/* WMAP · interfaz web (vanilla JS + Supabase). Sin dependencias de build. */
'use strict';
const CFG = window.WMAP_CONFIG || {};
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = (m, err) => { const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), err ? 6000 : 2500); };

/* ================= Capa de datos: Supabase o demo local ================= */
const SERIAL = new Set(['normas', 'procesos', 'materiales', 'consumibles', 'pqr_procesos', 'pqr_ensayos', 'wps_procesos', 'wpq_continuidad']);
let sb = null, DEMO = !CFG.SUPABASE_URL;

const Demo = {
  load() { try { return JSON.parse(localStorage.getItem('wmap_demo')) || null; } catch (e) { return null; } },
  save(d) { localStorage.setItem('wmap_demo', JSON.stringify(d)); },
  get() { let d = this.load(); if (!d) { d = seed(); this.save(d); } return d; }
};
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(16).slice(2) + Date.now());

const DB = {
  async list(t, order) {
    if (DEMO) { const r = [...(Demo.get()[t] || [])]; if (order) r.sort((a, b) => String(a[order] ?? '').localeCompare(String(b[order] ?? ''), 'es', { numeric: true })); return r; }
    let q = sb.from(t).select('*').range(0, 4999); if (order) q = q.order(order);
    const { data, error } = await q; if (error) throw error; return data;
  },
  async where(t, col, val) {
    if (DEMO) return (Demo.get()[t] || []).filter(r => r[col] == val);
    const { data, error } = await sb.from(t).select('*').eq(col, val).range(0, 4999); if (error) throw error; return data;
  },
  async insert(t, row) {
    if (DEMO) { const d = Demo.get(); d[t] = d[t] || []; const r = { ...row }; if (!r.id && !(t === 'wps_pqr')) r.id = SERIAL.has(t) ? Math.max(0, ...d[t].map(x => x.id || 0)) + 1 : uuid(); d[t].push(r); Demo.save(d); return r; }
    const { data, error } = await sb.from(t).insert(row).select().single(); if (error) throw error; return data;
  },
  async insertMany(t, rows) { for (const r of rows) await this.insert(t, r); },
  async update(t, id, patch) {
    if (DEMO) { const d = Demo.get(); const r = d[t].find(x => x.id == id); Object.assign(r, patch); Demo.save(d); return r; }
    const { error } = await sb.from(t).update(patch).eq('id', id); if (error) throw error;
  },
  async remove(t, id) {
    if (DEMO) { const d = Demo.get(); d[t] = d[t].filter(x => x.id != id); Demo.save(d); return; }
    const { error } = await sb.from(t).delete().eq('id', id); if (error) throw error;
  },
  async removeWhere(t, col, val) {
    if (DEMO) { const d = Demo.get(); d[t] = (d[t] || []).filter(x => x[col] != val); Demo.save(d); return; }
    const { error } = await sb.from(t).delete().eq(col, val); if (error) throw error;
  }
};

/* ================= Definición de entidades (campos de formulario) ================= */
const ESTADOS = ['borrador', 'revisado', 'aprobado', 'obsoleto'];
const TIPOS = [['penetracion', 'Penetración'], ['filete', 'Filete']];
const f = (k, l, t = 'text', x = {}) => ({ k, l, t, ...x });

const E = {
  pqr: {
    title: 'PQR', table: 'pqr', order: 'codigo', lk: 'pqr',
    cols: [['codigo', 'Código'], ['revision', 'Rev'], ['norma_id', 'Norma', 'normas'], ['clase_material', 'Material'], ['p_no_1', 'P-No'], ['espesor_mm', 'Esp. mm'], ['tipo', 'Tipo'], ['estado', 'Estado']],
    fields: [f('codigo', 'Código'), f('revision', 'Revisión', 'num'), f('norma_id', 'Norma', 'sel', { lookup: 'normas' }), f('fecha', 'Fecha', 'date'), f('estado', 'Estado', 'sel', { opts: ESTADOS }),
      f('tipo', 'Tipo de junta', 'sel', { opts: TIPOS }), f('clase_material', 'Material (clase)'), f('material1_id', 'Material 1 (BD)', 'sel', { lookup: 'materiales', blank: 1 }), f('material2_id', 'Material 2 (BD)', 'sel', { lookup: 'materiales', blank: 1 }),
      f('p_no_1', 'P-No 1'), f('group_1', 'Group 1'), f('p_no_2', 'P-No 2'), f('group_2', 'Group 2'), f('grupo_iso_1', 'Grupo ISO 15608 · 1'), f('grupo_iso_2', 'Grupo ISO 15608 · 2'),
      f('espesor_mm', 'Espesor ensayo (mm)', 'num'), f('diametro_mm', 'Diámetro (mm)', 'num'), f('posicion', 'Posición'), f('precalentamiento_c', 'Precalent. (°C)', 'num'), f('interpass_max_c', 'Interpass máx (°C)', 'num'),
      f('impacto_temp_c', 'Impacto T (°C)', 'num'), f('pwht', 'PWHT', 'bool'), f('pwht_detalle', 'Detalle PWHT'), f('observaciones', 'Observaciones', 'area')],
    rel: [{ key: 'procesos', label: 'Procesos (por orden)', table: 'pqr_procesos', fk: 'pqr_id', val: 'proceso_id', lookup: 'procesos', orden: 1 }]
  },
  wps: {
    title: 'WPS', table: 'wps', order: 'codigo', lk: 'wps',
    cols: [['codigo', 'Código'], ['revision', 'Rev'], ['norma_id', 'Norma', 'normas'], ['clase_material', 'Material'], ['p_no_1', 'P-No'], ['group_1', 'Group'], ['esp_min_mm', 'Esp. mín'], ['esp_max_mm', 'Esp. máx'], ['tipo', 'Tipo'], ['impacto_temp_c', 'Impacto'], ['pwht', 'PWHT'], ['estado', 'Estado']],
    fields: [f('codigo', 'Código'), f('revision', 'Revisión', 'num'), f('norma_id', 'Norma', 'sel', { lookup: 'normas' }), f('estado', 'Estado', 'sel', { opts: ESTADOS }), f('tipo', 'Tipo de junta', 'sel', { opts: TIPOS }), f('clase_material', 'Material (clase)'),
      f('p_no_1', 'P-No 1'), f('group_1', 'Group 1 (ej. 1,2)'), f('p_no_2', 'P-No 2'), f('group_2', 'Group 2'), f('grupo_iso_1', 'Grupo ISO · 1 (ej. 1.1,1.2)'), f('grupo_iso_2', 'Grupo ISO · 2'),
      f('esp_min_mm', 'Espesor mín (mm)', 'num'), f('esp_max_mm', 'Espesor máx (mm) · vacío=sin límite', 'num'), f('dia_min_mm', 'Diámetro mín', 'num'), f('dia_max_mm', 'Diámetro máx', 'num'),
      f('precalentamiento_min_c', 'Precalent. mín (°C)', 'num'), f('interpass_max_c', 'Interpass máx (°C)', 'num'), f('impacto_temp_c', 'Impacto T (°C) · vacío=no', 'num'),
      f('arqueo_resanado', 'Arqueo/resanado', 'bool'), f('pwht', 'PWHT', 'bool'), f('pqr_ref_txt', 'PQR de referencia (texto)'), f('observaciones', 'Observaciones', 'area', { cls: 'wall' })],
    rel: [{ key: 'procesos', label: 'Procesos (por orden)', table: 'wps_procesos', fk: 'wps_id', val: 'proceso_id', lookup: 'procesos', orden: 1 },
      { key: 'pqrs', label: 'PQR que soportan este WPS', table: 'wps_pqr', fk: 'wps_id', val: 'pqr_id', lookup: 'pqr' }]
  },
  wpq: {
    title: 'WPQ', table: 'wpq', order: 'numero', lk: 'wpq',
    cols: [['numero', 'Nº'], ['soldador_id', 'Soldador', 'soldadores'], ['norma_id', 'Norma', 'normas'], ['proceso_id', 'Proceso', 'procesos'], ['posicion', 'Posición'], ['espesor_mm', 'Esp.'], ['fecha_ensayo', 'Ensayo'], ['fecha_vencimiento', 'Vence', null, 'venc'], ['estado', 'Estado']],
    fields: [f('soldador_id', 'Soldador', 'sel', { lookup: 'soldadores' }), f('numero', 'Nº cualificación'), f('norma_id', 'Norma', 'sel', { lookup: 'normas' }), f('proceso_id', 'Proceso', 'sel', { lookup: 'procesos' }),
      f('wps_pqr_ref', 'WPS/PQR de ensayo'), f('material_ensayo_id', 'Material ensayo', 'sel', { lookup: 'materiales', blank: 1 }), f('espesor_mm', 'Espesor (mm)', 'num'), f('diametro_mm', 'Diámetro (mm)', 'num'),
      f('posicion', 'Posición'), f('tipo', 'Tipo', 'sel', { opts: TIPOS, blank: 1 }), f('f_no', 'F-No / grupo consumible'), f('consumible_id', 'Consumible', 'sel', { lookup: 'consumibles', blank: 1 }),
      f('fecha_ensayo', 'Fecha ensayo', 'date'), f('fecha_vencimiento', 'Fecha vencimiento', 'date'), f('estado', 'Estado', 'sel', { opts: ESTADOS }), f('documento', 'Documento (ruta/URL)')]
  },
  soldadores: {
    title: 'Soldadores', table: 'soldadores', order: 'nombre', lk: 'soldadores',
    cols: [['nombre', 'Nombre'], ['codigo', 'Código/estampilla'], ['empresa', 'Empresa'], ['activo', 'Activo']],
    fields: [f('nombre', 'Nombre'), f('codigo', 'Código/estampilla'), f('empresa', 'Empresa'), f('activo', 'Activo', 'bool')]
  },
  materiales: {
    title: 'Materiales', table: 'materiales', order: 'especificacion', lk: 'materiales',
    cols: [['especificacion', 'Especificación'], ['grado', 'Grado'], ['forma', 'Forma'], ['p_no', 'P-No'], ['group_no', 'Group'], ['grupo_iso', 'Grupo ISO'], ['uns', 'UNS']],
    fields: [f('especificacion', 'Especificación (SA-516)'), f('grado', 'Grado (Gr.60)'), f('forma', 'Forma (plate/pipe/forging/fitting)'), f('uns', 'UNS'), f('p_no', 'P-No'), f('group_no', 'Group'), f('grupo_iso', 'Grupo ISO 15608'), f('notas', 'Notas', 'area', { cls: 'w2' })]
  },
  consumibles: {
    title: 'Consumibles', table: 'consumibles', order: 'clasificacion', lk: 'consumibles',
    cols: [['clasificacion', 'Clasificación'], ['proceso_id', 'Proceso', 'procesos'], ['sfa', 'SFA'], ['f_no', 'F-No'], ['a_no', 'A-No'], ['grupo_iso', 'Grupo ISO'], ['nombre_comercial', 'Comercial']],
    fields: [f('clasificacion', 'Clasificación (E7018, ER316L…)'), f('proceso_id', 'Proceso', 'sel', { lookup: 'procesos', blank: 1 }), f('sfa', 'SFA'), f('f_no', 'F-No'), f('a_no', 'A-No'), f('grupo_iso', 'Grupo ISO'), f('nombre_comercial', 'Nombre comercial')]
  },
  proyectos: {
    title: 'Proyectos', table: 'proyectos', order: 'proyecto', lk: 'proyectos',
    cols: [['cliente', 'Cliente'], ['proyecto', 'Proyecto'], ['pedido', 'Pedido'], ['referencia', 'Referencia'], ['ubicacion', 'Ubicación']],
    fields: [f('cliente', 'Cliente'), f('proyecto', 'Proyecto'), f('pedido', 'Pedido'), f('referencia', 'Referencia'), f('ubicacion', 'Ubicación')],
    extra: r => `<button class="sm" data-act="equipos" data-id="${r.id}">Equipos y juntas →</button>`
  },
  welding_books: {
    title: 'Documentos welding book', table: 'welding_books', order: 'numero_doc', lk: 'welding_books',
    cols: [['numero_doc', 'Nº documento'], ['revision', 'Rev'], ['proyecto_id', 'Proyecto', 'proyectos'], ['fecha', 'Fecha'], ['estado', 'Estado']],
    fields: [f('proyecto_id', 'Proyecto', 'sel', { lookup: 'proyectos' }), f('numero_doc', 'Nº documento (271362-01)'), f('revision', 'Revisión', 'num'), f('estado', 'Estado', 'sel', { opts: ESTADOS }), f('fecha', 'Fecha', 'date'),
      f('dibujado', 'Dibujado por'), f('revisado', 'Revisado por'), f('aprobado', 'Aprobado por'), f('descripcion_rev', 'Descripción de la revisión', 'area', { cls: 'wall' })],
    extra: r => `<button class="sm pri" data-act="imprimir" data-id="${r.id}">Imprimir / PDF</button>`
  },
  equipos: {
    title: 'Equipo', table: 'equipos', order: 'item', lk: 'equipos',
    fields: [f('item', 'Item Nº'), f('descripcion', 'Descripción'), f('codigo_diseno', 'Código de diseño'), f('presion_diseno', 'Presión de diseño'), f('radiografia', 'Radiografía (Full/Spot/No)'), f('eficiencia_junta', 'Eficiencia de junta', 'num'),
      f('sobreespesor_corrosion_mm', 'Sobreespesor corrosión (mm)', 'num'), f('resiliencia_c', 'Resiliencia a (°C)', 'num'), f('pwht', 'PWHT', 'bool'), f('dureza', 'Dureza', 'bool'), f('servicio', 'Servicio')]
  },
  juntas: {
    title: 'Junta', table: 'juntas', order: 'marca', lk: 'juntas',
    fields: [f('marca', 'Marca'), f('tipo', 'Tipo', 'sel', { opts: TIPOS, blank: 1 }),
      f('pieza1_desc', 'Pieza 1 · descripción'), f('pieza1_od', 'Pieza 1 · OD'), f('pieza1_material_id', 'Pieza 1 · material', 'sel', { lookup: 'materiales', blank: 1 }), f('pieza1_esp_mm', 'Pieza 1 · espesor (mm)', 'num'),
      f('pieza2_desc', 'Pieza 2 · descripción'), f('pieza2_od', 'Pieza 2 · OD'), f('pieza2_material_id', 'Pieza 2 · material', 'sel', { lookup: 'materiales', blank: 1 }), f('pieza2_esp_mm', 'Pieza 2 · espesor (mm)', 'num'),
      f('garganta_a', 'Tamaño mín. a', 'num'), f('garganta_b', 'Tamaño mín. b', 'num'), f('garganta_c', 'Tamaño mín. c', 'num'), f('procesos', 'Procesos (texto)'), f('wps_id', 'WPS asignado', 'sel', { lookup: 'wps', blank: 1 })]
  }
};

/* ================= Lookups ================= */
const L = {};
const LBL = {
  normas: r => r.codigo, procesos: r => `${r.codigo_aws || ''}${r.codigo_iso ? ' (' + r.codigo_iso + ')' : ''}`,
  materiales: r => `${r.especificacion} ${r.grado || ''}`.trim(), consumibles: r => r.clasificacion, soldadores: r => r.nombre,
  pqr: r => `${r.codigo}${r.revision ? ' r' + r.revision : ''} · ${(L.normas.find(n => n.id == r.norma_id) || {}).codigo || ''}`,
  wps: r => `${r.codigo}${r.revision ? ' r' + r.revision : ''}`, proyectos: r => `${r.cliente || ''} · ${r.proyecto || ''}`
};
async function loadLookups() {
  for (const t of ['normas', 'procesos', 'materiales', 'consumibles', 'soldadores', 'pqr', 'wps', 'proyectos']) L[t] = await DB.list(t, t === 'normas' ? 'codigo' : null);
}
const lbl = (lk, id) => { if (id == null || id === '') return ''; const r = (L[lk] || []).find(x => x.id == id); return r ? LBL[lk](r) : String(id); };
const isNumId = lk => typeof ((L[lk] || [])[0] || {}).id === 'number';

/* ================= Navegación ================= */
const NAV = [
  ['inicio', 'Inicio'], ['_', 'Cualificaciones'], ['pqr', 'PQR'], ['wps', 'WPS'], ['wpq', 'WPQ'], ['soldadores', 'Soldadores'],
  ['_', 'Base de datos'], ['materiales', 'Materiales'], ['consumibles', 'Consumibles'],
  ['_', 'Welding books'], ['proyectos', 'Proyectos y equipos'], ['welding_books', 'Documentos']
];
let CUR = 'inicio';
function renderNav() {
  $('#nav').innerHTML = `<h1>WMAP</h1><small>ASME IX · EN ISO</small>` + NAV.map(([k, l]) => k === '_' ? `<div class="grp">${l}</div>` : `<a data-nav="${k}" class="${k === CUR ? 'on' : ''}">${l}</a>`).join('') +
    (!DEMO ? `<div class="grp">Sesión</div><a data-nav="_salir">Cerrar sesión</a>` : '');
}
document.addEventListener('click', async e => {
  const a = e.target.closest('[data-nav]'); if (a) {
    if (a.dataset.nav === '_salir') { await sb.auth.signOut(); location.reload(); return; }
    go(a.dataset.nav);
  }
});
async function go(k, arg) {
  CUR = k; renderNav(); const m = $('#main'); m.innerHTML = '';
  try {
    if (!Object.keys(L).length || k === 'inicio') await loadLookups();
    if (k === 'inicio') await viewInicio(); else if (k === 'equipos') await viewEquipos(arg); else await viewLista(k);
  } catch (err) { console.error(err); toast(err.message || String(err), true); }
  if (k === 'equipos') CUR = 'proyectos', renderNav();
}

/* ================= Inicio ================= */
async function viewInicio() {
  const wpq = await DB.list('wpq'); const hoy = new Date(); const en60 = new Date(Date.now() + 60 * 864e5);
  const venc = wpq.filter(w => w.fecha_vencimiento && new Date(w.fecha_vencimiento) < hoy), prox = wpq.filter(w => w.fecha_vencimiento && new Date(w.fecha_vencimiento) >= hoy && new Date(w.fecha_vencimiento) <= en60);
  const k = (n, l, to) => `<div class="kpi" data-nav="${to}"><b>${n}</b>${l}</div>`;
  $('#main').innerHTML = (DEMO ? demoBanner() : '') + `<div class="top"><h2>Inicio</h2></div>
  <div class="kpis">${k(L.pqr.length, 'PQR', 'pqr')}${k(L.wps.length, 'WPS', 'wps')}${k(wpq.length, 'WPQ', 'wpq')}${k(L.soldadores.length, 'Soldadores', 'soldadores')}${k(L.materiales.length, 'Materiales', 'materiales')}${k(L.proyectos.length, 'Proyectos', 'proyectos')}</div>
  <h3>Cualificaciones de soldador a vigilar</h3>
  <div class="card"><table><tr><th>Soldador</th><th>Nº</th><th>Proceso</th><th>Vence</th><th></th></tr>${[...venc, ...prox].map(w => `<tr><td>${esc(lbl('soldadores', w.soldador_id))}</td><td>${esc(w.numero)}</td><td>${esc(lbl('procesos', w.proceso_id))}</td><td>${esc(w.fecha_vencimiento)}</td><td>${new Date(w.fecha_vencimiento) < hoy ? '<span class="badge b-bad">vencida</span>' : '<span class="badge b-warn">&lt; 60 días</span>'}</td></tr>`).join('') || '<tr><td colspan=5 class="hint">Sin vencimientos próximos.</td></tr>'}</table></div>`;
}
const demoBanner = () => `<div class="demo">MODO DEMO · datos solo en este navegador. Para usar Supabase rellena <b>config.js</b>. <button class="sm" data-act="resetdemo">Reiniciar demo</button></div>`;

/* ================= Listado genérico ================= */
const fmt = (v, c) => {
  if (c[2] && c[2] !== null) return esc(lbl(c[2], v));
  if (c[3] === 'venc') { if (!v) return ''; const d = new Date(v), n = new Date(); return esc(v) + ' ' + (d < n ? '<span class="badge b-bad">vencida</span>' : d < new Date(Date.now() + 60 * 864e5) ? '<span class="badge b-warn">&lt;60d</span>' : ''); }
  if (typeof v === 'boolean') return v ? 'Sí' : '–';
  if (c[0] === 'estado' && v) return `<span class="badge b-${v}">${esc(v)}</span>`;
  if (c[0] === 'tipo') return esc(v === 'filete' ? 'Filete' : v === 'penetracion' ? 'Penetración' : v);
  if (c[0] === 'impacto_temp_c') return v == null ? 'NO' : esc(v + ' °C');
  if (c[0] === 'esp_max_mm') return v == null ? 'sin límite' : esc(v);
  return esc(v);
};
async function viewLista(k) {
  const ent = E[k]; const rows = await DB.list(ent.table, ent.order); ent._rows = rows;
  $('#main').innerHTML = (DEMO ? demoBanner() : '') + `<div class="top"><h2>${ent.title} <span class="hint">(${rows.length})</span></h2><input class="search" id="q" placeholder="Buscar…"><button class="pri" data-act="nuevo">+ Nuevo</button></div><div class="card" id="tbl"></div>`;
  const draw = () => {
    const q = $('#q').value.toLowerCase();
    const vis = rows.filter(r => !q || ent.cols.some(c => String(c[2] ? lbl(c[2], r[c[0]]) : r[c[0]] ?? '').toLowerCase().includes(q)));
    $('#tbl').innerHTML = `<table><tr>${ent.cols.map(c => `<th>${c[1]}</th>`).join('')}<th></th></tr>` + vis.map(r => `<tr>${ent.cols.map(c => `<td>${fmt(r[c[0]], c)}</td>`).join('')}<td class="act">${ent.extra ? ent.extra(r) : ''} <button class="sm" data-act="edit" data-id="${r.id}">Editar</button> <button class="sm" data-act="dup" data-id="${r.id}">Duplicar</button> <button class="sm del" data-act="del" data-id="${r.id}">✕</button></td></tr>`).join('') + '</table>';
  };
  $('#q').oninput = draw; draw();
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b) return; const act = b.dataset.act, id = b.dataset.id;
  const ent = E[CUR]; const row = ent && ent._rows ? ent._rows.find(r => r.id == id) : null;
  try {
    if (act === 'resetdemo') { localStorage.removeItem('wmap_demo'); Object.keys(L).forEach(x => delete L[x]); go('inicio'); }
    else if (act === 'nuevo') openForm(ent, null, {}, () => go(CUR));
    else if (act === 'edit') openForm(ent, row, {}, () => go(CUR));
    else if (act === 'dup') { const c = { ...row }; delete c.id; if (c.codigo) c.codigo += ' (copia)'; openForm(ent, null, { prefill: c, dupFrom: row }, () => go(CUR)); }
    else if (act === 'del') { if (!confirm('¿Eliminar este registro?')) return; await DB.remove(ent.table, id); toast('Eliminado'); Object.keys(L).forEach(x => delete L[x]); go(CUR); }
    else if (act === 'equipos') go('equipos', id);
    else if (act === 'imprimir') imprimirDocumento(id);
  } catch (err) { toast(err.message || String(err), true); }
});

/* ================= Formulario genérico ================= */
function inputHtml(fd, v) {
  const nm = `name="${fd.k}"`;
  if (fd.t === 'bool') return `<label>${fd.l}<br><input type="checkbox" ${nm} ${v ? 'checked' : ''}></label>`;
  let ctl;
  if (fd.t === 'sel') {
    const opts = fd.lookup ? L[fd.lookup].map(r => [r.id, LBL[fd.lookup](r)]) : fd.opts.map(o => Array.isArray(o) ? o : [o, o]);
    ctl = `<select ${nm}>${fd.blank ? '<option value="">—</option>' : ''}${opts.map(([id, l]) => `<option value="${esc(id)}" ${id == v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  } else if (fd.t === 'area') ctl = `<textarea ${nm} rows="2">${esc(v)}</textarea>`;
  else ctl = `<input ${nm} type="${fd.t === 'num' ? 'number' : fd.t === 'date' ? 'date' : 'text'}" ${fd.t === 'num' ? 'step="any"' : ''} value="${esc(v)}">`;
  return `<label class="${fd.cls || ''}">${fd.l}${ctl}</label>`;
}
function readForm(ent, form) {
  const out = {};
  for (const fd of ent.fields) {
    const el = form.elements[fd.k]; if (!el) continue; let v;
    if (fd.t === 'bool') v = el.checked;
    else if (fd.t === 'num') v = el.value === '' ? null : Number(el.value);
    else if (fd.t === 'sel') v = el.value === '' ? null : (fd.lookup && isNumId(fd.lookup) ? Number(el.value) : el.value);
    else v = el.value.trim() === '' ? null : el.value.trim();
    out[fd.k] = v;
  }
  return out;
}
async function openForm(ent, row, opts, done) {
  const rels = {};
  for (const r of ent.rel || []) {
    const src = row ? await DB.where(r.table, r.fk, row.id) : (opts.dupFrom ? await DB.where(r.table, r.fk, opts.dupFrom.id) : []);
    rels[r.key] = src.sort((a, b) => (a.orden || 0) - (b.orden || 0)).map(x => x[r.val]);
  }
  const base = row || opts.prefill || {};
  const defaults = { revision: 0, estado: 'borrador', activo: true };
  const val = fd => base[fd.k] ?? opts.fixed?.[fd.k] ?? (row || opts.prefill ? null : defaults[fd.k]) ?? '';
  const fields = ent.fields.filter(fd => !(opts.fixed && fd.k in opts.fixed));
  $('#box').innerHTML = `<h3>${row ? 'Editar' : 'Nuevo'} · ${ent.title}</h3><form id="frm"><div class="grid">${fields.map(fd => inputHtml(fd, val(fd))).join('')}</div>` +
    (ent.rel || []).map(r => `<div style="margin-top:12px"><div class="hint">${r.label}</div><div class="chk" data-rel="${r.key}">${L[r.lookup].map(o => `<label><input type="checkbox" value="${esc(o.id)}" ${rels[r.key].some(x => x == o.id) ? 'checked' : ''}>${esc(LBL[r.lookup](o))}</label>`).join('')}</div>${r.orden ? '<div class="hint">El orden de los procesos es el de la lista (se guarda en el orden mostrado).</div>' : ''}</div>`).join('') +
    (ent.table === 'juntas' ? `<div style="margin-top:12px"><button type="button" id="btnSug">Sugerir WPS válidos</button><div id="sug" class="sug" style="display:none"></div></div>` : '') +
    `<div class="foot"><button type="button" id="cancel">Cancelar</button><button class="pri" type="submit">Guardar</button></div></form>`;
  $('#modal').classList.remove('hidden');
  $('#cancel').onclick = () => $('#modal').classList.add('hidden');
  if (ent.table === 'juntas') $('#btnSug').onclick = () => mostrarSugerencias(ent);
  $('#frm').onsubmit = async ev => {
    ev.preventDefault();
    try {
      const vals = { ...readForm(ent, ev.target), ...(opts.fixed || {}) }; let id = row?.id;
      if (id) await DB.update(ent.table, id, vals); else id = (await DB.insert(ent.table, vals)).id;
      for (const r of ent.rel || []) {
        const sel = [...document.querySelectorAll(`[data-rel="${r.key}"] input:checked`)].map(x => isNumId(r.lookup) ? Number(x.value) : x.value);
        await DB.removeWhere(r.table, r.fk, id);
        await DB.insertMany(r.table, sel.map((v, i) => ({ [r.fk]: id, [r.val]: v, ...(r.orden ? { orden: i + 1 } : {}) })));
      }
      $('#modal').classList.add('hidden'); Object.keys(L).forEach(x => delete L[x]); await loadLookups(); toast('Guardado'); done && done(id);
    } catch (err) { toast(err.message || String(err), true); }
  };
}

/* ================= Selección de WPS para una junta ================= */
const incl = (list, v) => v == null || v === '' || list == null || list === '' || String(list).split(/[,;]/).map(s => s.trim()).includes(String(v).trim());
function candidatos(j) {
  const m1 = L.materiales.find(m => m.id == j.pieza1_material_id), m2 = L.materiales.find(m => m.id == j.pieza2_material_id);
  const esps = [j.pieza1_esp_mm, j.pieza2_esp_mm].filter(x => x != null && x > 0); const t = esps.length ? Math.min(...esps) : null;
  return L.wps.filter(w => w.estado !== 'obsoleto').map(w => {
    const notas = []; let ok = true;
    if (j.tipo && w.tipo !== j.tipo) ok = false;
    if (ok && j.tipo !== 'filete' && t != null) { if ((w.esp_min_mm != null && t < w.esp_min_mm) || (w.esp_max_mm != null && t > w.esp_max_mm)) ok = false; }
    const matchMat = (m, pn, gr, giso) => { if (!m) { notas.push('material sin definir'); return true; } if (pn && m.p_no && String(pn) !== String(m.p_no)) return false; if (!pn && !giso && !m.p_no) return true; if (giso && m.grupo_iso && !incl(giso, m.grupo_iso)) return false; if (gr && m.group_no && !incl(gr, m.group_no)) return false; if (pn && !m.p_no) notas.push('material sin P-No'); return true; };
    if (ok) {
      const dir = matchMat(m1, w.p_no_1, w.group_1, w.grupo_iso_1) && matchMat(m2, w.p_no_2, w.group_2, w.grupo_iso_2);
      const inv = matchMat(m1, w.p_no_2, w.group_2, w.grupo_iso_2) && matchMat(m2, w.p_no_1, w.group_1, w.grupo_iso_1);
      ok = dir || inv;
    }
    return ok ? { w, notas: [...new Set(notas)] } : null;
  }).filter(Boolean);
}
async function mostrarSugerencias(ent) {
  const form = $('#frm'); const j = readForm(ent, form); const box = $('#sug'); box.style.display = 'block';
  const c = candidatos(j); const procs = async w => (await DB.where('wps_procesos', 'wps_id', w.id)).sort((a, b) => a.orden - b.orden).map(p => (L.procesos.find(x => x.id == p.proceso_id) || {}).codigo_aws).filter(Boolean).join('+');
  const info = await Promise.all(c.map(async x => ({ ...x, pr: await procs(x.w) })));
  box.innerHTML = info.length ? `<div class="hint">${info.length} WPS compatibles (material, espesor del lado más delgado y tipo). Clic para asignar:</div>` + info.map(x => `<div data-w="${x.w.id}" data-p="${esc(x.pr)}"><b>${esc(x.w.codigo)}</b> · ${esc(x.pr)} · esp ${x.w.esp_min_mm ?? '–'}–${x.w.esp_max_mm ?? 'sin límite'} mm · impacto ${x.w.impacto_temp_c ?? 'NO'} · PWHT ${x.w.pwht ? 'Sí' : 'No'} ${x.notas.length ? '<span class="badge b-warn">' + esc(x.notas.join(', ')) + '</span>' : ''}</div>`).join('')
    : '<span class="badge b-bad">Ningún WPS cubre esta junta</span> <span class="hint">(revisa materiales/espesor o crea un WPS)</span>';
  box.querySelectorAll('[data-w]').forEach(d => d.onclick = () => { form.elements.wps_id.value = d.dataset.w; if (!form.elements.procesos.value) form.elements.procesos.value = d.dataset.p; box.style.display = 'none'; });
}

/* ================= Equipos y juntas (editor del welding map) ================= */
let PLACING = null;
async function viewEquipos(pid) {
  const pr = L.proyectos.find(p => p.id == pid); const eqs = (await DB.where('equipos', 'proyecto_id', pid)).sort((a, b) => String(a.item).localeCompare(String(b.item), 'es', { numeric: true }));
  const sel = window.__eq && eqs.find(e => e.id == window.__eq) ? window.__eq : (eqs[0] || {}).id; window.__eq = sel; const eq = eqs.find(e => e.id == sel);
  const js = eq ? (await DB.where('juntas', 'equipo_id', eq.id)).sort((a, b) => String(a.marca).localeCompare(String(b.marca), 'es', { numeric: true })) : [];
  E.equipos._rows = eqs; E.juntas._rows = js;
  const m = $('#main');
  m.innerHTML = `${DEMO ? demoBanner() : ''}<div class="top"><button data-nav="proyectos">← Proyectos</button><h2>${esc(lbl('proyectos', pid))}</h2></div>
  <div class="top"><select id="eqsel" style="max-width:300px">${eqs.map(e => `<option value="${e.id}" ${e.id == sel ? 'selected' : ''}>${esc(e.item)} ${esc(e.descripcion || '')}</option>`).join('') || '<option>(sin equipos)</option>'}</select>
    <button id="neweq" class="pri">+ Equipo</button>${eq ? '<button id="edeq">Editar datos</button><button id="deleq" class="del">Eliminar equipo</button>' : ''}</div>` + (eq ? `
  <div class="card" style="padding:10px 14px;margin-bottom:14px"><span class="hint">Código</span> ${esc(eq.codigo_diseno)} · <span class="hint">P diseño</span> ${esc(eq.presion_diseno)} · <span class="hint">RT</span> ${esc(eq.radiografia)} · <span class="hint">E</span> ${esc(eq.eficiencia_junta)} · <span class="hint">CA</span> ${esc(eq.sobreespesor_corrosion_mm)} · <span class="hint">PWHT</span> ${eq.pwht ? 'Sí' : 'No'} · <span class="hint">Servicio</span> ${esc(eq.servicio)}</div>
  <div class="top"><h3 style="margin:0;flex:1">Juntas (${js.length})</h3><button class="pri" id="newj">+ Junta</button></div>
  <div class="card"><table><tr><th>Marca</th><th>Pieza 1</th><th>Material 1</th><th>Esp</th><th>Pieza 2</th><th>Material 2</th><th>Esp</th><th>Tipo</th><th>Procesos</th><th>WPS</th><th></th></tr>${js.map(j => `<tr><td><b>${esc(j.marca)}</b>${j.mapa_x != null ? ' 📍' : ''}</td><td>${esc(j.pieza1_desc)} ${esc(j.pieza1_od)}</td><td>${esc(lbl('materiales', j.pieza1_material_id))}</td><td>${esc(j.pieza1_esp_mm)}</td><td>${esc(j.pieza2_desc)} ${esc(j.pieza2_od)}</td><td>${esc(lbl('materiales', j.pieza2_material_id))}</td><td>${esc(j.pieza2_esp_mm)}</td><td>${esc(j.tipo === 'filete' ? 'Filete' : j.tipo === 'penetracion' ? 'Penetr.' : '')}</td><td>${esc(j.procesos)}</td><td>${j.wps_id ? esc(lbl('wps', j.wps_id)) : '<span class="badge b-bad">sin WPS</span>'}</td><td class="act"><button class="sm" data-j="pos" data-id="${j.id}">📍 Colocar</button> <button class="sm" data-j="edit" data-id="${j.id}">Editar</button> <button class="sm del" data-j="del" data-id="${j.id}">✕</button></td></tr>`).join('')}</table></div>
  <h3>Croquis / mapa de soldadura</h3>
  <div class="top"><input type="file" id="img" accept="image/*" style="max-width:300px"> <span class="hint" id="plhint">${PLACING ? 'Haz clic sobre el croquis para ubicar la junta seleccionada.' : 'Sube una imagen del equipo (PNG/JPG) y usa «📍 Colocar» en cada junta.'}</span></div>
  <div class="croquis" id="cq">${eq.croquis ? `<img src="${eq.croquis}" id="cqimg">` : '<div style="padding:40px;color:#999">Sin croquis</div>'}${js.filter(j => j.mapa_x != null).map(j => `<span class="pin" style="left:${j.mapa_x * 100}%;top:${j.mapa_y * 100}%">${esc(j.marca)}</span>`).join('')}</div>` : '<p class="hint">Crea un equipo (item) para empezar.</p>');
  $('#eqsel').onchange = e => { window.__eq = e.target.value; PLACING = null; viewEquipos(pid); };
  $('#neweq').onclick = () => openForm(E.equipos, null, { fixed: { proyecto_id: pid } }, id => { window.__eq = id; viewEquipos(pid); });
  if (!eq) return;
  $('#edeq').onclick = () => openForm(E.equipos, eq, { fixed: { proyecto_id: pid } }, () => viewEquipos(pid));
  $('#deleq').onclick = async () => { if (confirm('¿Eliminar equipo y sus juntas?')) { await DB.removeWhere('juntas', 'equipo_id', eq.id); await DB.remove('equipos', eq.id); window.__eq = null; viewEquipos(pid); } };
  $('#newj').onclick = () => openForm(E.juntas, null, { fixed: { equipo_id: eq.id } }, () => viewEquipos(pid));
  m.querySelectorAll('[data-j]').forEach(b => b.onclick = async () => {
    const j = js.find(x => x.id == b.dataset.id);
    if (b.dataset.j === 'edit') openForm(E.juntas, j, { fixed: { equipo_id: eq.id } }, () => viewEquipos(pid));
    if (b.dataset.j === 'del') { if (confirm('¿Eliminar junta?')) { await DB.remove('juntas', j.id); viewEquipos(pid); } }
    if (b.dataset.j === 'pos') { if (!eq.croquis) return toast('Sube primero un croquis', true); PLACING = j.id; $('#plhint').textContent = `Haz clic sobre el croquis para ubicar la junta ${j.marca}.`; $('#cq').style.cursor = 'crosshair'; }
  });
  $('#img').onchange = ev => {
    const file = ev.target.files[0]; if (!file) return; const img = new Image(), rd = new FileReader();
    rd.onload = () => { img.onload = async () => { const k = Math.min(1, 1400 / img.width), c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); await DB.update('equipos', eq.id, { croquis: c.toDataURL('image/jpeg', 0.85) }); viewEquipos(pid); }; img.src = rd.result; };
    rd.readAsDataURL(file);
  };
  $('#cq').onclick = async ev => {
    if (!PLACING || ev.target.classList.contains('pin')) return; const r = $('#cq').getBoundingClientRect();
    const x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height; await DB.update('juntas', PLACING, { mapa_x: +x.toFixed(4), mapa_y: +y.toFixed(4) }); PLACING = null; viewEquipos(pid);
  };
}

/* ================= Impresión del welding book ================= */
async function imprimirDocumento(bookId) {
  const wb = (await DB.list('welding_books')).find(b => b.id == bookId); const pr = L.proyectos.find(p => p.id == wb.proyecto_id) || {};
  const eqs = (await DB.where('equipos', 'proyecto_id', wb.proyecto_id)).sort((a, b) => String(a.item).localeCompare(String(b.item), 'es', { numeric: true }));
  const th = `<th>JOINT MARK</th><th colspan=4>PART 1 (descr · OD · spec · th)</th><th colspan=4>PART 2 (descr · OD · spec · th)</th><th>WELD DTL</th><th>a</th><th>b</th><th>c</th><th>WELDING PROCESS</th><th>W.P.S. No.</th>`;
  const head = `Document No.: ${esc(wb.numero_doc)} · Rev.: ${esc(wb.revision)}`;
  let html = `<div class="pg"><h1>WELDING BOOK</h1><table class="meta cover"><tr><td>DOCUMENT</td><td>WELDING BOOK</td></tr><tr><td>CLIENT</td><td>${esc(pr.cliente)}</td></tr><tr><td>PROJECT</td><td>${esc(pr.proyecto)}</td></tr><tr><td>PURCHASE ORDER</td><td>${esc(pr.pedido)}</td></tr><tr><td>REFERENCE</td><td>${esc(pr.referencia)}</td></tr><tr><td>ITEMS</td><td>${esc(eqs.map(e => e.item).join(', '))}</td></tr><tr><td>LOCATION</td><td>${esc(pr.ubicacion)}</td></tr><tr><td>DOC. Nº / REV.</td><td>${esc(wb.numero_doc)} / ${esc(wb.revision)}</td></tr><tr><td>DRAWN / CHECKED / APPROVED</td><td>${esc(wb.dibujado)} / ${esc(wb.revisado)} / ${esc(wb.aprobado)} · ${esc(wb.fecha)}</td></tr><tr><td>REV. DESCRIPTION</td><td>${esc(wb.descripcion_rev)}</td></tr></table></div>`;
  for (const eq of eqs) {
    const js = (await DB.where('juntas', 'equipo_id', eq.id)).sort((a, b) => String(a.marca).localeCompare(String(b.marca), 'es', { numeric: true }));
    const mat = id => { const m = L.materiales.find(x => x.id == id); return m ? `${m.especificacion} ${m.grado || ''}` : ''; };
    html += `<div class="pg"><h2>LIST OF PIECES TO BE WELDED — ITEM Nº ${esc(eq.item)} · ${head}</h2><table><tr>${th}</tr>` + js.map(j => `<tr><td>${esc(j.marca)}</td><td>${esc(j.pieza1_desc)}</td><td>${esc(j.pieza1_od)}</td><td>${esc(mat(j.pieza1_material_id))}</td><td>${esc(j.pieza1_esp_mm)}</td><td>${esc(j.pieza2_desc)}</td><td>${esc(j.pieza2_od)}</td><td>${esc(mat(j.pieza2_material_id))}</td><td>${esc(j.pieza2_esp_mm)}</td><td>${j.tipo === 'filete' ? 'Fillet' : 'BW'}</td><td>${esc(j.garganta_a)}</td><td>${esc(j.garganta_b)}</td><td>${esc(j.garganta_c)}</td><td>${esc(j.procesos)}</td><td>${esc(lbl('wps', j.wps_id))}</td></tr>`).join('') + `</table></div>`;
    html += `<div class="pg"><h2>WELDING MAP WITH JOINT MARKS — ITEM Nº ${esc(eq.item)} · ${head}</h2><div style="display:flex;gap:14px;align-items:flex-start"><table class="meta" style="width:42%"><tr><td>Code</td><td>${esc(eq.codigo_diseno)}</td></tr><tr><td>Design Pressure</td><td>${esc(eq.presion_diseno)}</td></tr><tr><td>Radiography</td><td>${esc(eq.radiografia)}</td></tr><tr><td>Joint efficiency</td><td>${esc(eq.eficiencia_junta)}</td></tr><tr><td>Corrosion allowance (mm)</td><td>${esc(eq.sobreespesor_corrosion_mm)}</td></tr><tr><td>Post weld heat treatment</td><td>${eq.pwht ? 'Yes' : 'No'}</td></tr><tr><td>Hardness</td><td>${eq.dureza ? 'Yes' : 'No'}</td></tr><tr><td>Impact test (ºC)</td><td>${esc(eq.resiliencia_c ?? 'No')}</td></tr><tr><td>Service</td><td>${esc(eq.servicio)}</td></tr></table>` +
      (eq.croquis ? `<div class="croquis" style="flex:1;text-align:center"><img src="${eq.croquis}">${js.filter(j => j.mapa_x != null).map(j => `<span class="pin" style="left:${j.mapa_x * 100}%;top:${j.mapa_y * 100}%">${esc(j.marca)}</span>`).join('')}</div>` : '') + `</div></div>`;
  }
  $('#print').innerHTML = html; setTimeout(() => window.print(), 250);
}

/* ================= Arranque y login ================= */
async function start() {
  $('#login').style.display = 'none'; $('#app').style.display = 'flex'; renderNav(); go('inicio');
}
async function boot() {
  if (DEMO) return start();
  sb = supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  const { data } = await sb.auth.getSession();
  if (data.session) return start();
  $('#login').style.display = 'block';
  $('#lg_go').onclick = async () => { const { error } = await sb.auth.signInWithPassword({ email: $('#lg_mail').value, password: $('#lg_pass').value }); if (error) toast(error.message, true); else start(); };
}

/* ================= Datos de demostración ================= */
function seed() {
  const U = uuid;
  const d = {
    normas: [{ id: 1, codigo: 'ASME IX', sistema: 'ASME', ambito: 'otro' }, { id: 2, codigo: 'EN ISO 15614-1', sistema: 'ISO', ambito: 'PQR' }, { id: 3, codigo: 'EN ISO 15609-1', sistema: 'ISO', ambito: 'WPS' }, { id: 4, codigo: 'EN ISO 9606-1', sistema: 'ISO', ambito: 'WPQ' }],
    procesos: [{ id: 1, codigo_aws: 'SMAW', codigo_iso: '111' }, { id: 2, codigo_aws: 'GTAW', codigo_iso: '141' }, { id: 3, codigo_aws: 'SAW', codigo_iso: '12' }, { id: 4, codigo_aws: 'FCAW', codigo_iso: '136' }],
    materiales: [{ id: 1, especificacion: 'SA-516', grado: 'Gr.60', forma: 'plate', p_no: '1', group_no: '1', grupo_iso: '1.1' }, { id: 2, especificacion: 'SA-106', grado: 'Gr.B', forma: 'pipe', p_no: '1', group_no: '1', grupo_iso: '1.1' }, { id: 3, especificacion: 'SA-105', grado: '', forma: 'forging', p_no: '1', group_no: '2', grupo_iso: '1.2' }, { id: 4, especificacion: 'SA-240', grado: 'Tp.316L', forma: 'plate', p_no: '8', group_no: '1', grupo_iso: '8.1' }, { id: 5, especificacion: 'SA-182', grado: 'F316L', forma: 'forging', p_no: '8', group_no: '1', grupo_iso: '8.1' }],
    consumibles: [{ id: 1, clasificacion: 'E7018', proceso_id: 1, sfa: 'SFA-5.1', f_no: '4', a_no: '1' }, { id: 2, clasificacion: 'ER316L', proceso_id: 2, sfa: 'SFA-5.9', f_no: '6', a_no: '8' }],
    pqr: [], wps: [], wpq: [], soldadores: [], proyectos: [], equipos: [], juntas: [], welding_books: [], pqr_procesos: [], wps_procesos: [], wps_pqr: []
  };
  const p1 = U(), p2 = U(), w1 = U(), w2 = U(), w3 = U(), s1 = U(), pj = U();
  d.pqr.push({ id: p1, codigo: 'F019', revision: 0, norma_id: 1, estado: 'aprobado', tipo: 'penetracion', clase_material: '304L', p_no_1: '8', group_1: '1', p_no_2: '8', group_2: '1', espesor_mm: 9.5 }, { id: p2, codigo: 'F042', revision: 3, norma_id: 1, estado: 'aprobado', tipo: 'penetracion', clase_material: 'CS', p_no_1: '1', group_1: '1,2', p_no_2: '1', group_2: '1,2', espesor_mm: 20 });
  d.wps.push({ id: w1, codigo: 'F019/A2', revision: 5, norma_id: 1, estado: 'aprobado', tipo: 'penetracion', p_no_1: '8', group_1: '1', p_no_2: '8', group_2: '1', esp_min_mm: 1.6, esp_max_mm: 19, impacto_temp_c: null, pwht: false },
    { id: w2, codigo: 'F042/A1', revision: 3, norma_id: 1, estado: 'aprobado', tipo: 'penetracion', p_no_1: '1', group_1: '1,2', p_no_2: '1', group_2: '1,2', esp_min_mm: 4.8, esp_max_mm: 50, impacto_temp_c: null, pwht: true },
    { id: w3, codigo: 'F042/A3', revision: 2, norma_id: 1, estado: 'aprobado', tipo: 'filete', p_no_1: '1', group_1: '1,2', p_no_2: '1', group_2: '1,2', esp_min_mm: null, esp_max_mm: null, pwht: true });
  d.wps_pqr.push({ wps_id: w1, pqr_id: p1 }, { wps_id: w2, pqr_id: p2 }, { wps_id: w3, pqr_id: p2 });
  d.wps_procesos.push({ id: 1, wps_id: w1, orden: 1, proceso_id: 2 }, { id: 2, wps_id: w1, orden: 2, proceso_id: 1 }, { id: 3, wps_id: w2, orden: 1, proceso_id: 2 }, { id: 4, wps_id: w2, orden: 2, proceso_id: 1 }, { id: 5, wps_id: w3, orden: 1, proceso_id: 1 });
  d.pqr_procesos.push({ id: 1, pqr_id: p1, orden: 1, proceso_id: 2 }, { id: 2, pqr_id: p1, orden: 2, proceso_id: 1 });
  const y = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  d.soldadores.push({ id: s1, nombre: 'Soldador de ejemplo', codigo: 'S-001', empresa: 'Taller', activo: true });
  d.wpq.push({ id: U(), soldador_id: s1, norma_id: 4, numero: 'WPQ-001', proceso_id: 2, posicion: 'PF', espesor_mm: 6, fecha_ensayo: y(-300), fecha_vencimiento: y(40), estado: 'aprobado' });
  d.proyectos.push({ id: pj, cliente: 'CLIENTE DEMO', proyecto: 'Proyecto de ejemplo', pedido: 'PO-0001', referencia: 'REF-1', ubicacion: 'España' });
  d.welding_books.push({ id: U(), proyecto_id: pj, numero_doc: 'DEMO-01', revision: 0, estado: 'borrador', fecha: y(0), dibujado: 'J.A.M.P.', revisado: '', aprobado: '' });
  const eq = U(); d.equipos.push({ id: eq, proyecto_id: pj, item: 'NV-ME01', descripcion: 'Filtro de ejemplo', codigo_diseno: 'ASME VIII-1', presion_diseno: '5,3 kg/cm2 g', radiografia: 'Full', eficiencia_junta: 1, sobreespesor_corrosion_mm: 1.5, pwht: false, dureza: false, servicio: 'FUEL GAS' });
  d.juntas.push({ id: U(), equipo_id: eq, marca: '1', pieza1_desc: 'Shell', pieza1_od: '324', pieza1_material_id: 4, pieza1_esp_mm: 15, pieza2_desc: 'W.N. 300#', pieza2_od: '12"', pieza2_material_id: 5, pieza2_esp_mm: 10.3, tipo: 'penetracion', procesos: 'GTAW+SMAW', wps_id: w1 },
    { id: U(), equipo_id: eq, marca: '2', pieza1_desc: 'Shell', pieza1_od: '1067', pieza1_material_id: 1, pieza1_esp_mm: 15, pieza2_desc: 'Pipe Sch80', pieza2_od: '8"', pieza2_material_id: 2, pieza2_esp_mm: 12.7, tipo: 'penetracion', procesos: '', wps_id: null });
  return d;
}

window.addEventListener('keydown', e => { if (e.key === 'Escape') $('#modal').classList.add('hidden'); });
boot();
