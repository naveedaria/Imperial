# Imperial Watchlist

Full-stack take-home app scaffold using FastAPI, Postgres, React TypeScript, and Docker.

## Current Increment

Increment 1 creates a runnable local skeleton:

- FastAPI backend with `GET /health`
- Postgres container with persistent Docker volume
- React TypeScript frontend that checks backend and database health
- Docker Compose orchestration
- Basic backend request and startup logging

## Prerequisites

- Docker Desktop
- Docker Compose v2

## Run Locally

Copy the example environment file:

```sh
cp .env.example .env
```

Build and start the app:

```sh
docker compose up --build
```

Then open:

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend health check: [http://localhost:8000/health](http://localhost:8000/health)

## Verification Commands

In another terminal, check the backend health response:

```sh
curl http://localhost:8000/health
```

Expected response:

```json
{"status":"ok","database":"ok"}
```

Check that all containers are running:

```sh
docker compose ps
```

## Seed Demo Data

With the app running, create or refresh demo users:

```sh
docker compose exec backend python -m scripts.seed
```

The seed script is idempotent. It creates these users if missing and resets their passwords if they already exist:

```text
demo@example.com  / password123 / AAPL, MSFT, NVDA
alice@example.com / password123 / TSLA, AMZN
bob@example.com   / password123 / GOOG
```

Test a seeded login from the command line:

```sh
curl -X POST http://localhost:8000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"password123"}'
```

Expected response shape:

```json
{"id":"<user-id>","email":"demo@example.com"}
```

You can also open [http://localhost:5173](http://localhost:5173) and log in with one of the seeded accounts.

## Watchlist API

Watchlist requests use the locally stored user ID as a lightweight owner reference. Pass it with `X-User-Id`.

List a user's watchlist:

```sh
curl http://localhost:8000/watchlist \
  -H 'X-User-Id: <user-id>'
```

Add a ticker:

```sh
curl -X POST http://localhost:8000/watchlist \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: <user-id>' \
  -d '{"ticker":"AAPL"}'
```

Remove a ticker:

```sh
curl -X DELETE http://localhost:8000/watchlist/AAPL \
  -H 'X-User-Id: <user-id>'
```

## Price History API

Price history uses `yfinance` and returns the last 7 days at 5-minute granularity. Empty or upstream errors return an empty `points` array and a `warning` string instead of a 500.

```sh
curl http://localhost:8000/prices/AAPL
```

Response shape:

```json
{
  "ticker": "AAPL",
  "interval": "5m",
  "period": "7d",
  "points": [
    {
      "timestamp": "2026-04-23T09:30:00-04:00",
      "open": 275.04,
      "high": 275.67,
      "low": 274.15,
      "close": 275.08,
      "volume": 2310046
    }
  ],
  "warning": null
}
```

If yfinance has no data:

```json
{"ticker":"FAKE","interval":"5m","period":"7d","points":[],"warning":"No recent price data is available for this ticker."}
```

Stop the app:

```sh
docker compose down
```

Stop the app and remove the Postgres data volume:

```sh
docker compose down -v
```

## Folder Structure

```text
.
├── backend/          # FastAPI app and Python dependencies
├── frontend/         # React TypeScript app
├── docker-compose.yml
├── .env.example
└── README.md
```

