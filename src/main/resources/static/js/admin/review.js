// Refactored from legacy /js/admin.js. Business logic preserved.
// Loaded as a compatibility classic script by admin/admin.js so existing inline handlers keep working.

function escapeHtml(value){
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function reviewProductName(review) {
  return (
    review?.orderItem?.variant?.product?.productName ||
    review?.orderItem?.product?.productName ||
    review?.product?.productName ||
    review?.productName ||
    "Không rõ sản phẩm"
  );
}

function reviewProductId(review) {
  return (
    review?.orderItem?.variant?.product?.productId ??
    review?.orderItem?.product?.productId ??
    review?.product?.productId ??
    review?.productId ??
    null
  );
}

function reviewOrderId(review) {
  return (
    review?.orderItem?.order?.orderId ??
    review?.orderItem?.orderId ??
    review?.order?.orderId ??
    review?.orderId ??
    null
  );
}

function reviewOrderItemId(review) {
  return (
    review?.orderItem?.orderItemId ??
    review?.orderItem?.id ??
    null
  );
}

function reviewDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("vi-VN");
}

function reviewStars(rating) {
  let value = Number(rating || 0);

  value = Math.max(
    0,
    Math.min(5, value)
  );

  return `
    <span class="text-yellow-500">
      ${"★".repeat(value)}
    </span>

    <span class="text-neutral-300">
      ${"★".repeat(5 - value)}
    </span>
  `;
}

function findReviewById(id) {
  return reviews.find(
    r => Number(r.reviewId) === Number(id)
  );
}

function changeReviewPage(page) {
  const keyword =
    String(adminSearch.reviews || "")
      .trim()
      .toLowerCase();

  const filtered = reviews.filter(r => {

    const userName =
      String(r.user?.fullname || "")
        .toLowerCase();

    const email =
      String(r.user?.email || "")
        .toLowerCase();

    const productName =
      String(reviewProductName(r))
        .toLowerCase();

    const comment =
      String(r.comment || "")
        .toLowerCase();

    return (
      userName.includes(keyword) ||
      email.includes(keyword) ||
      productName.includes(keyword) ||
      comment.includes(keyword)
    );
  });

  const totalPages = Math.max(
    1,
    Math.ceil(
      filtered.length / REVIEW_PAGE_SIZE
    )
  );

  reviewPage = Math.min(
    Math.max(1, Number(page) || 1),
    totalPages
  );

  render();
}

function reviewPagination(totalPages) {

  if (totalPages <= 1) {
    return "";
  }

  const pages = [];

  /*
   * Tối đa hiển thị khoảng 5 số trang quanh trang hiện tại.
   */
  let start = Math.max(
    1,
    reviewPage - 2
  );

  let end = Math.min(
    totalPages,
    reviewPage + 2
  );


  if (reviewPage <= 3) {
    end = Math.min(
      totalPages,
      5
    );
  }


  if (reviewPage >= totalPages - 2) {
    start = Math.max(
      1,
      totalPages - 4
    );
  }


  /*
   * Trang đầu.
   */
  if (start > 1) {

    pages.push(`
      <button
        type="button"
        onclick="changeReviewPage(1)"
        class="
          w-9 h-9
          rounded-lg
          border
          bg-white
          hover:bg-neutral-50
          font-semibold
        "
      >
        1
      </button>
    `);


    if (start > 2) {

      pages.push(`
        <span
          class="
            w-8
            text-center
            text-neutral-400
          "
        >
          ...
        </span>
      `);
    }
  }


  /*
   * Các trang giữa.
   */
  for (
    let page = start;
    page <= end;
    page++
  ) {

    pages.push(`
      <button
        type="button"
        onclick="changeReviewPage(${page})"
        class="
          w-9 h-9
          rounded-lg
          border
          font-semibold
          transition

          ${
            page === reviewPage
              ? "bg-red-800 text-white border-red-800"
              : "bg-white hover:bg-neutral-50"
          }
        "
      >
        ${page}
      </button>
    `);
  }


  /*
   * Trang cuối.
   */
  if (end < totalPages) {

    if (end < totalPages - 1) {

      pages.push(`
        <span
          class="
            w-8
            text-center
            text-neutral-400
          "
        >
          ...
        </span>
      `);
    }


    pages.push(`
      <button
        type="button"
        onclick="changeReviewPage(${totalPages})"
        class="
          w-9 h-9
          rounded-lg
          border
          bg-white
          hover:bg-neutral-50
          font-semibold
        "
      >
        ${totalPages}
      </button>
    `);
  }


  return `
    <div
      class="
        flex
        items-center
        gap-2
        flex-wrap
        justify-end
      "
    >

      <!-- TRƯỚC -->
      <button
        type="button"

        onclick="
          changeReviewPage(
            ${Math.max(1, reviewPage - 1)}
          )
        "

        ${reviewPage <= 1 ? "disabled" : ""}

        class="
          h-9
          px-3
          rounded-lg
          border
          bg-white
          font-semibold
          text-sm
          flex
          items-center
          gap-1

          ${
            reviewPage <= 1
              ? "opacity-40 cursor-not-allowed"
              : "hover:bg-neutral-50"
          }
        "
      >
        ‹ Trước
      </button>


      ${pages.join("")}


      <!-- SAU -->
      <button
        type="button"

        onclick="
          changeReviewPage(
            ${Math.min(
              totalPages,
              reviewPage + 1
            )}
          )
        "

        ${
          reviewPage >= totalPages
            ? "disabled"
            : ""
        }

        class="
          h-9
          px-3
          rounded-lg
          border
          bg-white
          font-semibold
          text-sm
          flex
          items-center
          gap-1

          ${
            reviewPage >= totalPages
              ? "opacity-40 cursor-not-allowed"
              : "hover:bg-neutral-50"
          }
        "
      >
        Sau ›
      </button>

    </div>
  `;
}

function reviewPanel() {

  const keyword =
    String(adminSearch.reviews || "")
      .trim()
      .toLowerCase();


  /* =======================================================
     FILTER
  ======================================================= */

  const list = reviews.filter(r => {

    const userName =
      String(r.user?.fullname || "")
        .toLowerCase();

    const email =
      String(r.user?.email || "")
        .toLowerCase();

    const productName =
      String(reviewProductName(r))
        .toLowerCase();

    const comment =
      String(r.comment || "")
        .toLowerCase();


    return (
      userName.includes(keyword) ||
      email.includes(keyword) ||
      productName.includes(keyword) ||
      comment.includes(keyword)
    );
  });


  /* =======================================================
     PAGINATION
  ======================================================= */

  const totalItems = list.length;

  const totalPages = Math.max(
    1,
    Math.ceil(
      totalItems / REVIEW_PAGE_SIZE
    )
  );


  if (reviewPage > totalPages) {
    reviewPage = totalPages;
  }

  if (reviewPage < 1) {
    reviewPage = 1;
  }


  const startIndex =
    (reviewPage - 1) *
    REVIEW_PAGE_SIZE;


  const endIndex = Math.min(
    startIndex + REVIEW_PAGE_SIZE,
    totalItems
  );


  const pageItems =
    list.slice(
      startIndex,
      endIndex
    );


  /* =======================================================
     HTML
  ======================================================= */

  return `

    <div
      class="
        soft-card
        overflow-hidden
      "
    >

      <!-- HEADER -->
      <div
        class="
          px-6
          py-4
          border-b
          flex
          flex-col
          lg:flex-row
          lg:items-center
          lg:justify-between
          gap-4
        "
      >

        <div>

          <h2
            class="
              font-bold
              text-xl
            "
          >
            Quản lý đánh giá
          </h2>


          <p
            class="
              text-sm
              text-neutral-500
              mt-1
            "
          >
            Tổng cộng ${reviews.length} đánh giá
          </p>

        </div>


        <div
          class="
            flex
            gap-3
            w-full
            lg:w-auto
          "
        >

          <input
            data-search="reviews"

            value="${
              escapeHtml(
                adminSearch.reviews || ""
              )
            }"

            oninput="
              reviewPage = 1;
              searchAdmin(
                'reviews',
                this.value
              )
            "

            class="
              border
              rounded-full
              px-5
              py-3
              w-full
              lg:w-80
              outline-none
              focus:border-red-800
            "

            placeholder="Tìm user, sản phẩm, nội dung..."
          >


          <button
            type="button"

            onclick="
              reviewPage = 1;

              loadData().then(() => {
                currentTab = 'reviews';
                render();
              })
            "

            class="
              border
              rounded-full
              px-5
              py-3
              font-bold
              whitespace-nowrap
              hover:bg-neutral-50
              transition
            "
          >
            Làm mới
          </button>

        </div>

      </div>


      <!-- TABLE -->
      <div class="overflow-x-auto">

        <table
          class="
            w-full
            text-left
            table-fixed
          "
        >

          <thead
            class="
              bg-neutral-50
              text-sm
              text-neutral-500
            "
          >

            <tr>

              <th
                class="
                  p-4
                  w-[150px]
                "
              >
                Khách hàng
              </th>


              <th
                class="
                  w-[155px]
                "
              >
                Sản phẩm
              </th>


              <th
                class="
                  w-[115px]
                "
              >
                Đánh giá
              </th>


              <th>
                Nội dung
              </th>


              <th
                class="
                  w-[105px]
                "
              >
                Hình ảnh
              </th>


              <th
                class="
                  w-[145px]
                "
              >
                Ngày
              </th>


              <!-- THU GỌN CỘT THAO TÁC -->
              <th
                class="
                  w-[100px]
                  text-center
                "
              >
                Thao tác
              </th>

            </tr>

          </thead>


          <tbody>

            ${
              pageItems.length

              ? pageItems.map(r => {

                  const image =
                    r.imageUrl;


                  const productName =
                    reviewProductName(r);


                  const size =
                    r.orderItem
                      ?.variant
                      ?.size || "-";


                  const color =
                    r.orderItem
                      ?.variant
                      ?.color || "-";


                  return `

                    <tr
                      class="
                        border-t
                        align-top
                        hover:bg-neutral-50/50
                        transition-colors
                      "
                    >

                      <!-- KHÁCH HÀNG -->
                      <td
                        class="
                          p-4
                        "
                      >

                        <b
                          class="
                            block
                            truncate
                          "

                          title="${
                            escapeHtml(
                              r.user?.fullname ||
                              "Khách hàng"
                            )
                          }"
                        >
                          ${
                            escapeHtml(
                              r.user?.fullname ||
                              "Khách hàng"
                            )
                          }
                        </b>


                        <p
                          class="
                            text-xs
                            text-neutral-500
                            mt-1
                            truncate
                          "

                          title="${
                            escapeHtml(
                              r.user?.email || ""
                            )
                          }"
                        >
                          ${
                            escapeHtml(
                              r.user?.email || ""
                            )
                          }
                        </p>

                      </td>


                      <!-- SẢN PHẨM -->
                      <td
                        class="
                          pr-3
                          py-4
                        "
                      >

                        <b
                          class="
                            block
                            truncate
                          "

                          title="${
                            escapeHtml(
                              productName
                            )
                          }"
                        >
                          ${
                            escapeHtml(
                              productName
                            )
                          }
                        </b>


                        <p
                          class="
                            text-xs
                            text-neutral-500
                            mt-1
                            truncate
                          "

                          title="Size: ${
                            escapeHtml(size)
                          } · Màu: ${
                            escapeHtml(color)
                          }"
                        >
                          Size:
                          ${escapeHtml(size)}
                          · Màu:
                          ${escapeHtml(color)}
                        </p>

                      </td>


                      <!-- RATING -->
                      <td
                        class="
                          py-4
                          pr-2
                        "
                      >

                        <div
                          class="
                            text-base
                            whitespace-nowrap
                          "
                        >
                          ${reviewStars(r.rating)}
                        </div>


                        <span
                          class="
                            text-sm
                            font-bold
                          "
                        >
                          ${
                            Number(
                              r.rating || 0
                            )
                          }/5
                        </span>

                      </td>


                      <!-- NỘI DUNG -->
                      <td
                        class="
                          py-4
                          pr-4
                        "
                      >

                        <p
                          class="
                            whitespace-normal
                            break-words
                            line-clamp-3
                            text-sm
                          "

                          title="${
                            escapeHtml(
                              r.comment || ""
                            )
                          }"
                        >
                          ${
                            escapeHtml(
                              r.comment ||
                              "Không có nội dung"
                            )
                          }
                        </p>

                      </td>


                      <!-- HÌNH ẢNH -->
                      <td
                        class="
                          py-4
                          pr-3
                        "
                      >

                        ${
                          image

                          ? `
                            <a
                              href="${escapeHtml(image)}"
                              target="_blank"
                              rel="noopener noreferrer"
                            >

                              <img
                                src="${escapeHtml(image)}"

                                class="
                                  w-16
                                  h-16
                                  object-cover
                                  rounded-xl
                                  border
                                  transition
                                  hover:scale-105
                                "

                                onerror="
                                  this.src='/images/no-image.png'
                                "
                              >

                            </a>
                          `

                          : `
                            <span
                              class="
                                text-xs
                                text-neutral-400
                              "
                            >
                              Không có ảnh
                            </span>
                          `
                        }

                      </td>


                      <!-- NGÀY -->
                      <td
                        class="
                          py-4
                          pr-3
                          text-xs
                          text-neutral-500
                        "
                      >
                        ${
                          escapeHtml(
                            reviewDate(
                              r.createdAt
                            )
                          )
                        }
                      </td>


                      <!-- =================================================
                           THAO TÁC - GIAO DIỆN MỚI
                      ================================================== -->

                      <td
                        class="
                          py-4
                          px-2
                        "
                      >

                        <div
                          class="
                            flex
                            items-center
                            justify-center
                            gap-2
                          "
                        >

                          <!-- XEM CHI TIẾT -->
                          <button
                            type="button"

                            onclick="
                              openReviewDetail(
                                ${Number(r.reviewId)}
                              )
                            "

                            title="Xem chi tiết đánh giá"

                            aria-label="Xem chi tiết đánh giá"

                            class="
                              group
                              w-9
                              h-9
                              shrink-0
                              inline-flex
                              items-center
                              justify-center

                              rounded-xl

                              border
                              border-neutral-200

                              bg-white
                              text-neutral-600

                              shadow-sm

                              transition-all
                              duration-200

                              hover:bg-neutral-900
                              hover:text-white
                              hover:border-neutral-900
                              hover:shadow-md
                              hover:-translate-y-0.5

                              active:translate-y-0
                              active:scale-95
                            "
                          >

                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="17"
                              height="17"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              aria-hidden="true"
                            >
                              <path
                                d="
                                  M2.062 12.348
                                  a1 1 0 0 1 0-.696
                                  10.75 10.75 0 0 1 19.876 0
                                  1 1 0 0 1 0 .696
                                  10.75 10.75 0 0 1-19.876 0
                                "
                              />
                              <circle
                                cx="12"
                                cy="12"
                                r="3"
                              />
                            </svg>

                          </button>


                          <!-- XÓA -->
                          <button
                            type="button"

                            onclick="
                              deleteReview(
                                ${Number(r.reviewId)}
                              )
                            "

                            title="Xóa đánh giá"

                            aria-label="Xóa đánh giá"

                            class="
                              group
                              w-9
                              h-9
                              shrink-0
                              inline-flex
                              items-center
                              justify-center

                              rounded-xl

                              border
                              border-red-100

                              bg-red-50
                              text-red-600

                              shadow-sm

                              transition-all
                              duration-200

                              hover:bg-red-600
                              hover:text-white
                              hover:border-red-600
                              hover:shadow-md
                              hover:-translate-y-0.5

                              active:translate-y-0
                              active:scale-95
                            "
                          >

                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="17"
                              height="17"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M3 6h18"/>
                              <path
                                d="
                                  M8 6V4
                                  c0-1 1-2 2-2
                                  h4
                                  c1 0 2 1 2 2
                                  v2
                                "
                              />
                              <path
                                d="
                                  M19 6l-1 14
                                  c-.1 1-1 2-2 2
                                  H8
                                  c-1 0-1.9-1-2-2
                                  L5 6
                                "
                              />
                              <path d="M10 11v6"/>
                              <path d="M14 11v6"/>
                            </svg>

                          </button>

                        </div>

                      </td>

                    </tr>

                  `;

                }).join("")

              : `

                <tr>

                  <td
                    colspan="7"
                    class="
                      p-10
                      text-center
                      text-neutral-500
                    "
                  >
                    ${
                      keyword
                        ? "Không tìm thấy đánh giá phù hợp"
                        : "Chưa có đánh giá"
                    }
                  </td>

                </tr>

              `
            }

          </tbody>

        </table>

      </div>


      <!-- FOOTER / PAGINATION -->
      <div
        class="
          border-t
          px-5
          py-4
          flex
          flex-col
          md:flex-row
          md:items-center
          md:justify-between
          gap-4
        "
      >

        <div
          class="
            text-sm
            text-neutral-500
          "
        >

          ${
            totalItems > 0

            ? `
              Hiển thị

              <b class="text-neutral-800">
                ${startIndex + 1}
                -
                ${endIndex}
              </b>

              /

              <b class="text-neutral-800">
                ${totalItems}
              </b>

              đánh giá
            `

            : `
              Hiển thị

              <b class="text-neutral-800">
                0
              </b>

              đánh giá
            `
          }

        </div>


        ${reviewPagination(totalPages)}

      </div>

    </div>
  `;
}

function openReviewDetail(id) {

  const review =
    findReviewById(id);


  if (!review) {

    showToast(
      "Lỗi",
      "Không tìm thấy đánh giá",
      "error"
    );

    return;
  }


  /*
   * Đóng modal cũ nếu tồn tại.
   */
  closeReviewDetail();


  const productName =
    reviewProductName(review);


  const productId =
    reviewProductId(review);


  const orderId =
    reviewOrderId(review);


  const orderItemId =
    reviewOrderItemId(review);


  const size =
    review.orderItem
      ?.variant
      ?.size || "-";


  const color =
    review.orderItem
      ?.variant
      ?.color || "-";


  const quantity =
    review.orderItem
      ?.quantity ?? "-";


  const image =
    review.imageUrl;


  const modal =
    document.createElement("div");


  modal.id =
    "reviewDetailModalDynamic";


  modal.className = `
    fixed
    inset-0
    z-[99999]
    bg-black/50
    flex
    items-center
    justify-center
    p-4
  `;


  /*
   * Click nền đen -> đóng.
   */
  modal.onclick = function(event) {

    if (event.target === modal) {
      closeReviewDetail();
    }

  };


  modal.innerHTML = `

    <div

      class="
        bg-white
        w-full
        max-w-3xl
        max-h-[92vh]
        overflow-y-auto
        rounded-2xl
        shadow-2xl
      "

      onclick="
        event.stopPropagation()
      "
    >

      <!-- HEADER -->
      <div
        class="
          px-6
          py-5
          border-b
          flex
          items-center
          justify-between
          sticky
          top-0
          bg-white
          z-10
        "
      >

        <div>

          <h2
            class="
              text-2xl
              font-bold
            "
          >
            Chi tiết đánh giá
          </h2>


          <p
            class="
              text-sm
              text-neutral-500
              mt-1
            "
          >
            Mã đánh giá:
            #${escapeHtml(review.reviewId)}
          </p>

        </div>


        <button

          type="button"

          onclick="
            closeReviewDetail()
          "

          class="
            w-10
            h-10
            rounded-full
            border
            text-xl
            hover:bg-neutral-100
          "
        >
          ×
        </button>

      </div>


      <div
        class="
          p-6
          space-y-6
        "
      >

        <!-- =================================================
             NGUỒN ĐÁNH GIÁ
        ================================================== -->

        <div
          class="
            rounded-2xl
            border
            bg-neutral-50
            p-5
          "
        >

          <div
            class="
              flex
              items-center
              justify-between
              gap-3
              mb-4
            "
          >

            <div>

              <p
                class="
                  text-xs
                  uppercase
                  tracking-wider
                  text-neutral-500
                  font-bold
                "
              >
                Đánh giá từ
              </p>


              <h3
                class="
                  text-xl
                  font-bold
                  mt-1
                "
              >
                ${
                  escapeHtml(
                    productName
                  )
                }
              </h3>

            </div>


            ${
              productId

              ? `
                <a

                  href="/detail?productId=${
                    encodeURIComponent(
                      productId
                    )
                  }"

                  target="_blank"

                  class="
                    shrink-0
                    bg-red-800
                    text-white
                    rounded-xl
                    px-4
                    py-2
                    text-sm
                    font-bold
                    hover:bg-red-900
                  "
                >
                  Xem sản phẩm
                </a>
              `

              : ""
            }

          </div>


          <div
            class="
              grid
              sm:grid-cols-2
              gap-3
              text-sm
            "
          >

            <div>
              <span class="text-neutral-500">
                Sản phẩm:
              </span>

              <b>
                ${escapeHtml(productName)}
              </b>
            </div>


            <div>
              <span class="text-neutral-500">
                Product ID:
              </span>

              <b>
                ${
                  productId
                    ? "#" + escapeHtml(productId)
                    : "Không có dữ liệu"
                }
              </b>
            </div>


            <div>
              <span class="text-neutral-500">
                Size:
              </span>

              <b>
                ${escapeHtml(size)}
              </b>
            </div>


            <div>
              <span class="text-neutral-500">
                Màu:
              </span>

              <b>
                ${escapeHtml(color)}
              </b>
            </div>


            <div>
              <span class="text-neutral-500">
                Số lượng mua:
              </span>

              <b>
                ${escapeHtml(quantity)}
              </b>
            </div>


            <div>
              <span class="text-neutral-500">
                Order Item:
              </span>

              <b>
                ${
                  orderItemId
                    ? "#" + escapeHtml(orderItemId)
                    : "Không có dữ liệu"
                }
              </b>
            </div>


            <div>
              <span class="text-neutral-500">
                Đơn hàng:
              </span>

              <b>
                ${
                  orderId
                    ? "#" + escapeHtml(orderId)
                    : "Không có dữ liệu"
                }
              </b>
            </div>

          </div>

        </div>


        <!-- =================================================
             KHÁCH HÀNG
        ================================================== -->

        <div>

          <h3
            class="
              font-bold
              text-lg
              mb-3
            "
          >
            Khách hàng
          </h3>


          <div
            class="
              grid
              sm:grid-cols-2
              gap-4
              border
              rounded-2xl
              p-5
            "
          >

            <div>

              <p
                class="
                  text-xs
                  text-neutral-500
                  mb-1
                "
              >
                Họ tên
              </p>

              <b>
                ${
                  escapeHtml(
                    review.user?.fullname ||
                    "Khách hàng"
                  )
                }
              </b>

            </div>


            <div>

              <p
                class="
                  text-xs
                  text-neutral-500
                  mb-1
                "
              >
                Email
              </p>

              <b>
                ${
                  escapeHtml(
                    review.user?.email || "-"
                  )
                }
              </b>

            </div>

          </div>

        </div>


        <!-- =================================================
             ĐÁNH GIÁ
        ================================================== -->

        <div>

          <h3
            class="
              font-bold
              text-lg
              mb-3
            "
          >
            Nội dung đánh giá
          </h3>


          <div
            class="
              border
              rounded-2xl
              p-5
            "
          >

            <div
              class="
                flex
                flex-wrap
                items-center
                justify-between
                gap-3
                mb-4
              "
            >

              <div>

                <div
                  class="
                    text-xl
                    whitespace-nowrap
                  "
                >
                  ${reviewStars(review.rating)}
                </div>


                <b
                  class="
                    text-red-800
                  "
                >
                  ${
                    Number(
                      review.rating || 0
                    )
                  }/5
                </b>

              </div>


              <div
                class="
                  text-sm
                  text-neutral-500
                "
              >
                ${
                  escapeHtml(
                    reviewDate(
                      review.createdAt
                    )
                  )
                }
              </div>

            </div>


            <p
              class="
                leading-7
                whitespace-pre-wrap
                break-words
              "
            >${
              escapeHtml(
                review.comment ||
                "Không có nội dung đánh giá"
              )
            }</p>

          </div>

        </div>


        <!-- =================================================
             IMAGE
        ================================================== -->

        <div>

          <h3
            class="
              font-bold
              text-lg
              mb-3
            "
          >
            Hình ảnh đánh giá
          </h3>


          ${
            image

            ? `
              <a
                href="${escapeHtml(image)}"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-block"
              >

                <img

                  src="${escapeHtml(image)}"

                  class="
                    max-w-full
                    max-h-[420px]
                    object-contain
                    rounded-2xl
                    border
                  "

                  onerror="
                    this.src='/images/no-image.png'
                  "
                >

              </a>
            `

            : `
              <div
                class="
                  border
                  border-dashed
                  rounded-2xl
                  p-8
                  text-center
                  text-neutral-400
                "
              >
                Đánh giá này không có hình ảnh
              </div>
            `
          }

        </div>


        <!-- =================================================
             BUTTONS
        ================================================== -->

        <div
          class="
            flex
            justify-end
            gap-3
            border-t
            pt-5
          "
        >

          <button

            type="button"

            onclick="
              closeReviewDetail()
            "

            class="
              border
              rounded-xl
              px-6
              py-3
              font-bold
              hover:bg-neutral-50
            "
          >
            Đóng
          </button>


          <button

            type="button"

            onclick="
              closeReviewDetail();
              deleteReview(
                ${Number(review.reviewId)}
              );
            "

            class="
              bg-red-800
              text-white
              rounded-xl
              px-6
              py-3
              font-bold
              hover:bg-red-900
            "
          >
            Xóa đánh giá
          </button>

        </div>

      </div>

    </div>
  `;


  document.body.appendChild(
    modal
  );


  document.body.style.overflow =
    "hidden";
}

function closeReviewDetail() {

  const modal =
    document.getElementById(
      "reviewDetailModalDynamic"
    );


  if (modal) {
    modal.remove();
  }


  document.body.style.overflow =
    "";
}

function deleteReview(id) {

  showConfirm(

    "Xóa vĩnh viễn đánh giá này? Đánh giá sẽ không còn hiển thị trên sản phẩm.",

    async () => {

      try {

        const res =
          await fetch(
            `${API_BASE}/reviews/${id}`,
            {
              method: "DELETE",
              headers: adminAuthHeaders()
            }
          );


        const text =
          await res.text();


        if (!res.ok) {

          showToast(
            "Lỗi",
            text ||
            "Không thể xóa đánh giá",
            "error"
          );

          return;
        }


        /*
         * Xóa khỏi dữ liệu frontend.
         */
        reviews =
          reviews.filter(
            r =>
              Number(r.reviewId) !==
              Number(id)
          );


        /*
         * Tính lại trang sau khi xóa.
         */
        const keyword =
          String(
            adminSearch.reviews || ""
          )
            .trim()
            .toLowerCase();


        const filtered =
          reviews.filter(r => {

            const userName =
              String(
                r.user?.fullname || ""
              ).toLowerCase();

            const email =
              String(
                r.user?.email || ""
              ).toLowerCase();

            const productName =
              String(
                reviewProductName(r)
              ).toLowerCase();

            const comment =
              String(
                r.comment || ""
              ).toLowerCase();


            return (
              userName.includes(keyword) ||
              email.includes(keyword) ||
              productName.includes(keyword) ||
              comment.includes(keyword)
            );
          });


        const totalPages =
          Math.max(
            1,
            Math.ceil(
              filtered.length /
              REVIEW_PAGE_SIZE
            )
          );


        if (
          reviewPage >
          totalPages
        ) {

          reviewPage =
            totalPages;
        }


        currentTab =
          "reviews";


        render();


        showToast(
          "Thành công",
          "Đã xóa đánh giá"
        );


      } catch (error) {

        console.error(
          "DELETE REVIEW ERROR:",
          error
        );


        showToast(
          "Lỗi",
          error?.message ||
          "Không thể kết nối máy chủ",
          "error"
        );

      }

    },

    "Xóa"
  );
}
