// Formal register (Daniel, 3 Nov 2026): every English page is written without contractions, exclamation marks or
// casual phrasing. This reads the text of every page in both test builds (the normal one and the entries-open one;
// see playwright.config.ts) and fails on any of them. The Malay Privacy page (/ms/) is not checked here.
// The owner-approved prompts (src/site.ts, PROMPTS) are quoted exactly and are allowed to keep their own wording.
import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BUILDS = [
  { name: 'REGISTRATION_OPEN false', dir: 'dist-test' },
  { name: 'REGISTRATION_OPEN true', dir: 'dist-test-open' },
];

// Wording that is approved exactly as written and must not be edited (the third prompt).
const APPROVED_EXACT = [
  "The Universal Declaration of Human Rights says everyone has a right to food. If that's true, who is responsible when someone goes hungry, and what should they be made to do about it?",
];

function pages(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === 'ms') continue;
      out.push(...pages(path));
    } else if (name.endsWith('.html')) out.push(path);
  }
  return out;
}

// The words a reader sees: page text plus the description meta tag (shown in search results and link previews).
function visibleText(html: string): string {
  const description = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? '';
  let text = html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<head>[\s\S]*?<\/head>/, ' ')
    .replace(/<[^>]+>/g, ' ');
  text = `${description} ${text}`
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/’/g, "'")
    .replace(/\s+/g, ' ');
  for (const exact of APPROVED_EXACT) text = text.replace(exact, ' ');
  return text;
}

const CHECKS: { what: string; re: RegExp }[] = [
  { what: 'a contraction', re: /\b\w+n't\b|\b\w+'(re|ll|ve|m|d)\b|\b(it|that|there|here|what|who|how|let|he|she)'s\b/i },
  { what: 'an exclamation mark', re: /!/ },
  { what: 'casual phrasing', re: /\b(yep|yeah|yup|gonna|wanna|gotta|a quick look|sort it out|sort out|kinda|sorta)\b/i },
];

for (const build of BUILDS) {
  test(`${build.name}: no English page uses a contraction, an exclamation mark or casual phrasing`, () => {
    const files = pages(build.dir);
    expect(files.length, `no built pages found in ${build.dir}`).toBeGreaterThan(8);
    const problems: string[] = [];
    for (const file of files) {
      const text = visibleText(readFileSync(file, 'utf8'));
      for (const { what, re } of CHECKS) {
        const m = re.exec(text);
        if (m) problems.push(`${file}: ${what} near "${text.slice(Math.max(0, m.index - 40), m.index + 50)}"`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
}
