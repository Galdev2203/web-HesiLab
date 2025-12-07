// permissionsHelper.js - Sistema de permisos reutilizable
import { supabase } from "./supabaseClient.js";

// Cache de permisos para evitar consultas repetidas
let permissionsCache = {};
let currentUser = null;

/**
 * Inicializar el sistema de permisos con el usuario actual
 */
export async function initPermissions() {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    currentUser = data.session.user;
  }
  return currentUser;
}

/**
 * Limpiar cache de permisos (útil al cambiar de equipo)
 */
export function clearPermissionsCache() {
  permissionsCache = {};
}

/**
 * Obtener todos los datos del staff del usuario para un equipo
 * @param {string} teamId - ID del equipo
 * @returns {Object} Datos del staff incluyendo rol y permisos
 */
export async function getUserStaffData(teamId) {
  if (!currentUser) {
    await initPermissions();
  }

  const cacheKey = `${teamId}_${currentUser.id}`;
  
  if (permissionsCache[cacheKey]) {
    return permissionsCache[cacheKey];
  }

  const { data, error } = await supabase
    .from('team_staff')
    .select(`
      id,
      role,
      active,
      team_staff_permissions (
        permission,
        value
      )
    `)
    .eq('team_id', teamId)
    .eq('user_id', currentUser.id)
    .eq('active', true)
    .single();

  if (error) {
    console.error('Error obteniendo datos de staff:', error);
    return null;
  }

  permissionsCache[cacheKey] = data;
  return data;
}

/**
 * Verificar si el usuario tiene un permiso específico
 * @param {string} teamId - ID del equipo
 * @param {string} permission - Nombre del permiso (ej: 'MANAGE_PLAYERS')
 * @returns {boolean} true si tiene el permiso
 */
export async function hasPermission(teamId, permission) {
  const staffData = await getUserStaffData(teamId);
  
  if (!staffData || !staffData.team_staff_permissions) {
    return false;
  }

  return staffData.team_staff_permissions.some(
    p => p.permission === permission && p.value === true
  );
}

/**
 * Verificar múltiples permisos a la vez (OR lógico)
 * @param {string} teamId - ID del equipo
 * @param {string[]} permissions - Array de permisos
 * @returns {boolean} true si tiene al menos uno de los permisos
 */
export async function hasAnyPermission(teamId, permissions) {
  const staffData = await getUserStaffData(teamId);
  
  if (!staffData || !staffData.team_staff_permissions) {
    return false;
  }

  return permissions.some(permission =>
    staffData.team_staff_permissions.some(
      p => p.permission === permission && p.value === true
    )
  );
}

/**
 * Verificar múltiples permisos a la vez (AND lógico)
 * @param {string} teamId - ID del equipo
 * @param {string[]} permissions - Array de permisos
 * @returns {boolean} true si tiene TODOS los permisos
 */
export async function hasAllPermissions(teamId, permissions) {
  const staffData = await getUserStaffData(teamId);
  
  if (!staffData || !staffData.team_staff_permissions) {
    return false;
  }

  return permissions.every(permission =>
    staffData.team_staff_permissions.some(
      p => p.permission === permission && p.value === true
    )
  );
}

/**
 * Obtener el rol del usuario en el equipo
 * @param {string} teamId - ID del equipo
 * @returns {string|null} Rol del usuario (ej: 'HEAD_COACH', 'ASSISTANT_COACH')
 */
export async function getUserRole(teamId) {
  const staffData = await getUserStaffData(teamId);
  return staffData?.role || null;
}

/**
 * Obtener todos los permisos del usuario
 * @param {string} teamId - ID del equipo
 * @returns {Object} Objeto con permisos como { MANAGE_PLAYERS: true, ... }
 */
export async function getAllUserPermissions(teamId) {
  const staffData = await getUserStaffData(teamId);
  
  if (!staffData || !staffData.team_staff_permissions) {
    return {};
  }

  const permissionsObj = {};
  staffData.team_staff_permissions.forEach(p => {
    permissionsObj[p.permission] = p.value;
  });
  
  return permissionsObj;
}

/**
 * Mostrar u ocultar un elemento según permiso
 * @param {HTMLElement} element - Elemento del DOM
 * @param {boolean} hasPermission - Si tiene el permiso
 */
export function toggleElementByPermission(element, hasPermission) {
  if (!element) return;
  
  if (hasPermission) {
    element.style.display = '';
    element.removeAttribute('disabled');
  } else {
    element.style.display = 'none';
  }
}

/**
 * Deshabilitar elemento si no tiene permiso (no oculta, solo desactiva)
 * @param {HTMLElement} element - Elemento del DOM
 * @param {boolean} hasPermission - Si tiene el permiso
 */
export function disableIfNoPermission(element, hasPermission) {
  if (!element) return;
  
  if (hasPermission) {
    element.removeAttribute('disabled');
    element.classList.remove('disabled');
  } else {
    element.setAttribute('disabled', 'true');
    element.classList.add('disabled');
  }
}

/**
 * Obtener texto amigable para un permiso
 * @param {string} permission - Nombre del permiso
 * @returns {string} Texto legible
 */
export function getPermissionLabel(permission) {
  const labels = {
    'MANAGE_TEAM': 'Gestionar equipo',
    'MANAGE_STAFF': 'Gestionar entrenadores',
    'MANAGE_STAFF_PERMISSIONS': 'Gestionar permisos',
    'MANAGE_PLAYERS': 'Gestionar jugadores',
    'MANAGE_EVENTS': 'Gestionar eventos',
    'MANAGE_TRAININGS': 'Gestionar entrenamientos',
    'MANAGE_ATTENDANCE': 'Gestionar asistencia'
  };
  
  return labels[permission] || permission;
}

/**
 * Obtener texto amigable para un rol
 * @param {string} role - Nombre del rol
 * @returns {string} Texto legible
 */
export function getRoleLabel(role) {
  const labels = {
    'HEAD_COACH': 'Entrenador Principal',
    'SECOND_COACH': 'Segundo Entrenador',
    'ASSISTANT_COACH': 'Entrenador Asistente',
    'PHYSICAL_TRAINER': 'Preparador Físico',
    'GOALKEEPER_COACH': 'Entrenador de Porteros',
    'ANALYST': 'Analista',
    'MEDICAL_STAFF': 'Personal Médico',
    'OTHER': 'Otro'
  };
  
  return labels[role] || role;
}

/**
 * Lista de todos los permisos disponibles
 */
export const ALL_PERMISSIONS = [
  'MANAGE_TEAM',
  'MANAGE_STAFF',
  'MANAGE_STAFF_PERMISSIONS',
  'MANAGE_PLAYERS',
  'MANAGE_EVENTS',
  'MANAGE_TRAININGS',
  'MANAGE_ATTENDANCE'
];

/**
 * Lista de roles disponibles
 */
export const AVAILABLE_ROLES = [
  'HEAD_COACH',
  'SECOND_COACH',
  'ASSISTANT_COACH',
  'PHYSICAL_TRAINER',
  'GOALKEEPER_COACH',
  'ANALYST',
  'MEDICAL_STAFF',
  'OTHER'
];
