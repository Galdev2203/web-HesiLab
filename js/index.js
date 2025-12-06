// index.js - Lógica de autenticación para la página de login
import { supabase } from "../js/supabaseClient.js";

// Verificar si ya hay una sesión activa
const { data: sessionData } = await supabase.auth.getSession();
if (sessionData.session) {
  window.location.href = "/pages/dashboard.html";
}

// Manejar el inicio de sesión con Google
document.getElementById("loginBtn").onclick = async () => {
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: "https://hesilab.com/pages/dashboard.html" }
  });
};
