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

// Database (simplified for new supermarket app)
const DB = {
    orders: loadUserData('orders') || [],       // orders created by this supermarket
    kho: loadUserData('kho') || [],             // supermarket's warehouses
    lohang: loadUserData('lohang') || [],       // per-supermarket batches
    kiemDinh: loadUserData('kiemDinh') || []    // per-supermarket quality checks
};

function loadDB() {
    DB.orders = loadUserData('orders') || [];
    DB.kho = loadUserData('kho') || [];
    DB.lohang = loadUserData('lohang') || [];
    DB.kiemDinh = loadUserData('kiemDinh') || [];
}

function saveDB() {
    saveUserData('orders', DB.orders || []);
    saveUserData('kho', DB.kho || []);
    saveUserData('lohang', DB.lohang || []);
    saveUserData('kiemDinh', DB.kiemDinh || []);
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
    renderOrders();
    renderIncoming();
    renderInventory();
    renderReports();
}

function renderOrders() {
    renderTable('#table-orders-all', DB.orders || [], o => `
        <td>${o.maPhieu}</td><td>${o.sanPham}</td><td>${o.soLuong}</td><td>${o.toDaily || o.toDailyAgency || ''}</td><td>${o.ngayTao || ''}</td><td>${o.status || ''}</td>
        <td>${o.status==='pending'?`<button onclick="cancelOrder('${o.uid}')">Hủy</button>`:''}</td>`);
}

function renderIncoming() {
    try {
        const all = JSON.parse(localStorage.getItem('retail_orders') || '[]');
        const mine = all.filter(m => (String(m.toSieuthiId) === String(currentUser?.id) || String(m.toSieuthi) === String(currentUser?.id) || String(m.toSieuthi) === String(currentUser?.fullName)));
        renderTable('#table-incoming', mine, m => `
            <td>${m.maPhieu}</td><td>${m.maLo} — ${m.sanPham||''}</td><td>${m.soLuong}</td><td>${m.toDaily||''}</td><td>${m.ngayTao||''}</td><td>${m.status||''}</td>
            <td>${m.status!=='received'?`<button onclick="markRetailOrderReceived('${m.uid}')">Đã nhận</button>`:''}</td>`);
    } catch (e) { console.warn(e); }
}

function markRetailOrderReceived(uid) {
    const all = JSON.parse(localStorage.getItem('retail_orders') || '[]');
    const idx = all.findIndex(x => x.uid === uid);
    if (idx === -1) return;
    all[idx].status = 'received';
    localStorage.setItem('retail_orders', JSON.stringify(all));
    const p = all[idx];
    DB.lohang = DB.lohang || [];
    DB.lohang.push({ maLo: p.maLo, sanPham: p.sanPham, soLuong: parseFloat(p.soLuong)||0, ngayTao: new Date().toLocaleString() });
    saveDB();
    renderAll();
}

function cancelOrder(uid) {
    DB.orders = DB.orders || [];
    const idx = DB.orders.findIndex(o => o.uid === uid);
    if (idx !== -1) { DB.orders.splice(idx,1); saveDB(); }
    const all = JSON.parse(localStorage.getItem('retail_orders') || '[]');
    const idx2 = all.findIndex(a => a.uid === uid);
    if (idx2 !== -1) { all.splice(idx2,1); localStorage.setItem('retail_orders', JSON.stringify(all)); }
    renderAll();
}

function renderReports() {
    // nhập kho = total received from retail_orders addressed to this sieuthi
    const allRetail = JSON.parse(localStorage.getItem('retail_orders') || '[]');
    const incoming = allRetail.filter(r => r.status === 'received' && (String(r.toSieuthiId) === String(currentUser?.id) || String(r.toSieuthi) === String(currentUser?.id) || String(r.toSieuthi) === String(currentUser?.fullName))).reduce((s,r)=>s+(parseFloat(r.soLuong)||0),0);
    // tồn kho = sum of batches in this supermarket
    const stock = (DB.lohang || []).reduce((s,b)=>s+(parseFloat(b.soLuong)||0),0);
    // chất lượng = counts of kiemDinh; also show non-conforming count
    const totalChecks = (DB.kiemDinh || []).length;
    const notOk = (DB.kiemDinh || []).filter(k=>k.ketQua && k.ketQua.toLowerCase().includes('không')).length;

    document.getElementById('report-production').textContent = incoming + ' đơn vị';
    document.getElementById('report-received').textContent = stock + ' đơn vị';
    document.getElementById('report-stock').textContent = `${stock} đơn vị`;
    const qEl = document.getElementById('report-quality');
    if (qEl) qEl.textContent = `${totalChecks} kiểm định (${notOk} không đạt)`;
}

function renderInventory() {
    renderTable('#table-inventory', DB.lohang || [], b => `
        <td>${b.maLo}</td><td>${b.sanPham||''}</td><td>${b.soLuong||0}</td><td>${b.ngayTao||''}</td>
        <td>${`<button onclick="editBatch('${b.maLo}')">Sửa</button> <button onclick="deleteBatch('${b.maLo}')">Xóa</button>`}</td>`);
}



// Modal
function openModal(html) { modalBody.innerHTML = html; modal.classList.remove('hidden'); }
function closeModal() { modal.classList.add('hidden'); modalBody.innerHTML = ''; }

document.querySelector('.modal-close')?.addEventListener('click', closeModal);
modal.addEventListener('click', e => e.target === modal && closeModal());

// Quality modal
document.getElementById('btn-create-quality')?.addEventListener('click', ()=>{
    openModal(`<h3>Thêm phiếu kiểm định</h3>
        <label>Mã kiểm định</label><input id="q_ma" />
        <label>Mã lô</label><input id="q_lo" />
        <label>Ngày kiểm</label><input id="q_ngay" type="date" />
        <label>Người kiểm</label><input id="q_nguoi" />
        <label>Kết quả</label><select id="q_ket"><option>Đạt</option><option>Không đạt</option></select>
        <label>Ghi chú</label><input id="q_gc" />
        <div style="margin-top:12px"><button onclick="addQuality()">Lưu</button><button onclick="closeModal()">Hủy</button></div>`);
});

window.addQuality = function() {
    const q = { maKiemDinh: document.getElementById('q_ma').value || 'KD' + Date.now(), maLo: document.getElementById('q_lo').value, ngayKiem: document.getElementById('q_ngay').value || new Date().toLocaleDateString(), nguoiKiem: document.getElementById('q_nguoi').value, ketQua: document.getElementById('q_ket').value, ghiChu: document.getElementById('q_gc').value };
    DB.kiemDinh = DB.kiemDinh || [];
    DB.kiemDinh.push(q);
    saveDB();
    renderReports();
    closeModal();
};

// Create Order - simplified modal and handlers for new supermarket app
document.getElementById('btn-create-order')?.addEventListener('click', () => {
    openModal(`<h3>Đơn đặt hàng mới</h3>
        <label>Mã lô</label><input id="input-maLo" placeholder="ML..." />
        <label>Sản phẩm</label><select id="select-sanpham"><option value="">--Chọn sản phẩm--</option></select>
        <label>Số lượng</label><input id="input-soLuong" type="number" />
        <label>Kho nhận</label><select id="select-kho"><option value="">--Chọn kho--</option></select>
        <label>Gửi tới đại lý/đại lý</label><input id="input-toDaily" placeholder="Tên đại lý..." />
        <div style="margin-top:8px"><button onclick="addPhieu()">Thêm</button><button onclick="closeModal()">Hủy</button></div>`);
    populateOrderModalSelects();
});

function populateOrderModalSelects() {
    // fill products from lohang
    const sel = document.getElementById('select-sanpham');
    const skl = document.getElementById('select-kho');
    if (sel) {
        const prods = Array.from(new Set((DB.lohang||[]).map(b => b.sanPham).filter(Boolean)));
        sel.innerHTML = '<option value="">--Chọn sản phẩm--</option>' + prods.map(p=>`<option>${p}</option>`).join('');
    }
    if (skl) {
        const khs = (DB.kho||[]).map(k=>k.tenKho||k.maKho||'').filter(Boolean);
        skl.innerHTML = '<option value="">--Chọn kho--</option>' + khs.map(k=>`<option>${k}</option>`).join('');
    }
}

window.addPhieu = function() {
    const maLo = document.getElementById('input-maLo')?.value;
    const soLuong = document.getElementById('input-soLuong')?.value;
    const sanPham = document.getElementById('select-sanpham')?.value;
    const kho = document.getElementById('select-kho')?.value;
    const toDaily = document.getElementById('input-toDaily')?.value;
    if (!maLo || !soLuong || !sanPham) { alert('Vui lòng nhập đầy đủ Mã lô, sản phẩm và số lượng'); return; }
    const uid = 'R' + Date.now();
    const p = { uid, maPhieu: uid, maLo, sanPham, soLuong: parseFloat(soLuong)||0, khoNhap: kho, toDaily, fromSieuthiId: currentUser?.id, status: 'pending', ngayTao: new Date().toLocaleString() };
    DB.orders = DB.orders || [];
    DB.orders.push(p);
    saveDB();
    // broadcast to retail_orders channel
    const retail = JSON.parse(localStorage.getItem('retail_orders') || '[]');
    retail.push(Object.assign({}, p));
    localStorage.setItem('retail_orders', JSON.stringify(retail));
    renderAll();
    closeModal();
};

// Batch edit/delete simple handlers
window.editBatch = function(maLo) {
    const b = (DB.lohang||[]).find(x=>x.maLo===maLo);
    if (!b) return;
    openModal(`<h3>Sửa lô</h3>
        <label>Mã lô</label><input id="bl_maLo" value="${b.maLo}" />
        <label>Sản phẩm</label><input id="bl_sp" value="${b.sanPham||''}" />
        <label>Số lượng</label><input id="bl_sl" type="number" value="${b.soLuong||0}" />
        <div style="margin-top:8px"><button onclick="saveBatch('${maLo}')">Lưu</button><button onclick="closeModal()">Hủy</button></div>`);
};

window.saveBatch = function(oldMaLo) {
    const b = (DB.lohang||[]).find(x=>x.maLo===oldMaLo);
    if (!b) return;
    b.maLo = document.getElementById('bl_maLo').value;
    b.sanPham = document.getElementById('bl_sp').value;
    b.soLuong = parseFloat(document.getElementById('bl_sl').value)||0;
    saveDB(); renderAll(); closeModal();
};

window.deleteBatch = function(maLo) {
    if (!confirm('Xóa lô hàng?')) return;
    DB.lohang = (DB.lohang||[]).filter(x=>x.maLo!==maLo);
    saveDB(); renderAll();
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