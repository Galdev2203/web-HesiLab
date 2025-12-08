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

// Función principal
async function init() {
  try {
    console.log("Iniciando carga del equipo...");
    
    // Validar sesión
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      window.location.href = "/pages/index.html";
      throw new Error("No session");
    }
    const user = sessionData.session.user;
    console.log("Usuario autenticado:", user.email);

    // Inicializar sistema de permisos
    await initPermissions();
    console.log("Permisos inicializados");

    // Obtener team_id de la URL
    const params = new URLSearchParams(window.location.search);
    const teamId = params.get("team_id");
    console.log("Team ID:", teamId);

    if (!teamId) {
      alert("Error: no se ha proporcionado team_id.");
      window.location.href = "/pages/teams.html";
      return;
    }

    // Obtener datos del staff del usuario (incluye rol y permisos)
    console.log("Obteniendo datos del staff...");
    const staffData = await getUserStaffData(teamId);
    console.log("Staff data:", staffData);

    if (!staffData) {
      alert("No tienes permisos para acceder a este equipo.");
      window.location.href = "/pages/teams.html";
      return;
    }

    // Cargar datos del equipo
    console.log("Cargando datos del equipo...");
    const { data: teamData, error: teamError } = await supabase
      .from("teams")
      .select("*")
      .eq("id", teamId)
      .single();

    if (teamError || !teamData) {
      console.error("Error al cargar equipo:", teamError);
      alert("No se pudo cargar el equipo.");
      window.location.href = "/pages/teams.html";
      return;
    }

    console.log("Equipo cargado:", teamData);

    // Inicializar header con el nombre del equipo
    console.log("Inicializando header...");
    await initHeader({
      title: teamData.name,
      backUrl: '/pages/teams.html',
      activeNav: null
    });
    console.log("Header inicializado");

    // Continuar con el resto de la carga
    await loadTeamDetails(teamId, user, teamData);
    console.log("Detalles del equipo cargados correctamente");
  } catch (error) {
    console.error("Error en init():", error);
    alert("Error al cargar el equipo: " + error.message);
    window.location.href = "/pages/teams.html";
  }
}

// Cargar detalles del equipo
async function loadTeamDetails(teamId, user, teamData) {
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
  document.getElementById("staffBtn").href = `/pages/team_staff.html?team_id=${teamId}`;
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

  // Mostrar secciones
  document.getElementById("userInfo").style.display = "block";
  document.getElementById("actions").style.display = "grid";
}

// Iniciar la aplicación
init().catch(error => {
  console.error("Error al cargar el equipo:", error);
  alert("Error al cargar el equipo. Redirigiendo...");
  window.location.href = "/pages/teams.html";
});
