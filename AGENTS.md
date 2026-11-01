# Project workflow

## Source and deployment

- On 2026-11-01 the user chose to remove login and publish the app publicly. This supersedes the earlier laptop-only login setup (still available in Git history before this change). GitHub Pages hosts the static app from `dist/`.
- Repository: https://github.com/cucube1985/cornea-crt-lab
- Public app: https://cucube1985.github.io/cornea-crt-lab/
- This directory is the application repository. The parent workspace may contain a separate Git repository; run Git commands from this directory or use `git -C` with this directory.
- The default branch is `main`, tracking `origin/main`. Fetch and inspect local changes before integrating remote updates. Preserve existing work, including the external calculator results panel.
- Use the existing GitHub workflow for this project. Do not create, synchronize, or deploy an OpenAI Sites project unless the user explicitly requests it. The retained `.openai/hosting.json` describes the earlier deployment and does not control GitHub Pages.

## Development

- The application uses buildless HTML, CSS, and JavaScript ES modules in `dist/`. `server.mjs` is a plain local static server for development (`npm start`, http://127.0.0.1:4173).
- Use Node 24. Run `npm test` for geometry, patient and model checks before publishing application changes. Documentation-only changes do not require extra tests.
- Keep asset and module URLs relative so they work under the `/cornea-crt-lab/` project path.
- Browser asset/module URLs currently use a shared `?v=6` release suffix. Update it consistently on future releases to avoid mixing cached old geometry with new UI modules.
- Measurements stay in the browser. Never add features that send patient data to a server, and never commit actual patient records.
- Do not ship third-party recommendation formulas without the owner's permission; the calculator panel only parses results the user pastes.
- Preserve the educational model assumptions, the not-a-medical-device notice and the trademark notice, and distinguish calculated geometry from clinically validated predictions.

## Publishing

- Review the intended changes and commit only files belonging to this project.
- For an authorized release, push the intended source commit to `origin/main` using ordinary Git. Do not force-push.
- The Pages workflow runs `npm test` and deploys `dist/` as the public app.
- Verify the matching GitHub Actions run and report the GitHub Pages URL. If a push or deployment fails, report its actual status.
