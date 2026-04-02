// ========================================
// SFL FARM HELPER HUB - app.js
// Integración: Telegram WebApp + i18n + Supabase
// ========================================

// ========================================
// TELEGRAM WEBAPP INIT
// ========================================
const tg = window.Telegram?.WebApp;

if (tg) {
  tg.expand();
  tg.ready();
  
  // Aplicar tema de Telegram a variables CSS
  if (tg.themeParams?.bg_color) {
    document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color);
  }
  if (tg.themeParams?.text_color) {
    document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color);
  }
  if (tg.themeParams?.button_color) {
    document.documentElement.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color);
  }
  if (tg.themeParams?.button_text_color) {
    document.documentElement.style.setProperty('--tg-theme-button-text-color', tg.themeParams.button_text_color);
  }
  
  // Configurar botón de retroceso
  if (tg.BackButton) {
    tg.BackButton.onClick(() => {
      // Si hay un dropdown abierto, cerrarlo primero
      const dropdown = document.getElementById('langDropdown');
      if (dropdown?.classList.contains('show')) {
        dropdown.classList.remove('show');
        return;
      }
      tg.close();
    });
    tg.BackButton.show();
  }
  
  // Configurar MainButton si se necesita en el futuro
  // tg.MainButton.setText("Publicar");
  // tg.MainButton.disable();
}

// ========================================
// VARIABLES GLOBALES
// ========================================
let i18n = null;
let supabase = null;
let currentView = 'requests';

// ========================================
// SUPABASE CLIENT SETUP
// ========================================
function initSupabase() {
  // Variables inyectadas por Wrangler/Cloudflare
  const SUPABASE_URL = typeof __SUPABASE_URL !== 'undefined' 
    ? __SUPABASE_URL 
    : (import.meta?.env?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL || '');
  
  const SUPABASE_ANON_KEY = typeof __SUPABASE_ANON_KEY !== 'undefined' 
    ? __SUPABASE_ANON_KEY 
    : (import.meta?.env?.VITE_SUPABASE_ANON_KEY || process.env?.SUPABASE_ANON_KEY || '');

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('⚠️ Supabase credentials not configured. Check your environment variables.');
    return null;
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ========================================
// I18N INITIALIZATION
// ========================================
async function initI18n() {
  // Verificar que el sistema i18n está disponible
  if (typeof window.I18n === 'undefined') {
    console.error('❌ i18n.js no se cargó. Verifica que el script esté antes que app.js en index.html');
    // Fallback: usar traducciones en inglés por defecto
    return {
      t: (key) => key,
      getLanguage: () => 'es',
      setLanguage: async () => true,
      getSupportedLanguages: () => []
    };
  }
  
  try {
    i18n = await window.I18n.init();
    updateUITranslations();
    
    // Escuchar cambios de idioma para actualizar UI dinámicamente
    window.addEventListener('i18n:changed', () => {
      updateUITranslations();
      // Recargar solicitudes para actualizar textos dinámicos
      if (currentView === 'requests') {
        loadRequests();
      }
      // Notificar cambio de idioma
      showToast(i18n.t('language.switched', { 
        language: i18n.t(`language.${i18n.getLanguage()}`) 
      }));
    });
    
    // Configurar eventos del selector de idioma
    setupLanguageSelector();
    
    return i18n;
  } catch (error) {
    console.error('❌ Error initializing i18n:', error);
    // Fallback mínimo
    return {
      t: (key) => key,
      getLanguage: () => 'es',
      setLanguage: async () => true,
      getSupportedLanguages: () => []
    };
  }
}

// Actualizar todos los elementos con atributos data-i18n
function updateUITranslations() {
  if (!i18n) return;
  
  // Traducir texto de elementos
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      const translation = i18n.t(key);
      // Usar innerHTML solo si la traducción contiene HTML seguro
      if (translation.includes('<')) {
        el.innerHTML = translation;
      } else {
        el.textContent = translation;
      }
    }
  });
  
  // Traducir placeholders de inputs
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) el.placeholder = i18n.t(key);
  });
  
  // Actualizar título de la página
  document.title = i18n.t('app.name');
  
  // Actualizar botón de idioma (mostrar código: ES/EN)
  const currentCode = i18n.getLanguage().toUpperCase();
  const langBtn = document.getElementById('currentLang');
  if (langBtn) langBtn.textContent = currentCode;
  
  // Actualizar estado "activo" en el dropdown de idiomas
  document.querySelectorAll('.lang-option').forEach(opt => {
    const lang = opt.dataset.lang;
    opt.classList.toggle('active', lang === i18n.getLanguage());
  });
}

// Configurar eventos del selector de idioma
function setupLanguageSelector() {
  const toggle = document.getElementById('langToggle');
  const dropdown = document.getElementById('langDropdown');
  
  if (!toggle || !dropdown) {
    console.warn('⚠️ Language selector elements not found. Check your HTML.');
    return;
  }
  
  // Toggle: mostrar/ocultar dropdown
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('show');
  });
  
  // Cerrar dropdown al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== toggle) {
      dropdown.classList.remove('show');
    }
  });
  
  // Cerrar dropdown con tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      dropdown.classList.remove('show');
    }
  });
  
  // Cambiar idioma al seleccionar una opción
  document.querySelectorAll('.lang-option').forEach(option => {
    option.addEventListener('click', async (e) => {
      e.stopPropagation();
      const newLang = option.dataset.lang;
      
      if (newLang && newLang !== i18n?.getLanguage()) {
        // Feedback visual inmediato
        document.querySelectorAll('.lang-option').forEach(o => o.classList.remove('active'));
        option.classList.add('active');
        
        // Cambiar idioma (esto dispara el evento 'i18n:changed')
        await i18n.setLanguage(newLang);
      }
      
      // Cerrar dropdown
      dropdown.classList.remove('show');
    });
  });
}

// ========================================
// DOM ELEMENTS CACHE
// ========================================
let requestForm = null;
let requestsList = null;

function cacheDOMElements() {
  requestForm = document.getElementById('requestForm');
  requestsList = document.getElementById('requestsList');
}

// ========================================
// FUNCIONES PRINCIPALES
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Cache de elementos DOM
  cacheDOMElements();
  
  // 2. Inicializar Supabase
  supabase = initSupabase();
  if (!supabase) {
    showToast('⚠️ Supabase no configurado. Verifica las variables de entorno.', 'error');
  }
  
  // 3. Inicializar i18n (traducciones)
  await initI18n();
  
  // 4. Configurar evento de submit del formulario
  if (requestForm) {
    requestForm.addEventListener('submit', handleFormSubmit);
  }
  
  // 5. Cargar solicitudes iniciales
  if (requestsList) {
    loadRequests();
  }
  
  // 6. Auto-recargar cada 5 minutos para ver nuevas solicitudes
  setInterval(() => {
    if (currentView === 'requests') {
      loadRequests();
    }
  }, 5 * 60 * 1000);
  
  // 7. Haptic feedback al cargar (opcional, mejora UX en móviles)
  if (tg?.HapticFeedback) {
    tg.HapticFeedback.impactOccurred('light');
  }
});

// Manejar submit del formulario de publicación
async function handleFormSubmit(e) {
  e.preventDefault();
  
  if (!supabase) {
    showToast('⚠️ Backend no disponible. Intenta más tarde.', 'error');
    return;
  }

  const playerName = document.getElementById('playerName')?.value.trim();
  const telegramUsername = document.getElementById('telegramUsername')?.value.trim().replace(/^@/, '');
  const details = document.getElementById('details')?.value.trim();

  // Validación básica
  if (!playerName || !telegramUsername) {
    showToast(i18n?.t('actions.requiredFields') || '⚠️ Please fill required fields', 'error');
    if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
    return;
  }

  // Feedback visual: deshabilitar botón
  const button = requestForm?.querySelector('button[type="submit"]');
  if (button) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = i18n?.t('actions.posting') || '🔄 Posting...';
  }

  try {
    // Preparar datos para enviar a Supabase
    const requestData = {
      player_name: playerName,
      telegram_username: telegramUsername,
      details: details || null,
      // Datos de Telegram para verificación en backend (opcional pero recomendado)
      tg_init_data: tg?.initData || null,
      tg_user_id: tg?.initDataUnsafe?.user?.id || null,
      // expires_at se calcula automáticamente en la BD (DEFAULT NOW() + INTERVAL '24 hours')
    };

    const { data, error } = await supabase
      .from('help_requests')
      .insert(requestData)
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      throw new Error(error.message || 'Database error');
    }

    // Éxito: resetear formulario y recargar lista
    showToast(i18n?.t('actions.success') || '✅ Request posted!');
    requestForm?.reset();
    
    // Haptic feedback de éxito
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.notificationOccurred('success');
    }
    
    // Recargar lista y cambiar a vista de solicitudes si estamos en formulario
    loadRequests();
    
  } catch (err) {
    console.error('❌ Error posting request:', err);
    showToast(i18n?.t('actions.errorPost') || '❌ Error posting. Try again.', 'error');
    
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.notificationOccurred('error');
    }
  } finally {
    // Restaurar botón
    if (button) {
      button.disabled = false;
      button.textContent = button.dataset.originalText || (i18n?.t('form.submit') || '🚀 Post Request');
      delete button.dataset.originalText;
    }
  }
}

// Cargar y renderizar solicitudes desde Supabase
async function loadRequests() {
  if (!requestsList || !supabase) return;
  
  // Estado de carga
  requestsList.innerHTML = `<div class="loading">${i18n?.t('requests.loading') || '🌻 Loading...'}</div>`;

  try {
    const { data, error } = await supabase
      .from('help_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase fetch error:', error);
      throw new Error(error.message || 'Failed to fetch requests');
    }

    // Caso: sin datos
    if (!data || data.length === 0) {
      requestsList.innerHTML = `<div class="empty">${i18n?.t('requests.empty') || '🌱 No requests yet'}</div>`;
      return;
    }

    // Filtrar visualmente solicitudes expiradas (la expiración real debe manejarse en backend también)
    const now = Date.now();
    const validRequests = data.filter(req => {
      const expiresAt = new Date(req.expires_at).getTime();
      return expiresAt > now;
    });
    
    // Caso: todas expiradas
    if (validRequests.length === 0) {
      requestsList.innerHTML = `<div class="empty">${i18n?.t('requests.expired') || '⏰ All expired'}</div>`;
      return;
    }

    // Renderizar tarjetas
    requestsList.innerHTML = validRequests.map(req => createRequestCard(req)).join('');
    
    // Bind de eventos en los botones de las tarjetas
    bindCardEvents();
    
  } catch (err) {
    console.error('❌ Error loading requests:', err);
    requestsList.innerHTML = `<div class="error">${i18n?.t('requests.error') || '⚠️ Error loading'}</div>`;
  }
}

// Bind de eventos en botones de tarjetas (ayudar / eliminar)
function bindCardEvents() {
  // Botones "Ayudar" → abrir chat de Telegram
  document.querySelectorAll('.btn-help').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const username = btn.dataset.username;
      
      if (!username) return;
      
      // Usar API nativa de Telegram para mejor UX (abre dentro de la app)
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(`https://t.me/${username}`);
      } else {
        // Fallback para web normal
        window.open(`https://t.me/${username}`, '_blank', 'noopener,noreferrer');
      }
      
      // Haptic feedback sutil
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.selectionChanged();
      }
    });
  });

  // Botones "Eliminar" → borrar solicitud (solo si es del usuario)
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const id = btn.dataset.id;
      
      if (!id) return;
      
      // Confirmación antes de eliminar
      let confirmed = false;
      
      if (tg?.showConfirm) {
        // Usar confirmación nativa de Telegram
        confirmed = await new Promise(resolve => {
          tg.showConfirm(i18n?.t('actions.confirmDelete') || 'Remove this request?', (result) => {
            resolve(result);
          });
        });
      } else {
        // Fallback para web normal
        confirmed = confirm(i18n?.t('actions.confirmDelete') || 'Remove this request?');
      }
      
      if (!confirmed) return;

      try {
        const { error } = await supabase
          .from('help_requests')
          .delete()
          .eq('id', id);

        if (error) throw error;
        
        showToast(i18n?.t('actions.removed') || '🗑️ Request removed');
        loadRequests(); // Recargar lista
        
        if (tg?.HapticFeedback) {
          tg.HapticFeedback.notificationOccurred('success');
        }
      } catch (err) {
        console.error('❌ Error deleting request:', err);
        showToast(i18n?.t('actions.errorRemove') || '❌ Error removing', 'error');
        
        if (tg?.HapticFeedback) {
          tg.HapticFeedback.notificationOccurred('error');
        }
      }
    });
  });
}

// Crear HTML de una tarjeta de solicitud
function createRequestCard(req) {
  const createdAt = new Date(req.created_at);
  const expiresAt = new Date(req.expires_at);
  const now = Date.now();
  
  // Calcular tiempo restante
  const diffMs = expiresAt.getTime() - now;
  const hoursLeft = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  const minutesLeft = Math.max(0, Math.floor(diffMs / (1000 * 60)));
  
  // Texto de tiempo restante (con traducción)
  let timeLeftText;
  if (hoursLeft >= 1) {
    timeLeftText = i18n?.t('requests.timeRemaining.hours', { hours: hoursLeft }) 
      || `⏳ ${hoursLeft}h remaining`;
  } else if (minutesLeft > 0) {
    timeLeftText = i18n?.t('requests.timeRemaining.minutes', { minutes: minutesLeft })
      || `⏳ ${minutesLeft}m remaining`;
  } else {
    timeLeftText = i18n?.t('requests.timeRemaining.expired') || '⚠️ Expired';
  }

  // Formatear "hace X tiempo"
  const timeAgo = formatTimeAgo(createdAt);
  
  // Username limpio para enlace de Telegram
  const cleanUsername = req.telegram_username?.replace(/^@/, '') || '';

  // Escape de contenido para prevenir XSS
  const safePlayerName = escapeHtml(req.player_name);
  const safeDetails = req.details ? escapeHtml(req.details) : null;
  const safeUsername = escapeHtml(cleanUsername);

  return `
    <article class="request-card" data-id="${req.id}">
      <div class="request-header">
        <span class="player-name">🌾 ${safePlayerName}</span>
        <span class="time-left">${timeLeftText}</span>
      </div>
      
      ${safeDetails ? `<p class="request-details">${safeDetails}</p>` : ''}
      
      <div style="margin-bottom:0.75rem;font-size:0.85rem;color:var(--text-light)">
        <small>
          ${i18n?.t('requests.postedAgo', { timeAgo }) || `Posted ${timeAgo}`} 
          • @${safeUsername}
        </small>
      </div>
      
      <div class="request-actions">
        <a href="https://t.me/${cleanUsername}" 
           class="btn btn-help" 
           data-username="${cleanUsername}"
           target="_blank"
           rel="noopener noreferrer">
          ${i18n?.t('requests.helpButton') || '💬 Help'}
        </a>
        <button class="btn btn-delete" data-id="${req.id}" type="button">
          ${i18n?.t('requests.removeButton') || '🗑️ Remove'}
        </button>
      </div>
    </article>
  `;
}

// ========================================
// UTILIDADES
// ========================================

// Escape HTML para prevenir XSS al renderizar contenido de usuario
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Formato "hace X tiempo" con soporte i18n
function formatTimeAgo(date) {
  if (!date) return i18n?.t('time.justNow') || 'just now';
  
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return i18n?.t('time.justNow') || 'just now';
  
  const intervals = [
    { label: i18n?.t('time.year') || 'y', seconds: 31536000 },
    { label: i18n?.t('time.month') || 'mo', seconds: 2592000 },
    { label: i18n?.t('time.day') || 'd', seconds: 86400 },
    { label: i18n?.t('time.hour') || 'h', seconds: 3600 },
    { label: i18n?.t('time.minute') || 'm', seconds: 60 }
  ];
  
  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) {
      return `${count}${interval.label} ${i18n?.t('time.ago') || 'ago'}`;
    }
  }
  return i18n?.t('time.justNow') || 'just now';
}

// Toast notifications con animación y soporte para tema oscuro/claro
function showToast(message, type = 'success') {
  // Crear elemento toast si no existe
  let toast = document.getElementById('tg-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'tg-toast';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    toast.style.cssText = `
      position: fixed;
      bottom: max(20px, env(safe-area-inset-bottom));
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: var(--tg-theme-text-color, #1f2937);
      color: var(--tg-theme-bg-color, #ffffff);
      padding: 12px 20px;
      border-radius: 12px;
      font-size: 0.95rem;
      font-weight: 500;
      z-index: 9999;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      max-width: 85%;
      text-align: center;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      pointer-events: none;
      line-height: 1.4;
    `;
    document.body.appendChild(toast);
  }
  
  // Actualizar contenido y estilo según tipo
  toast.textContent = message;
  toast.style.background = type === 'error' 
    ? 'var(--tg-theme-destructive-text-color, #ef4444)' 
    : 'var(--tg-theme-text-color, #1f2937)';
  toast.style.color = type === 'error'
    ? 'var(--tg-theme-destructive-bg-color, white)'
    : 'var(--tg-theme-bg-color, white)';
  
  // Animación de entrada
  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });
  
  // Animación de salida automática
  const duration = type === 'error' ? 4000 : 3000;
  setTimeout(() => {
    toast.style.transform = 'translateX(-50%) translateY(100px)';
  }, duration);
}

// ========================================
// DEBUG / DEV UTILS (se elimina en producción si se desea)
// ========================================
if (import.meta?.env?.DEV || process.env?.NODE_ENV === 'development') {
  window.__DEBUG = {
    tg,
    i18n: () => i18n,
    supabase: () => supabase,
    reloadRequests: loadRequests,
    showToast
  };
  console.log('🔧 Debug utils available: window.__DEBUG');
}