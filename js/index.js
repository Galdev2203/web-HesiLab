// index.js - Lógica de autenticación y navegación para landing page
import { supabase } from "../js/supabaseClient.js";
import { setupAuthListener } from "../js/authGuard.js";

// Configurar listener de autenticación
setupAuthListener();

// ============================================
// FUNCIONES DE AUTENTICACIÓN
// ============================================

async function handleLogin() {
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
}

// ============================================
// BOTONES DE LOGIN
// ============================================

// Botón del nav
const navLoginBtn = document.getElementById("navLoginBtn");
if (navLoginBtn) {
  navLoginBtn.addEventListener("click", handleLogin);
}

// Botón del hero
const heroLoginBtn = document.getElementById("heroLoginBtn");
if (heroLoginBtn) {
  heroLoginBtn.addEventListener("click", handleLogin);
}

// Botón del footer CTA
const footerLoginBtn = document.getElementById("footerLoginBtn");
if (footerLoginBtn) {
  footerLoginBtn.addEventListener("click", handleLogin);
}

// Botón móvil
const mobileLoginBtn = document.getElementById("mobileLoginBtn");
if (mobileLoginBtn) {
  mobileLoginBtn.addEventListener("click", handleLogin);
}

// ============================================
// MENÚ MÓVIL
// ============================================

const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const mobileMenu = document.getElementById("mobileMenu");

if (mobileMenuBtn && mobileMenu) {
  mobileMenuBtn.addEventListener("click", () => {
    const isOpen = mobileMenu.classList.toggle("active");
    mobileMenuBtn.setAttribute("aria-expanded", isOpen.toString());
    mobileMenu.setAttribute("aria-hidden", (!isOpen).toString());
  });

  // Cerrar menú al hacer clic en un enlace
  const mobileLinks = mobileMenu.querySelectorAll(".mobile-link");
  mobileLinks.forEach(link => {
    link.addEventListener("click", () => {
      mobileMenu.classList.remove("active");
      mobileMenuBtn.setAttribute("aria-expanded", "false");
      mobileMenu.setAttribute("aria-hidden", "true");
    });
  });
}

// ============================================
// SMOOTH SCROLL PARA ENLACES
// ============================================

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener("click", function(e) {
    const href = this.getAttribute("href");
    if (href !== "#" && href.startsWith("#")) {
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    }
  });
});

// ============================================
// SCROLL HEADER
// ============================================

const header = document.querySelector(".landing-header");
if (header) {
  let lastScroll = 0;
  
  window.addEventListener("scroll", () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
    
    lastScroll = currentScroll;
  });
}

// ============================================
// ANIMACIONES ON SCROLL (OPCIONAL)
// ============================================

const observerOptions = {
  threshold: 0.1,
  rootMargin: "0px 0px -100px 0px"
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = "1";
      entry.target.style.transform = "translateY(0)";
    }
  });
}, observerOptions);

// Observar elementos para animación
document.querySelectorAll(".feature-card, .benefit-item, .step-item").forEach(el => {
  el.style.opacity = "0";
  el.style.transform = "translateY(30px)";
  el.style.transition = "all 0.6s ease-out";
  observer.observe(el);
});
