// Home page layout: Hero, "Who we are" (on its own, at a reading width), the edition section, "What we do"
// (three plain rounded cards), then the waitlist and footer; the SDG panel and the "Why Pharos?" block are gone from Home (they live on About).
// "Who we are" uses the lead type size, and the edition section carries the soup
// kitchen partner card under an "Inaugural Edition partner" label.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const headingsInMain = (page: import('@playwright/test').Page) =>
  page.locator('main h2').allInnerTexts();

test.describe('Home layout (sections and order)', () => {
  test('shows the right sections in the right order', async ({ page }) => {
    await page.goto('/');
    const headings = (await headingsInMain(page)).map((t) => t.trim());
    expect(headings).toEqual([
      'Who we are',
      'Your essay can feed someone.',
      'What we do',
      'Be notified when entries open',
    ]);
  });

  test('"Who we are" keeps its text and the About us button', async ({ page }) => {
    await page.goto('/');
    const who = page.locator('section.who');
    await expect(who.getByRole('heading', { name: 'Who we are' })).toBeVisible();
    await expect(who.locator('.who__text')).toHaveText(
      "We are student volunteers who believe young people should be part of the solution to the world's biggest problems, and that writing about them can create awareness and inspire change. Each edition takes one goal, asks three questions, and is a fundraiser for The Assembly Soup Kitchen (T.A.S.K).",
    );
    await expect(who.getByRole('link', { name: 'About us' })).toHaveAttribute('href', '/about/');
  });

  test('"What we do" has the intro line and three cards with the agreed text and buttons', async ({ page }) => {
    await page.goto('/');
    const doings = page.locator('section.doings');
    await expect(doings.locator('.doings__intro')).toHaveText(
      'Three ways to get involved: enter the competition, read our writing on the SDGs, or volunteer with our partner.',
    );
    // The intro sits directly under the heading.
    const h = (await doings.getByRole('heading', { name: 'What we do' }).boundingBox())!;
    const i = (await doings.locator('.doings__intro').boundingBox())!;
    expect(i.y).toBeGreaterThanOrEqual(h.y + h.height - 1);
    expect(i.y - (h.y + h.height)).toBeLessThan(40);

    await expect(doings.locator('.doing')).toHaveCount(3);
    await expect(doings.locator('.doing--comp p')).toHaveText('An essay competition on one SDG each edition, read and judged by people.');
    await expect(doings.locator('.doing--blog > p').first()).toHaveText('Short essays and explainers on the SDGs, with every figure sourced.');
    await expect(doings.locator('.doing--volunteer p')).toHaveText(
      'Help out at The Assembly Soup Kitchen (T.A.S.K), our Inaugural Edition partner. Find out how to join on their Instagram.',
    );
    await expect(doings.getByRole('link', { name: 'See the competition' })).toHaveAttribute('href', '/competition/');
    await expect(doings.getByRole('link', { name: /Find out on Instagram/ })).toBeVisible();
  });

  test('the blog card switches by itself: a "Read the blog" button when there are posts, "First posts coming soon." when there are none', async ({ page, request }) => {
    // Same rule as the blog index: it shows a featured post card, or the "coming soon" line.
    const blogHtml = await (await request.get('/blog/')).text();
    const hasPosts = blogHtml.includes('class="featured"') || /class="[^"]*\bfeatured\b[^"]*"/.test(blogHtml);
    await page.goto('/');
    const card = page.locator('.doing--blog');
    if (hasPosts) {
      await expect(card.getByRole('link', { name: 'Read the blog' })).toHaveAttribute('href', '/blog/');
      await expect(card).not.toContainText('First posts coming soon.');
    } else {
      await expect(card.getByRole('link')).toHaveCount(0);
      await expect(card.locator('.doing__soon')).toHaveText('First posts coming soon.');
      await expect(card.locator('.doing__soon')).toHaveCSS('font-size', /^(16|17)px$/);
    }
  });

  test('the three cards are plain rounded rectangles (radius-card, no half-round ends) and keep their fills', async ({ page }) => {
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      const radius = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--radius-card').trim());
      for (const sel of ['.doing--comp', '.doing--blog', '.doing--volunteer']) {
        const card = page.locator(sel);
        for (const corner of ['TopLeft', 'TopRight', 'BottomLeft', 'BottomRight']) {
          await expect(card).toHaveCSS(`border-${corner.replace(/([a-z])([A-Z])/, '$1-$2').toLowerCase()}-radius`, radius);
        }
      }
      expect(await page.locator('.doing--comp').evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
        await page.locator('.doing--blog').evaluate((el) => getComputedStyle(el).backgroundColor),
      );
    }
  });

  test('desktop: the three cards sit in one row at equal height; phone: they stack', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const boxes = await page.locator('.doing').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ y: r.y, h: r.height, x: r.x, w: r.width })));
    expect(new Set(boxes.map((b) => Math.round(b.y))).size).toBe(1);
    expect(new Set(boxes.map((b) => Math.round(b.h))).size).toBe(1);
    expect(boxes[0].x).toBeLessThan(boxes[1].x);
    expect(boxes[1].x).toBeLessThan(boxes[2].x);

    await page.setViewportSize({ width: 375, height: 812 });
    const stacked = await page.locator('.doing').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
    for (let k = 1; k < stacked.length; k++) expect(stacked[k].y).toBeGreaterThanOrEqual(stacked[k - 1].y + stacked[k - 1].height);
    // Full width between the gutters, nothing bleeding off the edge any more.
    for (const r of stacked) {
      expect(r.x).toBeGreaterThan(0);
      expect(r.x + r.width).toBeLessThan(375);
    }
  });

  test('the SDG panel and the "Why Pharos?" block are not on Home', async ({ page }) => {
    await page.goto('/');
    const main = page.locator('main');
    await expect(main).not.toContainText('Built on the Sustainable Development Goals');
    await expect(main).not.toContainText('Goals we focus on');
    await expect(main).not.toContainText('Why Pharos?');
    await expect(main).not.toContainText('A light for strangers.');
    await expect(page.locator('.sdgs, .why')).toHaveCount(0);
    await expect(page.locator('img[src="/images/pharos-hero-ship.png"]')).toHaveCount(0);
  });

  test('the About page still has them', async ({ page }) => {
    await page.goto('/about/');
    await expect(page.getByText('Goals we focus on')).toBeVisible();
    await expect(page.getByText('Why Pharos?')).toBeVisible();
  });

  test('desktop: "Who we are" has a reading width, not edge to edge, and sits right above the edition section', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const text = (await page.locator('.who__text').boundingBox())!;
    expect(text.width).toBeLessThan(800);
    const who = (await page.locator('section.who').boundingBox())!;
    const edition = (await page.locator('section.edition').boundingBox())!;
    expect(edition.y).toBeGreaterThanOrEqual(who.y + who.height - 1);
    expect(edition.y - (who.y + who.height)).toBeLessThan(2);
  });

  test('phone: stacked, Who we are first, no sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const who = (await page.locator('section.who').boundingBox())!;
    const edition = (await page.locator('section.edition').boundingBox())!;
    expect(who.y + who.height).toBeLessThanOrEqual(edition.y + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });

  test('"Who we are" paragraph uses the lead size, not the old body-lg size', async ({ page }) => {
    await page.goto('/');
    const text = page.locator('.who__text');
    await expect(text).toHaveClass(/t-lead/);
    await expect(text).not.toHaveClass(/t-body-lg/);
    // tokens.json: lead is 19px on phones and 23px on desktop (body-lg was 17px and 20px).
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(text).toHaveCSS('font-size', '19px');
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(text).toHaveCSS('font-size', '23px');
  });

  test('"Who we are" paragraph fills the width between the gutters on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const { textWidth, available } = await page.evaluate(() => {
      const who = document.querySelector('.who') as HTMLElement;
      const cs = getComputedStyle(who);
      return {
        textWidth: (document.querySelector('.who__text') as HTMLElement).getBoundingClientRect().width,
        available: who.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
      };
    });
    expect(textWidth).toBeGreaterThan(300); // it used to be capped at 300px
    expect(Math.abs(textWidth - available)).toBeLessThanOrEqual(1);
  });

  test('"Who we are" paragraph keeps a comfortable line length on desktop (60 to 70 characters)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const perLine = await page.evaluate(() => {
      const el = document.querySelector('.who__text') as HTMLElement;
      const range = document.createRange();
      range.selectNodeContents(el);
      const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
      return (el.textContent ?? '').trim().replace(/\s+/g, ' ').length / lines;
    });
    expect(perLine).toBeGreaterThanOrEqual(55);
    expect(perLine).toBeLessThanOrEqual(75);
  });

  test('the edition section shows the partner card under an "Inaugural Edition partner" label', async ({ page }) => {
    await page.goto('/');
    const edition = page.locator('section.edition');
    const label = edition.getByText('Inaugural Edition partner', { exact: true });
    await expect(label).toBeVisible();
    await expect(label).toHaveClass(/t-label/);
    const card = edition.locator('.sk');
    await expect(card).toBeVisible();
    await expect(card).toContainText('A fundraiser for The Assembly Soup Kitchen (T.A.S.K)');
    await expect(card.getByRole('link', { name: /^Facebook/ })).toHaveAttribute('href', 'https://www.facebook.com/theassemblysoupkitchen/');
    await expect(card.getByRole('link', { name: /^Instagram/ })).toHaveAttribute('href', 'https://www.instagram.com/assemblysoupkitchen/');
    for (const name of ['Facebook', 'Instagram']) {
      const link = card.getByRole('link', { name: new RegExp(`^${name}`) });
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener/);
    }
    // The label sits directly above the card, and the logo is the agreed file, unstretched.
    const l = (await label.boundingBox())!;
    const c = (await card.boundingBox())!;
    expect(l.y + l.height).toBeLessThanOrEqual(c.y + 1);
    expect(c.y - (l.y + l.height)).toBeLessThan(40);
    const img = card.getByAltText('The Assembly Soup Kitchen (T.A.S.K) logo');
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBe(600);
    const box = (await img.boundingBox())!;
    expect(box.width / box.height).toBeCloseTo(600 / 516, 1);
  });

  test('the partner logo appears once on Home, and not in the header or footer', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('img[src*="task-logo"]')).toHaveCount(1);
    await expect(page.locator('header img[src*="task-logo"], footer img[src*="task-logo"], nav img[src*="task-logo"]')).toHaveCount(0);
  });

  test('the order is Who we are, the edition section, What we do, then the waitlist', async ({ page }) => {
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      const y = async (sel: string) => (await page.locator(sel).boundingBox())!.y;
      expect(await y('section.who')).toBeLessThan(await y('section.edition'));
      expect(await y('section.edition')).toBeLessThan(await y('section.doings'));
      expect(await y('section.doings')).toBeLessThan(await y('section[aria-labelledby="home-waitlist-title"]'));
    }
  });

  test('the edition section keeps its mobile-only and desktop-only labels and buttons at both widths', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const label = 'Inaugural edition: Goal 2, Zero Hunger';
    await expect(page.locator('section.edition p.mobile-only', { hasText: label })).toBeVisible();
    await expect(page.locator('section.edition p.desktop-only', { hasText: label })).toBeHidden();
    await expect(page.locator('section.edition .btn.desktop-only')).toBeHidden();
    await expect(page.locator('section[aria-labelledby="home-waitlist-title"]').getByRole('link', { name: 'See the competition' })).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator('section.edition p.desktop-only', { hasText: label })).toBeVisible();
    await expect(page.locator('section.edition p.mobile-only', { hasText: label })).toBeHidden();
    await expect(page.locator('section.edition').getByRole('link', { name: 'See the competition' })).toBeVisible();
    await expect(page.locator('section[aria-labelledby="home-waitlist-title"]').getByRole('link', { name: 'See the competition' })).toBeHidden();
  });

  for (const width of [360, 768, 1440]) {
    test(`no sideways scrolling at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }

  test('no accessibility problems in Who we are, the edition section and What we do', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page }).include('.who').include('.edition').include('.doings').analyze();
    expect(results.violations).toEqual([]);
  });
});
