# Todo List App

A full-stack todo list app: a [SolidStart](https://start.solidjs.com/) backend API, a [Neo4j](https://neo4j.com/) database, and a [SolidJS](https://www.solidjs.com/) frontend.

This is a vertical slice covering account registration/login/deletion and basic todo management (create, complete, delete). See [PLAN.md](PLAN.md) for the design and scope.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Docker Engine + Compose)
- [Node.js](https://nodejs.org/) 20+ and npm — only needed for local development outside Docker (running tests, using `npm run dev`)

## Running locally with Docker

1. Copy the example environment file and adjust values if you like (the defaults work out of the box for local use, but you should change the secrets before deploying anywhere real):

   ```sh
   cp .env.example .env
   ```

2. Start everything:

   ```sh
   docker compose up --build
   ```

   This starts three services:
   - `neo4j` — the database, with its browser UI at http://localhost:7474 (default ports, see `.env`)
   - `backend` — the SolidStart API, at http://localhost:3001
   - `frontend` — the SolidJS app, at http://localhost:5173

   Open http://localhost:5173 in a browser once all three containers report healthy/running.

3. Stop everything:

   ```sh
   docker compose down
   ```

   Add `-v` to also delete the Neo4j data volume and start fresh next time:

   ```sh
   docker compose down -v
   ```

## Running the tests

### Backend unit tests

Repository, auth, session, and route-handler logic, all with mocked dependencies (no Docker or Neo4j required):

```sh
cd backend
npm install
npm test
```

### Backend integration tests (Docker)

Runs the real backend against a real (throwaway) Neo4j instance in Docker, exercising the full register → login → create/complete/delete todo → delete account flow over HTTP, plus session behaviour (revocation on logout and account deletion, expiry):

```sh
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit
docker compose -f docker-compose.test.yml down -v
```

### Frontend unit tests

Component tests (using `@solidjs/testing-library`) and API client tests, with the backend mocked:

```sh
cd frontend
npm install
npm test
```

## Local development without Docker

You can also run Neo4j in Docker while running the backend and frontend directly with `npm run dev`, which gives you hot reload:

```sh
docker compose up -d neo4j

cd backend
npm install
NEO4J_URI=bolt://localhost:7687 NEO4J_USER=neo4j NEO4J_PASSWORD=<your-password> SESSION_SECRET=<any-string> npm run dev
# in another terminal
cd frontend
npm install
npm run dev
```

The frontend dev server defaults to talking to `http://localhost:3000` unless you set `VITE_API_URL`.

## Environment variables

See `.env.example` for the full list used by Docker Compose. Notably:

- `SESSION_SECRET` — keys the hashes of session tokens stored in Neo4j; changing it logs everyone out. Sessions are stored server-side and expire after one day; logging out or deleting the account revokes them.
- `FRONTEND_ORIGIN` — must match the origin the browser loads the frontend from, or the backend won't set CORS headers for it.
- `VITE_API_URL` — baked into the frontend build at build time; the URL the browser uses to reach the backend.
