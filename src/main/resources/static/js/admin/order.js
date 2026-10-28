// Refactored from legacy /js/admin.js. Business logic preserved.
// Loaded as a compatibility classic script by admin/admin.js so existing inline handlers keep working.

function changeOrderSort(value){
  orderSort = value;
  orderLimit = 10;
  render();
}

function changeOrderDate(value){
  orderDate = value;
  orderLimit = 10;
  render();
}

function searchOrderAdmin(value){
  adminSearch.orders = value.toLowerCase();
  orderLimit = 10;

  setTimeout(() => {
    render();

    setTimeout(() => {
      const input = document.querySelector(`input[data-search="orders"]`);
      if(input){
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }, 0);
  }, 0);
}

function showMoreAdminOrders(){
  orderLimit += 10;
  render();
}

function hideLessAdminOrders(){
  orderLimit = Math.max(10, orderLimit - 10);
  render();
}

function changeOrderStatusFilter(status){
  orderStatusFilter = status;
  orderLimit = 10;
  render();
}

function changeOrderPaymentFilter(value){
  orderPaymentFilter = value;
  orderLimit = 10;
  render();
}

function changeOrderDateRange(){
  orderFromDate = document.getElementById("orderFromDate")?.value || "";
  orderToDate = document.getElementById("orderToDate")?.value || "";
  orderLimit = 10;
  render();
}

function orderStatusLabel(status){
  const map = {
    PENDING: "Chờ xác nhận",
    PENDING_PAYMENT: "Chờ thanh toán",
    PAID: "Đang xử lý",
    CONFIRMED: "Đang xử lý",
    SHIPPING: "Đang giao",
    COMPLETED: "Hoàn thành",
    CANCELLED: "Đã hủy"
  };

  return map[status] || status || "Không rõ";
}

function orderStatusBadge(status){
  if(status === "COMPLETED"){
    return "bg-green-100 text-green-700";
  }

  if(status === "SHIPPING"){
    return "bg-blue-100 text-blue-700";
  }

  if(status === "PAID" || status === "CONFIRMED"){
    return "bg-yellow-100 text-yellow-700";
  }

  if(status === "CANCELLED"){
    return "bg-neutral-200 text-neutral-600";
  }

  return "bg-red-100 text-red-700";
}

function getOrderPaymentMethod(o){
  return String(
    o.paymentMethod ||
    o.payment?.paymentMethod ||
    o.payment?.method ||
    ""
  ).toUpperCase();
}

function orderPaymentLabel(o){
  const method = getOrderPaymentMethod(o);

  if(method === "CASH"){
    return "COD";
  }

  if(method === "QR"){
    return "Chuyển khoản";
  }

  return "—";
}

function orderStatusCount(type){
  if(type === "ALL"){
    return orders.length;
  }

  if(type === "PENDING"){
    return orders.filter(o =>
      o.orderStatus === "PENDING" ||
      o.orderStatus === "PENDING_PAYMENT"
    ).length;
  }

  if(type === "PROCESSING"){
    return orders.filter(o =>
      o.orderStatus === "PAID" ||
      o.orderStatus === "CONFIRMED"
    ).length;
  }

  return orders.filter(o => o.orderStatus === type).length;
}

function formatOrderDate(value){
  if(!value) return "—";

  const d = new Date(value);

  if(Number.isNaN(d.getTime())){
    return value;
  }

  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function orderStatusSelect(order){

  const statuses = [
    ["PENDING", "Chờ xác nhận"],
    ["PENDING_PAYMENT", "Chờ thanh toán PayOS"],
    ["PAID", "Đã thanh toán"],
    ["CONFIRMED", "Đã xác nhận"],
    ["SHIPPING", "Đang giao"],
    ["COMPLETED", "Hoàn thành"],
    ["CANCELLED", "Đã hủy"]
  ];

  return `
    <select
      onchange="
        changeOrderStatusFromTable(
          ${Number(order.orderId)},
          this
        )
      "
      data-old-status="${safeOrderText(order.orderStatus || "PENDING")}"
      class="
        min-w-[205px]
        border
        border-neutral-300
        rounded-xl
        bg-white
        px-2
        py-2.5
        text-sm
        font-semibold
        outline-none
        cursor-pointer
        focus:border-red-700
        focus:ring-2
        focus:ring-red-100
      "
    >

      ${statuses.map(([value, label]) => `
        <option
          value="${value}"
          ${order.orderStatus === value ? "selected" : ""}
        >
          ${label}
        </option>
      `).join("")}

    </select>
  `;
}

async function changeOrderStatusFromTable(orderId, select){

  if(!select){
    return;
  }

  const newStatus =
    select.value;

  const oldStatus =
    select.dataset.oldStatus;


  if(newStatus === oldStatus){
    return;
  }


  // khóa select để tránh bấm liên tục
  select.disabled = true;

  select.classList.add(
    "opacity-60",
    "cursor-wait"
  );


  const success =
    await updateOrderStatus(
      orderId,
      newStatus
    );


  if(!success){

    // API lỗi -> trả về trạng thái cũ
    select.value =
      oldStatus;

    select.disabled = false;

    select.classList.remove(
      "opacity-60",
      "cursor-wait"
    );

    return;
  }

  // thành công -> trạng thái mới trở thành old status
  select.dataset.oldStatus =
    newStatus;

  await loadData();

  render();
}

function getOrderStaffName(order){

  return (
    order?.staffName ||
    order?.employeeName ||
    order?.updatedByStaff ||
    order?.updatedBy ||
    order?.updatedByName ||
    order?.staff?.fullname ||
    order?.staff?.fullName ||
    order?.employee?.fullname ||
    order?.employee?.fullName ||
    "—"
  );
}

function getOrderStatusClass(status) {
  switch (status) {
    case "PENDING":
      return "bg-amber-50 text-amber-700 border-amber-300";

    case "PENDING_PAYMENT":
      return "bg-orange-50 text-orange-700 border-orange-300";

    case "PAID":
      return "bg-cyan-50 text-cyan-700 border-cyan-300";

    case "CONFIRMED":
      return "bg-blue-50 text-blue-700 border-blue-300";

    case "SHIPPING":
      return "bg-violet-50 text-violet-700 border-violet-300";

    case "COMPLETED":
      return "bg-green-50 text-green-700 border-green-300";

    case "CANCELLED":
      return "bg-red-50 text-red-700 border-red-300";

    default:
      return "bg-neutral-50 text-neutral-700 border-neutral-300";
  }
}

function orderTable(){

  const keyword = (adminSearch.orders || "")
    .trim()
    .toLowerCase();


  // =========================================================
  // LỌC TÌM KIẾM
  // =========================================================

  let filteredOrders = orders.filter(o => {

    const orderId =
      String(o.orderId || "").toLowerCase();

    const orderCode =
      String(o.orderCode || "").toLowerCase();

    const name =
      String(
        o.user?.fullname ||
        o.customerName ||
        o.receiverName ||
        ""
      ).toLowerCase();

    const email =
      String(
        o.user?.email ||
        o.email ||
        ""
      ).toLowerCase();

    const phone =
      String(
        o.user?.phone ||
        o.phone ||
        o.receiverPhone ||
        ""
      ).toLowerCase();

    const address =
      String(
        o.address ||
        o.shippingAddress ||
        o.receiverAddress ||
        ""
      ).toLowerCase();


    return (
      !keyword ||
      orderId.includes(keyword) ||
      orderCode.includes(keyword) ||
      name.includes(keyword) ||
      email.includes(keyword) ||
      phone.includes(keyword) ||
      address.includes(keyword)
    );

  });


  // =========================================================
  // LỌC TRẠNG THÁI
  // =========================================================

  if(orderStatusFilter !== "ALL"){

    if(orderStatusFilter === "PENDING"){

      filteredOrders = filteredOrders.filter(o =>
        o.orderStatus === "PENDING" ||
        o.orderStatus === "PENDING_PAYMENT"
      );

    }

    else if(orderStatusFilter === "PROCESSING"){

      filteredOrders = filteredOrders.filter(o =>
        o.orderStatus === "PAID" ||
        o.orderStatus === "CONFIRMED"
      );

    }

    else{

      filteredOrders = filteredOrders.filter(
        o => o.orderStatus === orderStatusFilter
      );

    }

  }


  // =========================================================
  // LỌC THANH TOÁN
  // =========================================================

  if(orderPaymentFilter !== "ALL"){

    filteredOrders = filteredOrders.filter(o =>

      String(
        getOrderPaymentMethod(o)
      ).toUpperCase() === orderPaymentFilter

    );

  }


  // =========================================================
  // LỌC TỪ NGÀY
  // =========================================================

  if(orderFromDate){

    filteredOrders = filteredOrders.filter(o => {

      if(!o.createdAt){
        return false;
      }

      const date =
        new Date(o.createdAt);

      if(Number.isNaN(date.getTime())){
        return false;
      }

      const day =
        [
          date.getFullYear(),
          String(date.getMonth() + 1).padStart(2, "0"),
          String(date.getDate()).padStart(2, "0")
        ].join("-");

      return day >= orderFromDate;

    });

  }


  // =========================================================
  // LỌC ĐẾN NGÀY
  // =========================================================

  if(orderToDate){

    filteredOrders = filteredOrders.filter(o => {

      if(!o.createdAt){
        return false;
      }

      const date =
        new Date(o.createdAt);

      if(Number.isNaN(date.getTime())){
        return false;
      }

      const day =
        [
          date.getFullYear(),
          String(date.getMonth() + 1).padStart(2, "0"),
          String(date.getDate()).padStart(2, "0")
        ].join("-");

      return day <= orderToDate;

    });

  }


  // =========================================================
  // SẮP XẾP
  // =========================================================

  filteredOrders.sort((a, b) =>
    new Date(b.createdAt || 0) -
    new Date(a.createdAt || 0)
  );


  const list =
    filteredOrders.slice(0, orderLimit);


  // =========================================================
  // TAB
  // =========================================================

  const tabs = [

    {
      key: "ALL",
      label: "Tất cả",
      count: orderStatusCount("ALL")
    },

    {
      key: "PENDING",
      label: "Chờ xác nhận",
      count: orderStatusCount("PENDING")
    },

    {
      key: "PROCESSING",
      label: "Đang xử lý",
      count: orderStatusCount("PROCESSING")
    },

    {
      key: "SHIPPING",
      label: "Đang giao",
      count: orderStatusCount("SHIPPING")
    },

    {
      key: "COMPLETED",
      label: "Hoàn thành",
      count: orderStatusCount("COMPLETED")
    },

    {
      key: "CANCELLED",
      label: "Đã hủy",
      count: orderStatusCount("CANCELLED")
    }

  ];


  return `

    <div class="space-y-4">


      <!-- ===================================================
           TAB TRẠNG THÁI
      ==================================================== -->

      <div
        class="
          bg-white
          border
          border-neutral-200
          rounded-2xl
          p-3
          grid
          grid-cols-2
          md:grid-cols-3
          xl:grid-cols-6
          gap-3
        "
      >

        ${tabs.map(tab => `

          <button
            type="button"
            onclick="changeOrderStatusFilter('${tab.key}')"
            class="
              min-h-[48px]
              rounded-full
              px-5
              font-semibold
              transition

              ${
                orderStatusFilter === tab.key
                  ? "bg-red-800 text-white shadow"
                  : "bg-white border border-neutral-200 text-neutral-700 hover:border-red-300"
              }
            "
          >

            ${tab.label} (${tab.count})

          </button>

        `).join("")}

      </div>



      <!-- ===================================================
           BẢNG
      ==================================================== -->

      <div
        class="
          bg-white
          border
          border-neutral-200
          rounded-2xl
          overflow-hidden
        "
      >


        <!-- =================================================
             TOOLBAR
        ================================================== -->

        <div
          class="
            p-4
            border-b
            border-neutral-200
            flex
            flex-col
            xl:flex-row
            xl:items-center
            gap-3
          "
        >


          <!-- SEARCH -->

          <div
            class="
              relative
              flex-1
              min-w-[260px]
            "
          >

            <span
              class="
                absolute
                left-4
                top-1/2
                -translate-y-1/2
                text-neutral-400
              "
            >
              ${icon("search", "w-5 h-5")}
            </span>


            <input
              data-search="orders"
              value="${escapeHtml(adminSearch.orders || "")}"
              oninput="searchOrderAdmin(this.value)"
              class="
                w-full
                h-12
                border
                border-neutral-200
                rounded-xl
                pl-12
                pr-4
                outline-none
                focus:border-red-700
              "
              placeholder="Tìm kiếm theo mã đơn hàng, tên khách hàng, SĐT..."
            >

          </div>


          <!-- DATE -->

          <div
            class="
              flex
              items-center
              gap-2
              border
              border-neutral-200
              rounded-xl
              px-3
              h-12
            "
          >

            ${icon(
              "calendar-days",
              "w-5 h-5 text-neutral-500"
            )}


            <input
              id="orderFromDate"
              type="date"
              value="${orderFromDate}"
              onchange="changeOrderDateRange()"
              class="
                outline-none
                bg-transparent
                text-sm
              "
            >


            <span class="text-neutral-400">
              -
            </span>


            <input
              id="orderToDate"
              type="date"
              value="${orderToDate}"
              onchange="changeOrderDateRange()"
              class="
                outline-none
                bg-transparent
                text-sm
              "
            >

          </div>


          <!-- PAYMENT -->

          <select
            onchange="changeOrderPaymentFilter(this.value)"
            class="
              h-12
              border
              border-neutral-200
              rounded-xl
              px-2
              outline-none
              bg-white
              min-w-[210px]
            "
          >

            <option
              value="ALL"
              ${orderPaymentFilter === "ALL" ? "selected" : ""}
            >
              Phương thức thanh toán
            </option>


            <option
              value="CASH"
              ${orderPaymentFilter === "CASH" ? "selected" : ""}
            >
              COD
            </option>


            <option
              value="QR"
              ${orderPaymentFilter === "QR" ? "selected" : ""}
            >
              Chuyển khoản
            </option>

          </select>


          <!-- EXCEL -->

          <button
            type="button"
            onclick="exportShippingExcel()"
            class="
              h-12
              px-5
              rounded-xl
              border
              border-green-600
              text-green-700
              font-bold
              flex
              items-center
              justify-center
              gap-2
              whitespace-nowrap
              hover:bg-green-50
              transition
            "
          >

            ${icon("sheet", "w-5 h-5")}

            Xuất Excel

          </button>

        </div>



        <!-- =================================================
             TABLE
        ================================================== -->

        <div class="overflow-x-auto">

          <table
            class="
              w-full
              table-fixed
              text-left
            "
          >


            <!-- HEADER -->

            <thead
              class="
                bg-neutral-50
                text-[13px]
                text-neutral-600
              "
            >

              <tr>

                <th class="w-[4%] px-2 py-4">
                  #
                </th>

                <th class="w-[11%] px-2 py-4">
                  Mã đơn
                </th>

                <th class="w-[11%] px-2 py-4">
                  Khách hàng
                </th>

                <th class="w-[10%] px-2 py-4">
                  SĐT
                </th>

                <th class="w-[9%] px-2 py-4">
                  Tổng tiền
                </th>

                <th class="w-[12%] px-2 py-4">
                  Trạng thái
                </th>

                <th class="w-[10%] px-2 py-4">
                  Nhân viên
                </th>

                <th class="w-[11%] px-2 py-4">
                  Thanh toán
                </th>

                <th class="w-[12%] px-2 py-4">
                  Ngày đặt
                </th>

                <th class="w-[7%] px-2 py-4 text-center">
                  Xem
                </th>

              </tr>

            </thead>
            <!-- BODY -->

            <tbody>

              ${
                list.length

                ? list.map((o, index) => {


                    const customerName =
                      o.user?.fullname ||
                      o.customerName ||
                      o.receiverName ||
                      "Khách hàng";


                    const phone =
                      o.user?.phone ||
                      o.phone ||
                      o.receiverPhone ||
                      "—";


                    const staffName =
                      o.staffName ||
                      o.employeeName ||
                      o.updatedByStaff ||
                      o.updatedBy ||
                      o.updatedByName ||
                      o.staff?.fullname ||
                      o.staff?.fullName ||
                      o.employee?.fullname ||
                      o.employee?.fullName ||
                      "—";


                    return `

                      <tr
                        class="
                          border-t
                          border-neutral-100
                          hover:bg-neutral-50/70
                        "
                      >


                        <!-- STT -->

                        <td
                          class="
                            px-5
                            py-4
                            text-neutral-500
                          "
                        >
                          ${index + 1}
                        </td>


                        <!-- MÃ ĐƠN -->

                        <td
                          class="
                            px-2
                            py-4
                            font-bold
                            whitespace-nowrap
                          "
                        >

                          ${
                            escapeHtml(
                              o.orderCode ||
                              `#JODOK${o.orderId}`
                            )
                          }

                        </td>


                        <!-- KHÁCH -->

                        <td
                          class="
                            px-2
                            py-4
                            font-medium
                            whitespace-nowrap
                          "
                        >

                          ${escapeHtml(customerName)}

                        </td>


                        <!-- PHONE -->

                        <td
                          class="
                            px-2
                            py-4
                            text-neutral-600
                            whitespace-nowrap
                          "
                        >

                          ${escapeHtml(phone)}

                        </td>


                        <!-- TOTAL -->

                        <td
                          class="
                            px-2
                            py-4
                            font-semibold
                            whitespace-nowrap
                          "
                        >

                          ${money(
                            o.finalAmount ??
                            o.totalAmount ??
                            0
                          )}

                        </td>


                        <!-- =================================
                             TRẠNG THÁI - CHỈNH TRỰC TIẾP
                        ================================== -->
                        <td class="px-2 py-4 whitespace-nowrap">
                          <div class="relative inline-flex items-center">

                            <select
                              data-old-status="${escapeHtml(o.orderStatus || "PENDING")}"

                              onchange="
                                this.className =
                                  'appearance-none h-10 w-[125px] rounded-lg pl-3 pr-6 text-[13px] font-medium outline-none cursor-pointer border transition-colors ' +
                                  getOrderStatusClass(this.value);

                                changeOrderStatusFromTable(
                                  ${Number(o.orderId)},
                                  this
                                );
                              "

                              class="
                                appearance-none
                                h-10
                                w-[125px]
                                rounded-lg
                                pl-3
                                pr-6
                                text-[13px]
                                font-medium
                                outline-none
                                cursor-pointer
                                border
                                transition-colors
                                ${getOrderStatusClass(o.orderStatus || "PENDING")}
                              "
                            >

                              <option
                                value="PENDING"
                                ${o.orderStatus === "PENDING" ? "selected" : ""}
                              >
                                Chờ xác nhận
                              </option>

                              <option
                                value="PENDING_PAYMENT"
                                ${o.orderStatus === "PENDING_PAYMENT" ? "selected" : ""}
                              >
                                Chờ thanh toán
                              </option>

                              <option
                                value="PAID"
                                ${o.orderStatus === "PAID" ? "selected" : ""}
                              >
                                Đã thanh toán
                              </option>

                              <option
                                value="CONFIRMED"
                                ${o.orderStatus === "CONFIRMED" ? "selected" : ""}
                              >
                                Đã xác nhận
                              </option>

                              <option
                                value="SHIPPING"
                                ${o.orderStatus === "SHIPPING" ? "selected" : ""}
                              >
                                Đang giao
                              </option>

                              <option
                                value="COMPLETED"
                                ${o.orderStatus === "COMPLETED" ? "selected" : ""}
                              >
                                Hoàn thành
                              </option>

                              <option
                                value="CANCELLED"
                                ${o.orderStatus === "CANCELLED" ? "selected" : ""}
                              >
                                Đã hủy
                              </option>

                            </select>

                            <span
                              class="
                                pointer-events-none
                                absolute
                                right-1.5
                                top-1/2
                                -translate-y-1/2
                                text-current
                                flex
                                items-center
                              "
                            >
                              ${icon("chevron-down", "w-3 h-3")}
                            </span>

                          </div>
                        </td>
                        <!-- =================================
                             NHÂN VIÊN
                        ================================== -->

                        <td
                          class="
                            px-2
                            py-4
                            whitespace-nowrap
                          "
                        >

                          <div
                            class="
                              flex
                              items-center
                              gap-2
                            "
                          >

                            <span
                              class="
                                w-8
                                h-8
                                rounded-full
                                bg-neutral-100
                                flex
                                items-center
                                justify-center
                                text-neutral-500
                                shrink-0
                              "
                            >

                              ${icon("user", "w-4 h-4")}

                            </span>


                            <span class="font-medium">

                              ${escapeHtml(staffName)}

                            </span>

                          </div>

                        </td>


                        <!-- PAYMENT -->

                        <td
                          class="
                            px-2
                            py-4
                            text-neutral-600
                            whitespace-nowrap
                          "
                        >

                          ${orderPaymentLabel(o)}

                        </td>


                        <!-- DATE -->

                        <td
                          class="
                            px-2
                            py-4
                            text-neutral-600
                            whitespace-nowrap
                          "
                        >

                          ${formatOrderDate(o.createdAt)}

                        </td>


                        <!-- ACTION -->
                        <td class="px-2 py-4 text-center">

                          <button
                            type="button"
                            onclick="openOrderDetail(${Number(o.orderId)})"
                            title="Xem chi tiết đơn hàng"
                            class="
                              inline-flex
                              w-9
                              h-9
                              items-center
                              justify-center
                              border
                              border-neutral-200
                              rounded-lg
                              text-neutral-600
                              hover:bg-red-50
                              hover:border-red-200
                              hover:text-red-800
                              transition
                            "
                          >
                            ${icon("eye", "w-4 h-4")}
                          </button>

                        </td>
                      </tr>
                    `;

                  }).join("")

                : `

                  <tr>

                    <td
                      colspan="10"
                      class="
                        px-6
                        py-14
                        text-center
                        text-neutral-400
                      "
                    >

                      Không tìm thấy đơn hàng

                    </td>

                  </tr>

                `
              }

            </tbody>

          </table>

        </div>



        <!-- =================================================
             FOOTER
        ================================================== -->

        <div
          class="
            px-5
            py-4
            border-t
            border-neutral-100
            flex
            flex-col
            sm:flex-row
            sm:items-center
            sm:justify-between
            gap-4
          "
        >

          <p class="text-sm text-neutral-500">

            Hiển thị

            <b>
              ${filteredOrders.length ? 1 : 0}
              -
              ${Math.min(
                orderLimit,
                filteredOrders.length
              )}
            </b>

            của

            <b>
              ${filteredOrders.length}
            </b>

            đơn hàng

          </p>


          <div
            class="
              flex
              items-center
              gap-2
            "
          >

            ${
              orderLimit > 10

              ? `

                <button
                  type="button"
                  onclick="hideLessAdminOrders()"
                  class="
                    border
                    rounded-lg
                    px-2
                    py-2
                    text-sm
                    font-semibold
                    hover:bg-neutral-50
                  "
                >
                  Thu gọn
                </button>

              `

              : ""
            }


            ${
              orderLimit < filteredOrders.length

              ? `

                <button
                  type="button"
                  onclick="showMoreAdminOrders()"
                  class="
                    border
                    rounded-lg
                    px-2
                    py-2
                    text-sm
                    font-semibold
                    hover:bg-neutral-50
                  "
                >
                  Xem thêm
                </button>

              `

              : ""
            }

          </div>

        </div>

      </div>

    </div>

  `;

}

function orderDetailModal(){
  return `<div id="orderModal" class="fixed inset-0 bg-black/40 z-[999] hidden items-center justify-center p-5">
    <div class="bg-white rounded-3xl p-7 w-full max-w-3xl shadow-xl max-h-[90vh] overflow-y-auto">
      <div class="flex justify-between items-center mb-5">
        <h2 class="serif text-3xl">Chi tiết đơn hàng</h2>
        <button onclick="closeOrderDetail()" class="text-2xl">×</button>
      </div>
      <div id="orderDetailContent"></div>
    </div>
  </div>`;
}

function safeOrderText(value){
  if(value === null || value === undefined){
    return "";
  }

  if(typeof escapeHtml === "function"){
    return escapeHtml(String(value));
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getOrderReceiverName(order){
  return (
    order?.receiverName ||
    order?.customerName ||
    order?.shippingName ||
    order?.user?.fullname ||
    order?.user?.fullName ||
    order?.user?.email ||
    "Khách hàng"
  );
}

function getOrderReceiverPhone(order){
  return (
    order?.receiverPhone ||
    order?.phone ||
    order?.shippingPhone ||
    order?.user?.phone ||
    ""
  );
}

function getOrderReceiverEmail(order){
  return (
    order?.email ||
    order?.user?.email ||
    ""
  );
}

function getOrderAddress(order) {

  let address =
    order?.shippingAddress ||
    order?.address ||
    order?.deliveryAddress ||
    order?.receiverAddress ||
    "";

  address = String(address || "").trim();

  if (!address) {
    return "—";
  }
  const parts = address
    .split("|")
    .map(item => item.trim())
    .filter(Boolean);

  if (parts.length >= 3) {
    return parts.slice(2).join(" | ");
  }

  return address;
}

function getOrderCode(order){
  if(order?.orderCode){
    return order.orderCode;
  }

  return "JODOK" + String(order?.orderId || "").padStart(6, "0");
}

function getOrderTotal(order){
  return Number(
    order?.finalAmount ??
    order?.totalAmount ??
    0
  );
}

function getOrderShippingFee(order) {

  // 1. Nếu backend đã trả riêng phí ship thì ưu tiên dùng
  const backendShippingFee =
    order?.shippingFee ??
    order?.shipFee ??
    order?.deliveryFee ??
    order?.shippingCost ??
    order?.feeShip;

  if (
    backendShippingFee !== undefined &&
    backendShippingFee !== null &&
    backendShippingFee !== ""
  ) {
    const fee = Number(backendShippingFee);

    if (Number.isFinite(fee)) {
      return Math.max(0, fee);
    }
  }


  // 2. Nếu API không trả phí ship riêng:
  // tính tổng tiền hàng từ items
  const items =
    Array.isArray(order?.items)
      ? order.items
      : [];

  const productTotal =
    items.reduce((sum, item) => {

      const qty =
        getOrderItemQuantity(item);

      const price =
        getOrderItemPrice(item);

      return sum + (price * qty);

    }, 0);


  // 3. Tổng tiền khách phải thanh toán
  const finalTotal =
    getOrderTotal(order);


  // 4. Phí ship = tổng thanh toán - tiền hàng
  const shippingFee =
    finalTotal - productTotal;


  return Math.max(0, shippingFee);
}

function getOrderItemQuantity(item){
  return Number(
    item?.quantity ??
    item?.qty ??
    0
  );
}

function getOrderItemPrice(item){
  return Number(
    item?.price ??
    item?.unitPrice ??
    item?.variant?.price ??
    0
  );
}

function getOrderItemVariant(item){
  const size =
    item?.variant?.size?.sizeName ||
    item?.variant?.size ||
    item?.size ||
    "";

  const color =
    item?.variant?.color?.colorName ||
    item?.variant?.color ||
    item?.color ||
    "";

  return [size, color]
    .filter(Boolean)
    .join(" / ");
}

function getOrderProductsText(order){
  const items = Array.isArray(order?.items)
    ? order.items
    : [];

  if(!items.length){
    return "";
  }

  return items
    .map(item => {
      const name = getOrderItemName(item);
      const variant = getOrderItemVariant(item);
      const quantity = getOrderItemQuantity(item);

      return `${name}${variant ? " (" + variant + ")" : ""} x${quantity}`;
    })
    .join("; ");
}

function getOrderTotalQuantity(order){
  return (order?.items || [])
    .reduce(
      (sum, item) =>
        sum + getOrderItemQuantity(item),
      0
    );
}

function orderDetailStatusLabel(status){
  const map = {
    PENDING: "Chờ xác nhận",
    PENDING_PAYMENT: "Chờ thanh toán",
    PAID: "Đã thanh toán",
    CONFIRMED: "Đã xác nhận",
    SHIPPING: "Đang giao",
    COMPLETED: "Hoàn thành",
    CANCELLED: "Đã hủy"
  };

  return map[status] || status || "Không rõ";
}

function closeOrderDetail(){
  const modal =
    document.getElementById("orderDetailModalDynamic");

  if(modal){
    modal.remove();
  }

  document.body.style.overflow = "";
}

function getOrderItemProduct(item){

  const productId =
    item?.variant?.product?.productId ??
    item?.variant?.productId ??
    item?.product?.productId ??
    item?.productId ??
    item?.variant?.product_id ??
    item?.product_id;

  // Ưu tiên product đầy đủ đã load ở admin
  if(productId){

    const fullProduct = products.find(
      p => Number(p.productId) === Number(productId)
    );

    if(fullProduct){
      return fullProduct;
    }
  }

  // API order detail có trả product đầy đủ
  if(item?.variant?.product){
    return item.variant.product;
  }

  if(item?.product){
    return item.product;
  }

  return null;
}

function getOrderItemImage(item){

  const product =
    getOrderItemProduct(item);

  if(product){
    const src = productImg(product, 0);

    if(src){
      return src;
    }
  }


  // fallback nếu DTO order trả ảnh trực tiếp
  return (
    item?.imageUrl ||
    item?.productImage ||
    item?.variant?.imageUrl ||
    "/images/no-image.png"
  );
}

function getOrderItemName(item){

  const product =
    getOrderItemProduct(item);

  return (
    product?.productName ||
    item?.variant?.product?.productName ||
    item?.product?.productName ||
    item?.productName ||
    item?.name ||
    "Sản phẩm"
  );
}

async function openOrderDetail(orderId){

  const id = Number(orderId);

  if(!id){
    showToast(
      "Lỗi",
      "Mã đơn hàng không hợp lệ",
      "error"
    );
    return;
  }

  closeOrderDetail();

  try{

    const res = await fetch(
      `${API_BASE}/orders/${id}`,
      {
        method: "GET",
        headers: adminAuthHeaders()
      }
    );

    let order = null;

    try{
      order = await res.json();
    }catch(e){
      order = null;
    }

    if(!res.ok){

      const message =
        order?.message ||
        (
          res.status === 401
            ? "Phiên đăng nhập đã hết hạn"
            : res.status === 403
              ? "Tài khoản không có quyền xem đơn hàng"
              : "Không tải được chi tiết đơn hàng"
        );

      showToast(
        "Lỗi",
        message,
        "error"
      );

      return;
    }

    if(!order){
      showToast(
        "Lỗi",
        "API không trả về dữ liệu đơn hàng",
        "error"
      );
      return;
    }

    const items =
      Array.isArray(order.items)
        ? order.items
        : [];

    const modal =
      document.createElement("div");

    modal.id =
      "orderDetailModalDynamic";

    modal.className = `
      fixed
      inset-0
      z-[99999]
      bg-black/50
      flex
      items-center
      justify-center
      p-3
    `;

    modal.onclick = function(event){
      if(event.target === modal){
        closeOrderDetail();
      }
    };


    modal.innerHTML = `

      <div
        class="
          bg-white
          w-full
          max-w-5xl
          max-h-[96vh]
          rounded-2xl
          shadow-2xl
          overflow-hidden
          flex
          flex-col
        "
        onclick="event.stopPropagation()"
      >

        <!-- =================================================
             HEADER GỌN
        ================================================== -->

        <div
          class="
            shrink-0
            bg-white
            border-b
            px-5
            py-3
            flex
            items-center
            justify-between
            gap-4
          "
        >

          <div>

            <p
              class="
                text-xs
                text-red-800
                font-bold
                uppercase
                tracking-wider
              "
            >
              Chi tiết đơn hàng
            </p>

            <h2
              class="
                text-xl
                font-bold
                mt-0.5
              "
            >
              ${safeOrderText(getOrderCode(order))}
            </h2>

          </div>


          <button
            type="button"
            onclick="closeOrderDetail()"
            class="
              w-9
              h-9
              rounded-full
              border
              flex
              items-center
              justify-center
              hover:bg-neutral-100
              shrink-0
            "
          >
            ${icon("x", "w-4 h-4")}
          </button>

        </div>


        <!-- =================================================
             NỘI DUNG
        ================================================== -->

              <div
                class="
                  px-5
                  py-3
                  space-y-3
                  overflow-y-auto
                  min-h-0
                "
              >

          <!-- =================================================
               NGƯỜI NHẬN - 4 THÔNG TIN CÙNG HÀNG
          ================================================== -->

          <div
            class="
              border
              border-neutral-200
              rounded-xl
              px-4
              py-3
            "
          >

            <div
              class="
                flex
                items-center
                gap-2
                mb-2
              "
            >
              ${icon("user-round", "w-4 h-4")}

              <h3 class="font-bold text-base">
                Thông tin người nhận
              </h3>
            </div>


            <div
              class="
                grid
                grid-cols-2
                lg:grid-cols-4
                gap-x-5
                gap-y-2
              "
            >

              <div class="min-w-0">

                <p
                  class="
                    text-[11px]
                    text-neutral-500
                  "
                >
                  Họ và tên
                </p>

                <p
                  class="
                    font-semibold
                    text-sm
                    truncate
                  "
                  title="${safeOrderText(getOrderReceiverName(order))}"
                >
                  ${safeOrderText(getOrderReceiverName(order))}
                </p>

              </div>


              <div class="min-w-0">

                <p
                  class="
                    text-[11px]
                    text-neutral-500
                  "
                >
                  Số điện thoại
                </p>

                <p class="font-semibold text-sm">
                  ${safeOrderText(getOrderReceiverPhone(order) || "—")}
                </p>

              </div>


              <div class="min-w-0">

                <p
                  class="
                    text-[11px]
                    text-neutral-500
                  "
                >
                  Email
                </p>

                <p
                  class="
                    font-semibold
                    text-sm
                    truncate
                  "
                  title="${safeOrderText(getOrderReceiverEmail(order) || "—")}"
                >
                  ${safeOrderText(getOrderReceiverEmail(order) || "—")}
                </p>

              </div>


              <div class="min-w-0">

                <p
                  class="
                    text-[11px]
                    text-neutral-500
                  "
                >
                  Địa chỉ giao hàng
                </p>

                <p
                  class="
                    font-semibold
                    text-sm
                    truncate
                  "
                  title="${safeOrderText(getOrderAddress(order) || "—")}"
                >
                  ${safeOrderText(getOrderAddress(order) || "—")}
                </p>

              </div>

            </div>

          </div>


          <!-- =================================================
               TRẠNG THÁI - CHỈ 1 HÀNG
          ================================================== -->

          <div
            class="
              border
              border-red-100
              bg-red-50/30
              rounded-xl
              px-4
              py-2.5
            "
          >

            <div
              class="
                flex
                flex-col
                md:flex-row
                md:items-center
                gap-2
              "
            >

              <div
                class="
                  flex
                  items-center
                  gap-2
                  shrink-0
                "
              >
                <span
                  class="
                    text-sm
                    font-bold
                    whitespace-nowrap
                  "
                >
                  Trạng thái:
                </span>

                <span
                  class="
                    text-xs
                    text-neutral-500
                    whitespace-nowrap
                  "
                >
                  Hiện tại:
                  <b class="text-neutral-800">
                    ${
                      safeOrderText(
                        orderDetailStatusLabel(
                          order.orderStatus
                        )
                      )
                    }
                  </b>
                </span>

              </div>


              <div class="flex-1 min-w-0">

                <select
                  id="orderDetailStatus"
                  class="
                    w-full
                    h-10
                    border
                    border-neutral-300
                    rounded-lg
                    px-3
                    bg-white
                    outline-none
                    text-sm
                    focus:border-red-700
                  "
                >

                  <option
                    value="PENDING"
                    ${
                      order.orderStatus === "PENDING"
                        ? "selected"
                        : ""
                    }
                  >
                    Chờ xác nhận
                  </option>

                  <option
                    value="PENDING_PAYMENT"
                    ${
                      order.orderStatus === "PENDING_PAYMENT"
                        ? "selected"
                        : ""
                    }
                  >
                    Chờ thanh toán
                  </option>

                  <option
                    value="PAID"
                    ${
                      order.orderStatus === "PAID"
                        ? "selected"
                        : ""
                    }
                  >
                    Đã thanh toán
                  </option>

                  <option
                    value="CONFIRMED"
                    ${
                      order.orderStatus === "CONFIRMED"
                        ? "selected"
                        : ""
                    }
                  >
                    Đã xác nhận / Đang xử lý
                  </option>

                  <option
                    value="SHIPPING"
                    ${
                      order.orderStatus === "SHIPPING"
                        ? "selected"
                        : ""
                    }
                  >
                    Đang giao
                  </option>

                  <option
                    value="COMPLETED"
                    ${
                      order.orderStatus === "COMPLETED"
                        ? "selected"
                        : ""
                    }
                  >
                    Hoàn thành
                  </option>

                  <option
                    value="CANCELLED"
                    ${
                      order.orderStatus === "CANCELLED"
                        ? "selected"
                        : ""
                    }
                  >
                    Đã hủy
                  </option>

                </select>

              </div>


              <button
                id="saveOrderStatusBtn"
                type="button"
                onclick="saveOrderStatusFromDetail(${Number(order.orderId)})"
                class="
                  h-10
                  px-5
                  rounded-lg
                  bg-red-800
                  hover:bg-red-900
                  text-white
                  text-sm
                  font-bold
                  inline-flex
                  items-center
                  justify-center
                  gap-2
                  whitespace-nowrap
                  shrink-0
                "
              >
                ${icon("save", "w-4 h-4")}
                Cập nhật trạng thái
              </button>

            </div>

          </div>


          <!-- =================================================
               SẢN PHẨM
          ================================================== -->

          <div>

            <div
              class="
                flex
                items-center
                justify-between
                mb-2
              "
            >

              <h3
                class="
                  font-bold
                  text-lg
                "
              >
                Sản phẩm trong đơn
              </h3>

              <span
                class="
                  text-xs
                  text-neutral-500
                "
              >
                ${items.length} sản phẩm
              </span>

            </div>


            <div
              class="
                border
                border-neutral-200
                rounded-xl
                overflow-hidden
              "
            >

              <!-- Header sản phẩm -->

              <div
                class="
                  hidden
                  md:grid
                  grid-cols-[minmax(0,2.4fr)_1fr_55px_110px_110px]
                  gap-3
                  bg-neutral-50
                  border-b
                  px-3
                  py-2
                  text-xs
                  font-semibold
                  text-neutral-600
                "
              >

                <div>Sản phẩm</div>

                <div>Phân loại</div>

                <div class="text-center">
                  SL
                </div>

                <div class="text-right">
                  Đơn giá
                </div>

                <div class="text-right">
                  Thành tiền
                </div>

              </div>


              <!--
                Chỉ khu vực sản phẩm cuộn khi đơn có nhiều SP.
                1-3 sản phẩm sẽ nhìn thấy ngay.
              -->

              <div
                class="
                  max-h-[230px]
                  overflow-y-auto
                  divide-y
                  divide-neutral-100
                "
              >

                ${
                  items.length

                    ? items.map(item => {

                        const qty =
                          getOrderItemQuantity(item);

                        const price =
                          getOrderItemPrice(item);

                        const variant =
                          getOrderItemVariant(item);

                        const image =
                          getOrderItemImage(item);

                        const name =
                          getOrderItemName(item);


                        return `

                          <div
                            class="
                              grid
                              grid-cols-1
                              md:grid-cols-[minmax(0,2.4fr)_1fr_55px_110px_110px]
                              md:items-center
                              gap-2
                              md:gap-3
                              px-3
                              py-2
                            "
                          >

                            <!-- SẢN PHẨM -->

                            <div
                              class="
                                flex
                                items-center
                                gap-3
                                min-w-0
                              "
                            >

                              <img
                                src="${safeOrderText(image)}"
                                alt="${safeOrderText(name)}"
                                onerror="this.src='/images/no-image.png'"
                                class="
                                  w-11
                                  h-12
                                  rounded-lg
                                  object-cover
                                  border
                                  border-neutral-200
                                  shrink-0
                                "
                              >


                              <div class="min-w-0">

                                <p
                                  class="
                                    font-semibold
                                    text-sm
                                    truncate
                                  "
                                  title="${safeOrderText(name)}"
                                >
                                  ${safeOrderText(name)}
                                </p>

                                ${
                                  variant

                                    ? `
                                      <p
                                        class="
                                          md:hidden
                                          text-xs
                                          text-neutral-500
                                          mt-0.5
                                        "
                                      >
                                        ${safeOrderText(variant)}
                                      </p>
                                    `

                                    : ""
                                }

                              </div>

                            </div>


                            <!-- PHÂN LOẠI -->

                            <div
                              class="
                                hidden
                                md:block
                                text-sm
                                text-neutral-600
                                truncate
                              "
                              title="${safeOrderText(variant || "—")}"
                            >
                              ${safeOrderText(variant || "—")}
                            </div>


                            <!-- SỐ LƯỢNG -->

                            <div
                              class="
                                hidden
                                md:block
                                text-sm
                                text-center
                              "
                            >
                              ${qty}
                            </div>


                            <!-- ĐƠN GIÁ -->

                            <div
                              class="
                                hidden
                                md:block
                                text-sm
                                text-right
                              "
                            >
                              ${money(price)}
                            </div>


                            <!-- THÀNH TIỀN -->

                            <div
                              class="
                                hidden
                                md:block
                                text-sm
                                font-bold
                                text-right
                              "
                            >
                              ${money(price * qty)}
                            </div>


                            <!-- MOBILE -->

                            <div
                              class="
                                md:hidden
                                flex
                                items-center
                                justify-between
                                text-xs
                                text-neutral-600
                              "
                            >

                              <span>
                                SL: ${qty}
                              </span>

                              <span>
                                ${money(price)} × ${qty}
                              </span>

                              <b class="text-neutral-900">
                                ${money(price * qty)}
                              </b>

                            </div>

                          </div>

                        `;

                      }).join("")

                    : `

                      <div
                        class="
                          px-4
                          py-6
                          text-center
                          text-sm
                          text-neutral-400
                        "
                      >
                        Đơn hàng chưa có sản phẩm
                      </div>

                    `
                }

              </div>

            </div>

          </div>
          <!-- =================================================
              TỔNG KẾT ĐƠN HÀNG
          ================================================== -->

          <div
            class="
              border-t
              pt-3
              flex
              items-start
              justify-between
              gap-5
            "
          >

            <!-- TỔNG SỐ LƯỢNG -->

            <div
              class="
                text-sm
                text-neutral-500
                pt-1
              "
            >
              Tổng số lượng:

              <b class="text-neutral-900">
                ${getOrderTotalQuantity(order)}
              </b>
            </div>


            <!-- CHI TIẾT THANH TOÁN -->

            <div
              class="
                ml-auto
                w-[280px]
                space-y-1.5
              "
            >

              <!-- TIỀN HÀNG -->

              <div
                class="
                  flex
                  items-center
                  justify-between
                  gap-6
                  text-sm
                "
              >

                <span class="text-neutral-500">
                  Tiền hàng
                </span>

                <span class="font-semibold text-neutral-800">
                  ${
                    money(
                      Math.max(
                        0,
                        getOrderTotal(order) -
                        getOrderShippingFee(order)
                      )
                    )
                  }
                </span>

              </div>


              <!-- PHÍ SHIP -->

              <div
                class="
                  flex
                  items-center
                  justify-between
                  gap-6
                  text-sm
                "
              >

                <span
                  class="
                    text-neutral-500
                    flex
                    items-center
                    gap-1.5
                  "
                >
                  ${icon("truck", "w-4 h-4")}

                  Phí vận chuyển
                </span>

                <span class="font-semibold text-neutral-800">
                  ${money(getOrderShippingFee(order))}
                </span>

              </div>


              <!-- ĐƯỜNG KẺ -->

              <div class="border-t my-2"></div>


              <!-- TỔNG THANH TOÁN -->

              <div
                class="
                  flex
                  items-center
                  justify-between
                  gap-6
                "
              >

                <span class="font-semibold text-neutral-700">
                  Tổng thanh toán
                </span>

                <strong
                  class="
                    text-lg
                    text-red-800
                  "
                >
                  ${money(getOrderTotal(order))}
                </strong>

              </div>

            </div>

          </div>

        </div>

      </div>

    `;


    document.body.appendChild(modal);

    document.body.style.overflow =
      "hidden";


    if(
      window.lucide &&
      typeof lucide.createIcons === "function"
    ){
      lucide.createIcons();
    }


  }catch(error){

    console.error(
      "OPEN ORDER DETAIL ERROR:",
      error
    );

    showToast(
      "Lỗi",
      error?.message ||
      "Không thể mở chi tiết đơn hàng",
      "error"
    );

  }

}

async function updateOrderStatus(orderId, status){

  const id =
    Number(orderId);

  const newStatus =
    String(status || "")
      .trim()
      .toUpperCase();


  if(!id){

    showToast(
      "Lỗi",
      "Mã đơn hàng không hợp lệ",
      "error"
    );

    return false;

  }


  const allowedStatuses = [
    "PENDING",
    "PENDING_PAYMENT",
    "PAID",
    "CONFIRMED",
    "SHIPPING",
    "COMPLETED",
    "CANCELLED"
  ];


  if(!allowedStatuses.includes(newStatus)){

    showToast(
      "Lỗi",
      "Trạng thái đơn hàng không hợp lệ",
      "error"
    );

    return false;

  }


  try{

    const res = await fetch(
      `${API_BASE}/orders/${id}/status?status=${encodeURIComponent(newStatus)}`,
      {
        method: "PUT",
        headers: adminAuthHeaders()
      }
    );


    let data = {};

    try{
      data = await res.json();
    }catch(e){
      data = {};
    }


    if(!res.ok){

      let message =
        data?.message ||
        "Cập nhật trạng thái thất bại";


      if(res.status === 401){
        message =
          "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
      }


      if(res.status === 403){
        message =
          data?.message ||
          "Tài khoản hiện tại không có quyền cập nhật đơn hàng.";
      }


      showToast(
        "Lỗi",
        message,
        "error"
      );


      console.error(
        "UPDATE ORDER STATUS FAILED:",
        {
          orderId: id,
          status: newStatus,
          httpStatus: res.status,
          response: data
        }
      );


      return false;

    }


    // cập nhật local ngay lập tức
    const index =
      orders.findIndex(
        o => Number(o.orderId) === id
      );


    if(index !== -1){

      orders[index] = {
        ...orders[index],
        ...data,
        orderStatus:
          data?.orderStatus ||
          newStatus
      };

    }


    showToast(
      "Thành công",
      "Đã cập nhật trạng thái đơn hàng"
    );


    return true;


  }catch(error){

    console.error(
      "UPDATE ORDER STATUS ERROR:",
      error
    );


    showToast(
      "Lỗi",
      "Không kết nối được tới máy chủ để cập nhật trạng thái.",
      "error"
    );


    return false;

  }

}

async function saveOrderStatusFromDetail(orderId){

  const select =
    document.getElementById(
      "orderDetailStatus"
    );


  if(!select){

    showToast(
      "Lỗi",
      "Không tìm thấy ô chọn trạng thái",
      "error"
    );

    return;

  }


  const button =
    document.getElementById(
      "saveOrderStatusBtn"
    );


  const status =
    select.value;


  if(button){

    button.disabled = true;

    button.classList.add(
      "opacity-60",
      "cursor-not-allowed"
    );

    button.innerHTML =
      "Đang cập nhật...";

  }


  const success =
    await updateOrderStatus(
      orderId,
      status
    );


  if(!success){

    if(button){

      button.disabled = false;

      button.classList.remove(
        "opacity-60",
        "cursor-not-allowed"
      );

      button.innerHTML = `
        ${icon("save", "w-5 h-5")}
        Cập nhật trạng thái
      `;

      if(
        window.lucide &&
        typeof lucide.createIcons === "function"
      ){
        lucide.createIcons();
      }

    }

    return;

  }


  // tải lại toàn bộ danh sách
  await loadData();


  // render lại bảng
  render();


  // render() xóa modal nếu modal nằm trong app,
  // nên đóng modal động trước khi mở lại
  closeOrderDetail();


  // mở lại chi tiết với dữ liệu mới
  await openOrderDetail(orderId);

}

function excelEscape(value){

  if(value === null || value === undefined){
    return "";
  }


  return String(value)

    .replaceAll("&", "&amp;")

    .replaceAll("<", "&lt;")

    .replaceAll(">", "&gt;")

    .replaceAll('"', "&quot;");

}

function getFilteredOrdersForExport(){

  const keyword =
    String(
      adminSearch.orders || ""
    )
    .trim()
    .toLowerCase();


  let list =
    [...orders];


  // SEARCH
  if(keyword){

    list = list.filter(o => {

      const text = [

        o.orderId,

        getOrderCode(o),

        getOrderReceiverName(o),

        getOrderReceiverPhone(o),

        getOrderReceiverEmail(o),

        getOrderAddress(o)

      ]
      .join(" ")
      .toLowerCase();


      return text.includes(keyword);

    });

  }


  // STATUS
  if(orderStatusFilter !== "ALL"){

    if(orderStatusFilter === "PENDING"){

      list = list.filter(o =>
        o.orderStatus === "PENDING" ||
        o.orderStatus === "PENDING_PAYMENT"
      );

    }

    else if(
      orderStatusFilter === "PROCESSING"
    ){

      list = list.filter(o =>
        o.orderStatus === "PAID" ||
        o.orderStatus === "CONFIRMED"
      );

    }

    else{

      list = list.filter(
        o =>
          o.orderStatus ===
          orderStatusFilter
      );

    }

  }


  // PAYMENT
  if(orderPaymentFilter !== "ALL"){

    list = list.filter(o =>
      String(
        getOrderPaymentMethod(o)
      ).toUpperCase()
      ===
      orderPaymentFilter
    );

  }


  // FROM DATE
  if(orderFromDate){

    list = list.filter(o => {

      if(!o.createdAt){
        return false;
      }

      const d =
        new Date(o.createdAt);

      if(Number.isNaN(d.getTime())){
        return false;
      }

      const day =
        [
          d.getFullYear(),
          String(
            d.getMonth() + 1
          ).padStart(2, "0"),
          String(
            d.getDate()
          ).padStart(2, "0")
        ].join("-");


      return day >= orderFromDate;

    });

  }


  // TO DATE
  if(orderToDate){

    list = list.filter(o => {

      if(!o.createdAt){
        return false;
      }

      const d =
        new Date(o.createdAt);

      if(Number.isNaN(d.getTime())){
        return false;
      }

      const day =
        [
          d.getFullYear(),
          String(
            d.getMonth() + 1
          ).padStart(2, "0"),
          String(
            d.getDate()
          ).padStart(2, "0")
        ].join("-");


      return day <= orderToDate;

    });

  }


  return list.sort(
    (a, b) =>
      new Date(b.createdAt || 0) -
      new Date(a.createdAt || 0)
  );

}

function exportShippingExcel(){

  try{

    const list =
      getFilteredOrdersForExport();


    if(!list.length){

      showToast(
        "Thông báo",
        "Không có đơn hàng phù hợp để xuất Excel",
        "error"
      );

      return;

    }
    /*
     * Đây là mẫu chung cho dữ liệu vận chuyển.
     */
    const rows =
      list.map((order, index) => {


        const payment =
          typeof orderPaymentLabel === "function"
            ? orderPaymentLabel(order)
            : getOrderPaymentMethod(order);


        /*
         * COD:
         * CASH -> thu tiền khi giao.
         *
         * QR -> khách đã/chuyển khoản,
         * mặc định tiền thu hộ = 0.
         */
        const method =
          String(
            getOrderPaymentMethod(order)
          ).toUpperCase();


        const cod =
          method === "CASH"
            ? getOrderTotal(order)
            : 0;


        const productValue =
          getOrderTotal(order);


        return `

          <tr>

            <td>
              ${index + 1}
            </td>

            <td style="mso-number-format:'\\@';">
              ${excelEscape(getOrderCode(order))}
            </td>

            <td>
              ${excelEscape(getOrderReceiverName(order))}
            </td>

            <td style="mso-number-format:'\\@';">
              ${excelEscape(getOrderReceiverPhone(order))}
            </td>

            <td>
              ${excelEscape(getOrderReceiverEmail(order))}
            </td>

            <td>
              ${excelEscape(getOrderAddress(order))}
            </td>

            <td>
              ${excelEscape(getOrderProductsText(order))}
            </td>

            <td>
              ${getOrderTotalQuantity(order)}
            </td>

            <td>
            </td>

            <td>
              ${cod}
            </td>

            <td>
              ${productValue}
            </td>

            <td>
              ${excelEscape(payment)}
            </td>

            <td>
              ${excelEscape(
                orderDetailStatusLabel(
                  order.orderStatus
                )
              )}
            </td>

            <td>
              ${excelEscape(
                typeof formatOrderDate === "function"
                  ? formatOrderDate(order.createdAt)
                  : order.createdAt || ""
              )}
            </td>

            <td>
              ${excelEscape(
                order.note ||
                order.notes ||
                order.customerNote ||
                ""
              )}
            </td>

          </tr>

        `;

      }).join("");


    const html = `

      <!DOCTYPE html>

      <html>

      <head>

        <meta charset="UTF-8">

        <style>

          table{
            border-collapse:collapse;
            font-family:Arial,sans-serif;
            font-size:12px;
          }

          th,
          td{
            border:1px solid #999;
            padding:8px;
            vertical-align:top;
          }

          th{
            background:#eeeeee;
            font-weight:bold;
            white-space:nowrap;
          }

        </style>

      </head>


      <body>


        <table>


          <tr>

            <th colspan="15">
              DANH SÁCH ĐƠN VẬN CHUYỂN JODOK
            </th>

          </tr>


          <tr>

            <td colspan="15">

              Ngày xuất:
              ${
                excelEscape(
                  new Date().toLocaleString(
                    "vi-VN"
                  )
                )
              }

            </td>

          </tr>


          <tr>

            <th>STT</th>

            <th>Mã đơn hàng</th>

            <th>Tên người nhận</th>

            <th>SĐT người nhận</th>

            <th>Email</th>

            <th>Địa chỉ giao hàng</th>

            <th>Nội dung hàng hóa</th>

            <th>Số lượng</th>

            <th>Khối lượng (gram)</th>

            <th>Tiền thu hộ COD</th>

            <th>Giá trị hàng hóa</th>

            <th>Phương thức thanh toán</th>

            <th>Trạng thái đơn</th>

            <th>Ngày đặt hàng</th>

            <th>Ghi chú</th>

          </tr>


          ${rows}


        </table>


      </body>

      </html>

    `;


    const blob =
      new Blob(
        [
          "\ufeff",
          html
        ],
        {
          type:
            "application/vnd.ms-excel;charset=utf-8;"
        }
      );


    const url =
      URL.createObjectURL(blob);


    const link =
      document.createElement("a");


    const today =
      new Date()
        .toISOString()
        .slice(0, 10);


    link.href =
      url;


    link.download =
      `don-van-chuyen-jodok-${today}.xls`;


    document.body.appendChild(link);


    link.click();


    link.remove();


    setTimeout(
      () =>
        URL.revokeObjectURL(url),
      1000
    );


    showToast(
      "Thành công",
      `Đã xuất ${list.length} đơn hàng ra Excel`
    );


  }catch(error){

    console.error(
      "EXPORT SHIPPING EXCEL ERROR:",
      error
    );


    showToast(
      "Lỗi",
      error?.message ||
      "Không thể xuất file Excel",
      "error"
    );

  }

}
