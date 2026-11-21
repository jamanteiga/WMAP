-- ============================================================
-- WMAP · Esquema Supabase (PostgreSQL) · ASME IX + EN ISO
-- Módulos: WPS · PQR · WPQ · Base de datos · Welding books
-- ============================================================

-- ---------- 0. Catálogos y normas -----------------------------------
create type norma_sistema   as enum ('ASME','ISO');
create type estado_doc      as enum ('borrador','revisado','aprobado','obsoleto');
create type tipo_junta      as enum ('penetracion','filete');
create type rol_usuario     as enum ('admin','ingeniero','inspector','lector');

create table normas (
  id          serial primary key,
  codigo      text unique not null,          -- 'ASME IX', 'EN ISO 15614-1', 'EN ISO 9606-1'...
  sistema     norma_sistema not null,
  ambito      text not null check (ambito in ('WPS','PQR','WPQ','END','otro')),
  edicion     text
);

create table procesos (
  id          serial primary key,
  codigo_aws  text,                          -- GTAW, SMAW, SAW, FCAW...
  codigo_iso  text,                          -- 141, 111, 121, 136...
  nombre      text not null,
  unique (codigo_aws, codigo_iso)
);

-- ---------- 1. Materiales -------------------------------------------
create table materiales (
  id           serial primary key,
  especificacion text not null,              -- 'SA-516', 'SA-312', 'EN 10028-2'
  grado        text not null,                -- 'Gr.60', 'TP316L', 'P265GH'
  forma        text,                         -- plate, pipe, forging, fitting
  uns          text,
  p_no         text,                         -- ASME IX: 1, 8, 10H, 5B...
  group_no     text,                         -- ASME IX group: 1, 2...
  grupo_iso    text,                         -- ISO 15608: 1.1, 1.2, 8.1, 10.1...
  equivalencia_id int references materiales(id),   -- equivalente ASME<->EN
  notas        text,
  unique (especificacion, grado, forma)
);
create index on materiales (p_no, group_no);
create index on materiales (grupo_iso);

-- ---------- 2. Consumibles ------------------------------------------
create table consumibles (
  id           serial primary key,
  proceso_id   int references procesos(id),
  clasificacion text not null,               -- 'E7018', 'ER316L', 'EN ISO 2560-A E 42 4 B'
  sfa          text,                         -- 'SFA-5.1'
  f_no         text,                         -- ASME F-No
  a_no         text,                         -- ASME A-No
  grupo_iso    text,                         -- ISO 15608 / EN 13479 grupo consumible
  nombre_comercial text,
  diametros_mm numeric[]
);

-- ---------- 3. PQR ---------------------------------------------------
create table pqr (
  id              uuid primary key default gen_random_uuid(),
  codigo          text not null,             -- 'F019'
  revision        int not null default 0,
  norma_id        int not null references normas(id),
  fecha           date,
  estado          estado_doc default 'borrador',
  material1_id    int references materiales(id),
  material2_id    int references materiales(id),
  tipo            tipo_junta not null,
  espesor_mm      numeric not null,
  diametro_mm     numeric,                   -- null = chapa
  posicion        text,                      -- 'PA', 'PC', 'PF' / '1G', '6G'
  precalentamiento_c numeric,
  interpass_max_c numeric,
  pwht            boolean default false,
  pwht_detalle    text,
  impacto_temp_c  numeric,                   -- null = sin impacto
  observaciones   text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz default now(),
  unique (codigo, revision)
);

create table pqr_procesos (                  -- 1..n procesos por PQR
  id            serial primary key,
  pqr_id        uuid references pqr(id) on delete cascade,
  orden         int not null,
  proceso_id    int references procesos(id),
  consumible_id int references consumibles(id),
  espesor_depositado_mm numeric,             -- QW-451 / ISO 15614-1: cada proceso cubre su espesor
  parametros    jsonb                        -- I, U, velocidad, aporte térmico, gas, polaridad
);

create table pqr_ensayos (
  id        serial primary key,
  pqr_id    uuid references pqr(id) on delete cascade,
  ensayo    text not null,                   -- tracción, doblado, macro, dureza, resiliencia, END
  resultado jsonb,
  conforme  boolean,
  informe   text                             -- ruta de documento en Storage
);

-- ---------- 4. WPS ---------------------------------------------------
create table wps (
  id            uuid primary key default gen_random_uuid(),
  codigo        text not null,               -- 'F019/A2'
  revision      int not null default 0,
  norma_id      int not null references normas(id),
  estado        estado_doc default 'borrador',
  tipo          tipo_junta not null,
  material1_id  int references materiales(id),       -- o rango por p_no/grupo
  material2_id  int references materiales(id),
  p_no_1 text, group_1 text, p_no_2 text, group_2 text,   -- rangos por grupo (ASME)
  grupo_iso_1 text, grupo_iso_2 text,                      -- (ISO 15608)
  esp_min_mm    numeric,
  esp_max_mm    numeric,                     -- null = sin límite ("All")
  dia_min_mm    numeric,
  dia_max_mm    numeric,
  posiciones    text[],
  arqueo_resanado boolean default false,
  precalentamiento_min_c numeric,
  interpass_max_c numeric,
  impacto_temp_c numeric,
  pwht          boolean default false,
  detalle       jsonb,                       -- diseño de junta, pasadas, parámetros por pasada
  observaciones text,
  created_at    timestamptz default now(),
  unique (codigo, revision)
);

create table wps_procesos (
  id            serial primary key,
  wps_id        uuid references wps(id) on delete cascade,
  orden         int not null,
  proceso_id    int references procesos(id),
  consumible_id int references consumibles(id),
  parametros    jsonb
);

create table wps_pqr (                       -- N:M — qué PQR soporta cada WPS
  wps_id uuid references wps(id) on delete cascade,
  pqr_id uuid references pqr(id),
  primary key (wps_id, pqr_id)
);

-- ---------- 5. WPQ y soldadores -------------------------------------
create table soldadores (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  codigo     text unique,                    -- nº/estampilla
  empresa    text,
  activo     boolean default true
);

create table wpq (
  id             uuid primary key default gen_random_uuid(),
  soldador_id    uuid not null references soldadores(id),
  norma_id       int not null references normas(id),     -- ASME IX / EN ISO 9606-1
  numero         text not null,
  proceso_id     int references procesos(id),
  wps_pqr_ref    text,                       -- WPS/PQR de ensayo
  material_ensayo_id int references materiales(id),
  espesor_mm     numeric,
  diametro_mm    numeric,
  posicion       text,
  tipo           tipo_junta,
  f_no           text,                       -- ASME
  consumible_id  int references consumibles(id),
  rangos         jsonb,                      -- rangos calculados (espesor, dia, posiciones...)
  fecha_ensayo   date not null,
  fecha_vencimiento date,                    -- ISO 9606: 3 años (6 m confirmación)
  estado         estado_doc default 'borrador',
  documento      text
);

create table wpq_continuidad (               -- ASME IX QW-322 / ISO 9606 §9.3
  id         serial primary key,
  wpq_id     uuid references wpq(id) on delete cascade,
  fecha      date not null,
  tipo       text check (tipo in ('actividad','confirmacion_6m','revalidacion')),
  firmado_por text,
  notas      text
);

-- ---------- 6. Proyectos y welding books ----------------------------
create table proyectos (
  id         uuid primary key default gen_random_uuid(),
  cliente    text,
  proyecto   text,
  pedido     text,
  referencia text,
  ubicacion  text,
  created_at timestamptz default now()
);

create table equipos (                       -- "ITEM Nº" del welding book
  id           uuid primary key default gen_random_uuid(),
  proyecto_id  uuid references proyectos(id) on delete cascade,
  item         text not null,                -- 'NV-ME52'
  descripcion  text,
  codigo_diseno text,                        -- 'ASME VIII-1 Ed.04'
  presion_diseno text,
  radiografia  text,                         -- Full / Spot / None
  eficiencia_junta numeric,
  sobreespesor_corrosion_mm numeric,
  pwht         boolean default false,
  dureza       boolean default false,
  resiliencia_c numeric,
  servicio     text,
  croquis      text                          -- imagen/PDF en Storage
);

create table juntas (
  id           uuid primary key default gen_random_uuid(),
  equipo_id    uuid references equipos(id) on delete cascade,
  marca        text not null,                -- '1', '4A', '8B'...
  pieza1_desc  text, pieza1_od text, pieza1_material_id int references materiales(id), pieza1_esp_mm numeric,
  pieza2_desc  text, pieza2_od text, pieza2_material_id int references materiales(id), pieza2_esp_mm numeric,
  tipo         tipo_junta,
  garganta_a numeric, garganta_b numeric, garganta_c numeric,   -- min. weld size
  procesos     text,                         -- 'GTAW+SMAW' (texto de salida)
  wps_id       uuid references wps(id),      -- WPS asignado
  mapa_x       numeric, mapa_y numeric,      -- posición del globo en el croquis (0-1)
  unique (equipo_id, marca)
);

create table welding_books (
  id          uuid primary key default gen_random_uuid(),
  proyecto_id uuid references proyectos(id),
  numero_doc  text not null,                 -- '271362-01'
  revision    int not null default 0,
  estado      estado_doc default 'borrador',
  dibujado    text, revisado text, aprobado text,
  fecha       date,
  descripcion_rev text,
  unique (numero_doc, revision)
);
create table welding_book_equipos (
  welding_book_id uuid references welding_books(id) on delete cascade,
  equipo_id       uuid references equipos(id),
  orden           int,
  primary key (welding_book_id, equipo_id)
);

-- ---------- 7. Trazabilidad (fase 2) ---------------------------------
create table registro_soldadura (
  id          uuid primary key default gen_random_uuid(),
  junta_id    uuid references juntas(id),
  soldador_id uuid references soldadores(id),
  wpq_id      uuid references wpq(id),
  fecha       date,
  consumible_id int references consumibles(id),
  lote_consumible text,
  end_tipo    text, end_resultado text, reparacion boolean default false
);

-- ---------- 8. Usuarios, roles y auditoría ---------------------------
create table perfiles (
  id     uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  rol    rol_usuario not null default 'lector'
);

create table auditoria (
  id        bigserial primary key,
  tabla     text, registro uuid, accion text,
  datos     jsonb, usuario uuid, fecha timestamptz default now()
);

-- ---------- 9. RLS (patrón base, ajustar por tabla) ------------------
create or replace function es_rol(r rol_usuario[]) returns boolean
language sql stable as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol = any(r));
$$;

do $$
declare t text;
begin
  foreach t in array array['pqr','pqr_procesos','pqr_ensayos','wps','wps_procesos','wps_pqr',
    'wpq','wpq_continuidad','soldadores','proyectos','equipos','juntas','welding_books',
    'welding_book_equipos','materiales','consumibles','registro_soldadura']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "lectura" on %I for select using (auth.uid() is not null)', t);
    execute format('create policy "escritura" on %I for all
                    using (es_rol(array[''admin'',''ingeniero'']::rol_usuario[]))
                    with check (es_rol(array[''admin'',''ingeniero'']::rol_usuario[]))', t);
  end loop;
end $$;

-- ---------- 10. Vista clave: WPS válidos para una junta -----------
-- Ejemplo de uso: select * from wps_validos_para(1,2, 15, 'GTAW+SMAW', 'penetracion');
-- (Implementar en fase 2: compara p_no/grupo, espesor, tipo, impacto y PWHT)
