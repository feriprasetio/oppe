# OPPE Digital RSUD SSMA — Architecture

## Scope
Standalone application. No AUREKA integration and no Supabase dependency. GitHub Pages hosts the static frontend. A production backend (separately hosted Node.js API + PostgreSQL + private object storage) is required for multi-user authentication, private signatures, approved data and durable audit history.

## Current repository state
- UI shell and initial browser-local prototype.
- `data/professions.json`: should contain all 49 profiles extracted from source; verify the file before production.
- `assets/templates/profession-01.pdf` … `profession-49.pdf`: one-page source backgrounds converted from source document pages 1–49. A local copy was generated from the uploaded DOCX; the original DOCX itself must not be committed to this public repository.
- `src/pdf-renderer.js`: background PDF loader and PDF-lib text overlay utility.
- `src/app.js`: current prototype behavior; browser-local only.

## Source preservation
The original OPPE form has a recurring identity block, territory and quarter selection, three indicator groups, a four-part summary, and profession-dependent signature positions. The 49 profession pages differ in indicator labels and sometimes in the number or roles of signatories.

For faithful output, each source page must remain a PDF background; only dynamic values are overlaid. Do not recreate logos, watermark, table rules, font styling or layout independently. Each page has non-standard PDF geometry approximately 609.99 × 936 pt in the locally converted source. Calibrate coordinates for each profession page. The current HTML print preview is only a fallback preview and not a pixel-identical final document.

## Rules
1. Keep original indicator and trigger wording as supplied.
2. Trigger text is not automatically a pass/fail rule. Every score_rule requires institutional approval.
3. Annual and period-based indicators require an explicit approved measurement window.
4. Do not treat blank results as Good. An assessment cannot be finalized while mandatory indicators remain unassessed.
5. Preserve immutable snapshots of template version, indicator version, approver identity, approval time, signed asset version, and rendered PDF hash.
6. Signature images are not proof of approval. A final approval requires an authenticated action by a user with the relevant role.
7. Store staff personal data, signature assets and completed assessments in private storage; never commit these to a public repository.

## Database entities for production
users, roles, staff, professions, staff_professions, profession_versions, oppe_templates, template_versions, indicators, indicator_versions, assessments, assessment_items, signatory_slots, signatories, signature_asset_versions, approvals, audit_logs, exports, institution_assets.

## Recommended API
/api/auth/*, /api/staff, /api/professions, /api/templates, /api/indicators, /api/assessments, /api/signatories, /api/assets, /api/approvals, /api/audit-logs, /api/exports.
