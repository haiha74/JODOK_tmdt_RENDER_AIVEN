let myOrders = [];
let orderLimit = 10;
let orderSort = "newest";
let orderStatusFilter = "ALL";
let orderSearch = "";
let reviews = [];


async function loadMyOrders(){
  await checkPayOSReturn();
  const user = JSON.parse(localStorage.getItem("ha_user") || "null");

  if(!user){
    showToast("Chưa đăng nhập", "Vui lòng đăng nhập để xem đơn hàng", "error");

    setTimeout(()=>{
      location.href = "/auth";
    },1000);

    return;
  }

  try{
    const headers = { "Authorization": "Bearer " + user.token };
    // Only this customer's reviews, not every review in the database.
    // Start both requests together; orders render as soon as its data arrives.
    const reviewTask = fetch(`${API_BASE}/reviews/user/${user.userId}`, { headers })
      .then(async response => response.ok ? response.json() : [])
      .catch(() => []);
    const res = await fetch(`${API_BASE}/orders/user/${user.userId}`, { headers });
    const data = await res.json();
    if (!res.ok) {
      showToast("Lỗi", data.message || "Không tải được đơn hàng", "error");
      return;
    }
    myOrders = Array.isArray(data) ? data : [];
    reviews = await reviewTask;
    if (!Array.isArray(reviews)) reviews = [];
    renderOrders();

  }catch(e){
    console.error(e);
    showToast("Lỗi kết nối", "Không kết nối được backend", "error");
  }
}

async function checkPayOSReturn(){
  const user = JSON.parse(localStorage.getItem("ha_user") || "null");

    if(!user){
      return;
    }
  const params = new URLSearchParams(location.search);

  const status = params.get("status");
  const orderCode = params.get("orderCode");

  if(status === "PAID" && orderCode){
    await fetch(`${API_BASE}/orders/${orderCode}/paid`, {
      method: "PUT",
      headers: {
        "Authorization": "Bearer " + user.token
      }
    });

    history.replaceState(null, "", "/orders");
  }
}

function statusText(status){
  const map = {
    PENDING: "Chờ xác nhận",
    PENDING_PAYMENT: "Chờ thanh toán PayOS",
    CONFIRMED: "Đã xác nhận",
    SHIPPING: "Đang giao",
    COMPLETED: "Hoàn thành",
    CANCELLED: "Đã hủy",
    PAID: "Đã thanh toán",
  };

  return map[status] || status || "Chờ xác nhận";
}

function statusClass(status){
  if(status === "PAID") return "bg-green-50 text-green-700";
  if(status === "COMPLETED") return "bg-green-50 text-green-700";
  if(status === "SHIPPING") return "bg-blue-50 text-blue-700";
  if(status === "CONFIRMED") return "bg-yellow-50 text-yellow-700";
  if(status === "CANCELLED") return "bg-red-50 text-red-700";
  return "bg-neutral-100 text-neutral-700";
}

let orderNumberCache = new Map();
let orderNumberCacheFor = null;
function getUserOrderNo(order){
  if (orderNumberCacheFor !== myOrders) {
    const sorted = [...myOrders].sort((a,b) =>
      new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    orderNumberCache = new Map(sorted.map((o, index) => [o.orderId, index + 1]));
    orderNumberCacheFor = myOrders;
  }
  return orderNumberCache.get(order.orderId) || 0;
}


function renderOrders(){
  let filteredOrders = [...myOrders];

  if(orderStatusFilter !== "ALL"){
    filteredOrders = filteredOrders.filter(o => {
      if(orderStatusFilter === "PROCESSING"){
        return ["CONFIRMED", "PAID", "PENDING_PAYMENT"].includes(o.orderStatus);
      }
      return o.orderStatus === orderStatusFilter;
    });
  }

  if(orderSearch.trim()){
    const keyword = orderSearch.trim().toLowerCase();

    filteredOrders = filteredOrders.filter(o => {
      const products = (o.items || [])
        .map(i => i.variant?.product?.productName || "")
        .join(" ");

      return [
        String(o.orderId || ""),
        `đơn hàng #${getUserOrderNo(o)}`,
        products
      ].join(" ").toLowerCase().includes(keyword);
    });
  }

  filteredOrders.sort((a,b)=>{
    const da = new Date(a.createdAt || 0);
    const db = new Date(b.createdAt || 0);
    return orderSort === "oldest" ? da - db : db - da;
  });

  const tabs = [
    ["ALL", "Tất cả"],
    ["PENDING", "Chờ xác nhận"],
    ["PROCESSING", "Đang xử lý"],
    ["SHIPPING", "Đang giao"],
    ["COMPLETED", "Hoàn thành"],
    ["CANCELLED", "Đã hủy"]
  ];

  const countStatus = status => {
    if(status === "ALL") return myOrders.length;

    if(status === "PROCESSING"){
      return myOrders.filter(o =>
        ["CONFIRMED", "PAID", "PENDING_PAYMENT"].includes(o.orderStatus)
      ).length;
    }

    return myOrders.filter(o => o.orderStatus === status).length;
  };

  const html = header() + `
    <main class="wrap orders-page">

      <div class="orders-layout">

        <aside class="orders-sidebar">
          <h3>Tài khoản của tôi</h3>

          <a href="/account">
              <i data-lucide="user-round"></i>
              Thông tin tài khoản
          </a>

          <a href="/orders" class="active">
            <i data-lucide="package"></i>
            Đơn hàng của tôi
          </a>

          <a href="/products">
            <i data-lucide="shopping-bag"></i>
            Tiếp tục mua sắm
          </a>

          <button onclick="logoutOrderAccount()">
            <i data-lucide="log-out"></i>
            Đăng xuất
          </button>
        </aside>

        <section class="orders-content">

          <nav class="orders-breadcrumb">
            <a href="/">Trang chủ</a>
            <i data-lucide="chevron-right"></i>
            <span>Tài khoản</span>
            <i data-lucide="chevron-right"></i>
            <strong>Đơn hàng của tôi</strong>
          </nav>

          <div class="orders-heading">
            <h1>Đơn hàng của tôi</h1>
          </div>

          <div class="orders-tabs">
            ${tabs.map(([value,label]) => `
              <button
                class="${orderStatusFilter === value ? "active" : ""}"
                onclick="changeOrderStatus('${value}')">
                ${label} (${countStatus(value)})
              </button>
            `).join("")}
          </div>

          <div class="orders-toolbar">

            <div class="orders-search">
              <i data-lucide="search"></i>
              <input
                id="orderSearchInput"
                placeholder="Tìm theo mã đơn, tên sản phẩm..."
                value="${escapeOrderText(orderSearch)}"
                oninput="changeOrderSearch(this.value)"
              >
            </div>

            <select
              class="orders-sort"
              onchange="changeOrderSort(this.value)">
              <option value="newest"
                ${orderSort === "newest" ? "selected" : ""}>
                Mới nhất
              </option>
              <option value="oldest"
                ${orderSort === "oldest" ? "selected" : ""}>
                Cũ nhất
              </option>
            </select>

          </div>

          <div class="orders-list">
            ${
              myOrders.length === 0
              ? `
                <div class="orders-empty">
                  <i data-lucide="package-open"></i>
                  <h2>Bạn chưa có đơn hàng</h2>
                  <p>Khám phá sản phẩm và bắt đầu mua sắm tại JODOK.</p>
                  <a href="/products">Mua sắm ngay</a>
                </div>
              `
              : filteredOrders.length === 0
              ? `
                <div class="orders-empty">
                  <i data-lucide="search-x"></i>
                  <h2>Không tìm thấy đơn hàng</h2>
                  <p>Thử tìm kiếm hoặc chọn trạng thái khác.</p>
                  <button onclick="resetOrderFilter()">Xóa bộ lọc</button>
                </div>
              `
              : filteredOrders.slice(0,orderLimit)
                  .map(order => orderCard(order)).join("")
            }
          </div>

          <div class="orders-pagination">
            ${
              filteredOrders.length > orderLimit
              ? `<button onclick="showMoreOrders()">Xem thêm đơn hàng</button>`
              : ""
            }

            ${
              orderLimit > 10
              ? `<button onclick="hideOrders()">Thu gọn</button>`
              : ""
            }
          </div>

        </section>
      </div>
    </main>
  ` + footer();

  renderApp(html);
  if(window.lucide) lucide.createIcons();
}

function escapeOrderText(value){
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function changeOrderStatus(status){
  orderStatusFilter = status;
  orderLimit = 10;
  renderOrders();
}

function changeOrderSearch(value){
  orderSearch = value;
  orderLimit = 10;

  const cursor = document.getElementById("orderSearchInput")?.selectionStart;
  renderOrders();

  const input = document.getElementById("orderSearchInput");
  if(input){
    input.focus();
    input.setSelectionRange(cursor ?? value.length, cursor ?? value.length);
  }
}

function logoutOrderAccount(){
  localStorage.removeItem("ha_user");
  location.href = "/auth";
}


function orderCard(order){
  const items = order.items || [];

  return `
    <article class="order-card">

      <!-- HEADER -->
      <div class="order-card-header">
        <div class="order-card-title">
          <span class="order-card-icon">
            <i data-lucide="receipt-text"></i>
          </span>

          <div>
            <h2>Đơn hàng #${getUserOrderNo(order)}</h2>
            <p>
              Ngày đặt:
              ${order.createdAt
                ? new Date(order.createdAt).toLocaleString("vi-VN")
                : "Không rõ"}
            </p>
          </div>
        </div>

        <div class="order-card-actions">
          <span class="order-status ${statusClass(order.orderStatus)}">
            ${statusText(order.orderStatus)}
          </span>

          <button
            class="order-detail-btn"
            onclick="toggleOrderItems(${order.orderId})">
            <span id="order-detail-label-${order.orderId}">
              Xem chi tiết
            </span>
            <i data-lucide="chevron-down"></i>
          </button>
        </div>
      </div>

      <!-- THÔNG TIN ĐƠN HÀNG -->
      <div class="order-card-info">

        <div class="order-info-block">
          <i data-lucide="map-pin"></i>
          <div>
            <span>Địa chỉ nhận hàng</span>
            <strong>
              ${escapeOrderText(order.address || "Chưa có địa chỉ")}
            </strong>
          </div>
        </div>

        <div class="order-info-block">
          <i data-lucide="wallet"></i>
          <div>
            <span>Tổng thanh toán</span>
            <strong class="order-total">
              ${formatPrice(order.finalAmount ?? order.totalAmount ?? 0)}
            </strong>
          </div>
        </div>

        <div class="order-info-block">
          <i data-lucide="credit-card"></i>
          <div>
            <span>Hình thức thanh toán</span>
            <strong>
              ${orderPaymentText(order)}
            </strong>
          </div>
        </div>

      </div>

      <!-- DANH SÁCH SẢN PHẨM -->
      <div class="order-products">
        ${
          items.length
          ? items.map((item,index) =>
              orderItemHtml(item,index,order)
            ).join("")
          : `<p class="order-no-products">Không có sản phẩm trong đơn.</p>`
        }
      </div>

      <!-- CHI TIẾT MỞ RỘNG -->
      <div id="order-items-${order.orderId}"
           class="order-extra hidden">

        <div>
          <span>Mã đơn hàng</span>
          <strong>#${order.orderId}</strong>
        </div>

        <div>
          <span>Trạng thái</span>
          <strong>${statusText(order.orderStatus)}</strong>
        </div>

        <div>
          <span>Tổng thanh toán</span>
          <strong class="order-total">
            ${formatPrice(order.finalAmount ?? order.totalAmount ?? 0)}
          </strong>
        </div>

        <div>
          <span>Hình thức thanh toán</span>
          <strong>${orderPaymentText(order)}</strong>
        </div>

      </div>

    </article>
  `;
}

function orderPaymentText(order) {
    const method = String(
        order.payment?.paymentMethod ??
        order.paymentMethod ??
        ""
    ).trim().toUpperCase();

    switch (method) {
        case "CASH":
        case "COD":
        case "CASH_ON_DELIVERY":
            return "COD - Thanh toán khi nhận hàng";

        case "PAYOS":
        case "PAY_OS":
        case "BANK_TRANSFER":
        case "BANKING":
        case "QR":
            return "Chuyển khoản ngân hàng";

        default:
            return "Chưa xác định";
    }
}

function orderItemHtml(item,index,order){
  const v = item.variant;
  const p = v?.product;

  const img = p
    ? getProductImg(p,index)
    : fallbackImages[index % fallbackImages.length];

  const orderItemId = String(item.orderItemId || item.id || index);

  const reviewed = Array.isArray(reviews) && reviews.some(r =>
    String(r.orderItem?.orderItemId) === orderItemId
  );

  const productId = p?.productId;

  const reviewUrl =
    `/detail?productId=${productId}` +
    `${reviewed ? "" : "&review=1"}` +
    `&orderItemId=${orderItemId}` +
    `&size=${encodeURIComponent(v?.size || "")}` +
    `&color=${encodeURIComponent(v?.color || "")}`;

  return `
    <div class="order-product">

      <a href="/detail?productId=${productId}" class="order-product-image">
        <img loading="lazy" decoding="async" src="${img}" alt="${escapeOrderText(p?.productName || "Sản phẩm")}">
      </a>

      <div class="order-product-info">
        <a href="/detail?productId=${productId}" class="order-product-name">
          ${escapeOrderText(p?.productName || "Sản phẩm")}
        </a>

        <p>
          Size: ${escapeOrderText(v?.size || "-")}
          <span> | </span>
          Màu: ${escapeOrderText(v?.color || "-")}
          <span> | </span>
          Số lượng: ${item.quantity}
        </p>

        <strong>${formatPrice(item.price || item.unitPrice)}</strong>
      </div>

      <div class="order-product-actions">
        ${
          order.orderStatus === "COMPLETED"
          ? `
            <button
              class="order-review-btn"
              onclick="location.href='${reviewUrl}'">
              <i data-lucide="star"></i>
              ${reviewed ? "Xem đánh giá" : "Đánh giá"}
            </button>
          `
          : ""
        }

        ${
          productId
          ? `
            <a class="order-rebuy-btn"
               href="/detail?productId=${productId}">
              <i data-lucide="shopping-bag"></i>
              Mua lại
            </a>
          `
          : ""
        }
      </div>

    </div>
  `;
}


function toggleOrderItems(orderId){
  const box = document.getElementById(`order-items-${orderId}`);
  const label = document.getElementById(`order-detail-label-${orderId}`);

  if(!box) return;

  const isOpening = box.classList.contains("hidden");
  box.classList.toggle("hidden");

  if(label){
    label.textContent = isOpening ? "Thu gọn" : "Xem chi tiết";
  }
}

function showMoreOrders(){
  orderLimit += 10;
  renderOrders();
}


function hideOrders(){
  orderLimit = 10;
  renderOrders();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function changeOrderSort(value){
  orderSort = value;
  orderLimit = 10;
  renderOrders();
}

function resetOrderFilter(){
  orderSort = "newest";
  orderStatusFilter = "ALL";
  orderSearch = "";
  orderLimit = 10;
  renderOrders();
}
loadMyOrders();