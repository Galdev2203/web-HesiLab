// team_staff.js - Lógica para gestión de entrenadores
import { supabase } from "../js/supabaseClient.js";
import { initHeader } from "../js/headerComponent.js";
import { initPermissions, hasPermission } from "../js/permissionsHelper.js";

// Validar sesión
const { data: sessionData } = await supabase.auth.getSession();
if (!sessionData.session) {
  window.location.href = "/pages/index.html";
  throw new Error("No session");
}
const user = sessionData.session.user;

// Obtener team_id
const params = new URLSearchParams(window.location.search);
const teamId = params.get("team_id");

if (!teamId) {
  document.getElementById("errorMsg").innerText = "Error: falta team_id.";
  throw new Error("Missing team_id");
}

// Mi rol actual
let myRole = null;
let canManageStaff = false;

// Inicializar permisos
await initPermissions();

async function loadMyRole() {
  const { data, error } = await supabase
    .from("team_staff")
    .select("role, id")
    .eq("team_id", teamId)
    .eq("user_id", user.id)
    .eq("active", true)
    .single();

  if (error || !data) {
    console.error("Error cargando rol:", error);
    document.getElementById("errorMsg").innerText = "No tienes permiso para ver este equipo.";
    document.getElementById("errorMsg").style.display = "block";
    throw new Error("No permission");
  }

  myRole = data.role;
  console.log('Mi rol:', myRole, 'Staff ID:', data.id);
  
  // Verificar permiso para gestionar staff
  // Aceptar tanto 'principal' (español) como 'HEAD_COACH' (inglés)
  const isPrincipal = myRole === 'principal' || myRole === 'HEAD_COACH';
  const hasManageStaffPerm = await hasPermission(teamId, 'MANAGE_STAFF');
  
  canManageStaff = hasManageStaffPerm || isPrincipal;
  
  console.log('=== DEBUG PERMISOS ===');
  console.log('Rol:', myRole);
  console.log('Es principal:', isPrincipal);
  console.log('Tiene MANAGE_STAFF:', hasManageStaffPerm);
  console.log('Puede gestionar staff:', canManageStaff);
  console.log('=====================');
}

// Inicializar header
await initHeader({
  title: 'Entrenadores',
  backUrl: true, // Usa history.back()
  activeNav: null
});

// Cargar staff
async function loadStaff() {
  await loadMyRole();
  
  // Mostrar/ocultar FAB según permisos
  const fab = document.getElementById('fabBtn');
  if (fab) {
    fab.style.display = canManageStaff ? 'flex' : 'none';
  }

  const container = document.getElementById("staffList");
  container.innerHTML = "Cargando...";

  const { data, error } = await supabase
    .from("team_staff")
    .select("id, role, user_id, profiles(id, email)")
    .eq("team_id", teamId)
    .eq("active", true);

  if (error) {
    container.innerText = "Error cargando staff.";
    console.error(error);
    return;
  }

  if (data.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No hay entrenadores en este equipo.</p></div>';
    return;
  }

  container.innerHTML = "";

  data.forEach(staff => {
    const card = document.createElement("div");
    card.className = "item-card";

    const isMe = staff.user_id === user.id;
    const roleLabel = staff.role === 'principal' || staff.role === 'HEAD_COACH' ? '👔 Principal' : 
                     staff.role === 'segundo' ? '🎽 Segundo' : '🏃 Ayudante';

    card.innerHTML = `
      <div class="item-card-header">
        <div class="item-info">
          <div class="item-title">${staff.profiles?.email || "(sin email)"}</div>
          <div class="item-subtitle">${roleLabel}</div>
        </div>
        ${canManageStaff && !isMe ? `
          <div class="item-menu">
            <button class="menu-btn" data-id="${staff.id}">⋮</button>
            <div class="menu-dropdown">
              <button class="menu-item delete delete-item" data-id="${staff.id}" data-user="${staff.user_id}">🗑️ Eliminar</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    container.appendChild(card);
  });

  // Agregar manejadores para menú de 3 puntos
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

  document.querySelectorAll('.delete-item').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const staffId = btn.dataset.id;
      const userId = btn.dataset.user;
      if (confirm('¿Eliminar este entrenador del equipo?')) {
        await deleteStaff(staffId, userId);
      }
      btn.closest('.menu-dropdown').classList.remove('show');
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

  // Guardar cambios de rol (usando RPC)
  document.querySelectorAll(".saveRoleBtn").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute("data-id");
      const newRole = btn.parentElement.parentElement.querySelector(".roleSelect").value;

      const { data: staffRow } = await supabase
        .from("team_staff")
        .select("user_id, role")
        .eq("id", id)
        .single();

      const userIdToEdit = staffRow.user_id;

      if (userIdToEdit === user.id) {
        alert("No puedes cambiar tu propio rol.");
        return;
      }

      // PROMOVER A PRINCIPAL (RPC)
      if (newRole === "principal") {
        const confirmChange = confirm(
          "Solo puede haber un principal.\n\n" +
          "Si continúas:\n" +
          "➡ El entrenador seleccionado será PRINCIPAL\n" +
          "➡ Tú pasarás a SEGUNDO\n" +
          "➡ Perderás permisos\n\n" +
          "¿Confirmas?"
        );

        if (!confirmChange) return;

        const { error: rpcError } = await supabase.rpc("transfer_principal", {
          p_team_id: teamId,
          p_new_principal: userIdToEdit
        });

        if (rpcError) {
          alert("Error al transferir principal: " + rpcError.message);
          return;
        }

        alert("Transferencia realizada correctamente.");

        // Limpiar UI inmediatamente
        document.getElementById("staffList").innerHTML = "Actualizando...";

        await loadMyRole();
        await loadStaff();
        return;
      }

      // Cambio normal (segundo/ayudante)
      const { error } = await supabase
        .from("team_staff")
        .update({ role: newRole })
        .eq("id", id);

      if (error) {
        alert("Error actualizando rol: " + error.message);
        return;
      }

      alert("Rol actualizado correctamente.");
      loadStaff();
    };
  });

  // Eliminar entrenador
  document.querySelectorAll(".deleteBtn").forEach(btn => {
    btn.onclick = async () => {
      const userIdToDelete = btn.getAttribute("data-user");

      if (userIdToDelete === user.id) {
        alert("No puedes eliminarte a ti mismo.");
        return;
      }

      if (!confirm("¿Eliminar este entrenador del equipo?")) return;

      const id = btn.getAttribute("data-id");

      const { error } = await supabase
        .from("team_staff")
        .delete()
        .eq("id", id);

      if (error) {
        alert("Error eliminando entrenador: " + error.message);
        return;
      }

      loadStaff();
    };
  });
  
  // Mostrar/ocultar formulario de añadir según permisos (después de cargar el rol)
  const addBox = document.getElementById('addBox');
  if (addBox) {
    if (canManageStaff) {
      addBox.style.display = 'block';
      console.log('Formulario de añadir entrenadores: VISIBLE');
    } else {
      addBox.style.display = 'none';
      console.log('Formulario de añadir entrenadores: OCULTO');
    }
  }
}

loadStaff();

// Añadir entrenador
document.getElementById("addBtn").onclick = async () => {
  const email = document.getElementById("emailInput").value.trim();
  const role = document.getElementById("roleInput").value;

  if (!email) {
    alert("Introduce un correo electrónico.");
    return;
  }

  // Obtener permisos seleccionados
  const selectedPermissions = [];
  const permCheckboxes = document.querySelectorAll('.permissions-grid input[type="checkbox"]:checked');
  permCheckboxes.forEach(checkbox => {
    selectedPermissions.push(checkbox.value);
  });

  const { data: usr, error } = await supabase.rpc("get_user_by_email", { p_email: email });

  if (error || !usr || usr.length === 0) {
    alert("No existe ningún usuario con ese email.");
    return;
  }

  const userIdToAdd = usr[0].id;

  // Insertar entrenador
  const { data: staffData, error: insertErr } = await supabase
    .from("team_staff")
    .insert({
      team_id: teamId,
      user_id: userIdToAdd,
      role: role
    })
    .select()
    .single();

  if (insertErr) {
    alert("Error al añadir entrenador: " + insertErr.message);
    return;
  }

  // Insertar permisos seleccionados
  if (selectedPermissions.length > 0) {
    const permissionsToInsert = selectedPermissions.map(perm => ({
      team_staff_id: staffData.id,
      permission: perm,
      value: true
    }));

    const { error: permErr } = await supabase
      .from("team_staff_permissions")
      .insert(permissionsToInsert);

    if (permErr) {
      console.error("Error al añadir permisos:", permErr);
      alert("Entrenador añadido, pero hubo un error al asignar algunos permisos.");
    }
  }

  // Limpiar formulario
  document.getElementById("emailInput").value = "";
  document.querySelectorAll('.permissions-grid input[type="checkbox"]').forEach(cb => {
    cb.checked = ['MANAGE_PLAYERS', 'MANAGE_TRAININGS', 'MANAGE_EVENTS', 'MANAGE_ATTENDANCE'].includes(cb.value);
  });
  
  alert("Entrenador añadido correctamente.");
  closeModal();
  loadStaff();
};

// Elementos del modal
const modal = document.getElementById('staffModal');
const fabBtn = document.getElementById('fabBtn');
const closeBtn = document.getElementById('closeModalBtn');
const cancelBtn = document.getElementById('cancelModalBtn');

/**
 * Abrir modal
 */
function openModal() {
  if (!canManageStaff) {
    alert('No tienes permiso para añadir entrenadores');
    return;
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
}

// Event listeners para modal
fabBtn.onclick = openModal;
closeBtn.onclick = closeModal;
cancelBtn.onclick = closeModal;

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
