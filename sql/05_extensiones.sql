-- WMAP · extensiones: rangos, vigilancia WPQ, ajustes, plan de END
alter table pqr add column if not exists multipasada boolean default true;
alter table wpq add column if not exists espesor_depositado_mm numeric;
alter table wpq add column if not exists capas int;

create table if not exists ajustes (id text primary key, valor jsonb);

create table if not exists end_plan (
  id uuid primary key default gen_random_uuid(),
  junta_id uuid references juntas(id) on delete cascade,
  tipo text not null check (tipo in ('VT','RT','UT','PT','MT')),
  requerido boolean default true,
  referencia text
);
create table if not exists end_resultados (
  id uuid primary key default gen_random_uuid(),
  junta_id uuid references juntas(id) on delete cascade,
  tipo text not null,
  fecha date,
  informe text,
  conforme boolean,
  observaciones text,
  created_at timestamptz default now()
);
create index if not exists end_plan_junta on end_plan(junta_id);
create index if not exists end_res_junta on end_resultados(junta_id);

do $$
declare t text;
begin
  foreach t in array array['ajustes','end_plan','end_resultados']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "lectura" on %I', t);
    execute format('drop policy if exists "escritura" on %I', t);
    execute format('create policy "lectura" on %I for select using (auth.uid() is not null)', t);
    execute format('create policy "escritura" on %I for all
                    using (es_rol(array[''admin'',''ingeniero'',''inspector'']::rol_usuario[]))
                    with check (es_rol(array[''admin'',''ingeniero'',''inspector'']::rol_usuario[]))', t);
  end loop;
end $$;
