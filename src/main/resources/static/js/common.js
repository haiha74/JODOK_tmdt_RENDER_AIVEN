const API_BASE = "/api";

const fallbackImages = [
  "https://images.unsplash.com/photo-1539008835657-9e8e9680c956?q=80&w=900&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?q=80&w=900&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=900&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?q=80&w=900&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=900&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1543076447-215ad9ba6923?q=80&w=900&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=900&auto=format&fit=crop",
  "https://github.com/eniuu127/Jodok-Images/blob/1749ee22e2ed86071bac1621900d8c90d4f2eff3/banners/banner1.png"
];

let products = [];
let allProducts = [];
let categories = [];
let brands = [];

let selectedProduct = null;
let selectedCategoryId = null;
let searchKeyword = "";

let selectedProductVariants = [];
let selectedSize = "";
let selectedColor = "";
let selectedQty = 1;

let authMode = "login";

/* =========================================
   ICON
========================================= */

function icon(n, c = "w-6 h-6") {
  return `<i data-lucide="${n}" class="${c}"></i>`;
}

/* =========================================
   FORMAT PRICE
========================================= */

function formatPrice(price) {
  if (
    price === null ||
    price === undefined ||
    price === ""
  ) {
    return "Liên hệ";
  }

  const number = Number(price);

  if (!Number.isFinite(number)) {
    return "Liên hệ";
  }

  return number.toLocaleString("vi-VN") + "đ";
}

/* =========================================
   SOLD COUNT
========================================= */

function getSoldCount(productId) {
  return Number(window.soldCounts?.[productId] || 0);
}

/*
  Hiển thị số lượng đã bán giống mẫu Shopee.

  0       => 0 đã bán
  25      => 25 đã bán
  999     => 999 đã bán
  1000    => 1k+ đã bán
  3500    => 3k+ đã bán
  12000   => 12k+ đã bán
*/

function formatSoldCount(count) {
  const n = Math.max(0, Number(count) || 0);

  if (n >= 1000) {
    return `${Math.floor(n / 1000)}k+ đã bán`;
  }

  return `${Math.floor(n)} đã bán`;
}

/* =========================================
   HTML ESCAPE
========================================= */

/*
  Tránh lỗi khi tên sản phẩm chứa:
  &, <, >, dấu nháy đơn hoặc nháy kép.
*/

function escapeProductHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* =========================================
   PRODUCT IMAGE
========================================= */


function getProductImg(p, index = 0) {
  if (!p) return "";

  const validUrl = (url) => {
    if (typeof url !== "string") return false;

    const value = url.trim();

    return (
      value !== "" &&
      value.toLowerCase() !== "null" &&
      value.toLowerCase() !== "undefined"
    );
  };

  // Ưu tiên ảnh chính của sản phẩm
  if (validUrl(p.imageUrl)) {
    return p.imageUrl.trim();
  }

  // Kiểm tra danh sách ảnh sản phẩm
  if (Array.isArray(p.images)) {
    const images = p.images
      .filter(img => validUrl(img?.imageUrl))
      .sort((a, b) =>
        Number(b.imageId || b.image_id || 0) -
        Number(a.imageId || a.image_id || 0)
      );

    const mainImg = images.find(img =>
      img.isMain === true ||
      img.isMain === 1 ||
      img.is_main === true ||
      img.is_main === 1
    );

    const selected = mainImg || images[0];

    if (selected) {
      return selected.imageUrl.trim();
    }
  }

  // Không có ảnh thì không lấy ảnh mẫu
  return "";
}

// Khi ảnh không tải được
function handleProductImageError(img) {
  if (!img) return;

  img.onerror = null;
  img.style.display = "none";

  const parent = img.parentElement;
  if (!parent) return;

  if (parent.querySelector(".jodok-no-image")) return;

  const placeholder = document.createElement("div");

  placeholder.className = "jodok-no-image";
  placeholder.style.cssText = `
    width: 100%;
    height: 100%;
    min-height: 180px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 10px;
    background: #f5f5f5;
    color: #999;
    font-size: 13px;
    text-align: center;
    padding: 15px;
    box-sizing: border-box;
  `;

  placeholder.innerHTML = `
    <svg width="34" height="34"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <path d="m21 15-5-5L5 21"/>
      <path d="M3 3l18 18"/>
    </svg>
    <span>Chưa có ảnh sản phẩm</span>
  `;

  img.insertAdjacentElement("afterend", placeholder);
}


/* =========================================
   BRAND
========================================= */

function getBrandName(p) {
  return (
    p.brand?.brandName ||
    p.brandName ||
    p.brand?.name ||
    "JODOK"
  );
}

/* =========================================
   FETCH API
========================================= */

async function fetchJson(url) {
  const user = getUser();

  const headers = user?.token
    ? {
        Authorization: "Bearer " + user.token
      }
    : {};

  const res = await fetch(url, {
    headers
  });

  if (!res.ok) {
    throw new Error(
      `API lỗi ${res.status}: ${url}`
    );
  }

  return res.json();
}

/* Giá sự kiện dùng chung cho trang chủ, tìm kiếm, chi tiết và giỏ hàng.
   Giá cuối cùng của đơn vẫn phải do OrderService kiểm tra lại. */
let jodokLiveEvents = [];
async function loadJodokSalePrices() {
  try {
    const response = await fetch(`${API_BASE}/events`, {cache: 'no-store'});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const events = await response.json();
    const now = Date.now();
    jodokLiveEvents = (Array.isArray(events) ? events : []).filter(e =>
      e.enabled && Date.parse(e.startAt) <= now && now < Date.parse(e.endAt)
    );
  } catch (error) {
    console.warn('Không lấy được giá sự kiện:', error);
    jodokLiveEvents = [];
  }
}
function jodokSalePrice(productId, originalPrice) {
  const original = Number(originalPrice);
  if (originalPrice == null || !Number.isFinite(original)) return originalPrice;
  const now = Date.now();
  let best = original;
  for (const e of jodokLiveEvents) {
    if (!e.enabled || Date.parse(e.startAt) > now || Date.parse(e.endAt) <= now) continue;
    if (!(e.productIds || []).some(id => Number(id) === Number(productId))) continue;
    const amount = Number(e.discountValue);
    if (!Number.isFinite(amount) || amount < 0) continue;
    const value = e.discountType === 'PERCENT'
      ? original * (1 - amount / 100)
      : original - amount;
    best = Math.min(best, Math.max(0, Math.round(value)));
  }
  return best;
}
function jodokSalePriceMarkup(productId, original) {
  const finalPrice = jodokSalePrice(productId, original);
  const base = Number(original);

  if (original == null || !Number.isFinite(base)) {
    return 'Liên hệ';
  }

  const discounted = Number(finalPrice) < base;

  // Giá gốc nằm trên giá hiện tại. Giữ số đã bán ở bên phải.
  return `
    <span class="jodok-price-stack"
          style="display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:0;white-space:nowrap">
      ${discounted ? `
        <del style="color:#9ca3af;font-size:11px;font-weight:400;line-height:16px">
          ${formatPrice(base)}
        </del>
      ` : ''}
      <strong style="color:#991b1b;font-weight:700;line-height:22px">
        ${formatPrice(finalPrice)}
      </strong>
    </span>
  `;
}

/* =========================================
   USER
========================================= */

function getUser() {
  try {
    const raw = localStorage.getItem('ha_user');
    if (!raw) return null;
    const user = JSON.parse(raw);
    if (!user || !user.token || !user.userId || user.role !== 'USER') {
      localStorage.removeItem('ha_user');
      return null;
    }
    // JWT expiry is a fast client check; backend remains the authority.
    const payload = JSON.parse(atob(user.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.exp || payload.exp * 1000 <= Date.now()) {
      localStorage.removeItem('ha_user');
      return null;
    }
    return user;
  } catch (error) {
    localStorage.removeItem('ha_user');
    return null;
  }
}

/* =========================================
   CART COUNT
========================================= */

async function getCartCount() {
  const user = getUser();

  if (user?.userId) {
    try {
      const res = await fetch(
        `${API_BASE}/cart/${user.userId}`,
        {
          headers: {
            Authorization: "Bearer " + user.token
          }
        }
      );

      if (res.ok) {
        const data = await res.json();

        console.log("CART API DATA:", data);

        const items = Array.isArray(data)
          ? data
          : (
              data.items ||
              data.cartItems ||
              []
            );

        return items.reduce((sum, item) => {
          return sum + Number(item.quantity || 0);
        }, 0);
      }
    } catch (e) {
      console.error(
        "Không lấy được giỏ hàng DB",
        e
      );
    }
  }

  let localCart = [];

  try {
    localCart = JSON.parse(
      localStorage.getItem("ha_cart") || "[]"
    );
  } catch (e) {
    console.error(
      "Dữ liệu giỏ hàng local không hợp lệ:",
      e
    );
  }

  if (!Array.isArray(localCart)) {
    localCart = [];
  }

  return localCart.reduce((total, item) => {
    return total + Number(item.quantity || 0);
  }, 0);
}

/* =========================================
   NAVIGATION
========================================= */

function go(page) {
  if (page === "home") {
    location.href = "/";
  }

  if (page === "shop") {
    location.href = "/products";
  }

  if (page === "promo") {
    location.href = "/promo";
  }

  if (page === "store") {
    location.href = "/store";
  }

  if (page === "auth") {
    location.href = "/auth";
  }
}

/* =========================================
   SAVE PRODUCT VIEW
========================================= */

async function saveProductView(productId) {
  const user = getUser();

  if (!user?.userId) {
    return;
  }

  try {
    await fetch(
      `${API_BASE}/recommendations/view`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + user.token
        },

        body: JSON.stringify({
          userId: user.userId,
          productId: productId
        })
      }
    );
  } catch (e) {
    console.error(
      "Không lưu được lịch sử xem",
      e
    );
  }
}

/* =========================================
   PRODUCT DETAIL
========================================= */

async function detail(id) {
  await saveProductView(id);

  location.href = `/detail?productId=${id}`;
}

function goShop() {
  window.location.href = "/";
}

function goAdmin() {
  window.location.href = "/admin";
}

function goStaff() {
  window.location.href = "/staff";
}
/* =========================================
   ACCOUNT MENU
========================================= */

function getHeaderUserName() {
  const user = getUser();

  if (!user?.token) return "";

  return (
    user.fullname ||
    user.fullName ||
    user.username ||
    user.email?.split("@")[0] ||
    "Tài khoản"
  );
}

function toggleAccountMenu(event) {
  event.stopPropagation();

  const menu = document.getElementById("headerAccountMenu");
  const button = document.getElementById("headerAccountButton");

  if (!menu || !button) return;

  const isOpen = !menu.classList.contains("hidden");

  menu.classList.toggle("hidden", isOpen);
  button.setAttribute("aria-expanded", String(!isOpen));
}

function closeAccountMenu() {
  document.getElementById("headerAccountMenu")?.classList.add("hidden");

  document.getElementById("headerAccountButton")
    ?.setAttribute("aria-expanded", "false");
}

document.addEventListener("click", function (event) {
  if (!event.target.closest(".header-account")) {
    closeAccountMenu();
  }
});

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeAccountMenu();
  }
});

function logoutFromHeader() {
  localStorage.removeItem("ha_user");

  closeAccountMenu();

  window.location.replace("/auth");
}
/* =========================================
   HEADER
========================================= */

function header() {
  return `
    <header
      class="site-header sticky top-0 z-50 bg-white border-b shadow-sm"
      role="banner"
    >

      <div class="bg-black text-white text-xs">
        <div class="wrap py-2 flex justify-between">

          <span>
            Freeship đơn từ 999.000đ
          </span>

          <span>
            Hotline: 0900 888 999 · Đổi trả 7 ngày
          </span>

        </div>
      </div>

      <div class="wrap py-3 flex flex-wrap items-center justify-between gap-4">

        <button
          onclick="go('home')"
          class="whitespace-nowrap"
        >
          <img
            src="/images/logo1.jpg"
            alt="JODOK"
            class="h-12 md:h-14 lg:h-16 xl:h-20 object-contain"
          >
        </button>

        <nav
          aria-label="Điều hướng chính"
          class="
            flex flex-wrap items-center justify-center
            gap-3 md:gap-4 lg:gap-5
            text-base
            font-medium
            flex-1
          "
        >

          <button
            onclick="go('home')"
            class="hover:text-red-800"
          >
            Trang chủ
          </button>

          <button
            onclick="go('shop')"
            class="hover:text-red-800"
          >
            Sản phẩm
          </button>

          <a
            href="/events"
            class="text-[15px] font-medium hover:text-red-800 transition-colors"
          >
            Bộ sưu tập
          </a>
          
          <button
            onclick="go('promo')"
            class="hover:text-red-800"
          >
            Khuyến mãi
          </button>

          <button
            onclick="go('store')"
            class="hover:text-red-800"
          >
            Cửa hàng
          </button>

        </nav>

        <div
          class="w-full md:w-[260px] lg:w-[320px] flex rounded-full border bg-neutral-50 px-4 py-3 items-center gap-3"
        >

          ${icon("search", "w-5 h-5")}

          <input
            id="searchInput"
            onkeydown="searchEnter(event)"
            class="bg-transparent outline-none flex-1"
            placeholder="Tìm sản phẩm..."
          >

        </div>

        <div class="flex items-center gap-3 md:gap-5 shrink-0">

          <a
            href="/cart"
            title="Giỏ hàng"
            class="relative"
          >

            ${icon("shopping-bag")}

            <span
              id="cartCount"
              class="
                hidden absolute -top-2 -right-3
                min-w-[20px] h-5 px-1
                rounded-full bg-red-800 text-white
                text-[11px] font-bold
                flex items-center justify-center
              "
            >
              0
            </span>

          </a>

          <a
            href="/orders"
            title="Đơn hàng của tôi"
          >
            ${icon("receipt-text", "w-6 h-6")}
          </a>

          <div class="header-account">

  ${
    getUser()?.token
      ? `
        <button
          type="button"
          id="headerAccountButton"
          class="header-account-trigger"
          onclick="toggleAccountMenu(event)"
          aria-label="Mở menu tài khoản"
          aria-expanded="false"
          aria-controls="headerAccountMenu"
        >
          <span class="header-account-avatar">
            ${icon("user-round", "w-5 h-5")}
          </span>

          <span class="header-account-name">
            ${escapeProductHtml(getHeaderUserName())}
          </span>

          ${icon("chevron-down", "w-4 h-4 header-account-chevron")}
        </button>

        <div
          id="headerAccountMenu"
          class="header-account-dropdown hidden"
        >

          <a href="/account">
            ${icon("user-round", "w-4 h-4")}
            <span>Tài khoản của tôi</span>
          </a>

          <a href="/orders">
            ${icon("package", "w-4 h-4")}
            <span>Đơn mua</span>
          </a>

          <div class="header-account-divider"></div>

          <button
            type="button"
            class="header-account-logout"
            onclick="logoutFromHeader()"
          >
            ${icon("log-out", "w-4 h-4")}
            <span>Đăng xuất</span>
          </button>

        </div>
          `
          : `
            <a
              href="/auth"
              class="header-account-guest"
              title="Đăng nhập"
              aria-label="Đăng nhập"
            >
              ${icon("user", "w-6 h-6")}
            </a>
          `
      }

</div>

        </div>

      </div>

    </header>
  `;
}

/* =========================================
   FOOTER
========================================= */


function footer() {
  const supportLinks = [
    ["Hướng dẫn đặt hàng", "ordering-guide"],
    ["Phương thức thanh toán", "payment-methods"],
    ["Chính sách sinh nhật thành viên", "birthday-policy"],
    ["Chính sách tích - tiêu điểm", "loyalty-policy"],
    ["Chính sách hoàn tiền", "refund-policy"]
  ];

  const policyLinks = [
    ["Chính sách vận chuyển", "shipping-policy"],
    ["Chính sách kiểm hàng", "inspection-policy"],
    ["Chính sách đổi trả", "return-policy"],
    ["Điều kiện & Điều khoản", "terms"],
    ["Chính sách bảo mật", "privacy-policy"]
  ];
  
  const footerCategories = (
    typeof categories !== "undefined" && Array.isArray(categories)
      ? categories.filter(c => !c.parent && !c.parentId)
      : []
  );

  const categoryLinks = footerCategories.map(c => `
    <li>
      <a href="/products?categoryId=${encodeURIComponent(c.categoryId)}"
        class="hover:text-red-300 transition-colors">
        ${c.categoryName}
      </a>
    </li>
  `).join("");

  const footerLinks = links => links.map(([label, slug]) => `
    <li>
      <a href="/pages/${slug}"
         class="hover:text-red-300 transition-colors">
        ${label}
      </a>
    </li>
  `).join("");

  return `
    <footer class="site-footer bg-black text-white"
            role="contentinfo">

      <div class="wrap py-12 grid grid-cols-1
            sm:grid-cols-2 lg:grid-cols-5 gap-8">

        <div>
          <h2 class="serif text-3xl tracking-widest font-bold">
            JODOK
          </h2>

          <p class="mt-4 text-neutral-300 text-sm leading-7">
            Thời trang nữ thanh lịch, hiện đại
          </p>

          <p class="mt-4 text-neutral-400 text-xs leading-6">
            <!-- noi dung can thay doi trong footer -->
            <!--Thông tin đơn vị kinh doanh, địa chỉ và mã số thuế
            cần được công bố theo thông tin đăng ký thực tế.-->
          </p>
        </div>
        
        <!-- DANH MỤC SẢN PHẨM -->
        <div>
          <h3 class="font-bold mb-5">
            DANH MỤC SẢN PHẨM
          </h3>

          <ul class="space-y-3 text-sm text-neutral-300">
            ${categoryLinks || `
              <li>
                <a href="/products"
                  class="hover:text-red-300 transition-colors">
                  Xem tất cả sản phẩm
                </a>
              </li>
            `}
          </ul>
        </div>

        <div>
          <h3 class="font-bold mb-5">HỖ TRỢ KHÁCH HÀNG</h3>

          <ul class="space-y-3 text-sm text-neutral-300">
            ${footerLinks(supportLinks)}
          </ul>
        </div>

        <div>
          <h3 class="font-bold mb-5">CHÍNH SÁCH</h3>

          <ul class="space-y-3 text-sm text-neutral-300">
            ${footerLinks(policyLinks)}
          </ul>
        </div>

        <div>
          <h3 class="font-bold mb-5">LIÊN HỆ</h3>

          <div class="text-sm text-neutral-300 leading-7">
            <p>Hà Nội, Việt Nam</p>
            <p>Hotline: 0976 814 999</p>
            <p>Email: eniuu127@gmail.com</p>
            <p>Giờ hỗ trợ: 9:00 - 20:00</p>
          </div>
        </div>

      </div>

      <div class="border-t border-neutral-800">
        <div class="wrap py-5 text-xs text-neutral-400
                    flex flex-wrap justify-between gap-3">

          <span>© JODOK. Bảo lưu các quyền.</span>

          <span>
            <a href="/pages/terms" class="hover:text-white">
              Điều khoản sử dụng
            </a>
            ·
            <a href="/pages/privacy-policy" class="hover:text-white">
              Chính sách bảo mật
            </a>
          </span>

        </div>
      </div>

    </footer>
  `;
}


/* =========================================
   PRODUCT CARD
========================================= */

function card(p, index) {
  const productId = Number(p.productId);

  const imageUrl = escapeProductHtml(
    getProductImg(p, index)
  );

  const brandName = escapeProductHtml(
    getBrandName(p)
  );

  const productName = escapeProductHtml(
    p.productName || "Sản phẩm JODOK"
  );

  const price = jodokSalePriceMarkup(p.productId, p.basePrice);
  const originalPrice = Number(p.basePrice);
  const salePrice = Number(jodokSalePrice(p.productId, p.basePrice));
  const isOnSale = p.basePrice != null && Number.isFinite(originalPrice) &&
    originalPrice > 0 && Number.isFinite(salePrice) && salePrice < originalPrice;
  const salePercent = isOnSale
    ? Math.round((originalPrice - salePrice) * 100 / originalPrice)
    : 0;

  const soldCount = formatSoldCount(
    getSoldCount(productId)
  );

  return `
    <article class="jodok-product-card">

      <!-- PRODUCT IMAGE -->
      <div
        class="jodok-product-image"
        onclick="detail(${productId})"
        style="cursor:pointer"
      >

      ${
        imageUrl
          ? `
            <img
              src="${imageUrl}"
              alt="${productName}"
              loading="lazy"
              onerror="handleProductImageError(this)"
            >
          `
          : `
            <div class="jodok-no-image"
              style="
                width:100%;
                height:100%;
                min-height:180px;
                display:flex;
                align-items:center;
                justify-content:center;
                flex-direction:column;
                gap:10px;
                background:#f5f5f5;
                color:#999;
                font-size:13px;
                text-align:center;
              ">
              <span style="font-size:30px">▧</span>
              <span>Chưa có ảnh sản phẩm</span>
            </div>
          `
      }

        ${isOnSale
          ? `<span class="jodok-product-badge" style="top:12px;left:12px;border-radius:4px;background:#922a35;color:#fff;padding:4px 10px;font-size:12px;font-weight:700;line-height:18px">-${salePercent}%</span>`
          : ""
        }

        <!-- HOVER ACTIONS -->
        <div class="jodok-product-actions">

          <!-- CART BUTTON -->
          <button
            type="button"
            class="jodok-product-action"
            title="Chọn size, màu và thêm vào giỏ hàng"
            aria-label="Chọn biến thể và thêm vào giỏ hàng"
            onclick="event.stopPropagation(); detail(${productId})"
          >

            ${icon("shopping-cart", "w-5 h-5")}

          </button>

          <!-- VIEW DETAIL BUTTON -->
          <button
            type="button"
            class="jodok-product-action view"
            title="Xem chi tiết sản phẩm"
            aria-label="Xem chi tiết sản phẩm"
            onclick="event.stopPropagation(); detail(${productId})"
          >

            ${icon("eye", "w-5 h-5")}

          </button>

        </div>

      </div>

      <!-- PRODUCT INFORMATION -->
      <div class="jodok-product-info">

        <!-- BRAND -->
        <p class="jodok-product-brand">
          ${brandName}
        </p>

        <!-- NAME -->
        <h3 class="jodok-product-name">

          <a
            href="/detail?productId=${productId}"
            onclick="event.preventDefault(); detail(${productId})"
          >
            ${productName}
          </a>

        </h3>

        <!-- PRICE LEFT / SOLD RIGHT -->
        <div class="jodok-product-bottom" style="display:flex;flex-wrap:nowrap;align-items:flex-end;justify-content:space-between;gap:4px;min-width:0">

          <div class="jodok-product-price" style="flex:0 1 auto;min-width:0;white-space:normal;line-height:1.5">
            ${price}
          </div>

          <span class="jodok-product-sold" style="flex:0 0 auto;white-space:nowrap;margin-left:auto;align-self:flex-end;text-align:right">
            ${soldCount}
          </span>

        </div>

      </div>

    </article>
  `;
}

/* =========================================
   PRODUCT GRID
========================================= */

function productGrid(list = products) {
  if (!Array.isArray(list) || !list.length) {
    return `
      <div class="bg-white rounded-3xl border p-10 text-center text-neutral-500">
        Chưa có sản phẩm để hiển thị.
      </div>
    `;
  }

  return `
    <div class="jodok-product-grid">
      ${list.map((p, index) => card(p, index)).join("")}
    </div>
  `;
}

/* =========================================
   RENDER APP
========================================= */

function renderApp(html) {
  document.getElementById("app").innerHTML = `
    <div class="site-page">
      ${html}
    </div>
  `;

  if (window.lucide) {
    lucide.createIcons();
  }

  updateCartCount();
}

/* =========================================
   UPDATE CART COUNT
========================================= */

async function updateCartCount() {
  const badge = document.getElementById("cartCount");

  if (!badge) {
    return;
  }

  const user = getUser();

  if (!user?.userId) {
    badge.classList.add("hidden");
    return;
  }

  const total = await getCartCount();

  badge.innerText = total;

  badge.classList.remove("hidden");
}

/* =========================================
   TOAST NOTIFICATION
========================================= */

function showToast(
  title,
  text,
  type = "success"
) {
  const old = document.getElementById("toast");

  if (old) {
    old.remove();
  }

  const toast = document.createElement("div");

  toast.id = "toast";

  toast.className = `
    toast
    ${type === "error" ? "toast-error" : "toast-success"}
  `;

  toast.innerHTML = `
    <div class="toast-icon">
      ${type === "error" ? "!" : "✓"}
    </div>

    <div>

      <div class="toast-title">
        ${title}
      </div>

      <div class="toast-text">
        ${text}
      </div>

    </div>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2500);
}

/* =========================================
   SEARCH
========================================= */

function searchEnter(event) {
  if (event.key !== "Enter") {
    return;
  }

  const keyword = event.target.value.trim();

  if (!keyword) {
    return;
  }

  location.href =
    `/products?keyword=${encodeURIComponent(keyword)}`;
}

/* =========================================
   COMMON LOADED
========================================= */

console.log("COMMON LOADED");