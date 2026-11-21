# WMAP · Welding Management (ASME IX + EN ISO)

App web estática (HTML + JS) con Supabase: PQR, WPS, WPQ, base de datos de materiales/consumibles y generación de welding books.

- **Ejecutar:** abrir `index.html` con un servidor web (p. ej. GitHub Pages: Settings › Pages › Deploy from branch › `main` / root).
- **Sin configurar** `config.js` arranca en *modo demo* (datos en el navegador).
- **Con Supabase:** rellenar `SUPABASE_URL` y `SUPABASE_ANON_KEY` en `config.js` y ejecutar en el SQL Editor, por orden, los ficheros de `sql/`.
- `tools/import_excel_to_sql.py` regenera `sql/04_import_excel.sql` desde el Excel de WPS/PQR.


## Módulos ampliados (v2)
- **Rangos de cualificación** (ASME IX QW-451/452, EN ISO 15614-1 / 9606-1) en PQR y WPQ; **Validación WPS↔PQR**.
- **Vigilancia de WPQ** (continuidad 6 meses, validez 3 años) con historial de actividad.
- **Importar/Exportar** Excel, copia JSON, fichas PDF de WPS/PQR/WPQ.
- **Welding book**: cajetín con «Hoja n de N», logo y pie (Ajustes), equipos por documento, anexo de WPS, nueva revisión.
- **Producción**: avisos al registrar soldadura, avance y calidad por soldador; **Plan de END**.
- **Calculadoras**: precalentamiento EN 1011-2, aporte térmico, consumibles, garganta/cateto, Larson-Miller.

Ejecuta `sql/05_extensiones.sql` en Supabase tras los anteriores.
