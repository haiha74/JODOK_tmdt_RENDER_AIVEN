// Refactored from legacy /js/admin.js. Business logic preserved.
// Loaded as a compatibility classic script by admin/admin.js so existing inline handlers keep working.

function reportChartData(){

  const map = {};

  reportOrders().forEach(o => {
    const day = dateOnly(o.createdAt);
    map[day] = (map[day] || 0) + Number(o.finalAmount || 0);
  });

  let from = reportFrom;
  let to = reportTo;

  if(!from && !to){
    const days = Object.keys(map).sort();

    if(days.length === 0){
      return [];
    }

    from = days[0];
    to = days[days.length - 1];
  }

  if(from && !to){
    to = dateOnly(new Date());
  }

  if(!from && to){
    from = Object.keys(map).sort()[0] || to;
  }

  const result = [];
  const current = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");

  while(current <= end){
    const day = dateOnly(current);

    result.push({
      day,
      revenue: map[day] || 0
    });

    current.setDate(current.getDate() + 1);
  }

  return result;
}

function reportPanel() {
  const reportData = reportOrders();

  const revenue = revenueOf(reportData);
  const totalOrders = reportData.length;

  const completed = reportData.filter(
    o => o.orderStatus === "COMPLETED"
  ).length;

  const cancelled = reportData.filter(
    o => o.orderStatus === "CANCELLED"
  ).length;

  const productList = topProducts(
    reportData.filter(o => o.orderStatus !== "CANCELLED")
  );

  const customerList = topCustomers(
    reportData.filter(o => o.orderStatus !== "CANCELLED")
  );

  const chartData = reportChartData();

  const maxRevenue = Math.max(
    ...chartData.map(x => Number(x.revenue || 0)),
    1
  );

  const validOrderCount = Math.max(
    totalOrders - cancelled,
    1
  );

  const completePercent =
    Math.round(completed / validOrderCount * 100);

  return `
    <div class="space-y-5">

      <!-- BỘ LỌC -->
      <div class="soft-card p-5">

        <div class="
          flex flex-col xl:flex-row
          xl:items-center xl:justify-between
          gap-4
        ">

          <div>
            <h2 class="text-xl font-bold">
              Báo cáo thống kê
            </h2>

            <p class="text-sm text-neutral-500 mt-1">
              Theo dõi doanh thu, đơn hàng, sản phẩm và khách hàng
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">

            <input
              id="reportFrom"
              type="date"
              value="${reportFrom}"
              onchange="changeReportFilter()"
              class="
                border border-neutral-200
                rounded-lg
                px-3 py-2
                text-sm
                outline-none
              "
            >

            <span class="text-neutral-400">–</span>

            <input
              id="reportTo"
              type="date"
              value="${reportTo}"
              onchange="changeReportFilter()"
              class="
                border border-neutral-200
                rounded-lg
                px-3 py-2
                text-sm
                outline-none
              "
            >

            <button
              type="button"
              onclick="reportFrom=''; reportTo=''; render()"
              class="
                border border-neutral-200
                rounded-lg
                px-4 py-2
                text-sm font-semibold
                hover:bg-neutral-50
              "
            >
              Xóa lọc
            </button>

            <button
              type="button"
              onclick="exportReportExcel()"
              class="
                inline-flex items-center gap-2
                bg-green-700 hover:bg-green-800
                text-white
                rounded-lg
                px-4 py-2
                text-sm font-bold
                transition
              "
            >
              ${icon("file-spreadsheet", "w-4 h-4")}
              Xuất Excel
            </button>

          </div>
        </div>
      </div>


      <!-- KPI -->
      <div class="
        grid
        grid-cols-1
        sm:grid-cols-2
        xl:grid-cols-4
        gap-4
      ">

        <!-- DOANH THU -->
        <div class="soft-card p-5">
          <div class="flex items-start gap-4">

            <div class="
              w-10 h-10
              rounded-xl
              bg-red-50
              text-red-700
              flex items-center justify-center
              shrink-0
            ">
              ${icon("circle-dollar-sign", "w-5 h-5")}
            </div>

            <div class="min-w-0">
              <p class="text-sm text-neutral-500">
                Doanh thu
              </p>

              <h3 class="
                text-xl
                font-bold
                text-red-800
                mt-1
                break-words
              ">
                ${money(revenue)}
              </h3>

              <p class="text-xs text-neutral-400 mt-1">
                Không gồm đơn đã hủy
              </p>
            </div>

          </div>
        </div>


        <!-- ĐƠN HÀNG -->
        <div class="soft-card p-5">
          <div class="flex items-start gap-4">

            <div class="
              w-10 h-10
              rounded-xl
              bg-red-50
              text-red-700
              flex items-center justify-center
              shrink-0
            ">
              ${icon("shopping-cart", "w-5 h-5")}
            </div>

            <div>
              <p class="text-sm text-neutral-500">
                Đơn hàng
              </p>

              <h3 class="text-2xl font-bold mt-1">
                ${totalOrders.toLocaleString("vi-VN")}
              </h3>

              <p class="text-xs text-neutral-400 mt-1">
                Trong khoảng đã chọn
              </p>
            </div>

          </div>
        </div>


        <!-- HOÀN THÀNH -->
        <div class="soft-card p-5">
          <div class="flex items-start gap-4">

            <div class="
              w-10 h-10
              rounded-xl
              bg-green-50
              text-green-700
              flex items-center justify-center
              shrink-0
            ">
              ${icon("circle-check", "w-5 h-5")}
            </div>

            <div>
              <p class="text-sm text-neutral-500">
                Hoàn thành
              </p>

              <h3 class="text-2xl font-bold mt-1">
                ${completed.toLocaleString("vi-VN")}
              </h3>

              <p class="text-xs text-green-700 mt-1">
                ${completePercent}% đơn không bị hủy
              </p>
            </div>

          </div>
        </div>


        <!-- HỦY -->
        <div class="soft-card p-5">
          <div class="flex items-start gap-4">

            <div class="
              w-10 h-10
              rounded-xl
              bg-red-50
              text-red-700
              flex items-center justify-center
              shrink-0
            ">
              ${icon("circle-x", "w-5 h-5")}
            </div>

            <div>
              <p class="text-sm text-neutral-500">
                Đã hủy
              </p>

              <h3 class="text-2xl font-bold mt-1">
                ${cancelled.toLocaleString("vi-VN")}
              </h3>

              <p class="text-xs text-neutral-400 mt-1">
                Đơn hàng bị hủy
              </p>
            </div>

          </div>
        </div>

      </div>


      <!-- BIỂU ĐỒ -->
      <div class="
        grid
        grid-cols-1
        xl:grid-cols-[1.6fr_1fr]
        gap-4
      ">

        <!-- DOANH THU THEO NGÀY -->
        <div class="soft-card p-5">

          <div class="
            flex items-center justify-between
            mb-5
          ">
            <div>
              <h3 class="font-bold text-lg">
                Doanh thu theo ngày
              </h3>

              <p class="text-xs text-neutral-400 mt-1">
                Biến động doanh thu trong khoảng thời gian
              </p>
            </div>

            ${icon(
              "chart-no-axes-combined",
              "w-5 h-5 text-red-700"
            )}
          </div>

          ${
            chartData.length
              ? `
                <div class="
                  h-[260px]
                  flex items-end
                  gap-2
                  border-b
                  border-neutral-200
                  pt-5
                ">

                  ${chartData.map(item => {

                    const percent =
                      Math.max(
                        (Number(item.revenue || 0) / maxRevenue) * 100,
                        item.revenue > 0 ? 4 : 1
                      );

                    return `
                      <div class="
                        flex-1
                        min-w-[18px]
                        h-full
                        flex flex-col
                        justify-end
                        items-center
                        group
                        relative
                      ">

                        <div
                          class="
                            absolute
                            -top-3
                            hidden
                            group-hover:block
                            bg-neutral-900
                            text-white
                            text-xs
                            rounded-lg
                            px-3 py-2
                            whitespace-nowrap
                            z-20
                          "
                        >
                          ${item.day}
                          <br>
                          ${money(item.revenue)}
                        </div>

                        <div
                          class="
                            w-full
                            max-w-[38px]
                            bg-red-700
                            hover:bg-red-800
                            rounded-t-md
                            transition
                          "
                          style="
                            height:${percent}%;
                            min-height:${item.revenue ? 5 : 2}px;
                          "
                        ></div>

                      </div>
                    `;
                  }).join("")}

                </div>

                <div class="
                  flex justify-between
                  text-[11px]
                  text-neutral-400
                  mt-2
                ">
                  <span>
                    ${chartData[0]?.day || ""}
                  </span>

                  <span>
                    ${chartData[chartData.length - 1]?.day || ""}
                  </span>
                </div>
              `
              : `
                <div class="
                  h-[260px]
                  flex items-center justify-center
                  text-neutral-400
                ">
                  Chưa có dữ liệu doanh thu
                </div>
              `
          }

        </div>


        <!-- TÓM TẮT -->
        <div class="soft-card p-5">

          <h3 class="font-bold text-lg mb-5">
            Tình trạng đơn hàng
          </h3>

          <div class="space-y-5">

            ${[
              ["Tổng đơn", totalOrders, "receipt"],
              ["Hoàn thành", completed, "circle-check"],
              ["Đã hủy", cancelled, "circle-x"]
            ].map(item => `

              <div class="
                flex items-center justify-between
                border-b
                pb-4
                last:border-0
              ">

                <div class="flex items-center gap-3">

                  <div class="
                    w-9 h-9
                    rounded-lg
                    bg-neutral-50
                    flex items-center justify-center
                    text-red-700
                  ">
                    ${icon(item[2], "w-4 h-4")}
                  </div>

                  <span class="text-sm text-neutral-600">
                    ${item[0]}
                  </span>

                </div>

                <b class="text-lg">
                  ${Number(item[1]).toLocaleString("vi-VN")}
                </b>

              </div>

            `).join("")}

          </div>

        </div>

      </div>


      <!-- TOP SẢN PHẨM + KHÁCH HÀNG -->
      <div class="
        grid
        grid-cols-1
        xl:grid-cols-2
        gap-4
      ">

        <!-- TOP SẢN PHẨM -->
        <div class="soft-card overflow-hidden">

          <div class="
            px-5 py-4
            border-b
            flex items-center justify-between
          ">
            <div>
              <h3 class="font-bold text-lg">
                Top sản phẩm bán chạy
              </h3>

              <p class="text-xs text-neutral-400 mt-1">
                Xếp hạng theo số lượng đã bán
              </p>
            </div>

            ${icon("trophy", "w-5 h-5 text-red-700")}
          </div>

          <div class="overflow-x-auto">

            <table class="w-full text-sm">

              <thead class="bg-neutral-50">
                <tr class="text-left text-neutral-500">
                  <th class="px-5 py-3 w-12">#</th>
                  <th class="px-3 py-3">Sản phẩm</th>
                  <th class="px-3 py-3 text-center">
                    Đã bán
                  </th>
                  <th class="px-5 py-3 text-right">
                    Doanh thu
                  </th>
                </tr>
              </thead>

              <tbody>

                ${
                  productList.length
                    ? productList.map((p, index) => {

                      const product =
                        products.find(
                          x => x.productName === p.name
                        );

                      return `
                        <tr class="
                          border-t
                          hover:bg-neutral-50
                        ">

                          <td class="px-5 py-4">
                            <span class="
                              inline-flex
                              w-7 h-7
                              rounded-full
                              bg-red-50
                              text-red-700
                              items-center justify-center
                              font-bold
                            ">
                              ${index + 1}
                            </span>
                          </td>

                          <td class="px-3 py-4">
                            <div class="
                              flex items-center gap-3
                            ">

                              <img
                                src="${
                                  product
                                    ? productImg(product, index)
                                    : "/images/no-image.png"
                                }"
                                onerror="
                                  this.src='/images/no-image.png'
                                "
                                class="
                                  w-10 h-10
                                  rounded-lg
                                  object-cover
                                  border
                                "
                                alt=""
                              >

                              <span class="
                                font-semibold
                                max-w-[180px]
                                truncate
                              ">
                                ${escapeHtml(p.name)}
                              </span>

                            </div>
                          </td>

                          <td class="
                            px-3 py-4
                            text-center
                            font-semibold
                          ">
                            ${Number(p.qty || 0)
                              .toLocaleString("vi-VN")}
                          </td>

                          <td class="
                            px-5 py-4
                            text-right
                            font-semibold
                          ">
                            ${money(p.revenue)}
                          </td>

                        </tr>
                      `;
                    }).join("")
                    : `
                      <tr>
                        <td
                          colspan="4"
                          class="
                            p-10
                            text-center
                            text-neutral-400
                          "
                        >
                          Chưa có dữ liệu sản phẩm
                        </td>
                      </tr>
                    `
                }

              </tbody>
            </table>

          </div>
        </div>


        <!-- TOP KHÁCH HÀNG -->
        <div class="soft-card overflow-hidden">

          <div class="
            px-5 py-4
            border-b
            flex items-center justify-between
          ">
            <div>
              <h3 class="font-bold text-lg">
                Top khách hàng
              </h3>

              <p class="text-xs text-neutral-400 mt-1">
                Xếp hạng theo tổng giá trị mua hàng
              </p>
            </div>

            ${icon("users", "w-5 h-5 text-red-700")}
          </div>

          <div class="overflow-x-auto">

            <table class="w-full text-sm">

              <thead class="bg-neutral-50">
                <tr class="text-left text-neutral-500">
                  <th class="px-5 py-3 w-12">#</th>
                  <th class="px-3 py-3">Khách hàng</th>
                  <th class="px-3 py-3 text-center">
                    Đơn
                  </th>
                  <th class="px-5 py-3 text-right">
                    Tổng chi
                  </th>
                </tr>
              </thead>

              <tbody>

                ${
                  customerList.length
                    ? customerList.map((c, index) => `

                      <tr class="
                        border-t
                        hover:bg-neutral-50
                      ">

                        <td class="px-5 py-4">
                          <span class="
                            inline-flex
                            w-7 h-7
                            rounded-full
                            bg-red-50
                            text-red-700
                            items-center justify-center
                            font-bold
                          ">
                            ${index + 1}
                          </span>
                        </td>

                        <td class="px-3 py-4">

                          <div class="font-semibold">
                            ${escapeHtml(c.name || "Khách hàng")}
                          </div>

                          <div class="
                            text-xs
                            text-neutral-400
                            mt-1
                            max-w-[200px]
                            truncate
                          ">
                            ${escapeHtml(c.email || "")}
                          </div>

                        </td>

                        <td class="
                          px-3 py-4
                          text-center
                          font-semibold
                        ">
                          ${Number(c.orders || 0)
                            .toLocaleString("vi-VN")}
                        </td>

                        <td class="
                          px-5 py-4
                          text-right
                          font-semibold
                          text-red-800
                        ">
                          ${money(c.total)}
                        </td>

                      </tr>

                    `).join("")
                    : `
                      <tr>
                        <td
                          colspan="4"
                          class="
                            p-10
                            text-center
                            text-neutral-400
                          "
                        >
                          Chưa có dữ liệu khách hàng
                        </td>
                      </tr>
                    `
                }

              </tbody>
            </table>

          </div>
        </div>

      </div>

    </div>
  `;
}

function payosPanel(){
  return `
    <div class="soft-card p-8">
      <p class="uppercase tracking-widest text-green-700 font-bold mb-3">
        PAYOS
      </p>

      <h2 class="serif text-4xl mb-3">
        Lịch sử giao dịch PayOS
      </h2>

      <p class="text-neutral-500 mb-8">
        Mở trang quản lý thanh toán PayOS để xem lịch sử giao dịch realtime.
      </p>

      <a
        href="https://my.payos.vn/"
        target="_blank"
        class="inline-flex items-center gap-3 bg-green-600 hover:bg-green-700
        text-white font-bold px-7 py-4 rounded-2xl transition"
      >
        ${icon("external-link")}
        <span>Mở PayOS Dashboard</span>
      </a>
    </div>
  `;
}

function reportOrders(){
  let list = orders;

  if(reportFrom){
    list = list.filter(o =>
      o.createdAt && dateOnly(o.createdAt) >= reportFrom
    );
  }

  if(reportTo){
    list = list.filter(o =>
      o.createdAt && dateOnly(o.createdAt) <= reportTo
    );
  }

  return list;
}

function changeReportFilter(){

  reportFrom =
    document.getElementById("reportFrom").value;

  reportTo =
    document.getElementById("reportTo").value;

  render();
}
