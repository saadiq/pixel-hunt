// Random-scene palettes and name nouns (prototype lines 347-363).
export interface Palette { name: string; dark: string; light: string; acc: string[] }

export const PALETTES: Palette[] = [
  { name: 'Saffron', dark: '#2a1b36', light: '#fbf1d9', acc: ['#f2b134', '#e0603a', '#8e2c4f', '#3f8f7a', '#9ed7c8', '#5a63b8'] },
  { name: 'Harbor', dark: '#102a43', light: '#f0f4f8', acc: ['#2f80c3', '#7cc6e8', '#f2c14e', '#e4572e', '#3fa37a', '#a7b7c9'] },
  { name: 'Orchard', dark: '#2d2a1f', light: '#f7f3e3', acc: ['#c0392b', '#e67e22', '#f1c40f', '#6a9a3a', '#2e6b4f', '#b97a57'] },
  { name: 'Arcade', dark: '#14101f', light: '#e9f6ff', acc: ['#ff3d7f', '#ffd23f', '#3ddcff', '#7c4dff', '#2ee59d', '#ff8a3d'] },
  { name: 'Mesa', dark: '#3b2418', light: '#f8ecd9', acc: ['#d9824a', '#b5452e', '#e8b960', '#7d9e8c', '#5d7aa8', '#8c5a9e'] },
  { name: 'Lagoon', dark: '#0f2e33', light: '#effaf6', acc: ['#1fa39a', '#7fd8c9', '#ffcf56', '#ff7a5c', '#2b6cb0', '#9b5de5'] },
  { name: 'Berry', dark: '#2a0f24', light: '#fdf0f4', acc: ['#c2185b', '#f48fb1', '#7b1fa2', '#ffb74d', '#4db6ac', '#5c6bc0'] },
  { name: 'Fern', dark: '#13261b', light: '#eef3e2', acc: ['#2f6b3a', '#7fb35a', '#d9a441', '#a3492b', '#5b8fb9', '#c9d77e'] },
  { name: 'Bodega', dark: '#1a1a1a', light: '#fffdf5', acc: ['#e63946', '#ffbe0b', '#3a86ff', '#06d6a0', '#8338ec', '#fb8500'] },
  { name: 'Rust', dark: '#1e2430', light: '#eef0f2', acc: ['#b5532c', '#e9a15a', '#5f7d95', '#9fb7c9', '#46705a', '#d8c27a'] },
  { name: 'Sherbet', dark: '#3a3355', light: '#fffaf0', acc: ['#ff8fa3', '#6fd6d3', '#9be3a6', '#f7d55c', '#a98fe0', '#f6a77a'] },
  { name: 'Ember', dark: '#1c0f0a', light: '#fff3e0', acc: ['#ff5722', '#ffc107', '#8d2a1e', '#ff9e80', '#3e8d93', '#c56d2c'] },
];

export type SceneType = 'mandala' | 'glass' | 'quilt' | 'critter' | 'landscape' | 'planet';
export const SCENE_TYPES: SceneType[] = ['mandala', 'glass', 'quilt', 'critter', 'landscape', 'planet'];

export const SCENE_NOUNS: Record<SceneType, string[]> = {
  mandala: ['Rosette', 'Mandala', 'Medallion'],
  glass: ['Window', 'Glasswork', 'Chapel'],
  quilt: ['Quilt', 'Patchwork', 'Pinwheel'],
  critter: ['Critter', 'Beastie', 'Sprite'],
  landscape: ['Ridge', 'Valley', 'Highlands'],
  planet: ['Orbit', 'Moonrise', 'Planet'],
};
