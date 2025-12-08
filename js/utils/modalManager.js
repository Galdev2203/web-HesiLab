// modalManager.js - Gestor de modales reutilizable
/**
 * Clase para gestionar modales de forma unificada
 */
export class ModalManager {
  constructor(modalId) {
    this.modal = document.getElementById(modalId);
    if (!this.modal) {
      console.error(`Modal con id "${modalId}" no encontrado`);
      return;
    }
    
    this.modalTitle = this.modal.querySelector('.modal-header h3');
    this.closeBtn = this.modal.querySelector('.close-modal');
    this.cancelBtn = this.modal.querySelector('.secondary-btn');
    this.saveBtn = this.modal.querySelector('.primary-btn');
    
    this.mode = 'create';
    this.onSave = null;
    this.onClose = null;
    
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Cerrar modal
    if (this.closeBtn) {
      this.closeBtn.onclick = () => this.close();
    }
    
    if (this.cancelBtn) {
      this.cancelBtn.onclick = () => this.close();
    }
    
    // Cerrar al hacer clic fuera
    this.modal.onclick = (e) => {
      if (e.target === this.modal) this.close();
    };
    
    // Cerrar con ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });
    
    // Guardar
    if (this.saveBtn) {
      this.saveBtn.onclick = (e) => {
        if (this.onSave) this.onSave(e);
      };
    }
  }
  
  open(mode = 'create', title = '') {
    this.mode = mode;
    if (this.modalTitle) {
      this.modalTitle.textContent = title;
    }
    this.modal.classList.add('show');
    this.modal.style.display = 'flex';
  }
  
  close() {
    this.modal.classList.remove('show');
    setTimeout(() => {
      this.modal.style.display = 'none';
    }, 200);
    
    if (this.onClose) this.onClose();
  }
  
  isOpen() {
    return this.modal.style.display === 'flex';
  }
  
  setTitle(title) {
    if (this.modalTitle) {
      this.modalTitle.textContent = title;
    }
  }
  
  getMode() {
    return this.mode;
  }
}
