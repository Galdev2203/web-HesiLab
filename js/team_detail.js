// team_detail.js - Lógica para detalles del equipo
import { supabase } from "../js/supabaseClient.js";

// Validar sesión
const { data: sessionData } = await supabase.auth.getSession();
if (!sessionData.session) {
  window.location.href = "/pages/index.html";
  throw new Error("No session");
}
const user = sessionData.session.user;

// Obtener team_id de la URL
const params = new URLSearchParams(window.location.search);
const teamId = params.get("team_id");

if (!teamId) {
  document.getElementById("errorMessage").innerText = "Error: no se ha proporcionado team_id.";
  throw new Error("Missing team_id");
}

// Comprobar que el usuario es staff del equipo
const { data: staffData, error: staffError } = await supabase
  .from("team_staff")
  .select("id")
  .eq("team_id", teamId)
  .eq("user_id", user.id)
  .eq("active", true);

if (staffError) {
  document.getElementById("errorMessage").innerText = "Error al comprobar permisos.";
  console.error(staffError);
  throw new Error("Staff check failed");
}

if (!staffData || staffData.length === 0) {
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
  document.getElementById("errorMessage").innerText = "No se pudo cargar el equipo.";
  console.error(teamError);
  throw new Error("Team not found");
}

// Mostrar datos en pantalla
document.getElementById("teamTitle").innerText = teamData.name;
document.getElementById("teamCategory").innerText = teamData.category || "";

// Mostrar botones y configurar enlaces correctos
document.getElementById("actions").style.display = "block";

document.getElementById("playersBtn").href = `/pages/players.html?team_id=${teamId}`;
document.getElementById("staffBtn").href = `/pages/team_staff.html?team_id=${teamId}`;
document.getElementById("attendanceBtn").href = `/pages/attendance.html?team_id=${teamId}`;
