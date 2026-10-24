# Project workflow

## Source and deployment

- The user selected GitHub as this project's source of truth and GitHub Pages as its deployment destination.
- Repository: https://github.com/cucube1985/cornea-crt-lab
- Production site: https://cucube1985.github.io/cornea-crt-lab/
- This directory is the application repository. The parent workspace may contain a separate Git repository; run Git commands from this directory or use `git -C` with this directory.
- The default branch is `main`, tracking `origin/main`. Fetch and inspect local changes before integrating remote updates. Preserve existing work, including the recommendation calculator.
- Use the existing GitHub workflow for this project. Do not create, synchronize, or deploy an OpenAI Sites project unless the user explicitly requests it. The retained `.openai/hosting.json` describes the earlier deployment and does not control GitHub Pages.

## Development

- The application is buildless HTML, CSS, and JavaScript ES modules in `dist/`.
- Run `npm start` for the local preview at http://127.0.0.1:4173.
- Run `npm test` for applicable geometry and recommendation checks before publishing application changes. Documentation-only changes do not require extra tests.
- Keep asset and module URLs relative so they work under the `/cornea-crt-lab/` project path.
- Browser asset/module URLs currently use a shared `?v=3` release suffix. Update it consistently on future releases to avoid mixing cached old geometry with new UI modules.
- Preserve the educational model assumptions and distinguish calculated geometry from clinically validated predictions.

## Publishing

- Review the intended changes and commit only files belonging to this project.
- For an authorized release, push the intended source commit to `origin/main` using ordinary Git. Do not force-push.
- `.github/workflows/pages.yml` runs the tests and deploys `dist/` to GitHub Pages after a push to `main`.
- Verify the matching GitHub Actions run and report the GitHub Pages URL. If a push or deployment fails, report its actual status.
