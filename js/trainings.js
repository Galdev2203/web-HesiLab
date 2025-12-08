// trainings.js - Gestión de entrenamientos del equipo
import { supabase } from './supabaseClient.js';
import { initHeader } from './headerComponent.js';
import { initPermissions, hasPermission, getUserRole, getRoleLabel } from './permissionsHelper.js';
import { ModalManager } from './utils/modalManager.js';
import { CardRenderer } from './utils/cardRenderer.js';
import { FormValidator, getFormValue, setFormValue, clearForm } from './utils/formValidator.js';
import { requireSession, requireTeamId, loadData, insertData, updateData, deleteData } from './utils/supabaseHelpers.js';
import { escapeHtml, showError, hideError, showLoading, getDayName, formatTime } from './utils/domHelpers.js';

// Indicador visual de versión refactorizada
console.log('✅ VERSIÓN REFACTORIZADA - Usando arquitectura modular con utilidades reutilizables');

// Validar sesión y obtener team_id
await requireSession();
const teamId = requireTeamId();

// Inicializar header
await initHeader({
  title: '🏃 Entrenamientos',
  backUrl: true,
  activeNav: null
});

// Inicializar permisos
await initPermissions();
const canManage = await hasPermission(teamId, 'MANAGE_TRAININGS');
const userRole = await getUserRole(teamId);

if (!canManage) {
  showError(`No tienes permiso para gestionar entrenamientos. Tu rol: ${getRoleLabel(userRole)}`);
}

// Inicializar modal
const modal = new ModalManager('trainingModal');
const validator = new FormValidator();
let editingId = null;

// Clase personalizada para renderizar cards de entrenamientos
class TrainingCardRenderer extends CardRenderer {
  createCard(training) {
    const div = document.createElement('div');
    div.className = 'item-card';
    div.dataset.trainingid = training.id;

    const startTime = formatTime(training.start_time);
    const endTime = formatTime(training.end_time);
    const dayName = getDayName(training.weekday);

    div.innerHTML = `
      <div class="item-card-header">
        <div class="item-info">
          <div class="item-title">🕐 ${startTime} - ${endTime}</div>
          <div class="item-subtitle">${dayName}</div>
        </div>
        ${this.createMenuButton(training.id)}
      </div>
      ${training.location || training.notes ? `
        <div class="item-meta">
          ${training.location ? `<div class="item-meta-row">📍 ${escapeHtml(training.location)}</div>` : ''}
          ${training.notes ? `<div class="item-meta-row">${escapeHtml(training.notes)}</div>` : ''}
        </div>
      ` : ''}
    `;

    return div;
  }
}

const cardRenderer = new TrainingCardRenderer('trainingsList');
cardRenderer.setCanManage(canManage);

/**
 * Cargar entrenamientos
 */
async function loadTrainings() {
  showLoading('trainingsList', 'Cargando entrenamientos...');

  try {
    const trainings = await loadData(
      supabase
        .from('team_training_sessions')
        .select('*')
        .eq('team_id', teamId)
        .order('weekday', { ascending: true })
        .order('start_time', { ascending: true }),
      'Error cargando entrenamientos'
    );

    cardRenderer.setItems(trainings);
    cardRenderer.render('Aún no hay entrenamientos configurados');
    
    // Configurar handlers
    cardRenderer.onEdit(openEditModal);
    cardRenderer.onDelete(handleDelete);
    
  } catch (error) {
    showError(error.message);
  }
}

/**
 * Abrir modal para crear
 */
function openCreateModal() {
  if (!canManage) {
    alert('No tienes permiso para gestionar entrenamientos');
    return;
  }
  
  editingId = null;
  modal.open('create', 'Añadir entrenamiento');
  clearForm(['weekday', 'startTime', 'endTime', 'location', 'notes']);
}

/**
 * Abrir modal para editar
 */
function openEditModal(training) {
  editingId = training.id;
  modal.open('edit', 'Editar entrenamiento');
  
  setFormValue('weekday', training.weekday);
  setFormValue('startTime', training.start_time);
  setFormValue('endTime', training.end_time);
  setFormValue('location', training.location);
  setFormValue('notes', training.notes);
}

/**
 * Guardar entrenamiento
 */
async function saveTraining(e) {
  e.preventDefault();
  
  if (!canManage) {
    alert('No tienes permiso para gestionar entrenamientos');
    return;
  }

  // Validar
  validator.reset();
  
  const weekday = getFormValue('weekday', 'int');
  const startTime = getFormValue('startTime', 'trim');
  const endTime = getFormValue('endTime', 'trim');
  const location = getFormValue('location', 'trim');
  const notes = getFormValue('notes', 'trim');

  validator.range(weekday, 0, 6, 'Día de la semana');
  validator.required(startTime, 'Hora de inicio');
  validator.required(endTime, 'Hora de fin');
  validator.timeRange(startTime, endTime);

  if (!validator.isValid()) {
    validator.showErrors();
    return;
  }

  const trainingData = {
    team_id: teamId,
    weekday,
    start_time: startTime,
    end_time: endTime,
    location: location || null,
    notes: notes || null
  };

  // Guardar
  let result;
  if (editingId) {
    result = await updateData('team_training_sessions', editingId, trainingData, 'Entrenamiento actualizado');
  } else {
    result = await insertData('team_training_sessions', trainingData, 'Entrenamiento añadido');
  }

  if (result.success) {
    alert(result.message);
    modal.close();
    loadTrainings();
  } else {
    alert(`Error: ${result.error}`);
  }
}

/**
 * Eliminar entrenamiento
 */
async function handleDelete(trainingId) {
  if (!confirm('¿Eliminar este horario de entrenamiento?')) return;

  const result = await deleteData('team_training_sessions', trainingId, 'Entrenamiento eliminado');
  
  if (result.success) {
    loadTrainings();
  } else {
    alert(`Error: ${result.error}`);
  }
}

// Inicializar cuando el DOM esté listo
async function init() {
  const fabBtn = document.getElementById('fabBtn');
  if (fabBtn) {
    fabBtn.onclick = openCreateModal;
  }

  // Configurar modal
  modal.onSave = saveTraining;
  modal.onClose = () => {
    editingId = null;
  };

  // Cargar inicial
  await loadTrainings();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
