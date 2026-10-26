-- Faro Workspace · Contratos (se llenan en Formularios, se envían al portal de entregas y el cliente los acepta ahí).
-- Solo agrega cosas nuevas; se puede correr otra vez sin romper nada.

create sequence if not exists public.ct_seq;

create table if not exists public.doc_contratos (
  id            uuid primary key default gen_random_uuid(),
  numero        text not null unique,
  documento_id  uuid references public.doc_documentos(id) on delete set null,
  cuenta_id     uuid not null references public.en_cuentas(user_id) on delete cascade,
  cliente       text not null check (length(cliente) <= 160),
  version       text not null,
  datos         jsonb not null default '{}'::jsonb,
  texto         text not null,                       -- el contrato exacto que verá y aceptará el cliente (JSON de bloques)
  hash_texto    text not null,                       -- sha256 del texto, para probar que no cambió
  estado        text not null default 'enviado' check (estado in ('enviado','visto','aceptado','anulado')),
  enviado_en    timestamptz not null default now(),
  visto_en      timestamptz,
  aceptado_en   timestamptz,
  firma_nombre  text,
  firma_dpi     text,
  firma_tel     text,
  firma_usuario text,
  firma_ip      text,
  firma_agente  text,
  firma_hash    text,
  creado        timestamptz not null default now()
);
create index if not exists doc_contratos_cuenta_idx on public.doc_contratos (cuenta_id, estado);

-- el texto no se puede cambiar después de enviado, y su hash se calcula aquí (no confiamos en el navegador)
create or replace function public.ct_antes_escribir() returns trigger
 language plpgsql set search_path to 'public' as $$
begin
  if tg_op = 'INSERT' then
    new.hash_texto := encode(sha256(convert_to(new.texto, 'UTF8')), 'hex');
    new.estado := 'enviado'; new.visto_en := null; new.aceptado_en := null;
    new.firma_nombre := null; new.firma_dpi := null; new.firma_tel := null; new.firma_usuario := null;
    new.firma_ip := null; new.firma_agente := null; new.firma_hash := null;
  else
    if new.texto is distinct from old.texto or new.hash_texto is distinct from old.hash_texto
       or new.cuenta_id is distinct from old.cuenta_id or new.numero is distinct from old.numero then
      raise exception 'El texto de un contrato enviado no se cambia: anúlalo y crea otro.';
    end if;
    if old.estado = 'aceptado' and new.estado <> 'aceptado' and new.estado <> 'anulado' then
      raise exception 'Un contrato aceptado solo se puede anular.';
    end if;
    if old.estado = 'aceptado' and (new.firma_nombre is distinct from old.firma_nombre or new.firma_dpi is distinct from old.firma_dpi
       or new.firma_tel is distinct from old.firma_tel or new.firma_ip is distinct from old.firma_ip
       or new.firma_hash is distinct from old.firma_hash or new.aceptado_en is distinct from old.aceptado_en) then
      raise exception 'La constancia de aceptación no se puede cambiar.';
    end if;
    if old.estado <> 'aceptado' and new.estado = 'aceptado' and current_user in ('authenticated','anon') then
      raise exception 'Un contrato solo lo acepta el cliente desde su portal.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists ct_antes_escribir on public.doc_contratos;
create trigger ct_antes_escribir before insert or update on public.doc_contratos
  for each row execute function public.ct_antes_escribir();

alter table public.doc_contratos enable row level security;
drop policy if exists "admin doc_contratos" on public.doc_contratos;
create policy "admin doc_contratos" on public.doc_contratos for all
  using (public.tiene_permiso('formularios')) with check (public.tiene_permiso('formularios'));
drop policy if exists "cliente ve sus contratos" on public.doc_contratos;
create policy "cliente ve sus contratos" on public.doc_contratos for select
  using (cuenta_id = auth.uid() and estado <> 'anulado');

-- siguiente número: CT - 0001
create or replace function public.ct_siguiente_numero() returns text
 language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.tiene_permiso('formularios') then raise exception 'sin permiso'; end if;
  return 'CT - ' || lpad(nextval('public.ct_seq')::text, 4, '0');
end $$;

-- el cliente abrió el contrato
create or replace function public.ct_marcar_visto(p_id uuid) returns void
 language plpgsql security definer set search_path to 'public' as $$
begin
  update public.doc_contratos set estado = 'visto', visto_en = now()
   where id = p_id and cuenta_id = auth.uid() and estado = 'enviado';
end $$;

-- el cliente acepta: guarda nombre, documento, celular, fecha/hora, IP y navegador (la IP la lee el servidor, no el navegador)
create or replace function public.ct_aceptar(p_id uuid, p_nombre text, p_dpi text, p_tel text) returns jsonb
 language plpgsql security definer set search_path to 'public' as $$
declare
  c public.doc_contratos;
  h json := coalesce(nullif(current_setting('request.headers', true), '')::json, '{}'::json);
  v_ip text := split_part(coalesce(h->>'cf-connecting-ip', h->>'x-forwarded-for', ''), ',', 1);
  v_ag text := left(coalesce(h->>'user-agent', ''), 300);
  v_usr text;
  v_now timestamptz := now();
begin
  select * into c from public.doc_contratos where id = p_id and cuenta_id = auth.uid() for update;
  if not found then raise exception 'Contrato no encontrado'; end if;
  if c.estado = 'aceptado' then return jsonb_build_object('ok', true, 'ya', true, 'aceptado_en', c.aceptado_en); end if;
  if c.estado not in ('enviado','visto') then raise exception 'Este contrato ya no se puede aceptar'; end if;
  p_nombre := btrim(coalesce(p_nombre, '')); p_dpi := btrim(coalesce(p_dpi, '')); p_tel := btrim(coalesce(p_tel, ''));
  if length(p_nombre) < 5 or length(p_nombre) > 160 then raise exception 'Escribe tu nombre completo'; end if;
  if length(regexp_replace(p_dpi, '\D', '', 'g')) < 6 or length(p_dpi) > 30 then raise exception 'Escribe tu DPI'; end if;
  if length(regexp_replace(p_tel, '\D', '', 'g')) < 8 or length(p_tel) > 30 then raise exception 'Escribe tu número de celular'; end if;
  select usuario into v_usr from public.en_cuentas where user_id = auth.uid();
  update public.doc_contratos set
    estado = 'aceptado', aceptado_en = v_now, visto_en = coalesce(visto_en, v_now),
    firma_nombre = p_nombre, firma_dpi = p_dpi, firma_tel = p_tel, firma_usuario = v_usr,
    firma_ip = nullif(v_ip, ''), firma_agente = nullif(v_ag, ''),
    firma_hash = encode(sha256(convert_to(c.hash_texto || '|' || p_nombre || '|' || p_dpi || '|' || p_tel || '|' || coalesce(v_usr, '') || '|' || v_now::text || '|' || auth.uid()::text, 'UTF8')), 'hex')
   where id = p_id;
  return jsonb_build_object('ok', true, 'aceptado_en', v_now);
end $$;

revoke all on function public.ct_siguiente_numero() from public, anon;
revoke all on function public.ct_marcar_visto(uuid) from public, anon;
revoke all on function public.ct_aceptar(uuid, text, text, text) from public, anon;
grant execute on function public.ct_siguiente_numero() to authenticated;
grant execute on function public.ct_marcar_visto(uuid) to authenticated;
grant execute on function public.ct_aceptar(uuid, text, text, text) to authenticated;

-- permisos de tabla: sin borrar ni vaciar; el acceso fino lo deciden las políticas de arriba
revoke all on public.doc_contratos from anon, authenticated;
grant select, insert, update on public.doc_contratos to authenticated;
revoke all on sequence public.ct_seq from anon, authenticated;
