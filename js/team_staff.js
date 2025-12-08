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
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", user.id)
    .eq("active", true)
    .single();

  if (error || !data) {
    document.getElementById("errorMsg").innerText = "No tienes permiso para ver este equipo.";
    throw new Error("No permission");
  }

  myRole = data.role;
  
  // Verificar permiso para gestionar staff
  canManageStaff = await hasPermission(teamId, 'MANAGE_STAFF') || myRole === 'principal';
  console.log('Puede gestionar staff:', canManageStaff, 'Rol:', myRole);
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
    card.className = "staff-card";

    const staffInfo = document.createElement("div");
    staffInfo.className = "staff-info";

    const staffAvatar = document.createElement("div");
    staffAvatar.className = "staff-avatar";
    staffAvatar.textContent = staff.role === 'principal' ? '👔' : staff.role === 'segundo' ? '🎽' : '🏃';

    const staffDetails = document.createElement("div");
    staffDetails.className = "staff-details";

    const staffEmail = document.createElement("div");
    staffEmail.className = "staff-email";
    staffEmail.textContent = staff.profiles?.email || "(sin email)";

    const staffRoleDisplay = document.createElement("div");
    staffRoleDisplay.className = "staff-role-display";

    const roleSelect = document.createElement("select");
    roleSelect.className = "roleSelect";
    roleSelect.setAttribute("data-id", staff.id);
    roleSelect.innerHTML = `
      <option value="principal" ${staff.role === "principal" ? "selected" : ""}>👔 Principal</option>
      <option value="segundo" ${staff.role === "segundo" ? "selected" : ""}>🎽 Segundo</option>
      <option value="ayudante" ${staff.role === "ayudante" ? "selected" : ""}>🏃 Ayudante</option>
    `;

    staffRoleDisplay.appendChild(roleSelect);
    staffDetails.appendChild(staffEmail);
    staffDetails.appendChild(staffRoleDisplay);
    staffInfo.appendChild(staffAvatar);
    staffInfo.appendChild(staffDetails);

    const staffActions = document.createElement("div");
    staffActions.className = "staff-actions";

    const saveRoleBtn = document.createElement("button");
    saveRoleBtn.className = "btn btn-primary saveRoleBtn";
    saveRoleBtn.setAttribute("data-id", staff.id);
    saveRoleBtn.textContent = "💾 Guardar rol";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-danger deleteBtn";
    deleteBtn.setAttribute("data-id", staff.id);
    deleteBtn.setAttribute("data-user", staff.user_id);
    deleteBtn.textContent = "🗑️ Eliminar";

    staffActions.appendChild(saveRoleBtn);
    staffActions.appendChild(deleteBtn);

    card.appendChild(staffInfo);
    card.appendChild(staffActions);

    // Permisos - usar sistema de permisos
    if (!canManageStaff) {
      deleteBtn.style.display = "none";
      roleSelect.disabled = true;
      saveRoleBtn.style.display = "none";
    }

    // No puedo editarme a mí mismo
    if (staff.user_id === user.id) {
      deleteBtn.style.display = "none";
      roleSelect.disabled = true;
      saveRoleBtn.style.display = "none";
    }

    container.appendChild(card);
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
}

loadStaff();

// Mostrar/ocultar formulario de añadir según permisos
if (!canManageStaff) {
  const addBox = document.getElementById('addBox');
  if (addBox) addBox.style.display = 'none';
}

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
  loadStaff();
};
