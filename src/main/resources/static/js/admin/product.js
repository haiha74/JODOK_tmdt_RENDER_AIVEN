
/*
 * JODOK ADMIN - PRODUCT MANAGEMENT
 * Quản lý sản phẩm, ảnh và biến thể
 * Sử dụng cùng admin/admin.js
 */

// ============================================
// FILTERS
// ============================================

function changeProductFilter(type, value) {
  if (type === "category") productCategoryFilter = value;
  if (type === "brand") productBrandFilter = value;
  if (type === "status") productStatusFilter = value;

  productPage = 1;
  render();
}

function applyProductSearch(input) {
  if (!input || !input.isConnected) return;

  const value = input.value;
  const start = input.selectionStart;
  const end = input.selectionEnd;

  adminSearch.products = value.trim().toLowerCase();
  productPage = 1;

  render();

  const replacement = document.querySelector(
    '[data-search="products"]'
  );

  if (replacement) {
    replacement.focus({ preventScroll: true });

    try {
      replacement.setSelectionRange(start, end);
    } catch (_) {}
  }
}

function searchProductAdmin(input) {
  if (input.isComposing || window.productSearchComposing) {
    return;
  }

  clearTimeout(productSearchTimer);

  productSearchTimer = setTimeout(
    () => applyProductSearch(input),
    350
  );
}

function finishProductSearch(input) {
  window.productSearchComposing = false;
  clearTimeout(productSearchTimer);

  productSearchTimer = setTimeout(
    () => applyProductSearch(input),
    0
  );
}

async function refreshProductFilterOptions() {
  const headers = adminAuthHeaders();

  const results = await Promise.allSettled([
    fetch(`${API_BASE}/categories`, {
      headers,
      cache: "no-store"
    }).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }),

    fetch(`${API_BASE}/brands`, {
      headers,
      cache: "no-store"
    }).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
  ]);

  if (currentTab !== "products") return;

  if (
    results[0].status === "fulfilled" &&
    Array.isArray(results[0].value)
  ) {
    categories = results[0].value;
  }

  if (
    results[1].status === "fulfilled" &&
    Array.isArray(results[1].value)
  ) {
    brands = results[1].value;
  }

  const toolbar = document.querySelector(
    ".admin-product-toolbar"
  );

  if (!toolbar) return;

  const category = toolbar.querySelector(
    '[data-product-filter="category"]'
  );

  const brand = toolbar.querySelector(
    '[data-product-filter="brand"]'
  );

  if (category) {
    category.innerHTML = productCategoryOptions();
    category.value = productCategoryFilter || "";
  }

  if (brand) {
    brand.innerHTML = productBrandOptions();
    brand.value = productBrandFilter || "";
  }
}

function productCategoryOptions() {
  return `<option value="">Danh mục</option>` +
    categories.map(c => `
      <option value="${c.categoryId}">
        ${escapeHtml(c.categoryName || "")}
        ${c.parent == null ? "(Danh mục cha)" : ""}
      </option>
    `).join("");
}

function productBrandOptions() {
  return `<option value="">Thương hiệu</option>` +
    brands.map(b => `
      <option value="${b.brandId}">
        ${escapeHtml(b.brandName || "")}
      </option>
    `).join("");
}

// ============================================
// PAGINATION
// ============================================

function changeProductPage(page) {
  productPage = page;
  render();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function productPagination(totalPages) {
  if (totalPages <= 1) return "";

  const pages = [];

  for (let p = 1; p <= totalPages; p++) {
    if (
      totalPages <= 7 ||
      p === 1 ||
      p === totalPages ||
      Math.abs(p - productPage) <= 2
    ) {
      pages.push(p);
    }
  }

  let previous = 0;

  const buttons = pages.map(page => {
    const dots = page - previous > 1
      ? `<span class="product-page-dots">...</span>`
      : "";

    previous = page;

    return dots + `
      <button
        type="button"
        onclick="changeProductPage(${page})"
        class="product-page-number ${
          productPage === page ? "active" : ""
        }">
        ${page}
      </button>
    `;
  }).join("");

  return `
    <div class="admin-product-pagination">

      <button
        type="button"
        class="product-page-arrow"
        onclick="changeProductPage(${Math.max(1, productPage - 1)})"
        ${productPage === 1 ? "disabled" : ""}>
        ${icon("chevron-left", "w-4 h-4")}
      </button>

      ${buttons}

      <button
        type="button"
        class="product-page-arrow"
        onclick="changeProductPage(${Math.min(totalPages, productPage + 1)})"
        ${productPage === totalPages ? "disabled" : ""}>
        ${icon("chevron-right", "w-4 h-4")}
      </button>

    </div>
  `;
}

// ============================================
// PRODUCT IMAGE DISPLAY
// ============================================

function jodokAdminProductImage(p, index) {
  const image = productImg(p, index);

  if (
    !image ||
    image === "/images/no-image.png" ||
    image === "null" ||
    image === "undefined"
  ) {
    return `
      <span style="
        display:inline-flex;
        width:60px;
        height:55px;
        align-items:center;
        justify-content:center;
        background:#f5f5f5;
        color:#999;
        font-size:11px;
        border-radius:8px;
        text-align:center">
        Chưa có ảnh
      </span>
    `;
  }

  return `
    <img
      src="${escapeHtml(image)}"
      class="admin-product-image"
      alt="${escapeHtml(p.productName || "")}"
      onerror="
        this.onerror=null;
        this.style.display='none';
        const span=document.createElement('span');
        span.textContent='Chưa có ảnh';
        span.style.cssText='font-size:11px;color:#999';
        this.insertAdjacentElement('afterend',span);
      "
    >
  `;
}

// ============================================
// PRODUCT TABLE
// ============================================

function productTable() {
  const keyword = (
    adminSearch.products || ""
  ).trim().toLowerCase();

  const filtered = products.filter(p => {
    const name = (
      p.productName || ""
    ).toLowerCase();

    const categoryName = (
      p.category?.categoryName || ""
    ).toLowerCase();

    const brandName = (
      p.brand?.brandName || ""
    ).toLowerCase();

    const matchKeyword =
      name.includes(keyword) ||
      categoryName.includes(keyword) ||
      brandName.includes(keyword);

    const matchCategory =
      !productCategoryFilter ||
      String(p.category?.categoryId || "") ===
      String(productCategoryFilter);

    const matchBrand =
      !productBrandFilter ||
      String(p.brand?.brandId || "") ===
      String(productBrandFilter);

    const matchStatus =
      !productStatusFilter ||
      p.status === productStatusFilter;

    return matchKeyword &&
      matchCategory &&
      matchBrand &&
      matchStatus;
  });

  const totalProducts = filtered.length;
  const totalPages = Math.max(
    1,
    Math.ceil(totalProducts / productPageSize)
  );

  productPage = Math.max(
    1,
    Math.min(productPage, totalPages)
  );

  const start = (productPage - 1) * productPageSize;

  const list = filtered.slice(
    start,
    start + productPageSize
  );

  return `
    <div class="admin-product-page">

      <div class="admin-product-toolbar">

        <div class="admin-product-search">

          ${icon("search", "w-4 h-4")}

          <input
            data-search="products"
            type="search"
            value="${escapeHtml(adminSearch.products || "")}"
            oninput="searchProductAdmin(this)"
            oncompositionstart="
              window.productSearchComposing=true
            "
            oncompositionend="finishProductSearch(this)"
            placeholder="Tìm kiếm sản phẩm..."
            autocomplete="off"
            spellcheck="false">

        </div>

        <select
          class="admin-product-filter"
          data-product-filter="category"
          onchange="changeProductFilter('category',this.value)">
          ${productCategoryOptions()}
        </select>

        <select
          class="admin-product-filter"
          data-product-filter="brand"
          onchange="changeProductFilter('brand',this.value)">
          ${productBrandOptions()}
        </select>

        <select
          class="admin-product-filter"
          onchange="changeProductFilter('status',this.value)">

          <option value="">Trạng thái</option>

          <option value="ACTIVE"
            ${productStatusFilter === "ACTIVE" ? "selected" : ""}>
            Đang bán
          </option>

          <option value="INACTIVE"
            ${productStatusFilter === "INACTIVE" ? "selected" : ""}>
            Ngừng bán
          </option>

        </select>

        <button
          type="button"
          onclick="openProductForm()"
          class="admin-add-product">
          ${icon("plus", "w-4 h-4")}
          <span>Thêm sản phẩm</span>
        </button>

      </div>

      <div class="admin-product-table-wrap">

        <table class="admin-product-table">

          <thead>
            <tr>
              <th>#</th>
              <th>Ảnh</th>
              <th>Tên sản phẩm</th>
              <th>Danh mục</th>
              <th>Thương hiệu</th>
              <th>Giá</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>

          <tbody>

            ${
              list.length
                ? list.map((p, index) => {
                    const active = p.status === "ACTIVE";

                    return `
                      <tr>

                        <td class="product-index">
                          ${start + index + 1}
                        </td>

                        <td>
                          ${jodokAdminProductImage(p, index)}
                        </td>

                        <td>
                          <div class="admin-product-name">

                            <strong>
                              ${escapeHtml(p.productName || "Chưa có tên")}
                            </strong>

                            ${
                              productHasVariant(p.productId)
                                ? ""
                                : `
                                  <span class="product-no-variant">
                                    Chưa có biến thể
                                  </span>
                                `
                            }

                          </div>
                        </td>

                        <td>
                          ${escapeHtml(p.category?.categoryName || "Chưa có")}
                        </td>

                        <td>
                          ${escapeHtml(getActiveBrandName(p) || "-")}
                        </td>

                        <td class="admin-product-price">
                          ${money(p.basePrice)}
                        </td>

                        <td>
                          <span class="admin-product-status ${
                            active ? "active" : "inactive"
                          }">
                            ${active ? "Đang bán" : "Ngừng bán"}
                          </span>
                        </td>

                        <td>
                          <div class="admin-product-actions">

                            <button
                              type="button"
                              onclick="openProductForm(${p.productId})"
                              title="Chỉnh sửa"
                              class="product-action edit">
                              ${icon("pencil", "w-4 h-4")}
                            </button>

                            ${
                              active
                                ? `
                                  <button
                                    type="button"
                                    onclick="hideProduct(${p.productId})"
                                    title="Ẩn sản phẩm"
                                    class="product-action view">
                                    ${icon("eye", "w-4 h-4")}
                                  </button>
                                `
                                : `
                                  <button
                                    type="button"
                                    onclick="showProduct(${p.productId})"
                                    title="Hiện sản phẩm"
                                    class="product-action view">
                                    ${icon("eye-off", "w-4 h-4")}
                                  </button>
                                `
                            }

                            <button
                              type="button"
                              onclick="deleteProduct(${p.productId})"
                              title="Xóa sản phẩm"
                              aria-label="Xóa sản phẩm"
                              class="product-action delete">
                              ${icon("trash-2", "w-4 h-4")}
                            </button>

                          </div>
                        </td>

                      </tr>
                    `;
                  }).join("")
                : `
                  <tr>
                    <td colspan="8" class="admin-product-empty">
                      Không tìm thấy sản phẩm
                    </td>
                  </tr>
                `
            }

          </tbody>

        </table>

      </div>

      <div class="admin-product-footer">

        <p>
          Hiển thị
          <b>${list.length ? start + 1 : 0}</b>
          –
          <b>${list.length ? start + list.length : 0}</b>
          / ${totalProducts} sản phẩm
        </p>

        ${productPagination(totalPages)}

      </div>

    </div>

    ${productModal()}
  `;
}

// ============================================
// PRODUCT MODAL
// ============================================

function productModal() {
  return `
    <div id="productModal"
      class="admin-product-modal hidden">

      <div class="admin-product-modal-box">

        <div class="admin-product-form-header">

          <div>
            <h2 id="productFormTitle">Thêm sản phẩm</h2>
            <p>Nhập thông tin sản phẩm trong hệ thống JODOK</p>
          </div>

          <button
            type="button"
            class="admin-product-modal-close"
            onclick="closeProductForm()">
            ${icon("x", "w-5 h-5")}
          </button>

        </div>

        <input type="hidden" id="productId">

        <div class="admin-product-form-body">

          <div class="admin-product-form-left">

            <!-- TÊN -->
            <div class="admin-form-group">
              <label for="productName">
                Tên sản phẩm <span>*</span>
              </label>

              <input
                id="productName"
                type="text"
                placeholder="Nhập tên sản phẩm"
                autocomplete="off">
            </div>

            <!-- BRAND + CATEGORY -->
            <div class="admin-form-row">

              <div class="admin-form-group">
                <label for="productBrand">
                  Thương hiệu
                </label>

                <select id="productBrand">
                  <option value="">Không chọn thương hiệu</option>

                  ${brands.map(b => `
                    <option value="${b.brandId}">
                      ${escapeHtml(b.brandName || "")}
                    </option>
                  `).join("")}

                </select>
              </div>

              <div class="admin-form-group">
                <label for="productCategory">
                  Danh mục <span>*</span>
                </label>

                <select id="productCategory">
                  <option value="">Chọn danh mục</option>

                  ${categories.map(c => `
                    <option value="${c.categoryId}">
                      ${escapeHtml(c.categoryName || "")}
                    </option>
                  `).join("")}

                </select>
              </div>

            </div>

            <!-- MÔ TẢ -->
            <div class="admin-form-group">

              <label for="productDesc">Mô tả</label>

              <div class="admin-description-editor">

                <div class="admin-editor-toolbar">
                  <button type="button"><b>B</b></button>
                  <button type="button"><i>I</i></button>
                  <button type="button"><u>U</u></button>
                  <span></span>
                  <button type="button">≡</button>
                  <button type="button">•</button>
                </div>

                <textarea
                  id="productDesc"
                  placeholder="Nhập mô tả sản phẩm..."></textarea>

              </div>
            </div>

            <!-- ẢNH -->
            <div class="admin-form-group">

              <label style="
                display:flex;
                align-items:center;
                gap:6px;
                font-weight:600;
                margin-bottom:10px">

                Hình ảnh sản phẩm

                <span style="color:#dc2626">*</span>

                <small style="color:#9ca3af;font-weight:400">
                  Bắt buộc ít nhất 1 ảnh
                </small>
              </label>

              <div
                class="admin-product-upload"
                onclick="
                  document.getElementById('productImageFile').click()
                ">

                <div class="admin-upload-icon">
                  ${icon("image-up", "w-7 h-7")}
                </div>

                <strong>
                  Kéo thả hình ảnh vào đây hoặc
                  <em>chọn file</em>
                </strong>

                <small>JPG, JPEG, PNG, WEBP</small>

              </div>

              <input
                id="productImageFile"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                onchange="previewImage(event)">

              <div
                id="productImagePreviewList"
                class="admin-product-preview-box"
                style="
                  display:flex;
                  flex-wrap:wrap;
                  gap:12px;
                  margin-top:12px">
              </div>

              <p class="admin-upload-note">
                <strong style="color:#991b1b">
                  * Bắt buộc ít nhất 1 ảnh.
                </strong>
                Tối đa 3 ảnh, mỗi ảnh không quá 5MB.
                Có thể nhập màu tương ứng.
              </p>

            </div>

            <!-- BIẾN THỂ -->
            <div
              id="productVariantsEditor"
              class="admin-form-group"
              style="margin-top:20px">

              <label>
                Biến thể sản phẩm
                <span>*</span>
              </label>

              <p style="
                font-size:12px;
                color:#6b7280;
                margin:6px 0 10px">
                Mỗi dòng là một tổ hợp màu và size.
                SKU phải duy nhất, tồn kho có thể bằng 0.
              </p>

              <div
                id="productVariantRows"
                style="display:grid;gap:10px">
              </div>

              <button
                type="button"
                onclick="addProductVariantRow()"
                style="
                  margin-top:10px;
                  border:1px solid #991b1b;
                  color:#991b1b;
                  border-radius:9px;
                  padding:9px 14px;
                  font-weight:600;
                  background:white">
                + Thêm size / màu
              </button>

            </div>

          </div>

          <!-- BÊN PHẢI -->
          <div class="admin-product-form-right">

            <h3>Thông tin cơ bản</h3>

            <div class="admin-form-group">

              <label for="productPrice">Giá gốc</label>

              <div class="admin-price-input">

                <input
                  id="productPrice"
                  type="number"
                  min="0"
                  placeholder="150000">

                <span>đ</span>

              </div>
            </div>

            <div class="admin-form-group">

              <label for="productStatus">Trạng thái</label>

              <select id="productStatus">
                <option value="ACTIVE">Đang bán</option>
                <option value="INACTIVE">Ngừng bán</option>
              </select>

            </div>

          </div>

        </div>

        <!-- FOOTER -->
        <div class="admin-product-form-footer">

          <button
            type="button"
            class="admin-product-cancel-btn"
            onclick="closeProductForm()">
            Hủy
          </button>

          <button
            type="button"
            id="productSaveButton"
            class="admin-product-save-btn"
            onclick="saveProduct()">

            ${icon("save", "w-4 h-4")}

            <span>Lưu sản phẩm</span>

          </button>

        </div>

      </div>
    </div>
  `;
}

// ============================================
// VARIANT ROWS
// ============================================

function addProductVariantRow(data = {}) {
  const list = document.getElementById(
    "productVariantRows"
  );

  if (!list) return;

  const row = document.createElement("div");

  row.className = "jodok-variant-row";

  row.style.cssText = `
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:8px;
    padding:12px;
    border:1px solid #e5e7eb;
    border-radius:12px;
    background:#fafafa;
  `;

  const fields = [
    ["size", "Size * (S, M, XL...)", "text", data.size || ""],
    ["color", "Màu * (Đen, Trắng...)", "text", data.color || ""],
    ["sku", "SKU * (duy nhất)", "text", data.sku || ""],
    ["price", "Giá biến thể *", "number", data.price ?? ""],
    ["stock", "Tồn kho *", "number", data.stock ?? 0]
  ];

  fields.forEach(([key, placeholder, type, value]) => {
    const field = document.createElement("label");

    field.style.cssText = `
      font-size:12px;
      font-weight:600;
      color:#374151;
    `;

    field.textContent = placeholder;

    const input = document.createElement("input");

    input.dataset.variantField = key;
    input.type = type;
    input.placeholder = placeholder;
    input.value = value;
    input.required = true;

    if (type === "number") {
      input.min = "0";
      input.step = key === "stock" ? "1" : "any";
    }

    input.style.cssText = `
      display:block;
      width:100%;
      box-sizing:border-box;
      margin-top:5px;
      padding:9px;
      border:1px solid #d1d5db;
      border-radius:8px;
      background:white;
    `;

    field.appendChild(input);
    row.appendChild(field);
  });

  const remove = document.createElement("button");

  remove.type = "button";
  remove.textContent = "Xóa dòng";

  remove.style.cssText = `
    border:0;
    background:#fee2e2;
    color:#991b1b;
    border-radius:8px;
    padding:8px;
    cursor:pointer;
  `;

  remove.onclick = () => row.remove();

  row.appendChild(remove);
  list.appendChild(row);
}

function collectProductVariantRows() {
  const rows = Array.from(
    document.querySelectorAll(
      "#productVariantRows .jodok-variant-row"
    )
  );

  const variants = [];
  const seenSku = new Set();
  const seenPair = new Set();

  for (const [index, row] of rows.entries()) {
    const get = key => {
      const input = row.querySelector(
        `[data-variant-field="${key}"]`
      );

      return input?.value.trim() || "";
    };

    const size = get("size");
    const color = get("color");
    const sku = get("sku");
    const priceRaw = get("price");
    const stockRaw = get("stock");

    const price = Number(priceRaw);
    const stock = Number(stockRaw);

    if (
      !size ||
      !color ||
      !sku ||
      priceRaw === "" ||
      stockRaw === "" ||
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      throw new Error(
        `Dòng ${index + 1}: ` +
        "Vui lòng nhập đầy đủ size, màu, SKU, giá và tồn kho hợp lệ."
      );
    }

    const skuKey = sku.toLowerCase();
    const pairKey =
      color.toLowerCase() + "::" + size.toLowerCase();

    if (seenSku.has(skuKey)) {
      throw new Error(
        `Dòng ${index + 1}: SKU "${sku}" bị trùng.`
      );
    }

    if (seenPair.has(pairKey)) {
      throw new Error(
        `Dòng ${index + 1}: Biến thể ${color}/${size} bị trùng.`
      );
    }

    seenSku.add(skuKey);
    seenPair.add(pairKey);

    variants.push({
      size,
      color,
      sku,
      price,
      stock,
      status: "ACTIVE"
    });
  }

  return variants;
}

// ============================================
// OPEN PRODUCT FORM
// ============================================

async function openProductForm(id = null) {
  selectedFiles = [];
  window.jodokSavedProductImages = [];

  const modal = document.getElementById(
    "productModal"
  );

  if (!modal) return;

  const get = key => document.getElementById(key);

  const isEdit =
    id !== null &&
    id !== undefined &&
    id !== "";

  const previewList = get("productImagePreviewList");
  const variantRows = get("productVariantRows");
  const variantEditor = get("productVariantsEditor");
  const fileInput = get("productImageFile");

  modal.classList.remove("hidden");
  modal.classList.add("flex");

  get("productFormTitle").textContent =
    isEdit ? "Sửa sản phẩm" : "Thêm sản phẩm";

  get("productId").value =
    isEdit ? String(id) : "";

  if (fileInput) fileInput.value = "";
  if (previewList) previewList.innerHTML = "";
  if (variantRows) variantRows.innerHTML = "";

  const p = isEdit
    ? products.find(
        x => Number(x.productId) === Number(id)
      )
    : null;

  if (isEdit && !p) {
    showToast(
      "Lỗi",
      "Không tìm thấy sản phẩm",
      "error"
    );

    closeProductForm();
    return;
  }

  get("productName").value =
    p?.productName || "";

  get("productDesc").value =
    p?.description || "";

  get("productPrice").value =
    p?.basePrice ?? "";

  get("productCategory").value =
    p?.category?.categoryId || "";

  get("productBrand").value =
    p?.brand?.brandId || "";

  get("productStatus").value =
    p?.status || "ACTIVE";

  const addButton = variantEditor?.querySelector(
    'button[onclick="addProductVariantRow()"]'
  );

  if (addButton) {
    addButton.style.display =
      isEdit ? "none" : "";
  }

  if (!isEdit) {
    addProductVariantRow();
    renderProductImagePreviews();
    return;
  }

  // Tải ảnh đã lưu
  try {
    const response = await fetch(
      `${API_BASE}/product-images/product/${id}?t=${Date.now()}`,
      {
        headers: adminAuthHeaders(),
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const images = await response.json();

    window.jodokSavedProductImages = (
      Array.isArray(images) ? images : []
    ).filter(image => image?.imageUrl);

  } catch (error) {
    console.warn("Lỗi tải ảnh:", error);

    // Không dùng p.images làm fallback: dữ liệu này có thể cũ
    // sau khi xóa ảnh; thay vào đó thông báo để tránh hiện ảnh đã xóa.
    window.jodokSavedProductImages = [];
    showToast("Không tải được ảnh", "Vui lòng mở lại sản phẩm sau khi kiểm tra kết nối.", "error");
  }

  if (get("productId")?.value !== String(id)) {
    return;
  }

  renderProductImagePreviews();

  // Tải biến thể cũ
  try {
    const response = await fetch(
      `${API_BASE}/variants/product/${id}`,
      {
        headers: adminAuthHeaders()
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (get("productId")?.value !== String(id)) {
      return;
    }

    if (variantRows) {
      variantRows.innerHTML = "";

      const list = Array.isArray(data) ? data : [];

      if (list.length) {
        list.forEach(v => {
          addProductVariantRow({
            size: v.size || "",
            color: v.color || "",
            sku: v.sku || "",
            price: v.price ?? "",
            stock: v.stock ?? 0
          });
        });

        variantRows.querySelectorAll(
          "input, button"
        ).forEach(el => {
          el.disabled = true;
        });

      } else {
        variantRows.textContent =
          "Sản phẩm chưa có biến thể.";
      }
    }

  } catch (error) {
    console.error(
      "Không tải được biến thể:",
      error
    );

    if (variantRows) {
      variantRows.textContent =
        "Không tải được dữ liệu biến thể.";
    }
  }
}

function closeProductForm() {
  const modal = document.getElementById(
    "productModal"
  );

  if (!modal) return;

  modal.classList.add("hidden");
  modal.classList.remove("flex");

  const fileInput = document.getElementById(
    "productImageFile"
  );

  if (fileInput) fileInput.value = "";

  selectedFiles = [];
  window.jodokSavedProductImages = [];

  const previewList = document.getElementById(
    "productImagePreviewList"
  );

  if (previewList) previewList.innerHTML = "";
}

// ============================================
// IMAGE PREVIEW
// ============================================

function renderProductImagePreviews() {
  const container = document.getElementById(
    "productImagePreviewList"
  );

  if (!container) return;

  container.innerHTML = "";
  container.style.display = "flex";
  container.style.flexWrap = "wrap";
  container.style.gap = "12px";

  function createCard(src, color, saved, removeCallback) {
    const card = document.createElement("div");

    card.style.cssText = `
      width:155px;
      padding:8px;
      border:1px solid #e5e7eb;
      border-radius:12px;
      background:#fff;
      box-sizing:border-box;
      display:flex;
      flex-direction:column;
      gap:8px;
    `;

    const picture = document.createElement("div");
    picture.style.cssText =
      "height:120px;position:relative";

    const img = document.createElement("img");
    img.src = src;
    img.alt = saved ? "Ảnh đã lưu" : "Ảnh mới";
    img.style.cssText = `
      width:100%;
      height:100%;
      object-fit:cover;
      border-radius:8px;
    `;

    picture.appendChild(img);

    if (removeCallback) {
      const remove = document.createElement("button");

      remove.type = "button";
      remove.textContent = "×";
      remove.title = saved ? "Xóa ảnh đã lưu" : "Bỏ ảnh mới";

      remove.style.cssText = `
        position:absolute;
        top:4px;
        right:4px;
        width:26px;
        height:26px;
        border:0;
        border-radius:50%;
        background:#dc2626;
        color:white;
        font-size:20px;
        cursor:pointer;
      `;

      remove.onclick = removeCallback;
      picture.appendChild(remove);
    }

    const label = document.createElement("label");

    label.textContent = saved
      ? "Màu đã lưu"
      : "Màu ảnh";

    label.style.cssText =
      "font-size:12px;font-weight:600;color:#374151";

    const input = document.createElement("input");

    input.type = "text";
    input.value = color || "";
    input.placeholder = "VD: Đen, Trắng";
    input.readOnly = saved;

    input.style.cssText = `
      width:100%;
      box-sizing:border-box;
      padding:8px;
      border:1px solid #d1d5db;
      border-radius:8px;
      background:${saved ? "#f9fafb" : "#fff"};
      font-size:12px;
    `;

    const status = document.createElement("small");

    status.textContent = saved
      ? "Ảnh đã lưu"
      : "Ảnh mới";

    status.style.cssText =
      "color:#6b7280;font-size:11px";

    card.append(
      picture,
      label,
      input,
      status
    );

    container.appendChild(card);

    return { img, input };
  }

  (window.jodokSavedProductImages || [])
    .forEach(image => {
      createCard(
        image.imageUrl,
        image.color,
        true,
        () => deleteSavedProductImage(image)
      );
    });

  selectedFiles.forEach((file, index) => {
    const url = URL.createObjectURL(file);

    const { img, input } = createCard(
      url,
      file.jodokColor || "",
      false,
      () => {
        selectedFiles.splice(index, 1);
        renderProductImagePreviews();
      }
    );

    input.oninput = () => {
      file.jodokColor = input.value;
    };

    img.onload = () => URL.revokeObjectURL(url);
    img.onerror = () => URL.revokeObjectURL(url);
  });
}

// Xóa ảnh đã lưu trực tiếp qua API; không xóa toàn bộ sản phẩm.
// Đồng bộ thao tác xóa với kết quả thật của backend, không chỉ ẩn ảnh trên form.
window.jodokDeletingImageIds = window.jodokDeletingImageIds || new Set();

async function deleteSavedProductImage(image) {
  const productId = document.getElementById("productId")?.value;
  const imageId = Number(image?.imageId ?? image?.id);
  if (!productId || !Number.isSafeInteger(imageId) || imageId <= 0) {
    showToast("Không thể xóa ảnh", "Ảnh không có imageId hợp lệ.", "error");
    console.error("PRODUCT IMAGE MISSING ID:", image);
    return;
  }

  const saved = window.jodokSavedProductImages || [];
  if (saved.length + selectedFiles.length <= 1) {
    showToast("Cần ít nhất một ảnh", "Hãy lưu ảnh thay thế trước khi xóa ảnh cuối cùng.", "error");
    return;
  }
  if (window.jodokDeletingImageIds.has(imageId)) return;
  if (!window.confirm("Bạn có chắc muốn xóa vĩnh viễn ảnh này khỏi sản phẩm?")) return;

  window.jodokDeletingImageIds.add(imageId);
  try {
    const response = await fetch(`${API_BASE}/product-images/${imageId}`, {
      method: "DELETE",
      headers: adminAuthHeaders(),
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error(`DELETE HTTP ${response.status}: ${await jodokProductReadError(response)}`);
    }

    // Cache-buster giúp không đọc nhầm phản hồi GET cũ từ proxy/browser.
    const verifyUrl = `${API_BASE}/product-images/product/${encodeURIComponent(productId)}` +
      `?verify=${Date.now()}`;
    const verify = await fetch(verifyUrl, {
      method: "GET",
      headers: { ...adminAuthHeaders(), "Cache-Control": "no-cache" },
      cache: "no-store"
    });
    if (!verify.ok) {
      throw new Error(`DELETE đã thành công nhưng GET kiểm tra thất bại (HTTP ${verify.status}).`);
    }
    const fresh = await verify.json();
    if (!Array.isArray(fresh)) {
      throw new Error("API danh sách ảnh không trả về mảng dữ liệu.");
    }
    const stillExists = fresh.some(item =>
      Number(item?.imageId ?? item?.id) === imageId
    );
    if (stillExists) {
      console.error("IMAGE STILL IN DATABASE RESPONSE", {
        productId, imageId, deleteStatus: response.status, images: fresh
      });
      throw new Error(
        `API DELETE trả HTTP ${response.status} nhưng API GET vẫn còn imageId=${imageId}. ` +
        "Lỗi nằm ở backend hoặc dữ liệu database; cần kiểm tra controller, transaction và log SQL."
      );
    }

    // Chỉ thay đổi state khi server xác nhận ảnh thực sự biến mất.
    if (typeof products !== "undefined" && Array.isArray(products)) {
      const product = products.find(p => Number(p.productId) === Number(productId));
      if (product) product.images = fresh;
    }
    if (document.getElementById("productId")?.value === String(productId)) {
      window.jodokSavedProductImages = fresh.filter(item => item?.imageUrl);
      renderProductImagePreviews();
    }
    showToast("Đã xóa ảnh", "Ảnh đã được xóa và xác minh trên server.", "success");
  } catch (error) {
    console.error("DELETE PRODUCT IMAGE FAILED:", { productId, imageId, error });
    showToast("Không thể xóa ảnh", error?.message || "Vui lòng thử lại.", "error");
  } finally {
    window.jodokDeletingImageIds.delete(imageId);
  }
}

function previewImage(event) {
  const input = event.target;

  const files = Array.from(
    input.files || []
  );

  if (!files.length) return;

  const validTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  const invalid = files.find(file =>
    !validTypes.includes(file.type) ||
    file.size <= 0 ||
    file.size > 5 * 1024 * 1024
  );

  if (invalid) {
    showToast(
      "Ảnh không hợp lệ",
      "Chỉ chấp nhận JPG, PNG, WEBP, tối đa 5MB/ảnh.",
      "error"
    );

    input.value = "";
    return;
  }

  const savedCount = (
    window.jodokSavedProductImages || []
  ).length;

  const remaining = Math.max(
    0,
    3 - savedCount - selectedFiles.length
  );

  if (remaining <= 0) {
    showToast(
      "Thông báo",
      "Chỉ được chọn tối đa 3 ảnh",
      "error"
    );

    input.value = "";
    return;
  }

  selectedFiles.push(
    ...files.slice(0, remaining)
  );

  renderProductImagePreviews();

  if (files.length > remaining) {
    showToast(
      "Thông báo",
      "Một số ảnh vượt quá giới hạn 3 ảnh và không được thêm.",
      "error"
    );
  } else {
    showToast(
      "Thành công",
      `Đã chọn ${selectedFiles.length} ảnh mới.`
    );
  }

  input.value = "";
}

function previewCategoryImage(event) {
  const file = event.target.files[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showToast(
      "Lỗi",
      "Vui lòng chọn file ảnh",
      "error"
    );
    return;
  }

  selectedCategoryFile = file;

  const reader = new FileReader();

  reader.onload = function(e) {
    const img = document.getElementById(
      "previewCategoryImage"
    );

    if (!img) return;

    img.src = e.target.result;
    img.classList.remove("hidden");
  };

  reader.readAsDataURL(file);
}

// ============================================
// ERROR HELPERS
// ============================================

async function jodokProductReadError(response) {
  const raw = await response.text();

  let message = raw;

  try {
    const json = JSON.parse(raw);

    message =
      json.message ||
      json.error ||
      json.detail ||
      raw;
  } catch (_) {}

  if (!message) {
    if (response.status === 401) {
      message = "Phiên đăng nhập đã hết hạn.";
    } else if (response.status === 403) {
      message = "Tài khoản không đủ quyền ADMIN.";
    } else {
      message = `Lỗi HTTP ${response.status}`;
    }
  }

  return message;
}

function jodokProductImageValid() {
  const newFiles = Array.isArray(selectedFiles)
    ? selectedFiles
    : [];

  const savedImages = Array.isArray(
    window.jodokSavedProductImages
  )
    ? window.jodokSavedProductImages.filter(
        image => image?.imageUrl
      )
    : [];

  const total = newFiles.length + savedImages.length;

  if (total === 0) {
    throw new Error(
      "Vui lòng tải lên ít nhất 1 ảnh sản phẩm."
    );
  }

  if (total > 3) {
    throw new Error(
      "Mỗi sản phẩm chỉ được có tối đa 3 ảnh."
    );
  }

  for (const file of newFiles) {
    if (!(file instanceof File)) {
      throw new Error("File ảnh không hợp lệ.");
    }

    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp"
      ].includes(file.type)
    ) {
      throw new Error(
        "Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP."
      );
    }

    if (
      file.size <= 0 ||
      file.size > 5 * 1024 * 1024
    ) {
      throw new Error(
        "Dung lượng mỗi ảnh phải lớn hơn 0 và tối đa 5MB."
      );
    }
  }
}

// ============================================
// UPLOAD PRODUCT IMAGES
// ============================================

async function jodokUploadProductImages(productId) {
  const files = [...selectedFiles];

  const savedCount = (
    window.jodokSavedProductImages || []
  ).length;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    const formData = new FormData();
    formData.append("file", file);

    // Upload file
    const uploadRes = await fetch(
      `${API_BASE}/upload/image`,
      {
        method: "POST",
        headers: adminAuthHeaders(),
        body: formData
      }
    );

    if (!uploadRes.ok) {
      throw new Error(
        "Upload ảnh thất bại: " +
        await jodokProductReadError(uploadRes)
      );
    }

    const uploadData = await uploadRes.json();

    if (!uploadData?.imageUrl) {
      throw new Error(
        "Backend không trả về imageUrl sau khi upload."
      );
    }

    // Liên kết ảnh với sản phẩm
    const imageBody = {
      productId: Number(productId),
      imageUrl: uploadData.imageUrl,
      color: (file.jodokColor || "").trim() || null,
      isMain: i === 0 && savedCount === 0
    };

    const imageRes = await fetch(
      `${API_BASE}/product-images`,
      {
        method: "POST",
        headers: adminJsonHeaders(),
        body: JSON.stringify(imageBody)
      }
    );

    if (!imageRes.ok) {
      throw new Error(
        "Không thể liên kết ảnh với sản phẩm: " +
        await jodokProductReadError(imageRes)
      );
    }
  }
}

// ============================================
// SAVE VARIANTS
// ============================================

async function jodokSaveProductVariants(
  productId,
  pendingVariants
) {
  const failures = [];
  let success = 0;

  for (const variant of pendingVariants) {
    const body = {
      productId: Number(productId),
      size: variant.size.trim(),
      color: variant.color.trim(),
      sku: variant.sku.trim(),
      price: Number(variant.price),
      stock: Number(variant.stock),
      status: "ACTIVE"
    };

    try {
      const response = await fetch(
        `${API_BASE}/variants`,
        {
          method: "POST",
          headers: adminJsonHeaders(),
          body: JSON.stringify(body)
        }
      );

      if (!response.ok) {
        const message =
          await jodokProductReadError(response);

        failures.push({
          sku: body.sku,
          size: body.size,
          color: body.color,
          status: response.status,
          message
        });

        console.error(
          "CREATE VARIANT FAILED:",
          body,
          message
        );

        continue;
      }

      success++;

      console.log(
        "VARIANT CREATED:",
        body.sku
      );

    } catch (error) {
      failures.push({
        sku: body.sku,
        size: body.size,
        color: body.color,
        status: 0,
        message: error.message
      });

      console.error(
        "VARIANT NETWORK ERROR:",
        body,
        error
      );
    }
  }

  return {
    success,
    failures
  };
}

// ============================================
// SAVE PRODUCT - FIXED
// ============================================

async function saveProduct() {
  const saveButton = document.getElementById(
    "productSaveButton"
  );

  if (saveButton?.disabled) return;

  const id = document.getElementById(
    "productId"
  ).value;

  const priceRaw = document.getElementById(
    "productPrice"
  ).value.trim();

  const body = {
    productName: document.getElementById(
      "productName"
    ).value.trim(),

    description: document.getElementById(
      "productDesc"
    ).value.trim(),

    basePrice: Number(priceRaw),

    categoryId: Number(
      document.getElementById(
        "productCategory"
      ).value
    ),

    brandId: document.getElementById(
      "productBrand"
    ).value
      ? Number(
          document.getElementById(
            "productBrand"
          ).value
        )
      : null,

    status: document.getElementById(
      "productStatus"
    ).value
  };

  // Validate sản phẩm
  if (!body.productName) {
    showToast(
      "Lỗi",
      "Vui lòng nhập tên sản phẩm.",
      "error"
    );
    return;
  }

  if (!body.categoryId) {
    showToast(
      "Lỗi",
      "Vui lòng chọn danh mục.",
      "error"
    );
    return;
  }

  if (
    priceRaw === "" ||
    !Number.isFinite(body.basePrice) ||
    body.basePrice < 0
  ) {
    showToast(
      "Lỗi",
      "Giá sản phẩm không hợp lệ.",
      "error"
    );
    return;
  }

  // Kiểm tra ảnh
  try {
    jodokProductImageValid();
  } catch (error) {
    showToast(
      "Lỗi ảnh sản phẩm",
      error.message,
      "error"
    );

    document.querySelector(
      ".admin-product-upload"
    )?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    return;
  }

  // Kiểm tra toàn bộ biến thể trước khi tạo sản phẩm
  let pendingVariants = [];

  if (!id) {
    try {
      pendingVariants = collectProductVariantRows();

      if (!pendingVariants.length) {
        throw new Error(
          "Hãy thêm ít nhất một biến thể cho sản phẩm."
        );
      }

    } catch (error) {
      showToast(
        "Lỗi biến thể",
        error.message,
        "error"
      );
      return;
    }
  }

  if (saveButton) {
    saveButton.disabled = true;
    saveButton.style.opacity = "0.6";
  }

  let createdProductId = null;
  let variantResult = {
    success: 0,
    failures: []
  };

  try {
    // 1. Tạo/cập nhật sản phẩm
    const url = id
      ? `${API_BASE}/products/${id}`
      : `${API_BASE}/products`;

    const response = await fetch(
      url,
      {
        method: id ? "PUT" : "POST",
        headers: adminJsonHeaders(),
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      throw new Error(
        "Không lưu được sản phẩm: " +
        await jodokProductReadError(response)
      );
    }

    const product = await response.json();

    createdProductId =
      product?.productId || (id ? Number(id) : null);

    if (!createdProductId) {
      throw new Error(
        "Backend đã phản hồi nhưng không có productId."
      );
    }

    console.log(
      "PRODUCT SAVED:",
      createdProductId
    );

    // 2. Upload và liên kết ảnh
    if (selectedFiles.length > 0) {
      try {
        await jodokUploadProductImages(
          createdProductId
        );
      } catch (error) {
        throw new Error(
          `Sản phẩm #${createdProductId} đã được lưu nhưng ảnh chưa hoàn tất. ` +
          error.message
        );
      }
    }

    // 3. Tạo các biến thể đã nhập
    // Thực hiện TRƯỚC khi đóng form
    if (!id && pendingVariants.length > 0) {
      variantResult =
        await jodokSaveProductVariants(
          createdProductId,
          pendingVariants
        );
    }

    // 4. Tải lại dữ liệu
    await init();

    currentTab = "products";

    // 5. Đóng form sau khi hoàn thành request
    closeProductForm();
    render();

    // 6. Thông báo chi tiết khi biến thể thất bại
    if (variantResult.failures.length > 0) {
      const failedSkus = variantResult.failures
        .map(v => v.sku)
        .join(", ");

      console.error(
        "BIẾN THỂ LƯU THẤT BẠI:",
        variantResult.failures
      );

      showToast(
        "Lưu chưa hoàn tất",
        `Đã tạo sản phẩm #${createdProductId}. ` +
        `Thành công ${variantResult.success}/${pendingVariants.length} biến thể. ` +
        `SKU lỗi: ${failedSkus}. ` +
        `Nguyên nhân: ${variantResult.failures[0].message}.`,
        "error"
      );

      return;
    }

    if (!id) {
      showToast(
        "Thành công",
        `Đã tạo sản phẩm và ${variantResult.success} biến thể.`
      );
    } else {
      showToast(
        "Thành công",
        "Đã cập nhật sản phẩm."
      );
    }

  } catch (error) {
    console.error(
      "SAVE PRODUCT ERROR:",
      error
    );

    showToast(
      "Lưu sản phẩm thất bại",
      error.message,
      "error"
    );

    // Nếu sản phẩm đã được tạo, tránh tạo lại lần hai
    if (!id && createdProductId) {
      console.warn(
        "Sản phẩm đã tồn tại. Không tạo lại:",
        createdProductId
      );

      const idField = document.getElementById(
        "productId"
      );

      if (idField) {
        idField.value = String(createdProductId);
      }

      const title = document.getElementById(
        "productFormTitle"
      );

      if (title) {
        title.textContent =
          "Sản phẩm đã tạo - cần hoàn tất";
      }
    }

  } finally {
    if (saveButton && saveButton.isConnected) {
      saveButton.disabled = false;
      saveButton.style.opacity = "";
    }
  }
}

// ============================================
// DELETE PRODUCT
// ============================================

function deleteProduct(id) {
  const product = products.find(p => Number(p.productId) === Number(id));
  const name = product?.productName || `#${id}`;

  showConfirm(
    `Bạn có chắc muốn xóa vĩnh viễn sản phẩm "${name}"? Sản phẩm đã có đơn hàng sẽ không được phép xóa; hãy dùng chức năng Ẩn thay thế.`,
    async () => {
      try {
        const res = await fetch(`${API_BASE}/products/${id}`, {
          method: "DELETE",
          headers: adminAuthHeaders()
        });

        if (!res.ok) {
          const detail = await jodokProductReadError(res);
          showToast(
            "Không thể xóa sản phẩm",
            res.status === 403
              ? "Tài khoản không có quyền xóa sản phẩm."
              : detail || "Có lỗi xảy ra. Nếu sản phẩm đã có đơn hàng, hãy ẩn sản phẩm.",
            "error"
          );
          return;
        }

        products = products.filter(p => Number(p.productId) !== Number(id));
        if (typeof variants !== "undefined" && Array.isArray(variants)) {
          variants = variants.filter(v => Number(v.product?.productId ?? v.productId) !== Number(id));
        }
        showToast("Thành công", `Đã xóa sản phẩm "${name}".`);
        currentTab = "products";
        render();
      } catch (error) {
        showToast("Lỗi", error.message || "Không kết nối được máy chủ.", "error");
      }
    },
    "Xóa sản phẩm"
  );
}

// ============================================
// PRODUCT ORDERS
// ============================================

function productHasOrders(productId) {
  return orders.some(order =>
    (order.items || []).some(item =>
      Number(item.variant?.product?.productId) ===
      Number(productId)
    )
  );
}

// ============================================
// HIDE PRODUCT
// ============================================

async function hideProduct(id) {
  const p = products.find(
    x => Number(x.productId) === Number(id)
  );

  if (!p) return;

  showConfirm(
    "Ẩn sản phẩm này?",
    async () => {
      try {
        const res = await fetch(
          `${API_BASE}/products/${id}`,
          {
            method: "PUT",
            headers: adminJsonHeaders(),
            body: JSON.stringify({
              productName: p.productName,
              description: p.description || "",
              basePrice: p.basePrice,
              categoryId: p.category?.categoryId,
              brandId: p.brand?.brandId || null,
              status: "INACTIVE"
            })
          }
        );

        if (!res.ok) {
          showToast(
            "Lỗi",
            await jodokProductReadError(res),
            "error"
          );
          return;
        }

        showToast(
          "Thành công",
          "Đã ẩn sản phẩm khỏi shop."
        );

        await init();
        currentTab = "products";
        render();

      } catch (error) {
        showToast(
          "Lỗi",
          error.message,
          "error"
        );
      }
    },
    "Ẩn"
  );
}

// ============================================
// SHOW PRODUCT
// ============================================

async function showProduct(id) {
  const p = products.find(
    x => Number(x.productId) === Number(id)
  );

  if (!p) return;

  showConfirm(
    "Hiện lại sản phẩm này trên shop?",
    async () => {
      try {
        const body = {
          productName: p.productName,
          description: p.description || "",
          basePrice: Number(p.basePrice),
          categoryId: p.category?.categoryId || null,
          brandId: p.brand?.brandId || null,
          status: "ACTIVE"
        };

        if (!body.productName || !body.categoryId) {
          showToast(
            "Lỗi",
            "Sản phẩm thiếu tên hoặc danh mục.",
            "error"
          );
          return;
        }

        const res = await fetch(
          `${API_BASE}/products/${id}`,
          {
            method: "PUT",
            headers: adminJsonHeaders(),
            body: JSON.stringify(body)
          }
        );

        if (!res.ok) {
          showToast(
            "Lỗi",
            await jodokProductReadError(res),
            "error"
          );
          return;
        }

        showToast(
          "Thành công",
          "Đã hiện sản phẩm trên shop."
        );

        await init();

        currentTab = "products";
        render();

      } catch (error) {
        showToast(
          "Lỗi",
          error.message,
          "error"
        );
      }
    },
    "Hiện"
  );
}
