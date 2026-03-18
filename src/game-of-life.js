function createBoard(columns, rows) {
  return new Uint8Array(columns * rows);
}

function getIndex(columns, x, y) {
  return y * columns + x;
}

function countLiveNeighbors(board, columns, rows, x, y) {
  let neighbors = 0;

  for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
    const nextY = (y + yOffset + rows) % rows;

    for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
      const nextX = (x + xOffset + columns) % columns;

      if (xOffset === 0 && yOffset === 0) {
        continue;
      }

      neighbors += board[getIndex(columns, nextX, nextY)];
    }
  }

  return neighbors;
}

function nextGeneration(board, columns, rows) {
  const nextBoard = createBoard(columns, rows);

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const index = getIndex(columns, x, y);
      const isAlive = board[index] === 1;
      const neighbors = countLiveNeighbors(board, columns, rows, x, y);

      if ((isAlive && (neighbors === 2 || neighbors === 3)) || (!isAlive && neighbors === 3)) {
        nextBoard[index] = 1;
      }
    }
  }

  return nextBoard;
}

function resizeBoard(board, columns, rows, nextColumns, nextRows) {
  const resizedBoard = createBoard(nextColumns, nextRows);
  const copyColumns = Math.min(columns, nextColumns);
  const copyRows = Math.min(rows, nextRows);

  for (let y = 0; y < copyRows; y += 1) {
    for (let x = 0; x < copyColumns; x += 1) {
      resizedBoard[getIndex(nextColumns, x, y)] = board[getIndex(columns, x, y)];
    }
  }

  return resizedBoard;
}

function randomizeBoard(columns, rows, liveRatio) {
  const board = createBoard(columns, rows);

  for (let index = 0; index < board.length; index += 1) {
    board[index] = Math.random() < liveRatio ? 1 : 0;
  }

  return board;
}

function clearBoard(columns, rows) {
  return createBoard(columns, rows);
}

function countLiveCells(board) {
  let liveCells = 0;

  for (const cell of board) {
    liveCells += cell;
  }

  return liveCells;
}

function placePattern(board, columns, rows, cells, offsetX, offsetY) {
  const nextBoard = new Uint8Array(board);

  for (const [x, y] of cells) {
    const nextX = offsetX + x;
    const nextY = offsetY + y;

    if (nextX < 0 || nextX >= columns || nextY < 0 || nextY >= rows) {
      continue;
    }

    nextBoard[getIndex(columns, nextX, nextY)] = 1;
  }

  return nextBoard;
}

function computeRandomPlacement(columns, rows, width, height) {
  const maxX = Math.max(0, columns - width);
  const maxY = Math.max(0, rows - height);

  return {
    x: Math.floor(Math.random() * (maxX + 1)),
    y: Math.floor(Math.random() * (maxY + 1)),
  };
}

function encodeBoard(board) {
  return Buffer.from(board).toString('base64');
}

module.exports = {
  clearBoard,
  computeRandomPlacement,
  countLiveCells,
  createBoard,
  encodeBoard,
  nextGeneration,
  placePattern,
  randomizeBoard,
  resizeBoard,
};
