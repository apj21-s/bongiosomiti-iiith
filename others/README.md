# others/

Files that are not part of the running application.

Everything here was moved out of the project root so the root shows only what
the app actually uses. Nothing in this folder is imported, served, built or
linted: `others/` is excluded in `tsconfig.json` and ignored in
`eslint.config.mjs`.

It is kept rather than deleted because some of it is useful history. Move
anything back if you need it again; git history follows the files.

| Path | What it is | Why it is here |
|---|---|---|
| `prototype_backup/` | The original static prototype the Next.js app was built from | Superseded by `app/`; nothing references it |
| `Mahalaya_Registration_Assets_CLEAN_FINAL (2)/` | Registration artwork | Byte-identical duplicate of `public/mahalaya_registration_assets/`, which is the copy the site serves |
| `durga-puja-hyderabad/`, `durga-puja-hyderabad-2026-separated-2d-assets/` | Design sources for the Durga Puja page | Outside `public/`, so never served; the page uses `public/assets/dp/` |
| `mahalaya_registration_screens/` | Screen mockups | Design reference only |
| `scratch/` | One-off scripts and notes from development | Not referenced by the app. Note `scratch/api_debug.log` was removed from the working tree earlier; it is still in git history and holds attendee data |
| `root-scripts/` | One-off scripts that sat in the repo root | `gen_ticket.js`, `get_html.js`, `replace-*.js`, `replace_buttons.py`, `send_test_email.js`, `test_email_direct.js`, `test-supabase-sync.js`, `update_email_html.js`, `a.html` |
| `album-align-calibrator.html` | A photo-album alignment tool | Was in `public/`, so it was being served to the public internet |
| `removed-routes/copy-assets-route.ts` | The old `/api/copy-assets` endpoint | Existed only to copy the duplicate artwork folder above. Moving it out of `app/` removes the route |

## Operational scripts are not here

`scripts/` in the project root is still live tooling — creating admins,
resending passes, database maintenance. See `RUNBOOK.md`.
