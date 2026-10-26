import './hologram.css';

// Holographic Point-Cloud Spectral Palettes
const HOLO_PALETTES = {
  1: { core: '#00f6ff', glow: '#80fbff', dim: 'rgba(0, 246, 255, 0.22)' }, // I: Laser Cyan
  2: { core: '#4d7cff', glow: '#adc2ff', dim: 'rgba(77, 124, 255, 0.22)' }, // J: Deep Holo Blue
  3: { core: '#ff9e3b', glow: '#ffd09e', dim: 'rgba(255, 158, 59, 0.22)' }, // L: Amber Photon
  4: { core: '#ffe64d', glow: '#fff5b3', dim: 'rgba(255, 230, 77, 0.22)' }, // O: Solar Point
  5: { core: '#1aff9c', glow: '#a6ffda', dim: 'rgba(26, 255, 156, 0.22)' }, // S: Bio Scan Green
  6: { core: '#d94dff', glow: '#f0b3ff', dim: 'rgba(217, 77, 255, 0.22)' }, // T: Quantum Violet
  7: { core: '#ff3b7f', glow: '#ff9ec0', dim: 'rgba(255, 59, 127, 0.22)' }, // Z: Crimson Laser
  8: { core: '#a3c9e2', glow: '#e4f2fa', dim: 'rgba(163, 201, 226, 0.22)' } // Garbage: White Noise Cloud
};

export const themeConfig = {
  id: 'hologram',
  name: 'HOLO POINT CLOUD',
  label: 'ホログラム点群 (Hologram)',
  description: '3D空間点群データ（Point Cloud）＆光学ホログラム投影',
  layout: 'hologram',
  nextCount: 3,
  soundProfile: 'hologram',
  canvas: {
    boardBg: 'rgba(2, 10, 22, 0.86)',
    scanlines: 'rgba(0, 229, 255, 0.035)',
    gridLine: 'rgba(0, 210, 255, 0.09)',
    beamColor: '0, 246, 255',
    lockFlashColor: '180, 252, 255',
    lineFlashFill: '0, 246, 255',
    lineFlashStroke: '255, 255, 255',
    particleNormal: '#00f6ff',
    particleSpin: '#d94dff',
    ghostStyle: 'hologram',
    blockStyle: 'hologram',

    // Render each block as a volumetric 3D Point Cloud + wireframe node mesh
    drawCustomBlock(ctx, x, y, colorIndex, size, alpha = 1.0, isGhost = false) {
      const pal = HOLO_PALETTES[colorIndex] || HOLO_PALETTES[1];
      const px = x * size;
      const py = y * size;
      const now = performance.now() * 0.004;

      ctx.save();

      if (isGhost) {
        // Sparse LiDAR target point cloud for Ghost piece
        ctx.globalAlpha = alpha * 0.65;
        ctx.fillStyle = pal.core;

        const margin = 3;
        const step = (size - margin * 2) / 2;
        for (let r = 0; r <= 2; r++) {
          for (let c = 0; c <= 2; c++) {
            const gx = px + margin + c * step;
            const gy = py + margin + r * step;
            ctx.beginPath();
            ctx.arc(gx, gy, 1.15, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Subtle bounding dashed wireframe
        ctx.strokeStyle = pal.dim;
        ctx.lineWidth = 0.8;
        ctx.strokeRect(px + 2, py + 2, size - 4, size - 4);
        ctx.restore();
        return;
      }

      ctx.globalAlpha = alpha;

      // 1. Faint volumetric holographic field glow inside the voxel
      ctx.fillStyle = pal.dim;
      ctx.fillRect(px + 1.5, py + 1.5, size - 3, size - 3);

      // 2. Thin triangulation / point-cloud connectivity lines
      ctx.strokeStyle = pal.core;
      ctx.globalAlpha = alpha * 0.35;
      ctx.lineWidth = 0.75;
      ctx.strokeRect(px + 2, py + 2, size - 4, size - 4);

      ctx.beginPath();
      ctx.moveTo(px + 2, py + 2);
      ctx.lineTo(px + size - 2, py + size - 2);
      ctx.moveTo(px + size - 2, py + 2);
      ctx.lineTo(px + 2, py + size - 2);
      ctx.stroke();

      // 3. 4x4 Volumetric Point Cloud Matrix with subtle holographic shimmer
      const gridN = 3; // 4x4 = 16 points per cell
      const pad = 3.2;
      const spacing = (size - pad * 2) / gridN;

      for (let r = 0; r <= gridN; r++) {
        for (let c = 0; c <= gridN; c++) {
          const dotX = px + pad + c * spacing;
          const dotY = py + pad + r * spacing;

          // Subtle phase-shifted scintillation per point
          const phase = Math.sin(now + x * 1.3 + y * 0.9 + r * 1.7 + c * 2.1);
          const isCorner = (r === 0 || r === gridN) && (c === 0 || c === gridN);
          const radius = isCorner ? 1.65 : (1.15 + phase * 0.25);

          ctx.globalAlpha = alpha * (0.75 + phase * 0.25);
          ctx.fillStyle = isCorner ? pal.glow : pal.core;
          ctx.beginPath();
          ctx.arc(dotX, dotY, Math.max(0.6, radius), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 4. Central bright LiDAR anchor node
      ctx.globalAlpha = alpha * 0.95;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px + size / 2, py + size / 2, 1.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    },

    // Spawn Point-Cloud dissolution & LiDAR scan wave effects
    spawnCustomEffects(effects, ev, hardDropStartY, cellSize, gridWidth) {
      // Hard drop: LiDAR vertical point cloud stream
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
            alpha: 1.0
          });

          // Scatter floating data nodes along the drop column
          const count = Math.min(28, (maxY - hardDropStartY) * 2);
          for (let i = 0; i < count; i++) {
            effects.particles.push({
              x: (minX + Math.random() * (maxX - minX + 1)) * cellSize,
              y: (hardDropStartY + Math.random() * (maxY - hardDropStartY)) * cellSize,
              vx: (Math.random() - 0.5) * 1.2,
              vy: -0.5 - Math.random() * 1.2,
              gravity: -0.015,
              size: 1.6 + Math.random() * 1.5,
              color: i % 3 === 0 ? '#ffffff' : '#00f6ff',
              life: 0.9
            });
          }
        }
      }

      // Lock flash: expanding holographic node pulse
      if (ev.lockedCells) {
        ev.lockedCells.forEach(cell => {
          effects.lockFlashes.push({
            x: cell.x,
            y: cell.y,
            alpha: 0.9
          });
        });
      }

      // Line clear: Dissolve cleared rows into hundreds of drifting point-cloud nodes
      if (ev.linesCleared > 0) {
        const colors = ev.spinType
          ? ['#d94dff', '#00f6ff', '#ffffff', '#1aff9c']
          : ['#00f6ff', '#80fbff', '#ffffff', '#4d7cff'];

        ev.clearedRows.forEach(rowIdx => {
          effects.lineFlashes.push({
            row: rowIdx,
            alpha: 1.0
          });

          // High-density point cloud dispersion (40 points per cleared line)
          for (let i = 0; i < 40; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.8 + Math.random() * 4.2;
            effects.particles.push({
              x: (i / 40) * gridWidth * cellSize + (Math.random() - 0.5) * 10,
              y: (rowIdx + Math.random()) * cellSize,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 1.2,
              gravity: -0.04, // Points float upward like deconstructed hologram data
              size: 1.5 + Math.random() * 2.0,
              connectNeighbor: i % 2 === 0,
              color: colors[i % colors.length],
              life: 1.15
            });
          }
        });
      }
    },

    // Custom renderer for Point-Cloud effects (constellation lines + glowing nodes + scan rings)
    drawCustomEffects(ctx, effects, cellSize, widthPx) {
      ctx.save();

      // 1. Hard drop LiDAR scan matrix beam
      if (effects.beams) {
        for (const beam of effects.beams) {
          const bx = beam.x * cellSize;
          const bw = beam.width * cellSize;
          const byStart = Math.max(0, beam.startY * cellSize);
          const byEnd = beam.endY * cellSize;

          // Vertical laser guide lines
          ctx.strokeStyle = `rgba(0, 246, 255, ${beam.alpha * 0.45})`;
          ctx.lineWidth = 1;
          for (let x = bx; x <= bx + bw; x += cellSize / 2) {
            ctx.beginPath();
            ctx.moveTo(x, byStart);
            ctx.lineTo(x, byEnd);
            ctx.stroke();
          }

          // Horizontal scan wave rings along the beam
          ctx.fillStyle = `rgba(180, 252, 255, ${beam.alpha * 0.65})`;
          for (let y = byStart; y < byEnd; y += 10) {
            for (let x = bx + 4; x < bx + bw; x += 8) {
              ctx.fillRect(x, y, 2, 2);
            }
          }
        }
      }

      // 2. Lock flash: expanding wireframe reticle + corner nodes
      if (effects.lockFlashes) {
        for (const flash of effects.lockFlashes) {
          const fx = flash.x * cellSize;
          const fy = flash.y * cellSize;
          const expand = (1 - flash.alpha) * 6;

          ctx.strokeStyle = `rgba(160, 250, 255, ${flash.alpha})`;
          ctx.lineWidth = 1.2;
          ctx.strokeRect(fx - expand / 2 + 2, fy - expand / 2 + 2, cellSize + expand - 4, cellSize + expand - 4);
        }
      }

      // 3. Line clear holographic laser scanline + node grid flash
      if (effects.lineFlashes) {
        for (const lf of effects.lineFlashes) {
          const yPx = lf.row * cellSize;
          const cy = yPx + cellSize / 2;

          // Glowing scan plane
          const grad = ctx.createLinearGradient(0, yPx, 0, yPx + cellSize);
          grad.addColorStop(0, 'rgba(0, 246, 255, 0)');
          grad.addColorStop(0.5, `rgba(0, 246, 255, ${lf.alpha * 0.65})`);
          grad.addColorStop(1, 'rgba(0, 246, 255, 0)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, yPx, widthPx, cellSize);

          // Bright center laser core
          ctx.strokeStyle = `rgba(255, 255, 255, ${lf.alpha})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, cy);
          ctx.lineTo(widthPx, cy);
          ctx.stroke();
        }
      }

      // 4. Point-Cloud particles with dynamic constellation mesh lines between nearby nodes
      if (effects.particles && effects.particles.length > 0) {
        const pts = effects.particles;

        // Draw faint plexus/mesh connections between nearby point-cloud particles
        ctx.lineWidth = 0.7;
        for (let i = 0; i < pts.length; i++) {
          const p1 = pts[i];
          if (!p1.connectNeighbor || p1.life <= 0.15) continue;
          for (let j = i + 1; j < Math.min(pts.length, i + 8); j++) {
            const p2 = pts[j];
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < 900) { // within 30px
              const alpha = Math.min(p1.life, p2.life) * (1 - distSq / 900) * 0.45;
              ctx.strokeStyle = `rgba(0, 246, 255, ${alpha})`;
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            }
          }
        }

        // Draw glowing circular point-cloud nodes
        for (const p of pts) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      ctx.restore();
    }
  }
};
