// dashboard.js - Dashboard minimalista con calendario semanal
import { supabase } from './supabaseClient.js';
import { requireSession } from './utils/supabaseHelpers.js';
import { formatDate as formatDateUtil, formatTime } from './utils/domHelpers.js';

// Estado del calendario
let currentWeekStart = getWeekStart(new Date());
let user = null;

// ============================================
// SIDEBAR Y MENÚ
// ============================================
class SidebarManager {
  constructor() {
    this.menuToggle = document.getElementById('menuToggle');
    this.sidebar = document.getElementById('sidebar');
    this.overlay = document.getElementById('sidebarOverlay');
    this.init();
  }

  init() {
    this.menuToggle.addEventListener('click', () => this.toggle());
    this.overlay.addEventListener('click', () => this.close());
    
    // Cerrar en móvil al hacer clic en enlace
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth < 1024) {
          this.close();
        }
      });
    });
  }

  toggle() {
    this.menuToggle.classList.toggle('active');
    this.sidebar.classList.toggle('active');
    this.overlay.classList.toggle('active');
  }

  close() {
    this.menuToggle.classList.remove('active');
    this.sidebar.classList.remove('active');
    this.overlay.classList.remove('active');
  }
}

// ============================================
// GESTIÓN DE PERFIL
// ============================================
class ProfileManager {
  constructor(user) {
    this.user = user;
  }

  async load() {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', this.user.id)
        .single();

      if (profile) {
        this.updateAvatars(profile);
        this.updateUserInfo(profile);
      }
    } catch (error) {
      console.error('Error cargando perfil:', error);
    }
  }

  updateAvatars(profile) {
    const avatarUrl = profile.avatar_url || this.getDefaultAvatar(profile.full_name || this.user.email);
    
    const headerAvatar = document.getElementById('headerAvatar');
    const sidebarAvatar = document.getElementById('sidebarAvatar');
    
    if (headerAvatar) headerAvatar.src = avatarUrl;
    if (sidebarAvatar) sidebarAvatar.src = avatarUrl;
  }

  updateUserInfo(profile) {
    const userName = document.getElementById('sidebarUserName');
    const userEmail = document.getElementById('sidebarUserEmail');
    
    if (userName) {
      userName.textContent = profile.full_name || this.user.email.split('@')[0];
    }
    if (userEmail) {
      userEmail.textContent = this.user.email;
    }
  }

  getDefaultAvatar(name) {
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
class CalendarManager {
  constructor(userId) {
    this.userId = userId;
    this.calendar = document.getElementById('weeklyCalendar');
    this.weekRange = document.getElementById('weekRange');
    this.weekNavigation = document.querySelector('.week-navigation');
  }

  async loadWeek() {
    this.calendar.innerHTML = '';

    // Obtener equipos del usuario
    const { data: teamsData } = await supabase
      .from('team_staff')
      .select('team_id, teams(id, name)')
      .eq('user_id', this.userId)
      .eq('active', true);

    if (!teamsData || teamsData.length === 0) {
      this.showEmptyState();
      return;
    }

    // Mostrar navegación
    if (this.weekNavigation) this.weekNavigation.style.display = 'flex';

    const teamIds = teamsData.map(t => t.team_id);
    const weekStart = new Date(currentWeekStart);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // Cargar entrenamientos y eventos
    const { data: trainingsData } = await supabase
      .from('team_training_sessions')
      .select('id, team_id, start_time, end_time, weekday, teams(name)')
      .in('team_id', teamIds);

    const { data: eventsData } = await supabase
      .from('team_events')
      .select('id, team_id, title, event_date, start_time, teams(name)')
      .in('team_id', teamIds);

    // Renderizar días
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(weekStart);
      currentDate.setDate(currentDate.getDate() + i);
      this.renderDay(currentDate, trainingsData, eventsData);
    }

    // Actualizar rango
    this.weekRange.textContent = formatWeekRange(weekStart);

    // Verificar entrenamiento de hoy
    await this.checkTodayTraining(trainingsData);
  }

  renderDay(date, trainingsData, eventsData) {
    const dateInfo = formatDate(date);
    const dateStr = dateInfo.fullDate;
    const dayOfWeek = date.getDay();

    const dayColumn = document.createElement('div');
    dayColumn.className = `day-column ${isToday(date) ? 'today' : ''}`;

    dayColumn.innerHTML = `
      <div class="day-header">
        <span class="day-name">${dateInfo.dayName}</span>
        <span class="day-number">${dateInfo.dayNumber}</span>
      </div>
      <div class="day-events" id="events-${dateStr}"></div>
    `;

    this.calendar.appendChild(dayColumn);

    const eventsContainer = dayColumn.querySelector(`#events-${dateStr}`);

    // Filtrar entrenamientos por día de la semana
    const dayTrainings = trainingsData?.filter(t => t.weekday === dayOfWeek) || [];
    
    // Filtrar eventos por fecha específica
    const dayEvents = eventsData?.filter(e => e.event_date === dateStr) || [];

    if (dayTrainings.length === 0 && dayEvents.length === 0) {
      eventsContainer.innerHTML = '<span class="no-events">Sin eventos</span>';
    } else {
      this.renderEvents(eventsContainer, dayTrainings, dayEvents);
    }
  }

  renderEvents(container, trainings, events) {
    // Entrenamientos
    trainings.forEach(training => {
      if (!training.teams?.name) return; // Skip si no tiene nombre de equipo
      
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
      container.appendChild(eventDiv);
    });

    // Eventos
    events.forEach(event => {
      if (!event.title || !event.teams?.name) return; // Skip si faltan datos
      
      const eventDiv = document.createElement('div');
      eventDiv.className = 'event-item event';
      eventDiv.innerHTML = `
        <span class="event-time">📅 ${event.start_time?.substring(0, 5) || 'Todo el día'}</span>
        <span class="event-title">${event.title}</span>
        <span class="event-team">${event.teams.name}</span>
      `;
      eventDiv.addEventListener('click', () => {
        window.location.href = `/pages/team_detail.html?team_id=${event.team_id}`;
      });
      container.appendChild(eventDiv);
    });
  }

  async showEmptyState() {
    this.calendar.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 3rem; text-align: center;">
        <div class="empty-icon" style="font-size: 4rem; margin-bottom: 1rem;">📅</div>
        <h3 style="margin: 0 0 0.5rem 0; color: var(--gray-700);">No tienes equipos asignados</h3>
        <p style="color: var(--gray-500); margin: 0;">Crea un equipo o espera a que te añadan a uno para ver entrenamientos y eventos</p>
        <a href="/pages/teams.html" class="btn btn-primary" style="margin-top: 1.5rem; display: inline-block; padding: 0.75rem 1.5rem; text-decoration: none; border-radius: 0.5rem;">➜ Ir a Mis Equipos</a>
      </div>
    `;
    
    if (this.weekNavigation) this.weekNavigation.style.display = 'none';
    await this.checkTodayTraining([]);
  }

  async checkTodayTraining(trainingsData) {
    const today = new Date();
    const todayWeekday = today.getDay();
    const todayTrainings = trainingsData?.filter(t => t.weekday === todayWeekday) || [];

    const todaySection = document.getElementById('todayTrainingSection');
    const todayContainer = document.getElementById('todayTrainingsContainer');
    const noTrainingsMsg = document.getElementById('noTrainingsToday');
    
    // Sin equipos
    if (!trainingsData || trainingsData.length === 0) {
      todaySection.style.display = 'none';
      if (noTrainingsMsg) {
        noTrainingsMsg.innerHTML = `
          <div class="empty-icon">📅</div>
          <p>No tienes equipos asignados</p>
          <a href="/pages/teams.html" class="btn btn-primary" style="margin-top: 1rem; display: inline-block; padding: 0.5rem 1rem; text-decoration: none;">Ir a Mis Equipos</a>
        `;
        noTrainingsMsg.style.display = 'block';
      }
      return;
    }
    
    // Con entrenamientos hoy
    if (todayTrainings.length > 0) {
      todayContainer.innerHTML = '';
      
      todayTrainings.forEach(training => {
        const trainingCard = document.createElement('div');
        trainingCard.className = 'today-training-item';
        trainingCard.innerHTML = `
          <div class="training-item-info">
            <div class="training-item-icon">🏃</div>
            <div class="training-item-details">
              <div class="training-item-team">${training.teams.name}</div>
              <div class="training-item-time">⏰ ${training.start_time.substring(0, 5)} - ${training.end_time.substring(0, 5)}</div>
            </div>
          </div>
          <button class="training-item-btn" onclick="window.location.href='/pages/attendance.html?team_id=${training.team_id}'">
            📋 Pasar lista
          </button>
        `;
        todayContainer.appendChild(trainingCard);
      });
      
      todaySection.style.display = 'block';
      if (noTrainingsMsg) noTrainingsMsg.style.display = 'none';
    } else {
      // Sin entrenamientos hoy
      todaySection.style.display = 'none';
      if (noTrainingsMsg) {
        noTrainingsMsg.innerHTML = `
          <div class="empty-icon">✅</div>
          <p>No hay entrenamientos programados para hoy</p>
        `;
        noTrainingsMsg.style.display = 'block';
      }
    }
  }

  previousWeek() {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    this.loadWeek();
  }

  nextWeek() {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    this.loadWeek();
  }
}

// ============================================
// ACCESOS RÁPIDOS
// ============================================
class QuickActionsManager {
  constructor(userId) {
    this.userId = userId;
    this.container = document.getElementById('quickActions');
  }

  async load() {
    try {
      const { data: teamsData } = await supabase
        .from('team_staff')
        .select('team_id, teams(id, name)')
        .eq('user_id', this.userId)
        .eq('active', true)
        .limit(5);

      // Limpiar y añadir "Mis Equipos"
      this.container.innerHTML = `
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
          this.container.appendChild(btn);
        });
      }
    } catch (error) {
      console.error('Error cargando accesos rápidos:', error);
    }
  }
}

// ============================================
// SECCIONES COLLAPSABLES
// ============================================
class CollapsibleSectionsManager {
  init() {
    const collapsibleHeaders = document.querySelectorAll('.section-header-collapsible');
    
    collapsibleHeaders.forEach(header => {
      header.addEventListener('click', (e) => {
        if (e.target.closest('.collapse-btn')) {
          const section = header.closest('.collapsible-section');
          section.classList.toggle('collapsed');
          
          // Guardar estado
          const sectionId = header.id;
          const isCollapsed = section.classList.contains('collapsed');
          localStorage.setItem(`section_${sectionId}_collapsed`, isCollapsed);
        }
      });
    });
    
    // Restaurar estados
    collapsibleHeaders.forEach(header => {
      const sectionId = header.id;
      const wasCollapsed = localStorage.getItem(`section_${sectionId}_collapsed`) === 'true';
      
      if (wasCollapsed) {
        header.closest('.collapsible-section').classList.add('collapsed');
      }
    });
  }
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  // Verificar sesión
  await requireSession();
  const { data: { session } } = await supabase.auth.getSession();
  user = session.user;

  // Inicializar componentes
  const sidebar = new SidebarManager();
  const profile = new ProfileManager(user);
  const calendar = new CalendarManager(user.id);
  const quickActions = new QuickActionsManager(user.id);
  const collapsible = new CollapsibleSectionsManager();

  // Cargar datos
  await profile.load();
  await calendar.loadWeek();
  await quickActions.load();
  collapsible.init();

  // Navegación de semana
  document.getElementById('prevWeek')?.addEventListener('click', () => calendar.previousWeek());
  document.getElementById('nextWeek')?.addEventListener('click', () => calendar.nextWeek());

  // Cerrar sesión
  document.getElementById('sidebarLogoutBtn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    
    if (confirm('¿Seguro que quieres cerrar sesión?')) {
      await supabase.auth.signOut();
      window.location.href = '/pages/index.html';
    }
  });

  // Botones de acción
  document.getElementById('settingsBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    alert('Configuración en desarrollo');
  });

  document.getElementById('helpBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    alert('Centro de ayuda en desarrollo');
  });

  document.getElementById('notificationsBtn')?.addEventListener('click', () => {
    alert('Sistema de notificaciones en desarrollo');
  });

  document.getElementById('userMenuBtn')?.addEventListener('click', () => {
    window.location.href = '/pages/profile.html';
  });
});
