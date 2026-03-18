const fs = require('node:fs');
const path = require('node:path');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'game-config.json');

const DEFAULTS = {
  cellSize: 14,
  speed: 160,
  defaultColumns: 64,
  defaultRows: 36,
  randomFillRatio: 0.24,
  notificationDurationMs: 2200,
};

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function clampFloat(value, min, max, fallback) {
  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function loadConfig() {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  const fileConfig = JSON.parse(raw);

  return {
    cellSize: clampInteger(fileConfig.cellSize, 6, 48, DEFAULTS.cellSize),
    speed: clampInteger(fileConfig.speed, 40, 1500, DEFAULTS.speed),
    defaultColumns: clampInteger(fileConfig.defaultColumns, 8, 320, DEFAULTS.defaultColumns),
    defaultRows: clampInteger(fileConfig.defaultRows, 8, 180, DEFAULTS.defaultRows),
    randomFillRatio: clampFloat(fileConfig.randomFillRatio, 0.02, 0.9, DEFAULTS.randomFillRatio),
    notificationDurationMs: clampInteger(
      fileConfig.notificationDurationMs,
      800,
      8000,
      DEFAULTS.notificationDurationMs
    ),
  };
}

module.exports = {
  CONFIG_PATH,
  DEFAULTS,
  loadConfig,
};
