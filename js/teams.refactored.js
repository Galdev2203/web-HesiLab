// teams.refactored.js - Versión refactorizada usando helpers
import { supabase } from './supabaseClient.js';
import { initHeader } from './headerComponent.js';
import { ModalManager } from './utils/modalManager.js';
import { CardRenderer } from './utils/cardRenderer.js';
import { FormValidator, getFormValue, clearForm } from './utils/formValidator.js';
import { requireSession } from './utils/supabaseHelpers.js';

// Indicador visual de versión refactorizada
console.log('✅ VERSIÓN REFACTORIZADA (Teams) - Usando arquitectura modular');

// Validar sesión
await requireSession();
const user = (await supabase.auth.getSession()).data.session.user;

// Inicializar header
await initHeader({
  title: 'Mis equipos',
  backUrl: '/pages/dashboard.html',
  activeNav: 'teams'
});

// Modal manager
const modal = new ModalManager('teamModal');
const validator = new FormValidator();

// Card renderer para equipos
class TeamCardRenderer extends CardRenderer {
  async createCard(row) {
    const team = row.teams;
    const isHeadCoach = row.role === 'HEAD_COACH' || row.role === 'principal';

    // Obtener stats
    const { count: playersCount } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team.id)
      .eq('active', true);

    const { count: trainingsCount } = await supabase
      .from('team_training_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team.id);

    const card = document.createElement('div');
    card.className = 'team-card fade-in';
    card.dataset.teamid = team.id;

    card.innerHTML = `
      <div class="team-card-header">
        <div class="team-info">
          <div class="team-name">${team.name}</div>
          <div class="team-category">${team.category || 'Sin categoría'}</div>
        </div>
        ${isHeadCoach ? this.createMenuButton(team.id, team.name, team.category) : ''}
      </div>
      <div class="team-stats">
        <div class="stat-item"><strong>${playersCount || 0}</strong> ${playersCount === 1 ? 'jugador' : 'jugadores'}</div>
        <div class="stat-item"><strong>${trainingsCount || 0}</strong> ${trainingsCount === 1 ? 'entrenamiento' : 'entrenamientos'}</div>
      </div>
    `;

    return card;
  }

  createMenuButton(teamId, name, category) {
    return `
      <div class="team-menu">
        <button class="menu-btn" data-teamid="${teamId}" data-name="${name}" data-category="${category || ''}">⋮</button>
        <div class="menu-dropdown">
          <button class="menu-item edit-item" data-teamid="${teamId}" data-name="${name}" data-category="${category || ''}">✏️ Editar</button>
          <button class="menu-item delete delete-item" data-teamid="${teamId}">🗑️ Eliminar</button>
        </div>
      </div>
    `;
  }

  async render(emptyMessage = 'No tienes equipos todavía. ¡Crea tu primer equipo!') {
    const container = document.getElementById(this.containerId);

    if (this.items.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>${emptyMessage}</p></div>`;
      return;
    }

    container.innerHTML = '';

    // Renderizar cards con stats
    for (const row of this.items) {
      const card = await this.createCard(row);
      container.appendChild(card);
    }

    this.attachCardHandlers();
    this.attachMenuHandlers();
  }

  attachCardHandlers() {
    // Hacer cards clickeables (excepto el menú)
    document.querySelectorAll('.team-card').forEach(card => {
      card.onclick = (e) => {
        if (e.target.closest('.team-menu')) return;
        const teamId = card.dataset.teamid;
        window.location.href = `/pages/team_detail.html?team_id=${teamId}`;
      };
    });
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

    // Edit buttons
    document.querySelectorAll('.edit-item').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const team = {
          id: btn.getAttribute('data-teamid'),
          name: btn.getAttribute('data-name'),
          category: btn.getAttribute('data-category')
        };
        if (this.editCallback) this.editCallback(team);
        btn.closest('.menu-dropdown').classList.remove('show');
      };
    });

    // Delete buttons
    document.querySelectorAll('.delete-item').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const teamId = btn.getAttribute('data-teamid');
        if (this.deleteCallback) this.deleteCallback(teamId);
        btn.closest('.menu-dropdown').classList.remove('show');
      };
    });

    // Cerrar dropdowns al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.team-menu')) {
        document.querySelectorAll('.menu-dropdown.show').forEach(menu => {
          menu.classList.remove('show');
        });
      }
    });
  }
}

const cardRenderer = new TeamCardRenderer('teamsContainer');

// Cargar equipos
async function loadTeams() {
  const container = document.getElementById('teamsContainer');
  container.innerText = 'Cargando equipos...';

  try {
    const { data, error } = await supabase
      .from('team_staff')
      .select('team_id, role, teams(id,name,category)')
      .eq('user_id', user.id)
      .eq('active', true);

    if (error) throw error;

    if (!data || data.length === 0) {
      cardRenderer.setItems([]);
      await cardRenderer.render();
      return;
    }

    cardRenderer.setItems(data);
    await cardRenderer.render();
  } catch (error) {
    container.innerText = 'Error al cargar: ' + error.message;
    console.error(error);
  }
}

// Abrir modal para crear
function openCreateModal() {
  modal.open('create', 'Crear nuevo equipo');
  clearForm(['teamName', 'teamCategory']);
}

// Abrir modal para editar
function openEditModal(team) {
  modal.open('edit', 'Editar equipo');
  document.getElementById('teamName').value = team.name;
  document.getElementById('teamCategory').value = team.category || '';
  modal.currentEditId = team.id;
}

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

    // 2. Esperar a que el trigger cree el staff
    let staffData = null;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (!staffData && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const { data, error } = await supabase
        .from('team_staff')
        .select('id, role')
        .eq('team_id', newTeam.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        staffData = data;
        break;
      }
      
      attempts++;
    }

    if (!staffData) {
      throw new Error('No se pudo obtener el registro de staff después de ' + maxAttempts + ' intentos');
    }

    // 3. Crear todos los permisos para el principal
    const allPermissions = [
      'MANAGE_TEAM',
      'MANAGE_STAFF',
      'MANAGE_STAFF_PERMISSIONS',
      'MANAGE_PLAYERS',
      'MANAGE_EVENTS',
      'MANAGE_TRAININGS',
      'MANAGE_ATTENDANCE'
    ];

    // Verificar qué permisos ya existen
    const { data: existingPerms } = await supabase
      .from('team_staff_permissions')
      .select('permission')
      .eq('team_staff_id', staffData.id);

    const existingPermissions = existingPerms ? existingPerms.map(p => p.permission) : [];

    // Solo insertar los permisos que NO existen
    const permissionsToInsert = allPermissions
      .filter(perm => !existingPermissions.includes(perm))
      .map(permission => ({
        team_staff_id: staffData.id,
        permission: permission,
        value: true
      }));

    if (permissionsToInsert.length > 0) {
      const { error: permError } = await supabase
        .from('team_staff_permissions')
        .insert(permissionsToInsert);

      if (permError) {
        console.error('Error creando permisos:', permError);
        // Intentar inserción individual si falla
        let successCount = 0;
        for (const perm of permissionsToInsert) {
          const { error: singleError } = await supabase
            .from('team_staff_permissions')
            .insert(perm);
          
          if (!singleError) successCount++;
        }
        
        if (successCount > 0) {
          alert(`¡Equipo creado! (${successCount}/${allPermissions.length} permisos asignados)`);
        } else {
          alert('Equipo creado, pero hubo un problema al asignar permisos.');
        }
        return;
      }
    }

    alert('¡Equipo creado con éxito!');
    modal.close();
    await loadTeams();

  } catch (error) {
    console.error('Error creando equipo:', error);
    alert('Error creando equipo: ' + error.message);
  }
}

// Actualizar equipo
async function updateTeam(teamId, name, category) {
  try {
    const { error } = await supabase
      .from('teams')
      .update({ 
        name: name, 
        category: category || null 
      })
      .eq('id', teamId);
    
    if (error) throw error;
    
    alert('Equipo actualizado correctamente');
    modal.close();
    await loadTeams();
  } catch (error) {
    console.error('Error actualizando equipo:', error);
    alert('Error al actualizar: ' + error.message);
  }
}

// Eliminar equipo
async function deleteTeam(teamId) {
  if (!confirm('¿Eliminar equipo? Esta acción eliminará todos los datos relacionados (jugadores, entrenamientos, eventos, etc.). ¿Estás seguro?')) {
    return;
  }

  try {
    const { error } = await supabase.from('teams').delete().eq('id', teamId);
    if (error) throw error;
    
    alert('Equipo eliminado correctamente');
    await loadTeams();
  } catch (error) {
    console.error('Error eliminando equipo:', error);
    alert('Error al eliminar: ' + error.message);
  }
}

// Guardar (crear o editar)
async function saveTeam() {
  const name = getFormValue('teamName', 'trim');
  const category = getFormValue('teamCategory', 'trim');

  // Validar
  validator.reset();
  validator.required(name, 'Nombre del equipo');

  if (!validator.isValid()) {
    validator.showErrors();
    return;
  }

  if (modal.mode === 'edit') {
    await updateTeam(modal.currentEditId, name, category);
  } else {
    await createTeam(name, category);
  }
}

// Event listeners
document.getElementById('fabBtn').onclick = openCreateModal;

// Configurar callbacks
modal.onSave = saveTeam;
cardRenderer.onEdit(openEditModal);
cardRenderer.onDelete(deleteTeam);

// Cargar inicial
loadTeams();

// Recargar equipos cuando la página se vuelve visible
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    loadTeams();
  }
});
