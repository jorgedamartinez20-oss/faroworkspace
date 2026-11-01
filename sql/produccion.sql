-- =====================================================================================
-- PRODUCCIÓN · /produccion (empresas y agencias)
-- Un solo archivo, se corre UNA vez en Supabase → SQL Editor → Run. Se puede volver a correr sin problema.
-- Solo AGREGA columnas, tablas y funciones. Las galerías y los datos actuales no cambian.
--   Parte 1  versiones (V1, V2…), historial y revisores por nombre
--   Parte 2  perfil del cliente, ideas, referencias, guiones con versiones, fechas, documentos y pagos
--   Parte 3  permiso para que el cliente suba y vea los archivos de SU carpeta
-- =====================================================================================

-- PARTE 1 · Versiones (V1, V2, V3…), historial de correcciones y revisores por nombre

-- 1) Versiones: cada archivo pertenece a una "pieza"; cada versión es una fila con su propio archivo en R2 (no se sobrescribe ni se borra)
alter table public.en_archivos add column if not exists pieza_id uuid;
alter table public.en_archivos add column if not exists estado_por text;     -- quién marcó aprobado / cambios
alter table public.en_archivos add column if not exists estado_en timestamptz;
alter table public.en_archivos add column if not exists nota_version text;   -- qué se corrigió en esta versión
alter table public.en_archivos add column if not exists rol text not null default 'revision';  -- 'revision' (con marca de agua) o 'final' (alta calidad, pestaña Entregas)

update public.en_archivos set pieza_id = id where pieza_id is null;

create or replace function public.en_arch_pieza() returns trigger language plpgsql as $$
begin if new.pieza_id is null then new.pieza_id := new.id; end if; return new; end $$;
drop trigger if exists en_arch_pieza_t on public.en_archivos;
create trigger en_arch_pieza_t before insert on public.en_archivos for each row execute function public.en_arch_pieza();

create unique index if not exists en_archivos_pieza_version on public.en_archivos (pieza_id, version);

-- 2) Quién escribió cada nota, quién la resolvió y cómo
alter table public.en_comentarios add column if not exists autor text;
alter table public.en_comentarios add column if not exists resuelto_por text;
alter table public.en_comentarios add column if not exists resuelto_en timestamptz;
alter table public.en_comentarios add column if not exists resolucion text;
alter table public.en_rondas add column if not exists enviada_por text;

-- 3) Historial de cada espacio
create table if not exists public.en_historial (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.en_proyectos(id) on delete cascade,
  archivo_id uuid references public.en_archivos(id) on delete set null,
  pieza_id uuid,
  version int,
  ronda int,
  evento text not null,            -- version | aprobado | cambios | pendiente | ronda | resuelto | abierta
  autor text,
  detalle text,
  creado timestamptz not null default now()
);
create index if not exists en_historial_proy on public.en_historial (proyecto_id, creado);
alter table public.en_historial enable row level security;
drop policy if exists en_historial_admin on public.en_historial;
create policy en_historial_admin on public.en_historial for all using (es_admin()) with check (es_admin());
drop policy if exists en_historial_cliente on public.en_historial;
create policy en_historial_cliente on public.en_historial for select using (
  exists (select 1 from public.en_proyectos p where p.id = en_historial.proyecto_id and p.visible and p.cuenta_id = auth.uid()));

-- 4) Revisores (varias personas entrando a la misma cuenta)
create table if not exists public.en_revisores (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 60),
  creado timestamptz not null default now(),
  ultimo timestamptz not null default now()
);
create unique index if not exists en_revisores_nombre on public.en_revisores (cuenta_id, lower(btrim(nombre)));
alter table public.en_revisores enable row level security;
drop policy if exists en_revisores_admin on public.en_revisores;
create policy en_revisores_admin on public.en_revisores for all using (es_admin()) with check (es_admin());
drop policy if exists en_revisores_yo on public.en_revisores;
create policy en_revisores_yo on public.en_revisores for select using (cuenta_id = auth.uid());

create or replace function public.en_registrar_revisor(p_nombre text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare n text := btrim(coalesce(p_nombre, ''));
begin
  if auth.uid() is null or char_length(n) < 1 or char_length(n) > 60 then raise exception 'Nombre no válido'; end if;
  if not exists (select 1 from en_cuentas where user_id = auth.uid() and activo) then raise exception 'Cuenta no activa'; end if;
  insert into en_revisores(cuenta_id, nombre) values (auth.uid(), n)
    on conflict (cuenta_id, lower(btrim(nombre))) do update set ultimo = now();
  return (select coalesce(jsonb_agg(nombre order by nombre), '[]'::jsonb) from en_revisores where cuenta_id = auth.uid());
end $$;

-- 5) Marcar una versión (solo la más reciente de cada pieza) y dejar quién y cuándo
drop function if exists public.en_marcar_archivo(uuid, text);
create or replace function public.en_marcar_archivo(p_archivo uuid, p_estado text, p_autor text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare a en_archivos; p en_proyectos; quien text := nullif(btrim(coalesce(p_autor, '')), '');
begin
  if p_estado not in ('pendiente','aprobado','cambios') then raise exception 'estado inválido'; end if;
  select a2.* into a from en_archivos a2
   where a2.id = p_archivo and a2.habilitado and a2.rol = 'revision'
     and not exists (select 1 from en_archivos b where b.pieza_id = a2.pieza_id and b.version > a2.version and b.habilitado);
  if not found then raise exception 'No se pudo marcar'; end if;
  select * into p from en_proyectos where id = a.proyecto_id and visible and cuenta_id = auth.uid() and estado = 'en_revision';
  if not found then raise exception 'No se pudo marcar'; end if;
  update en_archivos set estado = p_estado, estado_por = quien, estado_en = now() where id = a.id;
  insert into en_historial(proyecto_id, archivo_id, pieza_id, version, ronda, evento, autor)
    values (a.proyecto_id, a.id, a.pieza_id, a.version, p.ronda, p_estado, quien);
end $$;

-- 6) Enviar la ronda: cuenta solo la última versión de cada pieza
drop function if exists public.en_enviar_ronda(uuid);
create or replace function public.en_enviar_ronda(p_proyecto uuid, p_autor text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare p en_proyectos; n_cam int; n_apr int; n_tot int; nuevo text; quien text := nullif(btrim(coalesce(p_autor, '')), '');
begin
  select * into p from en_proyectos where id = p_proyecto and visible and cuenta_id = auth.uid();
  if not found then raise exception 'Proyecto no disponible'; end if;
  if p.estado <> 'en_revision' then raise exception 'Esta ronda ya fue enviada'; end if;
  update en_comentarios set enviado = true where proyecto_id = p.id and ronda = p.ronda and user_id = auth.uid() and enviado = false;
  with ult as (
    select a.* from en_archivos a
     where a.proyecto_id = p.id and a.habilitado and a.rol = 'revision'
       and not exists (select 1 from en_archivos b where b.pieza_id = a.pieza_id and b.version > a.version and b.habilitado))
  select count(*) filter (where estado = 'cambios'), count(*) filter (where estado = 'aprobado'), count(*)
    into n_cam, n_apr, n_tot from ult;
  nuevo := case when n_tot > 0 and n_apr = n_tot then 'aprobado' else 'cambios_pedidos' end;
  insert into en_rondas(proyecto_id, ronda, cambios, aprobados, enviada_por) values (p.id, p.ronda, n_cam, n_apr, quien);
  update en_proyectos set estado = nuevo, actualizado = now() where id = p.id;
  insert into en_historial(proyecto_id, ronda, evento, autor, detalle)
    values (p.id, p.ronda, 'ronda', quien, n_apr || ' aprobadas · ' || n_cam || ' con cambios');
  return jsonb_build_object('estado', nuevo, 'ronda', p.ronda, 'cambios', n_cam, 'aprobados', n_apr);
end $$;

-- 7) Abrir la siguiente ronda: solo se reinician las últimas versiones; las anteriores conservan su estado como historial
create or replace function public.en_abrir_ronda(p_proyecto uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare p en_proyectos;
begin
  if not es_admin() then raise exception 'Solo el administrador'; end if;
  select * into p from en_proyectos where id = p_proyecto;
  if not found then raise exception 'No existe'; end if;
  update en_archivos a set estado = 'pendiente'
   where a.proyecto_id = p.id and a.estado = 'cambios'
     and not exists (select 1 from en_archivos b where b.pieza_id = a.pieza_id and b.version > a.version);
  update en_proyectos set ronda = p.ronda + 1, estado = 'en_revision', actualizado = now() where id = p.id;
  insert into en_historial(proyecto_id, ronda, evento, autor) values (p.id, p.ronda + 1, 'abierta', 'Faro');
  return jsonb_build_object('ronda', p.ronda + 1);
end $$;

grant select on public.en_historial, public.en_revisores to authenticated;
grant insert, update, delete on public.en_historial, public.en_revisores to authenticated;   -- las reglas (RLS) dejan escribir solo a Faro
revoke all on function public.en_marcar_archivo(uuid, text, text) from public, anon;
revoke all on function public.en_enviar_ronda(uuid, text) from public, anon;
revoke all on function public.en_registrar_revisor(text) from public, anon;
grant execute on function public.en_marcar_archivo(uuid, text, text) to authenticated;
grant execute on function public.en_enviar_ronda(uuid, text) to authenticated;
grant execute on function public.en_registrar_revisor(text) to authenticated;


-- =====================================================================================
-- PARTE 2 · Perfil del cliente, preproducción, fechas, documentos y pagos
-- =====================================================================================

-- Utilidades -------------------------------------------------------------------------
-- ¿Este proyecto es de la cuenta (empresa/agencia) que tiene la sesión abierta y está visible?
create or replace function public.pr_mio(p_proyecto uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from en_proyectos p join en_cuentas c on c.user_id = p.cuenta_id
     where p.id = p_proyecto and p.visible and p.cuenta_id = auth.uid() and c.activo and c.tipo in ('empresa','agencia'))
$$;

-- ¿Los pagos de este proyecto se muestran al cliente? (interruptor en Workspace)
create or replace function public.pr_fin_visible(p_proyecto uuid) returns boolean
language plpgsql stable security definer set search_path to 'public' as $$
begin
  return coalesce((select f.visible from pr_finanzas f where f.proyecto_id = p_proyecto), false);
end $$;

-- Carpeta de archivos del cliente (la misma de Clientes en Workspace)
create or replace function public.pr_mi_carpeta() returns text
language sql stable security definer set search_path to 'public' as $$
  select cl.carpeta from en_cuentas c join cl_clientes cl on cl.id = c.cliente_id
   where c.user_id = auth.uid() and c.activo and c.tipo in ('empresa','agencia') limit 1
$$;

create or replace function public.pr_dueno_carpeta(p_cliente uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from en_cuentas c where c.user_id = auth.uid() and c.activo
                    and c.tipo in ('empresa','agencia') and c.cliente_id = p_cliente)
$$;

-- Historial único del proyecto (lo usan todas las funciones de abajo)
create or replace function public.pr_log(p_proyecto uuid, p_evento text, p_autor text, p_detalle text default null, p_version int default null)
returns void language sql security definer set search_path to 'public' as $$
  insert into en_historial(proyecto_id, evento, autor, detalle, version)
  values (p_proyecto, p_evento, nullif(btrim(coalesce(p_autor,'')),''), left(p_detalle, 300), p_version)
$$;
revoke all on function public.pr_log(uuid, text, text, text, int) from public, anon, authenticated;

-- 2.1 Perfil del cliente -------------------------------------------------------------
create table if not exists public.pr_perfil (
  cuenta_id uuid primary key references public.en_cuentas(user_id) on delete cascade,
  cliente_id uuid,
  organizacion text,        -- nombre comercial o legal
  sector text,
  descripcion text,         -- a qué se dedican
  contacto_nombre text,
  cargo text,
  correo text,
  telefono text,
  web text,
  redes text,
  desde date,               -- cliente desde (solo Faro lo edita)
  objetivos text,
  mensaje text,             -- qué quiere comunicar
  voz text,                 -- cómo habla la marca
  publico text,
  tipografias text,
  colores text,
  logo_key text,
  brandbook_key text,
  brandbook_url text,
  actualizado timestamptz not null default now(),
  actualizado_por text
);
create table if not exists public.pr_perfil_interno (
  cuenta_id uuid primary key references public.en_cuentas(user_id) on delete cascade,
  notas text,               -- notas privadas de Faro: el cliente nunca las ve
  actualizado timestamptz not null default now()
);
alter table public.pr_perfil enable row level security;
alter table public.pr_perfil_interno enable row level security;
drop policy if exists pr_perfil_admin on public.pr_perfil;
create policy pr_perfil_admin on public.pr_perfil for all using (es_admin()) with check (es_admin());
drop policy if exists pr_perfil_yo on public.pr_perfil;
create policy pr_perfil_yo on public.pr_perfil for select using (cuenta_id = auth.uid());
drop policy if exists pr_perfil_int_admin on public.pr_perfil_interno;
create policy pr_perfil_int_admin on public.pr_perfil_interno for all using (es_admin()) with check (es_admin());

-- El cliente completa su propio perfil (todo menos "cliente desde")
create or replace function public.pr_perfil_guardar(p_datos jsonb, p_autor text default null) returns void
language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := auth.uid(); quien text := nullif(btrim(coalesce(p_autor,'')),''); t text; k text;
  campos text[] := array['organizacion','sector','descripcion','contacto_nombre','cargo','correo','telefono','web','redes','objetivos','mensaje','voz','publico','tipografias','colores','logo_key','brandbook_key','brandbook_url'];
begin
  if pr_cuenta() is null then raise exception 'Cuenta no disponible'; end if;
  insert into pr_perfil(cuenta_id) values (uid) on conflict (cuenta_id) do nothing;
  foreach k in array campos loop
    if p_datos ? k then
      t := left(btrim(coalesce(p_datos ->> k, '')), 4000);
      if k in ('logo_key','brandbook_key') and t <> '' and pr_mi_carpeta() is not null and left(t, length(pr_mi_carpeta())) <> pr_mi_carpeta() then
        raise exception 'Archivo no válido';
      end if;
      if k in ('web','brandbook_url') and t <> '' and t !~* '^https://' then
        t := 'https://' || regexp_replace(t, '^https?://', '', 'i');
      end if;
      execute format('update pr_perfil set %I = nullif($1, '''') where cuenta_id = $2', k) using t, uid;
    end if;
  end loop;
  update pr_perfil set actualizado = now(), actualizado_por = quien where cuenta_id = uid;
end $$;

-- 2.2 Ideas ----------------------------------------------------------------------------
create table if not exists public.pr_ideas (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.en_proyectos(id) on delete cascade,
  autor_rol text not null default 'cliente' check (autor_rol in ('cliente','faro')),
  autor text,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 160),
  texto text,
  links jsonb not null default '[]'::jsonb,
  estado text not null default 'propuesta' check (estado in ('propuesta','conversando','aprobada','descartada')),
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index if not exists pr_ideas_proy on public.pr_ideas (proyecto_id, creado);

-- 2.3 Referencias y archivos del cliente ---------------------------------------------
create table if not exists public.pr_referencias (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.en_proyectos(id) on delete cascade,
  autor_rol text not null default 'cliente' check (autor_rol in ('cliente','faro')),
  autor text,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 200),
  url text,
  key text,
  tipo text not null default 'link' check (tipo in ('link','imagen','video','audio','pdf','otro')),
  creado timestamptz not null default now()
);
create index if not exists pr_ref_proy on public.pr_referencias (proyecto_id, creado);

-- 2.4 Guiones con versiones ------------------------------------------------------------
create table if not exists public.pr_guiones (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.en_proyectos(id) on delete cascade,
  guion_id uuid not null,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 160),
  version int not null default 1,
  texto text not null default '',
  nota text,                 -- qué cambió en esta versión
  autor text,
  autor_rol text not null default 'faro' check (autor_rol in ('cliente','faro')),
  estado text not null default 'en_revision' check (estado in ('borrador','en_revision','aprobado')),
  aprobado_por text,
  aprobado_en timestamptz,
  creado timestamptz not null default now(),
  unique (guion_id, version)
);
create index if not exists pr_guiones_proy on public.pr_guiones (proyecto_id, guion_id, version);

-- Notas (comentarios) sobre ideas y guiones
create table if not exists public.pr_notas (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.en_proyectos(id) on delete cascade,
  objeto text not null check (objeto in ('idea','guion')),
  objeto_id uuid not null,   -- id de la idea, o guion_id del guion
  version int,
  autor text,
  autor_rol text not null default 'cliente' check (autor_rol in ('cliente','faro')),
  texto text not null check (char_length(btrim(texto)) between 1 and 3000),
  resuelto boolean not null default false,
  creado timestamptz not null default now()
);
create index if not exists pr_notas_obj on public.pr_notas (proyecto_id, objeto, objeto_id, creado);

-- 2.5 Fechas del proyecto (llamados, reuniones, entregas) ------------------------------
create table if not exists public.pr_fechas (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.en_proyectos(id) on delete cascade,
  titulo text not null,
  tipo text not null default 'otro' check (tipo in ('llamado','reunion','entrega','pago','revision','otro')),
  fecha date not null,
  hora time,
  hora_fin time,
  lugar text,
  nota text,
  link text,
  produccion_id uuid,        -- si viene de la pestaña Producciones
  visible boolean not null default true,
  creado timestamptz not null default now()
);
create index if not exists pr_fechas_proy on public.pr_fechas (proyecto_id, fecha);

-- 2.6 Documentos y pagos (solo orden y registro; no cobra nada) ---------------------
create table if not exists public.pr_finanzas (
  proyecto_id uuid primary key references public.en_proyectos(id) on delete cascade,
  total numeric(12,2) not null default 0,
  moneda text not null default 'GTQ',
  nota text,
  visible boolean not null default true,
  actualizado timestamptz not null default now()
);

create table if not exists public.pr_pagos (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.en_proyectos(id) on delete cascade,
  concepto text not null,
  monto numeric(12,2) not null default 0 check (monto >= 0),
  fecha date,
  metodo text,
  estado text not null default 'pendiente' check (estado in ('pendiente','reportado','confirmado')),
  comprobante_key text,
  reportado_por text,
  nota text,
  creado timestamptz not null default now()
);
create index if not exists pr_pagos_proy on public.pr_pagos (proyecto_id, creado);

create table if not exists public.pr_documentos (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.en_proyectos(id) on delete cascade,
  tipo text not null default 'otro' check (tipo in ('cotizacion','contrato','factura','recibo','comprobante','otro')),
  titulo text not null,
  key text,
  url text,
  monto numeric(12,2),
  fecha date,
  visible boolean not null default true,
  creado timestamptz not null default now()
);
create index if not exists pr_docs_proy on public.pr_documentos (proyecto_id, creado);

-- Reglas de acceso: Faro lo ve y edita todo; el cliente solo ve lo de su proyecto ----
do $$
declare t text;
begin
  foreach t in array array['pr_ideas','pr_referencias','pr_guiones','pr_notas','pr_fechas','pr_finanzas','pr_pagos','pr_documentos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_admin', t);
    execute format('create policy %I on public.%I for all using (es_admin()) with check (es_admin())', t||'_admin', t);
    execute format('drop policy if exists %I on public.%I', t||'_cliente', t);
  end loop;
end $$;
create policy pr_ideas_cliente       on public.pr_ideas       for select using (pr_mio(proyecto_id));
create policy pr_referencias_cliente on public.pr_referencias for select using (pr_mio(proyecto_id));
create policy pr_guiones_cliente     on public.pr_guiones     for select using (pr_mio(proyecto_id) and estado <> 'borrador');
create policy pr_notas_cliente       on public.pr_notas       for select using (pr_mio(proyecto_id));
create policy pr_fechas_cliente      on public.pr_fechas      for select using (pr_mio(proyecto_id) and visible);
create policy pr_finanzas_cliente    on public.pr_finanzas    for select using (pr_mio(proyecto_id) and visible);
create policy pr_pagos_cliente       on public.pr_pagos       for select using (pr_mio(proyecto_id) and pr_fin_visible(proyecto_id));
create policy pr_documentos_cliente  on public.pr_documentos  for select using (pr_mio(proyecto_id) and visible);

-- Funciones que usa el cliente para escribir (cada una revisa que sea SU proyecto) ----
create or replace function public.pr_cuenta() returns uuid
language sql stable security definer set search_path to 'public' as $$
  select user_id from en_cuentas where user_id = auth.uid() and activo and tipo in ('empresa','agencia')
$$;

create or replace function public.pr_idea_guardar(p_proyecto uuid, p_id uuid, p_titulo text, p_texto text, p_links jsonb, p_autor text default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare quien text := nullif(btrim(coalesce(p_autor,'')),''); nid uuid; ls jsonb := coalesce(p_links, '[]'::jsonb);
begin
  if not pr_mio(p_proyecto) then raise exception 'Proyecto no disponible'; end if;
  if char_length(btrim(coalesce(p_titulo,''))) < 1 then raise exception 'Escribe un título'; end if;
  if jsonb_typeof(ls) <> 'array' or jsonb_array_length(ls) > 10 then raise exception 'Enlaces no válidos'; end if;
  if p_id is null then
    insert into pr_ideas(proyecto_id, autor_rol, autor, titulo, texto, links) values (p_proyecto, 'cliente', quien, btrim(p_titulo), left(p_texto, 4000), ls) returning id into nid;
    perform pr_log(p_proyecto, 'idea', quien, 'Nueva idea: ' || btrim(p_titulo));
  else
    update pr_ideas set titulo = btrim(p_titulo), texto = left(p_texto, 4000), links = ls, actualizado = now()
     where id = p_id and proyecto_id = p_proyecto and autor_rol = 'cliente' and estado in ('propuesta','conversando') returning id into nid;
    if nid is null then raise exception 'No se puede editar esta idea'; end if;
  end if;
  return nid;
end $$;

create or replace function public.pr_idea_borrar(p_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  delete from pr_ideas where id = p_id and autor_rol = 'cliente' and estado = 'propuesta' and pr_mio(proyecto_id);
  if not found then raise exception 'No se puede quitar esta idea'; end if;
end $$;

create or replace function public.pr_ref_guardar(p_proyecto uuid, p_titulo text, p_url text, p_key text, p_tipo text, p_autor text default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare quien text := nullif(btrim(coalesce(p_autor,'')),''); nid uuid; carp text := pr_mi_carpeta(); u text := nullif(btrim(coalesce(p_url,'')),''); k text := nullif(btrim(coalesce(p_key,'')),'');
begin
  if not pr_mio(p_proyecto) then raise exception 'Proyecto no disponible'; end if;
  if p_tipo not in ('link','imagen','video','audio','pdf','otro') then raise exception 'Tipo no válido'; end if;
  if u is null and k is null then raise exception 'Falta el enlace o el archivo'; end if;
  if u is not null and u !~* '^https://' then u := 'https://' || regexp_replace(u, '^https?://', '', 'i'); end if;
  if k is not null and (carp is null or left(k, length(carp)) <> carp or k like '%..%') then raise exception 'Archivo no válido'; end if;
  insert into pr_referencias(proyecto_id, autor_rol, autor, titulo, url, key, tipo)
  values (p_proyecto, 'cliente', quien, left(btrim(coalesce(nullif(p_titulo,''), u, k)), 200), u, k, p_tipo) returning id into nid;
  perform pr_log(p_proyecto, 'referencia', quien, 'Agregó: ' || left(coalesce(nullif(p_titulo,''), u, k), 120));
  return nid;
end $$;

create or replace function public.pr_ref_borrar(p_id uuid) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  delete from pr_referencias where id = p_id and autor_rol = 'cliente' and pr_mio(proyecto_id);
  if not found then raise exception 'No se puede quitar'; end if;
end $$;

-- Guion: tanto Faro como el cliente pueden proponer una versión nueva (nunca se pisa la anterior)
create or replace function public.pr_guion_version(p_proyecto uuid, p_guion uuid, p_titulo text, p_texto text, p_nota text, p_autor text default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare quien text := nullif(btrim(coalesce(p_autor,'')),''); rol text; g uuid := p_guion; v int; ult pr_guiones; nid uuid; tit text := btrim(coalesce(p_titulo,''));
begin
  if es_admin() then rol := 'faro'; quien := coalesce(quien, 'Faro');
  elsif pr_mio(p_proyecto) then rol := 'cliente';
  else raise exception 'Proyecto no disponible'; end if;
  if g is null then
    if char_length(tit) < 1 then raise exception 'Ponle un título al guion'; end if;
    g := gen_random_uuid(); v := 1;
  else
    select * into ult from pr_guiones where proyecto_id = p_proyecto and guion_id = g order by version desc limit 1;
    if not found then raise exception 'No existe ese guion'; end if;
    if ult.estado = 'aprobado' and rol = 'cliente' then raise exception 'Este guion ya está aprobado'; end if;
    v := ult.version + 1; tit := coalesce(nullif(tit,''), ult.titulo);
  end if;
  insert into pr_guiones(proyecto_id, guion_id, titulo, version, texto, nota, autor, autor_rol, estado)
  values (p_proyecto, g, tit, v, left(coalesce(p_texto,''), 60000), left(p_nota, 600), quien, rol, 'en_revision') returning id into nid;
  perform pr_log(p_proyecto, 'guion', quien, tit || ' · versión ' || v || case when p_nota is not null and btrim(p_nota) <> '' then ' · ' || left(p_nota, 120) else '' end, v);
  return nid;
end $$;

create or replace function public.pr_guion_aprobar(p_id uuid, p_aprobar boolean, p_autor text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare g pr_guiones; quien text := nullif(btrim(coalesce(p_autor,'')),'');
begin
  select * into g from pr_guiones where id = p_id;
  if not found then raise exception 'No existe'; end if;
  if not (es_admin() or pr_mio(g.proyecto_id)) then raise exception 'Proyecto no disponible'; end if;
  if exists (select 1 from pr_guiones x where x.guion_id = g.guion_id and x.version > g.version) then raise exception 'Hay una versión más reciente'; end if;
  if not es_admin() and not p_aprobar then raise exception 'Solo Faro puede reabrir un guion'; end if;
  update pr_guiones set estado = case when p_aprobar then 'aprobado' else 'en_revision' end,
         aprobado_por = case when p_aprobar then quien else null end, aprobado_en = case when p_aprobar then now() else null end where id = g.id;
  perform pr_log(g.proyecto_id, case when p_aprobar then 'guion_aprobado' else 'guion_reabierto' end, quien, g.titulo || ' · versión ' || g.version, g.version);
end $$;

create or replace function public.pr_nota_agregar(p_proyecto uuid, p_objeto text, p_objeto_id uuid, p_version int, p_texto text, p_autor text default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare quien text := nullif(btrim(coalesce(p_autor,'')),''); rol text; nid uuid;
begin
  if es_admin() then rol := 'faro'; quien := coalesce(quien, 'Faro');
  elsif pr_mio(p_proyecto) then rol := 'cliente';
  else raise exception 'Proyecto no disponible'; end if;
  if p_objeto not in ('idea','guion') then raise exception 'Objeto no válido'; end if;
  insert into pr_notas(proyecto_id, objeto, objeto_id, version, autor, autor_rol, texto) values (p_proyecto, p_objeto, p_objeto_id, p_version, quien, rol, btrim(p_texto)) returning id into nid;
  return nid;
end $$;

create or replace function public.pr_nota_resolver(p_id uuid, p_resuelto boolean) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  update pr_notas set resuelto = p_resuelto where id = p_id and (es_admin() or pr_mio(proyecto_id));
  if not found then raise exception 'No existe'; end if;
end $$;

-- El cliente avisa que pagó: adjunta comprobante; Faro lo confirma
create or replace function public.pr_pago_reportar(p_proyecto uuid, p_pago uuid, p_concepto text, p_monto numeric, p_key text, p_nota text, p_autor text default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare quien text := nullif(btrim(coalesce(p_autor,'')),''); nid uuid; carp text := pr_mi_carpeta(); k text := nullif(btrim(coalesce(p_key,'')),'');
begin
  if not pr_mio(p_proyecto) or not pr_fin_visible(p_proyecto) then raise exception 'Proyecto no disponible'; end if;
  if k is not null and (carp is null or left(k, length(carp)) <> carp or k like '%..%') then raise exception 'Archivo no válido'; end if;
  if p_pago is not null then
    update pr_pagos set comprobante_key = coalesce(k, comprobante_key), estado = 'reportado', reportado_por = quien, nota = coalesce(nullif(left(p_nota, 500),''), nota), fecha = coalesce(fecha, current_date)
     where id = p_pago and proyecto_id = p_proyecto and estado <> 'confirmado' returning id into nid;
    if nid is null then raise exception 'No se puede actualizar este pago'; end if;
  else
    insert into pr_pagos(proyecto_id, concepto, monto, fecha, estado, comprobante_key, reportado_por, nota)
    values (p_proyecto, left(coalesce(nullif(btrim(p_concepto),''),'Pago'), 200), greatest(coalesce(p_monto,0),0), current_date, 'reportado', k, quien, left(p_nota, 500)) returning id into nid;
  end if;
  perform pr_log(p_proyecto, 'pago_reportado', quien, 'Comprobante enviado');
  return nid;
end $$;

-- Permisos de ejecución --------------------------------------------------------------
revoke all on function public.pr_mio(uuid), public.pr_fin_visible(uuid), public.pr_mi_carpeta(), public.pr_dueno_carpeta(uuid), public.pr_cuenta() from public, anon;
grant execute on function public.pr_mio(uuid), public.pr_fin_visible(uuid), public.pr_mi_carpeta(), public.pr_dueno_carpeta(uuid), public.pr_cuenta() to authenticated;
revoke all on function public.pr_perfil_guardar(jsonb, text), public.pr_idea_guardar(uuid, uuid, text, text, jsonb, text), public.pr_idea_borrar(uuid),
  public.pr_ref_guardar(uuid, text, text, text, text, text), public.pr_ref_borrar(uuid), public.pr_guion_version(uuid, uuid, text, text, text, text),
  public.pr_guion_aprobar(uuid, boolean, text), public.pr_nota_agregar(uuid, text, uuid, int, text, text), public.pr_nota_resolver(uuid, boolean),
  public.pr_pago_reportar(uuid, uuid, text, numeric, text, text, text) from public, anon;
grant execute on function public.pr_perfil_guardar(jsonb, text), public.pr_idea_guardar(uuid, uuid, text, text, jsonb, text), public.pr_idea_borrar(uuid),
  public.pr_ref_guardar(uuid, text, text, text, text, text), public.pr_ref_borrar(uuid), public.pr_guion_version(uuid, uuid, text, text, text, text),
  public.pr_guion_aprobar(uuid, boolean, text), public.pr_nota_agregar(uuid, text, uuid, int, text, text), public.pr_nota_resolver(uuid, boolean),
  public.pr_pago_reportar(uuid, uuid, text, numeric, text, text, text) to authenticated;
grant select on public.pr_perfil, public.pr_perfil_interno, public.pr_ideas, public.pr_referencias, public.pr_guiones, public.pr_notas, public.pr_fechas,
  public.pr_finanzas, public.pr_pagos, public.pr_documentos to authenticated;
grant insert, update, delete on public.pr_perfil, public.pr_perfil_interno, public.pr_ideas, public.pr_referencias, public.pr_guiones, public.pr_notas, public.pr_fechas,
  public.pr_finanzas, public.pr_pagos, public.pr_documentos to authenticated;   -- las reglas (RLS) dejan escribir solo a Faro

-- =====================================================================================
-- PARTE 3 · El cliente ve y sube archivos de SU carpeta (referencias, logo, comprobantes)
-- Es la misma función de siempre; solo se agrega la línea "pr_dueno_carpeta". Borrar sigue siendo solo del equipo.
-- =====================================================================================
create or replace function public.archivo_permiso(p_key text, p_accion text)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare v_id uuid; v_carp text; v_resto text; v_tipo text; v_n int;
begin
  if p_key is null or p_accion not in ('leer','escribir','borrar') or length(p_key) > 400
     or p_key like '%..%' or p_key like '%//%' or position(E'\\' in p_key) > 0 or left(p_key,1) = '/' or right(p_key,1) = '/' then
    return false;
  end if;
  if public.es_admin() then return true; end if;

  -- carpeta de alumno
  select id, carpeta into v_id, v_carp from public.ac_estudiantes where carpeta is not null and starts_with(p_key, carpeta) limit 1;
  if v_id is not null then
    v_resto := substr(p_key, length(v_carp) + 1);
    v_n := array_length(string_to_array(v_resto, '/'), 1);
    v_tipo := split_part(v_resto, '/', 1);
    if v_n <> 2 or split_part(v_resto, '/', 2) = '' then return false; end if;
    if v_tipo = 'facturas' then
      return public.ac_ve_facturas(v_id) and p_accion = 'leer' or public.tiene_permiso('academy_facturas');
    end if;
    if v_tipo in ('material','respuestas') then
      if p_accion = 'leer' then return public.ac_ve(v_id) or public.ac_docente_de(v_id) or public.tiene_permiso('academy'); end if;
      return public.ac_docente_de(v_id) or public.tiene_permiso('academy');
    end if;
    if v_tipo in ('practicas','mis-archivos') then
      if p_accion = 'leer' then return public.ac_ve(v_id) or public.ac_docente_de(v_id) or public.tiene_permiso('academy'); end if;
      if p_accion = 'escribir' then return public.ac_es_alumno(v_id) or public.tiene_permiso('academy'); end if;
      return public.tiene_permiso('academy');            -- borrar: solo el equipo; alumnos y familias no borran
    end if;
    if v_tipo = 'diplomas' then
      if p_accion = 'leer' then return public.ac_ve(v_id) or public.ac_docente_de(v_id) or public.tiene_permiso('academy'); end if;
      return public.tiene_permiso('academy');
    end if;
    return false;
  end if;

  -- carpeta de docente
  select id, carpeta into v_id, v_carp from public.ac_docentes where carpeta is not null and starts_with(p_key, carpeta) limit 1;
  if v_id is not null then
    v_resto := substr(p_key, length(v_carp) + 1);
    if v_resto = '' or position('/' in v_resto) > 0 then return false; end if;
    if public.tiene_permiso('academy') then return true; end if;
    if exists (select 1 from public.ac_cuentas c where c.user_id = auth.uid() and c.rol = 'docente' and c.activo and c.docente_id = v_id) then
      return true;                                       -- el docente en su propia carpeta: ver, subir y borrar
    end if;
    return p_accion = 'leer' and exists (select 1 from public.ac_asignaciones a where a.docente_id = v_id and public.ac_ve(a.estudiante_id));
  end if;

  -- carpeta de cliente de Studios
  select id, carpeta into v_id, v_carp from public.cl_clientes where carpeta is not null and starts_with(p_key, carpeta) limit 1;
  if v_id is not null then
    v_resto := substr(p_key, length(v_carp) + 1);
    if v_resto = '' or position('/' in v_resto) > 0 then return false; end if;
    if p_accion = 'leer' then return public.cl_ve(v_id) or public.tiene_permiso('clientes') or public.pr_dueno_carpeta(v_id); end if;
    if p_accion = 'escribir' then return public.tiene_permiso('clientes') or public.pr_dueno_carpeta(v_id); end if;
    return public.tiene_permiso('clientes');
  end if;

  return false;
end $function$;
