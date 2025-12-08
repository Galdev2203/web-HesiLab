// dashboard.js - Dashboard profesional moderno
import { supabase } from "../js/supabaseClient.js";

// Verificar sesión
const { data: sessionData } = await supabase.auth.getSession();
const session = sessionData.session;

if (!session) {
  window.location.href = "/pages/index.html";
  throw new Error("No session");
}

const user = session.user;

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
// CARGAR ESTADÍSTICAS
// ============================================
async function loadStatistics() {
  try {
    // Total de equipos
    const { data: teamsData } = await supabase
      .from('team_staff')
      .select('team_id', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('active', true);

    document.getElementById('totalTeams').textContent = teamsData?.length || 0;

    // Si tiene equipos, cargar más estadísticas
    if (teamsData && teamsData.length > 0) {
      const teamIds = teamsData.map(t => t.team_id);

      // Total de jugadores
      const { data: playersData } = await supabase
        .from('team_players')
        .select('id', { count: 'exact' })
        .in('team_id', teamIds);
      
      document.getElementById('totalPlayers').textContent = playersData?.length || 0;

      // Total de eventos
      const { data: eventsData } = await supabase
        .from('team_events')
        .select('id', { count: 'exact' })
        .in('team_id', teamIds);
      
      document.getElementById('totalEvents').textContent = eventsData?.length || 0;

      // Porcentaje de asistencia
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('status')
        .in('team_id', teamIds);
      
      if (attendanceData && attendanceData.length > 0) {
        const present = attendanceData.filter(a => a.status === 'PRESENT').length;
        const total = attendanceData.length;
        const rate = Math.round((present / total) * 100);
        document.getElementById('attendanceRate').textContent = `${rate}%`;
      }
    }
  } catch (error) {
    console.error('Error cargando estadísticas:', error);
  }
}

// ============================================
// FECHA ACTUAL
// ============================================
function updateCurrentDate() {
  const now = new Date();
  const options = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  document.getElementById('currentDate').textContent = 
    now.toLocaleDateString('es-ES', options);
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
updateCurrentDate();
loadUserProfile();
loadStatistics();

