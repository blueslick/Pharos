// The entry fee is in US dollars only (Daniel, 2 Nov 2026). The two test builds (the normal one,
// where REGISTRATION_OPEN is false, and the entries-open one, where it is true: see
// playwright.config.ts) are built before any test runs. This reads every page, the sitemap and the
// other text files in both builds and fails if any of them names the old currency or shows an amount in it
// (the word for it in any case, its three-letter code, or its two-letter symbol followed by a number).
// The patterns are built from pieces so this file does not trip the repo-wide check for those words.
import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const BUILDS = [
  { name: 'REGISTRATION_OPEN false', dir: 'dist-test' },
  { name: 'REGISTRATION_OPEN true', dir: 'dist-test-open' },
];
const TEXT_FILES = new Set(['.html', '.xml', '.txt', '.webmanifest', '.json']);

function textFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...textFiles(path));
    else if (TEXT_FILES.has(extname(name))) out.push(path);
  }
  return out;
}

const BANNED: { what: string; re: RegExp }[] = [
  { what: 'the currency name', re: new RegExp('ring' + 'git', 'i') },
  { what: 'the three-letter currency code', re: new RegExp('M' + 'YR') },
  { what: 'the two-letter symbol followed by a number', re: new RegExp('\\bR' + 'M\\s?\\d') },
];

for (const build of BUILDS) {
  test(`${build.name}: no page names or prices anything in the old currency`, () => {
    const files = textFiles(build.dir);
    expect(files.length, `no built files found in ${build.dir}`).toBeGreaterThan(5);
    const problems: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const { what, re } of BANNED) {
        const m = re.exec(text);
        if (m) problems.push(`${file}: ${what} near "${text.slice(Math.max(0, m.index - 30), m.index + 40).replace(/\s+/g, ' ')}"`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
}
