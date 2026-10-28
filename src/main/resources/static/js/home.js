let recommendProducts = [];
let homeSaleEvents = [];

const homeEventEscape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

function homeCollectionSection() {
  // Backend hiện tại chỉ có SaleEvent, chưa có bảng BST độc lập.
  // Tạm hiển thị tối đa 3 sự kiện đang diễn ra dưới dạng collection card.
  const items = homeSaleEvents.slice(0, 3);
  if (!items.length) return "";
  return `
    <section class="wrap py-10" id="home-collections">
      <div class="flex items-end justify-between gap-3 mb-6">
        <div>
          <h2 class="serif text-3xl md:text-4xl font-bold text-red-800">Bộ sưu tập nổi bật</h2>
        </div>
      </div>
      <div class="grid grid-cols-1 ${items.length === 1 ? 'md:grid-cols-1' : 'md:grid-cols-2'} ${items.length === 3 ? 'lg:grid-cols-3' : ''} gap-5">
        ${items.map(e => `
          <a href="/events/${encodeURIComponent(e.slug)}" class="block overflow-hidden rounded-2xl border bg-white hover:shadow-lg transition group">
            ${e.bannerUrl ? `<img src="${homeEventEscape(e.bannerUrl)}" alt="${homeEventEscape(e.name)}" class="w-full h-52 md:h-64 object-cover group-hover:scale-[1.02] transition" loading="lazy" onerror="this.onerror=null;this.src='/images/no-image.png'">` : `<div class="h-52 md:h-64 bg-gradient-to-br from-stone-700 to-red-900 text-white flex items-center justify-center text-2xl font-semibold">JODOK COLLECTION</div>`}
            <div class="p-5">
              <h3 class="font-semibold text-xl">${homeEventEscape(e.name)}</h3>
              <p class="mt-2 text-sm text-neutral-500 line-clamp-2">${homeEventEscape(e.description || 'Khám phá bộ sưu tập mới tại JODOK.')}</p>
              <span class="inline-block mt-4 text-red-800 text-sm font-semibold">Khám phá BST →</span>
            </div>
          </a>
        `).join("")}
      </div>
    </section>`;
}

let homeFeaturedTab = 'best';
let homeIsLoggedIn = false;

function homeFeaturedItems() {
  const list = [...products];
  if (homeFeaturedTab === 'best') {
    return list.sort((a, b) => getSoldCount(b.productId) - getSoldCount(a.productId)).slice(0, 10);
  }
  if (homeFeaturedTab === 'new') {
    return list.sort((a, b) => (Number(b.productId) || 0) - (Number(a.productId) || 0)).slice(0, 10);
  }
  const ids = new Set(homeSaleEvents.flatMap(e =>
    Array.isArray(e.productIds) ? e.productIds.map(Number) : []
  ));
  return list.filter(p => ids.has(Number(p.productId))).slice(0, 10);
}

function homeFeaturedSection() {
  // Dạng tab ngang lấy cảm hứng từ cách duyệt sản phẩm của Coolmate.
  // Chỉ thay giao diện tab, vẫn dùng productGrid() và dữ liệu JODOK hiện tại.
  const tabs = [
    { key: 'best', title: 'Bán chạy', icon: 'flame' },
    { key: 'new', title: 'Mới nhất', icon: 'sparkles' },
    { key: 'sale', title: 'Đang giảm giá', icon: 'badge-percent' }
  ];
  const featured = homeFeaturedItems();
  return `<section class="wrap py-10 md:py-14" id="home-featured">
    <div class="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h2 class="serif text-3xl md:text-4xl font-bold text-red-800">Sản phẩm nổi bật</h2>
      </div>
      <a href="/products" class="hidden md:inline-flex items-center gap-1 text-sm font-semibold text-red-800 hover:underline">Xem tất cả <span aria-hidden="true">↗</span></a>
    </div>

    <div class="border-b border-neutral-200 mb-6 overflow-x-auto" style="scrollbar-width:thin">
      <div class="flex items-stretch gap-6 md:gap-10 min-w-max" role="tablist" aria-label="Nhóm sản phẩm nổi bật">
        ${tabs.map(t => {
          const active = homeFeaturedTab === t.key;
          return `<button type="button" role="tab" aria-selected="${active}" onclick="switchHomeFeatured('${t.key}')"
            class="group relative flex items-center gap-2 pb-4 pt-2 whitespace-nowrap text-sm md:text-base font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-800 ${active ? 'text-red-800' : 'text-neutral-500 hover:text-red-800'}">
            <i data-lucide="${t.icon}" class="w-4 h-4 md:w-[18px] md:h-[18px]"></i>
            ${t.title}
            <span class="absolute bottom-0 left-0 right-0 h-[3px] rounded-t-full transition-transform duration-200 origin-left ${active ? 'bg-red-800 scale-x-100' : 'bg-red-800 scale-x-0 group-hover:scale-x-100'}"></span>
          </button>`;
        }).join('')}
      </div>
    </div>

    <div id="home-featured-products" role="tabpanel" aria-live="polite">
      ${featured.length
        ? productGrid(featured)
        : '<div class="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center text-neutral-500">Chưa có sản phẩm trong mục này. Hãy xem các mục khác nhé!</div>'}
    </div>
    <div class="flex justify-center mt-8 md:hidden">
      <a href="/products" class="inline-flex items-center gap-2 rounded-full border border-red-800 text-red-800 px-7 py-3 text-sm font-semibold hover:bg-red-800 hover:text-white transition">Xem tất cả sản phẩm →</a>
    </div>
  </section>`;
}

function switchHomeFeatured(tab) {
  if (!['best', 'new', 'sale'].includes(tab)) return;
  homeFeaturedTab = tab;
  const section = document.getElementById('home-featured');
  if (!section) return;
  const next = document.createElement('div');
  next.innerHTML = homeFeaturedSection();
  section.replaceWith(next.firstElementChild);
  if (window.lucide) lucide.createIcons();
}

function homeOfferSection() {
  // Chỉ hiện khi có chiến dịch đang diễn ra; không lặp thêm hàng loạt banner.
  const e = homeSaleEvents[0];
  if (!e) return '';
  const value = Number(e.discountValue || 0).toLocaleString('vi-VN');
  const offer = e.discountType === 'PERCENT' ? `Giảm ${value}%` : `Giảm ${value}đ`;
  return `<section class="wrap py-8" id="home-offer">
    <a href="/events/${encodeURIComponent(e.slug)}" class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-red-900 text-white rounded-2xl px-6 md:px-10 py-7">
      <div><h2 class="serif text-2xl md:text-3xl font-bold">${homeEventEscape(e.name)}</h2>
      <p class="text-sm mt-2 text-white/85">${offer} · Khám phá sản phẩm trong chương trình</p></div>
      <span class="shrink-0 bg-white text-red-900 font-bold px-5 py-3 rounded-full text-sm text-center">Xem ưu đãi →</span>
    </a>
  </section>`;
}

/* =========================================
   HERO SLIDER
========================================= */

function hero() {
  const slides = [
    {
      image: "https://res.cloudinary.com/t4cvynrt/image/upload/f_auto/q_auto/BST_T%C3%BAi_X%C3%A1ch_20_11_Sang_Tr%E1%BB%8Dng.png",
      title: "Trao Quà Tinh Tế – Gửi Lời Tri Ân 20/11",
      desc: "Nhân ngày Nhà giáo Việt Nam 20/11, khám phá bộ sưu tập túi xách và phụ kiện thời trang thanh lịch, tinh tế"
    },
    // {
    //   image: "https://res.cloudinary.com/t4cvynrt/image/upload/f_auto/q_auto/banner2.png",
    //   title: "Autumn Collection 2026",
    //   desc: "Thu đến, lên đồ thật chất"
    // },
    {
      image: "https://res.cloudinary.com/t4cvynrt/image/upload/f_auto/q_auto/BST_Thu_%C4%90%C3%B4ng_2026__Ch%E1%BA%A1m_Ch%E1%BA%A5t_Ri%C3%AAng.png",
      title: "Chạm Thu Phong Cách",
      desc: "Đón mùa se lạnh với bộ sưu tập Thu Đông 2026 dành cho cả nam và nữ"
    }
  ];

  // Banner sự kiện do Admin tạo được bổ sung động, không thay 3 banner mặc định.
  const eventSlides = homeSaleEvents.filter(event => event.bannerUrl).map(event => ({
    image: event.bannerUrl,
    title: event.name,
    desc: event.description || 'Ưu đãi thời trang đang diễn ra tại JODOK',
    slug: event.slug
  }));
  slides.unshift(...eventSlides.slice(0, 1));
  slides.splice(3);

  return `
    <section class="relative h-[360px] md:h-[520px] overflow-hidden bg-black">

      <div id="heroSlides" class="relative w-full h-full">

        ${slides.map((slide, index) => `
          <div class="hero-slide absolute inset-0 transition-opacity duration-700 ${index === 0 ? 'opacity-100 z-10' : 'opacity-0 z-0'}">

            <img
              class="absolute inset-0 w-full h-full object-cover"
              src="${homeEventEscape(slide.image)}"
              alt="${homeEventEscape(slide.title)}"
            >

            <div class="absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-transparent"></div>

            <div class="wrap relative h-full flex items-center text-white">
              <div class="max-w-2xl">

                <h1 class="serif text-4xl md:text-6xl leading-tight mt-4">
                  ${homeEventEscape(slide.title)}
                </h1>

                <p class="text-sm md:text-xl mt-5 text-white/85">
                  ${homeEventEscape(slide.desc)}
                </p>

                <button
                  onclick="${slide.slug ? `window.location.href='/events/${encodeURIComponent(slide.slug)}'` : "go('shop')"}"
                  class="mt-8 rounded-full bg-white text-black px-8 py-4 font-bold hover:bg-red-800 hover:text-white transition"
                >
                  Khám phá ngay
                </button>

              </div>
            </div>

          </div>
        `).join("")}

      </div>

      <!-- BUTTON LEFT -->
      <button
        onclick="prevHeroSlide()"
        aria-label="Slide trước"
        class="absolute left-6 top-1/2 -translate-y-1/2 z-30
               w-14 h-14 rounded-full bg-white/20 backdrop-blur
               text-white text-3xl hover:bg-white hover:text-black transition"
      >
        ‹
      </button>

      <!-- BUTTON RIGHT -->
      <button
        onclick="nextHeroSlide()"
        aria-label="Slide tiếp theo"
        class="absolute right-6 top-1/2 -translate-y-1/2 z-30
               w-14 h-14 rounded-full bg-white/20 backdrop-blur
               text-white text-3xl hover:bg-white hover:text-black transition"
      >
        ›
      </button>

      <!-- DOTS -->
      <div class="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex gap-3">

        ${slides.map((_, index) => `
          <button
            onclick="goHeroSlide(${index})"
            aria-label="Chuyển đến slide ${index + 1}"
            class="hero-dot w-3 h-3 rounded-full transition ${index === 0 ? 'bg-white scale-125' : 'bg-white/40'}"
          ></button>
        `).join("")}

      </div>

    </section>
  `;
}

/* =========================================
   HERO SLIDER FUNCTIONS
========================================= */

let currentHeroSlide = 0;
let heroInterval;

function updateHeroSlides() {
  const slides = document.querySelectorAll(".hero-slide");
  const dots = document.querySelectorAll(".hero-dot");

  if (!slides.length) return;

  slides.forEach((slide, index) => {
    if (index === currentHeroSlide) {
      slide.classList.remove("opacity-0", "z-0");
      slide.classList.add("opacity-100", "z-10");
    } else {
      slide.classList.remove("opacity-100", "z-10");
      slide.classList.add("opacity-0", "z-0");
    }
  });

  dots.forEach((dot, index) => {
    if (index === currentHeroSlide) {
      dot.classList.remove("bg-white/40");
      dot.classList.add("bg-white", "scale-125");
    } else {
      dot.classList.remove("bg-white", "scale-125");
      dot.classList.add("bg-white/40");
    }
  });
}

function nextHeroSlide() {
  const slides = document.querySelectorAll(".hero-slide");

  if (!slides.length) return;

  currentHeroSlide++;

  if (currentHeroSlide >= slides.length) {
    currentHeroSlide = 0;
  }

  updateHeroSlides();
}

function prevHeroSlide() {
  const slides = document.querySelectorAll(".hero-slide");

  if (!slides.length) return;

  currentHeroSlide--;

  if (currentHeroSlide < 0) {
    currentHeroSlide = slides.length - 1;
  }

  updateHeroSlides();
}

function goHeroSlide(index) {
  currentHeroSlide = index;
  updateHeroSlides();
}

function startHeroAutoSlide() {
  clearInterval(heroInterval);

  heroInterval = setInterval(() => {
    nextHeroSlide();
  }, 8000);
}

/* =========================================
   FEATURED CATEGORIES
========================================= */

function categoryGrid() {
  const parentCategories = categories.filter(
    c => !c.parent && !c.parentId
  );

  return `
    <section class="wrap py-12">

      <div class="w-full bg-white border rounded-3xl overflow-hidden shadow-sm">

        <h2 class="px-6 py-4 border-b text-xl md:text-2xl font-bold text-red-800">
          Danh mục nổi bật
        </h2>

        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7">

          ${parentCategories.map((c, i) => `

            <button
              type="button"
              onclick="location.href='/products?categoryId=${c.categoryId}'"
              class="h-28 border-r border-b hover:bg-red-50
                     flex flex-col items-center justify-center
                     gap-2 transition"
            >

              <img
                class="w-14 h-14 rounded-full object-cover"
                src="${c.imageUrl ? c.imageUrl + (c.imageUrl.includes('?') ? '&' : '?') + 't=' + Date.now() : '/images/no-image.png'}"
                alt="${c.categoryName}"
                loading="lazy"
                onerror="this.onerror=null;this.src='/images/no-image.png';"
              >

              <span class="text-sm font-semibold text-center px-2">
                ${c.categoryName}
              </span>

            </button>

          `).join("")}

        </div>

      </div>

    </section>
  `;
}

/* =========================================
   PERSONALIZED RECOMMENDATIONS
========================================= */
function recommendSection() {
  if (!homeIsLoggedIn) return '';

  const recommendations = Array.isArray(recommendProducts)
    ? recommendProducts.filter(p => p && p.status !== 'INACTIVE')
    : [];

  return `
    <section class="wrap py-10 md:py-14" id="home-recommendations">
      <div class="mb-6">
        <h2 class="serif text-3xl md:text-4xl font-bold text-red-800">
          Gợi ý cá nhân hóa
        </h2>
        <p class="mt-2 text-sm text-neutral-500">
          Những sản phẩm phù hợp với sở thích của bạn.
        </p>
      </div>

      ${recommendations.length
        ? productGrid(recommendations.slice(0, 10))
        : `<div class="rounded-xl border border-dashed border-neutral-300
                       bg-white px-6 py-9 text-center text-neutral-500">
             Chưa có gợi ý dành riêng cho bạn. Hãy khám phá các sản phẩm
             để JODOK hiểu sở thích của bạn hơn.
           </div>`}
    </section>
  `;
}

/* =========================================
   JODOK - SERVICE BENEFITS
========================================= */

function serviceBenefits() {
  const benefits = [
    {
      icon: "thumbs-up",
      title: "HÀNG HOÁ CHẤT LƯỢNG",
      description: "Tận hưởng các mặt hàng chất lượng hàng đầu với giá cả hợp lý"
    },
    {
      icon: "headset",
      title: "HỖ TRỢ 24/7",
      description: "Nhận hỗ trợ ngay lập tức bất cứ khi nào bạn cần"
    },
    {
      icon: "truck",
      title: "VẬN CHUYỂN NHANH CHÓNG",
      description: "Tùy chọn giao hàng nhanh chóng và đáng tin cậy"
    },
    {
      icon: "circle-dollar-sign",
      title: "THANH TOÁN AN TOÀN",
      description: "Nhiều phương thức thanh toán an toàn"
    }
  ];

  return `
      <section class="jodok-benefits wrap">
        
        <div class="text-left mb-5">

          <h2 class="serif text-2xl md:text-3xl font-bold text-red-800 mb-2">
            Mua sắm an tâm, trải nghiệm trọn vẹn
          </h2>

          <p class="text-neutral-500 text-sm md:text-base leading-relaxed">
            JODOK luôn đồng hành cùng bạn trong từng trải nghiệm mua sắm
          </p>

        </div>

        <div class="jodok-benefits-grid">

        ${benefits.map(item => `
          <div class="jodok-benefit-card">

            <div class="jodok-benefit-icon">
              ${icon(item.icon, "w-9 h-9")}
            </div>

            <h3 class="jodok-benefit-title">
              ${item.title}
            </h3>

            <p class="jodok-benefit-description">
              ${item.description}
            </p>

          </div>
        `).join("")}

      </div>

    </section>
  `;
}

/* =========================================
   HOME PAGE
========================================= */

function home() {
  // 6 khu vực: hero, danh mục, BST, sản phẩm (tabs), ưu đãi (nếu có), cam kết.
  return header()
    + hero()
    + categoryGrid()
    + homeCollectionSection()
    + recommendSection()
    + homeFeaturedSection()
    + homeOfferSection()
    + serviceBenefits()
    + footer();
}

/* =========================================
   LOAD HOME PAGE
========================================= */

async function loadHomePage() {
  try {
    const [
      productData,
      categoryData,
      brandData,
      orderData
    ] = await Promise.all([
      fetchJson(`${API_BASE}/products`),
      fetchJson(`${API_BASE}/categories`),
      fetchJson(`${API_BASE}/brands`).catch(() => []),
      fetchJson(`${API_BASE}/orders`).catch(() => [])
    ]);

    await loadJodokSalePrices();

    /* PRODUCTS */
    allProducts = productData.filter(
      p => p.status === "ACTIVE"
    );

    products = allProducts;

    /* CATEGORIES */
    categories = categoryData;

    /* BRANDS */
    brands = brandData;

    /* ORDERS */
    window.allOrders = orderData;

    /* SOLD COUNTS */
    window.soldCounts = {};

    await Promise.all(
      allProducts.map(async p => {
        try {
          const count = await fetchJson(
            `${API_BASE}/products/${p.productId}/sold-count`
          );

          window.soldCounts[p.productId] = Number(count || 0);
        } catch (e) {
          window.soldCounts[p.productId] = 0;
        }
      })
    );

    /* PERSONALIZED RECOMMENDATIONS */
    const user = getUser();
    homeIsLoggedIn = Boolean(user?.userId);

    recommendProducts = [];

    if (user?.userId) {
      try {
        const suggested = await fetchJson(
          `${API_BASE}/recommendations/${user.userId}`
        );
        recommendProducts = Array.isArray(suggested) ? suggested : [];
      } catch (e) {
        recommendProducts = [];
      }
    }

    /* ACTIVE SALE EVENTS: chỉ lấy sự kiện đang chạy, lỗi API không chặn trang chủ */
    try {
      const events = await fetchJson(`${API_BASE}/events`);
      homeSaleEvents = Array.isArray(events) ? events.filter(e => e && e.enabled && e.slug) : [];
    } catch (error) {
      console.warn('Không tải được sự kiện đang diễn ra:', error);
      homeSaleEvents = [];
    }

    /* ACTIVE EVENTS: sự kiện ngoài thời gian chạy không được đưa vào trang chủ */
    try {
      const result = await fetchJson(`${API_BASE}/events`);
      const now = Date.now();
      homeSaleEvents = Array.isArray(result) ? result.filter(e => {
        if (!e || !e.slug || !e.enabled || !e.startAt || !e.endAt) return false;
        const start = new Date(e.startAt).getTime();
        const end = new Date(e.endAt).getTime();
        return Number.isFinite(start) && Number.isFinite(end) && start <= now && now < end;
      }) : [];
    } catch (error) {
      console.warn('Không tải được sự kiện JODOK:', error);
      homeSaleEvents = [];
    }

    /* RENDER HOME */
    renderApp(home());

    /* START SLIDER */
    setTimeout(() => {
      startHeroAutoSlide();
    }, 100);

  } catch (err) {
    console.error(err);

    renderApp(
      header()

      + `
        <main class="wrap flex-1 p-10 text-center">

          <h1 class="text-3xl font-bold text-red-800">
            Không kết nối được backend
          </h1>

          <p class="mt-3">
            Kiểm tra Spring Boot đang chạy ở cổng 8080
            và API /api/products hoạt động.
          </p>

        </main>
      `

      + footer()
    );
  }
}

/* =========================================
   INITIALIZE
========================================= */

loadHomePage();