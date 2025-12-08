// team_detail.js - Lógica para detalles del equipo
import { supabase } from "../js/supabaseClient.js";
import { initHeader } from "../js/headerComponent.js";
import { 
  initPermissions, 
  getUserStaffData, 
  getUserRole,
  getAllUserPermissions,
  getRoleLabel,
  getPermissionLabel,
  toggleElementByPermission 
} from "../js/permissionsHelper.js";

// Validar sesión
const { data: sessionData } = await supabase.auth.getSession();
if (!sessionData.session) {
  window.location.href = "/pages/index.html";
  throw new Error("No session");
}
const user = sessionData.session.user;

// Inicializar sistema de permisos
await initPermissions();

// Obtener team_id de la URL
const params = new URLSearchParams(window.location.search);
const teamId = params.get("team_id");

if (!teamId) {
  document.getElementById("errorMessage").style.display = "block";
  document.getElementById("errorMessage").innerText = "Error: no se ha proporcionado team_id.";
  throw new Error("Missing team_id");
}

// Obtener datos del staff del usuario (incluye rol y permisos)
const staffData = await getUserStaffData(teamId);

if (!staffData) {
  document.getElementById("errorMessage").style.display = "block";
  document.getElementById("errorMessage").innerText = "No tienes permisos para acceder a este equipo.";
  throw new Error("No permission");
}

// Cargar datos del equipo
const { data: teamData, error: teamError } = await supabase
  .from("teams")
  .select("*")
  .eq("id", teamId)
  .single();

if (teamError || !teamData) {
  document.getElementById("errorMessage").style.display = "block";
  document.getElementById("errorMessage").innerText = "No se pudo cargar el equipo.";
  console.error(teamError);
  throw new Error("Team not found");
}

// Inicializar header con el nombre del equipo
await initHeader({
  title: teamData.name,
  backUrl: '/pages/teams.html',
  activeNav: null
});

// Mostrar información del equipo
document.getElementById("teamTitle").innerText = teamData.name;
document.getElementById("teamCategory").innerText = teamData.category || "Sin categoría";

// Mostrar rol y permisos del usuario
const userRole = await getUserRole(teamId);
const userPermissions = await getAllUserPermissions(teamId);

document.getElementById("userRole").innerText = getRoleLabel(userRole);

// Mostrar permisos
const permissionsList = document.getElementById("permissionsList");
const activePermissions = Object.entries(userPermissions)
  .filter(([_, value]) => value === true)
  .map(([key, _]) => getPermissionLabel(key));

if (activePermissions.length > 0) {
  permissionsList.innerHTML = activePermissions
    .map(p => `<li>${p}</li>`)
    .join('');
} else {
  permissionsList.innerHTML = '<li>Sin permisos asignados</li>';
}

// Configurar navegación con permisos
document.getElementById("playersBtn").href = `/pages/players.html?team_id=${teamId}`;
document.getElementById("staffBtn").href = `/pages/staff.html?team_id=${teamId}`;
document.getElementById("trainingsBtn").href = `/pages/trainings.html?team_id=${teamId}`;
document.getElementById("eventsBtn").href = `/pages/events.html?team_id=${teamId}`;
document.getElementById("attendanceBtn").href = `/pages/attendance.html?team_id=${teamId}`;

// Mostrar/ocultar botones según permisos
toggleElementByPermission(
  document.getElementById("playersBtn"), 
  userPermissions['MANAGE_PLAYERS']
);

toggleElementByPermission(
  document.getElementById("staffBtn"), 
  userPermissions['MANAGE_STAFF'] || userPermissions['MANAGE_STAFF_PERMISSIONS']
);

toggleElementByPermission(
  document.getElementById("trainingsBtn"), 
  userPermissions['MANAGE_TRAININGS']
);

toggleElementByPermission(
  document.getElementById("eventsBtn"), 
  userPermissions['MANAGE_EVENTS']
);

toggleElementByPermission(
  document.getElementById("attendanceBtn"), 
  userPermissions['MANAGE_ATTENDANCE']
);

// Mostrar sección de acciones
document.getElementById("userInfo").style.display = "block";
document.getElementById("actions").style.display = "grid";
