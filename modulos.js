/* WMAP · módulos ampliados: rangos, validación, vigilancia WPQ, import/export, fichas,
 * welding book (cajetín, revisiones), producción, END y calculadoras. Se carga después de app.js. */
'use strict';
const R_ = window.WMAPR, C_ = window.WMAPC;
const sist = nid => ((L.normas.find(n => n.id == nid) || {}).sistema) || 'ASME';
const pAws = id => (L.procesos.find(p => p.id == id) || {}).codigo_aws;
const pIso = id => (L.procesos.find(p => p.id == id) || {}).codigo_iso;
const byOrden = (a, b) => (a.orden || 0) - (b.orden || 0);
const hoyISO = () => new Date().toISOString().slice(0, 10);
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o.length ? o : [[]]; };
const badge = (k, t) => `<span class="badge b-${k}">${esc(t ?? k)}</span>`;
const showModal = html => { $('#box').innerHTML = html; $('#modal').classList.remove('hidden'); const c = $('#box [data-close]'); if (c) c.onclick = () => $('#modal').classList.add('hidden'); };
const reloadAll = async () => { Object.keys(L).forEach(x => delete L[x]); await loadLookups(); };

/* ---------- carga masiva y ajustes ---------- */
DB.bulk = async function (t, rows) {
  if (!rows.length) return;
  if (DEMO) { const d = Demo.get(); d[t] = d[t] || []; let n = Math.max(0, ...d[t].map(x => (typeof x.id === 'number' ? x.id : 0))); rows.forEach(r => { const o = { ...r }; if (SERIAL.has(t) && !o.id) o.id = ++n; d[t].push(o); }); Demo.save(d); return; }
  for (let i = 0; i < rows.length; i += 200) { const { error } = await sb.from(t).insert(rows.slice(i, i + 200)); if (error) throw error; }
};
let AJ = null;
async function getAj() { if (AJ) return AJ; const r = (await DB.listSafe('ajustes')).find(x => x.id === 'empresa'); AJ = r ? r.valor : {}; return AJ; }

/* ---------- procesos de PQR/WPS ---------- */
async function procsPQR(id) { return (await DB.where('pqr_procesos', 'pqr_id', id)).sort(byOrden).map(x => ({ rowid: x.id, aws: pAws(x.proceso_id), iso: pIso(x.proceso_id), t_dep: x.espesor_depositado_mm })); }
async function loadVal() { const [wp, wprocs, pprocs] = await Promise.all([DB.listSafe('wps_pqr'), DB.listSafe('wps_procesos'), DB.listSafe('pqr_procesos')]); return { wp, wprocs, pprocs }; }
function validarWPS(w, V) {
  const pqrs = V.wp.filter(x => x.wps_id == w.id).map(l => L.pqr.find(p => p.id == l.pqr_id)).filter(Boolean).map(p => ({ pqr: p, sistema: sist(p.norma_id), procs: V.pprocs.filter(x => x.pqr_id == p.id).sort(byOrden).map(x => ({ aws: pAws(x.proceso_id), iso: pIso(x.proceso_id), t_dep: x.espesor_depositado_mm })) }));
  const wp = V.wprocs.filter(x => x.wps_id == w.id).map(x => pAws(x.proceso_id)).filter(Boolean);
  return R_.validarWPS({ ...w, sistema: sist(w.norma_id) }, pqrs, wp);
}
const NIV = { ok: '✔', aviso: '⚠', error: '✖' };

/* ---------- botones extra en listados ---------- */
E.pqr.extra = r => `<button class="sm" data-act="rangos" data-id="${r.id}">Rangos</button> <button class="sm" data-act="ficha" data-id="${r.id}">Ficha</button>`;
E.wps.extra = r => `<button class="sm" data-act="validar" data-id="${r.id}">Validar</button> <button class="sm" data-act="ficha" data-id="${r.id}">Ficha</button>`;
E.wpq.extra = r => `<button class="sm" data-act="rangos" data-id="${r.id}">Rangos</button> <button class="sm" data-act="cont" data-id="${r.id}">Continuidad</button> <button class="sm" data-act="ficha" data-id="${r.id}">Ficha</button>`;

/* ================= 1 · Rangos de cualificación ================= */
function rangosHtml(titulo, r, extra) {
  return `<h3>${esc(titulo)}</h3><table>${r.items.map(([k, v]) => `<tr><th style="width:36%">${esc(k)}</th><td style="white-space:normal">${esc(v)}</td></tr>`).join('')}</table>
  ${extra || ''}${r.notas.length ? `<div class="sug" style="margin-top:10px">${r.notas.map(n => `<div style="cursor:default">· ${esc(n)}</div>`).join('')}</div>` : ''}
  <div class="hint" style="margin-top:8px">Valores orientativos según tablas de la norma (ASME IX 2015 / EN ISO 15614-1 / EN ISO 9606-1). Verifica con la edición vigente.</div>
  <div class="foot"><button data-close>Cerrar</button></div>`;
}
ACTS.rangos = async (ent, row) => {
  if (ent.table === 'pqr') {
    const procs = await procsPQR(row.id), s = sist(row.norma_id), r = R_.pqrRangos(row, procs, s);
    const ed = s === 'ASME' && procs.length ? `<div style="margin-top:10px"><div class="hint">Espesor depositado por proceso (mm) — limita el espesor de depósito (QW-451):</div>${procs.map(p => `<label style="display:inline-block;margin-right:10px">${esc(p.aws || p.iso)} <input style="width:90px" type="number" step="any" data-t="${p.rowid}" value="${p.t_dep ?? ''}"></label>`).join('')}<button id="savet">Guardar y recalcular</button></div>` : '';
    showModal(rangosHtml(`Rangos del PQR ${row.codigo} (${s})`, r, ed));
    const b = $('#savet'); if (b) b.onclick = async () => { for (const i of document.querySelectorAll('[data-t]')) await DB.update('pqr_procesos', Number(i.dataset.t), { espesor_depositado_mm: i.value === '' ? null : Number(i.value) }); ACTS.rangos(ent, row); };
  } else {
    const s = sist(row.norma_id), r = R_.wpqRangos({ ...row, proceso_txt: pAws(row.proceso_id) }, s);
    showModal(rangosHtml(`Rangos de la WPQ ${row.numero} · ${lbl('soldadores', row.soldador_id)} (${s})`, r));
  }
};

/* ================= 1b · Validación WPS ↔ PQR ================= */
ACTS.validar = async (ent, w, b) => {
  w = w || L.wps.find(x => x.id == b.dataset.id);
  const V = await loadVal(), v = validarWPS(w, V);
  showModal(`<h3>Validación de ${esc(w.codigo)} ${badge(v.estado)}</h3>${v.items.map(i => `<div style="padding:4px 0">${NIV[i.nivel] || '·'} ${esc(i.msg)}</div>`).join('')}<div class="hint" style="margin-top:8px">Se evalúa la unión de rangos de los PQR enlazados (material, espesor, tipo, impacto, PWHT y procesos).</div><div class="foot"><button data-close>Cerrar</button></div>`);
};
VIEWS.validacion = async () => {
  const V = await loadVal(); const rows = L.wps.map(w => ({ w, v: validarWPS(w, V) }));
  const cnt = k => rows.filter(x => x.v.estado === k).length; let filt = '';
  $('#main').innerHTML = `${DEMO ? demoBanner() : ''}<div class="top"><h2>Validación de WPS <span class="hint">(${rows.length})</span></h2><select id="vf" style="max-width:180px"><option value="">Todos</option><option value="error">Con errores (${cnt('error')})</option><option value="aviso">Con avisos (${cnt('aviso')})</option><option value="ok">Correctos (${cnt('ok')})</option></select><button data-act="export">Excel</button></div><div class="card" id="tbl"></div>`;
  E.__val = rows;
  const draw = () => { $('#tbl').innerHTML = `<table><tr><th>WPS</th><th>Rev</th><th>Norma</th><th>Estado</th><th>Resultado</th><th></th></tr>${rows.filter(x => !filt || x.v.estado === filt).map(x => `<tr><td><b>${esc(x.w.codigo)}</b></td><td>${esc(x.w.revision)}</td><td>${esc(lbl('normas', x.w.norma_id))}</td><td>${badge(x.v.estado)}</td><td style="white-space:normal">${esc((x.v.items.find(i => i.nivel === 'error') || x.v.items.find(i => i.nivel === 'aviso') || x.v.items[0] || {}).msg || '')}</td><td class="act"><button class="sm" data-act="validar" data-id="${x.w.id}">Detalle</button></td></tr>`).join('')}</table>`; };
  $('#vf').onchange = e => { filt = e.target.value; draw(); }; draw();
};

/* ================= 2 · Vigilancia de WPQ y continuidad ================= */
async function estadosWPQ() {
  const regs = await DB.listSafe('wpq_continuidad');
  return L.wpq.map(w => ({ w, e: R_.estadoWPQ(w, regs.filter(r => r.wpq_id == w.id), sist(w.norma_id)), regs: regs.filter(r => r.wpq_id == w.id) }));
}
const EST = { ok: ['ok', 'vigente'], proxima: ['warn', '< 60 días'], critica: ['bad', '< 30 días'], vencida: ['bad', 'vencida'], 'sin-datos': ['borrador', 'sin datos'] };
VIEWS.vigilancia = async () => {
  const rows = (await estadosWPQ()).sort((a, b) => (a.e.dias ?? 1e9) - (b.e.dias ?? 1e9));
  const k = x => rows.filter(r => r.e.estado === x).length;
  $('#main').innerHTML = `${DEMO ? demoBanner() : ''}<div class="top"><h2>Vigilancia de WPQ</h2><button data-act="export">Excel</button></div>
  <div class="kpis"><div class="kpi"><b>${k('vencida')}</b>Vencidas</div><div class="kpi"><b>${k('critica')}</b>&lt; 30 días</div><div class="kpi"><b>${k('proxima')}</b>&lt; 60 días</div><div class="kpi"><b>${k('ok')}</b>Vigentes</div></div>
  <div class="card"><table><tr><th>Soldador</th><th>WPQ</th><th>Norma</th><th>Proceso</th><th>Última actividad</th><th>Próximo vencimiento</th><th>Motivo</th><th>Días</th><th>Estado</th><th></th></tr>${rows.map(({ w, e }) => `<tr><td>${esc(lbl('soldadores', w.soldador_id))}</td><td>${esc(w.numero)}</td><td>${esc(lbl('normas', w.norma_id))}</td><td>${esc(lbl('procesos', w.proceso_id))}</td><td>${esc(e.ultimo)}</td><td>${esc(e.due)}</td><td>${esc(e.motivo)}</td><td>${e.dias ?? ''}</td><td>${badge(...EST[e.estado])}</td><td class="act"><button class="sm" data-act="cont" data-id="${w.id}">Historial</button></td></tr>`).join('') || '<tr><td colspan=10 class="hint">Sin WPQ.</td></tr>'}</table></div>
  <p class="hint">ASME IX: caduca si el soldador no suelda con el proceso en 6 meses (QW-322.1). EN ISO 9606-1: validez 3 años y confirmación del empleador cada 6 meses. Registra la actividad en «Historial».</p>`;
  E.__vig = rows;
};
ACTS.cont = async (ent, w, b) => {
  w = w || L.wpq.find(x => x.id == b.dataset.id);
  const s = sist(w.norma_id), regs = (await DB.where('wpq_continuidad', 'wpq_id', w.id)).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  const e = R_.estadoWPQ(w, regs, s);
  showModal(`<h3>Continuidad · ${esc(w.numero)} · ${esc(lbl('soldadores', w.soldador_id))} ${badge(...EST[e.estado])}</h3>
  <div class="hint">${(e.fechas || []).map(f => esc(f.k) + ': <b>' + esc(f.d) + '</b>').join(' · ')}</div>
  <div class="card" style="margin:10px 0"><table><tr><th>Fecha</th><th>Tipo</th><th>Firmado por</th><th>Notas</th><th></th></tr>${regs.map(r => `<tr><td>${esc(r.fecha)}</td><td>${esc(r.tipo)}</td><td>${esc(r.firmado_por)}</td><td>${esc(r.notas)}</td><td class="act"><button class="sm del" data-rm="${r.id}">✕</button></td></tr>`).join('') || '<tr><td colspan=5 class="hint">Sin registros.</td></tr>'}</table></div>
  <div class="grid"><label>Fecha<input type="date" id="cf" value="${hoyISO()}"></label><label>Tipo<select id="ct"><option value="actividad">Actividad con el proceso</option><option value="confirmacion_6m">Confirmación 6 meses</option><option value="revalidacion">Revalidación</option></select></label><label>Firmado por<input id="cs"></label><label>Notas<input id="cn"></label></div>
  <div class="foot"><button data-close>Cerrar</button><button class="pri" id="cadd">Añadir registro</button></div>`);
  $('#cadd').onclick = async () => { await DB.insert('wpq_continuidad', { wpq_id: w.id, fecha: $('#cf').value, tipo: $('#ct').value, firmado_por: $('#cs').value || null, notas: $('#cn').value || null }); toast('Registrado'); ACTS.cont(ent, w); if (CUR === 'vigilancia') VIEWS.vigilancia(); };
  document.querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => { await DB.remove('wpq_continuidad', Number(b.dataset.rm)); ACTS.cont(ent, w); });
};

/* ================= 3 · Importar / Exportar ================= */
const _s = v => { if (v == null) return null; v = String(v).trim(); return v || null; };
const _num = v => { if (v == null) return null; if (typeof v === 'number') return v; const m = String(v).match(/-?\d+(?:[.,]\d+)?/); return m ? Number(m[0].replace(',', '.')) : null; };
const _lim = v => { const t = _s(v); return t == null || t.toLowerCase() === 'all' ? null : _num(t); };
const _sino = v => ['SI', 'SÍ', 'YES', 'TRUE'].includes(String(v ?? '').trim().toUpperCase());
const _imp = v => { const t = _s(v); return t == null || t.toUpperCase() === 'NO' ? null : _num(t); };
const _tipo = v => (String(v || '').trim().toUpperCase().startsWith('FIL') ? 'filete' : 'penetracion');
const _gr = v => { const t = _s(v); return t ? t.replace(/_/g, ',') : null; };
const _rev = v => { const m = String(v ?? '').match(/\d+/); return m ? Number(m[0]) : 0; };
function planImport(wb) {
  const aviso = [], nid = c => (L.normas.find(n => n.codigo === c) || {}).id;
  const N = { asme: nid('ASME IX'), pqrIso: nid('EN ISO 15614-1'), wpsIso: nid('EN ISO 15609-1') };
  if (!N.asme || !N.pqrIso || !N.wpsIso) throw new Error('Faltan las normas base. Ejecuta sql/03_seed_catalogos.sql en Supabase.');
  const pid = (txt, tabla) => String(txt ?? '').split(/[+/ ]+/).map(s => s.trim().toUpperCase()).filter(Boolean).map(p => { const r = L.procesos.find(x => (tabla === 'aws' ? x.codigo_aws : x.codigo_iso) === p.replace(/\.0$/, '')); if (!r) aviso.push(`Proceso desconocido '${p}'`); return r && r.id; }).filter(Boolean);
  const rows = n => { const ws = wb.Sheets[n]; return ws ? XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }).filter(r => r[0] != null && String(r[0]).trim()) : []; };
  const pqr = [], wps = [], seenP = new Set(), seenW = new Set();
  const addPQR = (n, cod, rec, procs) => { const k = n + '|' + cod; if (seenP.has(k)) { aviso.push(`PQR duplicado: ${cod}`); return; } seenP.add(k); pqr.push({ ...rec, codigo: cod, norma_id: n, revision: 0, estado: 'aprobado', _procs: procs }); };
  for (const h of ['PQR', 'PQR-2']) for (const r of rows(h)) { const cod = _s(r[0]); if (cod.toUpperCase() === 'PQR') continue; addPQR(N.asme, cod, { tipo: _tipo(r[10]), espesor_mm: _lim(r[6]), p_no_1: _s(r[1]), group_1: _gr(r[2]), p_no_2: _s(r[3]), group_2: _gr(r[4]), clase_material: _s(r[5]), precalentamiento_c: _num(r[7]), precalentamiento_txt: _s(r[7]), pwht: _sino(r[9]), impacto_temp_c: _imp(r[8]), observaciones: _s(r[12]) }, pid(r[11], 'aws')); }
  for (const r of rows('PQR-EN')) { const cod = _s(r[0]); if (cod.toUpperCase() === 'PQR') continue; addPQR(N.pqrIso, cod, { tipo: _tipo(r[7]), espesor_mm: _lim(r[5]), grupo_iso_1: _s(r[1]), grupo_iso_2: _s(r[3]), observaciones: _s(r[9]) }, pid(r[8], 'iso')); }
  const refs = (norma, ref, cod) => {
    const out = []; if (!ref) { aviso.push(`WPS sin PQR: ${cod}`); return out; } let base = null;
    for (const t of ref.split(/\s*(?:\+|,|\sy\s)\s*/).map(x => x.trim()).filter(Boolean)) {
      const m = t.match(/^(F\d+[A-Z]?R?)/i); if (m) base = m[1];
      const codes = pqr.filter(p => p.norma_id === norma).map(p => p.codigo);
      let cand; if (/^sup/i.test(t)) cand = codes.filter(c => base && c.toUpperCase().startsWith(base.toUpperCase()) && c.toUpperCase().includes('SUP')); else if (codes.includes(t)) cand = [t]; else cand = codes.filter(c => c.toUpperCase().startsWith(t.toUpperCase()));
      if (!cand.length) { aviso.push(`WPS ${cod}: PQR '${t}' no encontrado`); continue; }
      if (/sup/i.test(t) && cand.length > 1) { aviso.push(`WPS ${cod}: '${t}' ambiguo → no enlazado, asignar a mano`); continue; }
      out.push(...cand.map(c => [norma, c]));
    } return out;
  };
  for (const r of rows('WPS')) { const cod = _s(r[0]); if (cod.toUpperCase() === 'WPS') continue; const rev = _rev(r[15]); if (seenW.has(cod + rev)) { aviso.push(`WPS duplicado: ${cod}`); continue; } seenW.add(cod + rev); const ref = _s(r[14]); wps.push({ codigo: cod, norma_id: N.asme, revision: rev, estado: 'aprobado', tipo: _tipo(r[12]), p_no_1: _s(r[1]), group_1: _gr(r[2]), p_no_2: _s(r[3]), group_2: _gr(r[4]), clase_material: _s(r[5]), esp_min_mm: _lim(r[6]), esp_max_mm: _lim(r[7]), arqueo_resanado: _sino(r[8]), precalentamiento_min_c: _num(r[9]), precalentamiento_txt: _s(r[9]), impacto_temp_c: _imp(r[10]), pwht: _sino(r[11]), pqr_ref_txt: ref, observaciones: _s(r[16]), _procs: pid(r[13], 'aws'), _links: refs(N.asme, ref || cod.split('/')[0].trim(), cod) }); }
  for (const r of rows('WPS-EN')) { const cod = _s(r[0]); if (cod.toUpperCase() === 'WPS') continue; const rev = _rev(r[13]); if (seenW.has('EN' + cod + rev)) { aviso.push(`WPS-EN duplicado: ${cod}`); continue; } seenW.add('EN' + cod + rev); const ref = _s(r[12]); wps.push({ codigo: cod, norma_id: N.wpsIso, revision: rev, estado: 'aprobado', tipo: _tipo(r[10]), grupo_iso_1: _s(r[2]) || _s(r[1]), grupo_iso_2: _s(r[4]) || _s(r[3]), esp_min_mm: _lim(r[5]), esp_max_mm: _lim(r[6]), arqueo_resanado: _sino(r[7]), precalentamiento_min_c: _num(r[8]), precalentamiento_txt: _s(r[8]), pwht: _sino(r[9]), pqr_ref_txt: ref, observaciones: _s(r[14]), _procs: pid(r[11], 'iso'), _links: refs(N.pqrIso, ref, cod) }); }
  const exP = new Set(L.pqr.map(p => p.norma_id + '|' + p.codigo)), exW = new Set(L.wps.map(w => w.norma_id + '|' + w.codigo + '|' + w.revision));
  return { pqr: pqr.filter(p => !exP.has(p.norma_id + '|' + p.codigo)), wps: wps.filter(w => !exW.has(w.norma_id + '|' + w.codigo + '|' + w.revision)), pqrAll: pqr, aviso, saltados: { pqr: pqr.filter(p => exP.has(p.norma_id + '|' + p.codigo)).length, wps: wps.filter(w => exW.has(w.norma_id + '|' + w.codigo + '|' + w.revision)).length } };
}
async function ejecutarImport(plan) {
  const idP = {}; L.pqr.forEach(p => { idP[p.norma_id + '|' + p.codigo] = p.id; });
  const P = [], PP = [], W = [], WP = [], WL = [];
  for (const p of plan.pqr) { const { _procs, ...rec } = p; rec.id = uuid(); idP[p.norma_id + '|' + p.codigo] = rec.id; P.push(rec); _procs.forEach((pr, i) => PP.push({ pqr_id: rec.id, orden: i + 1, proceso_id: pr })); }
  for (const w of plan.wps) { const { _procs, _links, ...rec } = w; rec.id = uuid(); W.push(rec); _procs.forEach((pr, i) => WP.push({ wps_id: rec.id, orden: i + 1, proceso_id: pr })); const seen = new Set(); _links.forEach(([n, c]) => { const id = idP[n + '|' + c]; if (id && !seen.has(id)) { seen.add(id); WL.push({ wps_id: rec.id, pqr_id: id }); } }); }
  await DB.bulk('pqr', P); await DB.bulk('pqr_procesos', PP); await DB.bulk('wps', W); await DB.bulk('wps_procesos', WP); await DB.bulk('wps_pqr', WL);
  return { pqr: P.length, wps: W.length, links: WL.length };
}
const xlsxOk = () => { if (typeof XLSX === 'undefined') { toast('No se cargó la librería de Excel (vendor/xlsx.full.min.js)', true); return false; } return true; };
function dlXlsx(nombre, hojas) { if (!xlsxOk()) return; const wb = XLSX.utils.book_new(); Object.entries(hojas).forEach(([n, rows]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), n.slice(0, 31))); XLSX.writeFile(wb, nombre + '.xlsx'); }
function rowsLegibles(ent, rows) {
  return rows.map(r => { const o = {}; (ent.fields || []).forEach(fd => { let v = r[fd.k]; if (fd.lookup) v = lbl(fd.lookup, v); else if (typeof v === 'boolean') v = v ? 'Sí' : 'No'; o[fd.l] = v; }); return o; });
}
ACTS.export = async () => {
  if (CUR === 'validacion') return dlXlsx('validacion_wps', { Validacion: (E.__val || []).map(x => ({ WPS: x.w.codigo, Rev: x.w.revision, Estado: x.v.estado, Detalle: x.v.items.map(i => NIV[i.nivel] + ' ' + i.msg).join(' | ') })) });
  if (CUR === 'vigilancia') return dlXlsx('vigilancia_wpq', { WPQ: (E.__vig || []).map(({ w, e }) => ({ Soldador: lbl('soldadores', w.soldador_id), WPQ: w.numero, Proceso: lbl('procesos', w.proceso_id), 'Última actividad': e.ultimo, Vencimiento: e.due, Motivo: e.motivo, Días: e.dias, Estado: e.estado })) });
  if (CUR === 'end' && E.__end) { const { js, P, ultimo } = E.__end; return dlXlsx('plan_END', { 'Plan END': js.map(j => { const o = { Junta: lbl('juntas', j.id), Tipo: j.tipo }; ENDS.forEach(x => { const p = P.find(q => q.junta_id == j.id && q.tipo === x), r = ultimo(j.id, x); o[x] = p || r ? (r ? (r.conforme ? 'conforme' : 'NO CONFORME') : 'pendiente') : ''; }); return o; }) }); }
  const ent = E[CUR]; if (!ent) return; const rows = ent._rows || await DB.list(ent.table, ent.order); dlXlsx(ent.title.toLowerCase().replace(/\s+/g, '_'), { [ent.title]: rowsLegibles(ent, rows) });
};
VIEWS.io = async () => {
  $('#main').innerHTML = `${DEMO ? demoBanner() : ''}<div class="top"><h2>Importar / Exportar</h2></div>
  <div class="card" style="padding:16px;margin-bottom:14px"><h3 style="margin-top:0">Importar Excel de WPS/PQR</h3>
    <p class="hint">Formato del libro WELDING_BOOK_DESARROLLO.xlsx (hojas WPS, PQR, PQR-2, WPS-EN, PQR-EN). Se omiten los registros que ya existen (mismo código, norma y revisión).</p>
    <input type="file" id="xin" accept=".xlsx,.xls"><div id="xprev" style="margin-top:10px"></div></div>
  <div class="card" style="padding:16px"><h3 style="margin-top:0">Exportar y copia de seguridad</h3>
    <button id="xall" class="pri">Excel con todas las tablas</button> <button id="xjson">Copia de seguridad (JSON)</button>
    <p class="hint">También puedes exportar cualquier listado con el botón «Excel» de su cabecera, y generar fichas PDF de cada WPS, PQR y WPQ con «Ficha».</p></div>`;
  $('#xin').onchange = async ev => {
    const f = ev.target.files[0]; if (!f || !xlsxOk()) return;
    try {
      await loadLookups(); const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' }); const plan = planImport(wb);
      $('#xprev').innerHTML = `<div>Nuevos: <b>${plan.pqr.length}</b> PQR y <b>${plan.wps.length}</b> WPS · ya existentes (omitidos): ${plan.saltados.pqr} PQR, ${plan.saltados.wps} WPS</div>${plan.aviso.length ? `<details><summary>${plan.aviso.length} avisos</summary><div class="sug" style="max-height:200px;overflow:auto">${plan.aviso.map(a => `<div style="cursor:default">· ${esc(a)}</div>`).join('')}</div></details>` : ''}<button class="pri" id="xgo" style="margin-top:8px">Importar ahora</button>`;
      $('#xgo').onclick = async () => { $('#xgo').disabled = true; try { const r = await ejecutarImport(plan); await reloadAll(); toast(`Importados ${r.pqr} PQR, ${r.wps} WPS y ${r.links} enlaces`); $('#xprev').innerHTML = `<b>Importación completada:</b> ${r.pqr} PQR, ${r.wps} WPS, ${r.links} enlaces WPS↔PQR.`; } catch (e) { toast(e.message, true); $('#xgo').disabled = false; } };
    } catch (e) { toast(e.message || String(e), true); }
  };
  $('#xall').onclick = async () => { const h = {}; for (const k of ['pqr', 'wps', 'wpq', 'soldadores', 'materiales', 'consumibles', 'proyectos']) h[E[k].title] = rowsLegibles(E[k], await DB.list(E[k].table, E[k].order)); dlXlsx('WMAP_export_' + hoyISO(), h); };
  $('#xjson').onclick = async () => { const T = ['normas', 'procesos', 'materiales', 'consumibles', 'pqr', 'pqr_procesos', 'wps', 'wps_procesos', 'wps_pqr', 'soldadores', 'wpq', 'wpq_continuidad', 'proyectos', 'equipos', 'juntas', 'welding_books', 'welding_book_equipos', 'registro_soldadura', 'end_plan', 'end_resultados', 'ajustes']; const d = {}; for (const t of T) d[t] = await DB.listSafe(t); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d)], { type: 'application/json' })); a.download = 'WMAP_backup_' + hoyISO() + '.json'; a.click(); };
};

/* ================= Fichas imprimibles (WPS / PQR / WPQ) ================= */
function printHtml(html) { $('#print').innerHTML = html; setTimeout(() => window.print(), 250); }
const valCampo = (fd, v) => (fd.lookup ? lbl(fd.lookup, v) : typeof v === 'boolean' ? (v ? 'Sí' : 'No') : fd.k === 'tipo' ? (v === 'filete' ? 'Filete' : v === 'penetracion' ? 'Penetración' : v) : v);
const hdrHtml = (aj, titulo) => `<div class="hdr">${aj.logo ? `<img src="${aj.logo}">` : ''}<b>${esc(aj.empresa || '')}</b><span>${esc(titulo)}</span></div>`;
ACTS.ficha = async (ent, row) => {
  const aj = await getAj(), s = sist(row.norma_id); let extra = '';
  const campos = ent.fields.map(fd => [fd.l, valCampo(fd, row[fd.k])]).filter(([, v]) => v != null && v !== '');
  const tabla = `<table class="meta">${chunk(campos, 2).map(p => `<tr>${p.map(([k, v]) => `<td>${esc(k)}</td><td>${esc(v)}</td>`).join('') + (p.length < 2 ? '<td></td><td></td>' : '')}</tr>`).join('')}</table>`;
  if (ent.table === 'pqr') {
    const procs = await procsPQR(row.id), r = R_.pqrRangos(row, procs, s);
    extra = `<h2>Procesos</h2><table><tr><th>#</th><th>Proceso</th><th>Espesor depositado (mm)</th></tr>${procs.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.aws)} (${esc(p.iso)})</td><td>${esc(p.t_dep)}</td></tr>`).join('')}</table><h2>Rangos de cualificación</h2><table class="meta">${r.items.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>`;
  } else if (ent.table === 'wps') {
    const V = await loadVal(), v = validarWPS(row, V), procs = V.wprocs.filter(x => x.wps_id == row.id).sort(byOrden).map(x => lbl('procesos', x.proceso_id)), pq = V.wp.filter(x => x.wps_id == row.id).map(x => lbl('pqr', x.pqr_id));
    extra = `<h2>Procesos y PQR de soporte</h2><table class="meta"><tr><td>Procesos</td><td>${esc(procs.join(' + '))}</td></tr><tr><td>PQR</td><td>${esc(pq.join(' · ') || row.pqr_ref_txt || '—')}</td></tr></table><h2>Validación contra PQR: ${esc(v.estado.toUpperCase())}</h2><table>${v.items.map(i => `<tr><td>${NIV[i.nivel]}</td><td>${esc(i.msg)}</td></tr>`).join('')}</table>`;
  } else if (ent.table === 'wpq') {
    const r = R_.wpqRangos({ ...row, proceso_txt: pAws(row.proceso_id) }, s), regs = (await DB.where('wpq_continuidad', 'wpq_id', row.id)).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))), e = R_.estadoWPQ(row, regs, s);
    extra = `<h2>Rango de cualificación</h2><table class="meta">${r.items.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table><h2>Continuidad · próximo vencimiento ${esc(e.due)} (${esc(e.motivo)})</h2><table><tr><th>Fecha</th><th>Tipo</th><th>Firmado por</th></tr>${regs.map(x => `<tr><td>${esc(x.fecha)}</td><td>${esc(x.tipo)}</td><td>${esc(x.firmado_por)}</td></tr>`).join('')}</table>`;
  }
  const id = row.codigo || row.numero;
  printHtml(`<div class="pg">${hdrHtml(aj, `${ent.title} ${id}${row.revision != null ? ' · Rev. ' + row.revision : ''} · ${s === 'ISO' ? 'EN ISO' : 'ASME IX'}`)}${tabla}${extra}<table class="meta" style="margin-top:14px"><tr><td>Elaborado</td><td></td><td>Revisado</td><td></td><td>Aprobado</td><td></td></tr></table><div class="pie">${esc(aj.pie || '')}</div></div>`);
};

/* ================= 4 · Welding book: ajustes, revisiones, impresión con cajetín ================= */
VIEWS.ajustes = async () => {
  const aj = await getAj();
  $('#main').innerHTML = `${DEMO ? demoBanner() : ''}<div class="top"><h2>Ajustes</h2></div><div class="card" style="padding:16px;max-width:620px"><div class="grid">
    <label class="w2">Empresa / título de cabecera<input id="a_emp" value="${esc(aj.empresa || '')}"></label>
    <label class="wall">Pie de página (confidencialidad)<textarea id="a_pie" rows="2">${esc(aj.pie || '')}</textarea></label>
    <label class="wall">Logotipo (PNG/JPG)<input type="file" id="a_logo" accept="image/*"></label></div>
    <div id="a_prev" style="margin:10px 0">${aj.logo ? `<img src="${aj.logo}" style="max-height:50px">` : '<span class="hint">Sin logotipo</span>'}</div>
    <div class="foot"><button class="pri" id="a_save">Guardar</button></div></div><p class="hint">El logotipo y los textos se imprimen en el cabecero y cajetín de fichas y welding books.</p>`;
  let logo = aj.logo || null;
  $('#a_logo').onchange = ev => { const f = ev.target.files[0]; if (!f) return; const img = new Image(), rd = new FileReader(); rd.onload = () => { img.onload = () => { const k = Math.min(1, 300 / img.width), c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); logo = c.toDataURL('image/png'); $('#a_prev').innerHTML = `<img src="${logo}" style="max-height:50px">`; }; img.src = rd.result; }; rd.readAsDataURL(f); };
  $('#a_save').onclick = async () => { try { AJ = { empresa: $('#a_emp').value, pie: $('#a_pie').value, logo }; await DB.upsert('ajustes', { id: 'empresa', valor: AJ }); toast('Guardado'); } catch (e) { toast(e.message, true); } };
};
ACTS.nuevarev = async (ent, row) => {
  const d = prompt(`Nueva revisión de ${row.numero_doc} (rev. ${row.revision} → ${row.revision + 1}). Descripción del cambio:`, ''); if (d === null) return;
  const nuevo = { ...row }; delete nuevo.id; nuevo.revision = (row.revision || 0) + 1; nuevo.estado = 'borrador'; nuevo.descripcion_rev = d; nuevo.fecha = hoyISO();
  const n = await DB.insert('welding_books', nuevo); let eqs = []; try { eqs = await DB.where('welding_book_equipos', 'welding_book_id', row.id); } catch (e) { }
  await DB.bulk('welding_book_equipos', eqs.map(x => ({ welding_book_id: n.id, equipo_id: x.equipo_id, orden: x.orden })));
  await DB.update('welding_books', row.id, { estado: 'obsoleto' }); toast('Revisión creada; la anterior queda como obsoleta'); go(CUR);
};
const cajHtml = (wb, aj, n, N) => `<div class="caj"><table><tr><td>${esc(aj.empresa || '')}</td><td>WELDING BOOK</td><td>Doc. ${esc(wb.numero_doc)}</td><td>Rev. ${esc(wb.revision)}</td><td>Dibujado: ${esc(wb.dibujado)}</td><td>Revisado: ${esc(wb.revisado)}</td><td>Aprobado: ${esc(wb.aprobado)}</td><td>${esc(wb.fecha)}</td><td>Hoja ${n} de ${N}</td></tr></table><div class="pie">${esc(aj.pie || '')}</div></div>`;
async function imprimirDocumento(bookId) {
  const aj = await getAj(), wb = (await DB.list('welding_books')).find(b => b.id == bookId), pr = L.proyectos.find(p => p.id == wb.proyecto_id) || {};
  let sel = []; try { sel = (await DB.where('welding_book_equipos', 'welding_book_id', bookId)).sort(byOrden).map(x => x.equipo_id); } catch (e) { }
  const todos = await DB.where('equipos', 'proyecto_id', wb.proyecto_id);
  const eqs = sel.length ? sel.map(id => todos.find(e => e.id == id)).filter(Boolean) : todos.sort((a, b) => String(a.item).localeCompare(String(b.item), 'es', { numeric: true }));
  const mat = id => { const m = L.materiales.find(x => x.id == id); return m ? `${m.especificacion} ${m.grado || ''}` : ''; };
  const head = `Document No.: ${esc(wb.numero_doc)} · Rev.: ${esc(wb.revision)}`, pages = [], wpsUsados = new Set();
  pages.push(`<h1>WELDING BOOK</h1><table class="meta cover"><tr><td>DOCUMENT</td><td>WELDING BOOK</td></tr><tr><td>CLIENT</td><td>${esc(pr.cliente)}</td></tr><tr><td>PROJECT</td><td>${esc(pr.proyecto)}</td></tr><tr><td>PURCHASE ORDER</td><td>${esc(pr.pedido)}</td></tr><tr><td>REFERENCE</td><td>${esc(pr.referencia)}</td></tr><tr><td>ITEMS</td><td>${esc(eqs.map(e => e.item).join(', '))}</td></tr><tr><td>LOCATION</td><td>${esc(pr.ubicacion)}</td></tr><tr><td>DOC. Nº / REV.</td><td>${esc(wb.numero_doc)} / ${esc(wb.revision)}</td></tr><tr><td>REV. DESCRIPTION</td><td>${esc(wb.descripcion_rev)}</td></tr></table>`);
  const th = `<tr><th>JOINT</th><th colspan=4>PART 1 (descr · OD · spec · th)</th><th colspan=4>PART 2 (descr · OD · spec · th)</th><th>TYPE</th><th>a</th><th>b</th><th>c</th><th>PROCESS</th><th>W.P.S.</th></tr>`;
  for (const eq of eqs) {
    const js = (await DB.where('juntas', 'equipo_id', eq.id)).sort((a, b) => String(a.marca).localeCompare(String(b.marca), 'es', { numeric: true }));
    js.forEach(j => j.wps_id && wpsUsados.add(j.wps_id));
    chunk(js, 14).forEach((c, i, all) => pages.push(`<h2>LIST OF PIECES TO BE WELDED — ITEM Nº ${esc(eq.item)}${all.length > 1 ? ` (${i + 1}/${all.length})` : ''} · ${head}</h2><table>${th}${c.map(j => `<tr><td>${esc(j.marca)}</td><td>${esc(j.pieza1_desc)}</td><td>${esc(j.pieza1_od)}</td><td>${esc(mat(j.pieza1_material_id))}</td><td>${esc(j.pieza1_esp_mm)}</td><td>${esc(j.pieza2_desc)}</td><td>${esc(j.pieza2_od)}</td><td>${esc(mat(j.pieza2_material_id))}</td><td>${esc(j.pieza2_esp_mm)}</td><td>${j.tipo === 'filete' ? 'Fillet' : 'BW'}</td><td>${esc(j.garganta_a)}</td><td>${esc(j.garganta_b)}</td><td>${esc(j.garganta_c)}</td><td>${esc(j.procesos)}</td><td>${esc(lbl('wps', j.wps_id))}</td></tr>`).join('')}</table>`));
    pages.push(`<h2>WELDING MAP WITH JOINT MARKS — ITEM Nº ${esc(eq.item)} · ${head}</h2><div style="display:flex;gap:14px;align-items:flex-start"><table class="meta" style="width:42%"><tr><td>Code</td><td>${esc(eq.codigo_diseno)}</td></tr><tr><td>Design Pressure</td><td>${esc(eq.presion_diseno)}</td></tr><tr><td>Radiography</td><td>${esc(eq.radiografia)}</td></tr><tr><td>Joint efficiency</td><td>${esc(eq.eficiencia_junta)}</td></tr><tr><td>Corrosion allowance (mm)</td><td>${esc(eq.sobreespesor_corrosion_mm)}</td></tr><tr><td>Post weld heat treatment</td><td>${eq.pwht ? 'Yes' : 'No'}</td></tr><tr><td>Hardness</td><td>${eq.dureza ? 'Yes' : 'No'}</td></tr><tr><td>Impact test (ºC)</td><td>${esc(eq.resiliencia_c ?? 'No')}</td></tr><tr><td>Service</td><td>${esc(eq.servicio)}</td></tr></table>${eq.croquis ? `<div class="croquis" style="flex:1;text-align:center"><img src="${eq.croquis}">${js.filter(j => j.mapa_x != null).map(j => `<span class="pin" style="left:${j.mapa_x * 100}%;top:${j.mapa_y * 100}%">${esc(j.marca)}</span>`).join('')}</div>` : ''}</div>`);
  }
  if (wpsUsados.size) {
    const V = await loadVal(), ws = [...wpsUsados].map(id => L.wps.find(w => w.id == id)).filter(Boolean).sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
    chunk(ws, 14).forEach((c, i, all) => pages.push(`<h2>ANNEX · WELDING PROCEDURE SPECIFICATIONS USED${all.length > 1 ? ` (${i + 1}/${all.length})` : ''} · ${head}</h2><table><tr><th>WPS</th><th>Rev</th><th>Standard</th><th>Materials</th><th>Thickness (mm)</th><th>Processes</th><th>Impact</th><th>PWHT</th><th>PQR</th></tr>${c.map(w => `<tr><td>${esc(w.codigo)}</td><td>${esc(w.revision)}</td><td>${esc(lbl('normas', w.norma_id))}</td><td>${esc(w.p_no_1 ? `P${w.p_no_1}/${w.group_1 || ''} – P${w.p_no_2 || ''}/${w.group_2 || ''}` : `${w.grupo_iso_1 || ''} – ${w.grupo_iso_2 || ''}`)}</td><td>${esc(R_.fmtR(w.esp_min_mm, w.esp_max_mm))}</td><td>${esc(V.wprocs.filter(x => x.wps_id == w.id).sort(byOrden).map(x => pAws(x.proceso_id)).join('+'))}</td><td>${esc(w.impacto_temp_c ?? 'No')}</td><td>${w.pwht ? 'Yes' : 'No'}</td><td>${esc(V.wp.filter(x => x.wps_id == w.id).map(x => lbl('pqr', x.pqr_id).split(' · ')[0]).join(', ') || w.pqr_ref_txt || '')}</td></tr>`).join('')}</table>`));
  }
  printHtml(pages.map((p, i) => `<div class="pg">${hdrHtml(aj, wb.numero_doc + ' · Rev. ' + wb.revision)}${p}${cajHtml(wb, aj, i + 1, pages.length)}</div>`).join(''));
}

/* ================= 5 · Producción: validaciones, avance y calidad ================= */
E.registro_soldadura.check = async vals => {
  const av = [], j = L.juntas.find(x => x.id == vals.junta_id); if (!j) return av;
  if (!j.wps_id) av.push('La junta no tiene WPS asignado.');
  const regs = await DB.listSafe('wpq_continuidad'), ws = L.wpq.filter(w => w.soldador_id == vals.soldador_id);
  const esps = [j.pieza1_esp_mm, j.pieza2_esp_mm].filter(x => x > 0), esp = esps.length ? Math.min(...esps) : null;
  let procs = String(j.procesos || '').split(/[+/ ]+/).map(x => x.trim().toUpperCase()).filter(Boolean);
  if (!procs.length && j.wps_id) procs = (await DB.where('wps_procesos', 'wps_id', j.wps_id)).map(x => pAws(x.proceso_id));
  const wq = ws.map(w => { const s = sist(w.norma_id); return { wpq: w, procAws: pAws(w.proceso_id), estado: R_.estadoWPQ(w, regs.filter(r => r.wpq_id == w.id), s, vals.fecha || undefined).estado, rangos: R_.wpqRangos({ ...w, proceso_txt: pAws(w.proceso_id) }, s) }; });
  const r = R_.soldadorOk(wq, { esp, procesos: procs, tipo: j.tipo });
  if (!r.ok) av.push(...r.motivos);
  if (vals.wpq_id) { const w = L.wpq.find(x => x.id == vals.wpq_id); if (w && w.soldador_id != vals.soldador_id) av.push('La WPQ seleccionada pertenece a otro soldador.'); }
  return av;
};
const bar = (p) => `<div style="background:#e9edf2;border-radius:6px;height:10px;width:120px;display:inline-block;vertical-align:middle"><div style="background:var(--acc);height:10px;border-radius:6px;width:${Math.min(100, p)}%"></div></div> ${Math.round(p)}%`;
VIEWS.avance = async () => {
  const [reg, res] = await Promise.all([DB.listSafe('registro_soldadura'), DB.listSafe('end_resultados')]);
  const nc = new Set(res.filter(r => r.conforme === false).map(r => r.junta_id));
  const filas = L.equipos.map(eq => { const js = L.juntas.filter(j => j.equipo_id == eq.id), hechas = js.filter(j => reg.some(r => r.junta_id == j.id)); return { eq, n: js.length, h: hechas.length, rep: js.filter(j => reg.some(r => r.junta_id == j.id && r.reparacion)).length, nc: js.filter(j => nc.has(j.id)).length, sinwps: js.filter(j => !j.wps_id).length }; });
  const por = {}; reg.forEach(r => { const o = por[r.soldador_id] = por[r.soldador_id] || { j: new Set(), nc: new Set(), rep: 0 }; o.j.add(r.junta_id); if (nc.has(r.junta_id)) o.nc.add(r.junta_id); if (r.reparacion) o.rep++; });
  $('#main').innerHTML = `${DEMO ? demoBanner() : ''}<div class="top"><h2>Avance y calidad</h2></div>
  <h3>Avance por equipo</h3><div class="card"><table><tr><th>Proyecto</th><th>Equipo</th><th>Juntas</th><th>Soldadas</th><th>Avance</th><th>Con reparación</th><th>END no conformes</th><th>Sin WPS</th></tr>${filas.map(f => `<tr><td>${esc(lbl('proyectos', f.eq.proyecto_id))}</td><td><b>${esc(f.eq.item)}</b></td><td>${f.n}</td><td>${f.h}</td><td>${bar(f.n ? 100 * f.h / f.n : 0)}</td><td>${f.rep}</td><td>${f.nc ? badge('bad', f.nc) : 0}</td><td>${f.sinwps ? badge('warn', f.sinwps) : 0}</td></tr>`).join('') || '<tr><td colspan=8 class="hint">Sin equipos.</td></tr>'}</table></div>
  <h3>Calidad por soldador</h3><div class="card"><table><tr><th>Soldador</th><th>Juntas</th><th>END no conformes</th><th>Reparaciones</th><th>% rechazo</th></tr>${Object.entries(por).map(([sid, o]) => `<tr><td>${esc(lbl('soldadores', sid) || sid)}</td><td>${o.j.size}</td><td>${o.nc.size}</td><td>${o.rep}</td><td>${o.j.size ? Math.round(100 * o.nc.size / o.j.size) : 0} %</td></tr>`).join('') || '<tr><td colspan=5 class="hint">Aún no hay registros de soldadura.</td></tr>'}</table></div>`;
};

/* ================= 6 · Plan de END ================= */
const nonMag = m => !!m && (String(m.p_no) === '8' || /^4[1-9]/.test(String(m.p_no || '')));
const ENDS = ['VT', 'RT', 'UT', 'PT', 'MT'];
VIEWS.end = async () => {
  const eqId = window.__endEq && L.equipos.find(e => e.id == window.__endEq) ? window.__endEq : (L.equipos[0] || {}).id; window.__endEq = eqId;
  const eq = L.equipos.find(e => e.id == eqId), js = L.juntas.filter(j => j.equipo_id == eqId).sort((a, b) => String(a.marca).localeCompare(String(b.marca), 'es', { numeric: true }));
  const [plan, res] = await Promise.all([DB.listSafe('end_plan'), DB.listSafe('end_resultados')]); const ids = new Set(js.map(j => j.id));
  const P = plan.filter(p => ids.has(p.junta_id) && p.requerido !== false), Rs = res.filter(r => ids.has(r.junta_id));
  const ultimo = (j, t) => Rs.filter(r => r.junta_id == j && r.tipo === t).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))[0];
  const celda = (j, t) => { const p = P.find(x => x.junta_id == j.id && x.tipo === t), r = ultimo(j.id, t); if (!p && !r) return `<span class="hint" data-add="${j.id}|${t}" style="cursor:pointer">＋</span>`; const ic = r ? (r.conforme ? '✅' : '❌') : '⏳'; return `<span data-res="${j.id}|${t}" style="cursor:pointer" title="Registrar resultado">${ic}</span>${p && !r ? ` <span class="hint" data-del="${p.id}" style="cursor:pointer">✕</span>` : ''}`; };
  const req = P.length, hechos = P.filter(p => ultimo(p.junta_id, p.tipo)).length, ncs = P.filter(p => { const r = ultimo(p.junta_id, p.tipo); return r && !r.conforme; }).length;
  $('#main').innerHTML = `${DEMO ? demoBanner() : ''}<div class="top"><h2>Plan de END</h2><select id="endeq" style="max-width:320px">${L.equipos.map(e => `<option value="${e.id}" ${e.id == eqId ? 'selected' : ''}>${esc(lbl('equipos', e.id))}</option>`).join('') || '<option>(sin equipos)</option>'}</select></div>` + (eq ? `
  <div class="card" style="padding:10px 14px;margin-bottom:12px">Radiografía del equipo: <b>${esc(eq.radiografia || '—')}</b> · Eficiencia: <b>${esc(eq.eficiencia_junta ?? '—')}</b> · Requeridos: <b>${req}</b> · Realizados: <b>${hechos}</b> · No conformes: <b>${ncs}</b></div>
  <div class="top"><label class="hint">% RT por muestreo (si «Spot»)</label><input id="pct" type="number" value="10" style="width:80px"><button class="pri" id="gen">Generar plan desde reglas</button><button data-act="export">Excel</button></div>
  <div class="card"><table><tr><th>Junta</th><th>Tipo</th><th>Material</th>${ENDS.map(t => `<th>${t}</th>`).join('')}</tr>${js.map(j => `<tr><td><b>${esc(j.marca)}</b></td><td>${j.tipo === 'filete' ? 'Filete' : 'A tope'}</td><td>${esc(lbl('materiales', j.pieza1_material_id))}</td>${ENDS.map(t => `<td>${celda(j, t)}</td>`).join('')}</tr>`).join('') || '<tr><td colspan=8 class="hint">El equipo no tiene juntas.</td></tr>'}</table></div>
  <p class="hint">Reglas: VT 100 % en todas las juntas · RT en juntas a tope según «Radiografía» del equipo (Full = 100 %, Spot = % indicado, No = ninguna) · filetes: PT si material no magnético (P-No 8 / níquel), MT si es ferromagnético. Los cambios se pueden ajustar celda a celda (＋ añade, ✕ quita, clic en ⏳ registra resultado). Revisa siempre contra el código de diseño y la especificación del cliente.</p>` : '<p class="hint">Crea equipos y juntas primero.</p>');
  E.__end = { js, P, ultimo, eq };
  $('#endeq').onchange = e => { window.__endEq = e.target.value; VIEWS.end(); };
  if (!eq) return;
  $('#gen').onclick = async () => {
    if (!confirm('Se sustituirá el plan actual de este equipo (los resultados registrados se conservan). ¿Continuar?')) return;
    for (const j of js) await DB.removeWhere('end_plan', 'junta_id', j.id);
    const rows = [], bw = js.filter(j => j.tipo !== 'filete'), rad = String(eq.radiografia || '').toLowerCase(), pct = Number($('#pct').value) || 10;
    let rtSet = new Set(); if (rad.startsWith('full')) bw.forEach(j => rtSet.add(j.id)); else if (rad.startsWith('spot')) { const n = Math.max(1, Math.ceil(bw.length * pct / 100)); for (let i = 0; i < n && bw.length; i++) rtSet.add(bw[Math.floor(i * bw.length / n)].id); }
    js.forEach(j => { rows.push({ junta_id: j.id, tipo: 'VT', requerido: true }); if (rtSet.has(j.id)) rows.push({ junta_id: j.id, tipo: 'RT', requerido: true }); if (j.tipo === 'filete') rows.push({ junta_id: j.id, tipo: nonMag(L.materiales.find(m => m.id == j.pieza1_material_id)) ? 'PT' : 'MT', requerido: true }); });
    await DB.bulk('end_plan', rows.map(r => ({ id: uuid(), ...r }))); toast(`Plan generado: ${rows.length} ensayos`); VIEWS.end();
  };
  const m = $('#main');
  m.querySelectorAll('[data-add]').forEach(s => s.onclick = async () => { const [j, t] = s.dataset.add.split('|'); await DB.insert('end_plan', { id: uuid(), junta_id: j, tipo: t, requerido: true }); VIEWS.end(); });
  m.querySelectorAll('[data-del]').forEach(s => s.onclick = async () => { await DB.remove('end_plan', s.dataset.del); VIEWS.end(); });
  m.querySelectorAll('[data-res]').forEach(s => s.onclick = () => { const [j, t] = s.dataset.res.split('|'); openForm(E.end_resultados, null, { fixed: { junta_id: j }, prefill: { tipo: t, fecha: hoyISO(), conforme: true } }, () => VIEWS.end()); });
};

/* ================= 7 · Calculadoras ================= */
VIEWS.calc = async () => {
  const inp = (id, l, v, st = 'any') => `<label>${l}<input type="number" step="${st}" id="${id}" value="${v}"></label>`;
  $('#main').innerHTML = `<div class="top"><h2>Calculadoras</h2></div>
  <div class="top" id="tabs">${[['pre', 'Precalentamiento'], ['aporte', 'Aporte térmico'], ['cons', 'Consumibles'], ['filete', 'Garganta de filete'], ['lm', 'PWHT · Larson-Miller']].map(([k, l], i) => `<button data-tab="${k}" class="${i ? '' : 'pri'}">${l}</button>`).join('')}</div>
  <div class="card" style="padding:16px" id="cbody"></div><p class="hint">Resultados orientativos. Comprueba siempre con la norma aplicable y con tu cualificación (PQR/WPS).</p>`;
  const T = {
    pre: () => `<h3 style="margin-top:0">Precalentamiento · EN 1011-2 (método B)</h3><div class="grid">${inp('C', 'C %', 0.2, '0.01')}${inp('Mn', 'Mn %', 1.2, '0.01')}${inp('Cr', 'Cr %', 0.1, '0.01')}${inp('Mo', 'Mo %', 0.05, '0.01')}${inp('V', 'V %', 0.02, '0.01')}${inp('Ni', 'Ni %', 0.1, '0.01')}${inp('Cu', 'Cu %', 0.1, '0.01')}${inp('d', 'Espesor d (mm)', 20)}${inp('HD', 'Hidrógeno HD (ml/100 g)', 5)}${inp('Q', 'Aporte térmico Q (kJ/mm)', 1.5, '0.1')}</div><div id="out" style="margin-top:12px"></div>`,
    aporte: () => `<h3 style="margin-top:0">Aporte térmico  Q = k·U·I·60 / (v·1000)</h3><div class="grid"><label>Proceso (k)<select id="k">${Object.entries(C_.K).map(([n, k]) => `<option value="${k}">${n} · k=${k}</option>`).join('')}</select></label>${inp('U', 'Tensión U (V)', 24)}${inp('I', 'Intensidad I (A)', 160)}${inp('v', 'Velocidad v (mm/min)', 150)}</div><div id="out" style="margin-top:12px"></div>`,
    cons: () => `<h3 style="margin-top:0">Consumo de consumibles</h3><div class="grid"><label>Junta<select id="jt"><option value="v">V simple</option><option value="f">Filete</option></select></label>${inp('t', 'Espesor t (mm)', 15)}${inp('ang', 'Ángulo total (°)', 60)}${inp('g', 'Separación raíz g (mm)', 2)}${inp('w', 'Ancho refuerzo w (mm)', 18)}${inp('h', 'Altura refuerzo h (mm)', 2)}${inp('z', 'Cateto z (filete, mm)', 6)}${inp('L', 'Longitud total (m)', 10)}<label>Proceso (rendimiento)<select id="rd">${Object.entries(C_.RENDIMIENTO).map(([n, k]) => `<option value="${k}">${n} · ${k}</option>`).join('')}</select></label></div><div id="out" style="margin-top:12px"></div>`,
    filete: () => `<h3 style="margin-top:0">Garganta ↔ cateto de filete</h3><div class="grid">${inp('z', 'Cateto z (mm)', 6, '0.1')}${inp('a', 'Garganta a (mm)', 4.24, '0.1')}</div><div id="out" style="margin-top:12px"></div>`,
    lm: () => `<h3 style="margin-top:0">PWHT · Larson-Miller y tiempos</h3><div class="grid">${inp('T1', 'T tratamiento (°C)', 620)}${inp('h1', 'Tiempo (h)', 2, '0.1')}${inp('T2', 'T alternativa (°C)', 595)}${inp('e', 'Espesor (mm) · UCS-56 P-No 1', 40)}</div><div id="out" style="margin-top:12px"></div>`
  };
  const calc = {
    pre: () => { const g = id => Number($('#' + id).value) || 0, m = { C: g('C'), Mn: g('Mn'), Cr: g('Cr'), Mo: g('Mo'), V: g('V'), Ni: g('Ni'), Cu: g('Cu') }, r = C_.precalentamiento(m, g('d'), g('HD'), g('Q')); return `<div class="kpis"><div class="kpi"><b>${r.tp} °C</b>Precalentamiento mín.</div><div class="kpi"><b>${r.ce}</b>CE (IIW)</div><div class="kpi"><b>${r.cet}</b>CET</div></div>${r.avisos.map(a => `<div>${badge('warn', '⚠')} ${esc(a)}</div>`).join('')}<div class="hint">Tp = 697·CET + 160·tanh(d/35) + 62·HD^0,35 + (53·CET − 32)·Q − 328. Mínimo 0 °C. Para acero sin tratamiento de hidrógeno controlado, usa HD alto (≥ 10).</div>`; },
    aporte: () => { const g = id => Number($('#' + id).value) || 0, q = C_.aporte(Number($('#k').value), g('U'), g('I'), g('v')); return `<div class="kpis"><div class="kpi"><b>${q} kJ/mm</b>Aporte térmico</div><div class="kpi"><b>${q == null ? '' : Math.round(q * 1000)} J/mm</b></div></div>`; },
    cons: () => { const g = id => Number($('#' + id).value) || 0, A = $('#jt').value === 'v' ? C_.areaV(g('t'), g('ang'), g('g'), g('w'), g('h')) : C_.areaFilete(g('z')), r = C_.consumo(A, g('L') * 1000, Number($('#rd').value)); return `<div class="kpis"><div class="kpi"><b>${Math.round(A)} mm²</b>Sección de junta</div><div class="kpi"><b>${r.deposito} kg</b>Metal depositado</div><div class="kpi"><b>${r.consumible} kg</b>Consumible a comprar</div></div><div class="hint">Densidad 7,85 g/cm³. V simple: A = g·t + t²·tan(α/2) + 2/3·w·h. Filete: A ≈ 0,55·z².</div>`; },
    filete: () => { const g = id => Number($('#' + id).value) || 0; return `<div class="kpis"><div class="kpi"><b>${C_.gargantaDesdeCateto(g('z'))} mm</b>a desde z</div><div class="kpi"><b>${C_.catetoDesdeGarganta(g('a'))} mm</b>z desde a</div></div>`; },
    lm: () => { const g = id => Number($('#' + id).value) || 0, P = C_.larsonMiller(g('T1'), g('h1')), t2 = C_.tiempoEquivalente(P, g('T2')), th = C_.pwhtTiempoPNo1(g('e')); return `<div class="kpis"><div class="kpi"><b>${P}</b>Parámetro LMP (×10³)</div><div class="kpi"><b>${t2} h</b>Tiempo equivalente a ${g('T2')} °C</div><div class="kpi"><b>${Math.round(th * 100) / 100} h</b>Mantenimiento mín. UCS-56 (P-No 1, ≥ 595 °C)</div></div><div class="hint">LMP = T(K)·(20 + log t)/1000. UCS-56 P-No 1: 1 h/25 mm (mín. 15 min) hasta 50 mm; 2 h + 15 min por cada 25 mm adicionales. Orientativo: confirma con la edición vigente.</div>`; }
  };
  const show = k => { $('#cbody').innerHTML = T[k](); $('#out').innerHTML = calc[k](); document.querySelectorAll('#cbody input,#cbody select').forEach(i => i.oninput = () => { if (k === 'filete') { if (i.id === 'z') $('#a').value = C_.gargantaDesdeCateto(Number(i.value)); else $('#z').value = C_.catetoDesdeGarganta(Number(i.value)); } $('#out').innerHTML = calc[k](); }); document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('pri', b.dataset.tab === k)); };
  document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => show(b.dataset.tab)); show('pre');
};

/* ================= Inicio ampliado ================= */
viewInicio = async function () {
  const [est, V, plan, res, reg] = await Promise.all([estadosWPQ(), loadVal(), DB.listSafe('end_plan'), DB.listSafe('end_resultados'), DB.listSafe('registro_soldadura')]);
  const val = L.wps.map(w => validarWPS(w, V).estado), c = k => val.filter(x => x === k).length;
  const alerta = est.filter(x => ['vencida', 'critica', 'proxima'].includes(x.e.estado)).sort((a, b) => a.e.dias - b.e.dias);
  const pend = plan.filter(p => p.requerido !== false && !res.some(r => r.junta_id == p.junta_id && r.tipo === p.tipo)).length;
  const k = (n, l, to) => `<div class="kpi" data-nav="${to}"><b>${n}</b>${l}</div>`;
  $('#main').innerHTML = (DEMO ? demoBanner() : '') + `<div class="top"><h2>Inicio</h2></div>
  <div class="kpis">${k(L.pqr.length, 'PQR', 'pqr')}${k(L.wps.length, 'WPS', 'wps')}${k(L.wpq.length, 'WPQ', 'wpq')}${k(L.soldadores.length, 'Soldadores', 'soldadores')}${k(L.materiales.length, 'Materiales', 'materiales')}${k(L.proyectos.length, 'Proyectos', 'proyectos')}${k(c('error'), 'WPS con errores', 'validacion')}${k(c('aviso'), 'WPS con avisos', 'validacion')}${k(pend, 'END pendientes', 'end')}${k(reg.length, 'Juntas registradas', 'avance')}</div>
  <h3>Cualificaciones de soldador a vigilar</h3>
  <div class="card"><table><tr><th>Soldador</th><th>WPQ</th><th>Proceso</th><th>Vence</th><th>Motivo</th><th></th></tr>${alerta.map(({ w, e }) => `<tr><td>${esc(lbl('soldadores', w.soldador_id))}</td><td>${esc(w.numero)}</td><td>${esc(lbl('procesos', w.proceso_id))}</td><td>${esc(e.due)}</td><td>${esc(e.motivo)}</td><td>${badge(...EST[e.estado])}</td></tr>`).join('') || '<tr><td colspan=6 class="hint">Sin vencimientos próximos.</td></tr>'}</table></div>`;
};

