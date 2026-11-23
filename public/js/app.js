const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');

function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024*1024) return (b/1024).toFixed(1) + ' KB';
  if (b < 1024*1024*1024) return (b/1024/1024).toFixed(1) + ' MB';
  return (b/1024/1024/1024).toFixed(2) + ' GB';
}

async function load() {
  const res = await fetch('/api/downloads');
  const data = await res.json();
  listEl.innerHTML = '';
  if (!data.length) { emptyEl.style.display = 'block'; return; }
  emptyEl.style.display = 'none';
  for (const d of data) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="download-item">
        <div class="meta">
          <h3>${escapeHtml(d.title)}</h3>
          <p>${escapeHtml(d.description || '')}</p>
          <div class="stats">
            <span>File: ${escapeHtml(d.original_name)}</span>
            <span>Size: ${formatBytes(d.size)}</span>
            <span>Downloads: ${d.downloads}</span>
          </div>
        </div>
        <div class="actions">
          <a class="btn primary" href="/api/downloads/${d.id}/file">Download</a>
        </div>
      </div>`;
    listEl.appendChild(card);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

load();
