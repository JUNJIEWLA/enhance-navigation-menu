-- Ejecuta este script en Supabase SQL Editor para habilitar la bitacora.

create table
if not exists public.historial_eventos
(
  id uuid primary key default gen_random_uuid
(),
  empresa_id uuid,
  evento text not null,
  descripcion text not null,
  usuario text not null,
  created_at timestamptz not null default now
()
);

create index
if not exists idx_historial_eventos_created_at
  on public.historial_eventos
(created_at desc);

create index
if not exists idx_historial_eventos_empresa_id
  on public.historial_eventos
(empresa_id);

alter table public.historial_eventos enable row level security;

drop policy
if exists "historial_select_anon" on public.historial_eventos;
drop policy
if exists "historial_insert_anon" on public.historial_eventos;
drop policy
if exists "historial_eventos_empresa_rw" on public.historial_eventos;

create policy "historial_eventos_empresa_rw"
on public.historial_eventos
for all
to authenticated
using
(
  exists
(
    select 1
from public.perfiles p
where p.user_id = auth.uid()
  and p.empresa_id = historial_eventos.empresa_id
  )
)
with check
(
  exists
(
    select 1
from public.perfiles p
where p.user_id = auth.uid()
  and p.empresa_id = historial_eventos.empresa_id
  )
);
