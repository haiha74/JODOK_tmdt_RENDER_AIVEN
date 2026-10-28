function userAuthHeaders(){
  const user = getUser();

  return user?.token
    ? { "Authorization": "Bearer " + user.token }
    : {};
}

function productImg(item){
  const p = item.variant?.product;

  if(p?.imageUrl) return p.imageUrl;

  if(p?.images && p.images.length > 0){
    return p.images[0].imageUrl;
  }

  return "https://images.unsplash.com/photo-1539008835657-9e8e9680c956?q=80&w=900&auto=format&fit=crop";
}

let cart = null;

async function fetchCart() {
  const user = getUser();

  if (!user || !user.token || !user.userId) {
    document.getElementById("app").innerHTML =
      header() +
      `
      <main class="wrap py-16">
        <div class="soft-card p-10 text-center max-w-xl mx-auto">

          <h1 class="serif text-4xl">
            Bạn chưa đăng nhập
          </h1>

          <p class="mt-4 text-neutral-600">
            Vui lòng đăng nhập để xem giỏ hàng.
          </p>

          <a
            href="/auth"
            class="
              inline-block
              mt-7
              bg-red-800
              text-white
              rounded-full
              px-8
              py-3
              font-bold
            "
          >
            Đăng nhập
          </a>

        </div>
      </main>
      ` +
      footer();

    if (window.lucide) {
      lucide.createIcons();
    }

    return;
  }

  try {

    const res = await fetch(
      `${API_BASE}/cart/${user.userId}`,
      {
        method: "GET",

        headers: {
          "Authorization": "Bearer " + user.token,
          "Accept": "application/json"
        }
      }
    );


    /*
     * QUAN TRỌNG:
     *
     * Không dùng:
     *
     * await res.json()
     *
     * trực tiếp nữa.
     *
     * Nếu backend trả body rỗng,
     * res.json() sẽ gây:
     *
     * Unexpected end of JSON input
     */
    const rawText = await res.text();

    let data = null;


    /*
     * Chỉ parse JSON khi response thật sự có dữ liệu.
     */
    if (rawText && rawText.trim() !== "") {

      try {

        data = JSON.parse(rawText);

      } catch (parseError) {

        console.error(
          "Response cart không phải JSON:",
          rawText
        );

        throw new Error(
          "Backend trả dữ liệu giỏ hàng không hợp lệ"
        );
      }
    }


    /*
     * Nếu HTTP lỗi.
     */
    if (!res.ok) {

      let message =
        data?.message ||
        `Không tải được giỏ hàng (HTTP ${res.status})`;


      /*
       * JWT hết hạn / không hợp lệ.
       */
      if (res.status === 401) {

        message =
          "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
      }


      if (res.status === 403) {

        message =
          data?.message ||
          "Bạn không có quyền truy cập giỏ hàng này.";
      }


      throw new Error(message);
    }


    /*
     * HTTP 200 nhưng backend không trả body.
     */
    if (!data) {

      console.warn(
        "API cart trả response rỗng"
      );

      cart = {
        cartId: null,
        user: user,
        items: []
      };

    } else {

      cart = data;
    }


    /*
     * Đảm bảo items luôn là array.
     */
    if (!Array.isArray(cart.items)) {

      cart.items = [];
    }


    await loadJodokSalePrices();
    renderCart();


  } catch (error) {

    console.error(
      "FETCH CART ERROR:",
      error
    );


    document.getElementById("app").innerHTML =
      header() +
      `
      <main class="wrap py-16">

        <div class="
          soft-card
          p-10
          text-center
          max-w-3xl
          mx-auto
        ">

          <h1 class="
            text-3xl
            font-bold
            text-red-800
          ">
            Không tải được giỏ hàng
          </h1>

          <p class="
            mt-3
            text-neutral-600
          ">
            ${escapeCartHtml(
              error.message ||
              "Có lỗi xảy ra khi tải giỏ hàng"
            )}
          </p>

          <div class="
            mt-7
            flex
            justify-center
            gap-3
            flex-wrap
          ">

            <button
              onclick="fetchCart()"
              class="
                bg-red-800
                text-white
                rounded-full
                px-7
                py-3
                font-bold
              "
            >
              Thử lại
            </button>

            <a
              href="/products"
              class="
                border
                rounded-full
                px-7
                py-3
                font-bold
              "
            >
              Xem sản phẩm
            </a>

          </div>

        </div>

      </main>
      ` +
      footer();


    if (window.lucide) {

      lucide.createIcons();

    }
  }
}


/*
 * =========================================================
 * ESCAPE HTML
 * =========================================================
 *
 * Tránh đưa trực tiếp error message
 * từ backend vào HTML.
 */
function escapeCartHtml(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function calcSubtotal(){
  if(!cart?.items) return 0;

  return cart.items.reduce((sum,item)=>{
    const price = Number(jodokSalePrice(item.variant?.product?.productId, item.variant?.price ?? 0));
    const qty = Number(item.quantity || 0);
    return sum + price * qty;
  },0);
}

function renderCart(){
  const items = cart?.items || [];
  const subtotal = calcSubtotal();
  const shipping = subtotal >= 999000 || subtotal === 0 ? 0 : 30000;
  const total = subtotal + shipping;

  document.getElementById("app").innerHTML =
    header() + `
    <main class="wrap cart-page py-8">
      <div class="mb-6">
        <h1 class="serif text-4xl mt-2">
          Giỏ hàng của bạn
        </h1>
      </div>

      ${
        items.length === 0
        ? `
          <div class="soft-card p-12 text-center">
            <h2 class="serif text-4xl">Giỏ hàng đang trống</h2>

            <p class="mt-4 text-neutral-600">
              Hãy chọn sản phẩm yêu thích để thêm vào giỏ.
            </p>

            <a href="/products" class="inline-block mt-7 bg-red-800 text-white rounded-full px-8 py-3 font-bold">
              Mua sắm ngay
            </a>
          </div>
        `
        : `
          <div class="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-5">

            <section class="soft-card overflow-hidden">
              <div class="px-6 py-4 border-b flex justify-between">
                <h2 class="font-bold text-xl">Sản phẩm</h2>
                <span class="text-neutral-500">${items.length} sản phẩm</span>
              </div>

              <div>
                ${items.map(item => {
                  const p = item.variant?.product;
                  const v = item.variant;
                  const price = Number(jodokSalePrice(p?.productId, v?.price ?? 0));
                  const qty = Number(item.quantity || 0);
                  const stock = Number(v?.stock || 0);

                  return `
                    <div class="p-4 border-b grid md:grid-cols-[76px_minmax(0,1fr)_110px_110px_45px] gap-3 items-center">
                    <img src="${productImg(item)}" class="w-[76px] h-[88px] object-cover rounded-xl border">

                    <div>
                      <h3 class="font-bold text-base">
                        ${p?.productName || "Sản phẩm"}
                      </h3>

                      <p class="text-neutral-500 mt-1">
                        Size: <b>${v?.size || "-"}</b>
                        ·
                        Màu: <b>${v?.color || "-"}</b>
                      </p>

                      <p class="text-sm mt-1 ${stock > 0 ? "text-green-700" : "text-red-800"}">
                        ${stock > 0 ? `Còn ${stock} sản phẩm` : "Hết hàng"}
                      </p>

                      <p class="text-red-800 font-bold mt-2">
                        ${formatPrice(price)}
                      </p>
                    </div>

                    <div class="flex items-center border rounded-full w-fit">
                      <button onclick="updateQty(${item.cartItemId}, ${qty - 1})" class="px-4 py-2">-</button>
                      <span class="px-3 font-bold">${qty}</span>
                      <button onclick="updateQty(${item.cartItemId}, ${qty + 1})" class="px-4 py-2">+</button>
                    </div>

                    <div class="font-bold text-red-800">
                      ${formatPrice(price * qty)}
                    </div>

                    <button onclick="removeItem(${item.cartItemId})" class="text-red-800 font-bold">
                      Xóa
                    </button>
                  </div>`;
                }).join("")}
              </div>
            </section>

            <aside class="soft-card p-5 h-fit sticky top-28">
              <h2 class="font-bold text-xl mb-5">
                Tổng đơn hàng
              </h2>

              <div class="space-y-3 text-neutral-700">

                <div class="flex justify-between">
                  <span>Tạm tính</span>
                  <b>${formatPrice(subtotal)}</b>
                </div>

                <div class="flex justify-between">
                  <span>Phí vận chuyển</span>
                  <b>${shipping === 0 ? "Miễn phí" : formatPrice(shipping)}</b>
                </div>

                <div class="border-t pt-4 flex justify-between text-xl">
                  <span class="font-bold">Tổng cộng</span>
                  <b class="text-red-800">${formatPrice(total)}</b>
                </div>

              </div>

              <button onclick="goToPayment()" class="mt-5 w-full bg-red-800 text-white rounded-full py-3 font-bold">
                Đặt hàng
              </button>

              <a href="/products" class="block text-center mt-4 border rounded-full py-3 font-bold">
                Tiếp tục mua sắm
              </a>
            </aside>
          </div>
        `
      }
    </main>
    ` + footer();

  lucide.createIcons();
}

async function updateQty(itemId, quantity){
  if(quantity <= 0){
    await removeItem(itemId);
    return;
  }

  const res = await fetch(`${API_BASE}/cart/items/${itemId}?quantity=${quantity}`, {
    method: "PUT",
    headers: userAuthHeaders()
  });

  if(!res.ok){
    const text = await res.text();

    let msg = "Vượt tồn kho";

    if(text.includes("Vượt tồn kho")){
      msg = "Vượt tồn kho";
    }else if(text.includes("Không đủ tồn kho")){
      msg = "Không đủ tồn kho";
    }else if(text.includes("message")){
      msg = text.replaceAll("{","")
                .replaceAll("}","")
                .replaceAll('"message":',"")
                .replaceAll('"',"");
    }

    showToast("Không thể cập nhật", msg, "error");
    return;
  }

  await fetchCart();
}
async function removeItem(itemId){
  if(!itemId){
    alert("Không tìm thấy ID sản phẩm trong giỏ");
    return;
  }

  const ok = await showConfirm(
    "Xóa sản phẩm",
    "Bạn có chắc muốn xóa sản phẩm này khỏi giỏ hàng?"
    );

if(!ok) return;

  const res = await fetch(`${API_BASE}/cart/items/${itemId}`, {
    method: "DELETE",
    headers: userAuthHeaders()
  });

  const data = await res.json().catch(()=>({}));

  if(!res.ok){
    showToast("Thao tác thất bại", data.message || "Xóa sản phẩm thất bại", "error");
    return;
  }

  showToast("Đã xóa", "Sản phẩm đã được xóa khỏi giỏ hàng", "success");
  await fetchCart();
}

function goToPayment() {
  window.location.href = "/payment";
}

fetchCart();


function showConfirm(title, text){
  return new Promise(resolve => {
    const old = document.getElementById("confirmModal");
    if(old) old.remove();

    const modal = document.createElement("div");
    modal.id = "confirmModal";
    modal.className = "confirm-overlay";

    modal.innerHTML = `
      <div class="confirm-box">
        <h3 class="text-2xl font-bold">${title}</h3>
        <p class="text-neutral-600 mt-3">${text}</p>

        <div class="confirm-actions">
          <button class="btn-cancel" id="cancelConfirm">Hủy</button>
          <button class="btn-confirm" id="okConfirm">Xóa</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("cancelConfirm").onclick = () => {
      modal.remove();
      resolve(false);
    };

    document.getElementById("okConfirm").onclick = () => {
      modal.remove();
      resolve(true);
    };
  });
}