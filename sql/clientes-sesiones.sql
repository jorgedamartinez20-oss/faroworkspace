-- Faro Workspace · Mi espacio: sesiones del cliente, vencimiento del acceso y aceptación del aviso.
-- Todo es aditivo: columnas nuevas (vacías = comportamiento de siempre) y una tabla nueva.
alter table public.cl_clientes add column if not exists acceso_vence date;
alter table public.cl_clientes add column if not exists aviso_aceptado_en timestamptz;

create table if not exists public.cl_sesiones (
  id           uuid primary key default gen_random_uuid(),
  creado       timestamptz not null default now(),
  cliente_id   uuid not null references public.cl_clientes(id) on delete cascade,
  titulo       text not null check (length(titulo) <= 160),
  fecha        date,
  hora         text check (length(hora) <= 40),
  agenda_id    uuid,
  estado       text not null default 'agendada' check (estado in ('agendada','realizada','lista','cancelada')),
  realizada_en date,
  dias_habiles date[] not null default '{}',   -- los 5 días hábiles de entrega (el último es la fecha de entrega)
  entrega_fecha date,
  proyecto_id  uuid references public.en_proyectos(id) on delete set null,
  lista_en     timestamptz,
  nota         text check (length(nota) <= 500)
);
create index if not exists cl_sesiones_cliente on public.cl_sesiones(cliente_id);
alter table public.cl_sesiones enable row level security;
drop policy if exists "admin todo" on public.cl_sesiones;
create policy "admin todo" on public.cl_sesiones for all using (es_admin()) with check (es_admin());
drop policy if exists "equipo clientes cl_sesiones" on public.cl_sesiones;
create policy "equipo clientes cl_sesiones" on public.cl_sesiones for all using (tiene_permiso('clientes')) with check (tiene_permiso('clientes'));
drop policy if exists "cliente ve sus sesiones" on public.cl_sesiones;
create policy "cliente ve sus sesiones" on public.cl_sesiones for select using (cl_ve(cliente_id));
grant select, insert, update, delete on public.cl_sesiones to authenticated;

-- El acceso vencido deja de ver datos (acceso_vence vacío = no vence nunca, como hasta ahora).
create or replace function public.cl_ve(p_cli uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select public.es_admin() or exists (select 1 from public.ac_cuentas c join public.cl_clientes k on k.id = c.cliente_id
                  where c.user_id = auth.uid() and c.rol = 'cliente' and c.activo and k.activo and c.cliente_id = p_cli
                    and (k.acceso_vence is null or k.acceso_vence >= (now() at time zone 'America/Guatemala')::date));
$$;

-- Estado de mi acceso (lo lee Mi espacio justo después de entrar, incluso si ya venció).
create or replace function public.cl_mi_estado() returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select coalesce((select jsonb_build_object('cliente_id', k.id, 'nombre', k.nombre, 'vence', k.acceso_vence,
            'vencido', (k.acceso_vence is not null and k.acceso_vence < (now() at time zone 'America/Guatemala')::date) or not k.activo,
            'aviso_en', k.aviso_aceptado_en)
          from public.ac_cuentas c join public.cl_clientes k on k.id = c.cliente_id
          where c.user_id = auth.uid() and c.rol = 'cliente' and c.activo limit 1), '{}'::jsonb);
$$;

-- El cliente acepta el aviso de perfil temporal (una sola vez).
create or replace function public.cl_aceptar_aviso() returns void
language sql security definer set search_path to 'public' as $$
  update public.cl_clientes set aviso_aceptado_en = coalesce(aviso_aceptado_en, now())
   where id = (select c.cliente_id from public.ac_cuentas c where c.user_id = auth.uid() and c.rol = 'cliente' and c.activo limit 1);
$$;
grant execute on function public.cl_mi_estado() to authenticated;
grant execute on function public.cl_aceptar_aviso() to authenticated;
notify pgrst, 'reload schema';
