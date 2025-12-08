// Importar dependencias
import { supabase } from './supabaseClient.js';
import { initHeader } from './headerComponent.js';

// Variables globales
let currentTeamId = null;
let allAttendance = [];
let allPlayers = [];

// Inicializar página
document.addEventListener('DOMContentLoaded', async () => {
  // Obtener team_id de la URL
  const urlParams = new URLSearchParams(window.location.search);
  currentTeamId = urlParams.get('team_id');

  if (!currentTeamId) {
    alert('No se especificó el equipo');
    window.location.href = '/pages/teams.html';
    return;
  }

  // Inicializar header
  await initHeader({
    title: '📊 Estadísticas',
    backUrl: true,
    activeNav: null
  });

  // Cargar datos iniciales
  await loadData();
  
  // Configurar filtros
  setupFilters();
  
  // Cargar estadísticas por defecto (semana)
  await loadStatistics('week');
});

// Cargar datos del equipo
async function loadData() {
  try {
    console.log('Cargando datos para team_id:', currentTeamId);
    
    // Cargar jugadores - usando el mismo formato que players.js
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('id, name, number, position')
      .eq('team_id', currentTeamId)
      .eq('active', true);

    if (playersError) {
      console.error('Error en query de jugadores:', playersError);
      throw playersError;
    }
    
    allPlayers = (players || []).sort((a, b) => (a.number || 999) - (b.number || 999));
    console.log('Jugadores cargados:', allPlayers.length, allPlayers);

    // Cargar toda la asistencia del equipo
    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance')
      .select('*')
      .eq('team_id', currentTeamId);

    if (attendanceError) {
      console.error('Error en query de asistencia:', attendanceError);
      throw attendanceError;
    }
    
    allAttendance = attendance || [];
    console.log('Registros de asistencia cargados:', allAttendance.length);

  } catch (error) {
    console.error('Error cargando datos:', error);
    showError('Error al cargar los datos del equipo');
  }
}

// Configurar eventos de filtros
function setupFilters() {
  const periodFilter = document.getElementById('periodFilter');
  const customDatesGroup = document.getElementById('customDatesGroup');
  const customDatesGroupEnd = document.getElementById('customDatesGroupEnd');
  const applyFiltersBtn = document.getElementById('applyFiltersBtn');

  // Mostrar/ocultar fechas personalizadas
  periodFilter.addEventListener('change', (e) => {
    if (e.target.value === 'custom') {
      customDatesGroup.style.display = 'flex';
      customDatesGroupEnd.style.display = 'flex';
      applyFiltersBtn.style.display = 'block';
    } else {
      customDatesGroup.style.display = 'none';
      customDatesGroupEnd.style.display = 'none';
      applyFiltersBtn.style.display = 'none';
      // Cargar estadísticas automáticamente
      loadStatistics(e.target.value);
    }
  });

  // Aplicar filtros personalizados
  applyFiltersBtn.addEventListener('click', () => {
    const period = periodFilter.value;
    if (period === 'custom') {
      const startDate = document.getElementById('startDate').value;
      const endDate = document.getElementById('endDate').value;
      
      if (!startDate || !endDate) {
        alert('Por favor, selecciona ambas fechas');
        return;
      }
      
      if (new Date(startDate) > new Date(endDate)) {
        alert('La fecha inicial debe ser anterior a la fecha final');
        return;
      }
      
      loadStatistics('custom', startDate, endDate);
    } else {
      loadStatistics(period);
    }
  });
}

// Cargar estadísticas según el período
async function loadStatistics(period, customStart = null, customEnd = null) {
  try {
    // Filtrar asistencia según el período
    const filteredAttendance = filterAttendanceByPeriod(allAttendance, period, customStart, customEnd);
    
    console.log('Registros filtrados:', filteredAttendance.length);

    // Calcular estadísticas globales
    calculateGlobalStats(filteredAttendance);
    
    // Calcular estadísticas por jugador
    calculatePlayerStats(filteredAttendance);

  } catch (error) {
    console.error('Error calculando estadísticas:', error);
    showError('Error al calcular las estadísticas');
  }
}

// Filtrar asistencia por período
function filterAttendanceByPeriod(attendance, period, customStart, customEnd) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return attendance.filter(record => {
    const recordDate = new Date(record.date);
    recordDate.setHours(0, 0, 0, 0);

    switch (period) {
      case 'week': {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return recordDate >= weekAgo && recordDate <= today;
      }
      
      case 'month': {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        firstDayOfMonth.setHours(0, 0, 0, 0);
        lastDayOfMonth.setHours(23, 59, 59, 999);
        return recordDate >= firstDayOfMonth && recordDate <= lastDayOfMonth;
      }
      
      case 'season':
        return true; // Toda la temporada
      
      case 'custom': {
        const start = new Date(customStart);
        const end = new Date(customEnd);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return recordDate >= start && recordDate <= end;
      }
      
      default:
        return true;
    }
  });
}

// Calcular estadísticas globales
function calculateGlobalStats(attendance) {
  const stats = {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0
  };

  attendance.forEach(record => {
    switch (record.status) {
      case 'PRESENT':
        stats.present++;
        break;
      case 'ABSENT':
        stats.absent++;
        break;
      case 'LATE':
        stats.late++;
        break;
      case 'EXCUSED':
        stats.excused++;
        break;
    }
  });

  // Calcular porcentaje de asistencia
  const totalSessions = attendance.length;
  const effectiveSessions = totalSessions - stats.excused;
  const attendedSessions = stats.present + stats.late;
  const attendanceRate = effectiveSessions > 0 
    ? ((attendedSessions / effectiveSessions) * 100).toFixed(1)
    : 0;

  // Actualizar DOM
  document.getElementById('totalPresent').textContent = stats.present;
  document.getElementById('totalAbsent').textContent = stats.absent;
  document.getElementById('totalLate').textContent = stats.late;
  document.getElementById('totalExcused').textContent = stats.excused;
  document.getElementById('attendanceRate').textContent = `${attendanceRate}%`;
}

// Calcular estadísticas por jugador
function calculatePlayerStats(attendance) {
  const playerStatsMap = new Map();

  // Inicializar stats para cada jugador
  allPlayers.forEach(player => {
    playerStatsMap.set(player.id, {
      player: player,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      total: 0
    });
  });

  // Contar registros por jugador
  attendance.forEach(record => {
    const playerStats = playerStatsMap.get(record.player_id);
    if (playerStats) {
      playerStats.total++;
      switch (record.status) {
        case 'PRESENT':
          playerStats.present++;
          break;
        case 'ABSENT':
          playerStats.absent++;
          break;
        case 'LATE':
          playerStats.late++;
          break;
        case 'EXCUSED':
          playerStats.excused++;
          break;
      }
    }
  });

  // Convertir a array y calcular porcentajes
  const playerStatsArray = Array.from(playerStatsMap.values()).map(stats => {
    const effectiveSessions = stats.total - stats.excused;
    const attendedSessions = stats.present + stats.late;
    const percentage = effectiveSessions > 0 
      ? ((attendedSessions / effectiveSessions) * 100).toFixed(1)
      : 0;
    
    return {
      ...stats,
      percentage: parseFloat(percentage)
    };
  });

  // Ordenar por porcentaje (descendente)
  playerStatsArray.sort((a, b) => b.percentage - a.percentage);

  // Renderizar tabla
  renderPlayerStatsTable(playerStatsArray);
}

// Renderizar tabla de estadísticas de jugadores
function renderPlayerStatsTable(playerStats) {
  const tbody = document.getElementById('playersStatsTable');
  if (!tbody) {
    console.error('No se encontró el elemento playersStatsTable');
    return;
  }
  tbody.innerHTML = '';

  if (playerStats.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <div class="empty-icon">📊</div>
          <p>No hay datos de asistencia para mostrar</p>
        </td>
      </tr>
    `;
    return;
  }

  playerStats.forEach(stats => {
    if (stats.total === 0) return; // No mostrar jugadores sin registros

    const tr = document.createElement('tr');
    
    // Determinar clase de porcentaje
    let percentageClass = 'percentage-low';
    if (stats.percentage >= 80) {
      percentageClass = 'percentage-high';
    } else if (stats.percentage >= 60) {
      percentageClass = 'percentage-medium';
    }

    tr.innerHTML = `
      <td class="text-center">
        <span class="player-number">${stats.player.number || '-'}</span>
      </td>
      <td>
        <span class="player-name">${stats.player.name}</span>
      </td>
      <td class="text-center">${stats.present}</td>
      <td class="text-center">${stats.absent}</td>
      <td class="text-center">${stats.late}</td>
      <td class="text-center">${stats.excused}</td>
      <td class="text-center">
        <span class="${percentageClass}">${stats.percentage}%</span>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

// Mostrar error
function showError(message) {
  console.error('showError:', message);
  const errorMsg = document.getElementById('errorMsg');
  if (errorMsg) {
    errorMsg.textContent = message;
    errorMsg.style.display = 'block';
  } else {
    alert(message);
  }
}
