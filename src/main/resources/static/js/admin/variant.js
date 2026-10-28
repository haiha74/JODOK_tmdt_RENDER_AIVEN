// Refactored from legacy /js/admin.js. Business logic preserved.
// Loaded as a compatibility classic script by admin/admin.js so existing inline handlers keep working.

function getVariantProductId(v){
  return (
    v?.product?.productId ??
    v?.productId ??
    v?.product_id ??
    ""
  );
}

function getVariantProductName(v){
  return (
    v?.product?.productName ||
    v?.productName ||
    "Không rõ"
  );
}

function changeVariantProductFilter(value){
  variantProductFilter = value || "ALL";
  variantPage = 1;
  render();
}

function searchVariantAdmin(input){
  if(input?.isComposing){
    return;
  }

  clearTimeout(variantSearchTimer);

  variantSearchTimer = setTimeout(() => {
    adminSearch.variants =
      String(input?.value || "")
        .trim()
        .toLowerCase();

    variantPage = 1;

    render();

    requestAnimationFrame(() => {
      const searchInput =
        document.getElementById("variantSearch");

      if(searchInput){
        searchInput.focus();

        const end =
          searchInput.value.length;

        searchInput.setSelectionRange(
          end,
          end
        );
      }
    });
  }, 250);
}

function finishVariantSearch(input){
  clearTimeout(variantSearchTimer);

  adminSearch.variants =
    String(input?.value || "")
      .trim()
      .toLowerCase();

  variantPage = 1;

  render();

  requestAnimationFrame(() => {
    const searchInput =
      document.getElementById("variantSearch");

    if(searchInput){
      searchInput.focus();

      const end =
        searchInput.value.length;

      searchInput.setSelectionRange(
        end,
        end
      );
    }
  });
}

function changeVariantPage(page){
  const value = Number(page);

  if(
    !Number.isFinite(value) ||
    value < 1
  ){
    return;
  }

  variantPage = value;
  render();
}

function getVariantStatusInfo(v){
  const status =
    String(v?.status || "ACTIVE")
      .toUpperCase();

  if(status === "ACTIVE"){
    return {
      text: "Đang bán",
      className:
        "bg-green-50 text-green-700"
    };
  }

  return {
    text: "Ngừng bán",
    className:
      "bg-red-50 text-red-700"
  };
}

function getVariantColorStyle(color){
  const value =
    String(color || "")
      .trim()
      .toLowerCase();

  const colorMap = {
    "trắng": "#ffffff",
    "white": "#ffffff",

    "đen": "#171717",
    "black": "#171717",

    "đỏ": "#dc2626",
    "red": "#dc2626",

    "xanh": "#2563eb",
    "blue": "#2563eb",
    "xanh dương": "#2563eb",

    "xanh lá": "#16a34a",
    "green": "#16a34a",

    "vàng": "#eab308",
    "yellow": "#eab308",

    "hồng": "#ec4899",
    "pink": "#ec4899",

    "tím": "#9333ea",
    "purple": "#9333ea",

    "cam": "#f97316",
    "orange": "#f97316",

    "nâu": "#92400e",
    "brown": "#92400e",

    "xám": "#9ca3af",
    "gray": "#9ca3af",
    "grey": "#9ca3af",

    "bạc": "#cbd5e1",
    "silver": "#cbd5e1",

    "be": "#e7d7bd",
    "beige": "#e7d7bd"
  };

  return (
    colorMap[value] ||
    "#e5e7eb"
  );
}

function variantPagination(totalPages){
  if(totalPages <= 1){
    return "";
  }

  let pages = [];

  if(totalPages <= 5){

    for(
      let i = 1;
      i <= totalPages;
      i++
    ){
      pages.push(i);
    }

  }else{

    pages.push(1);

    if(variantPage > 3){
      pages.push("...");
    }

    const start =
      Math.max(
        2,
        variantPage - 1
      );

    const end =
      Math.min(
        totalPages - 1,
        variantPage + 1
      );

    for(
      let i = start;
      i <= end;
      i++
    ){
      pages.push(i);
    }

    if(
      variantPage <
      totalPages - 2
    ){
      pages.push("...");
    }

    pages.push(totalPages);
  }


  return `
    <div
      class="
        flex
        items-center
        gap-1
      "
    >

      <button
        type="button"

        onclick="
          changeVariantPage(
            ${variantPage - 1}
          )
        "

        ${
          variantPage <= 1
            ? "disabled"
            : ""
        }

        class="
          w-8 h-8
          flex
          items-center
          justify-center

          border
          rounded-lg

          bg-white
          text-neutral-500

          hover:bg-neutral-50

          disabled:opacity-40
          disabled:cursor-not-allowed
        "

        title="Trang trước"
      >
        ${icon(
          "chevron-left",
          "w-4 h-4"
        )}
      </button>


      ${pages.map(page => {

        if(page === "..."){
          return `
            <span
              class="
                w-8 h-8

                flex
                items-center
                justify-center

                text-sm
                text-neutral-400
              "
            >
              ...
            </span>
          `;
        }


        const active =
          Number(page) ===
          Number(variantPage);


        return `
          <button
            type="button"

            onclick="
              changeVariantPage(
                ${page}
              )
            "

            class="
              w-8 h-8

              flex
              items-center
              justify-center

              rounded-lg

              text-sm
              font-semibold

              transition

              ${
                active
                  ? `
                    bg-red-800
                    text-white
                    border
                    border-red-800
                  `
                  : `
                    bg-white
                    text-neutral-600
                    border

                    hover:bg-neutral-50
                  `
              }
            "
          >
            ${page}
          </button>
        `;

      }).join("")}


      <button
        type="button"

        onclick="
          changeVariantPage(
            ${variantPage + 1}
          )
        "

        ${
          variantPage >= totalPages
            ? "disabled"
            : ""
        }

        class="
          w-8 h-8

          flex
          items-center
          justify-center

          border
          rounded-lg

          bg-white
          text-neutral-500

          hover:bg-neutral-50

          disabled:opacity-40
          disabled:cursor-not-allowed
        "

        title="Trang sau"
      >
        ${icon(
          "chevron-right",
          "w-4 h-4"
        )}
      </button>

    </div>
  `;
}

function variantPanel(){

  const keyword =
    String(
      adminSearch.variants || ""
    )
      .trim()
      .toLowerCase();


  // ===============================
  // FILTER
  // ===============================

  let list =
    variants.filter(v => {

      const productId =
        String(
          getVariantProductId(v)
        );

      const productName =
        String(
          getVariantProductName(v)
        ).toLowerCase();

      const sku =
        String(
          v?.sku || ""
        ).toLowerCase();

      const size =
        String(
          v?.size || ""
        ).toLowerCase();

      const color =
        String(
          v?.color || ""
        ).toLowerCase();


      const matchSearch =
        !keyword ||
        productName.includes(keyword) ||
        sku.includes(keyword) ||
        size.includes(keyword) ||
        color.includes(keyword);


      const matchProduct =
        variantProductFilter === "ALL" ||
        productId ===
          String(
            variantProductFilter
          );


      return (
        matchSearch &&
        matchProduct
      );
    });


  // ===============================
  // PAGINATION
  // ===============================

  // Hien thi 15 bien the moi trang.
  const pageSize = 15;

  const totalItems =
    list.length;


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        totalItems /
        pageSize
      )
    );


  if(variantPage > totalPages){
    variantPage = totalPages;
  }

  if(variantPage < 1){
    variantPage = 1;
  }


  const startIndex =
    (variantPage - 1) *
    pageSize;


  const pageList =
    list.slice(
      startIndex,
      startIndex +
      pageSize
    );


  // ===============================
  // PRODUCT FILTER OPTIONS
  // ===============================

  const productOptions =
    [...products]

      .sort((a, b) =>
        String(
          a?.productName || ""
        ).localeCompare(
          String(
            b?.productName || ""
          ),
          "vi"
        )
      )

      .map(p => {

        const id =
          p?.productId ?? "";

        const selected =
          String(
            variantProductFilter
          ) ===
          String(id)
            ? "selected"
            : "";


        return `
          <option
            value="${id}"
            ${selected}
          >
            ${escapeHtml(
              p?.productName ||
              "Không tên"
            )}
          </option>
        `;

      }).join("");


  // ===============================
  // HTML
  // ===============================

  return `
    <div
      class="
        soft-card
        overflow-hidden
        bg-white
      "
    >

      <!-- HEADER -->
      <div
        class="
          px-5 py-4
          border-b

          flex
          flex-col

          lg:flex-row
          lg:items-center
          lg:justify-between

          gap-4
        "
      >

        <div
          class="
            flex
            flex-col
            sm:flex-row

            items-stretch

            gap-3

            w-full
            lg:w-auto
          "
        >

          <!-- SEARCH -->
          <div
            class="
              relative
              w-full
              sm:w-[260px]
            "
          >

            <span
              class="
                absolute
                left-3
                top-1/2
                -translate-y-1/2

                text-neutral-400

                pointer-events-none
              "
            >
              ${icon(
                "search",
                "w-4 h-4"
              )}
            </span>


            <input
              id="variantSearch"

              type="text"

              value="${escapeHtml(
                adminSearch.variants || ""
              )}"

              oninput="
                searchVariantAdmin(this)
              "

              oncompositionend="
                finishVariantSearch(this)
              "

              placeholder="
                Tìm kiếm biến thể...
              "

              class="
                w-full
                h-10

                border
                border-neutral-200

                rounded-lg

                pl-9
                pr-3

                text-sm

                outline-none
                bg-white

                focus:border-red-700
                focus:ring-1
                focus:ring-red-100
              "
            >
          </div>


          <!-- PRODUCT FILTER -->
          <div
            class="
              relative
              w-full
              sm:w-[190px]
            "
          >

            <select
              onchange="
                changeVariantProductFilter(
                  this.value
                )
              "

              class="
                appearance-none

                w-full
                h-10

                border
                border-neutral-200

                rounded-lg

                bg-white

                pl-3
                pr-9

                text-sm

                outline-none
                cursor-pointer

                focus:border-red-700
              "
            >

              <option
                value="ALL"

                ${
                  variantProductFilter ===
                  "ALL"
                    ? "selected"
                    : ""
                }
              >
                Chọn sản phẩm
              </option>

              ${productOptions}

            </select>


            <span
              class="
                absolute

                right-3
                top-1/2
                -translate-y-1/2

                pointer-events-none

                text-neutral-400
              "
            >
              ${icon(
                "chevron-down",
                "w-4 h-4"
              )}
            </span>

          </div>


          <!-- ADD -->
          <button
            type="button"

            onclick="
              openVariantForm()
            "

            class="
              h-10

              px-4

              rounded-lg

              bg-red-800
              text-white

              text-sm
              font-semibold

              whitespace-nowrap

              hover:bg-red-900

              transition
            "
          >
            + Thêm
          </button>

        </div>

      </div>


      <!-- TABLE -->
      <div class="overflow-x-auto">

        <table
          class="
            w-full
            text-left
            border-collapse
          "
        >

          <thead
            class="
              bg-neutral-50

              text-[13px]
              text-neutral-500
            "
          >

            <tr>

              <th
                class="
                  px-5 py-3
                  w-[55px]
                  font-semibold
                "
              >
                #
              </th>

              <th
                class="
                  px-3 py-3
                  font-semibold
                "
              >
                Sản phẩm
              </th>

              <th
                class="
                  px-3 py-3
                  w-[80px]
                  font-semibold
                "
              >
                Size
              </th>

              <th
                class="
                  px-3 py-3
                  w-[145px]
                  font-semibold
                "
              >
                Màu sắc
              </th>

              <th
                class="
                  px-3 py-3
                  w-[125px]
                  font-semibold
                "
              >
                Giá
              </th>

              <th
                class="
                  px-3 py-3
                  w-[90px]
                  font-semibold
                "
              >
                Tồn kho
              </th>

              <th
                class="
                  px-3 py-3
                  w-[125px]
                  font-semibold
                "
              >
                Trạng thái
              </th>

              <th
                class="
                  px-3 py-3
                  w-[115px]

                  text-center
                  font-semibold
                "
              >
                Hành động
              </th>

            </tr>

          </thead>


          <tbody>

            ${
              pageList.length

                ? pageList.map(
                    (v, index) => {

                      const status =
                        getVariantStatusInfo(v);

                      const color =
                        v?.color || "";

                      const colorStyle =
                        getVariantColorStyle(
                          color
                        );

                      const number =
                        startIndex +
                        index +
                        1;


                      return `
                        <tr
                          class="
                            border-t
                            border-neutral-100

                            hover:bg-neutral-50/70

                            transition
                          "
                        >

                          <td
                            class="
                              px-5 py-3

                              text-sm
                              text-neutral-600
                            "
                          >
                            ${number}
                          </td>


                          <td
                            class="
                              px-3 py-3

                              font-semibold
                              text-sm

                              text-neutral-800
                            "
                          >
                            ${escapeHtml(
                              getVariantProductName(v)
                            )}
                          </td>


                          <td
                            class="
                              px-3 py-3
                              text-sm
                            "
                          >
                            ${escapeHtml(
                              v?.size || "-"
                            )}
                          </td>


                          <td
                            class="
                              px-3 py-3
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
                                  inline-block

                                  w-5 h-5

                                  rounded

                                  border
                                  border-neutral-300

                                  shrink-0
                                "

                                style="
                                  background:
                                  ${colorStyle};
                                "
                              ></span>


                              <span
                                class="
                                  text-sm
                                  text-neutral-700
                                "
                              >
                                ${escapeHtml(
                                  color || "-"
                                )}
                              </span>

                            </div>

                          </td>


                          <td
                            class="
                              px-3 py-3

                              text-sm
                              font-semibold

                              text-neutral-800
                            "
                          >
                            ${money(
                              v?.price
                            )}
                          </td>


                          <td
                            class="
                              px-3 py-3

                              text-sm
                              font-semibold
                            "
                          >
                            ${Number(
                              v?.stock ?? 0
                            ).toLocaleString(
                              "vi-VN"
                            )}
                          </td>


                          <td
                            class="
                              px-3 py-3
                            "
                          >

                            <span
                              class="
                                inline-flex

                                items-center

                                rounded-full

                                px-3 py-1

                                text-xs
                                font-medium

                                ${status.className}
                              "
                            >
                              ${status.text}
                            </span>

                          </td>


                          <td
                            class="
                              px-3 py-3
                            "
                          >

                            <div
                              class="
                                flex
                                items-center
                                justify-center
                                gap-1
                              "
                            >

                              <button
                                type="button"

                                onclick="
                                  openVariantForm(
                                    ${v.variantId}
                                  )
                                "

                                class="
                                  w-8 h-8

                                  inline-flex
                                  items-center
                                  justify-center

                                  rounded-lg

                                  text-red-700

                                  hover:bg-red-50

                                  transition
                                "

                                title="
                                  Sửa biến thể
                                "
                              >
                                ${icon(
                                  "pencil",
                                  "w-4 h-4"
                                )}
                              </button>


                              <button
                                type="button"

                                onclick="
                                  openVariantForm(
                                    ${v.variantId}
                                  )
                                "

                                class="
                                  w-8 h-8

                                  inline-flex
                                  items-center
                                  justify-center

                                  rounded-lg

                                  text-neutral-500

                                  hover:bg-neutral-100

                                  transition
                                "

                                title="
                                  Xem biến thể
                                "
                              >
                                ${icon(
                                  "eye",
                                  "w-4 h-4"
                                )}
                              </button>


                              <button
                                type="button"

                                onclick="
                                  deleteVariant(
                                    ${v.variantId}
                                  )
                                "

                                class="
                                  w-8 h-8

                                  inline-flex
                                  items-center
                                  justify-center

                                  rounded-lg

                                  text-red-700

                                  hover:bg-red-50

                                  transition
                                "

                                title="
                                  Xóa biến thể
                                "
                              >
                                ${icon(
                                  "trash-2",
                                  "w-4 h-4"
                                )}
                              </button>

                            </div>

                          </td>

                        </tr>
                      `;

                    }
                  ).join("")

                : `
                  <tr>

                    <td
                      colspan="8"

                      class="
                        px-6
                        py-12

                        text-center
                        text-neutral-400
                      "
                    >

                      <div
                        class="
                          flex
                          flex-col

                          items-center

                          gap-2
                        "
                      >

                        ${icon(
                          "package-search",
                          "w-8 h-8"
                        )}

                        <span>
                          Không tìm thấy biến thể sản phẩm
                        </span>

                      </div>

                    </td>

                  </tr>
                `
            }

          </tbody>

        </table>

      </div>


      <!-- FOOTER -->
      <div
        class="
          px-5 py-4

          border-t

          flex
          flex-col

          sm:flex-row
          sm:items-center
          sm:justify-between

          gap-3
        "
      >

        <p
          class="
            text-sm
            text-neutral-500
          "
        >
          Hiển thị

          <b class="text-neutral-700">
            ${pageList.length}
          </b>

          /

          <b class="text-neutral-700">
            ${totalItems}
          </b>

          biến thể
        </p>


        ${variantPagination(
          totalPages
        )}

      </div>

    </div>


    ${variantModal()}
  `;
}

function variantModal() {
  return `
    <div
      id="variantModal"
      class="
        fixed inset-0
        z-[9999]
        hidden
        items-center
        justify-center
        bg-black/45
        p-4
      "
    >

      <div
        class="
          bg-white
          w-full
          max-w-2xl
          max-h-[86vh]
          rounded-2xl
          shadow-2xl
          overflow-hidden
          flex
          flex-col
        "
      >

        <!-- HEADER -->
        <div
          class="
            px-6
            py-5
            border-b
            border-neutral-100
            flex
            items-start
            justify-between
            shrink-0
          "
        >

          <div>
            <h2
              id="variantFormTitle"
              class="
                text-2xl
                font-bold
                text-neutral-900
              "
            >
              Thêm biến thể
            </h2>

            <p
              class="
                text-sm
                text-neutral-500
                mt-1
              "
            >
              Thiết lập thuộc tính, giá và tồn kho cho biến thể
            </p>
          </div>


          <button
            type="button"
            onclick="closeVariantForm()"
            class="
              w-9
              h-9
              rounded-lg
              hover:bg-neutral-100
              text-neutral-500
              text-2xl
              inline-flex
              items-center
              justify-center
              transition
            "
          >
            ×
          </button>

        </div>


        <!-- BODY -->
        <div
          class="
            flex-1
            overflow-y-auto
            px-6
            py-5
          "
        >

          <!-- ID -->
          <input
            type="hidden"
            id="variantId"
            value=""
          >


          <!-- SẢN PHẨM -->
          <div class="mb-5">

            <label
              class="
                block
                text-sm
                font-semibold
                text-neutral-700
                mb-2
              "
            >
              Sản phẩm
              <span class="text-red-700">*</span>
            </label>


            <select
              id="variantProductId"
              class="
                w-full
                h-12
                px-4
                rounded-xl
                border
                border-neutral-200
                bg-white
                outline-none
                focus:border-red-800
                focus:ring-2
                focus:ring-red-800/10
                transition
              "
            >

              <option value="">
                Chọn sản phẩm
              </option>

              ${products.map(p => `
                <option value="${p.productId}">
                  ${p.productName}
                </option>
              `).join("")}

            </select>

          </div>


          <!-- THUỘC TÍNH -->
          <div
            class="
              border
              border-neutral-200
              rounded-2xl
              p-4
              mb-5
            "
          >

            <div
              class="
                flex
                items-center
                gap-2
                font-bold
                text-neutral-800
                mb-4
              "
            >
              <span class="text-red-800">
                ⚙
              </span>

              Thuộc tính biến thể
            </div>


            <div
              class="
                grid
                grid-cols-1
                md:grid-cols-2
                gap-4
              "
            >

              <!-- SIZE -->
              <div>

                <label
                  class="
                    block
                    text-sm
                    font-semibold
                    text-neutral-700
                    mb-2
                  "
                >
                  Size
                  <span class="text-red-700">*</span>
                </label>

                <input
                  id="variantSize"
                  type="text"
                  autocomplete="off"
                  placeholder="Ví dụ: S, M, L, XL"
                  class="
                    w-full
                    h-12
                    px-4
                    rounded-xl
                    border
                    border-neutral-200
                    outline-none
                    focus:border-red-800
                    focus:ring-2
                    focus:ring-red-800/10
                  "
                >

              </div>


              <!-- COLOR -->
              <div>

                <label
                  class="
                    block
                    text-sm
                    font-semibold
                    text-neutral-700
                    mb-2
                  "
                >
                  Màu sắc
                  <span class="text-red-700">*</span>
                </label>

                <input
                  id="variantColor"
                  type="text"
                  autocomplete="off"
                  placeholder="Ví dụ: Đen, Trắng"
                  class="
                    w-full
                    h-12
                    px-4
                    rounded-xl
                    border
                    border-neutral-200
                    outline-none
                    focus:border-red-800
                    focus:ring-2
                    focus:ring-red-800/10
                  "
                >

              </div>

            </div>


            <!-- SKU -->
            <div class="mt-4">

              <label
                class="
                  block
                  text-sm
                  font-semibold
                  text-neutral-700
                  mb-2
                "
              >
                SKU
                <span class="text-red-700">*</span>
              </label>

              <input
                id="variantSku"
                type="text"
                autocomplete="off"
                placeholder="Ví dụ: AO-DEN-M"
                class="
                  w-full
                  h-12
                  px-4
                  rounded-xl
                  border
                  border-neutral-200
                  outline-none
                  focus:border-red-800
                  focus:ring-2
                  focus:ring-red-800/10
                "
              >

              <p
                class="
                  mt-2
                  text-xs
                  text-neutral-400
                "
              >
                SKU dùng để nhận diện riêng từng biến thể sản phẩm.
              </p>

            </div>

          </div>


          <!-- GIÁ + TỒN KHO -->
          <div
            class="
              border
              border-neutral-200
              rounded-2xl
              p-4
              mb-5
            "
          >

            <div
              class="
                font-bold
                text-neutral-800
                mb-4
              "
            >
              Giá & tồn kho
            </div>


            <div
              class="
                grid
                grid-cols-1
                md:grid-cols-2
                gap-4
              "
            >

              <!-- PRICE -->
              <div>

                <label
                  class="
                    block
                    text-sm
                    font-semibold
                    text-neutral-700
                    mb-2
                  "
                >
                  Giá biến thể
                  <span class="text-red-700">*</span>
                </label>


                <div class="relative">

                  <input
                    id="variantPrice"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    class="
                      w-full
                      h-12
                      pl-4
                      pr-10
                      rounded-xl
                      border
                      border-neutral-200
                      outline-none
                      focus:border-red-800
                      focus:ring-2
                      focus:ring-red-800/10
                    "
                  >

                  <span
                    class="
                      absolute
                      right-4
                      top-1/2
                      -translate-y-1/2
                      text-neutral-400
                    "
                  >
                    đ
                  </span>

                </div>

              </div>


              <!-- STOCK -->
              <div>

                <label
                  class="
                    block
                    text-sm
                    font-semibold
                    text-neutral-700
                    mb-2
                  "
                >
                  Tồn kho
                  <span class="text-red-700">*</span>
                </label>

                <input
                  id="variantStock"
                  type="number"
                  min="0"
                  step="1"
                  value="0"
                  oninput="
                    if(Number(this.value) < 0){
                      this.value = 0;
                    }
                  "
                  class="
                    w-full
                    h-12
                    px-4
                    rounded-xl
                    border
                    border-neutral-200
                    outline-none
                    focus:border-red-800
                    focus:ring-2
                    focus:ring-red-800/10
                  "
                >

              </div>

            </div>

          </div>


          <!-- STATUS -->
          <div>

            <label
              class="
                block
                text-sm
                font-semibold
                text-neutral-700
                mb-2
              "
            >
              Trạng thái
            </label>


            <select
              id="variantStatus"
              class="
                w-full
                h-12
                px-4
                rounded-xl
                border
                border-neutral-200
                bg-white
                outline-none
                focus:border-red-800
                focus:ring-2
                focus:ring-red-800/10
              "
            >

              <option value="ACTIVE">
                Đang bán
              </option>

              <option value="INACTIVE">
                Ngừng bán
              </option>

            </select>

          </div>

        </div>


        <!-- FOOTER -->
        <div
          class="
            shrink-0
            px-6
            py-4
            border-t
            border-neutral-100
            bg-white
            flex
            items-center
            justify-end
            gap-3
          "
        >

          <button
            type="button"
            onclick="closeVariantForm()"
            class="
              h-10
              px-5
              rounded-xl
              border
              border-neutral-200
              bg-white
              text-sm
              font-semibold
              hover:bg-neutral-50
              transition
            "
          >
            Hủy
          </button>


          <button
            id="variantSaveButton"
            type="button"
            onclick="saveVariant()"
            class="
              h-10
              px-6
              rounded-xl
              bg-red-800
              text-white
              text-sm
              font-bold
              hover:bg-red-900
              transition
              shadow-sm
              inline-flex
              items-center
              gap-2
            "
          >
            ${icon("save", "w-4 h-4")}

            Lưu biến thể
          </button>

        </div>

      </div>

    </div>
  `;
}

function openVariantForm(id = null) {
  const modal = document.getElementById("variantModal");

  if (!modal) {
    console.error("Không tìm thấy #variantModal");
    return;
  }

  const v = id
    ? variants.find(
        item => Number(item.variantId) === Number(id)
      )
    : null;

  console.log("OPEN VARIANT:", v);

  modal.classList.remove("hidden");
  modal.classList.add("flex");

  const title = document.getElementById("variantFormTitle");
  const idInput = document.getElementById("variantId");
  const productInput = document.getElementById("variantProductId");
  const sizeInput = document.getElementById("variantSize");
  const colorInput = document.getElementById("variantColor");
  const skuInput = document.getElementById("variantSku");
  const priceInput = document.getElementById("variantPrice");
  const stockInput = document.getElementById("variantStock");
  const statusInput = document.getElementById("variantStatus");

  if (title) {
    title.textContent = id ? "Sửa biến thể" : "Thêm biến thể";
  }

  if (idInput) {
    idInput.value = id || "";
  }

  /*
   * FIX QUAN TRỌNG:
   * Backend có thể trả:
   *
   * v.product.productId
   * hoặc
   * v.productId
   *
   * hỗ trợ cả 2.
   */
  const productId =
    v?.product?.productId ??
    v?.productId ??
    "";

  if (productInput) {
    productInput.value = String(productId);

    /*
     * Trường hợp option được render sau
     */
    if (
      productId &&
      productInput.value !== String(productId)
    ) {
      const option = document.createElement("option");

      option.value = String(productId);
      option.textContent =
        v?.product?.productName ||
        v?.productName ||
        `Sản phẩm #${productId}`;

      option.selected = true;

      productInput.appendChild(option);
    }
  }

  if (sizeInput) {
    sizeInput.value = v?.size ?? "";
  }

  if (colorInput) {
    colorInput.value = v?.color ?? "";
  }

  if (skuInput) {
    skuInput.value = v?.sku ?? "";
  }

  if (priceInput) {
    priceInput.value =
      v?.price !== undefined &&
      v?.price !== null
        ? v.price
        : "";
  }

  if (stockInput) {
    stockInput.value =
      v?.stock !== undefined &&
      v?.stock !== null
        ? v.stock
        : 0;
  }

  if (statusInput) {
    statusInput.value = v?.status || "ACTIVE";
  }
}

function closeVariantForm(){
  document.getElementById('variantModal').classList.add('hidden');
  document.getElementById('variantModal').classList.remove('flex');
}

async function saveVariant(){

  const getEl = id =>
    document.getElementById(id);

  const idEl = getEl("variantId");
  const productEl = getEl("variantProductId");
  const sizeEl = getEl("variantSize");
  const colorEl = getEl("variantColor");
  const skuEl = getEl("variantSku");
  const priceEl = getEl("variantPrice");
  const stockEl = getEl("variantStock");
  const statusEl = getEl("variantStatus");


  // ================================
  // KIỂM TRA FORM
  // ================================

  if(
    !idEl ||
    !productEl ||
    !sizeEl ||
    !colorEl ||
    !skuEl ||
    !priceEl ||
    !stockEl ||
    !statusEl
  ){
    console.error("VARIANT FORM MISSING:", {
      idEl,
      productEl,
      sizeEl,
      colorEl,
      skuEl,
      priceEl,
      stockEl,
      statusEl
    });

    showToast(
      "Lỗi",
      "Form biến thể đang thiếu trường dữ liệu.",
      "error"
    );

    return;
  }


  const id = idEl.value.trim();

  const productId =
    Number(productEl.value);

  const size =
    sizeEl.value.trim();

  const color =
    colorEl.value.trim();

  const sku =
    skuEl.value.trim();

  const price =
    Number(priceEl.value);

  const stock =
    Number(stockEl.value);

  const status =
    statusEl.value || "ACTIVE";


  // ================================
  // VALIDATE
  // ================================

  if(!productId){

    showToast(
      "Thiếu thông tin",
      "Vui lòng chọn sản phẩm.",
      "error"
    );

    productEl.focus();
    return;
  }


  if(!size){

    showToast(
      "Thiếu thông tin",
      "Vui lòng nhập size.",
      "error"
    );

    sizeEl.focus();
    return;
  }


  if(!color){

    showToast(
      "Thiếu thông tin",
      "Vui lòng nhập màu sắc.",
      "error"
    );

    colorEl.focus();
    return;
  }


  if(!sku){

    showToast(
      "Thiếu thông tin",
      "Vui lòng nhập SKU.",
      "error"
    );

    skuEl.focus();
    return;
  }


  if(
    !Number.isFinite(price) ||
    price < 0
  ){

    showToast(
      "Giá không hợp lệ",
      "Vui lòng nhập giá biến thể.",
      "error"
    );

    priceEl.focus();
    return;
  }


  if(
    !Number.isFinite(stock) ||
    stock < 0
  ){

    showToast(
      "Tồn kho không hợp lệ",
      "Tồn kho phải lớn hơn hoặc bằng 0.",
      "error"
    );

    stockEl.focus();
    return;
  }


  // ================================
  // BODY
  // ================================

  const body = {
    productId: productId,
    size: size,
    color: color,
    sku: sku,
    price: price,
    stock: stock,
    status: status
  };


  const url =
    id
      ? `${API_BASE}/variants/${id}`
      : `${API_BASE}/variants`;


  const method =
    id
      ? "PUT"
      : "POST";


  console.log(
    "========== SAVE VARIANT =========="
  );

  console.log("URL:", url);
  console.log("METHOD:", method);
  console.log("BODY:", body);
  console.log(
    "HEADERS:",
    adminJsonHeaders()
  );


  // ================================
  // DISABLE BUTTON
  // ================================

  const saveButton =
    document.getElementById(
      "variantSaveButton"
    );

  if(saveButton){
    saveButton.disabled = true;
    saveButton.innerHTML =
      "Đang lưu...";
  }


  try{

    const res = await fetch(
      url,
      {
        method: method,

        headers:
          adminJsonHeaders(),

        body:
          JSON.stringify(body)
      }
    );


    const responseText =
      await res.text();


    console.log(
      "VARIANT STATUS:",
      res.status
    );

    console.log(
      "VARIANT RESPONSE:",
      responseText
    );


    // ================================
    // BACKEND ERROR
    // ================================

    if(!res.ok){

      let message =
        responseText ||
        `HTTP ${res.status}`;


      try{

        const json =
          JSON.parse(responseText);

        message =
          json.message ||
          json.error ||
          json.detail ||
          message;

      }catch(e){
        // response không phải JSON
      }


      showToast(
        "Không thể lưu biến thể",
        message,
        "error"
      );

      return;
    }


    // ================================
    // SUCCESS
    // ================================

    closeVariantForm();


    showToast(
      "Thành công",
      id
        ? "Đã cập nhật biến thể"
        : "Đã thêm biến thể"
    );


    await init();

  }catch(error){

    console.error(
      "SAVE VARIANT ERROR:",
      error
    );


    showToast(
      "Lỗi kết nối",
      error?.message ||
      "Không thể kết nối tới máy chủ.",
      "error"
    );

  }finally{

    if(saveButton){

      saveButton.disabled = false;

      saveButton.innerHTML = `
        ${icon("save", "w-4 h-4")}
        Lưu biến thể
      `;

      if(window.lucide){
        lucide.createIcons();
      }
    }
  }
}

function deleteVariant(id){
  showConfirm("Xóa biến thể này?", async () => {
    const res = await fetch(
      `${API_BASE}/variants/${id}`,
      {
        method:'DELETE',
        headers: adminAuthHeaders()
      }
    );

    if(!res.ok){
      showToast("Lỗi", await res.text(), "error");
      return;
    }

    showToast("Thành công", "Đã xóa biến thể");
    await init();
  });
}
