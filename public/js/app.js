const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');
const tagFilterEl = document.getElementById('tagFilter');

let allDownloads = [];
let allTags = [];
let activeTag = null;

function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024*1024) return (b/1024).toFixed(1) + ' KB';
  if (b < 1024*1024*1024) return (b/1024/1024).toFixed(1) + ' MB';
  return (b/1024/1024/1024).toFixed(2) + ' GB';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function tagName(t) { return typeof t === 'string' ? t : t.name; }

function faviconUrl(url) {
  try {
    const u = new URL(url);
    return 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(u.hostname) + '&sz=64';
  } catch (e) { return ''; }
}

function renderTagFilter() {
  tagFilterEl.innerHTML = '';
  const allChip = document.createElement('button');
  allChip.className = 'btn';
  allChip.style.padding = '6px 12px';
  allChip.style.fontSize = '12px';
  allChip.textContent = 'All';
  if (!activeTag) allChip.style.borderColor = 'var(--gold)';
  allChip.addEventListener('click', () => { activeTag = null; render(); renderTagFilter(); });
  tagFilterEl.appendChild(allChip);
  for (const t of allTags) {
    const name = tagName(t);
    const chip = document.createElement('button');
    chip.className = 'btn';
    chip.style.padding = '6px 12px';
    chip.style.fontSize = '12px';
    chip.textContent = name;
    if (activeTag === name) chip.style.borderColor = 'var(--gold)';
    chip.addEventListener('click', () => { activeTag = name; render(); renderTagFilter(); });
    tagFilterEl.appendChild(chip);
  }
}

function render() {
  listEl.innerHTML = '';
  let data = allDownloads;
  if (activeTag) {
    data = data.filter(d => (d.tags || []).map(tagName).includes(activeTag));
  }
  if (!data.length) { emptyEl.style.display = 'block'; return; }
  emptyEl.style.display = 'none';
  for (const d of data) {
    const tags = (d.tags || []).map(tagName).map(n => `<span style="display:inline-block;padding:2px 8px;margin:2px;border:1px solid var(--border-gold);font-size:11px;color:var(--gold-bright);">${escapeHtml(n)}</span>`).join(' ');
    let iconHtml = '';
    if (d.type === 'link') {
      const fu = faviconUrl(d.url);
      if (fu) iconHtml = `<img src="${escapeHtml(fu)}" alt="" style="width:32px;height:32px;object-fit:contain;margin-right:12px;vertical-align:middle;" onerror="this.style.display='none'" />`;
    } else {
      iconHtml = `<span style="font-size:28px;margin-right:12px;vertical-align:middle;">📄</span>`;
    }
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="download-item">
        <div class="meta">
          ${iconHtml}<h3 style="display:inline-block;vertical-align:middle;">${escapeHtml(d.title)}</h3>
          <p>${escapeHtml(d.description || '')}</p>
          ${tags ? `<div style="margin-bottom:8px;">${tags}</div>` : ''}
          <div class="stats">
            <span>${d.type === 'link' ? 'Link' : 'File'}: ${escapeHtml(d.type === 'link' ? d.url : d.original_name)}</span>
            ${d.type === 'file' ? '<span>Size: ' + formatBytes(d.size) + '</span>' : ''}
            <span>Downloads: ${d.downloads}</span>
          </div>
        </div>
        <div class="actions">
          <a class="btn primary" href="/api/downloads/${d.id}/file">${d.type === 'link' ? 'Open Link' : 'Download'}</a>
        </div>
      </div>`;
    listEl.appendChild(card);
  }
}

async function load() {
  const [dlRes, tagRes] = await Promise.all([
    fetch('/api/downloads'),
    fetch('/api/tags')
  ]);
  allDownloads = await dlRes.json();
  allTags = await tagRes.json();
  renderTagFilter();
  render();
}

load();