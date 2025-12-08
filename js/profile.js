// profile.js - Gestión del perfil de usuario
import { supabase } from "../js/supabaseClient.js";

// Comprobar sesión
const { data: sessionData } = await supabase.auth.getSession();
const session = sessionData.session;
if (!session) {
  window.location.href = "/pages/index.html";
  throw new Error("No session");
}
const user = session.user;

// Estado de edición
let isEditingInfo = false;

// ============================================
// CARGA INICIAL
// ============================================
async function loadProfile() {
  try {
    // Cargar datos básicos del usuario
    document.getElementById('userEmail').textContent = user.email;
    document.getElementById('securityEmail').textContent = user.email;
    
    // Fecha de registro
    const createdDate = new Date(user.created_at);
    document.getElementById('memberSince').textContent = createdDate.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Cargar perfil desde la tabla profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error cargando perfil:', profileError);
    }

    if (profile) {
      // Avatar
      if (profile.avatar_url) {
        document.getElementById('avatarImg').src = profile.avatar_url;
      } else {
        // Avatar por defecto con iniciales
        document.getElementById('avatarImg').src = getDefaultAvatar(profile.full_name || user.email);
      }

      // Información personal
      document.getElementById('userName').textContent = profile.full_name || 'Usuario';
      document.getElementById('fullName').value = profile.full_name || '';
      document.getElementById('phone').value = profile.phone || '';
      document.getElementById('birthDate').value = profile.birth_date || '';
      document.getElementById('location').value = profile.location || '';
      document.getElementById('bio').value = profile.bio || '';
    }

    // Cargar estadísticas
    await loadStatistics();

  } catch (error) {
    console.error('Error cargando perfil:', error);
    alert('Error al cargar el perfil: ' + error.message);
  }
}

// ============================================
// AVATAR
// ============================================
function getDefaultAvatar(name) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  const canvas = document.createElement('canvas');
  canvas.width = 120;
  canvas.height = 120;
  const ctx = canvas.getContext('2d');
  
  // Fondo gradiente
  const gradient = ctx.createLinearGradient(0, 0, 120, 120);
  gradient.addColorStop(0, '#667eea');
  gradient.addColorStop(1, '#4c51bf');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 120, 120);
  
  // Texto
  ctx.fillStyle = 'white';
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, 60, 60);
  
  return canvas.toDataURL();
}

// Cambiar avatar
document.getElementById('changeAvatarBtn').onclick = () => {
  document.getElementById('avatarInput').click();
};

document.getElementById('avatarInput').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Validar tipo y tamaño
  if (!file.type.startsWith('image/')) {
    return alert('Por favor selecciona una imagen válida');
  }
  if (file.size > 5 * 1024 * 1024) {
    return alert('La imagen no debe superar 5 MB');
  }

  try {
    // Subir imagen a Supabase Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('profile-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // Obtener URL pública
    const { data: urlData } = supabase.storage
      .from('profile-images')
      .getPublicUrl(filePath);

    // Actualizar en la base de datos
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: urlData.publicUrl })
      .eq('id', user.id);

    if (updateError) throw updateError;

    // Actualizar imagen en la página
    document.getElementById('avatarImg').src = urlData.publicUrl;
    alert('✅ Foto de perfil actualizada correctamente');

  } catch (error) {
    console.error('Error subiendo avatar:', error);
    alert('Error al subir la imagen: ' + error.message);
  }
};

// ============================================
// EDICIÓN DE INFORMACIÓN PERSONAL
// ============================================
document.getElementById('editInfoBtn').onclick = () => {
  isEditingInfo = true;
  
  // Habilitar campos
  document.getElementById('fullName').disabled = false;
  document.getElementById('phone').disabled = false;
  document.getElementById('birthDate').disabled = false;
  document.getElementById('location').disabled = false;
  document.getElementById('bio').disabled = false;
  
  // Mostrar acciones
  document.getElementById('infoActions').style.display = 'flex';
  document.getElementById('editInfoBtn').style.display = 'none';
};

document.getElementById('cancelInfoBtn').onclick = () => {
  isEditingInfo = false;
  
  // Deshabilitar campos
  document.getElementById('fullName').disabled = true;
  document.getElementById('phone').disabled = true;
  document.getElementById('birthDate').disabled = true;
  document.getElementById('location').disabled = true;
  document.getElementById('bio').disabled = true;
  
  // Ocultar acciones
  document.getElementById('infoActions').style.display = 'none';
  document.getElementById('editInfoBtn').style.display = 'inline-flex';
  
  // Recargar datos originales
  loadProfile();
};

document.getElementById('saveInfoBtn').onclick = async () => {
  const fullName = document.getElementById('fullName').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const birthDate = document.getElementById('birthDate').value;
  const location = document.getElementById('location').value.trim();
  const bio = document.getElementById('bio').value.trim();

  if (!fullName) {
    return alert('El nombre completo es obligatorio');
  }

  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        phone: phone || null,
        birth_date: birthDate || null,
        location: location || null,
        bio: bio || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (error) throw error;

    alert('✅ Información actualizada correctamente');
    
    // Actualizar nombre en header
    document.getElementById('userName').textContent = fullName;
    
    // Volver a modo visualización
    isEditingInfo = false;
    document.getElementById('fullName').disabled = true;
    document.getElementById('phone').disabled = true;
    document.getElementById('birthDate').disabled = true;
    document.getElementById('location').disabled = true;
    document.getElementById('bio').disabled = true;
    document.getElementById('infoActions').style.display = 'none';
    document.getElementById('editInfoBtn').style.display = 'inline-flex';

  } catch (error) {
    console.error('Error actualizando perfil:', error);
    alert('Error al actualizar: ' + error.message);
  }
};

// ============================================
// CAMBIO DE CONTRASEÑA
// ============================================
document.getElementById('changePasswordBtn').onclick = () => {
  document.getElementById('passwordModal').style.display = 'flex';
  document.getElementById('newPassword').value = '';
  document.getElementById('confirmPassword').value = '';
};

// Validación en tiempo real
document.getElementById('newPassword').oninput = validatePassword;
document.getElementById('confirmPassword').oninput = validatePassword;

function validatePassword() {
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  
  const reqLength = document.getElementById('req-length');
  const reqMatch = document.getElementById('req-match');
  
  // Validar longitud
  if (newPassword.length >= 6) {
    reqLength.classList.add('valid');
    reqLength.classList.remove('invalid');
  } else {
    reqLength.classList.add('invalid');
    reqLength.classList.remove('valid');
  }
  
  // Validar coincidencia
  if (confirmPassword && newPassword === confirmPassword) {
    reqMatch.classList.add('valid');
    reqMatch.classList.remove('invalid');
  } else {
    reqMatch.classList.add('invalid');
    reqMatch.classList.remove('valid');
  }
}

document.getElementById('savePasswordBtn').onclick = async () => {
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (newPassword.length < 6) {
    return alert('La contraseña debe tener al menos 6 caracteres');
  }

  if (newPassword !== confirmPassword) {
    return alert('Las contraseñas no coinciden');
  }

  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;

    alert('✅ Contraseña actualizada correctamente');
    document.getElementById('passwordModal').style.display = 'none';
    document.getElementById('lastPasswordChange').textContent = 'justo ahora';

  } catch (error) {
    console.error('Error cambiando contraseña:', error);
    alert('Error al cambiar la contraseña: ' + error.message);
  }
};

// Cerrar modal al hacer clic fuera
document.getElementById('passwordModal').onclick = (e) => {
  if (e.target.id === 'passwordModal') {
    document.getElementById('passwordModal').style.display = 'none';
  }
};

// ============================================
// ESTADÍSTICAS
// ============================================
async function loadStatistics() {
  try {
    // Total de equipos donde es staff
    const { data: teamsData, error: teamsError } = await supabase
      .from('team_staff')
      .select('team_id', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('active', true);

    if (!teamsError) {
      document.getElementById('totalTeams').textContent = teamsData?.length || 0;
    }

    // Total de jugadores en sus equipos
    const { data: playersData, error: playersError } = await supabase
      .from('team_staff')
      .select('team_id')
      .eq('user_id', user.id)
      .eq('active', true);

    if (!playersError && playersData) {
      const teamIds = playersData.map(t => t.team_id);
      
      if (teamIds.length > 0) {
        const { data: players } = await supabase
          .from('team_players')
          .select('id', { count: 'exact' })
          .in('team_id', teamIds);
        
        document.getElementById('totalPlayers').textContent = players?.length || 0;
      }
    }

    // Total de eventos
    if (!playersError && playersData) {
      const teamIds = playersData.map(t => t.team_id);
      
      if (teamIds.length > 0) {
        const { data: events } = await supabase
          .from('team_events')
          .select('id', { count: 'exact' })
          .in('team_id', teamIds);
        
        document.getElementById('totalEvents').textContent = events?.length || 0;
      }
    }

    // Calcular porcentaje de asistencia promedio
    if (!playersError && playersData) {
      const teamIds = playersData.map(t => t.team_id);
      
      if (teamIds.length > 0) {
        const { data: attendance } = await supabase
          .from('attendance')
          .select('status')
          .in('team_id', teamIds);
        
        if (attendance && attendance.length > 0) {
          const present = attendance.filter(a => a.status === 'PRESENT').length;
          const total = attendance.length;
          const rate = Math.round((present / total) * 100);
          document.getElementById('attendanceRate').textContent = `${rate}%`;
        }
      }
    }

  } catch (error) {
    console.error('Error cargando estadísticas:', error);
  }
}

// ============================================
// ELIMINAR CUENTA
// ============================================
document.getElementById('deleteAccountBtn').onclick = async () => {
  const confirmText = prompt(
    '⚠️ ADVERTENCIA: Esta acción es PERMANENTE y eliminará todos tus datos.\n\n' +
    'Escribe "ELIMINAR MI CUENTA" para confirmar:'
  );

  if (confirmText !== 'ELIMINAR MI CUENTA') {
    return alert('Cancelado. Tu cuenta está segura.');
  }

  const confirmEmail = prompt('Por seguridad, confirma tu correo electrónico:');
  
  if (confirmEmail !== user.email) {
    return alert('El correo no coincide. Operación cancelada.');
  }

  try {
    // Nota: La eliminación real requeriría una función del servidor
    // Por seguridad, esto debería hacerse desde el backend
    alert(
      '⚠️ Para eliminar tu cuenta, por favor contacta con el soporte en:\n' +
      'soporte@hesilab.com\n\n' +
      'Incluye tu correo electrónico en el mensaje.'
    );

  } catch (error) {
    console.error('Error eliminando cuenta:', error);
    alert('Error: ' + error.message);
  }
};

// ============================================
// INICIALIZACIÓN
// ============================================
loadProfile();
