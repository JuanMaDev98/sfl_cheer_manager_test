// ========================================
// TELEGRAM WEBAPP INIT
// ========================================
const tg = window.Telegram?.WebApp;

if (tg) {
  tg.expand();
  tg.ready();
  
  if (tg.themeParams?.bg_color) {
    document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color);
  }
  if (tg.themeParams?.text_color) {
    document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color);
  }
  
  if (tg.BackButton) {
    tg.BackButton.onClick(() => tg.close());
    tg.BackButton.show();
  }
}

// ========================================
// I18N INITIALIZATION (NUEVO)
// ========================================
let i18n = null;

async function initI18n() {
  i18n = await window.I18n.init();
  
  // Actualizar UI inicial con traducciones
  updateUITranslations();
  
  // Escuchar cambios de idioma para actualizar UI dinámicamente
  window.addEventListener('i18n:changed', () => {
    updateUITranslations();
    // Recargar solicitudes para actualizar textos dinámicos
    if (currentView === 'requests') {
      loadRequests();
    }
    showToast(i18n.t('language.switched', { 
      language: i18n.t(`language.${i18n.getLanguage()}`) 
    }));
  });
  
  // Configurar selector de idioma
  setupLanguageSelector();
}

// Actualizar todos los elementos con data-i18n
function updateUITranslations() {
  // Traducir texto
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) el.innerHTML = i18n.t(key);
  });
  
  // Traducir placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) el.placeholder = i18n.t(key);
  });
  
  // Actualizar título de la página
  const titleKey = document.title.getAttribute?.('data-i18n') || 'app.name';
  document.title = i18n.t('app.name');
  
  // Actualizar botón de idioma
  const currentCode = i18n.getLanguage().toUpperCase();
  const langBtn = document.getElementById('currentLang');
  if (langBtn) langBtn.textContent = currentCode;
  
  // Actualizar estado activo en dropdown
  document.querySelectorAll('.lang-option').forEach(opt => {
    const lang = opt.dataset.lang;
    opt.classList.toggle('active', lang === i18n.getLanguage());
  });
}

// Configurar eventos del selector de idioma
function setupLanguageSelector() {
  const toggle = document.getElementById('langToggle');
  const dropdown = document.getElementById('langDropdown');
  
  if (!toggle || !dropdown) return;
  
  // Toggle dropdown
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
  
  // Cambiar idioma al seleccionar opción
  document.querySelectorAll('.lang-option').forEach(option => {
    option.addEventListener('click', async (e) => {
      e.stopPropagation();
      const newLang = option.dataset.lang;
      
      if (newLang && newLang !== i18n.getLanguage()) {
        await i18n.setLanguage(newLang);
        // updateUITranslations() se llama vía evento 'i18n:changed'
      }
      dropdown.classList.remove('show');
    });
  });
}

// ========================================
// SUPABASE CLIENT SETUP
// ========================================
const SUPABASE_URL = typeof __SUPABASE_URL !== 'undefined' ? __SUPABASE_URL : (process.env?.SUPABASE_URL || '');
const SUPABASE_ANON_KEY = typeof __SUPABASE_ANON_KEY !== 'undefined' ? __SUPABASE_ANON_KEY : (process.env?.SUPABASE_ANON_KEY || '');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========================================
// DOM ELEMENTS
// ========================================
const requestForm = document.getElementById('requestForm');
const requestsList = document.getElementById('requestsList');

// ========================================
// FUNCIONES PRINCIPALES
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Inicializar i18n PRIMERO
  await initI18n();
  
  // 2. Cargar solicitudes
  loadRequests();
  
  // 3. Auto-recargar cada 5 minutos
  setInterval(loadRequests, 5 * 60 * 1000);
});

requestForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const playerName = document.getElementById('playerName').value.trim();
  const telegramUsername = document.getElementById('telegramUsername').value.trim().replace(/^@/, '');
  const details = document.getElementById('details').value.trim();

  if (!playerName || !telegramUsername) {
    showToast(i18n.t('actions.requiredFields'), 'error');
    return;
  }

  const button = requestForm.querySelector('button');
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = i18n.t('actions.posting');

  try {
    const requestData = {
      player_name: playerName,
      telegram_username: telegramUsername,
      details: details,
      tg_init_data: tg?.initData || null,
      tg_user_id: tg?.initDataUnsafe?.user?.id || null
    };

    const { data, error } = await supabase
      .from('help_requests')
      .insert(requestData)
      .select();

    if (error) throw error;

    showToast(i18n.t('actions.success'));
    requestForm.reset();
    loadRequests();
    
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.notificationOccurred('success');
    }
    
  } catch (err) {
    console.error('Error posting request:', err);
    showToast(i18n.t('actions.errorPost'), 'error');
    
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.notificationOccurred('error');
    }
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
});

async function loadRequests() {
  if (!requestsList) return;
  
  requestsList.innerHTML = `<div class="loading">${i18n.t('requests.loading')}</div>`;

  try {
    const { data, error } = await supabase
      .from('help_requests')
      .select()
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      requestsList.innerHTML = `<div class="empty">${i18n.t('requests.empty')}</div>`;
      return;
    }

    const now = Date.now();
    const validRequests = data.filter(req => new Date(req.expires_at).getTime() > now);
    
    if (validRequests.length === 0) {
      requestsList.innerHTML = `<div class="empty">${i18n.t('requests.expired')}</div>`;
      return;
    }

    requestsList.innerHTML = validRequests.map(req => createRequestCard(req)).join('');
    bindCardEvents();
    
  } catch (err) {
    console.error('Error loading requests:', err);
    requestsList.innerHTML = `<div class="error">${i18n.t('requests.error')}</div>`;
  }
}

function bindCardEvents() {
  document.querySelectorAll('.btn-help').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const username = btn.dataset.username;
      
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(`https://t.me/${username}`);
      } else {
        window.open(`https://t.me/${username}`, '_blank');
      }
      
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.selectionChanged();
      }
    });
  });

  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = btn.dataset.id;
      
      if (tg?.showConfirm) {
        const confirmed = await new Promise(resolve => {
          tg.showConfirm(i18n.t('actions.confirmDelete'), (confirmed) => resolve(confirmed));
        });
        if (!confirmed) return;
      } else if (!confirm(i18n.t('actions.confirmDelete'))) {
        return;
      }

      try {
        const { error } = await supabase
          .from('help_requests')
          .delete()
          .eq('id', id);

        if (error) throw error;
        
        showToast(i18n.t('actions.removed'));
        loadRequests();
        
        if (tg?.HapticFeedback) {
          tg.HapticFeedback.notificationOccurred('success');
        }
      } catch (err) {
        console.error('Error deleting:', err);
        showToast(i18n.t('actions.errorRemove'), 'error');
      }
    });
  });
}

function createRequestCard(req) {
  const createdAt = new Date(req.created_at);
  const expiresAt = new Date(req.expires_at);
  const now = Date.now();
  
  const diffMs = expiresAt.getTime() - now;
  const hoursLeft = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  const minutesLeft = Math.max(0, Math.floor(diffMs / (1000 * 60)));
  
  let timeLeftText;
  if (hoursLeft >= 1) {
    timeLeftText = i18n.t('requests.timeRemaining.hours', { hours: hoursLeft });
  } else if (minutesLeft > 0) {
    timeLeftText = i18n.t('requests.timeRemaining.minutes', { minutes: minutesLeft });
  } else {
    timeLeftText = i18n.t('requests.timeRemaining.expired');
  }

  const timeAgo = formatTimeAgo(createdAt);
  const cleanUsername = req.telegram_username.replace(/^@/, '');

  return `
    <article class="request-card" data-id="${req.id}">
      <div class="request-header">
        <span class="player-name">🌾 ${escapeHtml(req.player_name)}</span>
        <span class="time-left">${timeLeftText}</span>
      </div>
      
      ${req.details ? `<p class="request-details">${escapeHtml(req.details)}</p>` : ''}
      
      <div style="margin-bottom:0.75rem;font-size:0.85rem;color:var(--text-light)">
        <small>${i18n.t('requests.postedAgo', { timeAgo })} • @${escapeHtml(cleanUsername)}</small>
      </div>
      
      <div class="request-actions">
        <a href="https://t.me/${cleanUsername}" 
           class="btn btn-help" 
           data-username="${cleanUsername}"
           target="_blank"
           rel="noopener">
          ${i18n.t('requests.helpButton')}
        </a>
        <button class="btn btn-delete" data-id="${req.id}">
          ${i18n.t('requests.removeButton')}
        </button>
      </div>
    </article>
  `;
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
  
  const intervals = [
    { label: i18n.t('time.year'), seconds: 31536000 },
    { label: i18n.t('time.month'), seconds: 2592000 },
    { label: i18n.t('time.day'), seconds: 86400 },
    { label: i18n.t('time.hour'), seconds: 3600 },
    { label: i18n.t('time.minute'), seconds: 60 }
  ];
  
  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) {
      return `${count}${interval.label} ${i18n.t('time.ago', { defaultValue: 'ago' })}`;
    }
  }
  return i18n.t('time.justNow');
}

function showToast(message, type = 'success') {
  let toast = document.getElementById('tg-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'tg-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: max(20px, env(safe-area-inset-bottom));
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: ${type === 'error' ? 'var(--danger)' : 'var(--text)'};
      color: ${type === 'error' ? 'white' : 'var(--tg-bg, white)'};
      padding: 12px 20px;
      border-radius: 12px;
      font-size: 0.95rem;
      z-index: 9999;
      transition: transform 0.3s ease;
      max-width: 85%;
      text-align: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    document.body.appendChild(toast);
  }
  
  toast.textContent = message;
  toast.style.background = type === 'error' ? 'var(--danger)' : 'var(--text)';
  toast.style.color = type === 'error' ? 'white' : 'var(--tg-bg, white)';
  
  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });
  
  setTimeout(() => {
    toast.style.transform = 'translateX(-50%) translateY(100px)';
  }, 3000);
}