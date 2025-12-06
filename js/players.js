// players.js - Lógica para gestión de jugadores
import { supabase } from '../js/supabaseClient.js';

// Sesión
const { data: sessionData } = await supabase.auth.getSession();
if (!sessionData.session) {
  window.location.href = '/pages/index.html';
  throw new Error('No session');
}
const user = sessionData.session.user;

// team_id desde querystring
const params = new URLSearchParams(window.location.search);
const teamId = params.get('team_id');
if (!teamId) {
  document.getElementById('errorMsg').innerText = 'Error: falta team_id en la URL.';
  throw new Error('Missing team_id');
}

// Mi rol actual
let myRole = null;

async function loadMyRole() {
  const { data, error } = await supabase
    .from('team_staff')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .eq('active', true)
    .single();

  if (error || !data) {
    document.getElementById('errorMsg').innerText = 'No tienes permiso para ver este equipo.';
    throw new Error('No permission');
  }

  myRole = data.role;
}

// Estado de edición
let editingId = null;

// Helpers
function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function getFilters() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  return { q };
}

// Carga y render
async function loadPlayers() {
  await loadMyRole();

  const container = document.getElementById('playersList');
  container.innerHTML = 'Cargando...';

  // Traer jugadores del equipo
  const { data, error } = await supabase
    .from('players')
    .select('id, name, number, position, notes, active, created_at')
    .eq('team_id', teamId)
    .order('number', { ascending: true });

  if (error) {
    container.innerText = 'Error cargando jugadores: ' + error.message;
    console.error(error);
    return;
  }

  const { q } = getFilters();
  let list = data || [];
  if (q) {
    list = list.filter(x =>
      (x.name || '').toLowerCase().includes(q) ||
      (x.number !== null && String(x.number).includes(q))
    );
  }

  if (list.length === 0) {
    container.innerHTML = '<p class="muted">No hay jugadores.</p>';
    return;
  }

  container.innerHTML = '';
  list.forEach(p => {
    const card = document.createElement('div');
    card.className = 'card';

    const left = document.createElement('div');
    left.innerHTML = `<strong>${escapeHtml(p.name)}</strong> <span class="muted">#${p.number ?? '-'}</span><br>
                      <span class="muted">${p.position ? escapeHtml(p.position) + ' • ' : ''}${p.notes ? escapeHtml(p.notes) : ''}</span>`;

    const right = document.createElement('div');

    // Editar (principal/segundo)
    if (myRole === 'principal' || myRole === 'segundo') {
      const editBtn = document.createElement('button');
      editBtn.className = 'btn small';
      editBtn.textContent = 'Editar';
      editBtn.onclick = () => openEditForm(p);
      right.appendChild(editBtn);
    }

    // Eliminar (solo principal)
    if (myRole === 'principal') {
      const delBtn = document.createElement('button');
      delBtn.className = 'btn danger';
      delBtn.style.marginLeft = '8px';
      delBtn.textContent = 'Eliminar';
      delBtn.onclick = async () => {
        if (!confirm('¿Eliminar jugador? Esta acción es irreversible.')) return;
        
        // Limpiar UI rápidamente
        document.getElementById('playersList').innerHTML = 'Actualizando...';
        const { error } = await supabase.from('players').delete().eq('id', p.id);
        if (error) {
          alert('Error eliminando: ' + error.message);
          loadPlayers();
          return;
        }
        loadPlayers();
      };
      right.appendChild(delBtn);
    }

    card.appendChild(left);
    card.appendChild(right);
    container.appendChild(card);
  });
}

// Abrir formulario para editar
function openEditForm(player) {
  editingId = player.id;
  document.getElementById('formTitle').innerText = 'Editar jugador';
  document.getElementById('playerName').value = player.name || '';
  document.getElementById('playerNumber').value = player.number ?? '';
  document.getElementById('playerPosition').value = player.position || '';
  document.getElementById('playerNotes').value = player.notes || '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Cancelar edición
document.getElementById('cancelEditBtn').onclick = (e) => {
  e.preventDefault();
  resetForm();
};

function resetForm() {
  editingId = null;
  document.getElementById('formTitle').innerText = 'Añadir jugador';
  document.getElementById('playerName').value = '';
  document.getElementById('playerNumber').value = '';
  document.getElementById('playerPosition').value = '';
  document.getElementById('playerNotes').value = '';
}

// Guardar (crear o actualizar)
document.getElementById('savePlayerBtn').onclick = async () => {
  // Validar permisos
  await loadMyRole();
  if (!(myRole === 'principal' || myRole === 'segundo')) {
    alert('No tienes permiso para añadir/editar jugadores.');
    return;
  }

  const name = document.getElementById('playerName').value.trim();
  const numberRaw = document.getElementById('playerNumber').value.trim();
  const position = document.getElementById('playerPosition').value.trim();
  const notes = document.getElementById('playerNotes').value.trim();

  // Validaciones: name + dorsal obligatorios
  if (!name) { alert('El nombre es obligatorio.'); return; }
  if (!numberRaw) { alert('El dorsal es obligatorio.'); return; }
  const number = parseInt(numberRaw, 10);
  if (Number.isNaN(number) || number < 0) { alert('Dorsal inválido.'); return; }

  // Preparar payload
  const payload = {
    team_id: teamId,
    name,
    number,
    position: position || null,
    notes: notes || null,
    active: true
  };

  // Limpiar UI inmediatamente
  document.getElementById('playersList').innerHTML = 'Actualizando...';

  if (editingId) {
    // Update
    const { error } = await supabase.from('players').update(payload).eq('id', editingId);
    if (error) {
      alert('Error actualizando jugador: ' + error.message);
      loadPlayers();
      return;
    }
    alert('Jugador actualizado.');
    resetForm();
    await loadPlayers();
    return;
  } else {
    // Insert
    const { error } = await supabase.from('players').insert(payload);
    if (error) {
      alert('Error añadiendo jugador: ' + error.message);
      loadPlayers();
      return;
    }
    alert('Jugador añadido.');
    resetForm();
    await loadPlayers();
    return;
  }
};

// Filtros y eventos
document.getElementById('refreshBtn').onclick = () => loadPlayers();
document.getElementById('searchInput').oninput = debounce(() => loadPlayers(), 300);

// Debounce
function debounce(fn, wait) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(()=>fn(...a), wait); };
}

// Inicial
loadPlayers();
