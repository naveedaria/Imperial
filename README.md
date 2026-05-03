# Imperial Watchlist

Full-stack take-home app: register, log in, manage a private watchlist of up
to ten stock tickers, and view the last seven days of 5-minute price history
for each. Built with FastAPI, Postgres, React TypeScript, and orchestrated
with Docker Compose.

## Prerequisites

- Docker Desktop (or Docker Engine) running
- Docker Compose v2 (bundled with current Docker Desktop releases)

That's it. You do not need Python, Node.js, or Postgres installed locally.

## Quick Start

From the project root:

```sh
cp .env.example .env
docker compose up --build
```

The first build takes a minute or two. When it's ready, open:

- Frontend: <http://localhost:5173>
- Backend: <http://localhost:8000>
- API docs (Swagger UI): <http://localhost:8000/docs>
- Backend health: <http://localhost:8000/health>

To stop:

```sh
docker compose down          # stop containers, keep Postgres data
docker compose down -v       # stop and wipe Postgres data volume
```
