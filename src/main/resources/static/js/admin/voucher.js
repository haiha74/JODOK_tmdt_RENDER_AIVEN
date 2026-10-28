
/*
 * JODOK ADMIN - VOUCHER MANAGEMENT
 * Giao diện bảng + tìm kiếm + lọc trạng thái
 * Phân trang 10 voucher/trang
 * Giữ API: /api/vouchers
 */

var voucherPage = 1;
var voucherPageSize = 10;
var voucherKeyword = "";
var voucherStatusFilter = "ALL";

// =========================
// HELPER
// =========================

function voucherEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function voucherMoney(value) {
  return new Intl.NumberFormat("vi-VN").format(
    Number(value) || 0
  ) + "đ";
}

function voucherDate(value) {
  if (!value) return "Không giới hạn";

  const raw = String(value).substring(0, 10);
  const parts = raw.split("-");

  if (parts.length !== 3) {
    return voucherEscape(raw);
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function voucherExpired(v) {
  if (!v.endDate) return false;

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");

  const current = `${yyyy}-${mm}-${dd}`;
  return String(v.endDate).substring(0, 10) < current;
}

function voucherDisplayStatus(v) {
  if (voucherExpired(v)) return "EXPIRED";
  return v.status || "INACTIVE";
}

function voucherStatusBadge(v) {
  const status = voucherDisplayStatus(v);

  if (status === "ACTIVE") {
    return `
      <span class="inline-flex items-center rounded-full
        bg-green-100 text-green-700 px-3 py-1
        text-xs font-semibold whitespace-nowrap">
        Đang dùng
      </span>`;
  }

  if (status === "EXPIRED") {
    return `
      <span class="inline-flex items-center rounded-full
        bg-red-100 text-red-700 px-3 py-1
        text-xs font-semibold whitespace-nowrap">
        Hết hạn
      </span>`;
  }

  return `
    <span class="inline-flex items-center rounded-full
      bg-gray-100 text-gray-600 px-3 py-1
      text-xs font-semibold whitespace-nowrap">
      Ngừng dùng
    </span>`;
}

function voucherTypeText(type) {
  return type === "PERCENT"
    ? "Phần trăm"
    : "Tiền mặt";
}

function voucherValueText(v) {
  if (v.discountType === "PERCENT") {
    return `${v.discountValue}%`;
  }
  return voucherMoney(v.discountValue);
}

function voucherConditionText(v) {
  const min = Number(v.minOrderValue) || 0;

  return min > 0
    ? `Đơn từ ${voucherMoney(min)}`
    : "Không điều kiện";
}

// =========================
// FILTER + PAGINATION
// =========================

function voucherFilteredData() {
  const keyword = voucherKeyword.trim().toLowerCase();

  return (Array.isArray(vouchers) ? vouchers : [])
    .filter(v => {
      const searchable = [
        v.code,
        voucherTypeText(v.discountType),
        v.discountValue
      ].join(" ").toLowerCase();

      const matchKeyword = searchable.includes(keyword);

      const status = voucherDisplayStatus(v);

      const matchStatus =
        voucherStatusFilter === "ALL" ||
        status === voucherStatusFilter;

      return matchKeyword && matchStatus;
    });
}

function voucherSetPage(page) {
  const total = voucherFilteredData().length;
  const pages = Math.max(1, Math.ceil(total / voucherPageSize));

  voucherPage = Math.min(Math.max(1, page), pages);
  voucherRefreshList();
}

function voucherSetSearch(value) {
  voucherKeyword = value;
  voucherPage = 1;
  voucherRefreshList();
}

function voucherSetStatus(value) {
  voucherStatusFilter = value;
  voucherPage = 1;
  voucherRefreshList();
}

function voucherRefreshList() {
  const target = document.getElementById("voucherListArea");
  if (target) {
    target.innerHTML = voucherTableMarkup();
  }
}

// =========================
// MAIN PANEL
// =========================

function voucherPanel() {
  return `
    <div class="space-y-5" id="voucherManager">

      <div class="flex flex-col sm:flex-row
        sm:items-center sm:justify-between gap-3">

        
      </div>

      <div class="bg-white rounded-2xl
        border border-gray-200 shadow-sm overflow-hidden">

        <!-- TOOLBAR -->

        <div class="p-5 border-b border-gray-100">
          <div class="flex flex-col lg:flex-row gap-3
            lg:items-center">

            <div class="relative flex-1 min-w-0">
              <svg
                class="absolute left-4 top-1/2 -translate-y-1/2
                  w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>

              <input
                type="text"
                value="${voucherEscape(voucherKeyword)}"
                oninput="voucherSetSearch(this.value)"
                placeholder="Tìm kiếm mã voucher..."
                class="w-full h-11 pl-11 pr-4
                  border border-gray-200 rounded-xl
                  text-sm outline-none
                  focus:border-red-700
                  focus:ring-1 focus:ring-red-700"
              >
            </div>

            <select
              onchange="voucherSetStatus(this.value)"
              class="h-11 px-4 rounded-xl
                border border-gray-200 bg-white
                text-sm outline-none
                lg:w-44 cursor-pointer">

              <option value="ALL"
                ${voucherStatusFilter === "ALL" ? "selected" : ""}>
                Tất cả trạng thái
              </option>

              <option value="ACTIVE"
                ${voucherStatusFilter === "ACTIVE" ? "selected" : ""}>
                Đang dùng
              </option>

              <option value="INACTIVE"
                ${voucherStatusFilter === "INACTIVE" ? "selected" : ""}>
                Ngừng dùng
              </option>

              <option value="EXPIRED"
                ${voucherStatusFilter === "EXPIRED" ? "selected" : ""}>
                Hết hạn
              </option>
            </select>

            <button
              type="button"
              onclick="openVoucherForm()"
              class="h-11 px-5 rounded-xl
                bg-red-800 hover:bg-red-900
                text-white text-sm font-semibold
                inline-flex items-center justify-center
                gap-2 transition whitespace-nowrap">

              <span class="text-lg leading-none">+</span>
              Thêm voucher
            </button>

          </div>
        </div>

        <div id="voucherListArea">
          ${voucherTableMarkup()}
        </div>

      </div>
    </div>

    ${voucherModal()}
    ${voucherDetailModal()}
  `;
}

// =========================
// TABLE
// =========================

function voucherTableMarkup() {
  const filtered = voucherFilteredData();

  const total = filtered.length;
  const pages = Math.max(
    1,
    Math.ceil(total / voucherPageSize)
  );

  if (voucherPage > pages) voucherPage = pages;

  const start = (voucherPage - 1) * voucherPageSize;
  const end = Math.min(start + voucherPageSize, total);

  const pageData = filtered.slice(start, end);

  return `
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">

        <thead class="bg-gray-50 text-gray-600">
          <tr class="border-b border-gray-200">
            <th class="py-4 px-4 font-semibold">#</th>
            <th class="py-4 px-3 font-semibold">Mã voucher</th>
            <th class="py-4 px-3 font-semibold">Loại giảm giá</th>
            <th class="py-4 px-3 font-semibold">Giá trị</th>
            <th class="py-4 px-3 font-semibold">Điều kiện</th>
            <th class="py-4 px-3 font-semibold">Trạng thái</th>
            <th class="py-4 px-3 font-semibold">Thời gian</th>
            <th class="py-4 px-3 font-semibold text-center">
              Hành động
            </th>
          </tr>
        </thead>

        <tbody class="divide-y divide-gray-100">

          ${
            pageData.length
              ? pageData.map((v, index) => `
                <tr class="hover:bg-gray-50 transition">

                  <td class="px-4 py-4 text-gray-500">
                    ${start + index + 1}
                  </td>

                  <td class="px-3 py-4 font-bold
                    text-gray-900 whitespace-nowrap">
                    ${voucherEscape(v.code)}
                  </td>

                  <td class="px-3 py-4 text-gray-600">
                    ${voucherTypeText(v.discountType)}
                  </td>

                  <td class="px-3 py-4 font-semibold
                    text-gray-900 whitespace-nowrap">
                    ${voucherValueText(v)}
                  </td>

                  <td class="px-3 py-4 text-gray-600">
                    ${voucherConditionText(v)}
                  </td>

                  <td class="px-3 py-4">
                    ${voucherStatusBadge(v)}
                  </td>

                  <td class="px-3 py-4 text-gray-600 whitespace-nowrap">
                    ${voucherDate(v.endDate)}
                  </td>

                  <td class="px-3 py-4">
                    <div class="flex items-center
                      justify-center gap-1">

                      <button
                        type="button"
                        onclick="openVoucherForm(${Number(v.voucherId)})"
                        title="Sửa voucher"
                        class="w-8 h-8 flex items-center
                          justify-center rounded-lg
                          text-red-700 hover:bg-red-50
                          transition">
                        <span class="text-base">✎</span>
                      </button>

                      <button
                        type="button"
                        onclick="viewVoucher(${Number(v.voucherId)})"
                        title="Xem chi tiết"
                        class="w-8 h-8 flex items-center
                          justify-center rounded-lg
                          text-red-700 hover:bg-red-50
                          transition">
                        <span class="text-base">◉</span>
                      </button>

                      <button
                        type="button"
                        onclick="deleteVoucher(${Number(v.voucherId)})"
                        title="Xóa voucher"
                        class="w-8 h-8 flex items-center
                          justify-center rounded-lg
                          text-red-700 hover:bg-red-50
                          transition">
                        <span class="text-base">🗑</span>
                      </button>

                    </div>
                  </td>

                </tr>
              `).join("")
              : `
                <tr>
                  <td colspan="8"
                    class="p-12 text-center text-gray-400">
                    Không tìm thấy voucher phù hợp
                  </td>
                </tr>
              `
          }

        </tbody>
      </table>
    </div>

    <!-- PAGINATION -->

    <div class="flex flex-col sm:flex-row
      sm:items-center sm:justify-between
      gap-3 px-5 py-4 border-t border-gray-100">

      <div class="text-sm text-gray-500">
        Hiển thị
        <strong class="text-gray-800">
          ${total ? start + 1 : 0}–${end}
        </strong>
        /
        <strong class="text-gray-800">${total}</strong>
        voucher

        <span class="text-gray-400 ml-1">
          (10 voucher/trang)
        </span>
      </div>

      <div class="flex items-center gap-1 flex-wrap">

        <button
          type="button"
          onclick="voucherSetPage(${voucherPage - 1})"
          ${voucherPage === 1 ? "disabled" : ""}
          class="w-9 h-9 rounded-lg
            border border-gray-200 text-sm
            hover:bg-gray-100
            disabled:opacity-40">
          ‹
        </button>

        ${Array.from({ length: pages }, (_, i) => i + 1)
          .filter(p =>
            pages <= 7 ||
            p === 1 ||
            p === pages ||
            Math.abs(p - voucherPage) <= 2
          )
          .map((p, i, arr) => `
            ${i > 0 && p - arr[i - 1] > 1
              ? `<span class="px-1 text-gray-400">...</span>`
              : ""
            }

            <button
              type="button"
              onclick="voucherSetPage(${p})"
              class="min-w-9 h-9 px-2 rounded-lg
                border text-sm font-semibold transition
                ${
                  p === voucherPage
                    ? "bg-red-800 border-red-800 text-white"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-100"
                }">
              ${p}
            </button>
          `).join("")}

        <button
          type="button"
          onclick="voucherSetPage(${voucherPage + 1})"
          ${voucherPage >= pages ? "disabled" : ""}
          class="w-9 h-9 rounded-lg
            border border-gray-200 text-sm
            hover:bg-gray-100
            disabled:opacity-40">
          ›
        </button>

      </div>
    </div>
  `;
}

// =========================
// ADD / EDIT MODAL
// =========================


function voucherModal() {
  return `
    <div
      id="voucherModal"
      class="fixed inset-0 z-[999] hidden
        items-center justify-center bg-black/50
        backdrop-blur-[2px] p-4"
    >
      <div class="bg-white w-full max-w-2xl
        rounded-3xl shadow-2xl overflow-hidden
        max-h-[92vh] flex flex-col">

        <!-- HEADER -->
        <div class="flex items-center justify-between
          px-7 py-5 border-b border-gray-100">

          <div>
            <h2 id="voucherFormTitle"
              class="text-2xl font-bold text-gray-900">
              Thêm voucher
            </h2>
            <p class="text-sm text-gray-500 mt-1">
              Thiết lập chương trình ưu đãi cho khách hàng
            </p>
          </div>

          <button
            type="button"
            onclick="closeVoucherForm()"
            class="w-9 h-9 flex items-center justify-center
              rounded-full bg-gray-100 hover:bg-gray-200
              text-gray-600 text-xl transition"
            aria-label="Đóng">
            &times;
          </button>
        </div>

        <input type="hidden" id="voucherId">

        <!-- FORM BODY -->
        <div class="px-7 py-6 overflow-y-auto space-y-5">

          <!-- MÃ VOUCHER -->
          <div>
            <label for="voucherCode"
              class="block text-sm font-semibold
                text-gray-700 mb-2">
              Mã voucher <span class="text-red-600">*</span>
            </label>

            <input
              id="voucherCode"
              type="text"
              maxlength="50"
              placeholder="VD: SALE20, FREESHIP"
              class="w-full h-11 px-4
                border border-gray-200 rounded-xl
                text-sm outline-none uppercase
                focus:ring-2 focus:ring-red-100
                focus:border-red-700 transition"
            >

            <p class="text-xs text-gray-400 mt-1.5">
              Mã được sử dụng khi khách hàng áp dụng ưu đãi.
            </p>
          </div>

          <!-- LOẠI GIẢM VÀ GIÁ TRỊ -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div>
              <label for="voucherType"
                class="block text-sm font-semibold
                  text-gray-700 mb-2">
                Loại giảm giá <span class="text-red-600">*</span>
              </label>

              <select
                id="voucherType"
                onchange="voucherUpdateValueUnit()"
                class="w-full h-11 px-3 bg-white
                  border border-gray-200 rounded-xl
                  text-sm outline-none
                  focus:border-red-700
                  focus:ring-2 focus:ring-red-100">
                <option value="PERCENT">Giảm theo phần trăm</option>
                <option value="FIXED">Giảm tiền cố định</option>
              </select>
            </div>

            <div>
              <label for="voucherValue"
                class="block text-sm font-semibold
                  text-gray-700 mb-2">
                Giá trị giảm <span class="text-red-600">*</span>
              </label>

              <div class="relative">
                <input
                  id="voucherValue"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Nhập giá trị"
                  class="w-full h-11 pl-4 pr-14
                    border border-gray-200 rounded-xl
                    text-sm outline-none
                    focus:border-red-700
                    focus:ring-2 focus:ring-red-100">

                <span
                  id="voucherValueUnit"
                  class="absolute right-4 top-1/2
                    -translate-y-1/2 text-sm
                    font-semibold text-gray-500">
                  %
                </span>
              </div>
            </div>
          </div>

          <!-- ĐƠN TỐI THIỂU -->
          <div>
            <label for="voucherMinOrder"
              class="block text-sm font-semibold
                text-gray-700 mb-2">
              Giá trị đơn hàng tối thiểu
            </label>

            <div class="relative">
              <input
                id="voucherMinOrder"
                type="number"
                min="0"
                step="1"
                placeholder="VD: 200000"
                class="w-full h-11 pl-4 pr-16
                  border border-gray-200 rounded-xl
                  text-sm outline-none
                  focus:border-red-700
                  focus:ring-2 focus:ring-red-100">

              <span
                class="absolute right-4 top-1/2
                  -translate-y-1/2 text-sm
                  font-medium text-gray-500">
                VNĐ
              </span>
            </div>

            <p class="text-xs text-gray-400 mt-1.5">
              Nhập 0 nếu không yêu cầu giá trị đơn hàng tối thiểu.
            </p>
          </div>

          <!-- NGÀY HẾT HẠN VÀ TRẠNG THÁI -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div>
              <label for="voucherEndDate"
                class="block text-sm font-semibold
                  text-gray-700 mb-2">
                Ngày hết hạn
              </label>

              <input
                id="voucherEndDate"
                type="date"
                class="w-full h-11 px-3
                  border border-gray-200 rounded-xl
                  text-sm outline-none
                  focus:border-red-700
                  focus:ring-2 focus:ring-red-100">
            </div>

            <div>
              <label for="voucherStatus"
                class="block text-sm font-semibold
                  text-gray-700 mb-2">
                Trạng thái
              </label>

              <select
                id="voucherStatus"
                class="w-full h-11 px-3 bg-white
                  border border-gray-200 rounded-xl
                  text-sm outline-none
                  focus:border-red-700
                  focus:ring-2 focus:ring-red-100">

                <option value="ACTIVE">Đang hoạt động</option>
                <option value="INACTIVE">Ngừng hoạt động</option>
              </select>
            </div>
          </div>

          <!-- NOTE -->
          <div class="flex items-start gap-3
            bg-red-50 rounded-xl px-4 py-3
            border border-red-100">

            <span class="text-red-700 text-lg">ⓘ</span>

            <p class="text-xs text-red-800 leading-relaxed">
              Voucher đang hoạt động sẽ có thể được áp dụng
              khi đáp ứng đủ điều kiện và còn thời hạn.
            </p>
          </div>
        </div>

        <!-- FOOTER -->
        <div class="flex items-center justify-end
          gap-3 px-7 py-5 border-t border-gray-100 bg-white">

          <button
            type="button"
            onclick="closeVoucherForm()"
            class="h-11 px-6 rounded-xl
              border border-gray-200
              text-gray-700 text-sm font-semibold
              hover:bg-gray-50 transition">
            Hủy
          </button>

          <button
            type="button"
            id="voucherSaveButton"
            onclick="saveVoucher()"
            class="btn-primary h-11 px-7
              rounded-xl bg-red-800
              text-white text-sm font-semibold
              hover:bg-red-900 transition">
            Lưu voucher
          </button>

        </div>
      </div>
    </div>
  `;
}

function voucherUpdateValueUnit() {
  const type = document.getElementById("voucherType");
  const unit = document.getElementById("voucherValueUnit");
  const value = document.getElementById("voucherValue");

  if (!type || !unit || !value) return;

  if (type.value === "PERCENT") {
    unit.textContent = "%";
    value.placeholder = "VD: 10";
    value.max = "100";
  } else {
    unit.textContent = "VNĐ";
    value.placeholder = "VD: 50000";
    value.removeAttribute("max");
  }
}

function openVoucherForm(id = null) {
  const modal = document.getElementById("voucherModal");
  if (!modal) return;

  const v = id == null
    ? null
    : (vouchers || []).find(
        x => String(x.voucherId) === String(id)
      );

  if (id != null && !v) {
    showToast("Lỗi", "Không tìm thấy voucher", "error");
    return;
  }

  document.getElementById("voucherFormTitle").innerText =
    v ? "Sửa voucher" : "Thêm voucher";

  document.getElementById("voucherId").value =
    v ? v.voucherId : "";

  document.getElementById("voucherCode").value =
    v?.code ?? "";

  document.getElementById("voucherType").value =
    v?.discountType ?? "PERCENT";

  document.getElementById("voucherValue").value =
    v?.discountValue ?? "";

  document.getElementById("voucherMinOrder").value =
    v?.minOrderValue ?? 0;

  document.getElementById("voucherEndDate").value =
    v?.endDate ? String(v.endDate).substring(0, 10) : "";

  document.getElementById("voucherStatus").value =
    v?.status ?? "ACTIVE";

  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeVoucherForm() {
  const modal = document.getElementById("voucherModal");
  if (!modal) return;

  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

// =========================
// VIEW DETAILS
// =========================

function voucherDetailModal() {
  return `
    <div id="voucherDetailModal"
      class="fixed inset-0 bg-black/40
        z-[1000] hidden items-center justify-center p-5">

      <div class="bg-white rounded-3xl
        p-7 w-full max-w-lg shadow-xl">

        <div class="flex justify-between items-center mb-5">
          <h2 class="text-2xl font-bold">
            Chi tiết voucher
          </h2>

          <button
            onclick="closeVoucherDetail()"
            class="text-2xl">
            ×
          </button>
        </div>

        <div id="voucherDetailContent"></div>

        <button
          onclick="closeVoucherDetail()"
          class="mt-6 w-full h-11 rounded-xl
            bg-red-800 text-white font-semibold">
          Đóng
        </button>

      </div>
    </div>
  `;
}

function viewVoucher(id) {
  const v = (vouchers || []).find(
    x => String(x.voucherId) === String(id)
  );

  if (!v) {
    showToast("Lỗi", "Không tìm thấy voucher", "error");
    return;
  }

  const rows = [
    ["Mã voucher", v.code],
    ["Loại giảm giá", voucherTypeText(v.discountType)],
    ["Giá trị giảm", voucherValueText(v)],
    ["Đơn tối thiểu", voucherConditionText(v)],
    ["Ngày hết hạn", voucherDate(v.endDate)],
    ["Trạng thái", voucherDisplayStatus(v)]
  ];

  document.getElementById("voucherDetailContent").innerHTML =
    rows.map(([label, value]) => `
      <div class="flex justify-between items-center
        gap-3 py-3 border-b border-gray-100 text-sm">
        <span class="text-gray-500">
          ${voucherEscape(label)}
        </span>
        <span class="font-semibold text-gray-900 text-right">
          ${voucherEscape(value)}
        </span>
      </div>
    `).join("");

  const modal = document.getElementById("voucherDetailModal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeVoucherDetail() {
  const modal = document.getElementById("voucherDetailModal");
  if (!modal) return;

  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

// =========================
// API ERROR HANDLER
// =========================

async function voucherReadError(res) {
  const raw = await res.text();
  let message = raw;

  try {
    const json = JSON.parse(raw);
    message = json.message || json.error || raw;
  } catch (_) {}

  if (res.status === 403) {
    return "Không đủ quyền ADMIN hoặc phiên đăng nhập hết hạn";
  }

  if (res.status === 401) {
    return "Vui lòng đăng nhập lại";
  }

  return message || `Lỗi HTTP ${res.status}`;
}

// =========================
// SAVE VOUCHER
// =========================

async function saveVoucher() {
  const id = document.getElementById("voucherId").value;

  const code =
    document.getElementById("voucherCode").value.trim().toUpperCase();

  const valueInput =
    document.getElementById("voucherValue").value;

  const minInput =
    document.getElementById("voucherMinOrder").value;

  const body = {
    code: code,
    discountType: document.getElementById("voucherType").value,
    discountValue: Number(valueInput),
    minOrderValue: Number(minInput),
    endDate: document.getElementById("voucherEndDate").value || null,
    status: document.getElementById("voucherStatus").value
  };

  if (!body.code) {
    showToast("Thiếu dữ liệu", "Vui lòng nhập mã voucher", "error");
    return;
  }

  if (
    !valueInput.trim() ||
    !Number.isFinite(body.discountValue) ||
    body.discountValue <= 0
  ) {
    showToast(
      "Dữ liệu không hợp lệ",
      "Giá trị giảm phải lớn hơn 0",
      "error"
    );
    return;
  }

  if (
    body.discountType === "PERCENT" &&
    body.discountValue > 100
  ) {
    showToast(
      "Dữ liệu không hợp lệ",
      "Phần trăm giảm không được vượt quá 100%",
      "error"
    );
    return;
  }

  if (
    !Number.isFinite(body.minOrderValue) ||
    body.minOrderValue < 0
  ) {
    showToast(
      "Dữ liệu không hợp lệ",
      "Đơn tối thiểu không được âm",
      "error"
    );
    return;
  }

  if (body.endDate) {
    const today = new Date();
    const localToday =
      `${today.getFullYear()}-` +
      `${String(today.getMonth() + 1).padStart(2, "0")}-` +
      `${String(today.getDate()).padStart(2, "0")}`;

    if (body.endDate < localToday) {
      showToast(
        "Dữ liệu không hợp lệ",
        "Ngày hết hạn không được ở quá khứ",
        "error"
      );
      return;
    }
  }

  const existing = (vouchers || []).find(v =>
    String(v.code || "").toUpperCase() === body.code &&
    String(v.voucherId) !== String(id)
  );

  if (existing) {
    showToast(
      "Trùng mã voucher",
      "Mã voucher này đã tồn tại",
      "error"
    );
    return;
  }

  const button = document.getElementById("voucherSaveButton");
  if (button?.disabled) return;

  if (button) {
    button.disabled = true;
    button.innerText = "Đang lưu...";
  }

  try {
    const url = id
      ? `${API_BASE}/vouchers/${id}`
      : `${API_BASE}/vouchers`;

    const res = await fetch(url, {
      method: id ? "PUT" : "POST",
      headers: {
        ...adminAuthHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      showToast(
        "Lưu voucher thất bại",
        await voucherReadError(res),
        "error"
      );
      return;
    }

    closeVoucherForm();

    showToast("Thành công", "Đã lưu voucher");

    await init();

    currentTab = "promo";
    render();

  } catch (error) {
    console.error("SAVE VOUCHER ERROR:", error);

    showToast(
      "Lỗi kết nối",
      error.message || "Không thể kết nối máy chủ",
      "error"
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.innerText = "Lưu voucher";
    }
  }
}

// =========================
// DELETE VOUCHER
// =========================

function deleteVoucher(id) {
  showConfirm("Bạn có chắc muốn xóa voucher này?", async () => {
    try {
      const res = await fetch(
        `${API_BASE}/vouchers/${id}`,
        {
          method: "DELETE",
          headers: adminAuthHeaders()
        }
      );

      if (!res.ok) {
        showToast(
          "Xóa voucher thất bại",
          await voucherReadError(res),
          "error"
        );
        return;
      }

      showToast("Thành công", "Đã xóa voucher");

      await init();

      currentTab = "promo";
      render();

    } catch (error) {
      console.error("DELETE VOUCHER ERROR:", error);

      showToast(
        "Lỗi kết nối",
        error.message || "Không thể kết nối máy chủ",
        "error"
      );
    }
  });
}
