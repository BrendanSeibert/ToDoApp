# To-Do List App

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

### End-to-end tests (Selenium)

Drives the real app in a real Chrome browser: registering, logging in and out, adding / completing / deleting to-dos, the empty-input error, and deleting an account. It runs against its own throwaway stack (separate Neo4j, backend and frontend on ports **3101** and **5273**), so it never touches your development data and can run next to `docker compose up`.

**Requirements:** Docker, Node 20+, and Google Chrome installed on the machine running the tests (the matching ChromeDriver is downloaded automatically on first run, which needs internet access).

```sh
cd e2e
npm install
npm run e2e          # start the stack, run every test, tear the stack down
```

Useful variations:

```sh
npm run e2e:fast                              # skip the slow 15-second message-expiry test
npm run e2e -- tests/todos.e2e.test.ts        # one test file
npm run e2e -- -t "adds a to-do"              # tests whose name matches
npm run test:headed                           # watch the browser (stack must already be running)
```

Keeping the stack running between runs is much faster while you are writing tests:

```sh
npm run stack:up      # build and start (first time takes several minutes)
npm test              # run the tests against the running stack, as often as you like
npm run stack:down    # stop and delete the stack and its data
```

Setting `E2E_KEEP_STACK=1` makes `npm run e2e` leave the stack up.

**When a test fails**, a screenshot and the page HTML are saved in `e2e/artifacts/` (git-ignored). Re-run just that test with `npm run test:headed -- -t "<name>"` to watch it.

**Troubleshooting**

- *Login "works" and then bounces back to the login screen:* the browser must use `localhost` for both the app and the API (the session cookie is `SameSite=Lax` and `Secure`). Do not open the app by Docker service name.
- *CORS errors in the console, or "Failed to fetch":* `FRONTEND_ORIGIN` and `VITE_API_URL` in `docker-compose.e2e.yml` must match the ports the browser uses. `VITE_API_URL` is baked into the frontend at build time, so rebuild (`npm run stack:up`) after changing it.
- *Timeouts at the start of a run:* Neo4j can take a minute to become healthy on a cold start. The suite waits up to two minutes.
- *Port already in use:* something else holds 3101 or 5273; change the ports in `docker-compose.e2e.yml` and `e2e/src/config.ts`.
- *Checking the e2e app by hand while your dev stack is also open:* cookies are shared between ports on `localhost`, so one login replaces the other. Use a private window or a separate Chrome profile for each.
- *The stack is still running after pressing Ctrl+C:* run `npm run stack:down`.

**Adding a test:** put it in `e2e/tests/*.e2e.test.ts`, register a fresh user with `uniqueEmail()`, drive the UI only through the page objects in `e2e/src/pages/`, and use the explicit-wait helpers (never fixed sleeps). UI text comes from `frontend/src/i18n/en.json` via `e2e/src/helpers/strings.ts`.

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

The frontend dev server defaults to talking to `http://localhost:3000` (where `npm run dev` serves the backend) unless you set `VITE_API_URL`.

### Pointing the dev server at a different backend

If the backend is running in Docker instead (e.g. `docker compose up -d backend`), it is published on port 3001, so a bare `npm run dev` gets `ERR_CONNECTION_REFUSED` on login/register. `npm run dev` doesn't read the root `.env` that Docker Compose uses, so set the URL in a frontend-only file:

```sh
cd frontend
cp .env.local.example .env.local   # adjust VITE_API_URL if your backend port differs
npm run dev                        # restart if it was already running; Vite reads env files at startup
```

`frontend/.env.local` is git-ignored and Docker-ignored, so it only affects local `npm run dev` and never the Docker build. Docker builds get `VITE_API_URL` from the root `.env` instead.

Both the Docker frontend and the Vite dev server use port 5173 by default, so stop the container first with `docker compose stop frontend`.

## Environment variables

See `.env.example` for the full list used by Docker Compose. Notably:

- `SESSION_SECRET` — keys the hashes of session tokens stored in Neo4j; changing it logs everyone out. Sessions are stored server-side and expire after one day; logging out or deleting the account revokes them.
- `FRONTEND_ORIGIN` — must match the origin the browser loads the frontend from, or the backend won't set CORS headers for it.
- `VITE_API_URL` — baked into the frontend build at build time; the URL the browser uses to reach the backend. For `npm run dev`, set it in `frontend/.env.local` instead (see `frontend/.env.local.example`).
