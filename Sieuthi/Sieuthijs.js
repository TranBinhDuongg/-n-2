// Sieuthi.js - Đại lý Management
let currentUser = null;

// Load user from session
function loadCurrentUser() {
    const stored = sessionStorage.getItem('currentUser');
    if (!stored) {
        // No user logged in - redirect or show login
        return null;
    }
    currentUser = JSON.parse(stored);
    return currentUser;
}

// Storage helpers
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

// Database
const DB = {
    phieuNhap: [],
    kho: [],
    kiemDinh: [],
    lohang: JSON.parse(localStorage.getItem('lohang') || '[]'),
    nongdan: JSON.parse(localStorage.getItem('nongdan') || '[]')
};

function loadDB() {
    DB.phieuNhap = loadUserData('phieuNhap');
    DB.kho = loadUserData('kho');
    DB.kiemDinh = loadUserData('kiemDinh');
}

function saveDB() {
    saveUserData('phieuNhap', DB.phieuNhap);
    saveUserData('kho', DB.kho);
    saveUserData('kiemDinh', DB.kiemDinh);
    localStorage.setItem('lohang', JSON.stringify(DB.lohang));
    localStorage.setItem('nongdan', JSON.stringify(DB.nongdan));
}



// Get or create modal (nếu không có trong HTML thì tạo)
let modal = document.getElementById('modal');
let modalBody = document.getElementById('modal-body');

if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal';
    modal.className = 'modal hidden';
    modal.innerHTML = '<div class="modal-content"><span class="modal-close">&times;</span><div id="modal-body"></div></div>';
    document.body.appendChild(modal);
    modalBody = document.getElementById('modal-body');
}

function renderTable(sel, data, fn) {
    const tb = document.querySelector(sel + ' tbody');
    if (!tb) return;
    tb.innerHTML = '';
    data.forEach((r, i) => { const tr = document.createElement('tr'); tr.innerHTML = fn(r, i); tb.appendChild(tr); });
}

function renderAll() {
    // Dashboard tables
    renderTable('#table-orders', DB.phieuNhap.slice(-5), p => `
        <td>${p.maPhieu}</td><td>${p.maLo}</td><td>${p.soLuong}</td><td>${p.khoNhap}</td><td>${p.ngayNhap}</td>`);
    
    renderTable('#table-quality-alerts', DB.kiemDinh.slice(-5), q => `
        <td>${q.maKiemDinh}</td><td>${q.maLo}</td><td>${q.ngayKiem}</td><td>${q.ketQua}</td>`);
    
    // Orders page
    renderTable('#table-orders-all', DB.phieuNhap, p => `
        <td>${p.maPhieu}</td><td>${p.maLo}</td><td>${p.soLuong}</td>
        <td>${p.tenNong}</td><td>${p.khoNhap}</td><td>${p.ngayNhap}</td>
        <td><button onclick="editPhieu('${p.maPhieu}')">Sửa</button><button onclick="deletePhieu('${p.maPhieu}')">Xóa</button></td>`);
    
    // Inventory
    renderTable('#table-kho', DB.kho, k => `
        <td>${k.maKho}</td><td>${k.tenKho}</td><td>${k.diaChi}</td><td>${k.soDienThoai}</td>
        <td><button onclick="editKho('${k.maKho}')">Sửa</button><button onclick="deleteKho('${k.maKho}')">Xóa</button></td>`);
    
    // Quality
    renderTable('#table-quality', DB.kiemDinh, q => `
        <td>${q.maKiemDinh}</td><td>${q.maLo}</td><td>${q.ngayKiem}</td>
        <td>${q.ketQua}</td><td>${q.ghiChu}</td>
        <td><button onclick="editQuality('${q.maKiemDinh}')">Sửa</button><button onclick="deleteQuality('${q.maKiemDinh}')">Xóa</button></td>`);
    
    // Update KPIs
    const kpi = document.getElementById('kpi-orders');
    if (kpi) kpi.textContent = DB.phieuNhap.length;
    const kpi2 = document.getElementById('kpi-inventory');
    if (kpi2) kpi2.textContent = DB.kho.length;
    const kpi3 = document.getElementById('kpi-quality');
    if (kpi3) kpi3.textContent = DB.kiemDinh.length;
}

// Modal
function openModal(html) { modalBody.innerHTML = html; modal.classList.remove('hidden'); }
function closeModal() { modal.classList.add('hidden'); modalBody.innerHTML = ''; }

document.querySelector('.modal-close')?.addEventListener('click', closeModal);
modal.addEventListener('click', e => e.target === modal && closeModal());

// Phiếu nhập
window.editPhieu = function(id) {
    const p = DB.phieuNhap.find(x => x.maPhieu === id);
    if (!p) return;
    openModal(`<h3>Sửa phiếu nhập</h3>
        <label>Mã phiếu</label><input id="mp" value="${p.maPhieu}" />
        <label>Mã lô</label><input id="ml" value="${p.maLo}" />
        <label>Sản phẩm</label><input id="sp" value="${p.sanPham}" />
        <label>Số lượng</label><input id="sl" type="number" value="${p.soLuong}" />
        <label>Nông dân</label><input id="tn" value="${p.tenNong}" />
        <label>Kho</label><input id="kh" value="${p.khoNhap}" />
        <label>Ngày</label><input id="ng" type="date" value="${p.ngayNhap}" />
        <button onclick="savePhieu('${id}')">Lưu</button><button onclick="closeModal()">Hủy</button>`);
};

window.savePhieu = function(id) {
    const p = DB.phieuNhap.find(x => x.maPhieu === id);
    if (!p) return;
    p.maPhieu = document.getElementById('mp').value;
    p.maLo = document.getElementById('ml').value;
    p.sanPham = document.getElementById('sp').value;
    p.soLuong = parseInt(document.getElementById('sl').value);
    p.tenNong = document.getElementById('tn').value;
    p.khoNhap = document.getElementById('kh').value;
    p.ngayNhap = document.getElementById('ng').value;
    saveDB();
    renderAll();
    closeModal();
};

window.deletePhieu = function(id) {
    if (!confirm('Xóa phiếu?')) return;
    DB.phieuNhap = DB.phieuNhap.filter(x => x.maPhieu !== id);
    saveDB();
    renderAll();
};

// Kho
window.editKho = function(id) {
    const k = DB.kho.find(x => x.maKho === id);
    if (!k) return;
    openModal(`<h3>Sửa kho</h3>
        <label>Mã kho</label><input id="mk" value="${k.maKho}" />
        <label>Tên</label><input id="tk" value="${k.tenKho}" />
        <label>Địa chỉ</label><input id="dc" value="${k.diaChi}" />
        <label>SĐT</label><input id="sd" value="${k.soDienThoai}" />
        <button onclick="saveKho('${id}')">Lưu</button><button onclick="closeModal()">Hủy</button>`);
};

window.saveKho = function(id) {
    const k = DB.kho.find(x => x.maKho === id);
    if (!k) return;
    k.maKho = document.getElementById('mk').value;
    k.tenKho = document.getElementById('tk').value;
    k.diaChi = document.getElementById('dc').value;
    k.soDienThoai = document.getElementById('sd').value;
    saveDB();
    renderAll();
    closeModal();
};

window.deleteKho = function(id) {
    if (!confirm('Xóa kho?')) return;
    DB.kho = DB.kho.filter(x => x.maKho !== id);
    saveDB();
    renderAll();
};

// Kiểm định
window.editQuality = function(id) {
    const q = DB.kiemDinh.find(x => x.maKiemDinh === id);
    if (!q) return;
    openModal(`<h3>Sửa kiểm định</h3>
        <label>Mã</label><input id="mkd" value="${q.maKiemDinh}" />
        <label>Mã lô</label><input id="ml2" value="${q.maLo}" />
        <label>Ngày</label><input id="nk" type="date" value="${q.ngayKiem}" />
        <label>Người</label><input id="nk2" value="${q.nguoiKiem}" />
        <label>Kết quả</label><select id="kq"><option ${q.ketQua==='Đạt'?'selected':''}>Đạt</option><option>Không</option></select>
        <label>Ghi chú</label><input id="gc" value="${q.ghiChu}" />
        <button onclick="saveQuality('${id}')">Lưu</button><button onclick="closeModal()">Hủy</button>`);
};

window.saveQuality = function(id) {
    const q = DB.kiemDinh.find(x => x.maKiemDinh === id);
    if (!q) return;
    q.maKiemDinh = document.getElementById('mkd').value;
    q.maLo = document.getElementById('ml2').value;
    q.ngayKiem = document.getElementById('nk').value;
    q.nguoiKiem = document.getElementById('nk2').value;
    q.ketQua = document.getElementById('kq').value;
    q.ghiChu = document.getElementById('gc').value;
    saveDB();
    renderAll();
    closeModal();
};

window.deleteQuality = function(id) {
    if (!confirm('Xóa kiểm định?')) return;
    DB.kiemDinh = DB.kiemDinh.filter(x => x.maKiemDinh !== id);
    saveDB();
    renderAll();
};

// Create new
document.getElementById('btn-create-order')?.addEventListener('click', () => {
    openModal(`<h3>Phiếu mới</h3>
        <label>Mã</label><input id="mp" placeholder="PN..." />
        <label>Mã lô</label><input id="ml" />
        <label>Sản phẩm</label><input id="sp" />
        <label>Số lượng</label><input id="sl" type="number" />
        <label>Nông dân</label><input id="tn" />
        <label>Kho</label><input id="kh" />
        <label>Ngày</label><input id="ng" type="date" />
        <button onclick="addPhieu()">Thêm</button><button onclick="closeModal()">Hủy</button>`);
});

window.addPhieu = function() {
    DB.phieuNhap.push({
        maPhieu: document.getElementById('mp').value,
        maLo: document.getElementById('ml').value,
        sanPham: document.getElementById('sp').value,
        soLuong: parseInt(document.getElementById('sl').value),
        tenNong: document.getElementById('tn').value,
        khoNhap: document.getElementById('kh').value,
        ngayNhap: document.getElementById('ng').value
    });
    saveDB();
    renderAll();
    closeModal();
};

document.getElementById('btn-add-nhap-hang')?.addEventListener('click', () => {
    openModal(`<h3>Kho mới</h3>
        <label>Mã kho</label><input id="mk" placeholder="KHO..." />
        <label>Tên</label><input id="tk" />
        <label>Địa chỉ</label><input id="dc" />
        <label>SĐT</label><input id="sd" />
        <button onclick="addKho()">Thêm</button><button onclick="closeModal()">Hủy</button>`);
});

window.addKho = function() {
    DB.kho.push({
        maKho: document.getElementById('mk').value,
        tenKho: document.getElementById('tk').value,
        diaChi: document.getElementById('dc').value,
        soDienThoai: document.getElementById('sd').value
    });
    saveDB();
    renderAll();
    closeModal();
};

document.getElementById('btn-create-quality')?.addEventListener('click', () => {
    openModal(`<h3>Kiểm định mới</h3>
        <label>Mã</label><input id="mkd" placeholder="KD..." />
        <label>Mã lô</label><input id="ml2" />
        <label>Ngày</label><input id="nk" type="date" />
        <label>Người</label><input id="nk2" />
        <label>Kết quả</label><select id="kq"><option>Đạt</option><option>Không</option></select>
        <label>Ghi chú</label><input id="gc" />
        <button onclick="addQuality()">Thêm</button><button onclick="closeModal()">Hủy</button>`);
});

window.addQuality = function() {
    DB.kiemDinh.push({
        maKiemDinh: document.getElementById('mkd').value,
        maLo: document.getElementById('ml2').value,
        ngayKiem: document.getElementById('nk').value,
        nguoiKiem: document.getElementById('nk2').value,
        ketQua: document.getElementById('kq').value,
        ghiChu: document.getElementById('gc').value
    });
    saveDB();
    renderAll();
    closeModal();
};

// Menu navigation - FIX: use [data-section] selector like Nongdan & Daily
document.querySelectorAll('.menu-link[data-section]').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.menu-link[data-section]').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active-page'));
        link.classList.add('active');
        const section = link.dataset.section;
        document.getElementById(section)?.classList.add('active-page');
    });
});

// Init - Must call refreshAll() like Daily & Nongdan
window.addEventListener('DOMContentLoaded', () => {
    loadCurrentUser();
    loadDB();
    const user = document.getElementById('current-user');
    if (user && currentUser) user.innerHTML = `<strong>${currentUser.fullName}</strong>`;
    refreshAll();
});

// Refresh all data & renders (like Daily & Nongdan)
function refreshAll() {
    renderAll();
}

