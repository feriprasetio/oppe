# OPPE Digital — RSUD SSMA

Standalone prototype, separate from AUREKA and without Supabase. Static frontend intended for GitHub Pages. Production institutional use requires a separate secured backend, authentication, PostgreSQL database and private object storage.

## Prototype
- Profession-driven assessment UI and basic draft scoring.
- Editable browser-local staff/settings and signatory placeholders.
- 49 source-specific profession forms and 493 indicator rows are being added to the catalogue.
- Source PDF backgrounds, overlay renderer and per-profession coordinate calibration are still being integrated.

## Run locally
`python -m http.server 8000` then open `http://localhost:8000`.

## Important
This is not production-ready. Do not use real staff data, actual signatures or completed OPPE records in this public repository. Trigger strings are not automatically scoring rules. The currently wired print output is not pixel-identical to the source DOCX. A faithful output requires source-page PDF backgrounds, calibrated overlays for every profession, and visual regression tests.

See `docs/ARCHITECTURE.md` and `docs/SOURCE-MAPPING.md`.