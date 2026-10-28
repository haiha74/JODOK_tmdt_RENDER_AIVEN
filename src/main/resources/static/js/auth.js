function authPage(){
  const user = getUser();

  if(user){
    return header()+`
      <main class="wrap py-20 min-h-[60vh] flex items-center justify-center">
        <div class="soft-card p-8 max-w-xl w-full text-center">
          <h1 class="serif text-4xl">Xin chào, ${user.fullname || user.email}</h1>
          <p class="mt-4 text-neutral-600">Email: ${user.email}</p>
          <p class="mt-2 text-neutral-600">Vai trò: ${user.role}</p>
          <button onclick="logout()" class="mt-7 bg-black text-white rounded-full px-8 py-3 font-bold">
            Đăng xuất
          </button>
        </div>
      </main>
    `+footer();
  }

  const isLogin = authMode === "login";


  return header()+`  <style>
    .jodok-auth-alert{display:none;position:fixed;top:24px;right:24px;z-index:2147483000;align-items:flex-start;gap:12px;width:min(420px,calc(100vw - 32px));margin:0;padding:15px;border:1px solid #fecaca;border-left:4px solid #bd252c;border-radius:16px;background:linear-gradient(115deg,#fff6f5 0%,#fffafa 100%);color:#8c2228;box-shadow:0 18px 48px rgba(58,22,22,.16);animation:jodok-alert-in .28s cubic-bezier(.2,.8,.2,1);}
    .jodok-auth-alert.is-visible{display:flex}
    .jodok-auth-alert__icon{flex:0 0 32px;width:32px;height:32px;display:grid;place-items:center;background:#fee2e2;border-radius:10px;color:#b91c1c}
    .jodok-auth-alert__body{flex:1;min-width:0;padding-top:1px}
    .jodok-auth-alert__title{font-size:13px;line-height:19px;font-weight:800;letter-spacing:.01em}
    .jodok-auth-alert__detail{margin-top:2px;font-size:13px;line-height:20px;color:#a14246;overflow-wrap:anywhere}
    .jodok-auth-alert__close{display:grid;place-items:center;flex:0 0 24px;width:24px;height:24px;border-radius:7px;color:#b86b6b;cursor:pointer;transition:background .2s,color .2s}
    .jodok-auth-alert__close:hover{background:#fee2e2;color:#991b1b}
    .jodok-auth-field-invalid{border-color:#dc6464!important;background:#fffafa!important;box-shadow:0 0 0 3px rgba(220,38,38,.09)!important;outline:none!important}
    @keyframes jodok-alert-in{from{opacity:0;transform:translate(12px,-12px)}to{opacity:1;transform:translate(0,0)}}
    @media(max-width:640px){.jodok-auth-alert{top:12px;right:12px;width:calc(100vw - 24px)}}
    @media(prefers-reduced-motion:reduce){.jodok-auth-alert{animation:none}}
  </style><main class="wrap py-12 lg:py-16 min-h-[calc(100vh-260px)] flex items-center">
    <div class="w-full grid lg:grid-cols-[1fr_540px] gap-10 items-center">
      <section class="pr-4">
        <p class="text-red-800 tracking-[.18em] uppercase font-bold text-base mb-5">JODOK ACCOUNT</p>
        <h1 class="serif text-5xl lg:text-6xl leading-tight mb-5">${isLogin ? "Chào mừng bạn quay lại" : "Tạo tài khoản mua hàng"}</h1>
        
      </section>

      <section class="soft-card p-7 lg:p-8">
        <h2 class="serif text-4xl text-center mb-7">${isLogin ? "Đăng nhập" : "Đăng ký"}</h2>

        ${isLogin ? `
          <div class="space-y-4">
            <input id="loginEmail" type="email" autocomplete="email" class="input-ui" placeholder="Email">
            <input id="loginPassword" autocomplete="current-password" type="password" class="input-ui" placeholder="Mật khẩu">
            <button onclick="login()" id="loginSubmit" class="btn-primary">Đăng nhập</button>
          </div>
          <p class="text-center mt-6 text-base">Chưa có tài khoản? <button onclick="switchAuth('register')" class="text-red-800 font-bold">Đăng ký ngay</button></p>
        ` : `
          <div class="space-y-4">
            <input id="regFullname" autocomplete="name" class="input-ui" placeholder="Họ và tên">
            <input id="regEmail" type="email" autocomplete="email" class="input-ui" placeholder="Email">
            <input id="regPassword" autocomplete="new-password" type="password" class="input-ui" placeholder="Mật khẩu">
            <input id="regConfirm" autocomplete="new-password" type="password" class="input-ui" placeholder="Nhập lại mật khẩu">
            <button onclick="register()" id="registerSubmit" class="btn-primary">Tạo tài khoản</button>
          </div>
          <p class="text-center mt-6 text-base">Đã có tài khoản? <button onclick="switchAuth('login')" class="text-red-800 font-bold">Đăng nhập</button></p>
        `}
        <div id="authMsg" class="jodok-auth-alert" role="alert" aria-live="polite" aria-atomic="true">
          <div class="jodok-auth-alert__icon" aria-hidden="true">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 7v6"/><path d="M12 17h.01"/></svg>
          </div>
          <div class="jodok-auth-alert__body">
            <div class="jodok-auth-alert__title">Vui lòng kiểm tra lại</div>
            <div id="authMsgText" class="jodok-auth-alert__detail"></div>
          </div>
          <button type="button" class="jodok-auth-alert__close" aria-label="Đóng thông báo" onclick="authMessage('')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </section>
    </div>
  </main>`+footer();
}

function switchAuth(type){
  clearTimeout(authAlertTimer);
  document.getElementById('authMsg')?.remove();
  authMode = type;
  renderApp(authPage());
}

let authAlertTimer;
function authMessage(message, fieldId) {
  clearTimeout(authAlertTimer);
  const alert = document.getElementById('authMsg');
  const text = document.getElementById('authMsgText');
  document.querySelectorAll('.jodok-auth-field-invalid').forEach(el => {
    el.classList.remove('jodok-auth-field-invalid');
    el.removeAttribute('aria-invalid');
  });
  if (!alert || !text) return;
  text.textContent = message || '';
  // Đưa toast ra ngoài form để cố định theo cửa sổ, không bị layout che khuất.
  if (alert.parentElement !== document.body) document.body.appendChild(alert);
  alert.classList.toggle('is-visible', Boolean(message));
  if (message) authAlertTimer = setTimeout(() => authMessage(''), 5000);
  if (message && fieldId) {
    const field = document.getElementById(fieldId);
    if (field) {
      field.classList.add('jodok-auth-field-invalid');
      field.setAttribute('aria-invalid', 'true');
      field.focus({preventScroll: true});
    }
  }
}

// Xóa cảnh báo ngay khi người dùng chỉnh sửa trường nhập lỗi.
document.addEventListener('input', event => {
  if (event.target?.classList?.contains('jodok-auth-field-invalid')) authMessage('');
});

function authBusy(buttonId, busy) {
  const button = document.getElementById(buttonId);
  if (button) button.disabled = busy;
}

async function authRequest(path, payload) {
  const response = await fetch(`${API_BASE}/auth/${path}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Yêu cầu thất bại, vui lòng thử lại');
  return data;
}

async function login() {
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;
  if (!email || !password) return authMessage('Vui lòng nhập email và mật khẩu', !email ? 'loginEmail' : 'loginPassword');
  authMessage('');
  authBusy('loginSubmit', true);
  try {
    const data = await authRequest('login', {email, password});
    if (data.role !== 'USER') {
      return authMessage('Tài khoản Admin/Staff không được đăng nhập ở trang Shop');
    }
    if (!data.token || !data.userId) throw new Error('Dữ liệu đăng nhập không hợp lệ');
    localStorage.setItem('ha_user', JSON.stringify(data));
    window.location.replace('/');
  } catch (error) {
    authMessage(error instanceof TypeError ? 'Không kết nối được máy chủ. Vui lòng thử lại.' : error.message);
  } finally {
    authBusy('loginSubmit', false);
  }
}

async function register() {
  const fullname = document.getElementById('regFullname').value.trim().replace(/\s+/g, ' ');
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const password = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regConfirm').value;
  if (fullname.length < 2 || fullname.length > 255) return authMessage('Họ tên phải có từ 2 đến 255 ký tự', 'regFullname');
  if (email.length > 255 || !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)) return authMessage('Vui lòng nhập đúng định dạng email, ví dụ: ten@gmail.com', 'regEmail');
  if (password.length < 8 || password.length > 72 || !/\p{L}/u.test(password) || !/\d/.test(password)) {
    return authMessage('Mật khẩu cần có 8–72 ký tự, bao gồm cả chữ và số.', 'regPassword');
  }
  if (password !== confirm) return authMessage('Mật khẩu xác nhận chưa trùng với mật khẩu đã nhập.', 'regConfirm');
  authMessage('');
  authBusy('registerSubmit', true);
  try {
    await authRequest('register', {fullname, email, password});
    showToast('Đăng ký thành công', 'Vui lòng đăng nhập để tiếp tục', 'success');
    clearTimeout(authAlertTimer);
    document.getElementById('authMsg')?.remove();
    authMode = 'login';
    renderApp(authPage());
  } catch (error) {
    authMessage(error instanceof TypeError ? 'Không kết nối được máy chủ. Vui lòng thử lại.' : error.message);
  } finally {
    authBusy('registerSubmit', false);
  }
}

function logout() {
  localStorage.removeItem('ha_user');
  location.href = '/auth';
}

// Kiểm tra token với backend trước khi hiển thị phiên đăng nhập trên trang auth.
async function loadAuthPage() {
  const user = getUser();
  if (user?.token) {
    try {
      const response = await fetch(`${API_BASE}/account/me`, {
        headers: {Authorization: `Bearer ${user.token}`}
      });
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        localStorage.removeItem('ha_user');
      } else if (response.ok) {
        const profile = await response.json();
        localStorage.setItem('ha_user', JSON.stringify({
          ...user, fullname: profile.fullname, email: profile.email
        }));
      }
      // Lỗi mạng hoặc server: không kết luận token sai, cho phép thử lại.
    } catch (_) { /* Giữ token cho đến khi có kết quả xác thực */ }
  }
  renderApp(authPage());
}

loadAuthPage();
