// match_planner.js - Planificador de Partidos
import { supabase } from './supabaseClient.js';
import { initHeader } from './headerComponent.js';
import { getUrlParam, loadData } from './utils/supabaseHelpers.js';
import { escapeHtml, showError, hideError } from './utils/domHelpers.js';

const elements = {
  errorMsg: document.getElementById('errorMsg'),
  teamSelectorSection: document.getElementById('teamSelectorSection'),
  teamSelector: document.getElementById('teamSelector'),
  playersList: document.getElementById('playersList'),
  tempPlayerName: document.getElementById('tempPlayerName'),
  tempPlayerNumber: document.getElementById('tempPlayerNumber'),
  addTempPlayerBtn: document.getElementById('addTempPlayerBtn'),
  quartersCount: document.getElementById('quartersCount'),
  quartersGrid: document.getElementById('quartersGrid')
};

const TEAM_ID_PARAM = 'team_id';
let tempPlayerCounter = 1;
const GUEST_TEAM_ID = 'guest';
const SLOT_COUNT = 5;
const SLOT_CAPACITY = 3;

function renderGuestHeader() {
  const container = document.getElementById('guestHeader');
  if (!container) return;

  container.innerHTML = `
    <header class="landing-header" role="banner">
      <nav class="nav-container" role="navigation" aria-label="Navegación principal">
        <div class="nav-logo">
          <span class="logo-icon">🏀</span>
          <span class="logo-text">HesiLab</span>
        </div>
        <div class="nav-links">
          <a href="/pages/index.html#features" class="nav-link">Características</a>
          <a href="/pages/index.html#benefits" class="nav-link">Beneficios</a>
          <a href="/pages/index.html#how-it-works" class="nav-link">Cómo Funciona</a>
          <a href="/pages/index.html" class="nav-link">Volver</a>
        </div>
      </nav>
    </header>
  `;
}
function sortPlayersByNumber(players) {
  return (players || []).sort((a, b) => {
    const numA = a.number ? parseInt(a.number, 10) : 999999;
    const numB = b.number ? parseInt(b.number, 10) : 999999;

    if (numA !== numB) {
      return numA - numB;
    }

    const lenA = a.number ? String(a.number).length : 0;
    const lenB = b.number ? String(b.number).length : 0;
    return lenB - lenA;
  });
}

class PlannerState {
  constructor() {
    this.teamId = null;
    this.teams = [];
    this.players = [];
    this.tempPlayers = [];
    this.quartersCount = 4;
    this.quarters = this.createQuarters(this.quartersCount);
  }

  createQuarters(count) {
    return Array.from({ length: count }, () => this.createSlots());
  }

  createSlots() {
    return Array.from({ length: SLOT_COUNT }, () => []);
  }

  setTeamId(teamId) {
    this.teamId = teamId;
    this.tempPlayers = [];
    this.quarters = this.createQuarters(this.quartersCount);
  }

  setTeams(teams) {
    this.teams = teams;
  }

  setPlayers(players) {
    this.players = players;
  }

  setQuarterCount(count) {
    const safeCount = Math.max(1, count || 1);
    if (safeCount === this.quartersCount) return;

    if (safeCount > this.quarters.length) {
      const extra = this.createQuarters(safeCount - this.quarters.length);
      this.quarters = [...this.quarters, ...extra];
    } else {
      this.quarters = this.quarters.slice(0, safeCount);
    }

    this.quartersCount = safeCount;
  }

  addTempPlayer(name, number) {
    const player = {
      id: `temp-${tempPlayerCounter++}`,
      name,
      number: number || null,
      isTemp: true
    };

    this.tempPlayers.push(player);
    return player;
  }

  getAllPlayers() {
    return [...this.players, ...this.tempPlayers];
  }

  getSortedPlayers() {
    return sortPlayersByNumber(this.getAllPlayers());
  }

  getPlayerById(playerId) {
    return this.getAllPlayers().find(player => player.id === playerId);
  }

  isPlayerInQuarter(quarterIndex, playerId) {
    const quarter = this.quarters[quarterIndex];
    if (!quarter) return false;

    return quarter.some(slot => slot.includes(playerId));
  }

  assignPlayerToQuarter(quarterIndex, slotIndex, playerId) {
    const quarter = this.quarters[quarterIndex];
    if (!quarter) {
      return { success: false, reason: 'invalid-quarter' };
    }

    const slot = quarter[slotIndex];
    if (!slot) {
      return { success: false, reason: 'invalid-slot' };
    }

    if (this.isPlayerInQuarter(quarterIndex, playerId)) {
      return { success: false, reason: 'already-assigned' };
    }

    if (slot.length >= SLOT_CAPACITY) {
      return { success: false, reason: 'slot-full' };
    }

    slot.push(playerId);
    return { success: true };
  }

  removePlayerFromQuarter(quarterIndex, slotIndex, playerId) {
    const quarter = this.quarters[quarterIndex];
    if (!quarter) return false;

    const slot = quarter[slotIndex];
    if (!slot) return false;

    const index = slot.indexOf(playerId);
    if (index === -1) return false;

    slot.splice(index, 1);
    return true;
  }
}

class PlannerUI {
  constructor(state, elements) {
    this.state = state;
    this.elements = elements;
  }

  renderTeamSelector() {
    const { teamSelectorSection, teamSelector } = this.elements;

    if (!teamSelectorSection || !teamSelector) return;

    if (this.state.teamId) {
      teamSelectorSection.style.display = 'none';
      return;
    }

    teamSelectorSection.style.display = 'flex';
    teamSelector.innerHTML = '<option value="">Selecciona un equipo</option>';

    this.state.teams.forEach(team => {
      const option = document.createElement('option');
      option.value = team.id;
      option.textContent = team.name;
      teamSelector.appendChild(option);
    });
  }

  renderPlayers() {
    const { playersList } = this.elements;
    if (!playersList) return;

    if (!this.state.teamId) {
      playersList.innerHTML = 'Selecciona un equipo para cargar jugadores.';
      return;
    }

    const players = this.state.getSortedPlayers();

    if (players.length === 0) {
      playersList.innerHTML = '<div class="quarter-placeholder">No hay jugadores en este equipo.</div>';
      return;
    }

    playersList.innerHTML = '';

    players.forEach(player => {
      const item = document.createElement('div');
      item.className = 'player-item';
      item.setAttribute('draggable', 'true');
      item.dataset.playerId = player.id;

      const numberHtml = player.number ? `<span class="player-number">${escapeHtml(player.number)}</span>` : '';
      const tempTag = player.isTemp ? '<span class="player-tag">Temporal</span>' : '';

      item.innerHTML = `
        ${numberHtml}
        <span class="player-name">${escapeHtml(player.name)}</span>
        ${tempTag}
      `;

      item.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', player.id);
        event.dataTransfer.effectAllowed = 'copy';
      });

      playersList.appendChild(item);
    });
  }

  renderQuarters() {
    const { quartersGrid } = this.elements;
    if (!quartersGrid) return;

    quartersGrid.innerHTML = '';

    this.state.quarters.forEach((_, index) => {
      quartersGrid.appendChild(this.createQuarterCard(index));
    });
  }

  createQuarterCard(index) {
    const card = document.createElement('div');
    card.className = 'quarter-card';

    const header = document.createElement('div');
    header.className = 'quarter-header';
    header.textContent = `Cuarto ${index + 1}`;

    const dropzone = document.createElement('div');
    dropzone.className = 'quarter-dropzone';
    dropzone.dataset.quarterIndex = String(index);

    for (let slotIndex = 0; slotIndex < SLOT_COUNT; slotIndex += 1) {
      const slot = document.createElement('div');
      slot.className = 'quarter-slot';
      slot.dataset.quarterIndex = String(index);
      slot.dataset.slotIndex = String(slotIndex);

      const slotHeader = document.createElement('div');
      slotHeader.className = 'quarter-slot-header';

      const slotBody = document.createElement('div');
      slotBody.className = 'quarter-slot-body';

      slot.appendChild(slotHeader);
      slot.appendChild(slotBody);

      slot.addEventListener('dragover', (event) => {
        event.preventDefault();
        slot.classList.add('drag-over');
      });

      slot.addEventListener('dragleave', () => {
        slot.classList.remove('drag-over');
      });

      slot.addEventListener('drop', (event) => {
        event.preventDefault();
        slot.classList.remove('drag-over');
        const playerId = event.dataTransfer.getData('text/plain');
        this.handleDrop(index, slotIndex, playerId);
      });

      this.renderQuarterPlayers(slot, index, slotIndex);
      dropzone.appendChild(slot);
    }

    card.appendChild(header);
    card.appendChild(dropzone);
    return card;
  }

  renderQuarterPlayers(slot, index, slotIndex) {
    const header = slot.querySelector('.quarter-slot-header');
    const body = slot.querySelector('.quarter-slot-body');
    const assigned = this.state.quarters[index]?.[slotIndex] || [];

    if (header) {
      header.textContent = `Hueco ${slotIndex + 1} (${assigned.length}/${SLOT_CAPACITY})`;
    }

    if (!body) return;

    body.innerHTML = '';

    if (assigned.length === 0) {
      body.innerHTML = '<div class="quarter-placeholder">Arrastra jugadores aquí</div>';
      return;
    }

    assigned.forEach(playerId => {
      const player = this.state.getPlayerById(playerId);
      if (!player) return;

      const playerEl = document.createElement('div');
      playerEl.className = 'quarter-player';
      playerEl.innerHTML = `
        ${player.number ? `<span class="player-number">${escapeHtml(player.number)}</span>` : ''}
        ${escapeHtml(player.name)}
      `;
      playerEl.title = 'Quitar jugador';
      playerEl.addEventListener('click', () => {
        const removed = this.state.removePlayerFromQuarter(index, slotIndex, playerId);
        if (removed) {
          this.renderQuarters();
        }
      });
      body.appendChild(playerEl);
    });
  }

  handleDrop(quarterIndex, slotIndex, playerId) {
    hideError();

    if (!this.state.teamId) {
      showError('Selecciona un equipo antes de asignar jugadores.');
      return;
    }

    const player = this.state.getPlayerById(playerId);
    if (!player) {
      showError('Jugador no válido.');
      return;
    }

    const result = this.state.assignPlayerToQuarter(quarterIndex, slotIndex, playerId);
    if (!result.success) {
      if (result.reason === 'slot-full') {
        showError('Este hueco ya tiene 3 jugadores.');
        return;
      }

      if (result.reason === 'already-assigned') {
        return;
      }
    }

    this.renderQuarters();
  }

  setPlannerEnabled(enabled) {
    const { tempPlayerName, tempPlayerNumber, addTempPlayerBtn, quartersCount } = this.elements;

    [tempPlayerName, tempPlayerNumber, addTempPlayerBtn, quartersCount].forEach(element => {
      if (element) {
        element.disabled = !enabled;
      }
    });
  }
}

const state = new PlannerState();
const ui = new PlannerUI(state, elements);

async function loadTeams() {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;

  if (!user) return [];

  const { data, error } = await supabase
    .from('team_staff')
    .select('team_id, teams(id,name)')
    .eq('user_id', user.id)
    .eq('active', true);

  if (error) {
    showError('No se pudieron cargar los equipos.');
    return [];
  }

  return (data || []).map(row => row.teams).filter(Boolean);
}

async function loadPlayers(teamId) {
  if (!teamId) return [];

  const query = supabase
    .from('players')
    .select('id, name, number')
    .eq('team_id', teamId)
    .eq('active', true);

  const players = await loadData(query, 'Error al cargar jugadores');
  return (players || []).map(player => ({
    id: `player-${player.id}`,
    name: player.name,
    number: player.number || null,
    isTemp: false
  }));
}

function handleTeamSelection(teamId) {
  if (!teamId) {
    state.setTeamId(null);
    ui.renderPlayers();
    ui.renderQuarters();
    ui.setPlannerEnabled(false);
    return;
  }

  state.setTeamId(teamId);
  ui.setPlannerEnabled(true);
  loadPlayers(teamId)
    .then(players => {
      state.setPlayers(players);
      ui.renderPlayers();
      ui.renderQuarters();
    })
    .catch(error => {
      console.error(error);
      showError('No se pudieron cargar los jugadores.');
    });
}

function handleTempPlayerAdd() {
  hideError();

  if (!state.teamId) {
    showError('Selecciona un equipo para añadir jugadores temporales.');
    return;
  }

  const name = elements.tempPlayerName?.value.trim();
  const numberRaw = elements.tempPlayerNumber?.value.trim();

  if (!name) {
    showError('Introduce el nombre del jugador temporal.');
    return;
  }

  if (numberRaw && !/^\d+$/.test(numberRaw)) {
    showError('El dorsal debe contener solo números.');
    return;
  }

  state.addTempPlayer(name, numberRaw || null);
  elements.tempPlayerName.value = '';
  elements.tempPlayerNumber.value = '';
  ui.renderPlayers();
}

function handleQuarterCountChange() {
  const value = parseInt(elements.quartersCount?.value, 10);
  state.setQuarterCount(value);
  ui.renderQuarters();
}

async function init() {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;

  if (user) {
    await initHeader({
      title: 'Planificador de Partidos',
      backUrl: true,
      activeNav: 'match_planner'
    });
  } else {
    document.body.classList.remove('has-unified-header');
    renderGuestHeader();
  }

  const teamIdFromUrl = getUrlParam(TEAM_ID_PARAM);

  if (teamIdFromUrl && user) {
    state.setTeamId(teamIdFromUrl);
    ui.setPlannerEnabled(true);
    try {
      const players = await loadPlayers(teamIdFromUrl);
      state.setPlayers(players);
    } catch (error) {
      console.error(error);
      showError('No se pudieron cargar los jugadores.');
    }
  } else if (!user) {
    state.setTeamId(GUEST_TEAM_ID);
    state.setPlayers([]);
    ui.setPlannerEnabled(true);
    ui.renderTeamSelector();
    if (teamIdFromUrl) {
      showError('Inicia sesión para cargar jugadores de un equipo. Puedes usar el modo temporal sin cuenta.');
    }
  } else {
      header.textContent = '';
    state.setTeams(teams);

    ui.setPlannerEnabled(false);
    ui.renderTeamSelector();
  }

  ui.renderPlayers();
  ui.renderQuarters();
  ui.renderTeamSelector();
      body.innerHTML = '';
  if (elements.teamSelector) {
    elements.teamSelector.addEventListener('change', (event) => {
      handleTeamSelection(event.target.value);
    });
  }

  if (elements.addTempPlayerBtn) {
    elements.addTempPlayerBtn.addEventListener('click', handleTempPlayerAdd);
  }
      if (!player.number) {
        playerEl.classList.add('no-number');
      }

        ${player.number ? `<span class="player-number">${escapeHtml(player.number)}</span>` : ''}
        <span class="player-name">${escapeHtml(player.name)}</span>
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
