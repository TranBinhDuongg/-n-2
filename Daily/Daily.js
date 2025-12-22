// ====== HÀM HỖ TRỢ LOCALSTORAGE (Dữ liệu riêng từng người dùng) ======
let currentUser = null;

function loadCurrentUser() {
    const stored = sessionStorage.getItem('currentUser');
    if (!stored) {
        // Chuyển hướng về trang đăng nhập nếu chưa đăng nhập
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

// ====== CẤU TRÚC DỮ LIỆU (ĐẠI LÝ) ======
const DB = {
    nongdan: JSON.parse(localStorage.getItem('nongdan') || '[]'),      
    lohang: JSON.parse(localStorage.getItem('lohang') || '[]'),        
    phieuNhap: [],  
    kho: [],        
    kiemDinh: [],   
    dailyAgencies: JSON.parse(localStorage.getItem('dailyAgencies') || '[]'), // Shared
};

function loadDB() {
    DB.phieuNhap = loadUserData('phieuNhap');
    DB.kho = loadUserData('kho');
    DB.kiemDinh = loadUserData('kiemDinh');
}

// Clear old non-per-user data that may have been stored with old format
function clearOldDataFormat() {
    // Xóa các key cũ không theo định dạng từng người dùng
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
    // Lưu dữ liệu từng người dùng với tiền tố user_${id}_
    saveUserData('phieuNhap', DB.phieuNhap);
    saveUserData('kho', DB.kho);
    saveUserData('kiemDinh', DB.kiemDinh);
    
    // Lưu dữ liệu dùng chung toàn hệ thống
    localStorage.setItem('nongdan', JSON.stringify(DB.nongdan));
    localStorage.setItem('lohang', JSON.stringify(DB.lohang));
    localStorage.setItem('dailyAgencies', JSON.stringify(DB.dailyAgencies));
}

// Lấy tên kho từ mã kho
function getKhoName(maKho) {
    if (!maKho) return '';
    const kho = DB.kho.find(k => k.maKho === maKho);
    return kho ? kho.tenKho : maKho;
}

// Kiểm tra kết quả kiểm định đạt hay không
function isKiemDinhPassed(kq) {
    if (!kq) return false;
    // Loại bỏ dấu, khoảng trắng, ký tự đặc biệt, chuyển về chữ thường
    let v = String(kq).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    v = v.replace(/[^a-z0-9]/g, '');
    console.log('[DEBUG isKiemDinhPassed] ketQua goc:', kq, '| sau xu ly:', v);
    // Chỉ so sánh với các giá trị không dấu
    return v === 'at' || v === 'pass' || v === 'passed' || v.includes('dat') || v.includes('pass');
}

function isStatusPending(s) {
    if (!s) return false;
    const v = String(s).trim().toLowerCase();
    const base = v.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    return base.includes('cho') || base.includes('pending') || base.includes('kiem');
}

// Chuẩn hóa trạng thái về mã trạng thái chuẩn
function mapStatusToCode(s) {
    if (!s && s !== '') return '';
    const v = String(s || '').trim().toLowerCase();
    const base = v.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    if (base === '' || base === 'created' || base.includes('tao') || base.includes('moi')) return 'created';
    if (base.includes('pending') || base.includes('cho')) return 'pending';
    if (base.includes('prepar') || base.includes('chu an') || base.includes('chuẩn') || base.includes('dang chuan')) return 'preparing';
    if (base.includes('ship') || base.includes('xuat') || base.includes('da xuat') || base.includes('đã xuất')) return 'shipped';
    if (base.includes('nhan') || base.includes('received') || base.includes('da nhan')) return 'received';
    if (base.includes('kiem')) return 'awaiting_check';
    if (base.includes('accepted') || base.includes('nhan don') || base.includes('nông dan nhan don') || base.includes('dang cho')) return 'accepted';
    return base;
}

function statusDisplay(codeOrRaw) {
    const code = mapStatusToCode(codeOrRaw);
    switch (code) {
        case 'created': return 'Đã tạo';
        case 'pending': return 'Chờ xử lý';
        case 'preparing': return 'Đang chuẩn bị';
        case 'shipped': return 'Đã xuất';
        case 'received': return 'Đã nhận';
        case 'awaiting_check': return 'Chờ kiểm định';
        case 'accepted': return 'Đã nhận (Nông dân)';
        default: return String(codeOrRaw || '');
    }
}

// Hiển thị báo cáo thống kê
function renderReports() {
    // ensure DOM elements exist
    if (typeof document === 'undefined') return;
    const elOrders = document.getElementById('report-orders');
    const elShipped = document.getElementById('report-shipped');
    const elStock = document.getElementById('report-stock');
    const elQuality = document.getElementById('report-quality');
    // Tổng đơn hàng nhập (số phiếu nhập)
    const totalOrders = (DB.phieuNhap || []).length;
    // Đã xuất hàng: số đơn hàng thị trường đã xuất từ đại lý này hoặc gửi tới đại lý này
    let marketAll = [];
    try { marketAll = JSON.parse(localStorage.getItem('market_orders') || '[]'); } catch (e) { marketAll = []; }
    const shippedFromDaily = marketAll.filter(m => String(m.fromDailyUserId) === String(currentUser?.id) && (String(m.status).toLowerCase().includes('ship') || String(m.status).toLowerCase().includes('xuất') || String(m.status).toLowerCase().includes('shipped'))).length;
    const shippedToDaily = marketAll.filter(m => String(m.toDailyAgency) === String(currentUser?.maDaiLy) && (String(m.status).toLowerCase().includes('ship') || String(m.status).toLowerCase().includes('xuất') || String(m.status).toLowerCase().includes('shipped'))).length;
    const totalShipped = shippedFromDaily + shippedToDaily;

    // current stock by batches (giữ nguyên là tổng số lượng sản phẩm)
    const totalStock = (DB.lohang || []).reduce((s, b) => s + (parseFloat(b.soLuong) || 0), 0);

    const totalChecks = (DB.kiemDinh || []).length;
    const passed = (DB.kiemDinh || []).filter(k => (k.ketQua || '').toLowerCase() === 'đạt' || (k.ketQua || '').toLowerCase() === 'dat' || (k.ketQua || '').toLowerCase().includes('dat')).length;
    const passPercent = totalChecks ? Math.round((passed / totalChecks) * 100) : 0;

    if (elOrders) elOrders.textContent = totalOrders + ' đơn';
    if (elShipped) elShipped.textContent = totalShipped + ' đơn';
    if (elStock) elStock.textContent = totalStock + ' sản phẩm';
    if (elQuality) elQuality.textContent = `${passed}/${totalChecks} (${passPercent}%)`;
}

// Tạo dữ liệu mẫu cho phát triển/demo
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

// Điều chỉnh tồn kho khi nhập/xuất hàng (delta > 0: nhập, < 0: xuất)
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

// Thêm số lượng vào kho cụ thể
function addToWarehouse(maKho, maLo, sanPham, qty) {
    if (!maKho) return;
    const amount = parseFloat(qty) || 0;
    // find warehouse for current user
    let kho = (DB.kho || []).find(k => String(k.maKho) === String(maKho));
    if (!kho) {
        // create a minimal warehouse entry if missing
        kho = { maKho: maKho, tenKho: maKho, diaChi: '', soDienThoai: '', maDaiLy: currentUser?.maDaiLy || '', items: [] };
        DB.kho.push(kho);
    }
    if (!Array.isArray(kho.items)) kho.items = [];
    // find existing item by batch code first, otherwise by product name
    let item = kho.items.find(it => String(it.maLo || '') === String(maLo));
    if (!item) item = kho.items.find(it => it.sanPham && it.sanPham === sanPham);
    if (item) {
        item.soLuong = (parseFloat(item.soLuong) || 0) + amount;
    } else {
        kho.items.push({ maLo: maLo || '', sanPham: sanPham || '', soLuong: amount });
    }
}

// Hiển thị bảng tồn kho từ DB.lohang
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
                <button class="btn small btn-danger" onclick="deleteLohang('${l.maLo}')">Xóa</button>
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

// Mở modal sửa phiếu nhập
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

// Khởi tạo modal tạo phiếu nhập: điền nông dân và sản phẩm
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

        // Đã chọn nông dân -> Ẩn ô nhập nông dân thủ công
        fromManual.style.display = 'none';
        productManual.style.display = 'none';

        // Tìm sản phẩm liên quan đến nông dân này từ bảng LôHàng.
        // So khớp theo nhiều định danh vì DB.lohang có thể dùng mã nông dân (ví dụ: 'ND001')
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        const farmerUser = users.find(u => String(u.id) === String(fid));
        // Chuẩn bị danh sách lô hàng kết hợp: gồm DB.lohang dùng chung và lô hàng riêng của nông dân
        let allBatches = Array.isArray(batches) ? batches.slice() : [];
        try {
            if (farmerUser && farmerUser.id) {
                const farmerBatches = JSON.parse(localStorage.getItem(`user_${farmerUser.id}_batches`) || '[]');
                if (Array.isArray(farmerBatches) && farmerBatches.length) {
                    // normalize farmer batch shape to match shared lohang entries
                    const mapped = farmerBatches.map(b => ({ maLo: b.id || b.maLo || '', sanPham: b.product || b.sanPham || '', maNong: farmerUser.maNong || farmerUser.id || '', soLuong: b.quantity || b.soLuong || 0, farmName: b.farmName || '' }));
                    allBatches = allBatches.concat(mapped);
                }
            }
        } catch (e) { /* ignore */ }
        const ids = new Set();
        if (farmerUser) {
            if (farmerUser.maNong) ids.add(String(farmerUser.maNong));
            ids.add(String(farmerUser.id));
            if (farmerUser.username) ids.add(String(farmerUser.username));
            if (farmerUser.fullName) ids.add(String(farmerUser.fullName));
            if (farmerUser.hoTen) ids.add(String(farmerUser.hoTen));
        }

        // Trường hợp không tìm thấy: thử ánh xạ user nông dân sang DB.nongdan (mã maNong)
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

        const prods = allBatches
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

        // Nếu không có gợi ý, thử tìm trực tiếp theo maNong từ DB.lohang qua DB.nongdan
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
            // Không có gợi ý sản phẩm -> cho phép người dùng nhập tay
            productSelect.appendChild(new Option('Không có loại gợi ý', 'manual'));
            productSelect.disabled = true;
            productManual.style.display = 'block';
        }
    });
}

// ====== Quản lý kho ======
function renderKho() {
    const tbody = document.querySelector('#table-kho tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    (DB.kho || []).forEach(k => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${k.maKho}</td><td>${k.tenKho}</td><td>${k.diaChi || ''}</td><td>${k.soDienThoai || ''}</td>
            <td><button class="btn small" onclick="editKho('${k.maKho}')">Sửa</button>
                <button class="btn small btn-danger" onclick="deleteKho('${k.maKho}')">Xóa</button></td>`;
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

// Tab chuyển trang tồn kho (đã bỏ import/export tab, dùng chuyển trang)

// ====== Quản lý kiểm định chất lượng ======
// Tạo DB.kiemDinh nếu chưa có
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
        // If no related per-user receipts were found, try to discover matching orders in shared channels
        if (!related || related.length === 0) {
            console.warn('No related pending receipts found for maLo in per-user DB, searching shared orders for maLo', maLo);
            try {
                const sharedRetail = JSON.parse(localStorage.getItem('retail_orders') || '[]');
                const sharedMarket = JSON.parse(localStorage.getItem('market_orders') || '[]');
                const matches = [];
                // collect retail_orders addressed to this daily or matching maLo
                (sharedRetail || []).forEach(o => {
                    try {
                        if (!o) return;
                        if (String(o.maLo) === String(maLo)) matches.push({ maPhieu: o.maPhieu || o.uid || ('PN' + Date.now()), maLo: o.maLo, sanPham: o.sanPham, soLuong: parseFloat(o.soLuong)||0, khoNhap: o.khoNhap || '', ngayNhap: o.ngayTao || new Date().toLocaleDateString(), source: 'retail' });
                    } catch(e){}
                });
                // collect market_orders that created receipts for this maLo
                (sharedMarket || []).forEach(o => {
                    try {
                        if (!o) return;
                        if (String(o.maLo) === String(maLo)) matches.push({ maPhieu: o.maPhieu || o.uid || ('PN' + Date.now()), maLo: o.maLo, sanPham: o.sanPham, soLuong: parseFloat(o.soLuong)||0, khoNhap: o.khoNhap || '', ngayNhap: o.ngayTao || new Date().toLocaleDateString(), source: 'market' });
                    } catch(e){}
                });
                // Convert matches into per-user receipts if not already present
                matches.forEach(m => {
                    const exists = (DB.phieuNhap || []).find(p => String(p.maPhieu) === String(m.maPhieu) || String(p.maLo) === String(m.maLo) && (parseFloat(p.soLuong)||0) === (parseFloat(m.soLuong)||0));
                    if (!exists) {
                        DB.phieuNhap = DB.phieuNhap || [];
                        const rec = { maPhieu: m.maPhieu, maLo: m.maLo, maNongUserId: '', tenNong: '', sanPham: m.sanPham, soLuong: m.soLuong, khoNhap: m.khoNhap || '', ngayNhap: m.ngayNhap, ghiChu: 'Imported from shared orders (' + (m.source||'') + ')', status: 'Đã nhập' };
                        DB.phieuNhap.push(rec);
                        related.push(rec);
                    }
                });
            } catch (e) { console.warn('search shared orders failed', e); }
        }

        // For all related receipts (found or imported), apply stock increase and record into warehouses
        related.forEach(r => {
            const qty = parseFloat(r.soLuong) || 0;
            console.log('Applying stock increase for receipt', r.maPhieu, 'maLo', r.maLo, 'qty', qty);
            adjustStockOnReceipt(r, qty);
            // Determine target warehouse: prefer receipt.khoNhap, else first existing warehouse, else a default per-daily code
            let targetKho = r.khoNhap;
            if (!targetKho) {
                if (Array.isArray(DB.kho) && DB.kho.length > 0) targetKho = DB.kho[0].maKho;
                else targetKho = 'KHO_' + (currentUser?.maDaiLy || currentUser?.id || 'DEFAULT');
            }
            // Also record the received items into the dealer's specific warehouse (creates warehouse if missing)
            try { addToWarehouse(targetKho, r.maLo, r.sanPham, qty); } catch (e) { console.warn('addToWarehouse failed', e); }
            r.khoNhap = targetKho;
            r.status = 'Đã kiểm định';
        });

        // persist per-user DB and shared lohang
        saveDB();
        try { localStorage.setItem('lohang', JSON.stringify(DB.lohang || [])); } catch (e) { console.warn('persist lohang failed', e); }

        // refresh UI
        try { renderReceiptsFromDB(); } catch (e) {}
        try { renderInventory(); } catch (e) {}
        try { renderKho(); } catch (e) {}
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
                <button class="btn small btn-danger" onclick="deleteKiemDinh('${k.maKiemDinh}')">Xóa</button></td>`;
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

// Gắn nút tạo phiếu kiểm định

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

// Thêm dòng vào bảng và gắn sự kiện (hiển thị phiếu nhập)
function addOrderRow(tableSelector, data) {
    const table = document.querySelector(tableSelector + ' tbody');
    if (!table) return;
    const tr = document.createElement('tr');
    // Build batch cell from maLo and sanPham
    const batchCell = data.maLo + (data.sanPham ? (' — ' + data.sanPham) : '');
    const tenNongDisplay = data.tenNong || data.fromAddress || '';

    // Nếu trạng thái là 'Đã xuất' thì hiển thị text, không cho bấm xuất đơn nữa
    let actionButtons = `<button class="btn-edit">Sửa</button> <button class="btn-delete">Xóa</button>`;
    const statusCode = mapStatusToCode(data.status);

    if (statusCode === 'shipped' || data.status === 'Đã xuất') {
        actionButtons += ` <span class="btn btn-disabled" style="background:#e0e0e0;color:#888;cursor:not-allowed;">Đã xuất</span>`;
    } else if (statusCode === 'received' || statusCode === 'awaiting_check' || data.status === 'Đã kiểm định' || data.status === 'Đã nhập') {
        // Thêm nút xuất hàng nếu chưa xuất
        actionButtons += ` <button class="btn-export btn" style="background:#4caf50;color:#fff;">Xuất đơn</button>`;
    }

    tr.innerHTML = `
        <td>${data.maPhieu}</td>
        <td>${batchCell}</td>
        <td>${data.soLuong}</td>
        <td>${tenNongDisplay}</td>
        <td>${getKhoName(data.khoNhap)}</td>
        <td>${data.ngayNhap || new Date().toLocaleDateString()}</td>
        <td class="status-in-transit">${statusDisplay(data.status || 'created')}</td>
        <td>
            ${actionButtons}
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

    // Nút xác nhận xuất hàng
    tr.querySelector('.btn-export')?.addEventListener('click', () => {
        if (confirm('Xác nhận xuất hàng cho đơn này?')) {
            const rec = DB.phieuNhap.find(p => p.maPhieu === data.maPhieu);
            if (rec) {
                // Trừ kho đại lý
                let kho = DB.kho.find(k => k.maKho === rec.khoNhap);
                if (kho && Array.isArray(kho.items)) {
                    let item = kho.items.find(it => String(it.maLo) === String(rec.maLo));
                    if (!item) item = kho.items.find(it => it.sanPham === rec.sanPham);
                    if (item) {
                        item.soLuong = Math.max(0, (parseFloat(item.soLuong) || 0) - (parseFloat(rec.soLuong) || 0));
                    }
                }
                rec.status = 'Đã xuất';
                saveDB();
                tr.querySelector('.status-in-transit').textContent = statusDisplay('Đã xuất');
                tr.querySelector('.btn-export').replaceWith(document.createElement('span'));
                tr.querySelector('span').textContent = 'Đã xuất';
                tr.querySelector('span').className = 'btn btn-disabled';
                tr.querySelector('span').style.background = '#e0e0e0';
                tr.querySelector('span').style.color = '#888';
                tr.querySelector('span').style.cursor = 'not-allowed';
                alert('Đơn hàng đã được xuất và trừ kho!');
            }
        }
    });
}

// Đã bỏ tính năng xuất hàng (phieuXuat)

// Xử lý submit form tạo phiếu nhập (lưu theo cấu trúc SQL)
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


        closeModal();
        alert('Đã nhập hàng: ' + receipt.maPhieu);
        try { renderReports(); } catch (e) { /* ignore */ }
    }
});

// Tải đơn hàng thị trường đã xuất về đại lý này
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
            <td><span class="btn btn-disabled" style="background:#e0e0e0;color:#888;cursor:not-allowed;">Đã xuất</span></td>`;
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
        DB.phieuNhap.push({ maPhieu: ord.maPhieu, maLo: ord.maLo, maNong: ord.toFarmerUserId, tenNong: '', sanPham: ord.sanPham, soLuong: ord.soLuong, khoNhap: ord.khoNhap, ngayNhap: new Date().toLocaleDateString(), ghiChu: '', status: 'awaiting_check' });
    }

    // create a quality-check (kiểm định) entry assigned to this Daily
    try {
        if (!Array.isArray(DB.kiemDinh)) DB.kiemDinh = loadUserData('kiemDinh') || [];
        const maKiemDinh = 'KD' + Date.now();
        DB.kiemDinh.push({ maKiemDinh, maLo: ord.maLo, ngayKiem: '', nguoiKiem: '', ketQua: 'Chưa kiểm', ghiChu: 'Tự động tạo sau khi nhận: ' + ord.maPhieu });
    } catch (e) { console.warn('failed to create kiemDinh', e); }

    // persist per-user data
    saveDB();

    // KHÔNG xoá đơn market_orders ở bước nhận hàng nữa, chỉ xoá sau khi xuất hàng!

    alert('Đã nhận hàng. Phiếu nhập chuyển sang kiểm định chất lượng. Đơn hàng sẽ chuyển qua Siêu thị sau khi xuất hàng.');

    // Refresh UI without full reload
    try { renderReceiptsFromDB(); } catch (e) {}
    try { renderKiemDinh(); } catch (e) {}
    try { loadMarketOrdersForDaily(); } catch (e) {}
    try { renderReports(); } catch (e) {}
};

// ====== Đơn bán lẻ từ Siêu thị về Đại lý ======
function loadRetailOrdersForDaily() {
    try {
        const all = JSON.parse(localStorage.getItem('retail_orders') || '[]');
        const mine = all.filter(m => {
            try {
                if (!m) return false;
                // match by agency code
                if (String(m.toDailyAgency) === String(currentUser?.maDaiLy)) return true;
                // match by user id (some orders store user id instead of maDaiLy)
                if (String(m.toDailyUserId) === String(currentUser?.id)) return true;
                // match by visible label
                if (String(m.toDaily) === String(currentUser?.fullName)) return true;
                // match if toDailyAgency was set to the user's id
                if (String(m.toDailyAgency) === String(currentUser?.id)) return true;
            } catch (e) { /* ignore */ }
            return false;
        });
        const tb = document.querySelector('#table-retail-incoming tbody');
        // the retail-incoming table was removed from Nhập hàng page; if not present, skip rendering
        if (!tb) return;
        tb.innerHTML = '';
        mine.forEach(m => {
            if (!m.uid) return;
            // avoid duplicate rows
            if (tb.querySelector(`[data-retail='${m.uid}']`)) return;
            const tr = document.createElement('tr');
            tr.dataset.retail = m.uid;
            const shopName = (function(){ try { const users = JSON.parse(localStorage.getItem('users')||'[]'); const u = users.find(x=>String(x.id)===String(m.fromSieuthiId)); return u ? (u.fullName||u.username) : (m.fromSieuthiId||'Siêu thị'); } catch(e){ return m.fromSieuthiId || 'Siêu thị'; } })();
            tr.innerHTML = `<td>${m.maPhieu || ''}</td><td>${m.maLo || ''} — ${m.sanPham || ''}</td><td>${m.soLuong}</td><td>${shopName}</td><td>${m.ngayTao || ''}</td><td>${statusDisplay(m.status || 'pending')}</td>`;
            const td = document.createElement('td');
            if (String(m.status) === 'pending') {
                td.innerHTML = `<button class="btn small" onclick="confirmRetailOrder('${m.uid}')">Xác nhận</button>`;           
            } else if (String(m.status) === 'received') {
                td.innerHTML = `<span>Đã nhận</span>`;
            } else if (String(m.status) === 'preparing') {
                td.innerHTML = `<span>Đang chuẩn bị</span>`;
            } else {
                td.innerHTML = `<span>${statusDisplay(m.status || '')}</span>`;
            }
            tr.appendChild(td);
            tb.appendChild(tr);
        });
    } catch (e) { console.warn('loadRetailOrdersForDaily failed', e); }
}

window.confirmRetailOrder = function(uid) {
    try {
        const all = JSON.parse(localStorage.getItem('retail_orders') || '[]');
        const idx = all.findIndex(x => {
            if (!x) return false;
            if (String(x.uid) !== String(uid)) return false;
            if (String(x.toDailyAgency) === String(currentUser?.maDaiLy)) return true;
            if (String(x.toDailyUserId) === String(currentUser?.id)) return true;
            if (String(x.toDailyAgency) === String(currentUser?.id)) return true;
            return false;
        });
        if (idx === -1) return alert('Không tìm thấy đơn');
        // Skip intermediate 'preparing' state: confirm -> ship immediately
        if (!confirm('Xác nhận và xuất hàng cho Siêu thị ngay chứ?')) return;
        try {
            // Call ship handler directly; it will deduct stock, set status to 'shipped' and persist
            shipRetailOrder(uid);
        } catch (e) {
            console.warn('shipRetailOrder failed from confirmRetailOrder', e);
            alert('Lỗi khi xuất đơn');
        }
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
        const idx = all.findIndex(x => {
            if (!x) return false;
            if (String(x.uid) !== String(uid)) return false;
            if (String(x.toDailyAgency) === String(currentUser?.maDaiLy)) return true;
            if (String(x.toDailyUserId) === String(currentUser?.id)) return true;
            if (String(x.toDailyAgency) === String(currentUser?.id)) return true;
            return false;
        });
        if (idx === -1) return alert('Không tìm thấy đơn');
        const ord = all[idx];
        // Validate available stock in this Daily's warehouses (DB.kho)
        const needQty = parseFloat(ord.soLuong) || 0;
        // Build candidate items from DB.kho for this user
        let candidates = [];
        try {
            (DB.kho || []).forEach(k => {
                if (!Array.isArray(k.items)) return;
                k.items.forEach(it => {
                    if (!it || !it.sanPham) return;
                    if (String(it.sanPham) === String(ord.sanPham) || String(it.maLo) === String(ord.maLo)) {
                        // try to get expiry from shared lohang by maLo
                        let hanDung = null;
                        try {
                            const shared = JSON.parse(localStorage.getItem('lohang') || '[]');
                            const s = shared.find(x => String(x.maLo) === String(it.maLo));
                            if (s && s.hanDung) hanDung = s.hanDung;
                        } catch (e) { /* ignore */ }
                        candidates.push({ kho: k, item: it, maLo: it.maLo || '', soLuong: parseFloat(it.soLuong)||0, hanDung });
                    }
                });
            });
        } catch (e) { console.warn('build candidates failed', e); }

        // sort by expiry ascending (earliest first), nulls last
        candidates.sort((a,b) => {
            const da = a.hanDung ? new Date(a.hanDung).getTime() : Infinity;
            const db = b.hanDung ? new Date(b.hanDung).getTime() : Infinity;
            return da - db;
        });

        // Calculate total available from per-user kho + shared lohang (fallback)
        const totalFromKho = candidates.reduce((s,c)=>s+(parseFloat(c.soLuong)||0),0);
        const sharedAll = JSON.parse(localStorage.getItem('lohang') || '[]');
        const sharedMatches = sharedAll.filter(x => String(x.maLo) === String(ord.maLo) || String(x.sanPham) === String(ord.sanPham));
        const totalFromShared = sharedMatches.reduce((s,x)=>s+(parseFloat(x.soLuong)||0),0);
        const totalAvailable = totalFromKho + totalFromShared;

        if (totalAvailable < needQty) {
            return alert('Không đủ tồn kho để xuất đơn này. Có: ' + totalAvailable + ', cần: ' + needQty);
        }

        // Deduct quantities from candidates in order (kho first), then from shared lohang if needed
        let remain = needQty;
        for (const c of candidates) {
            if (remain <= 0) break;
            const avail = parseFloat(c.item.soLuong) || 0;
            if (avail <= 0) continue;
            const take = Math.min(avail, remain);
            // reduce in kho item
            c.item.soLuong = Math.max(0, avail - take);
            // also reduce shared lohang if this candidate has a matching maLo entry
            try {
                const sIdx = sharedAll.findIndex(x => String(x.maLo) === String(c.maLo));
                if (sIdx !== -1) {
                    sharedAll[sIdx].soLuong = Math.max(0, (parseFloat(sharedAll[sIdx].soLuong)||0) - take);
                }
            } catch (e) { console.warn('update shared lohang per item failed', e); }
            remain -= take;
        }

        // If still need more, deduct from sharedAll matches (by maLo first, then by product)
        if (remain > 0) {
            // try maLo matches first
            for (let i = 0; i < sharedAll.length && remain > 0; i++) {
                const s = sharedAll[i];
                if (!s) continue;
                if (String(s.maLo) !== String(ord.maLo)) continue;
                const avail = parseFloat(s.soLuong) || 0;
                if (avail <= 0) continue;
                const take = Math.min(avail, remain);
                sharedAll[i].soLuong = Math.max(0, avail - take);
                remain -= take;
            }
            // then by product name
            for (let i = 0; i < sharedAll.length && remain > 0; i++) {
                const s = sharedAll[i];
                if (!s) continue;
                if (String(s.sanPham) !== String(ord.sanPham)) continue;
                const avail = parseFloat(s.soLuong) || 0;
                if (avail <= 0) continue;
                const take = Math.min(avail, remain);
                sharedAll[i].soLuong = Math.max(0, avail - take);
                remain -= take;
            }
        }

        // Persist changes
        try { localStorage.setItem('lohang', JSON.stringify(sharedAll)); } catch (e) { console.warn('persist shared lohang failed', e); }
        try { saveDB(); } catch (e) { console.warn('saveDB failed', e); }

        // mark as shipped and record shipping info
        ord.status = 'shipped';
        ord.shipInfo = { ngayGui: date, note, shippedQty: needQty };
        // record into Daily's orders history
        try {
            DB.orders = DB.orders || [];
            DB.orders.push({ id: 'O' + Date.now(), batchId: ord.maLo || '', quantity: needQty, recipient: ord.to || ord.toSieuthi || '', kho: ord.khoNhap || '', date, status: 'shipped' });
            saveDB();
        } catch(e){ console.warn('record DB.orders failed', e); }

        localStorage.setItem('retail_orders', JSON.stringify(all));
        closeModal();
        loadRetailOrdersForDaily();
        alert('Đã xuất đơn và chuyển cho Siêu thị.');
    } catch (e) { console.warn(e); alert('Lỗi khi xuất đơn'); }
};

// Mark a retail order (from Sieuthi) as received by this Daily
window.markRetailOrderReceived = function(uid) {
    try {
        const all = JSON.parse(localStorage.getItem('retail_orders') || '[]');
        const ord = all.find(x => {
            if (!x) return false;
            if (String(x.uid) !== String(uid)) return false;
            if (String(x.toDailyAgency) === String(currentUser?.maDaiLy)) return true;
            if (String(x.toDailyUserId) === String(currentUser?.id)) return true;
            if (String(x.toDailyAgency) === String(currentUser?.id)) return true;
            return false;
        });
        if (!ord) return alert('Không tìm thấy đơn');

        // ensure it's recorded in this daily's phieuNhap if not exists
        if (!DB.phieuNhap.find(p => p.maPhieu === ord.maPhieu)) {
            DB.phieuNhap.push({ maPhieu: ord.maPhieu, maLo: ord.maLo, maNong: ord.maNong || '', tenNong: ord.tenNong || '', sanPham: ord.sanPham, soLuong: ord.soLuong, khoNhap: ord.khoNhap || '', ngayNhap: new Date().toLocaleDateString(), ghiChu: 'Nhận từ Siêu thị: ' + (ord.fromSieuthiId || ''), status: 'awaiting_check' });
        }

        // create a quality-check (kiểm định) entry assigned to this Daily
        try {
            if (!Array.isArray(DB.kiemDinh)) DB.kiemDinh = loadUserData('kiemDinh') || [];
            const maKiemDinh = 'KD' + Date.now();
            DB.kiemDinh.push({ maKiemDinh, maLo: ord.maLo, ngayKiem: '', nguoiKiem: '', ketQua: 'Chưa kiểm', ghiChu: 'Tự động tạo sau khi nhận từ Siêu thị: ' + ord.maPhieu });
        } catch (e) { console.warn('failed to create kiemDinh for retail', e); }

        // persist per-user data
        saveDB();

        // remove the retail order from shared storage since it's been received
        const remaining = all.filter(x => String(x.uid) !== String(uid));
        localStorage.setItem('retail_orders', JSON.stringify(remaining));

        alert('Đã nhận hàng từ Siêu thị. Phiếu nhập chuyển sang kiểm định chất lượng.');

        // Refresh UI
        try { renderReceiptsFromDB(); } catch (e) {}
        try { renderKiemDinh(); } catch (e) {}
        try { loadRetailOrdersForDaily(); } catch (e) {}
        try { renderReports(); } catch (e) {}
    } catch (e) { console.warn('markRetailOrderReceived failed', e); alert('Lỗi khi nhận đơn'); }
};

// Xử lý submit các form nhỏ
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

// ====== KHỞI TẠO DỮ LIỆU VÀ GIAO DIỆN ======
// Tải dữ liệu và hiển thị khi load trang
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
        userDisplay.textContent = currentUser?.fullName || 'Đại lý';
        userDisplay.style.cursor = 'pointer';
        userDisplay.title = 'Xem thông tin cá nhân';
        userDisplay.addEventListener('click', function() {
            // Fake data cho đại lý
            const fakeUser = {
                fullName: 'Trần Thị B',
                username: 'daily456',
                email: 'daily.b@example.com',
                phone: '0912 345 678',
                role: 'Đại lý',
                companyName: 'Công ty Vận tải B',
                taxCode: '1234567890',
                vehicleCount: '12',
                serviceArea: 'Hà Nội, Hải Phòng, Bắc Ninh',
                province: 'Hà Nội',
                district: 'Quận Long Biên',
                address: 'Số 88, Đường Nguyễn Văn Cừ',
                createdAt: '2025-11-15T10:00:00',
                id: 'DL654321'
            };
            const avatar = `<div style="display:flex;justify-content:center;align-items:center;margin-bottom:16px;"><div style="background:linear-gradient(135deg,#4caf50,#388e3c);width:72px;height:72px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px #0002;"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"44\" height=\"44\" viewBox=\"0 0 24 24\" fill=\"#fff\"><path d=\"M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z\"/></svg></div></div>`;
            const infoTable = `
                <table style=\"width:100%;border-collapse:separate;border-spacing:0 12px 0 18px;font-size:16px;\">
                    <colgroup><col style=\"width:180px;\"><col style=\"width:auto;\"></colgroup>
                    <tr><td style=\"color:#888;padding-right:32px;\">Họ tên</td><td style=\"font-weight:600;\">${fakeUser.fullName}</td></tr>
                    <tr><td style=\"color:#888;padding-right:32px;\">Tên đăng nhập</td><td>${fakeUser.username}</td></tr>
                    <tr><td style=\"color:#888;padding-right:32px;\">Email</td><td>${fakeUser.email}</td></tr>
                    <tr><td style=\"color:#888;padding-right:32px;\">Số điện thoại</td><td>${fakeUser.phone}</td></tr>
                    <tr><td style=\"color:#888;padding-right:32px;\">Vai trò</td><td>${fakeUser.role}</td></tr>
                    <tr><td style=\"color:#888;padding-right:32px;\">Tỉnh/Thành phố</td><td>${fakeUser.province}</td></tr>
                    <tr><td style=\"color:#888;padding-right:32px;\">Quận/Huyện</td><td>${fakeUser.district}</td></tr>
                    <tr><td style=\"color:#888;padding-right:32px;\">Địa chỉ</td><td>${fakeUser.address}</td></tr>
                    <tr><td style=\"color:#888;padding-right:32px;\">Tên công ty/Đại lý</td><td>${fakeUser.companyName}</td></tr>
                    <tr><td style=\"color:#888;padding-right:32px;\">Mã số thuế</td><td>${fakeUser.taxCode}</td></tr>
                    <tr><td style=\"color:#888;padding-right:32px;\">Số xe vận chuyển</td><td>${fakeUser.vehicleCount}</td></tr>
                    <tr><td style=\"color:#888;padding-right:32px;\">Khu vực hoạt động</td><td>${fakeUser.serviceArea}</td></tr>
                    <tr><td style=\"color:#888;padding-right:32px;\">Ngày tạo tài khoản</td><td>${new Date(fakeUser.createdAt).toLocaleString('vi-VN')}</td></tr>
                    <tr><td style=\"color:#888;padding-right:32px;\">ID người dùng</td><td>${fakeUser.id}</td></tr>
                </table>`;
            showUserInfoModal(`
                ${avatar}
                <div style=\"margin-bottom:12px;text-align:center;font-size:18px;font-weight:600;color:#388e3c;letter-spacing:0.5px;\">Thông tin cá nhân</div>
                <div style=\"padding:0 8px 8px 8px;\">${infoTable}</div>
            `);
        });
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
    renderReports();
    // Modal hiển thị thông tin người dùng
    function showUserInfoModal(html) {
        let modal = document.getElementById('modal-user-info');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-user-info';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100vw';
            modal.style.height = '100vh';
            modal.style.background = 'rgba(0,0,0,0.3)';
            modal.style.display = 'flex';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.style.zIndex = '9999';
            document.body.appendChild(modal);
        }
        modal.innerHTML = `<div style=\"background:#fff;padding:24px 32px;border-radius:8px;min-width:260px;max-width:90vw;box-shadow:0 2px 16px #0002;position:relative;\">\n            <button id=\"close-user-info-modal\" style=\"position:absolute;top:8px;right:12px;font-size:20px;background:none;border:none;cursor:pointer;\">&times;</button>\n            <h3 style=\"margin-top:0\">Thông tin cá nhân</h3>\n            <div style=\"margin:12px 0 0 0;font-size:16px;\">${html}</div>\n        </div>`;
        modal.style.display = 'flex';
        document.getElementById('close-user-info-modal').onclick = () => { modal.style.display = 'none'; };
        modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    }
    // Load any market orders that have been shipped to this daily so they can confirm receipt
    try { loadMarketOrdersForDaily(); } catch (e) { /* ignore */ }
    // Load incoming retail orders from supermarkets
    try { loadRetailOrdersForDaily(); } catch (e) { /* ignore */ }
    // Khởi tạo nút chuyển tab Đơn nhập/Đơn bán lẻ nếu có
    try {
        const tabImport = document.getElementById('tab-orders-import');
        const tabRetail = document.getElementById('tab-orders-retail');
        const panelImport = document.getElementById('orders-import');
        const panelRetail = document.getElementById('orders-retail');
        function showOrdersTab(t) {
            if (!panelImport || !panelRetail || !tabImport || !tabRetail) return;
            const btnCreateOrder = document.getElementById('btn-create-order');
            if (t === 'retail') {
                panelImport.style.display = 'none';
                panelRetail.style.display = '';
                tabImport.classList.remove('active');
                tabRetail.classList.add('active');
                if (btnCreateOrder) btnCreateOrder.style.display = 'none';
                // render retail list when switching
                try { loadRetailOrdersForDaily(); } catch (e) {}
            } else {
                panelImport.style.display = '';
                panelRetail.style.display = 'none';
                tabImport.classList.add('active');
                tabRetail.classList.remove('active');
                if (btnCreateOrder) btnCreateOrder.style.display = '';
                // ensure receipts are rendered
                try { renderReceiptsFromDB(); } catch (e) {}
            }
        }
        tabImport?.addEventListener('click', () => showOrdersTab('import'));
        tabRetail?.addEventListener('click', () => showOrdersTab('retail'));
        // default to import tab
        showOrdersTab('import');
        // Lắng nghe thay đổi storage để tự động cập nhật giao diện
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
    
    // Hiển thị 5 phiếu nhập gần nhất ở dashboard
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
    // Đã bỏ KPI xuất hàng (phieuXuat)
}

