// dashboard.js - Lógica del panel principal
import { supabase } from "../js/supabaseClient.js";

// Verificar sesión
const { data } = await supabase.auth.getSession();

if (!data.session) {
  window.location.href = "/index.html";
} else {
  document.getElementById("userinfo").innerText =
    `Has iniciado sesión como: ${data.session.user.email}`;
}

// Navegar a equipos
document.getElementById("teamsCard").onclick = () => {
  window.location.href = "/teams.html";
};

// Cerrar sesión
document.getElementById("logoutBtn").onclick = async () => {
  await supabase.auth.signOut();
  window.location.href = "/index.html";
};
