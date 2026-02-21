# Scryfall Matrix Bot

A Matrix bot that provides an API and cache for Scryfall card lookups.

## Features
- Search for Magic: The Gathering cards using the `!card <name>` command.
- Integrated cache for Scryfall API results.
- REST API for querying the card cache.
- Dockerized setup for easy deployment.

## Prerequisites
- Docker and Docker Compose.
- A Matrix Homeserver (e.g., Synapse).

## Setup

### 1. Configure the Environment
Copy the example environment file and fill in your details:
```bash
cp .env.example .env
```

If you're running as a simple bot with an access token, set `HOMESERVER_URL` and `ACCESS_TOKEN`.
If you're running as an Application Service, set `AS_TOKEN`, `HS_TOKEN`, and `BOT_USER_ID`.

> **Note:** When running in Docker, `HOMESERVER_URL` must be reachable from within the container. If you are running Synapse in another container on the same Docker network, use the container name (e.g., `http://synapse:8008`).

### 2. Generate Registration File (AppService only)
To register the bot as an Application Service with Synapse, you need a registration file. You can generate one using the following command (requires Docker):
```bash
docker compose run --rm scryfall-matrix npm run generate-registration
```
This will create a `registration.yaml` file in the project root.

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
docker compose up -d --build
```

## Testing
To rebuild and run the bot for testing:
```bash
docker compose up --build
```

## API Usage
Once the bot is running, you can access the Scryfall cache via the API:
```bash
curl http://localhost:3000/api/card/Black%20Lotus
```

## Matrix Commands
- `!card <name>`: Looks up a card on Scryfall and returns its details.
