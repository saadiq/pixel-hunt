// Node-only: composes the 1200×630 link-preview card (public/og-image.png) from three scenes.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { SCENES } from '../src/scenes';
import { renderScene, sceneHeight } from './scene-png';
import { OG_PICKS as PICKS, TAGLINE, THEME, escapeXml } from './site';

const OUT = 'public/og-image.png';
// TTF builds of the families index.html loads from Google Fonts (resvg can't read the woff2 the CSS API serves).
const FONTS = {
  pixelify: 'https://fonts.gstatic.com/s/pixelifysans/v3/CHy2V-3HFUT7aC4iv1TxGDR9DHEserHN25py2TQO131Y.ttf',
  figtree: 'https://fonts.gstatic.com/s/figtree/v9/_Xmz-HUzqDCFdgfMsYiV_F7wfS-Bs_ehR15e.ttf',
};

/** Downloads a font once into out/fonts (keyed by its URL's file name, so a new URL refetches) and returns its path. */
async function font(name: string, url: string): Promise<string> {
  const path = `out/fonts/${name}-${basename(new URL(url).pathname)}`;
  if (!existsSync(path)) {
    mkdirSync('out/fonts', { recursive: true });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`font download failed (${res.status}): ${url}`);
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  return path;
}

const W = 1200, H = 630, TILE = 300, GAP = 36, TOP = 250;
const x0 = (W - PICKS.length * TILE - (PICKS.length - 1) * GAP) / 2;
const tiles = PICKS.map((id, i) => {
  const s = SCENES[id];
  if (!s) throw new Error(`unknown scene id: ${id}`);
  const png = renderScene(s, TILE).toString('base64');
  const th = sceneHeight(s, TILE);
  const x = x0 + i * (TILE + GAP);
  return `<rect x="${x - 8}" y="${TOP - 8}" width="${TILE + 16}" height="${th + 16}" rx="18" fill="#ffffff" fill-opacity="0.14"/>
  <image x="${x}" y="${TOP}" width="${TILE}" height="${th}" href="data:image/png;base64,${png}"/>`;
}).join('\n');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${THEME}"/>
  <g fill="#ffffff" transform="translate(${W / 2 - 372} 64) scale(6.5)">
    <rect y="2" width="14" height="2"/><rect y="6" width="14" height="2"/><rect y="10" width="14" height="2"/>
  </g>
  <text x="${W / 2 + 48}" y="148" text-anchor="middle" font-family="Pixelify Sans" font-weight="700" font-size="112" fill="#ffffff">PIXEL HUNT</text>
  <text x="${W / 2}" y="210" text-anchor="middle" font-family="Figtree" font-weight="600" font-size="34" fill="#dbe4ff">${escapeXml(TAGLINE)}</text>
  ${tiles}
</svg>`;

const fontFiles = await Promise.all(Object.entries(FONTS).map(([name, url]) => font(name, url)));
const img = new Resvg(svg, { font: { fontFiles, loadSystemFonts: false } }).render();
const buf = img.asPng();
writeFileSync(OUT, buf);
console.log(`wrote ${OUT} (${img.width}×${img.height}, ${(buf.length / 1024).toFixed(0)} KB)`);
