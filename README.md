# To-Do List App

A to-do list application with a [SolidJS](https://www.solidjs.com/) frontend, a [SolidStart](https://start.solidjs.com/) API backend, and a [Neo4j](https://neo4j.com/) database. Everything runs locally with Docker Compose.



## Features

- Account registration, login, logout and account deletion (behind a confirmation dialog).
- Create, complete and delete to-dos. Changes appear immediately and are rolled back with an error message if the server rejects them.
- Per-user data: each account sees only its own to-dos.
- Server-side sessions that expire after one day and are revoked on logout and account deletion.
- Unit, integration and end-to-end tests at every layer.

The original scope and design are described in [`docs/PLAN.md`](docs/PLAN.md).

## Development approach

This is my first project built with Claude. I wanted to explore developing with AI while maintaining software best practices.
I mainly used Claude's Sonnet 5.5 model for its efficiency and I found it sufficiently powerful for this project.

For each feature, I described the desired changes in detail, and would prompt Claude to give me a list of steps required to complete the task. For smaller changes, I would review and tinker with the implementation strategy myself before asking Claude to follow the steps. For larger changes I had Claude put together plan files. I would review the files and I would also spin up fresh Claude instances to review the document, compare the plan to the codebase, and fine tune the plan.

I instructed Claude to never commit any code. I wanted to review all code before committing so I always knew what changes were being made.

There were a few things that I wanted implemented in very specific ways. In those cases I would implement a portion of it myself first. Then I would have a Claude instance review my work before having it follow the strategy. For example I styled one frontend component implementing a CSS color variable strategy, then I had Claude update the rest of the frontend components to align with that paradigm.

## Project structure

```
.
├── backend/                  SolidStart API (routes under /api) and Neo4j access
├── frontend/                 SolidJS single-page app
├── e2e/                      Selenium end-to-end tests
├── docs/                     Design and test plans
├── docker-compose.yml        Development stack: Neo4j, backend, frontend
├── docker-compose.test.yml   Throwaway stack for the backend integration tests
├── docker-compose.e2e.yml    Throwaway stack for the end-to-end tests
└── .env.example              Template for the Docker Compose configuration
```

## Getting started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Docker Engine and Compose)
- [Node.js](https://nodejs.org/) 20 or later and npm. Required only for local development and for running the tests outside Docker.

### Run the application with Docker

1. Create your environment file from the template. The defaults work for local use; change the secrets before deploying anywhere else.

   ```sh
   cp .env.example .env          # macOS, Linux, Git Bash
   Copy-Item .env.example .env   # Windows PowerShell
   ```

2. Build and start the stack:

   ```sh
   docker compose up --build
   ```

   This starts three services:

   | Service | Description | Default address |
   | --- | --- | --- |
   | `neo4j` | Database, with its browser UI | http://localhost:7474 |
   | `backend` | SolidStart API | http://localhost:3001 |
   | `frontend` | SolidJS application | http://localhost:5173 |

   The backend starts once Neo4j reports healthy, which can take up to a minute on a cold start. The application is ready when the backend log shows it is listening; then open http://localhost:5173.

3. Stop the stack:

   ```sh
   docker compose down        # keep the database
   docker compose down -v     # also delete the Neo4j data volume
   ```

## Configuration

Docker Compose reads its settings from the root `.env` file. `.env.example` lists every variable:

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEO4J_USER` | `neo4j` | Neo4j username. |
| `NEO4J_PASSWORD` | `please-change-me` | Neo4j password. |
| `NEO4J_HTTP_PORT` | `7474` | Host port for the Neo4j browser UI. |
| `NEO4J_BOLT_PORT` | `7687` | Host port for the Bolt protocol. |
| `SESSION_SECRET` | `please-change-me-too` | Keys the hashes of session tokens stored in Neo4j. Changing it logs every user out. |
| `BACKEND_PORT` | `3001` | Host port for the API. |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | The origin the browser loads the frontend from. If it does not match, the backend sends no CORS headers. |
| `FRONTEND_PORT` | `5173` | Host port for the frontend. |
| `VITE_API_URL` | `http://localhost:3001` | The URL the browser uses to reach the API. It is baked into the frontend at build time, so rebuild after changing it. |

When you change a port, keep `FRONTEND_ORIGIN` and `VITE_API_URL` consistent with it and rebuild with `docker compose up --build`.

## Local development

For hot reload, run Neo4j in Docker and the backend and frontend directly with `npm run dev`.

1. Start the database:

   ```sh
   docker compose up -d neo4j
   ```

2. Start the backend, using the `NEO4J_PASSWORD` and `NEO4J_BOLT_PORT` values from your `.env`. It serves on port 3000.

   ```sh
   cd backend
   npm install

   # macOS, Linux, Git Bash
   NEO4J_URI=bolt://localhost:7687 NEO4J_USER=neo4j NEO4J_PASSWORD=<password> SESSION_SECRET=<any-string> npm run dev
   ```

   ```powershell
   # Windows PowerShell
   $env:NEO4J_URI = "bolt://localhost:7687"; $env:NEO4J_USER = "neo4j"
   $env:NEO4J_PASSWORD = "<password>"; $env:SESSION_SECRET = "<any-string>"
   npm run dev
   ```

3. In a second terminal, start the frontend:

   ```sh
   cd frontend
   npm install
   npm run dev
   ```

The Vite dev server talks to `http://localhost:3000` unless `VITE_API_URL` is set.

### Using a backend that runs in Docker

If the backend runs in Docker (for example `docker compose up -d backend`), it is published on port 3001, so a bare `npm run dev` fails on login and registration with `ERR_CONNECTION_REFUSED`. The Vite dev server does not read the root `.env`, so set the URL in a frontend-only file:

```sh
cd frontend
cp .env.local.example .env.local   # adjust VITE_API_URL if your backend port differs
npm run dev                        # restart it if it was already running; Vite reads env files at startup
```

`frontend/.env.local` is ignored by Git and Docker, so it affects only `npm run dev`. Docker builds take `VITE_API_URL` from the root `.env`.

The Docker frontend and the Vite dev server both default to port 5173, so stop the container first with `docker compose stop frontend`.

## Testing

| Layer | Run from | Command | Needs Docker | Covers |
| --- | --- | --- | --- | --- |
| Backend unit | `backend/` | `npm test` | No | Repositories, auth, sessions and route handlers, with mocked dependencies. |
| Backend integration | repository root | see below | Yes | The real backend against a real Neo4j instance. |
| Frontend unit | `frontend/` | `npm test` | No | Components, contexts and the API client, with the backend mocked. |
| End-to-end | `e2e/` | `npm run e2e` | Yes, plus Chrome | The full application in a real browser. |

Run `npm install` in a package before its first test run.

### Unit tests and coverage

```sh
cd backend && npm test               # or: npm run test:coverage
cd frontend && npm test              # or: npm run test:coverage
```

`npm run test:coverage` prints a coverage table and writes an HTML report to `coverage/` (ignored by Git). It exits with an error if coverage falls below the thresholds configured in each package's `vitest.config.ts`.

### Backend integration tests

These tests exercise the full flow over HTTP (register, log in, create, complete and delete a to-do, delete the account) as well as session behaviour: revocation on logout and account deletion, and expiry.

```sh
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit
docker compose -f docker-compose.test.yml down -v
```

### End-to-end tests

```sh
cd e2e
npm install
npm run e2e
```

The suite starts its own stack on ports 3101 and 5273, so it does not interfere with a running development stack. See [`e2e/README.md`](e2e/README.md) for requirements, options, troubleshooting and how to add a test.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Login appears to succeed, then returns to the login screen | Open the application at `localhost` and keep the API on `localhost` too. The session cookie is `SameSite=Lax` and, in the Docker build, `Secure`, so it is not sent if the app is opened by another host name. |
| CORS errors in the browser console, or "Failed to fetch" | `FRONTEND_ORIGIN` must equal the address in the browser's address bar, and `VITE_API_URL` must be the address the browser uses for the API. Rebuild after changing either. |
| "Port is already allocated" on start | Another process is using the port. Change the relevant `*_PORT` in `.env`, update `FRONTEND_ORIGIN` and `VITE_API_URL` to match, and rebuild. |
| The backend takes a long time to start | It waits for Neo4j to become healthy, which can take up to a minute on a cold start. |
| Neo4j rejects the password after you changed it | Neo4j stores the password in its data volume on first start. Run `docker compose down -v` to recreate it. |

## Further reading

- [`docs/PLAN.md`](docs/PLAN.md): original design and scope.
- [`docs/OptimisticAddDeletePlan.md`](docs/OptimisticAddDeletePlan.md): design of optimistic add and delete.
- [`docs/SeleniumEnd2EndTestingPlan.md`](docs/SeleniumEnd2EndTestingPlan.md): design of the end-to-end suite.
- [`docs/UnitTestingGapCoveragePlan.md`](docs/UnitTestingGapCoveragePlan.md): unit-test coverage gaps and how they were closed.

## License

This repository does not yet include a license file. The `package.json` files declare ISC as a placeholder; choose and add a license before distributing the code.
