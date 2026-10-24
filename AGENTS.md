# Project workflow

## Source and deployment

- The user's latest choice is to run authentication and the application on this laptop only. This supersedes cloud hosting and cross-device access plans. GitHub remains the source of truth; GitHub Pages publishes only laptop usage instructions and a local app link.
- Repository: https://github.com/cucube1985/cornea-crt-lab
- Current public entry: https://cucube1985.github.io/cornea-crt-lab/
- Integrate verified laptop-only source from `codex/server-login` to `main`. No external hosting or billing setup is required. Never describe GitHub Pages as hosting the login server.
- This directory is the application repository. The parent workspace may contain a separate Git repository; run Git commands from this directory or use `git -C` with this directory.
- The default branch is `main`, tracking `origin/main`. Fetch and inspect local changes before integrating remote updates. Preserve existing work, including the recommendation calculator.
- Use the existing GitHub workflow for this project. Do not create, synchronize, or deploy an OpenAI Sites project unless the user explicitly requests it. The retained `.openai/hosting.json` describes the earlier deployment and does not control GitHub Pages.

## Development

- The application uses buildless HTML, CSS, and JavaScript ES modules in `dist/`; `auth/` and `server.mjs` enforce server authentication before app assets/API are served.
- Use Node 24. Initialize the local admin with `npm run init-admin -- --password-stdin` via stdin, then `npm start` at http://127.0.0.1:4173. Never put the actual initial password in tracked files, shell arguments, tests, or output. Existing admin credentials must not be reset by bootstrap.
- `auth/local-config.mjs` fixes the host, port and origin to IPv4 loopback. Do not enable LAN/public listeners, proxy trust, external tunnels or paid hosting without a new explicit user request.
- `앱 시작.cmd` starts/reuses the background server and opens the browser. `앱 종료.cmd` uses a private control token and matching instance ID to stop only that server. Do not register automatic boot tasks or Windows services.
- Run `npm test` for applicable geometry and recommendation checks before publishing application changes. Documentation-only changes do not require extra tests.
- Keep asset and module URLs relative so they work under the `/cornea-crt-lab/` project path.
- Browser asset/module URLs currently use a shared `?v=5` release suffix. Update it consistently on future releases to avoid mixing cached old geometry with new UI modules.
- Account/session DBs belong in `.private/` or a configured persistent volume outside `dist/`. Never commit DBs, password hashes for live accounts, environment secrets, session tokens, or actual patient records.
- Preserve the educational model assumptions and distinguish calculated geometry from clinically validated predictions.

## Publishing

- Review the intended changes and commit only files belonging to this project.
- For an authorized release, push the intended source commit to `origin/main` using ordinary Git. Do not force-push.
- The Pages workflow tests and deploys only the generated laptop usage page in `pages/`. App assets, account DBs and authentication endpoints must not be uploaded as public Pages artifacts. No server URL variable or hosting secret is required.
- Verify the matching GitHub Actions run and report the GitHub Pages URL. If a push or deployment fails, report its actual status.
