# OPPE Digital V2 — RSUD Sultan Syarif Mohamad Alkadrie
Static GitHub Pages workspace: https://feriprasetio.github.io/oppe/

## Usage
Import the private OPPE local package (JSON generated from the source workbook and Word artwork) or the original .xlsx through Data tenaga kesehatan. The XLSX importer validates the original workbook layout and rejects shifted section headers; import the JSON package as well to restore logos and watermark. No staff data, signatures, or evaluation records are included in this public repository. The package contains 146 rows and 21 source groups; ambiguous assignments must be checked. The app supports editing staff, entering actual measurements and notes per indicator, local autosave, signer mapping per group or individual quarter, twelve chronological PDF pages per staff, ZIP export and backup/restore. Demo uses fictional staff only, clearly labeled.

## Document design
PDF-lib draws a one-page vector reconstruction per quarter, using source geometry 609.9874 x 936 points, indicator groups and triggers from the 49-profile catalogue, original logo artwork when imported, checkbox areas and score table. Signer names are mapped from the Excel group, with three blank approval positions. All real staff output remains a draft; no automatic approval or signature image is inserted. Source Word rendering has layout overflow on some pages; reconstruction is not pixel identical. Source trigger operators are preserved semantically; unsupported glyphs are represented as >= or <=. The actual source needs institutional review, particularly annual indicators and category boundaries.

## Privacy
Browser localStorage is not an authenticated or encrypted clinical record system. Use only on authorized devices, back up privately, and delete when done. GitHub Pages frontend is public, not the data. Vendor PDF-lib and JSZip are pinned and copied into the deployment by Actions; no runtime third-party script/CDN is used. No backend or real signature workflow is present.

## V3 hierarchy
Two unsigned approval slots per page: committee chair plus room/unit head for staff, or section head for room/unit heads. Source-row mapping includes the three pharmacy sub-unit heads; missing/ambiguous or self-signing assignments are blocked from automatic naming. Use per-period overrides for authorized replacements. PDF status describes incomplete or pending approval records; no fabricated measurements or copied signatures. Import revised mapping package to refresh group names without overwriting assessments.

## V4 single assessment workspace
The assessment has a fixed twelve-quarter scope, no quarter selector. Shared entries are saved locally as pending edits and applied to all twelve records only after explicit confirmation that measurements apply to each period. Per-indicator details accept separate quarterly actuals. Missing/invalid values remain unassessed. Automatic results distinguish adverse triggers from direct targets, including strict laboratory rejection and positive > targets. Annual/monthly windows are displayed; no annual totals are imputed. A working rule is not institutional approval. Export uses actual recorded values, with ongoing-period and approval status retained. The user-corrected committee chair is resolved from local Excel source row 89, with no employee names or NIP embedded in public code; self-assessment is blocked and prior row-94 assignments migrate. 

## V5 final archive
A local IndexedDB archive preserves the exact bytes of a manually checked, externally signed 12-page PDF. Before archiving, all quarters must have ended, assessments must be complete with evidence, provisional values cleared and signatory conflicts resolved. The operator records the approval reference and confirms manual review. SHA-256 of the assessment snapshot and original PDF detect changed data and corrupted files; they do not authenticate signatories or validate electronic signatures. Final export returns the original PDF bytes, not a newly stamped document. The final ZIP includes only current signed archives with a manifest; signed documents must be backed up separately from JSON. No source signature images are published, reconstructed or automatically replayed. The ongoing Q4 2026 cannot be finalized before its end.

## V6 private approval portal (option B)
See [backend deployment guide](backend/README.md). A separate authorized HTTPS server is required; Pages only provides a local request export and portal link. Each enrolled signer reviews and approves exact PDF(s) using their own account and optional own image upload; no automatic Excel signature replay, no certified TTE. The backend blocks incomplete/future periods and self-approval. No live backend deployment is included.

## V6.1 export UX
The only individual signed-PDF export is next to the assessment save action. It downloads the exact current approved PDF from the local archive or explains the missing conditions inline; it never generates a falsely signed document. The unsigned/export-for-signing tools and external archive form are collapsed by default. Bulk signed ZIP remains in the archive section. The private portal requires separate deployment and does not synchronize signed PDFs directly to Pages yet.

## V7 simplified local export
One export button beneath the assessment generates a 12-page PDF from saved records; the scope selector allows a ZIP for all staff. Approval and portal configuration panels are removed from the public interface. Existing matching signed archives are reused byte-for-byte if available; otherwise PDFs retain unsigned and ongoing-period status, with mapped signer names and empty signature lines. No automatic signature replay or approval claims. Existing local data and signed archives are not deleted by the upgrade. The separate backend source remains in the repository but is not part of the public UI.

## V7.1 private personal signature assets
The separately hosted approval portal can store a signer's own image in an account-scoped encrypted vault, with password reauthentication for changes and an explicit document approval requirement. The public one-button export remains unchanged except version label; it does not replay Excel signatures. See backend/README.md for deployment and key setup. No production backend is connected.

## V8 tanda tangan otomatis
Di **Mapping penandatangan**, tiap penanda tangan (Ketua Komite, kepala ruang/unit, kepala seksi) dapat diunggahkan gambar TTD-nya sekali (PNG/JPG). Admin wajib mengonfirmasi bahwa pemilik TTD sudah memberi izin; tanggal izin disimpan bersama gambar. TTD dicocokkan per orang (NIP, atau nama bila NIP kosong), dikecilkan, latar putih dibuat transparan, dan disimpan hanya di browser/backup privat — tidak pernah di repo.
Saat ekspor, TTD dibubuhkan otomatis hanya pada triwulan yang statusnya lengkap (periode selesai, semua indikator terisi, bukti dicatat, mapping terverifikasi). Halaman dengan kedua TTD bertanda "TELAH DITANDATANGANI"; triwulan yang belum lengkap tetap memakai garis kosong. Mode simulasi tidak pernah memakai TTD.

### V8.1
- TTD dibubuhkan pada setiap triwulan yang **sudah selesai dan seluruh indikatornya terisi**; referensi bukti tidak lagi wajib.
- **Impor Excel mapping** sekarang juga membaca gambar TTD yang ditempel di sheet (dicocokkan ke nama/NIP pada baris gambar, atau blok kepala seksi di kolom H), lalu membersihkan latarnya otomatis (putih, abu, kekuningan, foto) dan memasangnya sebagai TTD otomatis setelah konfirmasi izin.
