const test = require('node:test');
const assert = require('node:assert/strict');

const {
  computeRandomPlacement,
  nextGeneration,
  placePattern,
  resizeBoard,
} = require('../src/game-of-life');

function createBoard(columns, rows, liveCells) {
  const board = new Uint8Array(columns * rows);

  for (const [x, y] of liveCells) {
    board[y * columns + x] = 1;
  }

  return board;
}

test('nextGeneration keeps a blinker oscillating', () => {
  const columns = 5;
  const rows = 5;
  const startingBoard = createBoard(columns, rows, [
    [2, 1],
    [2, 2],
    [2, 3],
  ]);

  const nextBoard = nextGeneration(startingBoard, columns, rows);

  assert.equal(nextBoard[2 + 1 * columns], 0);
  assert.equal(nextBoard[2 + 2 * columns], 1);
  assert.equal(nextBoard[2 + 3 * columns], 0);
  assert.equal(nextBoard[1 + 2 * columns], 1);
  assert.equal(nextBoard[3 + 2 * columns], 1);
});

test('nextGeneration wraps around the board edges', () => {
  const columns = 5;
  const rows = 5;
  const startingBoard = createBoard(columns, rows, [
    [0, 0],
    [4, 0],
    [0, 4],
  ]);

  const nextBoard = nextGeneration(startingBoard, columns, rows);

  assert.equal(nextBoard[4 + 4 * columns], 1);
});

test('resizeBoard preserves overlapping cells', () => {
  const board = createBoard(4, 4, [
    [0, 0],
    [3, 3],
    [2, 1],
  ]);

  const resized = resizeBoard(board, 4, 4, 3, 3);

  assert.equal(resized[0], 1);
  assert.equal(resized[2 + 1 * 3], 1);
  assert.equal(resized[2 + 2 * 3], 0);
});

test('placePattern clips cells that land outside the grid', () => {
  const board = createBoard(4, 4, []);
  const placed = placePattern(
    board,
    4,
    4,
    [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
    2,
    3
  );

  assert.equal(placed[2 + 3 * 4], 1);
  assert.equal(placed[3 + 3 * 4], 1);
  assert.equal(placed.filter(Boolean).length, 2);
});

test('computeRandomPlacement stays within bounds', () => {
  for (let index = 0; index < 25; index += 1) {
    const placement = computeRandomPlacement(20, 10, 7, 4);

    assert.ok(placement.x >= 0 && placement.x <= 13);
    assert.ok(placement.y >= 0 && placement.y <= 6);
  }
});
