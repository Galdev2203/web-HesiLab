// cardRenderer.js - Sistema de renderizado de cards reutilizable
/**
 * Clase base para renderizar cards con menú de 3 puntos
 */
export class CardRenderer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.items = [];
    this.canManage = false;
  }
  
  setItems(items) {
    this.items = items;
  }
  
  setCanManage(canManage) {
    this.canManage = canManage;
  }
  
  render(emptyMessage = 'No hay elementos') {
    if (!this.container) return;
    
    if (this.items.length === 0) {
      this.container.innerHTML = `
        <div class="empty-state">
          <p>${emptyMessage}</p>
        </div>
      `;
      return;
    }
    
    this.container.innerHTML = '';
    
    this.items.forEach(item => {
      const card = this.createCard(item);
      this.container.appendChild(card);
    });
    
    this.attachMenuHandlers();
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
    document.querySelectorAll('.edit-item').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const itemId = btn.dataset.id;
        const item = this.items.find(i => i.id === itemId);
        if (item) callback(item);
        btn.closest('.menu-dropdown').classList.remove('show');
      };
    });
  }
  
  onDelete(callback) {
    document.querySelectorAll('.delete-item').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const itemId = btn.dataset.id;
        await callback(itemId);
        btn.closest('.menu-dropdown').classList.remove('show');
      };
    });
  }
}
