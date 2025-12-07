// attendance.js - Sistema de asistencia con generación lazy
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

// Inicializar permisos
await initPermissions();

// Obtener team_id
const params = new URLSearchParams(window.location.search);
const teamId = params.get('team_id');

if (!teamId) {
  document.getElementById('errorMsg').style.display = 'block';
  document.getElementById('errorMsg').innerText = 'Error: falta team_id';
  throw new Error('Missing team_id');
}

// Verificar permisos
const canManage = await hasPermission(teamId, 'MANAGE_ATTENDANCE');
const userRole = await getUserRole(teamId);

if (!canManage) {
  document.getElementById('errorMsg').style.display = 'block';
  document.getElementById('errorMsg').innerText = `No tienes permiso para gestionar asistencia. Tu rol: ${getRoleLabel(userRole)}`;
}

// Estado
let currentDate = null;
let currentSession = null;
let currentEvent = null;
let attendanceRecords = [];
let activePlayers = [];
let pendingChanges = new Map(); // player_id -> { status, notes }

/**
 * Cargar asistencia para una fecha
 */
async function loadAttendanceForDate() {
  const dateInput = document.getElementById('selectedDate');
  const selectedDate = dateInput.value;

  if (!selectedDate) {
    alert('Selecciona una fecha');
    return;
  }

  currentDate = selectedDate;
  const dayOfWeek = new Date(selectedDate).getDay();

  const container = document.getElementById('attendanceList');
  container.innerHTML = '<div class="loading">Cargando...</div>';

  try {
    // 1. Buscar sesión de entrenamiento para ese día de la semana
    const { data: sessions, error: sessionsError } = await supabase
      .from('team_training_sessions')
      .select('*')
      .eq('team_id', teamId)
      .eq('day_of_week', dayOfWeek);

    if (sessionsError) throw sessionsError;

    currentSession = sessions && sessions.length > 0 ? sessions[0] : null;

    // 2. Buscar evento específico para esa fecha
    const { data: events, error: eventsError } = await supabase
      .from('team_events')
      .select('*')
      .eq('team_id', teamId)
      .eq('event_date', selectedDate);

    if (eventsError) throw eventsError;

    currentEvent = events && events.length > 0 ? events[0] : null;

    // 3. Si no hay sesión ni evento, mostrar mensaje
    if (!currentSession && !currentEvent) {
      showNoSessionMessage();
      return;
    }

    // 4. Mostrar info de la sesión/evento
    displaySessionInfo();

    // 5. Cargar jugadores activos
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', teamId)
      .eq('active', true)
      .order('dorsal');

    if (playersError) throw playersError;

    activePlayers = players || [];

    if (activePlayers.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No hay jugadores activos en el equipo</p></div>';
      return;
    }

    // 6. Cargar registros de asistencia existentes
    const { data: existingAttendance, error: attendanceError } = await supabase
      .from('attendance')
      .select('*')
      .eq('team_id', teamId)
      .eq('date', selectedDate);

    if (attendanceError) throw attendanceError;

    attendanceRecords = existingAttendance || [];

    // 7. Si no hay registros, generar lazy (solo renderizar vacío)
    if (attendanceRecords.length === 0) {
      generateLazyAttendance();
    } else {
      renderAttendanceList();
    }

  } catch (error) {
    console.error('Error loading attendance:', error);
    container.innerHTML = `<div class="error-state">Error: ${error.message}</div>`;
  }
}

/**
 * Generar pase de lista lazy (sin insertar en BD hasta guardar)
 */
function generateLazyAttendance() {
  attendanceRecords = activePlayers.map(player => ({
    id: null, // No existe en BD todavía
    team_id: teamId,
    player_id: player.id,
    date: currentDate,
    session_id: currentSession?.id || null,
    event_id: currentEvent?.id || null,
    status: 'PENDING',
    notes: null,
    _isNew: true,
    _playerData: player
  }));

  renderAttendanceList();
}

/**
 * Renderizar lista de asistencia
 */
function renderAttendanceList() {
  const container = document.getElementById('attendanceList');
  container.innerHTML = '';

  const attendanceGrid = document.createElement('div');
  attendanceGrid.className = 'attendance-grid';

  // Combinar registros con datos de jugadores
  const recordsWithPlayers = attendanceRecords.map(record => {
    const playerData = record._playerData || activePlayers.find(p => p.id === record.player_id);
    return { ...record, _playerData: playerData };
  });

  recordsWithPlayers.forEach(record => {
    const card = createAttendanceCard(record);
    attendanceGrid.appendChild(card);
  });

  container.appendChild(attendanceGrid);

  // Mostrar barra de acciones
  document.getElementById('actionsBar').style.display = 'flex';
}

/**
 * Crear card de asistencia
 */
function createAttendanceCard(record) {
  const player = record._playerData;
  if (!player) return document.createElement('div');

  const card = document.createElement('div');
  card.className = 'attendance-card fade-in';

  // Aplicar cambios pendientes si existen
  const pending = pendingChanges.get(player.id);
  const displayStatus = pending?.status || record.status;
  const displayNotes = pending?.notes !== undefined ? pending.notes : record.notes;

  let statusClass = 'status-pending';
  let statusIcon = '⏳';
  let statusText = 'Pendiente';

  if (displayStatus === 'PRESENT') {
    statusClass = 'status-present';
    statusIcon = '✅';
    statusText = 'Presente';
  } else if (displayStatus === 'ABSENT') {
    statusClass = 'status-absent';
    statusIcon = '❌';
    statusText = 'Ausente';
  } else if (displayStatus === 'EXCUSED') {
    statusClass = 'status-excused';
    statusIcon = '📝';
    statusText = 'Justificado';
  }

  card.innerHTML = `
    <div class="attendance-player-info">
      <div class="attendance-dorsal">#${player.dorsal || '?'}</div>
      <div class="attendance-player-name">
        <div class="player-full-name">${escapeHtml(player.name)} ${escapeHtml(player.surname)}</div>
        ${player.position ? `<div class="player-position-tag">${escapeHtml(player.position)}</div>` : ''}
      </div>
    </div>
    
    <div class="attendance-status-section">
      <div class="attendance-status-badge ${statusClass}">
        ${statusIcon} ${statusText}
      </div>
      
      <div class="attendance-status-buttons" id="buttons-${player.id}">
        <button class="status-btn status-present-btn" data-status="PRESENT" title="Presente">✅</button>
        <button class="status-btn status-absent-btn" data-status="ABSENT" title="Ausente">❌</button>
        <button class="status-btn status-excused-btn" data-status="EXCUSED" title="Justificado">📝</button>
      </div>
      
      <div class="attendance-notes-section">
        <textarea 
          class="attendance-notes-input" 
          id="notes-${player.id}"
          placeholder="Observaciones (opcional)"
          rows="2"
        >${escapeHtml(displayNotes || '')}</textarea>
      </div>
    </div>
  `;

  // Event listeners para botones de estado
  const buttonsContainer = card.querySelector(`#buttons-${player.id}`);
  buttonsContainer.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const newStatus = btn.dataset.status;
      updateAttendanceStatus(player.id, newStatus);
    });
  });

  // Event listener para notas
  const notesInput = card.querySelector(`#notes-${player.id}`);
  notesInput.addEventListener('change', () => {
    updateAttendanceNotes(player.id, notesInput.value.trim() || null);
  });

  return card;
}

/**
 * Actualizar estado de asistencia (en memoria)
 */
function updateAttendanceStatus(playerId, status) {
  const existing = pendingChanges.get(playerId) || {};
  pendingChanges.set(playerId, { ...existing, status });
  renderAttendanceList();
}

/**
 * Actualizar notas de asistencia (en memoria)
 */
function updateAttendanceNotes(playerId, notes) {
  const existing = pendingChanges.get(playerId) || {};
  pendingChanges.set(playerId, { ...existing, notes });
}

/**
 * Guardar todos los cambios
 */
async function saveAllChanges() {
  if (!canManage) {
    alert('No tienes permiso para gestionar asistencia');
    return;
  }

  if (attendanceRecords.length === 0) {
    alert('No hay registros para guardar');
    return;
  }

  const saveBtn = document.getElementById('saveAllBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = '💾 Guardando...';

  try {
    const recordsToUpsert = attendanceRecords.map(record => {
      const pending = pendingChanges.get(record.player_id);
      
      return {
        id: record.id || undefined, // undefined para nuevos registros
        team_id: teamId,
        player_id: record.player_id,
        date: currentDate,
        session_id: currentSession?.id || null,
        event_id: currentEvent?.id || null,
        status: pending?.status || record.status,
        notes: pending?.notes !== undefined ? pending.notes : record.notes
      };
    });

    const { data, error } = await supabase
      .from('attendance')
      .upsert(recordsToUpsert, { onConflict: 'id' })
      .select();

    if (error) throw error;

    // Actualizar registros con IDs generados
    attendanceRecords = data.map(record => ({
      ...record,
      _isNew: false,
      _playerData: activePlayers.find(p => p.id === record.player_id)
    }));

    pendingChanges.clear();
    renderAttendanceList();

    alert('✅ Asistencia guardada correctamente');

  } catch (error) {
    console.error('Error saving attendance:', error);
    alert(`Error al guardar: ${error.message}`);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 Guardar todos los cambios';
  }
}

/**
 * Marcar todos como presentes
 */
function markAllPresent() {
  activePlayers.forEach(player => {
    const existing = pendingChanges.get(player.id) || {};
    pendingChanges.set(player.id, { ...existing, status: 'PRESENT' });
  });
  renderAttendanceList();
}

/**
 * Marcar todos como ausentes
 */
function markAllAbsent() {
  activePlayers.forEach(player => {
    const existing = pendingChanges.get(player.id) || {};
    pendingChanges.set(player.id, { ...existing, status: 'ABSENT' });
  });
  renderAttendanceList();
}

/**
 * Mostrar info de sesión/evento
 */
function displaySessionInfo() {
  const infoBox = document.getElementById('sessionInfo');
  const badge = document.getElementById('sessionTypeBadge');
  const details = document.getElementById('sessionDetails');

  if (currentEvent) {
    const eventTypes = {
      'MATCH': '⚽ Partido oficial',
      'FRIENDLY': '🤝 Amistoso',
      'TOURNAMENT': '🏆 Torneo',
      'TRAINING': '⚽ Entrenamiento',
      'MEETING': '👥 Reunión',
      'OTHER': '📌 Otro'
    };
    badge.textContent = eventTypes[currentEvent.type] || currentEvent.type;
    badge.className = 'session-type-badge event-badge';
    
    let detailsHtml = '';
    if (currentEvent.title) detailsHtml += `<strong>${escapeHtml(currentEvent.title)}</strong><br>`;
    if (currentEvent.start_time) {
      const end = currentEvent.end_time ? ` - ${currentEvent.end_time.substring(0, 5)}` : '';
      detailsHtml += `🕐 ${currentEvent.start_time.substring(0, 5)}${end}<br>`;
    }
    if (currentEvent.location) detailsHtml += `📍 ${escapeHtml(currentEvent.location)}`;
    
    details.innerHTML = detailsHtml;
  } else if (currentSession) {
    const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    badge.textContent = `⚽ Entrenamiento - ${weekdays[currentSession.day_of_week]}`;
    badge.className = 'session-type-badge training-badge';
    
    let detailsHtml = '';
    if (currentSession.start_time) {
      const end = currentSession.end_time ? ` - ${currentSession.end_time.substring(0, 5)}` : '';
      detailsHtml += `🕐 ${currentSession.start_time.substring(0, 5)}${end}<br>`;
    }
    if (currentSession.location) detailsHtml += `📍 ${escapeHtml(currentSession.location)}`;
    
    details.innerHTML = detailsHtml;
  }

  infoBox.style.display = 'flex';
}

/**
 * Mostrar mensaje cuando no hay sesión ni evento
 */
function showNoSessionMessage() {
  const container = document.getElementById('attendanceList');
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">📅</div>
      <p>No hay entrenamiento ni evento programado para esta fecha</p>
      <p class="empty-hint">Configura entrenamientos semanales o crea eventos específicos primero</p>
    </div>
  `;
  
  document.getElementById('sessionInfo').style.display = 'none';
  document.getElementById('actionsBar').style.display = 'none';
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
document.getElementById('loadBtn')?.addEventListener('click', loadAttendanceForDate);
document.getElementById('saveAllBtn')?.addEventListener('click', saveAllChanges);
document.getElementById('markAllPresentBtn')?.addEventListener('click', markAllPresent);
document.getElementById('markAllAbsentBtn')?.addEventListener('click', markAllAbsent);

// Establecer fecha de hoy por defecto
const today = new Date().toISOString().split('T')[0];
document.getElementById('selectedDate').value = today;
