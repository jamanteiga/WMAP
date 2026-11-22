/* WMAP · plantillas Facet de WPS (2 hojas) y PQR (3 hojas) ASME IX. Datos de detalle en la columna jsonb `datos`
 * (claves planas con puntos: 'aport.sfa.0', 'el.1.amps'…). Se carga después de modulos.js. */
'use strict';
(function () {
  const NC = 3, CKB = b => (b ? '☒' : '☐');
  const gv = (d, k) => (d[k] == null ? '' : d[k]);
  const bi = (es, en) => `${es}<small>${en}</small>`;

  /* ---------- CSS ---------- */
  const css = document.createElement('style');
  css.textContent = `
  .fm{width:198mm;height:284mm;position:relative;overflow:hidden;page-break-after:always;font:8.5px/1.25 Arial,Helvetica,sans-serif;color:#000;background:#fff;box-sizing:border-box;border:1px solid #000}
  .fm:last-child{page-break-after:auto}
  .fm table{width:100%;border-collapse:collapse;table-layout:fixed}
  .fm td,.fm th{border:1px solid #000;padding:1.5px 3px;vertical-align:middle;word-wrap:break-word;overflow-wrap:anywhere}
  .fm th{font-weight:bold;text-align:center;background:#fff!important;color:#000!important;font-size:7.5px!important;text-transform:none!important;letter-spacing:0!important}
  .fm small{display:block;font-size:6.5px;color:#222;font-weight:normal}
  .fm .l{text-align:left} .fm .c{text-align:center} .fm .t{font-weight:bold;text-align:center;font-size:8.5px;background:#fff;border-left:0;border-right:0}
  .fm .h1{font-size:12px;font-weight:bold;text-align:center;line-height:1.1;padding:8px 0 4px;border:0;text-decoration:underline}
  .fm .fh td{height:13mm;font-size:9px}.fm .fh .lg{width:60mm;font-size:16px;font-weight:bold}.fm .fh img{max-height:11mm;max-width:56mm}
  .fm .fh .hs{width:12mm;font-size:8px}.fm .fh .hn{width:9mm;text-align:center;font-size:11px}
  .fm .nb td{border:0} .fm .ck{font-size:10px;white-space:nowrap}
  .fm .big{font-size:11px;font-weight:bold}
  .fm .sk{height:48mm;text-align:center;position:relative}.fm .sk svg,.fm .sk img{max-width:100%;max-height:46mm}
  .fm .g{height:14px}
  `;
  document.head.appendChild(css);

  /* ---------- croquis esquemático (V / X / filete) ---------- */
  function svgJunta(kind, ang, tlabel) {
    const a = Math.max(20, Math.min(90, Number(ang) || 60)) * Math.PI / 360, tn = Math.tan(a);
    const W = 260, H = 120;
    if (kind === 'filete') {
      return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><polygon points="20,70 240,70 240,100 20,100" fill="#ddd" stroke="#000"/><polygon points="120,70 120,10 150,10 150,70" fill="#ddd" stroke="#000"/><polygon points="150,70 150,45 175,70" fill="#999" stroke="#000"/><polygon points="120,70 120,45 95,70" fill="#999" stroke="#000"/><text x="185" y="40" font-size="10">filete / fillet</text><text x="250" y="88" font-size="9" text-anchor="end">${tlabel || ''}</text></svg>`;
    }
    const cx = W / 2, g = 6, y0 = 20, y1 = 96, rf = 6, o = (y1 - rf - y0) * tn, doble = kind === 'X';
    let L, Rr, fill;
    if (!doble) {
      L = `10,${y0} ${cx - g / 2 - o},${y0} ${cx - g / 2},${y1 - rf} ${cx - g / 2},${y1} 10,${y1}`;
      Rr = `${W - 10},${y0} ${cx + g / 2 + o},${y0} ${cx + g / 2},${y1 - rf} ${cx + g / 2},${y1} ${W - 10},${y1}`;
      fill = `${cx - g / 2 - o},${y0} ${cx + g / 2 + o},${y0} ${cx + g / 2},${y1 - rf} ${cx - g / 2},${y1 - rf}`;
    } else {
      const ym = (y0 + y1) / 2, oo = (ym - y0 - rf / 2) * tn;
      L = `10,${y0} ${cx - g / 2 - oo},${y0} ${cx - g / 2},${ym - rf / 2} ${cx - g / 2},${ym + rf / 2} ${cx - g / 2 - oo},${y1} 10,${y1}`;
      Rr = `${W - 10},${y0} ${cx + g / 2 + oo},${y0} ${cx + g / 2},${ym - rf / 2} ${cx + g / 2},${ym + rf / 2} ${cx + g / 2 + oo},${y1} ${W - 10},${y1}`;
      fill = `${cx - g / 2 - oo},${y0} ${cx + g / 2 + oo},${y0} ${cx + g / 2},${ym - rf / 2} ${cx + g / 2},${ym + rf / 2} ${cx + g / 2 + oo},${y1} ${cx - g / 2 - oo},${y1} ${cx - g / 2},${ym + rf / 2} ${cx - g / 2},${ym - rf / 2}`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><polygon points="${L}" fill="#ddd" stroke="#000"/><polygon points="${Rr}" fill="#ddd" stroke="#000"/><polygon points="${fill}" fill="#999" stroke="#000" stroke-dasharray="2 1"/><text x="${cx}" y="12" font-size="10" text-anchor="middle">${Math.round(a * 360 / Math.PI)}°</text><text x="${W - 12}" y="${(y0 + y1) / 2 + 3}" font-size="10" text-anchor="end">${tlabel ? 't = ' + tlabel : 't'}</text><text x="${cx}" y="${H - 6}" font-size="8" text-anchor="middle">raíz / root gap</text></svg>`;
  }
  const sketch = (d, kind) => (d.croquis ? `<img src="${d.croquis}">` : svgJunta(kind || (d.dis === 'X' ? 'X' : 'V'), d.ang, d.esp));

  /* ---------- contexto ---------- */
  async function ctx(ent, row) {
    const aj = await getAj(), s = sist(row.norma_id), d = { ...(row.datos || {}) };
    let procs = [], pqrs = [];
    if (ent.table === 'pqr') procs = (await procsPQR(row.id)).map(p => p.aws || p.iso);
    else if (ent.table === 'wps') { const V = await loadVal(); procs = V.wprocs.filter(x => x.wps_id == row.id).sort(byOrden).map(x => pAws(x.proceso_id)); pqrs = V.wp.filter(x => x.wps_id == row.id).map(x => (L.pqr.find(p => p.id == x.pqr_id) || {}).codigo).filter(Boolean); }
    return { aj, s, d, row, procs: [0, 1, 2].map(i => d['col.' + i] || procs[i] || ''), allProcs: procs, pqrs, ent };
  }

  /* ---------- bloques ---------- */
  const hdr = (c, n, N, mid) => `<table class="fh"><tr><td class="lg">${c.aj.logo ? `<img src="${c.aj.logo}">` : esc(c.aj.empresa || 'Facet International')}</td>${mid || '<td></td>'}<td class="hs">${bi('Hoja', 'Sheet')}</td><td class="hn">${n}</td><td class="hs">${bi('De', 'of')}</td><td class="hn">${N}</td></tr></table>`;
  const midDoc = (c, tipo) => `<td style="width:70mm"><table style="border:0"><tr><td style="border:0;width:22mm">${tipo} Nº</td><td style="border:0;width:30mm;font-size:10px">${esc(c.row.codigo)}</td><td style="border:0;width:10mm">Rev.</td><td style="border:0">${esc(c.row.revision ?? '')}</td></tr></table></td>`;
  const titulo = (es, en) => `<div class="h1">${es}<br>${en}</div>`;
  const procChecks = c => ['SMAW', 'SAW', 'GTAW', 'GMAW', 'EGW'].map(p => `<span class="ck">${CKB(c.allProcs.includes(p))} ${p}</span>`).join(' &nbsp;');
  const tipoChecks = c => [['manual', 'Manual', 'Manual'], ['semi', 'Semi Auto.', 'Semi Auto.'], ['auto', 'Automático', 'Automatic'], ['maq', 'Máquina', 'Machine']].map(([k, a]) => `<span class="ck">${CKB((c.d.tipoaplic || 'manual') === k)} ${a}</span>`).join(' &nbsp;');
  const sec = t => `<tr><td colspan="9" class="t">${t}</td></tr>`;
  const secT = t => `<table><tr><td class="t" style="border-bottom:1px solid #000;border-top:1px solid #000">${t}</td></tr></table>`;
  const prow = (c, k, es, en, cls) => `<tr><td class="l" style="width:34%">${bi(es, en)}</td>${[0, 1, 2].map(i => `<td class="c">${esc(gv(c.d, k + '.' + i))}</td>`).join('')}</tr>`;
  const phead = c => `<tr><th></th>${[0, 1, 2].map(i => `<th>${esc(c.procs[i])}</th>`).join('')}</tr>`;
  const ft = (a, b) => (a != null && a !== '' ? a : b);

  function bloqueMetalBase(c, esPQR) {
    const r = c.row, d = c.d, P = (a, b) => ft(a, b ?? '');
    return `${secT('METAL BASE/BASE METAL (QW-403)')}<table>
      <tr><td class="l" style="width:14%">P Nº</td><td class="c big" style="width:12%">${esc(r.p_no_1)}</td><td class="l" style="width:14%">${bi('(Grupo/Group)', '')}</td><td class="c" style="width:12%">${esc(r.group_1)}</td><td class="l" style="width:14%">${bi('a/to P Nº', '')}</td><td class="c big" style="width:12%">${esc(r.p_no_2)}</td><td class="l" style="width:14%">${bi('(Grupo/Group)', '')}</td><td class="c">${esc(r.group_2)}</td></tr></table>
      <table><tr><td class="l" style="width:34%">${bi('Especificación Tipo - Grado', 'Specification Type-Grade')}</td><td>${esc(gv(d, 'mb.esp1'))}</td></tr>
      <tr><td class="l">${bi('a Especificación Tipo - Grado', 'To Specification Type-Grade')}</td><td>${esc(gv(d, 'mb.esp2'))}</td></tr>
      <tr><td class="l">${bi('Análisis químico y Propiedades Mecánicas', 'Chemical Analysis and Mechanical Properties')}</td><td>${esc(gv(d, 'mb.an1'))}</td></tr>
      <tr><td class="l">${bi('A Análisis químico y Propiedades Mecánicas', 'To Chemical Analysis and Mechanical Properties')}</td><td>${esc(gv(d, 'mb.an2'))}</td></tr>
      ${esPQR ? `<tr><td class="l">${bi('Espesor de cupón', 'Thickness of test coupon')}</td><td>Chaflán / Groove: <b>${esc(ft(d['mb.cg'], r.espesor_mm != null ? r.espesor_mm + ' mm' : ''))}</b> &nbsp;&nbsp; Ángulo / Fillet: <b>${esc(gv(d, 'mb.cf'))}</b></td></tr>
        <tr><td class="l">${bi('Diámetro del cupón', 'Diameter of test coupon')}</td><td>${esc(gv(d, 'mb.dia'))} &nbsp;&nbsp; Pasada t &gt; 12 mm / t pass &gt; ½ inch: ${CKB(d.pas12 === 'Sí')} Sí/Yes ${CKB(d.pas12 !== 'Sí')} No</td></tr>`
        : `<tr><td class="l">${bi('Rango de espesores', 'Thickness range')}</td><td>Chaflán / Groove: <b>${esc(ft(d['mb.rg'], R_.fmtR(r.esp_min_mm, r.esp_max_mm) + ' mm'))}</b> &nbsp;&nbsp; Ángulo / Fillet: <b>${esc(gv(d, 'mb.rf'))}</b></td></tr>
        <tr><td class="l">T &gt; 8": ${CKB(d.t8 === 'Sí')} Sí/Yes ${CKB(d.t8 !== 'Sí')} No</td><td>Pasada t &gt; 12 mm / t pass &gt; ½ inch: ${CKB(d.pas12 === 'Sí')} Sí/Yes ${CKB(d.pas12 !== 'Sí')} No</td></tr>`}
      <tr><td class="l">${bi('Otros', 'Others')}</td><td>${esc(gv(d, 'mb.otros'))}</td></tr></table>`;
  }
  function bloqueFiller(c, esPQR) {
    return `${secT(`${bi('METAL APORTACIÓN', 'FILLER METAL (QW-404)')}`)}<table>${phead(c)}
      ${prow(c, 'ap.sfa', 'Especificación Nº (SFA)', 'Spec. Nº (SFA)')}${prow(c, 'ap.aws', 'AWS Nº (Class)', '')}${prow(c, 'ap.fno', 'F Nº', '')}${prow(c, 'ap.ano', 'A Nº', '')}${prow(c, 'ap.tam', 'Tamaño metal aportación', 'Size of filler metal')}${prow(c, 'ap.dep', 'Metal depositado', 'Weld Metal')}
      <tr><td class="l" colspan="4">${bi('Rango de espesores / Espesor', 'Thickness range / Thickness')}</td></tr>${prow(c, 'ap.eg', '&nbsp;&nbsp;Chaflán', 'Groove')}${prow(c, 'ap.ef', '&nbsp;&nbsp;Ángulo', 'Fillet')}${prow(c, 'ap.flux', 'Electrodo-Flux (Clase)', 'Electrode-Flux (Class)')}${prow(c, 'ap.marca', 'Marca flux', 'Trade Name of flux')}${prow(c, 'ap.ins', 'Insertos Consumibles', 'Consumable Insert')}
      <tr><td class="l">${bi('Otros', 'Others')}</td><td colspan="3">${esc(gv(c.d, 'ap.otros'))}</td></tr></table>`;
  }
  function bloqueUniones(c) {
    const d = c.d, dis = d.dis || '';
    return `${secT('UNIONES / JOINTS (QW402)')}<table class="nb"><tr><td colspan="7" class="l" style="border:0">Diseño de la Unión / <i>Joint Design</i></td></tr><tr>${['V', 'X', 'U', 'K', 'Y', 'J', 'Otro/Others'].map(x => `<td class="ck" style="border:0">${CKB(dis === x)} ${x}</td>`).join('')}</tr></table>
    <table><tr><td class="c" style="width:22%">&nbsp;</td><td class="c"><b>YES / NO</b></td><td class="c">en /in <b>Process</b></td><td class="c"><b>Tipo / Type</b></td></tr>
    ${[0, 1, 2].map(i => `<tr>${i === 0 ? `<td class="l" rowspan="3">${bi('Soporte / Backing', '')}</td>` : ''}<td class="c">${esc(gv(d, 'sop.' + i + '.yn'))}</td><td class="c">${esc(gv(d, 'sop.' + i + '.proc'))}</td><td class="c">${esc(gv(d, 'sop.' + i + '.tipo'))}</td></tr>`).join('')}
    <tr><td class="l">${bi('Retenedores / Retainers', '')}</td><td class="c" colspan="3">${esc(gv(d, 'ret'))}</td></tr></table>
    <table class="nb"><tr><td class="ck" style="border:0">${CKB((d.metal || 'metal') === 'metal')} Metálico / Metal</td><td class="ck" style="border:0">${CKB(d.metal === 'nometal')} No Metálico / Non Metalic</td><td style="border:0" class="ck">${CKB(d.metal === 'nofund')} Metal no Fundible / Non Fusing metal</td><td style="border:0" class="ck">${CKB(d.metal === 'otros')} Otros / Others</td></tr></table>`;
  }
  const bloquePosicion = (c, pqr) => `<table><tr><td class="t" style="width:50%;border-top:1px solid #000">POSICIÓN / POSITION (QW-405)</td><td class="t" style="border-top:1px solid #000">TRATAMIENTO TÉRMICO POSTSOLDEO / POSTWELD HEAT TREATMENT (QW-407)</td></tr>
    <tr><td style="padding:0"><table style="border:0"><tr><td class="l" style="border:0;border-bottom:1px solid #000">${bi('Posición(es) de Chaflán', 'Position(s) of Groove')}</td><td class="c big" style="border:0;border-bottom:1px solid #000">${esc(gv(c.d, 'pos.g'))}</td></tr><tr><td class="l" style="border:0;border-bottom:1px solid #000">${bi('Progresión de Soldeo', 'Weld progression')}</td><td class="ck" style="border:0;border-bottom:1px solid #000">${CKB(c.d['pos.prog'] === 'asc')} Ascendente ${CKB(c.d['pos.prog'] === 'desc')} Descendente</td></tr><tr><td class="l" style="border:0">${bi(pqr ? 'Otros' : 'Posición(es) de Ángulo', pqr ? 'Others' : 'Position(s) of Fillet')}</td><td class="c big" style="border:0">${esc(gv(c.d, pqr ? 'pos.otros' : 'pos.f'))}</td></tr></table></td>
    <td style="padding:0"><table style="border:0"><tr><td class="l" style="border:0;border-bottom:1px solid #000">${bi('Rango de Temperatura', 'Temperature Range')}</td><td class="c" style="border:0;border-bottom:1px solid #000"><b>${esc(gv(c.d, 'pw.temp'))}</b></td></tr><tr><td class="l" style="border:0;border-bottom:1px solid #000">${bi('Tiempo mantenimiento', 'Time Range')}</td><td class="c" style="border:0;border-bottom:1px solid #000">${esc(gv(c.d, 'pw.tiempo'))}</td></tr><tr><td class="l" style="border:0">Otros / Others</td><td class="c" style="border:0">${esc(gv(c.d, 'pw.otros'))}</td></tr></table></td></tr></table>`;
  const bloquePrecalGas = c => `<table><tr><td class="t" style="width:50%;border-top:1px solid #000">PRECALENTAMIENTO / PREHEAT (QW-406)</td><td class="t" style="border-top:1px solid #000">GAS (QW-408)</td></tr><tr><td style="padding:0"><table style="border:0"><tr><th style="width:42%;border-top:0;border-left:0"></th>${[0, 1, 2].map(i => `<th style="border-top:0">${esc(c.procs[i])}</th>`).join('')}</tr>
    ${[['pre.min', 'Temperatura Precalentamiento Mínima', 'Preheat Temperature Minimum'], ['pre.int', 'Temperatura Entre paradas Máxima', 'Interpass Temperature Maximum'], ['pre.man', 'Mantenimiento del Precalentamiento', 'Preheat Maintenance']].map(([k, a, b]) => `<tr><td class="l" style="border-left:0">${bi(a, b)}</td>${[0, 1, 2].map(i => `<td class="c" style="${i == 2 ? 'border-right:0' : ''}">${esc(gv(c.d, k + '.' + i))}</td>`).join('')}</tr>`).join('')}</table></td>
    <td style="padding:0"><table style="border:0"><tr><th style="border-top:0;border-left:0;width:24%"></th><th style="border-top:0">Proceso</th><th style="border-top:0">Gas</th><th style="border-top:0">% mezcla<small>mixture</small></th><th style="border-top:0;border-right:0">Caudal<small>Flow l/min</small></th></tr>
    ${[['Protección', 'Shielding'], ['Secundario', 'Trailing'], ['Soporte', 'Backing']].map(([a, b], i) => `<tr><td class="l" style="border-left:0">${bi(a, b)}</td><td class="c">${esc(gv(c.d, 'gas.' + i + '.proc'))}</td><td class="c"><b>${esc(gv(c.d, 'gas.' + i + '.gas'))}</b></td><td class="c"><b>${esc(gv(c.d, 'gas.' + i + '.pct'))}</b></td><td class="c" style="border-right:0"><b>${esc(gv(c.d, 'gas.' + i + '.q'))}</b></td></tr>`).join('')}</table></td></tr></table>`;
  const bloqueElec = c => `${secT('CARACTERÍSTICAS ELÉCTRICAS / ELECTRICAL CHARACTERISTICS (QW-409)')}<table><tr><th style="width:9%">${bi('Pasada(s)', 'Weld Layer(s)')}</th><th style="width:9%">${bi('Proceso', 'Process')}</th><th colspan="2">${bi('Material Aportación', 'Filler Metal')}</th><th style="width:11%">${bi('Tipo/Polar', 'Type/Polar')}</th><th style="width:12%">Amps.</th><th style="width:10%">${bi('Volts. Range', '')}</th><th style="width:14%">${bi('Velocidad', 'Travel Speed Cm/min')}</th><th style="width:10%">${bi('Otros', 'Others')}</th></tr>
    <tr><th></th><th></th><th>${bi('Clase /Class', '')}</th><th>Ø Diam Mm.</th><th></th><th></th><th></th><th></th><th></th></tr>
    ${[0, 1, 2, 3, 4, 5].map(i => `<tr style="height:5mm">${['pas', 'proc', 'clase', 'dia', 'pol', 'amp', 'volt', 'vel', 'otros'].map(k => `<td class="c">${esc(gv(c.d, 'el.' + i + '.' + k))}</td>`).join('')}</tr>`).join('')}</table>
    <table><tr><td class="l" style="width:34%">${bi('Tipo y tamaño Electrodo tungsteno', 'Tungsten electrode size & type')}</td><td>${esc(gv(c.d, 'tung'))}</td></tr><tr><td class="l">${bi('Rango de velocidad aporte Varilla', 'Electrode wire feed speed range')}</td><td>${esc(gv(c.d, 'vhilo'))}</td></tr><tr><td class="l">${bi('Modo transferencia en GMAW', 'Mode of metal transfer of GMAW')}</td><td>${esc(gv(c.d, 'modo'))}</td></tr><tr><td class="l">${bi('Corriente pulsante en DC', 'Pulsing Current to DC')}</td><td>${esc(gv(c.d, 'puls'))}</td></tr></table>`;
  const bloqueTecnica = c => `${secT('TECNICA / TECHNIQUE (QW-410)')}<table><tr><th style="width:34%"></th>${[0, 1, 2].map(i => `<th>${esc(c.procs[i])}</th>`).join('')}</tr>
    ${[['tec.cordon', 'Cordón recto u oscilante', 'String or weave Bead'], ['tec.boq', 'Tamaño boquilla gas', 'Orifice or Gas cup Size'], ['tec.limp', 'Limpieza inicial y entrepasadas', 'Initial & interpass cleaning'], ['tec.gouge', 'Método de toma de raíz', 'Method of back gouging'], ['tec.osc', 'Oscilación', 'Oscillation'], ['tec.dist', 'Distancia boquilla pieza', 'Contact tube to work distance'], ['tec.pas', 'Pasadas (por lado) única / múltiple', 'Multiple or Single Pass (per side)'], ['tec.elec', 'Electrodo único / múltiple', 'Multiple or Single Electrode'], ['tec.tipo', 'Tipo de Soldadura', 'Welding Type'], ['tec.mart', 'Martilleado', 'Peening']].map(([k, a, b]) => `<tr style="height:7.5mm"><td class="l">${bi(a, b)}</td>${[0, 1, 2].map(i => `<td class="c">${esc(gv(c.d, k + '.' + i))}</td>`).join('')}</tr>`).join('')}
    <tr style="height:7.5mm"><td class="l">${bi('Otros', 'Others')}</td><td colspan="3">${esc(gv(c.d, 'tec.otros'))}</td></tr></table>`;
  const pie = (c, extra) => `<table style="position:absolute;bottom:0;left:0"><tr><td class="l" style="width:46%;height:20mm">${bi('NOMBRE DE LA COMPAÑÍA:', 'COMPANY NAME:')}<div style="font-size:12px;font-weight:bold;margin-top:2px">${esc(c.aj.empresa || '')}</div></td><td style="padding:0"><table style="border:0"><tr><td class="l" style="border:0;border-bottom:1px solid #000;height:6.6mm">${bi('PREPARADO', 'PREPARED')}</td><td style="border:0;border-bottom:1px solid #000;width:50%">${esc(gv(c.d, 'f.prep'))}</td></tr><tr><td class="l" style="border:0;border-bottom:1px solid #000;height:6.6mm">${bi('COMPROBADO', 'CHECKED')}</td><td style="border:0;border-bottom:1px solid #000">${esc(gv(c.d, 'f.comp'))}</td></tr><tr><td class="l" style="border:0;height:6.6mm">${bi('APROBADO', 'APPROVED')}</td><td style="border:0">${esc(gv(c.d, 'f.apr'))}</td></tr></table></td></tr></table>${c.aj.pie ? `<div style="position:absolute;bottom:20.5mm;left:2mm;font-size:6px;color:#555">${esc(c.aj.pie)}</div>` : ''}`;

  /* ---------- páginas WPS ---------- */
  function paginasWPS(c) {
    const d = c.d, r = c.row, N = 2;
    const p1 = `<div class="fm">${hdr(c, 1, N)}${titulo('ESPECIFICACION PROCEDIMIENTO DE SOLDADURA (WPS)', 'WELDING PROCEDURE SPECIFICATION (WPS)')}
      <table><tr><td class="l" style="width:14%;border:0"><span class="big">WPS Nº</span></td><td class="big" style="border:0;width:20%;font-size:12px">${esc(r.codigo)}</td><td class="l" style="border:0;width:14%">${bi('Fecha', 'Date')}</td><td class="c" style="border:0;width:20%">${esc(gv(d, 'fecha'))}</td><td class="l" style="border:0;width:16%"><b>Cubierto por PQR Nº</b><small>Supporting PQR Nº</small></td><td class="big" style="border:0;font-size:12px">${esc(ft(d.cubierto, c.pqrs.join(', ')))}</td></tr>
      <tr><td class="l" style="border:0"><span class="big">Rev.</span></td><td class="big" style="border:0;font-size:12px">${esc(r.revision ?? '')}</td><td class="l" style="border:0">${bi('Fecha', 'Date')}</td><td class="c" style="border:0">${esc(gv(d, 'fecha_rev'))}</td><td style="border:0" colspan="2"></td></tr></table>
      <table><tr><td class="l" style="border:0;width:50%"><b>Procesos de Soldadura</b> ${procChecks(c)}<small>Welding Process (es)</small></td><td class="l" style="border:0"><b>Tipo(s)</b> ${tipoChecks(c)}<small>Type(s)</small></td></tr></table>
      ${bloqueUniones(c)}${secT('DETALLES / DETAILS')}<table><tr><td class="sk" style="width:50%">${sketch(d, 'V')}</td><td class="sk">${d.croquis ? '' : svgJunta('filete', 0, '')}</td></tr></table>
      ${bloqueMetalBase(c, false)}${bloqueFiller(c, false)}</div>`;
    const mid = `<td style="width:62mm"><table style="border:0"><tr><td style="border:0">WPS Nº</td><td style="border:0;font-size:10px">${esc(r.codigo)}</td><td style="border:0">Rev.</td><td style="border:0">${esc(r.revision ?? '')}</td></tr></table></td>`;
    const p2 = `<div class="fm">${hdr(c, 2, N, mid)}${bloquePosicion(c, false)}${bloquePrecalGas(c)}${bloqueElec(c)}${bloqueTecnica(c)}${pie(c)}</div>`;
    return p1 + p2;
  }

  /* ---------- páginas PQR ---------- */
  function paginasPQR(c) {
    const d = c.d, r = c.row, N = 3;
    const p1 = `<div class="fm">${hdr(c, 1, N)}${titulo('CALIFICACION PROCEDIMIENTO DE SOLDADURA (PQR)', 'PROCEDURE QUALIFICATION RECORD (PQR)')}
      <table><tr><td class="l" style="border:0;width:12%"><span class="big">PQR Nº</span></td><td class="big" style="border:0;width:20%;font-size:12px">${esc(r.codigo)}</td><td class="l" style="border:0;width:12%">${bi('Fecha', 'Date')}</td><td class="c" style="border:0;width:22%">${esc(gv(d, 'fecha'))}</td><td class="l" style="border:0;width:14%"><span class="big">WPS Nº</span></td><td class="big" style="border:0;font-size:12px">${esc(ft(d.wps, ''))}</td></tr></table>
      <table><tr><td class="l" style="border:0;width:50%"><b>Procesos de Soldadura</b> ${procChecks(c)}<small>Welding Process (es)</small></td><td class="l" style="border:0"><b>Tipo(s)</b> ${tipoChecks(c)}<small>Type(s)</small></td></tr></table>
      ${secT('UNIONES / UNIONS (QW-402)')}<table><tr><td class="sk" style="height:62mm">${sketch(d, d.dis === 'X' ? 'X' : (r.tipo === 'filete' ? 'filete' : 'V'))}</td></tr></table>
      ${bloqueMetalBase(c, true)}${bloqueFiller(c, true)}</div>`;
    const mid = `<td style="width:62mm"><table style="border:0"><tr><td style="border:0">PQR Nº</td><td style="border:0;font-size:10px">${esc(r.codigo)}</td></tr></table></td>`;
    const p2 = `<div class="fm">${hdr(c, 2, N, mid)}${bloquePosicion(c, true)}${bloquePrecalGas(c)}${bloqueElec(c)}${bloqueTecnica(c)}</div>`;
    const tr = [0, 1, 2, 3, 4, 5], bd = [0, 1, 2, 3, 4], tg = [0, 1, 2, 3, 4, 5, 6, 7];
    const p3 = `<div class="fm">${hdr(c, 3, N, mid)}
      ${secT('ENSAYO DE TRACCION / TENSILE TEST (QW-150)')}<table><tr><th>${bi('Probeta Nº', 'Specimen Nº')}</th><th>${bi('Ancho', 'Width mm')}</th><th>${bi('Espesor', 'Thickness mm')}</th><th>${bi('Área', 'Area mm²')}</th><th>${bi('Carga rotura total', 'Ultimate total load N')}</th><th>${bi('Resistencia Tracción', 'Ultimate Unit Stress MPa')}</th><th>${bi('Tipo y localización de rotura', 'Type of failure & location')}</th></tr>
      ${tr.map(i => `<tr style="height:5mm">${['pb', 'an', 'es', 'ar', 'ca', 're', 'ro'].map(k => `<td class="c">${esc(gv(d, 'tr.' + i + '.' + k))}</td>`).join('')}</tr>`).join('')}</table>
      ${secT('ENSAYO DE PLEGADO / GUIDED BEND TESTS (QW-160)')}<table><tr><th style="width:50%">${bi('Tipo y figura Nº', 'Type and Figure Nº')}</th><th>${bi('Resultado', 'Result')}</th></tr>${bd.map(i => `<tr style="height:5mm"><td class="c">${esc(gv(d, 'bd.' + i + '.tipo'))}</td><td class="c">${esc(gv(d, 'bd.' + i + '.res'))}</td></tr>`).join('')}</table>
      ${secT('ENSAYO DE RESILIENCIA / TOUGHNESS TEST (QW-170)')}<table><tr><th>${bi('Probeta Nº', 'Specimen Nº')}</th><th>${bi('Situación de ranura', 'Notch location')}</th><th>${bi('Tamaño de Probeta', 'Specimen Size')}</th><th>${bi('Temperatura Ensayo', 'Test Temperature')}</th><th>${bi('Valores de Resiliencia', 'Impact Values')}</th><th>${bi('% cortadura', '% shear')}</th><th>${bi('Frenado sí / no', 'Drop Weight Break (Y/N)')}</th></tr>
      ${tg.map(i => `<tr style="height:5mm">${['pb', 'ra', 'ta', 'te', 'va', 'pc', 'dw'].map(k => `<td class="c">${esc(gv(d, 'tg.' + i + '.' + k))}</td>`).join('')}</tr>`).join('')}<tr><td class="l" colspan="7">Comentarios / Comments: ${esc(gv(d, 'tg.com'))}</td></tr></table>
      ${secT('ENSAYO SOLDADURA EN ANGULO / FILLET WELD TEST (QW-180)')}<table><tr><td class="l" style="width:25%">${bi('Resultado aceptable', 'Result Satisfactory')}</td><td class="ck">${CKB(d['fl.ac'] === 'Sí')} Sí / Yes &nbsp; ${CKB(d['fl.ac'] === 'No')} No</td><td class="l" style="width:25%">${bi('Penetración en el Metal Base:', 'Penetration into Metal Base:')}</td><td class="ck">${CKB(d['fl.pen'] === 'Sí')} Sí / Yes &nbsp; ${CKB(d['fl.pen'] === 'No')} No</td></tr><tr><td class="l">${bi('Macrografía resultado', 'Macro - Results')}</td><td colspan="3">${esc(gv(d, 'fl.macro'))}</td></tr></table>
      ${secT('OTROS / OTHERS')}<table><tr><td class="l" style="width:34%">${bi('Tipo de ensayo', 'Type of test')}</td><td>${esc(gv(d, 'ot.tipo'))}</td></tr><tr><td class="l">${bi('Análisis metal depositado', 'Deposit Analysis')}</td><td>${esc(gv(d, 'ot.anal'))}</td></tr><tr><td class="l">${bi('Otros', 'Others')}</td><td>${esc(gv(d, 'ot.otros'))}</td></tr></table>
      <table><tr><td class="l" style="width:22%">${bi('Nombre del soldador', "Welder's Name")}</td><td style="width:26%"><b>${esc(gv(d, 'sol.nom'))}</b></td><td class="l" style="width:14%">${bi('Nº de reloj', 'Clock Nº')}</td><td style="width:12%">${esc(gv(d, 'sol.reloj'))}</td><td class="l" style="width:14%">${bi('Sello Nº', 'Stamp Nº')}</td><td>${esc(gv(d, 'sol.sello'))}</td></tr>
      <tr><td class="l">${bi('Ensayos dirigidos por:', 'Tests conducted by')}</td><td><b>${esc(gv(d, 'lab.dir'))}</b></td><td class="l" colspan="2">${bi('Laboratorio Ensayos', 'Laboratory Test Nº')}</td><td colspan="2"><b>${esc(gv(d, 'lab.n'))}</b></td></tr></table>
      <table><tr><td class="l" style="font-size:7.5px">Certificamos que el contenido de este informe es correcto y que las soldaduras han sido preparadas, soldadas y ensayadas de acuerdo con los requerimientos del código ASME Sección IX<small style="font-size:7px">We certify that the statements in this record are correct and that the test welds were prepared, welded and tested in accordance with the requirements of Section IX of the ASME Code</small></td></tr></table>${pie(c)}</div>`;
    return p1 + p2 + p3;
  }

  function imprimirFicha(html) {
    $('#print').innerHTML = `<style>@page{size:A4 portrait;margin:6mm}</style>` + html; setTimeout(() => window.print(), 300);
  }
  const _ficha = ACTS.ficha;
  ACTS.ficha = async (ent, row, b) => {
    row = row || (ent.table === 'pqr' ? L.pqr : L.wps).find(x => x.id == b.dataset.id);
    if (ent.table !== 'wps' && ent.table !== 'pqr') return _ficha(ent, row, b);
    const c = await ctx(ent, row); imprimirFicha(ent.table === 'wps' ? paginasWPS(c) : paginasPQR(c));
  };
  ACTS.fichaBlanco = async (ent, row, b) => {
    const tipo = b.dataset.tipo, aj = await getAj(), ent2 = tipo === 'wps' ? E.wps : E.pqr;
    const c = { aj, s: 'ASME', d: {}, row: { codigo: '', revision: '' }, procs: ['', '', ''], allProcs: [], pqrs: [], ent: ent2 };
    imprimirFicha(tipo === 'wps' ? paginasWPS(c) : paginasPQR(c));
  };

  /* ---------- editor de datos de la ficha ---------- */
  const inp = (d, k, l, w) => `<label style="${w ? 'grid-column:span ' + w : ''}">${l}<input data-k="${k}" value="${esc(gv(d, k))}"></label>`;
  const sel = (d, k, l, opts) => `<label>${l}<select data-k="${k}"><option value=""></option>${opts.map(([v, t]) => `<option value="${esc(v)}" ${d[k] === v ? 'selected' : ''}>${esc(t || v)}</option>`).join('')}</select></label>`;
  const prc = (d, k, l) => `<div style="grid-column:1/-1;display:grid;grid-template-columns:200px repeat(3,1fr);gap:6px;align-items:center"><span class="hint">${l}</span>${[0, 1, 2].map(i => `<input data-k="${k}.${i}" value="${esc(gv(d, k + '.' + i))}">`).join('')}</div>`;
  const rows = (d, pre, n, cols) => `<div style="grid-column:1/-1;overflow:auto"><table><tr>${cols.map(([, l]) => `<th>${l}</th>`).join('')}</tr>${Array.from({ length: n }, (_, i) => `<tr>${cols.map(([k]) => `<td><input style="width:100%;min-width:60px" data-k="${pre}.${i}.${k}" value="${esc(gv(d, pre + '.' + i + '.' + k))}"></td>`).join('')}</tr>`).join('')}</table></div>`;
  const grp = (t, inner, open) => `<details ${open ? 'open' : ''} style="margin:8px 0"><summary><b>${t}</b></summary><div class="grid" style="margin-top:6px">${inner}</div></details>`;

  ACTS.datosficha = async (ent, row, b) => {
    row = row || (ent.table === 'pqr' ? L.pqr : L.wps).find(x => x.id == b.dataset.id);
    const d = { ...(row.datos || {}) }, wps = ent.table === 'wps';
    const SI = [['Sí', 'Sí'], ['No', 'No']];
    const ap = ['sfa', 'aws', 'fno', 'ano', 'tam', 'dep', 'eg', 'ef', 'flux', 'marca', 'ins'], apL = ['Especificación SFA', 'AWS (Class)', 'F Nº', 'A Nº', 'Tamaño metal aportación', 'Metal depositado', wps ? 'Rango espesor chaflán' : 'Espesor chaflán', wps ? 'Rango espesor ángulo' : 'Espesor ángulo', 'Electrodo-Flux', 'Marca flux', 'Insertos consumibles'];
    const html = `<h3>Datos de la ficha ${wps ? 'WPS' : 'PQR'} ${esc(row.codigo)}</h3><div class="hint">Estos datos completan los de la tabla (materiales, espesores, procesos…) en la plantilla impresa. Los vacíos salen en blanco.</div>
    <div id="fe" style="max-height:62vh;overflow:auto;padding-right:6px">
    ${grp('Cabecera y unión', `${inp(d, 'fecha', 'Fecha')}${wps ? `${inp(d, 'fecha_rev', 'Fecha revisión')}${inp(d, 'cubierto', 'Cubierto por PQR Nº (vacío = enlazados)')}` : inp(d, 'wps', 'WPS Nº')}${sel(d, 'tipoaplic', 'Tipo', [['manual', 'Manual'], ['semi', 'Semi Auto.'], ['auto', 'Automático'], ['maq', 'Máquina']])}${sel(d, 'dis', 'Diseño de la unión', ['V', 'X', 'U', 'K', 'Y', 'J', 'Otro/Others'].map(x => [x]))}${inp(d, 'ang', 'Ángulo bisel (°) croquis')}${inp(d, 'esp', 'Espesor t croquis (mm)')}${sel(d, 'metal', 'Metal', [['metal', 'Metálico'], ['nometal', 'No metálico'], ['nofund', 'No fundible'], ['otros', 'Otros']])}${[0, 1, 2].map(i => inp(d, 'sop.' + i + '.yn', 'Soporte ' + (i + 1) + ' (YES/NO)') + inp(d, 'sop.' + i + '.proc', '… proceso') + inp(d, 'sop.' + i + '.tipo', '… tipo')).join('')}${inp(d, 'ret', 'Retenedores')}
      <label style="grid-column:1/-1">Croquis propio (imagen; sustituye al esquema)<input type="file" id="fcro" accept="image/*"></label>`, true)}
    ${grp('Columnas por proceso (cabecera de las tablas)', `${[0, 1, 2].map(i => inp(d, 'col.' + i, 'Proceso columna ' + (i + 1) + ' (vacío = automático)')).join('')}`)}
    ${grp('Metal base (QW-403)', `${inp(d, 'mb.esp1', 'Especificación tipo-grado', 3)}${inp(d, 'mb.esp2', 'A especificación tipo-grado', 3)}${inp(d, 'mb.an1', 'Análisis químico / prop. mecánicas', 3)}${inp(d, 'mb.an2', 'A análisis químico / prop. mec.', 3)}${wps ? `${inp(d, 'mb.rg', 'Rango espesores chaflán (vacío = de la tabla)')}${inp(d, 'mb.rf', 'Rango ángulo / fillet')}${sel(d, 't8', 'T > 8"', SI)}` : `${inp(d, 'mb.cg', 'Espesor cupón chaflán')}${inp(d, 'mb.cf', 'Espesor cupón ángulo')}${inp(d, 'mb.dia', 'Diámetro del cupón')}`}${sel(d, 'pas12', 'Pasada t > 12 mm', SI)}${inp(d, 'mb.otros', 'Otros', 3)}`)}
    ${grp('Metal de aportación (QW-404)', ap.map((k, i) => prc(d, 'ap.' + k, apL[i])).join('') + inp(d, 'ap.otros', 'Otros', 3))}
    ${grp('Posición y PWHT (QW-405/407)', `${inp(d, 'pos.g', 'Posición(es) de chaflán')}${sel(d, 'pos.prog', 'Progresión', [['asc', 'Ascendente'], ['desc', 'Descendente']])}${inp(d, wps ? 'pos.f' : 'pos.otros', wps ? 'Posición(es) de ángulo' : 'Otros')}${inp(d, 'pw.temp', 'PWHT rango temperatura')}${inp(d, 'pw.tiempo', 'PWHT tiempo')}${inp(d, 'pw.otros', 'PWHT otros')}`)}
    ${grp('Precalentamiento y gas (QW-406/408)', prc(d, 'pre.min', 'Precalentamiento mínimo') + prc(d, 'pre.int', 'Entre pasadas máximo') + prc(d, 'pre.man', 'Mantenimiento') + ['Protección', 'Secundario', 'Soporte'].map((n, i) => inp(d, `gas.${i}.proc`, n + ' · proceso') + inp(d, `gas.${i}.gas`, '… gas') + inp(d, `gas.${i}.pct`, '… % mezcla') + inp(d, `gas.${i}.q`, '… caudal l/min')).join(''))}
    ${grp('Características eléctricas (QW-409)', rows(d, 'el', 6, [['pas', 'Pasada(s)'], ['proc', 'Proceso'], ['clase', 'Clase'], ['dia', 'Ø mm'], ['pol', 'Tipo/Polar'], ['amp', 'Amps'], ['volt', 'Volts'], ['vel', 'Velocidad cm/min'], ['otros', 'Otros']]) + inp(d, 'tung', 'Electrodo tungsteno', 3) + inp(d, 'vhilo', 'Velocidad aporte varilla/hilo') + inp(d, 'modo', 'Modo transferencia GMAW') + inp(d, 'puls', 'Corriente pulsante'))}
    ${grp('Técnica (QW-410)', [['tec.cordon', 'Cordón recto / oscilante'], ['tec.boq', 'Tamaño boquilla'], ['tec.limp', 'Limpieza inicial y entrepasadas'], ['tec.gouge', 'Toma de raíz'], ['tec.osc', 'Oscilación'], ['tec.dist', 'Distancia boquilla-pieza'], ['tec.pas', 'Pasadas única / múltiple'], ['tec.elec', 'Electrodo único / múltiple'], ['tec.tipo', 'Tipo de soldadura'], ['tec.mart', 'Martilleado']].map(([k, l]) => prc(d, k, l)).join('') + inp(d, 'tec.otros', 'Otros', 3))}
    ${wps ? '' : `${grp('Ensayos de tracción y plegado', rows(d, 'tr', 6, [['pb', 'Probeta'], ['an', 'Ancho mm'], ['es', 'Espesor mm'], ['ar', 'Área mm²'], ['ca', 'Carga N'], ['re', 'Resist. MPa'], ['ro', 'Tipo rotura']]) + rows(d, 'bd', 5, [['tipo', 'Tipo y figura'], ['res', 'Resultado']]))}
    ${grp('Resiliencia, ángulo y otros', rows(d, 'tg', 8, [['pb', 'Probeta'], ['ra', 'Ranura'], ['ta', 'Tamaño'], ['te', 'Temp.'], ['va', 'Valores'], ['pc', '% cortadura'], ['dw', 'Frenado']]) + inp(d, 'tg.com', 'Comentarios', 3) + sel(d, 'fl.ac', 'Filete: resultado aceptable', SI) + sel(d, 'fl.pen', 'Penetración en metal base', SI) + inp(d, 'fl.macro', 'Macrografía') + inp(d, 'ot.tipo', 'Tipo de ensayo', 3) + inp(d, 'ot.anal', 'Análisis metal depositado', 3) + inp(d, 'ot.otros', 'Otros', 3) + inp(d, 'sol.nom', 'Soldador') + inp(d, 'sol.reloj', 'Nº reloj') + inp(d, 'sol.sello', 'Sello Nº') + inp(d, 'lab.dir', 'Ensayos dirigidos por') + inp(d, 'lab.n', 'Laboratorio ensayos Nº'))}`}
    ${grp('Firmas', `${inp(d, 'f.prep', 'Preparado')}${inp(d, 'f.comp', 'Comprobado')}${inp(d, 'f.apr', 'Aprobado')}`)}</div>
    <div class="foot"><button data-close>Cancelar</button><button id="fsave" class="pri">Guardar</button></div>`;
    showModal(html); const bx = $('#box'); bx.style.maxWidth = '1050px'; bx.style.width = '96vw';
    const cerrar = () => { bx.style.maxWidth = ''; bx.style.width = ''; };
    $('#box [data-close]').addEventListener('click', cerrar);
    let croquis = d.croquis || null;
    $('#fcro').onchange = ev => { const f = ev.target.files[0]; if (!f) return; const img = new Image(), rd = new FileReader(); rd.onload = () => { img.onload = () => { const k = Math.min(1, 900 / img.width), cv = document.createElement('canvas'); cv.width = img.width * k; cv.height = img.height * k; cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); croquis = cv.toDataURL('image/jpeg', 0.85); toast('Croquis cargado'); }; img.src = rd.result; }; rd.readAsDataURL(f); };
    $('#fsave').onclick = async () => {
      const nd = {}; document.querySelectorAll('#fe [data-k]').forEach(i => { if (i.value !== '') nd[i.dataset.k] = i.value; }); if (croquis) nd.croquis = croquis;
      try { await DB.update(ent.table, row.id, { datos: nd }); row.datos = nd; toast('Datos de la ficha guardados'); $('#modal').classList.add('hidden'); cerrar(); } catch (e) { toast(e.message, true); }
    };
  };

  /* botones y vista Importar/Exportar */
  E.pqr.extra = r => `<button class="sm" data-act="rangos" data-id="${r.id}">Rangos</button> <button class="sm" data-act="datosficha" data-id="${r.id}">Datos ficha</button> <button class="sm" data-act="ficha" data-id="${r.id}">Ficha</button>`;
  E.wps.extra = r => `<button class="sm" data-act="validar" data-id="${r.id}">Validar</button> <button class="sm" data-act="datosficha" data-id="${r.id}">Datos ficha</button> <button class="sm" data-act="ficha" data-id="${r.id}">Ficha</button>`;
  const _io = VIEWS.io;
  VIEWS.io = async () => {
    await _io();
    const d = document.createElement('div'); d.className = 'card'; d.style.cssText = 'padding:16px;margin-top:14px';
    d.innerHTML = `<h3 style="margin-top:0">Plantillas en blanco</h3><button data-act="fichaBlanco" data-tipo="wps">WPS en blanco (2 hojas)</button> <button data-act="fichaBlanco" data-tipo="pqr">PQR en blanco (3 hojas)</button><p class="hint">Formato Facet ASME IX. Para que salga el logo, súbelo en Ajustes.</p>`;
    $('#main').appendChild(d);
  };
})();
