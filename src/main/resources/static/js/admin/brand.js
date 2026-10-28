// Refactored from legacy /js/admin.js. Business logic preserved.
// Loaded as a compatibility classic script by admin/admin.js so existing inline handlers keep working.

function brandPanel() {
  const keyword = String(adminSearch?.brands || "")
    .trim()
    .toLowerCase();

  // Lấy trạng thái filter, nếu chưa có thì mặc định ALL
  const statusFilter =
    adminSearch.brandStatus || "ALL";

  // Lấy kiểu sắp xếp, mặc định mới nhất
  const sortType =
    adminSearch.brandSort || "newest";


  // =========================
  // LỌC
  // =========================
  let list = (Array.isArray(brands) ? brands : []).filter(b => {

    const name =
      String(b?.brandName || "").toLowerCase();

    const description =
      String(b?.description || "").toLowerCase();

    const status =
      String(b?.status || "ACTIVE").toUpperCase();


    const matchSearch =
      !keyword ||
      name.includes(keyword) ||
      description.includes(keyword);


    const matchStatus =
      statusFilter === "ALL" ||
      status === statusFilter;


    return matchSearch && matchStatus;
  });


  // =========================
  // SẮP XẾP
  // =========================
  list.sort((a, b) => {

    const idA = Number(a?.brandId || 0);
    const idB = Number(b?.brandId || 0);

    if (sortType === "oldest") {
      return idA - idB;
    }

    return idB - idA;
  });


  // =========================
  // ĐẾM SẢN PHẨM THEO BRAND
  // =========================
  const productCountMap = new Map();

  (Array.isArray(products) ? products : []).forEach(p => {

    const brandId = Number(
      p?.brand?.brandId ??
      p?.brandId ??
      p?.brand_id ??
      0
    );

    if (!brandId) return;

    productCountMap.set(
      brandId,
      (productCountMap.get(brandId) || 0) + 1
    );
  });


  return `
    <div class="soft-card overflow-hidden">


      <!-- ===================================== -->
      <!-- TOOLBAR -->
      <!-- ===================================== -->

      <div
        class="
          px-5
          py-5
          border-b
          border-neutral-200
          bg-white
        "
      >

        <div
          class="
            flex
            flex-col
            xl:flex-row
            xl:items-center
            gap-3
          "
        >


          <!-- SEARCH -->
          <div class="relative flex-1">

            <span
              class="
                absolute
                left-4
                top-1/2
                -translate-y-1/2
                text-neutral-400
                pointer-events-none
              "
            >
              ${icon("search", "w-5 h-5")}
            </span>


            <input
              type="text"
              data-search="brands"

              value="${escapeHtml(
                adminSearch?.brands || ""
              )}"

              placeholder="Tìm kiếm thương hiệu..."

              autocomplete="off"

              oninput="
                searchAdmin(
                  'brands',
                  this.value
                )
              "

              class="
                w-full
                border
                border-neutral-200
                rounded-xl
                pl-12
                pr-4
                py-3
                text-sm
                bg-white
                outline-none
                focus:border-red-800
              "
            >

          </div>


          <!-- ================================= -->
          <!-- FILTER TRẠNG THÁI -->
          <!-- ================================= -->

          <select
            onchange="
              adminSearch.brandStatus =
                this.value;

              render();
            "

            class="
              border
              border-neutral-200
              rounded-xl
              px-2
              py-3
              text-sm
              bg-white
              outline-none
              min-w-[190px]
              cursor-pointer
              focus:border-red-800
            "
          >

            <option
              value="ALL"
              ${
                statusFilter === "ALL"
                  ? "selected"
                  : ""
              }
            >
              Tất cả trạng thái
            </option>


            <option
              value="ACTIVE"
              ${
                statusFilter === "ACTIVE"
                  ? "selected"
                  : ""
              }
            >
              Đang hiển thị
            </option>


            <option
              value="INACTIVE"
              ${
                statusFilter === "INACTIVE"
                  ? "selected"
                  : ""
              }
            >
              Đã ẩn
            </option>

          </select>


          <!-- ================================= -->
          <!-- SORT MỚI / CŨ -->
          <!-- ================================= -->

          <select
            onchange="
              adminSearch.brandSort =
                this.value;

              render();
            "

            class="
              border
              border-neutral-200
              rounded-xl
              px-2
              py-3
              text-sm
              bg-white
              outline-none
              min-w-[160px]
              cursor-pointer
              focus:border-red-800
            "
          >

            <option
              value="newest"
              ${
                sortType === "newest"
                  ? "selected"
                  : ""
              }
            >
              Mới nhất
            </option>


            <option
              value="oldest"
              ${
                sortType === "oldest"
                  ? "selected"
                  : ""
              }
            >
              Cũ nhất
            </option>

          </select>


          <!-- ================================= -->
          <!-- ADD BRAND -->
          <!-- ================================= -->

          <button
            type="button"

            onclick="openBrandForm()"

            class="
              bg-red-800
              hover:bg-red-900
              text-white
              rounded-xl
              px-5
              py-3
              font-semibold
              text-sm
              whitespace-nowrap
              inline-flex
              items-center
              justify-center
              gap-2
            "
          >

            ${icon(
              "plus",
              "w-4 h-4"
            )}

            Thêm thương hiệu

          </button>

        </div>

      </div>


      <!-- ===================================== -->
      <!-- TABLE -->
      <!-- ===================================== -->

      <div class="overflow-x-auto">

        <table class="w-full text-left">

          <thead
            class="
              bg-neutral-50
              text-sm
              text-neutral-500
            "
          >

            <tr>

              <th class="px-5 py-4 w-[70px]">
                #
              </th>

              <th class="px-5 py-4">
                Tên thương hiệu
              </th>

              <th class="px-5 py-4">
                Mô tả
              </th>

              <th
                class="
                  px-5
                  py-4
                  text-center
                  whitespace-nowrap
                "
              >
                Số sản phẩm
              </th>

              <th
                class="
                  px-5
                  py-4
                  text-center
                  whitespace-nowrap
                "
              >
                Trạng thái
              </th>

              <th
                class="
                  px-5
                  py-4
                  text-center
                  whitespace-nowrap
                "
              >
                Hành động
              </th>

            </tr>

          </thead>


          <tbody>

            ${
              list.length

                ? list.map((b, index) => {

                    const brandId =
                      Number(
                        b?.brandId || 0
                      );


                    const brandName =
                      escapeHtml(
                        b?.brandName ||
                        "Chưa có tên"
                      );


                    const description =
                      escapeHtml(
                        b?.description ||
                        "Không có mô tả"
                      );


                    const status =
                      String(
                        b?.status ||
                        "ACTIVE"
                      ).toUpperCase();


                    const active =
                      status === "ACTIVE";


                    const productCount =
                      productCountMap.get(
                        brandId
                      ) || 0;


                    return `

                      <tr
                        class="
                          border-t
                          border-neutral-100
                          hover:bg-neutral-50/60
                        "
                      >


                        <!-- STT -->

                        <td
                          class="
                            px-5
                            py-5
                            text-neutral-500
                          "
                        >
                          ${index + 1}
                        </td>


                        <!-- BRAND NAME -->

                        <td class="px-5 py-5">

                          <div
                            class="
                              flex
                              items-center
                              gap-3
                            "
                          >

                            <div
                              class="
                                w-10
                                h-10
                                rounded-xl
                                bg-neutral-100
                                border
                                border-neutral-200
                                flex
                                items-center
                                justify-center
                                font-bold
                                text-red-800
                                shrink-0
                              "
                            >
                              ${
                                brandName
                                  .charAt(0)
                                  .toUpperCase()
                              }
                            </div>


                            <span
                              class="
                                font-semibold
                                text-neutral-900
                              "
                            >
                              ${brandName}
                            </span>

                          </div>

                        </td>


                        <!-- DESCRIPTION -->

                        <td
                          class="
                            px-5
                            py-5
                            text-neutral-500
                          "
                        >
                          ${description}
                        </td>


                        <!-- PRODUCT COUNT -->

                        <td
                          class="
                            px-5
                            py-5
                            text-center
                            font-semibold
                          "
                        >
                          ${productCount}
                        </td>


                        <!-- STATUS -->

                        <td
                          class="
                            px-5
                            py-5
                            text-center
                          "
                        >

                          <span
                            class="
                              inline-flex
                              rounded-full
                              px-3
                              py-1
                              text-xs
                              font-semibold

                              ${
                                active

                                  ? "bg-green-50 text-green-700"

                                  : "bg-neutral-100 text-neutral-500"
                              }
                            "
                          >

                            ${
                              active
                                ? "Đang hiển thị"
                                : "Đã ẩn"
                            }

                          </span>

                        </td>


                        <!-- ACTION -->

                        <td class="px-5 py-5">

                          <div
                            class="
                              flex
                              justify-center
                              items-center
                              gap-2
                            "
                          >


                            <button
                              type="button"

                              onclick="
                                openBrandForm(
                                  ${brandId}
                                )
                              "

                              title="Sửa"

                              class="
                                w-10
                                h-10
                                rounded-xl
                                border
                                border-neutral-200
                                flex
                                items-center
                                justify-center
                                text-neutral-600
                                hover:bg-neutral-50
                                hover:text-red-800
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
                                deleteBrand(
                                  ${brandId}
                                )
                              "

                              title="Xóa"

                              class="
                                w-10
                                h-10
                                rounded-xl
                                border
                                border-red-100
                                flex
                                items-center
                                justify-center
                                text-red-600
                                hover:bg-red-50
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

                  }).join("")

                : `

                  <tr>

                    <td
                      colspan="6"

                      class="
                        px-6
                        py-16
                        text-center
                        text-neutral-400
                      "
                    >

                      Không tìm thấy thương hiệu phù hợp

                    </td>

                  </tr>

                `
            }

          </tbody>

        </table>

      </div>


      <!-- ===================================== -->
      <!-- FOOTER -->
      <!-- ===================================== -->

      <div
        class="
          px-5
          py-4
          border-t
          border-neutral-200
          bg-white
          text-sm
          text-neutral-500
        "
      >

        Hiển thị

        <b class="text-neutral-800">
          ${list.length}
        </b>

        /

        <b class="text-neutral-800">
          ${
            Array.isArray(brands)
              ? brands.length
              : 0
          }
        </b>

        thương hiệu

      </div>

    </div>


    ${
      typeof brandModal === "function"
        ? brandModal()
        : ""
    }
  `;
}

function brandModal(){
  return `<div id="brandModal" class="fixed inset-0 bg-black/40 z-[999] hidden items-center justify-center p-5">
    <div class="bg-white rounded-3xl p-7 w-full max-w-lg shadow-xl">
      <div class="flex justify-between items-center mb-5">
        <h2 id="brandFormTitle" class="serif text-3xl">Thêm thương hiệu</h2>
        <button onclick="closeBrandForm()" class="text-2xl">×</button>
      </div>
      <input type="hidden" id="brandId">
      <div class="space-y-4">
        <input id="brandName" class="input-ui" placeholder="Tên thương hiệu">
        <textarea id="brandDesc" class="input-ui" placeholder="Mô tả"></textarea>
        <select id="brandStatus" class="input-ui"><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></select>
        <button onclick="saveBrand()" class="btn-primary w-full">Lưu thương hiệu</button>
      </div>
    </div>
  </div>`;
}

function openBrandForm(id=null){
  document.getElementById('brandModal').classList.remove('hidden');
  document.getElementById('brandModal').classList.add('flex');
  document.getElementById('brandFormTitle').innerText = id ? 'Sửa thương hiệu' : 'Thêm thương hiệu';
  document.getElementById('brandId').value = id || '';

  const b = brands.find(x => x.brandId === id);
  document.getElementById('brandName').value = b?.brandName || '';
  document.getElementById('brandDesc').value = b?.description || '';
  document.getElementById('brandStatus').value = b?.status || 'ACTIVE';
}

function closeBrandForm(){
  document.getElementById('brandModal').classList.add('hidden');
  document.getElementById('brandModal').classList.remove('flex');
}

async function saveBrand(){
  const id = document.getElementById('brandId').value;

  const body = {
    brandName: document.getElementById('brandName').value.trim(),
    description: document.getElementById('brandDesc').value.trim(),
    status: document.getElementById('brandStatus').value
  };

  if(!body.brandName){
    showToast("Lỗi", "Vui lòng nhập tên thương hiệu", "error");
    return;
  }

  const url = id ? `${API_BASE}/brands/${id}` : `${API_BASE}/brands`;
  const method = id ? 'PUT' : 'POST';

  const res = await fetch(url,{
    method,
    headers: adminJsonHeaders(),
    body:JSON.stringify(body)
  });

  const data = await res.json().catch(()=>({}));

  if(!res.ok){
    showToast("Lỗi", data.message || "Lưu thương hiệu thất bại", "error");
    return;
  }

  closeBrandForm();

  showToast("Thành công", "Đã lưu thương hiệu");

  await init();
}

function deleteBrand(id){
  showConfirm("Xóa thương hiệu này?", async () => {
    const res = await fetch(
      `${API_BASE}/brands/${id}`,
      {
        method:'DELETE',
        headers: adminAuthHeaders()
      }
    );
    const data = await res.json().catch(() => ({}));

    if(!res.ok){
      showToast(
        "Lỗi",
        "Không thể xóa vì đang có sản phẩm dùng thương hiệu",
        "error"
      );
      return;
    }

    showToast("Thành công", "Đã xóa thương hiệu");
    await init();
  });
}
