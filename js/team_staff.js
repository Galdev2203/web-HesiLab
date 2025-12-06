// team_staff.js - Lógica para gestión de entrenadores
import { supabase } from "../js/supabaseClient.js";

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
}

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

  container.innerHTML = "";

  data.forEach(staff => {
    const div = document.createElement("div");
    div.className = "staff-card";

    // Selector + botón
    const roleEditor = `
      <select class="roleSelect" data-id="${staff.id}">
        <option value="principal" ${staff.role === "principal" ? "selected" : ""}>Principal</option>
        <option value="segundo" ${staff.role === "segundo" ? "selected" : ""}>Segundo</option>
        <option value="ayudante" ${staff.role === "ayudante" ? "selected" : ""}>Ayudante</option>
      </select>
      <button class="btn primary saveRoleBtn" data-id="${staff.id}">Guardar rol</button>
    `;

    div.innerHTML = `
      <div>
        <strong>${staff.profiles?.email || "(sin email)"}</strong><br>
        <small>Rol actual: ${staff.role}</small>
      </div>

      <div style="display:flex; gap:12px; align-items:center;">
        ${roleEditor}
        <button class="btn danger deleteBtn" data-id="${staff.id}" data-user="${staff.user_id}">
          Eliminar
        </button>
      </div>
    `;

    const deleteBtn = div.querySelector(".deleteBtn");
    const selectRole = div.querySelector(".roleSelect");
    const saveRoleBtn = div.querySelector(".saveRoleBtn");

    // Permisos
    if (myRole !== "principal") {
      deleteBtn.style.display = "none";
      selectRole.style.display = "none";
      saveRoleBtn.style.display = "none";
    }

    // No puedo editarme a mí mismo
    if (staff.user_id === user.id) {
      deleteBtn.style.display = "none";
      selectRole.style.display = "none";
      saveRoleBtn.style.display = "none";
    }

    container.appendChild(div);
  });

  // Guardar cambios de rol (usando RPC)
  document.querySelectorAll(".saveRoleBtn").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute("data-id");
      const newRole = btn.parentElement.querySelector(".roleSelect").value;

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

// Añadir entrenador
document.getElementById("addBtn").onclick = async () => {
  const email = document.getElementById("emailInput").value.trim();
  const role = document.getElementById("roleInput").value;

  if (!email) {
    alert("Introduce un correo electrónico.");
    return;
  }

  const { data: usr, error } = await supabase.rpc("get_user_by_email", { p_email: email });

  if (error || !usr || usr.length === 0) {
    alert("No existe ningún usuario con ese email.");
    return;
  }

  const userIdToAdd = usr[0].id;

  const { error: insertErr } = await supabase
    .from("team_staff")
    .insert({
      team_id: teamId,
      user_id: userIdToAdd,
      role: role
    });

  if (insertErr) {
    alert("No tienes permiso para añadir entrenadores.");
    return;
  }

  document.getElementById("emailInput").value = "";
  loadStaff();
};
