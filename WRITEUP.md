# Imperial Watchlist Write-Up

## How To Run Locally

This app runs locally with Docker Compose. From the project root:

```sh
cp .env.example .env
docker compose up --build
```

Then open:

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend API: [http://localhost:8000](http://localhost:8000)
- API docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health check: [http://localhost:8000/health](http://localhost:8000/health)

To stop the app while keeping Postgres data:

```sh
docker compose down
```

To stop the app and wipe the local Postgres volume:

```sh
docker compose down -v
```

## Architecture Overview

The app is a small monorepo with a React TypeScript frontend, a FastAPI backend, and Postgres for persistence. Docker Compose wires the three services together so a reviewer can run the whole system with one command.

At a high level:

```text
Browser / React UI
  -> FastAPI JSON API
    -> Postgres for users and watchlists
    -> yfinance for recent price history
```

The core data model is intentionally small:

- `users` stores account identity, email, password hash, and timestamps.
- `watchlist_items` stores one ticker per user with a unique constraint on `(user_id, ticker)`.
- Price history is not stored permanently. It is fetched from `yfinance` on demand and cached briefly in memory.

The app was built incrementally. The first goal was a runnable Dockerized skeleton, then persisted users, then private watchlist CRUD, then price history, then UI polish and modularity. That incremental approach kept each step reviewable and made the trade-offs explicit.

## Engineering Design Decisions

### Monorepo And Docker Compose

I kept the backend and frontend in one repository because this is a small full-stack take-home. The reviewer can inspect the whole system from the project root, and Docker Compose can define Postgres, backend, frontend, ports, volumes, and environment variables in one place.

For production, I would likely keep a monorepo initially but add stronger boundaries: separate CI jobs, deployment manifests, migration tooling, shared lint/test commands, and environment-specific infrastructure configuration.

### FastAPI Backend

FastAPI was a good fit because it gives a small typed API surface, request validation through Pydantic, and automatic OpenAPI docs. The backend uses SQLAlchemy with `asyncpg` so database access fits naturally with FastAPI's async request handlers.

The backend is split by responsibility:

- `main.py` creates the app, configures middleware, registers routers, and owns startup/shutdown.
- `routes/` contains API endpoints grouped by feature.
- `models.py` contains SQLAlchemy tables.
- `schemas.py` contains request/response models.
- `deps.py` contains shared FastAPI dependencies.
- `services/prices.py` isolates the market-data integration.
- `security.py` contains password hashing and normalization helpers.
- `validation.py` contains request validation helpers.

This keeps request handlers small and makes the most likely future changes easier. For example, replacing `yfinance` should mostly touch the price service rather than the API routes or UI.

### Postgres Persistence

User accounts and watchlist choices persist in Postgres. Docker Compose uses a named Postgres volume, so data survives application restarts until the user explicitly runs `docker compose down -v`.

For this take-home, tables are created at backend startup with SQLAlchemy metadata. That is simple and enough for local review. In production I would replace this with Alembic migrations so schema changes are versioned, reviewed, reversible, and applied safely during deploys.

### Authentication Scope

The current app implements registration, login, password hashing, and logout behavior, but the authentication model is intentionally lightweight. Login returns a user object, the frontend stores it in `localStorage`, and watchlist requests send the user id in an `X-User-Id` header.

This is acceptable only as a take-home shortcut. It demonstrates the product flow and keeps focus on the full-stack watchlist behavior, but it is not secure because a client can forge another user id.

If I were hardening this, I would replace the `X-User-Id` convention with real authentication:

- On login, issue either a secure server-side session cookie or a signed access token.
- If using cookies, set `HttpOnly`, `Secure`, and `SameSite=Lax` or `Strict`.
- If using JWTs, keep access tokens short-lived and use refresh-token rotation.
- Store refresh tokens or sessions server-side so logout can revoke them.
- Hash passwords with a dedicated password hashing algorithm such as Argon2id or bcrypt instead of plain PBKDF2.
- Add rate limiting to login and registration endpoints.
- Add account lockout or progressive delay for repeated failed logins.
- Add CSRF protection if cookie-based auth is used.
- Stop trusting user ids from headers and derive the current user only from the verified session/token.

At 10K DAU, I would probably choose secure `HttpOnly` cookie sessions backed by Redis or Postgres session storage. For a browser-only app, that keeps tokens out of JavaScript and makes logout/revocation simpler.

### Watchlist Rules

The max-ten ticker rule is enforced in the backend, not only the UI. The frontend disables the add form at ten tickers, but the API also counts existing rows before inserting. This matters because frontend checks are only a convenience; backend checks are the real invariant.

The database also has a unique constraint on `(user_id, ticker)`, which prevents duplicate tickers even if two requests race.

### Price Data Integration

The requirement asked for `yfinance`, so this app uses it for seven days of price data at five-minute granularity. The backend calls:

```text
period = 7d
interval = 5m
```

`yfinance` is isolated inside `services/prices.py`. That was a deliberate design decision because `yfinance` is convenient but not a production-grade market data dependency. It relies on Yahoo Finance behavior that can change, it can return empty data, and it can be rate limited.

The service handles those risks by:

- Catching exceptions from `yfinance`.
- Returning a stable response shape even when data is missing.
- Including a `warning` field for empty or failed responses.
- Cleaning `NaN`, `None`, and non-numeric values before returning data.
- Running the blocking `yfinance` call in a thread so it does not block the async event loop.
- Caching successful responses for 60 seconds in memory.

The frontend renders warnings and empty states instead of crashing.

### Frontend Structure

The frontend is React TypeScript with Vite. I avoided heavy state libraries because the app's state is small and local:

- the current user,
- the user's watchlist,
- price data keyed by ticker,
- the currently selected ticker,
- loading/error/message states.

Custom hooks own the main state transitions:

- `useUser` reads/writes the current user from local storage.
- `useWatchlist` loads, adds, and removes watchlist items.
- `usePrices` fetches and refreshes price histories for the current watchlist.

The UI uses simple components rather than a design system. The chart is plain SVG instead of a charting library. That keeps the code easy to explain, though a production finance UI would eventually benefit from a dedicated charting library with crosshairs, tooltips, zooming, and better axis behavior.

### Logging

The backend has request logging middleware that records method, path, response status, and duration. It also logs startup, database readiness, registration, login, watchlist changes, cache hits, and price-fetch failures.

For a take-home this is enough to debug local behavior. In production I would switch to structured JSON logs with request ids, user ids where safe, trace ids, and centralized log aggregation.

## Folder Structure Tour

```text
.
├── README.md
├── WRITEUP.md
├── PROJECT_NOTES.md
├── .env.example
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── deps.py
│   │   ├── logging_config.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── security.py
│   │   ├── validation.py
│   │   ├── routes/
│   │   └── services/
│   └── scripts/
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── index.html
    └── src/
        ├── api/
        ├── auth/
        ├── charts/
        ├── dashboard/
        ├── shared/
        ├── styles/
        ├── App.tsx
        ├── main.tsx
        └── types.ts
```

Important files:

- `docker-compose.yml` runs Postgres, the backend, and the frontend.
- `.env.example` documents local environment variables.
- `backend/app/main.py` wires the FastAPI app together.
- `backend/app/routes/auth.py` handles register and login.
- `backend/app/routes/watchlist.py` handles watchlist CRUD.
- `backend/app/routes/prices.py` exposes price history.
- `backend/app/services/prices.py` owns the `yfinance` integration and cache.
- `backend/app/models.py` defines the `users` and `watchlist_items` tables.
- `frontend/src/api/` contains fetch wrappers.
- `frontend/src/auth/` contains authentication UI and current-user state.
- `frontend/src/dashboard/` contains the watchlist and price-history dashboard.
- `frontend/src/charts/` contains the SVG line chart and sparklines.
- `frontend/src/styles/` contains CSS split by UI area.

## Architecture Review: Scaling To 10K DAU

The current architecture is good for a local take-home and a small demo, but I would change several things before running it for 10K daily active users.

### 1. Replace Lightweight Auth With Real Sessions

The first production change would be authentication. The current `X-User-Id` approach is the largest security gap. At 10K DAU, the system needs to assume clients are untrusted.

I would implement:

- Real login sessions using secure `HttpOnly` cookies.
- Server-side session storage in Redis or Postgres.
- Session revocation on logout.
- Password hashing with Argon2id or bcrypt.
- Login and registration rate limits by IP and account.
- CSRF protection for cookie-authenticated state-changing requests.
- Audit logging for login, logout, failed login, and suspicious activity.
- Secret management through a real secret store instead of local `.env` values.

The backend dependency `get_current_user` would no longer read `X-User-Id`. It would validate the session cookie, load the session, and then load the user from the database or a short-lived user cache.

### 2. Add Proper Database Migrations And Operational Postgres

Startup table creation is convenient locally, but production needs migrations.

I would add:

- Alembic migrations.
- Managed Postgres.
- Automated backups and restore testing.
- Connection pooling, either through SQLAlchemy pool settings, PgBouncer, or the managed provider.
- Readiness checks that fail when the database is unavailable.
- Index review for common access patterns.

The current watchlist query is simple: fetch all watchlist items for a user. With a max of ten rows per user, this will scale easily. The larger database concern is auth/session/account metadata, not watchlist size.

### 3. Replace Direct `yfinance` Dependency

`yfinance` is fine for the assignment, but it is not what I would use for a production product. It depends on scraping behavior, can break when upstream pages change, and can be rate limited unpredictably.

At 10K DAU, I would put a provider abstraction behind the price service and use a more reliable market data source such as Polygon.io, IEX Cloud, Tiingo, Twelve Data, Alpha Vantage, Nasdaq Data Link, or another licensed provider depending on cost, coverage, redistribution terms, and latency needs.

The app should not care which provider is underneath. I would define an internal interface like:

```text
MarketDataProvider.get_price_history(ticker, period, interval)
MarketDataProvider.search_symbols(query)
MarketDataProvider.validate_symbol(ticker)
```

Then `yfinance` could remain a local/dev provider while production uses a paid API. This also makes provider failures easier to test.

### 4. Add Caching For Common Tickers

The current cache is an in-memory dictionary with a 60-second TTL. That reduces repeated refreshes in one backend process, but it does not work across multiple backend replicas and disappears on restart.

For 10K DAU, I would use Redis or another shared cache:

- Cache price history by `(ticker, interval, period)`.
- Give common tickers like `AAPL`, `MSFT`, `NVDA`, `SPY`, and `QQQ` short TTLs.
- Use stale-while-revalidate so users get fast responses while the backend refreshes data.
- Deduplicate concurrent requests so 100 users loading `AAPL` at once causes one provider call, not 100.
- Cache negative/empty responses briefly to protect the provider from repeated bad ticker lookups.
- Track cache hit rate, provider latency, provider error rate, and refresh failures.

I would also add a background refresh worker for popular tickers. Instead of waiting for a user request to fetch `AAPL`, the system could refresh common watchlist symbols every minute during market hours and serve most users from cache.

### 5. Add Better Ticker Lookup And Validation

Right now, the app validates a ticker mostly by asking `yfinance` for price data. That is slow and expensive as a validation strategy.

For production, I would add a proper symbol search and lookup flow:

- Maintain a symbols table populated from a market data provider or exchange reference data.
- Support search by ticker and company name.
- Store metadata like exchange, instrument type, currency, active/inactive status, and display name.
- Validate watchlist additions against the symbols table first.
- Use provider calls only for actual market data, not basic symbol lookup.

This would improve UX and reduce provider load. Users should be able to type "Apple" and select `AAPL - Apple Inc.` instead of guessing exact symbols.

### 6. Move Price Refreshing Off The Request Path

Today, a user request can directly trigger a `yfinance` call. That is simple, but it makes request latency depend on an external provider.

At 10K DAU, I would separate read and refresh paths:

- API reads price data from Redis/Postgres/timeseries storage.
- Background workers refresh missing or stale data.
- A queue handles refresh jobs.
- Workers enforce provider rate limits and retry policies.
- The UI can show "last updated" and a warning if data is stale.

This design makes the user-facing API faster and more reliable.

### 7. Add Observability

The current logs are useful locally, but production needs deeper visibility.

I would add:

- Structured JSON logs.
- Request ids and trace ids.
- Metrics for request count, latency, errors, cache hits, provider calls, provider failures, and database latency.
- Alerts for elevated 5xx rate, login failures, provider degradation, Redis failures, and database connection pressure.
- Distributed tracing around API request -> cache -> provider/database.

The most important dashboards would be API health, auth health, price provider health, cache hit rate, and database health.

### 8. Add Testing And CI

Automated tests were not required, so they were not prioritized in the initial build. Before production, I would add:

- Backend unit tests for auth validation, password hashing, ticker validation, and price response cleaning.
- Backend integration tests for register/login/watchlist flows.
- Tests proving users cannot access each other's watchlists.
- Mocked provider tests for price success, empty response, timeout, and error cases.
- Frontend tests for auth form, watchlist add/remove, limit handling, and warning states.
- CI that runs formatting, type checks, tests, and dependency scanning.

The highest priority test is watchlist privacy because it is the most important product invariant.

### 9. Harden The API

I would add:

- Consistent error response shapes.
- Request size limits.
- Rate limits per user and IP.
- CORS locked to production origins.
- Secure headers at the edge.
- OpenAPI review and typed API clients if the surface grows.
- Better health endpoints: separate liveness and readiness.

I would also avoid exposing raw provider error messages directly to users. The logs can keep detailed provider errors; the UI should get friendly, stable messages.

### 10. Deployment Shape

For 10K DAU, a reasonable production deployment would be:

```text
CDN
  -> Static React assets

Load Balancer
  -> FastAPI containers
    -> Managed Postgres
    -> Redis cache/session store
    -> Background worker containers
      -> Market data provider
```

The frontend can be built once and served from a CDN. The backend can run as multiple containers behind a load balancer. Redis handles shared caching, request deduplication, and possibly sessions. Workers refresh common ticker data and isolate market-data provider rate limits from user-facing API requests.

## What I Would Do With More Time

If I had more time inside the take-home scope, I would focus on:

- Replace the `X-User-Id` auth shortcut with signed sessions.
- Add backend tests for auth and watchlist privacy.
- Add mocked tests for `yfinance` success, empty data, and failure.
- Add a real ticker search/autocomplete experience.
- Improve chart interactions with hover tooltips and clearer axes.
- Add Alembic migrations instead of startup table creation.
- Improve user-facing error copy.
- Add structured logs and request ids.

## Summary

The current implementation is a working local full-stack app that meets the main product flow: users can register, log in, manage a persisted watchlist, and view recent price history. The main intentional shortcuts are authentication, migrations, and production-grade market-data handling.

The most important production changes would be real session auth, a shared cache, a reliable market-data provider, background refresh jobs, better ticker lookup, migrations, observability, and focused tests around privacy and failure cases.