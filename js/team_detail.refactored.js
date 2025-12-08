// team_detail.js - Lógica para detalles del equipo
import { supabase } from './supabaseClient.js';
import { initHeader } from './headerComponent.js';
import { 
  initPermissions, 
  getUserStaffData, 
  getUserRole,
  getAllUserPermissions,
  getRoleLabel,
  getPermissionLabel,
  toggleElementByPermission 
} from './permissionsHelper.js';
import { requireSession, requireTeamId } from './utils/supabaseHelpers.js';
import { showError } from './utils/domHelpers.js';

// ============================================
// GESTOR DE NAVEGACIÓN Y PERMISOS
// ============================================
class TeamNavigationManager {
  constructor(teamId, userPermissions) {
    this.teamId = teamId;
    this.userPermissions = userPermissions;
    this.navigationButtons = {
      players: { id: 'playersBtn', permission: 'MANAGE_PLAYERS' },
      staff: { id: 'staffBtn', permission: ['MANAGE_STAFF', 'MANAGE_STAFF_PERMISSIONS'] },
      trainings: { id: 'trainingsBtn', permission: 'MANAGE_TRAININGS' },
      events: { id: 'eventsBtn', permission: 'MANAGE_EVENTS' },
      attendance: { id: 'attendanceBtn', permission: 'MANAGE_ATTENDANCE' },
      stats: { id: 'statsBtn', permission: null } // Siempre visible
    };
  }

  setupNavigation() {
    Object.entries(this.navigationButtons).forEach(([key, config]) => {
      const btn = document.getElementById(config.id);
      if (!btn) return;

      // Configurar URL
      btn.href = `/pages/${key}.html?team_id=${this.teamId}`;

      // Configurar visibilidad según permisos
      if (config.permission === null) {
        // Siempre visible (como stats)
        btn.style.display = 'flex';
      } else if (Array.isArray(config.permission)) {
        // Múltiples permisos (OR)
        const hasPermission = config.permission.some(p => this.userPermissions[p]);
        toggleElementByPermission(btn, hasPermission);
      } else {
        // Permiso único
        toggleElementByPermission(btn, this.userPermissions[config.permission]);
      }
    });

    // Mostrar sección de acciones
    const actions = document.getElementById('actions');
    if (actions) actions.style.display = 'grid';
  }
}

// ============================================
// GESTOR DE PERMISOS DEL USUARIO
// ============================================
class UserPermissionsDisplay {
  constructor(teamId) {
    this.teamId = teamId;
    this.roleElement = document.getElementById('userRole');
    this.permissionsList = document.getElementById('permissionsList');
  }

  async load() {
    const userRole = await getUserRole(this.teamId);
    const userPermissions = await getAllUserPermissions(this.teamId);

    this.displayRole(userRole);
    this.displayPermissions(userPermissions);

    return userPermissions;
  }

  displayRole(role) {
    if (this.roleElement) {
      this.roleElement.innerText = getRoleLabel(role);
    }
  }

  displayPermissions(permissions) {
    if (!this.permissionsList) return;

    const activePermissions = Object.entries(permissions)
      .filter(([_, value]) => value === true)
      .map(([key, _]) => getPermissionLabel(key));

    if (activePermissions.length > 0) {
      this.permissionsList.innerHTML = activePermissions
        .map(p => `<li>${p}</li>`)
        .join('');
    } else {
      this.permissionsList.innerHTML = '<li>Sin permisos asignados</li>';
    }
  }
}

// ============================================
// GESTOR DE EQUIPO
// ============================================
class TeamDetailManager {
  constructor(teamId, user) {
    this.teamId = teamId;
    this.user = user;
  }

  async init() {
    // Verificar acceso del usuario al equipo
    const staffData = await getUserStaffData(this.teamId);
    if (!staffData) {
      throw new Error('No tienes permisos para acceder a este equipo');
    }

    // Cargar datos del equipo
    const teamData = await this.loadTeamData();
    
    // Inicializar header
    await initHeader({
      title: teamData.name,
      backUrl: '/pages/teams.html',
      activeNav: null
    });

    // Cargar permisos y configurar navegación
    const permissionsDisplay = new UserPermissionsDisplay(this.teamId);
    const userPermissions = await permissionsDisplay.load();

    // Configurar navegación
    const navigation = new TeamNavigationManager(this.teamId, userPermissions);
    navigation.setupNavigation();
  }

  async loadTeamData() {
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .eq('id', this.teamId)
      .single();

    if (teamError || !teamData) {
      throw new Error('No se pudo cargar el equipo');
    }

    return teamData;
  }
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Verificar sesión
    await requireSession();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session.user;

    // Inicializar sistema de permisos
    await initPermissions();

    // Obtener team_id de la URL
    const params = new URLSearchParams(window.location.search);
    const teamId = params.get('team_id');

    if (!teamId) {
      throw new Error('No se ha proporcionado team_id');
    }

    // Inicializar gestor del equipo
    const teamDetail = new TeamDetailManager(teamId, user);
    await teamDetail.init();

  } catch (error) {
    console.error('Error al cargar el equipo:', error);
    alert(error.message || 'Error al cargar el equipo. Redirigiendo...');
    window.location.href = '/pages/teams.html';
  }
});
