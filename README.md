# WMAP · Welding Management (ASME IX + EN ISO)

App web estática (HTML + JS) con Supabase: PQR, WPS, WPQ, base de datos de materiales/consumibles y generación de welding books.

- **Ejecutar:** abrir `index.html` con un servidor web (p. ej. GitHub Pages: Settings › Pages › Deploy from branch › `main` / root).
- **Sin configurar** `config.js` arranca en *modo demo* (datos en el navegador).
- **Con Supabase:** rellenar `SUPABASE_URL` y `SUPABASE_ANON_KEY` en `config.js` y ejecutar en el SQL Editor, por orden, los ficheros de `sql/`.
- `tools/import_excel_to_sql.py` regenera `sql/04_import_excel.sql` desde el Excel de WPS/PQR.
