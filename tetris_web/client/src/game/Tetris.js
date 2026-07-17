import { GRID_WIDTH, GRID_HEIGHT, SHAPES, SRS_OFFSETS_NORMAL, SRS_OFFSETS_I } from './config';

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
    this.ren = -1;
    this.lastActionText = "";
    this.renText = "";

    this.bag = [];
    this.nextQueue = [];
    this.fillNextQueue();

    this.holdFigureType = null;
    this.hasHeldThisTurn = false;

    this.lockDelayTimer = 0;
    this.lockDelayLimit = 30; // approx 500ms at 60fps

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
    this.lockDelayTimer = 0;
  }

  hold() {
    if (this.hasHeldThisTurn) return;

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
    }

    this.hasHeldThisTurn = true;
    this.lockDelayTimer = 0;
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

  rotate() {
    if (this.figureType === 4) return; // O shape
    const oldRot = this.rotationState;
    const newRot = (oldRot + 1) % 4;
    
    // Rotate 90 degrees clockwise
    const rotated = this.figure[0].map((val, index) =>
      this.figure.map(row => row[index]).reverse()
    );

    const table = this.figureType === 1 ? SRS_OFFSETS_I : SRS_OFFSETS_NORMAL;
    const offsets = table[`${oldRot},${newRot}`];

    for (const [dx, dy] of offsets) {
      if (!this.intersects(this.figureX + dx, this.figureY - dy, rotated)) { // note: python was +dy, but pygame uses inverted Y, so check coordinates carefully. Pygame y goes down. Wait, original python SRS offsets had (dx, dy). In Pygame, +dy is DOWN. Let's look at the offsets: (0, 2) means down 2 in Pygame? Actually SRS standard y is + up. In Python, my `intersects` did `i + f_y`. So in Python, `self.figure_y += dy`. If `dy` is positive, it goes DOWN. Let's use `+ dy`. But standard SRS has Y up. I will just use `+ dy` as in Python.
        this.figureX += dx;
        this.figureY -= dy; // In SRS Y is up, but grid Y is down. Wait, Python did: `self.figure_y += dy`. Let's stick to original Python if we want identical behavior. Let's look at the python code: `self.figure_y += dy`. Let's do `this.figureY -= dy` because standard SRS offsets Y are up (+y is up). But wait, Python had `self.figure_y += dy`.
        // Let's re-verify: Python code: `self.figure_y += dy`. I will use `this.figureY += dy` if Python did that, but maybe Python offsets were already inverted?
        // Let's look at Python: `(0, 1): [(0, 0), (-1, 0), (-1, -1), (0,  2), (-1,  2)]`.
        // Wait, Python SRS_OFFSETS_NORMAL `0,1` is `(0,0), (-1,0), (-1,-1), (0, 2), (-1, 2)`. This matches standard SRS if +dy is UP. If +dy is UP, then in a +y DOWN grid (like canvas), we should subtract dy: `this.figureY -= dy`. So `this.figureY -= dy` is correct.
      }
    }
  }

  // Implementing accurate rotation based on standard SRS and Pygame equivalent
  _performRotate(rotated, newRot, offsets) {
    for (const [dx, dy] of offsets) {
      if (!this.intersects(this.figureX + dx, this.figureY - dy, rotated)) {
        this.figureX += dx;
        this.figureY -= dy;
        this.figure = rotated;
        this.rotationState = newRot;
        this.wasLastMoveRotation = true;
        if (this.intersects(this.figureX, this.figureY + 1)) {
          this.lockDelayTimer = Math.max(0, this.lockDelayTimer - 10);
        }
        return true;
      }
    }
    return false;
  }

  rotateClockwise() {
    if (this.figureType === 4) return;
    const oldRot = this.rotationState;
    const newRot = (oldRot + 1) % 4;
    const rotated = this.figure[0].map((_, i) => this.figure.map(row => row[i]).reverse());
    const table = this.figureType === 1 ? SRS_OFFSETS_I : SRS_OFFSETS_NORMAL;
    const offsets = table[`${oldRot},${newRot}`];
    this._performRotate(rotated, newRot, offsets);
  }

  rotateCounterClockwise() {
    if (this.figureType === 4) return;
    const oldRot = this.rotationState;
    const newRot = (oldRot - 1 + 4) % 4;
    const rotated = this.figure[0].map((_, i) => this.figure.map(row => row[row.length - 1 - i]));
    const table = this.figureType === 1 ? SRS_OFFSETS_I : SRS_OFFSETS_NORMAL;
    const offsets = table[`${oldRot},${newRot}`];
    this._performRotate(rotated, newRot, offsets);
  }

  freeze() {
    const isTSpin = this.checkTSpin();
    let linesClearedAmount = 0;

    for (let i = 0; i < this.figure.length; i++) {
      for (let j = 0; j < this.figure[i].length; j++) {
        if (this.figure[i][j]) {
          if (i + this.figureY >= 0) {
            this.field[i + this.figureY][j + this.figureX] = this.figureColor;
          }
        }
      }
    }

    linesClearedAmount = this.clearLines(isTSpin);
    this.newFigure();
    if (this.intersects(this.figureX, this.figureY)) {
      this.state = "gameover";
    }
    return linesClearedAmount;
  }

  clearLines(isTSpin) {
    let lines = 0;
    for (let i = 0; i < this.height; i++) {
      if (!this.field[i].includes(0)) {
        lines++;
        this.field.splice(i, 1);
        this.field.unshift(Array(this.width).fill(0));
      }
    }

    if (lines > 0) {
      this.ren += 1;
      let baseGain = 0;
      if (isTSpin) {
        if (lines === 1) { baseGain = 800; this.lastActionText = "T-SPIN SINGLE"; }
        else if (lines === 2) { baseGain = 1200; this.lastActionText = "T-SPIN DOUBLE!!"; }
        else if (lines === 3) { baseGain = 1600; this.lastActionText = "T-SPIN TRIPLE!!!"; }
      } else {
        if (lines === 1) { baseGain = 100; this.lastActionText = "SINGLE"; }
        else if (lines === 2) { baseGain = 300; this.lastActionText = "DOUBLE"; }
        else if (lines === 3) { baseGain = 500; this.lastActionText = "TRIPLE"; }
        else if (lines === 4) { baseGain = 800; this.lastActionText = "TETRIS!"; }
      }

      const renGain = this.ren > 0 ? this.ren * 50 : 0;
      if (this.ren > 0) this.renText = `${this.ren} REN!`;
      else this.renText = "";

      this.score += baseGain + renGain;
    } else {
      if (isTSpin) {
        this.score += 400;
        this.lastActionText = "T-SPIN";
      }
      this.ren = -1;
      this.renText = "";
    }
    return lines;
  }

  dropSpace() {
    while (!this.intersects(this.figureX, this.figureY + 1)) {
      this.figureY++;
    }
    return this.freeze();
  }

  moveDown() {
    this.figureY++;
    if (this.intersects(this.figureX, this.figureY)) {
      this.figureY--;
    }
  }

  moveSide(dx) {
    if (!this.intersects(this.figureX + dx, this.figureY)) {
      this.figureX += dx;
      this.wasLastMoveRotation = false;
      if (this.intersects(this.figureX, this.figureY + 1)) {
        this.lockDelayTimer = Math.max(0, this.lockDelayTimer - 10);
      }
    }
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
    
    // Check if top row has blocks (game over)
    for(let i=0; i<lines; i++) {
        if (this.field[0].some(cell => cell > 0)) {
          this.state = "gameover";
          return;
        }
        
        // Push up
        for (let r = 0; r < this.height - 1; r++) {
          this.field[r] = [...this.field[r + 1]];
        }
        
        const hole = Math.floor(Math.random() * this.width);
        this.field[this.height - 1] = Array(this.width).fill(8); // 8 is garbage color
        this.field[this.height - 1][hole] = 0;
    }
  }
}
