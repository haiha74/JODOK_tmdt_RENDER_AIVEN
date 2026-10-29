/* =========================================
   JODOK - PRODUCTS PAGE
========================================= */

let shopSort = "default";
let shopMinPrice = "";
let shopMaxPrice = "";

function escapeProductHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shopCategoryName(id) {
  return categories.find(
    c => Number(c.categoryId) === Number(id)
  )?.categoryName || "Danh mục";
}

function shopCategoryIds(id) {
  const ids = new Set([Number(id)]);
  let changed = true;

  while (changed) {
    changed = false;

    categories.forEach(c => {
      const parentId = Number(
        c.parent?.categoryId ?? c.parentId
      );

      if (
        ids.has(parentId) &&
        !ids.has(Number(c.categoryId))
      ) {
        ids.add(Number(c.categoryId));
        changed = true;
      }
    });
  }

  return ids;
}

function shopPrice(p) {
  const n = Number(jodokSalePrice(p.productId, p.basePrice));
  return Number.isFinite(n) ? n : 0;
}

/* =========================================
   FILTER + SORT
========================================= */

function shopFilteredProducts() {
  let list = [...allProducts];

  if (selectedCategoryId !== null) {
    const ids = shopCategoryIds(selectedCategoryId);

    list = list.filter(p =>
      ids.has(Number(
        p.category?.categoryId ?? p.categoryId
      ))
    );
  }

  const kw = searchKeyword
    .trim()
    .toLocaleLowerCase("vi");

  if (kw) {
    list = list.filter(p =>
      (p.productName || "")
        .toLocaleLowerCase("vi")
        .includes(kw)
    );
  }

  const min = shopMinPrice === ""
    ? null
    : Number(shopMinPrice);

  const max = shopMaxPrice === ""
    ? null
    : Number(shopMaxPrice);

  if (min !== null) {
    list = list.filter(p => shopPrice(p) >= min);
  }

  if (max !== null) {
    list = list.filter(p => shopPrice(p) <= max);
  }

  switch (shopSort) {
    case "asc":
      list.sort((a, b) => shopPrice(a) - shopPrice(b));
      break;

    case "desc":
      list.sort((a, b) => shopPrice(b) - shopPrice(a));
      break;

    case "sold":
      list.sort((a, b) =>
        getSoldCount(b.productId) -
        getSoldCount(a.productId)
      );
      break;

    case "newest":
      list.sort((a, b) =>
        Number(b.productId) - Number(a.productId)
      );
      break;
  }

  return list;
}

/* =========================================
   BREADCRUMB
========================================= */

function shopBreadcrumb() {
  const crumbs = [
    { name: "Trang chủ", href: "/" },
    { name: "Tất cả sản phẩm", href: "/products" }
  ];

  if (selectedCategoryId !== null) {
    const current = categories.find(
      c => Number(c.categoryId) ===
           Number(selectedCategoryId)
    );

    const parentId =
      current?.parent?.categoryId ??
      current?.parentId;

    if (
      parentId != null &&
      categories.some(
        c => Number(c.categoryId) === Number(parentId)
      )
    ) {
      crumbs.push({
        name: shopCategoryName(parentId),
        href: `/products?categoryId=${parentId}`
      });
    }

    crumbs.push({
      name: shopCategoryName(selectedCategoryId),
      href: null
    });
  }

  if (searchKeyword.trim()) {
    crumbs.push({
      name: `Tìm kiếm: ${searchKeyword}`,
      href: null
    });
  }

  return `
    <nav class="shop-breadcrumb"
         aria-label="Đường dẫn điều hướng">

      ${crumbs.map((c, i) => `
        ${i ? '<span aria-hidden="true">›</span>' : ""}

        ${
          c.href && i < crumbs.length - 1
            ? `<a href="${c.href}">
                 ${escapeProductHtml(c.name)}
               </a>`
            : `<span aria-current="page">
                 ${escapeProductHtml(c.name)}
               </span>`
        }
      `).join("")}

    </nav>
  `;
}

/* =========================================
   SIDEBAR
========================================= */

function shopSidebar() {
  const parents = categories.filter(
    c => !c.parent && !c.parentId
  );

  return `
    <aside class="shop-sidebar">

      <div class="shop-sidebar-scroll custom-scroll">

        <button
          type="button"
          class="shop-category-all ${
            selectedCategoryId === null ? "active" : ""
          }"
          onclick="clearCategory()"
        >
          <span class="shop-category-all-icon">
            ${icon("layout-grid", "w-5 h-5")}
          </span>

          <span>Tất cả danh mục</span>
        </button>

        ${parents.map((parent, i) => {
          const id = Number(parent.categoryId);

          const open =
            selectedCategoryId !== null &&
            shopCategoryIds(id).has(
              Number(selectedCategoryId)
            );

          const children = categories.filter(
            c => Number(
              c.parent?.categoryId ?? c.parentId
            ) === id
          );

          return `
            <div class="shop-category-group">

              <div class="shop-category-parent ${
                Number(selectedCategoryId) === id
                  ? "active"
                  : ""
              }">

                <button
                  type="button"
                  class="shop-category-parent-link"
                  onclick="filterCategory(${id})"
                >

                  <img
                    src="${escapeProductHtml(
                      parent.imageUrl || "/images/no-image.png"
                    )}"
                    alt=""
                    loading="lazy"
                    onerror="this.onerror=null;this.src='/images/no-image.png'"
                  >

                  <span>
                    ${escapeProductHtml(parent.categoryName)}
                  </span>

                </button>

                ${children.length ? `
                  <button
                    type="button"
                    class="shop-category-toggle"
                    aria-label="Mở danh mục ${escapeProductHtml(parent.categoryName)}"
                    aria-expanded="${open}"
                    onclick="toggleCategory(${id})"
                  >
                    ${icon(
                      open ? "chevron-up" : "chevron-down",
                      "w-4 h-4"
                    )}
                  </button>
                ` : ""}

              </div>

              ${children.length ? `
                <div
                  id="children-${id}"
                  class="shop-category-children ${
                    open ? "" : "hidden"
                  }"
                >

                  ${children.map(child => `
                    <button
                      type="button"
                      onclick="filterCategory(${
                        Number(child.categoryId)
                      })"
                      class="${
                        Number(selectedCategoryId) ===
                        Number(child.categoryId)
                          ? "active"
                          : ""
                      }"
                    >
                      ${escapeProductHtml(child.categoryName)}
                    </button>
                  `).join("")}

                </div>
              ` : ""}

            </div>
          `;
        }).join("")}

      </div>

      <!-- PRICE FILTER -->

      <form
        class="shop-price-filter"
        onsubmit="applyShopPrice(event)"
      >

        <h3>Lọc theo khoảng giá</h3>

        <div class="shop-price-inputs">

          <input
            id="shopMinPrice"
            type="number"
            min="0"
            step="1000"
            placeholder="Từ (đ)"
            value="${shopMinPrice}"
            aria-label="Giá thấp nhất"
          >

          <span>–</span>

          <input
            id="shopMaxPrice"
            type="number"
            min="0"
            step="1000"
            placeholder="Đến (đ)"
            value="${shopMaxPrice}"
            aria-label="Giá cao nhất"
          >

        </div>

        <button type="submit">
          ÁP DỤNG
        </button>

        ${
          shopMinPrice !== "" || shopMaxPrice !== ""
            ? `
              <button
                type="button"
                class="shop-price-clear"
                onclick="clearShopPrice()"
              >
                Xóa lọc giá
              </button>
            `
            : ""
        }

      </form>

    </aside>
  `;
}

/* =========================================
   PAGE LAYOUT
========================================= */

function shop() {
  const list = shopFilteredProducts();

  products = list;

  return header() + `

    <main class="wrap shop-page">

      ${shopBreadcrumb()}

      <div class="shop-layout">

        ${shopSidebar()}

        <section class="shop-results">

          <div class="shop-heading">

            <div>

              <h1 class="serif shop-title">
                ${
                  selectedCategoryId !== null
                    ? escapeProductHtml(
                        shopCategoryName(selectedCategoryId)
                      )
                    : "Danh sách sản phẩm"
                }
              </h1>

              <p class="shop-description">
                Chọn danh mục bên trái để chuyển nhanh
                sang nhóm sản phẩm khác
              </p>

            </div>

            <label class="shop-sort-label">

              <span class="sr-only">
                Sắp xếp sản phẩm
              </span>

              <select onchange="sortProducts(this.value)">

                <option value="default"
                  ${shopSort === "default" ? "selected" : ""}>
                  Sắp xếp mặc định
                </option>

                <option value="asc"
                  ${shopSort === "asc" ? "selected" : ""}>
                  Giá tăng dần
                </option>

                <option value="desc"
                  ${shopSort === "desc" ? "selected" : ""}>
                  Giá giảm dần
                </option>

                <option value="sold"
                  ${shopSort === "sold" ? "selected" : ""}>
                  Bán chạy
                </option>

                <option value="newest"
                  ${shopSort === "newest" ? "selected" : ""}>
                  Mới nhất
                </option>

              </select>

            </label>

          </div>

          <p class="shop-result-count">
            ${list.length} sản phẩm
          </p>

          ${productGrid(list)}

        </section>

      </div>

    </main>

  ` + footer();
}

function renderShop() {
  renderApp(shop());
}

/* =========================================
   CATEGORY ACTIONS
========================================= */

function applyCategoryFilter(categoryId) {
  selectedCategoryId =
    categoryId == null
      ? null
      : Number(categoryId);

  const url = new URL(location.href);

  if (selectedCategoryId === null) {
    url.searchParams.delete("categoryId");
  } else {
    url.searchParams.set(
      "categoryId",
      String(selectedCategoryId)
    );
  }

  history.pushState(
    null,
    "",
    url.pathname + url.search
  );

  renderShop();
}

function filterCategory(categoryId) {
  applyCategoryFilter(categoryId);
}

function clearCategory() {
  applyCategoryFilter(null);
}

function toggleCategory(parentId) {
  const el = document.getElementById(
    `children-${parentId}`
  );

  if (!el) return;

  const hidden = el.classList.toggle("hidden");

  const btn = el.previousElementSibling
    ?.querySelector(".shop-category-toggle");

  if (btn) {
    btn.setAttribute(
      "aria-expanded",
      String(!hidden)
    );

    btn.innerHTML = icon(
      hidden ? "chevron-down" : "chevron-up",
      "w-4 h-4"
    );

    if (window.lucide) {
      lucide.createIcons();
    }
  }
}

/* =========================================
   SORT ACTION
========================================= */

function sortProducts(type) {
  shopSort = [
    "default",
    "asc",
    "desc",
    "sold",
    "newest"
  ].includes(type)
    ? type
    : "default";

  renderShop();
}

/* =========================================
   PRICE ACTIONS
========================================= */

function applyShopPrice(event) {
  event.preventDefault();

  const min = document
    .getElementById("shopMinPrice")
    .value.trim();

  const max = document
    .getElementById("shopMaxPrice")
    .value.trim();

  if (
    (
      min !== "" &&
      (
        !Number.isFinite(Number(min)) ||
        Number(min) < 0
      )
    ) ||
    (
      max !== "" &&
      (
        !Number.isFinite(Number(max)) ||
        Number(max) < 0
      )
    )
  ) {
    alert("Vui lòng nhập mức giá hợp lệ.");
    return;
  }

  if (
    min !== "" &&
    max !== "" &&
    Number(min) > Number(max)
  ) {
    alert("Giá từ không được lớn hơn giá đến.");
    return;
  }

  shopMinPrice = min;
  shopMaxPrice = max;

  renderShop();
}

function clearShopPrice() {
  shopMinPrice = "";
  shopMaxPrice = "";

  renderShop();
}

/* =========================================
   SEARCH
========================================= */

function searchEnter(e) {
  if (e.key !== "Enter") return;

  location.href =
    `/products?keyword=${
      encodeURIComponent(e.target.value.trim())
    }`;
}

/* =========================================
   LOAD DATA
========================================= */

async function loadProductsPage() {
  renderApp(header() + `<main class="wrap py-12 text-center" role="status">Đang tải sản phẩm...</main>` + footer());
  try {
    const params = new URLSearchParams(
      location.search
    );

    selectedCategoryId =
      params.has("categoryId") &&
      params.get("categoryId") !== ""
        ? Number(params.get("categoryId"))
        : null;

    searchKeyword = params.get("keyword") || "";

    const [productData, categoryData, brandData] = await Promise.all([
      fetchJson(`${API_BASE}/products`),
      fetchJson(`${API_BASE}/categories`),
      fetchJson(`${API_BASE}/brands`).catch(() => [])
    ]);

    if (!Array.isArray(productData)) throw new Error('Dữ liệu sản phẩm không hợp lệ');
    allProducts = productData.filter(p => p && p.status === 'ACTIVE');
    products = allProducts;
    categories = Array.isArray(categoryData) ? categoryData : [];
    brands = Array.isArray(brandData) ? brandData : [];
    window.soldCounts = {};

    // Dựng danh sách trước, không đợi /orders hoặc hàng trăm sold-count.
    renderShop();

    fetchJson(`${API_BASE}/products/sold-counts`).then(counts => {
      window.soldCounts = counts && typeof counts === 'object' && !Array.isArray(counts)
        ? counts : {};
      renderShop();
    }).catch(err => console.warn('Không tải được số lượng đã bán:', err));

    loadJodokSalePrices().then(() => renderShop())
      .catch(err => console.warn('Không tải được giá khuyến mãi:', err));

  } catch (err) {
    console.error(err);

    renderApp(
      header() + `
        <main class="wrap p-10 text-center">

          <h1 class="text-3xl font-bold text-red-800">
            Không kết nối được backend
          </h1>

          <p class="mt-3">
            Kiểm tra API /api/products hoạt động.
          </p>

        </main>
      ` + footer()
    );
  }
}

/* =========================================
   BROWSER BACK / FORWARD
========================================= */

window.addEventListener("popstate", () => {
  const params = new URLSearchParams(
    location.search
  );

  selectedCategoryId = params.has("categoryId")
    ? Number(params.get("categoryId"))
    : null;

  searchKeyword = params.get("keyword") || "";

  if (allProducts.length) {
    renderShop();
  }
});

loadProductsPage();