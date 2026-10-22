import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Tetris } from './game/Tetris';
import { COLORS, SHAPES, GRID_WIDTH, GRID_HEIGHT } from './game/config';
import { sound } from './game/sound';
import './index.css';

const SOCKET_URL = window.location.hostname === 'localhost' ? 'http://localhost:3005' : '/';
const CELL_SIZE = 28;
const MINI_CELL_SIZE = 18;

// Pro-grade customizable DAS / ARR / SDF (defaults tuned to eliminate misdrops while feeling snappy)
const DEFAULT_DAS = 135; // ms before auto-repeat starts
const DEFAULT_ARR = 22;  // ms per auto-repeat step
const DEFAULT_SDF = 35;  // ms per soft-drop step

function drawBlock(ctx, x, y, colorIndex, size, alpha = 1.0, isGhost = false) {
  const baseColor = COLORS[colorIndex] || '#2cff65';
  const px = x * size;
  const py = y * size;

  ctx.save();
  ctx.globalAlpha = alpha;

  if (isGhost) {
    ctx.strokeStyle = baseColor;
    ctx.lineWidth = 1.8;
    ctx.fillStyle = `${baseColor}22`;
    ctx.fillRect(px + 1.5, py + 1.5, size - 3, size - 3);
    ctx.strokeRect(px + 1.5, py + 1.5, size - 3, size - 3);
    ctx.restore();
    return;
  }

  // Glossy cyber block body
  ctx.fillStyle = baseColor;
  ctx.fillRect(px + 0.5, py + 0.5, size - 1, size - 1);

  // Inner gradient sheen
  const grad = ctx.createLinearGradient(px, py, px + size, py + size);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
  grad.addColorStop(0.45, 'rgba(255, 255, 255, 0.05)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
  ctx.fillStyle = grad;
  ctx.fillRect(px + 1, py + 1, size - 2, size - 2);

  // Bright top/left edge highlight like the reference screenshot
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.fillRect(px + 1, py + 1, size - 2, 2.5);
  ctx.fillRect(px + 1, py + 1, 2.5, size - 2);

  // Dark bottom/right bevel
  ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
  ctx.fillRect(px + 1, py + size - 3.5, size - 2, 2.5);
  ctx.fillRect(px + size - 3.5, py + 1, 2.5, size - 2);

  // Crisp cell border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);

  ctx.restore();
}

function drawGrid(ctx, field, ghostY, currentFigure, figX, figY, figColor, effects = null) {
  const widthPx = GRID_WIDTH * CELL_SIZE;
  const heightPx = GRID_HEIGHT * CELL_SIZE;

  ctx.clearRect(0, 0, widthPx, heightPx);

  // 1. Cyber green scanlines & grid inside the board (matching the reference image)
  ctx.fillStyle = 'rgba(4, 24, 10, 0.92)';
  ctx.fillRect(0, 0, widthPx, heightPx);

  // Horizontal fine scanlines
  ctx.fillStyle = 'rgba(44, 255, 101, 0.045)';
  for (let y = 0; y < heightPx; y += 3) {
    ctx.fillRect(0, y, widthPx, 1);
  }

  // Grid lines
  ctx.strokeStyle = 'rgba(65, 255, 115, 0.14)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= widthPx; x += CELL_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, heightPx);
    ctx.stroke();
  }
  for (let y = 0; y <= heightPx; y += CELL_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(widthPx, y);
    ctx.stroke();
  }

  // 2. Hard drop vertical cyber beam trail
  if (effects && effects.beams) {
    for (const beam of effects.beams) {
      const grad = ctx.createLinearGradient(0, beam.startY * CELL_SIZE, 0, beam.endY * CELL_SIZE);
      grad.addColorStop(0, 'rgba(44, 255, 101, 0)');
      grad.addColorStop(1, `rgba(120, 255, 180, ${beam.alpha * 0.45})`);
      ctx.fillStyle = grad;
      ctx.fillRect(
        beam.x * CELL_SIZE,
        beam.startY * CELL_SIZE,
        beam.width * CELL_SIZE,
        Math.max(1, (beam.endY - beam.startY) * CELL_SIZE)
      );
    }
  }

  // 3. Draw placed blocks
  for (let r = 0; r < GRID_HEIGHT; r++) {
    for (let c = 0; c < GRID_WIDTH; c++) {
      if (field[r][c] > 0) {
        drawBlock(ctx, c, r, field[r][c], CELL_SIZE);
      }
    }
  }

  // 4. Draw Ghost & Current Piece
  if (currentFigure) {
    if (ghostY >= 0) {
      for (let i = 0; i < currentFigure.length; i++) {
        for (let j = 0; j < currentFigure[i].length; j++) {
          if (currentFigure[i][j]) {
            const x = figX + j;
            const y = ghostY + i;
            if (y >= 0) drawBlock(ctx, x, y, figColor, CELL_SIZE, 0.65, true);
          }
        }
      }
    }

    for (let i = 0; i < currentFigure.length; i++) {
      for (let j = 0; j < currentFigure[i].length; j++) {
        if (currentFigure[i][j]) {
          const x = figX + j;
          const y = figY + i;
          if (y >= 0) drawBlock(ctx, x, y, figColor, CELL_SIZE, 1.0, false);
        }
      }
    }
  }

  // 5. Lock flash highlight on newly placed cells
  if (effects && effects.lockFlashes) {
    for (const flash of effects.lockFlashes) {
      ctx.fillStyle = `rgba(210, 255, 225, ${flash.alpha})`;
      ctx.fillRect(flash.x * CELL_SIZE, flash.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
  }

  // 6. Line clear laser sweep effect
  if (effects && effects.lineFlashes) {
    for (const lf of effects.lineFlashes) {
      const yPx = lf.row * CELL_SIZE;
      ctx.fillStyle = `rgba(180, 255, 210, ${lf.alpha})`;
      ctx.fillRect(0, yPx, widthPx, CELL_SIZE);

      ctx.strokeStyle = `rgba(44, 255, 101, ${lf.alpha})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(0, yPx, widthPx, CELL_SIZE);
    }
  }

  // 7. Cyber digital particles
  if (effects && effects.particles) {
    for (const p of effects.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fillRect(p.x, p.y, p.size, p.size);
      ctx.restore();
    }
  }
}

function drawMini(ctx, figType) {
  const boxSize = 4 * MINI_CELL_SIZE;
  ctx.clearRect(0, 0, boxSize, boxSize);
  if (!figType) return;

  const fig = SHAPES[figType];
  const offsetX = figType === 4 ? 1 : (figType === 1 ? 0 : 0.5);
  const offsetY = figType === 1 ? 0.5 : (figType === 4 ? 1 : 0.8);

  for (let i = 0; i < fig.length; i++) {
    for (let j = 0; j < fig[i].length; j++) {
      if (fig[i][j]) {
        drawBlock(ctx, j + offsetX, i + offsetY, figType, MINI_CELL_SIZE);
      }
    }
  }
}

const Logo = () => (
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M 65 10 A 40 40 0 1 0 95 65 A 35 35 0 0 1 65 10 Z" fill="#2cff65" />
    <path d="M 75 25 Q 80 25 80 20 Q 80 25 85 25 Q 80 25 80 30 Q 80 25 75 25 Z" fill="#eafff0" />
  </svg>
);

const StarIcon = () => (
  <svg className="star-icon" viewBox="0 0 24 24" fill="#c7d6ff" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
  </svg>
);

export default function App() {
  const [appState, setAppState] = useState('title'); // title, join_room, 1p_game, 2p_wait, 2p_game
  const [roomCode, setRoomCode] = useState('');
  const [socket, setSocket] = useState(null);

  const [score, setScore] = useState(0);
  const [linesCount, setLinesCount] = useState(0);
  const [actionText, setActionText] = useState('');
  const [renText, setRenText] = useState('');
  const [calloutKey, setCalloutKey] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [boardShake, setBoardShake] = useState({ x: 0, y: 0 });

  const [gameOver, setGameOver] = useState(false);
  const [opponentGameOver, setOpponentGameOver] = useState(false);
  const [opponentScore, setOpponentScore] = useState(0);

  const appStateRef = useRef(appState);
  const roomCodeRef = useRef(roomCode);
  const gameOverRef = useRef(gameOver);
  const isPausedRef = useRef(isPaused);

  useEffect(() => { appStateRef.current = appState; }, [appState]);
  useEffect(() => { roomCodeRef.current = roomCode; }, [roomCode]);
  useEffect(() => { gameOverRef.current = gameOver; }, [gameOver]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  const canvasRef = useRef(null);
  const holdRef = useRef(null);
  const nextRefs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)];
  const opponentCanvasRef = useRef(null);

  const gameRef = useRef(null);
  const animationFrameRef = useRef(null);

  const lastTimeRef = useRef(0);
  const dropCounterRef = useRef(0);
  const dropInterval = 500; // Fixed constant gravity (no level speed-up per user requirement)

  // Separate horizontal DAS/ARR and Soft Drop state to prevent misdrops!
  const horizInputRef = useRef({
    leftDown: false,
    rightDown: false,
    activeDir: 0, // -1 for left, 1 for right, 0 for none
    dasElapsed: 0,
    arrElapsed: 0
  });
  const softDropRef = useRef({
    down: false,
    sdfElapsed: 0
  });

  // Visual effects state stored in ref for 60fps canvas rendering
  const effectsRef = useRef({
    particles: [],
    lineFlashes: [],
    lockFlashes: [],
    beams: []
  });

  const triggerBoardImpact = (dx = 0, dy = 4) => {
    setBoardShake({ x: dx, y: dy });
    setTimeout(() => setBoardShake({ x: 0, y: 0 }), 75);
  };

  const spawnLockAndClearEffects = (game, hardDropStartY = null) => {
    const ev = game.lastEvent;
    if (!ev) return;

    // Hard drop vertical cyber beam
    if (hardDropStartY !== null && ev.lockedCells && ev.lockedCells.length > 0) {
      const xs = ev.lockedCells.map(c => c.x);
      const ys = ev.lockedCells.map(c => c.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      if (maxY > hardDropStartY) {
        effectsRef.current.beams.push({
          x: minX,
          width: maxX - minX + 1,
          startY: Math.max(0, hardDropStartY),
          endY: maxY + 1,
          alpha: 0.9
        });
      }
    }

    // Lock cell flash
    if (ev.lockedCells) {
      ev.lockedCells.forEach(cell => {
        effectsRef.current.lockFlashes.push({
          x: cell.x,
          y: cell.y,
          alpha: 0.65
        });
      });
    }

    // Line clear flashes & cyber particles
    if (ev.linesCleared > 0) {
      sound.clear(ev.linesCleared, ev.spinType, ev.ren);
      triggerBoardImpact(ev.spinType ? 5 : 0, Math.min(10, ev.linesCleared * 2.5));

      ev.clearedRows.forEach(rowIdx => {
        effectsRef.current.lineFlashes.push({
          row: rowIdx,
          alpha: 1.0
        });
        for (let i = 0; i < 18; i++) {
          effectsRef.current.particles.push({
            x: Math.random() * GRID_WIDTH * CELL_SIZE,
            y: (rowIdx + 0.5) * CELL_SIZE,
            vx: (Math.random() - 0.5) * 6.5,
            vy: (Math.random() - 0.6) * 5.5,
            size: 3 + Math.random() * 4,
            color: ev.spinType ? '#00f5ff' : '#2cff65',
            life: 1.0
          });
        }
      });
    } else if (ev.spinType) {
      sound.rotate(true);
    }

    if (ev.actionText || ev.renText) {
      setCalloutKey(prev => prev + 1);
    }
  };

  const syncGameResult = (game, linesCleared, hardDropStartY = null) => {
    spawnLockAndClearEffects(game, hardDropStartY);

    if (appStateRef.current === '2p_game' && socket) {
      let garbage = 0;
      const ev = game.lastEvent;
      if (ev?.spinType) {
        garbage = linesCleared * 2;
      } else if (linesCleared === 4) {
        garbage = 4;
      } else if (linesCleared >= 2) {
        garbage = linesCleared - 1;
      }
      if (linesCleared > 0 && game.ren > 0) {
        garbage += Math.floor((game.ren + 1) / 2);
      }
      if (ev?.isPerfectClear) {
        garbage += 10;
      }
      if (garbage > 0) {
        socket.emit('send_garbage', { roomCode: roomCodeRef.current, lines: garbage });
      }
    }

    setScore(game.score);
    setLinesCount(game.lines);
    setActionText(game.lastActionText);
    setRenText(game.renText);

    if (game.state === 'gameover') {
      sound.gameOver();
      setGameOver(true);
      gameOverRef.current = true;
      if (appStateRef.current === '2p_game') {
        socket?.emit('game_over', { roomCode: roomCodeRef.current });
        socket?.emit('leave_room', roomCodeRef.current);
      }
    }
  };

  const togglePause = () => {
    if (appStateRef.current !== '1p_game' || gameOverRef.current) return;
    sound.uiClick();
    setIsPaused(prev => {
      const next = !prev;
      isPausedRef.current = next;
      // Clear held keys on pause/resume so pieces don't fly off
      horizInputRef.current = { leftDown: false, rightDown: false, activeDir: 0, dasElapsed: 0, arrElapsed: 0 };
      softDropRef.current = { down: false, sdfElapsed: 0 };
      lastTimeRef.current = performance.now();
      return next;
    });
  };

  // Input handling (ignoring OS e.repeat and isolating horizontal DAS from soft drop and rotations)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!gameRef.current || (appState !== '1p_game' && appState !== '2p_game')) return;

      // Prevent browser scrolling on arrows / space
      if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Space'].includes(e.code)) {
        e.preventDefault();
      }

      // Ignore OS key auto-repeat completely! Custom DAS/ARR handles continuous movement cleanly.
      if (e.repeat) return;

      // Escape toggles pause menu in 1P mode only
      if (e.code === 'Escape') {
        if (appState === '1p_game' && !gameOverRef.current) {
          togglePause();
        }
        return;
      }

      if (gameOverRef.current || isPausedRef.current) return;

      const game = gameRef.current;
      let stateChanged = false;

      if (e.code === 'ArrowLeft') {
        horizInputRef.current.leftDown = true;
        horizInputRef.current.activeDir = -1;
        horizInputRef.current.dasElapsed = 0;
        horizInputRef.current.arrElapsed = 0;
        if (game.moveSide(-1)) {
          sound.move();
          stateChanged = true;
        }
      } else if (e.code === 'ArrowRight') {
        horizInputRef.current.rightDown = true;
        horizInputRef.current.activeDir = 1;
        horizInputRef.current.dasElapsed = 0;
        horizInputRef.current.arrElapsed = 0;
        if (game.moveSide(1)) {
          sound.move();
          stateChanged = true;
        }
      } else if (e.code === 'ArrowDown') {
        softDropRef.current.down = true;
        softDropRef.current.sdfElapsed = 0;
        if (game.moveDown()) {
          sound.softDrop();
          dropCounterRef.current = 0;
          stateChanged = true;
        }
      } else {
        switch (e.code) {
          case 'ArrowUp':
          case 'KeyX':
            if (game.rotateClockwise()) {
              const spin = game.checkSpinType();
              sound.rotate(Boolean(spin));
              stateChanged = true;
            }
            break;
          case 'KeyZ':
          case 'ControlLeft':
          case 'ControlRight':
            if (game.rotateCounterClockwise()) {
              const spin = game.checkSpinType();
              sound.rotate(Boolean(spin));
              stateChanged = true;
            }
            break;
          case 'KeyA':
            if (game.rotate180()) {
              const spin = game.checkSpinType();
              sound.rotate(Boolean(spin));
              stateChanged = true;
            }
            break;
          case 'Space': {
            const startY = game.figureY;
            const linesCleared = game.dropSpace();
            sound.hardDrop();
            triggerBoardImpact(0, 4);
            dropCounterRef.current = 0;
            // Reset ARR timer slightly on new piece spawn to prevent accidental carryover slide
            horizInputRef.current.arrElapsed = 0;
            syncGameResult(game, linesCleared, startY);
            stateChanged = true;
            break;
          }
          case 'KeyC':
          case 'ShiftLeft':
          case 'ShiftRight':
            if (game.hold()) {
              sound.hold();
              dropCounterRef.current = 0;
              stateChanged = true;
            }
            break;
          default:
            break;
        }
      }

      if (stateChanged) {
        drawAll();
        if (appStateRef.current === '2p_game') emitState();
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'ArrowLeft') {
        horizInputRef.current.leftDown = false;
        if (horizInputRef.current.rightDown) {
          horizInputRef.current.activeDir = 1;
          horizInputRef.current.dasElapsed = 0;
          horizInputRef.current.arrElapsed = 0;
        } else {
          horizInputRef.current.activeDir = 0;
        }
      } else if (e.code === 'ArrowRight') {
        horizInputRef.current.rightDown = false;
        if (horizInputRef.current.leftDown) {
          horizInputRef.current.activeDir = -1;
          horizInputRef.current.dasElapsed = 0;
          horizInputRef.current.arrElapsed = 0;
        } else {
          horizInputRef.current.activeDir = 0;
        }
      } else if (e.code === 'ArrowDown') {
        softDropRef.current.down = false;
      }
    };

    const handleBlur = () => {
      horizInputRef.current = { leftDown: false, rightDown: false, activeDir: 0, dasElapsed: 0, arrElapsed: 0 };
      softDropRef.current = { down: false, sdfElapsed: 0 };
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [appState, gameOver, socket, roomCode]);

  const emitState = () => {
    if (socket && gameRef.current && appStateRef.current === '2p_game') {
      socket.emit('send_state', {
        roomCode: roomCodeRef.current,
        field: gameRef.current.field,
        score: gameRef.current.score,
        currentFigure: gameRef.current.figure,
        figX: gameRef.current.figureX,
        figY: gameRef.current.figureY,
        figColor: gameRef.current.figureColor
      });
    }
  };

  const stepEffects = (dt) => {
    const fx = effectsRef.current;
    const factor = dt / 16.67;

    for (let i = fx.particles.length - 1; i >= 0; i--) {
      const p = fx.particles[i];
      p.x += p.vx * factor;
      p.y += p.vy * factor;
      p.vy += 0.22 * factor;
      p.life -= 0.032 * factor;
      if (p.life <= 0) fx.particles.splice(i, 1);
    }

    for (let i = fx.lineFlashes.length - 1; i >= 0; i--) {
      fx.lineFlashes[i].alpha -= 0.065 * factor;
      if (fx.lineFlashes[i].alpha <= 0) fx.lineFlashes.splice(i, 1);
    }

    for (let i = fx.lockFlashes.length - 1; i >= 0; i--) {
      fx.lockFlashes[i].alpha -= 0.08 * factor;
      if (fx.lockFlashes[i].alpha <= 0) fx.lockFlashes.splice(i, 1);
    }

    for (let i = fx.beams.length - 1; i >= 0; i--) {
      fx.beams[i].alpha -= 0.09 * factor;
      if (fx.beams[i].alpha <= 0) fx.beams.splice(i, 1);
    }
  };

  const drawAll = () => {
    const game = gameRef.current;
    if (!game) return;

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      drawGrid(ctx, game.field, game.getGhostY(), game.figure, game.figureX, game.figureY, game.figureColor, effectsRef.current);
    }

    if (holdRef.current) {
      drawMini(holdRef.current.getContext('2d'), game.holdFigureType);
    }

    game.nextQueue.forEach((figType, idx) => {
      if (nextRefs[idx] && nextRefs[idx].current) {
        drawMini(nextRefs[idx].current.getContext('2d'), figType);
      }
    });
  };

  const update = (time = performance.now()) => {
    const deltaTime = Math.min(100, Math.max(0, time - lastTimeRef.current));
    lastTimeRef.current = time;

    const game = gameRef.current;

    if (game && !gameOverRef.current && !isPausedRef.current) {
      let movedOrChanged = false;

      // 1. Horizontal DAS / ARR processing (strictly isolated from soft drop)
      const hState = horizInputRef.current;
      if (hState.activeDir !== 0) {
        hState.dasElapsed += deltaTime;
        if (hState.dasElapsed >= DEFAULT_DAS) {
          hState.arrElapsed += deltaTime;
          while (hState.arrElapsed >= DEFAULT_ARR) {
            hState.arrElapsed -= DEFAULT_ARR;
            if (game.moveSide(hState.activeDir)) {
              sound.move();
              movedOrChanged = true;
            } else {
              break;
            }
          }
        }
      }

      // 2. Soft drop processing (never auto-locks on touch; uses standard 500ms lock delay)
      const sState = softDropRef.current;
      if (sState.down) {
        sState.sdfElapsed += deltaTime;
        while (sState.sdfElapsed >= DEFAULT_SDF) {
          sState.sdfElapsed -= DEFAULT_SDF;
          if (game.moveDown()) {
            sound.softDrop();
            dropCounterRef.current = 0;
            movedOrChanged = true;
          } else {
            break;
          }
        }
      }

      // 3. Accurate frame-rate independent Lock Delay (500ms) & Gravity
      if (game.intersects(game.figureX, game.figureY + 1)) {
        game.lockDelayTimer += deltaTime;
        if (game.lockDelayTimer >= 500) {
          const linesCleared = game.freeze();
          sound.hardDrop();
          syncGameResult(game, linesCleared, null);
          movedOrChanged = true;
        }
      } else {
        dropCounterRef.current += deltaTime;
        if (dropCounterRef.current >= dropInterval) {
          dropCounterRef.current = 0;
          game.moveDown();
          movedOrChanged = true;
        }
      }

      stepEffects(deltaTime);
      drawAll();

      if (movedOrChanged && appStateRef.current === '2p_game') {
        emitState();
      }
    }

    animationFrameRef.current = requestAnimationFrame(update);
  };

  const startGame = () => {
    gameRef.current = new Tetris();
    setScore(0);
    setLinesCount(0);
    setActionText('');
    setRenText('');
    setIsPaused(false);
    isPausedRef.current = false;
    setGameOver(false);
    gameOverRef.current = false;
    setOpponentGameOver(false);

    lastTimeRef.current = performance.now();
    dropCounterRef.current = 0;
    horizInputRef.current = { leftDown: false, rightDown: false, activeDir: 0, dasElapsed: 0, arrElapsed: 0 };
    softDropRef.current = { down: false, sdfElapsed: 0 };
    effectsRef.current = { particles: [], lineFlashes: [], lockFlashes: [], beams: [] };

    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(update);
  };

  const returnToTitle = () => {
    sound.uiClick();
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (socket && roomCodeRef.current && appStateRef.current !== '1p_game') {
      socket.emit('leave_room', roomCodeRef.current);
    }
    setIsPaused(false);
    isPausedRef.current = false;
    setAppState('title');
    setRoomCode('');
    roomCodeRef.current = '';
  };

  // Socket setup
  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);
    return () => newSocket.close();
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('joined_room', () => {
      setAppState('2p_wait');
    });

    socket.on('room_full', () => {
      alert('Room is full!');
      returnToTitle();
    });

    socket.on('game_start', () => {
      sound.uiSelect();
      setAppState('2p_game');
      startGame();
    });

    socket.on('receive_state', (data) => {
      if (opponentCanvasRef.current) {
        const ctx = opponentCanvasRef.current.getContext('2d');
        setOpponentScore(prev => (prev !== data.score ? data.score : prev));
        drawGrid(ctx, data.field, -1, data.currentFigure, data.figX, data.figY, data.figColor);
      }
    });

    socket.on('receive_garbage', (data) => {
      if (gameRef.current && !gameOverRef.current) {
        gameRef.current.enemyAttack(data.lines);
        triggerBoardImpact(4, 4);
        if (gameRef.current.state === 'gameover') {
          sound.gameOver();
          setGameOver(true);
          gameOverRef.current = true;
          socket.emit('game_over', { roomCode: roomCodeRef.current });
          socket.emit('leave_room', roomCodeRef.current);
        }
        drawAll();
      }
    });

    socket.on('opponent_game_over', () => {
      setOpponentGameOver(true);
      setGameOver(true);
      gameOverRef.current = true;
      if (gameRef.current) {
        gameRef.current.state = 'gameover';
      }
      socket.emit('leave_room', roomCodeRef.current);
    });

    socket.on('opponent_disconnected', () => {
      if (!gameOverRef.current) {
        alert('Opponent disconnected.');
        returnToTitle();
      }
    });

    return () => {
      socket.off('joined_room');
      socket.off('room_full');
      socket.off('game_start');
      socket.off('receive_state');
      socket.off('receive_garbage');
      socket.off('opponent_game_over');
      socket.off('opponent_disconnected');
    };
  }, [socket, gameOver]);

  const toggleMute = () => {
    sound.muted = !sound.muted;
    setIsMuted(sound.muted);
    if (!sound.muted) sound.uiClick();
  };

  const renderGameUI = () => (
    <>
      {/* Top-left Star Score HUD matching the reference screenshot */}
      <div className="hud-top-left">
        <StarIcon />
        <span className="hud-score-num">{score.toLocaleString()}</span>
      </div>

      {/* Bottom-right circular HUD buttons (Pause for 1P + Sound Mute toggle) */}
      <div className="hud-bottom-right">
        <button
          className="circle-hud-btn"
          onClick={toggleMute}
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
        {appState === '1p_game' && (
          <button
            className="circle-hud-btn"
            onClick={togglePause}
            title="Pause (Esc)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="5" y="4" width="5" height="16" rx="1.5" />
              <rect x="14" y="4" width="5" height="16" rx="1.5" />
            </svg>
          </button>
        )}
      </div>

      <div className="game-area">
        {/* Left Column: HOLD & Action Callouts */}
        <div className="side-column">
          <div className="cyber-widget">
            <div className="cyber-widget-header">HOLD</div>
            <div className="cyber-widget-body">
              <canvas ref={holdRef} width={4 * MINI_CELL_SIZE} height={4 * MINI_CELL_SIZE} />
            </div>
          </div>

          <div className="action-callout-container">
            {actionText && (
              <div key={`act-${calloutKey}`} className="action-badge">
                {actionText}
              </div>
            )}
            {renText && (
              <div key={`ren-${calloutKey}`} className="ren-badge">
                {renText}
              </div>
            )}
          </div>
        </div>

        {/* Center Main Board with Cyber Brackets & Stacked Base */}
        <div className="board-wrapper">
          <div className="corner-bracket tl" />
          <div className="corner-bracket tr" />

          <div
            className="board-container"
            style={{
              transform: `translate(${boardShake.x}px, ${boardShake.y}px)`
            }}
          >
            <canvas
              ref={canvasRef}
              width={GRID_WIDTH * CELL_SIZE}
              height={GRID_HEIGHT * CELL_SIZE}
            />

            {/* Floating Action Callout on Board */}
            {(actionText || renText) && !isPaused && !gameOver && (
              <div key={`float-${calloutKey}`} className="board-floating-callout">
                {actionText && <div className="main-callout">{actionText}</div>}
                {renText && <div className="sub-callout">{renText}</div>}
              </div>
            )}

            {/* 1P Pause Menu Overlay (Triggered by Escape or Pause Icon) */}
            {isPaused && appState === '1p_game' && !gameOver && (
              <div className="cyber-overlay">
                <span className="system-badge">SYSTEM // PAUSED</span>
                <div className="overlay-title">PAUSED</div>
                <div className="overlay-subtitle">AWAITING OPERATOR COMMAND</div>
                <button
                  className="cyber-btn cyber-btn-primary"
                  onClick={togglePause}
                >
                  RESUME (再開)
                </button>
                <button
                  className="cyber-btn cyber-btn-danger"
                  onClick={returnToTitle}
                >
                  QUIT (やめる)
                </button>
              </div>
            )}

            {/* Game Over Overlay */}
            {gameOver && (
              <div className="cyber-overlay">
                <span className="system-badge">SESSION // TERMINATED</span>
                <div className={`overlay-title ${opponentGameOver ? '' : 'danger'}`}>
                  {opponentGameOver ? 'YOU WIN!' : (appState === '2p_game' ? 'YOU LOSE...' : 'GAME OVER')}
                </div>
                <div className="overlay-subtitle">FINAL SCORE: {score.toLocaleString()}</div>
                {appState === '1p_game' && (
                  <button
                    className="cyber-btn cyber-btn-primary"
                    onClick={() => {
                      sound.uiSelect();
                      startGame();
                    }}
                  >
                    RETRY (もう一度)
                  </button>
                )}
                <button className="cyber-btn" onClick={returnToTitle}>
                  TITLE (タイトルへ)
                </button>
              </div>
            )}
          </div>

          <div className="board-base-layers">
            <div className="board-base-layer l1" />
            <div className="board-base-layer l2" />
            <div className="board-base-layer l3" />
          </div>
        </div>

        {/* Right Column: NEXT & SCORE (Replacing LEVEL from reference image) */}
        <div className="side-column">
          <div className="cyber-widget">
            <div className="cyber-widget-header">NEXT</div>
            <div className="cyber-widget-body" style={{ gap: '6px', padding: '8px 4px' }}>
              {[0, 1, 2].map(i => (
                <canvas
                  key={i}
                  ref={nextRefs[i]}
                  width={4 * MINI_CELL_SIZE}
                  height={4 * MINI_CELL_SIZE}
                />
              ))}
            </div>
          </div>

          <div className="cyber-widget">
            <div className="cyber-widget-header">SCORE</div>
            <div className="cyber-widget-body" style={{ minHeight: '76px' }}>
              <div className="score-widget-value">{score.toLocaleString()}</div>
              <div className="lines-sub-value">LINES: {linesCount}</div>
            </div>
          </div>
        </div>

        {/* 2P Opponent Display */}
        {appState === '2p_game' && (
          <div className="opponent-area">
            <div className="opponent-header">TARGET // OPPONENT</div>
            <div className="board-wrapper">
              <div className="corner-bracket tl" />
              <div className="corner-bracket tr" />
              <div className="board-container">
                <canvas
                  ref={opponentCanvasRef}
                  width={GRID_WIDTH * CELL_SIZE}
                  height={GRID_HEIGHT * CELL_SIZE}
                />
                {opponentGameOver && (
                  <div className="cyber-overlay">
                    <div className="overlay-title">K.O.!</div>
                  </div>
                )}
              </div>
            </div>
            <div className="cyber-widget" style={{ marginTop: '10px' }}>
              <div className="cyber-widget-header">ENEMY SCORE</div>
              <div className="cyber-widget-body" style={{ minHeight: '50px' }}>
                <div className="score-widget-value" style={{ fontSize: '1.15rem' }}>
                  {opponentScore.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="app-container">
      {appState === 'title' && (
        <div className="cyber-modal-card">
          <div className="system-badge">CYBER MATRIX SYSTEM // VER 2.0</div>
          <div className="logo-container">
            <Logo />
          </div>
          <h1 className="title-text">HOSSHI TETRIS</h1>
          <p className="subtitle-text">TACTICAL PRO EDITION</p>

          <button
            className="cyber-btn cyber-btn-primary"
            onClick={() => {
              sound.uiSelect();
              setAppState('1p_game');
              startGame();
            }}
          >
            1 PLAYER (SOLO)
          </button>

          <button
            className="cyber-btn"
            onClick={() => {
              sound.uiClick();
              setAppState('join_room');
            }}
          >
            2 PLAYERS (ONLINE)
          </button>

          <div className="controls-hint-grid">
            <span><b>← / →</b> : MOVE</span>
            <span><b>↑ / X</b> : ROTATE CW</span>
            <span><b>Z / CTRL</b> : ROTATE CCW</span>
            <span><b>A</b> : ROTATE 180°</span>
            <span><b>SPACE</b> : HARD DROP</span>
            <span><b>C / SHIFT</b> : HOLD</span>
            <span><b>↓</b> : SOFT DROP</span>
            <span><b>ESC</b> : PAUSE (1P)</span>
          </div>
        </div>
      )}

      {appState === 'join_room' && (
        <div className="cyber-modal-card">
          <div className="system-badge">NETWORK // MULTIPLAYER</div>
          <h2 className="title-text" style={{ fontSize: '1.9rem', marginBottom: '12px' }}>
            ACCESS ROOM
          </h2>
          <p className="subtitle-text" style={{ marginBottom: '1.2rem' }}>
            ENTER SYNCHRONIZATION CODE
          </p>
          <input
            className="input-field"
            placeholder="ROOM CODE"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            maxLength={10}
          />
          <button
            className="cyber-btn cyber-btn-primary"
            onClick={() => {
              if (roomCode.trim().length > 0) {
                sound.uiSelect();
                socket.emit('join_room', roomCode.trim());
              }
            }}
          >
            CONNECT (参加/作成)
          </button>
          <button
            className="cyber-btn"
            onClick={() => {
              sound.uiClick();
              setAppState('title');
            }}
          >
            BACK (戻る)
          </button>
        </div>
      )}

      {appState === '2p_wait' && (
        <div className="cyber-modal-card">
          <div className="system-badge">STANDBY // LINKING</div>
          <h2 className="title-text" style={{ fontSize: '1.9rem', marginBottom: '10px' }}>
            ROOM: {roomCode}
          </h2>
          <p className="subtitle-text">WAITING FOR CHALLENGER...</p>
          <div className="logo-container" style={{ transform: 'scale(0.75)' }}>
            <Logo />
          </div>
          <button
            className="cyber-btn cyber-btn-danger"
            onClick={returnToTitle}
          >
            ABORT (キャンセル)
          </button>
        </div>
      )}

      {(appState === '1p_game' || appState === '2p_game') && renderGameUI()}
    </div>
  );
}
