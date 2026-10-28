(function () {
  if (document.getElementById("jodok-chat-panel")) return;

  const API = window.location.protocol === "file:"
    ? "http://localhost:8080/api"
    : `${window.location.origin}/api`;

  /*
   * =========================================================
   * CONVERSATION ID
   * =========================================================
   */
  function newConversationId() {
    return window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  const HISTORY_KEY = "jodokChatHistory";

  // Chỉ lưu định danh phiên không bí mật, không lưu JWT hoặc dữ liệu xác thực.
  function historyOwner() {
    const token = getAuthToken();
    if (!token) return "guest";
    try {
      const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const claims = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, "=")));
      if (typeof claims.sub !== "string" || !claims.sub) return null;
      return JSON.stringify([claims.sub,
        Number.isFinite(claims.iat) ? claims.iat : null,
        Number.isFinite(claims.exp) ? claims.exp : null]);
    } catch (_) { return null; }
  }

  let activeHistoryOwner = historyOwner();
  let savedHistory = null;
  try {
    const state = JSON.parse(sessionStorage.getItem(HISTORY_KEY));
    if (activeHistoryOwner && state?.version === 1 && state.owner === activeHistoryOwner
        && typeof state.conversationId === "string" && state.conversationId
        && typeof state.html === "string" && typeof state.open === "boolean") {
      savedHistory = state;
    } else {
      sessionStorage.removeItem(HISTORY_KEY);
      sessionStorage.removeItem("jodokConversationId");
    }
  } catch (_) { /* Chat vẫn dùng được khi trình duyệt chặn storage. */ }
  let conversationId = savedHistory?.conversationId || newConversationId();

  function saveConversationId() {
    try {
      sessionStorage.setItem("jodokConversationId", conversationId);
    } catch (_) { /* Giữ phiên trong bộ nhớ nếu storage không khả dụng. */ }
  }
  saveConversationId();

  /*
   * =========================================================
   * AUTH - V9 CART TOOL
   * =========================================================
   *
   * Lấy JWT của khách đang đăng nhập.
   * Không gửi userId từ frontend.
   *
   * Backend ChatbotController sẽ lấy User thật từ
   * Spring Security Authentication.
   */
  function getAuthToken() {
    try {
      const rawUser =
        localStorage.getItem("ha_user");

      if (!rawUser) {
        return null;
      }

      const user =
        JSON.parse(rawUser);

      if (
        user &&
        typeof user.token === "string" &&
        user.token.trim()
      ) {
        return user.token.trim();
      }

      return null;
    } catch (_) {
      return null;
    }
  }

  /*
   * =========================================================
   * REQUEST HEADERS
   * =========================================================
   */
  function getRequestHeaders(token = getAuthToken()) {

    const headers = {
      "Content-Type":
        "application/json"
    };

    if (token) {
      headers.Authorization =
        `Bearer ${token}`;
    }

    return headers;
  }

  /*
   * =========================================================
   * CSS
   * =========================================================
   */
  const style =
    document.createElement("style");

  style.textContent = `
    #jodok-chat-toggle {
      position: fixed;
      right: 22px;
      bottom: 22px;
      z-index: 9998;

      border: 0;
      border-radius: 999px;

      padding: 14px 18px;

      background: #991b1b;
      color: white;

      font-weight: 700;
      cursor: pointer;

      box-shadow: 0 6px 24px #0003;

      transition:
        transform .2s ease,
        box-shadow .2s ease,
        background .2s ease;
    }

    #jodok-chat-toggle:hover {
      background: #7f1d1d;
      transform: translateY(-2px);
      box-shadow: 0 10px 30px #0004;
    }

    #jodok-chat-panel {
      position: fixed;

      right: 22px;
      bottom: 82px;

      z-index: 9999;

      width: min(
        400px,
        calc(100vw - 24px)
      );

      height: min(
        600px,
        calc(100vh - 110px)
      );

      background: white;

      border: 1px solid #e5e5e5;
      border-radius: 18px;

      box-shadow: 0 12px 40px #0003;

      display: none;
      flex-direction: column;

      overflow: hidden;

      font-family:
        Arial,
        sans-serif;
    }

    #jodok-chat-panel.open {
      display: flex;
    }

    /*
     * HEADER
     */
    .jodok-chat-header {
      padding: 15px 16px;

      background: #991b1b;
      color: white;

      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .jodok-chat-header-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .jodok-chat-avatar {
      width: 38px;
      height: 38px;

      border-radius: 50%;

      background: white;
      color: #991b1b;

      display: flex;
      align-items: center;
      justify-content: center;

      font-size: 19px;
    }

    .jodok-chat-title {
      font-size: 15px;
      font-weight: 700;
    }

    .jodok-chat-status {
      margin-top: 2px;

      font-size: 11px;
      font-weight: 400;

      opacity: .85;
    }

    .jodok-chat-header button {
      width: 34px;
      height: 34px;

      border: 0;
      border-radius: 50%;

      background: transparent;
      color: white;

      font-size: 23px;

      cursor: pointer;
    }

    .jodok-chat-header button:hover {
      background: #ffffff1f;
    }

    /*
     * MESSAGES
     */
    #jodok-chat-messages {
      flex: 1;

      overflow-y: auto;

      padding: 14px;

      background: #fafafa;

      scroll-behavior: smooth;
    }

    .jodok-chat-message {
      max-width: 88%;

      margin-bottom: 12px;

      padding: 10px 12px;

      border-radius: 13px;

      line-height: 1.5;
      font-size: 14px;

      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .jodok-chat-message.user {
      margin-left: auto;

      background: #991b1b;
      color: white;

      border-bottom-right-radius: 4px;
    }

    .jodok-chat-message.bot {
      margin-right: auto;

      background: #f0f0f0;
      color: #222;

      border-bottom-left-radius: 4px;
    }

    /*
     * LOADING
     */
    .jodok-chat-loading {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }

    .jodok-chat-loading-dot {
      width: 6px;
      height: 6px;

      border-radius: 50%;

      background: #777;

      animation:
        jodokChatDot 1.2s infinite;
    }

    .jodok-chat-loading-dot:nth-child(2) {
      animation-delay: .15s;
    }

    .jodok-chat-loading-dot:nth-child(3) {
      animation-delay: .3s;
    }

    @keyframes jodokChatDot {
      0%,
      60%,
      100% {
        transform: translateY(0);
        opacity: .4;
      }

      30% {
        transform: translateY(-4px);
        opacity: 1;
      }
    }

    /*
     * PRODUCT CARD
     */
    .jodok-chat-product {
      display: flex;

      gap: 11px;

      padding: 10px;

      margin-bottom: 10px;

      border: 1px solid #e5e5e5;
      border-radius: 13px;

      background: white;

      cursor: pointer;

      transition:
        transform .15s ease,
        box-shadow .15s ease,
        border-color .15s ease;
    }

    .jodok-chat-product:hover {
      transform: translateY(-1px);

      border-color: #d6b5b5;

      box-shadow: 0 5px 16px #00000010;
    }

    .jodok-chat-product-number {
      width: 22px;
      height: 22px;

      flex: 0 0 22px;

      border-radius: 50%;

      background: #991b1b;
      color: white;

      display: flex;
      align-items: center;
      justify-content: center;

      font-size: 11px;
      font-weight: 700;
    }

    .jodok-chat-product img {
      width: 66px;
      height: 84px;

      flex: 0 0 66px;

      object-fit: cover;

      border-radius: 8px;

      background: #f5f5f5;
    }

    .jodok-chat-product-info {
      flex: 1;
      min-width: 0;

      font-size: 13px;
      line-height: 1.45;
    }

    .jodok-chat-product-name {
      font-weight: 600;

      color: #222;

      overflow: hidden;

      display: -webkit-box;

      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .jodok-chat-product-price {
      display: block;

      margin: 3px 0;

      color: #991b1b;

      font-size: 14px;
      font-weight: 700;
    }

    .jodok-chat-product-variant {
      color: #555;
    }

    .jodok-chat-product-stock {
      margin-top: 2px;

      color: #166534;

      font-size: 12px;
    }

    .jodok-chat-product-stock.out {
      color: #991b1b;
    }

    .jodok-chat-product-action {
      margin-top: 5px;

      color: #991b1b;

      font-size: 12px;
      font-weight: 600;
    }

    /*
     * QUICK SUGGESTIONS
     */
    .jodok-chat-suggestions {
      display: flex;
      flex-wrap: wrap;

      gap: 6px;

      margin:
        4px
        0
        13px;
    }

    .jodok-chat-suggestion {
      border: 1px solid #e0caca;
      border-radius: 999px;

      padding: 6px 9px;

      background: white;
      color: #7f1d1d;

      font-size: 11px;

      cursor: pointer;

      transition:
        background .15s ease,
        color .15s ease;
    }

    .jodok-chat-suggestion:hover {
      background: #991b1b;
      color: white;
    }

    /*
     * FORM
     */
    #jodok-chat-form {
      display: flex;
      align-items: center;

      gap: 8px;

      padding: 12px;

      border-top: 1px solid #eee;

      background: white;
    }

    #jodok-chat-input {
      flex: 1;
      min-width: 0;

      padding: 10px 11px;

      border: 1px solid #ddd;
      border-radius: 10px;

      outline: none;

      font-size: 14px;
    }

    #jodok-chat-input:focus {
      border-color: #991b1b;

      box-shadow:
        0 0 0 2px
        rgba(153, 27, 27, .08);
    }

    #jodok-chat-send {
      height: 39px;

      border: 0;
      border-radius: 10px;

      padding: 0 15px;

      background: #991b1b;
      color: white;

      font-weight: 600;

      cursor: pointer;

      transition:
        background .15s ease;
    }

    #jodok-chat-send:hover {
      background: #7f1d1d;
    }

    #jodok-chat-send:disabled {
      opacity: .5;
      cursor: not-allowed;
    }

    #jodok-chat-panel .jodok-chat-summary {
      padding: 12px;
      margin-bottom: 12px;
      border: 1px solid #e5e5e5;
      border-radius: 13px;
      background: white;
      font-size: 13px;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }

    #jodok-chat-panel .jodok-chat-summary h3 {
      margin: 0 0 8px;
      color: #7f1d1d;
      font-size: 14px;
    }

    #jodok-chat-panel .jodok-chat-summary p { margin: 4px 0; }
    #jodok-chat-panel .jodok-chat-line { padding: 8px 0; border-bottom: 1px solid #eee; }
    #jodok-chat-panel .jodok-chat-total { display: flex; justify-content: space-between; gap: 10px; margin-top: 6px; }
    #jodok-chat-panel .jodok-chat-total strong { text-align: right; }
    #jodok-chat-panel .jodok-chat-actions { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
    #jodok-chat-panel .jodok-chat-action {
      display: inline-block;
      padding: 7px 9px;
      border: 1px solid #d6b5b5;
      border-radius: 8px;
      background: white;
      color: #7f1d1d;
      font: inherit;
      font-size: 12px;
      text-decoration: none;
      cursor: pointer;
    }
    #jodok-chat-panel .jodok-chat-action:focus-visible { outline: 2px solid #991b1b; outline-offset: 2px; }
    #jodok-chat-panel button:disabled { opacity: .5; cursor: not-allowed; }
    #jodok-chat-panel .jodok-chat-confirmation { border: 1px solid #d6b5b5; background: #fff7ed; }
    #jodok-chat-panel .jodok-chat-original-price { margin-right: 6px; color: #777; font-size: 12px; }
    #jodok-chat-panel .jodok-chat-product { cursor: default; }

    /*
     * MOBILE
     */
    @media (max-width: 520px) {
      #jodok-chat-toggle {
        right: 12px;
        bottom: 12px;
      }

      #jodok-chat-panel {
        right: 12px;
        bottom: 72px;

        width: calc(100vw - 24px);

        height: min(
          620px,
          calc(100vh - 90px)
        );
      }
    }
  `;

  document.head.appendChild(
    style
  );

  /*
   * =========================================================
   * CREATE CHAT UI
   * =========================================================
   */

  const toggle =
    document.createElement(
      "button"
    );

  toggle.id =
    "jodok-chat-toggle";

  toggle.type =
    "button";

  toggle.textContent =
    "💬 Chat với JODOK";

  const panel =
    document.createElement(
      "section"
    );

  panel.id =
    "jodok-chat-panel";

  panel.innerHTML = `
    <div class="jodok-chat-header">

      <div class="jodok-chat-header-info">

        <div class="jodok-chat-avatar">
          ✦
        </div>

        <div>
          <div class="jodok-chat-title">
            Trợ lý mua sắm JODOK
          </div>

          <div class="jodok-chat-status">
            ● Đang hoạt động
          </div>
        </div>

      </div>

      <button
        type="button"
        id="jodok-chat-close"
        aria-label="Đóng"
      >
        ×
      </button>

    </div>

    <div id="jodok-chat-messages" role="log" aria-live="polite" aria-label="Hội thoại với JODOK"></div>

    <form id="jodok-chat-form">

      <input
        id="jodok-chat-input"
        maxlength="500"
        aria-label="Tin nhắn cho JODOK"
        placeholder="Hỏi JODOK về sản phẩm..."
        autocomplete="off"
      />

      <button
        id="jodok-chat-send"
        type="submit"
      >
        Gửi
      </button>

    </form>
  `;

  document.body.append(
    toggle,
    panel
  );

  /*
   * =========================================================
   * ELEMENTS
   * =========================================================
   */

  const messages =
    panel.querySelector(
      "#jodok-chat-messages"
    );

  const form =
    panel.querySelector(
      "#jodok-chat-form"
    );

  const input =
    panel.querySelector(
      "#jodok-chat-input"
    );

  const sendButton =
    panel.querySelector(
      "#jodok-chat-send"
    );

  const closeButton =
    panel.querySelector(
      "#jodok-chat-close"
    );

  /*
   * =========================================================
   * OPEN / CLOSE
   * =========================================================
   */

  toggle.addEventListener(
    "click",
    () => {

      panel.classList.toggle(
        "open"
      );

      if (
        panel.classList.contains(
          "open"
        )
      ) {
        input.focus();
      }
    }
  );

  closeButton.addEventListener(
    "click",
    () => {

      panel.classList.remove(
        "open"
      );
    }
  );

  /*
   * =========================================================
   * MESSAGE
   * =========================================================
   */

  function scrollToBottom() {
    messages.scrollTop =
      messages.scrollHeight;
  }

  function addMessage(
    text,
    role
  ) {

    const element =
      document.createElement(
        "div"
      );

    element.className =
      "jodok-chat-message " +
      role;

    /*
     * Dùng textContent thay innerHTML
     * để tránh HTML/script từ câu trả lời.
     */
    element.textContent =
      text || "";

    messages.appendChild(
      element
    );

    scrollToBottom();

    return element;
  }

  /*
   * =========================================================
   * LOADING
   * =========================================================
   */

  function addLoading() {

    const wrapper =
      document.createElement(
        "div"
      );

    wrapper.className =
      "jodok-chat-message bot";

    const loading =
      document.createElement(
        "div"
      );

    loading.className =
      "jodok-chat-loading";

    loading.innerHTML = `
      <span>JODOK đang suy nghĩ</span>

      <span
        class="jodok-chat-loading-dot"
      ></span>

      <span
        class="jodok-chat-loading-dot"
      ></span>

      <span
        class="jodok-chat-loading-dot"
      ></span>
    `;

    wrapper.appendChild(
      loading
    );

    messages.appendChild(
      wrapper
    );

    scrollToBottom();

    return wrapper;
  }

  // Chỉ hiển thị dữ liệu đã định kiểu; không ép object thành nội dung chat.
  function textValue(value, fallback = "") {
    return typeof value === "string" || typeof value === "number"
      ? String(value)
      : fallback;
  }

  function money(value) {
    if (value === null || value === undefined || value === "") return "—";
    const amount = Number(value);
    return Number.isFinite(amount)
      ? amount.toLocaleString("vi-VN") + "đ"
      : "—";
  }

  function positiveId(value) {
    return /^\d+$/.test(textValue(value)) && Number.isSafeInteger(Number(value))
      && Number(value) > 0 ? String(value) : null;
  }

  function element(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = textValue(content);
    return node;
  }

  function localUrl(value) {
    if (typeof value !== "string") return null;
    try {
      const url = new URL(value, window.location.href);
      return url.origin === window.location.origin
        && /^\/(auth|cart|payment|orders|account|products|detail)\/?$/.test(url.pathname)
        && !url.username && !url.password
        ? url.href : null;
    } catch (_) { return null; }
  }

  function imageUrl(value) {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
      const url = new URL(value, window.location.href);
      return ["https:", "http:"].includes(url.protocol)
        && !url.username && !url.password ? url.href : null;
    } catch (_) { return null; }
  }

  function payosUrl(value) {
    if (typeof value !== "string") return null;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname === "pay.payos.vn"
        && !url.port && !url.username && !url.password ? url.href : null;
    } catch (_) { return null; }
  }

  let busy = false;
  let activeAuthToken = getAuthToken();
  let discardPendingHistory = false;

  function setBusy(value) {
    busy = value;
    input.disabled = value;
    sendButton.disabled = value;
    form.setAttribute("aria-busy", String(value));
    messages.querySelectorAll("button").forEach(button => {
      button.disabled = value || button.dataset.stale === "true";
    });
  }

  function expireActions() {
    messages.querySelectorAll("button").forEach(button => {
      button.dataset.stale = "true";
      button.disabled = true;
    });
  }

  function welcome() {
    addMessage("Xin chào! Mình là trợ lý mua sắm JODOK. Bạn có thể tìm sản phẩm, quản lý giỏ hàng, đặt hàng và theo dõi đơn tại đây.", "bot");
    addSuggestions(["Áo nam khoảng 200k", "Đồ nữ màu đen", "Xem giỏ hàng", "Đơn hàng của tôi"]);
  }

  function syncAuthContext(forceReset = false) {
    const token = getAuthToken();
    if (token === activeAuthToken && forceReset !== true) return false;
    activeAuthToken = token;
    activeHistoryOwner = historyOwner();
    savedHistory = null;
    discardPendingHistory = discardPendingHistory || busy;
    try { sessionStorage.removeItem(HISTORY_KEY); } catch (_) { /* Storage có thể bị chặn. */ }
    conversationId = newConversationId();
    saveConversationId();
    messages.replaceChildren();
    input.value = "";
    welcome();
    setBusy(busy);
    return true;
  }

  function commandButton(label, message, confirmationToken) {
    if (typeof message !== "string" || !message.trim() || message.length > 500) return null;
    const button = element("button", "jodok-chat-action", label);
    button.type = "button";
    button.disabled = busy;
    if (confirmationToken) button.dataset.confirmation = "true";
    button.addEventListener("click", () => {
      if (busy || button.dataset.stale === "true") return;
      if (syncAuthContext()) return;
      sendMessage(message, confirmationToken);
    });
    return button;
  }

  function appendCommand(parent, label, message, confirmationToken) {
    const button = commandButton(label, message, confirmationToken);
    if (button) parent.appendChild(button);
    return button;
  }

  function appendLink(parent, label, href) {
    const url = localUrl(href);
    if (!url) return;
    const link = element("a", "jodok-chat-action", label);
    link.href = url;
    parent.appendChild(link);
  }

  function addSuggestions(suggestions) {
    const wrapper = element("div", "jodok-chat-suggestions");
    suggestions.filter(value => typeof value === "string").forEach(suggestion => {
      appendCommand(wrapper, suggestion, suggestion);
    });
    messages.appendChild(wrapper);
    scrollToBottom();
  }

  async function requestJson(url, options = {}, timeout = 45000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      if (!response.ok) {
        const error = new Error("Yêu cầu không thành công");
        error.status = response.status;
        throw error;
      }
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  // Fallback ảnh cho response cũ; response mới mang imageUrl trực tiếp.
  let productMapCache;
  async function legacyProductMap() {
    if (productMapCache) return productMapCache;
    try {
      const products = await requestJson(API + "/products", {}, 8000);
      productMapCache = new Map(
        (Array.isArray(products) ? products : [])
          .filter(product => product && positiveId(product.productId))
          .map(product => [String(product.productId), product])
      );
    } catch (_) {
      return new Map();
    }
    return productMapCache;
  }

  async function showProducts(products, metadata) {
    if (!Array.isArray(products)) return;
    const items = products.filter(item => item && typeof item === "object");
    const legacy = items.some(item => !Object.prototype.hasOwnProperty.call(item, "imageUrl"))
      ? await legacyProductMap() : new Map();

    const variantMode = metadata?.productMode === "variants";
    items.forEach((item, index) => {
      const card = element("div", "jodok-chat-product");
      const info = element("div", "jodok-chat-product-info");
      card.appendChild(element("div", "jodok-chat-product-number", index + 1));
      const oldProduct = legacy.get(String(item.productId));
      const src = imageUrl(item.imageUrl || oldProduct?.imageUrl || oldProduct?.images?.[0]?.imageUrl);
      if (src) {
        const image = element("img");
        image.src = src;
        image.alt = textValue(item.productName, "Sản phẩm JODOK");
        image.loading = "lazy";
        image.addEventListener("error", () => { image.hidden = true; });
        card.appendChild(image);
      }
      info.appendChild(element("div", "jodok-chat-product-name", textValue(item.productName, "Sản phẩm")));
      const price = element("div", "jodok-chat-product-price");
      if (item.originalPrice != null && item.price != null
          && Number(item.originalPrice) > Number(item.price)) {
        price.appendChild(element("del", "jodok-chat-original-price", money(item.originalPrice)));
      }
      price.appendChild(element("strong", "", money(item.price)));
      info.appendChild(price);
      info.appendChild(element("div", "jodok-chat-product-variant",
        "Màu: " + textValue(item.color, "—") + " · Size: " + textValue(item.size, "—")));
      const knownStock = item.stock != null && Number.isFinite(Number(item.stock));
      const stock = element("div", "jodok-chat-product-stock",
        knownStock ? (Number(item.stock) > 0 ? "Còn " + item.stock + " sản phẩm" : "Hết hàng")
          : "Chọn mẫu để kiểm tra tồn kho");
      if (knownStock && Number(item.stock) <= 0) stock.classList.add("out");
      info.appendChild(stock);
      const actions = element("div", "jodok-chat-actions");
      const productId = positiveId(item.productId);
      if (productId) {
        appendLink(actions, "Xem chi tiết", "/detail?productId=" + encodeURIComponent(productId));
        const selection = variantMode
          ? [typeof item.size === "string" && item.size ? "size " + item.size : "",
            typeof item.color === "string" && item.color ? "màu " + item.color : ""].filter(Boolean).join(" ")
          : "mẫu " + (index + 1);
        if (selection) {
          const chooseButton = appendCommand(actions, variantMode ? "Chọn biến thể" : "Chọn mẫu " + (index + 1),
            variantMode ? selection : "Chọn " + selection);
          if (chooseButton) {
            chooseButton.dataset.productCommand = "true";
            chooseButton.dataset.productMessage = variantMode ? selection : "Chọn " + selection;
          }
        }
        if (!knownStock || Number(item.stock) > 0) {
          const addButton = appendCommand(actions, "Thêm vào giỏ", "Thêm " + (selection || "sản phẩm này") + " vào giỏ");
          if (addButton) {
            addButton.dataset.productCommand = "true";
            addButton.dataset.productMessage = "Thêm " + (selection || "sản phẩm này") + " vào giỏ";
          }
        }
      }
      info.appendChild(actions);
      card.appendChild(info);
      messages.appendChild(card);
    });
  }

  function summary(title) {
    const card = element("section", "jodok-chat-summary");
    card.appendChild(element("h3", "", title));
    messages.appendChild(card);
    return card;
  }

  function row(parent, label, value) {
    const line = element("div", "jodok-chat-total");
    line.append(element("span", "", label), element("strong", "", value));
    parent.appendChild(line);
  }

  function showItems(parent, items) {
    if (!Array.isArray(items)) return;
    items.filter(item => item && typeof item === "object").forEach(item => {
      const line = element("div", "jodok-chat-line");
      line.appendChild(element("strong", "", textValue(item.productName, "Sản phẩm")));
      line.appendChild(element("p", "",
        "Màu: " + textValue(item.color, "—") + " · Size: " + textValue(item.size, "—")));
      row(line, "Số lượng: " + textValue(item.quantity, "—"), money(item.lineTotal));
      if (item.price != null) line.appendChild(element("p", "", "Đơn giá: " + money(item.price)));
      parent.appendChild(line);
    });
  }

  function addressText(address) {
    if (typeof address === "string") return address;
    if (!address || typeof address !== "object") return "";
    return [address.fullname, address.phone, address.address]
      .filter(value => typeof value === "string" && value.trim()).join(" · ");
  }

  function paymentLabel(method) {
    return method === "CASH" ? "Thanh toán khi nhận hàng (COD)"
      : method === "QR" ? "Thanh toán PayOS QR" : "Chưa chọn";
  }

  function showCart(cart) {
    if (!cart || typeof cart !== "object") return;
    const card = summary("Giỏ hàng");
    if (Array.isArray(cart.items) && cart.items.length === 0) {
      card.appendChild(element("p", "", "Giỏ hàng đang trống."));
    }
    showItems(card, cart.items);
    row(card, "Tạm tính", money(cart.subtotal));
    const actions = element("div", "jodok-chat-actions");
    appendLink(actions, "Mở giỏ hàng", "/cart");
    if (Array.isArray(cart.items) && cart.items.length) {
      appendCommand(actions, "Thanh toán", "Thanh toán giỏ hàng");
      appendCommand(actions, "Xóa hết giỏ", "Xóa hết giỏ hàng");
    }
    card.appendChild(actions);
  }

  function showCheckout(checkout) {
    if (!checkout || typeof checkout !== "object") return;
    const card = summary("Thông tin đặt hàng");
    showItems(card, checkout.items);
    row(card, "Tạm tính", money(checkout.subtotal));
    row(card, "Giảm giá", money(checkout.discount));
    row(card, "Phí vận chuyển", money(checkout.shipping));
    row(card, "Tổng thanh toán", money(checkout.total));
    if (typeof checkout.voucherCode === "string" && checkout.voucherCode) {
      card.appendChild(element("p", "", "Mã giảm giá: " + checkout.voucherCode));
    }
    card.appendChild(element("p", "", "Nhận hàng: " + (addressText(checkout.address) || "Chưa chọn địa chỉ")));
    card.appendChild(element("p", "", "Thanh toán: " + paymentLabel(checkout.paymentMethod)));
    const actions = element("div", "jodok-chat-actions");
    appendCommand(actions, "Đổi địa chỉ", "Đổi địa chỉ");
    appendCommand(actions, "Chọn COD", "Thanh toán COD");
    appendCommand(actions, "Chọn PayOS QR", "Thanh toán QR");
    appendCommand(actions, "Xem voucher", "Mã nào dùng được cho đơn này?");
    card.appendChild(actions);
  }

  function showAddresses(addresses) {
    if (!Array.isArray(addresses)) return;
    const card = summary("Địa chỉ nhận hàng");
    if (!addresses.length) card.appendChild(element("p", "", "Bạn chưa có địa chỉ nhận hàng."));
    addresses.filter(address => address && typeof address === "object").forEach((address, index) => {
      const line = element("div", "jodok-chat-line");
      line.appendChild(element("p", "", (index + 1) + ". " + addressText(address)));
      appendCommand(line, "Chọn địa chỉ " + (index + 1), "Chọn địa chỉ " + (index + 1));
      card.appendChild(line);
    });
    appendLink(card, "Cập nhật địa chỉ", "/account");
  }

  function showVouchers(vouchers) {
    if (!Array.isArray(vouchers) || !vouchers.length) return;
    const card = summary("Mã giảm giá");
    vouchers.filter(voucher => voucher && typeof voucher.code === "string").forEach(voucher => {
      const line = element("div", "jodok-chat-line");
      line.appendChild(element("strong", "", voucher.code));
      if (voucher.discount != null) line.appendChild(element("p", "", "Giảm: " + money(voucher.discount)));
      if (voucher.minOrderValue != null) line.appendChild(element("p", "", "Đơn tối thiểu: " + money(voucher.minOrderValue)));
      if (typeof voucher.endDate === "string") line.appendChild(element("p", "", "Hạn dùng: " + voucher.endDate));
      appendCommand(line, "Áp dụng " + voucher.code, "Áp mã " + voucher.code);
      card.appendChild(line);
    });
  }

  function showOrders(orders) {
    if (!Array.isArray(orders)) return;
    if (!orders.length) summary("Đơn hàng").appendChild(element("p", "", "Chưa có đơn hàng phù hợp."));
    orders.filter(order => order && typeof order === "object").forEach(order => {
      const orderId = positiveId(order.orderId);
      const card = summary("Đơn hàng" + (orderId ? " #" + orderId : ""));
      if (typeof order.statusLabel === "string") row(card, "Trạng thái", order.statusLabel);
      if (typeof order.paymentStatusLabel === "string") row(card, "Thanh toán", order.paymentStatusLabel);
      row(card, "Phương thức", paymentLabel(order.paymentMethod));
      row(card, "Tổng tiền", money(order.total));
      if (typeof order.createdAt === "string") {
        const date = new Date(order.createdAt);
        if (!Number.isNaN(date.getTime())) card.appendChild(element("p", "", "Ngày đặt: " + date.toLocaleString("vi-VN")));
      }
      if (addressText(order.address)) card.appendChild(element("p", "", "Nhận hàng: " + addressText(order.address)));
      showItems(card, order.items);
      const actions = element("div", "jodok-chat-actions");
      if (orderId) appendCommand(actions, "Xem đơn #" + orderId, "Đơn #" + orderId);
      appendLink(actions, "Mở đơn hàng", "/orders");
      card.appendChild(actions);
    });
  }

  async function createPayment(payment, button) {
    if (busy || button.dataset.stale === "true") return;
    if (syncAuthContext()) return;
    const token = getAuthToken();
    if (!token) {
      addMessage("Bạn cần đăng nhập để thanh toán đơn hàng.", "bot");
      appendLink(messages, "Đăng nhập", "/auth");
      return;
    }
    const orderId = positiveId(payment.orderId);
    if (!orderId || payment.method !== "QR" || payment.status !== "PENDING") return;
    setBusy(true);
    const loading = addLoading();
    try {
      const data = await requestJson(API + "/payments/payos/create", {
        method: "POST",
        headers: getRequestHeaders(token),
        body: JSON.stringify({ orderId: Number(orderId) })
      }, 30000);
      if (token !== getAuthToken()) {
        syncAuthContext();
        return;
      }
      const href = payosUrl(data?.checkoutUrl || data?.data?.checkoutUrl);
      if (!href) throw new Error("Đường dẫn thanh toán không hợp lệ");
      button.dataset.stale = "true";
      addMessage("Đang mở cổng thanh toán PayOS. Trạng thái thanh toán sẽ được cập nhật từ hệ thống.", "bot");
      window.location.assign(href);
    } catch (error) {
      if (token !== getAuthToken()) {
        syncAuthContext();
        return;
      }
      addMessage(error.status === 401
        ? "Phiên đăng nhập đã hết hạn. Bạn vui lòng đăng nhập lại để thanh toán."
        : "Chưa mở được thanh toán PayOS. Đơn hàng vẫn được giữ; bạn có thể thử lại hoặc kiểm tra trong Đơn hàng của tôi.", "bot");
      appendLink(messages, error.status === 401 ? "Đăng nhập" : "Xem đơn hàng",
        error.status === 401 ? "/auth" : "/orders");
    } finally {
      loading.remove();
      setBusy(false);
      scrollToBottom();
    }
  }

  function showMetadata(metadata) {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return;
    showCart(metadata.cart);
    showCheckout(metadata.checkout);
    showAddresses(metadata.addresses);
    showVouchers(metadata.vouchers);
    showOrders(metadata.orders);
    if (metadata.requiresLogin === true) {
      const actions = element("div", "jodok-chat-actions");
      appendLink(actions, "Đăng nhập", "/auth");
      messages.appendChild(actions);
    }
    const token = metadata.requiresConfirmation === true && typeof metadata.confirmationToken === "string"
      ? metadata.confirmationToken : undefined;
    const actions = element("div", "jodok-chat-actions");
    if (metadata.requiresConfirmation === true) {
      const notice = summary("Xác nhận thao tác");
      notice.classList.add("jodok-chat-confirmation");
      notice.appendChild(element("p", "", "Kiểm tra thông tin ở trên trước khi xác nhận."));
      notice.appendChild(actions);
    } else {
      messages.appendChild(actions);
    }
    if (Array.isArray(metadata.actions)) {
      metadata.actions.filter(action => action && typeof action.label === "string").forEach(action => {
        if (typeof action.message === "string") appendCommand(actions, action.label, action.message, token);
        else if (typeof action.url === "string") appendLink(actions, action.label, action.url);
      });
    }
    const payment = metadata.payment;
    if (payment && positiveId(payment.orderId) && payment.method === "QR" && payment.status === "PENDING") {
      const button = element("button", "jodok-chat-action", "Thanh toán đơn #" + payment.orderId + " qua PayOS");
      button.type = "button";
      button.disabled = busy;
      button.addEventListener("click", () => createPayment(payment, button));
      actions.appendChild(button);
    }
  }

  async function sendMessage(rawMessage, confirmationToken) {
    if (busy || typeof rawMessage !== "string") return;
    const message = rawMessage.trim();
    if (!message) return;
    if (message.length > 500) {
      addMessage("Tin nhắn không được vượt quá 500 ký tự.", "bot");
      return;
    }
    // Một action từ phiên đăng nhập cũ không được thực thi ở tài khoản mới.
    if (syncAuthContext() && confirmationToken) return;
    const token = getAuthToken();
    expireActions();
    addMessage(message, "user");
    setBusy(true);
    const loading = addLoading();
    try {
      const body = { message, conversationId };
      if (typeof confirmationToken === "string" && confirmationToken) body.confirmationToken = confirmationToken;
      const data = await requestJson(API + "/chatbot/message", {
        method: "POST",
        headers: getRequestHeaders(token),
        body: JSON.stringify(body)
      });
      if (token !== getAuthToken()) {
        syncAuthContext();
        return;
      }
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Phản hồi không hợp lệ");
      loading.remove();
      addMessage(textValue(data.reply, "Mình chưa tìm được kết quả phù hợp."), "bot");
      await showProducts(data.products, data.metadata);
      if (token !== getAuthToken()) {
        syncAuthContext();
        return;
      }
      showMetadata(data.metadata);
      if (data.metadata?.cart || data.metadata?.checkout || data.metadata?.orders) {
        if (typeof window.updateCartCount === "function") {
          Promise.resolve().then(() => window.updateCartCount()).catch(() => {});
        }
      }
    } catch (error) {
      if (token !== getAuthToken()) {
        syncAuthContext();
        return;
      }
      const reply = error.status === 401
        ? "Phiên đăng nhập đã hết hạn. Bạn vui lòng đăng nhập lại."
        : error.status === 429
          ? "Bạn gửi tin nhắn hơi nhanh. Vui lòng chờ một chút rồi thử lại."
          : error.name === "AbortError"
            ? "Yêu cầu đang mất nhiều thời gian. Nếu vừa xác nhận đặt hàng, hãy kiểm tra Đơn hàng của tôi trước khi thử lại."
            : "Chatbot chưa xử lý được yêu cầu. Bạn vui lòng thử lại; nếu vừa đặt hàng, hãy kiểm tra Đơn hàng của tôi.";
      addMessage(reply, "bot");
      if (error.status === 401) appendLink(messages, "Đăng nhập", "/auth");
    } finally {
      loading.remove();
      setBusy(false);
      scrollToBottom();
      if (panel.classList.contains("open")) input.focus();
    }
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    if (busy) return;
    const message = input.value.trim();
    if (!message) return;
    input.value = "";
    sendMessage(message);
  });

  /* Lưu bản sao DOM đã render; không thay đổi hàm gửi tin nhắn/render phía trên. */
  const historyTags = new Set(["DIV", "SECTION", "H3", "P", "SPAN", "STRONG", "DEL", "IMG", "A", "BR"]);
  const historyDocument = document.implementation.createHTMLDocument("");

  function historyNode(node, restoring = false) {
    if (node.nodeType === Node.TEXT_NODE) return (restoring ? document : historyDocument).createTextNode(node.textContent);
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    // Chỉ giữ nút chọn mẫu/thêm giỏ của card sản phẩm, không giữ nút thanh toán/xóa giỏ.
    if (node.tagName === "BUTTON") {
      if (node.dataset.productCommand !== "true" || !node.closest(".jodok-chat-product")) return null;
      const label = node.textContent.trim();
      const validChoose = /^Chọn mẫu [1-9]\d*$/.test(label);
      const validVariant = label === "Chọn biến thể";
      const validAdd = label === "Thêm vào giỏ";
      if (!validChoose && !validVariant && !validAdd) return null;
      const command = node.dataset.productMessage;
      if (restoring) {
        if (typeof command !== "string" || !command || command.length > 500) return null;
        const button = commandButton(label, command);
        if (!button) return null;
        button.dataset.productCommand = "true";
        button.dataset.productMessage = command;
        if (node.dataset.stale === "true") {
          button.dataset.stale = "true";
          button.disabled = true;
        }
        return button;
      }
      // Khi lưu lần đầu, command lấy từ thuộc tính được gắn trong showProducts.
      if (typeof command !== "string" || !command || command.length > 500) return null;
      const copy = historyDocument.createElement("button");
      copy.type = "button";
      copy.className = "jodok-chat-action";
      copy.textContent = label;
      copy.dataset.productCommand = "true";
      copy.dataset.productMessage = command;
      if (node.dataset.stale === "true") copy.dataset.stale = "true";
      return copy;
    }
    if (!historyTags.has(node.tagName)) return null;
    if (node.matches(".jodok-chat-suggestions, .jodok-chat-confirmation, .jodok-chat-loading")
        || node.querySelector(".jodok-chat-loading")) return null;

    const copy = (restoring ? document : historyDocument).createElement(node.tagName.toLowerCase());
    copy.className = Array.from(node.classList)
      .filter(name => /^jodok-chat-[a-z-]+$/.test(name) || ["user", "bot", "out"].includes(name)).join(" ");
    if (node.tagName === "IMG") {
      const src = imageUrl(node.getAttribute("src"));
      if (!src) return null;
      // Không giữ URL mang thông tin xác thực/thanh toán trong lịch sử.
      const url = new URL(src);
      if (Array.from(url.searchParams.keys()).some(key => /token|key|secret|signature|password|payment/i.test(key))) return null;
      copy.src = src;
      copy.alt = node.getAttribute("alt") || "";
      copy.loading = "lazy";
      copy.hidden = node.hidden;
      copy.addEventListener("error", () => { copy.hidden = true; });
    }
    if (node.tagName === "A") {
      const href = localUrl(node.getAttribute("href"));
      if (!href) return null;
      const url = new URL(href);
      if (url.pathname.replace(/\/$/, "") === "/payment") return null;
      const productId = positiveId(url.searchParams.get("productId"));
      copy.href = url.pathname + (url.pathname === "/detail" && productId
        ? "?productId=" + encodeURIComponent(productId) : "");
    }
    node.childNodes.forEach(child => {
      const clean = historyNode(child, restoring);
      if (clean) copy.appendChild(clean);
    });
    return copy;
  }

  function saveHistory() {
    try {
      syncAuthContext();
      // Response cũ có thể hoàn tất sau khi đổi tài khoản trong lúc chờ ảnh.
      if (discardPendingHistory) {
        if (messages.hasChildNodes()) messages.replaceChildren();
        if (busy) return;
        discardPendingHistory = false;
        welcome();
      }
      if (!activeHistoryOwner) return;
      const copy = historyDocument.createElement("div");
      messages.childNodes.forEach(node => {
        const clean = historyNode(node);
        if (clean) copy.appendChild(clean);
      });
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify({
        version: 1,
        owner: activeHistoryOwner,
        conversationId,
        open: panel.classList.contains("open"),
        html: copy.innerHTML
      }));
    } catch (_) { /* Lỗi lưu lịch sử không được làm hỏng tìm kiếm/chat. */ }
  }

  function restoreHistory() {
    if (!savedHistory) return false;
    try {
      const template = document.createElement("template");
      // Chỉ đọc HTML từ bản sao DOM đã lọc; lọc lại trước khi gắn vào trang.
      template.innerHTML = savedHistory.html;
      const fragment = document.createDocumentFragment();
      template.content.childNodes.forEach(node => {
        const clean = historyNode(node, true);
        if (clean) fragment.appendChild(clean);
      });
      panel.classList.toggle("open", savedHistory.open);
      if (!fragment.hasChildNodes()) return false;
      messages.replaceChildren(fragment);
      scrollToBottom();
      return true;
    } catch (_) { return false; }
    finally { savedHistory = null; }
  }

  window.addEventListener("storage", event => {
    if (event.key === "ha_user" || event.key === null) syncAuthContext(true);
  });
  window.addEventListener("focus", syncAuthContext);
  toggle.addEventListener("click", syncAuthContext);
  window.addEventListener("pageshow", () => { syncAuthContext(); saveHistory(); });
  window.addEventListener("pagehide", saveHistory);
  document.addEventListener("visibilitychange", saveHistory);
  // Cùng tab không phát sự kiện storage khi đăng xuất/đổi tài khoản.
  window.setInterval(syncAuthContext, 500);

  if (!restoreHistory()) welcome();
  const historyObserver = new MutationObserver(saveHistory);
  historyObserver.observe(messages, { childList: true, subtree: true, characterData: true, attributes: true });
  historyObserver.observe(panel, { attributes: true, attributeFilter: ["class"] });
  historyObserver.observe(form, { attributes: true, attributeFilter: ["aria-busy"] });
  saveHistory();
})();
