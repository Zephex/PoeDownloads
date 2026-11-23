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
    const iconSrc = d.icon_type === 'file' ? ('/uploads/' + encodeURIComponent(d.icon)) : (d.icon_type === 'url' ? d.icon : '');
    const iconHtml = iconSrc ? `<img src="${escapeHtml(iconSrc)}" alt="" style="width:48px;height:48px;object-fit:cover;border:1px solid var(--border-gold);margin-right:12px;vertical-align:middle;border-radius:2px;" onerror="this.style.display='none'" />` : '';
    card.innerHTML = `
      <div class="download-item">
        <div class="meta">
          ${iconHtml}<h3 style="display:inline-block;vertical-align:middle;">${escapeHtml(d.title)}</h3>`
          <p>${escapeHtml(d.description || '')}</p>
          <div class="stats">
            <span>${d.type === 'link' ? 'Link' : 'File'}: ${escapeHtml(d.type === 'link' ? d.url : d.original_name)}</span>
            ${d.type === 'file' ? '<span>Size: ' + formatBytes(d.size) + '</span>' : ''}
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
