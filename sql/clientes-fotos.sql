-- Foto/logo de perfil de cada ficha (solo la ve el administrador; nunca el cliente). Ya aplicado en Supabase.
create table if not exists public.cl_fotos(ref text primary key, foto text not null, actualizado timestamptz default now());
alter table public.cl_fotos enable row level security;
drop policy if exists cl_fotos_admin on public.cl_fotos;
create policy cl_fotos_admin on public.cl_fotos for all to authenticated using (public.es_admin() or public.tiene_permiso('clientes')) with check (public.es_admin() or public.tiene_permiso('clientes'));
grant select, insert, update, delete on public.cl_fotos to authenticated;
notify pgrst, 'reload schema';
