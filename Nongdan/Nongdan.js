/*
  Mô phỏng dữ liệu bằng localStorage để minh họa:
  - farms, batches, shipments, warehouses, inspections, audit
  - QR generation via quickchart.io
  - Alerts: phát hiện lô gần tới hạn / quá hạn
*/

const DB = {
    farms: JSON.parse(localStorage.getItem('farms') || '[]'),
    batches: JSON.parse(localStorage.getItem('batches') || '[]'),
    shipments: JSON.parse(localStorage.getItem('shipments') || '[]'),
    warehouses: JSON.parse(localStorage.getItem('warehouses') || '[]'),
    inspections: JSON.parse(localStorage.getItem('inspections') || '[]'),
    audit: JSON.parse(localStorage.getItem('audit') || '[]'),
};

function saveDB() {
    Object.keys(DB).forEach(k => localStorage.setItem(k, JSON.stringify(DB[k])));
}

function logAudit(user, action, detail) {
    const entry = { time: new Date().toISOString(), user: user || 'system', action, detail };
    DB.audit.unshift(entry);
    if (DB.audit.length > 200) DB.audit.pop();
    saveDB();
    renderAudit();
}

/* ---------- Rendering ---------- */

function renderKPIs() {
    document.getElementById('kpi-farms').textContent = DB.farms.length;
    document.getElementById('kpi-batches').textContent = DB.batches.length;
    document.getElementById('kpi-inspections').textContent = DB.inspections.length;
    const alerts = getAlerts();
    document.getElementById('kpi-alerts').textContent = alerts.length;
}

function renderFarms() {
    const tbody = document.querySelector('#table-farms tbody');
    tbody.innerHTML = '';
    DB.farms.forEach(f => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${f.id}</td><td>${f.name}</td><td>${f.address}</td><td>${f.cert || '-'}</td>
            <td><button class="btn small" data-id="${f.id}" onclick="editFarm('${f.id}')">Sửa</button></td>`;
        tbody.appendChild(tr);
    });
}

function renderBatches() {
    const tbody = document.querySelector('#table-batches tbody');
    tbody.innerHTML = '';
    DB.batches.forEach(b => {
        const expiry = b.expiry || '';
        const qUrl = encodeURIComponent(JSON.stringify({ batchId: b.id }));
        const qrSrc = `https://quickchart.io/qr?text=${qUrl}&size=200`;
        const tr = document.createElement('tr');
        tr.className = isExpiredRow(b) ? 'critical' : '';
        tr.innerHTML = `<td>${b.id}</td><td>${b.farmName}</td><td>${b.product}</td><td>${b.quantity}</td><td>${expiry}</td>
            <td><img src="${qrSrc}" alt="QR" style="width:48px;height:48px"></td>
            <td>
                <button class="btn small" onclick="viewBatch('${b.id}')">Xem</button>
                <button class="btn small" onclick="generateQrForBatch('${b.id}')">QR</button>
            </td>`;
        tbody.appendChild(tr);
    });
}

function renderShipments() {
    const t1 = document.querySelector('#table-shipments tbody');
    if (t1) t1.innerHTML = '';
    const t2 = document.querySelector('#table-shipments-all tbody');
    if (t2) t2.innerHTML = '';
    DB.shipments.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${s.id}</td><td>${s.from}</td><td>${s.to}</td><td>${s.date}</td><td>${s.status}</td>
            <td><button class="btn small" onclick="markShipmentDelivered('${s.id}')">Đã giao</button></td>`;
        if (t1) t1.appendChild(tr);
        if (t2) t2.appendChild(tr.cloneNode(true));
    });
}

function renderWarehouses() {
    const tbody = document.querySelector('#table-warehouses tbody');
    tbody.innerHTML = '';
    DB.warehouses.forEach(w => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${w.id}</td><td>${w.name}</td><td>${w.location}</td><td>${w.capacity || '-'}</td>`;
        tbody.appendChild(tr);
    });
}

function renderInspections() {
    const tbody = document.querySelector('#table-inspections tbody');
    tbody.innerHTML = '';
    DB.inspections.forEach(i => {
        const sig = i.signature ? '<i class="fas fa-check-circle" title="Đã ký"></i>' : '-';
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${i.id}</td><td>${i.batchId}</td><td>${i.result}</td><td>${i.signedBy||'-'}</td><td>${i.date}</td><td>${sig}</td>`;
        tbody.appendChild(tr);
    });
}

function renderReports() {
    // Very simple aggregates
    const prod = DB.batches.reduce((s,b)=>s+(parseFloat(b.quantity)||0),0);
    const stock = DB.batches.length;
    document.getElementById('report-production').textContent = prod + ' đơn vị';
    document.getElementById('report-stock').textContent = stock + ' lô';
}

function renderAudit() {
    const tbody = document.querySelector('#table-audit tbody');
    tbody.innerHTML = '';
    DB.audit.forEach(a => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${new Date(a.time).toLocaleString()}</td><td>${a.user}</td><td>${a.action}</td><td>${a.detail}</td>`;
        tbody.appendChild(tr);
    });
}

function renderAlertsTable() {
    const rows = document.querySelectorAll('#table-alerts tbody, #table-alerts-all tbody');
    rows.forEach(tbody => tbody.innerHTML = '');
    const alerts = getAlerts(true);
    const target = document.querySelector('#table-alerts tbody');
    alerts.forEach(a => {
        const tr = document.createElement('tr');
        tr.className = a.level === 'critical' ? 'critical' : '';
        tr.innerHTML = `<td>${a.id}</td><td>${a.product}</td><td>${a.expiry}</td><td>${a.diffDays} ngày</td><td>${a.level}</td>`;
        if (target) target.appendChild(tr);
        const allTarget = document.querySelector('#table-alerts-all tbody');
        if (allTarget) allTarget.appendChild(tr.cloneNode(true));
    });
}

function isExpiredRow(batch) {
    if (!batch.expiry) return false;
    const d = new Date(batch.expiry);
    const now = new Date();
    const diff = (d - now) / (1000*60*60*24);
    return diff <= 3; // highlight if <= 3 days
}

function getAlerts(full=false) {
    const now = new Date();
    const list = DB.batches.map(b => {
        if (!b.expiry) return null;
        const d = new Date(b.expiry);
        const diffDays = Math.ceil( (d - now) / (1000*60*60*24) );
        const level = diffDays < 0 ? 'expired' : (diffDays <= 3 ? 'critical' : (diffDays <= 7 ? 'warning' : 'ok'));
        return { id: b.id, product: b.product, expiry: b.expiry, diffDays, level };
    }).filter(Boolean);
    return full ? list.filter(l => l.level !== 'ok') : list.filter(l => l.level !== 'ok').slice(0,5);
}

/* ---------- Actions / Modals ---------- */

function openModal(html) {
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
    document.getElementById('modal-body').innerHTML = '';
}

document.addEventListener('click', (e)=>{
    if (e.target.matches('.modal-close')) closeModal();
});

window.editFarm = function(id) {
    const farm = DB.farms.find(f => f.id === id);
    openModal(`
        <h3>Sửa trang trại</h3>
        <label>Tên</label><input id="farm-name" value="${farm.name}" />
        <label>Địa chỉ</label><input id="farm-address" value="${farm.address}" />
        <label>Chứng nhận</label><input id="farm-cert" value="${farm.cert || ''}" />
        <div style="margin-top:10px">
            <button onclick="saveFarm('${farm.id}')" class="btn">Lưu</button>
        </div>
    `);
}

window.saveFarm = function(id) {
    const name = document.getElementById('farm-name').value;
    const addr = document.getElementById('farm-address').value;
    const cert = document.getElementById('farm-cert').value;
    const farm = DB.farms.find(f => f.id === id);
    farm.name = name; farm.address = addr; farm.cert = cert;
    saveDB(); renderFarms(); renderKPIs(); logAudit('Người dùng','Sửa trang trại', id);
    closeModal();
}

function createId(prefix) {
    return prefix + '-' + Math.random().toString(36).slice(2,8).toUpperCase();
}

/* New Farm */
document.getElementById('btn-new-farm')?.addEventListener('click', ()=>{
    openModal(`
        <h3>Thêm trang trại mới</h3>
        <label>Tên</label><input id="farm-name" />
        <label>Địa chỉ</label><input id="farm-address" />
        <label>Chứng nhận (VietGAP/...)</label><input id="farm-cert" />
        <div style="margin-top:10px">
            <button onclick="addFarm()" class="btn">Tạo</button>
        </div>
    `);
});

window.addFarm = function() {
    const name = document.getElementById('farm-name').value || 'Farm';
    const addr = document.getElementById('farm-address').value || '-';
    const cert = document.getElementById('farm-cert').value || '';
    const id = createId('FARM');
    DB.farms.push({ id, name, address: addr, cert });
    saveDB(); renderFarms(); renderKPIs(); logAudit('Người dùng','Tạo trang trại', id);
    closeModal();
};

/* New Batch */
document.getElementById('btn-new-batch')?.addEventListener('click', openBatchModal);
document.getElementById('btn-new-batch-2')?.addEventListener('click', openBatchModal);

function openBatchModal(){
    const farmOptions = DB.farms.map(f=>`<option value="${f.id}">${f.name}</option>`).join('');
    openModal(`
        <h3>Đăng ký lô nông sản</h3>
        <label>Trang trại</label>
        <select id="batch-farm">${farmOptions}</select>
        <label>Sản phẩm</label><input id="batch-product" />
        <label>Số lượng</label><input id="batch-qty" type="number" />
        <label>Ngày thu hoạch</label><input id="batch-harvest" type="date" />
        <label>Hạn dùng</label><input id="batch-expiry" type="date" />
        <div style="margin-top:10px">
            <button onclick="addBatch()" class="btn">Tạo lô</button>
        </div>
    `);
}

window.addBatch = function() {
    const farmId = document.getElementById('batch-farm').value;
    const farm = DB.farms.find(f=>f.id===farmId) || {name: 'N/A'};
    const product = document.getElementById('batch-product').value || 'Sản phẩm';
    const qty = document.getElementById('batch-qty').value || 0;
    const harvest = document.getElementById('batch-harvest').value || '';
    const expiry = document.getElementById('batch-expiry').value || '';
    const id = createId('BATCH');
    DB.batches.push({ id, farmId, farmName: farm.name, product, quantity: qty, harvest, expiry });
    saveDB(); renderBatches(); renderKPIs(); renderAlertsTable(); logAudit('Người dùng','Tạo lô', id);
    closeModal();
}

/* View batch / generate QR */
window.viewBatch = function(id) {
    const b = DB.batches.find(x=>x.id===id);
    const qUrl = encodeURIComponent(JSON.stringify({ batchId: b.id, farm: b.farmName, product: b.product }));
    const qrSrc = `https://quickchart.io/qr?text=${qUrl}&size=300`;
    openModal(`
        <h3>Chi tiết lô ${b.id}</h3>
        <p><strong>Trang trại:</strong> ${b.farmName}</p>
        <p><strong>Sản phẩm:</strong> ${b.product}</p>
        <p><strong>Số lượng:</strong> ${b.quantity}</p>
        <p><strong>Hạn dùng:</strong> ${b.expiry}</p>
        <div style="display:flex;gap:12px;align-items:center">
            <img src="${qrSrc}" alt="QR" style="width:160px;height:160px;border:1px solid #eee;padding:6px;background:white">
            <div>
                <button class="btn" onclick="printQr('${qrSrc}')">In tem QR</button>
                <button class="btn" onclick="openInspectionForm('${b.id}')">Tạo biên bản</button>
            </div>
        </div>
    `);
}

window.generateQrForBatch = function(id) { viewBatch(id); }
window.printQr = function(src) { window.open(src,'_blank'); }

/* Shipments */
document.getElementById('btn-new-shipment')?.addEventListener('click', openShipmentModal);
document.getElementById('btn-new-shipment-2')?.addEventListener('click', openShipmentModal);

function openShipmentModal(){
    openModal(`
        <h3>Tạo vận chuyển</h3>
        <label>From</label><input id="ship-from" />
        <label>To</label><input id="ship-to" />
        <label>Danh sách lô (CSV IDs)</label><input id="ship-batches" />
        <div style="margin-top:10px">
            <button onclick="addShipment()" class="btn">Tạo</button>
        </div>
    `);
}

window.addShipment = function() {
    const from = document.getElementById('ship-from').value || '-';
    const to = document.getElementById('ship-to').value || '-';
    const batchList = (document.getElementById('ship-batches').value || '').split(',').map(s=>s.trim()).filter(Boolean);
    const id = createId('SHIP');
    const date = new Date().toISOString().slice(0,10);
    DB.shipments.push({ id, from, to, batches: batchList, date, status: 'in-transit' });
    saveDB(); renderShipments(); logAudit('Người dùng','Tạo vận chuyển', id);
    closeModal();
}

window.markShipmentDelivered = function(id) {
    const s = DB.shipments.find(x=>x.id===id);
    if (s) { s.status = 'delivered'; saveDB(); renderShipments(); logAudit('Người dùng','Cập nhật vận chuyển','Đã giao '+id); }
}

/* Warehouses */
document.getElementById('btn-new-warehouse')?.addEventListener('click', ()=>{
    openModal(`
        <h3>Thêm kho trung gian</h3>
        <label>Tên kho</label><input id="wh-name" />
        <label>Vị trí</label><input id="wh-loc" />
        <label>Sức chứa</label><input id="wh-cap" type="number" />
        <div style="margin-top:10px"><button class="btn" onclick="addWarehouse()">Tạo</button></div>
    `);
});

window.addWarehouse = function() {
    const id = createId('WH');
    DB.warehouses.push({ id, name: document.getElementById('wh-name').value||'Kho', location: document.getElementById('wh-loc').value||'-', capacity: document.getElementById('wh-cap').value||0 });
    saveDB(); renderWarehouses(); logAudit('Người dùng','Tạo kho', id); closeModal();
}

/* Inspections (with simple digital signature placeholder) */
document.getElementById('btn-new-inspection')?.addEventListener('click', ()=> openInspectionForm(''));

window.openInspectionForm = function(batchId='') {
    const batchOptions = DB.batches.map(b=>`<option value="${b.id}">${b.id} - ${b.product}</option>`).join('');
    openModal(`
        <h3>Tạo biên bản kiểm định</h3>
        <label>Lô</label>
        <select id="insp-batch">${batchOptions}<option value="${batchId}">${batchId}</option></select>
        <label>Kết quả</label><select id="insp-result"><option>Passed</option><option>Failed</option></select>
        <label>Người ký</label><input id="insp-signer" />
        <label>Chữ ký (gõ tên để tạo chữ ký giả)</label><input id="insp-signature" placeholder="Nguyễn Văn B" />
        <div style="margin-top:10px"><button class="btn" onclick="addInspection()">Tạo biên bản</button></div>
    `);
}

window.addInspection = function() {
    const batchId = document.getElementById('insp-batch').value || '';
    const result = document.getElementById('insp-result').value || '';
    const signer = document.getElementById('insp-signer').value || '';
    const signature = document.getElementById('insp-signature').value ? ('SIG:' + btoa(document.getElementById('insp-signature').value)) : '';
    const id = createId('INSP');
    const date = new Date().toISOString().slice(0,10);
    DB.inspections.push({ id, batchId, result, signedBy: signer, signature, date });
    saveDB(); renderInspections(); logAudit(signer || 'Người dùng','Tạo biên bản', id);
    closeModal();
}

/* QR generator control */
document.getElementById('btn-generate-qr')?.addEventListener('click', ()=>{
    const txt = document.getElementById('qr-input').value || 'AgriChain';
    const url = `https://quickchart.io/qr?text=${encodeURIComponent(txt)}&size=300`;
    document.getElementById('qr-img').src = url;
});

/* Navigation between pages */
document.querySelectorAll('.menu-link[data-section]').forEach(a=>{
    a.addEventListener('click', (e)=>{
        e.preventDefault();
        document.querySelectorAll('.menu-link').forEach(x=>x.classList.remove('active'));
        a.classList.add('active');
        const sec = a.dataset.section;
        document.querySelectorAll('.page').forEach(p=>p.classList.remove('active-page'));
        document.getElementById(sec).classList.add('active-page');
    });
});

/* Initialize with some demo data if empty */
(function seed() {
    if (DB.farms.length===0) {
        DB.farms.push({ id:'FARM-01', name:'Trang trại A', address:'Huyện X, Tỉnh Y', cert:'VietGAP' });
    }
    if (DB.batches.length===0) {
        DB.batches.push({ id:'BATCH-001', farmId:'FARM-01', farmName:'Trang trại A', product:'Cà chua', quantity:120, harvest:'2025-11-01', expiry: new Date(Date.now()+5*24*3600*1000).toISOString().slice(0,10) });
        DB.batches.push({ id:'BATCH-002', farmId:'FARM-01', farmName:'Trang trại A', product:'Dưa leo', quantity:60, harvest:'2025-10-25', expiry: new Date(Date.now()-2*24*3600*1000).toISOString().slice(0,10) });
    }
    if (DB.warehouses.length===0) {
        DB.warehouses.push({ id:'WH-1', name:'Kho Huyện X', location:'Huyện X', capacity:1000 });
    }
    if (DB.shipments.length===0) {
        DB.shipments.push({ id:'SHIP-1', from:'Trang trại A', to:'Kho Huyện X', batches:['BATCH-001'], date: new Date().toISOString().slice(0,10), status:'in-transit' });
    }
    saveDB();
    refreshAll();
})();

function refreshAll() {
    renderKPIs(); renderFarms(); renderBatches(); renderShipments(); renderWarehouses(); renderInspections(); renderReports(); renderAudit(); renderAlertsTable();
}

/* Alerts refresh periodically */
setInterval(()=> {
    renderKPIs(); renderAlertsTable();
}, 30*1000);