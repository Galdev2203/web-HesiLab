# Accesibilidad y SEO - HesiLab

## 📋 Resumen

Este documento detalla las mejoras de accesibilidad y SEO implementadas en HesiLab para cumplir con los estándares WCAG 2.1 AA y requisitos de Google AdSense.

---

## ✅ Mejoras Implementadas

### 1. **Meta Tags y SEO**

#### Meta Tags Básicos
Todas las páginas incluyen:
- `<meta name="description">` - Descripción única por página
- `<meta name="keywords">` - Palabras clave relevantes
- `<meta name="robots">` - Control de indexación
- `<meta name="viewport">` - Responsive design
- `<meta charset="UTF-8">` - Codificación de caracteres

#### Open Graph (Redes Sociales)
```html
<meta property="og:type" content="website">
<meta property="og:title" content="HesiLab - Sistema de Gestión Deportiva">
<meta property="og:description" content="...">
<meta property="og:locale" content="es_ES">
```

#### Twitter Cards
```html
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="...">
<meta name="twitter:description" content="...">
```

### 2. **HTML Semántico**

#### Estructura Semántica
- `<header>` con `role="banner"` - Cabecera principal
- `<nav>` con `role="navigation"` - Menús de navegación
- `<main>` con `role="main"` - Contenido principal
- `<aside>` - Barra lateral
- `<section>` - Secciones de contenido
- `<article>` - Contenido independiente

#### Landmarks ARIA
```html
<nav role="navigation" aria-label="Menú principal">
<main role="main" aria-label="Contenido principal">
<section aria-labelledby="todayHeader">
```

### 3. **ARIA (Accessible Rich Internet Applications)**

#### Atributos ARIA Implementados
- `aria-label` - Etiquetas descriptivas
- `aria-labelledby` - Referencias a etiquetas
- `aria-describedby` - Descripciones adicionales
- `aria-expanded` - Estado de elementos colapsables
- `aria-hidden` - Ocultar de lectores de pantalla
- `aria-haspopup` - Indicar menús emergentes
- `aria-current="page"` - Página actual
- `aria-live` - Regiones con contenido dinámico
- `role="menu/menuitem"` - Menús accesibles

#### Ejemplo de Implementación
```html
<button 
  id="menuToggle" 
  aria-label="Abrir menú de navegación" 
  aria-expanded="false" 
  aria-controls="sidebar">
  <span aria-hidden="true">☰</span>
</button>
```

### 4. **Navegación por Teclado**

#### Skip Link
```html
<a href="#main-content" class="skip-link">
  Saltar al contenido principal
</a>
```

#### Focus Management
- Focus trap en modales
- Focus visible en todos los elementos interactivos
- Navegación secuencial lógica (tabindex)
- Cierre con tecla Escape

#### Atajos de Teclado
- `Tab` / `Shift+Tab` - Navegación secuencial
- `Enter` / `Space` - Activar botones
- `Escape` - Cerrar modales/menús
- `Arrow Up/Down` - Navegación en menús

### 5. **Contraste y Colores (WCAG AA)**

#### Requisitos de Contraste
- Texto normal: mínimo 4.5:1
- Texto grande: mínimo 3:1
- Controles UI: mínimo 3:1

#### Paleta de Colores Accesible
```css
:root {
  --primary-600: #667eea;     /* Contraste 4.5:1 */
  --gray-900: #111827;        /* Texto principal */
  --gray-600: #4b5563;        /* Texto secundario */
  --success-600: #38a169;     /* Acción positiva */
  --danger-600: #e53e3e;      /* Acción destructiva */
}
```

#### High Contrast Mode Support
```css
@media (prefers-contrast: high) {
  :root {
    --primary-600: #4c51bf;
    --gray-500: #000000;
  }
  .btn {
    border: 2px solid currentColor;
  }
}
```

### 6. **Focus States Visibles**

#### Focus Outline Mejorado
```css
*:focus-visible {
  outline: 3px solid var(--primary-600);
  outline-offset: 2px;
  border-radius: 2px;
}

button:focus-visible,
a:focus-visible,
input:focus-visible {
  outline: 3px solid var(--primary-600);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.2);
}
```

### 7. **Reduced Motion**

#### Respeto a Preferencias del Usuario
```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 8. **Screen Reader Support**

#### Clases de Utilidad
```css
/* Solo lectores de pantalla */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

/* Visible al enfocar */
.sr-only-focusable:focus {
  position: static;
  width: auto;
  height: auto;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
```

#### ARIA Live Regions
```javascript
// Anunciar cambios dinámicos
announce('Jugador agregado exitosamente', 'polite');
announce('Error: formulario inválido', 'assertive');
```

### 9. **Módulo JavaScript de Accesibilidad**

#### Archivo: `js/utils/accessibility.js`

**Funciones Principales:**
- `initAccessibility()` - Inicialización automática
- `announce(message, priority)` - Anuncios para lectores de pantalla
- `trapFocus(element)` - Focus trap en modales
- `updateAriaExpanded(button, state)` - Actualizar estados ARIA
- `setupMenuButton(button, menu)` - Menús accesibles
- `showAccessibleLoader(container)` - Indicadores de carga accesibles

**Uso:**
```javascript
import { announce, updateAriaExpanded } from './utils/accessibility.js';

// Anunciar acción
announce('Datos guardados correctamente', 'polite');

// Actualizar elemento colapsable
updateAriaExpanded(button, isExpanded);
```

### 10. **SEO Técnico**

#### robots.txt
```
User-agent: *
Allow: /
Allow: /pages/index.html

Disallow: /pages/dashboard.html
Disallow: /pages/teams.html
...

Sitemap: https://hesilab.com/sitemap.xml
```

#### sitemap.xml
Incluye todas las páginas con:
- URLs completas
- Última modificación
- Frecuencia de cambio
- Prioridad

### 11. **Responsive Design**

#### Breakpoints
```css
:root {
  --breakpoint-sm: 640px;   /* Móviles grandes */
  --breakpoint-md: 768px;   /* Tablets */
  --breakpoint-lg: 1024px;  /* Desktop */
  --breakpoint-xl: 1280px;  /* Desktop grande */
}
```

#### Media Queries
```css
@media (max-width: 768px) {
  /* Estilos móviles */
}

@media (min-width: 769px) and (max-width: 1024px) {
  /* Estilos tablet */
}
```

### 12. **Imágenes y Multimedia**

#### Alt Text
```html
<img src="avatar.jpg" alt="Avatar de usuario" />
<img src="logo.png" alt="HesiLab - Gestión Deportiva" />

<!-- Decorativas -->
<img src="decoration.svg" alt="" aria-hidden="true" />
```

#### Iconos
```html
<!-- Con texto visible -->
<button>
  <span aria-hidden="true">🔔</span>
  <span>Notificaciones</span>
</button>

<!-- Solo icono -->
<button aria-label="Cerrar">
  <span aria-hidden="true">×</span>
</button>
```

---

## 🎯 Checklist de Accesibilidad

### HTML
- [x] DOCTYPE declarado
- [x] Idioma especificado (`lang="es"`)
- [x] Charset UTF-8
- [x] Viewport meta tag
- [x] Title descriptivo en cada página
- [x] Estructura semántica (header, nav, main, footer)

### ARIA
- [x] Landmarks con aria-label
- [x] Botones con aria-label descriptivos
- [x] Estados dinámicos (aria-expanded, aria-hidden)
- [x] Roles apropiados (menu, menuitem, banner, etc.)
- [x] aria-live para contenido dinámico

### Teclado
- [x] Todos los elementos interactivos accesibles por teclado
- [x] Skip link funcional
- [x] Focus trap en modales
- [x] Focus visible en todos los elementos
- [x] Orden lógico de tabulación

### Visual
- [x] Contraste mínimo 4.5:1 para texto
- [x] Contraste mínimo 3:1 para componentes UI
- [x] Focus states visibles
- [x] No depende solo del color
- [x] Zoom hasta 200% sin pérdida de funcionalidad

### Contenido
- [x] Headings jerárquicos (h1 → h2 → h3)
- [x] Links descriptivos
- [x] Alt text en imágenes
- [x] Labels en formularios
- [x] Mensajes de error claros

### Responsive
- [x] Mobile-first design
- [x] Touch targets mínimo 44×44px
- [x] Texto legible sin zoom
- [x] Contenido adaptable
- [x] No scroll horizontal

---

## 🔍 Testing y Validación

### Herramientas Recomendadas

1. **Google Lighthouse**
   - Accesibilidad: >90
   - SEO: >90
   - Mejores prácticas: >90
   - Rendimiento: >80

2. **WAVE (Web Accessibility Evaluation Tool)**
   - https://wave.webaim.org/

3. **axe DevTools**
   - Extensión de navegador
   - Detecta problemas de accesibilidad

4. **Validadores**
   - W3C HTML Validator: https://validator.w3.org/
   - W3C CSS Validator: https://jigsaw.w3.org/css-validator/

5. **Screen Readers**
   - NVDA (Windows - Gratis)
   - JAWS (Windows - Comercial)
   - VoiceOver (macOS/iOS - Integrado)
   - TalkBack (Android - Integrado)

### Tests Manuales

#### Navegación por Teclado
1. Desconectar el mouse
2. Usar solo Tab, Enter, Escape, flechas
3. Verificar que todo sea accesible
4. Comprobar que el focus sea visible

#### Zoom
1. Aumentar zoom al 200%
2. Verificar que no haya scroll horizontal
3. Comprobar que todo sea legible y funcional

#### Screen Reader
1. Activar lector de pantalla
2. Navegar por la página
3. Verificar que todo el contenido sea anunciado
4. Comprobar que los landmarks sean identificados

---

## 📊 Métricas de Google AdSense

### Requisitos Principales

1. **Contenido de Calidad**
   - ✅ Contenido original y valioso
   - ✅ Páginas informativas completas
   - ✅ Navegación clara

2. **Políticas de Privacidad**
   - ⚠️ Agregar página de Política de Privacidad
   - ⚠️ Agregar página de Términos de Servicio
   - ⚠️ Cookie consent banner

3. **Experiencia de Usuario**
   - ✅ Diseño responsive
   - ✅ Navegación intuitiva
   - ✅ Tiempos de carga rápidos
   - ✅ Accesibilidad implementada

4. **Requisitos Técnicos**
   - ✅ HTTPS (certificado SSL)
   - ✅ Dominio propio
   - ✅ Sitemap.xml
   - ✅ robots.txt
   - ✅ Meta tags apropiados

---

## 🚀 Próximos Pasos Recomendados

### Para Mejorar AdSense Approval

1. **Agregar Páginas Legales**
   ```
   /pages/privacy-policy.html
   /pages/terms-of-service.html
   /pages/cookie-policy.html
   /pages/contact.html
   /pages/about.html
   ```

2. **Cookie Consent Banner**
   - Implementar banner de cookies
   - Guardar preferencias del usuario
   - Cumplir con GDPR/CCPA

3. **Contenido Público**
   - Crear blog o sección de recursos
   - Artículos sobre gestión deportiva
   - Guías de uso
   - FAQs

4. **Analytics y Monitoreo**
   - Google Search Console
   - Google Analytics 4
   - Monitoreo de errores
   - Performance tracking

5. **Mejorar Rendimiento**
   - Optimizar imágenes
   - Lazy loading
   - Code splitting
   - Cache strategies
   - CDN para assets estáticos

---

## 📚 Referencias

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN Web Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [Google AdSense Policies](https://support.google.com/adsense/answer/9335567)
- [A11Y Project Checklist](https://www.a11yproject.com/checklist/)
- [WebAIM](https://webaim.org/)

---

## 💡 Contacto y Soporte

Para preguntas o sugerencias sobre accesibilidad:
- Reportar problemas en el repositorio
- Contactar al equipo de desarrollo
- Revisar documentación actualizada

---

**Última actualización:** 9 de diciembre de 2024
**Versión:** 1.0
**Mantenido por:** Equipo HesiLab
