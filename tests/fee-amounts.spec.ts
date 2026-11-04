// The fee is advertised as USD 10 and paid as exactly MYR 40 (Daniel, 3 Nov 2026; written MYR 40, not RM 40, from
// the expert review of 4 Nov 2026). T.A.S.K's account takes Malaysian Ringgit only. The two test builds (the normal one, where REGISTRATION_OPEN is false, and the entries-open one,
// where it is true: see playwright.config.ts) are built before any test runs. This reads every page, the
// sitemap and the other text files in both builds and fails if any of them:
//  - shows an MYR (or RM) amount other than MYR 40, or a USD amount other than the fee (USD 10) and the two prizes
//    (USD 50 and USD 100, which the Competition page and Rules show);
//  - names an exchange rate (the one allowed sentence, FX_NOTE: "Exchange rates change, but the amount you
//    transfer is always MYR 40.", names no rate and is taken out before this check);
//  - still says "US dollars" or shows an amount in any other currency symbol.
import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const BUILDS = [
  { name: 'REGISTRATION_OPEN false', dir: 'dist-test' },
  { name: 'REGISTRATION_OPEN true', dir: 'dist-test-open' },
];
const TEXT_FILES = new Set(['.html', '.xml', '.txt', '.webmanifest', '.json']);
const ALLOWED_MYR = new Set(['40']);
const FX_NOTE = 'Exchange rates change, but the amount you transfer is always MYR 40.';
const ALLOWED_USD = new Set(['10', '50', '100']);

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
  test(`${build.name}: the only amounts are USD 10 (fee), MYR 40 (what is transferred) and the two prizes`, () => {
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
      }
      const withoutFxNote = text.split(FX_NOTE).join('');
      for (const [what, re] of [
        ['"US dollars"', /US dollars?/i],
        ['an exchange rate', /exchange rate|conversion rate|rate of (MYR|RM|USD)/i],
        ['a dollar, pound, euro or other currency symbol before a number', /[$£€]\s?\d/],
      ] as const) {
        const m = re.exec(withoutFxNote);
        if (m) problems.push(`${file}: ${what} near "${around(withoutFxNote, m.index)}"`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
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
