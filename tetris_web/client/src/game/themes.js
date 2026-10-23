// Extensible Theme Registry for HOSSHI TETRIS
// Add new theme objects to THEMES array to make them selectable on the Title Screen.

export const THEMES = [
  {
    id: 'cyber',
    name: 'CYBER MATRIX',
    label: 'サイバー風 (Cyber)',
    description: 'グリーンマトリックス＆システムHUDスタイル',
    layout: 'cyber', // 'cyber' | 'classic'
    nextCount: 3,
    canvas: {
      boardBg: 'rgba(4, 24, 10, 0.92)',
      scanlines: 'rgba(44, 255, 101, 0.045)',
      gridLine: 'rgba(65, 255, 115, 0.14)',
      beamColor: '120, 255, 180',
      lockFlashColor: '210, 255, 225',
      lineFlashFill: '180, 255, 210',
      lineFlashStroke: '44, 255, 101',
      particleNormal: '#2cff65',
      particleSpin: '#00f5ff',
      ghostStyle: 'outline', // 'outline' | 'translucent'
      blockStyle: 'cyber'    // 'cyber' | 'classic'
    }
  },
  {
    id: 'classic',
    name: 'CLASSIC NEON',
    label: 'クラシック (Original)',
    description: '元のシンプルなグラスモーフィズム＆ネオンUI',
    layout: 'classic',
    nextCount: 5,
    canvas: {
      boardBg: 'rgba(0, 0, 0, 0.82)',
      scanlines: null,
      gridLine: 'rgba(255, 255, 255, 0.05)',
      beamColor: '0, 240, 240',
      lockFlashColor: '255, 255, 255',
      lineFlashFill: '255, 255, 255',
      lineFlashStroke: '0, 240, 240',
      particleNormal: '#00f0f0',
      particleSpin: '#ff007f',
      ghostStyle: 'translucent',
      blockStyle: 'classic'
    }
  }
];

export const DEFAULT_THEME_ID = 'cyber';

export function getThemeById(id) {
  return THEMES.find(t => t.id === id) || THEMES[0];
}
