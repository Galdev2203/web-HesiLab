// trainings.js - Gestión de entrenamientos recurrentes
import { supabase } from '../js/supabaseClient.js';
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

// Inicializar permisos
await initPermissions();

// Obtener team_id
const params = new URLSearchParams(window.location.search);
const teamId = params.get('team_id');

if (!teamId) {
  document.getElementById('errorMsg').style.display = 'block';
  document.getElementById('errorMsg').innerText = 'Error: falta team_id';
  throw new Error('Missing team_id');
}

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
let allTrainings = [];

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

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
        <div class="empty-icon">⚽</div>
        <p>Aún no hay entrenamientos configurados</p>
        <p class="empty-hint">Usa el formulario de abajo para añadir los horarios semanales</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  
  // Agrupar por día
  const byDay = {};
  allTrainings.forEach(t => {
    if (!byDay[t.weekday]) byDay[t.weekday] = [];
    byDay[t.weekday].push(t);
  });

  // Renderizar por día (ordenado)
  [1, 2, 3, 4, 5, 6, 0].forEach(day => {
    if (!byDay[day]) return;
    
    const dayCard = document.createElement('div');
    dayCard.className = 'training-day-card';
    
    const dayHeader = document.createElement('div');
    dayHeader.className = 'training-day-header';
    dayHeader.textContent = WEEKDAYS[day];
    dayCard.appendChild(dayHeader);
    
    byDay[day].forEach(training => {
      const item = createTrainingItem(training);
      dayCard.appendChild(item);
    });
    
    container.appendChild(dayCard);
  });
}

/**
 * Crear item de entrenamiento
 */
function createTrainingItem(training) {
  const item = document.createElement('div');
  item.className = 'training-item fade-in';

  const startTime = training.start_time.substring(0, 5); // HH:MM
  const endTime = training.end_time.substring(0, 5);

  item.innerHTML = `
    <div class="training-time">
      <span class="time-badge">🕐 ${startTime} - ${endTime}</span>
    </div>
    <div class="training-details">
      ${training.location ? `<div class="training-location">📍 ${escapeHtml(training.location)}</div>` : ''}
      ${training.notes ? `<div class="training-notes">${escapeHtml(training.notes)}</div>` : ''}
    </div>
    <div class="training-actions" id="actions-${training.id}"></div>
  `;

  if (canManage) {
    const actionsContainer = item.querySelector(`#actions-${training.id}`);
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-outline btn-sm';
    editBtn.textContent = '✏️';
    editBtn.onclick = () => openEditForm(training);
    actionsContainer.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger btn-sm';
    deleteBtn.textContent = '🗑️';
    deleteBtn.onclick = () => deleteTraining(training.id);
    actionsContainer.appendChild(deleteBtn);
  }

  return item;
}

/**
 * Abrir formulario para editar
 */
function openEditForm(training) {
  editingId = training.id;
  document.getElementById('formTitle').textContent = 'Editar entrenamiento';
  document.getElementById('weekday').value = training.weekday;
  document.getElementById('startTime').value = training.start_time;
  document.getElementById('endTime').value = training.end_time;
  document.getElementById('location').value = training.location || '';
  document.getElementById('notes').value = training.notes || '';
  
  document.getElementById('cancelBtn').style.display = 'inline-block';
  document.getElementById('saveBtn').textContent = '💾 Guardar';
  
  const formBox = document.getElementById('formBox');
  if (formBox) formBox.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Resetear formulario
 */
function resetForm() {
  editingId = null;
  document.getElementById('formTitle').textContent = 'Añadir entrenamiento';
  document.getElementById('weekday').value = '';
  document.getElementById('startTime').value = '';
  document.getElementById('endTime').value = '';
  document.getElementById('location').value = '';
  document.getElementById('notes').value = '';
  document.getElementById('cancelBtn').style.display = 'none';
  document.getElementById('saveBtn').textContent = '➕ Añadir';
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
    } else {
      const { error } = await supabase
        .from('team_training_sessions')
        .insert(trainingData);
      if (error) throw error;
    }

    resetForm();
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
document.getElementById('saveBtn')?.addEventListener('click', saveTraining);
document.getElementById('cancelBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  resetForm();
});

// Cargar inicial
loadTrainings();
