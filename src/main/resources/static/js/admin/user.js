// Refactored from legacy /js/admin.js. Business logic preserved.
// Loaded as a compatibility classic script by admin/admin.js so existing inline handlers keep working.

function userTable(){
  const list = users.filter(u =>
    (u.fullname || "").toLowerCase().includes(adminSearch.users) ||
    (u.email || "").toLowerCase().includes(adminSearch.users) ||
    (u.phone || "").toLowerCase().includes(adminSearch.users) ||
    (u.role || "").toLowerCase().includes(adminSearch.users)
  );

  return `<div class="soft-card overflow-hidden">
    ${adminToolbar("users", "Quản lý người dùng", "Thêm", "openUserForm()")}

    <div class="overflow-x-auto">
      <table class="w-full text-left">
        <thead class="bg-neutral-50 text-sm text-neutral-500">
          <tr>
            <th class="p-4">Tên</th>
            <th>Email</th>
            <th>SĐT</th>
            <th>Vai trò</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>

        <tbody>
          ${
            list.map(u => `
              <tr class="border-t">
                <td class="p-4 font-semibold">${u.fullname || "Chưa có"}</td>
                <td>${u.email}</td>
                <td>${u.phone || "-"}</td>
                <td><span class="rounded-full bg-neutral-100 px-3 py-1 text-sm">${u.role}</span></td>
                <td>${u.status}</td>
                <td class="space-x-2">
                  <button onclick="openUserForm(${u.userId})" class="border rounded-full px-2 py-2 text-sm">Sửa</button>
                  <button onclick="deleteUser(${u.userId})" class="bg-red-800 text-white rounded-full px-2 py-2 text-sm">Xóa</button>
                </td>
              </tr>
            `).join("") || `<tr><td colspan="6" class="p-6 text-center text-neutral-500">Chưa có người dùng</td></tr>`
          }
        </tbody>
      </table>
    </div>
  </div>${userModal()}`;
}

function userModal(){
  return `<div id="userModal" class="fixed inset-0 bg-black/40 z-[999] hidden items-center justify-center p-5">
    <div class="bg-white rounded-3xl p-7 w-full max-w-lg shadow-xl">
      <div class="flex justify-between items-center mb-5">
        <h2 id="userFormTitle" class="serif text-3xl">Thêm người dùng</h2>
        <button onclick="closeUserForm()" class="text-2xl">×</button>
      </div>

      <input type="hidden" id="userId">

      <div class="space-y-4">
        <input id="userFullname" class="input-ui" placeholder="Họ tên">
        <input id="userEmail" class="input-ui" placeholder="Email">
        <input id="userPhone" class="input-ui" placeholder="Số điện thoại">
        <input id="userPassword" type="password" class="input-ui" placeholder="Mật khẩu">

        <select id="userRole" class="input-ui">
          <option value="USER">USER</option>
          <option value="STAFF">STAFF</option>
          <option value="ADMIN">ADMIN</option>
        </select>

        <select id="userStatus" class="input-ui">
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>

        <textarea id="userAddress" class="input-ui" placeholder="Địa chỉ"></textarea>

        <button onclick="saveUser()" class="btn-primary w-full">Lưu người dùng</button>
      </div>
    </div>
  </div>`;
}

function openUserForm(id=null){
  document.getElementById("userModal").classList.remove("hidden");
  document.getElementById("userModal").classList.add("flex");

  document.getElementById("userFormTitle").innerText = id ? "Sửa người dùng" : "Thêm người dùng";
  document.getElementById("userId").value = id || "";

  const u = users.find(x => x.userId === id);

  document.getElementById("userFullname").value = u?.fullname || "";
  document.getElementById("userEmail").value = u?.email || "";
  document.getElementById("userPhone").value = u?.phone || "";
  document.getElementById("userPassword").value = "";
  document.getElementById("userRole").value = u?.role || "USER";
  document.getElementById("userStatus").value = u?.status || "ACTIVE";
  document.getElementById("userAddress").value = u?.address || "";
}

function closeUserForm(){
  document.getElementById("userModal").classList.add("hidden");
  document.getElementById("userModal").classList.remove("flex");
}

async function saveUser(){
  const id = document.getElementById("userId").value;

  const body = {
    fullname: document.getElementById("userFullname").value.trim(),
    email: document.getElementById("userEmail").value.trim(),
    phone: document.getElementById("userPhone").value.trim(),
    password: document.getElementById("userPassword").value,
    role: document.getElementById("userRole").value,
    status: document.getElementById("userStatus").value,
    address: document.getElementById("userAddress").value.trim()
  };

  if(!body.fullname || !body.email){
    showToast("Lỗi", "Vui lòng nhập họ tên và email", "error");
    return;
  }

  if(!id && !body.password){
    showToast("Lỗi", "Vui lòng nhập mật khẩu cho tài khoản mới", "error");
    return;
  }

  const url = id ? `${API_BASE}/users/${id}` : `${API_BASE}/users`;
  const method = id ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    headers: adminJsonHeaders(),
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({}));

  if(!res.ok){
    showToast("Lỗi", data.message || "Lưu người dùng thất bại", "error");
    return;
  }

  closeUserForm();
  await init();
  currentTab = "users";
  render();
  showToast("Thành công", "Đã lưu người dùng");
}

function deleteUser(id){
  const currentAdmin = admin();

  if(currentAdmin?.userId === id){
    showToast("Lỗi", "Không thể xóa chính tài khoản đang đăng nhập", "error");
    return;
  }

  showConfirm("Xóa người dùng này?", async () => {
    const res = await fetch(
      `${API_BASE}/users/${id}`,
      {
        method:"DELETE",
        headers: adminAuthHeaders()
      }
    );

    const data = await res.json().catch(() => ({}));

    if(!res.ok){
      showToast("Lỗi", data.message || "Xóa người dùng thất bại", "error");
      return;
    }

    await init();
    currentTab = "users";
    render();
    showToast("Thành công", "Đã xóa người dùng");
  });
}
