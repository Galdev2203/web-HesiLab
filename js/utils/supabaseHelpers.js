// supabaseHelpers.js - Helpers para operaciones comunes de Supabase
import { supabase } from '../supabaseClient.js';

/**
 * Validar y obtener sesión actual
 */
export async function requireSession(redirectUrl = '/pages/index.html') {
  const { data: sessionData } = await supabase.auth.getSession();
  
  if (!sessionData.session) {
    window.location.href = redirectUrl;
    throw new Error('No session');
  }
  
  return sessionData.session;
}

/**
 * Obtener parámetro de URL
 */
export function getUrlParam(paramName) {
  const params = new URLSearchParams(window.location.search);
  return params.get(paramName);
}

/**
 * Validar team_id de URL
 */
export function requireTeamId(redirectUrl = '/pages/teams.html') {
  const teamId = getUrlParam('team_id');
  
  if (!teamId) {
    alert('Error: falta team_id');
    window.location.href = redirectUrl;
    throw new Error('Missing team_id');
  }
  
  return teamId;
}

/**
 * Cargar datos con manejo de errores
 */
export async function loadData(query, errorMessage = 'Error al cargar datos') {
  try {
    const { data, error } = await query;
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error(errorMessage, error);
    throw new Error(`${errorMessage}: ${error.message}`);
  }
}

/**
 * Insertar dato con manejo de errores
 */
export async function insertData(table, data, successMessage = 'Datos guardados') {
  try {
    const { error } = await supabase
      .from(table)
      .insert(data);
    
    if (error) throw error;
    
    return { success: true, message: successMessage };
  } catch (error) {
    console.error('Error insertando datos:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Actualizar dato con manejo de errores
 */
export async function updateData(table, id, data, successMessage = 'Datos actualizados') {
  try {
    const { error } = await supabase
      .from(table)
      .update(data)
      .eq('id', id);
    
    if (error) throw error;
    
    return { success: true, message: successMessage };
  } catch (error) {
    console.error('Error actualizando datos:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Eliminar dato con manejo de errores
 */
export async function deleteData(table, id, successMessage = 'Datos eliminados') {
  try {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    return { success: true, message: successMessage };
  } catch (error) {
    console.error('Error eliminando datos:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Contar registros
 */
export async function countRecords(table, filters = {}) {
  try {
    let query = supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    // Aplicar filtros
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    
    const { count, error } = await query;
    
    if (error) throw error;
    
    return count || 0;
  } catch (error) {
    console.error('Error contando registros:', error);
    return 0;
  }
}

/**
 * Verificar si existe un registro
 */
export async function recordExists(table, filters) {
  const count = await countRecords(table, filters);
  return count > 0;
}
