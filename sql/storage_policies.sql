-- =====================================================
-- POLÍTICAS DE STORAGE PARA PROFILE-IMAGES
-- =====================================================
-- Ejecutar después de crear el bucket 'profile-images'

-- 1. INSERT policy: Los usuarios pueden subir su propio avatar
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = 'avatars' AND
  auth.uid()::text = (regexp_split_to_array(name, '/'))[2]::text
);

-- 2. UPDATE policy: Los usuarios pueden actualizar su propio avatar
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = 'avatars' AND
  auth.uid()::text = (regexp_split_to_array(name, '/'))[2]::text
)
WITH CHECK (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = 'avatars' AND
  auth.uid()::text = (regexp_split_to_array(name, '/'))[2]::text
);

-- 3. DELETE policy: Los usuarios pueden eliminar su propio avatar
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = 'avatars' AND
  auth.uid()::text = (regexp_split_to_array(name, '/'))[2]::text
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
