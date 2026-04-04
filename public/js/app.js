// ========================================
// SFL FARM HELPER HUB - app.js
// ========================================

const tg = window.Telegram?.WebApp;

if (tg) {
  tg.expand();
  tg.ready();
}

// Variables globales
let i18n = null;
let supabase = null;

// ========================================
// INICIALIZACIÓN
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 App iniciando...');
  
  // 1. Inicializar Supabase
  initSupabase();
  
  // 2. Inicializar i18n
  await initI18n();
  
  // 3. Configurar formulario
  const form = document.getElementById('requestForm');
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }
  
  // 4. Cargar solicitudes
  loadRequests();
  
  console.log('✅ App iniciada correctamente');
});

// ========================================
// SUPABASE
// ========================================
function initSupabase() {
  const SUPABASE_URL = typeof __SUPABASE_URL !== 'undefined' 
    ? __SUPABASE_URL 
    : (import.meta?.env?.VITE_SUPABASE_URL || '');
  
  const SUPABASE_ANON_KEY = typeof __SUPABASE_ANON_KEY !== 'undefined' 
    ? __SUPABASE_ANON_KEY 
    : (import.meta?.env?.VITE_SUPABASE_ANON_KEY || '');

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('⚠️ Supabase no configurado');
    return null;
  }

  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabase;
}

// ========================================
// I18N - SISTEMA DE IDIOMAS
// ========================================
async function initI18n() {
  console.log('🌍 Inicializando i18n...');
  
  if (typeof window.I18n === 'undefined') {
    console.error('❌ window.I18n no existe. ¿Se cargó i18n.js?');
    return;
  }
  
  try {
    i18n = await window.I18n.init();
    console.log('✅ i18n inicializado. Idioma:', i18n.getLanguage());
    
    // Actualizar UI con traducciones
    updateTranslations();
    
    // Configurar selector de idioma
    setupLanguageSelector();
    
    // Escuchar cambios de idioma
    window.addEventListener('i18n:changed', () => {
      console.log('🔄 Idioma cambiado a:', i18n.getLanguage());
      updateTranslations();
      loadRequests(); // Recargar para actualizar textos
      showToast('Idioma cambiado a ' + i18n.t('language.' + i18n.getLanguage()));
    });
    
  } catch (error) {
    console.error('❌ Error en i18n:', error);
  }
}

// Actualizar todos los textos de la UI
function updateTranslations() {
  if (!i18n) return;
  
  // Traducir elementos con data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      const text = i18n.t(key);
      el.innerHTML = text;
    }
  });
  
  // Traducir placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) {
      el.placeholder = i18n.t(key);
    }
  });
  
  // Actualizar título
  document.title = i18n.t('app.name');
  
  // Actualizar botón de idioma
  const currentLang = i18n.getLanguage().toUpperCase();
  const langBtn = document.getElementById('currentLang');
  if (langBtn) {
    langBtn.textContent = currentLang;
  }
  
  // Marcar opción activa
  document.querySelectorAll('.lang-option').forEach(opt => {
    const isActive = opt.dataset.lang === i18n.getLanguage();
    opt.classList.toggle('active', isActive);
  });
  
  console.log('📝 Traducciones actualizadas');
}

// ========================================
// SELECTOR DE IDIOMA - VERSIÓN SIMPLE Y ROBUSTA
// ========================================
function setupLanguageSelector() {
  console.log('🔘 Configurando selector de idioma...');
  
  const toggle = document.getElementById('langToggle');
  const dropdown = document.getElementById('langDropdown');
  
  if (!toggle) {
    console.error('❌ No se encontró #langToggle');
    return;
  }
  
  if (!dropdown) {
    console.error('❌ No se encontró #langDropdown');
    return;
  }
  
  console.log('✅ Elementos encontrados:', { toggle, dropdown });
  
  // Click en el botón para mostrar/ocultar
  toggle.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('👆 Click en toggle');
    
    const isShowing = dropdown.classList.contains('show');
    
    if (isShowing) {
      dropdown.classList.remove('show');
      dropdown.style.display = 'none';
      console.log('🔽 Dropdown oculto');
    } else {
      dropdown.classList.add('show');
      dropdown.style.display = 'flex';
      console.log('🔼 Dropdown mostrado');
    }
  });
  
  // Cerrar al hacer clic fuera
  document.addEventListener('click', function(e) {
    if (!dropdown.contains(e.target) && !toggle.contains(e.target)) {
      dropdown.classList.remove('show');
      dropdown.style.display = 'none';
    }
  });
  
  // Click en cada opción de idioma
  const options = document.querySelectorAll('.lang-option');
  options.forEach((option, index) => {
    console.log(`📋 Opción ${index}:`, option.dataset.lang);
    
    option.addEventListener('click', async function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const newLang = this.dataset.lang;
      console.log('🌐 Seleccionado idioma:', newLang);
      
      if (!newLang || !i18n) return;
      
      // Cambiar idioma
      await i18n.setLanguage(newLang);
      
      // Cerrar dropdown
      dropdown.classList.remove('show');
      dropdown.style.display = 'none';
    });
  });
  
  console.log('✅ Selector configurado');
}

// ========================================
// FORMULARIO
// ========================================
async function handleFormSubmit(e) {
  e.preventDefault();
  
  if (!i18n || !supabase) {
    showToast('Sistema no listo. Recarga la página.', 'error');
    return;
  }
  
  const playerName = document.getElementById('playerName')?.value.trim();
  const telegramUsername = document.getElementById('telegramUsername')?.value.trim().replace(/^@/, '');
  const details = document.getElementById('details')?.value.trim();
  
  if (!playerName || !telegramUsername) {
    showToast(i18n.t('actions.requiredFields'), 'error');
    return;
  }
  
  const button = e.target.querySelector('button[type="submit"]');
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = i18n.t('actions.posting');
  
  try {
    const { data, error } = await supabase
      .from('help_requests')
      .insert({
        player_name: playerName,
        telegram_username: telegramUsername,
        details: details || null,
        tg_init_data: tg?.initData || null,
        tg_user_id: tg?.initDataUnsafe?.user?.id || null
      })
      .select()
      .single();
    
    if (error) throw error;
    
    showToast(i18n.t('actions.success'));
    e.target.reset();
    loadRequests();
    
  } catch (err) {
    console.error('Error:', err);
    showToast(i18n.t('actions.errorPost'), 'error');
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

// ========================================
// CARGAR SOLICITUDES
// ========================================
async function loadRequests() {
  const list = document.getElementById('requestsList');
  if (!list) return;
  
  if (!supabase) {
    list.innerHTML = '<div class="error">Supabase no configurado</div>';
    return;
  }
  
  list.innerHTML = `<div class="loading">${i18n?.t('requests.loading') || 'Cargando...'}</div>`;
  
  try {
    const { data, error } = await supabase
      .from('help_requests')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      list.innerHTML = `<div class="empty">${i18n.t('requests.empty')}</div>`;
      return;
    }
    
    const now = Date.now();
    const valid = data.filter(r => new Date(r.expires_at).getTime() > now);
    
    if (valid.length === 0) {
      list.innerHTML = `<div class="empty">${i18n.t('requests.expired')}</div>`;
      return;
    }
    
    list.innerHTML = valid.map(r => createRequestCard(r)).join('');
    bindCardEvents();
    
  } catch (err) {
    console.error('Error cargando:', err);
    list.innerHTML = `<div class="error">${i18n.t('requests.error')}</div>`;
  }
}

// ========================================
// TARJETAS DE SOLICITUD
// ========================================
function createRequestCard(req) {
  const now = Date.now();
  const expiresAt = new Date(req.expires_at).getTime();
  const diffHours = Math.max(0, Math.floor((expiresAt - now) / (1000 * 60 * 60)));
  const diffMinutes = Math.max(0, Math.floor((expiresAt - now) / (1000 * 60)));
  
  let timeText;
  if (diffHours >= 1) {
    timeText = i18n.t('requests.timeRemaining.hours', { hours: diffHours });
  } else if (diffMinutes > 0) {
    timeText = i18n.t('requests.timeRemaining.minutes', { minutes: diffMinutes });
  } else {
    timeText = i18n.t('requests.timeRemaining.expired');
  }
  
  const timeAgo = formatTimeAgo(new Date(req.created_at));
  const username = req.telegram_username.replace(/^@/, '');
  
  return `
    <article class="request-card" data-id="${req.id}">
      <div class="request-header">
        <span class="player-name">🌾 ${escapeHtml(req.player_name)}</span>
        <span class="time-left">${timeText}</span>
      </div>
      ${req.details ? `<p class="request-details">${escapeHtml(req.details)}</p>` : ''}
      <div style="margin-bottom:12px;font-size:0.85rem;color:var(--text-light)">
        <small>${i18n.t('requests.postedAgo', { timeAgo })} • @${escapeHtml(username)}</small>
      </div>
      <div class="request-actions">
        <a href="https://t.me/${username}" class="btn btn-help" data-username="${username}" target="_blank" rel="noopener">
          ${i18n.t('requests.helpButton')}
        </a>
        <button class="btn btn-delete" data-id="${req.id}" type="button">
          ${i18n.t('requests.removeButton')}
        </button>
      </div>
    </article>
  `;
}

function bindCardEvents() {
  // Botones de ayuda
  document.querySelectorAll('.btn-help').forEach(btn => {
    btn.addEventListener('click', function(e) {
      const username = this.dataset.username;
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(`https://t.me/${username}`);
      } else {
        window.open(`https://t.me/${username}`, '_blank');
      }
    });
  });
  
  // Botones de eliminar
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async function() {
      const id = this.dataset.id;
      
      if (!confirm(i18n.t('actions.confirmDelete'))) return;
      
      try {
        const { error } = await supabase
          .from('help_requests')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        
        showToast(i18n.t('actions.removed'));
        loadRequests();
      } catch (err) {
        console.error('Error:', err);
        showToast(i18n.t('actions.errorRemove'), 'error');
      }
    });
  });
}

// ========================================
// UTILIDADES
// ========================================
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return i18n?.t('time.justNow') || 'ahora';
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}${i18n?.t('time.minute') || 'm'}`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}${i18n?.t('time.hour') || 'h'}`;
  
  const days = Math.floor(hours / 24);
  return `${days}${i18n?.t('time.day') || 'd'}`;
}

function showToast(message, type = 'success') {
  let toast = document.getElementById('tg-toast');
  
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'tg-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: ${type === 'error' ? '#ef4444' : '#1f2937'};
      color: white;
      padding: 12px 20px;
      border-radius: 12px;
      font-size: 0.95rem;
      z-index: 9999;
      transition: transform 0.3s;
      max-width: 85%;
      text-align: center;
    `;
    document.body.appendChild(toast);
  }
  
  toast.textContent = message;
  toast.style.background = type === 'error' ? '#ef4444' : '#1f2937';
  
  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });
  
  setTimeout(() => {
    toast.style.transform = 'translateX(-50%) translateY(100px)';
  }, 3000);
}