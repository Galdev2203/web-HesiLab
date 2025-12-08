// index.js - Lógica de autenticación para la página de login
import { supabase } from "../js/supabaseClient.js";
import { setupAuthListener } from "../js/authGuard.js";

// Configurar listener de autenticación
setupAuthListener();

// Verificar si ya hay una sesión activa
const { data: sessionData } = await supabase.auth.getSession();
if (sessionData.session) {
  window.location.href = "/pages/dashboard.html";
}

// Manejar el inicio de sesión con Google
document.getElementById("loginBtn").onclick = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { 
      redirectTo: window.location.origin + "/pages/dashboard.html",
      skipBrowserRedirect: false
    }
  });
  
  if (error) {
    console.error('Error al iniciar sesión:', error);
    alert('Error al iniciar sesión. Por favor, inténtalo de nuevo.');
  }
};
