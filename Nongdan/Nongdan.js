const DB = {
    farms: JSON.parse(localStorage.getItem('farms') || '[]'),
    batches: JSON.parse(localStorage.getItem('batches') || '[]'),
    shipments: JSON.parse(localStorage.getItem('shipments') || '[]'),
};

function saveDB() {
    Object.keys(DB).forEach(k => localStorage.setItem(k, JSON.stringify(DB[k])));
}

/* ---------- KPI & Rendering ---------- */

function renderKPIs() {
    document.getElementById('kpi-farms').textContent = DB.farms.length;
    document.getElementById('kpi-batches').textContent = DB.batches.length;
    document.getElementById('kpi-shipments').textContent = DB.shipments.length;
}

function renderFarms() {
    const tbody = document.querySelector('#table-farms tbody');
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

function renderShipments() {
    const tbody = document.querySelector('#table-shipments tbody');
    tbody.innerHTML = '';
    DB.shipments.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${s.id}</td><td>${s.batchId}</td><td>${s.quantity}</td><td>${s.to}</td><td>${s.date}</td><td>${s.status}</td>
            <td><button class="btn small" onclick="updateShipment('${s.id}')">Cập nhật</button></td>`;
        tbody.appendChild(tr);
    });
}

function renderReports() {
    const totalProduction = DB.batches.reduce((sum, b) => sum + (parseFloat(b.quantity) || 0), 0);
    const totalShipped = DB.shipments.filter(s => s.status === 'delivered').reduce((sum, s) => sum + (parseFloat(s.quantity) || 0), 0);
    const inStock = totalProduction - totalShipped;
    
    document.getElementById('report-production').textContent = totalProduction + ' đơn vị';
    document.getElementById('report-shipped').textContent = totalShipped + ' đơn vị';
    document.getElementById('report-stock').textContent = inStock + ' đơn vị';
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
        farm.name = name;
        farm.address = address;
        farm.cert = cert;
    } else {
        DB.farms.push({
            id: 'FARM-' + Date.now(),
            name,
            address,
            cert
        });
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

document.getElementById('btn-new-batch')?.addEventListener('click', () => {
    const farmOptions = DB.farms.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
    openModal(`
        <h3>Đăng ký lô sản phẩm</h3>
        <label>Trang trại</label>
        <select id="batch-farm">${farmOptions}</select>
        <label>Sản phẩm</label><input id="batch-product" />
        <label>Số lượng</label><input id="batch-qty" type="number" />
        <label>Ngày thu hoạch</label><input id="batch-harvest" type="date" />
        <label>Hạn dùng</label><input id="batch-expiry" type="date" />
        <div style="margin-top:10px">
            <button onclick="saveBatch()" class="btn">Tạo lô</button>
            <button onclick="closeModal()" class="btn" style="background:#ccc;color:#333;">Hủy</button>
        </div>
    `);
});

window.saveBatch = function(id = null) {
    const farmId = document.getElementById('batch-farm').value;
    const farm = DB.farms.find(f => f.id === farmId) || { name: 'N/A' };
    const product = document.getElementById('batch-product').value;
    const qty = parseFloat(document.getElementById('batch-qty').value) || 0;
    const harvest = document.getElementById('batch-harvest').value;
    const expiry = document.getElementById('batch-expiry').value;
    
    if (!product || !qty) { alert('Vui lòng nhập đầy đủ thông tin'); return; }
    
    if (id) {
        const batch = DB.batches.find(b => b.id === id);
        batch.farmId = farmId;
        batch.farmName = farm.name;
        batch.product = product;
        batch.quantity = qty;
        batch.harvest = harvest;
        batch.expiry = expiry;
    } else {
        DB.batches.push({
            id: 'BATCH-' + Date.now(),
            farmId,
            farmName: farm.name,
            product,
            quantity: qty,
            harvest,
            expiry
        });
    }
    saveDB();
    renderBatches();
    renderKPIs();
    renderReports();
    closeModal();
};

window.editBatch = function(id) {
    const batch = DB.batches.find(b => b.id === id);
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
    if (confirm('Xác nhận xóa lô này?')) {
        DB.batches = DB.batches.filter(b => b.id !== id);
        saveDB();
        renderBatches();
        renderKPIs();
        renderReports();
    }
};

/* ---------- Shipments Management ---------- */

document.getElementById('btn-new-shipment')?.addEventListener('click', () => {
    const batchOptions = DB.batches.map(b => `<option value="${b.id}">${b.id} - ${b.product}</option>`).join('');
    openModal(`
        <h3>Tạo phiếu xuất hàng</h3>
        <label>Lô sản phẩm</label>
        <select id="ship-batch">${batchOptions}</select>
        <label>Số lượng xuất</label><input id="ship-qty" type="number" />
        <label>Người nhận</label><input id="ship-to" />
        <label>Địa chỉ giao hàng</label><input id="ship-address" />
        <div style="margin-top:10px">
            <button onclick="saveShipment()" class="btn">Tạo phiếu</button>
            <button onclick="closeModal()" class="btn" style="background:#ccc;color:#333;">Hủy</button>
        </div>
    `);
});

window.saveShipment = function(id = null) {
    const batchId = document.getElementById('ship-batch').value;
    const qty = parseFloat(document.getElementById('ship-qty').value) || 0;
    const to = document.getElementById('ship-to').value;
    const address = document.getElementById('ship-address').value;
    
    if (!batchId || !qty || !to) { alert('Vui lòng nhập đầy đủ thông tin'); return; }
    
    if (id) {
        const shipment = DB.shipments.find(s => s.id === id);
        shipment.batchId = batchId;
        shipment.quantity = qty;
        shipment.to = to;
        shipment.address = address;
    } else {
        DB.shipments.push({
            id: 'SHIP-' + Date.now(),
            batchId,
            quantity: qty,
            to,
            address,
            date: new Date().toISOString().slice(0, 10),
            status: 'in-transit'
        });
    }
    saveDB();
    renderShipments();
    renderKPIs();
    renderReports();
    closeModal();
};

window.updateShipment = function(id) {
    const shipment = DB.shipments.find(s => s.id === id);
    openModal(`
        <h3>Cập nhật phiếu xuất</h3>
        <p><strong>Lô:</strong> ${shipment.batchId}</p>
        <p><strong>Số lượng:</strong> ${shipment.quantity}</p>
        <p><strong>Người nhận:</strong> ${shipment.to}</p>
        <label>Trạng thái</label>
        <select id="ship-status">
            <option value="in-transit" ${shipment.status === 'in-transit' ? 'selected' : ''}>Đang vận chuyển</option>
            <option value="delivered" ${shipment.status === 'delivered' ? 'selected' : ''}>Đã giao</option>
        </select>
        <div style="margin-top:10px">
            <button onclick="confirmShipment('${id}')" class="btn">Lưu</button>
            <button onclick="closeModal()" class="btn" style="background:#ccc;color:#333;">Hủy</button>
        </div>
    `);
};

window.confirmShipment = function(id) {
    const status = document.getElementById('ship-status').value;
    const shipment = DB.shipments.find(s => s.id === id);
    shipment.status = status;
    saveDB();
    renderShipments();
    renderReports();
    closeModal();
};

/* ---------- Navigation ---------- */

document.querySelectorAll('.menu-link[data-section]').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.menu-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active-page'));
        const section = link.dataset.section;
        document.getElementById(section).classList.add('active-page');
    });
});

/* ---------- Initialize ---------- */

function refreshAll() {
    renderKPIs();
    renderFarms();
    renderBatches();
    renderShipments();
    renderReports();
}

window.addEventListener('DOMContentLoaded', () => {
    refreshAll();
});