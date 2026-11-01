-- Entregas · versiones (V1, V2, V3…), historial de correcciones y revisores por nombre
-- Solo AGREGA columnas, tablas y funciones: las galerías y los datos actuales no cambian.

-- 1) Versiones: cada archivo pertenece a una "pieza"; cada versión es una fila con su propio archivo en R2 (no se sobrescribe ni se borra)
alter table public.en_archivos add column if not exists pieza_id uuid;
alter table public.en_archivos add column if not exists estado_por text;     -- quién marcó aprobado / cambios
alter table public.en_archivos add column if not exists estado_en timestamptz;
alter table public.en_archivos add column if not exists nota_version text;   -- qué se corrigió en esta versión

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
   where a2.id = p_archivo and a2.habilitado
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
     where a.proyecto_id = p.id and a.habilitado
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

revoke all on function public.en_marcar_archivo(uuid, text, text) from public, anon;
revoke all on function public.en_enviar_ronda(uuid, text) from public, anon;
revoke all on function public.en_registrar_revisor(text) from public, anon;
grant execute on function public.en_marcar_archivo(uuid, text, text) to authenticated;
grant execute on function public.en_enviar_ronda(uuid, text) to authenticated;
grant execute on function public.en_registrar_revisor(text) to authenticated;
