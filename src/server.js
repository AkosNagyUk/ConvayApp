const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const express = require('express');
const QRCode = require('qrcode');
const { WebSocketServer } = require('ws');

const { loadConfig } = require('./config');
const {
  clearBoard,
  computeRandomPlacement,
  countLiveCells,
  encodeBoard,
  nextGeneration,
  placePattern,
  resizeBoard,
  randomizeBoard,
} = require('./game-of-life');
const { structures, structuresById } = require('./structures');

const config = loadConfig();
const PORT = Number.parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const app = express();
app.disable('x-powered-by');
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

function createStartingBoard(columns, rows) {
  const board = clearBoard(columns, rows);
  const startingStructure = structuresById.get('pulsar') || structures[0];
  const offsetX = Math.max(0, Math.floor((columns - startingStructure.width) / 2));
  const offsetY = Math.max(0, Math.floor((rows - startingStructure.height) / 2));

  return placePattern(board, columns, rows, startingStructure.cells, offsetX, offsetY);
}

const state = {
  cellSize: config.cellSize,
  speed: config.speed,
  columns: config.defaultColumns,
  rows: config.defaultRows,
  board: createStartingBoard(config.defaultColumns, config.defaultRows),
  generation: 0,
  viewportWidth: config.defaultColumns * config.cellSize,
  viewportHeight: config.defaultRows * config.cellSize,
};

const networkBaseUrls = getNetworkUrls(PORT);

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function buildStatePayload() {
  return {
    type: 'state',
    columns: state.columns,
    rows: state.rows,
    cellSize: state.cellSize,
    speed: state.speed,
    generation: state.generation,
    liveCells: countLiveCells(state.board),
    notificationDurationMs: config.notificationDurationMs,
    cells: encodeBoard(state.board),
  };
}

function isLoopbackHost(hostname) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]'
  );
}

function getConnectionInfo(request) {
  const requestBaseUrl = `${request.protocol}://${request.get('host')}`;
  const requestHostname = request.hostname;
  const preferredBaseUrl =
    isLoopbackHost(requestHostname) && networkBaseUrls.length > 0
      ? networkBaseUrls[0]
      : requestBaseUrl;

  return {
    interactUrl: `${preferredBaseUrl}/interact`,
    displayUrl: `${preferredBaseUrl}/display`,
    availableBaseUrls: networkBaseUrls.length > 0 ? networkBaseUrls : [requestBaseUrl],
  };
}

function broadcast(payload) {
  const serialized = JSON.stringify(payload);

  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(serialized);
    }
  }
}

function broadcastState() {
  broadcast(buildStatePayload());
}

function broadcastNotice(message) {
  broadcast({
    type: 'event',
    message,
    notificationDurationMs: config.notificationDurationMs,
  });
}

function resizeFromViewport(viewportWidth, viewportHeight) {
  const width = clampInteger(viewportWidth, state.cellSize, 7680, state.viewportWidth);
  const height = clampInteger(viewportHeight, state.cellSize, 4320, state.viewportHeight);
  const nextColumns = Math.max(1, Math.floor(width / state.cellSize));
  const nextRows = Math.max(1, Math.floor(height / state.cellSize));

  state.viewportWidth = width;
  state.viewportHeight = height;

  if (nextColumns === state.columns && nextRows === state.rows) {
    return false;
  }

  state.board = resizeBoard(state.board, state.columns, state.rows, nextColumns, nextRows);
  state.columns = nextColumns;
  state.rows = nextRows;

  return true;
}

function updateSettings(message) {
  const nextCellSize = clampInteger(message.cellSize, 6, 48, state.cellSize);
  const nextSpeed = clampInteger(message.speed, 40, 1500, state.speed);

  const changed = [];

  if (nextCellSize !== state.cellSize) {
    state.cellSize = nextCellSize;
    changed.push(`Cell size ${state.cellSize}px`);
  }

  if (nextSpeed !== state.speed) {
    state.speed = nextSpeed;
    changed.push(`Speed ${state.speed}ms`);
  }

  const resized = resizeFromViewport(message.viewportWidth, message.viewportHeight);

  if (resized) {
    changed.push(`Grid ${state.columns} x ${state.rows}`);
  }

  if (changed.length > 0) {
    broadcastState();
    broadcastNotice(changed.join('  |  '));
  }
}

function randomizeGrid() {
  state.board = randomizeBoard(state.columns, state.rows, config.randomFillRatio);
  state.generation = 0;
  broadcastState();
  broadcastNotice('Grid randomized');
}

function clearGrid() {
  state.board = clearBoard(state.columns, state.rows);
  state.generation = 0;
  broadcastState();
  broadcastNotice('Grid cleared');
}

function placeStructure(structure) {
  const position = computeRandomPlacement(state.columns, state.rows, structure.width, structure.height);

  state.board = placePattern(state.board, state.columns, state.rows, structure.cells, position.x, position.y);
  broadcastState();
  broadcastNotice(`${structure.name} placed at (${position.x}, ${position.y})`);

  return position;
}

function tick() {
  state.board = nextGeneration(state.board, state.columns, state.rows);
  state.generation += 1;
  broadcastState();
  setTimeout(tick, state.speed);
}

function getNetworkUrls(port) {
  const addresses = [];
  const interfaces = os.networkInterfaces();

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        addresses.push(`http://${entry.address}:${port}`);
      }
    }
  }

  return addresses;
}

app.get('/', (_request, response) => {
  response.redirect('/display');
});

app.get('/display', (_request, response) => {
  response.sendFile(path.join(PUBLIC_DIR, 'display.html'));
});

app.get('/interact', (_request, response) => {
  response.sendFile(path.join(PUBLIC_DIR, 'interact.html'));
});

app.get('/health', (_request, response) => {
  response.json({ ok: true });
});

app.get('/api/state', (_request, response) => {
  response.json(buildStatePayload());
});

app.get('/api/connection-info', (request, response) => {
  response.json(getConnectionInfo(request));
});

app.get('/api/interact-qr.svg', async (request, response, next) => {
  try {
    const { interactUrl } = getConnectionInfo(request);
    const svg = await QRCode.toString(interactUrl, {
      type: 'svg',
      margin: 1,
      width: 256,
      color: {
        dark: '#ebf6ff',
        light: '#0000',
      },
    });

    response.type('image/svg+xml').send(svg);
  } catch (error) {
    next(error);
  }
});

app.get('/api/structures', (_request, response) => {
  response.json({
    structures: structures.map((structure) => ({
      id: structure.id,
      name: structure.name,
      description: structure.description,
      width: structure.width,
      height: structure.height,
      cellCount: structure.cellCount,
      cells: structure.cells,
    })),
  });
});

app.post('/api/structures/:structureId/generate', (request, response) => {
  const structure = structuresById.get(request.params.structureId);

  if (!structure) {
    response.status(404).json({ error: 'Unknown structure.' });
    return;
  }

  const position = placeStructure(structure);

  response.json({
    ok: true,
    structureId: structure.id,
    structureName: structure.name,
    position,
  });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (socket) => {
  socket.send(JSON.stringify(buildStatePayload()));

  socket.on('message', (rawMessage) => {
    let message;

    try {
      message = JSON.parse(rawMessage.toString());
    } catch (_error) {
      return;
    }

    if (message.type === 'display:resize') {
      const resized = resizeFromViewport(message.viewportWidth, message.viewportHeight);

      if (resized) {
        broadcastState();
      }

      return;
    }

    if (message.type === 'config:update') {
      updateSettings(message);
      return;
    }

    if (message.type === 'board:randomize') {
      randomizeGrid();
      return;
    }

    if (message.type === 'board:clear') {
      clearGrid();
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Convay's Game of Life listening on http://localhost:${PORT}`);

  for (const url of networkBaseUrls) {
    console.log(`Network access: ${url}`);
  }

  console.log(`Display mode:  http://localhost:${PORT}/display`);
  console.log(`Interact mode: http://localhost:${PORT}/interact`);
});

setTimeout(tick, state.speed);
