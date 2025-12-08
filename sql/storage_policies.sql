-- =====================================================
-- POLÍTICAS DE STORAGE PARA PROFILE-IMAGES
-- =====================================================
-- Ejecutar después de crear el bucket 'profile-images'

-- PRIMERO: Eliminar políticas anteriores si existen
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

-- 1. INSERT policy: Los usuarios autenticados pueden subir avatares
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = 'avatars'
);

-- 2. UPDATE policy: Los usuarios autenticados pueden actualizar avatares
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = 'avatars'
)
WITH CHECK (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = 'avatars'
);

-- 3. DELETE policy: Los usuarios autenticados pueden eliminar avatares
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = 'avatars'
);

-- 4. SELECT policy: Las imágenes de perfil son públicamente accesibles
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-images');

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Ver todas las políticas del storage objects
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects';

-- O simplemente verificar que el bucket existe
SELECT * FROM storage.buckets WHERE id = 'profile-images';
