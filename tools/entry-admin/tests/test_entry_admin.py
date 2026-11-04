"""Run from tools/entry-admin:   python -m unittest discover -s tests -v

Builds the fake sample data in a temp folder and checks every flag, plus re-runs, emails and the judging pack.
"""
from __future__ import annotations

import csv
import re
import sys
import tomllib
import tempfile
import unittest
from pathlib import Path

from openpyxl import load_workbook
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "sample"))

import make_sample  # noqa: E402
from entry_admin import run  # noqa: E402
from entryadmin import config, emails, pack, tracker  # noqa: E402
from entryadmin.config import ConfigError  # noqa: E402
from entryadmin.xlsxutil import read_table  # noqa: E402

FORBIDDEN = ("charity", "non-profit", "nonprofit", "not-for-profit", "ngo", "foundation", "society",
              "united nations", "global goals")


class Base(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self._tmp.name)
        self.info = make_sample.build(self.dir)
        self.n = len(self.info["entries"])
        self.cfg = config.load(self.dir / "config.toml")
        self.addCleanup(self._tmp.cleanup)

    def process(self):
        return tracker.process(self.cfg)

    def table(self):
        return read_table(self.cfg.path("tracker"))

    def by_key(self):
        """sample key (e.g. 'over') -> tracker row."""
        sid_to_key = dict(self.info["entries"])
        return {sid_to_key[r["Submission ID"]]: r for r in self.table() if r["Submission ID"] in sid_to_key}

    def flags(self):
        return {k: {key for key, _ in tracker.raised_flags(r)} for k, r in self.by_key().items()}

    def eid(self, key):
        """The Entry ID the tracker gave a sample entry, e.g. eid('over') -> 'ZH-002'."""
        return self.by_key()[key]["Entry ID"]

    def csv_rows(self):
        with (self.dir / "tally-export.csv").open(encoding="utf-8-sig", newline="") as f:
            return list(csv.DictReader(f))

    def write_csv_rows(self, rows):
        with (self.dir / "tally-export.csv").open("w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0]))
            w.writeheader()
            w.writerows(rows)

    def edit_tracker(self, **by_key_edits):
        """by_key_edits: sample key -> {column: value}. Types into the tracker like the owner would."""
        path = self.cfg.path("tracker")
        wb = load_workbook(path)
        ws = wb.active
        headers = [c.value for c in ws[1]]
        sid_to_key = dict(self.info["entries"])
        for row in ws.iter_rows(min_row=2):
            key = sid_to_key.get(row[headers.index("Submission ID")].value)
            for col, val in by_key_edits.get(key, {}).items():
                row[headers.index(col)].value = val
        wb.save(path)


class TestFlags(Base):
    def test_every_flag(self):
        self.process()
        f = self.flags()
        expected = {
            "clean": set(), "limit800": set(), "age20": set(), "named_essay": set(),
            "over": {"over_word_limit"}, "limit801": {"over_word_limit"},
            "scanned": {"pdf_problem"}, "corrupt": {"pdf_problem"}, "nofile": {"pdf_problem"},
            "dupemail": {"duplicate_entrant"},
            "dupname_a": {"duplicate_entrant"}, "dupname_b": {"duplicate_entrant"},
            "old": set(),
            "noproof": {"no_proof"},
            "txn_a": {"duplicate_transfer"}, "txn_b": {"duplicate_transfer"},
            "multi": {"over_word_limit", "age_unclear", "no_proof"},
            "fee_other": {"fee"}, "nonlatin": {"name_not_latin"}, "accents": set(),
            "gdoc": {"pdf_problem"}, "other_url": {"pdf_problem"}, "few_words": {"pdf_problem"},
            "docx": {"pdf_problem"}, "nonlatin_multi": {"name_not_latin", "age_unclear"},
            "age25": set(), "age18": set(),
            "age26": {"age_over_open"}, "age99": {"age_over_open"},
            "minor_none": {"parent_email"}, "minor_self": {"parent_email"},
        }
        # 'clean' shares an email with 'dupemail', so both are flagged
        expected["clean"] = {"duplicate_entrant"}
        self.assertEqual(f, expected)

    def test_flag_details(self):
        self.process()
        r = self.by_key()
        self.assertTrue(r["scanned"]["PDF problem"].startswith("Scanned"))
        self.assertTrue(r["corrupt"]["PDF problem"].startswith("Unreadable"))
        self.assertTrue(r["nofile"]["PDF problem"].startswith("Missing"))
        self.assertTrue(r["multi"]["Age unclear"].startswith("Unclear"))
        self.assertTrue(r["fee_other"]["Fee problem"].startswith("Unclear"))
        self.assertIn("李明", r["nonlatin"]["Non-Latin name"])
        for k in ("gdoc", "other_url", "few_words", "docx"):  # anything that isn't a PDF upload
            self.assertTrue(r[k]["PDF problem"].startswith("Not a PDF"), k)
            self.assertEqual(r[k]["Word count"], "")
        self.assertIn("docs.google.com", r["gdoc"]["PDF problem"])
        self.assertIn("see my email", r["few_words"]["PDF problem"])

    def test_open_category_is_25_and_under(self):
        """25 is fine; 26 and the form's own cap of 99 are flagged for a manual check, red, with the age in the text."""
        self.process()
        r = self.by_key()
        self.assertEqual(self.cfg["entry"]["open_max_age"], 25)
        self.assertEqual(r["age25"]["Over Open age limit"], "")
        for key, age in (("age26", 26), ("age99", 99)):
            text = r[key]["Over Open age limit"]
            self.assertIn(f"age is {age}", text)
            self.assertIn("Open is 25 and under", text)
        self.assertEqual(r["old"]["Over Open age limit"], "")  # 23

    def test_under_18_needs_a_parent_or_guardian_email(self):
        self.process()
        r = self.by_key()
        self.assertTrue(r["minor_none"]["Parent email missing"].startswith("Missing"))
        self.assertTrue(r["minor_self"]["Parent email missing"].startswith("Same email"))  # their own address, any capitals
        for key in ("clean", "age18", "age20", "age25"):  # 17 with a parent's email, and adults, are fine
            self.assertEqual(r[key]["Parent email missing"], "", key)

    def test_a_csv_without_the_secondary_email_column_flags_nobody_but_says_so(self):
        rows = self.csv_rows()
        for row in rows:
            del row["Secondary email"]
        self.write_csv_rows(rows)
        result = self.process()
        self.assertFalse(any("parent_email" in f for f in self.flags().values()))
        self.assertTrue(any("Secondary email" in n and "NOT checked" in n for n in result["notes"]))

    def test_word_count_is_exact_on_simple_pdfs(self):
        self.process()
        r = self.by_key()
        self.assertEqual(r["limit800"]["Word count"], 800)
        self.assertEqual(r["limit801"]["Word count"], 801)

    def test_unreadable_pdf_gets_no_word_count(self):
        self.process()
        self.assertEqual(self.by_key()["corrupt"]["Word count"], "")

    def test_two_entries_pointing_at_same_file_are_flagged(self):
        src = self.dir / "tally-export.csv"
        rows = self.csv_rows()
        rows[1]["Your essay (PDF)"] = rows[0]["Your essay (PDF)"]
        self.write_csv_rows(rows)
        self.process()
        f = self.flags()
        self.assertIn("pdf_problem", f["clean"])
        self.assertIn("pdf_problem", f["over"])

    def test_essay_answer_kinds(self):
        from entryadmin.pdfs import classify_essay
        pdf = "https://storage.tally.so/private/My%20Essay.PDF?id=1&signature=x"
        self.assertEqual(classify_essay("")[0], "empty")
        self.assertEqual(classify_essay("   ")[0], "empty")
        self.assertEqual(classify_essay(pdf)[0], "upload")
        self.assertEqual(classify_essay(pdf + ", " + pdf)[0], "upload")
        for bad in ("https://docs.google.com/document/d/abc/edit", "https://example.com/essay",
                    "https://storage.tally.so/private/essay.docx?id=1", "https://storage.tally.so/private/essay.pdf.exe",
                    "here you go", " ".join(["a long pasted essay"] * 100)):
            self.assertEqual(classify_essay(bad)[0], "notpdf", bad)

    def test_links_are_never_fetched(self):
        import socket
        def boom(*a, **k):
            raise AssertionError("network used")
        real = socket.socket.connect
        socket.socket.connect = boom
        try:
            self.process()
        finally:
            socket.socket.connect = real
        self.assertEqual(self.flags()["gdoc"], {"pdf_problem"})

    def test_pasted_text_is_a_pdf_problem_with_no_word_count(self):
        rows = self.csv_rows()
        rows[0]["Your essay (PDF)"] = " ".join(["word"] * 850)
        self.write_csv_rows(rows)
        self.process()
        r = self.by_key()["clean"]
        self.assertTrue(r["PDF problem"].startswith("Not a PDF"))
        self.assertEqual(r["Word count"], "")
        self.assertEqual(r["Over word limit"], "")

    def test_blank_essay_is_a_pdf_problem(self):
        rows = self.csv_rows()
        rows[0]["Your essay (PDF)"] = ""
        self.write_csv_rows(rows)
        self.process()
        self.assertTrue(self.by_key()["clean"]["PDF problem"].startswith("Missing"))

    def test_non_latin_names(self):
        from entryadmin.tracker import non_latin_chars
        self.assertEqual(non_latin_chars("Ada Lovelace-Smith O'Neil"), "")
        self.assertEqual(non_latin_chars("José Álvarez"), "")
        self.assertEqual(non_latin_chars("Анна Ivanova"), "Анна")
        self.assertEqual(non_latin_chars("محمد Ali"), "محمد")
        self.assertEqual(non_latin_chars("김민수"), "김민수")

    def test_fee_answer_must_be_the_one_fee_but_ignores_case_and_spacing(self):
        rows = self.csv_rows()
        rows[0]["Your entry fee"] = "  myr 40 (about usd 10 at current forex rates) "
        rows[1]["Your entry fee"] = "Fee support at 50%: USD 5"  # the old half-fee option no longer exists
        self.write_csv_rows(rows)
        self.process()
        f = self.flags()
        self.assertNotIn("fee", f["clean"])
        self.assertIn("fee", f["over"])

    def test_a_csv_without_the_fee_column_flags_nobody_but_says_so(self):
        rows = self.csv_rows()
        for row in rows:
            del row["Your entry fee"]
        self.write_csv_rows(rows)
        result = self.process()
        self.assertFalse(any("fee" in f for f in self.flags().values()))
        self.assertTrue(any("Your entry fee" in n and "NOT checked" in n for n in result["notes"]))

    def test_there_is_no_fee_support_anywhere_in_the_toolkit(self):
        self.assertEqual(list(self.cfg["fees"]), ["full", "statement_amount"])  # one fee; no half
        self.assertEqual(self.cfg["fees"]["full"], "MYR 40 (about USD 10 at current FOREX rates)")
        self.assertEqual(self.cfg["fees"]["statement_amount"], "MYR 40.00")  # what to match on T.A.S.K's statement
        self.assertNotIn("fee_code", self.cfg["columns"])
        for h in tracker.HEADERS:
            self.assertNotIn("support", h.lower())


class TestColumnMapping(Base):
    def test_renamed_question_is_a_one_line_fix(self):
        src = self.dir / "tally-export.csv"
        src.write_text(src.read_text(encoding="utf-8-sig").replace("Full name", "Your full name"), encoding="utf-8")
        with self.assertRaises(ConfigError) as cm:
            self.process()
        self.assertIn("full_name", str(cm.exception))
        self.assertIn("Your full name", str(cm.exception))  # shows what the CSV actually has
        cfg_file = self.dir / "config.toml"
        cfg_file.write_text(cfg_file.read_text().replace('full_name       = "Full name"',
                                                         'full_name       = "Your full name"'))
        self.cfg = config.load(cfg_file)
        self.process()
        self.assertEqual(self.by_key()["clean"]["Full name"], "Ada Example")

    def test_header_matching_ignores_case_and_extra_spaces(self):
        src = self.dir / "tally-export.csv"
        src.write_text(src.read_text(encoding="utf-8-sig").replace("Full name", "FULL  NAME"), encoding="utf-8")
        self.process()
        self.assertEqual(self.by_key()["clean"]["Full name"], "Ada Example")

    def test_semicolon_csv_from_excel(self):
        src = self.dir / "tally-export.csv"
        with src.open(encoding="utf-8-sig", newline="") as f:
            rows = list(csv.reader(f))
        with src.open("w", newline="", encoding="utf-8-sig") as f:
            csv.writer(f, delimiter=";").writerows(rows)
        self.process()
        self.assertEqual(len(self.table()), self.n)


class TestRerun(Base):
    def test_owner_columns_survive_and_only_new_entries_are_added(self):
        self.process()
        before = {r["Submission ID"]: r["Entry ID"] for r in self.table()}
        self.edit_tracker(clean={"Payment verified (Y/N)": "Y", "Notes": "Checked bank transfer", "Status": "Confirmed"},
                          over={"Notes": "Asked to shorten", "Status": "Pending"})
        # a new entry arrives, submitted LATER than the rest, and another one EARLIER
        src = self.dir / "tally-export.csv"
        rows = self.csv_rows()
        new = dict(rows[0], **{"Submission ID": "subNEW", "Submitted at": "2026-12-30 10:00:00",
                               "Full name": "New Person", "Email": "new@example.com", "Transfer reference or transaction ID": "TXNNEW"})
        early = dict(rows[0], **{"Submission ID": "subEARLY", "Submitted at": "2026-01-01 10:00:00",
                                 "Full name": "Early Person", "Email": "early@example.com", "Transfer reference or transaction ID": "TXNEARLY"})
        self.write_csv_rows([early] + rows + [new])
        r = self.process()
        self.assertEqual(sorted(r["new"]), [f"ZH-{self.n + 1:03d}", f"ZH-{self.n + 2:03d}"])
        after = {x["Submission ID"]: x for x in self.table()}
        for sid, eid in before.items():  # nobody renumbered
            self.assertEqual(after[sid]["Entry ID"], eid)
        self.assertEqual(len(after), self.n + 2)
        k = {v: kk for kk, v in dict(self.info["entries"]).items()}
        self.assertEqual(after[k["clean"]]["Payment verified (Y/N)"], "Y")
        self.assertEqual(after[k["clean"]]["Notes"], "Checked bank transfer")
        self.assertEqual(after[k["clean"]]["Status"], "Confirmed")
        self.assertEqual(after[k["over"]]["Notes"], "Asked to shorten")

    def test_rerun_with_no_changes_is_stable(self):
        self.process()
        a = self.table()
        r = self.process()
        self.assertEqual(r["new"], [])
        self.assertEqual(a, self.table())

    def test_new_duplicate_flags_older_entry_too(self):
        self.process()
        self.assertNotIn("duplicate_entrant", self.flags()["old"])
        src = self.dir / "tally-export.csv"
        rows = self.csv_rows()
        rows.append(dict(rows[0], **{"Submission ID": "subDUP", "Full name": "Someone Else",
                                     "Email": "JON@example.com ", "Transfer reference or transaction ID": "TXNDUP"}))
        self.write_csv_rows(rows)
        self.process()
        self.assertIn("duplicate_entrant", self.flags()["old"])

    def test_entry_missing_from_csv_is_kept(self):
        self.process()
        src = self.dir / "tally-export.csv"
        lines = src.read_text(encoding="utf-8-sig").splitlines()
        src.write_text("\n".join(lines[:-1]), encoding="utf-8")
        r = self.process()
        self.assertEqual(len(self.table()), self.n)
        self.assertTrue(any("not in this CSV" in n for n in r["notes"]))

    def test_extra_columns_added_by_owner_are_kept(self):
        self.process()
        path = self.cfg.path("tracker")
        wb = load_workbook(path)
        ws = wb.active
        ws.cell(row=1, column=ws.max_column + 1, value="Judge assigned")
        ws.cell(row=2, column=ws.max_column, value="Judge 3")
        wb.save(path)
        self.process()
        self.assertEqual(self.table()[0]["Judge assigned"], "Judge 3")

    def test_colour_coding(self):
        self.process()
        ws = load_workbook(self.cfg.path("tracker")).active
        headers = [c.value for c in ws[1]]
        sid_to_row = {ws.cell(row=i, column=2).value: i for i in range(2, ws.max_row + 1)}
        col = headers.index("Over word limit") + 1
        flagged = ws.cell(row=sid_to_row["sub002"], column=col)
        clean = ws.cell(row=sid_to_row["sub001"], column=col)
        self.assertEqual(flagged.fill.start_color.rgb[-6:], "F8CBAD")
        self.assertNotEqual(clean.fill.fill_type, "solid")
        dup = ws.cell(row=sid_to_row["sub008"], column=headers.index("Duplicate entrant") + 1)
        self.assertEqual(dup.fill.start_color.rgb[-6:], "FFE699")


class TestEmails(Base):
    def setUp(self):
        super().setUp()
        self.process()

    def draft(self, kind, eid):
        return (self.cfg.path("emails") / kind / f"{eid}.txt").read_text(encoding="utf-8")

    def test_received_for_everyone_and_nothing_left_unfilled(self):
        r = emails.make_drafts(self.cfg, "received")
        self.assertEqual(len(r["made"]), self.n)
        text = self.draft("received", "ZH-001")
        self.assertIn("To: ada@example.com", text)
        self.assertIn("Hi Ada,", text)
        self.assertIn("pharosprize@gmail.com", text)
        self.assertNotIn("[contact email]", text)
        self.assertIn("ZH-001", text)
        combined = (self.cfg.path("emails") / "received_ALL.txt").read_text(encoding="utf-8")
        self.assertIn(f"[ZH-{self.n:03d}]", combined)
        for eid in ("ZH-001", self.eid("named_essay")):
            body = self.draft("received", eid)
            self.assertNotRegex(body.replace("[contact email]", ""), r"[{}]")

    def test_payment_drafts_are_made_for_payment_flags_only(self):
        r = emails.make_drafts(self.cfg, "payment_not_found")
        # no_proof, duplicate_transfer (both entries) and the entry that has no proof AND other problems
        expected = {self.eid(k) for k in ("noproof", "txn_a", "txn_b", "multi")}
        self.assertEqual(set(r["made"]), expected)
        self.assertIn("proof of your payment", self.draft("payment_not_found", self.eid("noproof")))
        self.assertIn("already been used", self.draft("payment_not_found", self.eid("txn_a")))
        # the payment email says what to transfer, by when, and what happens if it is not found
        text = self.draft("payment_not_found", self.eid("noproof"))
        self.assertIn("MYR 40", text)
        self.assertIn("24 January 2027", text)
        self.assertIn("disqualified", text)
        self.assertNotRegex(text, r"[{}]")

    def test_rule_breakers_are_not_emailed(self):
        """Word count, PDF problem, name, age, parent email, duplicate entrant and fee answer are internal flags only."""
        r = emails.make_drafts(self.cfg, "payment_not_found")
        for key in ("over", "limit801", "scanned", "corrupt", "nofile", "gdoc", "other_url", "few_words", "docx",
                    "nonlatin", "nonlatin_multi", "age26", "age99", "minor_none", "minor_self", "dupemail",
                    "dupname_a", "dupname_b", "fee_other"):
            self.assertNotIn(self.eid(key), r["made"], key)
        # ... but they are still flagged in the tracker
        f = self.flags()
        self.assertEqual(f["over"], {"over_word_limit"})
        self.assertEqual(f["scanned"], {"pdf_problem"})
        self.assertEqual(f["minor_none"], {"parent_email"})
        # and no other kind of problem email exists
        self.assertEqual(emails.KINDS, ("received", "confirmed", "payment_not_found"))
        self.assertFalse((self.cfg.path("emails") / "problem").exists())

    def test_payment_email_lists_only_the_payment_problem_of_a_multi_problem_entry(self):
        emails.make_drafts(self.cfg, "payment_not_found")
        multi = self.draft("payment_not_found", self.eid("multi"))  # over the word limit, age unreadable, no proof
        self.assertIn("proof of your payment", multi)
        for leaked in ("900 words", "age on your entry form", "word limit", "PDF"):
            self.assertNotIn(leaked, multi)
        # nothing about other entrants leaks into an email
        self.assertNotRegex(self.draft("payment_not_found", self.eid("txn_a")), self.eid("txn_b"))
        self.assertNotRegex(self.draft("payment_not_found", self.eid("txn_b")), self.eid("txn_a"))

    def test_payment_verified_n_gets_the_payment_email(self):
        self.edit_tracker(clean={"Payment verified (Y/N)": "N"}, over={"Payment verified (Y/N)": "Y"})
        r = emails.make_drafts(self.cfg, "payment_not_found")
        self.assertIn("ZH-001", r["made"])        # checked on T.A.S.K's statement: not found or wrong amount
        self.assertNotIn("ZH-002", r["made"])     # verified: no payment email
        self.assertIn("could not find a transfer of MYR 40", self.draft("payment_not_found", "ZH-001"))

    def test_confirmed_needs_status_and_payment_verified(self):
        self.edit_tracker(clean={"Payment verified (Y/N)": "Y", "Status": "Confirmed"},
                          over={"Status": "Confirmed"})  # forgot to mark payment verified
        r = emails.make_drafts(self.cfg, "confirmed")
        self.assertEqual(r["made"], ["ZH-001"])
        self.assertTrue(any("ZH-002" in n for n in r["notes"]))
        self.assertIn("confirmed", self.draft("confirmed", "ZH-001"))

    def test_no_payment_email_once_decided_and_rejected_get_no_received(self):
        noproof = self.eid("noproof")
        self.edit_tracker(noproof={"Status": "Confirmed", "Payment verified (Y/N)": "Y"}, old={"Status": "Rejected"})
        self.assertNotIn(noproof, emails.make_drafts(self.cfg, "payment_not_found")["made"])
        self.assertNotIn("ZH-011", emails.make_drafts(self.cfg, "received")["made"])

    def test_second_run_only_drafts_new_things(self):
        self.assertEqual(len(emails.make_drafts(self.cfg, "received")["made"]), self.n)
        again = emails.make_drafts(self.cfg, "received")
        self.assertEqual(again["made"], [])
        self.assertEqual(again["skipped_already_drafted"], self.n)
        self.assertEqual(len(emails.make_drafts(self.cfg, "received", redo_all=True)["made"]), self.n)
        self.assertEqual(emails.make_drafts(self.cfg, "received", only={"ZH-004"})["made"], ["ZH-004"])

    def test_payment_draft_redone_when_payment_problems_change(self):
        emails.make_drafts(self.cfg, "payment_not_found")
        self.assertEqual(emails.make_drafts(self.cfg, "payment_not_found")["made"], [])
        # Jon (ZH-011) has no problem. A second entry now reuses his transfer reference, so both get a payment email.
        rows = self.csv_rows()
        rows[10]["Transfer reference or transaction ID"] = rows[0]["Transfer reference or transaction ID"]  # ZH-011 now duplicates ZH-001
        self.write_csv_rows(rows)
        self.process()
        made = emails.make_drafts(self.cfg, "payment_not_found")["made"]
        self.assertIn("ZH-011", made)
        self.assertIn("ZH-001", made)
        self.assertNotIn(self.eid("noproof"), made)  # unchanged: not drafted again

    def test_cli_sends_nothing_and_reports(self):
        self.assertEqual(run(["--config", str(self.dir / "config.toml"), "emails"]), 0)
        self.assertTrue((self.cfg.path("emails") / "payment_not_found_ALL.txt").exists())
        self.assertFalse((self.cfg.path("emails") / "problem_ALL.txt").exists())

    def test_templates_obey_content_red_lines(self):
        for f in (ROOT / "templates").iterdir():
            low = f.read_text(encoding="utf-8").lower()
            for word in FORBIDDEN:
                self.assertNotIn(word, low, f"{f.name} contains '{word}'")
        self.assertIn("run by student volunteers", (ROOT / "templates" / "received.txt").read_text())


class TestContactEmailMatchesSite(unittest.TestCase):
    def test_contact_email_matches_site_ts(self):
        """The address is typed in two places; fail if they ever drift apart. site.ts is only read."""
        site_ts = ROOT.parent.parent / "src" / "site.ts"
        if not site_ts.is_file():
            self.skipTest("src/site.ts not found (toolkit used outside the website repo)")
        m = re.search(r"""CONTACT_EMAIL\s*=\s*['"]([^'"]+)['"]""", site_ts.read_text(encoding="utf-8"))
        self.assertIsNotNone(m, "CONTACT_EMAIL not found in src/site.ts. Was it renamed? Update this test.")
        toolkit = tomllib.loads((ROOT / "config.toml").read_text(encoding="utf-8"))["email"]["contact_email"]
        self.assertEqual(toolkit, m.group(1),
                         "tools/entry-admin/config.toml [email] contact_email must match CONTACT_EMAIL in src/site.ts")


class TestNameInTheFileName(Base):
    """Entrants name the PDF with their full name and the essay title. Nothing may flag that."""

    def setUp(self):
        super().setUp()
        # Cara Exact (limit800) has no other problem. Her file is named like the Register page asks.
        self.fname = "Cara Exact - Who Gets to Eat.pdf"
        (self.dir / "downloads" / self.fname).write_bytes((self.dir / "downloads" / "essay-limit800.pdf").read_bytes())
        (self.dir / "downloads" / "essay-limit800.pdf").unlink()
        rows = self.csv_rows()
        row = next(r for r in rows if r["Full name"] == "Cara Exact")
        row["Your essay (PDF)"] = "https://storage.tally.so/private/Cara%20Exact%20-%20Who%20Gets%20to%20Eat.pdf?id=abc123&signature=fake"
        self.write_csv_rows(rows)
        self.process()

    def test_a_name_in_the_file_name_raises_no_flag_and_no_email(self):
        self.assertEqual(self.flags()["limit800"], set())
        self.assertEqual(self.by_key()["limit800"]["Essay file"], self.fname)
        self.assertEqual(self.by_key()["limit800"]["Word count"], 800)
        for kind in emails.KINDS:
            made = emails.make_drafts(self.cfg, kind)["made"]
            if kind != "received":
                self.assertNotIn(self.eid("limit800"), made, kind)

    def test_pack_does_not_warn_about_the_file_name_and_judges_never_see_it(self):
        eid = self.eid("limit800")
        self.edit_tracker(limit800={"Payment verified (Y/N)": "Y", "Status": "Confirmed"})
        r = pack.pack(self.cfg)
        self.assertEqual(r["packed"], [eid])
        self.assertEqual(r["warnings"], [])  # the name is in the file name only, not inside the essay
        self.assertEqual(sorted(p.name for p in self.cfg.path("judging").iterdir()), [f"{eid}.pdf", "key.xlsx"])


class TestPaymentEmailMatchesSite(unittest.TestCase):
    """The MYR 40 and the 24 January date are typed in config.toml and in src/site.ts; fail if they drift apart."""

    def test_fee_and_payment_fix_date_match_site_ts(self):
        site_ts = ROOT.parent.parent / "src" / "site.ts"
        if not site_ts.is_file():
            self.skipTest("src/site.ts not found (toolkit used outside the website repo)")
        src = site_ts.read_text(encoding="utf-8")
        fee = re.search(r"""ENTRY_FEE_MYR\s*=\s*['"]([^'"]+)['"]""", src)
        deadline = re.search(r"""deadline:\s*['"](\d{4})-(\d{2})-(\d{2})['"]""", src)
        grace = re.search(r"PAYMENT_GRACE_DAYS_AFTER_DEADLINE\s*=\s*(\d+)", src)
        self.assertTrue(fee and deadline and grace, "ENTRY_FEE_MYR, DATES.deadline or PAYMENT_GRACE_DAYS_AFTER_DEADLINE not found in src/site.ts")
        import datetime
        day = datetime.date(*map(int, deadline.groups())) + datetime.timedelta(days=int(grace.group(1)))
        cfg = tomllib.loads((ROOT / "config.toml").read_text(encoding="utf-8"))
        self.assertEqual(cfg["email"]["fee_myr"], fee.group(1))
        self.assertEqual(cfg["email"]["payment_fix_by"], f"{day.day} {day.strftime('%B %Y')}")
        # The statement amount to match is the ringgit fee with ".00" added.
        self.assertEqual(cfg["fees"]["statement_amount"], fee.group(1) + ".00")
        # The form's fee answer is the site's standard ENTRY_FEE wording.
        entry_fee = re.search(r"""ENTRY_FEE\s*=\s*['"]([^'"]+)['"]""", src)
        self.assertTrue(entry_fee, "ENTRY_FEE not found in src/site.ts")
        self.assertEqual(cfg["fees"]["full"], entry_fee.group(1))


class TestSampleDataIsFake(unittest.TestCase):
    """The committed sample files must never hold real people's details."""

    def test_every_sample_person_is_fake(self):
        sample = ROOT / "sample"
        with (sample / "tally-export.csv").open(encoding="utf-8-sig", newline="") as f:
            rows = list(csv.DictReader(f))
        self.assertGreater(len(rows), 20)
        for r in rows:
            self.assertTrue(r["Email"].endswith("@example.com"), r["Email"])
            self.assertEqual(r["School"], "Fake Example School")
            self.assertTrue(r["Submission ID"].startswith("sub"))

    def test_real_data_locations_are_git_ignored(self):
        import subprocess
        probes = ["work/submissions.csv", "work/tracker.xlsx", "work/judging/key.xlsx", "data/real/export.csv",
                  "real/export.csv", "downloads/essay.pdf", "export.csv", "tracker.xlsx", "judging/key.xlsx",
                  "emails/payment_not_found_ALL.txt", "sample/output/tracker.xlsx"]
        for rel in probes:
            r = subprocess.run(["git", "check-ignore", "-q", rel], cwd=ROOT, capture_output=True)
            if r.returncode == 128:
                self.skipTest("not inside a git checkout")
            self.assertEqual(r.returncode, 0, f"{rel} is not git-ignored")


class TestPack(Base):
    def setUp(self):
        super().setUp()
        self.process()

    def test_only_confirmed_and_verified_are_packed_with_anonymous_names(self):
        self.edit_tracker(clean={"Payment verified (Y/N)": "Y", "Status": "Confirmed"},
                          limit800={"Payment verified (Y/N)": "Y", "Status": "Confirmed"},
                          named_essay={"Payment verified (Y/N)": "Y", "Status": "Confirmed"},
                          over={"Status": "Confirmed"},                       # not verified: skipped
                          old={"Payment verified (Y/N)": "Y", "Status": "Rejected"})
        r = pack.pack(self.cfg)
        self.assertEqual(r["packed"], ["ZH-001", "ZH-003", "ZH-013"])
        out = self.cfg.path("judging")
        self.assertEqual(sorted(p.name for p in out.iterdir()), ["ZH-001.pdf", "ZH-003.pdf", "ZH-013.pdf", "key.xlsx"])
        self.assertTrue(any("ZH-002" in w for w in r["warnings"]))
        key = read_table(out / "key.xlsx")
        self.assertEqual([k["Entry ID"] for k in key], ["ZH-001", "ZH-003", "ZH-013"])
        self.assertEqual(key[0]["Full name"], "Ada Example")
        self.assertEqual(key[0]["Email"], "ada@example.com")

    def test_pdf_metadata_author_is_removed_and_text_kept(self):
        self.edit_tracker(clean={"Payment verified (Y/N)": "Y", "Status": "Confirmed"})
        src_author = PdfReader(str(self.dir / "downloads" / "essay-clean.pdf")).metadata.author
        self.assertEqual(src_author, "Ada Example")
        pack.pack(self.cfg)
        out = PdfReader(str(self.cfg.path("judging") / "ZH-001.pdf"))
        self.assertFalse(out.metadata and out.metadata.author)
        self.assertEqual(len(out.pages[0].extract_text().split()) > 10, True)

    def test_warns_when_essay_text_names_the_author(self):
        self.edit_tracker(named_essay={"Payment verified (Y/N)": "Y", "Status": "Confirmed"},
                          clean={"Payment verified (Y/N)": "Y", "Status": "Confirmed"})
        r = pack.pack(self.cfg)
        self.assertTrue(any("ZH-013.pdf" in w and "name" in w for w in r["warnings"]))
        self.assertFalse(any("ZH-001.pdf" in w for w in r["warnings"]))

    def test_entry_no_longer_confirmed_is_removed_from_judging(self):
        self.edit_tracker(clean={"Payment verified (Y/N)": "Y", "Status": "Confirmed"})
        pack.pack(self.cfg)
        self.assertTrue((self.cfg.path("judging") / "ZH-001.pdf").exists())
        self.edit_tracker(clean={"Status": "Rejected"})
        r = pack.pack(self.cfg)
        self.assertEqual(r["removed"], ["ZH-001.pdf"])
        self.assertFalse((self.cfg.path("judging") / "ZH-001.pdf").exists())

    def test_cli_pack(self):
        self.edit_tracker(clean={"Payment verified (Y/N)": "Y", "Status": "Confirmed"})
        self.assertEqual(run(["--config", str(self.dir / "config.toml"), "pack"]), 0)


if __name__ == "__main__":
    unittest.main()
