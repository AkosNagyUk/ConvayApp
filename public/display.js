const canvas = document.getElementById('board');
const context = canvas.getContext('2d');
const notice = document.getElementById('notice');
const legendPanel = document.getElementById('legend-panel');
const legendToggle = document.getElementById('legend-toggle');
const interactLink = document.getElementById('interact-link');
const interactLinkText = document.getElementById('interact-link-text');
const interactQr = document.getElementById('interact-qr');

let socket;
let noticeTimer;
let resizeTimer;
let gameState;
let notificationDurationMs = 2200;
let isLegendVisible = window.localStorage.getItem('display.legend.visible') !== 'false';

context.imageSmoothingEnabled = false;

function socketUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
}

function decodeCells(base64) {
  const binary = window.atob(base64);
  const cells = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    cells[index] = binary.charCodeAt(index);
  }

  return cells;
}

function showNotice(message) {
  if (!message) {
    return;
  }

  window.clearTimeout(noticeTimer);
  notice.textContent = message;
  notice.classList.add('is-visible');

  noticeTimer = window.setTimeout(() => {
    notice.classList.remove('is-visible');
  }, notificationDurationMs);
}

function setLegendVisibility(isVisible) {
  isLegendVisible = isVisible;
  legendPanel.classList.toggle('is-hidden', !isVisible);
  legendToggle.textContent = isVisible ? 'Hide Panel' : 'Show Panel';
  legendToggle.setAttribute('aria-expanded', String(isVisible));
  window.localStorage.setItem('display.legend.visible', String(isVisible));
}

async function loadConnectionInfo() {
  try {
    const response = await fetch('/api/connection-info');
    const payload = await response.json();

    interactLink.href = payload.interactUrl;
    interactLinkText.href = payload.interactUrl;
    interactLinkText.textContent = payload.interactUrl;
    interactQr.src = '/api/interact-qr.svg';
  } catch (_error) {
    const fallbackUrl = `${window.location.origin}/interact`;
    interactLink.href = fallbackUrl;
    interactLinkText.href = fallbackUrl;
    interactLinkText.textContent = fallbackUrl;
  }
}

function syncCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawGridLines(offsetX, offsetY) {
  if (!gameState || gameState.cellSize < 10) {
    return;
  }

  context.strokeStyle = 'rgba(158, 218, 255, 0.08)';
  context.lineWidth = 1;
  context.beginPath();

  for (let column = 0; column <= gameState.columns; column += 1) {
    const x = offsetX + column * gameState.cellSize + 0.5;
    context.moveTo(x, offsetY);
    context.lineTo(x, offsetY + gameState.rows * gameState.cellSize);
  }

  for (let row = 0; row <= gameState.rows; row += 1) {
    const y = offsetY + row * gameState.cellSize + 0.5;
    context.moveTo(offsetX, y);
    context.lineTo(offsetX + gameState.columns * gameState.cellSize, y);
  }

  context.stroke();
}

function draw() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  context.fillStyle = '#07131e';
  context.fillRect(0, 0, width, height);

  if (!gameState) {
    return;
  }

  const gridWidth = gameState.columns * gameState.cellSize;
  const gridHeight = gameState.rows * gameState.cellSize;
  const offsetX = Math.max(0, Math.floor((width - gridWidth) / 2));
  const offsetY = Math.max(0, Math.floor((height - gridHeight) / 2));
  const inset = gameState.cellSize > 8 ? 1 : 0;
  const cellDrawSize = Math.max(1, gameState.cellSize - inset * 2);

  context.fillStyle = 'rgba(8, 26, 40, 0.92)';
  context.fillRect(offsetX, offsetY, gridWidth, gridHeight);
  drawGridLines(offsetX, offsetY);

  context.fillStyle = '#9cff57';
  context.shadowBlur = gameState.cellSize > 12 ? 12 : 0;
  context.shadowColor = 'rgba(156, 255, 87, 0.45)';

  for (let index = 0; index < gameState.cells.length; index += 1) {
    if (gameState.cells[index] !== 1) {
      continue;
    }

    const x = index % gameState.columns;
    const y = Math.floor(index / gameState.columns);

    context.fillRect(
      offsetX + x * gameState.cellSize + inset,
      offsetY + y * gameState.cellSize + inset,
      cellDrawSize,
      cellDrawSize
    );
  }

  context.shadowBlur = 0;
}

function sendViewport() {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(
    JSON.stringify({
      type: 'display:resize',
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    })
  );
}

function updateSetting(key, delta) {
  if (!socket || socket.readyState !== WebSocket.OPEN || !gameState) {
    return;
  }

  const constraints = {
    cellSize: { min: 6, max: 48 },
    speed: { min: 40, max: 1500 },
  };
  const nextValue = Math.min(
    constraints[key].max,
    Math.max(constraints[key].min, gameState[key] + delta)
  );

  if (nextValue === gameState[key]) {
    return;
  }

  socket.send(
    JSON.stringify({
      type: 'config:update',
      cellSize: key === 'cellSize' ? nextValue : gameState.cellSize,
      speed: key === 'speed' ? nextValue : gameState.speed,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    })
  );
}

function connect() {
  socket = new WebSocket(socketUrl());

  socket.addEventListener('open', () => {
    sendViewport();
    showNotice('Connected to shared grid');
  });

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);

    if (message.type === 'state') {
      notificationDurationMs = message.notificationDurationMs || notificationDurationMs;
      gameState = {
        ...message,
        cells: decodeCells(message.cells),
      };
      draw();
      return;
    }

    if (message.type === 'event') {
      notificationDurationMs = message.notificationDurationMs || notificationDurationMs;
      showNotice(message.message);
    }
  });

  socket.addEventListener('close', () => {
    showNotice('Connection lost. Reconnecting...');
    window.setTimeout(connect, 1200);
  });
}

window.addEventListener('resize', () => {
  syncCanvas();
  draw();
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(sendViewport, 120);
});

window.addEventListener('keydown', (event) => {
  if (event.repeat) {
    return;
  }

  if (event.code === 'BracketLeft') {
    updateSetting('speed', 20);
    return;
  }

  if (event.code === 'BracketRight') {
    updateSetting('speed', -20);
    return;
  }

  if (event.code === 'Minus' || event.code === 'NumpadSubtract') {
    updateSetting('cellSize', -2);
    return;
  }

  if (event.code === 'Equal' || event.code === 'NumpadAdd') {
    updateSetting('cellSize', 2);
    return;
  }

  if (event.code === 'KeyR' && socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'board:randomize' }));
    return;
  }

  if (event.code === 'KeyC' && socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'board:clear' }));
  }
});

legendToggle.addEventListener('click', () => {
  setLegendVisibility(!isLegendVisible);
});

syncCanvas();
setLegendVisibility(isLegendVisible);
loadConnectionInfo();
connect();
