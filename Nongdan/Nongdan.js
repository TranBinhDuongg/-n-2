// ========== LOCALSTORAGE HELPERS (Per-user isolation) ==========
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

function loadDailyKhos() {
    // Load kho list from daily (shared storage, not user-specific)
    return JSON.parse(localStorage.getItem('kho') || '[]');
}

// Per-user database structure
const DB = {
    farms: [],
    batches: [],
    orders: []         // orders sent/received (nhận đơn + xuất hàng)
};

function loadDB() {
    DB.farms = loadUserData('farms');
    DB.batches = loadUserData('batches');
    DB.orders = loadUserData('orders');
    // load market orders targeted to this farmer (shared global)
    try {
        const allMarket = JSON.parse(localStorage.getItem('market_orders') || '[]');
        DB.marketOrders = allMarket.filter(m => String(m.toFarmerUserId) === String(currentUser?.id));
    } catch (e) { DB.marketOrders = []; }
}

function saveDB() {
    saveUserData('farms', DB.farms);
    saveUserData('batches', DB.batches);
    saveUserData('orders', DB.orders);
}

/* ---------- KPI & Rendering ---------- */

function renderKPIs() {
    const displayName = currentUser?.fullName || 'Nông dân';
    const nameEl = document.querySelector('.sidebar-header span') || document.getElementById('current-user');
    if (nameEl) nameEl.textContent = displayName;
    document.getElementById('kpi-farms').textContent = DB.farms.length;
    document.getElementById('kpi-batches').textContent = DB.batches.length;
    document.getElementById('kpi-orders').textContent = DB.orders.length;
}

function renderFarms() {
    const tbody = document.querySelector('#table-farms tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    DB.farms.forEach(f => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${f.id}</td><td>${f.name}</td><td>${f.address}</td><td>${f.cert || '-'}</td>
            <td><button class="btn small" onclick="editFarm('${f.id}')">Sửa</button>
                <button class="btn small" onclick="deleteFarm('${f.id}')">Xóa</button></td>`;
        tbody.appendChild(tr);
    });
}

function renderBatches() {
    const tbody = document.querySelector('#table-batches tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    DB.batches.forEach(b => {
        const expiry = b.expiry || '';
        const status = getExpiryStatus(b.expiry);
        const tr = document.createElement('tr');
        tr.className = status === 'expired' ? 'critical' : (status === 'warning' ? 'warning' : '');
        tr.innerHTML = `<td>${b.id}</td><td>${b.farmName}</td><td>${b.product}</td><td>${b.quantity}</td><td>${expiry}</td><td>${status}</td>
            <td><button class="btn small" onclick="editBatch('${b.id}')">Sửa</button>
                <button class="btn small" onclick="deleteBatch('${b.id}')">Xóa</button></td>`;
        tbody.appendChild(tr);
    });
}

function renderOrders() {
    const tbody = document.querySelector('#table-orders-all tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    DB.orders.forEach(o => {
        const statusClass = o.status === 'completed' ? 'status-delivered' : 'status-in-transit';
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${o.id}</td><td>${o.batchId}</td><td>${o.quantity}</td><td>${o.recipient || o.to}</td><td>${o.kho || '-'}</td><td>${o.date}</td><td class="${statusClass}">${o.status}</td>
            <td><button class="btn small" onclick="updateOrder('${o.id}')">Cập nhật</button></td>`;
        tbody.appendChild(tr);
    });
}

function renderKhoNhap() {
    const tbody = document.querySelector('#table-kho-nhap tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    // Display farmer's own production batches as their inventory
    DB.batches.forEach(b => {
        const tr = document.createElement('tr');
        const status = b.quantity > 0 ? 'Còn hàng' : 'Hết';
        tr.innerHTML = `<td>${b.id}</td><td>${b.product}</td><td>${b.quantity}</td><td>${b.farmName || 'Chính'}</td><td>${b.expiry || '-'}</td><td>${status}</td>`;
        tbody.appendChild(tr);
    });
}

function renderKhoXuat() {
    const tbody = document.querySelector('#table-kho-xuat tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    // Display farmer's orders that have been shipped/exported
    const shipped = DB.orders.filter(o => o.status === 'completed');
    shipped.forEach(o => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${o.id}</td><td>${o.batchId}</td><td>${o.quantity}</td><td>${o.kho || '-'}</td><td>${o.date || '-'}</td>`;
        tbody.appendChild(tr);
    });
}

function renderIncomingOrders() {
    const tbody = document.querySelector('#table-incoming-orders tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const incoming = Array.isArray(DB.marketOrders) ? DB.marketOrders : [];
    incoming.forEach(m => {
        const tr = document.createElement('tr');
        const dailyName = (m.fromDailyUserId) ? (function(){
            const users = JSON.parse(localStorage.getItem('users')||'[]');
            const u = users.find(x => String(x.id) === String(m.fromDailyUserId));
            return u ? (u.fullName || u.hoTen || u.username) : (m.fromDailyUserId || 'Đại lý');
        })() : 'Đại lý';
        const status = m.status || 'pending';
        let actions = '';
        const idKey = m.uid || m.maPhieu;
        if (status === 'pending') {
            actions = `<button class="btn small" onclick="confirmIncomingOrder('${idKey}')">Xác nhận</button>`;
        } else if (status === 'preparing' || status === 'Nông dân nhận đơn') {
            // when farmer has accepted the order show 'Xuất đơn' so they can ship to the Daily
            actions = `<button class="btn small" onclick="openShipModal('${idKey}')">Xuất đơn</button>`;
        } else if (status === 'shipped') {
            actions = `<span>Đã xuất</span>`;
        } else if (status === 'received') {
            actions = `<span>Đã nhận bởi Đại lý</span>`;
        }

        tr.innerHTML = `<td>${m.maPhieu || ''}</td><td>${m.maLo || ''} — ${m.sanPham || ''}</td><td>${m.soLuong}</td><td>${dailyName}</td><td>${(m.ngayTao||'')}</td><td>${status}</td><td>${actions}</td>`;
        tbody.appendChild(tr);
    });
}

window.confirmIncomingOrder = function(idKey) {
    console.debug('confirmIncomingOrder called with idKey=', idKey);
    const all = JSON.parse(localStorage.getItem('market_orders') || '[]');
    console.debug('market_orders current:', all);
    const idx = all.findIndex(x => (String(x.uid) === String(idKey) || String(x.maPhieu) === String(idKey)) && String(x.toFarmerUserId) === String(currentUser?.id));
    console.debug('found index=', idx);
    if (idx === -1) return alert('Không tìm thấy đơn');
    // mark that farmer accepted the order
    all[idx].status = 'Nông dân nhận đơn';
    localStorage.setItem('market_orders', JSON.stringify(all));
    // reload local view
    DB.marketOrders = all.filter(m => String(m.toFarmerUserId) === String(currentUser?.id));
    renderIncomingOrders();
    console.debug('market_orders after confirm:', all);
    alert('Đã xác nhận nhận đơn, đang chuẩn bị.');
};

window.openShipModal = function(idKey) {
    openModal(`
        <h3>Xuất đơn</h3>
        <label>Ngày gửi</label><input id="ship-date" type="date" />
        <label>Ghi chú</label><input id="ship-note" />
        <div style="margin-top:10px"><button onclick="shipIncomingOrder('${idKey}')" class="btn">Xuất</button> <button onclick="closeModal()" class="btn">Hủy</button></div>
    `);
};

window.shipIncomingOrder = function(idKey) {
    console.debug('shipIncomingOrder called with idKey=', idKey);
    const date = document.getElementById('ship-date')?.value || new Date().toLocaleDateString();
    const note = document.getElementById('ship-note')?.value || '';
    const all = JSON.parse(localStorage.getItem('market_orders') || '[]');
    console.debug('market_orders current:', all);
    const idx = all.findIndex(x => (String(x.uid) === String(idKey) || String(x.maPhieu) === String(idKey)) && String(x.toFarmerUserId) === String(currentUser?.id));
    console.debug('found index=', idx);
    if (idx === -1) {
        console.warn('shipIncomingOrder: order not found for', idKey);
        return alert('Không tìm thấy đơn');
    }
    const ord = all[idx];
    // mark as shipped and waiting for quality check
    ord.status = 'Đang chờ kiểm định';
    ord.shipInfo = { ngayGui: date, note };
    localStorage.setItem('market_orders', JSON.stringify(all));
    // Notify the target Daily: create a receipt (phieuNhap) and a kiemDinh entry
    try {
        const dailyId = ord.fromDailyUserId || ord.fromDaily || ord.toDailyUserId || ord.toDaily;
            if (dailyId) {
            // update per-user phieuNhap for the Daily if exists, otherwise create
            const phieuKey = `user_${dailyId}_phieuNhap`;
            const existingPhieu = JSON.parse(localStorage.getItem(phieuKey) || '[]');
            const found = existingPhieu.find(p => String(p.maPhieu) === String(ord.maPhieu));
            if (found) {
                // update existing receipt status and fields
                found.status = 'Đang chờ kiểm định';
                found.maLo = ord.maLo || found.maLo;
                found.sanPham = ord.sanPham || found.sanPham;
                found.soLuong = parseFloat(ord.soLuong) || found.soLuong;
                found.khoNhap = ord.khoNhap || found.khoNhap;
                found.ghiChu = (found.ghiChu || '') + ' (Cập nhật: Nông dân đã giao)';
            } else {
                const newPhieu = {
                    maPhieu: ord.maPhieu || `PN${Date.now()}`,
                    maLo: ord.maLo || '',
                    maNongUserId: currentUser?.id || '',
                    tenNong: currentUser?.fullName || currentUser?.hoTen || '',
                    sanPham: ord.sanPham || '',
                    soLuong: parseFloat(ord.soLuong) || 0,
                    khoNhap: ord.khoNhap || '',
                    ngayNhap: new Date().toLocaleDateString(),
                    ghiChu: 'Tạo tự động khi nông dân giao: ' + (ord.maPhieu || ''),
                    status: 'Đang chờ kiểm định'
                };
                existingPhieu.push(newPhieu);
            }
            localStorage.setItem(phieuKey, JSON.stringify(existingPhieu));

            // create per-user kiemDinh for the Daily if not exists for this maPhieu
            const kdKey = `user_${dailyId}_kiemDinh`;
            const existingKd = JSON.parse(localStorage.getItem(kdKey) || '[]');
            const hasKd = existingKd.some(k => String(k.maLo) === String(ord.maLo) && (k.ghiChu||'').includes(ord.maPhieu));
            if (!hasKd) {
                const maKiemDinh = 'KD' + Date.now() + Math.random().toString(36).slice(2,5);
                existingKd.push({ maKiemDinh, maLo: ord.maLo || '', ngayKiem: '', nguoiKiem: '', ketQua: 'Chưa kiểm', ghiChu: 'Tạo tự động sau khi nông dân giao: ' + (ord.maPhieu || '') });
                localStorage.setItem(kdKey, JSON.stringify(existingKd));
            }
        }
    } catch (e) { console.warn('notify daily creation failed', e); }
    // Decrease stock for the shipped batch both in per-user DB and shared lohang
    try {
        const shippedQty = parseFloat(ord.soLuong) || 0;
        // 1) Try to reduce in per-user DB.batches by exact id match
        let reduced = false;
        let batch = DB.batches.find(b => String(b.id) === String(ord.maLo));
        // 2) Fallback: match by product name and sufficient quantity
        if (!batch) {
            batch = DB.batches.find(b => String(b.product) === String(ord.sanPham) && (parseFloat(b.quantity) || 0) >= shippedQty);
        }
        // 3) Another fallback: match by product name regardless of quantity
        if (!batch) {
            batch = DB.batches.find(b => String(b.product) === String(ord.sanPham));
        }
        if (batch) {
            batch.quantity = Math.max(0, (parseFloat(batch.quantity) || 0) - shippedQty);
            reduced = true;
        }

        // decrease in shared lohang (try exact maLo first)
        const allLohang = JSON.parse(localStorage.getItem('lohang') || '[]');
        let lo = allLohang.find(l => String(l.maLo) === String(ord.maLo));
        if (!lo) {
            // fallback: match by product + farmer id
            lo = allLohang.find(l => String(l.sanPham) === String(ord.sanPham) && (String(l.maNong) === String(currentUser?.maNong) || String(l.maNong) === String(currentUser?.id)));
        }
        if (lo) {
            lo.soLuong = Math.max(0, (parseFloat(lo.soLuong) || 0) - shippedQty);
            reduced = true;
        }
        // persist changes
        localStorage.setItem('lohang', JSON.stringify(allLohang));
        saveDB();
        // record exported order into farmer's DB.orders
        try {
            const outId = 'O' + Date.now();
            DB.orders.push({ id: outId, batchId: ord.maLo || (batch && batch.id) || '', quantity: shippedQty, recipient: ord.fromDailyUserId || ord.to, kho: ord.khoNhap || '', date, status: 'completed' });
            saveDB();
        } catch (e) { console.warn('failed to record DB.orders', e); }
    } catch (e) { console.warn('Error adjusting stock on ship', e); }

    DB.marketOrders = all.filter(m => String(m.toFarmerUserId) === String(currentUser?.id));
    renderIncomingOrders();
    renderBatches();
    renderKhoNhap();
    renderReports();
    closeModal();
    console.debug('market_orders after ship:', all);
    alert('Đã xuất đơn và chuyển cho Đại lý. Số lượng trong lô đã được cập nhật.');
};

function renderReports() {
    const totalProduction = DB.batches.reduce((sum, b) => sum + (parseFloat(b.quantity) || 0), 0);
    const totalOrdered = DB.orders.filter(o => o.status === 'completed').reduce((sum, o) => sum + (parseFloat(o.quantity) || 0), 0);
    const inStock = totalProduction - totalOrdered;
    
    const el1 = document.getElementById('report-production');
    const el2 = document.getElementById('report-shipped');
    const el3 = document.getElementById('report-stock');
    
    if (el1) el1.textContent = totalProduction + ' đơn vị';
    if (el2) el2.textContent = totalOrdered + ' đơn vị';
    if (el3) el3.textContent = inStock + ' đơn vị';
}

function getExpiryStatus(expiry) {
    if (!expiry) return 'ok';
    const now = new Date();
    const d = new Date(expiry);
    const diffDays = Math.ceil((d - now) / (1000*60*60*24));
    if (diffDays < 0) return 'expired';
    if (diffDays <= 7) return 'warning';
    return 'ok';
}

/* ---------- Modal ---------- */

function openModal(html) {
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
}

document.addEventListener('click', (e) => {
    if (e.target.matches('.modal-close')) closeModal();
});

/* ---------- Farms Management ---------- */

document.getElementById('btn-new-farm')?.addEventListener('click', () => {
    openModal(`
        <h3>Thêm trang trại mới</h3>
        <label>Tên</label><input id="farm-name" />
        <label>Địa chỉ</label><input id="farm-address" />
        <label>Chứng nhận (VietGAP/...)</label><input id="farm-cert" />
        <div style="margin-top:10px">
            <button onclick="saveFarm()" class="btn">Tạo</button>
            <button onclick="closeModal()" class="btn" style="background:#ccc;color:#333;">Hủy</button>
        </div>
    `);
});

window.editFarm = function(id) {
    const farm = DB.farms.find(f => f.id === id);
    if (!farm) return;
    openModal(`
        <h3>Sửa trang trại</h3>
        <label>Tên</label><input id="farm-name" value="${farm.name}" />
        <label>Địa chỉ</label><input id="farm-address" value="${farm.address}" />
        <label>Chứng nhận</label><input id="farm-cert" value="${farm.cert || ''}" />
        <div style="margin-top:10px">
            <button onclick="saveFarm('${id}')" class="btn">Lưu</button>
            <button onclick="closeModal()" class="btn" style="background:#ccc;color:#333;">Hủy</button>
        </div>
    `);
};

window.saveFarm = function(id = null) {
    const name = document.getElementById('farm-name').value;
    const address = document.getElementById('farm-address').value;
    const cert = document.getElementById('farm-cert').value;
    
    if (!name) { alert('Vui lòng nhập tên trang trại'); return; }
    
    if (id) {
        const farm = DB.farms.find(f => f.id === id);
        if (farm) { farm.name = name; farm.address = address; farm.cert = cert; }
    } else {
        DB.farms.push({ id: 'F' + Date.now(), name, address, cert });
    }
    saveDB();
    renderFarms();
    renderKPIs();
    closeModal();
};

window.deleteFarm = function(id) {
    if (confirm('Xác nhận xóa trang trại này?')) {
        DB.farms = DB.farms.filter(f => f.id !== id);
        saveDB();
        renderFarms();
        renderKPIs();
    }
};

/* ---------- Batches Management ---------- */

document.querySelectorAll('#btn-new-batch').forEach(btn => btn.addEventListener('click', () => {
    const farmOptions = DB.farms.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
    openModal(`
        <h3>Đăng ký lô sản phẩm</h3>
        <label>Trang trại</label>
        <select id="batch-farm">${farmOptions || '<option>Chưa có trang trại</option>'}</select>
        <label>Sản phẩm</label><input id="batch-product" />
        <label>Số lượng</label><input id="batch-qty" type="number" />
        <label>Ngày thu hoạch</label><input id="batch-harvest" type="date" />
        <label>Hạn dùng</label><input id="batch-expiry" type="date" />
        <div style="margin-top:10px">
            <button onclick="saveBatch()" class="btn">Tạo lô</button>
            <button onclick="closeModal()" class="btn" style="background:#ccc;color:#333;">Hủy</button>
        </div>
    `);
}));

window.saveBatch = function(id = null) {
    const farmId = document.getElementById('batch-farm').value;
    const farm = DB.farms.find(f => f.id === farmId) || { name: 'N/A' };
    const product = document.getElementById('batch-product').value;
    const qty = parseFloat(document.getElementById('batch-qty').value) || 0;
    const harvest = document.getElementById('batch-harvest').value;
    const expiry = document.getElementById('batch-expiry').value;
    
    if (!product || !qty) { alert('Vui lòng nhập sản phẩm và số lượng'); return; }
    
    if (id) {
        const batch = DB.batches.find(b => b.id === id);
        if (batch) { batch.farmId = farmId; batch.farmName = farm.name; batch.product = product; batch.quantity = qty; batch.harvest = harvest; batch.expiry = expiry; }
        // also update shared lohang (global) so others (Daily) can see this batch
        try {
            const all = JSON.parse(localStorage.getItem('lohang') || '[]');
            const lo = all.find(x => String(x.maLo) === String(id));
            if (lo) {
                lo.sanPham = product;
                lo.maNong = currentUser?.maNong || currentUser?.id || lo.maNong;
                lo.soLuong = qty;
                lo.ngayTao = harvest;
                lo.hanDung = expiry;
            } else {
                all.push({ maLo: id, sanPham: product, maNong: currentUser?.maNong || currentUser?.id || '', soLuong: qty, ngayTao: harvest, hanDung: expiry });
            }
            localStorage.setItem('lohang', JSON.stringify(all));
        } catch (e) { /* ignore */ }
    } else {
        const newId = 'B' + Date.now();
        DB.batches.push({ id: newId, farmId, farmName: farm.name, product, quantity: qty, harvest, expiry });
        // also add to shared lohang so Daily can suggest this product
        try {
            const all = JSON.parse(localStorage.getItem('lohang') || '[]');
            all.push({ maLo: newId, sanPham: product, maNong: currentUser?.maNong || currentUser?.id || '', soLuong: qty, ngayTao: harvest, hanDung: expiry });
            localStorage.setItem('lohang', JSON.stringify(all));
        } catch (e) { /* ignore */ }
    }
    saveDB();
    renderBatches();
    renderKPIs();
    renderReports();
    closeModal();
};

window.editBatch = function(id) {
    const batch = DB.batches.find(b => b.id === id);
    if (!batch) return;
    const farmOptions = DB.farms.map(f => `<option value="${f.id}" ${f.id === batch.farmId ? 'selected' : ''}>${f.name}</option>`).join('');
    openModal(`
        <h3>Sửa lô sản phẩm</h3>
        <label>Trang trại</label>
        <select id="batch-farm">${farmOptions}</select>
        <label>Sản phẩm</label><input id="batch-product" value="${batch.product}" />
        <label>Số lượng</label><input id="batch-qty" type="number" value="${batch.quantity}" />
        <label>Ngày thu hoạch</label><input id="batch-harvest" type="date" value="${batch.harvest || ''}" />
        <label>Hạn dùng</label><input id="batch-expiry" type="date" value="${batch.expiry || ''}" />
        <div style="margin-top:10px">
            <button onclick="saveBatch('${id}')" class="btn">Lưu</button>
            <button onclick="closeModal()" class="btn" style="background:#ccc;color:#333;">Hủy</button>
        </div>
    `);
};

window.deleteBatch = function(id) {
    if (confirm('Xác nhận xóa lô hàng này?')) {
        DB.batches = DB.batches.filter(b => b.id !== id);
        saveDB();
        renderBatches();
        renderKPIs();
        renderReports();
        // remove from shared lohang as well
        try {
            const all = JSON.parse(localStorage.getItem('lohang') || '[]');
            const remaining = all.filter(x => String(x.maLo) !== String(id));
            localStorage.setItem('lohang', JSON.stringify(remaining));
        } catch (e) { /* ignore */ }
    }
};

/* ---------- Orders Management (nhận đơn hàng + xuất hàng) ---------- */

document.getElementById('btn-new-order')?.addEventListener('click', () => {
    const batchOptions = DB.batches.map(b => `<option value="${b.id}">${b.product} (${b.quantity} đơn vị)</option>`).join('');
    const khoOptions = loadDailyKhos().map(k => `<option value="${k.maKho}">${k.tenKho}</option>`).join('');
    const today = new Date().toISOString().split('T')[0];
    
    openModal(`
        <h3>Xuất hàng (Tạo đơn hàng)</h3>
        <label>Lô sản phẩm</label>
        <select id="order-batch">${batchOptions || '<option>Chưa có lô</option>'}</select>
        <label>Số lượng xuất</label><input id="order-qty" type="number" min="1" />
        <label>Người/Địa chỉ nhận</label><input id="order-recipient" placeholder="Tên người nhận hoặc địa chỉ" />
        <label>Kho xuất (chọn từ Đại lý)</label>
        <select id="order-kho">${khoOptions || '<option value="">Chưa có kho</option>'}</select>
        <label>Ngày xuất</label><input id="order-date" type="date" value="${today}" />
        <div style="margin-top:10px">
            <button onclick="saveOrder()" class="btn">Xuất hàng</button>
            <button onclick="closeModal()" class="btn" style="background:#ccc;color:#333;">Hủy</button>
        </div>
    `);
});

window.saveOrder = function(id = null) {
    const batchId = document.getElementById('order-batch').value;
    const qty = parseFloat(document.getElementById('order-qty').value) || 0;
    const recipient = document.getElementById('order-recipient').value;
    const kho = document.getElementById('order-kho').value;
    const date = document.getElementById('order-date').value;
    
    const batch = DB.batches.find(b => b.id === batchId);
    if (!batch || !qty || !recipient) { alert('Vui lòng nhập đầy đủ thông tin'); return; }
    
    if (id) {
        const order = DB.orders.find(o => o.id === id);
        if (order) { order.quantity = qty; order.recipient = recipient; order.kho = kho; order.date = date; }
    } else {
        DB.orders.push({ id: 'O' + Date.now(), batchId, product: batch.product, quantity: qty, recipient, kho, date, status: 'pending' });
    }
    saveDB();
    renderOrders();
    renderKPIs();
    renderReports();
    closeModal();
};

window.updateOrder = function(id) {
    const order = DB.orders.find(o => o.id === id);
    if (!order) return;
    const newStatus = order.status === 'pending' ? 'completed' : 'pending';
    order.status = newStatus;
    saveDB();
    renderOrders();
    renderReports();
};

/* ---------- Navigation ---------- */

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

/* ---------- Initialize ---------- */

function refreshAll() {
    renderFarms();
    renderBatches();
    renderOrders();
    renderIncomingOrders();
    renderKhoNhap();
    renderKhoXuat();
    renderKPIs();
    renderReports();
}

window.addEventListener('DOMContentLoaded', () => {
    loadCurrentUser();
    loadDB();
    
    // Display current user info
    const userDisplay = document.getElementById('current-user');
    if (userDisplay && currentUser) {
        userDisplay.innerHTML = `<strong>👤 ${currentUser.fullName || 'Nông dân'}</strong>`;
    }
    
    refreshAll();
});
