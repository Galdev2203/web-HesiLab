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
  document.getElementById('teamsContainer').innerText = 'Cargando equipos...';
  
  // Consultamos team_staff -> teams
  const { data, error } = await supabase
    .from('team_staff')
    .select('team_id, role, teams(id,name,category)')
    .eq('user_id', user.id)
    .eq('active', true);

  if (error) {
    document.getElementById('teamsContainer').innerText = 'Error al cargar: ' + error.message;
    console.error(error);
    return;
  }
  
  if (!data || data.length === 0) {
    document.getElementById('teamsContainer').innerHTML = '<div class="empty-state"><p>No tienes equipos todavía. ¡Crea tu primer equipo!</p></div>';
    return;
  }

  const container = document.getElementById('teamsContainer');
  container.innerHTML = '';
  
  data.forEach(row => {
    const team = row.teams;
    const isHeadCoach = row.role === 'HEAD_COACH';
    const div = document.createElement('div');
    div.className = 'team-card fade-in';
    div.innerHTML = `
      <div class="team-info">
        <div class="team-name">${team.name}</div>
        <div class="team-category">${team.category || 'Sin categoría'}</div>
      </div>
      <div class="team-actions">
        <button class="primary-btn" data-teamid="${team.id}">➜ Entrar</button>
        ${isHeadCoach 
          ? `<button class="secondary-btn" data-teamid="${team.id}" data-action="edit" data-name="${team.name}" data-category="${team.category || ''}">✏️ Editar</button>
             <button class="danger-btn" data-teamid="${team.id}" data-action="delete">🗑️ Eliminar</button>` 
          : ``}
      </div>
    `;
    container.appendChild(div);
  });

  // Attach handlers para botones
  document.querySelectorAll('button.primary-btn[data-teamid]').forEach(b => {
    b.onclick = () => {
      const id = b.getAttribute('data-teamid');
      window.location.href = `/pages/team_detail.html?team_id=${id}`;
    }
  });

  document.querySelectorAll('button.secondary-btn[data-action="edit"]').forEach(b => {
    b.onclick = () => {
      const teamId = b.getAttribute('data-teamid');
      const teamName = b.getAttribute('data-name');
      const teamCategory = b.getAttribute('data-category');
      openEditModal(teamId, teamName, teamCategory);
    }
  });

  document.querySelectorAll('button.danger-btn[data-action="delete"]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('¿Eliminar equipo? Esta acción eliminará todos los datos relacionados (jugadores, entrenamientos, eventos, etc.). ¿Estás seguro?')) return;
      const teamId = b.getAttribute('data-teamid');
      
      // Borrar equipo (también se eliminarán filas relacionadas por FK con CASCADE)
      const { error } = await supabase.from('teams').delete().eq('id', teamId);
      if (error) return alert('Error al eliminar: ' + error.message);
      alert('Equipo eliminado correctamente');
      loadTeams();
    }
  });
}

// Crear equipo
document.getElementById('createBtn').onclick = async () => {
  const name = document.getElementById('teamName').value.trim();
  const category = document.getElementById('teamCategory').value.trim();
  
  if (!name) return alert('Pon un nombre al equipo');

  // Insertar en teams
  const { data: newTeam, error } = await supabase
    .from('teams')
    .insert({ 
      name: name, 
      category: category || null, 
      created_by: user.id 
    })
    .select()
    .single();

  if (error) {
    console.error('Error creando equipo:', error);
    return alert('Error creando equipo: ' + error.message);
  }
  
  // El trigger automáticamente añade al creador como staff, no necesitamos hacer nada más
  document.getElementById('teamName').value = '';
  document.getElementById('teamCategory').value = '';
  loadTeams();
};

// Variables para edición
let currentEditTeamId = null;

// Abrir modal de edición
function openEditModal(teamId, name, category) {
  currentEditTeamId = teamId;
  document.getElementById('editTeamName').value = name;
  document.getElementById('editTeamCategory').value = category || '';
  document.getElementById('editModal').style.display = 'flex';
}

// Guardar edición
document.getElementById('saveEditBtn').onclick = async () => {
  if (!currentEditTeamId) return;
  
  const name = document.getElementById('editTeamName').value.trim();
  const category = document.getElementById('editTeamCategory').value.trim();
  
  if (!name) return alert('El nombre del equipo es obligatorio');
  
  const { error } = await supabase
    .from('teams')
    .update({ 
      name: name, 
      category: category || null 
    })
    .eq('id', currentEditTeamId);
  
  if (error) {
    console.error('Error actualizando equipo:', error);
    return alert('Error al actualizar: ' + error.message);
  }
  
  document.getElementById('editModal').style.display = 'none';
  currentEditTeamId = null;
  loadTeams();
};

// Cerrar modal al hacer clic fuera
document.getElementById('editModal').onclick = (e) => {
  if (e.target.id === 'editModal') {
    document.getElementById('editModal').style.display = 'none';
  }
};

// Cargar inicial
loadTeams();
