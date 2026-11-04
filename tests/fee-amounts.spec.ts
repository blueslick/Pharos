// The fee is advertised as USD 10 and paid as exactly RM 40 (Daniel, 3 Nov 2026). T.A.S.K's account takes
// ringgit only. The two test builds (the normal one, where REGISTRATION_OPEN is false, and the entries-open one,
// where it is true: see playwright.config.ts) are built before any test runs. This reads every page, the
// sitemap and the other text files in both builds and fails if any of them:
//  - shows an RM amount other than RM 40, or a USD amount other than the fee (USD 10) and the two prizes
//    (USD 50 and USD 100, which the Competition page and Rules show);
//  - names an exchange rate;
//  - still says "US dollars" or shows an amount in any other currency symbol.
import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const BUILDS = [
  { name: 'REGISTRATION_OPEN false', dir: 'dist-test' },
  { name: 'REGISTRATION_OPEN true', dir: 'dist-test-open' },
];
const TEXT_FILES = new Set(['.html', '.xml', '.txt', '.webmanifest', '.json']);
const ALLOWED_RM = new Set(['40']);
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
  test(`${build.name}: the only amounts are USD 10 (fee), RM 40 (what is transferred) and the two prizes`, () => {
    const files = textFiles(build.dir);
    expect(files.length, `no built files found in ${build.dir}`).toBeGreaterThan(5);
    const problems: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/\bRM\s?(\d+(?:[.,]\d+)*)/g)) {
        if (!ALLOWED_RM.has(m[1])) problems.push(`${file}: RM amount "${m[0]}" near "${around(text, m.index!)}"`);
      }
      for (const m of text.matchAll(/\bUSD\s?(\d+(?:[.,]\d+)*)/g)) {
        if (!ALLOWED_USD.has(m[1])) problems.push(`${file}: USD amount "${m[0]}" near "${around(text, m.index!)}"`);
      }
      for (const [what, re] of [
        ['"US dollars"', /US dollars?/i],
        ['an exchange rate', /exchange rate|conversion rate|rate of (RM|USD)/i],
        ['a dollar, pound, euro or other currency symbol before a number', /[$£€]\s?\d/],
      ] as const) {
        const m = re.exec(text);
        if (m) problems.push(`${file}: ${what} near "${around(text, m.index)}"`);
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

test('REGISTRATION_OPEN true: /register/ names RM 40 as the amount to transfer', () => {
  const html = readFileSync('dist-test-open/register/index.html', 'utf8');
  expect(html).toContain('RM 40');
  expect(html).toContain('Malaysian ringgit (MYR)');
  expect(html).toContain('RHBBMYKL');
});
