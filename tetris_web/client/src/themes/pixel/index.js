import './pixel.css';

// Rich 16-bit Modern Pixel Palette per piece type (Base, Light, Dark, Core)
const PIXEL_PALETTES = {
  1: { base: '#00e5ff', light: '#a6fcff', dark: '#007c99', border: '#002b3d' }, // I: Sky Cyan
  2: { base: '#3d5afe', light: '#8c9eff', dark: '#1a237e', border: '#0d103b' }, // J: Royal Blue
  3: { base: '#ff9100', light: '#ffd180', dark: '#c65100', border: '#3e1900' }, // L: Amber Orange
  4: { base: '#ffea00', light: '#ffff8d', dark: '#c7a500', border: '#3d3000' }, // O: Gold Yellow
  5: { base: '#00e676', light: '#b9f6ca', dark: '#008037', border: '#002910' }, // S: Emerald Green
  6: { base: '#d500f9', light: '#ea80fc', dark: '#7b0099', border: '#2c0038' }, // T: Amethyst Purple
  7: { base: '#ff1744', light: '#ff8a80', dark: '#b00020', border: '#3b000b' }, // Z: Crimson Red
  8: { base: '#90a4ae', light: '#eceff1', dark: '#455a64', border: '#1c262b' }  // Garbage: Steel Slate
};

export const themeConfig = {
  id: 'pixel',
  name: 'PIXEL ODYSSEY',
  label: 'ピクセルアート (Pixel)',
  description: '現代風リッチドット絵＆チップチューン演出',
  layout: 'pixel',
  nextCount: 4,
  soundProfile: 'pixel', // Switches sound synthesizer to 8-bit square/chiptune arpeggios
  canvas: {
    boardBg: '#0b0914',
    scanlines: 'rgba(0, 0, 0, 0.24)',
    gridLine: 'rgba(138, 115, 204, 0.16)',
    beamColor: '255, 234, 0',
    lockFlashColor: '255, 250, 205',
    lineFlashFill: '255, 234, 0',
    lineFlashStroke: '255, 64, 129',
    particleNormal: '#ffea00',
    particleSpin: '#ff4081',
    ghostStyle: 'pixel',
    blockStyle: 'pixel',

    // Theme-specific custom block renderer (16-bit bevel sprite with pixel speculars)
    drawCustomBlock(ctx, x, y, colorIndex, size, alpha = 1.0, isGhost = false) {
      const pal = PIXEL_PALETTES[colorIndex] || PIXEL_PALETTES[1];
      const px = Math.floor(x * size);
      const py = Math.floor(y * size);
      const s = Math.floor(size);
      const p = Math.max(2, Math.floor(s / 14)); // 2px virtual pixel unit for 28px cell

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = alpha;

      if (isGhost) {
        // Dashed pixel corner brackets for ghost piece
        ctx.fillStyle = pal.base;
        const len = p * 3;
        // Top-left corner
        ctx.fillRect(px + p, py + p, len, p);
        ctx.fillRect(px + p, py + p, p, len);
        // Top-right corner
        ctx.fillRect(px + s - p - len, py + p, len, p);
        ctx.fillRect(px + s - 2 * p, py + p, p, len);
        // Bottom-left corner
        ctx.fillRect(px + p, py + s - 2 * p, len, p);
        ctx.fillRect(px + p, py + s - p - len, p, len);
        // Bottom-right corner
        ctx.fillRect(px + s - p - len, py + s - 2 * p, len, p);
        ctx.fillRect(px + s - 2 * p, py + s - p - len, p, len);

        ctx.globalAlpha = alpha * 0.18;
        ctx.fillRect(px + p * 2, py + p * 2, s - p * 4, s - p * 4);
        ctx.restore();
        return;
      }

      // 1. Dark pixel outer frame (with notched 1-pixel corners)
      ctx.fillStyle = pal.border;
      ctx.fillRect(px, py, s, s);

      // 2. Main sprite body
      ctx.fillStyle = pal.base;
      ctx.fillRect(px + p, py + p, s - 2 * p, s - 2 * p);

      // 3. Top & Left bright pixel highlight step
      ctx.fillStyle = pal.light;
      ctx.fillRect(px + p, py + p, s - 3 * p, p);
      ctx.fillRect(px + p, py + p, p, s - 3 * p);
      // Specular pixel dot at top-left inner corner
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px + 2 * p, py + 2 * p, p * 2, p);
      ctx.fillRect(px + 2 * p, py + 2 * p, p, p * 2);

      // 4. Bottom & Right deep pixel shadow step
      ctx.fillStyle = pal.dark;
      ctx.fillRect(px + 2 * p, py + s - 2 * p, s - 3 * p, p);
      ctx.fillRect(px + s - 2 * p, py + 2 * p, p, s - 3 * p);

      // 5. Inner recessed gem detail
      ctx.fillStyle = pal.dark;
      ctx.fillRect(px + 4 * p, py + 4 * p, s - 8 * p, p);
      ctx.fillRect(px + 4 * p, py + 4 * p, p, s - 8 * p);
      ctx.fillStyle = pal.light;
      ctx.fillRect(px + s - 5 * p, py + s - 5 * p, p, p);

      ctx.restore();
    },

    // Theme-specific custom particle & effect spawner
    spawnCustomEffects(effects, ev, hardDropStartY, cellSize, gridWidth) {
      // Dithered pixel afterimage column on hard drop
      if (hardDropStartY !== null && ev.lockedCells && ev.lockedCells.length > 0) {
        const xs = ev.lockedCells.map(c => c.x);
        const ys = ev.lockedCells.map(c => c.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        if (maxY > hardDropStartY) {
          effects.beams.push({
            x: minX,
            width: maxX - minX + 1,
            startY: Math.max(0, hardDropStartY),
            endY: maxY + 1,
            alpha: 1.0,
            style: 'pixel_dither'
          });
          // Rising pixel dust motes along the drop path
          for (let i = 0; i < 8; i++) {
            effects.particles.push({
              x: (minX + Math.random() * (maxX - minX + 1)) * cellSize,
              y: (hardDropStartY + Math.random() * (maxY - hardDropStartY)) * cellSize,
              vx: (Math.random() - 0.5) * 1.5,
              vy: -0.8 - Math.random() * 1.5,
              gravity: -0.02,
              size: 4,
              shape: 'square',
              color: i % 2 === 0 ? '#ffea00' : '#ffffff',
              life: 0.85
            });
          }
        }
      }

      if (ev.lockedCells) {
        ev.lockedCells.forEach(cell => {
          effects.lockFlashes.push({
            x: cell.x,
            y: cell.y,
            alpha: 0.85,
            style: 'pixel'
          });
        });
      }

      // Rich pixel star bursts & bouncing 8-bit debris on line clear
      if (ev.linesCleared > 0) {
        const sparkPalette = ev.spinType
          ? ['#ff4081', '#ffea00', '#00e5ff', '#ea80fc', '#ffffff']
          : ['#ffea00', '#00e676', '#00e5ff', '#ff9100', '#ffffff'];

        ev.clearedRows.forEach(rowIdx => {
          effects.lineFlashes.push({
            row: rowIdx,
            alpha: 1.0,
            style: 'pixel_step'
          });

          for (let i = 0; i < 24; i++) {
            const color = sparkPalette[i % sparkPalette.length];
            effects.particles.push({
              x: Math.random() * gridWidth * cellSize,
              y: (rowIdx + 0.5) * cellSize,
              vx: (Math.random() - 0.5) * 8,
              vy: -2.0 - Math.random() * 5.5,
              gravity: 0.28,
              size: i % 3 === 0 ? 6 : 4,
              shape: i % 3 === 0 ? 'star' : 'square',
              color,
              life: 1.15
            });
          }
        });
      }
    },

    // Theme-specific custom effects renderer
    drawCustomEffects(ctx, effects, cellSize, widthPx) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;

      // 1. Pixel dithered hard drop trail
      if (effects.beams) {
        for (const beam of effects.beams) {
          const bx = Math.floor(beam.x * cellSize);
          const bw = Math.floor(beam.width * cellSize);
          const byStart = Math.floor(beam.startY * cellSize);
          const byEnd = Math.floor(beam.endY * cellSize);
          const step = 4;

          ctx.fillStyle = `rgba(255, 234, 0, ${beam.alpha * 0.45})`;
          for (let y = byStart; y < byEnd; y += step * 2) {
            ctx.fillRect(bx + 2, y, bw - 4, step);
          }
          ctx.fillStyle = `rgba(255, 255, 255, ${beam.alpha * 0.6})`;
          ctx.fillRect(bx, byEnd - 6, bw, 4);
        }
      }

      // 2. Stepped pixel lock flash
      if (effects.lockFlashes) {
        for (const flash of effects.lockFlashes) {
          const fx = flash.x * cellSize;
          const fy = flash.y * cellSize;
          ctx.fillStyle = flash.alpha > 0.4 ? '#ffffff' : '#ffea00';
          ctx.globalAlpha = Math.min(1, flash.alpha);
          ctx.fillRect(fx + 2, fy + 2, cellSize - 4, cellSize - 4);
        }
        ctx.globalAlpha = 1.0;
      }

      // 3. Stepped arcade line clear flash bar
      if (effects.lineFlashes) {
        for (const lf of effects.lineFlashes) {
          const yPx = lf.row * cellSize;
          // Stepped color cycling like classic 16-bit arcade explosions
          const color = lf.alpha > 0.66 ? '#ffffff' : (lf.alpha > 0.33 ? '#ffea00' : '#ff4081');
          ctx.fillStyle = color;
          const barH = Math.max(4, Math.floor((lf.alpha * cellSize) / 4) * 4);
          const offsetY = Math.floor((cellSize - barH) / 2);
          ctx.fillRect(0, yPx + offsetY, widthPx, barH);
        }
      }

      // 4. Crisp quantized pixel particles (squares and 8-bit cross stars)
      if (effects.particles) {
        for (const p of effects.particles) {
          const qx = Math.round(p.x / 2) * 2;
          const qy = Math.round(p.y / 2) * 2;
          const s = Math.max(2, Math.round(p.size / 2) * 2);

          ctx.globalAlpha = p.life > 0.25 ? 1.0 : 0.5;
          ctx.fillStyle = p.color;

          if (p.shape === 'star') {
            // Draw 5-block pixel cross star
            ctx.fillRect(qx - s, qy, s * 3, s);
            ctx.fillRect(qx, qy - s, s, s * 3);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(qx, qy, s, s);
          } else {
            ctx.fillRect(qx, qy, s, s);
            ctx.fillStyle = '#000000';
            ctx.fillRect(qx + s, qy + s, 2, 2);
          }
        }
      }

      ctx.restore();
    }
  }
};
