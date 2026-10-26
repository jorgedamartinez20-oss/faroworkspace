-- Faro Workspace · permiso «Formularios y documentos» (se puede delegar en Ajustes › Usuarios y permisos)
-- Ya aplicado en Supabase; se puede correr otra vez sin romper nada.
alter policy "admin doc_contadores" on public.doc_contadores using (public.tiene_permiso('formularios'));
alter policy "admin doc_documentos leer" on public.doc_documentos using (public.tiene_permiso('formularios'));
alter policy "admin doc_documentos crear" on public.doc_documentos with check (public.tiene_permiso('formularios'));
alter policy "admin doc_documentos editar" on public.doc_documentos using (public.tiene_permiso('formularios')) with check (public.tiene_permiso('formularios'));
alter policy "admin doc_servicios" on public.doc_servicios using (public.tiene_permiso('formularios')) with check (public.tiene_permiso('formularios'));

create or replace function public.doc_siguiente_numero(p_tipo text)
 returns table(serie integer, numero text)
 language plpgsql security definer set search_path to 'public' as $function$
declare
  v_n int;
  v_anio text := to_char(now() at time zone 'America/Guatemala', 'YYYY');
begin
  if not public.tiene_permiso('formularios') then raise exception 'sin permiso'; end if;
  update public.doc_contadores set ultimo = ultimo + 1 where tipo = p_tipo returning ultimo into v_n;
  if v_n is null then raise exception 'tipo'; end if;
  serie := v_n;
  numero := case p_tipo
    when 'cotizacion'   then 'FA' || v_n || ' - ' || v_anio
    when 'confirmacion' then 'FS - ' || lpad(v_n::text, 4, '0')
    else                     'RC' || lpad(v_n::text, 5, '0') || ' - ' || v_anio
  end;
  return next;
end
$function$;
