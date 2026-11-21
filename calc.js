/* WMAP · Calculadoras de soldadura (módulo puro). Valores orientativos. */
(function (root) {
  'use strict';
  const C = {}; const r = (x, n = 2) => (x == null || !isFinite(x) ? null : Math.round(x * 10 ** n) / 10 ** n);

  /* Carbono equivalente IIW y CET (EN 1011-2) */
  C.ce = m => (m.C || 0) + (m.Mn || 0) / 6 + ((m.Cr || 0) + (m.Mo || 0) + (m.V || 0)) / 5 + ((m.Ni || 0) + (m.Cu || 0)) / 15;
  C.cet = m => (m.C || 0) + ((m.Mn || 0) + (m.Mo || 0)) / 10 + ((m.Cr || 0) + (m.Cu || 0)) / 20 + (m.Ni || 0) / 40;

  /* Precalentamiento EN 1011-2, método B: Tp = 697·CET + 160·tanh(d/35) + 62·HD^0.35 + (53·CET − 32)·Q − 328 */
  C.precalentamiento = function (m, d, HD, Q) {
    const cet = C.cet(m), ce = C.ce(m); const av = [];
    const tp = 697 * cet + 160 * Math.tanh(d / 35) + 62 * Math.pow(HD, 0.35) + (53 * cet - 32) * Q - 328;
    if (cet < 0.2 || cet > 0.5) av.push('CET fuera del rango 0,20–0,50 del método B.');
    if (d < 10 || d > 90) av.push('Espesor fuera de 10–90 mm.');
    if (HD < 1 || HD > 20) av.push('HD fuera de 1–20 ml/100 g.');
    if (Q < 0.5 || Q > 4.0) av.push('Aporte térmico fuera de 0,5–4,0 kJ/mm.');
    return { ce: r(ce, 3), cet: r(cet, 3), tp: r(Math.max(tp, 0), 0), tpRaw: r(tp, 0), avisos: av };
  };

  /* Aporte térmico Q = k·U·I·60 / (v·1000)  [kJ/mm], v en mm/min */
  C.K = { 'SMAW (111)': 0.8, 'GTAW (141)': 0.6, 'GMAW/MAG (135)': 0.8, 'FCAW (136)': 0.8, 'SAW (12)': 1.0, 'PAW (15)': 0.6 };
  C.aporte = (k, U, I, v) => r(k * U * I * 60 / (v * 1000), 3);
  C.velocidad = (k, U, I, Q) => r(k * U * I * 60 / (Q * 1000), 1);

  /* Consumo de consumibles */
  const RHO = 7.85e-6; // kg/mm3 acero
  C.areaV = function (t, ang, g, w, h) { return t * g + t * t * Math.tan(ang * Math.PI / 360) + (2 / 3) * w * h; };
  C.areaFilete = z => 0.55 * z * z; // triángulo z²/2 + ~10 % de convexidad
  C.RENDIMIENTO = { 'SMAW (varilla)': 0.60, 'GTAW (varilla)': 0.90, 'GMAW (hilo)': 0.95, 'FCAW (hilo)': 0.85, 'SAW (hilo)': 1.0 };
  C.consumo = (areaMm2, longitudMm, rend) => { const dep = areaMm2 * longitudMm * RHO; return { deposito: r(dep, 3), consumible: r(dep / rend, 3) }; };

  /* Garganta / cateto de filete */
  C.gargantaDesdeCateto = z => r(z / Math.SQRT2, 2);
  C.catetoDesdeGarganta = a => r(a * Math.SQRT2, 2);

  /* Larson-Miller y tiempos de PWHT */
  C.larsonMiller = (TC, horas) => r((TC + 273.15) * (20 + Math.log10(horas)) / 1000, 3);
  C.tiempoEquivalente = (P, TC) => r(Math.pow(10, P * 1000 / (TC + 273.15) - 20), 2);
  // ASME VIII-1 UCS-56, P-No 1 (≥ 595 °C): 1 h/25 mm (mín. 15 min) hasta 50 mm; 2 h + 15 min por cada 25 mm adicionales sobre 50 mm
  C.pwhtTiempoPNo1 = e => (e <= 50 ? Math.max(0.25, e / 25) : 2 + 0.25 * (e - 50) / 25);

  root.WMAPC = C;
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
