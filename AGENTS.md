# AGENTS.md

## Project Overview
Node.js ES module project - a Matrix bot that provides Scryfall card lookups with caching and REST API.

- **Entry point**: `src/index.js`
- **Test command**: `npm test` → runs `node --test test/*.test.js`
- **No lint/typecheck**: None configured

## Developer Commands

```bash
npm start                       # Run the bot
npm run generate-registration  # Generate registration.yaml for AppService mode
npm test                       # Run tests
```

## Two Bot Modes

1. **Simple bot** (no registration.yaml): Requires `HOMESERVER_URL` + `ACCESS_TOKEN`
2. **AppService** (registration.yaml exists): Requires `HOMESERVER_URL` + `AS_TOKEN` + `HS_TOKEN`

For AppService: Run `npm run generate-registration` first, then copy output to `registration.yaml`.

## Docker

```bash
docker compose up -d --build    # Production
docker compose up --build       # Development/testing
```

## Environment

Copy `.env.example` to `.env`. Required variables:
- `HOMESERVER_URL` (always required)
- `PORT` (default: 3000)
- `BOT_ICON_URL` (default: Scryfall icon)

For AppService mode also: `AS_TOKEN`, `HS_TOKEN`, `BOT_USER_ID`

## API

- REST API: `GET /api/card/:name` (returns card JSON)
- Matrix commands in rooms:
  - `[[card name]]` - Oracle text
  - `[[!card name]]` - Image
  - `[[$card name]]` - Prices
  - `[[?card name]]` - Rulings
  - `[[#card name]]` - Legality

## Key Source Files

- `src/index.js` - Main entry, bot logic, API server
- `src/scryfall.js` - Scryfall API client with caching
- `src/formatter.js` - Response formatting
- `src/generate-registration.js` - Registration YAML generator

## Testing

Tests use Node.js built-in test runner. Run a single test file:
```bash
node --test test/formatter.test.js
```
