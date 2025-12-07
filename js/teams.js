// teams.js - Lógica para gestión de equipos
import { supabase } from "../js/supabaseClient.js";

// Comprobar sesión
const { data: sessionData } = await supabase.auth.getSession();
const session = sessionData.session;
if (!session) {
  window.location.href = "/pages/index.html";
  throw new Error("No session");
}
const user = session.user;

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
    const div = document.createElement('div');
    div.className = 'team-card fade-in';
    div.innerHTML = `
      <div class="team-info">
        <div class="team-name">${team.name}</div>
        <div class="team-category">${team.category || 'Sin categoría'}</div>
      </div>
      <div class="team-actions">
        <button class="primary-btn" data-teamid="${team.id}">➜ Entrar</button>
        ${row.role === 'principal' 
          ? `<button class="danger-btn" data-teamid="${team.id}" data-action="delete">🗑️ Eliminar</button>` 
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

  document.querySelectorAll('button.danger-btn[data-action="delete"]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('¿Eliminar equipo? Esta acción eliminará relaciones; confirmar.')) return;
      const teamId = b.getAttribute('data-teamid');
      
      // Borrar equipo (también se eliminarán filas relacionadas por FK)
      const { error } = await supabase.from('teams').delete().eq('id', teamId);
      if (error) return alert('Error al eliminar: ' + error.message);
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
    .insert({ name, category, created_by: user.id })
    .select()
    .single();

  if (error) return alert('Error creando equipo: ' + error.message);

  // Añadir como staff principal
  const { error: err2 } = await supabase
    .from('team_staff')
    .insert({ team_id: newTeam.id, user_id: user.id, role: 'principal' });

  if (err2) {
    alert('Equipo creado pero no se pudo asignar staff: ' + err2.message);
  } else {
    document.getElementById('teamName').value = '';
    document.getElementById('teamCategory').value = '';
    loadTeams();
  }
};

// Cargar inicial
loadTeams();
