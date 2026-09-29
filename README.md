# Shortlink API

[![CI](https://github.com/venkata-kopparthi/shortlink-api/actions/workflows/ci.yml/badge.svg)](https://github.com/venkata-kopparthi/shortlink-api/actions/workflows/ci.yml)

A link shortener REST API with click analytics, built with **Node.js, Express and TypeScript**.

Create short links (random or custom aliases, with optional expiry), redirect visitors, and see how many clicks each link got per day and where they came from.

## Features

- **Short links** with random 7-character codes or custom aliases (case-insensitive), plus optional expiry dates
- **Click analytics**: total clicks, clicks per day and top referrers
- **Validation** with Zod, returning field-level error messages
- **Security**: optional API key for write routes, rate limiting on writes, Helmet headers, a 10 kB body limit, and only `http`/`https` URLs accepted
- **SQLite storage** through Node's built-in `node:sqlite`, so there are no native dependencies to compile
- **Tests** with Vitest and Supertest, run on every push by GitHub Actions
- **Docker** image with a multi-stage build that runs as a non-root user

## Tech stack

| Layer | Technology |
| --- | --- |
| Runtime | Node.js 22, TypeScript |
| Web framework | Express 4, Helmet, express-rate-limit |
| Validation | Zod |
| Database | SQLite (`node:sqlite`) |
| Testing | Vitest, Supertest |
| CI / delivery | GitHub Actions, Docker |

## Getting started

Requires Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env   # optional
npm run dev
```

The API runs at `http://localhost:3000`.

## API

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/links` | Create a short link |
| `GET` | `/api/links/:code` | Get a link's details |
| `GET` | `/api/links/:code/stats` | Get click analytics for a link |
| `DELETE` | `/api/links/:code` | Delete a link and its clicks |
| `GET` | `/:code` | Redirect to the original URL and record the click |
| `GET` | `/health` | Health check |

If `API_KEY` is set, `POST` and `DELETE` need an `x-api-key` header.

### Create a link

```bash
curl -X POST http://localhost:3000/api/links \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/a/very/long/path", "alias": "launch", "expiresAt": "2027-01-01T00:00:00Z"}'
```

```json
{
  "code": "launch",
  "url": "https://example.com/a/very/long/path",
  "createdAt": "2026-09-28T10:00:00.000Z",
  "expiresAt": "2027-01-01T00:00:00Z",
  "shortUrl": "http://localhost:3000/launch"
}
```

### Get stats

```bash
curl http://localhost:3000/api/links/launch/stats
```

```json
{
  "code": "launch",
  "total": 42,
  "byDay": [{ "day": "2026-09-28", "clicks": 42 }],
  "topReferrers": [
    { "referrer": "https://news.ycombinator.com/", "clicks": 30 },
    { "referrer": "direct", "clicks": 12 }
  ]
}
```

### Errors

Errors always return JSON with a message you can show to users.

| Status | When |
| --- | --- |
| `400` | Invalid input (includes `details` with the field and message) or malformed JSON |
| `401` | API key missing or wrong |
| `404` | Unknown short code |
| `409` | Custom alias already taken |
| `410` | Link has expired |
| `413` | Request body over 10 kB |
| `429` | Too many write requests |

## Project structure

```text
src/
  app.ts            # Express app: middleware, routes, error handling
  server.ts         # Reads environment variables and starts the server
  db.ts             # SQLite schema and the link repository (all SQL lives here)
  routes/links.ts   # Link routes and the redirect handler
  lib/code.ts       # Short-code generator
  lib/errors.ts     # HttpError and the JSON error handler
test/
  links.test.ts     # API tests against an in-memory database
```

## Design decisions

- **Repository pattern.** All SQL lives in `db.ts`, so the routes work with plain objects and storage could move to PostgreSQL without touching them.
- **App factory.** `createApp()` takes its configuration as arguments, so each test gets a fresh app with an in-memory database.
- **Readable codes.** Generated codes leave out look-alike characters (`l`, `I`, `O`) and use `crypto.randomInt` rather than `Math.random`.
- **302 redirects.** Browsers cache `301` redirects, which would hide repeat clicks from the analytics.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start with auto-reload |
| `npm test` | Run the test suite |
| `npm run typecheck` | Type-check without building |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run the compiled server |

## Docker

```bash
docker build -t shortlink-api .
docker run -p 3000:3000 -v shortlink-data:/data shortlink-api
```

## License

MIT
