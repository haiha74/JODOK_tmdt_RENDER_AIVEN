/* JODOK collection detail – use shared common.js header/footer */
(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const currency = value => Number(value).toLocaleString('vi-VN') + 'đ';
  const slug = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
  const state = { event:null, items:[], filter:'all', sort:'default', limit:8, timer:null, soldCounts:{} };
  const iconHtml = (name, cls='w-4 h-4') => typeof icon === 'function' ? icon(name,cls) : '';

  function layout(content) {
    return header() + `<style>
      .bst-page .bst-tab{background:#fff;color:#3f3f46;border-color:#d4d4d8;cursor:pointer}
      .bst-page .bst-tab:hover:not(.is-active),.bst-page .bst-tab:focus-visible:not(.is-active){background:#fff1f2;color:#831e2a;border-color:#922a35}
      .bst-page .bst-tab.is-active,.bst-page .bst-tab.is-active:hover,.bst-page .bst-tab.is-active:focus-visible{background:#922a35!important;color:#fff!important;border-color:#922a35!important}
      .bst-page .bst-card{min-width:0}
    </style><main class="bst-page min-h-[55vh] bg-[#faf9f7] pb-10"><div class="wrap">${content}</div></main>` + footer();
  }
  function paint(content) { renderApp(layout(content)); }
  function discounted(original, productId) {
    const value = Number(original);
    if (original == null || !Number.isFinite(value)) return null;
    // Cùng một quy tắc giá với trang chủ, danh mục và trang chi tiết.
    if (typeof jodokSalePrice === 'function') {
      return Number(jodokSalePrice(productId, value));
    }
    const discount = Number(state.event?.discountValue || 0);
    const computed = state.event?.discountType === 'PERCENT' ? value * (1 - discount/100) : value - discount;
    return Math.max(0, Math.round(computed));
  }
  function catId(product) { return String(product.category?.categoryId ?? product.categoryId ?? 'unknown'); }
  function catName(product) { return product.category?.categoryName || 'Khác'; }
  function imageFor(product) {
    if (typeof getProductImage === 'function') {
      try { const url=getProductImage(product); if(url) return url; } catch (_) {}
    }
    return product.images?.find(i => i?.imageUrl)?.imageUrl || product.imageUrl || '/images/no-image.png';
  }
  function card(product) {
    const original = Number(product.basePrice);
    const valid = product.basePrice != null && Number.isFinite(original);
    const sale = valid ? discounted(original, product.productId) : null;
    const reduced = valid && sale < original;
    const percent = reduced && original > 0
      ? Math.round((original - sale) * 100 / original)
      : 0;
    const id = Number(product.productId);
    const sold = typeof formatSoldCount === 'function'
      ? formatSoldCount(state.soldCounts[id] ?? 0)
      : `${state.soldCounts[id] ?? 0} đã bán`;
    const href = '/detail?productId=' + encodeURIComponent(product.productId);

    return `
      <article class="bst-card group flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white hover:shadow-md transition-all duration-300">
        <a href="${href}" class="relative block aspect-[3/4] overflow-hidden bg-neutral-100">
          <img class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
               loading="lazy" src="${esc(imageFor(product))}" alt="${esc(product.productName)}"
               onerror="this.onerror=null;this.src='/images/no-image.png'">
          ${reduced ? `<span class="absolute left-3 top-3 rounded bg-[#922a35] px-2.5 py-1 text-xs font-bold text-white">SALE -${percent}%</span>` : ''}
        </a>
        <div class="flex flex-1 flex-col p-2.5 md:p-3">
          <p class="mb-1 text-xs text-neutral-500">${esc(catName(product))}</p>
          <a href="${href}" class="block min-h-[2.6em] line-clamp-2 text-sm font-semibold text-neutral-900 hover:text-red-800">${esc(product.productName)}</a>
          <div class="mt-auto flex min-w-0 items-end justify-between gap-2 pt-3">
            <div class="flex min-w-0 flex-col items-start gap-0.5">
              ${reduced ? `<del class="text-[11px] text-neutral-400">${currency(original)}</del>` : ''}
              <strong class="text-sm text-[#922a35]">${valid ? currency(sale) : 'Liên hệ'}</strong>
            </div>
            <span data-bst-sold="${id}" class="shrink-0 whitespace-nowrap text-right text-[10px] text-neutral-500">${esc(sold)}</span>
          </div>
          <a href="${href}" class="mt-2.5 flex items-center justify-center gap-1.5 rounded-lg bg-[#922a35] px-2 py-2 text-[11px] font-bold text-white hover:bg-[#6f1c26] transition"
             aria-label="Chọn màu, size và thêm giỏ hàng">
            ${iconHtml('shopping-cart','w-4 h-4')} THÊM GIỎ HÀNG
          </a>
        </div>
      </article>`;
  }
  function filtered() {
    let list = state.items.filter(p => state.filter === 'all' || catId(p) === state.filter);
    if (state.sort === 'low') list.sort((a,b) => (discounted(a.basePrice, a.productId) ?? Infinity)-(discounted(b.basePrice, b.productId) ?? Infinity));
    else if (state.sort === 'high') list.sort((a,b) => (discounted(b.basePrice, b.productId) ?? -1)-(discounted(a.basePrice, a.productId) ?? -1));
    else if (state.sort === 'discount') list.sort((a,b) => {
      const reduction = p => p.basePrice > 0 ? 1-(discounted(p.basePrice, p.productId)/Number(p.basePrice)) : 0;
      return reduction(b)-reduction(a);
    });
    return list;
  }
  function drawProducts() {
    const list = filtered();
    const grid=document.getElementById('bst-grid');
    if (!grid) return;
    grid.innerHTML = list.length ? list.slice(0,state.limit).map(card).join('') : `<p class="col-span-full rounded-xl bg-white p-8 text-center text-neutral-500">Chưa có sản phẩm trong danh mục này.</p>`;
    const total=document.getElementById('bst-total');
    if(total) total.textContent=`${list.length} sản phẩm`;
    const more=document.getElementById('bst-more');
    if(more) more.hidden=list.length<=state.limit;
    if(window.lucide) lucide.createIcons();
  }
  function countdown() {
    const node=document.getElementById('bst-clock');
    if(!node) { clearInterval(state.timer); return; }
    const remaining=new Date(state.event.endAt).getTime()-Date.now();
    if(!Number.isFinite(remaining)) {node.textContent='Chưa xác định';clearInterval(state.timer);return;}
    if(remaining<=0) {node.textContent='Đã kết thúc';clearInterval(state.timer);return;}
    const t=Math.floor(remaining/1000);
    const parts=[[Math.floor(t/86400),'Ngày'],[Math.floor(t%86400/3600),'Giờ'],[Math.floor(t%3600/60),'Phút'],[t%60,'Giây']];
    node.innerHTML=parts.map(([v,label])=>`<span class="min-w-[50px] rounded-lg bg-[#f4e7e6] px-2 py-2 text-center"><strong class="block text-lg text-[#922a35]">${String(v).padStart(2,'0')}</strong><small class="block text-[10px] text-neutral-500">${label}</small></span>`).join('');
  }
  function showDetail() {
    const e=state.event;
    const groups=[...new Map(state.items.map(p => [catId(p),catName(p)])).entries()];
    const tabs=[['all','Tất cả'],...groups];
    paint(`
      <nav class="py-5 text-sm text-neutral-500"><a href="/" class="hover:text-[#922a35]">Trang chủ</a><span class="px-2">/</span><span>Bộ sưu tập</span><span class="px-2">/</span><span class="text-neutral-900">${esc(e.name)}</span></nav>
      ${e.bannerUrl ? `<div class="overflow-hidden rounded-2xl bg-[#f1e1de]"><img src="${esc(e.bannerUrl)}" alt="${esc(e.name)}" class="block max-h-[450px] w-full object-cover" onerror="this.style.display='none'"></div>` : `<div class="rounded-2xl bg-gradient-to-r from-[#60242e] to-[#a85460] px-8 py-16 text-white"><p class="text-sm uppercase tracking-widest">JODOK COLLECTION</p><h1 class="mt-3 text-3xl md:text-5xl font-bold">${esc(e.name)}</h1></div>`}
      <section class="flex flex-col justify-between gap-5 border-b border-neutral-200 py-7 md:flex-row md:items-center">
        <div><h1 class="text-2xl font-bold md:text-4xl text-[#922a35]">${esc(e.name)}</h1>${e.description ? `<p class="mt-2 max-w-2xl text-neutral-600">${esc(e.description)}</p>` : ''}</div>
        <div class="shrink-0"><p class="mb-2 text-xs font-semibold text-neutral-600">Ưu đãi kết thúc sau</p><div id="bst-clock" class="flex flex-wrap gap-2" aria-live="off">Đang tính...</div></div>
      </section>
      <section id="bst-products" class="py-9">
        <div class="mb-5 flex flex-wrap items-end justify-between gap-4"><div><h2 class="text-2xl font-bold text-[#922a35] md:text-3xl">Sản phẩm trong BST</h2><p id="bst-total" class="mt-1 text-sm text-neutral-500"></p></div>
        <label class="text-sm text-neutral-600">Sắp xếp <select id="bst-sort" class="ml-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"><option value="default">Mặc định</option><option value="low">Giá thấp đến cao</option><option value="high">Giá cao đến thấp</option><option value="discount">Giảm nhiều nhất</option></select></label></div>
        <div id="bst-tabs" class="mb-6 flex flex-wrap gap-2">${tabs.map(([id,name],i)=>`<button type="button" data-cat="${esc(id)}" aria-pressed="${i===0}" class="bst-tab ${i===0?'is-active':''} rounded-full border px-4 py-2 text-sm font-semibold transition">${esc(name)}</button>`).join('')}</div>
        <div id="bst-grid" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 md:gap-4"></div>
        <div class="mt-8 text-center"><button id="bst-more" type="button" class="rounded-lg border border-neutral-300 bg-white px-8 py-3 text-sm font-semibold hover:border-[#922a35] hover:text-[#922a35]" hidden>Xem thêm sản phẩm ↓</button></div>
      </section>
      ${e.description ? `<section class="mb-10 grid overflow-hidden rounded-2xl bg-[#f2e8e4] md:grid-cols-2"><div class="flex flex-col justify-center p-7 md:p-12"><h2 class="text-2xl font-bold text-[#922a35] md:text-3xl">Câu chuyện bộ sưu tập</h2><p class="mt-4 leading-7 text-neutral-700">${esc(e.description)}</p><a href="#bst-products" class="mt-6 inline-flex w-fit rounded-lg bg-[#922a35] px-5 py-3 text-sm font-semibold text-white">Khám phá sản phẩm →</a></div><div class="min-h-[240px] bg-[#e9d5d0]">${e.bannerUrl ? `<img src="${esc(e.bannerUrl)}" class="h-full w-full object-cover" alt="${esc(e.name)}" loading="lazy">` : '<div class="flex h-full items-center justify-center text-3xl font-bold text-[#922a35]">JODOK</div>'}</div></section>` : ''}
    `);
    document.getElementById('bst-tabs')?.addEventListener('click',evt=>{
      const btn=evt.target.closest('[data-cat]');if(!btn)return;
      state.filter=btn.dataset.cat;state.limit=8;
      document.querySelectorAll('.bst-tab').forEach(b=>{const active=b===btn;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed', String(active));});
      drawProducts();
    });
    document.getElementById('bst-sort')?.addEventListener('change',e=>{state.sort=e.target.value;state.limit=8;drawProducts();});
    document.getElementById('bst-more')?.addEventListener('click',()=>{state.limit+=8;drawProducts();});
    drawProducts();countdown();clearInterval(state.timer);state.timer=setInterval(countdown,1000);
  }
  // Trang tổng hợp BST: dùng chung events.html, header() và footer().
  async function showCollections() {
    paint('<div class="py-16 text-center text-neutral-500">Đang tải bộ sưu tập...</div>');

    try {
      const response = await fetch(`${API_BASE}/events`);
      if (!response.ok) throw new Error(`Không tải được bộ sưu tập (HTTP ${response.status}).`);
      const result = await response.json();
      const items = Array.isArray(result) ? result.filter(e => e && e.slug) : [];

      paint(`
        <nav class="py-5 text-sm text-neutral-500"><a href="/" class="hover:text-[#922a35]">Trang chủ</a><span class="px-2">/</span><span class="text-neutral-900">Bộ sưu tập</span></nav>
        <section class="py-5 md:py-9">
          <h1 class="text-3xl font-bold text-[#922a35] md:text-4xl">Bộ sưu tập JODOK</h1>
          <p class="mt-3 text-neutral-600">Khám phá những bộ sưu tập và chương trình thời trang đang diễn ra.</p>
          ${items.length ? `
            <div class="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              ${items.map(e => `
                <a href="/events/${encodeURIComponent(e.slug)}" class="group overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-shadow hover:shadow-lg">
                  ${e.bannerUrl ? `
                    <img src="${esc(e.bannerUrl)}" alt="${esc(e.name)}" class="aspect-[16/9] w-full object-cover transition-transform group-hover:scale-[1.02]" loading="lazy" onerror="this.onerror=null;this.src='/images/no-image.png'">
                  ` : '<div class="flex aspect-[16/9] items-center justify-center bg-[#f3e1df] text-xl font-bold text-[#922a35]">JODOK COLLECTION</div>'}
                  <div class="p-5">
                    <h2 class="text-lg font-bold text-neutral-900 group-hover:text-[#922a35]">${esc(e.name)}</h2>
                    <p class="mt-2 line-clamp-2 text-sm text-neutral-600">${esc(e.description || 'Khám phá bộ sưu tập mới tại JODOK.')}</p>
                    <span class="mt-4 inline-block text-sm font-semibold text-[#922a35]">Khám phá BST →</span>
                  </div>
                </a>
              `).join('')}
            </div>
          ` : '<div class="mt-8 rounded-xl border border-neutral-200 bg-white p-8 text-neutral-600">Hiện chưa có bộ sưu tập đang hoạt động. Vui lòng quay lại sau.</div>'}
        </section>
      `);
    } catch (error) {
      console.error('Không tải được danh sách BST:', error);
      paint(`<div class="my-12 rounded-xl border bg-white p-8"><h1 class="text-2xl font-bold text-[#922a35]">Không tải được bộ sưu tập</h1><p class="mt-3 text-neutral-600">${esc(error.message)}</p></div>`);
    }
  }

  async function init() {
    paint('<div class="py-16 text-center text-neutral-500">Đang tải bộ sưu tập...</div>');
    try {
      const [eventResponse,categoryResponse]=await Promise.all([
        fetch(`${API_BASE}/events/${encodeURIComponent(slug)}`),
        fetch(`${API_BASE}/categories`).catch(()=>null)
      ]);
      if(categoryResponse?.ok) {
        const list=await categoryResponse.json();
        if(Array.isArray(list)) categories=list;
      }
      if(!eventResponse.ok) throw new Error(eventResponse.status===404?'Bộ sưu tập không tồn tại hoặc chưa đến thời gian hoạt động.':`Không thể tải bộ sưu tập (HTTP ${eventResponse.status}).`);
      const data=await eventResponse.json();
      if(!data?.event) throw new Error('API không trả về thông tin bộ sưu tập.');
      state.event=data.event;
      if (typeof loadJodokSalePrices === 'function') {
        await loadJodokSalePrices();
      }
      state.items=Array.isArray(data.products)?data.products.filter(p=>p && p.status!=='INACTIVE'):[];
      // Draw immediately: sold counts are optional secondary data.
      showDetail();
      // One aggregate call instead of a request for every collection item.
      try {
        const response = await fetch(`${API_BASE}/products/sold-counts`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const counts = await response.json();
        for (const product of state.items) {
          const id = Number(product.productId);
          state.soldCounts[id] = Math.max(0, Number(counts?.[id]) || 0);
        }
      } catch (error) {
        console.warn('Không tải được số lượng đã bán của bộ sưu tập:', error);
      }
      // Update visible labels without re-rendering the grid and losing filters.
      document.querySelectorAll('[data-bst-sold]').forEach(node => {
        const id = Number(node.dataset.bstSold);
        const count = state.soldCounts[id] ?? 0;
        node.textContent = typeof formatSoldCount === 'function'
          ? formatSoldCount(count) : `${count} đã bán`;
      });
    } catch(e) {
      console.error('BST:',e);
      paint(`<div class="my-12 rounded-xl border bg-white p-8"><h1 class="text-2xl font-bold text-[#922a35]">Không tải được bộ sưu tập</h1><p class="mt-3 text-neutral-600">${esc(e.message)}</p><a href="/" class="mt-5 inline-block font-semibold text-[#922a35]">← Về trang chủ</a></div>`);
    }
  }
  if (location.pathname.replace(/\/+$/, '') === '/events') {
    showCollections();
  } else {
    init();
  }
})();