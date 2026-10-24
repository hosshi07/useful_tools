import './classic.css';

export const themeConfig = {
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
};
