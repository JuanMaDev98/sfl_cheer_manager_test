// ========================================
// TELEGRAM WEBAPP INIT
// ========================================
const tg = window.Telegram?.WebApp;

// Inicializar Telegram WebApp si estamos dentro de Telegram
if (tg) {
  tg.expand(); // Expandir a pantalla completa
  tg.ready();  // Notificar que la app está lista
  
  // Configurar colores de la barra superior (opcional pero recomendado)
  if (tg.themeParams?.bg_color) {
    document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color);
  }
  if (tg.themeParams?.text_color) {
    document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color);
  }
  
  // Mostrar botón de retroceso si es útil
  if (tg.BackButton) {
    tg.BackButton.onClick(() => {
      // Comportamiento personalizado si es necesario
      tg.close();
    });
    tg.BackButton.show();
  }
}

// ========================================
// SUPABASE CLIENT SETUP
// ========================================
// Las variables se inyectan desde el entorno (Wrangler/Cloudflare)
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

// Cargar solicitudes al iniciar
document.addEventListener('DOMContentLoaded', () => {
  loadRequests();
  
  // Auto-recargar cada 5 minutos para ver nuevas solicitudes
  setInterval(loadRequests, 5 * 60 * 1000);
});

// Submit del formulario
requestForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const playerName = document.getElementById('playerName').value.trim();
  const telegramUsername = document.getElementById('telegramUsername').value.trim().replace(/^@/, '');
  const details = document.getElementById('details').value.trim();

  if (!playerName || !telegramUsername) {
    showToast('⚠️ Por favor completa los campos obligatorios', 'error');
    return;
  }

  // Feedback visual inmediato
  const button = requestForm.querySelector('button');
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = '🔄 Posting...';

  try {
    // Preparar datos para enviar
    const requestData = {
      player_name: playerName,
      telegram_username: telegramUsername,
      details: details,
      // 🔐 IMPORTANTE: Adjuntar initData de Telegram para verificación en backend
      tg_init_data: tg?.initData || null,
      tg_user_id: tg?.initDataUnsafe?.user?.id || null
    };

    const { data, error } = await supabase
      .from('help_requests')
      .insert(requestData)
      .select();

    if (error) throw error;

    // Éxito: resetear formulario y recargar lista
    showToast('✅ ¡Solicitud publicada con éxito!');
    requestForm.reset();
    loadRequests();
    
    // Opcional: Haptic feedback en móviles
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.notificationOccurred('success');
    }
    
  } catch (err) {
    console.error('Error posting request:', err);
    showToast('❌ Error al publicar. Intenta de nuevo.', 'error');
    
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.notificationOccurred('error');
    }
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
});

// Cargar y renderizar solicitudes
async function loadRequests() {
  if (!requestsList) return;
  
  requestsList.innerHTML = '<div class="loading">🌻 Loading requests...</div>';

  try {
    const { data, error } = await supabase
      .from('help_requests')
      .select()
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      requestsList.innerHTML = `
        <div class="empty">
          🌱 No active help requests yet.<br>
          <small style="opacity:0.8">Be the first to post!</small>
        </div>
      `;
      return;
    }

    // Filtrar visualmente solicitudes expiradas (la expiración real debe ser en backend)
    const now = Date.now();
    const validRequests = data.filter(req => new Date(req.expires_at).getTime() > now);
    
    if (validRequests.length === 0) {
      requestsList.innerHTML = '<div class="empty">⏰ All requests have expired. Post a new one!</div>';
      return;
    }

    requestsList.innerHTML = validRequests.map(req => createRequestCard(req)).join('');

    // Bind eventos de botones
    bindCardEvents();
    
  } catch (err) {
    console.error('Error loading requests:', err);
    requestsList.innerHTML = '<div class="error">⚠️ Error loading requests. Pull to refresh.</div>';
  }
}

// Bind de eventos en las tarjetas (después de renderizar)
function bindCardEvents() {
  // Botones de ayuda (abrir Telegram)
  document.querySelectorAll('.btn-help').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const username = btn.dataset.username;
      
      // Usar API nativa de Telegram para abrir chat (mejor UX)
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(`https://t.me/${username}`);
      } else {
        // Fallback para web normal
        window.open(`https://t.me/${username}`, '_blank');
      }
      
      // Haptic feedback sutil
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.selectionChanged();
      }
    });
  });

  // Botones de eliminar (solo si el usuario es el creador)
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = btn.dataset.id;
      
      // Confirmación nativa de Telegram si está disponible
      if (tg?.showConfirm) {
        const confirmed = await new Promise(resolve => {
          tg.showConfirm('Remove this help request?', (confirmed) => resolve(confirmed));
        });
        if (!confirmed) return;
      } else if (!confirm('Remove this request?')) {
        return;
      }

      try {
        const { error } = await supabase
          .from('help_requests')
          .delete()
          .eq('id', id);

        if (error) throw error;
        
        showToast('🗑️ Request removed');
        loadRequests();
        
        if (tg?.HapticFeedback) {
          tg.HapticFeedback.notificationOccurred('success');
        }
      } catch (err) {
        console.error('Error deleting:', err);
        showToast('❌ Error removing request', 'error');
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
  
  let timeLeftText;
  if (hoursLeft >= 1) {
    timeLeftText = `⏳ ${hoursLeft}h remaining`;
  } else if (minutesLeft > 0) {
    timeLeftText = `⏳ ${minutesLeft}m remaining`;
  } else {
    timeLeftText = '⚠️ Expired';
  }

  // Formatear hora de creación
  const timeAgo = formatTimeAgo(createdAt);

  // Username limpio para enlace
  const cleanUsername = req.telegram_username.replace(/^@/, '');

  return `
    <article class="request-card" data-id="${req.id}">
      <div class="request-header">
        <span class="player-name">🌾 ${escapeHtml(req.player_name)}</span>
        <span class="time-left">${timeLeftText}</span>
      </div>
      
      ${req.details ? `<p class="request-details">${escapeHtml(req.details)}</p>` : ''}
      
      <div style="margin-bottom:0.75rem;font-size:0.85rem;color:var(--text-light)">
        <small>Posted ${timeAgo} • @${escapeHtml(cleanUsername)}</small>
      </div>
      
      <div class="request-actions">
        <a href="https://t.me/${cleanUsername}" 
           class="btn btn-help" 
           data-username="${cleanUsername}"
           target="_blank"
           rel="noopener">
          💬 Help Them
        </a>
        <button class="btn btn-delete" data-id="${req.id}">
          🗑️ Remove
        </button>
      </div>
    </article>
  `;
}

// ========================================
// UTILIDADES
// ========================================

// Escape HTML para prevenir XSS
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Formato "hace X tiempo"
function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  const intervals = [
    { label: 'y', seconds: 31536000 },
    { label: 'mo', seconds: 2592000 },
    { label: 'd', seconds: 86400 },
    { label: 'h', seconds: 3600 },
    { label: 'm', seconds: 60 }
  ];
  
  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) {
      return `${count}${interval.label} ago`;
    }
  }
  return 'just now';
}

// Toast notifications simples
function showToast(message, type = 'success') {
  // Crear toast si no existe
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
  
  // Mostrar
  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });
  
  // Ocultar después de 3 segundos
  setTimeout(() => {
    toast.style.transform = 'translateX(-50%) translateY(100px)';
  }, 3000);
}