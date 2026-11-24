const setupView = document.getElementById('setupView');
const loginView = document.getElementById('loginView');
const adminView = document.getElementById('adminView');
const adminList = document.getElementById('adminList');
const adminEmpty = document.getElementById('adminEmpty');
const modal = document.getElementById('modal');
const toast = document.getElementById('toast');

let editingId = null;
let allTags = [];

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024*1024) return (b/1024).toFixed(1) + ' KB';
  if (b < 1024*1024*1024) return (b/1024/1024).toFixed(1) + ' MB';
  return (b/1024/1024/1024).toFixed(2) + ' GB';
}
function showToast(msg, err) {
  toast.textContent = msg;
  toast.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 2800);
}

async function api(path, opts) {
  const res = await fetch('/api/admin' + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function checkAuth() {
  const me = await api('/me');
  if (me.needsSetup) showSetup();
  else if (me.loggedIn) showAdmin();
  else showLogin();
}

function showSetup() { setupView.style.display = 'block'; loginView.style.display = 'none'; adminView.style.display = 'none'; }
function showLogin() { setupView.style.display = 'none'; loginView.style.display = 'block'; adminView.style.display = 'none'; }
function showAdmin() { setupView.style.display = 'none'; loginView.style.display = 'none'; adminView.style.display = 'block'; loadList(); loadTags(); }

document.getElementById('loginBtn').addEventListener('click', async () => {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const err = document.getElementById('loginErr');
  err.textContent = '';
  try {
    await api('/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username, password }) });
    showAdmin();
  } catch (e) { err.textContent = e.message; }
});
document.getElementById('password').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('loginBtn').click(); });

document.getElementById('setupBtn').addEventListener('click', async () => {
  const username = document.getElementById('setupUsername').value.trim();
  const password = document.getElementById('setupPassword').value;
  const confirm = document.getElementById('setupConfirm').value;
  const err = document.getElementById('setupErr');
  err.textContent = '';
  if (password.length < 4) { err.textContent = 'Password must be at least 4 characters.'; return; }
  if (password !== confirm) { err.textContent = 'Passwords do not match.'; return; }
  try {
    await api('/setup', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username, password }) });
    showAdmin();
  } catch (e) { err.textContent = e.message; }
});

async function loadTags() {
  try { allTags = await api('/tags'); } catch (e) { allTags = []; }
  renderTagSuggestions();
}
function renderTagSuggestions() {
  const box = document.getElementById('tagSuggestions');
  if (!box) return;
  box.innerHTML = '';
  for (const t of allTags) {
    const chip = document.createElement('span');
    chip.className = 'btn';
    chip.style.padding = '4px 10px';
    chip.style.fontSize = '12px';
    chip.textContent = t.name;
    chip.addEventListener('click', () => {
      const input = document.getElementById('mTags');
      const parts = input.value.split(',').map(s=>s.trim()).filter(Boolean);
      if (!parts.includes(t.name)) parts.push(t.name);
      input.value = parts.join(', ');
    });
    box.appendChild(chip);
  }
}

async function loadList() {
  const data = await api('/downloads');
  adminList.innerHTML = '';
  if (!data.length) { adminEmpty.style.display = 'block'; return; }
  adminEmpty.style.display = 'none';
  for (const d of data) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="download-item">
        <div class="meta">
          <h3>${escapeHtml(d.title)}</h3>
          <p>${escapeHtml(d.description || '')}</p>
          <div class="stats">
            <span>Tags: ${(d.tags||[]).map(t=>escapeHtml(typeof t==='string'?t:t.name)).join(', ') || 'none'}</span>
          </div>
          <div class="stats">
            <span>Type: ${d.type === 'link' ? 'Link' : 'File'}</span>
            <span>${d.type === 'link' ? 'URL: ' + escapeHtml(d.url) : 'File: ' + escapeHtml(d.original_name)}</span>
            <span>Size: ${formatBytes(d.size)}</span>
            <span>Downloads: ${d.downloads}</span>
          </div>
        </div>
        <div class="actions">
          <button class="btn" data-edit="${d.id}">Edit</button>
          <button class="btn danger" data-del="${d.id}">Delete</button>
        </div>
      </div>`;
    adminList.appendChild(card);
  }
  adminList.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openEdit(+b.dataset.edit)));
  adminList.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => doDelete(+b.dataset.del)));
}

document.getElementById('addBtn').addEventListener('click', () => openAdd());

function openAdd() {
  editingId = null;
  document.getElementById('modalTitle').textContent = 'Add Download';
  document.getElementById('mTitle').value = '';
  document.getElementById('mDesc').value = '';
  document.getElementById('mFile').value = '';
  document.getElementById('mUrl').value = '';
  document.getElementById('mTags').value = '';
  document.getElementById('mFileHint').textContent = 'Upload a file, or paste a link below.';
  modal.classList.add('open');
}
async function openEdit(id) {
  editingId = id;
  const data = await api('/downloads');
  const d = data.find(x => x.id === id);
  document.getElementById('modalTitle').textContent = 'Edit Download';
  document.getElementById('mTitle').value = d.title;
  document.getElementById('mDesc').value = d.description || '';
  document.getElementById('mFile').value = '';
  document.getElementById('mUrl').value = d.type === 'link' ? (d.url || '') : '';
  document.getElementById('mTags').value = (d.tags || []).map(t => (typeof t === 'string' ? t : t.name)).join(', ');
  document.getElementById('mFileHint').textContent = d.type === 'link'
    ? 'Currently a link. Upload a file to replace, or update the URL.'
    : 'Leave empty to keep current file: ' + d.original_name;
  modal.classList.add('open');
}

document.getElementById('cancelBtn').addEventListener('click', () => modal.classList.remove('open'));

document.getElementById('saveBtn').addEventListener('click', async () => {
  const title = document.getElementById('mTitle').value.trim();
  const description = document.getElementById('mDesc').value.trim();
  const fileInput = document.getElementById('mFile');
  const url = document.getElementById('mUrl').value.trim();
  const tagsRaw = document.getElementById('mTags').value.trim();
  const tagNames = tagsRaw ? tagsRaw.split(',').map(s=>s.trim()).filter(Boolean) : [];
  const fd = new FormData();
  fd.append('title', title);
  fd.append('description', description);
  fd.append('url', url);
  fd.append('tags', JSON.stringify(tagNames));
  if (fileInput.files[0]) fd.append('file', fileInput.files[0]);

  try {
    if (editingId) {
      await api('/downloads/' + editingId, { method:'PUT', body: fd });
      showToast('Updated');
    } else {
      if (!fileInput.files[0] && !url) { showToast('File or link required', true); return; }
      await api('/downloads', { method:'POST', body: fd });
      showToast('Created');
    }
    modal.classList.remove('open');
    loadList();
    loadTags();
  } catch (e) { showToast(e.message, true); }
});

async function doDelete(id) {
  if (!confirm('Delete this download?')) return;
  try {
    await api('/downloads/' + id, { method:'DELETE' });
    showToast('Deleted');
    loadList();
  } catch (e) { showToast(e.message, true); }
}

checkAuth();
EOF
echo done