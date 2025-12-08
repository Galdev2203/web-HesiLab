// players.js - Gestión de jugadores
import { supabase } from './supabaseClient.js';
import { initHeader } from './headerComponent.js';
import { initPermissions, hasPermission, getUserRole, getRoleLabel } from './permissionsHelper.js';
import { ModalManager } from './utils/modalManager.js';
import { CardRenderer } from './utils/cardRenderer.js';
import { FormValidator, getFormValue, setFormValue, clearForm } from './utils/formValidator.js';
import { requireSession, requireTeamId, loadData, insertData, updateData } from './utils/supabaseHelpers.js';
import { escapeHtml, showError, formatDate } from './utils/domHelpers.js';

// Validar sesión y obtener team_id
await requireSession();
const teamId = requireTeamId();

// Inicializar header
await initHeader({
  title: 'Jugadores',
  backUrl: true,
  activeNav: null
});

// Inicializar permisos
await initPermissions();
const canManage = await hasPermission(teamId, 'MANAGE_PLAYERS');
const userRole = await getUserRole(teamId);

if (!canManage) {
  showError(`No tienes permiso para gestionar jugadores. Tu rol: ${getRoleLabel(userRole)}`);
}

// Estado
let allPlayers = [];

// Modal manager
const modal = new ModalManager('playerModal');
const validator = new FormValidator();

// Card renderer para jugadores
class PlayerCardRenderer extends CardRenderer {
  createCard(player) {
    const card = document.createElement('div');
    card.className = 'item-card fade-in';

    card.innerHTML = `
      <div class="item-card-header">
        <div class="item-info">
          <div class="item-title">
            ${player.number ? `<span class="player-badge">#${player.number}</span>` : ''}
            ${escapeHtml(player.name)}
          </div>
          <div class="item-subtitle">${escapeHtml(player.position) || 'Sin posición'}</div>
        </div>
        ${this.createMenuButton(player.id)}
      </div>
      ${player.birthdate || player.notes ? `
        <div class="item-meta">
          ${player.birthdate ? `<div class="item-meta-row">📅 ${formatDate(player.birthdate)}</div>` : ''}
          ${player.notes ? `<div class="item-meta-row">${escapeHtml(player.notes)}</div>` : ''}
        </div>
      ` : ''}
    `;

    return card;
  }

  render(emptyMessage = 'Aún no hay jugadores') {
    const container = this.getContainer();
    
    if (!container) {
      console.error('Container not found:', this.containerId);
      return;
    }

    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
    
    let filteredPlayers = this.items;
    if (searchTerm) {
      filteredPlayers = this.items.filter(p =>
        p.name.toLowerCase().includes(searchTerm) ||
        (p.number && String(p.number).includes(searchTerm)) ||
        (p.position && p.position.toLowerCase().includes(searchTerm))
      );
    }

    if (filteredPlayers.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>${searchTerm ? 'No se encontraron jugadores' : emptyMessage}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    filteredPlayers.forEach(player => {
      const card = this.createCard(player);
      container.appendChild(card);
    });

    this.attachMenuHandlers();
    this.attachCallbacks();
  }
}

const cardRenderer = new PlayerCardRenderer('playersList');
cardRenderer.setCanManage(canManage);

// Cargar jugadores
async function loadPlayers() {
  const query = supabase
    .from('players')
    .select('*')
    .eq('team_id', teamId)
    .eq('active', true)
    .order('number', { ascending: true });

  const players = await loadData(query, 'Error al cargar jugadores');
  if (players) {
    allPlayers = players;
    cardRenderer.setItems(players);
    cardRenderer.render();
  }
}

// Abrir modal para crear
function openCreateModal() {
  modal.open('create', 'Añadir jugador');
  modal.currentEditId = null;
  clearForm(['playerName', 'playerNumber', 'playerPosition', 'playerBirthdate', 'playerNotes']);
}

// Abrir modal para editar
function openEditModal(player) {
  modal.open('edit', 'Editar jugador');
  modal.currentEditId = player.id;
  setFormValue('playerName', player.name);
  setFormValue('playerNumber', player.number ?? '');
  setFormValue('playerPosition', player.position || '');
  setFormValue('playerBirthdate', player.birthdate || '');
  setFormValue('playerNotes', player.notes || '');
}

// Guardar jugador
async function savePlayer() {
  if (!canManage) {
    alert('No tienes permiso para gestionar jugadores');
    return;
  }

  const name = getFormValue('playerName', 'trim');
  const numberStr = getFormValue('playerNumber', 'trim');
  const position = getFormValue('playerPosition', 'trim');
  const birthdate = getFormValue('playerBirthdate') || null;
  const notes = getFormValue('playerNotes', 'trim');

  // Validar
  validator.reset();
  validator.required(name, 'Nombre del jugador');
  
  let number = null;
  if (numberStr) {
    number = parseInt(numberStr, 10);
    if (isNaN(number) || number < 0) {
      validator.addError('El dorsal debe ser un número válido mayor o igual a 0');
    }
  }

  if (!validator.isValid()) {
    validator.showErrors();
    return;
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

  let result;
  if (modal.mode === 'edit') {
    result = await updateData('players', modal.currentEditId, playerData, 'Jugador actualizado');
  } else {
    result = await insertData('players', playerData, 'Jugador creado');
  }

  if (result.success) {
    modal.close();
    await loadPlayers();
  } else if (result.error?.code === '23505') {
    if (result.error.message.includes('uniq_player_number_per_team')) {
      alert(`El dorsal ${number} ya está siendo usado por otro jugador en este equipo`);
    } else {
      alert('Ya existe un jugador con esos datos en este equipo');
    }
  }
}

// Eliminar jugador (soft delete)
async function deletePlayer(playerId) {
  const player = allPlayers.find(p => p.id == playerId);
  if (!confirm(`¿Eliminar a ${player?.name || 'este jugador'}?`)) return;

  const result = await updateData('players', playerId, { active: false }, 'Jugador eliminado');
  if (result.success) {
    await loadPlayers();
  }
}

// Inicializar cuando el DOM esté listo
async function init() {
  const fabBtn = document.getElementById('fabBtn');
  const searchInput = document.getElementById('searchInput');
  const refreshBtn = document.getElementById('refreshBtn');

  if (fabBtn) {
    fabBtn.onclick = openCreateModal;
    fabBtn.style.display = canManage ? 'flex' : 'none';
  }

  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => cardRenderer.render(), 300);
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadPlayers);
  }

  // Configurar modal callbacks
  modal.onSave = savePlayer;
  cardRenderer.onEdit(openEditModal);
  cardRenderer.onDelete(deletePlayer);

  // Cargar inicial
  await loadPlayers();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
