import { GRID_WIDTH, GRID_HEIGHT, SHAPES, SRS_OFFSETS_NORMAL, SRS_OFFSETS_I } from './config.js';

export class Tetris {
  constructor(height = GRID_HEIGHT, width = GRID_WIDTH) {
    this.height = height;
    this.width = width;
    this.state = "logo"; // "title", "start", "pause", "gameover", "logo"
    this.reset();
  }

  reset() {
    this.field = Array.from({ length: this.height }, () => Array(this.width).fill(0));
    this.score = 0;
    this.lines = 0;
    this.ren = -1;
    this.b2b = -1;
    this.lastActionText = "";
    this.renText = "";
    this.lastEvent = null;

    this.bag = [];
    this.nextQueue = [];
    this.fillNextQueue();

    this.holdFigureType = null;
    this.hasHeldThisTurn = false;

    this.lockDelayTimer = 0;
    this.lockResetCount = 0;
    this.lowestY = 0;

    this.newFigure();
  }

  getBag() {
    const bag = [1, 2, 3, 4, 5, 6, 7];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
  }

  fillNextQueue() {
    while (this.nextQueue.length < 5) {
      if (this.bag.length === 0) {
        this.bag = this.getBag();
      }
      this.nextQueue.push(this.bag.shift());
    }
  }

  newFigure() {
    this.fillNextQueue();
    this.figureType = this.nextQueue.shift();
    this.fillNextQueue();

    this.figure = SHAPES[this.figureType].map(row => [...row]);
    this.figureColor = this.figureType;

    this.figureX = 3;
    this.figureY = this.figureType === 1 ? -1 : 0;

    this.rotationState = 0;
    this.hasHeldThisTurn = false;
    this.wasLastMoveRotation = false;
    this.lastKickIndex = 0;
    this.lockDelayTimer = 0;
    this.lockResetCount = 0;
    this.lowestY = this.figureY;
  }

  hold() {
    if (this.hasHeldThisTurn) return false;

    if (this.holdFigureType === null) {
      this.holdFigureType = this.figureType;
      this.newFigure();
    } else {
      const temp = this.figureType;
      this.figureType = this.holdFigureType;
      this.holdFigureType = temp;

      this.figure = SHAPES[this.figureType].map(row => [...row]);
      this.figureColor = this.figureType;
      this.figureX = 3;
      this.figureY = this.figureType === 1 ? -1 : 0;
      this.rotationState = 0;
      this.wasLastMoveRotation = false;
      this.lastKickIndex = 0;
      this.lockDelayTimer = 0;
      this.lockResetCount = 0;
      this.lowestY = this.figureY;
    }

    this.hasHeldThisTurn = true;
    return true;
  }

  intersects(fx, fy, fig = this.figure) {
    for (let i = 0; i < fig.length; i++) {
      for (let j = 0; j < fig[i].length; j++) {
        if (fig[i][j]) {
          if (i + fy < 0) {
            if (j + fx < 0 || j + fx >= this.width) return true;
            continue;
          }
          if (
            i + fy >= this.height ||
            j + fx >= this.width ||
            j + fx < 0 ||
            this.field[i + fy][j + fx] > 0
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }

  isImmobile() {
    return (
      this.intersects(this.figureX - 1, this.figureY) &&
      this.intersects(this.figureX + 1, this.figureY) &&
      this.intersects(this.figureX, this.figureY - 1) &&
      this.intersects(this.figureX, this.figureY + 1)
    );
  }

  checkTSpin() {
    if (this.figureType !== 6 || !this.wasLastMoveRotation) return false;

    const cx = this.figureX + 1;
    const cy = this.figureY + 1;

    const corners = [
      [cx - 1, cy - 1],
      [cx + 1, cy - 1],
      [cx - 1, cy + 1],
      [cx + 1, cy + 1]
    ];

    let filledCount = 0;
    for (const [x, y] of corners) {
      if (x < 0 || x >= this.width || y >= this.height || (y >= 0 && this.field[y][x] > 0)) {
        filledCount++;
      }
    }
    return filledCount >= 3;
  }

  checkSpinType() {
    if (!this.wasLastMoveRotation) return null;
    if (this.figureType === 6) {
      if (this.checkTSpin() || this.isImmobile()) return 'T-SPIN';
      return null;
    }
    if (this.figureType !== 4 && this.isImmobile()) {
      const names = { 1: 'I-SPIN', 2: 'J-SPIN', 3: 'L-SPIN', 5: 'S-SPIN', 7: 'Z-SPIN' };
      return names[this.figureType] || 'ALL-SPIN';
    }
    return null;
  }

  _resetLockDelayOnMove() {
    if (this.figureY > this.lowestY) {
      this.lowestY = this.figureY;
      this.lockResetCount = 0;
      this.lockDelayTimer = 0;
    } else if (this.lockResetCount < 15) {
      this.lockDelayTimer = 0;
      this.lockResetCount++;
    }
  }

  _performRotate(rotated, newRot, offsets) {
    for (let idx = 0; idx < offsets.length; idx++) {
      const [dx, dy] = offsets[idx];
      // Standard SRS table uses +Y as UP; our grid uses +Y as DOWN, so we use +dy for Y offset
      // Wait: in config.js, SRS_OFFSETS_NORMAL has '0,1': [[0,0], [-1,0], [-1,-1], [0,2], [-1,2]]
      // Where test 3 (-1,-1) in screen coords (Y down) is left 1, up 1, and test 4 (0,2) is down 2 (TST kick)!
      // Therefore, this.figureY + dy is the exact screen-coordinate offset!
      if (!this.intersects(this.figureX + dx, this.figureY + dy, rotated)) {
        this.figureX += dx;
        this.figureY += dy;
        this.figure = rotated;
        this.rotationState = newRot;
        this.wasLastMoveRotation = true;
        this.lastKickIndex = idx;
        this._resetLockDelayOnMove();
        return true;
      }
    }
    return false;
  }

  rotateClockwise() {
    if (this.figureType === 4) return false;
    const oldRot = this.rotationState;
    const newRot = (oldRot + 1) % 4;
    const rotated = this.figure[0].map((_, i) => this.figure.map(row => row[i]).reverse());
    const table = this.figureType === 1 ? SRS_OFFSETS_I : SRS_OFFSETS_NORMAL;
    const extra = (this.figureType !== 1 && table[`${oldRot},${newRot}_tst`]) || [];
    const offsets = [...table[`${oldRot},${newRot}`], ...extra];
    return this._performRotate(rotated, newRot, offsets);
  }

  rotateCounterClockwise() {
    if (this.figureType === 4) return false;
    const oldRot = this.rotationState;
    const newRot = (oldRot - 1 + 4) % 4;
    const rotated = this.figure[0].map((_, i) => this.figure.map(row => row[row.length - 1 - i]));
    const table = this.figureType === 1 ? SRS_OFFSETS_I : SRS_OFFSETS_NORMAL;
    const extra = (this.figureType !== 1 && table[`${oldRot},${newRot}_tst`]) || [];
    const offsets = [...table[`${oldRot},${newRot}`], ...extra];
    return this._performRotate(rotated, newRot, offsets);
  }

  rotate180() {
    if (this.figureType === 4) return false;
    const oldRot = this.rotationState;
    const newRot = (oldRot + 2) % 4;
    const rotated = this.figure.map(row => [...row].reverse()).reverse();
    const offsets = [
      [0, 0],
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1]
    ];
    return this._performRotate(rotated, newRot, offsets);
  }

  freeze() {
    const spinType = this.checkSpinType();
    const lockedCells = [];

    for (let i = 0; i < this.figure.length; i++) {
      for (let j = 0; j < this.figure[i].length; j++) {
        if (this.figure[i][j]) {
          const r = i + this.figureY;
          const c = j + this.figureX;
          if (r >= 0 && r < this.height && c >= 0 && c < this.width) {
            this.field[r][c] = this.figureColor;
            lockedCells.push({ x: c, y: r, color: this.figureColor });
          }
        }
      }
    }

    const clearResult = this.clearLines(spinType, lockedCells);
    this.newFigure();
    if (this.intersects(this.figureX, this.figureY)) {
      this.state = "gameover";
    }
    return clearResult.linesCleared;
  }

  clearLines(spinType, lockedCells = []) {
    const clearedRowIndices = [];
    for (let i = 0; i < this.height; i++) {
      if (!this.field[i].includes(0)) {
        clearedRowIndices.push(i);
      }
    }

    const lines = clearedRowIndices.length;
    for (const rowIndex of clearedRowIndices) {
      this.field.splice(rowIndex, 1);
      this.field.unshift(Array(this.width).fill(0));
    }

    const isPerfectClear = lines > 0 && this.field.every(row => row.every(cell => cell === 0));

    if (lines > 0) {
      this.lines += lines;
      this.ren += 1;
      let baseGain = 0;
      const isDifficult = Boolean(spinType) || lines === 4;

      if (spinType) {
        if (lines === 1) { baseGain = spinType === 'T-SPIN' ? 800 : 400; this.lastActionText = `${spinType} SINGLE`; }
        else if (lines === 2) { baseGain = spinType === 'T-SPIN' ? 1200 : 800; this.lastActionText = `${spinType} DOUBLE!!`; }
        else if (lines === 3) { baseGain = spinType === 'T-SPIN' ? 1600 : 1200; this.lastActionText = `${spinType} TRIPLE!!!`; }
      } else {
        if (lines === 1) { baseGain = 100; this.lastActionText = "SINGLE"; }
        else if (lines === 2) { baseGain = 300; this.lastActionText = "DOUBLE"; }
        else if (lines === 3) { baseGain = 500; this.lastActionText = "TRIPLE"; }
        else if (lines === 4) { baseGain = 800; this.lastActionText = "TETRIS!"; }
      }

      if (isDifficult) {
        this.b2b += 1;
        if (this.b2b > 0) {
          baseGain = Math.floor(baseGain * 1.5);
          this.lastActionText = `B2B ${this.lastActionText}`;
        }
      } else {
        this.b2b = -1;
      }

      if (isPerfectClear) {
        baseGain += 3000;
        this.lastActionText = `PERFECT CLEAR!`;
      }

      const renGain = this.ren > 0 ? this.ren * 50 : 0;
      if (this.ren > 0) this.renText = `${this.ren} REN!`;
      else this.renText = "";

      this.score += baseGain + renGain;
    } else {
      if (spinType) {
        this.score += spinType === 'T-SPIN' ? 400 : 200;
        this.lastActionText = spinType;
      } else {
        this.lastActionText = "";
      }
      this.ren = -1;
      this.renText = "";
    }

    this.lastEvent = {
      linesCleared: lines,
      clearedRows: clearedRowIndices,
      spinType,
      isPerfectClear,
      ren: this.ren,
      b2b: this.b2b,
      actionText: this.lastActionText,
      renText: this.renText,
      lockedCells,
      timestamp: performance.now()
    };

    return { linesCleared: lines, clearedRows: clearedRowIndices };
  }

  dropSpace() {
    let dropDist = 0;
    while (!this.intersects(this.figureX, this.figureY + 1)) {
      this.figureY++;
      dropDist++;
    }
    if (dropDist > 0) {
      this.wasLastMoveRotation = false;
      this.score += dropDist * 2;
    }
    return this.freeze();
  }

  moveDown() {
    if (!this.intersects(this.figureX, this.figureY + 1)) {
      this.figureY++;
      this.wasLastMoveRotation = false;
      if (this.figureY > this.lowestY) {
        this.lowestY = this.figureY;
        this.lockResetCount = 0;
        this.lockDelayTimer = 0;
      }
      return true;
    }
    return false;
  }

  moveSide(dx) {
    if (!this.intersects(this.figureX + dx, this.figureY)) {
      this.figureX += dx;
      this.wasLastMoveRotation = false;
      this._resetLockDelayOnMove();
      return true;
    }
    return false;
  }

  getGhostY() {
    let ghostY = this.figureY;
    while (!this.intersects(this.figureX, ghostY + 1)) {
      ghostY++;
    }
    return ghostY;
  }

  enemyAttack(lines) {
    if (lines <= 0) return;

    for (let i = 0; i < lines; i++) {
      if (this.field[0].some(cell => cell > 0)) {
        this.state = "gameover";
        return;
      }

      for (let r = 0; r < this.height - 1; r++) {
        this.field[r] = [...this.field[r + 1]];
      }

      const hole = Math.floor(Math.random() * this.width);
      this.field[this.height - 1] = Array(this.width).fill(8);
      this.field[this.height - 1][hole] = 0;
    }
  }
}
