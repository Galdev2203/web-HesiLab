// analytics.js - Google Analytics para todas las páginas
(function() {
  // Cargar script de Google Analytics
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=G-3BQNCKKTXJ';
  document.head.appendChild(script);

  // Inicializar dataLayer y gtag
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-3BQNCKKTXJ');
})();
