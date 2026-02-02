// attendance.js - Sistema de asistencia con generación lazy
import { supabase } from './supabaseClient.js';
import { 
  initPermissions, 
  hasPermission, 
  getUserRole,
  getRoleLabel 
} from './permissionsHelper.js';
import { initHeader } from './headerComponent.js';
import { requireSession, requireTeamId } from './utils/supabaseHelpers.js';
import { escapeHtml, showError } from './utils/domHelpers.js';

// Variables globales
let teamId = null;
let canManage = false;
let activePlayers = [];

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

// ============================================
// GESTOR DE SESIONES Y EVENTOS
// ============================================
class SessionEventManager {
  constructor(teamId) {
    this.teamId = teamId;
    this.currentSession = null;
    this.currentEvent = null;
  }

  async loadForDate(date) {
    const dayOfWeek = new Date(date).getDay();

    // Buscar sesión de entrenamiento
    const { data: sessions, error: sessionsError } = await supabase
      .from('team_training_sessions')
      .select('*')
      .eq('team_id', this.teamId)
      .eq('weekday', dayOfWeek);

    if (sessionsError) throw sessionsError;
    this.currentSession = sessions && sessions.length > 0 ? sessions[0] : null;

    // Buscar evento específico
    const { data: events, error: eventsError } = await supabase
      .from('team_events')
      .select('*')
      .eq('team_id', this.teamId)
      .eq('event_date', date);

    if (eventsError) throw eventsError;
    this.currentEvent = events && events.length > 0 ? events[0] : null;

    return { session: this.currentSession, event: this.currentEvent };
  }

  hasActivity() {
    return this.currentSession || this.currentEvent;
  }

  displayInfo() {
    const infoBox = document.getElementById('sessionInfo');
    const badge = document.getElementById('sessionTypeBadge');
    const details = document.getElementById('sessionDetails');

    if (this.currentEvent) {
      this.displayEventInfo(badge, details);
    } else if (this.currentSession) {
      this.displaySessionInfo(badge, details);
    }

    infoBox.style.display = 'flex';
  }

  displayEventInfo(badge, details) {
    const eventTypes = {
      'MATCH': '⚽ Partido oficial',
      'FRIENDLY': '🤝 Amistoso',
      'TOURNAMENT': '🏆 Torneo',
      'TRAINING': '⚽ Entrenamiento',
      'MEETING': '👥 Reunión',
      'OTHER': '📌 Otro'
    };
    
    badge.textContent = eventTypes[this.currentEvent.type] || this.currentEvent.type;
    badge.className = 'session-type-badge event-badge';
    
    let detailsHtml = '';
    if (this.currentEvent.title) detailsHtml += `<strong>${escapeHtml(this.currentEvent.title)}</strong><br>`;
    if (this.currentEvent.start_time) {
      const end = this.currentEvent.end_time ? ` - ${this.currentEvent.end_time.substring(0, 5)}` : '';
      detailsHtml += `🕐 ${this.currentEvent.start_time.substring(0, 5)}${end}<br>`;
    }
    if (this.currentEvent.location) detailsHtml += `📍 ${escapeHtml(this.currentEvent.location)}`;
    
    details.innerHTML = detailsHtml;
  }

  displaySessionInfo(badge, details) {
    const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    badge.textContent = `⚽ Entrenamiento - ${weekdays[this.currentSession.weekday]}`;
    badge.className = 'session-type-badge training-badge';
    
    let detailsHtml = '';
    if (this.currentSession.start_time) {
      const end = this.currentSession.end_time ? ` - ${this.currentSession.end_time.substring(0, 5)}` : '';
      detailsHtml += `🕐 ${this.currentSession.start_time.substring(0, 5)}${end}<br>`;
    }
    if (this.currentSession.location) detailsHtml += `📍 ${escapeHtml(this.currentSession.location)}`;
    
    details.innerHTML = detailsHtml;
  }
}

// ============================================
// GESTOR DE REGISTROS DE ASISTENCIA
// ============================================
class AttendanceRecordsManager {
  constructor(teamId) {
    this.teamId = teamId;
    this.records = [];
    this.pendingChanges = new Map();
  }

  async loadForDate(date, sessionEventManager) {
    // Cargar registros existentes
    const { data: existingAttendance, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('team_id', this.teamId)
      .eq('date', date);

    if (error) throw error;

    if (existingAttendance && existingAttendance.length > 0) {
      // Combinar con datos de jugadores
      const attendanceMap = new Map(existingAttendance.map(a => [a.player_id, a]));
      
      this.records = activePlayers.map(player => {
        const existingRecord = attendanceMap.get(player.id);
        if (existingRecord) {
          return { ...existingRecord, _playerData: player };
        } else {
          return this.createNewRecord(player, date, sessionEventManager);
        }
      });
    } else {
      // Generar registros lazy
      this.generateLazy(date, sessionEventManager);
    }

    return this.records;
  }

  generateLazy(date, sessionEventManager) {
    this.records = activePlayers.map(player => 
      this.createNewRecord(player, date, sessionEventManager)
    );
  }

  createNewRecord(player, date, sessionEventManager) {
    return {
      id: null,
      team_id: this.teamId,
      player_id: player.id,
      date: date,
      session_id: sessionEventManager.currentSession?.id || null,
      event_id: sessionEventManager.currentEvent?.id || null,
      status: 'PRESENT',
      notes: null,
      _isNew: true,
      _playerData: player
    };
  }

  updateStatus(playerId, status) {
    const existing = this.pendingChanges.get(playerId) || {};
    this.pendingChanges.set(playerId, { ...existing, status });
  }

  updateNotes(playerId, notes) {
    const existing = this.pendingChanges.get(playerId) || {};
    this.pendingChanges.set(playerId, { ...existing, notes: notes.trim() || null });
  }

  markAll(status) {
    activePlayers.forEach(player => {
      const existing = this.pendingChanges.get(player.id) || {};
      this.pendingChanges.set(player.id, { ...existing, status });
    });
  }

  getStatus(playerId) {
    const record = this.records.find(r => r.player_id === playerId);
    const pending = this.pendingChanges.get(playerId);
    return pending?.status || record?.status || 'PRESENT';
  }

  getNotes(playerId) {
    const record = this.records.find(r => r.player_id === playerId);
    const pending = this.pendingChanges.get(playerId);
    return pending?.notes !== undefined ? pending.notes : record?.notes;
  }

  getSummary() {
    const summary = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    
    this.records.forEach(record => {
      const status = this.getStatus(record.player_id);
      if (summary[status] !== undefined) {
        summary[status]++;
      }
    });

    return summary;
  }

  async save(date, sessionEventManager) {
    const recordsToUpsert = this.records.map(record => {
      const pending = this.pendingChanges.get(record.player_id);
      
      const baseRecord = {
        team_id: this.teamId,
        player_id: record.player_id,
        date: date,
        session_id: sessionEventManager.currentSession?.id || null,
        event_id: sessionEventManager.currentEvent?.id || null,
        status: pending?.status || record.status,
        notes: pending?.notes !== undefined ? pending.notes : record.notes
      };
      
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
    this.records = data.map(record => ({
      ...record,
      _isNew: false,
      _playerData: activePlayers.find(p => p.id === record.player_id)
    }));

    this.pendingChanges.clear();
    return this.records;
  }
}

// ============================================
// RENDERIZADOR DE ASISTENCIA
// ============================================
class AttendanceRenderer {
  constructor(recordsManager) {
    this.recordsManager = recordsManager;
    this.container = document.getElementById('attendanceList');
    this.summaryContainer = document.getElementById('attendanceSummary');
    this.actionsBar = document.getElementById('actionsBar');
  }

  render() {
    this.container.innerHTML = '';

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

    this.recordsManager.records.forEach(record => {
      const row = this.createRow(record);
      tbody.appendChild(row);
    });

    this.container.appendChild(table);
    this.actionsBar.style.display = 'flex';
    this.renderSummary();
  }

  createRow(record) {
    const player = record._playerData;
    if (!player) return document.createElement('tr');

    const row = document.createElement('tr');
    const displayStatus = this.recordsManager.getStatus(player.id);
    const displayNotes = this.recordsManager.getNotes(player.id);

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
               value="${escapeHtml(displayNotes || '')}"
               ${!canManage ? 'disabled' : ''}>
      </td>
    `;

    // Eventos
    row.querySelectorAll('.status-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!canManage) return;
        this.recordsManager.updateStatus(btn.dataset.playerId, btn.dataset.status);
        this.render();
      });
    });

    row.querySelector('.notes-input').addEventListener('input', (e) => {
      if (!canManage) return;
      this.recordsManager.updateNotes(e.target.dataset.playerId, e.target.value);
    });

    return row;
  }

  renderSummary() {
    const summary = this.recordsManager.getSummary();

    this.summaryContainer.innerHTML = `
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
    this.summaryContainer.style.display = 'block';
  }

  showNoSession() {
    this.container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📅</div>
        <p>No hay entrenamiento ni evento programado para esta fecha</p>
        <p class="empty-hint">Configura entrenamientos semanales o crea eventos específicos primero</p>
      </div>
    `;
    
    document.getElementById('sessionInfo').style.display = 'none';
    this.actionsBar.style.display = 'none';
  }

  showNoPlayers() {
    this.container.innerHTML = '<div class="empty-state"><p>No hay jugadores activos en el equipo</p></div>';
    this.actionsBar.style.display = 'none';
  }

  showLoading() {
    this.container.innerHTML = '<div class="loading">Cargando...</div>';
  }

  showError(message) {
    this.container.innerHTML = `<div class="error-state">Error: ${message}</div>`;
  }
}

// ============================================
// CONTROLADOR PRINCIPAL
// ============================================
class AttendanceController {
  constructor(teamId) {
    this.teamId = teamId;
    this.currentDate = null;
    this.sessionEventManager = new SessionEventManager(teamId);
    this.recordsManager = new AttendanceRecordsManager(teamId);
    this.renderer = new AttendanceRenderer(this.recordsManager);
  }

  async loadForDate(date) {
    this.currentDate = date;
    this.renderer.showLoading();

    try {
      // Cargar sesión/evento
      await this.sessionEventManager.loadForDate(date);

      if (!this.sessionEventManager.hasActivity()) {
        this.renderer.showNoSession();
        return;
      }

      this.sessionEventManager.displayInfo();

      // Cargar jugadores activos
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', this.teamId)
        .eq('active', true);

      if (playersError) throw playersError;
      activePlayers = sortPlayersByNumber(players);

      if (activePlayers.length === 0) {
        this.renderer.showNoPlayers();
        return;
      }

      // Cargar/generar registros
      await this.recordsManager.loadForDate(date, this.sessionEventManager);
      this.renderer.render();
      
      // Ocultar controles de edición si no hay permisos
      if (!canManage) {
        const saveBtn = document.getElementById('saveAllBtn');
        const markAllPresentBtn = document.getElementById('markAllPresentBtn');
        const markAllAbsentBtn = document.getElementById('markAllAbsentBtn');
        
        if (saveBtn) saveBtn.style.display = 'none';
        if (markAllPresentBtn) markAllPresentBtn.style.display = 'none';
        if (markAllAbsentBtn) markAllAbsentBtn.style.display = 'none';
        
        // Deshabilitar todos los botones de estado
        document.querySelectorAll('.status-btn').forEach(btn => {
          btn.disabled = true;
          btn.style.cursor = 'not-allowed';
          btn.style.opacity = '0.6';
        });
      }

    } catch (error) {
      console.error('Error loading attendance:', error);
      this.renderer.showError(error.message);
    }
  }

  async save() {
    if (!canManage) {
      alert('No tienes permiso para gestionar asistencia');
      return;
    }

    if (this.recordsManager.records.length === 0) {
      alert('No hay registros para guardar');
      return;
    }

    const saveBtn = document.getElementById('saveAllBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = '💾 Guardando...';

    try {
      await this.recordsManager.save(this.currentDate, this.sessionEventManager);
      this.renderer.render();
      alert('✅ Asistencia guardada correctamente');
    } catch (error) {
      console.error('Error saving attendance:', error);
      alert(`Error al guardar: ${error.message}`);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Guardar todos los cambios';
    }
  }

  markAllPresent() {
    this.recordsManager.markAll('PRESENT');
    this.renderer.render();
  }

  markAllAbsent() {
    this.recordsManager.markAll('ABSENT');
    this.renderer.render();
  }
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Verificar sesión
    await requireSession();
    
    // Obtener team_id
    const params = new URLSearchParams(window.location.search);
    teamId = params.get('team_id');

    if (!teamId) {
      throw new Error('Falta team_id');
    }

    // Inicializar header
    await initHeader({
      title: '📋 Asistencia',
      backUrl: true,
      activeNav: null
    });

    // Inicializar permisos
    await initPermissions();
    canManage = await hasPermission(teamId, 'MANAGE_ATTENDANCE');
    const userRole = await getUserRole(teamId);

    if (!canManage) {
      console.log(`Modo solo lectura - No tienes permiso para gestionar asistencia. Tu rol: ${getRoleLabel(userRole)}`);
    }

    // Crear controlador
    const controller = new AttendanceController(teamId);

    // Establecer fecha de hoy por defecto (zona horaria local)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayString = `${year}-${month}-${day}`;
    
    const dateInput = document.getElementById('selectedDate');
    if (dateInput) {
      dateInput.value = todayString;
    }

    // Event listeners
    document.getElementById('loadBtn')?.addEventListener('click', () => {
      const dateInput = document.getElementById('selectedDate');
      const selectedDate = dateInput.value;
      
      if (!selectedDate) {
        alert('Selecciona una fecha');
        return;
      }
      
      controller.loadForDate(selectedDate);
    });

    document.getElementById('saveAllBtn')?.addEventListener('click', () => controller.save());
    document.getElementById('markAllPresentBtn')?.addEventListener('click', () => controller.markAllPresent());
    document.getElementById('markAllAbsentBtn')?.addEventListener('click', () => controller.markAllAbsent());

    // Recargar cuando la página vuelve a estar visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && controller.currentDate) {
        controller.loadForDate(controller.currentDate);
      }
    });

  } catch (error) {
    console.error('Error en inicialización:', error);
    alert(error.message);
    window.location.href = '/pages/dashboard.html';
  }
});
