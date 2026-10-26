-- Faro Workspace · Producciones (calendario, inventario, mantenimiento y hojas de llamado)
-- Pega TODO esto en Supabase → SQL Editor → Run. Se puede correr más de una vez sin romper nada.
-- Protección: solo el director con autenticador activo (es_admin() = correo del director + mfa_ok()).
--   · Tablas con RLS y sin acceso para anon.
--   · Inventario: nunca se borra desde la app (se archiva). Serie y factura viven en otra tabla (prod_inv_privado).
--   · Auditoría: cada alta, cambio o borrado queda en prod_auditoria (quién, cuándo, antes y después) y no se puede editar desde la app.
--   · Fotos: bucket privado «inventario», solo se ven con enlace firmado de 1 hora y solo para el director.

create table if not exists public.prod_inventario (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  categoria text not null,
  descripcion text not null,
  marca text,
  modelo text,
  notas text,
  propiedad text not null default 'propio' check (propiedad in ('propio','prestado')),
  dueno text,
  estado text not null default 'disponible' check (estado in ('disponible','mantenimiento','reparacion','extraviado','baja')),
  ubicacion text,
  foto_path text,
  foto_thumb text,
  archivado boolean not null default false,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

create table if not exists public.prod_inv_privado (
  item_id uuid primary key references public.prod_inventario(id) on delete cascade,
  serie text,
  fecha_compra date,
  factura text,
  notas_privadas text
);

create table if not exists public.prod_mantenimiento (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.prod_inventario(id) on delete cascade,
  fecha date not null default current_date,
  tipo text not null default 'revision',
  descripcion text,
  costo numeric(12,2),
  proximo date,
  responsable text,
  creado timestamptz not null default now()
);
create index if not exists prod_mant_item on public.prod_mantenimiento(item_id, fecha desc);

create table if not exists public.prod_producciones (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  titulo text not null,
  cliente text,
  tipo text not null default 'video',
  fecha date not null,
  hora_llamado time,
  hora_fin time,
  ubicacion text,
  lat double precision,
  lon double precision,
  estado text not null default 'programada' check (estado in ('programada','confirmada','en_curso','completada','cancelada')),
  nota text,
  desayuno text,
  almuerzo text,
  encargado text,
  encargado_tel text,
  contactos jsonb not null default '[]'::jsonb,
  objetivos jsonb not null default '[]'::jsonb,
  crew jsonb not null default '[]'::jsonb,
  apoyo jsonb not null default '[]'::jsonb,
  cronograma jsonb not null default '[]'::jsonb,
  recursos jsonb not null default '[]'::jsonb,
  instrucciones jsonb not null default '{}'::jsonb,
  clima jsonb,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index if not exists prod_prod_fecha on public.prod_producciones(fecha);

create table if not exists public.prod_auditoria (
  id bigint generated always as identity primary key,
  en timestamptz not null default now(),
  usuario text,
  tabla text not null,
  accion text not null,
  fila_id text,
  antes jsonb,
  despues jsonb
);
create index if not exists prod_aud_en on public.prod_auditoria(en desc);

-- fecha de última modificación
create or replace function public.prod_tocar() returns trigger
language plpgsql set search_path = '' as $$
begin new.actualizado := now(); return new; end $$;

drop trigger if exists prod_inv_tocar on public.prod_inventario;
create trigger prod_inv_tocar before update on public.prod_inventario for each row execute function public.prod_tocar();
drop trigger if exists prod_prod_tocar on public.prod_producciones;
create trigger prod_prod_tocar before update on public.prod_producciones for each row execute function public.prod_tocar();

-- auditoría automática (security definer: la app no puede escribir ni borrar el historial)
create or replace function public.prod_auditar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_id text;
begin
  if tg_op = 'DELETE' then v_id := coalesce(to_jsonb(old)->>'id', to_jsonb(old)->>'item_id');
  else v_id := coalesce(to_jsonb(new)->>'id', to_jsonb(new)->>'item_id'); end if;
  insert into public.prod_auditoria(usuario, tabla, accion, fila_id, antes, despues)
  values (coalesce(auth.jwt()->>'email', current_user), tg_table_name, tg_op, v_id,
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

do $$ declare t text; begin
  foreach t in array array['prod_inventario','prod_inv_privado','prod_mantenimiento','prod_producciones'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_aud', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.prod_auditar()', t || '_aud', t);
  end loop;
end $$;

-- correlativo de hojas de llamado (CS-0110, CS-0111…)
create table if not exists public.prod_contador (tipo text primary key, ultimo int not null);
insert into public.prod_contador(tipo, ultimo) values ('llamado', 109) on conflict (tipo) do nothing;
alter table public.prod_contador enable row level security;
revoke all on public.prod_contador from anon, authenticated;
create or replace function public.prod_siguiente_codigo() returns text
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not public.es_admin() then raise exception 'sin permiso'; end if;
  insert into public.prod_contador(tipo, ultimo) values ('llamado', 110)
  on conflict (tipo) do update set ultimo = public.prod_contador.ultimo + 1
  returning ultimo into n;
  return 'CS-' || lpad(n::text, 4, '0');
end $$;
revoke all on function public.prod_siguiente_codigo() from public, anon;
grant execute on function public.prod_siguiente_codigo() to authenticated;

-- permisos: solo el director (con autenticador)
alter table public.prod_inventario enable row level security;
alter table public.prod_inv_privado enable row level security;
alter table public.prod_mantenimiento enable row level security;
alter table public.prod_producciones enable row level security;
alter table public.prod_auditoria enable row level security;

drop policy if exists prod_inv_ver on public.prod_inventario;
drop policy if exists prod_inv_alta on public.prod_inventario;
drop policy if exists prod_inv_edit on public.prod_inventario;
create policy prod_inv_ver on public.prod_inventario for select to authenticated using (public.es_admin());
create policy prod_inv_alta on public.prod_inventario for insert to authenticated with check (public.es_admin());
create policy prod_inv_edit on public.prod_inventario for update to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists prod_priv_ver on public.prod_inv_privado;
drop policy if exists prod_priv_alta on public.prod_inv_privado;
drop policy if exists prod_priv_edit on public.prod_inv_privado;
create policy prod_priv_ver on public.prod_inv_privado for select to authenticated using (public.es_admin());
create policy prod_priv_alta on public.prod_inv_privado for insert to authenticated with check (public.es_admin());
create policy prod_priv_edit on public.prod_inv_privado for update to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists prod_mant_todo on public.prod_mantenimiento;
create policy prod_mant_todo on public.prod_mantenimiento for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists prod_prod_todo on public.prod_producciones;
create policy prod_prod_todo on public.prod_producciones for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists prod_aud_ver on public.prod_auditoria;
create policy prod_aud_ver on public.prod_auditoria for select to authenticated using (public.es_admin());

revoke all on public.prod_inventario, public.prod_inv_privado, public.prod_mantenimiento, public.prod_producciones, public.prod_auditoria from anon;
revoke insert, update, delete, truncate on public.prod_auditoria from authenticated;
revoke delete, truncate on public.prod_inventario, public.prod_inv_privado from authenticated;
revoke truncate on public.prod_mantenimiento, public.prod_producciones from authenticated;

-- permisos de tabla para la app (sin esto Supabase responde «permission denied» aunque la política RLS lo permita;
-- RLS sigue limitando todo al director con autenticador)
grant select on public.prod_auditoria to authenticated;
grant select, insert, update on public.prod_inventario, public.prod_inv_privado to authenticated;
grant select, insert, update, delete on public.prod_mantenimiento, public.prod_producciones to authenticated;

-- fotos del inventario: bucket privado
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inventario', 'inventario', false, 20971520, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public = false, file_size_limit = 20971520,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif'];

drop policy if exists inventario_ver on storage.objects;
drop policy if exists inventario_subir on storage.objects;
drop policy if exists inventario_cambiar on storage.objects;
create policy inventario_ver on storage.objects for select to authenticated using (bucket_id = 'inventario' and public.es_admin());
create policy inventario_subir on storage.objects for insert to authenticated with check (bucket_id = 'inventario' and public.es_admin());
create policy inventario_cambiar on storage.objects for update to authenticated using (bucket_id = 'inventario' and public.es_admin()) with check (bucket_id = 'inventario' and public.es_admin());

-- las funciones internas (triggers) no se pueden llamar desde la API
revoke execute on function public.prod_auditar() from public, anon, authenticated;
revoke execute on function public.prod_tocar() from public, anon, authenticated;
