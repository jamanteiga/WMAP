-- Ajustes sobre wmap_schema.sql para poder importar el Excel (WPS/PQR por P-No/Group e ISO 15608)
alter table pqr
  add column if not exists p_no_1 text, add column if not exists group_1 text,
  add column if not exists p_no_2 text, add column if not exists group_2 text,
  add column if not exists grupo_iso_1 text, add column if not exists grupo_iso_2 text,
  add column if not exists clase_material text,        -- p.ej. '516 Gr.60', '316L'
  add column if not exists precalentamiento_txt text;  -- valor original ('20-30', '120º')

alter table wps
  add column if not exists clase_material text,
  add column if not exists precalentamiento_txt text,
  add column if not exists pqr_ref_txt text;           -- referencia original al/los PQR ('F083+F062')

-- Códigos únicos de WPS/PQR por norma (evita mezclar ASME e ISO con el mismo código)
alter table pqr drop constraint if exists pqr_codigo_revision_key;
alter table pqr add constraint pqr_codigo_norma_rev_key unique (codigo, norma_id, revision);
alter table wps drop constraint if exists wps_codigo_revision_key;
alter table wps add constraint wps_codigo_norma_rev_key unique (codigo, norma_id, revision);
