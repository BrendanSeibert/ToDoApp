# End-to-end tests

Selenium tests that drive the real application in a real Chrome browser. They cover registration, login and logout, adding, completing and deleting to-dos (including optimistic updates and rollback), the empty-input error, user isolation, and account deletion with its confirmation dialog.

The suite runs against its own throwaway stack (a separate Neo4j, backend and frontend on ports **3101** and **5273**, defined in [`docker-compose.e2e.yml`](../docker-compose.e2e.yml)). It never touches development data and can run alongside `docker compose up`.

## Requirements

- Docker
- Node.js 20 or later
- Google Chrome installed on the machine running the tests

The matching ChromeDriver is downloaded automatically on the first run, which requires internet access.

## Running the tests

```sh
cd e2e
npm install
npm run e2e          # start the stack, run every test, tear the stack down
```

### Common options

```sh
npm run e2e:fast                              # skip the slow 15-second message-expiry test
npm run e2e -- tests/todos.e2e.test.ts        # run one test file
npm run e2e -- -t "adds a to-do"              # run tests whose name matches
npm run test:headed                           # watch the browser (the stack must already be running)
```

Setting `E2E_KEEP_STACK=1` makes `npm run e2e` leave the stack running afterwards.

### Keeping the stack running between runs

While writing tests it is much faster to start the stack once and re-run the tests against it:

```sh
npm run stack:up      # build and start (the first run takes several minutes)
npm test              # run the tests against the running stack, as often as needed
npm run stack:down    # stop the stack and delete its data
```

### When a test fails

A screenshot and the page HTML are saved to `e2e/artifacts/` (git-ignored). To watch the failing test, re-run it with `npm run test:headed -- -t "<name>"`.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Login appears to succeed, then returns to the login screen | The browser must use `localhost` for both the app and the API, because the session cookie is `SameSite=Lax` and `Secure`. Do not open the app by Docker service name. |
| CORS errors in the console, or "Failed to fetch" | `FRONTEND_ORIGIN` and `VITE_API_URL` in `docker-compose.e2e.yml` must match the ports the browser uses. `VITE_API_URL` is baked into the frontend at build time, so rebuild with `npm run stack:up` after changing it. |
| Timeouts at the start of a run | Neo4j can take up to a minute to become healthy on a cold start. The suite waits for up to two minutes. |
| Port already in use | Another process holds 3101 or 5273. Change the ports in `docker-compose.e2e.yml` and `e2e/src/config.ts`. |
| One login replaces the other when the development stack is also open | Browsers share cookies between ports on `localhost`. Use a private window or a separate Chrome profile for each. |
| The stack is still running after pressing Ctrl+C | Run `npm run stack:down`. |

## Adding a test

- Add the test to `e2e/tests/*.e2e.test.ts`.
- Register a fresh user with `uniqueEmail()`.
- Drive the UI only through the page objects in `e2e/src/pages/`.
- Use the explicit-wait helpers; never use fixed sleeps.
- Take UI text from `frontend/src/i18n/en.json` through `e2e/src/helpers/strings.ts`.

For the design and rationale of the suite, see [`docs/SeleniumEnd2EndTestingPlan.md`](../docs/SeleniumEnd2EndTestingPlan.md).
