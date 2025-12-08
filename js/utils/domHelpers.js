// domHelpers.js - Helpers para manipulación del DOM
/**
 * Escapar HTML para prevenir XSS
 */
export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Mostrar/ocultar elemento
 */
export function toggleElement(elementId, show) {
  const element = document.getElementById(elementId);
  if (element) {
    element.style.display = show ? 'block' : 'none';
  }
}

/**
 * Mostrar mensaje de error
 */
export function showError(message, containerId = 'errorMsg') {
  const container = document.getElementById(containerId);
  if (container) {
    container.textContent = message;
    container.style.display = 'block';
  }
}

/**
 * Ocultar mensaje de error
 */
export function hideError(containerId = 'errorMsg') {
  const container = document.getElementById(containerId);
  if (container) {
    container.style.display = 'none';
  }
}

/**
 * Mostrar loading en contenedor
 */
export function showLoading(containerId, message = 'Cargando...') {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = `<div class="loading">${message}</div>`;
  }
}

/**
 * Crear elemento con clases y atributos
 */
export function createElement(tag, options = {}) {
  const element = document.createElement(tag);
  
  if (options.className) {
    element.className = options.className;
  }
  
  if (options.id) {
    element.id = options.id;
  }
  
  if (options.html) {
    element.innerHTML = options.html;
  }
  
  if (options.text) {
    element.textContent = options.text;
  }
  
  if (options.attributes) {
    Object.entries(options.attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
  }
  
  if (options.dataset) {
    Object.entries(options.dataset).forEach(([key, value]) => {
      element.dataset[key] = value;
    });
  }
  
  if (options.onclick) {
    element.onclick = options.onclick;
  }
  
  return element;
}

/**
 * Scroll suave a elemento
 */
export function scrollToElement(elementId, behavior = 'smooth') {
  const element = document.getElementById(elementId);
  if (element) {
    element.scrollIntoView({ behavior });
  }
}

/**
 * Debounce para eventos
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Formatear fecha
 */
export function formatDate(dateString, locale = 'es-ES', options = {}) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString(locale, options);
}

/**
 * Formatear hora
 */
export function formatTime(timeString) {
  if (!timeString) return '';
  return timeString.substring(0, 5); // HH:MM
}

/**
 * Obtener nombre del día de la semana
 */
export function getDayName(dayNumber, locale = 'es-ES') {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return days[dayNumber] || '';
}
