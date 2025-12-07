// staff.js - Gestión de cuerpo técnico y permisos
import { supabase } from '../js/supabaseClient.js';
import { 
  initPermissions, 
  hasPermission, 
  getUserRole,
  getRoleLabel 
} from '../js/permissionsHelper.js';

// Validar sesión
const { data: sessionData } = await supabase.auth.getSession();
if (!sessionData.session) {
  window.location.href = '/pages/index.html';
  throw new Error('No session');
}

const currentUser = sessionData.session.user;

// Inicializar permisos
await initPermissions();

// Obtener team_id
const params = new URLSearchParams(window.location.search);
const teamId = params.get('team_id');

if (!teamId) {
  document.getElementById('errorMsg').style.display = 'block';
  document.getElementById('errorMsg').innerText = 'Error: falta team_id';
  throw new Error('Missing team_id');
}

// Verificar permisos
const canManageStaff = await hasPermission(teamId, 'MANAGE_STAFF');
const canManagePermissions = await hasPermission(teamId, 'MANAGE_STAFF_PERMISSIONS');
const userRole = await getUserRole(teamId);

if (!canManageStaff && !canManagePermissions) {
  document.getElementById('errorMsg').style.display = 'block';
  document.getElementById('errorMsg').innerText = `No tienes permiso para gestionar el staff. Tu rol: ${getRoleLabel(userRole)}`;
}

// Mostrar formulario solo si puede añadir staff
if (canManageStaff) {
  document.getElementById('formBox').style.display = 'block';
}

// Estado
let allStaff = [];

const ROLE_LABELS = {
  'HEAD_COACH': '👔 Entrenador principal',
  'SECOND_COACH': '👨‍🏫 Segundo entrenador',
  'ASSISTANT_COACH': '🤝 Ayudante',
  'PHYSICAL_TRAINER': '💪 Preparador físico',
  'ANALYST': '📊 Analista',
  'OTHER': '📌 Otro'
};

const PERMISSION_LABELS = {
  'MANAGE_TEAM': 'Gestionar equipo',
  'MANAGE_STAFF': 'Gestionar staff',
  'MANAGE_STAFF_PERMISSIONS': 'Gestionar permisos de staff',
  'MANAGE_PLAYERS': 'Gestionar jugadores',
  'MANAGE_EVENTS': 'Gestionar eventos',
  'MANAGE_TRAININGS': 'Gestionar entrenamientos',
  'MANAGE_ATTENDANCE': 'Gestionar asistencia'
};

/**
 * Cargar staff del equipo
 */
async function loadStaff() {
  const container = document.getElementById('staffList');
  container.innerHTML = '<div class="loading">Cargando...</div>';

  try {
    // Obtener staff del equipo
    const { data: staffData, error: staffError } = await supabase
      .from('team_staff')
      .select('id, user_id, role')
      .eq('team_id', teamId);

    if (staffError) throw staffError;

    if (!staffData || staffData.length === 0) {
      allStaff = [];
      renderStaff();
      return;
    }

    // Obtener datos de usuarios
    const userIds = staffData.map(s => s.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds);

    if (profilesError) throw profilesError;

    // Combinar staff con profiles
    const staffWithProfiles = staffData.map(staff => ({
      ...staff,
      profiles: profiles?.find(p => p.id === staff.user_id) || null
    }));

    allStaff = staffWithProfiles;

    // Para cada staff, obtener sus permisos
    const staffWithPermissions = await Promise.all(
      allStaff.map(async (staff) => {
        const { data: permissions, error: permError } = await supabase
          .from('team_staff_permissions')
          .select('permission')
          .eq('team_staff_id', staff.id);

        if (permError) throw permError;

        return {
          ...staff,
          permissions: permissions?.map(p => p.permission) || []
        };
      })
    );

    allStaff = staffWithPermissions;
    renderStaff();

  } catch (error) {
    console.error('Error loading staff:', error);
    container.innerHTML = `<div class="error-state">Error: ${error.message}</div>`;
  }
}

/**
 * Renderizar lista de staff
 */
function renderStaff() {
  const container = document.getElementById('staffList');

  if (allStaff.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👥</div>
        <p>No hay miembros en el cuerpo técnico</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  
  const staffGrid = document.createElement('div');
  staffGrid.className = 'staff-grid';

  allStaff.forEach(staff => {
    const card = createStaffCard(staff);
    staffGrid.appendChild(card);
  });

  container.appendChild(staffGrid);
}

/**
 * Crear card de staff
 */
function createStaffCard(staff) {
  const card = document.createElement('div');
  card.className = 'staff-card fade-in';

  const profile = staff.profiles || {};
  const isCurrentUser = staff.user_id === currentUser.id;
  const isHeadCoach = staff.role === 'HEAD_COACH';

  card.innerHTML = `
    <div class="staff-header">
      <div class="staff-avatar">
        ${(profile.full_name || profile.email || '?').charAt(0).toUpperCase()}
      </div>
      <div class="staff-info">
        <div class="staff-name">${escapeHtml(profile.full_name || 'Usuario')}</div>
        <div class="staff-email">${escapeHtml(profile.email || 'Sin email')}</div>
        ${isCurrentUser ? '<span class="current-user-badge">Tú</span>' : ''}
      </div>
    </div>
    
    <div class="staff-role-badge">${ROLE_LABELS[staff.role] || staff.role}</div>
    
    <div class="staff-permissions">
      <div class="permissions-header">Permisos (${staff.permissions.length}):</div>
      <div class="permissions-list">
        ${staff.permissions.length > 0 
          ? staff.permissions.map(p => `
              <span class="permission-badge">✓ ${PERMISSION_LABELS[p] || p}</span>
            `).join('')
          : '<span class="no-permissions">Sin permisos asignados</span>'
        }
      </div>
    </div>
    
    <div class="staff-actions" id="actions-${staff.id}"></div>
  `;

  // Botones de acción
  const actionsContainer = card.querySelector(`#actions-${staff.id}`);

  // Solo HEAD_COACH puede gestionar permisos de otros
  if (canManagePermissions && !isCurrentUser) {
    const permBtn = document.createElement('button');
    permBtn.className = 'btn btn-outline btn-sm';
    permBtn.textContent = '🔑 Permisos';
    permBtn.onclick = () => openPermissionsModal(staff);
    actionsContainer.appendChild(permBtn);
  }

  // No se puede eliminar al HEAD_COACH ni a uno mismo
  if (canManageStaff && !isHeadCoach && !isCurrentUser) {
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-danger btn-sm';
    removeBtn.textContent = '🗑️ Eliminar';
    removeBtn.onclick = () => removeStaff(staff.id, profile.full_name || profile.email);
    actionsContainer.appendChild(removeBtn);
  }

  return card;
}

/**
 * Abrir modal de permisos (simulado con confirm/prompt)
 */
async function openPermissionsModal(staff) {
  const profile = staff.profiles || {};
  const name = profile.full_name || profile.email || 'Usuario';
  
  alert(`Configurando permisos para: ${name}\n\nPermisos actuales:\n${staff.permissions.map(p => `✓ ${PERMISSION_LABELS[p]}`).join('\n') || '(ninguno)'}\n\n⚠️ Usa los checkboxes del formulario de abajo para cambiar permisos (funcionalidad completa próximamente).`);
}

/**
 * Eliminar miembro del staff
 */
async function removeStaff(staffId, name) {
  if (!confirm(`¿Eliminar a ${name} del cuerpo técnico?\n\nEsto también eliminará todos sus permisos.`)) {
    return;
  }

  try {
    // Supabase CASCADE eliminará automáticamente los permisos relacionados
    const { error } = await supabase
      .from('team_staff')
      .delete()
      .eq('id', staffId);

    if (error) throw error;

    alert('✅ Miembro eliminado correctamente');
    await loadStaff();

  } catch (error) {
    console.error('Error removing staff:', error);
    alert(`Error: ${error.message}`);
  }
}

/**
 * Añadir nuevo miembro al staff
 */
async function addStaff(e) {
  e.preventDefault();

  if (!canManageStaff) {
    alert('No tienes permiso para añadir staff');
    return;
  }

  const email = document.getElementById('staffEmail').value.trim();
  const role = document.getElementById('staffRole').value;

  if (!email) {
    alert('Introduce el email del usuario');
    return;
  }

  if (!role) {
    alert('Selecciona un rol');
    return;
  }

  // Obtener permisos seleccionados
  const selectedPermissions = [];
  document.querySelectorAll('.permissions-checklist input[type="checkbox"]:checked').forEach(cb => {
    selectedPermissions.push(cb.value);
  });

  try {
    // 1. Buscar usuario por email en profiles
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('email', email)
      .maybeSingle();

    if (profileError) {
      console.error('Error buscando usuario:', profileError);
      alert(`Error al buscar usuario: ${profileError.message}`);
      return;
    }

    if (!profiles) {
      alert(`No se encontró ningún usuario con el email: ${email}\n\nEl usuario debe estar registrado en HesiLab primero.\n\nVerifica que:\n- El email esté escrito correctamente\n- El usuario se haya registrado en la aplicación`);
      return;
    }

    const userId = profiles.id;

    // 2. Verificar que no esté ya en el equipo
    const { data: existing, error: existingError } = await supabase
      .from('team_staff')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      alert('Este usuario ya es miembro del cuerpo técnico');
      return;
    }

    // 3. Añadir a team_staff
    const { data: newStaff, error: staffError } = await supabase
      .from('team_staff')
      .insert({
        team_id: teamId,
        user_id: userId,
        role: role
      })
      .select()
      .single();

    if (staffError) throw staffError;

    // 4. Añadir permisos si hay seleccionados
    if (selectedPermissions.length > 0) {
      const permissionsToInsert = selectedPermissions.map(perm => ({
        team_staff_id: newStaff.id,
        permission: perm,
        value: true
      }));

      const { error: permError } = await supabase
        .from('team_staff_permissions')
        .insert(permissionsToInsert);

      if (permError) throw permError;
    }

    // Limpiar formulario
    document.getElementById('staffEmail').value = '';
    document.getElementById('staffRole').value = '';
    document.querySelectorAll('.permissions-checklist input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
    });

    alert('✅ Miembro añadido correctamente');
    await loadStaff();

  } catch (error) {
    console.error('Error adding staff:', error);
    alert(`Error: ${error.message}`);
  }
}

/**
 * Helpers
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Event listeners
document.getElementById('addBtn')?.addEventListener('click', addStaff);

// Cargar inicial
loadStaff();
