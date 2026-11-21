/* WMAP · Motor de rangos de cualificación (módulo puro, sin DOM).
 * ASME IX: QW-451.1/451.2 (PQR), QW-452.1/452.3 (WPQ), QW-461.9 (posiciones).
 * EN ISO 15614-1 (Tabla 5, PQR) y EN ISO 9606-1 (Tablas 5-9, WPQ).
 * Los valores son orientativos: contrastar siempre con la edición vigente de la norma. */
(function (root) {
  'use strict';
  const R = {};
  const rnd = x => (x == null ? null : Math.round(x * 100) / 100);
  const nz = v => v !== null && v !== undefined && v !== '' && !isNaN(Number(v));
  const num = v => (nz(v) ? Number(v) : null);
  const fmtR = (a, b) => `${a == null ? '0' : rnd(a)} – ${b == null ? 'sin límite' : rnd(b)}`;
  R.fmtR = fmtR;

  /* ---------- utilidades de grupos ---------- */
  const lista = v => String(v == null ? '' : v).split(/[,;]/).map(s => s.trim()).filter(Boolean);
  const ASME_FUSION_200 = ['GTAW', 'GMAW', 'SMAW', 'SAW', 'PAW'];
  const POS_ISO2ASME = { PA: '1G', PC: '2G', PF: '3G', PE: '4G', PH: '5G', 'H-L045': '6G', PG: '3G', PB: '2F', PD: '4F' };

  /* ---------- ASME IX · PQR (QW-451) ---------- */
  R.asmeEspesorPQR = function (T, procs, impacto, tipo) {
    const notas = [];
    if (tipo === 'filete') return { min: null, max: null, notas: ['Probeta de filete: cualifica todos los espesores y diámetros de filete (QW-202.2).'] };
    if (!nz(T)) return { min: null, max: null, notas: ['Falta el espesor de la probeta.'] };
    T = Number(T); let min, max;
    if (T < 1.5) { min = T; max = 2 * T; }
    else if (T <= 10) { min = 1.5; max = 2 * T; }
    else if (T < 38) { min = 5; max = 2 * T; }
    else if (T <= 150) {
      min = 5;
      const all = (procs || []).length && procs.every(p => ASME_FUSION_200.includes(p));
      max = all ? 200 : 2 * T; if (!all) notas.push('T ≥ 38 mm: el máx. 200 mm solo aplica a GTAW/GMAW/SMAW/SAW/PAW; resto 2T.');
    } else { min = 5; max = 1.33 * T; }
    if (impacto) { min = T < 6 ? T / 2 : Math.min(T, 16); notas.push('Con ensayo de impacto (QW-403.6): espesor mínimo = T (máx. 16 mm); si T < 6 mm, T/2.'); }
    notas.push('Si alguna pasada supera 13 mm, el máximo se limita a 1,1T (QW-403.9). GMAW arco corto: 1,1T (QW-403.10).');
    return { min: rnd(min), max: rnd(max), notas };
  };
  R.asmeDepositoMax = (t, maxBase) => (t == null ? null : (t < 19 ? rnd(2 * t) : maxBase));

  R.pqrRangos = function (pqr, procs, sistema) {
    // procs: [{aws, iso, t_dep}]
    const out = { items: [], notas: [], esp: { min: null, max: null }, dia: null, sistema };
    const aws = (procs || []).map(p => p.aws).filter(Boolean);
    if (sistema === 'ISO') {
      const multi = pqr.multipasada !== false;
      const e = R.isoEspesorPQR(num(pqr.espesor_mm), multi, pqr.tipo);
      out.esp = { min: e.min, max: e.max }; out.notas.push(...e.notas);
      out.items.push(['Espesor de material cualificado', fmtR(e.min, e.max) + ' mm']);
      const D = num(pqr.diametro_mm);
      if (D == null) { out.dia = { min: 500, max: null }; out.items.push(['Diámetro (probeta chapa)', 'tubos ≥ 500 mm (y chapa)']); }
      else if (D <= 25) { out.dia = { min: rnd(0.5 * D), max: rnd(2 * D) }; out.items.push(['Diámetro exterior', fmtR(0.5 * D, 2 * D) + ' mm']); }
      else { out.dia = { min: rnd(Math.max(0.5 * D, 25)), max: null }; out.items.push(['Diámetro exterior', '≥ ' + rnd(Math.max(0.5 * D, 25)) + ' mm']); }
      out.items.push(['Posiciones', R.isoPosicionPQR(pqr.posicion, nz(pqr.impacto_temp_c))]);
      out.items.push(['Procesos', (procs || []).map(p => p.iso || p.aws).join(' + ') || '—']);
      if (pqr.tipo === 'filete' && !multi) out.notas.push('Filete monopasada: garganta a cualificada = 0,75a – 1,5a.');
      out.notas.push('ISO 15614-1: un cambio de grupo de material, proceso, consumible o aporte térmico fuera de tolerancia exige nuevo PQR.');
    } else {
      const e = R.asmeEspesorPQR(num(pqr.espesor_mm), aws, nz(pqr.impacto_temp_c), pqr.tipo);
      out.esp = { min: e.min, max: e.max }; out.notas.push(...e.notas);
      out.items.push(['Espesor de metal base cualificado', e.min == null && e.max == null ? 'todos' : fmtR(e.min, e.max) + ' mm']);
      out.items.push(['Depósito máx. por proceso', (procs || []).map(p => { const m = R.asmeDepositoMax(num(p.t_dep) ?? (procs.length === 1 ? num(pqr.espesor_mm) : null), e.max); return `${p.aws || p.iso}: ${m == null ? 'indicar t' : m + ' mm'}`; }).join(' · ') || '—']);
      out.items.push(['Diámetro', 'no esencial en PQR (cualquiera)']);
      out.items.push(['Posiciones', 'cualquiera (QW-405: posición no esencial, salvo variable suplementaria)']);
      out.items.push(['P-No / Group', `${pqr.p_no_1 || '?'}/${pqr.group_1 || '?'} con ${pqr.p_no_2 || '?'}/${pqr.group_2 || '?'} — ver QW-420 para extensiones`]);
      if (pqr.pwht) out.notas.push('PWHT (QW-407): el WPS solo es válido con PWHT dentro del rango y espesor ensayado.');
      out.items.push(['Impacto', nz(pqr.impacto_temp_c) ? `ensayado a ${pqr.impacto_temp_c} °C` : 'no ensayado']);
    }
    return out;
  };

  /* ---------- ISO 15614-1 (Tabla 5) ---------- */
  R.isoEspesorPQR = function (t, multi, tipo) {
    if (!nz(t)) return { min: null, max: null, notas: ['Falta el espesor de la probeta.'] };
    t = Number(t); let min, max; const notas = [];
    if (tipo === 'filete') {
      if (t <= 3) { min = 0.7 * t; max = 2 * t; }
      else if (t < 30) { min = Math.max(3, 0.5 * t); max = 1.2 * t; }
      else { min = 5; max = null; }
      return { min: rnd(min), max: rnd(max), notas: ['Espesor de filete según ISO 15614-1 (Tabla 6).'] };
    }
    if (multi) {
      if (t <= 3) { min = 0.7 * t; max = 2 * t; }
      else if (t <= 12) { min = 3; max = 2 * t; }
      else if (t <= 100) { min = 0.5 * t; max = 2 * t; }
      else { min = 50; max = 2 * t; }
    } else {
      if (t <= 3) { min = 0.7 * t; max = 1.3 * t; }
      else if (t <= 12) { min = Math.max(3, 0.5 * t); max = 1.3 * t; }
      else if (t <= 100) { min = 0.5 * t; max = 1.1 * t; }
      else { return { min: null, max: null, notas: ['t > 100 mm monopasada: no aplicable.'] }; }
      notas.push('Probeta monopasada: rango reducido (0,5t/0,7t – 1,1t/1,3t).');
    }
    if (t > 12) notas.push('Con ensayos de impacto y t > 12 mm, revisar limitaciones adicionales de la Tabla 5 (edición vigente).');
    return { min: rnd(min), max: rnd(max), notas };
  };
  R.isoPosicionPQR = function (pos, impacto) {
    const p = String(pos || '').toUpperCase();
    if (/^(PG|PJ|J-L045)$/.test(p)) return `solo ${p} (descendente)`;
    return 'todas, salvo descendentes (PG, PJ, J-L045)' + (impacto ? ' · con impacto: verificar apdo. 8.4.2' : '');
  };

  /* ---------- ISO 9606-1 (Tablas 5-9) ---------- */
  const isoTh = t => (t < 3 ? { min: t, max: 2 * t } : t <= 12 ? { min: 3, max: 2 * t } : { min: 5, max: null });
  const ISO_POS = {
    PA: ['PA'], PC: ['PA', 'PC'], PF: ['PA', 'PF'], PG: ['PG'], PE: ['PA', 'PC', 'PF', 'PE'],
    PH: ['PA', 'PF', 'PH'], 'H-L045': ['PA', 'PC', 'PE', 'PF', 'PH', 'H-L045'], PJ: ['PJ'], 'J-L045': ['PG', 'PJ', 'J-L045'],
    PB: ['PA', 'PB'], PD: ['PA', 'PB', 'PD']
  };
  R.isoWPQ = function (w) {
    const out = { items: [], notas: [], esp: { min: null, max: null }, dia: null };
    const t = num(w.espesor_mm), s = num(w.espesor_depositado_mm);
    const base = isoTh(t != null ? t : 0);
    if (t != null) { out.esp = { min: rnd(base.min), max: rnd(base.max) }; out.items.push(['Espesor de material t', fmtR(base.min, base.max) + ' mm']); }
    if (s != null) { const d = isoTh(s); out.items.push(['Espesor depositado s', fmtR(d.min, d.max) + ' mm']); out.dep = { min: rnd(d.min), max: rnd(d.max) }; }
    const D = num(w.diametro_mm);
    if (D == null) { out.dia = { min: 500, max: null }; out.items.push(['Diámetro exterior', 'tubos ≥ 500 mm (probeta en chapa)']); }
    else if (D <= 25) { out.dia = { min: rnd(D), max: rnd(2 * D) }; out.items.push(['Diámetro exterior', fmtR(D, 2 * D) + ' mm']); }
    else { out.dia = { min: rnd(Math.max(0.5 * D, 25)), max: null }; out.items.push(['Diámetro exterior', '≥ ' + rnd(Math.max(0.5 * D, 25)) + ' mm y chapa']); }
    const p = String(w.posicion || '').toUpperCase();
    out.pos = ISO_POS[p] || (p ? [p] : []);
    out.items.push(['Posiciones', out.pos.join(', ') || '—']);
    out.items.push(['Tipo de unión', w.tipo === 'filete' ? 'solo filete (FW)' : 'solo a tope (BW); para filetes, ensayo de filete adicional']);
    out.items.push(['Proceso', 'solo el ensayado (' + (w.proceso_txt || '—') + ')']);
    out.notas.push('Posiciones: tabla simplificada de ISO 9606-1 (Tablas 9-10); verificar con la norma.');
    out.notas.push('Validez: 3 años con confirmación del empleador cada 6 meses (apdo. 9.3-9.4).');
    return out;
  };

  /* ---------- ASME IX · WPQ (QW-452) ---------- */
  const ALL = ['F', 'H', 'V', 'O'];
  const ASME_POS = {
    '1G': { g: ['F'], f: ['F', 'H'] }, '2G': { g: ['F', 'H'], f: ['F', 'H'] }, '3G': { g: ['F', 'V'], f: ['F', 'H', 'V'] }, '4G': { g: ['F', 'O'], f: ['F', 'H', 'O'] },
    '3G+4G': { g: ALL, f: ALL }, '5G': { g: ['F', 'V', 'O'], f: ALL }, '6G': { g: ALL, f: ALL }, '2G+5G': { g: ALL, f: ALL },
    '1F': { f: ['F'] }, '2F': { f: ['F', 'H'] }, '3F': { f: ['F', 'H', 'V'] }, '4F': { f: ['F', 'H', 'O'] }
  };
  R.asmeWPQ = function (w) {
    const out = { items: [], notas: [], esp: { min: null, max: null }, dia: null };
    const t = num(w.espesor_depositado_mm) ?? num(w.espesor_mm), capas = num(w.capas);
    if (t != null) {
      const ilimit = t >= 13 && capas != null && capas >= 3;
      out.dep = { min: null, max: ilimit ? null : rnd(2 * t) };
      out.items.push(['Espesor de metal depositado', ilimit ? 'máximo a soldar según WPS (t ≥ 13 mm, ≥ 3 capas)' : '≤ ' + rnd(2 * t) + ' mm (2t)']);
      if (t >= 13 && !(capas >= 3)) out.notas.push('t ≥ 13 mm: indica nº de capas (≥ 3) para cualificar "máximo a soldar".');
    }
    out.items.push(['Espesor de metal base', 'sin límite propio; lo limita el WPS (QW-452.1)']);
    const od = num(w.diametro_mm);
    if (w.tipo === 'filete') out.items.push(['Diámetro', 'según QW-452.4 (filete)']);
    else if (od == null) { out.dia = { min: 610, max: null }; out.items.push(['Diámetro (probeta en chapa)', 'tubos de OD ≥ 610 mm (24") y chapa']); }
    else { const mn = od < 25 ? od : od <= 73 ? 25 : 73; out.dia = { min: mn, max: null }; out.items.push(['Diámetro exterior (QW-452.3)', '≥ ' + mn + ' mm (ilimitado)']); }
    let p = String(w.posicion || '').toUpperCase().replace(/\s/g, ''); p = POS_ISO2ASME[p] || p;
    const q = ASME_POS[p];
    out.items.push(['Posiciones a tope (ASME)', q && q.g ? q.g.join(', ') : '—']);
    out.items.push(['Posiciones de filete (ASME)', q && q.f ? q.f.join(', ') : '—']);
    out.pos = q ? (w.tipo === 'filete' ? q.f : q.g) : [];
    out.items.push(['F-No ensayado', (w.f_no || '—') + ' (ver QW-433)']);
    out.items.push(['Proceso', 'solo el ensayado (' + (w.proceso_txt || '—') + ')']);
    out.notas.push('Posiciones: QW-461.9 simplificado; verificar con la edición vigente.');
    out.notas.push('Continuidad: la cualificación caduca si el soldador no suelda con el proceso durante 6 meses (QW-322.1).');
    return out;
  };

  R.wpqRangos = (w, sistema) => (sistema === 'ISO' ? R.isoWPQ(w) : R.asmeWPQ(w));

  /* ---------- Validación WPS ↔ PQR ---------- */
  const ISO12 = { '12': 'SAW', '121': 'SAW' };
  R.validarWPS = function (wps, pqrs, wpsProcs) {
    // pqrs: [{pqr, procs:[{aws,iso,t_dep}], sistema}] ; wpsProcs: ['GTAW','SMAW'...]
    const items = []; const add = (nivel, msg) => items.push({ nivel, msg });
    if (!pqrs.length) { add('error', 'El WPS no tiene ningún PQR asociado.'); return fin(items); }
    const sw = wps.sistema || pqrs[0].sistema;
    if (pqrs.some(p => p.sistema !== sw)) add('aviso', 'El WPS mezcla PQR de ASME e ISO.');
    const rg = pqrs.map(p => ({ p, r: R.pqrRangos(p.pqr, p.procs, p.sistema) }));
    // tipo
    const tipoW = wps.tipo;
    if (tipoW === 'penetracion' && !pqrs.some(x => x.pqr.tipo === 'penetracion')) add('error', 'WPS de penetración sin PQR de penetración.');
    if (tipoW === 'filete' && !pqrs.some(x => x.pqr.tipo === 'filete' || x.sistema === 'ASME')) add('aviso', 'WPS de filete: solo hay PQR a tope en ISO (comprobar Tabla 6).');
    // material
    const cubre = (x) => {
      const a = x.pqr; const asme = x.sistema === 'ASME';
      const f = (pn, gr, pn2, gr2) => asme
        ? (!pn || String(pn) === String(pn2)) /* QW-424: se cualifica por P-No; el Group solo importa con impacto (QW-403.5) */
        : (!pn || lista(pn).every(g => lista(pn2).includes(g)));
      const a1 = asme ? f(wps.p_no_1, wps.group_1, a.p_no_1, a.group_1) : f(wps.grupo_iso_1, null, a.grupo_iso_1);
      const a2 = asme ? f(wps.p_no_2, wps.group_2, a.p_no_2, a.group_2) : f(wps.grupo_iso_2, null, a.grupo_iso_2);
      const b1 = asme ? f(wps.p_no_1, wps.group_1, a.p_no_2, a.group_2) : f(wps.grupo_iso_1, null, a.grupo_iso_2);
      const b2 = asme ? f(wps.p_no_2, wps.group_2, a.p_no_1, a.group_1) : f(wps.grupo_iso_2, null, a.grupo_iso_1);
      return (a1 && a2) || (b1 && b2);
    };
    const hayDatosMat = pqrs.some(x => x.sistema === 'ASME' ? x.pqr.p_no_1 : x.pqr.grupo_iso_1);
    if (hayDatosMat && !pqrs.some(cubre)) add('error', 'Ningún PQR cubre la combinación de materiales del WPS (P-No/Group o grupo ISO).');
    else if (!hayDatosMat) add('aviso', 'Los PQR no tienen P-No/Group ni grupo ISO: no se puede validar el material.');
    // espesor: unión de rangos
    const iv = rg.map(x => x.r.esp).filter(e => !(e.min == null && e.max == null)).sort((a, b) => (a.min ?? 0) - (b.min ?? 0));
    const todos = rg.some(x => x.r.esp.min == null && x.r.esp.max == null && (x.p.pqr.tipo === 'filete'));
    if (!todos && tipoW !== 'filete') {
      const wmin = num(wps.esp_min_mm) ?? 0, wmax = num(wps.esp_max_mm);
      let cur = null, cov = [];
      for (const e of iv) { if (cur && (e.min ?? 0) <= (cur.max ?? Infinity) + 1e-9) cur.max = (cur.max == null || e.max == null) ? null : Math.max(cur.max, e.max); else { cur = { min: e.min ?? 0, max: e.max }; cov.push(cur); } }
      const dentro = cov.some(c => wmin >= c.min - 1e-9 && (c.max == null || (wmax != null && wmax <= c.max + 1e-9)));
      if (iv.length && !dentro) add('error', `Espesor del WPS (${fmtR(wmin, wmax)} mm) fuera de lo cualificado por los PQR (${cov.map(c => fmtR(c.min, c.max)).join(' ∪ ')} mm).`);
      else if (iv.length) add('ok', `Espesor cubierto: ${cov.map(c => fmtR(c.min, c.max)).join(' ∪ ')} mm.`);
    }
    // impacto
    const imp = num(wps.impacto_temp_c);
    if (imp != null) {
      const ok = pqrs.some(x => nz(x.pqr.impacto_temp_c) && Number(x.pqr.impacto_temp_c) <= imp);
      if (!ok) add('error', `WPS con impacto a ${imp} °C y ningún PQR ensayado a esa temperatura o inferior.`);
      else add('ok', 'Impacto cubierto por PQR.');
    }
    // PWHT
    const pw = !!wps.pwht;
    if (!pqrs.some(x => !!x.pqr.pwht === pw)) add('error', `PWHT del WPS (${pw ? 'sí' : 'no'}) no coincide con ningún PQR.`);
    // procesos
    const pqrAws = new Set(); pqrs.forEach(x => x.procs.forEach(p => { if (p.aws) pqrAws.add(p.aws); else if (ISO12[p.iso]) pqrAws.add('SAW'); }));
    const falta = (wpsProcs || []).filter(p => !pqrAws.has(p));
    if (falta.length) add('error', `Proceso(s) sin PQR: ${falta.join(', ')}.`);
    else if ((wpsProcs || []).length) add('ok', 'Procesos cubiertos por PQR.');
    if (!wps.revision && wps.revision !== 0) add('aviso', 'WPS sin revisión.');
    return fin(items);
    function fin(it) {
      const estado = it.some(i => i.nivel === 'error') ? 'error' : it.some(i => i.nivel === 'aviso') ? 'aviso' : 'ok';
      return { estado, items: it };
    }
  };

  /* ---------- Continuidad y caducidad de WPQ ---------- */
  const addMonths = (d, m) => { const x = new Date(d); const day = x.getDate(); x.setMonth(x.getMonth() + m); if (x.getDate() < day) x.setDate(0); return x; };
  const iso = d => (d ? new Date(d).toISOString().slice(0, 10) : null);
  R.estadoWPQ = function (wpq, registros, sistema, hoy) {
    hoy = hoy ? new Date(hoy) : new Date();
    const regs = (registros || []).filter(r => r.fecha).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    const ensayo = wpq.fecha_ensayo ? new Date(wpq.fecha_ensayo) : null;
    const ult = a => regs.filter(a).map(r => r.fecha).pop();
    const ultAct = ult(r => true);
    const base = ultAct ? new Date(ultAct) : ensayo;
    const fechas = [];
    if (base) fechas.push({ k: sistema === 'ISO' ? 'Confirmación 6 meses' : 'Continuidad 6 meses (QW-322)', d: addMonths(base, 6) });
    if (sistema === 'ISO') {
      const rev = ult(r => r.tipo === 'revalidacion');
      const ini = rev ? new Date(rev) : ensayo; if (ini) fechas.push({ k: 'Validez 3 años', d: addMonths(ini, 36) });
    }
    if (wpq.fecha_vencimiento) fechas.push({ k: 'Fecha de vencimiento indicada', d: new Date(wpq.fecha_vencimiento) });
    if (!fechas.length) return { estado: 'sin-datos', due: null, motivo: 'Sin fecha de ensayo', ultimo: null, dias: null };
    fechas.sort((a, b) => a.d - b.d); const f = fechas[0];
    const dias = Math.floor((f.d - hoy) / 864e5);
    const estado = dias < 0 ? 'vencida' : dias <= 30 ? 'critica' : dias <= 60 ? 'proxima' : 'ok';
    return { estado, due: iso(f.d), motivo: f.k, ultimo: ultAct || iso(ensayo), dias, fechas: fechas.map(x => ({ k: x.k, d: iso(x.d) })) };
  };

  /* ---------- ¿Puede el soldador soldar esta junta? ---------- */
  R.soldadorOk = function (wpqs, junta, hoy) {
    // wpqs: [{wpq, estado, rangos, procAws}] ; junta: {esp, tipo, procesos:[aws]}
    const motivos = [];
    if (!wpqs.length) return { ok: false, motivos: ['El soldador no tiene ninguna WPQ.'] };
    const cands = wpqs.filter(x => (junta.procesos || []).length === 0 || (junta.procesos || []).includes(x.procAws));
    if (!cands.length) return { ok: false, motivos: ['Ninguna WPQ del soldador cubre los procesos de la junta (' + (junta.procesos || []).join('+') + ').'] };
    const vig = cands.filter(x => !['vencida'].includes(x.estado));
    if (!vig.length) return { ok: false, motivos: ['Las WPQ del proceso están vencidas.'] };
    const dentro = vig.filter(x => junta.esp == null || !x.rangos.esp || (x.rangos.esp.min == null || junta.esp >= x.rangos.esp.min) && (x.rangos.esp.max == null || junta.esp <= x.rangos.esp.max) || x.rangos.dep && (x.rangos.dep.max == null || junta.esp <= x.rangos.dep.max));
    if (!dentro.length) return { ok: false, motivos: ['Espesor de la junta (' + junta.esp + ' mm) fuera del rango de la WPQ.'] };
    return { ok: true, motivos: [] };
  };

  root.WMAPR = R;
  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
