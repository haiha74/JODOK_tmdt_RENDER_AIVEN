
/* JODOK - Địa chỉ hành chính 2 cấp */

const JODOK_DIVISION_API = 'https://provinces.open-api.vn/api/v2';
let jodokProvinceCache = null;
const jodokWardCache = new Map();

function jodokEscape(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}


/* ==========================================
   JODOK - VALIDATE SỐ ĐIỆN THOẠI VIỆT NAM
   ========================================== */

// Danh sách đầu số di động hợp lệ tại Việt Nam
const JODOK_VN_PHONE_PREFIXES = [
  // Viettel
  "032", "033", "034", "035", "036",
  "037", "038", "039", "086", "096",
  "097", "098",

  // VinaPhone
  "081", "082", "083", "084", "085",
  "088", "091", "094",

  // MobiFone
  "070", "076", "077", "078", "079",
  "089", "090", "093",

  // Vietnamobile
  "052", "056", "058", "092",

  // Gmobile
  "059", "099",

  // Mạng di động ảo
  "055", "087"
];

// Kiểm tra số điện thoại hợp lệ
function jodokPhoneValid(phone) {
  const value = String(phone ?? "").trim();

  // Bắt buộc đúng 10 chữ số
  if (!/^0[0-9]{9}$/.test(value)) {
    return false;
  }

  // Kiểm tra đầu số thuộc danh sách Việt Nam
  const prefix = value.substring(0, 3);

  return JODOK_VN_PHONE_PREFIXES.includes(prefix);
}

// Làm sạch dữ liệu khi nhập
function jodokCleanPhone(input) {
  if (!input) return;

  input.value = String(input.value)
    .replace(/[^0-9]/g, "")
    .slice(0, 10);

  // Xóa thông báo lỗi khi khách sửa
  input.setCustomValidity("");
}

// Lấy thông báo lỗi cụ thể
function jodokPhoneError(phone) {
  const value = String(phone ?? "").trim();

  if (!value) {
    return "Vui lòng nhập số điện thoại.";
  }

  if (!/^[0-9]+$/.test(value)) {
    return "Số điện thoại chỉ được chứa chữ số.";
  }

  if (!value.startsWith("0")) {
    return "Số điện thoại phải bắt đầu bằng số 0.";
  }

  if (value.length !== 10) {
    return "Số điện thoại phải có đúng 10 chữ số.";
  }

  if (!JODOK_VN_PHONE_PREFIXES.includes(value.slice(0, 3))) {
    return "Đầu số điện thoại không hợp lệ tại Việt Nam.";
  }

  return "";
}

// Kiểm tra trường nhập, hiển thị lỗi ngay dưới ô

function jodokValidatePhoneInput(input) {
  if (!input) return false;

  const message = jodokPhoneError(input.value);

  input.setCustomValidity(message);

  let error = document.getElementById(input.id + "Error");

  if (!error) {
    error = document.createElement("p");
    error.id = input.id + "Error";
    error.style.cssText = `
      font-size: 12px;
      color: #b91c1c;
      margin-top: 5px;
      line-height: 1.5;
    `;

    input.insertAdjacentElement("afterend", error);
  }

  // Chỉ hiển thị khi có lỗi
  error.textContent = message;
  error.style.display = message ? "block" : "none";

  input.style.borderColor = message
    ? "#dc2626"
    : "#e5e7eb";

  input.setAttribute(
    "aria-invalid",
    message ? "true" : "false"
  );

  return !message;
}



function jodokAddressFields(prefix, style = 'payment') {
  const c = style === 'account'
    ? 'account-field'
    : 'block text-sm font-semibold text-gray-700';

  const input = style === 'account'
    ? ''
    : 'w-full border rounded-xl px-4 py-3 bg-white';

  const label = (text, id, inner) =>
    style === 'account'
      ? `<label class="account-field">
          <span>${text} <b>*</b></span>
          ${inner}
        </label>`
      : `<label class="block">
          <span class="${c}">${text} *</span>
          ${inner}
        </label>`;

  const select = (id, placeholder, disabled) => `
    <select
      id="${id}"
      required
      ${disabled ? 'disabled' : ''}
      class="${input}"
      style="width:100%;min-height:46px;padding:10px;border:1px solid #ddd;border-radius:12px">
      <option value="">${placeholder}</option>
    </select>`;

  return `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

      ${label(
        'Tỉnh / Thành phố',
        prefix + 'Province',
        select(prefix + 'Province', 'Đang tải tỉnh/thành...', true)
      )}

      ${label(
        'Phường / Xã',
        prefix + 'Ward',
        select(prefix + 'Ward', 'Chọn tỉnh/thành trước', true)
      )}

      <label class="${
        style === 'account'
          ? 'account-field account-field-full'
          : 'block sm:col-span-2'
      }">
        <span class="${c}">
          Số nhà, tên đường, thôn/tổ dân phố *
        </span>
        <input
          id="${prefix}Street"
          maxlength="180"
          required
          placeholder="VD: Số 12, ngõ 5, phố Huế"
          class="${input}"
          style="width:100%;min-height:46px;padding:10px;border:1px solid #ddd;border-radius:12px">
      </label>

      <p
        id="${prefix}AddressHint"
        class="text-xs text-gray-500 sm:col-span-2"
        aria-live="polite">
        Chọn tỉnh/thành và phường/xã theo địa giới mới.
      </p>

    </div>`;
}

async function jodokLoadDivisions(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Không tải được danh sách địa chỉ');
  }

  const items = await response.json();

  if (!Array.isArray(items)) {
    throw new Error('Dữ liệu địa chỉ không hợp lệ');
  }

  return items;
}

function jodokFillSelect(select, items, placeholder) {
  select.replaceChildren(new Option(placeholder, ''));

  items
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    .forEach(item => {
      select.add(new Option(item.name, String(item.code)));
    });

  select.disabled = false;
}

async function jodokInitAddress(prefix, existing = '') {
  const provinceEl = document.getElementById(prefix + 'Province');
  const wardEl = document.getElementById(prefix + 'Ward');
  const streetEl = document.getElementById(prefix + 'Street');
  const hint = document.getElementById(prefix + 'AddressHint');

  if (!provinceEl || !wardEl || !streetEl) return;

  let generation = 0;
  const old = String(existing || '').trim();

  if (old) {
    streetEl.value = old;
    hint.textContent =
      'Địa chỉ cũ được giữ tạm trong ô chi tiết. ' +
      'Vui lòng chọn lại tỉnh/thành và phường/xã, ' +
      'rồi chỉnh số nhà, đường trước khi lưu.';
  }

  const setWard = async () => {
    const gen = ++generation;

    wardEl.disabled = true;
    wardEl.replaceChildren(
      new Option('Đang tải phường/xã...', '')
    );

    if (!provinceEl.value) {
      wardEl.replaceChildren(
        new Option('Chọn tỉnh/thành trước', '')
      );
      return;
    }

    try {
      const code = provinceEl.value;

      if (!jodokWardCache.has(code)) {
        jodokWardCache.set(
          code,
          await jodokLoadDivisions(
            `${JODOK_DIVISION_API}/w/?province=${encodeURIComponent(code)}`
          )
        );
      }

      if (gen !== generation) return;

      jodokFillSelect(
        wardEl,
        jodokWardCache.get(code),
        'Chọn phường/xã'
      );

    } catch (e) {
      if (gen !== generation) return;

      wardEl.replaceChildren(
        new Option('Không tải được - chọn lại tỉnh/thành', '')
      );

      hint.textContent =
        'Không tải được phường/xã. ' +
        'Kiểm tra mạng và chọn lại tỉnh/thành.';
    }
  };

  provinceEl.onchange = () => {
    hint.textContent =
      'Vui lòng chọn phường/xã và nhập địa chỉ chi tiết.';
    setWard();
  };

  try {
    if (!jodokProvinceCache) {
      jodokProvinceCache = await jodokLoadDivisions(
        `${JODOK_DIVISION_API}/p/`
      );
    }

    jodokFillSelect(
      provinceEl,
      jodokProvinceCache,
      'Chọn tỉnh/thành phố'
    );

    const matchProvince = jodokProvinceCache.find(
      p => old.endsWith(', ' + p.name)
    );

    if (matchProvince) {
      provinceEl.value = String(matchProvince.code);

      await setWard();

      const matchWard = (
        jodokWardCache.get(provinceEl.value) || []
      ).find(
        w => old.endsWith(
          ', ' + w.name + ', ' + matchProvince.name
        )
      );

      if (matchWard) {
        wardEl.value = String(matchWard.code);

        streetEl.value = old.slice(
          0,
          -(
            ', ' + matchWard.name +
            ', ' + matchProvince.name
          ).length
        );

        hint.textContent =
          'Địa chỉ đã được điền từ hồ sơ.';
      }
    }

  } catch (e) {
    hint.textContent =
      'Không tải được tỉnh/thành. ' +
      'Kiểm tra kết nối và tải lại trang.';

    provinceEl.replaceChildren(
      new Option('Không tải được dữ liệu địa chỉ', '')
    );
  }
}

function jodokGetAddress(prefix) {
  const province = document.getElementById(prefix + 'Province');
  const ward = document.getElementById(prefix + 'Ward');
  const street = document.getElementById(prefix + 'Street');

  if (
    !province?.value ||
    !ward?.value ||
    !street?.value.trim()
  ) {
    throw new Error(
      'Chọn tỉnh/thành, phường/xã và nhập số nhà, tên đường.'
    );
  }

  const detail = street.value.trim().replace(/\s+/g, ' ');

  const value = [
    detail,
    ward.selectedOptions[0].textContent,
    province.selectedOptions[0].textContent
  ].join(', ');

  if (value.length > 255) {
    throw new Error(
      'Địa chỉ đầy đủ vượt quá 255 ký tự. ' +
      'Hãy rút ngắn phần địa chỉ chi tiết.'
    );
  }

  return value;
}
