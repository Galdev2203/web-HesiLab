// cardRenderer.js - Sistema de renderizado de cards reutilizable
/**
 * Clase base para renderizar cards con menú de 3 puntos
 */
export class CardRenderer {
  constructor(containerId) {
    this.containerId = containerId;
    this.items = [];
    this.canManage = false;
    this.editCallback = null;
    this.deleteCallback = null;
  }
  
  getContainer() {
    return document.getElementById(this.containerId);
  }
  
  setItems(items) {
    this.items = items;
  }
  
  setCanManage(canManage) {
    this.canManage = canManage;
  }
  
  render(emptyMessage = 'No hay elementos') {
    const container = this.getContainer();
    
    if (!container) {
      console.error('Container not found:', this.containerId);
      return;
    }
    
    if (this.items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>${emptyMessage}</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = '';
    
    this.items.forEach(item => {
      const card = this.createCard(item);
      container.appendChild(card);
    });
    
    this.attachMenuHandlers();
    this.attachCallbacks();
  }
  
  createCard(item) {
    // Método a sobrescribir por clases hijas
    const div = document.createElement('div');
    div.className = 'item-card';
    return div;
  }
  
  attachMenuHandlers() {
    // Toggle menú
    document.querySelectorAll('.menu-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const dropdown = btn.nextElementSibling;
        
        document.querySelectorAll('.menu-dropdown.show').forEach(menu => {
          if (menu !== dropdown) menu.classList.remove('show');
        });
        
        dropdown.classList.toggle('show');
      };
    });
    
    // Cerrar menús al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.item-menu')) {
        document.querySelectorAll('.menu-dropdown.show').forEach(menu => {
          menu.classList.remove('show');
        });
      }
    });
  }
  
  createMenuButton(itemId, options = {}) {
    const { showEdit = true, showDelete = true } = options;
    
    if (!this.canManage) return '';
    
    return `
      <div class="item-menu">
        <button class="menu-btn" data-id="${itemId}">⋮</button>
        <div class="menu-dropdown">
          ${showEdit ? `<button class="menu-item edit-item" data-id="${itemId}">✏️ Editar</button>` : ''}
          ${showDelete ? `<button class="menu-item delete delete-item" data-id="${itemId}">🗑️ Eliminar</button>` : ''}
        </div>
      </div>
    `;
  }
  
  onEdit(callback) {
    this.editCallback = callback;
  }
  
  onDelete(callback) {
    this.deleteCallback = callback;
  }
  
  attachCallbacks() {
    // Edit buttons
    if (this.editCallback) {
      document.querySelectorAll('.edit-item').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const itemId = btn.dataset.id;
          const item = this.items.find(i => i.id == itemId);
          if (item) this.editCallback(item);
          btn.closest('.menu-dropdown')?.classList.remove('show');
        };
      });
    }
    
    // Delete buttons  
    if (this.deleteCallback) {
      document.querySelectorAll('.delete-item').forEach(btn => {
        btn.onclick = async (e) => {
          e.stopPropagation();
          const itemId = btn.dataset.id;
          await this.deleteCallback(itemId);
          btn.closest('.menu-dropdown')?.classList.remove('show');
        };
      });
    }
  }
}
