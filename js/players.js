// players.js - Gestión de jugadores con sistema de permisos
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
const user = sessionData.session.user;

// Inicializar permisos
await initPermissions();

// Obtener team_id de la URL
const params = new URLSearchParams(window.location.search);
const teamId = params.get('team_id');

if (!teamId) {
  document.getElementById('errorMsg').style.display = 'block';
  document.getElementById('errorMsg').innerText = 'Error: falta team_id en la URL.';
  throw new Error('Missing team_id');
}

// Verificar permisos
const canManage = await hasPermission(teamId, 'MANAGE_PLAYERS');
const userRole = await getUserRole(teamId);

if (!canManage) {
  document.getElementById('errorMsg').style.display = 'block';
  document.getElementById('errorMsg').innerText = `No tienes permiso para gestionar jugadores. Tu rol: ${getRoleLabel(userRole)}`;
  const formBox = document.getElementById('formBox');
  if (formBox) formBox.style.display = 'none';
}

// Estado
let editingId = null;
let allPlayers = [];

/**
 * Cargar jugadores del equipo
 */
async function loadPlayers() {
  const container = document.getElementById('playersList');
  container.innerHTML = '<div class="loading">Cargando jugadores...</div>';

  try {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', teamId)
      .eq('active', true)
      .order('number', { ascending: true });

    if (error) throw error;

    allPlayers = data || [];
    renderPlayers();
  } catch (error) {
    container.innerHTML = `<div class="error-state">Error: ${error.message}</div>`;
    console.error('Error loading players:', error);
  }
}

/**
 * Renderizar lista de jugadores
 */
function renderPlayers() {
  const container = document.getElementById('playersList');
  const searchTerm = document.getElementById('searchInput')?.value.trim().toLowerCase() || '';

  let filteredPlayers = allPlayers;
  if (searchTerm) {
    filteredPlayers = allPlayers.filter(p =>
      p.name.toLowerCase().includes(searchTerm) ||
      (p.number && String(p.number).includes(searchTerm)) ||
      (p.position && p.position.toLowerCase().includes(searchTerm))
    );
  }

  if (filteredPlayers.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>${searchTerm ? 'No se encontraron jugadores' : 'Aún no hay jugadores'}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  filteredPlayers.forEach(player => {
    const card = createPlayerCard(player);
    container.appendChild(card);
  });
}

/**
 * Crear card de jugador
 */
function createPlayerCard(player) {
  const card = document.createElement('div');
  card.className = 'player-card fade-in';

  card.innerHTML = `
    <div class="player-info">
      <div class="player-number">${player.number || '-'}</div>
      <div class="player-details">
        <div class="player-name">${escapeHtml(player.name)}</div>
        <div class="player-position">${escapeHtml(player.position) || 'Sin posición'}</div>
        ${player.birthdate ? `<div class="player-meta">📅 ${formatDate(player.birthdate)}</div>` : ''}
        ${player.notes ? `<div class="player-notes">${escapeHtml(player.notes)}</div>` : ''}
      </div>
    </div>
    <div class="player-actions" id="actions-${player.id}"></div>
  `;

  if (canManage) {
    const actionsContainer = card.querySelector(`#actions-${player.id}`);
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-outline btn-sm';
    editBtn.textContent = '✏️ Editar';
    editBtn.onclick = () => openEditForm(player);
    actionsContainer.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger btn-sm';
    deleteBtn.textContent = '🗑️';
    deleteBtn.onclick = () => deletePlayer(player.id, player.name);
    actionsContainer.appendChild(deleteBtn);
  }

  return card;
}

/**
 * Abrir formulario para editar
 */
function openEditForm(player) {
  editingId = player.id;
  document.getElementById('formTitle').textContent = 'Editar jugador';
  document.getElementById('playerName').value = player.name || '';
  document.getElementById('playerNumber').value = player.number ?? '';
  document.getElementById('playerPosition').value = player.position || '';
  const birthdateInput = document.getElementById('playerBirthdate');
  if (birthdateInput) birthdateInput.value = player.birthdate || '';
  document.getElementById('playerNotes').value = player.notes || '';
  
  document.getElementById('cancelEditBtn').style.display = 'inline-block';
  document.getElementById('savePlayerBtn').textContent = '💾 Guardar';
  
  const formBox = document.getElementById('formBox');
  if (formBox) formBox.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Resetear formulario
 */
function resetForm() {
  editingId = null;
  document.getElementById('formTitle').textContent = 'Añadir jugador';
  document.getElementById('playerName').value = '';
  document.getElementById('playerNumber').value = '';
  document.getElementById('playerPosition').value = '';
  const birthdateInput = document.getElementById('playerBirthdate');
  if (birthdateInput) birthdateInput.value = '';
  document.getElementById('playerNotes').value = '';
  document.getElementById('cancelEditBtn').style.display = 'none';
  document.getElementById('savePlayerBtn').textContent = '➕ Añadir';
}

/**
 * Guardar jugador
 */
async function savePlayer(e) {
  e.preventDefault();

  if (!canManage) {
    alert('No tienes permiso para gestionar jugadores');
    return;
  }

  const name = document.getElementById('playerName').value.trim();
  const numberStr = document.getElementById('playerNumber').value.trim();
  const position = document.getElementById('playerPosition').value.trim();
  const birthdateInput = document.getElementById('playerBirthdate');
  const birthdate = birthdateInput ? birthdateInput.value || null : null;
  const notes = document.getElementById('playerNotes').value.trim();

  if (!name) {
    alert('El nombre es obligatorio');
    return;
  }

  let number = null;
  if (numberStr) {
    number = parseInt(numberStr, 10);
    if (isNaN(number) || number < 0) {
      alert('El dorsal debe ser un número válido');
      return;
    }
  }

  const playerData = {
    team_id: teamId,
    name,
    number,
    position: position || null,
    birthdate,
    notes: notes || null,
    active: true
  };

  try {
    if (editingId) {
      const { error } = await supabase
        .from('players')
        .update(playerData)
        .eq('id', editingId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('players')
        .insert(playerData);
      if (error) throw error;
    }

    resetForm();
    await loadPlayers();
  } catch (error) {
    console.error('Error saving player:', error);
    if (error.code === '23505') {
      alert('Ya existe un jugador con ese dorsal');
    } else {
      alert(`Error: ${error.message}`);
    }
  }
}

/**
 * Eliminar jugador
 */
async function deletePlayer(playerId, playerName) {
  if (!confirm(`¿Eliminar a ${playerName}?`)) return;

  try {
    const { error } = await supabase
      .from('players')
      .update({ active: false })
      .eq('id', playerId);

    if (error) throw error;
    await loadPlayers();
  } catch (error) {
    console.error('Error deleting player:', error);
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

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Event listeners
document.getElementById('savePlayerBtn')?.addEventListener('click', savePlayer);
document.getElementById('cancelEditBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  resetForm();
});

let searchTimeout;
document.getElementById('searchInput')?.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => renderPlayers(), 300);
});

document.getElementById('refreshBtn')?.addEventListener('click', () => loadPlayers());

// Cargar inicial
loadPlayers();
