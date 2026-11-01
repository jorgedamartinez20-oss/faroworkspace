-- Control maestro de accesos (Clientes › Accesos): cambiar usuario y/o contraseña de una cuenta de portal
-- sin crear otro usuario. Solo el administrador (es_admin) y solo cuentas @acceso / @entregas.farostudios.net.
-- Ya está aplicado en Supabase; este archivo es el respaldo por si hay que correrlo de nuevo.
create or replace function public.admin_cambiar_acceso(p_user uuid, p_clave text default null, p_email text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_old text;
begin
  if not public.es_admin() then raise exception 'solo el administrador' using errcode='42501'; end if;
  select email into v_old from auth.users where id = p_user;
  if v_old is null then raise exception 'usuario no existe'; end if;
  if v_old not like '%@acceso.farostudios.net' and v_old not like '%@entregas.farostudios.net' then
    raise exception 'solo cuentas de portal (clientes, academia, entregas)'; end if;
  if p_clave is not null then
    if length(p_clave) < 6 then raise exception 'la contraseña necesita al menos 6 caracteres'; end if;
    update auth.users set encrypted_password = extensions.crypt(p_clave, extensions.gen_salt('bf')), updated_at = now() where id = p_user;
  end if;
  if p_email is not null and lower(p_email) <> v_old then
    if p_email not like '%@acceso.farostudios.net' and p_email not like '%@entregas.farostudios.net' then raise exception 'dominio no permitido'; end if;
    if exists(select 1 from auth.users where lower(email)=lower(p_email) and id<>p_user) then raise exception 'Ese usuario ya existe'; end if;
    update auth.users set email = lower(p_email), updated_at = now() where id = p_user;
    update auth.identities set provider_id = lower(p_email), identity_data = jsonb_set(identity_data,'{email}',to_jsonb(lower(p_email))), updated_at = now() where user_id = p_user and provider='email';
  end if;
end $$;
revoke all on function public.admin_cambiar_acceso(uuid,text,text) from public, anon;
grant execute on function public.admin_cambiar_acceso(uuid,text,text) to authenticated;
notify pgrst, 'reload schema';
