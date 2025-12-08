// attendance.js - Sistema de asistencia con generación lazy
import { supabase } from '../js/supabaseClient.js';
import { 
  initPermissions, 
  hasPermission, 
  getUserRole,
  getRoleLabel 
} from '../js/permissionsHelper.js';
import { initHeader } from '../js/headerComponent.js';

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
  window.location.href = '/pages/dashboard.html';
  throw new Error('Missing team_id');
}

// Inicializar header
initHeader('📋 Asistencia', true);

// Inicializar permisos
await initPermissions();

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
      .eq('weekday', dayOfWeek);

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
      .order('number');

    console.log('Jugadores cargados:', players);
    console.log('Error jugadores:', playersError);

    if (playersError) throw playersError;

    activePlayers = players || [];

    if (activePlayers.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No hay jugadores activos en el equipo</p></div>';
      document.getElementById('actionsBar').style.display = 'none';
      return;
    }

    // 6. Cargar registros de asistencia existentes (primero verificar estructura)
    const { data: existingAttendance, error: attendanceError } = await supabase
      .from('attendance')
      .select('*')
      .eq('team_id', teamId)
      .eq('date', selectedDate)
      .limit(1);

    if (attendanceError) throw attendanceError;

    // Si hay registros, cargar todos
    if (existingAttendance && existingAttendance.length > 0) {
      const { data: allAttendance, error: allError } = await supabase
        .from('attendance')
        .select('*')
        .eq('team_id', teamId)
        .eq('date', selectedDate);

      if (allError) throw allError;
      attendanceRecords = allAttendance || [];
      renderAttendanceList();
    } else {
      // 7. Si no hay registros, generar lazy
      generateLazyAttendance();
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
    status: 'PRESENT',
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

  // Combinar registros con datos de jugadores
  const recordsWithPlayers = attendanceRecords.map(record => {
    const playerData = record._playerData || activePlayers.find(p => p.id === record.player_id);
    return { ...record, _playerData: playerData };
  });

  // Crear tabla
  const table = document.createElement('table');
  table.className = 'attendance-table';
  
  table.innerHTML = `
    <thead>
      <tr>
        <th>Jugador</th>
        <th>Estado</th>
        <th>Notas</th>
      </tr>
    </thead>
    <tbody id="attendanceTableBody"></tbody>
  `;

  const tbody = table.querySelector('#attendanceTableBody');

  recordsWithPlayers.forEach(record => {
    const row = createAttendanceRow(record);
    tbody.appendChild(row);
  });

  container.appendChild(table);

  // Mostrar barra de acciones
  document.getElementById('actionsBar').style.display = 'flex';
  
  // Mostrar resumen
  updateSummary();
}

/**
 * Crear fila de asistencia
 */
function createAttendanceRow(record) {
  const player = record._playerData;
  if (!player) return document.createElement('tr');

  const row = document.createElement('tr');

  // Aplicar cambios pendientes si existen
  const pending = pendingChanges.get(player.id);
  const displayStatus = pending?.status || record.status;
  const displayNotes = pending?.notes !== undefined ? pending.notes : record.notes;

  row.innerHTML = `
    <td data-label="Jugador">
      <div class="player-info">
        <div class="player-number">${player.number || '?'}</div>
        <div class="player-name">${escapeHtml(player.name)}</div>
      </div>
    </td>
    <td data-label="Estado">
      <div class="status-buttons">
        <button class="status-btn ${displayStatus === 'PRESENT' ? 'active present' : ''}" 
                data-player-id="${player.id}" data-status="PRESENT">
          ✅ Presente
        </button>
        <button class="status-btn ${displayStatus === 'ABSENT' ? 'active absent' : ''}" 
                data-player-id="${player.id}" data-status="ABSENT">
          ❌ Ausente
        </button>
        <button class="status-btn ${displayStatus === 'LATE' ? 'active late' : ''}" 
                data-player-id="${player.id}" data-status="LATE">
          ⏰ Tarde
        </button>
        <button class="status-btn ${displayStatus === 'EXCUSED' ? 'active excused' : ''}" 
                data-player-id="${player.id}" data-status="EXCUSED">
          📝 Justif.
        </button>
      </div>
    </td>
    <td data-label="Notas">
      <input type="text" class="notes-input" 
             data-player-id="${player.id}"
             placeholder="Añadir nota..."
             value="${escapeHtml(displayNotes || '')}">
    </td>
  `;

  // Eventos
  row.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const playerId = btn.dataset.playerId;
      const status = btn.dataset.status;
      handleStatusChange(playerId, status);
    });
  });

  row.querySelector('.notes-input').addEventListener('input', (e) => {
    const playerId = e.target.dataset.playerId;
    const notes = e.target.value;
    handleNotesChange(playerId, notes);
  });

  return row;
}

/**
 * Manejar cambio de estado
 */
function handleStatusChange(playerId, status) {
  const existing = pendingChanges.get(playerId) || {};
  pendingChanges.set(playerId, { ...existing, status });
  renderAttendanceList();
}

/**
 * Manejar cambio de notas
 */
function handleNotesChange(playerId, notes) {
  const existing = pendingChanges.get(playerId) || {};
  pendingChanges.set(playerId, { ...existing, notes: notes.trim() || null });
}

/**
 * Actualizar resumen de asistencia
 */
function updateSummary() {
  const summary = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
  
  attendanceRecords.forEach(record => {
    const pending = pendingChanges.get(record.player_id);
    const status = pending?.status || record.status;
    if (summary[status] !== undefined) {
      summary[status]++;
    }
  });

  const summaryContainer = document.getElementById('attendanceSummary');
  summaryContainer.innerHTML = `
    <div class="attendance-summary">
      <div class="summary-item">
        <span class="summary-number present">${summary.PRESENT}</span>
        <span class="summary-label">Presentes</span>
      </div>
      <div class="summary-item">
        <span class="summary-number absent">${summary.ABSENT}</span>
        <span class="summary-label">Ausentes</span>
      </div>
      <div class="summary-item">
        <span class="summary-number late">${summary.LATE}</span>
        <span class="summary-label">Tarde</span>
      </div>
      <div class="summary-item">
        <span class="summary-number excused">${summary.EXCUSED}</span>
        <span class="summary-label">Justificados</span>
      </div>
    </div>
  `;
  summaryContainer.style.display = 'block';
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
      
      const baseRecord = {
        team_id: teamId,
        player_id: record.player_id,
        date: currentDate,
        session_id: currentSession?.id || null,
        event_id: currentEvent?.id || null,
        status: pending?.status || record.status,
        notes: pending?.notes !== undefined ? pending.notes : record.notes
      };
      
      // Solo incluir id si existe (para updates)
      if (record.id) {
        baseRecord.id = record.id;
      }
      
      return baseRecord;
    });

    const { data, error } = await supabase
      .from('attendance')
      .upsert(recordsToUpsert, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      })
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
    badge.textContent = `⚽ Entrenamiento - ${weekdays[currentSession.weekday]}`;
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
