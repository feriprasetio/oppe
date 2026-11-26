# OPPE Digital V2 — RSUD Sultan Syarif Mohamad Alkadrie
Static GitHub Pages workspace: https://feriprasetio.github.io/oppe/

## Usage
Import the private OPPE local package (JSON generated from the source workbook and Word artwork) through Data tenaga kesehatan. No staff data, signatures, or evaluation records are included in this public repository. The package contains 146 rows and 21 source groups; ambiguous assignments must be checked. The app supports editing staff, entering actual measurements and notes per indicator, local autosave, signer mapping per group or individual quarter, twelve chronological PDF pages per staff, ZIP export and backup/restore. Demo uses fictional staff only, clearly labeled.

## Document design
PDF-lib draws a one-page vector reconstruction per quarter, using source geometry 609.9874 x 936 points, indicator groups and triggers from the 49-profile catalogue, original logo artwork when imported, checkbox areas and score table. Signer names are mapped from the Excel group, with three blank approval positions. All real staff output remains a draft; no automatic approval or signature image is inserted. Source Word rendering has layout overflow on some pages; reconstruction is not pixel identical. Source trigger operators are preserved semantically; unsupported glyphs are represented as >= or <=. The actual source needs institutional review, particularly annual indicators and category boundaries.

## Privacy
Browser localStorage is not an authenticated or encrypted clinical record system. Use only on authorized devices, back up privately, and delete when done. GitHub Pages frontend is public, not the data. Vendor PDF-lib and JSZip are pinned and copied into the deployment by Actions; no runtime third-party script/CDN is used. No backend or real signature workflow is present.
