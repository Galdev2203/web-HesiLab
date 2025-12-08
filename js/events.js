// events.js - Gestión de eventos del equipo
import { supabase } from './supabaseClient.js';
import { initHeader } from './headerComponent.js';
import { initPermissions, hasPermission, getUserRole, getRoleLabel } from './permissionsHelper.js';
import { ModalManager } from './utils/modalManager.js';
import { CardRenderer } from './utils/cardRenderer.js';
import { FormValidator, getFormValue, setFormValue, clearForm } from './utils/formValidator.js';
import { requireSession, requireTeamId, loadData, insertData, updateData, deleteData } from './utils/supabaseHelpers.js';
import { escapeHtml, showError, hideError, formatDate } from './utils/domHelpers.js';

// Validar sesión y obtener team_id
await requireSession();
const teamId = requireTeamId();

// Inicializar header
await initHeader({
  title: '📅 Eventos',
  backUrl: true,
  activeNav: null
});

// Inicializar permisos
await initPermissions();
const canManage = await hasPermission(teamId, 'MANAGE_EVENTS');
const userRole = await getUserRole(teamId);

if (!canManage) {
  showError(`No tienes permiso para gestionar eventos. Tu rol: ${getRoleLabel(userRole)}`);
}

// Tipos de eventos
const EVENT_TYPES = {
  'MATCH': '⚽ Partido oficial',
  'FRIENDLY': '🤝 Amistoso',
  'TOURNAMENT': '🏆 Torneo',
  'TRAINING': '⚽ Entrenamiento',
  'MEETING': '👥 Reunión',
  'OTHER': '📌 Otro'
};

// Estado
let allEvents = [];

// Modal manager
const modal = new ModalManager('eventModal');
const validator = new FormValidator();

// Card renderer para eventos
class EventCardRenderer extends CardRenderer {
  createCard(event) {
    const card = document.createElement('div');
    card.className = 'item-card fade-in';

    const eventDate = new Date(event.event_date);
    const dateFormatted = eventDate.toLocaleDateString('es-ES', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    });

    let timeStr = '';
    if (event.start_time) {
      const start = event.start_time.substring(0, 5);
      const end = event.end_time ? event.end_time.substring(0, 5) : null;
      timeStr = end ? `${start} - ${end}` : start;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isPast = eventDate < today;

    card.innerHTML = `
      <div class="item-card-header">
        <div class="item-info">
          <div class="item-title">${EVENT_TYPES[event.type] || event.type} ${event.title ? `- ${escapeHtml(event.title)}` : ''}</div>
          <div class="item-subtitle">${dateFormatted}${timeStr ? ` • ${timeStr}` : ''}</div>
        </div>
        ${this.createMenuButton(event.id)}
      </div>
      ${event.location || event.notes ? `
        <div class="item-meta">
          ${event.location ? `<div class="item-meta-row">📍 ${escapeHtml(event.location)}</div>` : ''}
          ${event.notes ? `<div class="item-meta-row">${escapeHtml(event.notes)}</div>` : ''}
        </div>
      ` : ''}
      ${isPast ? '<div class="item-badge">Pasado</div>' : ''}
    `;

    return card;
  }

  render(emptyMessage = 'Aún no hay eventos programados') {
    const container = document.getElementById(this.containerId);
    
    if (!container) {
      console.error('Container not found:', this.containerId);
      return;
    }

    const typeFilterEl = document.getElementById('typeFilter');
    const typeFilter = typeFilterEl ? typeFilterEl.value : '';
    let filteredEvents = this.items;
    
    if (typeFilter) {
      filteredEvents = this.items.filter(e => e.type === typeFilter);
    }
    
    if (filteredEvents.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📅</div>
          <p>${typeFilter ? 'No hay eventos de este tipo' : emptyMessage}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';

    // Renderizar eventos
    filteredEvents.forEach(event => {
      const card = this.createCard(event);
      container.appendChild(card);
    });

    this.attachMenuHandlers();
    this.attachCallbacks();
  }
}

const cardRenderer = new EventCardRenderer('eventsList');
cardRenderer.setCanManage(canManage);

// Cargar eventos
async function loadEvents() {
  const query = supabase
    .from('team_events')
    .select('*')
    .eq('team_id', teamId)
    .order('event_date', { ascending: false })
    .order('start_time', { ascending: true });

  const events = await loadData(query, 'Error al cargar eventos');
  if (events) {
    allEvents = events;
    cardRenderer.setItems(events);
    cardRenderer.render();
  }
}

// Abrir modal para crear
function openCreateModal() {
  modal.open('create', 'Añadir evento');
  modal.currentEditId = null;
  clearForm(['eventType', 'eventDate', 'startTime', 'endTime', 'title', 'location', 'notes']);
}

// Abrir modal para editar
function openEditModal(event) {
  modal.open('edit', 'Editar evento');
  modal.currentEditId = event.id;
  setFormValue('eventType', event.type);
  setFormValue('eventDate', event.event_date);
  setFormValue('startTime', event.start_time || '');
  setFormValue('endTime', event.end_time || '');
  setFormValue('title', event.title || '');
  setFormValue('location', event.location || '');
  setFormValue('notes', event.notes || '');
}

// Guardar evento
async function saveEvent() {
  if (!canManage) {
    alert('No tienes permiso para gestionar eventos');
    return;
  }

  const type = getFormValue('eventType');
  const eventDate = getFormValue('eventDate');
  const startTime = getFormValue('startTime') || null;
  const endTime = getFormValue('endTime') || null;
  const title = getFormValue('title', 'trim');
  const location = getFormValue('location', 'trim');
  const notes = getFormValue('notes', 'trim');

  // Validar
  validator.reset();
  validator.required(type, 'Tipo de evento');
  validator.required(eventDate, 'Fecha del evento');
  
  if (startTime && endTime) {
    validator.timeRange(startTime, endTime);
  }

  if (!validator.isValid()) {
    validator.showErrors();
    return;
  }

  const eventData = {
    team_id: teamId,
    type,
    event_date: eventDate,
    start_time: startTime,
    end_time: endTime,
    title: title || null,
    location: location || null,
    notes: notes || null
  };

  let result;
  if (modal.mode === 'edit') {
    result = await updateData('team_events', modal.currentEditId, eventData, 'Evento actualizado');
  } else {
    result = await insertData('team_events', eventData, 'Evento creado');
  }

  if (result.success) {
    modal.close();
    await loadEvents();
  }
}

// Eliminar evento
async function deleteEvent(eventId) {
  if (!confirm('¿Eliminar este evento?')) return;

  const result = await deleteData('team_events', eventId, 'Evento eliminado');
  if (result.success) {
    await loadEvents();
  }
}

// Event listeners - Esperar a que el DOM esté listo
async function init() {
  const fabBtn = document.getElementById('fabBtn');
  const typeFilter = document.getElementById('typeFilter');
  const refreshBtn = document.getElementById('refreshBtn');

  if (fabBtn) {
    fabBtn.onclick = openCreateModal;
    fabBtn.style.display = canManage ? 'flex' : 'none';
  }
  
  if (typeFilter) {
    typeFilter.addEventListener('change', () => cardRenderer.render());
  }
  
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadEvents);
  }

  // Configurar modal callbacks
  modal.onSave = saveEvent;
  cardRenderer.onEdit(openEditModal);
  cardRenderer.onDelete(deleteEvent);

  // Cargar inicial
  await loadEvents();
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
