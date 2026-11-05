// The first mention of the SDGs on each landing page defines them (Daniel, 3 Nov 2026): "the Sustainable Development
// Goals (SDGs)" (on Competition, "Sustainable Development Goal 2 (SDG 2)"), and later mentions use "SDGs". No new
// text adds "UN" or "United Nations": the only "UN" on these pages is the About page's existing source sentence.
import { test, expect } from '@playwright/test';

const pages = ['/', '/competition/', '/about/', '/blog/'];
const UN = /\bUN\b|United Nations/;
// The footer's existing disclaimer ("Independent, not affiliated with the United Nations.") is allowed to stay.
const textWithoutDisclaimer = async (loc: import('@playwright/test').Locator) =>
  (await loc.innerText()).replace('Independent, not affiliated with the United Nations.', '');

for (const path of pages) {
  test(`${path}: the first SDG mention is the definition`, async ({ page }) => {
    await page.goto(path);
    const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    const first = text.search(/\bSDGs?\b/);
    expect(first, 'the page never uses "SDG"').toBeGreaterThan(-1);
    expect(text.slice(Math.max(0, first - 60), first)).toMatch(/Sustainable Development Goals? (2 )?\($/);
  });
}

test('Home: the intro reads "the Sustainable Development Goals (SDGs)" with no "UN"', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.hero__intro')).toContainText('built around the Sustainable Development Goals (SDGs).');
  expect(await textWithoutDisclaimer(page.locator('main'))).not.toMatch(UN);
  expect(await page.locator('.hero__intro').innerText()).not.toMatch(UN);
});

test('Competition: "This edition is based on Sustainable Development Goal 2 (SDG 2): Zero Hunger."', async ({ page }) => {
  await page.goto('/competition/');
  const sdg = page.locator('p.top__sdg:visible');
  await expect(sdg).toHaveText('This edition is based on Sustainable Development Goal 2 (SDG 2): Zero Hunger. The SDGs are 17 shared global goals for 2030; Goal 2 is to end hunger. What are the SDGs?');
  await expect(sdg.getByRole('link', { name: 'What are the SDGs?' })).toHaveAttribute('href', '/about/#sdgs');
  expect(await textWithoutDisclaimer(page.locator('header.top'))).not.toMatch(UN);
  expect(await textWithoutDisclaimer(page.locator('main'))).not.toMatch(UN);
});

test('About: the SDGs are defined before the source link, and the link to sdgs.un.org is unchanged', async ({ page }) => {
  await page.goto('/about/');
  const goals = page.locator('.goals__text');
  await expect(goals).toContainText('every UN member state agreed to the Sustainable Development Goals (SDGs): 17 goals to reach by 2030');
  await expect(goals).toContainText('We focus on the SDGs about fairness');
  const link = goals.getByRole('link');
  await expect(link).toHaveAttribute('href', 'https://sdgs.un.org/goals');
  await expect(link).toHaveText("source: the UN's Sustainable Development Goals page");
});

test('Blog index: the intro defines the SDGs', async ({ page }) => {
  await page.goto('/blog/');
  const html = await (await page.request.get('/blog/')).text();
  expect(html).toContain('Short explainers on hunger, justice and the Sustainable Development Goals (SDGs), written by students');
});
