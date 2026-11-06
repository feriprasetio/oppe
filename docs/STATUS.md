# Current implementation status — 6 November 2026

## Deployment
- GitHub Pages project site: https://feriprasetio.github.io/oppe/
- GitHub Actions workflow: .github/workflows/pages.yml
- Latest verified deployment before this documentation-only update: successful.
- Post-deploy smoke test verified HTML, CSS, JavaScript, and the published JSON catalogue.
- Published catalogue validation: 49 professions and 493 indicators.

## Implemented prototype
- Responsive OPPE workspace shell.
- Profession catalogue loaded through fetch relative to import.meta.url (works under project path /oppe/).
- Profession-filtered staff dropdown.
- Browser-local staff, draft assessment and basic scoring summary.
- Basic print preview.

## Not yet production-ready
- Source background PDFs for all 49 professions are not committed in this repository.
- Per-profession coordinate calibration and source-faithful PDF overlay are not implemented.
- Bulk PDF export currently does not produce final source-layout pages.
- Signature uploads are not wired to durable private storage.
- Approval workflow, authentication, role-based authorization and server-side database are not implemented.
- Assessment storage currently relies on browser localStorage and is not shared between devices.

Do not use this public repository to store real staff personal data, actual signature assets, completed assessments or credentials.
