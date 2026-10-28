// Refactored from legacy /js/admin.js. Business logic preserved.
// Loaded as a compatibility classic script by admin/admin.js so existing inline handlers keep working.

function icon(n, cls="w-5 h-5"){return `<i data-lucide="${n}" class="${cls}"></i>`}

function money(v){
  return Math.round(Number(v || 0)).toLocaleString("vi-VN") + "đ";
}

function isVoucherExpired(v){
  if(!v.endDate) return false;
  return new Date(v.endDate + "T23:59:59") < new Date();
}

function adminAuthHeaders(){
  const admin = JSON.parse(
    localStorage.getItem("ha_admin") || "null"
  );

  if(!admin?.token){
    console.warn("ADMIN TOKEN KHÔNG TỒN TẠI");
    return {};
  }

  return {
    "Authorization": "Bearer " + admin.token
  };
}

function adminJsonHeaders(){
  return {
    "Content-Type": "application/json",
    ...adminAuthHeaders()
  };
}

function voucherStatusText(v){
  if(isVoucherExpired(v)) return "Hết hạn";
  if(v.status === "ACTIVE") return "Đang hoạt động";
  return "Tạm ẩn";
}

function admin(){return JSON.parse(localStorage.getItem("ha_admin") || "null")}

function showToast(
  title,
  message = "",
  type = "success"
){
  const old =
    document.getElementById(
      "adminToast"
    );

  if(old){
    old.remove();
  }


  const color =
    type === "error"
      ? "border-red-800"
      : "border-green-700";


  const safeTitle =
    title == null
      ? "Thông báo"
      : String(title);


  const safeMessage =
    message == null
      ? ""
      : String(message);


  const toast =
    document.createElement("div");


  toast.id =
    "adminToast";


  toast.className = `
    fixed top-6 right-6 z-[9999]
    bg-white
    border-l-8
    ${color}
    rounded-2xl
    shadow-2xl
    px-6 py-4
    min-w-[320px]
    max-w-[520px]
  `;


  toast.innerHTML = `
    <b class="block text-lg">
      ${escapeHtml(safeTitle)}
    </b>

    ${
      safeMessage
        ? `
          <p
            class="
              text-sm
              text-neutral-600
              mt-1
              break-words
            "
          >
            ${escapeHtml(safeMessage)}
          </p>
        `
        : ""
    }
  `;


  document.body.appendChild(
    toast
  );


  setTimeout(
    () => {
      toast.remove();
    },
    type === "error"
      ? 6000
      : 3000
  );
}

function showConfirm(message, onConfirm, confirmText = "Xóa"){
  confirmCallback = onConfirm;

  const old = document.getElementById("adminConfirmModal");
  if(old) old.remove();

  const modal = document.createElement("div");
  modal.id = "adminConfirmModal";
  modal.className = "fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center p-5";

  modal.innerHTML = `
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md p-7">
      <h2 class="serif text-3xl mb-3">Xác nhận</h2>
      <p class="text-neutral-600 mb-7">${message}</p>

      <div class="flex justify-end gap-3">
        <button onclick="closeConfirm()"
          class="border rounded-full px-6 py-3 font-bold">
          Hủy
        </button>

        <button onclick="confirmAction()"
          class="bg-red-800 text-white rounded-full px-6 py-3 font-bold">
          ${confirmText}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function closeConfirm(){
  const modal = document.getElementById("adminConfirmModal");
  if(modal) modal.remove();
  confirmCallback = null;
}

function confirmAction(){
  if(confirmCallback){
    confirmCallback();
  }
  closeConfirm();
}

function productImg(p, i) {
  if (p?.imageUrl) {
    return p.imageUrl;
  }

  if (Array.isArray(p?.images) && p.images.length > 0) {
    const sorted = [...p.images].sort((a, b) =>
      Number(b.imageId || b.image_id || 0) -
      Number(a.imageId || a.image_id || 0)
    );

    const mainImg = sorted.find(img =>
      img.isMain == true ||
      img.isMain == 1 ||
      img.is_main == true ||
      img.is_main == 1
    );

    const img = mainImg || sorted[0];

    return img?.imageUrl || "/images/no-image.png";
  }

  return "/images/no-image.png";
}

function productHasVariant(productId){
  const id = Number(productId);

  if(!id){
    return false;
  }

  return variants.some(v => {
    const variantProductId =
      v?.product?.productId ??
      v?.productId ??
      v?.product_id;

    return Number(variantProductId) === id;
  });
}

function getActiveBrand(product){
  const brandId =
    product?.brand?.brandId ??
    product?.brandId ??
    product?.brand_id;

  if(!brandId){
    return null;
  }

  const brand = brands.find(
    b => String(b.brandId) === String(brandId)
  );

  if(!brand){
    return null;
  }

  if(String(brand.status || "").toUpperCase() !== "ACTIVE"){
    return null;
  }

  return brand;
}

function getActiveBrandName(product){
  const brand = getActiveBrand(product);

  return brand?.brandName || "";
}

async function fetchJson(url){
  const res = await fetch(url, {
    headers: adminAuthHeaders()
  });

  /*
   * 401 = token không hợp lệ / hết hạn.
   *
   * Chỉ trường hợp này mới xóa phiên đăng nhập.
   */
  if(res.status === 401){
    console.error(
      "ADMIN AUTH 401:",
      url
    );

    localStorage.removeItem("ha_admin");

    throw new Error(
      "Phiên đăng nhập đã hết hạn"
    );
  }

  if(res.status === 403){
    const text = await res.text();

    console.error(
      "ADMIN API 403:",
      {
        url: url,
        status: res.status,
        response: text
      }
    );

    throw new Error(
      text ||
      `Không có quyền truy cập API: ${url}`
    );
  }

  if(!res.ok){
    const text = await res.text();

    console.error(
      "API lỗi:",
      {
        url: url,
        status: res.status,
        response: text
      }
    );

    throw new Error(
      text ||
      `API lỗi HTTP ${res.status}`
    );
  }

  return res.json();
}

async function safeFetch(url, fallback = []) {
  try {
    const data = await fetchJson(url);
    return data ?? fallback;
  } catch (e) {
    console.error("LOAD FAILED:", url, e);
    return fallback;
  }
}

// Load only what's needed for the active admin page.
// Dashboard uses a lightweight order projection, avoiding eager Order.items JSON.
const adminLoaded = new Set();
let adminCorePromise = null;
let adminSectionRequests = {};

async function loadAdminCore() {
  if (adminLoaded.has('core')) return;
  if (!adminCorePromise) {
    // Start independent requests: a slow variants/users endpoint must not block KPIs.
    const endpoints = [
      ['products', `${API_BASE}/products?all=true`],
      ['categories', `${API_BASE}/categories`],
      ['users', `${API_BASE}/users`],
      ['orders', `${API_BASE}/orders/admin-overview`],
      ['brands', `${API_BASE}/brands`],
      ['variants', `${API_BASE}/variants`]
    ];
    const assign = { products: d => products = d, categories: d => categories = d,
      users: d => users = d, orders: d => orders = d,
      brands: d => brands = d, variants: d => variants = d };
    adminCorePromise = Promise.allSettled(endpoints.map(async ([key, url]) => {
      // Share in-flight requests with tab navigation; no duplicate variant download.
      const task = fetchJson(url).then(data => {
        assign[key](Array.isArray(data) ? data : []);
        adminLoaded.add(key);
        if (currentTab === 'overview' ||
            (currentTab === 'products' && (key === 'products' || key === 'variants')) ||
            currentTab === key) render();
      });
      adminSectionRequests[key] = task;
      try { await task; }
      finally { if (adminSectionRequests[key] === task) delete adminSectionRequests[key]; }
    })).then(results => {
      results.forEach((result, index) => {
        if (result.status === 'rejected') console.error('ADMIN CORE LOAD FAILED:', endpoints[index][0], result.reason);
      });
      adminLoaded.add('core');
    }).catch(error => { adminCorePromise = null; throw error; });
  }
  return adminCorePromise;
}

async function loadAdminSection(tab, force = false) {
  const section = ({
    variants: ['variants', 'variants'],
    reviews: ['reviews', 'reviews'],
    orders: ['orders', 'orders/admin-overview'],
    vouchers: ['vouchers', 'vouchers'],
    promo: ['vouchers', 'vouchers']
  })[tab];
  if (!section) return;
  const [key, resource] = section;
  if (!force && adminLoaded.has(key)) return;
  if (adminSectionRequests[key]) return adminSectionRequests[key];
  const task = (async () => {
    const data = await fetchJson(`${API_BASE}/${resource}`);
    if (key === 'variants') variants = data || [];
    if (key === 'reviews') reviews = data || [];
    if (key === 'orders') orders = data || [];
    if (key === 'vouchers') vouchers = data || [];
    adminLoaded.add(key);
  })().finally(() => { delete adminSectionRequests[key]; });
  adminSectionRequests[key] = task;
  return task;
}

async function loadData() {
  await loadAdminCore();
  // Core requests already include orders and variants; do not load them twice.
  if (['variants', 'orders', 'reviews', 'vouchers', 'promo'].includes(currentTab))
    await loadAdminSection(currentTab, true);
}

function dateOnly(d){
  return new Date(d).toISOString().slice(0, 10);
}

function daysAgo(n){
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dateOnly(d);
}
