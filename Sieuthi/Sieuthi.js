// ========== LOCALSTORAGE HELPERS (Per-user isolation) ==========
let currentUser = null;

function loadCurrentUser() {
    const stored = sessionStorage.getItem('currentUser');
    if (!stored) {
        // no redirect during local dev — keep behavior but fallback
        console.warn('[Sieuthi] no currentUser in sessionStorage');
        return null;
    }
    try { currentUser = JSON.parse(stored); } catch (e) { currentUser = null; }
    return currentUser;
}

function getUserStorageKey(key) {
    if (!currentUser) return null;
    return `user_${currentUser.id}_${key}`;
}

function loadUserData(key) {
    const storageKey = getUserStorageKey(key);
    if (!storageKey) return [];
    return JSON.parse(localStorage.getItem(storageKey) || '[]');
}

function saveUserData(key, data) {
    const storageKey = getUserStorageKey(key);
    if (!storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(data));
}

// Per-user database structure for Siêu thị
const DB = { users: [], inventory: [], sales: [] };

function loadDB() {
    DB.users = loadUserData('users') || [];
    DB.inventory = loadUserData('inventory') || [];
    DB.sales = loadUserData('sales') || [];
}

function saveDB() {
    saveUserData('users', DB.users);
    saveUserData('inventory', DB.inventory);
    saveUserData('sales', DB.sales);
}

/* ---------- KPI & Rendering ---------- */

function renderKPIs() {
    const displayName = currentUser?.fullName || 'Siêu thị';
    const headerSpan = document.querySelector('.sidebar-header span');
    if (headerSpan) headerSpan.textContent = displayName;
    document.getElementById('kpi-users').textContent = DB.users.length;
    document.getElementById('kpi-inventory').textContent = DB.inventory.length;
    document.getElementById('kpi-sales').textContent = DB.sales.length;
    const totalRevenue = DB.sales.reduce((sum, s) => sum + (parseFloat(s.soLuong) * parseFloat(s.giaBan)), 0);
    document.getElementById('kpi-revenue').textContent = totalRevenue.toLocaleString('vi-VN');
}

function renderUsers() {
    const tbody = document.querySelector('#table-users tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    DB.users.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${u.id}</td><td>${u.hoTen}</td><td>${u.chucVu}</td><td>${u.soDienThoai || '-'}</td><td>${u.ngayTuyenDung || '-'}</td><td>Hoạt động</td>
            <td><button class="btn small" onclick="editUser('${u.id}')">Sửa</button>
                <button class="btn small" onclick="deleteUser('${u.id}')">Xóa</button></td>`;
        tbody.appendChild(tr);
    });
}

function renderInventory() {
    const tbody = document.querySelector('#table-inventory-all tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    DB.inventory.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${p.id}</td><td>${p.tenSP}</td><td>${p.soLuong}</td><td>${parseFloat(p.giaNhap).toLocaleString()}</td><td>${parseFloat(p.giaBan).toLocaleString()}</td><td>${p.nhaCungCap || '-'}</td><td>${p.hanDung || '-'}</td>
            <td><button class="btn small" onclick="editProduct('${p.id}')">Sửa</button>
                <button class="btn small" onclick="deleteProduct('${p.id}')">Xóa</button></td>`;
        tbody.appendChild(tr);
    });
}

function renderSales() {
    const tbody = document.querySelector('#table-sales-all tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    DB.sales.forEach(s => {
        const totalAmount = (parseFloat(s.soLuong) * parseFloat(s.giaBan)).toLocaleString();
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${s.maHD}</td><td>${s.sanPham}</td><td>${s.soLuong}</td><td>${parseFloat(s.giaBan).toLocaleString()}</td><td>${totalAmount}</td><td>${s.nhanVienBan || '-'}</td><td>${s.ngayBan || '-'}</td><td>Hoàn thành</td>
            <td><button class="btn small" onclick="deleteSale('${s.id}')">Xóa</button></td>`;
        tbody.appendChild(tr);
    });
}

function renderRecent() {
    const tbody = document.querySelector('#table-sales-recent tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const recent = DB.sales.slice().reverse().slice(0, 5);
    recent.forEach(s => {
        const tr = document.createElement('tr');
        const totalAmount = (parseFloat(s.soLuong) * parseFloat(s.giaBan)).toLocaleString();
        tr.innerHTML = `<td>${s.maHD}</td><td>${s.sanPham}</td><td>${s.soLuong}</td><td>${totalAmount}</td><td>${s.ngayBan || '-'}</td><td>Hoàn thành</td>`;
        tbody.appendChild(tr);
    });
}

function renderLowStock() {
    const tbody = document.querySelector('#table-low-stock tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const lowStock = DB.inventory.filter(p => p.soLuong < 10);
    lowStock.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${p.id}</td><td>${p.tenSP}</td><td>${p.soLuong}</td><td>${p.nhaCungCap || '-'}</td>
            <td><button class="btn small" onclick="editProduct('${p.id}')">Nhập hàng</button></td>`;
        tbody.appendChild(tr);
    });
}

function renderReports() {
    const totalProducts = DB.inventory.length;
    const totalStock = DB.inventory.reduce((sum, p) => sum + parseInt(p.soLuong || 0), 0);
    const totalRevenue = DB.sales.reduce((sum, s) => sum + (parseFloat(s.soLuong) * parseFloat(s.giaBan)), 0);
    const totalInvoices = DB.sales.length;

    document.getElementById('report-total-products').textContent = totalProducts;
    document.getElementById('report-total-stock').textContent = totalStock;
    document.getElementById('report-total-revenue').textContent = totalRevenue.toLocaleString('vi-VN');
    document.getElementById('report-total-invoices').textContent = totalInvoices;
}

/* ---------- Modal ---------- */

function openModal(html) {
    try {
        console.log('[Sieuthi] openModal called');
        document.getElementById('modal-body').innerHTML = html;
        document.getElementById('modal').classList.remove('hidden');
    } catch (err) { console.error('[Sieuthi] openModal error', err); }
}

function closeModal() {
    try { console.log('[Sieuthi] closeModal called'); document.getElementById('modal').classList.add('hidden'); } catch (err) { console.error('[Sieuthi] closeModal error', err); }
}

/* ---------- Users Management ---------- */

// Users (use delegation for modal buttons)
window.editUser = function(id) {
    const user = DB.users.find(u => u.id === id);
    if (!user) return;
    openModal(`
        <h3>Sửa thông tin nhân viên</h3>
        <label>Họ tên</label><input id="user-name" value="${user.hoTen}" />
        <label>Chức vụ</label><input id="user-position" value="${user.chucVu}" />
        <label>Số điện thoại</label><input id="user-phone" value="${user.soDienThoai || ''}" />
        <label>Ngày tuyển dụng</label><input id="user-hired" type="date" value="${user.ngayTuyenDung || ''}" />
        <div class="modal-actions">
            <button data-action="save-user" data-id="${id}" class="btn">Lưu</button>
            <button data-action="close" class="btn cancel">Hủy</button>
        </div>
    `);
};

window.deleteUser = function(id) {
    if (confirm('Xác nhận xóa nhân viên này?')) {
        DB.users = DB.users.filter(u => u.id !== id);
        saveDB(); renderUsers(); renderKPIs();
    }
};

function handleSaveUser(id = null) {
    const name = document.getElementById('user-name')?.value;
    const position = document.getElementById('user-position')?.value;
    const phone = document.getElementById('user-phone')?.value;
    const hired = document.getElementById('user-hired')?.value;
    if (!name || !position) { alert('Vui lòng nhập đầy đủ thông tin'); return; }
    if (id) {
        const user = DB.users.find(u => u.id === id);
        if (user) { user.hoTen = name; user.chucVu = position; user.soDienThoai = phone; user.ngayTuyenDung = hired; }
    } else {
        DB.users.push({ id: 'emp_' + Date.now(), hoTen: name, chucVu: position, soDienThoai: phone, ngayTuyenDung: hired });
    }
    saveDB(); renderUsers(); renderKPIs(); closeModal();
}

/* ---------- Inventory Management ---------- */

window.editProduct = function(id) {
    const product = DB.inventory.find(p => p.id === id);
    if (!product) return;
    openModal(`
        <h3>Sửa sản phẩm</h3>
        <label>Tên sản phẩm</label><input id="product-name" value="${product.tenSP}" />
        <label>Số lượng</label><input id="product-qty" type="number" value="${product.soLuong}" />
        <label>Giá nhập</label><input id="product-cost" type="number" value="${product.giaNhap}" />
        <label>Giá bán</label><input id="product-price" type="number" value="${product.giaBan}" />
        <label>Hạn dùng</label><input id="product-expiry" type="date" value="${product.hanDung || ''}" />
        <label>Nhà cung cấp</label><input id="product-supplier" value="${product.nhaCungCap || ''}" />
        <div class="modal-actions">
            <button data-action="save-product" data-id="${id}" class="btn">Lưu</button>
            <button data-action="close" class="btn cancel">Hủy</button>
        </div>
    `);
};

window.deleteProduct = function(id) {
    if (confirm('Xác nhận xóa sản phẩm này?')) {
        DB.inventory = DB.inventory.filter(p => p.id !== id);
        saveDB(); renderInventory(); renderLowStock(); renderKPIs();
    }
};

function handleSaveProduct(id = null) {
    const name = document.getElementById('product-name')?.value;
    const qty = parseInt(document.getElementById('product-qty')?.value) || 0;
    const cost = parseFloat(document.getElementById('product-cost')?.value) || 0;
    const price = parseFloat(document.getElementById('product-price')?.value) || 0;
    const expiry = document.getElementById('product-expiry')?.value;
    const supplier = document.getElementById('product-supplier')?.value;
    if (!name || !qty) { alert('Vui lòng nhập đầy đủ thông tin'); return; }
    if (id) {
        const product = DB.inventory.find(p => p.id === id);
        if (product) { product.tenSP = name; product.soLuong = qty; product.giaNhap = cost; product.giaBan = price; product.hanDung = expiry; product.nhaCungCap = supplier; }
    } else {
        DB.inventory.push({ id: 'SP' + Date.now(), tenSP: name, soLuong: qty, giaNhap: cost, giaBan: price, hanDung: expiry, nhaCungCap: supplier });
    }
    saveDB(); renderInventory(); renderLowStock(); renderKPIs(); closeModal();
}

/* ---------- Sales Management ---------- */

function handleSaveSale(id = null) {
    const product = document.getElementById('sale-product')?.value;
    const qty = parseInt(document.getElementById('sale-qty')?.value) || 0;
    const price = parseFloat(document.getElementById('sale-price')?.value) || 0;
    const seller = document.getElementById('sale-seller')?.value;
    const date = document.getElementById('sale-date')?.value;
    if (!product || !qty || !price) { alert('Vui lòng nhập đầy đủ thông tin'); return; }
    if (id) {
        const sale = DB.sales.find(s => s.id === id);
        if (sale) { sale.sanPham = product; sale.soLuong = qty; sale.giaBan = price; sale.nhanVienBan = seller; sale.ngayBan = date; }
    } else {
        const maHD = 'HD' + Date.now();
        DB.sales.push({ id: 'sale_' + Date.now(), maHD, sanPham: product, soLuong: qty, giaBan: price, nhanVienBan: seller, ngayBan: date });
    }
    saveDB(); renderSales(); renderRecent(); renderKPIs(); closeModal();
}

window.deleteSale = function(id) { if (confirm('Xác nhận xóa hóa đơn này?')) { DB.sales = DB.sales.filter(s => s.id !== id); saveDB(); renderSales(); renderRecent(); renderKPIs(); } };

/* ---------- Initialize ---------- */

function refreshAll() { renderKPIs(); renderUsers(); renderInventory(); renderSales(); renderRecent(); renderLowStock(); renderReports(); }

// ⭐ CHẠY KHI DOM ĐÃ SẴNG SÀNG
window.addEventListener('DOMContentLoaded', () => {
    // Try loading user; if missing, do not immediately redirect to allow local testing
    loadCurrentUser();
    loadDB();

    // Display current user info
    const userDisplay = document.getElementById('current-user');
    if (userDisplay && currentUser) userDisplay.innerHTML = `<strong>👤 ${currentUser.fullName || 'Siêu thị'}</strong>`;
    const agencyDisplay = document.getElementById('current-agency');
    if (agencyDisplay) agencyDisplay.innerHTML = '<em>Siêu thị</em>';

    // Navigation
    const pages = document.querySelectorAll('.page');
    const sidebarMenu = document.querySelector('.sidebar-menu');

    function showSection(id) {
        pages.forEach(p => p.classList.toggle('active-page', p.id === id));
        document.querySelectorAll('.menu-link[data-section]').forEach(l => l.classList.toggle('active', l.dataset.section === id));
    }

    function currentHash() { return (location.hash || '').replace(/^#/, '') || 'dashboard'; }

    // initial
    showSection(currentHash()); refreshAll();

    window.addEventListener('hashchange', () => { showSection(currentHash()); refreshAll(); });

    sidebarMenu?.addEventListener('click', (e) => {
        const link = e.target.closest('.menu-link[data-section]');
        if (!link) return; e.preventDefault(); const section = link.dataset.section; location.hash = section;
    });

    // Modal: close button and delegation for actions inside modal
    document.getElementById('modal')?.addEventListener('click', (e) => {
        if (e.target.matches('.modal-close')) return closeModal();
    });

    // Listen for action buttons inside modal-body (data-action)
    document.getElementById('modal-body')?.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const id = btn.dataset.id || null;
        if (action === 'close') return closeModal();
        if (action === 'save-user') return handleSaveUser(id);
        if (action === 'save-product') return handleSaveProduct(id);
        if (action === 'save-sale') return handleSaveSale(id);
    });

    // Buttons that open modals (use JS to inject modal content, no inline onclick)
    document.getElementById('btn-new-user')?.addEventListener('click', () => {
        openModal(`
            <h3>Thêm nhân viên mới</h3>
            <label>Họ tên</label><input id="user-name" />
            <label>Chức vụ</label><input id="user-position" />
            <label>Số điện thoại</label><input id="user-phone" />
            <label>Ngày tuyển dụng</label><input id="user-hired" type="date" />
            <div class="modal-actions"><button data-action="save-user" class="btn">Tạo</button><button data-action="close" class="btn cancel">Hủy</button></div>
        `);
    });

    document.getElementById('btn-add-user')?.addEventListener('click', () => {
        document.getElementById('btn-new-user')?.click();
    });

    document.getElementById('btn-new-product')?.addEventListener('click', () => {
        openModal(`
            <h3>Nhập sản phẩm mới</h3>
            <label>Tên sản phẩm</label><input id="product-name" />
            <label>Số lượng</label><input id="product-qty" type="number" />
            <label>Giá nhập</label><input id="product-cost" type="number" />
            <label>Giá bán</label><input id="product-price" type="number" />
            <label>Hạn dùng</label><input id="product-expiry" type="date" />
            <label>Nhà cung cấp</label><input id="product-supplier" />
            <div class="modal-actions"><button data-action="save-product" class="btn">Nhập</button><button data-action="close" class="btn cancel">Hủy</button></div>
        `);
    });

    document.getElementById('btn-import-product')?.addEventListener('click', () => document.getElementById('btn-new-product')?.click());

    document.getElementById('btn-new-invoice')?.addEventListener('click', () => {
        const today = new Date().toISOString().split('T')[0];
        openModal(`
            <h3>Tạo hóa đơn bán hàng</h3>
            <label>Sản phẩm</label><input id="sale-product" />
            <label>Số lượng</label><input id="sale-qty" type="number" />
            <label>Giá bán</label><input id="sale-price" type="number" />
            <label>Nhân viên bán</label><input id="sale-seller" />
            <label>Ngày bán</label><input id="sale-date" type="date" value="${today}" />
            <div class="modal-actions"><button data-action="save-sale" class="btn">Lập hóa đơn</button><button data-action="close" class="btn cancel">Hủy</button></div>
        `);
    });

    // Initial render
    refreshAll();
});