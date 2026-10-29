/* =========================================
   JODOK - PRODUCT DETAIL
========================================= */

let productFeedbacks = [];
let showReviewForm = false;
let reviewImageFile = null;
let reviewImagePreviewUrl = null;

let detailImageIndex = 0;
let detailReviewPage = 1;
let detailRelatedProducts = [];

const DETAIL_REVIEWS_PER_PAGE = 3;

/* =========================================
   HELPERS
========================================= */

function detailEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function detailImages(p) {
  const all = [...(p.images || [])]
    .filter(img => img && img.imageUrl)
    .sort(
      (a, b) =>
        Number(a.imageId || 0) -
        Number(b.imageId || 0)
    );

  // Chuẩn hóa tên màu
  const normalize = value =>
    String(value || "")
      .trim()
      .toLocaleLowerCase("vi-VN");

  const chosen = normalize(selectedColor);

  // Ảnh thuộc màu khách đang chọn
  const matching = chosen
    ? all.filter(
        img => normalize(img.color) === chosen
      )
    : [];

  // Ảnh không gắn màu: ảnh mặc định
  const defaults = all.filter(
    img => !normalize(img.color)
  );

  // Ưu tiên ảnh đúng màu
  const displayed = matching.length
    ? matching
    : defaults.length
      ? defaults
      : all;

  const urls = displayed.map(
    img => img.imageUrl
  );

  return urls.length
    ? urls
    : [getProductImg(p, 0)];
}

function detailChangeImage(index) {
  if (!selectedProduct) return;

  const images = detailImages(selectedProduct);

  detailImageIndex =
    (index + images.length) % images.length;

  const main = document.getElementById("detailMainImage");

  if (main) {
    main.src = images[detailImageIndex];
  }

  document.querySelectorAll(".detail-thumb").forEach((el, i) => {
    el.classList.toggle("active", i === detailImageIndex);
  });
}

function detailChangeQty(delta) {
  const variant = getSelectedVariant();
  const max = Math.max(1, Number(variant?.stock || 1));

  selectedQty = Math.max(
    1,
    Math.min(max, selectedQty + delta)
  );

  const input = document.getElementById("detailQty");

  if (input) input.value = selectedQty;
}

function changeQty(value) {
  const variant = getSelectedVariant();
  const max = Math.max(1, Number(variant?.stock || 1));

  selectedQty = Math.max(
    1,
    Math.min(max, Math.floor(Number(value) || 1))
  );

  const input = document.getElementById("detailQty");

  if (input) input.value = selectedQty;
}

function getSelectedVariant() {
  return selectedProductVariants.find(v =>
    v.status === "ACTIVE" &&
    v.size === selectedSize &&
    v.color === selectedColor
  );
}

/* =========================================
   RELATED PRODUCTS
   Gợi ý theo sản phẩm đang xem
========================================= */

async function loadDetailRelatedProducts(productId) {
  detailRelatedProducts = [];

  try {
    const currentCategoryIdForQuery = Number(
      selectedProduct.category?.categoryId ?? selectedProduct.categoryId
    );
    const catalog = currentCategoryIdForQuery > 0
      ? await fetchJson(`${API_BASE}/products/category/${currentCategoryIdForQuery}`)
      : [];

    allProducts = catalog.filter(p => p.status === "ACTIVE");
    products = allProducts;

    const currentId = Number(productId);

    // Danh mục của sản phẩm đang xem
    const currentCategoryId = Number(
      selectedProduct.category?.categoryId ??
      selectedProduct.categoryId
    );

    // Thương hiệu của sản phẩm đang xem
    const currentBrandId = Number(
      selectedProduct.brand?.brandId ??
      selectedProduct.brandId
    );

    // Không lấy chính sản phẩm đang xem
    const otherProducts = allProducts.filter(p =>
      Number(p.productId) !== currentId
    );

    // 1. Sản phẩm cùng danh mục
    const sameCategory = otherProducts.filter(p => {
      const categoryId = Number(
        p.category?.categoryId ?? p.categoryId
      );

      return (
        Number.isFinite(currentCategoryId) &&
        currentCategoryId > 0 &&
        categoryId === currentCategoryId
      );
    });

    // 2. Sản phẩm cùng thương hiệu
    const sameBrand = otherProducts.filter(p => {
      const brandId = Number(
        p.brand?.brandId ?? p.brandId
      );

      return (
        Number.isFinite(currentBrandId) &&
        currentBrandId > 0 &&
        brandId === currentBrandId
      );
    });

    // Ưu tiên cùng danh mục, sau đó cùng thương hiệu.
    // Không bổ sung sản phẩm không liên quan chỉ để đủ 10 ô.
    const candidates = [
      ...sameCategory,
      ...sameBrand
    ];

    // Loại sản phẩm trùng nhau
    const uniqueProducts = new Map();

    candidates.forEach(p => {
      if (
        p &&
        p.status === "ACTIVE" &&
        Number(p.productId) !== currentId
      ) {
        uniqueProducts.set(Number(p.productId), p);
      }
    });

    // Tối đa 10 sản phẩm
    detailRelatedProducts = [
      ...uniqueProducts.values()
    ].slice(0, 10);

    // Tải số lượng đã bán cho các thẻ sản phẩm
    window.soldCounts ||= {};

    // One aggregate API for all related cards, instead of a request per product.
    try {
      const counts = await fetchJson(`${API_BASE}/products/sold-counts`);
      for (const p of [selectedProduct, ...detailRelatedProducts]) {
        window.soldCounts[p.productId] = Number(counts?.[p.productId] || 0);
      }
    } catch (error) {
      console.warn("Không tải được lượt bán:", error);
    }

  } catch (error) {
    console.warn(
      "Không tải được sản phẩm liên quan:",
      error
    );

    detailRelatedProducts = [];
  }
}

function detailRelatedSection() {
  if (!detailRelatedProducts.length) return "";

  return `
    <section class="detail-related">

      <div class="detail-section-heading">
        <h2>CÓ THỂ BẠN CŨNG THÍCH</h2>
      </div>

      ${productGrid(detailRelatedProducts)}

      <div class="detail-related-more">
        <a href="/products">Xem thêm</a>
      </div>

    </section>
  `;
}
/* =========================================
   PRODUCT DETAIL PAGE
========================================= */

function detailPage() {
  const p = selectedProduct;

  if (!p) {
    return header() + `
      <main class="wrap py-20">
        Không tìm thấy sản phẩm.
      </main>
    ` + footer();
  }

  const images = detailImages(p);

  detailImageIndex = Math.min(
    detailImageIndex,
    images.length - 1
  );

  const activeVariants = selectedProductVariants.filter(
    v => v.status === "ACTIVE"
  );


  const sizes = [
    ...new Set(
      activeVariants.map(v => v.size).filter(Boolean)
    )
  ];

  // Sắp xếp Combo từ nhỏ đến lớn: 1 -> 3 -> 5
  // Không ảnh hưởng đến size quần áo S, M, L, XL
  if (
    sizes.length &&
    sizes.every(size => /^Combo\s+\d+$/i.test(size.trim()))
  ) {
    sizes.sort((a, b) =>
      Number(a.trim().match(/\d+$/)[0]) -
      Number(b.trim().match(/\d+$/)[0])
    );
  }


  const colors = selectedSize
    ? [
        ...new Set(
          activeVariants
            .filter(v => v.size === selectedSize)
            .map(v => v.color)
            .filter(Boolean)
        )
      ]
    : [];

  const variant = getSelectedVariant();

  const originalPrice = variant?.price ?? p.basePrice;
  const price = jodokSalePrice(p.productId, originalPrice);
  const stock = Number(variant?.stock || 0);

  const averageRating = productFeedbacks.length
    ? (
        productFeedbacks.reduce(
          (sum, review) =>
            sum + Number(review.rating || 0),
          0
        ) / productFeedbacks.length
      ).toFixed(1)
    : null;

  const categoryName = p.category?.categoryName || "";

  const categoryId =
    p.category?.categoryId ?? p.categoryId;

  return header() + `

    <main class="wrap detail-page">

      <!-- BREADCRUMB -->

      <nav class="detail-breadcrumb" aria-label="Đường dẫn">

        <a href="/">Trang chủ</a>
        <span>›</span>

        <a href="/products">Sản phẩm</a>

        ${categoryName && categoryId ? `
          <span>›</span>

          <a href="/products?categoryId=${encodeURIComponent(categoryId)}">
            ${detailEscape(categoryName)}
          </a>
        ` : ""}

        <span>›</span>

        <strong>${detailEscape(p.productName)}</strong>

      </nav>

      <!-- MAIN PRODUCT -->

      <div class="detail-main">

        <!-- GALLERY -->

        <div class="detail-gallery">

          <div class="detail-thumbnails">

            ${images.map((url, index) => `
              <button
                type="button"
                class="detail-thumb ${index === detailImageIndex ? "active" : ""}"
                onclick="detailChangeImage(${index})"
                aria-label="Xem ảnh ${index + 1}"
              >
                <img
                  src="${detailEscape(url)}"
                  alt="Ảnh sản phẩm ${index + 1}"
                  onerror="this.onerror=null;this.src='/images/no-image.png';"
                >
              </button>
            `).join("")}

          </div>

          <div class="detail-main-image">

            <img
              id="detailMainImage"
              src="${detailEscape(images[detailImageIndex])}"
              alt="${detailEscape(p.productName)}"
              onerror="this.onerror=null;this.src='/images/no-image.png';"
            >

            ${images.length > 1 ? `

              <button
                type="button"
                class="detail-gallery-arrow prev"
                onclick="detailChangeImage(detailImageIndex - 1)"
                aria-label="Ảnh trước"
              >‹</button>

              <button
                type="button"
                class="detail-gallery-arrow next"
                onclick="detailChangeImage(detailImageIndex + 1)"
                aria-label="Ảnh tiếp theo"
              >›</button>

            ` : ""}

          </div>

        </div>

        <!-- PURCHASE INFORMATION -->

        <div class="detail-purchase">

          <p class="detail-brand">
            ${detailEscape(getBrandName(p))}
          </p>

          <h1>${detailEscape(p.productName)}</h1>

          <div class="detail-rating">

            ${averageRating ? `
              <span class="detail-stars">★★★★★</span>

              <span>
                ${averageRating}
                (${productFeedbacks.length} đánh giá)
              </span>
            ` : `
              <span>Chưa có đánh giá</span>
            `}

            <span class="detail-rating-separator">|</span>

            <span>
              <span id="detail-sold-count">${getSoldCount(p.productId)}</span> đã bán
            </span>

          </div>

          <div class="detail-price">
            ${jodokSalePriceMarkup(p.productId, originalPrice)}
          </div>

          <div class="detail-options">

            <!-- SIZE -->

            <h3>Kích thước</h3>

            <div class="detail-option-row">

              ${sizes.length
                ? sizes.map(size => `
                    <button
                      type="button"
                      class="${selectedSize === size ? "active" : ""}"
                      onclick="selectSize(decodeURIComponent('${encodeURIComponent(size)}'))"
                    >
                      ${detailEscape(size)}
                    </button>
                  `).join("")
                : `
                    <span class="detail-option-hint">
                      Chưa có biến thể size
                    </span>
                  `
              }

            </div>

            <!-- COLOR AS TEXT -->

            <h3>Màu sắc</h3>

            <div class="detail-option-row">

              ${selectedSize
                ? colors.length
                  ? colors.map(color => `
                      <button
                        type="button"
                        class="${selectedColor === color ? "active" : ""}"
                        onclick="selectColor(decodeURIComponent('${encodeURIComponent(color)}'))"
                      >
                        ${detailEscape(color)}
                      </button>
                    `).join("")
                  : `
                      <span class="detail-option-hint">
                        Không có màu khả dụng
                      </span>
                    `
                : `
                    <span class="detail-option-hint">
                      Vui lòng chọn kích thước trước
                    </span>
                  `
              }

            </div>

            <!-- QUANTITY -->

            <div class="detail-qty-row">

              <strong>Số lượng</strong>

              <div class="detail-qty">

                <button
                  type="button"
                  onclick="detailChangeQty(-1)"
                >−</button>

                <input
                  id="detailQty"
                  type="number"
                  min="1"
                  max="${stock || 1}"
                  value="${selectedQty}"
                  onchange="changeQty(this.value)"
                >

                <button
                  type="button"
                  onclick="detailChangeQty(1)"
                >+</button>

              </div>

            </div>

            <p class="detail-stock">

              ${variant
                ? stock > 0
                  ? `Còn ${stock} sản phẩm`
                  : "Hết hàng"
                : "Chọn size và màu để xem tồn kho"
              }

            </p>

          </div>

          <!-- PURCHASE ACTIONS -->
          <div class="detail-purchase-actions">

            <button
              type="button"
              class="detail-add-cart"
              onclick="addToCart()"
            >
              ${icon("shopping-cart", "w-5 h-5")}
              Thêm vào giỏ hàng
            </button>

            <button
              type="button"
              class="detail-buy-now"
              onclick="buyNow()"
            >
              ${icon("zap", "w-5 h-5")}
              Mua ngay
            </button>

          </div>

          <!-- STORE POLICIES -->

          <div class="detail-promises">

            <div>
              ${icon("truck", "w-5 h-5")}

              <span>
                <b>Miễn phí vận chuyển</b>
                <small>Đơn từ 999.000đ</small>
              </span>
            </div>

            <div>
              ${icon("refresh-cw", "w-5 h-5")}

              <span>
                <b>Đổi trả 7 ngày</b>
                <small>Theo chính sách cửa hàng</small>
              </span>
            </div>

            <div>
              ${icon("shield-check", "w-5 h-5")}

              <span>
                <b>Cam kết chính hãng</b>
                <small>Thông tin minh bạch</small>
              </span>
            </div>

          </div>

        </div>

      </div>

      <!-- DESCRIPTION -->

      <section class="detail-description">

        <h2>Mô tả sản phẩm</h2>

        <div class="detail-description-content">
          ${detailEscape(
            p.description || "Sản phẩm chưa có mô tả."
          ).replace(/\n/g, "<br>")}
        </div>

      </section>

      <!-- REVIEW FORM -->

      ${reviewFormSection()}

      <!-- CUSTOMER REVIEWS -->

      <div id="detailFeedbackMount">
        ${feedbackSection()}
      </div>

      <!-- RELATED PRODUCTS -->

      <div id="detail-related-placeholder">${detailRelatedSection()}</div>

    </main>

  ` + footer();
}

/* =========================================
   LOAD PRODUCT DETAIL
========================================= */

async function loadDetailPage() {
  const params = new URLSearchParams(location.search);

  const productId = params.get("productId")
    ? Number(params.get("productId"))
    : null;

  showReviewForm = params.get("review") === "1";

  if (!productId) {
    renderApp(
      header() +
      `<main class="wrap py-20">Không tìm thấy sản phẩm.</main>` +
      footer()
    );
    return;
  }

  try {

    // Independent API requests must not block one another across Singapore/US.
    const salePricesTask = loadJodokSalePrices();

    // PRODUCT

    try {
      selectedProduct = await fetchJson(
        `${API_BASE}/products/${productId}`
      );
    } catch (error) {
      const all = await fetchJson(`${API_BASE}/products`);

      selectedProduct = all.find(
        p => Number(p.productId) === productId
      );
    }

    if (!selectedProduct) {
      renderApp(
        header() +
        `<main class="wrap py-20">Không tìm thấy sản phẩm.</main>` +
        footer()
      );
      return;
    }

    // Variant, review and current sale price load concurrently.
    const [variantResult, reviewResult] = await Promise.all([
      fetchJson(`${API_BASE}/variants/product/${productId}`).catch(() => []),
      fetchJson(`${API_BASE}/reviews/product/${productId}`).catch(() => []),
      salePricesTask
    ]).then(([v, r]) => [v, r]);
    selectedProductVariants = Array.isArray(variantResult) ? variantResult : [];
    productFeedbacks = Array.isArray(reviewResult) ? reviewResult : [];

    // RESET SELECTION

    selectedSize = "";
    selectedColor = "";
    selectedQty = 1;

    detailImageIndex = 0;
    detailReviewPage = 1;

    // RELATED PRODUCTS

    // Product detail is usable before the secondary recommendation query finishes.
    renderApp(detailPage());
    loadDetailRelatedProducts(productId).then(() => {
      // Update only the related section; never reset the user's chosen size/color.
      const mount = document.getElementById("detail-related-placeholder");
      if (mount && Number(selectedProduct?.productId) === productId) {
        mount.innerHTML = detailRelatedSection();
        const soldNode = document.getElementById("detail-sold-count");
        if (soldNode) soldNode.textContent = getSoldCount(productId);
        if (window.lucide) lucide.createIcons();
      }
    }).catch(error => console.warn("Không tải được gợi ý:", error));

  } catch (error) {
    console.error("LOAD DETAIL ERROR:", error);

    renderApp(
      header() +
      `<main class="wrap py-20">Không tải được sản phẩm.</main>` +
      footer()
    );
  }
}

/* =========================================
   SELECT VARIANT
========================================= */

function selectSize(size) {
  selectedSize = size;
  selectedColor = "";
  selectedQty = 1;

  renderApp(detailPage());
}

function selectColor(color) {
  selectedColor = color;

  // Khi đổi màu, trở về ảnh đầu tiên
  detailImageIndex = 0;

  // Reset số lượng
  selectedQty = 1;

  // Render lại trang chi tiết
  renderApp(detailPage());
}

/* =========================================
   ADD TO CART
========================================= */

async function addToCart() {

  const user = getUser();


  /*
   * =========================================================
   * CHECK LOGIN
   * =========================================================
   */
  if (!user || !user.token) {

    showToast(
      "Chưa đăng nhập",
      "Vui lòng đăng nhập để tiếp tục",
      "error"
    );

    setTimeout(() => {
      location.href = "/auth";
    }, 1000);

    return false;
  }


  /*
   * =========================================================
   * GET SELECTED VARIANT
   * =========================================================
   */
  const variant = getSelectedVariant();


  if (!variant) {

    showToast(
      "Thiếu thông tin",
      "Vui lòng chọn đầy đủ kích thước và màu sắc",
      "error"
    );

    return false;
  }


  /*
   * Variant phải có ID.
   */
  const variantId = Number(
    variant.variantId
  );


  if (
    !Number.isInteger(variantId) ||
    variantId <= 0
  ) {

    console.error(
      "Variant không hợp lệ:",
      variant
    );

    showToast(
      "Không thể thêm",
      "Không xác định được biến thể sản phẩm",
      "error"
    );

    return false;
  }


  /*
   * =========================================================
   * STOCK
   * =========================================================
   */
  const stock = Number(
    variant.stock || 0
  );


  if (stock <= 0) {

    showToast(
      "Hết hàng",
      "Sản phẩm hiện đã hết hàng",
      "error"
    );

    return false;
  }


  /*
   * =========================================================
   * QUANTITY
   * =========================================================
   */
  const quantity = Number(
    selectedQty
  );


  if (
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {

    showToast(
      "Số lượng không hợp lệ",
      "Số lượng phải lớn hơn 0",
      "error"
    );

    return false;
  }


  if (quantity > stock) {

    showToast(
      "Không đủ hàng",
      `Sản phẩm chỉ còn ${stock} sản phẩm`,
      "error"
    );

    return false;
  }


  /*
   * =========================================================
   * REQUEST BODY
   * =========================================================
   */
  const payload = {

    /*
     * Backend sẽ lấy userId từ JWT.
     *
     * Vẫn gửi userId để tương thích code cũ,
     * nhưng backend không tin giá trị này.
     */
    userId: user.userId,

    variantId: variantId,

    quantity: quantity
  };


  console.log(
    "ADD CART PAYLOAD:",
    payload
  );


  try {

    /*
     * =========================================================
     * CALL API
     * =========================================================
     */
    const response = await fetch(
      `${API_BASE}/cart/add`,
      {

        method: "POST",

        headers: {

          "Content-Type":
            "application/json",

          "Accept":
            "application/json",

          "Authorization":
            "Bearer " + user.token
        },

        body: JSON.stringify(
          payload
        )
      }
    );


    /*
     * =========================================================
     * READ RESPONSE SAFELY
     * =========================================================
     *
     * Không gọi response.json() trực tiếp.
     *
     * Vì nếu backend trả body rỗng:
     *
     * Unexpected end of JSON input
     */
    const rawText =
      await response.text();


    let data = null;


    if (
      rawText &&
      rawText.trim() !== ""
    ) {

      try {

        data =
          JSON.parse(rawText);

      } catch (parseError) {

        console.error(
          "Response không phải JSON:",
          rawText
        );

        data = {
          message: rawText
        };
      }
    }


    console.log(
      "ADD CART STATUS:",
      response.status
    );

    console.log(
      "ADD CART RESPONSE:",
      data
    );


    /*
     * =========================================================
     * HTTP ERROR
     * =========================================================
     */
    if (!response.ok) {

      let message =
        data?.message ||
        "Thêm giỏ hàng thất bại";


      /*
       * Token hết hạn.
       */
      if (response.status === 401) {

        message =
          "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
      }


      /*
       * Không có quyền.
       */
      if (response.status === 403) {

        message =
          data?.message ||
          "Tài khoản không có quyền thêm giỏ hàng.";
      }


      /*
       * Hiện lỗi thật ra màn hình.
       */
      showToast(
        "Không thể thêm",
        message,
        "error"
      );


      return false;
    }


    /*
     * =========================================================
     * SUCCESS
     * =========================================================
     */
    showToast(
      "Thành công",
      "Sản phẩm đã được thêm vào giỏ hàng",
      "success"
    );


    /*
     * Cập nhật icon số lượng cart.
     *
     * Không để lỗi updateCartCount làm
     * addToCart bị coi là thất bại.
     */
    try {

      await updateCartCount();

    } catch (countError) {

      console.warn(
        "Không cập nhật được cart count:",
        countError
      );
    }


    return true;


  } catch (error) {

    console.error(
      "ADD TO CART ERROR:",
      error
    );


    showToast(
      "Lỗi kết nối",
      error?.message ||
      "Không kết nối được backend",
      "error"
    );


    return false;
  }
}

/* =========================================
   BUY NOW
========================================= */
async function buyNow() {
  const success = await addToCart();

  if (success) {
    location.href = "/cart";
  }
}

/* =========================================
   REVIEW PAGINATION
========================================= */

function detailReviewPagination(page) {
  const totalPages = Math.ceil(
    productFeedbacks.length / DETAIL_REVIEWS_PER_PAGE
  );

  if (page < 1 || page > totalPages) return;

  detailReviewPage = page;

  const mount = document.getElementById(
    "detailFeedbackMount"
  );

  if (mount) {
    mount.innerHTML = feedbackSection();
  }
}

/* =========================================
   CUSTOMER REVIEWS
========================================= */


function feedbackSection() {
  const totalReviews = productFeedbacks.length;

  const totalPages = Math.ceil(
    totalReviews / DETAIL_REVIEWS_PER_PAGE
  );

  const start =
    (detailReviewPage - 1) * DETAIL_REVIEWS_PER_PAGE;

  const visibleReviews = productFeedbacks.slice(
    start,
    start + DETAIL_REVIEWS_PER_PAGE
  );

  const averageRating = totalReviews
    ? (
        productFeedbacks.reduce(
          (sum, review) => sum + Number(review.rating || 0),
          0
        ) / totalReviews
      ).toFixed(1)
    : "0.0";

  const renderStars = rating => {
    const count = Math.max(
      0,
      Math.min(5, Math.round(Number(rating) || 0))
    );

    return `
      <span class="detail-review-stars">
        ${"★".repeat(count)}
        <span>${"★".repeat(5 - count)}</span>
      </span>
    `;
  };

  return `
    <section class="detail-feedback">

      <div class="detail-section-heading">
        <h2>ĐÁNH GIÁ SẢN PHẨM</h2>
        <span>${totalReviews} đánh giá</span>
      </div>

      ${totalReviews ? `

        <div class="detail-review-summary">

          <div class="detail-review-score">
            <div>
              <strong>${averageRating}</strong>
              <span>trên 5</span>
            </div>

            ${renderStars(averageRating)}
          </div>

          <div class="detail-review-filters">

            <span class="detail-review-filter active">
              Tất cả (${totalReviews})
            </span>

            ${[5, 4, 3, 2, 1].map(star => {
              const count = productFeedbacks.filter(
                review => Number(review.rating) === star
              ).length;

              return `
                <button
                  type="button"
                  class="detail-review-filter"
                  onclick="detailFilterReviews(${star})"
                >
                  ${star} Sao (${count})
                </button>
              `;
            }).join("")}

          </div>

        </div>

      ` : ""}

      <div class="detail-review-list">

        ${visibleReviews.length
          ? visibleReviews.map(review => {

              const customerName =
                review.user?.fullname ||
                review.user?.fullName ||
                review.user?.email ||
                "Khách hàng";

              const reviewDate = review.createdAt
                ? new Date(review.createdAt)
                    .toLocaleDateString("vi-VN")
                : "";

              const reviewImages = [
                ...(Array.isArray(review.images)
                  ? review.images.map(image =>
                      typeof image === "string"
                        ? image
                        : image.imageUrl
                    )
                  : []),
                review.imageUrl
              ].filter(Boolean);

              const uniqueImages = [...new Set(reviewImages)];

              return `
                <article class="detail-review-item">

                  <div class="detail-review-avatar">
                    ${detailEscape(
                      customerName.charAt(0).toUpperCase()
                    )}
                  </div>

                  <div class="detail-review-body">

                    <div class="detail-review-name">
                      ${detailEscape(customerName)}
                    </div>

                    ${renderStars(review.rating)}

                    <div class="detail-review-date">
                      ${detailEscape(reviewDate)}
                    </div>

                    <p class="detail-review-comment">
                      ${detailEscape(review.comment || "")}
                    </p>

                    <div class="detail-review-photos">

                      ${uniqueImages.map(url => `
                        <a
                          href="${detailEscape(url)}"
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Xem ảnh đánh giá"
                        >
                          <img
                            src="${detailEscape(url)}"
                            alt="Ảnh đánh giá sản phẩm"
                            loading="lazy"
                            onerror="this.parentElement.style.display='none'"
                          >
                        </a>
                      `).join("")}

                    </div>

                    <div class="detail-review-variant">
                      Phân loại:
                      Size ${detailEscape(
                        review.orderItem?.variant?.size || "-"
                      )}
                      · Màu ${detailEscape(
                        review.orderItem?.variant?.color || "-"
                      )}
                    </div>

                  </div>

                </article>
              `;

            }).join("")

          : `
            <p class="detail-review-empty">
              Chưa có đánh giá từ đơn hàng hoàn thành.
            </p>
          `
        }

      </div>

      ${totalPages > 1 ? `

        <nav
          class="detail-review-pages"
          aria-label="Phân trang đánh giá"
        >

          <button
            type="button"
            onclick="detailReviewPagination(${detailReviewPage - 1})"
            ${detailReviewPage === 1 ? "disabled" : ""}
          >‹</button>

          ${Array.from(
            { length: totalPages },
            (_, index) => index + 1
          ).map(page => `

            <button
              type="button"
              class="${page === detailReviewPage ? "active" : ""}"
              onclick="detailReviewPagination(${page})"
            >
              ${page}
            </button>

          `).join("")}

          <button
            type="button"
            onclick="detailReviewPagination(${detailReviewPage + 1})"
            ${detailReviewPage === totalPages ? "disabled" : ""}
          >›</button>

        </nav>

      ` : ""}

    </section>
  `;
}

function detailFilterReviews(star) {
  const buttons = document.querySelectorAll(
    ".detail-review-filter"
  );

  buttons.forEach(button => {
    button.classList.remove("active");
  });

  const selectedButton = [...buttons].find(
    button => button.textContent.trim().startsWith(`${star} Sao`)
  );

  if (selectedButton) {
    selectedButton.classList.add("active");
  }

  const reviews = document.querySelectorAll(
    ".detail-review-item"
  );

  const start =
    (detailReviewPage - 1) * DETAIL_REVIEWS_PER_PAGE;

  const visibleReviews = productFeedbacks.slice(
    start,
    start + DETAIL_REVIEWS_PER_PAGE
  );

  reviews.forEach((element, index) => {
    element.style.display =
      Number(visibleReviews[index]?.rating) === star
        ? ""
        : "none";
  });
}


/* =========================================
   REVIEW FORM
========================================= */

function reviewFormSection() {
  if (!showReviewForm || !selectedProduct) return "";

  return `
    <section class="detail-description">

      <h2>Đánh giá sản phẩm</h2>

      <div class="grid md:grid-cols-[120px_1fr] gap-6">

        <img
          src="${detailEscape(getProductImg(selectedProduct, 0))}"
          alt="${detailEscape(selectedProduct.productName)}"
          class="w-28 h-36 object-cover rounded-2xl border"
        >

        <div>

          <b class="text-xl">
            ${detailEscape(selectedProduct.productName)}
          </b>

          <div class="mt-5">

            <label for="reviewRating" class="font-bold">
              Số sao
            </label>

            <input
              id="reviewRating"
              type="number"
              min="1"
              max="5"
              value="5"
              class="block mt-2 border rounded-xl px-4 py-3 w-32"
            >

          </div>

          <div class="mt-5">

            <label for="reviewComment" class="font-bold">
              Nội dung đánh giá
            </label>

            <textarea
              id="reviewComment"
              class="w-full mt-2 border rounded-2xl px-5 py-4 h-32"
              placeholder="Nhập cảm nhận của bạn về sản phẩm..."
            ></textarea>

          </div>

          <div class="mt-5">

            <label class="font-bold">
              Hình ảnh sản phẩm
            </label>

            <p class="text-sm text-neutral-500 mt-1">
              Không bắt buộc · JPG, PNG, WEBP · tối đa 5MB
            </p>

            <input
              id="reviewImage"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onchange="selectReviewImage(event)"
              class="hidden"
            >

            <label
              for="reviewImage"
              class="mt-3 border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-red-800 transition"
            >

              ${icon("image-plus", "w-8 h-8")}

              <span class="mt-2 font-semibold">
                Thêm hình ảnh
              </span>

              <span class="text-sm text-neutral-500">
                Chọn ảnh thực tế của sản phẩm
              </span>

            </label>

            <div
              id="reviewImagePreview"
              class="mt-4"
            ></div>

          </div>

          <button
            id="submitReviewBtn"
            type="button"
            onclick="submitReview()"
            class="mt-5 bg-red-800 text-white rounded-full px-8 py-3 font-bold"
          >
            Gửi đánh giá
          </button>

        </div>

      </div>

    </section>
  `;
}

/* =========================================
   REVIEW IMAGE
========================================= */

function selectReviewImage(event) {
  const file = event.target.files?.[0];

  if (!file) {
    removeReviewImage();
    return;
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (!allowedTypes.includes(file.type)) {
    showToast(
      "Ảnh không hợp lệ",
      "Chỉ chấp nhận JPG, PNG hoặc WEBP",
      "error"
    );

    event.target.value = "";
    reviewImageFile = null;
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    showToast(
      "Ảnh quá lớn",
      "Ảnh không được vượt quá 5MB",
      "error"
    );

    event.target.value = "";
    reviewImageFile = null;
    return;
  }

  reviewImageFile = file;

  if (reviewImagePreviewUrl) {
    URL.revokeObjectURL(reviewImagePreviewUrl);
  }

  reviewImagePreviewUrl = URL.createObjectURL(file);

  const preview = document.getElementById(
    "reviewImagePreview"
  );

  if (!preview) return;

  preview.innerHTML = `
    <div class="relative w-32">

      <img
        src="${reviewImagePreviewUrl}"
        alt="Ảnh xem trước"
        class="w-32 h-32 object-cover rounded-2xl border"
      >

      <button
        type="button"
        onclick="removeReviewImage()"
        class="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-black text-white font-bold flex items-center justify-center"
        aria-label="Xóa ảnh"
      >
        ×
      </button>

    </div>
  `;
}

function removeReviewImage() {
  reviewImageFile = null;

  if (reviewImagePreviewUrl) {
    URL.revokeObjectURL(reviewImagePreviewUrl);
    reviewImagePreviewUrl = null;
  }

  const input = document.getElementById("reviewImage");

  if (input) input.value = "";

  const preview = document.getElementById(
    "reviewImagePreview"
  );

  if (preview) preview.innerHTML = "";
}

/* =========================================
   SUBMIT REVIEW
========================================= */

async function submitReview() {
  const user = getUser();

  if (!user?.token) {
    showToast(
      "Chưa đăng nhập",
      "Vui lòng đăng nhập để đánh giá",
      "error"
    );
    return;
  }

  const rating = Number(
    document.getElementById("reviewRating")?.value
  );

  const comment = document
    .getElementById("reviewComment")
    ?.value.trim() || "";

  if (
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    showToast(
      "Lỗi",
      "Số sao phải từ 1 đến 5",
      "error"
    );
    return;
  }

  if (!comment) {
    showToast(
      "Lỗi",
      "Vui lòng nhập nội dung đánh giá",
      "error"
    );
    return;
  }

  const params = new URLSearchParams(location.search);
  const orderItemId = params.get("orderItemId");

  if (!orderItemId) {
    showToast(
      "Lỗi",
      "Không xác định được sản phẩm trong đơn hàng",
      "error"
    );
    return;
  }

  const button = document.getElementById(
    "submitReviewBtn"
  );

  try {
    if (button) {
      button.disabled = true;
      button.innerText = "Đang gửi...";
      button.classList.add("opacity-60");
    }

    const imageUrl = await uploadReviewImage();

    const response = await fetch(
      `${API_BASE}/reviews`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + user.token
        },

        body: JSON.stringify({
          orderItemId: Number(orderItemId),
          rating,
          comment,
          imageUrl
        })
      }
    );

    if (!response.ok) {
      let message = "Không thể gửi đánh giá";

      try {
        const data = await response.json();

        message =
          data.message ||
          data.error ||
          message;
      } catch (error) {}

      throw new Error(message);
    }

    showToast(
      "Thành công",
      "Đã gửi đánh giá sản phẩm",
      "success"
    );

    setTimeout(() => {
      location.href =
        `/detail?productId=${selectedProduct.productId}`;
    }, 1000);

  } catch (error) {
    console.error(error);

    showToast(
      "Lỗi",
      error.message || "Không thể gửi đánh giá",
      "error"
    );

  } finally {
    if (button) {
      button.disabled = false;
      button.innerText = "Gửi đánh giá";
      button.classList.remove("opacity-60");
    }
  }
}

/* =========================================
   UPLOAD REVIEW IMAGE
========================================= */

async function uploadReviewImage() {
  if (!reviewImageFile) return null;

  const user = getUser();

  if (!user?.token) {
    throw new Error("Bạn chưa đăng nhập");
  }

  const formData = new FormData();

  formData.append("file", reviewImageFile);

  const response = await fetch(
    `${API_BASE}/upload/image`,
    {
      method: "POST",

      headers: {
        "Authorization": "Bearer " + user.token
      },

      body: formData
    }
  );

  const text = await response.text();

  if (!response.ok) {
    let message = "Upload ảnh thất bại";

    if (text) {
      try {
        const data = JSON.parse(text);

        message =
          data.message ||
          data.error ||
          message;
      } catch (error) {
        message = text;
      }
    }

    throw new Error(message);
  }

  if (!text) {
    throw new Error(
      "Backend upload ảnh không trả dữ liệu"
    );
  }

  let data;

  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(
      "Dữ liệu trả về từ upload ảnh không hợp lệ"
    );
  }

  if (!data.imageUrl) {
    throw new Error(
      "Backend không trả về imageUrl"
    );
  }

  return data.imageUrl;
}

/* =========================================
   INITIALIZE
========================================= */

loadDetailPage();