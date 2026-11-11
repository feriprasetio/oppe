// OPPE Digital — prototipe mandiri (data disimpan di browser ini saja).
const KEY = 'oppe-digital-v1';
const GROUPS = ['Perilaku', 'Pengembangan Profesionalisme', 'Kinerja Klinis/Profesional Primer'];
const ROMAN = ['I', 'II', 'III', 'IV'];
const DEFAULT_INSTITUTION = 'Rumah Sakit Umum Daerah Sultan Syarif Mohamad Alkadrie';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let professions = [];
let profile = null;

// ---------------------------------------------------------------- state
const empty = () => ({ staff: [], assessments: {}, settings: { institution: DEFAULT_INSTITUTION, signers: {} }, signatures: {} });
function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    const s = { ...empty(), ...raw };
    s.staff = Array.isArray(s.staff) ? s.staff : [];
    s.assessments = s.assessments && typeof s.assessments === 'object' ? s.assessments : {};
    s.settings = { ...empty().settings, ...(s.settings || {}) };
    s.settings.signers = s.settings.signers && typeof s.settings.signers === 'object' ? s.settings.signers : {};
    s.signatures = s.signatures && typeof s.signatures === 'object' ? s.signatures : {};
    return s;
  } catch {
    return empty();
  }
}
let state = loadState();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error('OPPE save failed:', error);
    toast('Gagal menyimpan: penyimpanan browser penuh. Hapus tanda tangan/staf yang tidak dipakai.');
    return false;
  }
}

let toastTimer;
function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ---------------------------------------------------------------- helpers
const byId = (id) => professions.find((p) => p.id === id);
const assessmentKey = (staffId, year, quarter) => [staffId, year, quarter].join('::');
const currentYear = () => {
  const y = Number($('year').value);
  return Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : null;
};
const currentQuarter = () => $('quarter').selectedIndex + 1;
const currentAssessment = () => {
  const y = currentYear();
  return y ? state.assessments[assessmentKey($('staff').value, y, currentQuarter())] : undefined;
};

/** Daftar indikator dengan id unik. Nomor ganda dalam satu kelompok (mis. Fisioterapis) diberi akhiran #2, #3, … */
function indicatorsOf(prof) {
  const seen = {};
  return (prof?.indicators || []).map((ind) => {
    const base = ind.category + '-' + ind.number;
    seen[base] = (seen[base] || 0) + 1;
    return { ...ind, id: seen[base] === 1 ? base : base + '#' + seen[base] };
  });
}

/** Slot tanda tangan dari katalog: "Penilai, Kepala KSM Anak" → { caption: 'Penilai', role: 'Kepala KSM Anak' } */
function signatorySlots(prof) {
  return (prof?.signatory_slots || []).map((raw) => {
    let role = String(raw).replace(/_{3,}.*$/, '').replace(/\s+Nama\s*\/\s*NIP\s*$/i, '').trim();
    let caption = '';
    const m = /^(Mengetahui|Penilai|Menyetujui|Pemohon)\s*,\s*(.+)$/i.exec(role);
    if (m) { caption = m[1]; role = m[2].trim(); }
    return { caption, role };
  }).filter((s) => s.role);
}

function score(a, prof) {
  const items = a?.items || {};
  const all = indicatorsOf(prof);
  const rated = Object.values(items).filter((x) => x.result === 'Baik' || x.result === 'Kurang');
  const good = rated.filter((x) => x.result === 'Baik').length;
  const pct = rated.length ? (100 * good) / rated.length : null;
  const missing = all.filter((i) => !['Baik', 'Kurang'].includes(items[i.id]?.result)).length;
  const category = pct === null ? 'Belum dinilai' : pct >= 90 ? 'Sangat Baik' : pct >= 70 ? 'Baik' : pct >= 60 ? 'Cukup' : 'Kurang';
  return { good, n: rated.length, total: all.length, missing, pct, category };
}

// ---------------------------------------------------------------- selects & lists
function professionOptions(placeholder) {
  return '<option value="">' + esc(placeholder) + '</option>' + professions.map((p) => '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>').join('');
}

function refreshStaffSelect() {
  const pid = $('profession').value;
  const keep = $('staff').value;
  const rows = state.staff.filter((s) => s.professionId === pid);
  $('staff').innerHTML = !pid
    ? '<option value="">Pilih profesi dahulu</option>'
    : rows.length
      ? '<option value="">Pilih staf</option>' + rows.map((s) => '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>').join('')
      : '<option value="">Belum ada staf untuk profesi ini — tambah di Data Staf</option>';
  if (rows.some((s) => s.id === keep)) $('staff').value = keep;
}

function refreshBulkStaff() {
  const keep = $('bulkStaff').value;
  $('bulkStaff').innerHTML = '<option value="">Pilih staf</option>' + state.staff
    .map((s) => '<option value="' + esc(s.id) + '">' + esc(s.name) + ' · ' + esc(byId(s.professionId)?.name || '-') + '</option>').join('');
  if (state.staff.some((s) => s.id === keep)) $('bulkStaff').value = keep;
  renderPeriods();
}

function renderStaffRows() {
  if (!state.staff.length) { $('staffRows').innerHTML = '<p class="muted">Belum ada staf tersimpan di browser ini.</p>'; return; }
  const sorted = [...state.staff].sort((a, b) => (byId(a.professionId)?.name || '').localeCompare(byId(b.professionId)?.name || '') || a.name.localeCompare(b.name));
  $('staffRows').innerHTML = '<div class="table-wrap"><table><thead><tr><th>Nama</th><th>ID / NIP</th><th>Profesi</th><th>Penilaian</th><th></th></tr></thead><tbody>' + sorted.map((s) => {
    const count = Object.values(state.assessments).filter((a) => a.staffId === s.id).length;
    return '<tr><td>' + esc(s.name) + '</td><td>' + esc(s.employeeId) + '</td><td>' + esc(byId(s.professionId)?.name || '-') + '</td><td>' + count + ' periode</td>' +
      '<td><button type="button" class="secondary small" data-delete-staff="' + esc(s.id) + '">Hapus</button></td></tr>';
  }).join('') + '</tbody></table></div>';
}

function refreshAllStaff() {
  refreshStaffSelect();
  refreshBulkStaff();
  renderStaffRows();
}

// ---------------------------------------------------------------- assessment form
function render() {
  const pid = $('profession').value;
  const sid = $('staff').value;
  profile = byId(pid) || null;
  renderSigners();
  const staff = state.staff.find((s) => s.id === sid);
  if (!profile || !staff) {
    $('form').innerHTML = '<p class="muted">' + (profile ? 'Pilih nama staf.' : 'Pilih profesi dan nama staf.') + '</p>';
    return;
  }
  if (!currentYear()) {
    $('form').innerHTML = '<p class="muted">Isi tahun penilaian yang valid (2000–2100).</p>';
    return;
  }
  const a = currentAssessment() || { items: {} };
  const inds = indicatorsOf(profile);
  $('form').innerHTML = GROUPS.map((g) => {
    const rows = inds.filter((i) => i.category === g);
    if (!rows.length) return '';
    return '<div class="group"><h3>Indikator ' + esc(g) + '</h3><div class="table-wrap"><table><thead><tr><th>No.</th><th>Indikator</th><th>Trigger sumber</th><th>Nilai capaian</th><th>Hasil</th></tr></thead><tbody>' +
      rows.map((i) => {
        const v = a.items[i.id] || {};
        return '<tr><td>' + esc(i.number) + '</td><td>' + esc(i.name) + '<br><small class="muted-note">Aturan skor: menunggu pengesahan</small></td><td>' + esc(i.trigger) + '</td>' +
          '<td><input class="indicator-input" aria-label="Nilai capaian ' + esc(i.name) + '" data-id="' + esc(i.id) + '" data-field="value" value="' + esc(v.value || '') + '"></td>' +
          '<td><select aria-label="Hasil ' + esc(i.name) + '" data-id="' + esc(i.id) + '" data-field="result"><option value="">Belum dinilai</option><option' + (v.result === 'Baik' ? ' selected' : '') + '>Baik</option><option' + (v.result === 'Kurang' ? ' selected' : '') + '>Kurang</option></select></td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }).join('') + '<div id="summary"></div><p class="muted-note">Trigger pada instrumen sumber belum diperlakukan sebagai aturan kelulusan. Tetapkan aturan Baik/Kurang secara resmi sebelum otomatisasi.</p>';
  renderSummary();
}

function renderSummary() {
  const box = $('summary');
  if (!box || !profile) return;
  const a = currentAssessment();
  const s = score(a, profile);
  box.innerHTML = '<div class="summary"><div><small>Jumlah Baik</small><strong>' + s.good + '</strong></div><div><small>Indikator Dinilai</small><strong>' + s.n + ' / ' + s.total + '</strong></div>' +
    '<div><small>Nilai OPPE</small><strong>' + (s.pct === null ? '—' : s.pct.toFixed(2) + '%') + '</strong></div><div><small>Kategori</small><strong>' + esc(s.category) + '</strong></div></div>' +
    (s.missing ? '<p class="warn-note">' + s.missing + ' indikator belum dinilai — penilaian belum dapat dianggap final.</p>' : '') +
    (a?.updatedAt ? '<p class="muted-note">Tersimpan otomatis ' + esc(new Date(a.updatedAt).toLocaleString('id-ID')) + (a.status ? ' · Status: ' + esc(a.status) : '') + '</p>' : '');
}

function onIndicatorChange(el) {
  const sid = $('staff').value;
  const year = currentYear();
  if (!sid || !year || !profile) return;
  const k = assessmentKey(sid, year, currentQuarter());
  const a = state.assessments[k] || (state.assessments[k] = { professionId: profile.id, staffId: sid, year, quarter: currentQuarter(), items: {}, status: 'Draft' });
  const item = a.items[el.dataset.id] || (a.items[el.dataset.id] = {});
  item[el.dataset.field] = el.value;
  a.updatedAt = new Date().toISOString();
  save();
  // Perbarui ringkasan saja: render ulang seluruh tabel membuat kursor/fokus hilang saat pindah kolom.
  renderSummary();
  renderStaffRows();
  if ($('bulkStaff').value === sid) renderPeriods();
}

// ---------------------------------------------------------------- signers (per jabatan, dipakai ulang lintas profesi)
function renderSigners() {
  const box = $('signers');
  if (!box) return;
  const slots = signatorySlots(profile);
  if (!profile) { box.innerHTML = '<p class="muted">Pilih profesi pada Formulir Penilaian untuk mengatur penandatangannya.</p>'; return; }
  if (!slots.length) { box.innerHTML = '<p class="muted">Profesi ini tidak memiliki slot tanda tangan di katalog.</p>'; return; }
  box.innerHTML = '<p class="muted">Penandatangan untuk <b>' + esc(profile.name) + '</b>. Nama disimpan per jabatan sehingga dipakai ulang di profesi lain dengan jabatan yang sama.</p>' +
    slots.map((s) => {
      const signer = state.settings.signers[s.role] || {};
      const sig = state.signatures[s.role];
      return '<fieldset class="signer"><legend>' + (s.caption ? esc(s.caption) + ' · ' : '') + esc(s.role) + '</legend>' +
        '<label>Nama<input data-signer="' + esc(s.role) + '" data-field="name" value="' + esc(signer.name || '') + '" placeholder="Nama pejabat"></label>' +
        '<label>NIP<input data-signer="' + esc(s.role) + '" data-field="nip" value="' + esc(signer.nip || '') + '" placeholder="NIP (opsional)"></label>' +
        '<label>Tanda tangan (gambar)<input type="file" accept="image/png,image/jpeg" data-signature="' + esc(s.role) + '"></label>' +
        (sig ? '<div class="sig-preview"><img alt="Tanda tangan ' + esc(s.role) + '" src="' + sig + '"><button type="button" class="secondary small" data-remove-signature="' + esc(s.role) + '">Hapus tanda tangan</button></div>' : '') +
        '</fieldset>';
    }).join('');
}

/** Perkecil gambar tanda tangan agar muat di localStorage (lebar maks 480px, PNG). */
function readSignature(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g)$/.test(file.type)) { reject(new Error('Format harus PNG atau JPG.')); return; }
    if (file.size > 5 * 1024 * 1024) { reject(new Error('Ukuran gambar maksimal 5 MB.')); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 480 / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Gambar tidak dapat dibaca.')); };
    img.src = url;
  });
}

// ---------------------------------------------------------------- print
function documentHtml(staff, prof, a, year, quarter) {
  const s = score(a, prof);
  const inds = indicatorsOf(prof);
  const tables = GROUPS.map((g) => {
    const rows = inds.filter((i) => i.category === g);
    if (!rows.length) return '';
    return '<h3>Indikator ' + esc(g) + '</h3><table><thead><tr><th class="no">No</th><th>Indikator</th><th>Trigger</th><th>Nilai Capaian</th><th>Hasil</th></tr></thead><tbody>' + rows.map((i) => {
      const v = a?.items?.[i.id] || {};
      return '<tr><td class="no">' + esc(i.number) + '</td><td>' + esc(i.name) + '</td><td>' + esc(i.trigger) + '</td><td>' + esc(v.value || '') + '</td><td>' + esc(v.result || 'Belum dinilai') + '</td></tr>';
    }).join('') + '</tbody></table>';
  }).join('');
  const signs = signatorySlots(prof).map((slot) => {
    const signer = state.settings.signers[slot.role] || {};
    const sig = state.signatures[slot.role];
    return '<div class="slot"><div>' + esc(slot.caption || ' ') + '</div><div>' + esc(slot.role) + '</div>' +
      '<div class="sigbox">' + (sig ? '<img alt="" src="' + sig + '">' : '') + '</div>' +
      '<div class="name">' + esc(signer.name || '______________________________') + '</div><div>NIP. ' + esc(signer.nip || '') + '</div></div>';
  }).join('');
  return '<section class="page"><header><h1>On Going Professional Practice Evaluation</h1><h2>Staf Medis dan Tenaga Kesehatan</h2>' + esc(state.settings.institution) + '</header>' +
    '<table class="ident"><tr><td>Nama Staf</td><td>: ' + esc(staff.name) + '</td></tr><tr><td>ID / NIP</td><td>: ' + esc(staff.employeeId) + '</td></tr>' +
    '<tr><td>Profesi / SMF</td><td>: ' + esc(prof.name) + '</td></tr><tr><td>Periode</td><td>: Triwulan ' + ROMAN[quarter - 1] + ' Tahun ' + esc(year) + '</td></tr></table>' +
    tables +
    '<div class="sum"><span>Jumlah Baik: <b>' + s.good + '</b></span><span>Indikator Dinilai: <b>' + s.n + ' / ' + s.total + '</b></span><span>Nilai: <b>' + (s.pct === null ? '—' : s.pct.toFixed(2) + '%') + '</b></span><span>Kategori: <b>' + esc(s.category) + '</b></span></div>' +
    (s.missing ? '<p class="draft">DRAF — ' + s.missing + ' indikator belum dinilai.</p>' : '') +
    '<div class="sign">' + signs + '</div></section>';
}

const PRINT_CSS = '@page{size:A4;margin:14mm}body{font:10.5px Arial,sans-serif;color:#000;margin:0}.page{page-break-after:always;break-after:page}.page:last-child{page-break-after:auto;break-after:auto}' +
  'header{text-align:center;border-bottom:2px solid;padding-bottom:8px;margin-bottom:10px}h1{font-size:16px;margin:0 0 4px}h2{font-size:13px;margin:0 0 4px}h3{font-size:11.5px;margin:12px 0 4px}' +
  'table{width:100%;border-collapse:collapse;margin:4px 0 10px}td,th{border:1px solid #666;padding:5px;text-align:left;vertical-align:top}th{background:#eee}.no{width:28px;text-align:center}' +
  '.ident td{border:0;padding:2px 4px}.ident td:first-child{width:110px}.sum{display:flex;flex-wrap:wrap;gap:24px;border:1px solid;padding:10px;margin-top:6px}.draft{color:#a00;font-weight:bold}' +
  '.sign{display:flex;flex-wrap:wrap;justify-content:space-around;gap:18px;margin-top:28px;text-align:center;break-inside:avoid}.slot{width:44%;min-width:200px}.sigbox{height:62px;display:flex;align-items:center;justify-content:center}.sigbox img{max-height:60px;max-width:180px}.name{font-weight:bold;text-decoration:underline}';

function openPrint(title, sectionsHtml) {
  const w = window.open('', '_blank');
  if (!w) { toast('Izinkan pop-up di browser untuk mencetak.'); return false; }
  // Catatan: penutup tag script ditulis terpisah agar tidak dianggap teks (sebelumnya "<\/script>" membuat cetak otomatis tidak jalan).
  w.document.write('<!doctype html><html lang="id"><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' + PRINT_CSS + '</style></head><body>' + sectionsHtml +
    '<script>window.onload=function(){setTimeout(function(){window.print()},300)}</scr' + 'ipt></body></html>');
  w.document.close();
  return true;
}

// ---------------------------------------------------------------- bulk export
function savedPeriodsFor(staffId) {
  return Object.values(state.assessments)
    .filter((a) => a.staffId === staffId)
    .sort((a, b) => a.year - b.year || a.quarter - b.quarter);
}

function renderPeriods() {
  const sid = $('bulkStaff').value;
  const box = $('periods');
  if (!sid) { box.innerHTML = '<p class="muted">Pilih staf untuk melihat periode yang tersimpan.</p>'; return; }
  const periods = savedPeriodsFor(sid);
  if (!periods.length) { box.innerHTML = '<p class="muted">Belum ada penilaian tersimpan untuk staf ini.</p>'; return; }
  box.innerHTML = '<div class="periods">' + periods.map((a) => {
    const s = score(a, byId(a.professionId));
    return '<label class="period-item"><input type="checkbox" checked data-period="' + esc(assessmentKey(a.staffId, a.year, a.quarter)) + '"> Triwulan ' + ROMAN[a.quarter - 1] + ' ' + esc(a.year) +
      '<small>' + (s.pct === null ? 'Belum dinilai' : s.pct.toFixed(2) + '% · ' + esc(s.category)) + (s.missing ? ' · ' + s.missing + ' belum dinilai' : '') + '</small></label>';
  }).join('') + '</div>';
}

function bulkExport() {
  const sid = $('bulkStaff').value;
  const staff = state.staff.find((s) => s.id === sid);
  if (!staff) { toast('Pilih staf terlebih dahulu.'); return; }
  const keys = [...$('periods').querySelectorAll('[data-period]:checked')].map((el) => el.dataset.period);
  if (!keys.length) { toast('Centang minimal satu periode.'); return; }
  const sections = keys.map((k) => state.assessments[k]).filter(Boolean).map((a) => {
    const prof = byId(a.professionId) || byId(staff.professionId);
    return prof ? documentHtml(staff, prof, a, a.year, a.quarter) : '';
  }).join('');
  if (openPrint('OPPE ' + staff.name, sections)) toast(keys.length + ' periode disiapkan untuk dicetak/PDF.');
}

// ---------------------------------------------------------------- actions
function addStaff() {
  const name = $('staffName').value.trim();
  const employeeId = $('employeeId').value.trim();
  const pid = $('staffProfession').value;
  if (!name || !employeeId || !pid) { toast('Isi nama, ID/NIP, dan pilih profesi staf.'); return; }
  if (state.staff.some((s) => s.employeeId.toLowerCase() === employeeId.toLowerCase())) { toast('ID/NIP tersebut sudah dipakai staf lain.'); return; }
  state.staff.push({ id: crypto.randomUUID(), name, employeeId, professionId: pid });
  if (!save()) { state.staff.pop(); return; }
  $('staffName').value = '';
  $('employeeId').value = '';
  refreshAllStaff();
  toast('Staf tersimpan di browser ini.');
}

function deleteStaff(id) {
  const s = state.staff.find((x) => x.id === id);
  if (!s) return;
  const count = Object.values(state.assessments).filter((a) => a.staffId === id).length;
  if (!confirm('Hapus staf "' + s.name + '"' + (count ? ' beserta ' + count + ' penilaian tersimpan' : '') + '? Tindakan ini tidak dapat dibatalkan.')) return;
  state.staff = state.staff.filter((x) => x.id !== id);
  for (const [k, a] of Object.entries(state.assessments)) if (a.staffId === id) delete state.assessments[k];
  save();
  refreshAllStaff();
  render();
  toast('Staf dihapus.');
}

function saveSettings() {
  state.settings.institution = $('institution').value.trim() || DEFAULT_INSTITUTION;
  $('signers').querySelectorAll('[data-signer]').forEach((el) => {
    const role = el.dataset.signer;
    state.settings.signers[role] = { ...(state.settings.signers[role] || {}), [el.dataset.field]: el.value.trim() };
  });
  if (save()) toast('Pengaturan tersimpan.');
}

function init() {
  $('profession').innerHTML = professionOptions('Pilih profesi');
  $('staffProfession').innerHTML = professionOptions('Pilih profesi staf');
  $('institution').value = state.settings.institution || DEFAULT_INSTITUTION;

  $('profession').addEventListener('change', () => {
    if (!$('staffProfession').value) $('staffProfession').value = $('profession').value;
    refreshStaffSelect();
    render();
  });
  $('staff').addEventListener('change', render);
  $('year').addEventListener('change', render);
  $('quarter').addEventListener('change', render);
  $('form').addEventListener('change', (e) => { if (e.target.matches('[data-id][data-field]')) onIndicatorChange(e.target); });

  $('save').addEventListener('click', () => {
    if (!profile || !$('staff').value) { toast('Pilih profesi dan nama staf terlebih dahulu.'); return; }
    if (!currentYear()) { toast('Isi tahun yang valid.'); return; }
    const a = currentAssessment();
    if (!a) { toast('Isi minimal satu indikator terlebih dahulu.'); return; }
    a.status = 'Draft';
    a.updatedAt = new Date().toISOString();
    if (save()) { renderSummary(); toast('Draf disimpan. Perubahan juga tersimpan otomatis.'); }
  });
  $('print').addEventListener('click', () => {
    const staff = state.staff.find((x) => x.id === $('staff').value);
    if (!staff || !profile) { toast('Pilih profesi dan nama staf terlebih dahulu.'); return; }
    const year = currentYear();
    if (!year) { toast('Isi tahun yang valid.'); return; }
    openPrint('OPPE ' + staff.name, documentHtml(staff, profile, currentAssessment(), year, currentQuarter()));
  });

  $('addStaff').addEventListener('click', addStaff);
  $('staffRows').addEventListener('click', (e) => { const b = e.target.closest('[data-delete-staff]'); if (b) deleteStaff(b.dataset.deleteStaff); });

  $('bulkStaff').addEventListener('change', renderPeriods);
  $('bulkExport').addEventListener('click', bulkExport);

  $('saveSettings').addEventListener('click', saveSettings);
  $('signers').addEventListener('change', async (e) => {
    const input = e.target.closest('[data-signature]');
    if (!input || !input.files?.[0]) return;
    try {
      const role = input.dataset.signature;
      const previous = state.signatures[role];
      state.signatures[role] = await readSignature(input.files[0]);
      if (!save()) { if (previous) state.signatures[role] = previous; else delete state.signatures[role]; return; }
      renderSigners();
      toast('Tanda tangan tersimpan di browser ini.');
    } catch (error) {
      input.value = '';
      toast(error.message || 'Tanda tangan gagal dibaca.');
    }
  });
  // Nama/NIP penandatangan tersimpan otomatis saat diketik (tidak hilang saat unggah tanda tangan).
  $('signers').addEventListener('input', (e) => {
    const el = e.target.closest('[data-signer]');
    if (!el) return;
    const role = el.dataset.signer;
    state.settings.signers[role] = { ...(state.settings.signers[role] || {}), [el.dataset.field]: el.value.trim() };
    save();
  });
  $('institution').addEventListener('input', () => { state.settings.institution = $('institution').value.trim() || DEFAULT_INSTITUTION; save(); });
  $('signers').addEventListener('click', (e) => {
    const b = e.target.closest('[data-remove-signature]');
    if (!b) return;
    delete state.signatures[b.dataset.removeSignature];
    save();
    renderSigners();
    toast('Tanda tangan dihapus.');
  });

  refreshAllStaff();
  render();
}

fetch(new URL('../data/professions.json', import.meta.url), { cache: 'no-store' })
  .then((response) => {
    if (!response.ok) throw new Error('HTTP ' + response.status + ' saat memuat katalog profesi');
    return response.json();
  })
  .then((data) => {
    if (!Array.isArray(data) || data.length !== 49) throw new Error('Katalog OPPE tidak lengkap: diharapkan 49 profesi.');
    professions = data;
    init();
  })
  .catch((error) => {
    console.error('OPPE bootstrap failed:', error);
    const form = $('form');
    if (form) form.innerHTML = '<p class="muted">Katalog profesi belum dapat dimuat. Periksa koneksi dan muat ulang halaman.</p>';
    toast('Gagal memuat katalog profesi.');
  });
