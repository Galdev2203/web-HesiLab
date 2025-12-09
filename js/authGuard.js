// authGuard.js - Verificación centralizada de autenticación
import { supabase } from './supabaseClient.js';

/**
 * Verifica que el usuario tenga una sesión activa
 * Redirige al login si no hay sesión
 * @returns {Promise<{session: Object, user: Object}>} Datos de sesión y usuario
 */
export async function requireAuth() {
  try {
    // Intentar obtener la sesión actual
    const { data: sessionData, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error al obtener sesión:', error);
      redirectToLogin();
      throw error;
    }

    // Si no hay sesión, redirigir al login
    if (!sessionData || !sessionData.session) {
      console.warn('No hay sesión activa, redirigiendo al login...');
      redirectToLogin();
      throw new Error('No session');
    }

    // Sesión válida encontrada
    return {
      session: sessionData.session,
      user: sessionData.session.user
    };

  } catch (error) {
    console.error('Error en requireAuth:', error);
    redirectToLogin();
    throw error;
  }
}

/**
 * Verifica si hay una sesión activa sin redirigir
 * @returns {Promise<boolean>} true si hay sesión activa
 */
export async function checkAuth() {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    return !!(sessionData && sessionData.session);
  } catch (error) {
    console.error('Error al verificar autenticación:', error);
    return false;
  }
}

/**
 * Redirige al usuario a la página de login
 */
function redirectToLogin() {
  // Evitar bucles de redirección
  if (!window.location.pathname.includes('/pages/index.html')) {
    window.location.href = '/pages/index.html';
  }
}

/**
 * Configura el listener para cambios en el estado de autenticación
 * Útil para detectar cuando se cierra sesión en otra pestaña
 */
export function setupAuthListener() {
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth state changed:', event, session ? 'Session active' : 'No session');
    
    // Si se cerró sesión, redirigir al login
    if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' && !session) {
      redirectToLogin();
    }
    
    // Si se inició sesión y estamos en la página de login, ir al dashboard
    if (event === 'SIGNED_IN' && window.location.pathname.includes('/pages/index.html')) {
      window.location.href = '/pages/dashboard.html';
    }
  });
}

/**
 * Cierra la sesión del usuario
 */
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    // Limpiar completamente localStorage y sessionStorage
    localStorage.clear();
    sessionStorage.clear();
    
    // Redirigir a la landing page (no al login interno)
    window.location.href = '/pages/index.html';
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    // Forzar limpieza y redirección incluso si hay error
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/pages/index.html';
  }
}
