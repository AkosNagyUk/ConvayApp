const previewCanvas = document.getElementById('structure-preview');
const previewContext = previewCanvas.getContext('2d');
const structureName = document.getElementById('structure-name');
const structureDescription = document.getElementById('structure-description');
const structureSize = document.getElementById('structure-size');
const structureCells = document.getElementById('structure-cells');
const gridSize = document.getElementById('grid-size');
const generationCount = document.getElementById('generation-count');
const liveCells = document.getElementById('live-cells');
const timingInfo = document.getElementById('timing-info');
const toast = document.getElementById('toast');
const previousButton = document.getElementById('previous-button');
const nextButton = document.getElementById('next-button');
const generateButton = document.getElementById('generate-button');

let structures = [];
let currentIndex = 0;
let socket;
let toastTimer;

function socketUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
}

function showToast(message, isError = false) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.style.color = isError ? '#ffc96b' : '#afc4d8';

  toastTimer = window.setTimeout(() => {
    toast.textContent = '';
  }, 2500);
}

function currentStructure() {
  return structures[currentIndex];
}

function syncPreviewCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const width = previewCanvas.clientWidth;
  const height = previewCanvas.clientHeight;

  previewCanvas.width = Math.floor(width * dpr);
  previewCanvas.height = Math.floor(height * dpr);
  previewContext.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawPreview() {
  const structure = currentStructure();
  const width = previewCanvas.clientWidth;
  const height = previewCanvas.clientHeight;

  previewContext.fillStyle = '#07131e';
  previewContext.fillRect(0, 0, width, height);

  if (!structure) {
    return;
  }

  const maxPatternWidth = Math.max(1, structure.width);
  const maxPatternHeight = Math.max(1, structure.height);
  const padding = 24;
  const cellSize = Math.max(
    4,
    Math.floor(Math.min((width - padding * 2) / maxPatternWidth, (height - padding * 2) / maxPatternHeight))
  );
  const offsetX = Math.floor((width - maxPatternWidth * cellSize) / 2);
  const offsetY = Math.floor((height - maxPatternHeight * cellSize) / 2);

  previewContext.strokeStyle = 'rgba(116, 211, 255, 0.12)';
  previewContext.lineWidth = 1;

  for (let x = 0; x <= structure.width; x += 1) {
    const lineX = offsetX + x * cellSize + 0.5;
    previewContext.beginPath();
    previewContext.moveTo(lineX, offsetY);
    previewContext.lineTo(lineX, offsetY + structure.height * cellSize);
    previewContext.stroke();
  }

  for (let y = 0; y <= structure.height; y += 1) {
    const lineY = offsetY + y * cellSize + 0.5;
    previewContext.beginPath();
    previewContext.moveTo(offsetX, lineY);
    previewContext.lineTo(offsetX + structure.width * cellSize, lineY);
    previewContext.stroke();
  }

  previewContext.fillStyle = '#74d3ff';
  previewContext.shadowBlur = 14;
  previewContext.shadowColor = 'rgba(116, 211, 255, 0.35)';

  for (const [x, y] of structure.cells) {
    previewContext.fillRect(offsetX + x * cellSize + 1, offsetY + y * cellSize + 1, cellSize - 2, cellSize - 2);
  }

  previewContext.shadowBlur = 0;
}

function renderStructure() {
  const structure = currentStructure();

  if (!structure) {
    structureName.textContent = 'No structures';
    structureDescription.textContent = 'The server did not provide any structures.';
    structureSize.textContent = 'Size: -';
    structureCells.textContent = 'Cells: -';
    return;
  }

  structureName.textContent = structure.name;
  structureDescription.textContent = structure.description;
  structureSize.textContent = `Size ${structure.width} x ${structure.height}`;
  structureCells.textContent = `${structure.cellCount} live cells`;
  drawPreview();
}

function setStructure(index) {
  if (structures.length === 0) {
    return;
  }

  currentIndex = (index + structures.length) % structures.length;
  renderStructure();
}

function updateStateSummary(state) {
  gridSize.textContent = `${state.columns} x ${state.rows}`;
  generationCount.textContent = String(state.generation);
  liveCells.textContent = String(state.liveCells);
  timingInfo.textContent = `${state.speed}ms | ${state.cellSize}px`;
}

async function loadStructures() {
  const response = await fetch('/api/structures');
  const payload = await response.json();
  structures = payload.structures || [];
  renderStructure();
}

async function loadState() {
  const response = await fetch('/api/state');
  const payload = await response.json();
  updateStateSummary(payload);
}

async function generateCurrentStructure() {
  const structure = currentStructure();

  if (!structure) {
    return;
  }

  generateButton.disabled = true;

  try {
    const response = await fetch(`/api/structures/${structure.id}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('The server could not place that structure.');
    }

    const payload = await response.json();
    showToast(`${payload.structureName} placed at ${payload.position.x}, ${payload.position.y}`);
  } catch (error) {
    showToast(error.message, true);
  } finally {
    generateButton.disabled = false;
  }
}

function connect() {
  socket = new WebSocket(socketUrl());

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);

    if (message.type === 'state') {
      updateStateSummary(message);
      return;
    }

    if (message.type === 'event') {
      showToast(message.message);
    }
  });

  socket.addEventListener('close', () => {
    showToast('Live updates disconnected. Reconnecting...', true);
    window.setTimeout(connect, 1200);
  });
}

window.addEventListener('resize', () => {
  syncPreviewCanvas();
  drawPreview();
});

previousButton.addEventListener('click', () => {
  setStructure(currentIndex - 1);
});

nextButton.addEventListener('click', () => {
  setStructure(currentIndex + 1);
});

generateButton.addEventListener('click', generateCurrentStructure);

syncPreviewCanvas();
Promise.all([loadStructures(), loadState()])
  .then(() => {
    connect();
  })
  .catch(() => {
    showToast('Unable to load data from the server.', true);
  });
