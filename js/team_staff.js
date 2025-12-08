// team_staff.js - Gestión de entrenadores
import { supabase } from './supabaseClient.js';
import { initHeader } from './headerComponent.js';
import { initPermissions, hasPermission } from './permissionsHelper.js';
import { ModalManager } from './utils/modalManager.js';
import { CardRenderer } from './utils/cardRenderer.js';
import { FormValidator, getFormValue, clearForm } from './utils/formValidator.js';
import { requireSession, requireTeamId, loadData, deleteData } from './utils/supabaseHelpers.js';
import { showError } from './utils/domHelpers.js';

// Validar sesión y obtener team_id
await requireSession();
const user = (await supabase.auth.getSession()).data.session.user;
const teamId = requireTeamId();

// Inicializar header
await initHeader({
  title: 'Entrenadores',
  backUrl: true,
  activeNav: null
});

// Inicializar permisos
await initPermissions();

// Estado
let myRole = null;
let canManageStaff = false;
let allStaff = [];

// Cargar mi rol
async function loadMyRole() {
  const { data, error } = await supabase
    .from('team_staff')
    .select('role, id')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .eq('active', true)
    .single();

  if (error || !data) {
    showError('No tienes permiso para ver este equipo.');
    throw new Error('No permission');
  }

  myRole = data.role;
  const isPrincipal = myRole === 'principal' || myRole === 'HEAD_COACH';
  const hasManageStaffPerm = await hasPermission(teamId, 'MANAGE_STAFF');
  canManageStaff = hasManageStaffPerm || isPrincipal;
}

// Modal manager
const modal = new ModalManager('staffModal');
const validator = new FormValidator();

// Card renderer para staff
class StaffCardRenderer extends CardRenderer {
  createCard(staff) {
    const card = document.createElement('div');
    card.className = 'item-card';

    const isMe = staff.user_id === user.id;
    const roleLabel = staff.role === 'principal' || staff.role === 'HEAD_COACH' ? '👔 Principal' : 
                     staff.role === 'segundo' ? '🎽 Segundo' : '🏃 Ayudante';

    card.innerHTML = `
      <div class="item-card-header">
        <div class="item-info">
          <div class="item-title">${staff.profiles?.email || '(sin email)'}</div>
          <div class="item-subtitle">${roleLabel}</div>
        </div>
        ${this.canManage && !isMe ? this.createMenuButton(staff.id, staff.user_id) : ''}
      </div>
    `;

    return card;
  }

  createMenuButton(staffId, userId) {
    return `
      <div class="item-menu">
        <button class="menu-btn" data-id="${staffId}" data-user="${userId}">⋮</button>
        <div class="menu-dropdown">
          <button class="menu-item delete delete-item" data-id="${staffId}" data-user="${userId}">🗑️ Eliminar</button>
        </div>
      </div>
    `;
  }

  attachMenuHandlers() {
    // Menu buttons
    document.querySelectorAll('.menu-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const dropdown = btn.nextElementSibling;
        document.querySelectorAll('.menu-dropdown.show').forEach(menu => {
          if (menu !== dropdown) menu.classList.remove('show');
        });
        dropdown.classList.toggle('show');
      };
    });

    // Delete buttons
    document.querySelectorAll('.delete-item').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const staffId = parseInt(btn.dataset.id);
        const userId = btn.dataset.user;
        
        if (userId === user.id) {
          alert('No puedes eliminarte a ti mismo.');
          return;
        }

        if (this.deleteCallback) this.deleteCallback(staffId);
        btn.closest('.menu-dropdown').classList.remove('show');
      };
    });

    // Cerrar menús al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.item-menu')) {
        document.querySelectorAll('.menu-dropdown.show').forEach(menu => {
          menu.classList.remove('show');
        });
      }
    });
  }
}

const cardRenderer = new StaffCardRenderer('staffList');

// Cargar staff
async function loadStaff() {
  await loadMyRole();
  
  cardRenderer.setCanManage(canManageStaff);

  // Mostrar/ocultar FAB según permisos
  const fab = document.getElementById('fabBtn');
  if (fab) {
    fab.style.display = canManageStaff ? 'flex' : 'none';
  }

  const query = supabase
    .from('team_staff')
    .select('id, role, user_id, profiles(id, email)')
    .eq('team_id', teamId)
    .eq('active', true);

  const staff = await loadData(query, 'Error al cargar entrenadores');
  if (staff) {
    allStaff = staff;
    cardRenderer.setItems(staff);
    cardRenderer.render('No hay entrenadores en este equipo.');
  }
}

// Abrir modal para añadir
function openAddModal() {
  if (!canManageStaff) {
    alert('No tienes permiso para añadir entrenadores');
    return;
  }

  modal.open('create', 'Añadir entrenador');
  clearForm(['emailInput', 'roleInput']);
  
  // Marcar permisos por defecto
  document.querySelectorAll('.permissions-grid input[type="checkbox"]').forEach(cb => {
    cb.checked = ['MANAGE_PLAYERS', 'MANAGE_TRAININGS', 'MANAGE_EVENTS', 'MANAGE_ATTENDANCE'].includes(cb.value);
  });
}

// Añadir entrenador
async function addStaff() {
  const email = getFormValue('emailInput', 'trim');
  const role = getFormValue('roleInput');

  // Validar
  validator.reset();
  validator.email(email, 'Email');
  validator.required(role, 'Rol');

  if (!validator.isValid()) {
    validator.showErrors();
    return;
  }

  // Obtener permisos seleccionados
  const selectedPermissions = [];
  const permCheckboxes = document.querySelectorAll('.permissions-grid input[type="checkbox"]:checked');
  permCheckboxes.forEach(checkbox => {
    selectedPermissions.push(checkbox.value);
  });

  try {
    // Buscar usuario por email
    const { data: usr, error } = await supabase.rpc('get_user_by_email', { p_email: email });

    if (error || !usr || usr.length === 0) {
      alert('No existe ningún usuario con ese email.');
      return;
    }

    const userIdToAdd = usr[0].id;

    // Insertar entrenador
    const { data: staffData, error: insertErr } = await supabase
      .from('team_staff')
      .insert({
        team_id: teamId,
        user_id: userIdToAdd,
        role: role
      })
      .select()
      .single();

    if (insertErr) {
      alert('Error al añadir entrenador: ' + insertErr.message);
      return;
    }

    // Insertar permisos seleccionados
    if (selectedPermissions.length > 0) {
      const permissionsToInsert = selectedPermissions.map(perm => ({
        team_staff_id: staffData.id,
        permission: perm,
        value: true
      }));

      const { error: permErr } = await supabase
        .from('team_staff_permissions')
        .insert(permissionsToInsert);

      if (permErr) {
        console.error('Error al añadir permisos:', permErr);
        alert('Entrenador añadido, pero hubo un error al asignar algunos permisos.');
      }
    }

    alert('Entrenador añadido correctamente.');
    modal.close();
    await loadStaff();
  } catch (error) {
    console.error('Error adding staff:', error);
    alert('Error: ' + error.message);
  }
}

// Eliminar entrenador
async function deleteStaff(staffId) {
  if (!confirm('¿Eliminar este entrenador del equipo?')) return;

  const result = await deleteData('team_staff', staffId, 'Entrenador eliminado');
  if (result.success) {
    await loadStaff();
  }
}

// Inicializar cuando el DOM esté listo
async function init() {
  const fabBtn = document.getElementById('fabBtn');
  if (fabBtn) {
    fabBtn.onclick = openAddModal;
  }

  // Configurar modal callbacks
  modal.onSave = addStaff;
  cardRenderer.onDelete(deleteStaff);

  // Cargar inicial
  await loadStaff();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
