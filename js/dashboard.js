// dashboard.js - Dashboard minimalista con calendario semanal
import { supabase } from "../js/supabaseClient.js";

// Verificar sesión
const { data: sessionData } = await supabase.auth.getSession();
const session = sessionData.session;

if (!session) {
  window.location.href = "/pages/index.html";
  throw new Error("No session");
}

const user = session.user;

// Estado del calendario
let currentWeekStart = getWeekStart(new Date());

// ============================================
// SIDEBAR Y MENÚ
// ============================================
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

// Toggle sidebar
menuToggle.addEventListener('click', () => {
  menuToggle.classList.toggle('active');
  sidebar.classList.toggle('active');
  sidebarOverlay.classList.toggle('active');
});

// Cerrar sidebar al hacer clic en overlay
sidebarOverlay.addEventListener('click', () => {
  menuToggle.classList.remove('active');
  sidebar.classList.remove('active');
  sidebarOverlay.classList.remove('active');
});

// Cerrar sidebar en móvil al hacer clic en un enlace
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    if (window.innerWidth < 1024) {
      menuToggle.classList.remove('active');
      sidebar.classList.remove('active');
      sidebarOverlay.classList.remove('active');
    }
  });
});

// ============================================
// CARGAR PERFIL DEL USUARIO
// ============================================
async function loadUserProfile() {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profile) {
      // Avatar en header
      const headerAvatar = document.getElementById('headerAvatar');
      if (profile.avatar_url) {
        headerAvatar.src = profile.avatar_url;
      } else {
        headerAvatar.src = getDefaultAvatar(profile.full_name || user.email);
      }

      // Avatar en sidebar
      const sidebarAvatar = document.getElementById('sidebarAvatar');
      if (profile.avatar_url) {
        sidebarAvatar.src = profile.avatar_url;
      } else {
        sidebarAvatar.src = getDefaultAvatar(profile.full_name || user.email);
      }

      // Nombre y email en sidebar
      document.getElementById('sidebarUserName').textContent = 
        profile.full_name || user.email.split('@')[0];
      document.getElementById('sidebarUserEmail').textContent = user.email;
    }
  } catch (error) {
    console.error('Error cargando perfil:', error);
  }
}

// Generar avatar por defecto
function getDefaultAvatar(name) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  const canvas = document.createElement('canvas');
  canvas.width = 120;
  canvas.height = 120;
  const ctx = canvas.getContext('2d');
  
  const gradient = ctx.createLinearGradient(0, 0, 120, 120);
  gradient.addColorStop(0, '#667eea');
  gradient.addColorStop(1, '#4c51bf');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 120, 120);
  
  ctx.fillStyle = 'white';
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, 60, 60);
  
  return canvas.toDataURL();
}

// ============================================
// UTILIDADES DE FECHA
// ============================================
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Lunes como inicio
  return new Date(d.setDate(diff));
}

function formatDate(date) {
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  return {
    dayName: days[date.getDay()],
    dayNumber: date.getDate(),
    fullDate: date.toISOString().split('T')[0]
  };
}

function isToday(date) {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function formatWeekRange(startDate) {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  
  const options = { day: 'numeric', month: 'short' };
  return `${startDate.toLocaleDateString('es-ES', options)} - ${endDate.toLocaleDateString('es-ES', options)}`;
}

// ============================================
// CALENDARIO SEMANAL
// ============================================
async function loadWeeklyCalendar() {
  const weeklyCalendar = document.getElementById('weeklyCalendar');
  weeklyCalendar.innerHTML = '';

  // Obtener equipos del usuario
  const { data: teamsData } = await supabase
    .from('team_staff')
    .select('team_id, teams(id, name)')
    .eq('user_id', user.id)
    .eq('active', true);

  if (!teamsData || teamsData.length === 0) {
    weeklyCalendar.innerHTML = '<p class="no-events">No tienes equipos asignados</p>';
    return;
  }

  const teamIds = teamsData.map(t => t.team_id);
  const weekStart = new Date(currentWeekStart);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Cargar todos los entrenamientos de la semana
  const { data: trainingsData } = await supabase
    .from('team_trainings')
    .select('*, teams(name)')
    .in('team_id', teamIds)
    .gte('date', weekStart.toISOString().split('T')[0])
    .lt('date', weekEnd.toISOString().split('T')[0])
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });

  // Cargar todos los eventos de la semana
  const { data: eventsData } = await supabase
    .from('team_events')
    .select('*, teams(name)')
    .in('team_id', teamIds)
    .gte('date', weekStart.toISOString().split('T')[0])
    .lt('date', weekEnd.toISOString().split('T')[0])
    .order('date', { ascending: true })
    .order('time', { ascending: true });

  // Generar los 7 días de la semana
  for (let i = 0; i < 7; i++) {
    const currentDate = new Date(weekStart);
    currentDate.setDate(currentDate.getDate() + i);
    const dateInfo = formatDate(currentDate);
    const dateStr = dateInfo.fullDate;

    const dayColumn = document.createElement('div');
    dayColumn.className = `day-column ${isToday(currentDate) ? 'today' : ''}`;

    // Header del día
    dayColumn.innerHTML = `
      <div class="day-header">
        <span class="day-name">${dateInfo.dayName}</span>
        <span class="day-number">${dateInfo.dayNumber}</span>
      </div>
      <div class="day-events" id="events-${dateStr}"></div>
    `;

    weeklyCalendar.appendChild(dayColumn);

    // Agregar entrenamientos del día
    const dayTrainings = trainingsData?.filter(t => t.date === dateStr) || [];
    const dayEvents = eventsData?.filter(e => e.date === dateStr) || [];

    const eventsContainer = document.getElementById(`events-${dateStr}`);

    if (dayTrainings.length === 0 && dayEvents.length === 0) {
      eventsContainer.innerHTML = '<span class="no-events">Sin eventos</span>';
    } else {
      // Agregar entrenamientos
      dayTrainings.forEach(training => {
        const eventDiv = document.createElement('div');
        eventDiv.className = 'event-item training';
        eventDiv.innerHTML = `
          <span class="event-time">🏃 ${training.start_time.substring(0, 5)} - ${training.end_time.substring(0, 5)}</span>
          <span class="event-title">Entrenamiento</span>
          <span class="event-team">${training.teams.name}</span>
        `;
        eventDiv.addEventListener('click', () => {
          window.location.href = `/pages/team_detail.html?team_id=${training.team_id}`;
        });
        eventsContainer.appendChild(eventDiv);
      });

      // Agregar eventos
      dayEvents.forEach(event => {
        const eventDiv = document.createElement('div');
        eventDiv.className = 'event-item event';
        eventDiv.innerHTML = `
          <span class="event-time">📅 ${event.time?.substring(0, 5) || 'Todo el día'}</span>
          <span class="event-title">${event.title}</span>
          <span class="event-team">${event.teams.name}</span>
        `;
        eventDiv.addEventListener('click', () => {
          window.location.href = `/pages/team_detail.html?team_id=${event.team_id}`;
        });
        eventsContainer.appendChild(eventDiv);
      });
    }
  }

  // Actualizar el rango de la semana
  document.getElementById('weekRange').textContent = formatWeekRange(weekStart);

  // Verificar si hay entrenamiento hoy
  await checkTodayTraining(trainingsData);
}

// ============================================
// VERIFICAR ENTRENAMIENTO DE HOY
// ============================================
async function checkTodayTraining(trainingsData) {
  const today = new Date().toISOString().split('T')[0];
  const todayTrainings = trainingsData?.filter(t => t.date === today) || [];

  const todaySection = document.getElementById('todayTrainingSection');
  
  if (todayTrainings.length > 0) {
    const training = todayTrainings[0]; // Tomar el primero si hay varios
    
    document.getElementById('todayTrainingDetails').textContent = 
      `${training.teams.name} - ${training.start_time.substring(0, 5)} a ${training.end_time.substring(0, 5)}`;
    
    todaySection.style.display = 'block';

    // Configurar botón de asistencia
    const attendanceBtn = document.getElementById('takeAttendanceBtn');
    attendanceBtn.onclick = () => {
      // Aquí puedes implementar la lógica para pasar asistencia
      // Por ahora redirigimos a la página de jugadores
      window.location.href = `/pages/players.html?team_id=${training.team_id}`;
    };
  } else {
    todaySection.style.display = 'none';
  }
}

// ============================================
// NAVEGACIÓN DE SEMANA
// ============================================
document.getElementById('prevWeek').addEventListener('click', () => {
  currentWeekStart.setDate(currentWeekStart.getDate() - 7);
  loadWeeklyCalendar();
});

document.getElementById('nextWeek').addEventListener('click', () => {
  currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  loadWeeklyCalendar();
});

// ============================================
// CARGAR EQUIPOS EN ACCESOS RÁPIDOS
// ============================================
async function loadQuickActions() {
  try {
    const { data: teamsData } = await supabase
      .from('team_staff')
      .select('team_id, teams(id, name)')
      .eq('user_id', user.id)
      .eq('active', true)
      .limit(5);

    const quickActions = document.getElementById('quickActions');
    
    // Limpiar accesos rápidos existentes excepto "Mis Equipos"
    quickActions.innerHTML = `
      <a href="/pages/teams.html" class="quick-action-btn">
        <span class="icon">👥</span>
        <span class="text">Mis Equipos</span>
      </a>
    `;

    // Añadir equipos individuales
    if (teamsData && teamsData.length > 0) {
      teamsData.forEach(team => {
        const btn = document.createElement('a');
        btn.href = `/pages/team_detail.html?team_id=${team.team_id}`;
        btn.className = 'quick-action-btn';
        btn.innerHTML = `
          <span class="icon">⚽</span>
          <span class="text">${team.teams.name}</span>
        `;
        quickActions.appendChild(btn);
      });
    }
  } catch (error) {
    console.error('Error cargando accesos rápidos:', error);
  }
}

// ============================================
// CERRAR SESIÓN
// ============================================
document.getElementById('sidebarLogoutBtn').addEventListener('click', async (e) => {
  e.preventDefault();
  
  if (confirm('¿Seguro que quieres cerrar sesión?')) {
    await supabase.auth.signOut();
    window.location.href = "/pages/index.html";
  }
});

// ============================================
// BOTONES DE ACCIÓN
// ============================================
document.getElementById('settingsBtn').addEventListener('click', (e) => {
  e.preventDefault();
  alert('Configuración en desarrollo');
});

document.getElementById('helpBtn').addEventListener('click', (e) => {
  e.preventDefault();
  alert('Centro de ayuda en desarrollo');
});

document.getElementById('notificationsBtn').addEventListener('click', () => {
  alert('Sistema de notificaciones en desarrollo');
});

// Avatar en header - abrir perfil
document.getElementById('userMenuBtn').addEventListener('click', () => {
  window.location.href = '/pages/profile.html';
});

// ============================================
// INICIALIZACIÓN
// ============================================
loadUserProfile();
loadWeeklyCalendar();
loadQuickActions();
