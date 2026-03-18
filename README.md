# Convay's Game of Life

A small Node.js app with two browser routes:

- `/display` for the shared simulation screen
- `/interact` for browsing and injecting established structures

## Run it

```bash
npm install
npm start
```

The server binds to `0.0.0.0`, so other devices on the same network can connect by using the host machine's IP address.

## Config

Startup settings live in `config/game-config.json`:

- `cellSize`
- `speed`
- `defaultColumns`
- `defaultRows`
- `randomFillRatio`

## Display controls

- `[` slower
- `]` faster
- `-` smaller cells
- `=` larger cells
- `R` randomize
