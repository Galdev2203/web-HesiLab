// headerComponent.js - Componente reutilizable del header unificado
import { supabase } from './supabaseClient.js';
import { setupAuthListener, signOut } from './authGuard.js';

/**
 * Inicializa el header unificado con sidebar
 * @param {Object} options - Opciones de configuración
 * @param {string} options.title - Título a mostrar en el header
 * @param {string|boolean} options.backUrl - URL para el botón de volver, true para history.back(), null/false para ocultar
 * @param {string} options.activeNav - ID del nav item activo ('dashboard', 'teams', 'profile')
 */
export async function initHeader(options = {}) {
  const {
    title = 'HesiLab',
    backUrl = null,
    activeNav = null
  } = options;

  // Configurar listener de autenticación (solo una vez)
  if (!window._authListenerSetup) {
    setupAuthListener();
    window._authListenerSetup = true;
  }

  // Verificar sesión
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) {
    window.location.href = '/pages/index.html';
    return;
  }
  const user = sessionData.session.user;

  // Determinar el HTML del botón de volver
  let backButtonHTML = '<div style="width: 40px;"></div>';
  if (backUrl === true) {
    // Usar history.back()
    backButtonHTML = '<button class="back-btn" id="backBtn" title="Volver">←</button>';
  } else if (backUrl) {
    // Usar URL específica
    backButtonHTML = `<a href="${backUrl}" class="back-btn" title="Volver">←</a>`;
  }

  // Crear estructura del header
  const headerHTML = `
    <header class="unified-header">
      <div class="unified-header-content">
        <button class="menu-toggle" id="menuToggle" aria-label="Abrir menú">
          <span></span>
          <span></span>
          <span></span>
        </button>
        
        ${backButtonHTML}
        
        <h1 class="header-title">${title}</h1>

        <div class="header-actions">
          <button class="icon-btn" id="notificationsBtn" title="Notificaciones">
            <span class="icon">🔔</span>
            <span class="badge">3</span>
          </button>
          <a href="/pages/profile.html" class="user-avatar" title="Mi perfil">
            <img id="headerAvatar" src="" alt="Avatar">
          </a>
        </div>
      </div>
    </header>

    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <div class="user-profile">
          <img id="sidebarAvatar" src="" alt="Avatar" class="sidebar-avatar">
          <div class="user-info">
            <h4 id="sidebarUserName">Usuario</h4>
            <p id="sidebarUserEmail">email@ejemplo.com</p>
          </div>
        </div>
      </div>

      <nav class="sidebar-nav">
        <a href="/pages/dashboard.html" class="nav-item ${activeNav === 'dashboard' ? 'active' : ''}">
          <span class="icon">🏠</span>
          <span class="text">Inicio</span>
        </a>
        <a href="/pages/teams.html" class="nav-item ${activeNav === 'teams' ? 'active' : ''}">
          <span class="icon">👥</span>
          <span class="text">Mis Equipos</span>
        </a>
        <a href="/pages/profile.html" class="nav-item ${activeNav === 'profile' ? 'active' : ''}">
          <span class="icon">👤</span>
          <span class="text">Mi Perfil</span>
        </a>
        <a href="#" class="nav-item" id="settingsNav">
          <span class="icon">⚙️</span>
          <span class="text">Configuración</span>
        </a>
        <a href="#" class="nav-item" id="helpNav">
          <span class="icon">❓</span>
          <span class="text">Ayuda</span>
        </a>
      </nav>

      <div class="sidebar-footer">
        <button class="logout-btn" id="logoutBtn">
          <span class="icon">🚪</span>
          <span class="text">Cerrar Sesión</span>
        </button>
      </div>
    </aside>

    <div class="sidebar-overlay" id="sidebarOverlay"></div>
  `;

  // Insertar al inicio del body
  document.body.insertAdjacentHTML('afterbegin', headerHTML);
  document.body.classList.add('has-unified-header');

  // Inicializar funcionalidad
  setupHeaderListeners(user);
  await loadUserProfile(user);
}

/**
 * Configura los event listeners del header y sidebar
 */
function setupHeaderListeners(user) {
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const backBtn = document.getElementById('backBtn');

  // Botón de volver con history.back()
  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      history.back();
    });
  }

  // Toggle del menú
  menuToggle?.addEventListener('click', () => {
    sidebar.classList.toggle('active');
    menuToggle.classList.toggle('active');
    sidebarOverlay.classList.toggle('active');
  });

  // Cerrar sidebar al hacer clic en el overlay
  sidebarOverlay?.addEventListener('click', () => {
    sidebar.classList.remove('active');
    menuToggle.classList.remove('active');
    sidebarOverlay.classList.remove('active');
  });

  // Cerrar sidebar en móvil al hacer clic en nav-item
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth < 1024) {
        sidebar.classList.remove('active');
        menuToggle.classList.remove('active');
        sidebarOverlay.classList.remove('active');
      }
    });
  });

  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await signOut();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      // Forzar redirección incluso si hay error
      window.location.href = '/pages/index.html';
    }
  });

  // Configuración
  document.getElementById('settingsNav')?.addEventListener('click', (e) => {
    e.preventDefault();
    alert('Configuración próximamente');
  });

  // Ayuda
  document.getElementById('helpNav')?.addEventListener('click', (e) => {
    e.preventDefault();
    alert('Ayuda próximamente');
  });

  // Notificaciones
  document.getElementById('notificationsBtn')?.addEventListener('click', () => {
    alert('Notificaciones próximamente');
  });
}

/**
 * Carga el perfil del usuario
 */
async function loadUserProfile(user) {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('full_name, email, avatar_url')
      .eq('id', user.id)
      .single();

    if (error) throw error;

    const fullName = profile?.full_name || user.email?.split('@')[0] || 'Usuario';
    const email = profile?.email || user.email;
    const avatarUrl = profile?.avatar_url;

    document.getElementById('sidebarUserName').textContent = fullName;
    document.getElementById('sidebarUserEmail').textContent = email;

    // Avatar del header y sidebar
    if (avatarUrl) {
      document.getElementById('headerAvatar').src = avatarUrl;
      document.getElementById('sidebarAvatar').src = avatarUrl;
    } else {
      const defaultAvatar = getDefaultAvatar(fullName);
      document.getElementById('headerAvatar').src = defaultAvatar;
      document.getElementById('sidebarAvatar').src = defaultAvatar;
    }
  } catch (error) {
    console.error('Error cargando perfil:', error);
  }
}

/**
 * Genera un avatar por defecto con las iniciales del usuario
 */
function getDefaultAvatar(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 100, 100);
  gradient.addColorStop(0, '#667eea');
  gradient.addColorStop(1, '#4c51bf');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 100, 100);

  ctx.fillStyle = 'white';
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
  
  ctx.fillText(initials, 50, 50);
  return canvas.toDataURL();
}
