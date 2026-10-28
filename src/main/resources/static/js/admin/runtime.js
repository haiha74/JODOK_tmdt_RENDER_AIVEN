// Shared legacy runtime/state retained for compatibility during modular refactor.
const API_BASE = "/api";
// const fallbackImages = [
//   "https://images.unsplash.com/photo-1539008835657-9e8e9680c956?q=80&w=900&auto=format&fit=crop",
//   "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?q=80&w=900&auto=format&fit=crop",
//   "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=900&auto=format&fit=crop",
//   "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?q=80&w=900&auto=format&fit=crop"
// ];

let products = [];
let categories = [];
let users = [];
let orders = [];
let variants = [];
let brands = [];
let brandStatusFilter = "ALL";
let brandSort = "newest";
let vouchers = [];
let reviews = [];
let reviewPage = 1;
const REVIEW_PAGE_SIZE = 10;
let currentTab = "overview";

let productPage = 1;
let productPageSize = 10;

// ===============================
// VARIANT
// ===============================
let variantPage = 1;
let variantPageSize = 5;
let variantProductFilter = "ALL";

let productCategoryFilter = "";
let productBrandFilter = "";
let productStatusFilter = "";
let overviewPeriod = "7";
let overviewFrom = "";
let overviewTo = "";
let selectedFiles = [];
let selectedCategoryFile = null;
let confirmCallback = null;
let orderLimit = 10;
let orderSort = "newest";
let orderDate = "";
let orderStatusFilter = "ALL";
let orderPaymentFilter = "ALL";
let orderFromDate = "";
let orderToDate = "";
let adminSearch = {
  products: "",
  categories: "",
  categoryStatus: "ALL",
  categorySort: "newest",
  brands: "",
  variants: "",
  promo: "",
  orders: "",
  users: "",
  reviews: ""
};

let reportFrom = "";
let reportTo = "";


/* moved to admin modules */


/* moved to admin modules */


/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */


/* moved to admin modules */


/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */




/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */


/* moved to admin modules */



/* moved to admin modules */


/* moved to admin modules */


/* moved to admin modules */


/* moved to admin modules */



/* moved to admin modules */





/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */




/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */


let productSearchTimer = null;


/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */


/* moved to admin modules */



/* moved to admin modules */


/* moved to admin modules */


/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */




/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */


/* moved to admin modules */




/* moved to admin modules */




/* moved to admin modules */

/* init() is invoked by the module entry after all feature scripts load. */
/* moved to admin modules */


// =====================================================
// VARIANT - HELPERS
// =====================================================


/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */


let variantSearchTimer = null;


/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



// =====================================================
// VARIANT PAGINATION
// =====================================================


/* moved to admin modules */



// =====================================================
// VARIANT PANEL
// =====================================================


/* moved to admin modules */


/* moved to admin modules */


/* moved to admin modules */



/* moved to admin modules */


/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */


/* moved to admin modules */


/* moved to admin modules */


/* moved to admin modules */


/* moved to admin modules */


/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */




/* moved to admin modules */




/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */

// ============================================================
// ORDER ADMIN - CHI TIẾT + CẬP NHẬT TRẠNG THÁI + EXCEL
// ============================================================


/* moved to admin modules */



// ============================================================
// LẤY THÔNG TIN NGƯỜI NHẬN
// Hỗ trợ nhiều tên field để không phụ thuộc 1 DTO duy nhất
// ============================================================


/* moved to admin modules */




/* moved to admin modules */




/* moved to admin modules */




/* moved to admin modules */




/* moved to admin modules */




/* moved to admin modules */


/* moved to admin modules */


// ============================================================
// LẤY SẢN PHẨM TRONG ĐƠN
// ============================================================


/* moved to admin modules */




/* moved to admin modules */




/* moved to admin modules */




/* moved to admin modules */




/* moved to admin modules */




/* moved to admin modules */



// ============================================================
// LABEL TRẠNG THÁI
// ============================================================


/* moved to admin modules */



// ============================================================
// ĐÓNG POPUP
// ============================================================


/* moved to admin modules */



// ============================================================
// MỞ CHI TIẾT ĐƠN
// ============================================================

/* moved to admin modules */




/* moved to admin modules */




/* moved to admin modules */


/* moved to admin modules */



// ============================================================
// CẬP NHẬT TRẠNG THÁI
// ============================================================


/* moved to admin modules */



// ============================================================
// LƯU TRẠNG THÁI TỪ POPUP
// ============================================================


/* moved to admin modules */



// ============================================================
// ESCAPE GIÁ TRỊ CHO EXCEL HTML
// ============================================================


/* moved to admin modules */



// ============================================================
// LẤY DANH SÁCH ĐƠN THEO BỘ LỌC HIỆN TẠI
// Dùng cho Excel
// ============================================================


/* moved to admin modules */



// ============================================================
// XUẤT FILE EXCEL ĐƠN VẬN CHUYỂN
//
// Không cần thư viện XLSX.
// Xuất .xls HTML tương thích Excel.
// ============================================================


/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */





/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */



/* moved to admin modules */


/* =========================================================
   QUẢN LÝ ĐÁNH GIÁ
========================================================= */


/* moved to admin modules */



/* =========================================================
   PRODUCT ID CỦA REVIEW
========================================================= */


/* moved to admin modules */



/* =========================================================
   ORDER ID CỦA REVIEW
========================================================= */


/* moved to admin modules */



/* =========================================================
   ORDER ITEM ID
========================================================= */


/* moved to admin modules */



/* =========================================================
   FORMAT DATE
========================================================= */


/* moved to admin modules */



/* =========================================================
   RATING STARS
========================================================= */


/* moved to admin modules */



/* =========================================================
   TÌM REVIEW THEO ID
========================================================= */


/* moved to admin modules */



/* =========================================================
   ĐỔI TRANG REVIEW
========================================================= */


/* moved to admin modules */



/* =========================================================
   PHÂN TRANG
========================================================= */


/* moved to admin modules */



/* =========================================================
   REVIEW PANEL
========================================================= */


/* moved to admin modules */



/* =========================================================
   OPEN REVIEW DETAIL
========================================================= */


/* moved to admin modules */



/* =========================================================
   CLOSE REVIEW DETAIL
========================================================= */


/* moved to admin modules */



/* =========================================================
   DELETE REVIEW
========================================================= */


/* moved to admin modules */



function adminToolbar(type, title, btnText, btnAction){
  return `
    <div class="px-6 py-4 border-b flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <h2 class="font-bold text-xl">${title}</h2>

      <div class="flex gap-3 w-full lg:w-auto">
        <input
          data-search="${type}"
          value="${adminSearch[type] || ""}"
          oninput="searchAdmin('${type}', this.value)"
          class="border rounded-full px-5 py-3 w-full lg:w-80 outline-none"
          placeholder="Tìm kiếm..."
        >

        <button onclick="${btnAction}"
          class="bg-red-800 text-white rounded-full px-6 py-3 font-bold whitespace-nowrap">
          + ${btnText}
        </button>
      </div>
    </div>
  `;
}

function searchAdmin(type, value){
  adminSearch[type] = value.toLowerCase();

  setTimeout(() => {
    render();

    setTimeout(() => {
      const input = document.querySelector(`input[data-search="${type}"]`);
      if(input){
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }, 0);
  }, 0);
}

function loginPage(){
  return `<main class="min-h-screen grid lg:grid-cols-[1fr_520px]">
    <section class="px-10 lg:px-20 flex items-center">
      <div>
        <p class="text-red-800 tracking-[.18em] uppercase font-bold mb-5">JODOK Admin</p>
        <h1 class="serif text-6xl leading-tight mb-5">Đăng nhập quản trị</h1>
        <p class="text-neutral-600 text-xl max-w-2xl">Quản lý sản phẩm, danh mục, đơn hàng, người dùng, khuyến mãi và báo cáo hệ thống.</p>
      </div>
    </section>
    <section class="bg-white border-l flex items-center justify-center px-8 py-12">
      <div class="soft-card p-8 w-full max-w-md">
        <h2 class="serif text-4xl text-center mb-7">Admin Login</h2>
        <div class="space-y-4">
          <input id="adminEmail" class="input-ui" placeholder="Email admin">
          <input id="adminPassword" type="password" class="input-ui" placeholder="Mật khẩu">
          <button onclick="loginAdmin()" class="btn-primary w-full">Đăng nhập</button>
        </div>
        <p id="adminMsg" class="text-center mt-4 text-red-800 font-semibold text-sm"></p>
        <a href="/" class="block text-center mt-5 text-neutral-500 hover:text-red-800">← Quay lại shop</a>
      </div>
    </section>
  </main>`;
}

function sidebar() {
  const items = [
    ["overview", "Tổng quan", "layout-dashboard"],
    ["products", "Quản lý sản phẩm", "shopping-bag"],
    ["categories", "Danh mục", "list-tree"],
    ["brands", "Thương hiệu", "tag"],
    ["orders", "Quản lý đơn hàng", "receipt"],
    ["variants", "Biến thể sản phẩm", "palette"],
    ["users", "Quản lý người dùng", "users"],
    ["reviews", "Quản lý đánh giá", "message-square"],
    ["promo", "Voucher", "badge-percent"],
    ["events", "Sự kiện bán hàng", "calendar-days"],
    ["payos", "Lịch sử PayOS", "wallet"],
    ["reports", "Báo cáo thống kê", "bar-chart-3"]
  ];

  return `
    <aside class="admin-sidebar">
      <div class="admin-logo">
        <strong>JODOK</strong>

        <button type="button"
          onclick="toggleAdminSidebar()"
          title="Thu gọn menu">
          ${icon("panel-left-close", "w-5 h-5")}
        </button>
      </div>

      <h2>Menu quản trị</h2>

      <nav class="admin-nav">
        ${items.map(item => `
          <button
            type="button"
            onclick="setTab('${item[0]}')"
            class="${currentTab === item[0] ? "active" : ""}">

            ${icon(item[2])}

            <span>${item[1]}</span>
          </button>
        `).join("")}
      </nav>
    </aside>
  `;
}

function toggleAdminSidebar() {
  document.querySelector(".admin-dashboard")
    ?.classList.toggle("sidebar-collapsed");
}

function toggleAdminProfile() {
  document.getElementById("adminProfileMenu")
    ?.classList.toggle("hidden");
}

function content() {
  if (currentTab === "products") return productTable();
  if (currentTab === "categories") return categoryPanel();
  if (currentTab === "brands") return brandPanel();
  if (currentTab === "orders") return orderTable();
  if (currentTab === "variants") return variantPanel();
  if (currentTab === "users") return userTable();
  if (currentTab === "reviews") return reviewPanel();
  if (currentTab === "promo") return voucherPanel();
  if (currentTab === "events") { setTimeout(loadSaleEvents, 0); return eventPanel(); }
  if (currentTab === "payos") return payosPanel();
  if (currentTab === "reports") return reportPanel();

  return `
    ${statCards()}
    ${overviewCharts()}
  `;
}

function adminPage() {
  const a = admin();

  if (!a) return loginPage();

  const name = escapeHtml(a.fullname || a.email || "Admin");
  const initial = name.charAt(0).toUpperCase();

  const { from, to } = overviewRange();

  const pageNames = {
    overview: "Tổng quan",
    products: "Quản lý sản phẩm",
    categories: "Danh mục",
    brands: "Thương hiệu",
    orders: "Quản lý đơn hàng",
    variants: "Biến thể sản phẩm",
    users: "Quản lý người dùng",
    reviews: "Quản lý đánh giá",
    promo: "Voucher",
    events: "Sự kiện bán hàng",
    payos: "Lịch sử PayOS",
    reports: "Báo cáo thống kê"
  };

  return `
    <main class="admin-dashboard">
      <div class="admin-layout">

        ${sidebar()}

        <div class="admin-main">

          <header class="admin-topbar">

            <div class="admin-notification">
              <button type="button"
                title="Xem đơn hàng"
                onclick="setTab('orders')">

                ${icon("bell", "w-5 h-5")}
              </button>
            </div>

            <div class="admin-profile relative">

              <button type="button"
                onclick="toggleAdminProfile()"
                class="flex items-center gap-3">

                <span class="admin-avatar">${initial}</span>

                <span>${name}</span>

                ${icon("chevron-down", "w-4 h-4")}
              </button>

              <div id="adminProfileMenu"
                class="hidden absolute right-0 top-full mt-3 bg-white border rounded-xl shadow-xl p-2 z-50 min-w-[150px]">

                <button type="button"
                  onclick="logoutAdmin()"
                  class="w-full text-left px-2 py-3 rounded-lg hover:bg-red-50 text-red-800 font-semibold">

                  ${icon("log-out", "w-4 h-4 inline-block")}
                  Đăng xuất
                </button>
              </div>

            </div>
          </header>

          <section class="admin-content">

            <div class="admin-page-heading">
              <div>
                <h1>${pageNames[currentTab] || "Quản trị"}</h1>

                <p>
                  ${currentTab === "overview"
                    ? "Thống kê tổng quan hoạt động của hệ thống JODOK"
                    : "Quản lý dữ liệu và hoạt động hệ thống JODOK"}
                </p>
              </div>

              ${currentTab === "overview" ? `
                <div class="admin-date-filter">
                  ${icon("calendar-days", "w-4 h-4")}

                  <input
                    id="overviewFrom"
                    type="date"
                    value="${from}"
                    onchange="changeOverviewDates()"
                    aria-label="Từ ngày">

                  <span>–</span>

                  <input
                    id="overviewTo"
                    type="date"
                    value="${to}"
                    onchange="changeOverviewDates()"
                    aria-label="Đến ngày">
                </div>
              ` : ""}
            </div>

            <div class="admin-page-body">
              ${content()}
            </div>

          </section>
        </div>
      </div>
    </main>
  `;
}

async function loginAdmin(){
  const body = {email:document.getElementById("adminEmail").value.trim(), password:document.getElementById("adminPassword").value};
  const res = await fetch(`${API_BASE}/auth/login`, {
    method:"POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if(!res.ok){document.getElementById("adminMsg").innerText = data.message || "Đăng nhập thất bại"; return;}
  if(data.role !== "ADMIN"){document.getElementById("adminMsg").innerText = "Tài khoản không có quyền Admin"; return;}
  localStorage.setItem("ha_admin", JSON.stringify(data));
  await init();
}

function logoutAdmin(){

   localStorage.removeItem("ha_admin");
   localStorage.removeItem("token");

   location.reload();
}

function setTab(tab) {
  document.querySelectorAll(
    "#variantModal, #productModal, #orderModal, #userModal"
  ).forEach(modal => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  });
  currentTab = tab;
  if (tab === 'products') productPage = 1;

  // Display page shell immediately, then load large table only on demand.
  if (['variants', 'reviews', 'orders', 'vouchers', 'promo'].includes(tab) &&
      !adminLoaded.has(tab === 'promo' ? 'vouchers' : tab)) {
    const app = document.getElementById('app');
    if (app) app.innerHTML = '<div class="p-10 text-center text-neutral-500">Đang tải dữ liệu ' +
      escapeHtml(tab) + '...</div>';
    loadAdminSection(tab).then(() => {
      if (currentTab === tab) render();
    }).catch(error => {
      console.error('ADMIN SECTION LOAD ERROR:', error);
      if (currentTab === tab) showToast('Lỗi', 'Không thể tải dữ liệu: ' + error.message, 'error');
    });
    return;
  }

  render();
  if (tab === 'products') {
    refreshProductFilterOptions().catch(error =>
      console.warn('Refresh product filters failed:', error));
  }
}

function render() {
  const app = document.getElementById("app");

  if (!app) {
    console.error("Không tìm thấy #app");
    return;
  }

  try {
    app.innerHTML = adminPage();

    if (
      window.lucide &&
      typeof window.lucide.createIcons === "function"
    ) {
      window.lucide.createIcons();
    }
  } catch (error) {
    console.error("RENDER ERROR:", error);
    throw error;
  }
}

async function init() {
  try {
    // Show dashboard shell while independent KPI requests finish.
    render();
    await loadData();
    render();
  } catch (error) {
    console.error("INIT ERROR:", error);

    render();
    showToast?.("Lỗi", "Một số dữ liệu quản trị chưa tải được. Kiểm tra quyền đăng nhập và Console.", "error");
  }
}
