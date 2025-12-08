-- =====================================================
-- ACTUALIZACIÓN DE TABLA PROFILES PARA PERFIL PROFESIONAL
-- =====================================================
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar columnas adicionales a la tabla profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON profiles(full_name);
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at);

-- 3. Crear bucket de storage para imágenes de perfil (si no existe)
-- Esto se hace desde la UI de Supabase Storage:
-- Storage > Create bucket > Nombre: "profile-images" > Public: true

-- 4. Actualizar política RLS para permitir actualizaciones
-- Política para que los usuarios puedan actualizar su propio perfil
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" 
ON profiles FOR UPDATE 
USING (auth.uid() = id) 
WITH CHECK (auth.uid() = id);

-- 5. Política para que los usuarios puedan subir sus propios avatares
-- (Ejecutar después de crear el bucket profile-images)
-- Storage > profile-images > Policies

INSERT policy:
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profile-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

UPDATE policy:
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profile-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

DELETE policy:
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'profile-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

SELECT policy:
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-images');

-- 6. Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 8. Comentarios de documentación
COMMENT ON COLUMN profiles.full_name IS 'Nombre completo del usuario';
COMMENT ON COLUMN profiles.avatar_url IS 'URL de la foto de perfil del usuario';
COMMENT ON COLUMN profiles.phone IS 'Número de teléfono del usuario';
COMMENT ON COLUMN profiles.birth_date IS 'Fecha de nacimiento del usuario';
COMMENT ON COLUMN profiles.location IS 'Ubicación/ciudad del usuario';
COMMENT ON COLUMN profiles.bio IS 'Biografía o descripción del usuario';
COMMENT ON COLUMN profiles.updated_at IS 'Fecha de última actualización del perfil';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Para verificar que todo se creó correctamente:

-- Ver estructura de la tabla
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- Ver políticas RLS
SELECT * FROM pg_policies WHERE tablename = 'profiles';
