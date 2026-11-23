const loginView = document.getElementById('loginView');
const adminView = document.getElementById('adminView');
const adminList = document.getElementById('adminList');
const adminEmpty = document.getElementById('adminEmpty');
const modal = document.getElementById('modal');
const toast = document.getElementById('toast');

let editingId = null;

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
  if (me.loggedIn) showAdmin(); else showLogin();
}

function showLogin() { loginView.style.display = 'block'; adminView.style.display = 'none'; }
function showAdmin() { loginView.style.display = 'none'; adminView.style.display = 'block'; loadList(); }

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
  document.getElementById('mFileHint').textContent = 'Required when creating.';
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
  document.getElementById('mFileHint').textContent = 'Leave empty to keep current file: ' + d.original_name;
  modal.classList.add('open');
}

document.getElementById('cancelBtn').addEventListener('click', () => modal.classList.remove('open'));

document.getElementById('saveBtn').addEventListener('click', async () => {
  const title = document.getElementById('mTitle').value.trim();
  const description = document.getElementById('mDesc').value.trim();
  const fileInput = document.getElementById('mFile');
  const fd = new FormData();
  fd.append('title', title);
  fd.append('description', description);
  if (fileInput.files[0]) fd.append('file', fileInput.files[0]);

  try {
    if (editingId) {
      await api('/downloads/' + editingId, { method:'PUT', body: fd });
      showToast('Updated');
    } else {
      if (!fileInput.files[0]) { showToast('File required', true); return; }
      await api('/downloads', { method:'POST', body: fd });
      showToast('Created');
    }
    modal.classList.remove('open');
    loadList();
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
