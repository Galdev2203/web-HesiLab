// players.js - Lógica para gestión de jugadores
import { supabase } from '../js/supabaseClient.js';

// Sesión
const { data: sessionData } = await supabase.auth.getSession();
if (!sessionData.session) {
  window.location.href = '/pages/index.html';
  throw new Error('No session');
}
const user = sessionData.session.user;

// team_id desde querystring
const params = new URLSearchParams(window.location.search);
const teamId = params.get('team_id');
if (!teamId) {
  document.getElementById('errorMsg').innerText = 'Error: falta team_id en la URL.';
  throw new Error('Missing team_id');
}

// Mi rol actual
let myRole = null;

async function loadMyRole() {
  const { data, error } = await supabase
    .from('team_staff')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .eq('active', true)
    .single();

  if (error || !data) {
    document.getElementById('errorMsg').innerText = 'No tienes permiso para ver este equipo.';
    throw new Error('No permission');
  }

  myRole = data.role;
}

// Estado de edición
let editingId = null;

// Helpers
function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function getFilters() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  return { q };
}

// Carga y render
async function loadPlayers() {
  await loadMyRole();

  const container = document.getElementById('playersList');
  container.innerHTML = 'Cargando...';

  // Traer jugadores del equipo
  const { data, error } = await supabase
    .from('players')
    .select('id, name, number, position, notes, active, created_at')
    .eq('team_id', teamId)
    .order('number', { ascending: true });

  if (error) {
    container.innerText = 'Error cargando jugadores: ' + error.message;
    console.error(error);
    return;
  }

  const { q } = getFilters();
  let list = data || [];
  if (q) {
    list = list.filter(x =>
      (x.name || '').toLowerCase().includes(q) ||
      (x.number !== null && String(x.number).includes(q))
    );
  }

  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No hay jugadores en este equipo.</p></div>';
    return;
  }

  container.innerHTML = '';
  list.forEach(p => {
    const card = document.createElement('div');
    card.className = 'player-card';

    const playerInfo = document.createElement('div');
    playerInfo.className = 'player-info';

    const playerNumber = document.createElement('div');
    playerNumber.className = 'player-number';
    playerNumber.textContent = p.number ?? '-';

    const playerDetails = document.createElement('div');
    playerDetails.className = 'player-details';

    const playerName = document.createElement('div');
    playerName.className = 'player-name';
    playerName.textContent = p.name || 'Sin nombre';

    const playerPosition = document.createElement('div');
    playerPosition.className = 'player-position';
    playerPosition.textContent = p.position || 'Sin posición';

    playerDetails.appendChild(playerName);
    playerDetails.appendChild(playerPosition);

    if (p.notes) {
      const playerNotes = document.createElement('div');
      playerNotes.className = 'player-notes';
      playerNotes.textContent = p.notes;
      playerDetails.appendChild(playerNotes);
    }

    playerInfo.appendChild(playerNumber);
    playerInfo.appendChild(playerDetails);

    const playerActions = document.createElement('div');
    playerActions.className = 'player-actions';

    // Editar (principal/segundo)
    if (myRole === 'principal' || myRole === 'segundo') {
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-outline';
      editBtn.textContent = '✏️ Editar';
      editBtn.onclick = () => openEditForm(p);
      playerActions.appendChild(editBtn);
    }

    // Eliminar (solo principal)
    if (myRole === 'principal') {
      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-danger';
      delBtn.textContent = '🗑️ Eliminar';
      delBtn.onclick = async () => {
        if (!confirm('¿Eliminar jugador? Esta acción es irreversible.')) return;
        
        // Limpiar UI rápidamente
        document.getElementById('playersList').innerHTML = 'Actualizando...';
        const { error } = await supabase.from('players').delete().eq('id', p.id);
        if (error) {
          alert('Error eliminando: ' + error.message);
          loadPlayers();
          return;
        }
        loadPlayers();
      };
      playerActions.appendChild(delBtn);
    }

    card.appendChild(playerInfo);
    card.appendChild(playerActions);
    container.appendChild(card);
  });
}

// Abrir formulario para editar
function openEditForm(player) {
  editingId = player.id;
  document.getElementById('formTitle').innerText = 'Editar jugador';
  document.getElementById('playerName').value = player.name || '';
  document.getElementById('playerNumber').value = player.number ?? '';
  document.getElementById('playerPosition').value = player.position || '';
  document.getElementById('playerNotes').value = player.notes || '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Cancelar edición
document.getElementById('cancelEditBtn').onclick = (e) => {
  e.preventDefault();
  resetForm();
};

function resetForm() {
  editingId = null;
  document.getElementById('formTitle').innerText = 'Añadir jugador';
  document.getElementById('playerName').value = '';
  document.getElementById('playerNumber').value = '';
  document.getElementById('playerPosition').value = '';
  document.getElementById('playerNotes').value = '';
}

// Guardar (crear o actualizar)
document.getElementById('savePlayerBtn').onclick = async () => {
  // Validar permisos
  await loadMyRole();
  if (!(myRole === 'principal' || myRole === 'segundo')) {
    alert('No tienes permiso para añadir/editar jugadores.');
    return;
  }

  const name = document.getElementById('playerName').value.trim();
  const numberRaw = document.getElementById('playerNumber').value.trim();
  const position = document.getElementById('playerPosition').value.trim();
  const notes = document.getElementById('playerNotes').value.trim();

  // Validaciones: name + dorsal obligatorios
  if (!name) { alert('El nombre es obligatorio.'); return; }
  if (!numberRaw) { alert('El dorsal es obligatorio.'); return; }
  const number = parseInt(numberRaw, 10);
  if (Number.isNaN(number) || number < 0) { alert('Dorsal inválido.'); return; }

  // Preparar payload
  const payload = {
    team_id: teamId,
    name,
    number,
    position: position || null,
    notes: notes || null,
    active: true
  };

  // Limpiar UI inmediatamente
  document.getElementById('playersList').innerHTML = 'Actualizando...';

  if (editingId) {
    // Update
    const { error } = await supabase.from('players').update(payload).eq('id', editingId);
    if (error) {
      alert('Error actualizando jugador: ' + error.message);
      loadPlayers();
      return;
    }
    alert('Jugador actualizado.');
    resetForm();
    await loadPlayers();
    return;
  } else {
    // Insert
    const { error } = await supabase.from('players').insert(payload);
    if (error) {
      alert('Error añadiendo jugador: ' + error.message);
      loadPlayers();
      return;
    }
    alert('Jugador añadido.');
    resetForm();
    await loadPlayers();
    return;
  }
};

// Filtros y eventos
document.getElementById('refreshBtn').onclick = () => loadPlayers();
document.getElementById('searchInput').oninput = debounce(() => loadPlayers(), 300);

// Debounce
function debounce(fn, wait) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(()=>fn(...a), wait); };
}

// Inicial
loadPlayers();
