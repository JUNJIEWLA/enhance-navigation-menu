-- Agrega la columna `referencia` (No. de transferencia / cheque) a la tabla de pagos.
-- Ejecutar una vez en Supabase → SQL Editor.

alter table if exists public.pagos
  add column if not exists referencia text;

-- Recargar el caché de esquema de la API para que la columna se vea de inmediato
notify pgrst, 'reload schema';
