const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const requestForm = document.getElementById('requestForm');
const requestsList = document.getElementById('requestsList');

loadRequests();

requestForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const playerName = document.getElementById('playerName').value.trim();
  const telegramUsername = document.getElementById('telegramUsername').value.trim().replace(/^@/, '');
  const details = document.getElementById('details').value.trim();
  
  if (!playerName || !telegramUsername) return;
  
  const button = requestForm.querySelector('button');
  button.disabled = true;
  button.textContent = 'Posting...';
  
  const { data, error } = await supabase
    .from('help_requests')
    .insert({
      player_name: playerName,
      telegram_username: telegramUsername,
      details: details
    })
    .select();
  
  if (error) {
    alert('Error posting request: ' + error.message);
  } else {
    requestForm.reset();
    loadRequests();
  }
  
  button.disabled = false;
  button.textContent = 'Post Request';
});

async function loadRequests() {
  requestsList.innerHTML = '<div class="loading">Loading requests...</div>';
  
  const { data, error } = await supabase
    .from('help_requests')
    .select()
    .order('created_at', { ascending: false });
  
  if (error) {
    requestsList.innerHTML = '<p class="error">Error loading requests.</p>';
    return;
  }
  
  if (!data || data.length === 0) {
    requestsList.innerHTML = '<p class="empty">No active help requests. Be the first to post!</p>';
    return;
  }
  
  requestsList.innerHTML = data.map(req => createRequestCard(req)).join('');
  
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      if (!confirm('Remove this request?')) return;
      
      const { error } = await supabase
        .from('help_requests')
        .delete()
        .eq('id', id);
      
      if (error) {
        alert('Error removing request.');
      } else {
        loadRequests();
      }
    });
  });
}

function createRequestCard(req) {
  const createdAt = new Date(req.created_at);
  const expiresIn = Math.max(0, Math.floor((new Date(req.expires_at) - Date.now()) / (1000 * 60 * 60)));
  const timeLeft = expiresIn > 0 ? `${expiresIn}h remaining` : 'Expired';
  
  return `
    <div class="request-card">
      <div class="request-header">
        <span class="player-name">🌾 ${escapeHtml(req.player_name)}</span>
        <span class="time-left">${timeLeft}</span>
      </div>
      ${req.details ? `<p class="request-details">${escapeHtml(req.details)}</p>` : ''}
      <div class="request-actions">
        <a href="https://t.me/${escapeHtml(req.telegram_username)}" target="_blank" rel="noopener noreferrer" class="btn btn-help">
          💬 Help Them
        </a>
        <button class="btn btn-delete" data-id="${req.id}">
          Remove
        </button>
      </div>
    </div>
  `;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
