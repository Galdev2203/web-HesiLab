// trainings.js - Gestión de entrenamientos recurrentes
import { supabase } from '../js/supabaseClient.js';
import { initHeader } from '../js/headerComponent.js';
import { 
  initPermissions, 
  hasPermission, 
  getUserRole,
  getRoleLabel 
} from '../js/permissionsHelper.js';

// Validar sesión
const { data: sessionData } = await supabase.auth.getSession();
if (!sessionData.session) {
  window.location.href = '/pages/index.html';
  throw new Error('No session');
}

// Obtener team_id
const params = new URLSearchParams(window.location.search);
const teamId = params.get('team_id');

if (!teamId) {
  alert('Error: falta team_id');
  window.location.href = '/pages/teams.html';
  throw new Error('Missing team_id');
}

// Inicializar header
await initHeader({
  title: '🏃 Entrenamientos',
  backUrl: true,
  activeNav: null
});

// Inicializar permisos
await initPermissions();

// Verificar permisos
const canManage = await hasPermission(teamId, 'MANAGE_TRAININGS');
const userRole = await getUserRole(teamId);

if (!canManage) {
  document.getElementById('errorMsg').style.display = 'block';
  document.getElementById('errorMsg').innerText = `No tienes permiso para gestionar entrenamientos. Tu rol: ${getRoleLabel(userRole)}`;
  const formBox = document.getElementById('formBox');
  if (formBox) formBox.style.display = 'none';
}

// Estado
let editingId = null;
let currentMode = 'create';
let allTrainings = [];

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Elementos del modal
const modal = document.getElementById('trainingModal');
const modalTitle = document.getElementById('modalTitle');
const fabBtn = document.getElementById('fabBtn');
const closeBtn = document.getElementById('closeModalBtn');
const cancelBtn = document.getElementById('cancelModalBtn');
const saveBtn = document.getElementById('saveBtn');

/**
 * Cargar entrenamientos
 */
async function loadTrainings() {
  const container = document.getElementById('trainingsList');
  container.innerHTML = '<div class="loading">Cargando entrenamientos...</div>';

  try {
    const { data, error } = await supabase
      .from('team_training_sessions')
      .select('*')
      .eq('team_id', teamId)
      .order('weekday', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) throw error;

    allTrainings = data || [];
    renderTrainings();
  } catch (error) {
    container.innerHTML = `<div class="error-state">Error: ${error.message}</div>`;
    console.error('Error loading trainings:', error);
  }
}

/**
 * Renderizar entrenamientos
 */
function renderTrainings() {
  const container = document.getElementById('trainingsList');

  if (allTrainings.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Aún no hay entrenamientos configurados</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  
  // Renderizar cada entrenamiento como card
  allTrainings.forEach(training => {
    const card = createTrainingCard(training);
    container.appendChild(card);
  });
  
  // Agregar manejadores para menú de 3 puntos
  attachMenuHandlers();
}

/**
 * Crear card de entrenamiento
 */
function createTrainingCard(training) {
  const div = document.createElement('div');
  div.className = 'item-card';
  div.dataset.trainingid = training.id;

  const startTime = training.start_time.substring(0, 5);
  const endTime = training.end_time.substring(0, 5);
  const dayName = WEEKDAYS[training.weekday];

  div.innerHTML = `
    <div class="item-card-header">
      <div class="item-info">
        <div class="item-title">🕐 ${startTime} - ${endTime}</div>
        <div class="item-subtitle">${dayName}</div>
      </div>
      ${canManage ? `
        <div class="item-menu">
          <button class="menu-btn" data-id="${training.id}">⋮</button>
          <div class="menu-dropdown">
            <button class="menu-item edit-item" data-id="${training.id}">✏️ Editar</button>
            <button class="menu-item delete delete-item" data-id="${training.id}">🗑️ Eliminar</button>
          </div>
        </div>
      ` : ''}
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

/**
 * Agregar manejadores para menú de 3 puntos
 */
function attachMenuHandlers() {
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

  // Editar
  document.querySelectorAll('.edit-item').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const trainingId = btn.dataset.id;
      const training = allTrainings.find(t => t.id === trainingId);
      if (training) openModal('edit', training);
      btn.closest('.menu-dropdown').classList.remove('show');
    };
  });

  // Eliminar
  document.querySelectorAll('.delete-item').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const trainingId = btn.dataset.id;
      await deleteTraining(trainingId);
      btn.closest('.menu-dropdown').classList.remove('show');
    };
  });
}

// Cerrar menús al hacer clic fuera
document.addEventListener('click', (e) => {
  if (!e.target.closest('.item-menu')) {
    document.querySelectorAll('.menu-dropdown.show').forEach(menu => {
      menu.classList.remove('show');
    });
  }
});

/**
 * Abrir modal
 */
function openModal(mode = 'create', training = null) {
  currentMode = mode;
  editingId = training ? training.id : null;
  
  if (mode === 'create') {
    modalTitle.textContent = 'Añadir entrenamiento';
    document.getElementById('weekday').value = '';
    document.getElementById('startTime').value = '';
    document.getElementById('endTime').value = '';
    document.getElementById('location').value = '';
    document.getElementById('notes').value = '';
  } else {
    modalTitle.textContent = 'Editar entrenamiento';
    document.getElementById('weekday').value = training.weekday;
    document.getElementById('startTime').value = training.start_time;
    document.getElementById('endTime').value = training.end_time;
    document.getElementById('location').value = training.location || '';
    document.getElementById('notes').value = training.notes || '';
  }
  
  modal.classList.add('show');
  modal.style.display = 'flex';
}

/**
 * Cerrar modal
 */
function closeModal() {
  modal.classList.remove('show');
  setTimeout(() => {
    modal.style.display = 'none';
  }, 200);
  editingId = null;
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

  const weekday = parseInt(document.getElementById('weekday').value);
  const startTime = document.getElementById('startTime').value;
  const endTime = document.getElementById('endTime').value;
  const location = document.getElementById('location').value.trim();
  const notes = document.getElementById('notes').value.trim();

  if (isNaN(weekday) || weekday < 0 || weekday > 6) {
    alert('Selecciona un día de la semana');
    return;
  }

  if (!startTime || !endTime) {
    alert('Debes indicar hora de inicio y fin');
    return;
  }

  if (startTime >= endTime) {
    alert('La hora de inicio debe ser anterior a la hora de fin');
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

  try {
    if (editingId) {
      const { error } = await supabase
        .from('team_training_sessions')
        .update(trainingData)
        .eq('id', editingId);
      if (error) throw error;
      alert('Entrenamiento actualizado');
    } else {
      const { error } = await supabase
        .from('team_training_sessions')
        .insert(trainingData);
      if (error) throw error;
      alert('Entrenamiento añadido');
    }

    closeModal();
    await loadTrainings();
  } catch (error) {
    console.error('Error saving training:', error);
    alert(`Error: ${error.message}`);
  }
}

/**
 * Eliminar entrenamiento
 */
async function deleteTraining(trainingId) {
  if (!confirm('¿Eliminar este horario de entrenamiento?')) return;

  try {
    const { error } = await supabase
      .from('team_training_sessions')
      .delete()
      .eq('id', trainingId);

    if (error) throw error;
    await loadTrainings();
  } catch (error) {
    console.error('Error deleting training:', error);
    alert(`Error: ${error.message}`);
  }
}

/**
 * Helpers
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Event listeners
fabBtn.onclick = () => openModal('create');
closeBtn.onclick = closeModal;
cancelBtn.onclick = closeModal;
saveBtn.addEventListener('click', saveTraining);

// Cerrar modal al hacer clic fuera
modal.onclick = (e) => {
  if (e.target === modal) closeModal();
};

// Cerrar con ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.style.display === 'flex') {
    closeModal();
  }
});

// Cargar inicial
loadTrainings();
