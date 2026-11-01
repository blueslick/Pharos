// The web app manifest (/site.webmanifest): the name and icons a phone uses when someone saves the site.
// The colours are read from tokens.json (the page ground, `peach`), so nothing is hard-coded here:
// the manifest format needs literal colour values, and this file writes the token's value into it.
import type { APIRoute } from 'astro';
import { SITE_NAME } from '../site';
import tokens from '../../tokens.json';

const peach = tokens.color.tokens.find((t) => t.name === 'peach')!.value.light;

export const GET: APIRoute = () => {
  const manifest = {
    name: SITE_NAME,
    short_name: SITE_NAME,
    start_url: '/',
    display: 'browser',
    theme_color: peach, // token: peach
    background_color: peach, // token: peach
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
  return new Response(JSON.stringify(manifest, null, 2) + '\n', {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' },
  });
};
