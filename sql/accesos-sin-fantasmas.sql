-- Faro Workspace · borrar un acceso de Academy también borra su inicio de sesión
-- (antes solo se quitaba el registro y el usuario seguía pudiendo entrar). Ya aplicado en Supabase; se puede correr otra vez sin romper nada.
create or replace function public.ac_cuentas_borrar_login() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.user_id is not null
     and not exists (select 1 from public.admin_equipo e where e.user_id = old.user_id) then
    delete from auth.users where id = old.user_id and email like '%@acceso.farostudios.net';
  end if;
  return old;
end $$;
revoke execute on function public.ac_cuentas_borrar_login() from public, anon, authenticated;
drop trigger if exists ac_cuentas_borrar_login on public.ac_cuentas;
create trigger ac_cuentas_borrar_login after delete on public.ac_cuentas for each row execute function public.ac_cuentas_borrar_login();
