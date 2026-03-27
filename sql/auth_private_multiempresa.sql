-- Modulo de autenticacion privada y multiempresa para Supabase
-- Objetivo:
-- 1) No registro publico.
-- 2) Login por usuario + contrasena (sin exponer tablas de credenciales).
-- 3) Escalable para multiples usuarios por empresa.
-- 4) Solo super admin puede crear nuevos usuarios de negocio.

create extension if not exists pgcrypto;

-- Empresas
create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table if exists public.empresas
  add column if not exists activo boolean not null default true;

-- Perfiles de aplicacion: un usuario de auth.users asociado a una empresa
create table if not exists public.perfiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete restrict,
  username text not null unique,
  email_login text not null unique,
  rol text not null check (rol in ('super_admin', 'admin_empresa', 'usuario_empresa')),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_perfiles_empresa_id on public.perfiles(empresa_id);

alter table public.empresas enable row level security;
alter table public.perfiles enable row level security;

drop policy if exists "perfiles_select_self" on public.perfiles;
drop policy if exists "perfiles_select_super_admin" on public.perfiles;
drop policy if exists "perfiles_admin_insert" on public.perfiles;
drop policy if exists "perfiles_admin_update" on public.perfiles;

drop policy if exists "empresas_select_by_membership" on public.empresas;
drop policy if exists "empresas_select_super_admin" on public.empresas;

-- Helpers para evitar recursión RLS al evaluar permisos de super admin.
create or replace function public.es_super_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.perfiles p
    where p.user_id = auth.uid()
      and p.rol = 'super_admin'
      and p.activo = true
  );
$$;

revoke all on function public.es_super_admin() from public;
grant execute on function public.es_super_admin() to authenticated;

create or replace function public.obtener_perfil_actual()
returns table (
  user_id uuid,
  empresa_id uuid,
  rol text,
  username text,
  nombre_empresa text
)
language sql
security definer
set search_path = public
as $$
  select p.user_id, p.empresa_id, p.rol, p.username, e.nombre
  from public.perfiles p
  left join public.empresas e on e.id = p.empresa_id
  where p.user_id = auth.uid()
    and p.activo = true
  limit 1;
$$;

revoke all on function public.obtener_perfil_actual() from public;
grant execute on function public.obtener_perfil_actual() to authenticated;

drop function if exists public.admin_listar_empresas();

create or replace function public.admin_listar_empresas()
returns table (
  id uuid,
  nombre text,
  activo boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select e.id, e.nombre, e.activo, e.created_at
  from public.empresas e
  where public.es_super_admin()
  order by e.activo desc, e.nombre;
$$;

revoke all on function public.admin_listar_empresas() from public;
grant execute on function public.admin_listar_empresas() to authenticated;

create or replace function public.admin_crear_empresa(p_nombre text)
returns table (
  id uuid,
  nombre text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text;
begin
  if not public.es_super_admin() then
    raise exception 'Solo super admin puede crear empresas.';
  end if;

  v_nombre := trim(coalesce(p_nombre, ''));

  if v_nombre = '' then
    raise exception 'El nombre de empresa es obligatorio.';
  end if;

  if exists (
    select 1
    from public.empresas e
    where lower(e.nombre) = lower(v_nombre)
  ) then
    raise exception 'Ya existe una empresa con ese nombre.';
  end if;

  return query
  insert into public.empresas (nombre)
  values (v_nombre)
  returning empresas.id, empresas.nombre;
end;
$$;

revoke all on function public.admin_crear_empresa(text) from public;
grant execute on function public.admin_crear_empresa(text) to authenticated;

create or replace function public.admin_actualizar_empresa(
  p_empresa_id uuid,
  p_nombre text
)
returns table (
  id uuid,
  nombre text,
  activo boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text;
begin
  if not public.es_super_admin() then
    raise exception 'Solo super admin puede actualizar empresas.';
  end if;

  v_nombre := trim(coalesce(p_nombre, ''));

  if p_empresa_id is null then
    raise exception 'Empresa no valida.';
  end if;

  if v_nombre = '' then
    raise exception 'El nombre de empresa es obligatorio.';
  end if;

  if exists (
    select 1
    from public.empresas e
    where lower(e.nombre) = lower(v_nombre)
      and e.id <> p_empresa_id
  ) then
    raise exception 'Ya existe otra empresa con ese nombre.';
  end if;

  return query
  update public.empresas e
  set nombre = v_nombre
  where e.id = p_empresa_id
  returning e.id, e.nombre, e.activo, e.created_at;

  if not found then
    raise exception 'Empresa no encontrada.';
  end if;
end;
$$;

revoke all on function public.admin_actualizar_empresa(uuid, text) from public;
grant execute on function public.admin_actualizar_empresa(uuid, text) to authenticated;

create or replace function public.admin_desactivar_empresa(p_empresa_id uuid)
returns table (
  id uuid,
  nombre text,
  activo boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_super_admin() then
    raise exception 'Solo super admin puede desactivar empresas.';
  end if;

  if p_empresa_id is null then
    raise exception 'Empresa no valida.';
  end if;

  return query
  update public.empresas e
  set activo = false
  where e.id = p_empresa_id
  returning e.id, e.nombre, e.activo, e.created_at;

  if not found then
    raise exception 'Empresa no encontrada.';
  end if;

  update public.perfiles p
  set activo = false
  where p.empresa_id = p_empresa_id;
end;
$$;

revoke all on function public.admin_desactivar_empresa(uuid) from public;
grant execute on function public.admin_desactivar_empresa(uuid) to authenticated;

create or replace function public.admin_activar_empresa(p_empresa_id uuid)
returns table (
  id uuid,
  nombre text,
  activo boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.es_super_admin() then
    raise exception 'Solo super admin puede activar empresas.';
  end if;

  if p_empresa_id is null then
    raise exception 'Empresa no valida.';
  end if;

  return query
  update public.empresas e
  set activo = true
  where e.id = p_empresa_id
  returning e.id, e.nombre, e.activo, e.created_at;

  if not found then
    raise exception 'Empresa no encontrada.';
  end if;
end;
$$;

revoke all on function public.admin_activar_empresa(uuid) from public;
grant execute on function public.admin_activar_empresa(uuid) to authenticated;

create or replace function public.admin_listar_perfiles()
returns table (
  user_id uuid,
  username text,
  email_login text,
  rol text,
  activo boolean,
  empresa_id uuid,
  nombre_empresa text
)
language sql
security definer
set search_path = public
as $$
  select p.user_id, p.username, p.email_login, p.rol, p.activo, p.empresa_id, e.nombre
  from public.perfiles p
  left join public.empresas e on e.id = p.empresa_id
  where public.es_super_admin()
  order by p.created_at desc;
$$;

revoke all on function public.admin_listar_perfiles() from public;
grant execute on function public.admin_listar_perfiles() to authenticated;

create or replace function public.admin_desactivar_usuario(p_user_id uuid)
returns table (
  user_id uuid,
  username text,
  email_login text,
  rol text,
  activo boolean,
  empresa_id uuid,
  nombre_empresa text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_activo boolean;
begin
  if not public.es_super_admin() then
    raise exception 'Solo super admin puede desactivar usuarios.';
  end if;

  if p_user_id is null then
    raise exception 'Usuario no valido.';
  end if;

  select p.rol, p.activo
    into v_rol, v_activo
  from public.perfiles p
  where p.user_id = p_user_id;

  if not found then
    raise exception 'Usuario no encontrado.';
  end if;

  if v_rol = 'super_admin' then
    raise exception 'No se puede desactivar un super admin.';
  end if;

  if v_activo = false then
    raise exception 'El usuario ya esta inactivo.';
  end if;

  return query
  update public.perfiles p
  set activo = false
  from public.empresas e
  where p.user_id = p_user_id
    and e.id = p.empresa_id
  returning p.user_id, p.username, p.email_login, p.rol, p.activo, p.empresa_id, e.nombre;
end;
$$;

revoke all on function public.admin_desactivar_usuario(uuid) from public;
grant execute on function public.admin_desactivar_usuario(uuid) to authenticated;

create or replace function public.admin_activar_usuario(p_user_id uuid)
returns table (
  user_id uuid,
  username text,
  email_login text,
  rol text,
  activo boolean,
  empresa_id uuid,
  nombre_empresa text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa_activa boolean;
begin
  if not public.es_super_admin() then
    raise exception 'Solo super admin puede activar usuarios.';
  end if;

  if p_user_id is null then
    raise exception 'Usuario no valido.';
  end if;

  select e.activo
    into v_empresa_activa
  from public.perfiles p
  join public.empresas e on e.id = p.empresa_id
  where p.user_id = p_user_id;

  if not found then
    raise exception 'Usuario no encontrado.';
  end if;

  if v_empresa_activa = false then
    raise exception 'No se puede activar el usuario porque su empresa esta inactiva.';
  end if;

  return query
  update public.perfiles p
  set activo = true
  from public.empresas e
  where p.user_id = p_user_id
    and e.id = p.empresa_id
  returning p.user_id, p.username, p.email_login, p.rol, p.activo, p.empresa_id, e.nombre;
end;
$$;

revoke all on function public.admin_activar_usuario(uuid) from public;
grant execute on function public.admin_activar_usuario(uuid) to authenticated;

-- Funcion para resolver el email desde username durante el login.
-- Security definer evita exponer la tabla perfiles al cliente anon.
create or replace function public.resolver_email_login(p_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select p.email_login
    into v_email
  from public.perfiles p
  where lower(p.username) = lower(trim(p_username))
    and p.activo = true
  limit 1;

  return v_email;
end;
$$;

revoke all on function public.resolver_email_login(text) from public;
grant execute on function public.resolver_email_login(text) to anon, authenticated;

-- Politicas base para empresas y perfiles
create policy "perfiles_select_self"
on public.perfiles
for select
to authenticated
using (user_id = auth.uid());

create policy "perfiles_select_super_admin"
on public.perfiles
for select
to authenticated
using (public.es_super_admin());

create policy "empresas_select_by_membership"
on public.empresas
for select
to authenticated
using (
  exists (
    select 1
    from public.perfiles p
    where p.user_id = auth.uid()
      and p.empresa_id = empresas.id
  )
);

create policy "empresas_select_super_admin"
on public.empresas
for select
to authenticated
using (public.es_super_admin());

-- Solo super admin puede crear, editar o desactivar perfiles
create policy "perfiles_admin_insert"
on public.perfiles
for insert
to authenticated
with check (public.es_super_admin());

create policy "perfiles_admin_update"
on public.perfiles
for update
to authenticated
using (public.es_super_admin())
with check (public.es_super_admin());

-- Tablas de negocio: agrega empresa_id si aun no existe
alter table if exists public.suplidores add column if not exists empresa_id uuid references public.empresas(id);
alter table if exists public.facturas add column if not exists empresa_id uuid references public.empresas(id);
alter table if exists public.pagos add column if not exists empresa_id uuid references public.empresas(id);
alter table if exists public.historial_eventos add column if not exists empresa_id uuid references public.empresas(id);

create index if not exists idx_suplidores_empresa_id on public.suplidores(empresa_id);
create index if not exists idx_facturas_empresa_id on public.facturas(empresa_id);
create index if not exists idx_pagos_empresa_id on public.pagos(empresa_id);
create index if not exists idx_historial_eventos_empresa_id on public.historial_eventos(empresa_id);

alter table if exists public.suplidores enable row level security;
alter table if exists public.facturas enable row level security;
alter table if exists public.pagos enable row level security;
alter table if exists public.historial_eventos enable row level security;

drop policy if exists "suplidores_empresa_rw" on public.suplidores;
drop policy if exists "facturas_empresa_rw" on public.facturas;
drop policy if exists "pagos_empresa_rw" on public.pagos;
drop policy if exists "historial_eventos_empresa_rw" on public.historial_eventos;

create policy "suplidores_empresa_rw"
on public.suplidores
for all
to authenticated
using (
  exists (
    select 1 from public.perfiles p
    where p.user_id = auth.uid()
      and p.empresa_id = suplidores.empresa_id
  )
)
with check (
  exists (
    select 1 from public.perfiles p
    where p.user_id = auth.uid()
      and p.empresa_id = suplidores.empresa_id
  )
);

create policy "facturas_empresa_rw"
on public.facturas
for all
to authenticated
using (
  exists (
    select 1 from public.perfiles p
    where p.user_id = auth.uid()
      and p.empresa_id = facturas.empresa_id
  )
)
with check (
  exists (
    select 1 from public.perfiles p
    where p.user_id = auth.uid()
      and p.empresa_id = facturas.empresa_id
  )
);

create policy "pagos_empresa_rw"
on public.pagos
for all
to authenticated
using (
  exists (
    select 1 from public.perfiles p
    where p.user_id = auth.uid()
      and p.empresa_id = pagos.empresa_id
  )
)
with check (
  exists (
    select 1 from public.perfiles p
    where p.user_id = auth.uid()
      and p.empresa_id = pagos.empresa_id
  )
);

create policy "historial_eventos_empresa_rw"
on public.historial_eventos
for all
to authenticated
using (
  exists (
    select 1 from public.perfiles p
    where p.user_id = auth.uid()
      and p.empresa_id = historial_eventos.empresa_id
  )
)
with check (
  exists (
    select 1 from public.perfiles p
    where p.user_id = auth.uid()
      and p.empresa_id = historial_eventos.empresa_id
  )
);

-- Nota operativa:
-- La creacion de usuarios de auth.users debe hacerse desde backend seguro
-- (Edge Function o servicio privado con service_role key), no desde frontend.
