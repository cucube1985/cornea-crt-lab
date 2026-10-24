# Project workflow

## Source and deployment

- The user selected GitHub as this project's source of truth. They subsequently selected real server accounts shared across devices. The authenticated application now requires a Node 24 HTTPS server; GitHub Pages is its entry page after that server is connected.
- Repository: https://github.com/cucube1985/cornea-crt-lab
- Current public entry: https://cucube1985.github.io/cornea-crt-lab/
- Server-login work is on `codex/server-login` until a hosting destination and persistent volume are connected and verified. Do not merge/deploy it to `main` merely to make a login screen appear. Do not claim the existing Pages app is protected before the handoff is complete.
- This directory is the application repository. The parent workspace may contain a separate Git repository; run Git commands from this directory or use `git -C` with this directory.
- The default branch is `main`, tracking `origin/main`. Fetch and inspect local changes before integrating remote updates. Preserve existing work, including the recommendation calculator.
- Use the existing GitHub workflow for this project. Do not create, synchronize, or deploy an OpenAI Sites project unless the user explicitly requests it. The retained `.openai/hosting.json` describes the earlier deployment and does not control GitHub Pages.

## Development

- The application uses buildless HTML, CSS, and JavaScript ES modules in `dist/`; `auth/` and `server.mjs` enforce server authentication before app assets/API are served.
- Use Node 24. Initialize the local admin with `npm run init-admin -- --password-stdin` via stdin, then `npm start` at http://127.0.0.1:4173. Never put the actual initial password in tracked files, shell arguments, tests, or output. Existing admin credentials must not be reset by bootstrap.
- Run `npm test` for applicable geometry and recommendation checks before publishing application changes. Documentation-only changes do not require extra tests.
- Keep asset and module URLs relative so they work under the `/cornea-crt-lab/` project path.
- Browser asset/module URLs currently use a shared `?v=4` release suffix. Update it consistently on future releases to avoid mixing cached old geometry with new UI modules.
- Account/session DBs belong in `.private/` or a configured persistent volume outside `dist/`. Never commit DBs, password hashes for live accounts, environment secrets, session tokens, or actual patient records.
- Preserve the educational model assumptions and distinguish calculated geometry from clinically validated predictions.

## Publishing

- Review the intended changes and commit only files belonging to this project.
- For an authorized release, push the intended source commit to `origin/main` using ordinary Git. Do not force-push.
- Before publishing server login, deploy the complete Node service with HTTPS and persistent storage, verify it, and set the GitHub variable `CORNEA_SERVER_ORIGIN`. The Pages workflow tests and deploys only the generated entry page in `pages/`; authenticated application assets must not be uploaded as a public Pages artifact.
- Verify the matching GitHub Actions run and report the GitHub Pages URL. If a push or deployment fails, report its actual status.
