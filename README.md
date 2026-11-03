# Pharos

**Pharos is an essay competition for students, with a Junior and an Open category, built around the UN Sustainable Development Goals. Each edition takes one goal; the inaugural edition is Goal 2, Zero Hunger, and is a fundraiser for The Assembly Soup Kitchen (T.A.S.K). It is run by student volunteers.**

This repo is the website and the small tools that support it. The live site is at https://pharosprize.org and the code lives at https://github.com/blueslick/Pharos (`blueslick/Pharos`).

The name comes from the lighthouse of Alexandria, which guided ships in beside the greatest library of the ancient world.

## Key facts live in one place

`src/site.ts` is the single source for the entry fee, prizes, categories, dates, bank details, the soup kitchen's name, the contact email and the site name. Pages read from it; the README deliberately does not repeat those values, so it can't go stale. To change one, change it in `src/site.ts` and nowhere else.

## Running it

You need Node.js 20 or newer.

```sh
npm install      # once
npm run dev      # local preview at http://localhost:4321
npm run build    # writes the finished site to dist/
npm run preview  # serves the built dist/ folder locally
```

The live address is set once, as `site` in `astro.config.mjs`; canonical links, Open Graph URLs and the sitemap all follow it (`public/robots.txt` names the sitemap, so update it too if the domain ever changes).

### Tests

```sh
npm test         # the site's Playwright tests (builds the site twice, then checks it)
```

The first time, Playwright may ask for a browser: run `npx playwright install chromium`. The tests use fake certificates and build into `dist-test/` and `dist-test-open/`, so the real `dist/` and `src/data/certificates.json` are never touched.

The tools have their own tests, run from the folder named:

```sh
python3 -m unittest discover -s tests -v   # in tools/entry-admin (see its README for setup)
python3 -m pytest tools/judging            # from the repo folder (see tools/judging/README.md)
npm test                                   # in tools/social (see its README for setup)
```

## How changes go live

1. Work happens on a branch, never directly on `main`.
2. Open a pull request into `main`. GitHub Actions builds the site and posts a **preview link** on the PR.
3. The PR also gets an **entries-open preview** (bank details visible, hidden from search engines), so the owner can see the open state before launch.
4. The owner reviews both previews and merges the PR. The merge is the approval.
5. A merge to `main` makes GitHub Actions deploy the **live site** to Firebase Hosting.

Nobody runs `firebase` commands by hand: the Actions workflows in `.github/workflows/` do every deploy. For the full rules (who may merge, how follow-up changes work, what is off-limits) see [`CLAUDE.md`](CLAUDE.md), under "Branch, pull request, review".

## Entering the competition

Entries go through an external Tally form, linked from the site by `REGISTRATION_URL` in `src/site.ts`. The site never collects entries or money: it links to the form, and the fee is paid by bank transfer outside the site, as the Register page explains once entries are open.

## Where things are

| Path | What |
|---|---|
| `src/site.ts` | The single source for the fee, prizes, categories, dates, bank details, soup kitchen name, prompts and rubric. |
| `tokens.json` | Every colour, type size, space and radius. Turned into CSS custom properties by `src/lib/tokens.ts`. |
| `src/pages/` | One file per page. |
| `src/components/` | Shared pieces: header (`Hero`, `Nav`), footer, waitlist, edition cover. |
| `src/lib/nasiLemak.ts` | Draws the edition cover mosaic at build time. |
| `src/data/` | The encrypted certificate records for the Verify page (see its `README.md`). |
| `tests/` | The site's Playwright tests (`npm test`). |
| `tools/entry-admin/` | Weekly entry checks: turns the Tally export into a tracker, email drafts, fee-support codes and an anonymous judging folder. Its fee lines in `config.toml` must match the Tally form word for word, or every entry gets flagged. |
| `tools/judging/` | Scoring sheet, ranking and certificates for after entries close. |
| `tools/social/` | Instagram posts built from plain text files in the Pharos look, plus the publisher (`tools/social/publish/`) that posts approved ones on schedule. |
| `public/` | Files served as they are: the judging criteria PDF, the share image (`og-image.png`), the icons and favicons, `robots.txt`, and `images/` (the lighthouse mosaics and the soup kitchen logo). |
| `.github/workflows/` | The deploy and Instagram publishing workflows. |
| `PLACEHOLDERS.md` | Everything still waiting to be filled in. |

## Two modes: hook, then facts

Every page has two jobs. Big Gloock headlines, slabs, arches and rings hook people on the first screen; everything that matters sits right underneath in calm, plain Instrument Sans. Anything said in giant type is also said in plain text on the same screen, so a teacher skimming on a phone learns what this is and who runs it in a few seconds.

## Visual foundations

**Colour.** Light only, on a peach ground. Plum for text and the big dark slabs, slate for the second slab colour, cream for text on slabs and as the reading ground for blog posts. Coral and dusty pink are fills (buttons, cards, rings), never text on cream or peach. Two sea blues from the lighthouse images are used sparingly.

**The edition colour.** `edition` is the only token that changes between editions (SDG 2 mustard now). It appears in the egg yolk of the edition cover and as the "Now" goal on About, never as text.

**Type.** Gloock for display, Instrument Sans for all reading text and labels (sentence case, never tracked-out capitals). Kaushan Script only for the Pharos wordmark: a decorative accent, never body text or essential information. All self-hosted.

**Shapes.** Slabs with one big rounded corner, half-round cards, arches and concentric rings, with a risograph grain over every page.

**The edition cover.** A circle holding a mosaic of patterned tiles in the brand palette. The frame stays the same every edition; only the picture inside changes. This edition's picture is a plate of nasi lemak.

## Content rules

- Never call the organisation a charity, non-profit, NGO or foundation. Use "run by student volunteers" and "a fundraiser for The Assembly Soup Kitchen (T.A.S.K)".
- The soup kitchen is named with written permission. On the site, always use `SOUP_KITCHEN_NAME` in `src/site.ts`; never hard-code or re-spell it.
- No invented people, quotes, statistics, testimonials or past editions.
- No official SDG icons, UN logo or colour wheel. Name goals in text only.
- No photos of people being served or in poverty.

## Accessibility

Body text is never under 16px and every text colour pair passes 4.5:1. Buttons are at least 48px tall. Every image has alt text, including the edition cover.
