// accessibility.js - Mejoras de accesibilidad y navegación por teclado

/**
 * Inicializa mejoras de accesibilidad en toda la aplicación
 */
export function initAccessibility() {
  setupKeyboardNavigation();
  setupFocusTrap();
  setupAriaLiveRegions();
  setupSkipLinks();
  announcePageLoaded();
}

/**
 * Configura navegación por teclado mejorada
 */
function setupKeyboardNavigation() {
  // Navegación por Tab en modales
  document.addEventListener('keydown', (e) => {
    // Cerrar modal con Escape
    if (e.key === 'Escape') {
      const openModal = document.querySelector('.modal[style*="display: flex"]');
      if (openModal) {
        const closeBtn = openModal.querySelector('.close-btn');
        if (closeBtn) closeBtn.click();
      }
    }
    
    // Cerrar sidebar con Escape en móvil
    if (e.key === 'Escape') {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebarOverlay');
      if (sidebar && sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
      }
    }
  });

  // Mejorar navegación en dropdown menus
  const menuButtons = document.querySelectorAll('[aria-haspopup="true"]');
  menuButtons.forEach(button => {
    button.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        button.click();
      }
    });
  });
}

/**
 * Implementa focus trap en modales activos
 */
function setupFocusTrap() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'style') {
        const modal = mutation.target;
        if (modal.classList.contains('modal')) {
          const isVisible = window.getComputedStyle(modal).display !== 'none';
          
          if (isVisible) {
            trapFocus(modal);
          }
        }
      }
    });
  });

  // Observar todos los modales
  document.querySelectorAll('.modal').forEach(modal => {
    observer.observe(modal, { attributes: true });
  });
}

/**
 * Atrapa el foco dentro de un elemento
 */
function trapFocus(element) {
  const focusableElements = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  if (focusableElements.length === 0) return;
  
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  // Enfocar el primer elemento
  setTimeout(() => firstElement.focus(), 100);

  const handleTabKey = (e) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  element.addEventListener('keydown', handleTabKey);
  
  // Limpiar event listener cuando el modal se cierra
  const observer = new MutationObserver(() => {
    const isVisible = window.getComputedStyle(element).display !== 'none';
    if (!isVisible) {
      element.removeEventListener('keydown', handleTabKey);
      observer.disconnect();
    }
  });
  
  observer.observe(element, { attributes: true, attributeFilter: ['style'] });
}

/**
 * Configura regiones ARIA live para anuncios dinámicos
 */
function setupAriaLiveRegions() {
  // Crear región para anuncios polite (no interrumpen)
  if (!document.getElementById('aria-live-polite')) {
    const politeRegion = document.createElement('div');
    politeRegion.id = 'aria-live-polite';
    politeRegion.className = 'sr-only';
    politeRegion.setAttribute('aria-live', 'polite');
    politeRegion.setAttribute('aria-atomic', 'true');
    document.body.appendChild(politeRegion);
  }

  // Crear región para anuncios assertive (interrumpen)
  if (!document.getElementById('aria-live-assertive')) {
    const assertiveRegion = document.createElement('div');
    assertiveRegion.id = 'aria-live-assertive';
    assertiveRegion.className = 'sr-only';
    assertiveRegion.setAttribute('aria-live', 'assertive');
    assertiveRegion.setAttribute('aria-atomic', 'true');
    document.body.appendChild(assertiveRegion);
  }
}

/**
 * Anuncia un mensaje a lectores de pantalla
 * @param {string} message - Mensaje a anunciar
 * @param {string} priority - 'polite' o 'assertive'
 */
export function announce(message, priority = 'polite') {
  const regionId = priority === 'assertive' ? 'aria-live-assertive' : 'aria-live-polite';
  const region = document.getElementById(regionId);
  
  if (region) {
    // Limpiar y establecer nuevo mensaje
    region.textContent = '';
    setTimeout(() => {
      region.textContent = message;
    }, 100);
  }
}

/**
 * Configura skip links funcionales
 */
function setupSkipLinks() {
  const skipLink = document.querySelector('.skip-link');
  if (skipLink) {
    skipLink.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(skipLink.getAttribute('href'));
      if (target) {
        target.setAttribute('tabindex', '-1');
        target.focus();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }
}

/**
 * Anuncia que la página ha cargado
 */
function announcePageLoaded() {
  const pageTitle = document.title;
  setTimeout(() => {
    announce(`Página cargada: ${pageTitle}`, 'polite');
  }, 1000);
}

/**
 * Actualiza el estado ARIA de un elemento colapsable
 * @param {HTMLElement} button - Botón que controla el colapso
 * @param {boolean} isExpanded - Estado expandido
 */
export function updateAriaExpanded(button, isExpanded) {
  button.setAttribute('aria-expanded', isExpanded.toString());
  const icon = button.querySelector('.collapse-icon');
  if (icon) {
    icon.textContent = isExpanded ? '▼' : '▶';
  }
}

/**
 * Marca un elemento como región live para actualizaciones dinámicas
 * @param {HTMLElement} element - Elemento a marcar
 * @param {string} priority - 'polite' o 'assertive'
 */
export function makeAriaLive(element, priority = 'polite') {
  element.setAttribute('aria-live', priority);
  element.setAttribute('aria-atomic', 'true');
}

/**
 * Mejora la accesibilidad de botones de menú
 * @param {HTMLElement} button - Botón de menú
 * @param {HTMLElement} menu - Menú asociado
 */
export function setupMenuButton(button, menu) {
  button.setAttribute('aria-haspopup', 'true');
  button.setAttribute('aria-expanded', 'false');
  menu.setAttribute('role', 'menu');
  
  const menuItems = menu.querySelectorAll('a, button');
  menuItems.forEach(item => {
    item.setAttribute('role', 'menuitem');
  });

  button.addEventListener('click', () => {
    const isExpanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', (!isExpanded).toString());
  });

  // Navegación por teclado en el menú
  menu.addEventListener('keydown', (e) => {
    const items = Array.from(menuItems);
    const currentIndex = items.indexOf(document.activeElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % items.length;
      items[nextIndex].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + items.length) % items.length;
      items[prevIndex].focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1].focus();
    }
  });
}

/**
 * Añade indicadores visuales de carga accesibles
 * @param {HTMLElement} container - Contenedor donde mostrar el indicador
 * @param {string} message - Mensaje de carga
 */
export function showAccessibleLoader(container, message = 'Cargando...') {
  const loader = document.createElement('div');
  loader.className = 'accessible-loader';
  loader.setAttribute('role', 'status');
  loader.setAttribute('aria-live', 'polite');
  
  loader.innerHTML = `
    <div class="spinner" aria-hidden="true"></div>
    <span class="sr-only">${message}</span>
  `;
  
  container.appendChild(loader);
  return loader;
}

/**
 * Elimina el indicador de carga
 * @param {HTMLElement} loader - Elemento loader a eliminar
 * @param {string} completionMessage - Mensaje de completado
 */
export function hideAccessibleLoader(loader, completionMessage = 'Carga completada') {
  if (loader) {
    announce(completionMessage, 'polite');
    setTimeout(() => loader.remove(), 300);
  }
}

// Auto-inicializar si el DOM está listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAccessibility);
} else {
  initAccessibility();
}
