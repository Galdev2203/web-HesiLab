// match_planner.js - Planificador de Partidos
import { supabase } from './supabaseClient.js';
import { initHeader } from './headerComponent.js';
import { getUrlParam, loadData } from './utils/supabaseHelpers.js';
import { escapeHtml, showError, hideError } from './utils/domHelpers.js';
import { ModalManager } from './utils/modalManager.js';

const elements = {
  errorMsg: document.getElementById('errorMsg'),
  teamSelectorSection: document.getElementById('teamSelectorSection'),
  teamSelector: document.getElementById('teamSelector'),
  playersList: document.getElementById('playersList'),
  tempPlayerName: document.getElementById('tempPlayerName'),
  tempPlayerNumber: document.getElementById('tempPlayerNumber'),
  addTempPlayerBtn: document.getElementById('addTempPlayerBtn'),
  matchType: document.getElementById('matchType'),
  quartersGrid: document.getElementById('quartersGrid'),
  slotModalInfo: document.getElementById('slotModalInfo'),
  slotModalList: document.getElementById('slotModalList')
};

const TEAM_ID_PARAM = 'team_id';
const GUEST_TEAM_ID = 'guest';
const SLOT_COUNT = 5;
const SLOT_CAPACITY = 3;
const MATCH_TYPES = {
  basket: 4,
  minibasket: 6
};
let tempPlayerCounter = 1;

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
    this.playerAvailability = {};
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
    this.players.forEach(player => {
      if (!(player.id in this.playerAvailability)) {
        this.playerAvailability[player.id] = 'available';
      }
    });
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
    this.playerAvailability[player.id] = 'available';
    return player;
  }

  setPlayerAvailability(playerId, status) {
    const safeStatus = status === 'injured' || status === 'unavailable' ? status : 'available';
    this.playerAvailability[playerId] = safeStatus;
  }

  getPlayerAvailability(playerId) {
    return this.playerAvailability[playerId] || 'available';
  }

  isPlayerAvailable(playerId) {
    return this.getPlayerAvailability(playerId) === 'available';
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

  setSlotPlayers(quarterIndex, slotIndex, playerIds) {
    const quarter = this.quarters[quarterIndex];
    if (!quarter) return false;

    const slot = quarter[slotIndex];
    if (!slot) return false;

    const unique = Array.from(new Set(playerIds)).slice(0, SLOT_CAPACITY);
    quarter[slotIndex] = unique;
    return true;
  }

  findPlayerSlotInQuarter(quarterIndex, playerId) {
    const quarter = this.quarters[quarterIndex];
    if (!quarter) return null;

    for (let slotIndex = 0; slotIndex < quarter.length; slotIndex += 1) {
      if (quarter[slotIndex].includes(playerId)) {
        return slotIndex;
      }
    }
    return null;
  }

  removePlayerFromAllQuarters(playerId) {
    let removed = false;
    this.quarters.forEach(quarter => {
      quarter.forEach(slot => {
        const index = slot.indexOf(playerId);
        if (index !== -1) {
          slot.splice(index, 1);
          removed = true;
        }
      });
    });
    return removed;
  }
}

class PlannerUI {
  constructor(state, elements) {
    this.state = state;
    this.elements = elements;
    this.slotModal = new ModalManager('slotModal');
    this.activeSlotContext = null;
    this.setupSlotModal();
  }

  setupSlotModal() {
    if (!this.slotModal) return;

    this.slotModal.onSave = () => this.handleSlotModalSave();
    this.slotModal.onClose = () => {
      this.activeSlotContext = null;
    };
  }

  openSlotModal({ quarterIndex, slotIndex }) {
    if (!this.slotModal) return;

    this.activeSlotContext = { quarterIndex, slotIndex };
    this.renderSlotModal();
    this.slotModal.open('edit', `Hueco ${slotIndex + 1}`);
  }

  renderSlotModal() {
    const { slotModalInfo, slotModalList } = this.elements;
    if (!slotModalList || !this.activeSlotContext) return;

    const { quarterIndex, slotIndex } = this.activeSlotContext;
    const slotPlayers = this.state.quarters[quarterIndex]?.[slotIndex] || [];

    if (slotModalInfo) {
      slotModalInfo.textContent = `Selecciona hasta ${SLOT_CAPACITY} jugadores para este hueco.`;
    }

    const availablePlayers = this.state
      .getSortedPlayers()
      .filter(player => this.state.isPlayerAvailable(player.id));

    slotModalList.innerHTML = '';

    availablePlayers.forEach(player => {
      const item = document.createElement('div');
      item.className = 'slot-player-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.dataset.playerId = player.id;

      const inThisSlotIndex = slotPlayers.indexOf(player.id);
      const slotIndexInQuarter = this.state.findPlayerSlotInQuarter(quarterIndex, player.id);
      const inOtherSlot = slotIndexInQuarter !== null && slotIndexInQuarter !== slotIndex;

      if (inThisSlotIndex !== -1) {
        checkbox.checked = true;
      }

      if (inOtherSlot) {
        checkbox.disabled = true;
        item.classList.add('slot-player-disabled');
      }

      checkbox.addEventListener('change', (event) => {
        this.handleSlotModalSelectionChange(event);
      });

      const label = document.createElement('label');
      label.className = 'slot-player-label';
      label.textContent = `${player.number ? player.number + ' - ' : ''}${player.name}`;

      const meta = document.createElement('span');
      meta.className = 'slot-player-meta';

      const position = document.createElement('span');
      position.className = 'slot-player-position';

      if (inOtherSlot) {
        meta.textContent = `En hueco ${slotIndexInQuarter + 1}`;
      }

      meta.appendChild(position);

      item.appendChild(checkbox);
      item.appendChild(label);
      item.appendChild(meta);

      slotModalList.appendChild(item);
    });

    this.updateSlotModalPositions();
  }

  handleSlotModalSelectionChange(event) {
    const { slotModalList } = this.elements;
    if (!slotModalList) return;

    const checked = Array.from(slotModalList.querySelectorAll('input[type="checkbox"]:checked'));
    if (checked.length > SLOT_CAPACITY) {
      event.target.checked = false;
      showError(`Máximo ${SLOT_CAPACITY} jugadores por hueco.`);
      return;
    }

    this.updateSlotModalPositions();
  }

  updateSlotModalPositions() {
    const { slotModalList } = this.elements;
    if (!slotModalList) return;

    const items = Array.from(slotModalList.querySelectorAll('.slot-player-item'));
    let positionCounter = 1;

    items.forEach(item => {
      const checkbox = item.querySelector('input[type="checkbox"]');
      const position = item.querySelector('.slot-player-position');
      if (!checkbox || !position) return;

      if (checkbox.checked && !checkbox.disabled) {
        position.textContent = `Posición ${positionCounter}`;
        positionCounter += 1;
      } else {
        position.textContent = '';
      }
    });
  }

  handleSlotModalSave() {
    if (!this.activeSlotContext) return;
    const { slotModalList } = this.elements;
    if (!slotModalList) return;

    const { quarterIndex, slotIndex } = this.activeSlotContext;
    const currentPlayers = this.state.quarters[quarterIndex]?.[slotIndex] || [];

    const checkedIds = Array.from(slotModalList.querySelectorAll('input[type="checkbox"]:checked'))
      .map(input => input.dataset.playerId)
      .filter(Boolean);

    const kept = currentPlayers.filter(playerId => checkedIds.includes(playerId));
    const added = checkedIds.filter(playerId => !currentPlayers.includes(playerId));
    const finalList = [...kept, ...added].slice(0, SLOT_CAPACITY);

    this.state.setSlotPlayers(quarterIndex, slotIndex, finalList);
    this.renderQuarters();
    this.slotModal.close();
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

    const players = this.state.getSortedPlayers().sort((a, b) => {
      const statusA = this.state.getPlayerAvailability(a.id);
      const statusB = this.state.getPlayerAvailability(b.id);
      const order = { available: 0, injured: 1, unavailable: 2 };
      return (order[statusA] ?? 3) - (order[statusB] ?? 3);
    });

    if (players.length === 0) {
      playersList.innerHTML = '<div class="quarter-placeholder">No hay jugadores en este equipo.</div>';
      return;
    }

    playersList.innerHTML = '';

    players.forEach(player => {
      const item = document.createElement('div');
      item.className = 'player-item';
      const status = this.state.getPlayerAvailability(player.id);
      const isAvailable = status === 'available';
      item.classList.toggle('player-inactive', status !== 'available');
      item.classList.toggle('player-injured', status === 'injured');
      item.setAttribute('draggable', isAvailable ? 'true' : 'false');
      item.dataset.playerId = player.id;

      const numberHtml = player.number ? `<span class="player-number">${escapeHtml(player.number)}</span>` : '';
      const tempTag = player.isTemp ? '<span class="player-tag">Temporal</span>' : '';

      item.innerHTML = `
        ${numberHtml}
        <span class="player-name">${escapeHtml(player.name)}</span>
        ${tempTag}
      `;

      const statusSelect = document.createElement('select');
      statusSelect.className = 'player-status';
      statusSelect.setAttribute('aria-label', `Estado de ${player.name}`);
      statusSelect.innerHTML = `
        <option value="available">Convocado</option>
        <option value="injured">Lesionado</option>
        <option value="unavailable">No convocado</option>
      `;
      statusSelect.value = status;
      statusSelect.addEventListener('change', () => {
        const newStatus = statusSelect.value;
        const available = newStatus === 'available';
        this.state.setPlayerAvailability(player.id, newStatus);
        if (!available) {
          const removed = this.state.removePlayerFromAllQuarters(player.id);
          if (removed) {
            this.renderQuarters();
          }
        }
        item.classList.toggle('player-inactive', newStatus !== 'available');
        item.classList.toggle('player-injured', newStatus === 'injured');
        item.setAttribute('draggable', available ? 'true' : 'false');
        this.renderPlayers();
      });

      statusSelect.addEventListener('mousedown', (event) => {
        event.stopPropagation();
      });

      item.appendChild(statusSelect);

      item.addEventListener('dragstart', (event) => {
        if (!this.state.isPlayerAvailable(player.id)) {
          event.preventDefault();
          return;
        }
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
    if (this.state.quartersCount === 4) {
      quartersGrid.dataset.columns = '4';
    } else if (this.state.quartersCount === 6) {
      quartersGrid.dataset.columns = '3';
    } else {
      quartersGrid.removeAttribute('data-columns');
    }

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

      slot.addEventListener('click', (event) => {
        event.stopPropagation();
        this.openSlotModal({
          quarterIndex: index,
          slotIndex
        });
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
      header.textContent = '';
    }

    slot.classList.toggle('slot-stacked', assigned.length > 3);
    slot.classList.toggle('slot-multi', assigned.length > 1);

    if (!body) return;

    body.innerHTML = '';

    const assignedPlayers = assigned
      .map(playerId => this.state.getPlayerById(playerId))
      .filter(Boolean);

    assignedPlayers.forEach(player => {
      const playerEl = document.createElement('div');
      playerEl.className = 'quarter-player';
      if (!player.number) {
        playerEl.classList.add('no-number');
      }
      playerEl.innerHTML = `
        ${player.number ? `<span class="player-number">${escapeHtml(player.number)}</span>` : ''}
        <span class="player-name">${escapeHtml(player.name)}</span>
      `;
      playerEl.title = 'Quitar jugador';
      playerEl.addEventListener('click', (event) => {
        event.stopPropagation();
        this.openSlotModal({
          quarterIndex: index,
          slotIndex
        });
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

    if (!this.state.isPlayerAvailable(playerId)) {
      showError('Este jugador no está convocado.');
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
    const { tempPlayerName, tempPlayerNumber, addTempPlayerBtn, matchType } = this.elements;

    [tempPlayerName, tempPlayerNumber, addTempPlayerBtn, matchType].forEach(element => {
      if (element) {
        element.disabled = !enabled;
      }
    });
  }
}

const state = new PlannerState();
const ui = new PlannerUI(state, elements);

async function getSessionWithRetry() {
  const maxRetries = 5;
  const retryDelay = 200;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session) {
      return sessionData.session;
    }

    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  return null;
}

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

function handleMatchTypeChange() {
  const type = elements.matchType?.value || 'basket';
  const count = MATCH_TYPES[type] || MATCH_TYPES.basket;
  state.setQuarterCount(count);
  ui.renderQuarters();
}

async function init() {
  await initHeader({
    title: 'Planificador de Partidos',
    backUrl: true,
    activeNav: 'match_planner',
    allowGuest: true,
    guestCtaLabel: 'Iniciar sesión',
    guestCtaHref: '/pages/index.html'
  });

  const session = await getSessionWithRetry();
  const user = session?.user;

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
    const teams = await loadTeams();
    state.setTeams(teams);
    ui.setPlannerEnabled(false);
    ui.renderTeamSelector();
  }

  ui.renderPlayers();
  handleMatchTypeChange();
  ui.renderTeamSelector();

  if (elements.teamSelector) {
    elements.teamSelector.addEventListener('change', (event) => {
      handleTeamSelection(event.target.value);
    });
  }

  if (elements.addTempPlayerBtn) {
    elements.addTempPlayerBtn.addEventListener('click', handleTempPlayerAdd);
  }

  if (elements.matchType) {
    elements.matchType.addEventListener('change', handleMatchTypeChange);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
