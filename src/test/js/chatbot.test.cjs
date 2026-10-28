const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../../main/resources/static/js/chatbot.js'), 'utf8');

// Minimal browser surface: run the real widget and exercise its public form/buttons.
// No production data or commerce services are replaced by this test fixture.
class Element {
  constructor(tag) {
    this.tagName = tag.toLowerCase();
    this.children = [];
    this.listeners = new Map();
    this.dataset = {};
    this.style = {};
    this.attributes = {};
    this.className = '';
    this.value = '';
    this.disabled = false;
    this._text = '';
    this.classList = {
      add: name => { this.className = [...new Set([...this.className.split(' '), name])].join(' ').trim(); },
      remove: name => { this.className = this.className.split(' ').filter(value => value !== name).join(' '); },
      contains: name => this.className.split(' ').includes(name),
      toggle: name => this.classList.contains(name) ? this.classList.remove(name) : this.classList.add(name)
    };
  }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set innerHTML(value) {
    // Only static widget/loading markup may enter an HTML sink.
    assert.ok(value.includes('jodok-chat-header') || value.includes('jodok-chat-loading-dot'));
    this.children = [];
    for (const match of value.matchAll(/<(\w+)[^>]*\bid="([^"]+)"[^>]*>/g)) {
      const child = new Element(match[1]);
      child.id = match[2];
      this.appendChild(child);
    }
  }
  appendChild(child) { child.parent = this; this.children.push(child); return child; }
  append(...children) { children.forEach(child => this.appendChild(child)); }
  replaceChildren(...children) { this.children.forEach(child => { child.parent = null; }); this.children = []; this._text = ''; this.append(...children); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
  querySelectorAll(selector) {
    const descendants = this.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
    return descendants.filter(child => selector === '*' || (selector.startsWith('#') ? child.id === selector.slice(1)
      : selector.startsWith('.') ? child.classList.contains(selector.slice(1)) : child.tagName === selector));
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  addEventListener(name, handler) { const list = this.listeners.get(name) || []; list.push(handler); this.listeners.set(name, list); }
  dispatch(name, event = {}) { for (const listener of this.listeners.get(name) || []) listener({ preventDefault() {}, ...event }); }
  setAttribute(name, value) { this.attributes[name] = value; }
  focus() {}
}

const flush = () => new Promise(resolve => setImmediate(resolve));
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });

function widget(initialUser = null) {
  const document = { head: new Element('head'), body: new Element('body'), createElement: tag => new Element(tag) };
  const storage = new Map(initialUser ? [['ha_user', JSON.stringify(initialUser)]] : []);
  const session = new Map();
  const events = new Map();
  const requests = [];
  const responses = [];
  const navigations = [];
  const timers = new Map();
  let nextTimer = 0;
  let uuid = 0;
  const window = {
    location: { protocol: 'https:', origin: 'https://jodok.test', href: 'https://jodok.test/products', assign: url => navigations.push(url) },
    crypto: { randomUUID: () => 'conversation-' + (++uuid) },
    addEventListener(name, handler) { const list = events.get(name) || []; list.push(handler); events.set(name, list); }
  };
  const context = {
    window, document, console, URL, AbortController,
    setTimeout(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
    sessionStorage: { getItem: key => session.get(key) || null, setItem: (key, value) => session.set(key, value) },
    localStorage: { getItem: key => storage.get(key) || null },
    fetch: async (url, options) => {
      requests.push({ url, ...options });
      assert.ok(responses.length, 'Unexpected fetch: ' + url);
      const next = responses.shift();
      return typeof next === 'function' ? next(options) : next;
    }
  };
  vm.runInNewContext(source, context, { filename: 'chatbot.js' });
  const query = selector => document.body.querySelector(selector);
  const messages = query('#jodok-chat-messages');
  return {
    document, requests, responses, navigations, timers, messages,
    form: query('#jodok-chat-form'), input: query('#jodok-chat-input'), send: query('#jodok-chat-send'),
    button(label) { return messages.querySelectorAll('button').find(button => button.textContent === label); },
    async submit(message, data = { reply: 'Đã nhận yêu cầu.', products: [] }) {
      responses.push(response(data));
      this.input.value = message;
      this.form.dispatch('submit');
      await flush();
    },
    changeUser(user, notify = true) {
      if (user) storage.set('ha_user', JSON.stringify(user)); else storage.delete('ha_user');
      if (notify) (events.get('storage') || []).forEach(handler => handler({ key: 'ha_user' }));
    }
  };
}

test('form rejects empty input and prevents duplicate submits while forwarding only current JWT and chat data', async () => {
  const ui = widget({ userId: 7, token: 'token-seven' });
  ui.input.value = '   ';
  ui.form.dispatch('submit');
  assert.equal(ui.requests.length, 0);
  let complete;
  ui.responses.push(() => new Promise(resolve => { complete = resolve; }));
  ui.input.value = 'Áo nam khoảng 200k';
  ui.form.dispatch('submit');
  ui.form.dispatch('submit');
  assert.equal(ui.requests.length, 1);
  assert.equal(ui.input.disabled, true);
  assert.equal(ui.send.disabled, true);
  const request = ui.requests[0];
  assert.equal(request.url, 'https://jodok.test/api/chatbot/message');
  assert.equal(request.headers.Authorization, 'Bearer token-seven');
  assert.deepEqual(Object.keys(JSON.parse(request.body)).sort(), ['conversationId', 'message']);
  complete(response({ reply: 'Mình đã tìm thấy áo nam.', products: [] }));
  await flush();
  assert.equal(ui.send.disabled, false);
  assert.match(ui.messages.textContent, /Mình đã tìm thấy áo nam/);
});

test('renders real response product/commerce fields as text and rejects object or executable URLs', async () => {
  const ui = widget();
  await ui.submit('Thanh toán', {
    reply: '<img src=x onerror=alert(1)>',
    products: [{ productId: 3, productName: '<script>mẫu</script>', imageUrl: 'javascript:alert(1)', price: 200000,
      originalPrice: 250000, size: 'L', color: 'Đen', stock: 4 }],
    metadata: {
      cart: { items: [{ productName: 'Áo thật', size: 'L', color: 'Đen', quantity: 2, price: 200000, lineTotal: 400000 }], subtotal: 400000 },
      checkout: { items: [], subtotal: 400000, discount: 20000, shipping: 30000, total: 410000, paymentMethod: 'CASH',
        address: { fullname: 'Khách', phone: '0900000000', address: 'Địa chỉ giao hàng' } },
      addresses: [{ id: 1, fullname: 'Khách', address: 'Địa chỉ giao hàng' }],
      orders: [{ orderId: 15, statusLabel: 'Chờ xác nhận', paymentMethod: 'QR', paymentStatusLabel: 'Chưa thanh toán', total: 410000, items: [] }],
      vouchers: [{ code: 'ABC', discount: 20000, minOrderValue: 300000, endDate: '2026-10-31' }],
      actions: [{ label: 'Không an toàn', url: 'javascript:alert(1)' }, { label: 'Website khác', url: 'https://evil.test' }, { label: 'Lỗi', message: {} }]
    }
  });
  assert.match(ui.messages.textContent, /<img src=x onerror=alert\(1\)>/);
  assert.match(ui.messages.textContent, /<script>mẫu<\/script>/);
  assert.match(ui.messages.textContent, /410\.000đ/);
  assert.match(ui.messages.textContent, /Chờ xác nhận/);
  assert.match(ui.messages.textContent, /Địa chỉ giao hàng/);
  assert.match(ui.messages.textContent, /Thanh toán khi nhận hàng/);
  assert.equal(ui.messages.querySelectorAll('img').length, 0);
  assert.ok(ui.messages.querySelectorAll('a').every(link => link.href.startsWith('https://jodok.test/')));
  assert.equal(ui.button('Không an toàn'), undefined);
  assert.equal(ui.button('Lỗi'), undefined);
  assert.ok(ui.button('Thêm vào giỏ'));
  assert.ok(ui.button('Chọn địa chỉ 1'));
  assert.ok(ui.button('Áp dụng ABC'));
  await ui.submit('Lỗi dữ liệu', { reply: { dangerous: true }, products: [], metadata: {} });
  assert.doesNotMatch(ui.messages.textContent, /\[object Object\]/);
});

test('confirmation buttons carry the response token and cannot replay after another request', async () => {
  const ui = widget({ token: 'current' });
  await ui.submit('Đặt hàng', { reply: 'Kiểm tra đơn.', products: [], metadata: {
    requiresConfirmation: true, confirmationToken: 'pending-one', actions: [{ label: 'Xác nhận đặt hàng', message: 'Xác nhận' }]
  } });
  const confirm = ui.button('Xác nhận đặt hàng');
  ui.responses.push(response({ reply: 'Đơn đã được tạo.', products: [] }));
  confirm.dispatch('click');
  confirm.dispatch('click');
  await flush();
  assert.equal(ui.requests.length, 2);
  assert.equal(JSON.parse(ui.requests[1].body).confirmationToken, 'pending-one');
  assert.equal(confirm.disabled, true);
  confirm.dispatch('click');
  assert.equal(ui.requests.length, 2);
});

test('variant cards select size/color while search cards keep original product ordinal commands', async () => {
  const ui = widget();
  const product = { productId: 8, variantId: 42, productName: 'Áo mẫu thứ hai', imageUrl: null,
    price: 300000, size: 'L', color: 'Đen', stock: 3 };
  await ui.submit('Cái thứ 2', { reply: 'Chọn biến thể áo.', products: [product],
    metadata: { productMode: 'variants', selectedProductId: 8 } });
  assert.equal(ui.button('Chọn mẫu 1'), undefined);
  ui.responses.push(response({ reply: 'Đã chọn size L màu Đen.', products: [product],
    metadata: { productMode: 'variants', selectedProductId: 8 } }));
  ui.button('Chọn biến thể').dispatch('click');
  await flush();
  assert.equal(JSON.parse(ui.requests[1].body).message, 'size L màu Đen');
  ui.responses.push(response({ reply: 'Đã thêm vào giỏ.', products: [] }));
  const add = ui.messages.querySelectorAll('button').find(button => button.textContent === 'Thêm vào giỏ' && !button.disabled);
  add.dispatch('click');
  await flush();
  assert.equal(JSON.parse(ui.requests[2].body).message, 'Thêm size L màu Đen vào giỏ');
  await ui.submit('Tìm áo nam', { reply: 'Danh sách áo.', products: [product], metadata: {} });
  ui.responses.push(response({ reply: 'Bạn chọn áo thứ nhất.', products: [] }));
  ui.button('Chọn mẫu 1').dispatch('click');
  await flush();
  assert.equal(JSON.parse(ui.requests.at(-1).body).message, 'Chọn mẫu 1');
});

test('switching accounts clears private messages and rotates conversation without reusing old actions', async () => {
  const ui = widget({ userId: 1, token: 'one' });
  await ui.submit('Đơn hàng của tôi', { reply: 'Địa chỉ riêng của tài khoản một', products: [], metadata: {
    actions: [{ label: 'Thao tác cũ', message: 'Thêm mẫu 1 vào giỏ' }]
  } });
  const oldAction = ui.button('Thao tác cũ');
  const oldConversation = JSON.parse(ui.requests[0].body).conversationId;
  ui.changeUser({ userId: 2, token: 'two' }, false);
  oldAction.dispatch('click');
  assert.equal(ui.requests.length, 1);
  assert.doesNotMatch(ui.messages.textContent, /Địa chỉ riêng/);
  await ui.submit('Xem giỏ hàng');
  assert.equal(ui.requests[1].headers.Authorization, 'Bearer two');
  assert.notEqual(JSON.parse(ui.requests[1].body).conversationId, oldConversation);
});

test('responses from an account that signed out during a request are discarded', async () => {
  const ui = widget({ token: 'old-account' });
  let complete;
  ui.responses.push(() => new Promise(resolve => { complete = resolve; }));
  ui.input.value = 'Đơn hàng của tôi';
  ui.form.dispatch('submit');
  ui.changeUser(null);
  complete(response({ reply: 'Thông tin riêng không được hiển thị', products: [] }));
  await flush();
  assert.doesNotMatch(ui.messages.textContent, /Thông tin riêng/);
  assert.equal(ui.send.disabled, false);
});

test('PayOS creates only the existing pending order, blocks untrusted checkout URL and allows official HTTPS URL', async () => {
  const ui = widget({ token: 'payment-jwt' });
  await ui.submit('Thanh toán đơn #15', { reply: 'Đơn chờ thanh toán.', products: [], metadata: {
    payment: { orderId: 15, method: 'QR', status: 'PENDING' }
  } });
  const pay = ui.button('Thanh toán đơn #15 qua PayOS');
  ui.responses.push(response({ checkoutUrl: 'https://pay.payos.vn.evil.test/web/15' }));
  pay.dispatch('click');
  await flush();
  assert.equal(ui.navigations.length, 0);
  assert.match(ui.messages.textContent, /Chưa mở được thanh toán PayOS/);
  const paymentRequest = ui.requests[1];
  assert.equal(paymentRequest.url, 'https://jodok.test/api/payments/payos/create');
  assert.equal(paymentRequest.headers.Authorization, 'Bearer payment-jwt');
  assert.deepEqual(JSON.parse(paymentRequest.body), { orderId: 15 });
  ui.responses.push(response({ data: { checkoutUrl: 'https://pay.payos.vn/web/15' } }));
  pay.dispatch('click');
  await flush();
  assert.deepEqual(ui.navigations, ['https://pay.payos.vn/web/15']);
  assert.equal(pay.disabled, true);
  assert.equal(ui.requests.some(request => request.url.includes('/paid')), false);
});

test('authentication and timeout failures recover controls without exposing server details', async () => {
  const ui = widget({ token: 'expired' });
  ui.responses.push(response({ message: 'SQL SELECT secret FROM users' }, 401));
  ui.input.value = 'Xem giỏ hàng';
  ui.form.dispatch('submit');
  await flush();
  assert.match(ui.messages.textContent, /Phiên đăng nhập đã hết hạn/);
  assert.doesNotMatch(ui.messages.textContent, /SQL|secret/);
  assert.equal(ui.messages.querySelectorAll('a').at(-1).href, 'https://jodok.test/auth');
  ui.responses.push(options => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => { const error = new Error('aborted'); error.name = 'AbortError'; reject(error); });
  }));
  ui.input.value = 'Xác nhận';
  ui.form.dispatch('submit');
  for (const callback of ui.timers.values()) callback();
  await flush();
  assert.equal(ui.send.disabled, false);
  assert.match(ui.messages.textContent, /kiểm tra Đơn hàng của tôi trước khi thử lại/);
});
