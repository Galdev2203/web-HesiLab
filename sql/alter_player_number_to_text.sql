-- Cambiar el campo 'number' de la tabla 'players' de integer a text
-- Esto permite almacenar valores como '00', '0', '1', etc.

-- Paso 1: Cambiar el tipo de columna
ALTER TABLE players 
ALTER COLUMN number TYPE TEXT USING number::TEXT;

-- Paso 2: Actualizar los valores NULL a mantenerlos como NULL (ya están así)
-- No es necesario hacer nada adicional

-- Verificar el cambio
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'players' AND column_name = 'number';
