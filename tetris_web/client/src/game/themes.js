// Lazy-Loading Theme Catalog & Loader
// Only lightweight metadata is bundled initially.
// Each theme's CSS, custom block renderer, and custom effect hooks are loaded on demand via dynamic import().

export const THEME_CATALOG = [
  {
    id: 'cyber',
    name: 'CYBER MATRIX',
    label: 'サイバー風 (Cyber)',
    description: 'グリーンマトリックス＆システムHUDスタイル',
    accent: '#2cff65',
    loader: () => import('../themes/cyber/index.js')
  },
  {
    id: 'hologram',
    name: 'HOLO POINT CLOUD',
    label: 'ホログラム点群 (Hologram)',
    description: '3D空間点群データ（Point Cloud）＆光学ホログラム投影',
    accent: '#00f6ff',
    loader: () => import('../themes/hologram/index.js')
  },
  {
    id: 'pixel',
    name: 'PIXEL ODYSSEY',
    label: 'ピクセルアート (Pixel)',
    description: '現代風リッチドット絵＆チップチューン演出',
    accent: '#ffea00',
    loader: () => import('../themes/pixel/index.js')
  },
  {
    id: 'classic',
    name: 'CLASSIC NEON',
    label: 'クラシック (Original)',
    description: '元のシンプルなグラスモーフィズム＆ネオンUI',
    accent: '#a000f0',
    loader: () => import('../themes/classic/index.js')
  }
];

export const DEFAULT_THEME_ID = 'cyber';

const loadedThemesCache = {};

export async function loadThemeById(id) {
  const entry = THEME_CATALOG.find(t => t.id === id) || THEME_CATALOG[0];
  if (loadedThemesCache[entry.id]) {
    return loadedThemesCache[entry.id];
  }
  const mod = await entry.loader();
  loadedThemesCache[entry.id] = mod.themeConfig;
  return mod.themeConfig;
}
