const setupView = document.getElementById('setupView');
const loginView = document.getElementById('loginView');
const adminView = document.getElementById('adminView');
const adminList = document.getElementById('adminList');
const adminEmpty = document.getElementById('adminEmpty');
const modal = document.getElementById('modal');
const toast = document.getElementById('toast');

let editingId = null;
let allTags = [];
let allIcons = [];
let selectedExistingIcon = '';

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
function showAdmin() { setupView.style.display = 'none'; loginView.style.display = 'none'; adminView.style.display = 'block'; loadList(); loadTags(); loadIcons(); }

async function loadIcons() {
  try { allIcons = await api('/icons'); } catch (e) { allIcons = []; }
  renderIconGallery();
}
function updateIconPreview() {
  const preview = document.getElementById('iconPreview');
  if (!preview) return;
  let src = '';
  if (selectedExistingIcon) {
    src = '/uploads/' + encodeURIComponent(selectedExistingIcon);
  } else {
    const iu = document.getElementById('mIconUrl').value.trim();
    if (iu) src = iu;
  }
  if (src) { preview.src = src; preview.style.display = 'inline-block'; }
  else { preview.style.display = 'none'; }
}

function renderIconGallery() {
  const box = document.getElementById('iconGallery');
  if (!box) return;
  box.innerHTML = '';
  if (!allIcons.length) { box.textContent = 'No uploaded images yet.'; box.style.color = 'var(--ink-muted)'; return; }
  for (const ic of allIcons) {
    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    wrap.style.display = 'inline-block';
    const img = document.createElement('img');
    img.src = ic.url;
    img.title = ic.filename;
    img.style.width = '48px';
    img.style.height = '48px';
    img.style.objectFit = 'cover';
    img.style.cursor = 'pointer';
    img.style.border = '2px solid transparent';
    img.style.borderRadius = '2px';
    if (selectedExistingIcon === ic.filename) img.style.borderColor = 'var(--gold)';
    img.addEventListener('click', () => {
      if (selectedExistingIcon === ic.filename) {
        selectedExistingIcon = '';
      } else {
        selectedExistingIcon = ic.filename;
      }
      document.getElementById('mIconExisting').value = selectedExistingIcon;
      renderIconGallery();
    });
    const del = document.createElement('button');
    del.textContent = '×';
    del.title = 'Delete icon';
    del.style.position = 'absolute';
    del.style.top = '-6px';
    del.style.right = '-6px';
    del.style.width = '18px';
    del.style.height = '18px';
    del.style.padding = '0';
    del.style.fontSize = '12px';
    del.style.lineHeight = '1';
    del.style.borderRadius = '50%';
    del.style.cursor = 'pointer';
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Delete this icon?')) return;
      try {
        await api('/icons/' + encodeURIComponent(ic.filename), { method: 'DELETE' });
        if (selectedExistingIcon === ic.filename) { selectedExistingIcon = ''; document.getElementById('mIconExisting').value = ''; }
        await loadIcons();
        showToast('Icon deleted');
      } catch (err) { showToast(err.message, true); }
    });
    wrap.appendChild(img);
    wrap.appendChild(del);
    box.appendChild(wrap);
  }
  updateIconPreview();
}

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

async function loadList() {
  const data = await api('/downloads');
  adminList.innerHTML = '';
  if (!data.length) { adminEmpty.style.display = 'block'; return; }
  adminEmpty.style.display = 'none';
  for (const d of data) {
    const card = document.createElement('div');
    card.className = 'card';
    const iconSrc = d.icon_type === 'file' ? ('/uploads/' + encodeURIComponent(d.icon)) : (d.icon_type === 'url' ? d.icon : '');
    const iconHtml = iconSrc ? `<img src="${escapeHtml(iconSrc)}" alt="" style="width:40px;height:40px;object-fit:cover;border:1px solid var(--border);margin-right:10px;vertical-align:middle;" onerror="this.style.display='none'" />` : '';
    card.innerHTML = `
      <div class="download-item">
        <div class="meta">
          ${iconHtml}<h3 style="display:inline-block;vertical-align:middle;">${escapeHtml(d.title)}</h3>
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
  document.getElementById('mIcon').value = '';
  document.getElementById('mIconUrl').value = '';
  document.getElementById('mTags').value = '';
  selectedExistingIcon = '';
  document.getElementById('mIconExisting').value = '';
  renderIconGallery();
  document.getElementById('mFileHint').textContent = 'Upload a file, or paste a link below.';
  document.getElementById('mIconHint').textContent = 'Optional icon/picture for this entry.';
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
  document.getElementById('mIcon').value = '';
  document.getElementById('mIconUrl').value = d.icon_type === 'url' ? (d.icon || '') : '';
  selectedExistingIcon = d.icon_type === 'file' ? (d.icon || '') : '';
  document.getElementById('mIconExisting').value = selectedExistingIcon;
  renderIconGallery();
  document.getElementById('mTags').value = (d.tags || []).map(t => (typeof t === 'string' ? t : t.name)).join(', ');
  document.getElementById('mFileHint').textContent = d.type === 'link'
    ? 'Currently a link. Upload a file to replace, or update the URL.'
    : 'Leave empty to keep current file: ' + d.original_name;
  document.getElementById('mIconHint').textContent = d.icon_type === 'file'
    ? 'Current icon: ' + d.icon + '. Upload a new one to replace.'
    : (d.icon_type === 'url' ? 'Current icon URL set.' : 'Optional icon/picture.');
  modal.classList.add('open');
}

document.getElementById('cancelBtn').addEventListener('click', () => modal.classList.remove('open'));

document.getElementById('saveBtn').addEventListener('click', async () => {
  const title = document.getElementById('mTitle').value.trim();
  const description = document.getElementById('mDesc').value.trim();
  const fileInput = document.getElementById('mFile');
  const url = document.getElementById('mUrl').value.trim();
  const iconInput = document.getElementById('mIcon');
  const iconUrl = document.getElementById('mIconUrl').value.trim();
  const tagsRaw = document.getElementById('mTags').value.trim();
  const tagNames = tagsRaw ? tagsRaw.split(',').map(s=>s.trim()).filter(Boolean) : [];
  const fd = new FormData();
  fd.append('title', title);
  fd.append('description', description);
  fd.append('url', url);
  fd.append('icon_url', iconUrl);
  fd.append('icon_existing', selectedExistingIcon);
  fd.append('tags', JSON.stringify(tagNames));
  if (fileInput.files[0]) fd.append('file', fileInput.files[0]);
  if (iconInput.files[0]) fd.append('icon', iconInput.files[0]);

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
    loadIcons();
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

// Icon upload button wiring
const uploadIconBtn = document.getElementById('uploadIconBtn');
const iconUploadInput = document.getElementById('iconUploadInput');
if (uploadIconBtn && iconUploadInput) {
  uploadIconBtn.addEventListener('click', () => iconUploadInput.click());
  iconUploadInput.addEventListener('change', async () => {
    const f = iconUploadInput.files[0];
    if (!f) return;
    const fd = new FormData();
    fd.append('icon', f);
    try {
      const res = await api('/icons', { method: 'POST', body: fd });
      showToast('Icon uploaded: ' + res.filename);
      selectedExistingIcon = res.filename;
      document.getElementById('mIconExisting').value = selectedExistingIcon;
      await loadIcons();
      updateIconPreview();
    } catch (e) { showToast(e.message, true); }
    iconUploadInput.value = '';
  });
}

// live preview for icon URL field
const mIconUrlInput = document.getElementById('mIconUrl');
if (mIconUrlInput) mIconUrlInput.addEventListener('input', updateIconPreview);

checkAuth();
