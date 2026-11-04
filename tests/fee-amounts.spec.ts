// Money wording (Daniel and Adrian, 4 Nov 2026): the Malaysian ringgit (MYR) amount is the price everywhere. US dollars
// appear only as an "about" guide, never on their own. The two test builds (the normal one, where REGISTRATION_OPEN is
// false, and the entries-open one, where it is true: see playwright.config.ts) are built before any test runs. This
// reads every page, the sitemap and the other text files in both builds and fails if any of them:
//  - shows an MYR (or RM) amount other than 40 (fee), 200 and 400 (prizes);
//  - shows a USD amount other than 10, 50 or 100, or one that is not directly preceded by "about " (the one exception
//    is the full prize wording, "about USD 50 and USD 100 at current FOREX rates", where the second figure follows "and");
//  - names an exchange rate (the one allowed sentence, CURRENCY_NOTE, names no rate and is taken out before this check),
//    or writes "1 USD = 4.06 MYR" in any form;
//  - says "funded separately" (we do not say who funds the prizes) or "Malaysian Ringgit" with capitals;
//  - still says "US dollars" or shows an amount in any other currency symbol.
// A separate check at the end: the first currency amount on Competition, Rules, FAQ and Register is in MYR, not USD.
import { test, expect } from '@playwright/test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const BUILDS = [
  { name: 'REGISTRATION_OPEN false', dir: 'dist-test' },
  { name: 'REGISTRATION_OPEN true', dir: 'dist-test-open' },
];
const TEXT_FILES = new Set(['.html', '.xml', '.txt', '.webmanifest', '.json']);
const ALLOWED_MYR = new Set(['40', '200', '400']);
const ALLOWED_USD = new Set(['10', '50', '100']);
const CURRENCY_NOTE =
  'All amounts are set and paid in Malaysian ringgit (MYR). US dollar (USD) figures are a guide only, based on foreign exchange (FOREX) rates as of 5 November 2026, and may change; the entry fee is always MYR 40.';

function textFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...textFiles(path));
    else if (TEXT_FILES.has(extname(name))) out.push(path);
  }
  return out;
}

const around = (text: string, index: number) => text.slice(Math.max(0, index - 30), index + 40).replace(/\s+/g, ' ');

for (const build of BUILDS) {
  test(`${build.name}: the only amounts are MYR 40, 200 and 400, and every USD amount is an "about" guide`, () => {
    const files = textFiles(build.dir);
    expect(files.length, `no built files found in ${build.dir}`).toBeGreaterThan(5);
    const problems: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/\b(?:MYR|RM)\s?(\d+(?:[.,]\d+)*)/g)) {
        if (!ALLOWED_MYR.has(m[1])) problems.push(`${file}: MYR amount "${m[0]}" near "${around(text, m.index!)}"`);
      }
      for (const m of text.matchAll(/\bUSD\s?(\d+(?:[.,]\d+)*)/g)) {
        if (!ALLOWED_USD.has(m[1])) problems.push(`${file}: USD amount "${m[0]}" near "${around(text, m.index!)}"`);
        const before = text.slice(Math.max(0, m.index! - 40), m.index!);
        // "about USD 10", or the second figure of "about USD 50 and USD 100"
        if (!/about $/.test(before) && !/about USD \d+ and $/.test(before)) {
          problems.push(`${file}: USD amount "${m[0]}" is not directly preceded by "about " near "${around(text, m.index!)}"`);
        }
      }
      const withoutNote = text.split(CURRENCY_NOTE).join('');
      for (const [what, re] of [
        ['"US dollars"', /US dollars?|United States Dollar/i],
        ['an exchange rate', /exchange rate|conversion rate|rate of (MYR|RM|USD)/i],
        ['an exchange-rate figure such as 1 USD = 4.06 MYR', /\d\s?(USD|MYR|RM)\s?=|=\s?\d[\d.,]*\s?(USD|MYR|RM)/],
        ['"funded separately"', /funded separately/i],
        ['"Malaysian Ringgit" (write "ringgit" in lower case)', /Malaysian Ringgit/],
        ['a dollar, pound, euro or other currency symbol before a number', /[$£€]\s?\d/],
      ] as const) {
        const m = re.exec(withoutNote);
        if (m) problems.push(`${file}: ${what} near "${around(withoutNote, m.index)}"`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
}

// The first currency amount in the visible text is ringgit: MYR leads, USD only follows as a guide.
const PAGES: { name: string; base: string; path: string }[] = [
  { name: 'Competition', base: 'http://localhost:4331', path: '/competition/' },
  { name: 'Rules', base: 'http://localhost:4331', path: '/rules/' },
  { name: 'FAQ', base: 'http://localhost:4331', path: '/faq/' },
  { name: 'Register (entries-open build)', base: 'http://localhost:4332', path: '/register/' },
];
for (const p of PAGES) {
  test(`${p.name}: the first currency amount in the page text is MYR, not USD`, async ({ page }) => {
    await page.goto(`${p.base}${p.path}`);
    // textContent, not innerText: the FAQ answers are in collapsed <details>, which innerText leaves out
    const text = (await page.locator('main').textContent()) ?? '';
    const first = /(MYR|USD)\s?\d/.exec(text); // no \b: textContent can join a label and its value ("FeeMYR 40")
    expect(first, `no currency amount found on ${p.path}`).not.toBeNull();
    expect(first![1], `first amount on ${p.path} is "${first![0]}" near "${around(text, first!.index)}"`).toBe('MYR');
  });
}

test('REGISTRATION_OPEN false: the bank account number appears nowhere before launch (the FAQ names the SWIFT code, nothing else does)', () => {
  const swiftIn: string[] = [];
  for (const file of textFiles('dist-test')) {
    const text = readFileSync(file, 'utf8');
    expect(text, file).not.toContain('262111-00010155');
    if (text.includes('RHBBMYKL')) swiftIn.push(file.replace(/\\/g, '/'));
  }
  expect(swiftIn).toEqual(['dist-test/faq/index.html']);
});

test('REGISTRATION_OPEN true: /register/ names MYR 40 as the amount to transfer', () => {
  const html = readFileSync('dist-test-open/register/index.html', 'utf8');
  expect(html).toContain('MYR 40');
  expect(html).toContain('Malaysian ringgit (MYR)');
  expect(html).toContain('RHBBMYKL');
});

// Every "about USD" figure says what date it is based on (T145 follow-up). The date is FX_DATE in src/site.ts; it is read
// from the file's text because site.ts cannot be imported here (it uses import.meta.env).
const siteSource = readFileSync('src/site.ts', 'utf8');
const FX_DATE = siteSource.match(/export const FX_DATE = '([^']+)'/)![1];
const FX_DATED_LINE = `USD figures are approximate, based on FOREX rates as of ${FX_DATE}.`;

test('the FX date is 5 November 2026 and the dated line is built from it', () => {
  expect(FX_DATE).toBe('5 November 2026');
  expect(siteSource).toContain('export const FX_DATED_LINE = `USD figures are approximate, based on FOREX rates as of ${FX_DATE}.`;');
});

for (const build of BUILDS) {
  test(`${build.name}: every page that shows an "about USD" figure also says "as of ${FX_DATE}"`, () => {
    const withGuide: string[] = [];
    const missing: string[] = [];
    for (const file of textFiles(build.dir).filter((f) => f.endsWith('.html'))) {
      const html = readFileSync(file, 'utf8');
      if (!/about USD \d/.test(html)) continue;
      withGuide.push(file);
      if (!html.includes(`as of ${FX_DATE}`)) missing.push(file);
    }
    expect(withGuide.length, 'expected the Competition, Rules, FAQ pages to show an "about USD" figure').toBeGreaterThan(2);
    expect(missing, `pages with an "about USD" figure but no "as of ${FX_DATE}"`).toEqual([]);
  });
}

// The Instagram posts: every slide that shows a USD figure carries the dated line, and every caption or alt text
// that mentions an "about USD" figure (or carries the currency note) says "as of <date>".
const POSTS = 'tools/social/posts';
test('Instagram slides, captions and alt texts: every USD figure is dated', () => {
  expect(existsSync(POSTS)).toBe(true);
  const problems: string[] = [];
  let slidesWithUsd = 0;
  for (const dir of readdirSync(POSTS)) {
    const base = join(POSTS, dir);
    if (!statSync(base).isDirectory() || dir.startsWith('example')) continue;
    for (const name of readdirSync(base).filter((n) => /^slide-.*\.html$/.test(n))) {
      const html = readFileSync(join(base, name), 'utf8');
      if (!/USD/.test(html)) continue;
      slidesWithUsd++;
      if (!html.includes(FX_DATED_LINE)) problems.push(`${base}/${name}: shows a USD figure without "${FX_DATED_LINE}"`);
    }
    const yamlPath = join(base, 'post.yaml');
    if (!existsSync(yamlPath)) continue;
    const yaml = readFileSync(yamlPath, 'utf8');
    const at = yaml.indexOf('\nslides:');
    const caption = at === -1 ? yaml : yaml.slice(0, at);
    // caption: the currency note ("US dollar (USD) figures are a guide only") must carry the date
    if (/about USD \d|US dollar \(USD\)/.test(caption) && !caption.includes(`as of ${FX_DATE}`)) {
      problems.push(`${yamlPath}: the caption mentions USD without "as of ${FX_DATE}"`);
    }
    for (const line of yaml.split('\n').filter((l) => /^\s+alt:/.test(l))) {
      if (/about USD \d/.test(line) && !line.includes(FX_DATED_LINE)) problems.push(`${yamlPath}: an alt text mentions "about USD" without the dated line: ${line.trim().slice(0, 60)}...`);
    }
  }
  expect(slidesWithUsd, 'expected slides 01-03/04, 02 and 05 to show a USD figure').toBeGreaterThanOrEqual(4);
  expect(problems, problems.join('\n')).toEqual([]);
});
