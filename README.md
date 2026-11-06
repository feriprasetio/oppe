# OPPE Digital — RSUD Sultan Syarif Mohamad Alkadrie

Standalone web application prototype, independent of AUREKA and without Supabase.

**Published site:** https://feriprasetio.github.io/oppe/

## Current deployment
- GitHub Pages deployment from GitHub Actions.
- Post-deploy smoke test checks the public HTML, CSS, JavaScript and profession catalogue.
- Source catalogue contains 49 profession profiles and 493 indicators/trigger texts.
- Profession-filtered staff selection and local-browser draft form are implemented as a prototype.

## Run locally
Serve the repository root over HTTP (ES modules and fetch do not work reliably from `file://`):

```bash
python -m http.server 8000
```

Open http://localhost:8000.

## Important limitations
- Current staff and assessment records use browser localStorage; data is not yet shared across users or devices.
- Signature upload, authenticated approval, server database and durable audit history are not yet implemented.
- The 49 source-background PDF pages and coordinate maps are not yet committed to this repository.
- Current print output is a basic HTML reconstruction, not a pixel-identical reproduction of the source DOCX/PDF.
- Trigger wording is preserved as source data but is not automatically treated as a pass/fail rule. Scoring rules require institutional approval.

Do not enter real staff personal data or upload authentic signatures until private backend storage, authentication and access controls are implemented.

See `docs/ARCHITECTURE.md`, `docs/SOURCE-MAPPING.md` and `docs/STATUS.md`.
