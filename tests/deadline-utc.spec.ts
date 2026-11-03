// The entry deadline is shown in UTC everywhere public (Daniel, 3 Nov 2026): 15:59 UTC on
// 17 January 2027, which is the end of that day in Malaysia. No built page may show the
// deadline in Malaysia time. Both test builds (the normal one and the entries-open one, see
// playwright.config.ts) are built before any test runs; this reads every page, the sitemap and
// the other text files in both. (Internal scheduling under tools/social/publish stays on Malaysia
// time on purpose: it is not part of the site.)
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
  { what: 'the abbreviation for Malaysia time', re: new RegExp('\\bM' + 'YT\\b') },
  { what: 'the words "Malaysia time"', re: new RegExp('Malaysia\\s+' + 'time', 'i') },
];

for (const build of BUILDS) {
  test(`${build.name}: no page shows the deadline in Malaysia time`, () => {
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

  test(`${build.name}: the Rules page gives the deadline as 15:59 UTC`, () => {
    const rules = readFileSync(join(build.dir, 'rules', 'index.html'), 'utf8');
    expect(rules).toContain('15:59 UTC');
  });
}
