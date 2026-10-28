let cart = null;
let appliedVoucher = null;
let discountAmount = 0;
let availableVouchers = [];

// ==========================================
// AUTH
// ==========================================

function userAuthHeaders() {
  const user = getUser();

  return user?.token
    ? { "Authorization": "Bearer " + user.token }
    : {};
}

function userJsonHeaders() {
  return {
    "Content-Type": "application/json",
    ...userAuthHeaders()
  };
}

// ==========================================
// HELPERS
// ==========================================

function money(v) {
  return Number(v || 0).toLocaleString("vi-VN") + "đ";
}

function productImg(p) {
  if (p?.imageUrl) return p.imageUrl;

  if (p?.images && p.images.length > 0) {
    return p.images[0].imageUrl;
  }

  return "https://images.unsplash.com/photo-1539008835657-9e8e9680c956?q=80&w=900&auto=format&fit=crop";
}

// ==========================================
// TÍNH TIỀN ĐƠN HÀNG
// ==========================================

function getPaymentSubtotal() {
  return (cart?.items || []).reduce((sum, item) => {
    const variant = item.variant;
    const product = variant.product;

    const price = Number(
      jodokSalePrice(product?.productId, variant.price ?? product.basePrice ?? 0)
    );

    return sum + price * Number(item.quantity || 0);
  }, 0);
}

function getPaymentShipping(subtotal) {
  return subtotal >= 999000 ? 0 : 30000;
}

function calculateVoucherDiscount(voucher, subtotal) {
  if (!voucher) return 0;

  let amount = 0;

  if (voucher.discountType === "PERCENT") {
    amount =
      subtotal * Number(voucher.discountValue || 0) / 100;
  } else {
    amount = Number(voucher.discountValue || 0);
  }

  return Math.max(
    0,
    Math.min(amount, subtotal)
  );
}

// ==========================================
// LOAD CART
// ==========================================

async function loadCart() {
  const user = getUser();

  if (!user) {
    showToast(
      "Lỗi",
      "Vui lòng đăng nhập",
      "error"
    );

    location.href = "/auth";
    return;
  }

  try {
    const res = await fetch(
      `${API_BASE}/cart/${user.userId}`,
      {
        headers: userAuthHeaders()
      }
    );

    const data = await res.json();

    if (!res.ok) {
      showToast(
        "Lỗi",
        data.message || "Không tải được giỏ hàng",
        "error"
      );

      location.href = "/cart";
      return;
    }

    cart = data;

    if (!cart.items || cart.items.length === 0) {
      showToast(
        "Thông báo",
        "Giỏ hàng trống",
        "error"
      );

      location.href = "/cart";
      return;
    }

    await loadJodokSalePrices();
    await loadAvailableVouchers();

    // Chỉ render một lần khi trang được tải
    renderPayment();

  } catch (error) {
    console.error("LOAD CART ERROR:", error);

    showToast(
      "Lỗi",
      "Không thể tải giỏ hàng",
      "error"
    );
  }
}

// ==========================================
// LOAD AVAILABLE VOUCHERS
// ==========================================

async function loadAvailableVouchers() {
  try {
    const res = await fetch(
      `${API_BASE}/vouchers`
    );

    if (!res.ok) {
      throw new Error(
        "Không tải được danh sách voucher"
      );
    }

    const data = await res.json();

    if (!Array.isArray(data)) {
      availableVouchers = [];
      return;
    }

    const subtotal = getPaymentSubtotal();

    availableVouchers = data.filter(v => {
      const active =
        v.status === "ACTIVE";

      const notExpired =
        !v.endDate ||
        new Date(v.endDate + "T23:59:59") >= new Date();

      const enoughOrder =
        !v.minOrderValue ||
        subtotal >= Number(v.minOrderValue);

      return (
        active &&
        notExpired &&
        enoughOrder
      );
    });

    availableVouchers.sort((a, b) => {
      const discountA =
        calculateVoucherDiscount(a, subtotal);

      const discountB =
        calculateVoucherDiscount(b, subtotal);

      return discountB - discountA;
    });

  } catch (error) {
    console.error(
      "LOAD VOUCHERS ERROR:",
      error
    );

    availableVouchers = [];
  }
}

// ==========================================
// RENDER PAYMENT
// ==========================================

function renderPayment() {
  const user = getUser();
  const items = cart.items || [];

  let subtotal = 0;

  const itemHtml = items.map(item => {
    const v = item.variant;
    const p = v.product;

    const price = Number(
      jodokSalePrice(p?.productId, v.price ?? p.basePrice ?? 0)
    );

    const line = price * item.quantity;
    subtotal += line;

    return `
      <div class="flex gap-4 border-b pb-4">

        <img
          src="${productImg(p)}"
          class="w-20 h-24 object-cover rounded-xl">

        <div class="flex-1">
          <b>${jodokEscape(p.productName)}</b>

          <p class="text-sm text-neutral-500">
            Size: ${jodokEscape(v.size)}
            · Màu: ${jodokEscape(v.color)}
          </p>

          <p>Số lượng: ${item.quantity}</p>
        </div>

        <b class="text-red-800">
          ${money(line)}
        </b>

      </div>
    `;
  }).join("");

  const shipping =
    getPaymentShipping(subtotal);

  discountAmount = calculateVoucherDiscount(
    appliedVoucher,
    subtotal
  );

  const total = Math.max(
    subtotal + shipping - discountAmount,
    0
  );

  document.getElementById("app").innerHTML = `
    ${header()}

    <main class="payment-page max-w-6xl mx-auto px-6 py-10 w-full">

      <h1 class="text-5xl font-serif mb-8">
        Thanh toán
      </h1>

      <div class="grid lg:grid-cols-[1fr_420px] gap-8">

        <!-- THÔNG TIN NHẬN HÀNG -->
        <div class="payment-panel bg-white rounded-3xl p-8 shadow">

          <h2 class="text-2xl font-bold mb-5">
            Thông tin nhận hàng
          </h2>

          <div class="space-y-4">

            <!-- HỌ TÊN -->
            <div>
              <label
                for="fullname"
                class="block text-sm font-semibold mb-2">
                Họ và tên *
              </label>

              <input
                id="fullname"
                required
                maxlength="255"
                class="w-full border rounded-2xl px-5 py-4"
                placeholder="Họ và tên người nhận"
                value="${jodokEscape(user.fullname || "")}">
            </div>

            <!-- SỐ ĐIỆN THOẠI -->
            <div>
              <label
                for="phone"
                class="block text-sm font-semibold mb-2">
                Số điện thoại *
              </label>

              <input
                id="phone"
                type="tel"
                inputmode="numeric"
                autocomplete="tel"
                maxlength="10"
                pattern="0[0-9]{9}"
                required
                placeholder="VD: 0976814999"
                value="${jodokEscape(user.phone || '')}"
                oninput="
                  jodokCleanPhone(this);
                  jodokValidatePhoneInput(this);
                "
                onblur="jodokValidatePhoneInput(this)"
                class="w-full border rounded-2xl px-5 py-4"
              >
            </div>

            <!-- ĐỊA CHỈ -->
            <div class="border-t pt-5 mt-5">

              <h3 class="font-bold text-lg mb-4">
                Địa chỉ nhận hàng
              </h3>

              ${jodokAddressFields("checkout", "payment")}

            </div>

            <!-- VOUCHER -->
            <div>

              <h3 class="font-bold text-xl pt-4">
                Mã giảm giá
              </h3>

              <div class="flex gap-3 mt-3">

                <input
                  id="voucherCode"
                  class="flex-1 min-w-0 border rounded-2xl px-5 py-4"
                  placeholder="Nhập mã voucher"
                  value="${jodokEscape(appliedVoucher?.code || "")}">

                <button
                  type="button"
                  id="applyVoucherButton"
                  onclick="applyVoucher()"
                  class="bg-black text-white rounded-2xl px-5 font-bold
                    disabled:opacity-50">
                  Áp dụng
                </button>

              </div>

              <div class="payment-voucher-list mt-4 border rounded-2xl p-3 max-h-48 overflow-y-auto space-y-2">

                ${
                  availableVouchers.length
                    ? availableVouchers.map(v => `
                      <button
                        type="button"
                        onclick="selectVoucher('${jodokEscape(v.code)}')"
                        data-voucher-code="${jodokEscape(v.code)}"
                        class="w-full border rounded-xl px-4 py-3 text-left hover:bg-red-50
                        ${
                          appliedVoucher?.code === v.code
                            ? "border-red-800 bg-red-50"
                            : ""
                        }">

                        <b>${jodokEscape(v.code)}</b>

                        <p class="text-sm text-neutral-500">
                          Giảm ${
                            v.discountType === "PERCENT"
                              ? v.discountValue + "%"
                              : money(v.discountValue)
                          }
                        </p>

                      </button>
                    `).join("")
                    : `
                      <p class="text-neutral-500">
                        Không có voucher khả dụng
                      </p>
                    `
                }

              </div>

              <p
                id="voucherInfo"
                class="mt-2 text-sm text-green-700 font-semibold">

                ${
                  appliedVoucher
                    ? `Đã áp dụng mã ${jodokEscape(appliedVoucher.code)} - Giảm ${money(discountAmount)}`
                    : ""
                }
              </p>
            </div>

            <!-- PHƯƠNG THỨC THANH TOÁN -->
            <h3 class="font-bold text-xl pt-4">
              Phương thức thanh toán
            </h3>

            <label class="block border rounded-2xl p-4 cursor-pointer">
              <input
                type="radio"
                name="paymentMethod"
                value="CASH"
                checked>
              Thanh toán khi nhận hàng
            </label>

            <label class="block border rounded-2xl p-4 cursor-pointer">
              <input
                type="radio"
                name="paymentMethod"
                value="QR">
              Thanh toán PayOS QR
            </label>

            <div
              id="qrBox"
              class="hidden border rounded-2xl p-5 bg-neutral-50 text-center">

              <p class="font-bold text-lg mb-3">
                Bấm "Xác nhận đặt hàng" để chuyển sang cổng thanh toán PayOS
              </p>

              <p class="text-neutral-500">
                Bạn sẽ được chuyển tới trang thanh toán bảo mật của PayOS.
              </p>

            </div>

          </div>
        </div>

        <!-- TÓM TẮT ĐƠN HÀNG -->
        <div class="payment-summary bg-white rounded-3xl p-8 shadow h-fit">

          <h2 class="text-2xl font-bold mb-5">
            Đơn hàng
          </h2>

          <div class="space-y-4 mb-6">
            ${itemHtml}
          </div>

          <div class="border-t pt-5 space-y-3">

            <!-- TẠM TÍNH -->
            <div class="flex justify-between">
              <span>Tạm tính</span>

              <b id="paymentSubtotal">
                ${money(subtotal)}
              </b>
            </div>

            <!-- PHÍ VẬN CHUYỂN -->
            <div class="flex justify-between">
              <span>Phí vận chuyển</span>

              <b id="paymentShipping">
                ${shipping === 0 ? "Miễn phí" : money(shipping)}
              </b>
            </div>

            <!-- GIẢM GIÁ -->
            <div class="flex justify-between">
              <span>Giảm giá</span>

              <b
                id="paymentDiscount"
                class="text-green-700">
                - ${money(discountAmount)}
              </b>
            </div>

            <!-- TỔNG CỘNG -->
            <div class="flex justify-between text-xl">
              <span class="font-bold">
                Tổng cộng
              </span>

              <b
                id="paymentTotal"
                class="text-red-800">
                ${money(total)}
              </b>
            </div>

          </div>

          <button
            type="button"
            onclick="submitPayment()"
            class="mt-7 w-full bg-red-800 text-white rounded-full py-4 font-bold">
            Xác nhận đặt hàng
          </button>

          <a
            href="/cart"
            class="block text-center mt-4 border rounded-full py-3 font-bold">
            Quay lại giỏ hàng
          </a>

        </div>

      </div>
    </main>

    ${footer()}
  `;

  // Khởi tạo địa chỉ một lần khi mở trang
  jodokInitAddress(
    "checkout",
    user.address || ""
  );

  if (window.lucide) {
    lucide.createIcons();
  }

  // Điều khiển phần PayOS
  document.querySelectorAll(
    'input[name="paymentMethod"]'
  ).forEach(input => {
    input.addEventListener("change", () => {
      const selected = document.querySelector(
        'input[name="paymentMethod"]:checked'
      );

      document.getElementById("qrBox")
        .classList.toggle(
          "hidden",
          selected?.value !== "QR"
        );
    });
  });
}

// ==========================================
// FIX: CẬP NHẬT TỔNG TIỀN KHÔNG RENDER LẠI
// ==========================================

function updatePaymentTotals() {
  if (!cart || !Array.isArray(cart.items)) {
    return;
  }

  const subtotal = getPaymentSubtotal();

  const shipping =
    getPaymentShipping(subtotal);

  discountAmount = calculateVoucherDiscount(
    appliedVoucher,
    subtotal
  );

  const total = Math.max(
    subtotal + shipping - discountAmount,
    0
  );

  // Chỉ thay đổi nội dung hiển thị
  const subtotalEl =
    document.getElementById("paymentSubtotal");

  const shippingEl =
    document.getElementById("paymentShipping");

  const discountEl =
    document.getElementById("paymentDiscount");

  const totalEl =
    document.getElementById("paymentTotal");

  const voucherInfoEl =
    document.getElementById("voucherInfo");

  if (subtotalEl) {
    subtotalEl.textContent = money(subtotal);
  }

  if (shippingEl) {
    shippingEl.textContent =
      shipping === 0
        ? "Miễn phí"
        : money(shipping);
  }

  if (discountEl) {
    discountEl.textContent =
      "- " + money(discountAmount);
  }

  if (totalEl) {
    totalEl.textContent = money(total);
  }

  if (voucherInfoEl) {
    voucherInfoEl.textContent = appliedVoucher
      ? `Đã áp dụng mã ${appliedVoucher.code} - Giảm ${money(discountAmount)}`
      : "";
  }

  // Đánh dấu voucher đang được chọn
  document.querySelectorAll(
    ".payment-voucher-list button"
  ).forEach(button => {

    const code = button.getAttribute(
      "data-voucher-code"
    );

    const selected = Boolean(
      appliedVoucher &&
      code?.toUpperCase() ===
        String(appliedVoucher.code).toUpperCase()
    );

    button.classList.toggle(
      "border-red-800",
      selected
    );

    button.classList.toggle(
      "bg-red-50",
      selected
    );
  });

  // Không gọi renderPayment() ở đây
  // => Giữ nguyên dữ liệu form khách đã nhập
}

// ==========================================
// APPLY VOUCHER
// ==========================================

async function applyVoucher() {
  const input =
    document.getElementById("voucherCode");

  if (!input) return;

  const code = input.value.trim();

  if (!code) {
    showToast(
      "Thiếu mã",
      "Vui lòng nhập mã voucher",
      "error"
    );
    return;
  }

  const button = document.getElementById(
    "applyVoucherButton"
  );

  if (button?.disabled) return;

  if (button) {
    button.disabled = true;
    button.textContent = "Đang kiểm tra...";
  }

  try {
    const res = await fetch(
      `${API_BASE}/vouchers`
    );

    if (!res.ok) {
      throw new Error(
        "Không tải được danh sách voucher"
      );
    }

    const vouchers = await res.json();

    if (!Array.isArray(vouchers)) {
      throw new Error(
        "Dữ liệu voucher không hợp lệ"
      );
    }

    const subtotal = getPaymentSubtotal();

    const voucher = vouchers.find(
      v => String(v.code || "").toUpperCase() ===
        code.toUpperCase()
    );

    if (!voucher) {
      showToast(
        "Không hợp lệ",
        "Voucher không tồn tại",
        "error"
      );
      return;
    }

    if (voucher.status !== "ACTIVE") {
      showToast(
        "Không hợp lệ",
        "Voucher đã bị khóa",
        "error"
      );
      return;
    }

    if (
      voucher.endDate &&
      new Date(voucher.endDate + "T23:59:59") < new Date()
    ) {
      showToast(
        "Không hợp lệ",
        "Voucher đã hết hạn",
        "error"
      );
      return;
    }

    if (
      voucher.minOrderValue &&
      subtotal < Number(voucher.minOrderValue)
    ) {
      showToast(
        "Không đủ điều kiện",
        "Đơn hàng chưa đạt giá trị tối thiểu",
        "error"
      );
      return;
    }

    // Lưu voucher đang chọn
    appliedVoucher = voucher;

    // Tính lại số tiền giảm
    discountAmount = calculateVoucherDiscount(
      voucher,
      subtotal
    );

    // Chỉ cập nhật tiền và trạng thái voucher
    updatePaymentTotals();

    showToast(
      "Thành công",
      "Áp dụng voucher thành công",
      "success"
    );

    // KHÔNG GỌI renderPayment()
    // => Giữ nguyên họ tên, SĐT và địa chỉ

  } catch (error) {
    console.error(
      "APPLY VOUCHER ERROR:",
      error
    );

    showToast(
      "Lỗi",
      error.message || "Không thể áp dụng voucher",
      "error"
    );

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Áp dụng";
    }
  }
}

// ==========================================
// SELECT VOUCHER
// ==========================================

function selectVoucher(code) {
  const input =
    document.getElementById("voucherCode");

  if (input) {
    input.value = code;
  }

  // Áp dụng voucher nhưng không render lại form
  applyVoucher();
}

// ==========================================
// SUBMIT PAYMENT
// ==========================================

async function submitPayment() {
  const user = getUser();

  const fullname =
    document.getElementById("fullname")
      .value.trim();

  const phone =
    document.getElementById("phone")
      .value.trim();

  // KIỂM TRA HỌ TÊN
  if (!fullname) {
    showToast(
      "Thiếu thông tin",
      "Vui lòng nhập họ và tên người nhận",
      "error"
    );
    return;
  }

  // KIỂM TRA SỐ ĐIỆN THOẠI VIỆT NAM
  if (!jodokPhoneValid(phone)) {
    const message = jodokPhoneError(phone);

    jodokValidatePhoneInput(
      document.getElementById("phone")
    );

    showToast(
      "Số điện thoại không hợp lệ",
      message,
      "error"
    );
    return;
  }

  // KIỂM TRA ĐỊA CHỈ
  let address;

  try {
    address = jodokGetAddress(
      "checkout"
    );

  } catch (error) {
    showToast(
      "Địa chỉ không hợp lệ",
      error.message,
      "error"
    );
    return;
  }

  // KIỂM TRA PHƯƠNG THỨC THANH TOÁN
  const selectedMethod =
    document.querySelector(
      'input[name="paymentMethod"]:checked'
    );

  if (!selectedMethod) {
    showToast(
      "Thiếu thông tin",
      "Vui lòng chọn phương thức thanh toán",
      "error"
    );
    return;
  }

  const paymentMethod =
    selectedMethod.value;

  // ========================================
  // TẠO ĐƠN HÀNG
  // ========================================

  try {
    const res = await fetch(
      `${API_BASE}/orders/checkout`,
      {
        method: "POST",
        headers: userJsonHeaders(),
        body: JSON.stringify({
          userId: user.userId,
          fullname,
          phone,
          address,
          paymentMethod,
          voucherCode:
            appliedVoucher?.code || null
        })
      }
    );

    const data = await res.json();

    if (!res.ok) {
      showToast(
        "Lỗi",
        data.message || "Đặt hàng thất bại",
        "error"
      );
      return;
    }

    // ======================================
    // PAYOS
    // ======================================

    if (paymentMethod === "QR") {
      const total = Number(
        data.finalAmount ||
        data.totalAmount ||
        0
      );

      const orderId =
        data.orderId || data.id;

      if (!orderId) {
        showToast(
          "Lỗi",
          "Không lấy được mã đơn hàng",
          "error"
        );

        console.log(
          "ORDER DATA:",
          data
        );
        return;
      }

      const payosRes = await fetch(
        `${API_BASE}/payments/payos/create`,
        {
          method: "POST",
          headers: userJsonHeaders(),
          body: JSON.stringify({
            orderId: orderId,
            amount: total,
            description: `DH${orderId}`
          })
        }
      );

      const payosData =
        await payosRes.json();

      console.log(
        "PAYOS DATA:",
        payosData
      );

      const checkoutUrl =
        payosData.checkoutUrl ||
        payosData.data?.checkoutUrl;

      if (checkoutUrl) {
        window.location.href =
          checkoutUrl;
        return;
      }

      showToast(
        "Lỗi",
        payosData.error ||
        payosData.message ||
        "Không tạo được PayOS",
        "error"
      );

      return;

    } else {
      // ====================================
      // COD
      // ====================================

      showToast(
        "Đặt hàng thành công",
        "Thanh toán khi nhận hàng",
        "success"
      );
    }

    setTimeout(() => {
      location.href = "/orders";
    }, 1500);

  } catch (error) {
    console.error(
      "PAYMENT ERROR:",
      error
    );

    showToast(
      "Lỗi",
      error.message ||
      "Không thể kết nối máy chủ",
      "error"
    );
  }
}

// ==========================================
// INITIALIZE
// ==========================================

loadCart();