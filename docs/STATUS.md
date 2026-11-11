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

## Perbaikan 11 November 2026
- Kursor/fokus tidak lagi hilang saat pindah kolom indikator (sebelumnya seluruh tabel dirender ulang tiap perubahan).
- Indikator dengan nomor ganda (Fisioterapis, Kinerja Klinis no. 4) tidak lagi saling menimpa nilai.
- Cetak memakai penandatangan sesuai profesi dari katalog (signatory_slots), lengkap nama, NIP, dan gambar tanda tangan; sebelumnya selalu "Kepala Ruangan / Ketua Komite Tenaga Kesehatan Lainnya".
- Cetak otomatis kini berjalan (penutup tag script sebelumnya rusak).
- Unggah tanda tangan kini benar-benar tersimpan (diperkecil, lokal di browser) dan bisa dihapus.
- Bulk Export mencetak dokumen lengkap per periode yang dicentang dalam satu file, bukan halaman placeholder dan tidak lagi terkunci 2024–2026.
- Data Staf punya pilihan profesi sendiri, daftar staf tampil saat halaman dibuka, dan staf bisa dihapus.
- Ringkasan menampilkan jumlah indikator yang belum dinilai; cetakan diberi tanda DRAF bila belum lengkap.
- Validasi tahun, penanganan penyimpanan browser penuh, id HTML ganda "staff", dan tampilan HP yang melebar ke samping diperbaiki.
- CI memeriksa sintaks JavaScript sebelum deploy.

## Not yet production-ready
- Source background PDFs for all 49 professions are not committed in this repository.
- Per-profession coordinate calibration and source-faithful PDF overlay are not implemented.
- Bulk PDF export currently does not produce final source-layout pages.
- Signature uploads are not wired to durable private storage.
- Approval workflow, authentication, role-based authorization and server-side database are not implemented.
- Assessment storage currently relies on browser localStorage and is not shared between devices.

Do not use this public repository to store real staff personal data, actual signature assets, completed assessments or credentials.
