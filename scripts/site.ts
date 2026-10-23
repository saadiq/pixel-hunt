// Site-wide copy and branding shared by vite.config.ts (manifest, index.html meta) and og-image.ts.
export const SITE_URL = 'https://pixel-hunt.saadiq.workers.dev/';
export const TAGLINE = 'A pixel-art puzzle. Send the right squads to eat every pixel.';
export const DESCRIPTION = `${TAGLINE} Hand-drawn scenes, a daily board, and offline play.`;
export const THEME = '#2c56cc';
// The link-preview card: the scenes it shows and its alt text. Keep the two in step.
export const OG_PICKS = ['rubber-duck', 'hot-air-balloon', 'sea-turtle'];
export const OG_ALT = 'Pixel Hunt: pixel-art scenes of a rubber duck, a hot-air balloon and a sea turtle';

/** Escapes text for an XML/HTML attribute or text node. */
export function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
