import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Tetris } from './game/Tetris';
import { COLORS, SHAPES, GRID_WIDTH, GRID_HEIGHT } from './game/config';
import './index.css';

const SOCKET_URL = window.location.hostname === 'localhost' ? 'http://localhost:3005' : '/';
const CELL_SIZE = 30;
const MINI_CELL_SIZE = 20;

function drawGrid(ctx, field, ghostY, currentFigure, figX, figY, figColor) {
  ctx.clearRect(0, 0, GRID_WIDTH * CELL_SIZE, GRID_HEIGHT * CELL_SIZE);
  
  // Draw placed blocks
  for (let r = 0; r < GRID_HEIGHT; r++) {
    for (let c = 0; c < GRID_WIDTH; c++) {
      if (field[r][c] > 0) {
        drawBlock(ctx, c, r, field[r][c], CELL_SIZE);
      }
    }
  }

  // Draw Ghost
  if (currentFigure) {
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < currentFigure.length; i++) {
      for (let j = 0; j < currentFigure[i].length; j++) {
        if (currentFigure[i][j]) {
          const x = figX + j;
          const y = ghostY + i;
          if (y >= 0) drawBlock(ctx, x, y, figColor, CELL_SIZE);
        }
      }
    }
    ctx.globalAlpha = 1.0;

    // Draw current piece
    for (let i = 0; i < currentFigure.length; i++) {
      for (let j = 0; j < currentFigure[i].length; j++) {
        if (currentFigure[i][j]) {
          const x = figX + j;
          const y = figY + i;
          if (y >= 0) drawBlock(ctx, x, y, figColor, CELL_SIZE);
        }
      }
    }
  }

  // Grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= GRID_WIDTH * CELL_SIZE; x += CELL_SIZE) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, GRID_HEIGHT * CELL_SIZE); ctx.stroke();
  }
  for (let y = 0; y <= GRID_HEIGHT * CELL_SIZE; y += CELL_SIZE) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(GRID_WIDTH * CELL_SIZE, y); ctx.stroke();
  }
}

function drawBlock(ctx, x, y, colorIndex, size) {
  const color = COLORS[colorIndex];
  ctx.fillStyle = color;
  ctx.fillRect(x * size, y * size, size, size);
  
  // Highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fillRect(x * size, y * size, size, 4);
  ctx.fillRect(x * size, y * size, 4, size);
  
  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(x * size, y * size + size - 4, size, 4);
  ctx.fillRect(x * size + size - 4, y * size, 4, size);
}

function drawMini(ctx, figType) {
  ctx.clearRect(0, 0, 4 * MINI_CELL_SIZE, 4 * MINI_CELL_SIZE);
  if (!figType) return;
  
  const fig = SHAPES[figType];
  const offsetX = figType === 4 ? 1 : (figType === 1 ? 0 : 0.5);
  const offsetY = figType === 1 ? 1 : 1;

  for (let i = 0; i < fig.length; i++) {
    for (let j = 0; j < fig[i].length; j++) {
      if (fig[i][j]) {
        drawBlock(ctx, j + offsetX, i + offsetY, figType, MINI_CELL_SIZE);
      }
    }
  }
}

// Custom Logo SVG to represent the crescent moon and star
const Logo = () => (
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    {/* Crescent Moon */}
    <path d="M 65 10 A 40 40 0 1 0 95 65 A 35 35 0 0 1 65 10 Z" fill="#ffffff" />
    {/* Star (Sparkle) */}
    <path d="M 75 25 Q 80 25 80 20 Q 80 25 85 25 Q 80 25 80 30 Q 80 25 75 25 Z" fill="#ffffff" />
  </svg>
);

export default function App() {
  const [appState, setAppState] = useState('title'); // title, join_room, 1p_game, 2p_wait, 2p_game
  const [roomCode, setRoomCode] = useState('');
  const [socket, setSocket] = useState(null);
  
  const [score, setScore] = useState(0);
  const [actionText, setActionText] = useState('');
  const [renText, setRenText] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [opponentGameOver, setOpponentGameOver] = useState(false);

  // Opponent state
  const [opponentScore, setOpponentScore] = useState(0);

  const appStateRef = useRef(appState);
  const roomCodeRef = useRef(roomCode);
  const gameOverRef = useRef(gameOver);

  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  useEffect(() => {
    roomCodeRef.current = roomCode;
  }, [roomCode]);

  useEffect(() => {
    gameOverRef.current = gameOver;
  }, [gameOver]);

  const canvasRef = useRef(null);
  const holdRef = useRef(null);
  const nextRefs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)];
  const opponentCanvasRef = useRef(null);

  const gameRef = useRef(null);
  const animationFrameRef = useRef(null);
  
  const lastTimeRef = useRef(0);
  const dropCounterRef = useRef(0);
  const dropInterval = 500; // ms

  const keysRef = useRef({});
  const dasTimerRef = useRef({ time: 0, activeKey: null, initialDelayPassed: false });

  // Input handling
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!gameRef.current || (appState !== '1p_game' && appState !== '2p_game')) return;
      
      if (e.code === 'Escape' && appState === '1p_game') {
        setAppState('title');
        return;
      }

      if (gameOverRef.current) return;
      
      const game = gameRef.current;
      let stateChanged = false;

      // Handle DAS movement keys
      if (['ArrowLeft', 'ArrowRight', 'ArrowDown'].includes(e.code)) {
        if (!keysRef.current[e.code]) {
          keysRef.current[e.code] = true;
          dasTimerRef.current = { time: performance.now(), activeKey: e.code, initialDelayPassed: false };
          if (e.code === 'ArrowLeft') game.moveSide(-1);
          if (e.code === 'ArrowRight') game.moveSide(1);
          if (e.code === 'ArrowDown') game.moveDown();
          stateChanged = true;
        }
      } else {
        // Handle Action keys
        switch(e.code) {
          case 'ArrowUp': game.rotateClockwise(); stateChanged = true; break;
          case 'KeyZ': game.rotateCounterClockwise(); stateChanged = true; break;
          case 'Space': 
            const linesCleared = game.dropSpace(); 
            if (appStateRef.current === '2p_game' && linesCleared >= 2 && socket) {
              const garbage = linesCleared - 1 + (game.ren > 0 ? 1 : 0);
              socket.emit('send_garbage', { roomCode: roomCodeRef.current, lines: garbage });
            }
            stateChanged = true;
            break;
          case 'KeyC':
          case 'ShiftLeft':
          case 'ShiftRight':
            game.hold(); stateChanged = true; break;
          default: break;
        }
      }

      if (stateChanged) {
        setScore(game.score);
        setActionText(game.lastActionText);
        setRenText(game.renText);
        if (game.state === 'gameover') {
          setGameOver(true);
          gameOverRef.current = true;
          if (appStateRef.current === '2p_game') {
            socket?.emit('game_over', { roomCode: roomCodeRef.current });
            socket?.emit('leave_room', roomCodeRef.current);
          }
        }
        drawAll();
        if (appStateRef.current === '2p_game') emitState();
      }
    };

    const handleKeyUp = (e) => {
      if (keysRef.current[e.code]) {
        keysRef.current[e.code] = false;
        if (dasTimerRef.current.activeKey === e.code) {
          // Find if any other movement key is still down
          const fallbackKey = ['ArrowLeft', 'ArrowRight', 'ArrowDown'].find(k => keysRef.current[k]);
          dasTimerRef.current.activeKey = fallbackKey || null;
          if (fallbackKey) {
            dasTimerRef.current.time = performance.now();
            dasTimerRef.current.initialDelayPassed = false;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
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

  const drawAll = () => {
    const game = gameRef.current;
    if (!game) return;
    
    // Draw Main Board
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      drawGrid(ctx, game.field, game.getGhostY(), game.figure, game.figureX, game.figureY, game.figureColor);
    }
    
    // Draw Hold
    if (holdRef.current) {
      drawMini(holdRef.current.getContext('2d'), game.holdFigureType);
    }

    // Draw Next
    game.nextQueue.forEach((figType, idx) => {
      if (nextRefs[idx].current) {
        drawMini(nextRefs[idx].current.getContext('2d'), figType);
      }
    });
  };

  const update = (time = 0) => {
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;

    const game = gameRef.current;

    if (game && !gameOverRef.current) {
      // Process DAS
      const dasState = dasTimerRef.current;
      if (dasState.activeKey) {
        const elapsed = time - dasState.time;
        const delay = dasState.initialDelayPassed ? 40 : 150; // 150ms initial delay, 40ms repeat
        if (elapsed > delay) {
          dasState.time = time;
          dasState.initialDelayPassed = true;
          if (dasState.activeKey === 'ArrowLeft') game.moveSide(-1);
          if (dasState.activeKey === 'ArrowRight') game.moveSide(1);
          if (dasState.activeKey === 'ArrowDown') game.moveDown();
          drawAll();
          if (appStateRef.current === '2p_game') emitState();
        }
      }

      dropCounterRef.current += deltaTime;
      
      // Auto drop
      if (dropCounterRef.current > dropInterval) {
        dropCounterRef.current = 0;
        
        if (game.intersects(game.figureX, game.figureY + 1)) {
          game.lockDelayTimer += 100; // rough approximation per drop step
          if (game.lockDelayTimer >= 300) { // Set lock delay limit to 300ms
             const linesCleared = game.freeze();
             if (appStateRef.current === '2p_game' && linesCleared >= 2 && socket) {
                const garbage = linesCleared - 1 + (game.ren > 0 ? 1 : 0);
                socket.emit('send_garbage', { roomCode: roomCodeRef.current, lines: garbage });
             }
             setScore(game.score);
             setActionText(game.lastActionText);
             setRenText(game.renText);
             if (game.state === 'gameover') {
               setGameOver(true);
               gameOverRef.current = true;
               if (appStateRef.current === '2p_game') {
                 socket?.emit('game_over', { roomCode: roomCodeRef.current });
                 socket?.emit('leave_room', roomCodeRef.current);
               }
             }
          }
        } else {
          game.lockDelayTimer = 0;
          game.moveDown();
        }
        drawAll();
        if (appStateRef.current === '2p_game') emitState();
      }
    }
    
    animationFrameRef.current = requestAnimationFrame(update);
  };

  const startGame = () => {
    gameRef.current = new Tetris();
    setScore(0);
    setActionText('');
    setRenText('');
    setGameOver(false);
    gameOverRef.current = false;
    setOpponentGameOver(false);
    lastTimeRef.current = performance.now();
    dropCounterRef.current = 0;
    keysRef.current = {};
    dasTimerRef.current = { time: 0, activeKey: null, initialDelayPassed: false };
    
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    update();
  };

  const returnToTitle = () => {
    if (socket && roomCodeRef.current && appStateRef.current !== '1p_game') {
      socket.emit('leave_room', roomCodeRef.current);
    }
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

    socket.on('joined_room', (room) => {
      setAppState('2p_wait');
    });

    socket.on('room_full', () => {
      alert("Room is full!");
      returnToTitle();
    });

    socket.on('game_start', () => {
      setAppState('2p_game');
      startGame();
    });

    socket.on('receive_state', (data) => {
      if (opponentCanvasRef.current) {
        const ctx = opponentCanvasRef.current.getContext('2d');
        setOpponentScore(prev => prev !== data.score ? data.score : prev);
        drawGrid(ctx, data.field, -1, data.currentFigure, data.figX, data.figY, data.figColor);
      }
    });

    socket.on('receive_garbage', (data) => {
      if (gameRef.current && !gameOverRef.current) {
        gameRef.current.enemyAttack(data.lines);
        if (gameRef.current.state === 'gameover') {
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
        alert("Opponent disconnected.");
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


  const renderGameUI = () => (
    <div className="game-area">
      <div className="side-panel">
        <div className="panel-box hold-box">
          <div className="panel-title">HOLD</div>
          <canvas ref={holdRef} width={4*MINI_CELL_SIZE} height={4*MINI_CELL_SIZE}></canvas>
        </div>
        <div className="panel-box score-box">
          <div className="panel-title">SCORE</div>
          <div className="score-value">{score}</div>
          <div className="action-text">{actionText}</div>
          <div className="ren-text">{renText}</div>
        </div>
      </div>

      <div className="board-container">
        <canvas ref={canvasRef} width={GRID_WIDTH*CELL_SIZE} height={GRID_HEIGHT*CELL_SIZE}></canvas>
        {gameOver && (
          <div className="game-over-overlay">
            <div className="game-over-text">
              {opponentGameOver ? 'YOU WIN!' : (appState === '2p_game' ? 'YOU LOSE...' : 'GAME OVER')}
            </div>
            <button className="btn btn-primary" onClick={returnToTitle}>Return to Title</button>
          </div>
        )}
      </div>

      <div className="side-panel">
        <div className="panel-box next-box">
          <div className="panel-title">NEXT</div>
          {[0,1,2,3,4].map(i => (
            <canvas key={i} ref={nextRefs[i]} width={4*MINI_CELL_SIZE} height={4*MINI_CELL_SIZE} style={{marginBottom: i < 4 ? '10px' : '0'}}></canvas>
          ))}
        </div>
      </div>

      {appState === '2p_game' && (
        <div className="opponent-area panel-box">
          <div className="opponent-title">OPPONENT</div>
          <div className="board-container">
            <canvas ref={opponentCanvasRef} width={GRID_WIDTH*CELL_SIZE} height={GRID_HEIGHT*CELL_SIZE}></canvas>
            {opponentGameOver && (
              <div className="game-over-overlay" style={{background: 'rgba(0,0,0,0.5)'}}>
                <div className="game-over-text" style={{fontSize: '1.5rem'}}>WINNER!</div>
              </div>
            )}
          </div>
          <div className="panel-title" style={{marginTop: '10px'}}>SCORE: {opponentScore}</div>
        </div>
      )}
    </div>
  );

  return (
    <div className="app-container">
      {appState === 'title' && (
        <div className="glass-panel title-screen">
          <div className="logo-container">
            <Logo />
          </div>
          <h1 className="title-text">HOSSHI TETRIS</h1>
          <p className="subtitle-text">Web Edition</p>
          <button className="btn btn-primary" onClick={() => {
            setAppState('1p_game');
            startGame();
          }}>1 Player</button>
          <button className="btn" onClick={() => setAppState('join_room')}>2 Players (Online)</button>
        </div>
      )}

      {appState === 'join_room' && (
        <div className="glass-panel title-screen">
          <h2 className="title-text" style={{fontSize: '2rem', marginBottom: '20px'}}>Join Room</h2>
          <input 
            className="input-field" 
            placeholder="Enter Room Code" 
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            maxLength={10}
          />
          <button className="btn btn-primary" onClick={() => {
            if(roomCode.trim().length > 0) socket.emit('join_room', roomCode);
          }}>Join / Create</button>
          <button className="btn" onClick={() => setAppState('title')}>Back</button>
        </div>
      )}

      {appState === '2p_wait' && (
        <div className="glass-panel title-screen">
          <h2 className="title-text" style={{fontSize: '2rem', marginBottom: '20px'}}>Room: {roomCode}</h2>
          <p className="subtitle-text">Waiting for opponent to join...</p>
          <div className="logo-container" style={{transform: 'scale(0.5)'}}>
            <Logo />
          </div>
          <button className="btn" onClick={() => {
             // In a real app we'd emit leave_room, but reload/reconnect is simpler here
             window.location.reload(); 
          }}>Cancel</button>
        </div>
      )}

      {(appState === '1p_game' || appState === '2p_game') && renderGameUI()}
    </div>
  );
}
