# instant-nav rig: NeatPlan

- BUILD: `NEXT_TEST_MODE=1 pnpm build && PORT=3030 pnpm start`
- EXPOSE: `NEXT_TEST_MODE=1` enables `experimental.exposeTestingApiInProductionBuild`; normal production builds leave it disabled.
- RUN: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3030 pnpm exec playwright test tests/e2e/instant-navigation.spec.ts`.
- TEST USER: no account; the guard covers the public `/demo` and `/demo/view` routes.
- DRIFT: none for the public routes; they do not depend on roles, feature flags, database rows, locale, or authentication.
- LOOP: local production build → start on port 3030 → run the focused Playwright spec; fully agent-drivable.
- LIVENESS: not applicable because the test uses the freshly built local artifact.
- WALLS: authenticated routes need PostgreSQL and seeded users; public routes provide a deterministic shell guard without credentials.
