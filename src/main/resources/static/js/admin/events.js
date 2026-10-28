/* JODOK Admin – giao diện quản lý sự kiện/BST. Giữ API và tên hàm cũ. */
const eventEscape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let eventCache = [];

// Thông báo gọn trong Admin, không dùng alert() của trình duyệt.
function saleEventToast(message, type = 'success') {
  document.getElementById('sale-event-toast')?.remove();
  const toast = document.createElement('div');
  toast.id = 'sale-event-toast';
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  const success = type === 'success';
  toast.className = 'fixed right-5 top-5 z-[300] flex items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-2xl max-w-[min(420px,calc(100vw-40px))]';
  toast.style.borderColor = success ? '#bbf7d0' : '#fecaca';
  toast.innerHTML = `
    <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}" aria-hidden="true">${success ? '✓' : '!'}</span>
    <div class="min-w-0 flex-1">
      <p class="text-sm font-semibold text-gray-900">${success ? 'Thành công' : 'Có lỗi xảy ra'}</p>
      <p class="mt-0.5 text-xs text-gray-600 break-words">${eventEscape(message)}</p>
    </div>
    <button type="button" class="ml-1 text-gray-400 hover:text-gray-700" aria-label="Đóng thông báo">✕</button>`;
  toast.querySelector('button').onclick = () => toast.remove();
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.isConnected) toast.remove(); }, 3500);
}


function eventPanel() {
  return `
    <style>
      #sale-events-admin{--event-red:#922a35;color:#242424}
      #sale-events-admin .ev-card{background:#fff;border:1px solid #e9e9ed;border-radius:16px;overflow:hidden;transition:box-shadow .2s,transform .2s}
      #sale-events-admin .ev-card:hover{box-shadow:0 10px 28px rgba(30,20,20,.08);transform:translateY(-2px)}
      #sale-events-admin .ev-image{height:148px;width:100%;object-fit:cover;display:block;background:#f6e8e9}
      #sale-events-admin .ev-input{width:100%;min-width:0;background:white;border:1px solid #d9d9de;border-radius:10px;padding:10px 12px;outline:none;transition:border-color .2s,box-shadow .2s}
      #sale-events-admin .ev-input:focus{border-color:#922a35;box-shadow:0 0 0 3px #922a351a}
      #sale-events-admin .ev-label{display:block;font-size:13px;font-weight:600;color:#42424a;margin-bottom:6px}
      #sale-events-admin .ev-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:10px;padding:9px 14px;font-weight:600;transition:background .2s}
      #sale-events-admin .ev-primary{background:#922a35;color:#fff}
      #sale-events-admin .ev-primary:hover{background:#741f28}
      #sale-events-admin .ev-muted{background:#f5f5f6;color:#3f3f46}
      #sale-events-admin .ev-muted:hover{background:#e9e9ed}
      #sale-events-admin .ev-danger{background:#fff1f2;color:#be123c}
      #sale-events-admin .ev-danger:hover{background:#ffe4e6}
      #sale-events-admin .ev-outline{border:1px solid #e4e4e7;background:#fff;color:#52525b}
      #sale-events-admin .ev-outline:hover{border-color:#922a35;color:#922a35}
      #sale-events-admin .ev-pill{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;font-size:11px;font-weight:700}
      #sale-events-admin .ev-field{min-width:0}
      #sale-events-admin .ev-preview{width:100%;max-height:180px;object-fit:cover;border-radius:10px;border:1px solid #eee}
    </style>
    <section id="sale-events-admin" class="space-y-5">
      <div class="bg-white border border-gray-100 rounded-2xl p-5 md:p-6 shadow-sm">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 class="text-xl md:text-2xl font-bold text-[#922a35]">Quản lý BST & sự kiện</h2>
            <p class="text-sm text-gray-500 mt-1">Quản lý banner, sản phẩm và thời gian ưu đãi trên JODOK.</p>
          </div>
          <button class="ev-btn ev-primary" type="button" onclick="newSaleEvent()">＋ Tạo chiến dịch</button>
        </div>
        <div id="sale-event-summary" class="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5"></div>
      </div>
      <div class="bg-white border border-gray-100 rounded-2xl p-5 md:p-6 shadow-sm">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
          <h3 class="text-lg font-bold">Danh sách chiến dịch</h3>
          <div class="flex flex-wrap gap-2">
            <input id="sale-event-search" type="search" placeholder="Tìm tên, slug..." aria-label="Tìm chiến dịch" class="ev-input" style="width:210px;max-width:100%" oninput="renderSaleEvents()" />
            <select id="sale-event-status" class="ev-input" style="width:145px" onchange="renderSaleEvents()" aria-label="Lọc trạng thái">
              <option value="all">Tất cả</option><option value="live">Đang chạy</option><option value="upcoming">Sắp diễn ra</option><option value="ended">Đã kết thúc</option><option value="off">Đã tắt</option>
            </select>
          </div>
        </div>
        <div id="sale-event-list" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">Đang tải...</div>
      </div>
      <div id="sale-event-editor"></div>
    </section>`;
}

function eventHeaders() {
  if (typeof adminJsonHeaders === 'function') return adminJsonHeaders();
  let account = null;
  try { account = JSON.parse(localStorage.getItem('ha_admin') || 'null'); } catch (_) {}
  return { 'Content-Type':'application/json', ...(account?.token ? {Authorization:`Bearer ${account.token}`} : {}) };
}

async function eventRequest(path, options = {}) {
  const response = await fetch(`${String(API_BASE).replace(/\/$/,'')}/events/admin${path}`, {
    ...options, headers:{...eventHeaders(), ...(options.headers || {})}
  });
  if (!response.ok) {
    const raw = await response.text();
    let message = raw;
    try { const data = JSON.parse(raw); message = data.message || data.detail || data.error || raw; } catch (_) {}
    throw new Error(`HTTP ${response.status}: ${message || ({400:'Dữ liệu không hợp lệ',401:'Vui lòng đăng nhập lại',403:'Không đủ quyền ADMIN',409:'Slug đã tồn tại',500:'Lỗi máy chủ'}[response.status] || response.statusText)}`);
  }
  if (response.status === 204) return null;
  const raw = await response.text();
  return raw ? JSON.parse(raw) : null;
}

function eventDateInput(value) { const s = String(value || ''); return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) ? s.slice(0,16) : ''; }
function eventDateDisplay(value) {
  if (!value) return 'Chưa xác định';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? eventEscape(value) : d.toLocaleString('vi-VN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'});
}
function eventStatus(e) {
  if (!e.enabled) return {key:'off',label:'Đã tắt',cls:'bg-gray-100 text-gray-600'};
  const now = Date.now(), start = new Date(e.startAt).getTime(), end = new Date(e.endAt).getTime();
  if (now < start) return {key:'upcoming',label:'Sắp diễn ra',cls:'bg-blue-50 text-blue-700'};
  if (now >= end) return {key:'ended',label:'Đã kết thúc',cls:'bg-amber-50 text-amber-700'};
  return {key:'live',label:'Đang diễn ra',cls:'bg-green-50 text-green-700'};
}
function eventDiscountLabel(e) {
  const n = Number(e.discountValue ?? 0).toLocaleString('vi-VN');
  return e.discountType === 'AMOUNT' ? `Giảm ${n}đ` : `Giảm ${n}%`;
}
function eventSafeImage(url) {
  const s = String(url || '').trim();
  // Không cho phép các scheme không an toàn trong src HTML.
  return /^(https?:\/\/|\/)/i.test(s) && !s.startsWith('//') ? eventEscape(s) : '';
}
function eventSummaryBox(number, label, color) {
  return `<div class="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3"><div class="text-2xl font-bold ${color}">${number}</div><div class="text-xs text-gray-500 mt-1">${label}</div></div>`;
}
function renderSaleEvents() {
  const el = document.getElementById('sale-event-list');
  if (!el) return;
  const summary = document.getElementById('sale-event-summary');
  if (summary) summary.innerHTML = [
    eventSummaryBox(eventCache.length,'Tổng chiến dịch','text-gray-900'),
    eventSummaryBox(eventCache.filter(e=>eventStatus(e).key==='live').length,'Đang diễn ra','text-green-700'),
    eventSummaryBox(eventCache.filter(e=>eventStatus(e).key==='upcoming').length,'Sắp diễn ra','text-blue-700'),
    eventSummaryBox(eventCache.filter(e=>eventStatus(e).key==='off').length,'Đã tắt','text-gray-500')
  ].join('');
  const search = (document.getElementById('sale-event-search')?.value || '').trim().toLowerCase();
  const status = document.getElementById('sale-event-status')?.value || 'all';
  const list = eventCache.filter(e => (
    (!search || String(e.name || '').toLowerCase().includes(search) || String(e.slug || '').toLowerCase().includes(search)) &&
    (status === 'all' || eventStatus(e).key === status)
  ));
  if (!list.length) {
    el.innerHTML = `<div class="col-span-full rounded-xl border border-dashed border-gray-200 p-10 text-center text-gray-500">${eventCache.length ? 'Không tìm thấy chiến dịch phù hợp.' : 'Chưa có BST/sự kiện. Nhấn “Tạo chiến dịch” để bắt đầu.'}</div>`;
    return;
  }
  el.innerHTML = list.map(e => {
    const badge = eventStatus(e), banner = eventSafeImage(e.bannerUrl);
    const count = Array.isArray(e.productIds) ? e.productIds.length : (e.productIds?.size ?? 0);
    return `<article class="ev-card flex flex-col">
      <div class="relative">
        ${banner ? `<img class="ev-image" src="${banner}" alt="${eventEscape(e.name)}" loading="lazy" onerror="this.style.display='none'" />` : `<div class="ev-image flex items-center justify-center text-[#922a35] text-xl font-bold">JODOK COLLECTION</div>`}
        <span class="ev-pill ${badge.cls} absolute top-3 left-3 shadow-sm">● ${badge.label}</span>
      </div>
      <div class="p-4 flex flex-col flex-1">
        <h4 class="font-bold text-gray-900 text-base leading-snug line-clamp-2">${eventEscape(e.name)}</h4>
        <p class="text-xs text-gray-500 mt-1 break-all">/events/${eventEscape(e.slug)}</p>
        <div class="text-sm text-gray-600 mt-3 space-y-1">
          <p>🗓 ${eventDateDisplay(e.startAt)} – ${eventDateDisplay(e.endAt)}</p>
          <p>🏷 ${eventEscape(eventDiscountLabel(e))} · ${count} sản phẩm</p>
        </div>
        <div class="flex flex-wrap gap-2 mt-auto pt-4 border-t border-gray-100" style="margin-top:16px">
          <a class="ev-btn ev-outline text-sm" href="/events/${encodeURIComponent(e.slug || '')}" target="_blank" rel="noopener noreferrer">Xem trang ↗</a>
          <button type="button" class="ev-btn ev-muted text-sm" onclick="editSaleEvent(${Number(e.id)})">Sửa</button>
          <button type="button" class="ev-btn ev-danger text-sm ml-auto" onclick="removeSaleEvent(${Number(e.id)})">Xóa</button>
        </div>
      </div>
    </article>`;
  }).join('');
}

async function loadSaleEvents() {
  const el = document.getElementById('sale-event-list');
  if (!el) return;
  el.innerHTML = '<p class="col-span-full text-gray-500 py-5">Đang tải danh sách...</p>';
  try {
    const result = await eventRequest('/all');
    eventCache = Array.isArray(result) ? result : [];
    renderSaleEvents();

  } catch (err) {
    el.innerHTML = `<div class="col-span-full bg-red-50 border border-red-200 rounded-xl p-4 text-red-700"><b>Không tải được sự kiện</b><p class="text-sm mt-1 break-words">${eventEscape(err.message)}</p><button class="ev-btn ev-primary mt-3" onclick="loadSaleEvents()">Thử lại</button></div>`;
  }
}

// ===== Màn hình tạo / sửa riêng, không nằm dưới danh sách =====
let saleEditorSelectedIds = new Set();
let salePickerProducts = [];
let salePickerLoaded = false;

function newSaleEvent() { openSaleEditor(null); }

function editSaleEvent(id) {
  const item = eventCache.find(e => Number(e.id) === Number(id));
  if (!item) return saleEventToast('Không tìm thấy chiến dịch cần sửa.', 'error');
  openSaleEditor(item);
}

function closeSaleProductPicker() {
  document.getElementById('sale-product-picker')?.remove();
}

function closeSaleEditor() {
  closeSaleProductPicker();
  document.getElementById('sale-event-editor-screen')?.remove();
  document.body.style.overflow = saleEditorPriorOverflow ?? '';
  saleEditorPriorOverflow = null;

}
let saleEditorPriorOverflow = null;

function saleEditorField(name, title, value, hint, options = {}) {
  const required = options.required ? 'required' : '';
  const type = options.type || 'text';
  const max = options.max ? `max="${options.max}"` : '';
  return `<div class="ev-field">
    <label class="ev-label" for="ev-${name}">${title}${options.required ? ' <span class="text-red-700">*</span>' : ''}</label>
    <input id="ev-${name}" name="${name}" type="${type}" class="ev-input"
      value="${eventEscape(value ?? '')}" placeholder="${eventEscape(hint)}" ${required} ${max}>
    <p class="mt-1 text-xs text-gray-500">${eventEscape(hint)}</p>
  </div>`;
}

function saleProductImage(p) {
  const raw = p.images?.find(i => i?.imageUrl)?.imageUrl || p.imageUrl || '';
  return eventSafeImage(raw) || '/images/no-image.png';
}
function saleProductPrice(p) {
  const n = Number(p.basePrice);
  return p.basePrice != null && Number.isFinite(n) ? n.toLocaleString('vi-VN') + 'đ' : 'Chưa có giá';
}
function updateSaleSelectedProducts() {
  const box = document.getElementById('sale-selected-products');
  const count = document.getElementById('sale-selected-count');
  if (count) count.textContent = String(saleEditorSelectedIds.size);
  if (!box) return;
  const ids = [...saleEditorSelectedIds];
  if (!ids.length) {
    box.innerHTML = '<p class="text-sm text-gray-500">Chưa chọn sản phẩm. Nhấn “Chọn sản phẩm” để thêm.</p>';
    return;
  }
  box.innerHTML = ids.map(id => {
    const p = salePickerProducts.find(x => Number(x.productId) === id);
    return `<div class="flex items-center gap-3 border rounded-xl p-2 bg-white min-w-0">
      <img class="w-12 h-12 rounded-lg object-cover bg-gray-100" src="${p ? saleProductImage(p) : '/images/no-image.png'}" onerror="this.onerror=null;this.src='/images/no-image.png'" alt="">
      <div class="min-w-0 flex-1"><div class="font-semibold text-sm truncate">${eventEscape(p?.productName || 'Sản phẩm #' + id)}</div>
      <div class="text-xs text-gray-500">${eventEscape(p ? saleProductPrice(p) : 'ID: ' + id)}</div></div>
      <button type="button" class="text-red-700 text-sm font-semibold px-2" data-remove-product="${id}" aria-label="Bỏ sản phẩm">✕</button>
    </div>`;
  }).join('');
  box.querySelectorAll('[data-remove-product]').forEach(btn => btn.addEventListener('click', () => {
    saleEditorSelectedIds.delete(Number(btn.dataset.removeProduct));
    updateSaleSelectedProducts();
  }));
}

function renderSaleProductPicker() {
  const root = document.getElementById('sale-product-picker');
  const list = root?.querySelector('#sale-picker-list');
  if (!list) return;
  const keyword = (root.querySelector('#sale-picker-search')?.value || '').trim().toLowerCase();
  const category = root.querySelector('#sale-picker-category')?.value || 'all';
  const filtered = salePickerProducts.filter(p => {
    const name = String(p.productName || '').toLowerCase();
    const id = String(p.productId);
    const catId = String(p.category?.categoryId ?? p.categoryId ?? '');
    return (!keyword || name.includes(keyword) || id.includes(keyword)) && (category === 'all' || catId === category);
  });
  root.querySelector('#sale-picker-results').textContent = `${filtered.length} sản phẩm · Đã chọn ${saleEditorSelectedIds.size}`;
  list.innerHTML = filtered.length ? filtered.map(p => {
    const id = Number(p.productId);
    const checked = saleEditorSelectedIds.has(id);
    return `<label class="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-rose-50 transition ${checked ? 'border-[#922a35] bg-rose-50' : 'border-gray-200 bg-white'}">
      <input type="checkbox" data-pick-id="${id}" ${checked ? 'checked' : ''} class="w-4 h-4 accent-[#922a35] shrink-0">
      <img class="w-14 h-16 object-cover rounded-lg bg-gray-100 shrink-0" src="${saleProductImage(p)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='/images/no-image.png'">
      <span class="flex-1 min-w-0"><span class="block font-semibold text-sm truncate">${eventEscape(p.productName)}</span>
        <span class="block text-xs text-gray-500 truncate">${eventEscape(p.category?.categoryName || 'Chưa có danh mục')} · #${id}</span>
        <span class="block text-sm font-bold text-[#922a35] mt-1">${eventEscape(saleProductPrice(p))}</span></span>
    </label>`;
  }).join('') : '<div class="p-8 text-center text-gray-500">Không tìm thấy sản phẩm phù hợp.</div>';
  list.querySelectorAll('[data-pick-id]').forEach(input => input.addEventListener('change', () => {
    const id = Number(input.dataset.pickId);
    if (input.checked) saleEditorSelectedIds.add(id);
    else saleEditorSelectedIds.delete(id);
    updateSaleSelectedProducts();
    renderSaleProductPicker();
  }));
}

async function openSaleProductPicker() {
  if (!document.getElementById('sale-event-editor-screen')) return;
  closeSaleProductPicker();
  const screen = document.createElement('div');
  screen.id = 'sale-product-picker';
  screen.className = 'fixed inset-0 z-[130] flex items-center justify-center p-3 md:p-6 bg-black/60';
  screen.innerHTML = `<style>#sale-product-picker .ev-input{padding:10px 12px;background:white;border:1px solid #d9d9de;border-radius:10px;outline:none}#sale-product-picker .ev-btn{display:inline-flex;align-items:center;justify-content:center;padding:10px 15px;border-radius:10px;font-weight:600}#sale-product-picker .ev-primary{background:#922a35;color:white}#sale-product-picker .ev-muted{background:#f1f1f3;color:#3f3f46}</style><div class="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col overflow-hidden" style="max-height:90vh">
    <div class="p-4 md:p-5 border-b flex items-center justify-between gap-3"><div><h3 class="font-bold text-xl text-[#922a35]">Chọn sản phẩm tham gia</h3>
    <p id="sale-picker-results" class="text-xs text-gray-500 mt-1">Đang tải...</p></div>
    <button type="button" id="sale-picker-close" class="ev-btn ev-muted">✕ Đóng</button></div>
    <div class="p-4 flex flex-wrap gap-3 border-b"><input id="sale-picker-search" class="ev-input flex-1" style="min-width:190px" placeholder="Tìm tên sản phẩm hoặc mã ID..." type="search">
    <select id="sale-picker-category" class="ev-input" style="max-width:220px"><option value="all">Tất cả danh mục</option></select></div>
    <div id="sale-picker-list" class="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 overflow-y-auto flex-1 min-h-0"><p>Đang tải sản phẩm...</p></div>
    <div class="p-4 border-t flex justify-between items-center"><span class="text-xs text-gray-500">Chọn nhiều sản phẩm bằng checkbox</span>
    <button type="button" id="sale-picker-done" class="ev-btn ev-primary">Xong</button></div>
  </div>`;
  document.body.appendChild(screen);
  screen.addEventListener('click', e => { if (e.target === screen) closeSaleProductPicker(); });
  screen.querySelector('#sale-picker-close').onclick = closeSaleProductPicker;
  screen.querySelector('#sale-picker-done').onclick = closeSaleProductPicker;
  screen.querySelector('#sale-picker-search').oninput = renderSaleProductPicker;
  screen.querySelector('#sale-picker-category').onchange = renderSaleProductPicker;
  try {
    if (!salePickerLoaded) {
      const res = await fetch(`${String(API_BASE).replace(/\/$/, '')}/products?all=true`, {headers:eventHeaders()});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const items = await res.json();
      if (!Array.isArray(items)) throw new Error('API không trả danh sách sản phẩm.');
      salePickerProducts = items;
      salePickerLoaded = true;
    }
    if (!screen.isConnected) return;
    const select = screen.querySelector('#sale-picker-category');
    const categories = new Map();
    salePickerProducts.forEach(p => {
      const c = p.category;
      if (c?.categoryId != null) categories.set(String(c.categoryId), c.categoryName || 'Danh mục ' + c.categoryId);
    });
    select.innerHTML += [...categories].map(([id,name]) => `<option value="${eventEscape(id)}">${eventEscape(name)}</option>`).join('');
    updateSaleSelectedProducts();
    renderSaleProductPicker();
  } catch (err) {
    if (screen.isConnected) screen.querySelector('#sale-picker-list').innerHTML = `<p class="col-span-full p-5 text-red-700">Không tải được sản phẩm: ${eventEscape(err.message)}. Hãy kiểm tra API /api/products.</p>`;
  }
}

function openSaleEditor(e) {
  closeSaleEditor();
  const editing = Boolean(e);
  saleEditorSelectedIds = new Set(Array.from(e?.productIds || []).map(Number).filter(Number.isSafeInteger));
  const overlay = document.createElement('div');
  overlay.id = 'sale-event-editor-screen';
  overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/55 backdrop-blur-[3px] p-3 md:p-6';
  overlay.innerHTML = `<div id="sale-events-admin" role="dialog" aria-modal="true" aria-label="${editing ? 'Chỉnh sửa chiến dịch' : 'Tạo chiến dịch'}" class="w-full max-w-5xl bg-white shadow-2xl rounded-2xl flex flex-col overflow-hidden" style="max-height:min(92vh,960px)">
    <style>
      #sale-event-editor-screen .ev-input{width:100%;min-width:0;background:white;border:1px solid #d9d9de;border-radius:10px;padding:9px 11px;outline:none;font-size:13px}
      #sale-event-editor-screen .ev-input:focus{border-color:#922a35;box-shadow:0 0 0 3px #922a351a}
      #sale-event-editor-screen .ev-label{display:block;font-size:12px;font-weight:600;color:#42424a;margin-bottom:5px}
      #sale-event-editor-screen .ev-btn,#sale-product-picker .ev-btn{display:inline-flex;justify-content:center;align-items:center;gap:7px;padding:9px 15px;border-radius:10px;font-weight:600;font-size:13px}
      #sale-event-editor-screen .ev-primary,#sale-product-picker .ev-primary{background:#922a35;color:#fff}
      #sale-event-editor-screen .ev-muted,#sale-product-picker .ev-muted{background:#f1f1f3;color:#3f3f46}
      #sale-event-editor-screen .ev-field{min-width:0}
      #sale-event-editor-screen .ev-section{background:white;border:1px solid #e9e9ed;border-radius:14px;padding:16px}
      #sale-event-editor-screen .ev-scroller{overflow-y:auto;min-height:0;overscroll-behavior:contain}
      @media(max-width:640px){#sale-event-editor-screen .ev-section{padding:14px}}
    </style>
    <div class="flex items-center justify-between gap-3 px-5 md:px-7 py-4 border-b bg-white shrink-0">
      <div>
        <h2 class="text-lg md:text-xl font-bold text-[#922a35]">${editing ? 'Chỉnh sửa BST / Sự kiện' : 'Thêm BST / Sự kiện'}</h2>
        <p class="text-xs md:text-sm text-gray-500 mt-1">Nhập thông tin chiến dịch JODOK · * là bắt buộc</p>
      </div>
      <button type="button" id="sale-editor-close" aria-label="Đóng" class="ev-btn ev-muted shrink-0">✕</button>
    </div>
    <form id="sale-form" class="flex flex-col min-h-0 flex-1">
      <div class="ev-scroller space-y-5 px-5 md:px-7 py-5">
      <section class="ev-section"><h3 class="font-bold text-base mb-3">01 · Thông tin cơ bản</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${saleEditorField('name','Tên BST / sự kiện',e?.name,'Ví dụ: 20/10 – Special For Her', {required:true})}
          ${saleEditorField('slug','Đường dẫn (slug)',e?.slug,'Ví dụ: ngay-20-10 (không dấu, không khoảng trắng)',{required:true})}
          <div class="md:col-span-2"><label class="ev-label" for="ev-description">Mô tả BST</label>
          <textarea class="ev-input" rows="3" id="ev-description" name="description" placeholder="Ví dụ: Bộ sưu tập dành cho phái đẹp, ưu đãi mừng 20/10...">${eventEscape(e?.description || '')}</textarea></div>
        </div>
      </section>
      <section class="ev-section"><h3 class="font-bold text-base mb-3">02 · Hình ảnh chiến dịch</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${saleEditorField('bannerUrl','URL banner máy tính',e?.bannerUrl,'Dán URL ảnh Cloudinary https://...')}
          ${saleEditorField('mobileBannerUrl','URL banner điện thoại',e?.mobileBannerUrl,'Dán URL ảnh dọc cho điện thoại (có thể bỏ trống)')}
          <div class="md:col-span-2"><label class="ev-label">Xem trước banner</label><div id="sale-banner-preview" class="rounded-xl min-h-[110px] bg-rose-50 flex items-center justify-center text-sm text-gray-500 overflow-hidden">Chưa có banner</div></div>
        </div>
      </section>
      <section class="ev-section"><h3 class="font-bold text-base mb-3">03 · Thời gian & ưu đãi</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${saleEditorField('startAt','Ngày giờ bắt đầu',eventDateInput(e?.startAt),'Chọn thời điểm chương trình bắt đầu',{required:true,type:'datetime-local'})}
          ${saleEditorField('endAt','Ngày giờ kết thúc',eventDateInput(e?.endAt),'Phải sau thời gian bắt đầu',{required:true,type:'datetime-local'})}
          <div><label class="ev-label" for="ev-discountType">Kiểu giảm giá</label><select id="ev-discountType" name="discountType" class="ev-input"><option value="PERCENT" ${e?.discountType === 'PERCENT' ? 'selected':''}>Giảm theo %</option><option value="AMOUNT" ${e?.discountType === 'AMOUNT' ? 'selected':''}>Giảm theo số tiền (VNĐ)</option></select></div>
          ${saleEditorField('discountValue','Mức giảm',e?.discountValue ?? 10,'Ví dụ: 10 nghĩa là giảm 10%',{required:true,type:'number'})}
        </div>
      </section>
      <section class="ev-section"><div class="flex justify-between items-center gap-3 flex-wrap mb-4"><div><h3 class="font-bold text-base">04 · Sản phẩm tham gia</h3>
        <p class="text-sm text-gray-500">Chọn từ danh sách, không cần nhớ ID sản phẩm.</p></div>
        <button type="button" id="sale-open-picker" class="ev-btn ev-primary">＋ Chọn sản phẩm (<span id="sale-selected-count">0</span>)</button></div>
        <div id="sale-selected-products" class="grid grid-cols-1 sm:grid-cols-2 gap-2"></div>
      </section>
      <section class="ev-section"><label class="flex items-center gap-3 cursor-pointer"><input type="checkbox" id="ev-enabled" name="enabled" class="w-5 h-5 accent-[#922a35]" ${e?.enabled?'checked':''}>
        <span class="font-semibold text-sm">Kích hoạt chiến dịch</span></label><p class="text-xs text-gray-500 mt-2">Chiến dịch chỉ hiển thị khi đã bật và đang nằm trong thời gian diễn ra.</p></section>
      <p id="sale-form-error" role="alert" class="hidden bg-red-50 text-red-700 border border-red-200 rounded-xl p-4 text-sm"></p>
      </div>
      <div class="shrink-0 bg-white py-4 px-5 md:px-7 flex justify-end gap-3 border-t">
        <button type="button" id="sale-cancel" class="ev-btn ev-muted">Hủy</button>
        <button type="submit" id="sale-submit-btn" class="ev-btn ev-primary">${editing ? 'Lưu thay đổi' : 'Tạo chiến dịch'}</button>
      </div>
    </form>
  </div>`;
  saleEditorPriorOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', ev => { if (ev.target === overlay) closeSaleEditor(); });
  overlay.querySelector('#sale-editor-close').onclick = closeSaleEditor;
  overlay.querySelector('#sale-cancel').onclick = closeSaleEditor;
  overlay.querySelector('#sale-open-picker').onclick = openSaleProductPicker;
  overlay.querySelector('#sale-editor-close').focus();
  updateSaleSelectedProducts();

  const form = overlay.querySelector('#sale-form');
  const banner = form.elements.namedItem('bannerUrl');
  const preview = () => {
    const node = overlay.querySelector('#sale-banner-preview');
    const url = eventSafeImage(banner.value);
    node.innerHTML = url ? `<img src="${url}" alt="Banner" class="w-full max-h-60 object-cover" onerror="this.parentElement.textContent='Không tải được ảnh, hãy kiểm tra URL.'">` : 'Chưa có banner';
  };
  banner.addEventListener('input', preview);
  preview();
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const errBox = overlay.querySelector('#sale-form-error');
    const button = overlay.querySelector('#sale-submit-btn');
    const fail = text => {errBox.textContent = text;errBox.classList.remove('hidden');errBox.scrollIntoView({behavior:'smooth'});};
    errBox.classList.add('hidden');
    const data = Object.fromEntries(new FormData(form));
    data.name = String(data.name || '').trim();
    data.slug = String(data.slug || '').trim();
    data.enabled = form.elements.namedItem('enabled').checked;
    data.discountValue = Number(data.discountValue);
    data.productIds = [...saleEditorSelectedIds];
    // Trường này vẫn có trong Entity; giữ giá trị cũ khi sửa, không hiển thị trên form.
    data.themeColor = e?.themeColor ?? null;
    if (!data.name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)) return fail('Tên hoặc slug không hợp lệ. Slug ví dụ: ngay-20-10.');
    if (!data.startAt || !data.endAt || new Date(data.endAt) <= new Date(data.startAt)) return fail('Thời gian kết thúc phải sau bắt đầu.');
    if (!Number.isFinite(data.discountValue) || data.discountValue < 0 || (data.discountType === 'PERCENT' && data.discountValue > 100)) return fail('Mức giảm phải từ 0–100% hoặc số tiền không âm.');
    if (data.startAt.length === 16) data.startAt += ':00';
    if (data.endAt.length === 16) data.endAt += ':00';
    try {
      button.disabled = true;
      button.textContent = 'Đang lưu...';
      await eventRequest(editing ? `/${e.id}` : '', {method:editing ? 'PUT' : 'POST', body:JSON.stringify(data)});
      closeSaleEditor();
      await loadSaleEvents();
      saleEventToast(editing ? 'Đã cập nhật chiến dịch thành công.' : 'Đã tạo chiến dịch thành công.');
    } catch (err) {
      console.error('Lỗi lưu BST:', err);
      fail('Không lưu được: ' + err.message);
    } finally {
      button.disabled = false;
      button.textContent = editing ? 'Lưu thay đổi' : 'Tạo chiến dịch';
    }
  });
}

async function removeSaleEvent(id) {
  const item = eventCache.find(e => Number(e.id) === Number(id));
  if (!confirm(`Bạn muốn xóa chiến dịch "${item?.name || id}"?`)) return;
  try { await eventRequest(`/${id}`,{method:'DELETE'}); await loadSaleEvents(); }
  catch (err) { saleEventToast('Không thể xóa chiến dịch: ' + err.message, 'error'); }
}