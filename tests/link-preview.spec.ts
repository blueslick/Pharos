// Link previews (T78): every page carries Open Graph and Twitter tags, and the share image exists
// at 1200 x 630 on pharosprize.org. Port 4331 is the normal build, 4332 the entries-open preview.
import { test, expect } from '@playwright/test';
import tokens from '../tokens.json' with { type: 'json' };

const NORMAL = 'http://localhost:4331';
const OPEN = 'http://localhost:4332';
const DOMAIN = 'https://pharosprize.org';
const IMAGE = `${DOMAIN}/og-image.png`;
const SITE_NAME = 'Pharos';
// The owner-approved wording, written out here so a change to it shows up as a failing test.
const ALT = 'Pharos, Inaugural Edition: Zero Hunger. An essay competition for students, a fundraiser for The Assembly Soup Kitchen (T.A.S.K).';

const PAGES = ['/', '/competition/', '/rules/', '/faq/', '/about/', '/blog/', '/contact/', '/privacy/', '/verify/', '/register/'];

test('every page has Open Graph and Twitter tags that match its own title and description', async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(`${NORMAL}${path}`);
    const meta = (selector: string) => page.locator(`head meta[${selector}]`).getAttribute('content');
    const title = await page.title();
    const description = await meta('name="description"');

    expect(await meta('property="og:type"'), path).toBe('website');
    expect(await meta('property="og:site_name"'), path).toBe(SITE_NAME);
    expect(await meta('property="og:title"'), path).toBe(title);
    expect(await meta('property="og:description"'), path).toBe(description);
    expect(await meta('property="og:url"'), path).toBe(`${DOMAIN}${path}`);
    expect(await meta('property="og:image"'), path).toBe(IMAGE);
    expect(await meta('property="og:image:width"'), path).toBe('1200');
    expect(await meta('property="og:image:height"'), path).toBe('630');
    expect(await meta('property="og:image:alt"'), path).toBe(ALT);
    expect(await meta('name="twitter:card"'), path).toBe('summary_large_image');
    expect(await meta('name="twitter:title"'), path).toBe(title);
    expect(await meta('name="twitter:description"'), path).toBe(description);
    expect(await meta('name="twitter:image"'), path).toBe(IMAGE);
    expect(await meta('name="twitter:image:alt"'), path).toBe(ALT);
  }
});

test('the blog posts and the entries-open preview carry the same tags', async ({ page }) => {
  await page.goto(`${NORMAL}/blog/`);
  const links = await page.locator('main a[href^="/blog/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  for (const path of [...new Set(links)]) {
    await page.goto(`${NORMAL}${path}`);
    expect(await page.locator('head meta[property="og:image"]').getAttribute('content'), path).toBe(IMAGE);
    expect(await page.locator('head meta[name="twitter:card"]').getAttribute('content'), path).toBe('summary_large_image');
  }
  await page.goto(`${OPEN}/`);
  expect(await page.locator('head meta[property="og:image"]').getAttribute('content')).toBe(IMAGE);
  expect(await page.locator('head meta[name="twitter:card"]').getAttribute('content')).toBe('summary_large_image');
});

test('og-image.png is served as a 1200 x 630 PNG under 300 KB', async ({ request }) => {
  const res = await request.get(`${NORMAL}/og-image.png`);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('image/png');
  const body = await res.body();
  expect(body.subarray(1, 4).toString()).toBe('PNG');
  // A PNG stores its width and height as two 32-bit numbers right after the "IHDR" label.
  expect(body.readUInt32BE(16)).toBe(1200);
  expect(body.readUInt32BE(20)).toBe(630);
  expect(body.length).toBeLessThan(300 * 1024);
});

// Site icons (T78, part 2): one SVG icon plus 32 and 16 pixel PNG fallbacks, an Apple touch icon and a manifest on every page.
const ICON_PAGES = [...PAGES, '/ms/privacy/'];

test('every page has exactly one of each icon link, the touch icon and the manifest', async ({ page }) => {
  for (const path of ICON_PAGES) {
    await page.goto(`${NORMAL}${path}`);
    const count = (selector: string) => page.locator(`head link${selector}`).count();
    expect(await count('[rel="icon"]'), path).toBe(3);
    expect(await count('[rel="icon"][href="/favicon.svg"][type="image/svg+xml"]'), path).toBe(1);
    expect(await count('[rel="icon"][href="/favicon-32.png"][type="image/png"][sizes="32x32"]'), path).toBe(1);
    expect(await count('[rel="icon"][href="/favicon-16.png"][type="image/png"][sizes="16x16"]'), path).toBe(1);
    expect(await count('[rel="apple-touch-icon"]'), path).toBe(1);
    expect(await count('[rel="apple-touch-icon"][href="/apple-touch-icon.png"]'), path).toBe(1);
    expect(await count('[rel="manifest"][href="/site.webmanifest"]'), path).toBe(1);
  }
  await page.goto(`${OPEN}/`);
  expect(await page.locator('head link[rel="icon"]').count()).toBe(3);
  expect(await page.locator('head link[rel="apple-touch-icon"]').count()).toBe(1);
});

test('the icon files load with the right type and size', async ({ request }) => {
  const svg = await request.get(`${NORMAL}/favicon.svg`);
  expect(svg.status()).toBe(200);
  expect(svg.headers()['content-type']).toContain('image/svg+xml');
  expect(await svg.text()).toContain('<svg');

  const pngs: Record<string, number> = { 'favicon-16.png': 16, 'favicon-32.png': 32, 'apple-touch-icon.png': 180, 'icon-192.png': 192, 'icon-512.png': 512 };
  for (const [name, size] of Object.entries(pngs)) {
    const res = await request.get(`${NORMAL}/${name}`);
    expect(res.status(), name).toBe(200);
    expect(res.headers()['content-type'], name).toContain('image/png');
    const body = await res.body();
    expect(body.subarray(1, 4).toString(), name).toBe('PNG');
    expect(body.readUInt32BE(16), name).toBe(size);
    expect(body.readUInt32BE(20), name).toBe(size);
  }
});

test('the manifest names the site, lists the 192 and 512 icons and takes its colours from tokens.json', async ({ request }) => {
  const res = await request.get(`${NORMAL}/site.webmanifest`);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('manifest+json');
  const manifest = await res.json();
  const peach = tokens.color.tokens.find((t) => t.name === 'peach')!.value.light;
  expect(manifest.name).toBe(SITE_NAME);
  expect(manifest.theme_color).toBe(peach);
  expect(manifest.background_color).toBe(peach);
  expect(manifest.icons.map((i: { src: string; sizes: string; type: string }) => `${i.src} ${i.sizes} ${i.type}`)).toEqual([
    '/icon-192.png 192x192 image/png',
    '/icon-512.png 512x512 image/png',
  ]);
  for (const icon of manifest.icons) expect((await request.get(`${NORMAL}${icon.src}`)).status(), icon.src).toBe(200);
});

// The share image is fetched by WhatsApp, Facebook and X from the live domain, so its address must be
// absolute and on pharosprize.org on every build, including the pull-request previews. Here it is
// checked on the entries-open preview build too, and the file behind it must load as a PNG.
test('og:image is absolute on pharosprize.org on both builds and the file loads as image/png', async ({ page, request }) => {
  for (const base of [NORMAL, OPEN]) {
    await page.goto(`${base}/`);
    const url = await page.locator('head meta[property="og:image"]').getAttribute('content');
    expect(url).toBe(IMAGE);
    const res = await request.get(`${base}${new URL(url!).pathname}`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
  }
});
