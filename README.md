# Unofficial Scryfall Matrix Bot

![Build status (dev)](https://github.com/sim2kid/ScryfallMatrix/actions/workflows/dev-build.yml/badge.svg)
![Build status (stable)](https://github.com/sim2kid/ScryfallMatrix/actions/workflows/release-build.yml/badge.svg)
[![Releases](https://img.shields.io/github/v/release/sim2kid/ScryfallMatrix?style=plastic&color=green)](https://github.com/sim2kid/ScryfallMatrix/releases)

A Matrix bot that provides an API and cache for Scryfall card lookups. Not associated or endorsed by Scryfall.

## Features
- Search for Magic: The Gathering cards using the `[[card name]]` syntax.
- Supports specific data types:
  - `[[!card name]]` for images.
  - `[[$card name]]` for prices.
  - `[[?card name]]` for rulings.
  - `[[#card name]]` for legality.
- Integrated cache for Scryfall API results.
- REST API for querying the card cache.
- Dockerized setup for easy deployment.

## Prerequisites
- Docker and Docker Compose v2+.
- A Matrix Homeserver (e.g., Synapse).

## Setup

### 1. Docker Compose Setup
Create a `docker-compose.yml` file:
```yaml
services:
  scryfall-matrix:
    image: sim2kid/scryfall-matrix:latest  # or :dev for testing
    container_name: scryfall-matrix
    env_file:
      - .env
    ports:
      - "3000:3000"
```

### 3. Configure the Environment
Copy the example environment file and fill in your details:
```bash
cp .env.example .env
```

`HOMESERVER_URL` is required for all modes.
If you're running as a simple bot with an access token, also set `ACCESS_TOKEN`.
If you're running as an Application Service, also set `AS_TOKEN`, `HS_TOKEN`, and `BOT_USER_ID`.

> **Tip:** You can generate a secure random token for `AS_TOKEN` or `HS_TOKEN` using the following command:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

> **Note:** When running in Docker, `HOMESERVER_URL` must be reachable from within the container. If you are running Synapse in another container on the same Docker network, use the container name (e.g., `http://synapse:8008`).

### 4. Generate Registration YAML (AppService only)
To register the bot as an Application Service with Synapse, you need a registration configuration. You can generate this using the following command (requires Docker):
```bash
docker compose run --rm sim2kid/scryfall-matrix:latest npm run generate-registration
```
This will print the registration YAML to your console. Copy the YAML content and save it as `registration.yaml` on your server.

### 3. Register with Synapse
Add the path to the generated `registration.yaml` to your Synapse `homeserver.yaml`:
```yaml
app_service_config_files:
  - "/path/to/registration.yaml"
```
Then restart Synapse.

### 4. Run the Bot
To start the bot and API server:
```bash
docker compose up -d
```

## Testing & Development
For local testing, run unit tests:
```bash
npm test
```

For live testing against a remote Docker setup, build and push to Docker Hub:
```bash
npm run dev:build
npm run dev:push
```

Then on your remote machine, pull and run:
```bash
docker pull $DOCKER_USER/scryfall-matrix:dev
docker compose up -d
```

Make sure to set `DOCKER_USER` in your `.env` or prefix the commands with it:
```bash
DOCKER_USER=[your-username] npm run dev:build && DOCKER_USER=[your-username] npm run dev:push
```

## Running the Bot
Start the bot in production mode:
```bash
docker compose up -d --build
```

## API Usage
Once the bot is running, you can access the Scryfall cache via the API:
```bash
curl http://localhost:3000/api/card/Black%20Lotus
```

## Matrix Commands
- `[[card name]]`: Looks up a card and returns its Oracle text.
- `[[!card name]]`: Shows the card's image.
- `[[$card name]]`: Shows the card's current prices.
- `[[?card name]]`: Shows the card's rulings.
- `[[#card name]]`: Shows the card's legality in various formats.
