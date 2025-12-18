// ========== LOCALSTORAGE HELPERS (Per-user isolation - Same as Nongdan.js) ==========
let currentUser = null;

function loadCurrentUser() {
    const stored = sessionStorage.getItem('currentUser');
    if (!stored) {
        // redirect to login if no user session
        window.location.href = '/Dangnhap/Dangnhap.html';
        return null;
    }
    currentUser = JSON.parse(stored);
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

// ========== DATABASE STRUCTURE ==========
const DB = {
    nongdan: JSON.parse(localStorage.getItem('nongdan') || '[]'),      
    lohang: JSON.parse(localStorage.getItem('lohang') || '[]'),        
    phieuNhap: [],  // Will be loaded per-user
    kho: [],        // Will be loaded per-user
    kiemDinh: [],   // Will be loaded per-user
    dailyAgencies: JSON.parse(localStorage.getItem('dailyAgencies') || '[]'), // Shared
};

function loadDB() {
    DB.phieuNhap = loadUserData('phieuNhap');
    DB.kho = loadUserData('kho');
    DB.kiemDinh = loadUserData('kiemDinh');
}

// Clear old non-per-user data that may have been stored with old format
function clearOldDataFormat() {
    // Remove old keys that don't follow per-user format
    const oldKeys = ['phieuNhap', 'kho', 'kiemDinh'];
    oldKeys.forEach(key => {
        // Only clear if it looks like old shared format (not per-user)
        const value = localStorage.getItem(key);
        if (value && !value.startsWith('[]')) {
            // Check if this is the old format by seeing if it doesn't match per-user pattern
            try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) {
                    localStorage.removeItem(key);
                }
            } catch (e) {
                // ignore parse errors
            }
        }
    });
}

function saveDB() {
    // Save per-user data with user_${id}_ prefix
    saveUserData('phieuNhap', DB.phieuNhap);
    saveUserData('kho', DB.kho);
    saveUserData('kiemDinh', DB.kiemDinh);
    
    // Save shared data globally
    localStorage.setItem('nongdan', JSON.stringify(DB.nongdan));
    localStorage.setItem('lohang', JSON.stringify(DB.lohang));
    localStorage.setItem('dailyAgencies', JSON.stringify(DB.dailyAgencies));
}

// Helper: Get warehouse name from code (maKho)
function getKhoName(maKho) {
    if (!maKho) return '';
    const kho = DB.kho.find(k => k.maKho === maKho);
    return kho ? kho.tenKho : maKho;
}

// Helper: interpret quality result as pass
function isKiemDinhPassed(kq) {
    if (!kq) return false;
    const v = String(kq).trim().toLowerCase();
    // remove diacritics to compare base letters
    const base = v.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    return base === 'dat' || base === 'pass' || base === 'passed' || base.includes('dat') || base.includes('pass');
}

function isStatusPending(s) {
    if (!s) return false;
    const v = String(s).trim().toLowerCase();
    const base = v.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    return base.includes('cho') || base.includes('pending') || base.includes('kiem');
}

// Render reports (statistics) based on current DB state
function renderReports() {
    // ensure DOM elements exist
    if (typeof document === 'undefined') return;
    const elOrders = document.getElementById('report-orders');
    const elShipped = document.getElementById('report-shipped');
    const elStock = document.getElementById('report-stock');
    const elQuality = document.getElementById('report-quality');
    // compute totals similar to Nongdan reports
    const totalReceived = (DB.phieuNhap || []).reduce((s, r) => s + (parseFloat(r.soLuong) || 0), 0);
    // shipped: count market orders that involve this daily (either sent from this daily or shipped to this daily)
    let marketAll = [];
    try { marketAll = JSON.parse(localStorage.getItem('market_orders') || '[]'); } catch (e) { marketAll = []; }
    const shippedFromDaily = marketAll.filter(m => String(m.fromDailyUserId) === String(currentUser?.id) && (String(m.status).toLowerCase().includes('ship') || String(m.status).toLowerCase().includes('xuất') || String(m.status).toLowerCase().includes('shipped')))
        .reduce((s, m) => s + (parseFloat(m.soLuong) || 0), 0);
    const shippedToDaily = marketAll.filter(m => String(m.toDailyAgency) === String(currentUser?.maDaiLy) && (String(m.status).toLowerCase().includes('ship') || String(m.status).toLowerCase().includes('xuất') || String(m.status).toLowerCase().includes('shipped')))
        .reduce((s, m) => s + (parseFloat(m.soLuong) || 0), 0);
    const totalShipped = shippedFromDaily + shippedToDaily;

    // current stock by batches
    const totalStock = (DB.lohang || []).reduce((s, b) => s + (parseFloat(b.soLuong) || 0), 0);

    const totalChecks = (DB.kiemDinh || []).length;
    const passed = (DB.kiemDinh || []).filter(k => (k.ketQua || '').toLowerCase() === 'đạt' || (k.ketQua || '').toLowerCase() === 'dat' || (k.ketQua || '').toLowerCase().includes('dat')).length;
    const passPercent = totalChecks ? Math.round((passed / totalChecks) * 100) : 0;

    if (elOrders) elOrders.textContent = totalReceived + ' đơn vị';
    if (elShipped) elShipped.textContent = totalShipped + ' đơn vị';
    if (elStock) elStock.textContent = totalStock + ' đơn vị';
    if (elQuality) elQuality.textContent = `${passed}/${totalChecks} (${passPercent}%)`;
}

// Seed sample data for development/demo - only seed shared data, per-user data seeded per user
function seedSampleData() {
    let changed = false;
    
    // Initialize shared data (global, not per-user)
    if (!Array.isArray(DB.dailyAgencies) || DB.dailyAgencies.length === 0) {
        DB.dailyAgencies = [
            { maDaiLy: 'DL001', tenDaiLy: 'Đại lý A', diaChi: 'Số 1, Phố Y', soDienThoai: '0243333333' },
            { maDaiLy: 'DL002', tenDaiLy: 'Đại lý B', diaChi: 'Số 2, Phố Z', soDienThoai: '0244444444' }
        ];
        changed = true;
    }
    
    if (!Array.isArray(DB.nongdan) || DB.nongdan.length === 0) {
        DB.nongdan = [
            { maNong: 'ND001', tenNong: 'Nguyễn Văn A', diaChi: 'Xã A, Huyện B', soDienThoai: '0912345678', email: 'a@example.com' },
            { maNong: 'ND002', tenNong: 'Trần Thị B', diaChi: 'Xã C, Huyện D', soDienThoai: '0987654321', email: 'b@example.com' }
        ];
        changed = true;
    }

    if (!Array.isArray(DB.lohang) || DB.lohang.length === 0) {
        DB.lohang = [
            { maLo: 'LO1001', sanPham: 'Gạo thơm', maNong: 'ND001', soLuong: 500, ngayTao: '2025-11-01', hanDung: '2026-05-01' },
            { maLo: 'LO1002', sanPham: 'Rau sạch', maNong: 'ND002', soLuong: 200, ngayTao: '2025-11-15', hanDung: '2025-12-15' }
        ];
        changed = true;
    }  

    // Seed per-user data based on currentUser.id
    if (DB.kho.length === 0) {
        if (currentUser?.maDaiLy === 'DL001') {
            DB.kho = [
                { maKho: 'KHO001', tenKho: 'Kho Trung Tâm DL001', diaChi: 'Hà Nội', soDienThoai: '0241234567', maDaiLy: 'DL001' },
                { maKho: 'KHO002', tenKho: 'Kho Nhánh DL001', diaChi: 'Hải Phòng', soDienThoai: '0241234568', maDaiLy: 'DL001' }
            ];
        } else if (currentUser?.maDaiLy === 'DL002') {
            DB.kho = [
                { maKho: 'KHO003', tenKho: 'Kho Trung Tâm DL002', diaChi: 'Hồ Chí Minh', soDienThoai: '0281234567', maDaiLy: 'DL002' }
            ];
        }
        changed = true;
    }
  
    if (DB.phieuNhap.length === 0) {
        if (currentUser?.maDaiLy === 'DL001') {
            DB.phieuNhap = [
                { maPhieu: 'PN2025001', maLo: 'LO1001', maNong: 'ND001', tenNong: 'Nguyễn Văn A', sanPham: 'Gạo thơm', soLuong: 100, khoNhap: 'KHO001', ngayNhap: '2025-11-20', ghiChu: 'Lô đầu mùa', status: 'Đã nhập' },
                { maPhieu: 'PN2025002', maLo: 'LO1002', maNong: 'ND002', tenNong: 'Trần Thị B', sanPham: 'Rau sạch', soLuong: 50, khoNhap: 'KHO002', ngayNhap: '2025-11-25', ghiChu: 'Hàng tươi', status: 'Đã nhập' }
            ];
        } else if (currentUser?.maDaiLy === 'DL002') {
            DB.phieuNhap = [
                { maPhieu: 'PN2025003', maLo: 'LO1001', maNong: 'ND001', tenNong: 'Nguyễn Văn A', sanPham: 'Gạo thơm', soLuong: 200, khoNhap: 'KHO003', ngayNhap: '2025-11-22', ghiChu: 'Lô từ HN', status: 'Đã nhập' }
            ];
        }
        changed = true;
    }

    if (DB.kiemDinh.length === 0) {
        if (currentUser?.maDaiLy === 'DL001') {
            DB.kiemDinh = [
                { maKiemDinh: 'KD2025001', maLo: 'LO1001', ngayKiem: '2025-11-21', nguoiKiem: 'Kỹ thuật viên A', ketQua: 'Đạt', ghiChu: 'Đạt tiêu chuẩn' },
                { maKiemDinh: 'KD2025002', maLo: 'LO1002', ngayKiem: '2025-11-26', nguoiKiem: 'Kỹ thuật viên B', ketQua: 'Đạt', ghiChu: 'Chất lượng tốt' }
            ];
        } else if (currentUser?.maDaiLy === 'DL002') {
            DB.kiemDinh = [
                { maKiemDinh: 'KD2025003', maLo: 'LO1001', ngayKiem: '2025-11-23', nguoiKiem: 'Kỹ thuật viên C', ketQua: 'Đạt', ghiChu: 'Hợp chuẩn' }
            ];
        }
        changed = true;
    }

    

    if (changed) saveDB();
}

// Adjust stock levels in `DB.lohang` when receipts or shipments occur.
// `delta` is positive to increase stock (nhập), negative to decrease (xuất).
function adjustStockOnReceipt(receipt, delta) {
    if (!receipt || !receipt.maLo) return;
    const amt = parseFloat(delta) || 0;
    const lo = (DB.lohang || []).find(l => l.maLo === receipt.maLo);
    if (lo) {
        lo.soLuong = (parseFloat(lo.soLuong) || 0) + amt;
        if (lo.soLuong < 0) lo.soLuong = 0;
    } else if (amt > 0) {
        // create a minimal lohang record when receiving into a new batch
        DB.lohang.push({
            maLo: receipt.maLo,
            sanPham: receipt.sanPham || '',
            maNong: receipt.maNong || '',
            soLuong: amt,
            ngayTao: receipt.ngayNhap || new Date().toLocaleDateString(),
            hanDung: ''
        });
    }
}

// Render inventory table from `DB.lohang` (tồn kho by batch)
function renderInventory() {
    const tbody = document.querySelector('#table-inventory tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    (DB.lohang || []).forEach(l => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${l.maLo}</td>
            <td>${l.sanPham || ''}</td>
            <td>${l.soLuong || 0}</td>
            <td>${l.ngayTao || ''}</td>
            <td>${(l.soLuong || 0) > 0 ? 'Còn hàng' : 'Hết'}</td>
            <td>
                <button class="btn small" onclick="editLohang('${l.maLo}')">Sửa</button>
                <button class="btn small" onclick="deleteLohang('${l.maLo}')">Xóa</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.deleteLohang = function(maLo) {
    if (!confirm('Xác nhận xóa lô hàng?')) return;
    DB.lohang = (DB.lohang || []).filter(x => x.maLo !== maLo);
    saveDB();
    renderInventory();
};

window.editLohang = function(maLo) {
    const lo = (DB.lohang || []).find(x => x.maLo === maLo);
    if (!lo) return;
    const soLuongMoi = prompt('Nhập số lượng mới:', lo.soLuong);
    if (soLuongMoi !== null) {
        lo.soLuong = parseInt(soLuongMoi) || 0;
        saveDB();
        renderInventory();
    }
};

// Open edit modal for an existing receipt (phiếu nhập)
function openEditReceipt(maPhieu) {
    const rec = (DB.phieuNhap || []).find(r => r.maPhieu === maPhieu);
    if (!rec) return;
    openModalWithTemplate('create-order-template');
    setTimeout(() => {
        const form = modalBody.querySelector('#createOrderFormModal');
        if (!form) return;
        form.orderId.value = rec.maPhieu || '';
        form.batchCode.value = rec.maLo || '';
        form.quantity.value = rec.soLuong || '';

        const farmerSelect = modalBody.querySelector('select[name="farmerId"]');
        const fromManual = modalBody.querySelector('input[name="fromAddressManual"]');
        const productSelect = modalBody.querySelector('select[name="product"]');
        const productManual = modalBody.querySelector('input[name="productManual"]');

        if (farmerSelect) {
            // try to set farmer if exists, otherwise set manual
            const opt = Array.from(farmerSelect.options).find(o => o.value === rec.maNong);
            if (opt) { farmerSelect.value = rec.maNong; fromManual.style.display = 'none'; }
            else { farmerSelect.value = 'manual'; fromManual.style.display = 'block'; fromManual.value = rec.tenNong || ''; }
            // trigger change to populate product list
            farmerSelect.dispatchEvent(new Event('change'));
        }

        if (productSelect) {
            const pOpt = Array.from(productSelect.options).find(o => o.value === rec.sanPham);
            if (pOpt) { productSelect.value = rec.sanPham; productManual.style.display = 'none'; }
            else { productSelect.value = 'manual'; productManual.style.display = 'block'; productManual.value = rec.sanPham || ''; }
        }

        form.toAddress.value = rec.khoNhap || '';
        form.date.value = rec.ngayNhap || '';
        form.ghichu.value = rec.ghiChu || '';

        form.onsubmit = (ev) => {
            ev.preventDefault();
            const f = new FormData(form);
            const newQty = parseInt(f.get('quantity') || '0', 10) || 0;
            const oldQty = parseInt(rec.soLuong || '0', 10) || 0;
            const delta = newQty - oldQty;

            // update receipt fields
            rec.maPhieu = f.get('orderId') || rec.maPhieu;
            rec.maLo = f.get('batchCode') || rec.maLo;
            rec.maNong = f.get('farmerId') || rec.maNong;
            rec.tenNong = f.get('fromAddressManual') || rec.tenNong;
            rec.sanPham = (f.get('product') === 'manual') ? (f.get('productManual') || rec.sanPham) : (f.get('product') || rec.sanPham);
            rec.soLuong = newQty;
            rec.khoNhap = f.get('toAddress') || rec.khoNhap;
            rec.ngayNhap = f.get('date') || rec.ngayNhap;
            rec.ghiChu = f.get('ghichu') || rec.ghiChu;

            // apply stock delta and save
            adjustStockOnReceipt(rec, delta);
            saveDB();
            renderReceiptsFromDB();
            renderInventory();
            updateKPIs();
            closeModal();
            alert('Cập nhật phiếu: ' + rec.maPhieu);
        };
    }, 20);
}


document.querySelectorAll('.menu-link').forEach(btn => {
    btn.addEventListener('click', (e) => {
       
        document.querySelectorAll('.menu-link').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active-page'));
        
        btn.classList.add('active');
        const sectionId = btn.dataset.section;
        document.getElementById(sectionId).classList.add('active-page');
    });
});


const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');
const modalCloseBtn = document.querySelector('.modal-close');

function openModalWithTemplate(templateId) {
    const tpl = document.getElementById(templateId);
    if (!tpl) return;
    modalBody.innerHTML = '';
    modalBody.appendChild(tpl.content.cloneNode(true));
    // initialize form-specific UI after template is injected
    if (templateId === 'create-order-template') {
        try { initCreateOrderModal(); } catch (err) { console.warn('initCreateOrderModal error', err); }
    }
    modal.classList.remove('hidden');
}

function closeModal() {
    modal.classList.add('hidden');
    modalBody.innerHTML = '';
}

modalCloseBtn?.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

// Initialize the create-order modal: populate farmer and product selects from SQL schema
function initCreateOrderModal() {
    const farmerSelect = modalBody.querySelector('select[name="farmerId"]');
    const fromManual = modalBody.querySelector('input[name="fromAddressManual"]');
    const productSelect = modalBody.querySelector('select[name="product"]');
    const productManual = modalBody.querySelector('input[name="productManual"]');
    const khoSelect = modalBody.querySelector('select[name="toAddress"]');
    const dateInput = modalBody.querySelector('input[name="date"]');

    if (!farmerSelect || !productSelect) return;

    // Set today's date as default
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }

    // Get current agency from currentUser (logged-in user)
    const currentAgency = DB.dailyAgencies.find(a => a.maDaiLy === currentUser?.maDaiLy);
    
    // Populate kho (warehouses) from DB.kho - already filtered for current user
    if (khoSelect) {
        khoSelect.innerHTML = '<option value="">-- Chọn kho nhập --</option>';
        let khos = Array.isArray(DB.kho) ? DB.kho : [];
        
        khos.forEach(k => {
            const opt = document.createElement('option');
            opt.value = k.maKho;
            opt.textContent = k.tenKho + (k.diaChi ? ` (${k.diaChi})` : '');
            khoSelect.appendChild(opt);
        });
    }

    // Get farmers from registered users (only users with role 'nongdan')
    const allUsers = JSON.parse(localStorage.getItem('users') || '[]');
    const farmers = Array.isArray(allUsers) ? allUsers.filter(u => u.role === 'nongdan') : [];
    // Get batches from DB.lohang (SQL: LôHàng table with fields: maLo, sanPham, maNong, soLuong, etc.)
    const batches = Array.isArray(DB.lohang) ? DB.lohang : [];

    // Populate farmers from registered users
    farmerSelect.innerHTML = '<option value="">-- Chọn nông dân --</option>';
    if (farmers.length) {
        farmers.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.id;  // store user.id so we can target farmer by user id
            opt.textContent = f.fullName || f.hoTen || f.username || f.id;
            farmerSelect.appendChild(opt);
        });
        farmerSelect.appendChild(new Option('Khác (nhập tay)', 'manual'));
    } else {
        // no farmers available -> allow manual entry
        farmerSelect.innerHTML += '<option value="manual">Khác (nhập tay)</option>';
        fromManual.style.display = 'block';
    }

    // Initial state for product select
    productSelect.innerHTML = '<option value="">-- Chọn nông dân trước --</option>';
    productSelect.disabled = true;

    farmerSelect.addEventListener('change', () => {
        const fid = farmerSelect.value;
        if (!fid || fid === '') {
            // reset
            fromManual.style.display = 'none';
            productManual.style.display = 'none';
            productSelect.innerHTML = '<option value="">-- Chọn nông dân trước --</option>';
            productSelect.disabled = true;
            return;
        }

        if (fid === 'manual') {
            fromManual.style.display = 'block';
            productSelect.innerHTML = '<option value="manual">Khác (nhập tay)</option>';
            productSelect.disabled = true;
            productManual.style.display = 'block';
            return;
        }

        // selected a farmer id -> hide manual farmer input
        fromManual.style.display = 'none';
        productManual.style.display = 'none';

        // Find products associated with this farmer from LôHàng table.
        // Match by multiple identifiers because DB.lohang may use maNong codes (e.g. 'ND001')
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        const farmerUser = users.find(u => String(u.id) === String(fid));
        const ids = new Set();
        if (farmerUser) {
            if (farmerUser.maNong) ids.add(String(farmerUser.maNong));
            ids.add(String(farmerUser.id));
            if (farmerUser.username) ids.add(String(farmerUser.username));
            if (farmerUser.fullName) ids.add(String(farmerUser.fullName));
            if (farmerUser.hoTen) ids.add(String(farmerUser.hoTen));
        }

        // Fallback: try to map registered farmer user to DB.nongdan (seeded maNong codes)
        try {
            const ndList = Array.isArray(DB.nongdan) ? DB.nongdan : JSON.parse(localStorage.getItem('nongdan') || '[]');
            if (farmerUser && ndList.length) {
                const matchNd = ndList.find(n => {
                    if (!n) return false;
                    const ten = (n.tenNong || n.ten || '').toString();
                    return ten === farmerUser.fullName || ten === farmerUser.hoTen || ten.includes(farmerUser.fullName) || ten.includes(farmerUser.hoTen);
                });
                if (matchNd && matchNd.maNong) ids.add(String(matchNd.maNong));
            }
        } catch (e) { /* ignore */ }

        const prods = batches
            .filter(b => {
                const ownerId = String(b.maNong || b.farmId || '');
                if (ids.has(ownerId)) return true;
                // also match by farmName containing farmer name
                if (farmerUser && b.farmName && farmerUser.fullName && String(b.farmName).includes(farmerUser.fullName)) return true;
                if (farmerUser && b.farmName && farmerUser.hoTen && String(b.farmName).includes(farmerUser.hoTen)) return true;
                return false;
            })
            .map(b => b.sanPham || b.product)
            .filter(Boolean);
        const unique = [...new Set(prods)];

        // If no suggestions found, try direct lookup by maNong from DB.lohang using DB.nongdan mapping
        if (unique.length === 0 && farmerUser) {
            let fallbackProds = [];
            try {
                const ndList = Array.isArray(DB.nongdan) ? DB.nongdan : JSON.parse(localStorage.getItem('nongdan') || '[]');
                const matchNd = ndList.find(n => {
                    if (!n) return false;
                    const ten = (n.tenNong || n.ten || '').toString();
                    return ten === farmerUser.fullName || ten === farmerUser.hoTen || ten.includes(farmerUser.fullName) || ten.includes(farmerUser.hoTen);
                });
                if (matchNd && matchNd.maNong) {
                    fallbackProds = (batches || []).filter(b => String(b.maNong) === String(matchNd.maNong)).map(b => b.sanPham || b.product).filter(Boolean);
                }
            } catch (e) { /* ignore */ }
            if (fallbackProds.length) {
                const uniq2 = [...new Set(fallbackProds)];
                unique.push(...uniq2);
            }
        }
        productSelect.innerHTML = '';
        if (unique.length) {
            productSelect.appendChild(new Option('-- Chọn loại hàng --', ''));
            unique.forEach(p => productSelect.appendChild(new Option(p, p)));
            productSelect.appendChild(new Option('Khác (nhập tay)', 'manual'));
            productSelect.disabled = false;
            productManual.style.display = 'none';
        } else {
            // no product suggestions -> let user type
            productSelect.appendChild(new Option('Không có loại gợi ý', 'manual'));
            productSelect.disabled = true;
            productManual.style.display = 'block';
        }
    });
}

// ------------------ Warehouse (Kho) Management ------------------
function renderKho() {
    const tbody = document.querySelector('#table-kho tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    (DB.kho || []).forEach(k => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${k.maKho}</td><td>${k.tenKho}</td><td>${k.diaChi || ''}</td><td>${k.soDienThoai || ''}</td>
            <td><button class="btn small" onclick="editKho('${k.maKho}')">Sửa</button>
                <button class="btn small" onclick="deleteKho('${k.maKho}')">Xóa</button></td>`;
        tbody.appendChild(tr);
    });
}

window.editKho = function(maKho) {
    const kho = (DB.kho || []).find(k => k.maKho === maKho);
    openModalWithTemplate('warehouse-template');
    const form = modalBody.querySelector('#createKhoFormModal');
    if (!form || !kho) return;
    form.maKho.value = kho.maKho;
    form.tenKho.value = kho.tenKho || '';
    form.diaChi.value = kho.diaChi || '';
    form.soDienThoai.value = kho.soDienThoai || '';
    form.onsubmit = (e) => { e.preventDefault(); saveKho(kho.maKho); };
};

function saveKho(existingId = null) {
    const form = modalBody.querySelector('#createKhoFormModal');
    if (!form) return;
    const maKho = form.maKho.value || `KHO${Date.now()}`;
    const tenKho = form.tenKho.value;
    const diaChi = form.diaChi.value;
    const soDienThoai = form.soDienThoai.value;

    if (!tenKho) { alert('Vui lòng nhập tên kho'); return; }

    if (existingId) {
        const k = DB.kho.find(x => x.maKho === existingId);
        if (k) { k.tenKho = tenKho; k.diaChi = diaChi; k.soDienThoai = soDienThoai; }
    } else {
        DB.kho.push({ maKho, tenKho, diaChi, soDienThoai, maDaiLy: currentUser?.maDaiLy || 'DL001' });
    }
    saveDB();
    renderKho();
    closeModal();
}

window.deleteKho = function(maKho) {
    if (!confirm('Xác nhận xóa kho này?')) return;
    DB.kho = (DB.kho || []).filter(k => k.maKho !== maKho);
    saveDB();
    renderKho();
};

// Wire add warehouse button
document.getElementById('btn-add-nhap-hang')?.addEventListener('click', () => {
    openModalWithTemplate('warehouse-template');
    // attach handler for create
    setTimeout(() => {
        const form = modalBody.querySelector('#createKhoFormModal');
        if (form) {
            form.onsubmit = (e) => { e.preventDefault(); saveKho(); };
        }
    }, 10);
});

// Tab handling for Inventory page
// Import/Export tab switch removed — content displays are controlled by page navigation now.

// ------------------ Quality (Kiểm định) Management ------------------
// create DB.kiemDinh if not present
if (!Array.isArray(DB.kiemDinh)) DB.kiemDinh = JSON.parse(localStorage.getItem('kiemDinh') || '[]');

function saveKiemDinh(existingId = null) {
    const form = modalBody.querySelector('#createQualityFormModal');
    if (!form) return;
    const maKiemDinh = form.maKiemDinh.value || `KD${Date.now()}`;
    const maLo = form.maLo.value || '';
    const ngayKiem = form.ngayKiem.value || new Date().toLocaleDateString();
    const nguoiKiem = form.nguoiKiem.value || '';
    const ketQua = form.ketQua.value || '';
    const ghiChu = form.ghiChu.value || '';

    if (existingId) {
        const rec = DB.kiemDinh.find(x => x.maKiemDinh === existingId);
        if (rec) { rec.maLo = maLo; rec.ngayKiem = ngayKiem; rec.nguoiKiem = nguoiKiem; rec.ketQua = ketQua; rec.ghiChu = ghiChu; }
    } else {
        DB.kiemDinh.push({ maKiemDinh, maLo, ngayKiem, nguoiKiem, ketQua, ghiChu });
    }
    // persist
    saveDB();

    // If this quality check passed, only then increase stock for receipts linked to this batch
    const passed = isKiemDinhPassed(ketQua);
    const savedKD = DB.kiemDinh.find(x => x.maKiemDinh === maKiemDinh) || DB.kiemDinh[DB.kiemDinh.length - 1];

    // Find related receipts more robustly: match by maLo and pending-like status (accent-insensitive)
    let related = (DB.phieuNhap || []).filter(p => String(p.maLo) === String(maLo) && isStatusPending(p.status));
    // fallback: if none found by maLo, try to find any pending receipts for same maLo ignoring status wording
    if ((related || []).length === 0) {
        related = (DB.phieuNhap || []).filter(p => String(p.maLo) === String(maLo));
    }

    console.log('saveKiemDinh:', { maKiemDinh, maLo, ketQua, passed, relatedCount: (related || []).length });

    if (passed) {
        if (!related || related.length === 0) {
            console.warn('No related pending receipts found for maLo', maLo);
        }
        related.forEach(r => {
            const qty = parseFloat(r.soLuong) || 0;
            console.log('Applying stock increase for receipt', r.maPhieu, 'maLo', r.maLo, 'qty', qty);
            adjustStockOnReceipt(r, qty);
            r.status = 'Đã kiểm định';
        });
        saveDB();
        // refresh UI
        try { renderReceiptsFromDB(); } catch (e) {}
        try { renderInventory(); } catch (e) {}
        try { updateKPIs(); } catch (e) {}
    } else {
        related.forEach(r => { r.status = 'Không đạt - Chờ xử lý'; });
        saveDB();
        try { renderReceiptsFromDB(); } catch (e) {}
    }

    renderKiemDinh();
    closeModal();
}

function renderKiemDinh() {
    const tbody = document.querySelector('#table-quality tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    (DB.kiemDinh || []).forEach(k => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${k.maKiemDinh}</td><td>${k.maLo}</td><td>${k.ngayKiem}</td><td>${k.nguoiKiem}</td><td>${k.ketQua}</td><td>${k.ghiChu || ''}</td>
            <td><button class="btn small" onclick="editKiemDinh('${k.maKiemDinh}')">Kiểm định</button>
                <button class="btn small" onclick="deleteKiemDinh('${k.maKiemDinh}')">Xóa</button></td>`;
        tbody.appendChild(tr);
    });
}

window.editKiemDinh = function(maKiemDinh) {
    const rec = (DB.kiemDinh || []).find(x => x.maKiemDinh === maKiemDinh);
    if (!rec) return;
    openModalWithTemplate('quality-template');
    const form = modalBody.querySelector('#createQualityFormModal');
    if (!form) return;
    form.maKiemDinh.value = rec.maKiemDinh;
    form.maLo.value = rec.maLo || '';
    form.ngayKiem.value = rec.ngayKiem || '';
    form.nguoiKiem.value = rec.nguoiKiem || '';
    form.ketQua.value = rec.ketQua || '';
    form.ghiChu.value = rec.ghiChu || '';
    form.onsubmit = (e) => { e.preventDefault(); saveKiemDinh(rec.maKiemDinh); };
};

window.deleteKiemDinh = function(maKiemDinh) {
    if (!confirm('Xác nhận xóa phiếu kiểm định này?')) return;
    DB.kiemDinh = (DB.kiemDinh || []).filter(x => x.maKiemDinh !== maKiemDinh);
    saveDB();
    renderKiemDinh();
};

// Wire create quality button
document.getElementById('btn-create-quality')?.addEventListener('click', () => {
    openModalWithTemplate('quality-template');
    setTimeout(() => {
        const form = modalBody.querySelector('#createQualityFormModal');
        if (form) form.onsubmit = (e) => { e.preventDefault(); saveKiemDinh(); };
    }, 10);
});

// open create order modal from header/dashboard or orders page
document.querySelectorAll('#btn-create-order, #btn-new-order').forEach(btn => {
    btn?.addEventListener('click', () => openModalWithTemplate('create-order-template'));
});

// dashboard "Xuất hàng" quick button -> open export modal
// dashboard shipment quick button removed (export feature deleted)

// handle cancel inside injected form
document.addEventListener('click', (e) => {
    if (e.target?.classList?.contains('modal-close-btn')) closeModal();
});

// Helper to add a row and attach listeners
// Displays PhiếuNhậpHàng (Receipt) data with SQL schema fields
function addOrderRow(tableSelector, data) {
    const table = document.querySelector(tableSelector + ' tbody');
    if (!table) return;
    const tr = document.createElement('tr');
    
    // Build batch cell from maLo and sanPham
    const batchCell = data.maLo + (data.sanPham ? (' — ' + data.sanPham) : '');
    const tenNongDisplay = data.tenNong || data.fromAddress || '';
    
    tr.innerHTML = `
        <td>${data.maPhieu}</td>
        <td>${batchCell}</td>
        <td>${data.soLuong}</td>
        <td>${tenNongDisplay}</td>
        <td>${getKhoName(data.khoNhap)}</td>
        <td>${data.ngayNhap || new Date().toLocaleDateString()}</td>
        <td class="status-in-transit">${data.status || 'Đã tạo'}</td>
        <td>
            <button class="btn-edit">Sửa</button>
            <button class="btn-delete">Xóa</button>
        </td>
    `;
    table.prepend(tr);

    // attach listeners for the newly created buttons
    tr.querySelector('.btn-delete')?.addEventListener('click', (e) => {
        if (confirm('Bạn có chắc chắn muốn xóa?')) {
            const maPhieu = data.maPhieu;
            const removed = DB.phieuNhap.find(p => p.maPhieu === maPhieu);
            DB.phieuNhap = DB.phieuNhap.filter(p => p.maPhieu !== maPhieu);
            if (removed) {
                adjustStockOnReceipt(removed, - (parseFloat(removed.soLuong) || 0));
            }
            saveDB();
            tr.remove();
            // Update KPI
            const kpiEl = document.getElementById('kpi-orders');
            if (kpiEl) {
                const v = parseInt(kpiEl.textContent || '0', 10) || 0;
                kpiEl.textContent = Math.max(0, v - 1);
            }
            renderInventory();
            alert('Xóa thành công!');
        }
    });
    tr.querySelector('.btn-edit')?.addEventListener('click', () => {
        openEditReceipt(data.maPhieu);
    });
}

// Export feature removed: phieuXuat and related UI/handlers were deleted per request.

// Handle form submit for the modal create order form (delegated)
// Saves data according to SQL schema: PhiếuNhậpHàng (Receipt)
document.addEventListener('submit', (e) => {
    const form = e.target;
    if (form && form.id === 'createOrderFormModal') {
        e.preventDefault();
        const f = new FormData(form);
        
        // Extract farmer data (from registered users list)
        const farmerUserId = f.get('farmerId');
        let tenNong = '';
        if (farmerUserId && farmerUserId !== 'manual') {
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            const farmer = users.find(u => String(u.id) === String(farmerUserId));
            tenNong = farmer ? (farmer.fullName || farmer.hoTen || farmer.username || '') : '';
        }
        if (!tenNong) tenNong = f.get('fromAddressManual') || '';

        // Extract product (Sản phẩm from LôHàng)
        let sanPham = f.get('product');
        if (!sanPham || sanPham === 'manual') sanPham = f.get('productManual') || '';

        // SQL Schema: PhiếuNhậpHàng (Receipt) table structure
        const receipt = {
            maPhieu: f.get('orderId') || `PN${Date.now()}`,           // MãPhiếu (PK)
            maLo: f.get('batchCode') || '-',                          // MãLô (FK to LôHàng)
            maNongUserId: farmerUserId || '',                         // target farmer user id
            tenNong: tenNong,                                         // Farmer name (denorm)
            sanPham: sanPham,                                         // Sản phẩm (denorm)
            soLuong: parseInt(f.get('quantity') || '0'),              // SốLượng
            khoNhap: f.get('toAddress') || '',                        // KhoNhập (warehouse address)
            ngayNhap: f.get('date') || new Date().toLocaleDateString(),  // NgàyNhập
            ghiChu: f.get('ghichu') || '',                             // GhiChú (notes)
            status: 'Mới tạo'                                    // new receipt created
        };

        // Save to DB and localStorage (do NOT add to inventory until inspection passes)
        DB.phieuNhap.push(receipt);
        saveDB();

        // Add to main orders table and dashboard recent orders table
        addOrderRow('#table-orders-all', receipt);
        
        // Add to dashboard recent orders table (compact view)
        const dashTable = document.querySelector('#table-orders tbody');
        if (dashTable) {
            const tr = document.createElement('tr');
            const batchCell = receipt.maLo + (receipt.sanPham ? (' — ' + receipt.sanPham) : '');
            tr.innerHTML = `<td>${receipt.maPhieu}</td><td>${batchCell}</td><td>${receipt.soLuong}</td><td>${getKhoName(receipt.khoNhap)}</td><td>${receipt.ngayNhap}</td><td class="status-in-transit">${receipt.status}</td>`;
            dashTable.prepend(tr);
        }

        // Update KPI
        const kpiEl = document.getElementById('kpi-orders');
        if (kpiEl) {
            const v = parseInt(kpiEl.textContent || '0', 10) || 0;
            kpiEl.textContent = v + 1;
        }

        // -- Notify farmer by writing a market order into shared storage (auto-send) --
        try {
            const market = JSON.parse(localStorage.getItem('market_orders') || '[]');
            const uid = 'MO' + Date.now() + Math.random().toString(36).slice(2,8);
            market.push({
                uid,
                maPhieu: receipt.maPhieu,
                fromDailyUserId: currentUser?.id || currentUser?.maDaiLy || null,
                toFarmerUserId: receipt.maNongUserId || '',
                maLo: receipt.maLo,
                sanPham: receipt.sanPham,
                soLuong: receipt.soLuong,
                khoNhap: receipt.khoNhap,
                ngayTao: new Date().toISOString(),
                status: 'pending'
            });
            localStorage.setItem('market_orders', JSON.stringify(market));
        } catch (err) { console.warn('market_orders write failed', err); }

        closeModal();
        alert('Đã nhập hàng: ' + receipt.maPhieu);
        try { renderReports(); } catch (e) { /* ignore */ }
    }
});

// Load shipped market orders that belong to this daily (so daily can mark received)
function loadMarketOrdersForDaily() {
    const all = JSON.parse(localStorage.getItem('market_orders') || '[]');
    const my = all.filter(m => String(m.fromDailyUserId) === String(currentUser?.id));
    const shipped = my.filter(m => m.status === 'shipped');
    // render into orders table (append as rows with a "Đã nhận" button)
    const mainTable = document.querySelector('#table-orders-all tbody');
    if (!mainTable) return;
    shipped.forEach(m => {
        // avoid duplicating if row exists (use uid)
        if (!m.uid) return; // defensive
        if (mainTable.querySelector(`[data-market='${m.uid}']`)) return;
        const tr = document.createElement('tr');
        tr.dataset.market = m.uid;
        tr.innerHTML = `<td>${m.maPhieu}</td><td>${m.maLo} — ${m.sanPham || ''}</td><td>${m.soLuong}</td><td>—</td><td>${m.khoNhap || ''}</td><td>${m.ngayTao || ''}</td><td class="status-in-transit">Đã xuất</td>
            <td><button class="btn small" onclick="markMarketOrderReceived('${m.uid}')">Đã nhận</button></td>`;
        mainTable.prepend(tr);
    });
}

window.markMarketOrderReceived = function(maPhieu) {
    const uid = maPhieu; // parameter is uid now
    const all = JSON.parse(localStorage.getItem('market_orders') || '[]');
    const ord = all.find(x => x.uid === uid && String(x.fromDailyUserId) === String(currentUser?.id));
    if (!ord) return alert('Không tìm thấy đơn');

    // ensure it's recorded in this daily's phieuNhap if not exists
    if (!DB.phieuNhap.find(p => p.maPhieu === ord.maPhieu)) {
        DB.phieuNhap.push({ maPhieu: ord.maPhieu, maLo: ord.maLo, maNong: ord.toFarmerUserId, tenNong: '', sanPham: ord.sanPham, soLuong: ord.soLuong, khoNhap: ord.khoNhap, ngayNhap: new Date().toLocaleDateString(), ghiChu: '', status: 'Chờ kiểm định' });
    }

    // create a quality-check (kiểm định) entry assigned to this Daily
    try {
        if (!Array.isArray(DB.kiemDinh)) DB.kiemDinh = loadUserData('kiemDinh') || [];
        const maKiemDinh = 'KD' + Date.now();
        DB.kiemDinh.push({ maKiemDinh, maLo: ord.maLo, ngayKiem: '', nguoiKiem: '', ketQua: 'Chưa kiểm', ghiChu: 'Tự động tạo sau khi nhận: ' + ord.maPhieu });
    } catch (e) { console.warn('failed to create kiemDinh', e); }

    // persist per-user data
    saveDB();

    // remove the market order from shared storage since it's been received (by uid)
    const remaining = all.filter(x => x.uid !== uid);
    localStorage.setItem('market_orders', JSON.stringify(remaining));

    alert('Đã nhận hàng. Phiếu nhập chuyển sang kiểm định chất lượng.');

    // Refresh UI without full reload
    try { renderReceiptsFromDB(); } catch (e) {}
    try { renderKiemDinh(); } catch (e) {}
    try { loadMarketOrdersForDaily(); } catch (e) {}
    try { renderReports(); } catch (e) {}
};

// ------------ Retail orders from Supermarkets (Sieuthi -> Daily) ------------
function loadRetailOrdersForDaily() {
    try {
        const all = JSON.parse(localStorage.getItem('retail_orders') || '[]');
        const mine = all.filter(m => String(m.toDailyAgency) === String(currentUser?.maDaiLy));
        const tb = document.querySelector('#table-retail-incoming tbody');
        // the retail-incoming table was removed from Nhập hàng page; if not present, skip rendering
        if (!tb) return;
        tb.innerHTML = '';
        mine.forEach(m => {
            const tr = document.createElement('tr');
            const shopName = (function(){ try { const users = JSON.parse(localStorage.getItem('users')||'[]'); const u = users.find(x=>String(x.id)===String(m.fromSieuthiId)); return u ? (u.fullName||u.username) : (m.fromSieuthiId||'Siêu thị'); } catch(e){ return m.fromSieuthiId || 'Siêu thị'; } })();
            tr.innerHTML = `<td>${m.maPhieu || ''}</td><td>${m.maLo || ''} — ${m.sanPham || ''}</td><td>${m.soLuong}</td><td>${shopName}</td><td>${m.ngayTao || ''}</td><td>${m.status || 'pending'}</td>`;
            const td = document.createElement('td');
            if (m.status === 'pending') {
                td.innerHTML = `<button class="btn small" onclick="confirmRetailOrder('${m.uid}')">Xác nhận</button>`;
            } else {
                // Do not render a "Xuất đơn" action here — xuất hàng từ Đại lý đến Siêu thị đã bị vô hiệu hóa
                td.innerHTML = `<span>${m.status || ''}</span>`;
            }
            tr.appendChild(td);
            tb.appendChild(tr);
        });
    } catch (e) { console.warn('loadRetailOrdersForDaily failed', e); }
}

window.confirmRetailOrder = function(uid) {
    try {
        const all = JSON.parse(localStorage.getItem('retail_orders') || '[]');
        const idx = all.findIndex(x => String(x.uid) === String(uid) && String(x.toDailyAgency) === String(currentUser?.maDaiLy));
        if (idx === -1) return alert('Không tìm thấy đơn');
        all[idx].status = 'preparing';
        localStorage.setItem('retail_orders', JSON.stringify(all));
        loadRetailOrdersForDaily();
        alert('Đã xác nhận nhận đơn, đang chuẩn bị.');
    } catch (e) { console.warn(e); }
};

window.openShipRetailModal = function(uid) {
    openModal(`<h3>Xuất đơn (Đến Siêu thị)</h3>
        <label>Ngày gửi</label><input id="ship-date" type="date" />
        <label>Ghi chú</label><input id="ship-note" />
        <div style="margin-top:10px"><button onclick="shipRetailOrder('${uid}')" class="btn">Xuất</button> <button onclick="closeModal()" class="btn">Hủy</button></div>`);
};

window.shipRetailOrder = function(uid) {
    try {
        const date = document.getElementById('ship-date')?.value || new Date().toLocaleDateString();
        const note = document.getElementById('ship-note')?.value || '';
        const all = JSON.parse(localStorage.getItem('retail_orders') || '[]');
        const idx = all.findIndex(x => String(x.uid) === String(uid) && String(x.toDailyAgency) === String(currentUser?.maDaiLy));
        if (idx === -1) return alert('Không tìm thấy đơn');
        const ord = all[idx];
        ord.status = 'shipped';
        ord.shipInfo = { ngayGui: date, note };

        // decrease shared lohang if possible
        try {
            const shippedQty = parseFloat(ord.soLuong) || 0;
            const allLohang = JSON.parse(localStorage.getItem('lohang') || '[]');
            let lo = allLohang.find(l => String(l.maLo) === String(ord.maLo));
            if (!lo) lo = allLohang.find(l => String(l.sanPham) === String(ord.sanPham) && (parseFloat(l.soLuong)||0) >= shippedQty);
            if (lo) { lo.soLuong = Math.max(0, (parseFloat(lo.soLuong)||0) - shippedQty); }
            localStorage.setItem('lohang', JSON.stringify(allLohang));
        } catch (e) { console.warn('reduce lohang failed', e); }

        localStorage.setItem('retail_orders', JSON.stringify(all));
        closeModal();
        loadRetailOrdersForDaily();
        alert('Đã xuất đơn và chuyển cho Siêu thị.');
    } catch (e) { console.warn(e); alert('Lỗi khi xuất đơn'); }
};

// Form Submissions
document.getElementById('createOrderForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Tạo đơn hàng thành công!');
    e.target.reset();
});

document.getElementById('updateDeliveryForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Cập nhật trạng thái thành công!');
    e.target.reset();
});

document.getElementById('addInventoryForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Phân loại kho thành công!');
    e.target.reset();
});

document.getElementById('exportInventoryForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Xuất kho thành công!');
    e.target.reset();
});

document.getElementById('createQualityForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Tạo phiếu kiểm định thành công!');
    e.target.reset();
});

document.getElementById('qualityFeedbackForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Ghi nhận kết quả kiểm định thành công!');
    e.target.reset();
});

document.getElementById('rejectBatchForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Từ chối lô hàng thành công!');
    e.target.reset();
});

// Delete functionality
document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (confirm('Bạn có chắc chắn muốn xóa?')) {
            e.target.closest('tr').remove();
            alert('Xóa thành công!');
        }
    });
});

// ========== INITIALIZATION ==========
// Load persisted data and render on page load
window.addEventListener('DOMContentLoaded', () => {
    // Load current user
    loadCurrentUser();
    
    // Clear old shared data format before loading new per-user data
    clearOldDataFormat();
    
    // Load per-user database
    loadDB();
    
    // Display current user info
    const userDisplay = document.getElementById('current-user');
    const agencyDisplay = document.getElementById('current-agency');
    
    if (userDisplay) {
        userDisplay.innerHTML = `<strong>👤 ${currentUser?.fullName || 'User'}</strong>`;
    }
    
    if (agencyDisplay) {
        const agency = DB.dailyAgencies.find(a => a.maDaiLy === currentUser?.maDaiLy);
        agencyDisplay.innerHTML = `<small>🏢 ${agency ? agency.tenDaiLy : 'Đại lý'}</small>`;
    }
    
    // Ensure demo data exists, then render persisted PhiếuNhập from localStorage
    seedSampleData();
    renderReceiptsFromDB();
    renderKho();
    renderKiemDinh();
    renderInventory();
    updateKPIs();
    // Load any market orders that have been shipped to this daily so they can confirm receipt
    try { loadMarketOrdersForDaily(); } catch (e) { /* ignore */ }
    // Load incoming retail orders from supermarkets
    try { loadRetailOrdersForDaily(); } catch (e) { /* ignore */ }
    // Initialize Orders toggle controls if present
    try {
        const tabImport = document.getElementById('tab-orders-import');
        const tabRetail = document.getElementById('tab-orders-retail');
        const panelImport = document.getElementById('orders-import');
        const panelRetail = document.getElementById('orders-retail');
        function showOrdersTab(t) {
            if (!panelImport || !panelRetail || !tabImport || !tabRetail) return;
            if (t === 'retail') {
                panelImport.style.display = 'none';
                panelRetail.style.display = '';
                tabImport.classList.remove('active');
                tabRetail.classList.add('active');
                // render retail list when switching
                try { loadRetailOrdersForDaily(); } catch (e) {}
            } else {
                panelImport.style.display = '';
                panelRetail.style.display = 'none';
                tabImport.classList.add('active');
                tabRetail.classList.remove('active');
                // ensure receipts are rendered
                try { renderReceiptsFromDB(); } catch (e) {}
            }
        }
        tabImport?.addEventListener('click', () => showOrdersTab('import'));
        tabRetail?.addEventListener('click', () => showOrdersTab('retail'));
        // default to import tab
        showOrdersTab('import');
        // Listen for storage changes to refresh views (from other windows)
        window.addEventListener('storage', (ev) => {
            try {
                if (!ev.key) return;
                // refresh when shared keys or this user's per-user keys change
                const keysToWatch = ['market_orders','retail_orders', 'lohang', `user_${currentUser?.id}_phieuNhap`, `user_${currentUser?.id}_kiemDinh`];
                if (keysToWatch.includes(ev.key) || ev.key.includes('market_orders') || ev.key.includes('retail_orders') || ev.key.includes('lohang')) {
                    try { loadDB(); } catch (e) {}
                    try { renderReceiptsFromDB(); } catch (e) {}
                    try { renderKho(); } catch (e) {}
                    try { renderInventory(); } catch (e) {}
                    try { renderKiemDinh(); } catch (e) {}
                    try { updateKPIs(); } catch (e) {}
                    try { renderReports(); } catch (e) {}
                    try { loadRetailOrdersForDaily(); } catch (e) {}
                }
            } catch (err) { console.warn('storage listener error', err); }
        });
    } catch (e) { console.warn('Orders toggle init failed', e); }
});

function renderReceiptsFromDB() {
    const receipts = DB.phieuNhap || [];
    const mainTable = document.querySelector('#table-orders-all tbody');
    const dashTable = document.querySelector('#table-orders tbody');
    
    if (mainTable) {
        mainTable.innerHTML = '';
        receipts.forEach(receipt => {
            const batchCell = receipt.maLo + (receipt.sanPham ? (' — ' + receipt.sanPham) : '');
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${receipt.maPhieu}</td>
                <td>${batchCell}</td>
                <td>${receipt.soLuong}</td>
                <td>${receipt.tenNong || ''}</td>
                <td>${getKhoName(receipt.khoNhap)}</td>
                <td>${receipt.ngayNhap}</td>
                <td class="status-in-transit">${receipt.status || 'Đã tạo'}</td>
                <td>
                    <button class="btn-edit">Sửa</button>
                    <button class="btn-delete">Xóa</button>
                </td>
            `;
            mainTable.appendChild(tr);
            
            // attach delete listener
            tr.querySelector('.btn-delete')?.addEventListener('click', () => {
                if (confirm('Bạn có chắc chắn muốn xóa?')) {
                    // decrement stock for this receipt's batch
                    adjustStockOnReceipt(receipt, - (parseFloat(receipt.soLuong) || 0));
                    DB.phieuNhap = DB.phieuNhap.filter(p => p.maPhieu !== receipt.maPhieu);
                    saveDB();
                    tr.remove();
                    renderInventory();
                    updateKPIs();
                    alert('Xóa thành công!');
                }
            });
            tr.querySelector('.btn-edit')?.addEventListener('click', () => {
                openEditReceipt(receipt.maPhieu);
            });
        });
    }
    
    // Render recent receipts in dashboard (limit to last 5)
    if (dashTable) {
        dashTable.innerHTML = '';
        receipts.slice(0, 5).forEach(receipt => {
            const batchCell = receipt.maLo + (receipt.sanPham ? (' — ' + receipt.sanPham) : '');
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${receipt.maPhieu}</td><td>${batchCell}</td><td>${receipt.soLuong}</td><td>${receipt.khoNhap}</td><td>${receipt.ngayNhap}</td><td class="status-in-transit">${receipt.status}</td>`;
            dashTable.appendChild(tr);
        });
    }
}

function updateKPIs() {
    // Update receipt count KPI
    const kpiOrders = document.getElementById('kpi-orders');
    if (kpiOrders) {
        kpiOrders.textContent = (DB.phieuNhap || []).length;
    }
    // Shipments KPI removed (phieuXuat deleted)
}

console.log('Daily Management System loaded successfully!');