// Refactored from legacy /js/admin.js. Business logic preserved.
// Loaded as a compatibility classic script by admin/admin.js so existing inline handlers keep working.

function overviewDateKey(value) {
  if (!value) return "";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function overviewDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return overviewDateKey(d);
}

function overviewRange() {
  if (overviewPeriod === "custom") {
    return {
      from: overviewFrom,
      to: overviewTo
    };
  }

  const days = Number(overviewPeriod) || 7;

  return {
    from: overviewDaysAgo(days - 1),
    to: overviewDaysAgo(0)
  };
}

function overviewFilteredOrders() {
  const { from, to } = overviewRange();

  return orders.filter(o => {
    const day = overviewDateKey(o.createdAt);

    if (!day) return false;
    if (from && day < from) return false;
    if (to && day > to) return false;

    return true;
  });
}

function changeOverviewPeriod(value) {
  overviewPeriod = value;

  if (value !== "custom") {
    overviewFrom = "";
    overviewTo = "";
  }

  render();
}

function changeOverviewDates() {
  overviewPeriod = "custom";
  overviewFrom = document.getElementById("overviewFrom")?.value || "";
  overviewTo = document.getElementById("overviewTo")?.value || "";

  render();
}

function overviewStatusInfo(status) {
  const map = {
    PENDING: ["Chờ xác nhận", "pending", "#f5b43c"],
    PENDING_PAYMENT: ["Chờ thanh toán PayOS", "pending", "#f59e0b"],
    PAID: ["Đã thanh toán", "processing", "#3b82f6"],
    CONFIRMED: ["Đã xác nhận", "processing", "#60a5fa"],
    SHIPPING: ["Đang giao", "shipping", "#9061d8"],
    COMPLETED: ["Hoàn thành", "delivered", "#12a05c"],
    CANCELLED: ["Đã hủy", "cancelled", "#b91c1c"]
  };

  return map[status] || [status || "Không rõ", "pending", "#9ca3af"];
}

function statCards() {
  const list = overviewFilteredOrders();

  const revenue = list
    .filter(o => o.orderStatus !== "CANCELLED")
    .reduce((sum, o) => sum + Number(o.finalAmount || 0), 0);

  const cards = [
    {
      label: "Tổng đơn hàng",
      value: list.length.toLocaleString("vi-VN"),
      icon: "shopping-cart",
      note: "Trong khoảng thời gian đã chọn"
    },
    {
      label: "Doanh thu",
      value: money(revenue),
      icon: "circle-dollar-sign",
      note: "Không gồm đơn đã hủy",
      revenue: true
    },
    {
      label: "Người dùng",
      value: users.length.toLocaleString("vi-VN"),
      icon: "users",
      note: "Tổng tài khoản hệ thống"
    },
    {
      label: "Sản phẩm",
      value: products.length.toLocaleString("vi-VN"),
      icon: "shopping-bag",
      note: "Tổng sản phẩm đang quản lý"
    }
  ];

  return `
    <div class="admin-kpi-grid">
      ${cards.map(c => `
        <div class="soft-card admin-kpi-card">
          <div class="admin-kpi-icon">
            ${icon(c.icon)}
          </div>

          <div class="admin-kpi-body">
            <p class="admin-kpi-label">${c.label}</p>

            <h3 class="admin-kpi-value ${c.revenue ? "revenue" : ""}">
              ${c.value}
            </h3>

            <p class="admin-kpi-change">
              ${c.note}
            </p>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function overviewRevenueChart(list) {
  const { from, to } = overviewRange();
  const totals = {};

  list.forEach(o => {
    if (o.orderStatus === "CANCELLED") return;

    const day = overviewDateKey(o.createdAt);

    totals[day] = (totals[day] || 0)
      + Number(o.finalAmount || 0);
  });

  const dates = [];

  if (from && to && from <= to) {
    const cursor = new Date(from + "T12:00:00");
    const end = new Date(to + "T12:00:00");

    while (cursor <= end && dates.length < 366) {
      dates.push(overviewDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  } else {
    dates.push(...Object.keys(totals).sort());
  }

  if (!dates.length) {
    return `
      <div class="admin-revenue-chart flex items-center justify-center text-neutral-400">
        Chưa có dữ liệu doanh thu
      </div>
    `;
  }

  const values = dates.map(day => totals[day] || 0);
  const max = Math.max(...values, 1);

  const W = 700;
  const H = 215;
  const left = 70;
  const right = 15;
  const top = 12;
  const bottom = 31;

  const plotW = W - left - right;
  const plotH = H - top - bottom;

  const points = values.map((value, index) => {
    const x = left + (
      dates.length === 1
        ? plotW / 2
        : index * plotW / (dates.length - 1)
    );

    const y = top + plotH - (value / max) * plotH;

    return { x, y, value, day: dates[index] };
  });

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const area = `
    ${line}
    L ${points[points.length - 1].x} ${top + plotH}
    L ${points[0].x} ${top + plotH}
    Z
  `;

  const ticks = Array.from({ length: 5 }, (_, i) => {
    const value = max * i / 4;
    const y = top + plotH - i * plotH / 4;

    return `
      <line x1="${left}" y1="${y}" x2="${W - right}" y2="${y}"
        stroke="#e8e8eb" stroke-width="1"/>

      <text x="${left - 9}" y="${y + 4}"
        text-anchor="end" fill="#667085" font-size="10">
        ${Math.round(value).toLocaleString("vi-VN")}
      </text>
    `;
  }).join("");

  const step = Math.max(1, Math.ceil(dates.length / 7));

  const labels = points.map((p, i) => {
    if (i % step !== 0 && i !== points.length - 1) return "";

    return `
      <text x="${p.x}" y="${H - 8}"
        text-anchor="middle" fill="#667085" font-size="10">
        ${p.day.slice(8)}/${p.day.slice(5, 7)}
      </text>
    `;
  }).join("");

  return `
    <div class="admin-revenue-chart">
      <svg viewBox="0 0 ${W} ${H}"
        preserveAspectRatio="none"
        role="img"
        aria-label="Biểu đồ doanh thu theo ngày">

        <defs>
          <linearGradient id="overviewRevenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#b91c1c" stop-opacity=".19"/>
            <stop offset="100%" stop-color="#b91c1c" stop-opacity=".015"/>
          </linearGradient>
        </defs>

        ${ticks}

        <path d="${area}" fill="url(#overviewRevenueFill)"/>

        <path d="${line}" fill="none"
          stroke="#a31515" stroke-width="2.5"
          stroke-linejoin="round" stroke-linecap="round"/>

        ${points.map(p => `
          <circle cx="${p.x}" cy="${p.y}" r="3"
            fill="#a31515" stroke="#fff" stroke-width="1">
            <title>${p.day}: ${money(p.value)}</title>
          </circle>
        `).join("")}

        ${labels}
      </svg>
    </div>
  `;
}

function overviewDonutChart(list) {
  const statuses = [
    "PENDING",
    "PENDING_PAYMENT",
    "PAID",
    "CONFIRMED",
    "SHIPPING",
    "COMPLETED",
    "CANCELLED"
  ];

  const total = list.length;

  const data = statuses.map(status => {
    const [label, cls, color] = overviewStatusInfo(status);

    return {
      label,
      cls,
      color,
      count: list.filter(o => o.orderStatus === status).length
    };
  });

  let current = 0;

  const segments = data.map(item => {
    const start = current;
    const percent = total ? item.count / total * 100 : 0;

    current += percent;

    return `${item.color} ${start}% ${current}%`;
  });

  return `
    <div class="admin-donut-layout">
      <div class="admin-donut"
        style="background:${total
          ? `conic-gradient(${segments.join(",")})`
          : "#e5e7eb"}">

        <div class="admin-donut-center">
          <strong>${total.toLocaleString("vi-VN")}</strong>
          <span>đơn hàng</span>
        </div>
      </div>

      <div class="admin-donut-legend">
        ${data.map(item => `
          <div class="admin-legend-item">
            <span class="admin-legend-dot"
              style="background:${item.color}"></span>

            <span>${item.label}</span>

            <b>
              ${item.count}
              (${total ? Math.round(item.count / total * 100) : 0}%)
            </b>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function overviewRecentOrders(list) {
  const recent = [...list]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 5);

  return `
    <div class="soft-card admin-table-card">
      <div class="admin-card-heading">
        <h3 class="admin-card-title">
          ${icon("receipt-text")}
          Đơn hàng gần đây
        </h3>

        <a href="javascript:void(0)"
          onclick="setTab('orders')"
          class="admin-view-all">
          Xem tất cả ${icon("arrow-right", "w-4 h-4")}
        </a>
      </div>

      <div class="admin-table-scroll">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Mã đơn</th>
              <th>Khách hàng</th>
              <th>Tổng tiền</th>
              <th>Trạng thái</th>
              <th>Ngày đặt</th>
            </tr>
          </thead>

          <tbody>
            ${recent.length ? recent.map(o => {
              const [label, cls] = overviewStatusInfo(o.orderStatus);

              return `
                <tr>
                  <td>
                    <b>${escapeHtml(o.orderCode ||
                      ("DH" + String(o.orderId).padStart(6, "0")))}</b>
                  </td>

                  <td>${escapeHtml(o.user?.fullname ||
                    o.user?.email || "Khách hàng")}</td>

                  <td>${money(o.finalAmount ?? o.totalAmount)}</td>

                  <td>
                    <span class="admin-status ${cls}">
                      ${label}
                    </span>
                  </td>

                  <td>
                    ${o.createdAt
                      ? new Date(o.createdAt).toLocaleString("vi-VN")
                      : "-"}
                  </td>
                </tr>
              `;
            }).join("") : `
              <tr>
                <td colspan="5" class="text-center">
                  Chưa có đơn hàng trong khoảng thời gian này
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function overviewBestProducts(list) {
  const productList = topProducts(
    list.filter(o => o.orderStatus !== "CANCELLED")
  );

  return `
    <div class="soft-card admin-table-card">
      <div class="admin-card-heading">
        <h3 class="admin-card-title">
          ${icon("trophy")}
          Sản phẩm bán chạy
        </h3>

        <a href="javascript:void(0)"
          onclick="setTab('products')"
          class="admin-view-all">
          Xem tất cả ${icon("arrow-right", "w-4 h-4")}
        </a>
      </div>

      <div class="admin-table-scroll">
        <table class="admin-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Sản phẩm</th>
              <th>Đã bán</th>
              <th>Doanh thu</th>
            </tr>
          </thead>

          <tbody>
            ${productList.length ? productList.map((p, i) => {
              const product = products.find(x => x.productName === p.name);

              return `
                <tr>
                  <td>${i + 1}</td>

                  <td>
                    <div class="flex items-center gap-2">
                      <img
                        src="${product
                          ? productImg(product, i)
                          : "/images/no-image.png"}"
                        alt=""
                        onerror="this.src='/images/no-image.png'">

                      <span>${escapeHtml(p.name)}</span>
                    </div>
                  </td>

                  <td>${p.qty}</td>
                  <td>${money(p.revenue)}</td>
                </tr>
              `;
            }).join("") : `
              <tr>
                <td colspan="4" class="text-center">
                  Chưa có dữ liệu bán hàng
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function overviewCharts() {
  const list = overviewFilteredOrders();

  return `
    <div class="admin-chart-grid">
      <div class="soft-card admin-chart-card">
        <div class="admin-card-heading">
          <h3 class="admin-card-title">
            ${icon("chart-no-axes-combined")}
            Doanh thu theo ngày
          </h3>

          <select class="admin-chart-select"
            onchange="changeOverviewPeriod(this.value)">

            <option value="7" ${overviewPeriod === "7" ? "selected" : ""}>
              7 ngày gần nhất
            </option>

            <option value="14" ${overviewPeriod === "14" ? "selected" : ""}>
              14 ngày gần nhất
            </option>

            <option value="30" ${overviewPeriod === "30" ? "selected" : ""}>
              30 ngày gần nhất
            </option>

            <option value="custom" ${overviewPeriod === "custom" ? "selected" : ""}>
              Khoảng ngày đã chọn
            </option>
          </select>
        </div>

        ${overviewRevenueChart(list)}
      </div>

      <div class="soft-card admin-chart-card">
        <div class="admin-card-heading">
          <h3 class="admin-card-title">
            ${icon("chart-pie")}
            Tỉ lệ đơn hàng theo trạng thái
          </h3>
        </div>

        ${overviewDonutChart(list)}
      </div>
    </div>

    <div class="admin-table-grid">
      ${overviewRecentOrders(list)}
      ${overviewBestProducts(list)}
    </div>
  `;
}

function todayOrders(){
  const today = new Date().toDateString();

  return orders.filter(o =>
    o.createdAt && new Date(o.createdAt).toDateString() === today
  );
}

function todayRevenue(){
  return todayOrders()
    .filter(o => o.orderStatus !== "CANCELLED")
    .reduce((sum, o) => sum + Number(o.finalAmount || 0), 0);
}

function validOrders(){
  return orders.filter(o => o.orderStatus !== "CANCELLED");
}

function ordersInLastDays(days){
  const from = daysAgo(days - 1);
  return validOrders().filter(o =>
    o.createdAt && dateOnly(o.createdAt) >= from
  );
}

function revenueOf(list){
  return list
    .filter(o => o.orderStatus !== "CANCELLED")
    .reduce((sum, o) => sum + Number(o.finalAmount || 0), 0);
}

function topProducts(orderList = validOrders()){

  const map = {};

  orderList.forEach(order => {
    (order.items || []).forEach(item => {

      const p = item.variant?.product;
      if(!p) return;

      const id = p.productId;

      if(!map[id]){
        map[id] = {
          name: p.productName,
          qty: 0,
          revenue: 0
        };
      }

      map[id].qty += Number(item.quantity || 0);
      map[id].revenue +=
        Number(item.price || 0) *
        Number(item.quantity || 0);

    });
  });

  return Object.values(map)
    .sort((a,b)=>b.qty-a.qty)
    .slice(0,5);
}

function topCustomers(orderList = validOrders()){

  const map = {};

  orderList.forEach(o => {

    const u = o.user;
    if(!u) return;

    const id = u.userId;

    if(!map[id]){
      map[id] = {
        name: u.fullname || u.email,
        email: u.email || "",
        total: 0,
        orders: 0
      };
    }

    map[id].total += Number(o.finalAmount || 0);
    map[id].orders += 1;

  });

  return Object.values(map)
    .sort((a,b)=>b.total-a.total)
    .slice(0,5);
}
