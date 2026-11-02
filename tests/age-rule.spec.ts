// The age rule: Junior is 14 and under, Open is 25 and under, counted on 17 January 2027. The old wording
// ("any age", "no upper age limit") must be gone from every page in both builds. Port 4331 is the normal
// build, 4332 the entries-open preview (see playwright.config.ts).
import { test, expect } from '@playwright/test';

const builds = [['normal', 'http://localhost:4331'], ['entries-open', 'http://localhost:4332']] as const;
const pages = ['/', '/competition/', '/about/', '/blog/', '/contact/', '/register/', '/privacy/', '/ms/privacy/', '/verify/', '/rules/', '/faq/'];

// The only two places the old wording may still be written: the "previously any age" note on the Rules page,
// and the FAQ question about a poster that still says it (which the answer corrects).
const allowed = ['(previously any age)', 'I saw a poster that says Open is for any age. Which is right?'];
const oldWording = /any age|no upper (age )?limit|upper age|of any age|all ages/i;

for (const [name, base] of builds) {
  test.describe(`${name} build`, () => {
    for (const path of pages) {
      test(`${path} never says Open is for any age, in the page or its meta tags`, async ({ request }) => {
        let html = await (await request.get(`${base}${path}`)).text();
        for (const phrase of allowed) html = html.split(phrase).join('');
        expect(html).not.toMatch(oldWording);
      });
    }
  });
}

test('Home says Open is 25 and under, in its description', async ({ request }) => {
  const html = await (await request.get('http://localhost:4331/')).text();
  expect(html).toContain('a Junior category (14 and under) and an Open category (25 and under)');
});

test('Competition says Open is 25 and under, in the category card and the description', async ({ page, request }) => {
  await page.goto('http://localhost:4331/competition/');
  await expect(page.locator('.cat--open .cat__who')).toHaveText('25 and under');
  await expect(page.locator('.cat--junior .cat__who')).toHaveText('14 and under');
  const html = await (await request.get('http://localhost:4331/competition/')).text();
  expect(html).toContain('Junior (14 and under) and Open (25 and under)');
});

test('the Rules page says "25 and under" and no "any age" in the rules', async ({ page }) => {
  await page.goto('http://localhost:4331/rules/');
  const rules = await page.locator('main ol').innerText();
  expect(rules).toContain('25 and under');
  expect(rules).not.toMatch(oldWording);
  const whole = (await page.locator('main').innerText()).replace('(previously any age)', '');
  expect(whole).not.toMatch(oldWording);
});

test('no banner or notice about the change on Home or anywhere but Rules and the FAQ', async ({ request }) => {
  for (const path of ['/', '/competition/', '/about/', '/blog/', '/contact/', '/privacy/', '/ms/privacy/', '/verify/']) {
    const html = await (await request.get(`http://localhost:4331${path}`)).text();
    expect(html, path).not.toMatch(/previously|now for students aged|early posters/i);
  }
});

test('the Register page (entries-open build) says Open is 25 and under', async ({ page }) => {
  await page.goto('http://localhost:4332/register/');
  await expect(page.locator('main')).toContainText('Open is 25 and under');
});
