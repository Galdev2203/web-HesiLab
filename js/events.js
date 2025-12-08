// events.js - Gestión de eventos del equipo
import { supabase } from '../js/supabaseClient.js';
import { initHeader } from '../js/headerComponent.js';
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

// Obtener team_id
const params = new URLSearchParams(window.location.search);
const teamId = params.get('team_id');

if (!teamId) {
  alert('Error: falta team_id');
  window.location.href = '/pages/teams.html';
  throw new Error('Missing team_id');
}

// Inicializar header
await initHeader('📅 Eventos', true);

// Inicializar permisos
await initPermissions();

// Verificar permisos
const canManage = await hasPermission(teamId, 'MANAGE_EVENTS');
const userRole = await getUserRole(teamId);

if (!canManage) {
  document.getElementById('errorMsg').style.display = 'block';
  document.getElementById('errorMsg').innerText = `No tienes permiso para gestionar eventos. Tu rol: ${getRoleLabel(userRole)}`;
  const formBox = document.getElementById('formBox');
  if (formBox) formBox.style.display = 'none';
}

// Estado
let editingId = null;
let allEvents = [];

const EVENT_TYPES = {
  'MATCH': '⚽ Partido oficial',
  'FRIENDLY': '🤝 Amistoso',
  'TOURNAMENT': '🏆 Torneo',
  'TRAINING': '⚽ Entrenamiento',
  'MEETING': '👥 Reunión',
  'OTHER': '📌 Otro'
};

/**
 * Cargar eventos
 */
async function loadEvents() {
  const container = document.getElementById('eventsList');
  container.innerHTML = '<div class="loading">Cargando eventos...</div>';

  try {
    const { data, error } = await supabase
      .from('team_events')
      .select('*')
      .eq('team_id', teamId)
      .order('event_date', { ascending: false })
      .order('start_time', { ascending: true });

    if (error) throw error;

    allEvents = data || [];
    renderEvents();
  } catch (error) {
    container.innerHTML = `<div class="error-state">Error: ${error.message}</div>`;
    console.error('Error loading events:', error);
  }
}

/**
 * Renderizar eventos
 */
function renderEvents() {
  const container = document.getElementById('eventsList');
  const typeFilter = document.getElementById('typeFilter').value;

  let filteredEvents = allEvents;
  if (typeFilter) {
    filteredEvents = allEvents.filter(e => e.type === typeFilter);
  }

  if (filteredEvents.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📅</div>
        <p>${typeFilter ? 'No hay eventos de este tipo' : 'Aún no hay eventos programados'}</p>
        ${!typeFilter ? '<p class="empty-hint">Usa el formulario de abajo para añadir eventos</p>' : ''}
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  
  // Agrupar por mes
  const byMonth = {};
  filteredEvents.forEach(event => {
    const date = new Date(event.event_date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth[monthKey]) byMonth[monthKey] = [];
    byMonth[monthKey].push(event);
  });

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
      const card = createEventCard(event);
      eventsGrid.appendChild(card);
    });
    
    monthSection.appendChild(eventsGrid);
    container.appendChild(monthSection);
  });
}

/**
 * Crear card de evento
 */
function createEventCard(event) {
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
    <div class="event-actions" id="actions-${event.id}"></div>
  `;

  if (canManage) {
    const actionsContainer = card.querySelector(`#actions-${event.id}`);
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-outline btn-sm';
    editBtn.textContent = '✏️';
    editBtn.onclick = () => openEditForm(event);
    actionsContainer.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger btn-sm';
    deleteBtn.textContent = '🗑️';
    deleteBtn.onclick = () => deleteEvent(event.id);
    actionsContainer.appendChild(deleteBtn);
  }

  return card;
}

/**
 * Abrir formulario para editar
 */
function openEditForm(event) {
  editingId = event.id;
  document.getElementById('formTitle').textContent = 'Editar evento';
  document.getElementById('eventType').value = event.type;
  document.getElementById('eventDate').value = event.event_date;
  document.getElementById('startTime').value = event.start_time || '';
  document.getElementById('endTime').value = event.end_time || '';
  document.getElementById('title').value = event.title || '';
  document.getElementById('location').value = event.location || '';
  document.getElementById('notes').value = event.notes || '';
  
  document.getElementById('cancelBtn').style.display = 'inline-block';
  document.getElementById('saveBtn').textContent = '💾 Guardar';
  
  const formBox = document.getElementById('formBox');
  if (formBox) formBox.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Resetear formulario
 */
function resetForm() {
  editingId = null;
  document.getElementById('formTitle').textContent = 'Añadir evento';
  document.getElementById('eventType').value = '';
  document.getElementById('eventDate').value = '';
  document.getElementById('startTime').value = '';
  document.getElementById('endTime').value = '';
  document.getElementById('title').value = '';
  document.getElementById('location').value = '';
  document.getElementById('notes').value = '';
  document.getElementById('cancelBtn').style.display = 'none';
  document.getElementById('saveBtn').textContent = '➕ Añadir';
}

/**
 * Guardar evento
 */
async function saveEvent(e) {
  e.preventDefault();

  if (!canManage) {
    alert('No tienes permiso para gestionar eventos');
    return;
  }

  const type = document.getElementById('eventType').value;
  const eventDate = document.getElementById('eventDate').value;
  const startTime = document.getElementById('startTime').value || null;
  const endTime = document.getElementById('endTime').value || null;
  const title = document.getElementById('title').value.trim();
  const location = document.getElementById('location').value.trim();
  const notes = document.getElementById('notes').value.trim();

  if (!type) {
    alert('Selecciona un tipo de evento');
    return;
  }

  if (!eventDate) {
    alert('Indica la fecha del evento');
    return;
  }

  if (startTime && endTime && startTime >= endTime) {
    alert('La hora de inicio debe ser anterior a la hora de fin');
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

  try {
    if (editingId) {
      const { error } = await supabase
        .from('team_events')
        .update(eventData)
        .eq('id', editingId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('team_events')
        .insert(eventData);
      if (error) throw error;
    }

    resetForm();
    await loadEvents();
  } catch (error) {
    console.error('Error saving event:', error);
    alert(`Error: ${error.message}`);
  }
}

/**
 * Eliminar evento
 */
async function deleteEvent(eventId) {
  if (!confirm('¿Eliminar este evento?')) return;

  try {
    const { error } = await supabase
      .from('team_events')
      .delete()
      .eq('id', eventId);

    if (error) throw error;
    await loadEvents();
  } catch (error) {
    console.error('Error deleting event:', error);
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

// Event listeners
document.getElementById('saveBtn')?.addEventListener('click', saveEvent);
document.getElementById('cancelBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  resetForm();
});

document.getElementById('typeFilter')?.addEventListener('change', renderEvents);
document.getElementById('refreshBtn')?.addEventListener('click', loadEvents);

// Cargar inicial
loadEvents();
