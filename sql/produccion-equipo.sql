-- =====================================================================================
-- PRODUCCIÓN · EQUIPO Y ACCESOS  (corre DESPUÉS de sql/produccion.sql, una sola vez; se puede repetir sin problema)
--   · Varias personas por cliente: PRINCIPAL (ve todo) y SECUNDARIO (revisa y marca cambios; sin precios ni documentos
--     salvo que Faro le habilite "Pagos y documentos").
--   · Editores del equipo de Faro: suben material a cualquier proyecto; lo que suben queda "Por publicar" hasta que Faro lo publica.
--   · Carpetas en los archivos finales y nombre original al descargar.
-- Las galerías no cambian: su cuenta sigue funcionando exactamente igual.
-- =====================================================================================

-- 1) Columnas nuevas ---------------------------------------------------------------------
alter table public.en_cuentas  add column if not exists principal_id uuid references public.en_cuentas(user_id) on delete cascade;  -- si trae valor, es una persona del equipo del cliente
alter table public.en_cuentas  add column if not exists ve_pagos boolean not null default false;                                    -- solo aplica a secundarios
alter table public.en_archivos add column if not exists carpeta text;            -- carpeta dentro de Entregas (archivos finales)
alter table public.en_archivos add column if not exists subido_por uuid;         -- editor que lo subió
alter table public.en_archivos add column if not exists subido_nombre text;
create index if not exists en_cuentas_principal on public.en_cuentas (principal_id) where principal_id is not null;

create table if not exists public.pr_editores (
  user_id uuid primary key,
  nombre text not null,
  usuario text,
  email_auth text,
  activo boolean not null default true,
  creado timestamptz not null default now()
);
alter table public.pr_editores enable row level security;
drop policy if exists pr_editores_admin on public.pr_editores;
create policy pr_editores_admin on public.pr_editores for all using (es_admin()) with check (es_admin());
drop policy if exists pr_editores_yo on public.pr_editores;
create policy pr_editores_yo on public.pr_editores for select using (user_id = auth.uid());
grant select, insert, update, delete on public.pr_editores to authenticated;

-- 2) Quién es quién ---------------------------------------------------------------------
-- Cuenta "dueña" del espacio para la persona que entró: ella misma, o la cuenta principal si es de su equipo.
create or replace function public.pr_efectiva() returns uuid
language sql stable security definer set search_path to 'public' as $$
  select coalesce(
    (select case when c.principal_id is null then c.user_id
                 when c.activo and exists (select 1 from en_cuentas p where p.user_id = c.principal_id and p.activo) then c.principal_id end
       from en_cuentas c where c.user_id = auth.uid()),
    auth.uid())
$$;

create or replace function public.pr_es_secundario() returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from en_cuentas where user_id = auth.uid() and principal_id is not null)
$$;

create or replace function public.pr_ve_pagos() returns boolean
language sql stable security definer set search_path to 'public' as $$
  select coalesce((select c.principal_id is null or c.ve_pagos from en_cuentas c where c.user_id = auth.uid() and c.activo), false)
$$;

create or replace function public.pr_es_editor() returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from pr_editores where user_id = auth.uid() and activo)
$$;

create or replace function public.pr_editor_yo() returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select coalesce((select jsonb_build_object('user_id', user_id, 'nombre', nombre) from pr_editores where user_id = auth.uid() and activo), 'null'::jsonb)
$$;

-- Lo que devuelve "mi perfil" ahora dice también si es principal o secundario y si ve pagos (campos extra; lo demás igual)
create or replace function public.en_mi_perfil() returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select coalesce((select jsonb_build_object('user_id', c.user_id, 'tipo', c.tipo, 'nombre', c.nombre,
                          'rol', case when c.principal_id is null then 'principal' else 'secundario' end,
                          've_pagos', (c.principal_id is null or c.ve_pagos),
                          'empresa', coalesce((select p.nombre from en_cuentas p where p.user_id = c.principal_id), c.nombre))
                   from en_cuentas c
                  where c.user_id = auth.uid() and c.activo
                    and (c.principal_id is null or exists (select 1 from en_cuentas p where p.user_id = c.principal_id and p.activo))), 'null'::jsonb)
$$;

-- 3) El equipo del cliente ve el mismo espacio (en galerías pr_efectiva() = la misma persona, nada cambia) ----------
drop policy if exists en_proy_cliente on public.en_proyectos;
create policy en_proy_cliente on public.en_proyectos for select using (visible and cuenta_id = pr_efectiva());

drop policy if exists en_arch_cliente on public.en_archivos;
create policy en_arch_cliente on public.en_archivos for select using (
  habilitado and exists (select 1 from en_proyectos p where p.id = en_archivos.proyecto_id and p.visible and p.cuenta_id = pr_efectiva()));

drop policy if exists en_arch_editor on public.en_archivos;
create policy en_arch_editor on public.en_archivos for select using (subido_por = auth.uid());

drop policy if exists en_ron_cliente on public.en_rondas;
create policy en_ron_cliente on public.en_rondas for select using (
  exists (select 1 from en_proyectos p where p.id = en_rondas.proyecto_id and p.cuenta_id = pr_efectiva()));

drop policy if exists en_com_ver on public.en_comentarios;
create policy en_com_ver on public.en_comentarios for select using (
  user_id = auth.uid()
  or (pr_efectiva() <> auth.uid() and exists (select 1 from en_proyectos p where p.id = en_comentarios.proyecto_id and p.cuenta_id = pr_efectiva())));

drop policy if exists en_com_crear on public.en_comentarios;
create policy en_com_crear on public.en_comentarios for insert with check (
  user_id = auth.uid() and enviado = false and exists (
    select 1 from en_proyectos p where p.id = en_comentarios.proyecto_id and p.visible and p.cuenta_id = pr_efectiva()
       and p.estado = 'en_revision' and p.ronda = en_comentarios.ronda));

drop policy if exists en_historial_cliente on public.en_historial;
create policy en_historial_cliente on public.en_historial for select using (
  exists (select 1 from en_proyectos p where p.id = en_historial.proyecto_id and p.visible and p.cuenta_id = pr_efectiva())
  and (evento <> 'pago_reportado' or pr_ve_pagos()));

-- marcar y enviar (el secundario marca y comenta; solo la persona principal envía la ronda)
create or replace function public.en_marcar_archivo(p_archivo uuid, p_estado text, p_autor text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare a en_archivos; p en_proyectos; quien text := nullif(btrim(coalesce(p_autor, '')), '');
begin
  if p_estado not in ('pendiente','aprobado','cambios') then raise exception 'estado inválido'; end if;
  select a2.* into a from en_archivos a2
   where a2.id = p_archivo and a2.habilitado and a2.rol = 'revision'
     and not exists (select 1 from en_archivos b where b.pieza_id = a2.pieza_id and b.version > a2.version and b.habilitado);
  if not found then raise exception 'No se pudo marcar'; end if;
  select * into p from en_proyectos where id = a.proyecto_id and visible and cuenta_id = pr_efectiva() and estado = 'en_revision';
  if not found then raise exception 'No se pudo marcar'; end if;
  update en_archivos set estado = p_estado, estado_por = quien, estado_en = now() where id = a.id;
  insert into en_historial(proyecto_id, archivo_id, pieza_id, version, ronda, evento, autor)
    values (a.proyecto_id, a.id, a.pieza_id, a.version, p.ronda, p_estado, quien);
end $$;

create or replace function public.en_enviar_ronda(p_proyecto uuid, p_autor text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare p en_proyectos; n_cam int; n_apr int; n_tot int; nuevo text; quien text := nullif(btrim(coalesce(p_autor, '')), '');
begin
  select * into p from en_proyectos where id = p_proyecto and visible and cuenta_id = pr_efectiva();
  if not found then raise exception 'Proyecto no disponible'; end if;
  if pr_es_secundario() then raise exception 'La ronda la envía la persona principal de tu equipo'; end if;
  if p.estado <> 'en_revision' then raise exception 'Esta ronda ya fue enviada'; end if;
  update en_comentarios set enviado = true where proyecto_id = p.id and ronda = p.ronda and enviado = false;
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

-- 4) Producción: el equipo comparte proyecto; pagos y documentos solo para quien Faro habilite ------
create or replace function public.pr_mio(p_proyecto uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from en_proyectos p join en_cuentas c on c.user_id = p.cuenta_id
     where p.id = p_proyecto and p.visible and p.cuenta_id = pr_efectiva() and c.activo and c.tipo in ('empresa','agencia'))
$$;

create or replace function public.pr_cuenta() returns uuid
language sql stable security definer set search_path to 'public' as $$
  select c.user_id from en_cuentas c where c.user_id = pr_efectiva() and c.activo and c.tipo in ('empresa','agencia')
$$;

create or replace function public.pr_fin_visible(p_proyecto uuid) returns boolean
language plpgsql stable security definer set search_path to 'public' as $$
begin
  return pr_ve_pagos() and coalesce((select f.visible from pr_finanzas f where f.proyecto_id = p_proyecto), false);
end $$;

create or replace function public.pr_mi_carpeta() returns text
language sql stable security definer set search_path to 'public' as $$
  select cl.carpeta from en_cuentas c join cl_clientes cl on cl.id = c.cliente_id
   where c.user_id = pr_efectiva() and c.activo and c.tipo in ('empresa','agencia') limit 1
$$;

create or replace function public.pr_dueno_carpeta(p_cliente uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from en_cuentas c where c.user_id = pr_efectiva() and c.activo and c.tipo in ('empresa','agencia') and c.cliente_id = p_cliente)
$$;

-- carpeta de un cliente que tiene producción activa (donde un editor puede dejar archivos)
create or replace function public.pr_editor_carpeta(p_cliente uuid) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select pr_es_editor() and exists (select 1 from en_cuentas c where c.cliente_id = p_cliente and c.activo and c.principal_id is null and c.tipo in ('empresa','agencia'))
$$;

drop policy if exists pr_perfil_yo on public.pr_perfil;
create policy pr_perfil_yo on public.pr_perfil for select using (cuenta_id = pr_efectiva());

drop policy if exists pr_finanzas_cliente on public.pr_finanzas;
create policy pr_finanzas_cliente on public.pr_finanzas for select using (pr_mio(proyecto_id) and visible and pr_ve_pagos());
drop policy if exists pr_pagos_cliente on public.pr_pagos;
create policy pr_pagos_cliente on public.pr_pagos for select using (pr_mio(proyecto_id) and pr_fin_visible(proyecto_id));
drop policy if exists pr_documentos_cliente on public.pr_documentos;
create policy pr_documentos_cliente on public.pr_documentos for select using (pr_mio(proyecto_id) and visible and pr_ve_pagos());

create or replace function public.pr_perfil_guardar(p_datos jsonb, p_autor text default null) returns void
language plpgsql security definer set search_path to 'public' as $$
declare uid uuid := pr_efectiva(); quien text := nullif(btrim(coalesce(p_autor,'')),''); t text; k text;
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

-- 5) Editores: ven los proyectos y suben; lo que suben queda "Por publicar" ------------------------
create or replace function public.pr_editor_proyectos() returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not pr_es_editor() then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
        'id', p.id, 'titulo', p.titulo, 'cliente', c.nombre, 'estado', p.estado, 'ronda', p.ronda,
        'carpeta', cl.carpeta,
        'piezas', coalesce((
          select jsonb_agg(jsonb_build_object('pieza', x.pieza_id, 'nombre', x.nombre, 'version', x.version) order by x.orden, x.nombre)
            from (select distinct on (coalesce(a.pieza_id, a.id)) a.* from en_archivos a
                   where a.proyecto_id = p.id and a.rol = 'revision'
                   order by coalesce(a.pieza_id, a.id), a.version desc) x), '[]'::jsonb))
      order by c.nombre, p.titulo)
      from en_proyectos p
      join en_cuentas c on c.user_id = p.cuenta_id and c.activo and c.principal_id is null and c.tipo in ('empresa','agencia')
      left join cl_clientes cl on cl.id = c.cliente_id
     where p.estado <> 'entregado'), '[]'::jsonb);
end $$;

create or replace function public.pr_editor_registrar(p_proyecto uuid, p_key text, p_nombre text, p_tipo text, p_pieza uuid default null,
                                                       p_nota text default null, p_rol text default 'revision', p_carpeta text default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare carp text; v int; ord int; nid uuid; yo text; pz uuid; k text := nullif(btrim(coalesce(p_key,'')),''); nom text := left(btrim(coalesce(p_nombre,'')), 200);
begin
  if not pr_es_editor() then raise exception 'No tienes acceso de editor'; end if;
  select cl.carpeta into carp from en_proyectos p join en_cuentas c on c.user_id = p.cuenta_id and c.activo and c.principal_id is null and c.tipo in ('empresa','agencia')
    join cl_clientes cl on cl.id = c.cliente_id where p.id = p_proyecto;
  if carp is null then raise exception 'Este cliente aún no tiene carpeta. Avísale a Faro.'; end if;
  if k is null or left(k, length(carp)) <> carp or k like '%..%' then raise exception 'Archivo no válido'; end if;
  if nom = '' then raise exception 'Falta el nombre'; end if;
  if p_rol not in ('revision','final') then raise exception 'Destino no válido'; end if;
  if p_tipo not in ('video','imagen','audio','pdf','otro') then p_tipo := 'otro'; end if;
  select nombre into yo from pr_editores where user_id = auth.uid();
  if p_rol = 'revision' and p_pieza is not null then
    select max(version) into v from en_archivos where proyecto_id = p_proyecto and rol = 'revision' and coalesce(pieza_id, id) = p_pieza;
    if v is null then raise exception 'No existe esa pieza'; end if;
    select orden into ord from en_archivos where proyecto_id = p_proyecto and coalesce(pieza_id, id) = p_pieza order by version limit 1;
    pz := p_pieza; v := v + 1;
  else
    select coalesce(max(orden), -1) + 1 into ord from en_archivos where proyecto_id = p_proyecto;
    v := 1; pz := null;
  end if;
  insert into en_archivos(proyecto_id, key, nombre, tipo, orden, pieza_id, version, rol, nota_version, estado, habilitado, carpeta, subido_por, subido_nombre)
  values (p_proyecto, k, nom, p_tipo, ord, pz, v, p_rol, left(nullif(btrim(coalesce(p_nota,'')),''), 600), 'pendiente', false,
          case when p_rol = 'final' then left(nullif(btrim(coalesce(p_carpeta,'')),''), 200) end, auth.uid(), yo)
  returning id into nid;
  return nid;
end $$;

-- 6) El editor puede dejar archivos en la carpeta de clientes con producción (leer sigue siendo del equipo y del cliente) ----
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
      return public.tiene_permiso('academy');
    end if;
    if v_tipo = 'diplomas' then
      if p_accion = 'leer' then return public.ac_ve(v_id) or public.ac_docente_de(v_id) or public.tiene_permiso('academy'); end if;
      return public.tiene_permiso('academy');
    end if;
    return false;
  end if;

  select id, carpeta into v_id, v_carp from public.ac_docentes where carpeta is not null and starts_with(p_key, carpeta) limit 1;
  if v_id is not null then
    v_resto := substr(p_key, length(v_carp) + 1);
    if v_resto = '' or position('/' in v_resto) > 0 then return false; end if;
    if public.tiene_permiso('academy') then return true; end if;
    if exists (select 1 from public.ac_cuentas c where c.user_id = auth.uid() and c.rol = 'docente' and c.activo and c.docente_id = v_id) then
      return true;
    end if;
    return p_accion = 'leer' and exists (select 1 from public.ac_asignaciones a where a.docente_id = v_id and public.ac_ve(a.estudiante_id));
  end if;

  select id, carpeta into v_id, v_carp from public.cl_clientes where carpeta is not null and starts_with(p_key, carpeta) limit 1;
  if v_id is not null then
    v_resto := substr(p_key, length(v_carp) + 1);
    if v_resto = '' or position('/' in v_resto) > 0 then return false; end if;
    if p_accion = 'leer' then return public.cl_ve(v_id) or public.tiene_permiso('clientes') or public.pr_dueno_carpeta(v_id); end if;
    if p_accion = 'escribir' then return public.tiene_permiso('clientes') or public.pr_dueno_carpeta(v_id) or public.pr_editor_carpeta(v_id); end if;
    return public.tiene_permiso('clientes');
  end if;

  return false;
end $function$;

-- 7) Permisos de ejecución ---------------------------------------------------------------
revoke all on function public.pr_efectiva(), public.pr_es_secundario(), public.pr_ve_pagos(), public.pr_es_editor(), public.pr_editor_yo(), public.pr_editor_carpeta(uuid),
  public.pr_editor_proyectos(), public.pr_editor_registrar(uuid, text, text, text, uuid, text, text, text) from public, anon;
grant execute on function public.pr_efectiva(), public.pr_es_secundario(), public.pr_ve_pagos(), public.pr_es_editor(), public.pr_editor_yo(), public.pr_editor_carpeta(uuid),
  public.pr_editor_proyectos(), public.pr_editor_registrar(uuid, text, text, text, uuid, text, text, text) to authenticated;
