// MYR is the price; USD is only an "about" guide and never appears alone (owner decision, 4 Nov 2026, T141). The fee is
// MYR 40 (about USD 10), the prizes MYR 200 (about USD 50) and MYR 400 (about USD 100). T.A.S.K's account takes Malaysian
// Ringgit only. The two test builds (the normal one, where REGISTRATION_OPEN is false, and the entries-open one,
// where it is true: see playwright.config.ts) are built before any test runs. This reads every page, the
// sitemap and the other text files in both builds and fails if any of them:
//  - shows an MYR amount other than MYR 40, 200 or 400, or writes "RM" before a number;
//  - shows a USD amount that is not written "(about USD n)", or that does not go with its MYR amount
//    (MYR 40 / USD 10, MYR 200 / USD 50, MYR 400 / USD 100);
//  - names a live exchange rate, still says "US dollars", or shows an amount in any other currency symbol.
// It also checks that the one money note is on each page that shows money, once, and comes first.
import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const BUILDS = [
  { name: 'REGISTRATION_OPEN false', dir: 'dist-test' },
  { name: 'REGISTRATION_OPEN true', dir: 'dist-test-open' },
];
const TEXT_FILES = new Set(['.html', '.xml', '.txt', '.webmanifest', '.json']);
const MYR_TO_USD: Record<string, string> = { '40': '10', '200': '50', '400': '100' };
const MONEY_NOTE =
  'All amounts are set and paid in Malaysian ringgit (MYR). US dollar (USD) figures are a guide only and may change with foreign exchange (FOREX) rates; the entry fee is always MYR 40.';

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
  test(`${build.name}: money is MYR 40, 200 and 400, and USD only ever appears as "(about USD n)" after its MYR amount`, () => {
    const files = textFiles(build.dir);
    expect(files.length, `no built files found in ${build.dir}`).toBeGreaterThan(5);
    const problems: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/\bMYR\s?(\d+(?:[.,]\d+)*)/g)) {
        if (!(m[1] in MYR_TO_USD)) problems.push(`${file}: MYR amount "${m[0]}" near "${around(text, m.index!)}"`);
      }
      for (const m of text.matchAll(/\bRM\s?\d/g)) problems.push(`${file}: "RM" before a number near "${around(text, m.index!)}"`);
      const plain = text.replace(/<[^>]*>/g, ''); // tags removed, so "MYR 200 <span>(about USD 50)</span>" reads as one phrase
      for (const m of plain.matchAll(/\bUSD\s?(\d+(?:[.,]\d+)*)/g)) {
        const before = plain.slice(Math.max(0, m.index! - 40), m.index!);
        const pair = /\bMYR (\d+) \(about $/.exec(before);
        if (!pair) problems.push(`${file}: USD amount "${m[0]}" is not written "MYR n (about USD n)" near "${around(plain, m.index!)}"`);
        else if (MYR_TO_USD[pair[1]] !== m[1]) problems.push(`${file}: MYR ${pair[1]} is paired with USD ${m[1]} near "${around(plain, m.index!)}"`);
      }
      const withoutNote = text.split(MONEY_NOTE).join('');
      for (const [what, re] of [
        ['"US dollars"', /US dollars?/i],
        ['an exchange rate', /exchange rate|conversion rate|rate of (MYR|RM|USD)/i],
        ['"funded separately"', /funded separately/i],
        ['a dollar, pound, euro or other currency symbol before a number', /[$£€]\s?\d/],
      ] as const) {
        const m = re.exec(withoutNote);
        if (m) problems.push(`${file}: ${what} near "${around(withoutNote, m.index)}"`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
}

// Every page that shows money shows the one note, once, before the long "at current FOREX rates" wording,
// and spells out "foreign exchange (FOREX)" only that once.
const MONEY_PAGES = [
  { dir: 'dist-test', page: 'competition' },
  { dir: 'dist-test', page: 'rules' },
  { dir: 'dist-test', page: 'faq' },
  { dir: 'dist-test-open', page: 'register' },
];
for (const { dir, page } of MONEY_PAGES) {
  test(`/${page}/ (${dir}) shows the money note once, before the fee wording`, () => {
    const html = readFileSync(join(dir, page, 'index.html'), 'utf8');
    expect(html.split(MONEY_NOTE).length - 1, 'the money note appears exactly once').toBe(1);
    expect(html.split('foreign exchange (FOREX)').length - 1, '"foreign exchange (FOREX)" is spelled out exactly once').toBe(1);
    const long = html.indexOf('at current FOREX rates');
    if (long !== -1) expect(html.indexOf(MONEY_NOTE), 'the note comes before the long fee wording').toBeLessThan(long);
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
  expect(html).toContain('Malaysian Ringgit (MYR)');
  expect(html).toContain('RHBBMYKL');
});
