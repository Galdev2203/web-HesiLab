// events.refactored.js - Versión refactorizada usando helpers
import { supabase } from './supabaseClient.js';
import { initHeader } from './headerComponent.js';
import { initPermissions, hasPermission, getUserRole, getRoleLabel } from './permissionsHelper.js';
import { ModalManager } from './utils/modalManager.js';
import { CardRenderer } from './utils/cardRenderer.js';
import { FormValidator, getFormValue, setFormValue, clearForm } from './utils/formValidator.js';
import { requireSession, requireTeamId, loadData, insertData, updateData, deleteData } from './utils/supabaseHelpers.js';
import { escapeHtml, showError, hideError, formatDate } from './utils/domHelpers.js';

// Indicador visual de versión refactorizada
console.log('✅ VERSIÓN REFACTORIZADA (Events) - Usando arquitectura modular');

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
    card.className = 'event-card fade-in';

    const eventDate = new Date(event.event_date);
    const dayOfWeek = eventDate.toLocaleDateString('es-ES', { weekday: 'short' });
    const day = eventDate.getDate();
    const month = eventDate.toLocaleDateString('es-ES', { month: 'short' });

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
      <div class="event-date ${isPast ? 'event-past' : ''}">
        <div class="event-day">${day}</div>
        <div class="event-month">${month}</div>
        <div class="event-weekday">${dayOfWeek}</div>
      </div>
      <div class="event-content">
        <div class="event-type">${EVENT_TYPES[event.type] || event.type}</div>
        ${event.title ? `<div class="event-title">${escapeHtml(event.title)}</div>` : ''}
        ${timeStr ? `<div class="event-time">🕐 ${timeStr}</div>` : ''}
        ${event.location ? `<div class="event-location">📍 ${escapeHtml(event.location)}</div>` : ''}
        ${event.notes ? `<div class="event-notes">${escapeHtml(event.notes)}</div>` : ''}
      </div>
      <div class="event-actions">
        ${this.canManage ? `
          <button class="btn btn-outline btn-sm edit-btn" data-id="${event.id}">✏️</button>
          <button class="btn btn-danger btn-sm delete-btn" data-id="${event.id}">🗑️</button>
        ` : ''}
      </div>
    `;

    return card;
  }

  render(emptyMessage = 'Aún no hay eventos programados') {
    const typeFilter = document.getElementById('typeFilter').value;
    let filteredEvents = this.items;
    
    if (typeFilter) {
      filteredEvents = this.items.filter(e => e.type === typeFilter);
    }

    const container = document.getElementById(this.containerId);
    
    if (filteredEvents.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📅</div>
          <p>${typeFilter ? 'No hay eventos de este tipo' : emptyMessage}</p>
        </div>
      `;
      return;
    }

    // Agrupar por mes
    const byMonth = {};
    filteredEvents.forEach(event => {
      const date = new Date(event.event_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[monthKey]) byMonth[monthKey] = [];
      byMonth[monthKey].push(event);
    });

    container.innerHTML = '';

    // Renderizar por mes
    Object.keys(byMonth).sort().reverse().forEach(monthKey => {
      const [year, month] = monthKey.split('-');
      const monthName = new Date(year, parseInt(month) - 1, 1).toLocaleDateString('es-ES', { 
        month: 'long', 
        year: 'numeric' 
      });
      
      const monthSection = document.createElement('div');
      monthSection.className = 'events-month-section';
      
      const monthHeader = document.createElement('h3');
      monthHeader.className = 'events-month-header';
      monthHeader.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
      monthSection.appendChild(monthHeader);
      
      const eventsGrid = document.createElement('div');
      eventsGrid.className = 'events-grid';
      
      byMonth[monthKey].forEach(event => {
        const card = this.createCard(event);
        eventsGrid.appendChild(card);
      });
      
      monthSection.appendChild(eventsGrid);
      container.appendChild(monthSection);
    });

    this.attachEventHandlers();
  }

  attachEventHandlers() {
    // Edit buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        const event = this.items.find(ev => ev.id === id);
        if (event && this.editCallback) this.editCallback(event);
      };
    });

    // Delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        if (this.deleteCallback) this.deleteCallback(id);
      };
    });
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
  clearForm(['eventType', 'eventDate', 'startTime', 'endTime', 'title', 'location', 'notes']);
}

// Abrir modal para editar
function openEditModal(event) {
  modal.open('edit', 'Editar evento');
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
    const eventId = allEvents.find(e => 
      e.event_date === eventDate && 
      e.type === type && 
      (e.title || '') === (title || '')
    )?.id;
    
    result = await updateData('team_events', eventId, eventData, 'Evento actualizado');
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

// Event listeners
document.getElementById('fabBtn').onclick = openCreateModal;
document.getElementById('typeFilter')?.addEventListener('change', () => cardRenderer.render());
document.getElementById('refreshBtn')?.addEventListener('click', loadEvents);

// Configurar modal callbacks
modal.onSave = saveEvent;
cardRenderer.onEdit(openEditModal);
cardRenderer.onDelete(deleteEvent);

// Mostrar/ocultar FAB según permisos
document.getElementById('fabBtn').style.display = canManage ? 'flex' : 'none';

// Cargar inicial
loadEvents();
