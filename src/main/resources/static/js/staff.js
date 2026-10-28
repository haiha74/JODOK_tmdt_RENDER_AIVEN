const API_BASE = "/api";

let orders = [];
let variants = [];
let currentStaffTab = "orders";
let staffOrderLimit = 10;
let staffOrderSearch = "";
let staffOrderSort = "newest";
let staffOrderDate = "";
let staffInventoryLimit = 10;
let staffInventorySearch = "";
let staffInventorySearchTimer = null;



function money(v){
  return Number(v || 0).toLocaleString("vi-VN") + "đ";
}

function showStaffToast(title, message, type = "success"){
  const old = document.getElementById("staffToast");
  if(old) old.remove();

  const toast = document.createElement("div");
  toast.id = "staffToast";
  toast.className = `
    fixed top-6 right-6 z-[99999]
    bg-white border-l-8
    ${type === "error" ? "border-red-800" : "border-green-700"}
    rounded-2xl shadow-2xl px-6 py-4
    min-w-[320px] max-w-[420px]
  `;

  toast.innerHTML = `
    <b class="block text-lg">${title}</b>
    <p class="text-sm text-neutral-600 mt-1">${message}</p>
  `;

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

function staff(){
  return JSON.parse(localStorage.getItem("ha_staff") || "null");
}

function staffAuthHeaders(){
  const s = staff();

  return s?.token
    ? { "Authorization": "Bearer " + s.token }
    : {};
}

function staffJsonHeaders(){
  return {
    "Content-Type": "application/json",
    ...staffAuthHeaders()
  };
}

async function checkStaff(){
  if(staff()){
    document.getElementById("staffLogin").classList.add("hidden");
    document.getElementById("staffDashboard").classList.remove("hidden");

    await loadOrders();
    await loadVariants();
    renderStaffPage();
  }
}

async function loginStaff(){
  const body = {
    email: document.getElementById("staffEmail").value.trim(),
    password: document.getElementById("staffPassword").value
  };

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(body)
  });

  const data = await res.json();

  if(!res.ok){
    document.getElementById("staffMsg").innerText = data.message || "Đăng nhập thất bại";
    return;
  }

  if(data.role !== "STAFF"){
    document.getElementById("staffMsg").innerText = "Tài khoản không có quyền Staff";
    return;
  }

  localStorage.setItem("ha_staff", JSON.stringify(data));
  checkStaff();
}

function logoutStaff(){
  localStorage.removeItem("ha_staff");
  location.href = "/staff";
}

async function loadOrders(){
  const res = await fetch(`${API_BASE}/orders`, {
    headers: staffAuthHeaders()
  });
  orders = await res.json();
}

async function loadVariants(){
  const res = await fetch(`${API_BASE}/variants`, {
    headers: staffAuthHeaders()
  });
  variants = await res.json();
}

function renderStats(){
  document.getElementById("totalOrders").innerText = orders.length;
  document.getElementById("pendingOrders").innerText =
    orders.filter(o =>
    o.orderStatus === "PENDING" ||
    o.orderStatus === "PAID"
  ).length;
  document.getElementById("shippingOrders").innerText =
    orders.filter(o => o.orderStatus === "SHIPPING").length;
  document.getElementById("completedOrders").innerText =
    orders.filter(o => o.orderStatus === "COMPLETED").length;
}

function renderOrders(){
  const keyword = staffOrderSearch.toLowerCase();

  let filteredOrders = orders.filter(o => {
    const orderId = String(o.orderId || "").toLowerCase();
    const name = (o.user?.fullname || "").toLowerCase();
    const email = (o.user?.email || "").toLowerCase();
    const phone = (o.user?.phone || "").toLowerCase();
    const address = (o.address || "").toLowerCase();

    return orderId.includes(keyword)
      || name.includes(keyword)
      || email.includes(keyword)
      || phone.includes(keyword)
      || address.includes(keyword);
  });
  if(staffOrderDate){
  filteredOrders = filteredOrders.filter(o =>
    o.createdAt &&
    new Date(o.createdAt).toISOString().slice(0,10) === staffOrderDate
  );
}

filteredOrders.sort((a,b)=>{
  const da = new Date(a.createdAt || 0);
  const db = new Date(b.createdAt || 0);

  return staffOrderSort === "oldest"
    ? da - db
    : db - da;
});
  const list = filteredOrders.slice(0, staffOrderLimit);

  document.getElementById("orderBody").innerHTML = list.map(o => `
    <tr class="border-t">
      <td class="p-4 font-bold">${o.orderCode || ("DH" + String(o.orderId).padStart(6, "0"))}</td>
      <td>${o.user?.fullname || o.user?.email || "Khách hàng"}</td>
      <td class="max-w-[260px] text-sm text-neutral-600">${o.address || "Chưa có"}</td>
      <td class="text-red-800 font-bold">${money(o.finalAmount || o.totalAmount)}</td>

      <td>
        <select onchange="updateOrderStatus(${o.orderId}, this.value)"
          class="border rounded-full px-3 py-2 text-sm font-semibold">
          ${[
            ["PENDING","Chờ xử lý"],
            ["PENDING_PAYMENT","Chờ thanh toán PayOS"],
            ["PAID","Đã thanh toán"],
            ["CONFIRMED","Đã xác nhận"],
            ["SHIPPING","Đang giao"],
            ["COMPLETED","Hoàn thành"],
            ["CANCELLED","Đã hủy"]
          ].map(s => `
            <option value="${s[0]}" ${o.orderStatus === s[0] ? "selected" : ""}>
              ${s[1]}
            </option>
          `).join("")}
        </select>
      </td>

      <td>${o.updatedByStaff || "Chưa cập nhật"}</td>
      <td>
        <button onclick="openOrderDetail(${o.orderId})"
          class="bg-black text-white rounded-full px-4 py-2 text-sm">
          Chi tiết
        </button>
      </td>
    </tr>
  `).join("") || `
    <tr>
      <td colspan="7" class="p-6 text-center text-neutral-500">
        Không tìm thấy đơn hàng
      </td>
    </tr>
  `;

  document.getElementById("staffOrderPaging").innerHTML = `
    ${
      filteredOrders.length > staffOrderLimit
      ? `<button onclick="showMoreStaffOrders()"
          class="border rounded-full px-7 py-3 font-bold hover:bg-black hover:text-white transition">
          Xem thêm
        </button>`
      : ""
    }

    ${
      staffOrderLimit > 10
      ? `<button onclick="hideLessStaffOrders()"
          class="border rounded-full px-7 py-3 font-bold hover:bg-red-800 hover:text-white transition">
          Ẩn bớt
        </button>`
      : ""
    }
  `;
}

function searchStaffOrders(value){
  staffOrderSearch = value;
  staffOrderLimit = 10;
  renderStaffPage();

  setTimeout(() => {
    const input = document.getElementById("staffOrderSearch");
    if(input){
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }, 0);
}

function changeStaffOrderSort(value){
  staffOrderSort = value;
  staffOrderLimit = 10;
  renderStaffPage();
}

function changeStaffOrderDate(value){
  staffOrderDate = value;
  staffOrderLimit = 10;
  renderStaffPage();
}

function resetStaffOrderFilter(){
  staffOrderSort = "newest";
  staffOrderDate = "";
  staffOrderLimit = 10;
  renderStaffPage();
}

function showMoreStaffOrders(){
  staffOrderLimit += 10;
  renderStaffPage();
}

function hideLessStaffOrders(){
  staffOrderLimit = Math.max(10, staffOrderLimit - 10);
  renderStaffPage();
}

async function refreshStaffOrders(){
  staffOrderLimit = 10;
  await loadOrders();
  renderStaffPage();
}

async function updateOrderStatus(orderId, status){
  const res = await fetch(`${API_BASE}/orders/${orderId}/status?status=${status}`, {
    method: "PUT",
    headers: staffAuthHeaders()
  });

  if(!res.ok){
    alert("Cập nhật trạng thái thất bại");
    return;
  }

  await loadOrders();
  renderStaffPage();
}

async function openOrderDetail(orderId){
  const res = await fetch(`${API_BASE}/orders/${orderId}`, {
    headers: staffAuthHeaders()
  });
  const order = await res.json();

  document.getElementById("orderModal").classList.remove("hidden");
  document.getElementById("orderModal").classList.add("flex");

  document.getElementById("orderDetailContent").innerHTML = `
    <div class="grid md:grid-cols-2 gap-4 mb-6">
      <div class="border rounded-2xl p-4">
        <p class="text-neutral-500">Mã đơn</p>
        <b>${order.orderCode || ("DH" + String(order.orderId).padStart(6, "0"))}</b>
      </div>

      <div class="border rounded-2xl p-4">
        <p class="text-neutral-500">Trạng thái</p>
        <b class="text-red-800">${{
          PENDING:"Chờ xử lý",
          PENDING_PAYMENT: "Chờ thanh toán PayOS",
          PAID:"Đã thanh toán",
          CONFIRMED:"Đã xác nhận",
          SHIPPING:"Đang giao",
          COMPLETED:"Hoàn thành",
          CANCELLED:"Đã hủy"
        }[order.orderStatus] || order.orderStatus}</b>
      </div>

      <div class="border rounded-2xl p-4">
        <p class="text-neutral-500">Khách hàng</p>
        <b>${order.user?.fullname || order.user?.email}</b>
      </div>

      <div class="border rounded-2xl p-4">
        <p class="text-neutral-500">Tổng thanh toán</p>
        <b class="text-red-800">${money(order.finalAmount)}</b>
      </div>
    </div>

    <h3 class="font-bold text-xl mb-4">Sản phẩm trong đơn</h3>

    ${
      order.items?.length
      ? order.items.map(item => `
        <div class="border-b py-4">
          <b>${item.variant?.product?.productName || "Sản phẩm"}</b>
          <p class="text-sm text-neutral-500">
            Size: ${item.variant?.size || "-"} · Màu: ${item.variant?.color || "-"}
          </p>
          <p>Số lượng: ${item.quantity}</p>
          <p class="text-red-800 font-bold">${money(item.price)}</p>
        </div>
      `).join("")
      : `<p class="text-neutral-500">Không có sản phẩm</p>`
    }
  `;
}

function closeOrderDetail(){
  document.getElementById("orderModal").classList.add("hidden");
  document.getElementById("orderModal").classList.remove("flex");
}

function setStaffTab(tab){
  currentStaffTab = tab;
  renderStaffPage();
}

function staffMenu(){
  const items = [
    ["orders", "Quản lý đơn hàng"],
    ["inventory", "Quản lý kho"]
  ];

  return `
    <aside class="soft-card p-5 h-fit sticky top-28">
      <h2 class="font-bold text-xl mb-4">Menu nhân viên</h2>
      ${items.map(i => `
        <button onclick="setStaffTab('${i[0]}')"
          class="w-full flex items-center gap-3 text-left rounded-2xl px-4 py-3 mb-2
          ${currentStaffTab === i[0] ? "bg-red-50 text-red-800 font-bold" : "hover:bg-neutral-50"}">
          <span>${i[1]}</span>
        </button>
      `).join("")}
    </aside>
  `;
}

function renderStaffPage(){
  const content = currentStaffTab === "inventory"
    ? inventoryPanel()
    : orderPanel();

  document.getElementById("staffContent").innerHTML = `
    <div class="grid lg:grid-cols-[260px_1fr] gap-6">
      ${staffMenu()}
      <section>${content}</section>
    </div>
  `;

  if(currentStaffTab === "orders"){
    renderOrders();
    renderStats();
  }
}

function orderPanel(){
  return `
    <div class="space-y-6">
      <div class="grid md:grid-cols-4 gap-4">
        <div class="soft-card p-5"><p>Tổng đơn</p><b id="totalOrders" class="text-3xl">0</b></div>
        <div class="soft-card p-5"><p>Chờ xử lý</p><b id="pendingOrders" class="text-3xl">0</b></div>
        <div class="soft-card p-5"><p>Đang giao</p><b id="shippingOrders" class="text-3xl">0</b></div>
        <div class="soft-card p-5"><p>Hoàn thành</p><b id="completedOrders" class="text-3xl">0</b></div>
      </div>

      <div class="soft-card overflow-hidden">
        <div class="p-6 border-b flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <h2 class="font-bold text-xl">Quản lý đơn hàng</h2>

          <div class="flex flex-col lg:flex-row gap-3 w-full lg:w-auto">
            <input
              id="staffOrderSearch"
              value="${staffOrderSearch}"
              oninput="searchStaffOrders(this.value)"
              class="border rounded-full px-5 py-3 w-full lg:w-96 outline-none"
              placeholder="Tìm mã đơn, tên, email, số điện thoại..."
            >

            <select onchange="changeStaffOrderSort(this.value)"
              class="border rounded-full px-5 py-3">
              <option value="newest" ${staffOrderSort === "newest" ? "selected" : ""}>Mới nhất</option>
              <option value="oldest" ${staffOrderSort === "oldest" ? "selected" : ""}>Cũ nhất</option>
            </select>

            <input type="date"
              value="${staffOrderDate}"
              onchange="changeStaffOrderDate(this.value)"
              class="border rounded-full px-5 py-3">

            <button onclick="resetStaffOrderFilter()"
              class="border rounded-full px-5 py-3 font-bold whitespace-nowrap">
              Xóa lọc
            </button>

            <button onclick="refreshStaffOrders()"
              class="border rounded-full px-5 py-3 font-bold whitespace-nowrap">
              Làm mới
            </button>
          </div>
        </div>

        <table class="w-full text-left">
          <thead class="bg-neutral-50 text-sm text-neutral-500">
            <tr>
              <th class="p-4">Mã đơn</th>
              <th>Khách hàng</th>
              <th>Địa chỉ</th>
              <th>Tổng tiền</th>
              <th>Trạng thái</th>
              <th>Nhân viên</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody id="orderBody"></tbody>
        </table>

        <div id="staffOrderPaging" class="px-6 py-5 border-t flex justify-center gap-4"></div>
      </div>
    </div>
  `;
}

function inventoryPanel(){
  const keyword = staffInventorySearch.toLowerCase();

  const filteredVariants = variants.filter(v => {
    const product = (v.product?.productName || "").toLowerCase();
    const size = (v.size || "").toLowerCase();
    const color = (v.color || "").toLowerCase();
    const sku = (v.sku || "").toLowerCase();

    return product.includes(keyword)
      || size.includes(keyword)
      || color.includes(keyword)
      || sku.includes(keyword);
  });

  const list = filteredVariants.slice(0, staffInventoryLimit);

  return `
    <div class="soft-card overflow-hidden">
      <div class="p-6 border-b flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 class="font-bold text-xl">Quản lý kho</h2>
          <p class="text-neutral-500 mt-1">Theo dõi và cập nhật tồn kho biến thể sản phẩm.</p>
        </div>


          <div class="flex gap-3 w-full lg:w-auto">
  <input
    id="staffInventorySearch"
    value="${staffInventorySearch}"
    oninput="searchStaffInventory(this.value)"
    class="border rounded-full px-5 py-3 w-full lg:w-96 outline-none"
    placeholder="Tìm sản phẩm, size, màu, SKU..."
  >

  <button onclick="refreshStaffInventory()"
    class="border rounded-full px-5 py-3 font-bold whitespace-nowrap">
    Làm mới
  </button>
</div>
      </div>

      <table class="w-full text-left">
        <thead class="bg-neutral-50 text-sm text-neutral-500">
          <tr>
            <th class="p-4">Sản phẩm</th>
            <th>Size</th>
            <th>Màu</th>
            <th>SKU</th>
            <th>Tồn kho</th>
            <th>Nhân viên</th>
            <th>Cập nhật</th>
          </tr>
        </thead>

        <tbody>
          ${
            list.length
            ? list.map(v => `
              <tr class="border-t">
                <td class="p-4 font-semibold">${v.product?.productName || "Không rõ"}</td>
                <td>${v.size || "-"}</td>
                <td>${v.color || "-"}</td>
                <td class="font-mono text-sm">${v.sku || "-"}</td>
                <td>
                  <input
                    id="stock-${v.variantId}"
                    type="number"
                    min="0"
                    value="${v.stock ?? 0}"
                    oninput="if(this.value < 0) this.value = 0"
                    class="border rounded-xl px-4 py-2 w-28"
                  >
                </td>
                <td>${v.updatedByStaff || "Chưa cập nhật"}</td>
                <td>
                  <button onclick="updateStock(${v.variantId})"
                    class="bg-red-800 text-white rounded-full px-5 py-2 font-bold">
                    Lưu
                  </button>
                </td>
              </tr>
            `).join("")
            : `<tr><td colspan="7" class="p-6 text-center text-neutral-500">Không tìm thấy biến thể</td></tr>`
          }
        </tbody>
      </table>

      <div class="px-6 py-5 border-t flex justify-center gap-4">
        ${
          filteredVariants.length > staffInventoryLimit
          ? `<button onclick="showMoreStaffInventory()"
              class="border rounded-full px-7 py-3 font-bold hover:bg-black hover:text-white transition">
              Xem thêm
            </button>`
          : ""
        }

        ${
          staffInventoryLimit > 10
          ? `<button onclick="hideLessStaffInventory()"
              class="border rounded-full px-7 py-3 font-bold hover:bg-red-800 hover:text-white transition">
              Ẩn bớt
            </button>`
          : ""
        }
      </div>
    </div>
  `;
}

function searchStaffInventory(value){
  staffInventorySearch = value;
  staffInventoryLimit = 10;

  clearTimeout(staffInventorySearchTimer);

  staffInventorySearchTimer = setTimeout(() => {
    renderStaffPage();

    setTimeout(() => {
      const input = document.getElementById("staffInventorySearch");
      if(input){
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }, 0);
  }, 500);
}

function showMoreStaffInventory(){
  staffInventoryLimit += 10;
  renderStaffPage();
}

function hideLessStaffInventory(){
  staffInventoryLimit = Math.max(10, staffInventoryLimit - 10);
  renderStaffPage();
}

async function refreshStaffInventory(){
  staffInventoryLimit = 10;
  await loadVariants();
  renderStaffPage();
}

async function updateStock(variantId){
  const old = variants.find(v => v.variantId === variantId);
  let newStock = Number(document.getElementById(`stock-${variantId}`).value);

  if(newStock < 0){
    newStock = 0;
  }

  const body = {
    productId: old.product?.productId,
    size: old.size,
    color: old.color,
    sku: old.sku,
    price: old.price,
    stock: newStock,
    status: old.status || "ACTIVE"
  };

  const res = await fetch(`${API_BASE}/variants/${variantId}`, {
    method: "PUT",
    headers: staffJsonHeaders(),
    body: JSON.stringify(body)
  });

  if(!res.ok){
    showStaffToast(
      "Thất bại",
      "Cập nhật tồn kho thất bại",
      "error"
    );
    return;
  }

  await loadVariants();
  renderStaffPage();

  setTimeout(() => {
    showStaffToast(
      "Thành công",
      "Đã cập nhật tồn kho"
    );
  }, 100);
  }

checkStaff();