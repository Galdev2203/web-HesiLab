// teams.js - Lógica para gestión de equipos
import { supabase } from "../js/supabaseClient.js";
import { initHeader } from "../js/headerComponent.js";

// Inicializar header unificado
await initHeader({
  title: 'Mis equipos',
  backUrl: '/pages/dashboard.html',
  activeNav: 'teams'
});

// Obtener sesión después de initHeader
const { data: sessionData } = await supabase.auth.getSession();
const session = sessionData.session;
if (!session) {
  window.location.href = "/pages/index.html";
  throw new Error("No session");
}
const user = session.user;

// ============================================
// GESTIÓN DE EQUIPOS
// ============================================

// Cargar equipos donde el usuario es staff
async function loadTeams() {
  const container = document.getElementById('teamsContainer');
  container.innerText = 'Cargando equipos...';
  
  // Consultamos team_staff -> teams
  const { data, error } = await supabase
    .from('team_staff')
    .select('team_id, role, teams(id,name,category)')
    .eq('user_id', user.id)
    .eq('active', true);

  if (error) {
    container.innerText = 'Error al cargar: ' + error.message;
    console.error(error);
    return;
  }
  
  if (!data || data.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No tienes equipos todavía. ¡Crea tu primer equipo!</p></div>';
    return;
  }

  container.innerHTML = '';
  
  data.forEach(row => {
    const team = row.teams;
    const isHeadCoach = row.role === 'HEAD_COACH' || row.role === 'principal';
    
    const div = document.createElement('div');
    div.className = 'team-card fade-in';
    div.dataset.teamid = team.id;
    
    div.innerHTML = `
      <div class="team-card-header">
        <div class="team-info">
          <div class="team-name">${team.name}</div>
          <div class="team-category">${team.category || 'Sin categoría'}</div>
        </div>
        ${isHeadCoach 
          ? `<div class="team-menu">
              <button class="menu-btn" data-teamid="${team.id}" data-name="${team.name}" data-category="${team.category || ''}">⋮</button>
              <div class="menu-dropdown">
                <button class="menu-item edit-item" data-teamid="${team.id}" data-name="${team.name}" data-category="${team.category || ''}">✏️ Editar</button>
                <button class="menu-item delete delete-item" data-teamid="${team.id}">🗑️ Eliminar</button>
              </div>
            </div>` 
          : ``}
      </div>
      <div class="team-stats">
        <div class="stat-item"><strong>0</strong> jugadores</div>
        <div class="stat-item"><strong>0</strong> entrenamientos</div>
      </div>
    `;
    
    container.appendChild(div);
  });

  // Hacer cards clickeables (excepto el menú)
  document.querySelectorAll('.team-card').forEach(card => {
    card.onclick = (e) => {
      // Si el click es en el menú o sus items, no navegar
      if (e.target.closest('.team-menu')) return;
      
      const teamId = card.dataset.teamid;
      window.location.href = `/pages/team_detail.html?team_id=${teamId}`;
    };
  });

  // Manejadores para el menú de tres puntos
  document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const dropdown = btn.nextElementSibling;
      
      // Cerrar otros menús abiertos
      document.querySelectorAll('.menu-dropdown.show').forEach(menu => {
        if (menu !== dropdown) menu.classList.remove('show');
      });
      
      dropdown.classList.toggle('show');
    };
  });

  // Editar equipo
  document.querySelectorAll('.edit-item').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const teamId = btn.getAttribute('data-teamid');
      const teamName = btn.getAttribute('data-name');
      const teamCategory = btn.getAttribute('data-category');
      openModal('edit', teamId, teamName, teamCategory);
      // Cerrar dropdown
      btn.closest('.menu-dropdown').classList.remove('show');
    };
  });

  // Eliminar equipo
  document.querySelectorAll('.delete-item').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const teamId = btn.getAttribute('data-teamid');
      
      if (!confirm('¿Eliminar equipo? Esta acción eliminará todos los datos relacionados (jugadores, entrenamientos, eventos, etc.). ¿Estás seguro?')) return;
      
      const { error } = await supabase.from('teams').delete().eq('id', teamId);
      if (error) return alert('Error al eliminar: ' + error.message);
      alert('Equipo eliminado correctamente');
      loadTeams();
      
      // Cerrar dropdown
      btn.closest('.menu-dropdown').classList.remove('show');
    };
  });
}

// Cerrar dropdowns al hacer clic fuera
document.addEventListener('click', (e) => {
  if (!e.target.closest('.team-menu')) {
    document.querySelectorAll('.menu-dropdown.show').forEach(menu => {
      menu.classList.remove('show');
    });
  }
});

// ============================================
// MODAL PARA CREAR/EDITAR EQUIPO
// ============================================

let currentEditTeamId = null;
let currentMode = 'create'; // 'create' o 'edit'

const modal = document.getElementById('teamModal');
const modalTitle = document.getElementById('modalTitle');
const teamNameInput = document.getElementById('teamName');
const teamCategoryInput = document.getElementById('teamCategory');
const saveBtn = document.getElementById('saveTeamBtn');
const closeBtn = document.getElementById('closeModalBtn');
const cancelBtn = document.getElementById('cancelModalBtn');
const fabBtn = document.getElementById('fabBtn');

// Abrir modal
function openModal(mode = 'create', teamId = null, name = '', category = '') {
  currentMode = mode;
  currentEditTeamId = teamId;
  
  if (mode === 'create') {
    modalTitle.textContent = 'Crear nuevo equipo';
    teamNameInput.value = '';
    teamCategoryInput.value = '';
  } else {
    modalTitle.textContent = 'Editar equipo';
    teamNameInput.value = name;
    teamCategoryInput.value = category;
  }
  
  modal.classList.add('show');
  modal.style.display = 'flex';
  teamNameInput.focus();
}

// Cerrar modal
function closeModal() {
  modal.classList.remove('show');
  setTimeout(() => {
    modal.style.display = 'none';
  }, 200);
  currentEditTeamId = null;
}

// FAB - Abrir modal para crear
fabBtn.onclick = () => openModal('create');

// Cerrar modal
closeBtn.onclick = closeModal;
cancelBtn.onclick = closeModal;

// Cerrar al hacer clic fuera
modal.onclick = (e) => {
  if (e.target === modal) closeModal();
};

// Cerrar con ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.style.display === 'flex') {
    closeModal();
  }
});

// Guardar (crear o editar)
saveBtn.onclick = async () => {
  const name = teamNameInput.value.trim();
  const category = teamCategoryInput.value.trim();
  
  if (!name) return alert('El nombre del equipo es obligatorio');

  if (currentMode === 'create') {
    await createTeam(name, category);
  } else {
    await updateTeam(currentEditTeamId, name, category);
  }
};

// Crear equipo
async function createTeam(name, category) {
  try {
    // 1. Insertar en teams
    const { data: newTeam, error: teamError } = await supabase
      .from('teams')
      .insert({ 
        name: name, 
        category: category || null, 
        created_by: user.id 
      })
      .select()
      .single();

    if (teamError) throw teamError;

    console.log('Equipo creado:', newTeam);

    // 2. El trigger automáticamente añade al creador como staff con rol 'principal'
    // Esperar un momento para que el trigger se ejecute
    await new Promise(resolve => setTimeout(resolve, 500));

    // 3. Obtener el registro de staff creado por el trigger
    const { data: staffData, error: staffError } = await supabase
      .from('team_staff')
      .select('id')
      .eq('team_id', newTeam.id)
      .eq('user_id', user.id)
      .single();

    if (staffError) {
      console.error('Error obteniendo staff:', staffError);
      throw new Error('No se pudo obtener el staff del equipo');
    }

    console.log('Staff creado:', staffData);

    // 4. Crear todos los permisos para el principal
    const allPermissions = [
      'MANAGE_TEAM',
      'MANAGE_STAFF',
      'MANAGE_STAFF_PERMISSIONS',
      'MANAGE_PLAYERS',
      'MANAGE_EVENTS',
      'MANAGE_TRAININGS',
      'MANAGE_ATTENDANCE'
    ];

    const permissionsToInsert = allPermissions.map(permission => ({
      team_staff_id: staffData.id,
      permission: permission,
      value: true
    }));

    const { error: permError } = await supabase
      .from('team_staff_permissions')
      .insert(permissionsToInsert);

    if (permError) {
      console.error('Error creando permisos:', permError);
      alert('Equipo creado, pero hubo un problema al asignar permisos. Contacta con soporte.');
    } else {
      console.log('Permisos asignados correctamente');
    }

    alert('¡Equipo creado con éxito!');
    closeModal();
    loadTeams();

  } catch (error) {
    console.error('Error creando equipo:', error);
    alert('Error creando equipo: ' + error.message);
  }
}

// Actualizar equipo
async function updateTeam(teamId, name, category) {
  const { error } = await supabase
    .from('teams')
    .update({ 
      name: name, 
      category: category || null 
    })
    .eq('id', teamId);
  
  if (error) {
    console.error('Error actualizando equipo:', error);
    return alert('Error al actualizar: ' + error.message);
  }
  
  alert('Equipo actualizado correctamente');
  closeModal();
  loadTeams();
}

// Cargar inicial
loadTeams();
