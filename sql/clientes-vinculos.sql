-- Faro Workspace · Ficha de cliente: vínculos manuales (cotización, confirmación, contrato, factura, pago)
-- Solo agrega una tabla nueva; no cambia ninguna tabla existente. Solo la ve el equipo (el cliente NO la ve).
create table if not exists public.cl_vinculos (
  id         uuid primary key default gen_random_uuid(),
  creado     timestamptz not null default now(),
  cliente_id uuid not null references public.cl_clientes(id) on delete cascade,
  etapa      text not null check (etapa in ('cotizacion','confirmacion','contrato','factura','pago','otro')),
  ref_tabla  text check (ref_tabla in ('cotizaciones','doc_documentos','doc_contratos')),
  ref_id     uuid,
  etiqueta   text not null check (length(etiqueta) <= 200),
  ruta       text,
  nota       text check (length(nota) <= 500)
);
create index if not exists cl_vinculos_cliente on public.cl_vinculos(cliente_id);
alter table public.cl_vinculos enable row level security;
drop policy if exists "admin todo" on public.cl_vinculos;
create policy "admin todo" on public.cl_vinculos for all using (es_admin()) with check (es_admin());
drop policy if exists "equipo clientes cl_vinculos" on public.cl_vinculos;
create policy "equipo clientes cl_vinculos" on public.cl_vinculos for all using (tiene_permiso('clientes')) with check (tiene_permiso('clientes'));
