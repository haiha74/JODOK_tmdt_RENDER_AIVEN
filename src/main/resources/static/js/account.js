
/* JODOK - ACCOUNT */

let accountUser = null;

function accountEscape(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));
}

function accountPage() {
    return header() + `
        <main class="wrap orders-page account-page">
            <div class="orders-layout">

                <aside class="orders-sidebar">
                    <h3>Tài khoản của tôi</h3>

                    <a href="/account" class="active">
                        <i data-lucide="user-round"></i>
                        Thông tin tài khoản
                    </a>

                    <a href="/orders">
                        <i data-lucide="package"></i>
                        Đơn hàng của tôi
                    </a>

                    <a href="/products">
                        <i data-lucide="shopping-bag"></i>
                        Tiếp tục mua sắm
                    </a>

                    <button onclick="logoutAccount()">
                        <i data-lucide="log-out"></i>
                        Đăng xuất
                    </button>
                </aside>

                <section class="orders-content">

                    <nav class="orders-breadcrumb">
                        <a href="/">Trang chủ</a>
                        <i data-lucide="chevron-right"></i>
                        <span>Tài khoản</span>
                        <i data-lucide="chevron-right"></i>
                        <strong>Thông tin tài khoản</strong>
                    </nav>

                    <div class="orders-heading">
                        <h1>Thông tin tài khoản</h1>
                        <p></p>
                    </div>

                    <div class="account-card">

                        <div class="account-card-heading">
                            <span class="account-heading-icon">
                                <i data-lucide="user-round"></i>
                            </span>

                            <div>
                                <h2>Hồ sơ của tôi</h2>
                                <p>Cập nhật thông tin để thuận tiện khi mua sắm.</p>
                            </div>
                        </div>

                        <form id="accountForm" onsubmit="saveAccount(event)">

                            <div class="account-section-heading">
                                <i data-lucide="contact-round"></i>
                                <h3>Thông tin cá nhân</h3>
                            </div>

                            <div class="account-form-grid">

                                <label class="account-field">
                                    <span>Họ và tên <b>*</b></span>
                                    <input
                                        id="accountFullname"
                                        maxlength="255"
                                        required
                                        placeholder="Nhập họ và tên">
                                </label>

                                <label class="account-field">
                                    <span>Số điện thoại <b>*</b></span>
                                <input
                                    id="accountPhone"
                                    type="tel"
                                    inputmode="numeric"
                                    autocomplete="tel"
                                    maxlength="10"
                                    pattern="0[0-9]{9}"
                                    required
                                    placeholder="VD: 0976814999"
                                    oninput="
                                    jodokCleanPhone(this);
                                    jodokValidatePhoneInput(this);
                                    "
                                    onblur="jodokValidatePhoneInput(this)"
                                >
                                </label>

                                <label class="account-field account-field-full">
                                    <span>Email đăng nhập</span>
                                    <input
                                        id="accountEmail"
                                        type="email"
                                        readonly>
                                    <small>
                                        Email đăng nhập không thể thay đổi tại đây.
                                    </small>
                                </label>

                            </div>

                            <div class="account-section-heading account-address-heading">
                                <i data-lucide="map-pin"></i>
                                <h3>Địa chỉ nhận hàng mặc định</h3>
                            </div>

                            <div class="account-form-grid">

                                ${jodokAddressFields('account', 'account')}

                            </div>

                            <div id="accountMessage"
                                 class="account-message"
                                 role="status"
                                 aria-live="polite"></div>

                            <div class="account-form-actions">
                                <button type="button"
                                        class="account-reset-btn"
                                        onclick="fillAccountForm()">
                                    Hủy thay đổi
                                </button>

                                <button type="submit"
                                        id="accountSaveBtn"
                                        class="account-save-btn">
                                    <i data-lucide="save"></i>
                                    Lưu thay đổi
                                </button>
                            </div>

                        </form>
                    </div>

                </section>
            </div>
        </main>
    ` + footer();
}

function accountMessage(text, error = false) {
    const element = document.getElementById("accountMessage");
    if (!element) return;

    element.textContent = text;
    element.className = "account-message " +
        (error ? "error" : "success");
}

function fillAccountForm() {
    if (!accountUser) return;

    document.getElementById("accountFullname").value =
        accountUser.fullname || "";

    document.getElementById("accountPhone").value =
        accountUser.phone || "";

    document.getElementById("accountEmail").value =
        accountUser.email || "";

    jodokInitAddress("account", accountUser.address || "");

    const message = document.getElementById("accountMessage");
    message.textContent = "";
    message.className = "account-message";
}

async function loadAccountPage() {
    const session = JSON.parse(
        localStorage.getItem("ha_user") || "null"
    );

    if (!session?.token) {
        location.replace("/auth");
        return;
    }

    renderApp(accountPage());

    try {
        const response = await fetch(
            `${API_BASE}/account/me`,
            {
                headers: {
                    Authorization: `Bearer ${session.token}`
                }
            }
        );

        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem("ha_user");
            location.replace("/auth");
            return;
        }

        if (!response.ok) {
            throw new Error("Không thể tải thông tin tài khoản");
        }

        accountUser = await response.json();
        fillAccountForm();

    } catch (error) {
        accountMessage(error.message, true);
    }
}

async function saveAccount(event) {
    event.preventDefault();

    const session = JSON.parse(
        localStorage.getItem("ha_user") || "null"
    );

    if (!session?.token || !accountUser) {
        accountMessage("Vui lòng đăng nhập lại", true);
        return;
    }

    const phone = document.getElementById("accountPhone").value.trim();    
    if (!jodokPhoneValid(phone)) {
        const message = jodokPhoneError(phone);

        jodokValidatePhoneInput(
            document.getElementById("accountPhone")
        );

        accountMessage(message, true);
        return;
    }

    let address;

    try {
        address = jodokGetAddress("account");
    } catch (e) {
        accountMessage(e.message, true);
        return;
    }

    const body = {
        fullname: document.getElementById("accountFullname").value.trim(),
        phone,
        address
    };

    if (!body.fullname) {
        accountMessage("Vui lòng nhập họ và tên.", true);
        return;
    }

    const button = document.getElementById("accountSaveBtn");

    button.disabled = true;
    button.textContent = "Đang lưu...";

    try {
        const response = await fetch(
            `${API_BASE}/account/me`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.token}`
                },
                body: JSON.stringify(body)
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Cập nhật thất bại");
        }

        accountUser = data;

        localStorage.setItem("ha_user", JSON.stringify({
            ...session,
            fullname: data.fullname,
            phone: data.phone,
            address: data.address
        }));

        fillAccountForm();
        accountMessage("Cập nhật thông tin thành công!");

    } catch (error) {
        accountMessage(error.message, true);

    } finally {
        button.disabled = false;
        button.innerHTML = `
            <i data-lucide="save"></i>
            Lưu thay đổi
        `;

        if (window.lucide) lucide.createIcons();
    }
}

function logoutAccount() {
    localStorage.removeItem("ha_user");
    location.replace("/auth");
}

loadAccountPage();
