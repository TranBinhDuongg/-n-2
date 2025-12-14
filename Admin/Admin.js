// ========== INITIALIZATION & HELPERS ==========
let currentUser = null;

function loadCurrentUser() {
    const stored = sessionStorage.getItem('currentUser');
    if (!stored) {
        window.location.href = '/Dangnhap/Dangnhap.html';
        return null;
    }
    currentUser = JSON.parse(stored);
    return currentUser;
}

// Global database for Admin (centralized, not per-user)
const DB = {
    users: [],
    farms: [],
    batches: [],
    orders: [],
    logs: []
};

function loadDB() {
    DB.users = JSON.parse(localStorage.getItem('admin_users') || '[]');
    DB.farms = JSON.parse(localStorage.getItem('admin_farms') || '[]');
    DB.batches = JSON.parse(localStorage.getItem('admin_batches') || '[]');
    DB.orders = JSON.parse(localStorage.getItem('admin_orders') || '[]');
    DB.logs = JSON.parse(localStorage.getItem('admin_logs') || '[]');
}

function saveDB() {
    localStorage.setItem('admin_users', JSON.stringify(DB.users));
    localStorage.setItem('admin_farms', JSON.stringify(DB.farms));
    localStorage.setItem('admin_batches', JSON.stringify(DB.batches));
    localStorage.setItem('admin_orders', JSON.stringify(DB.orders));
    localStorage.setItem('admin_logs', JSON.stringify(DB.logs));
}

// ========== UI NAVIGATION ==========
document.addEventListener('DOMContentLoaded', () => {
    loadCurrentUser();
    loadDB();

    // Display current user
    if (currentUser?.fullName) {
        const userDisplay = document.getElementById('current-user');
        if (userDisplay) userDisplay.textContent = currentUser.fullName;
    }
    // Display current role (make it friendly)
    if (currentUser?.role) {
        const roleDisplay = document.getElementById('current-role');
        if (roleDisplay) roleDisplay.textContent = (currentUser.role || '').toString().replace(/(^|_)([a-z])/g, (_, a, b) => b ? b.toUpperCase() : '').replace(/_/g, ' ');
    }

    const links = document.querySelectorAll('.menu-link');
    const pages = document.querySelectorAll('.page');
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');

    function showSection(id) {
        pages.forEach(p => p.classList.toggle('active-page', p.id === id));
        links.forEach(l => l.classList.toggle('active', l.dataset.section === id));
    }

    function currentHash() { return (location.hash || '').replace(/^#/, '') || 'dashboard'; }
    showSection(currentHash());
    window.addEventListener('hashchange', () => showSection(currentHash()));

    links.forEach(link => {
        link.addEventListener('click', (e) => {
            const s = link.dataset.section;
            if (!s) return;
            e.preventDefault();
            location.hash = s;
        });
    });

    // Logo goes to dashboard
    document.querySelectorAll('.logo').forEach(l => l.addEventListener('click', (e) => { e.preventDefault(); location.hash = 'dashboard'; }));

    // Header action: new report -> open reports section
    document.getElementById('btn-new-report')?.addEventListener('click', () => { location.hash = 'reports'; });

    // ========== MODAL HELPERS ==========
    function openModal(templateId) {
        const tpl = document.getElementById(templateId);
        if (!tpl) return;
        modalBody.innerHTML = '';
        modalBody.appendChild(tpl.content.cloneNode(true));
        modal.classList.remove('hidden');
        
        modalBody.querySelectorAll('.modal-close-btn').forEach(b => {
            b.addEventListener('click', closeModal);
        });
        modalBody.querySelectorAll('.modal-close').forEach(b => {
            b.addEventListener('click', closeModal);
        });
        
        modalBody.querySelectorAll('form').forEach(f => {
            f.addEventListener('submit', (ev) => {
                ev.preventDefault();
                const formId = f.id || templateId;
                handleFormSubmit(formId, new FormData(f));
                closeModal();
            });
        });
    }

    function closeModal() {
        modal.classList.add('hidden');
        modalBody.innerHTML = '';
    }

    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    window.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

    // ========== FORM SUBMISSION ==========
    function handleFormSubmit(formId, formData) {
        const data = Object.fromEntries(formData);
        
        if (formId.includes('user')) {
            addUser(data);
        } else if (formId.includes('farm')) {
            addFarm(data);
        }
        
        refreshAll();
    }

    // ========== DATA OPERATIONS ==========
    function addUser(data) {
        const user = {
            id: 'user_' + Date.now(),
            hoTen: data.hoTen,
            role: data.role,
            email: data.email || ''
        };
        DB.users.push(user);
        saveDB();
    }

    function addFarm(data) {
        const farm = {
            id: 'F' + (DB.farms.length + 1),
            ten: data.ten,
            chu: data.chu,
            diachi: data.diachi || ''
        };
        DB.farms.push(farm);
        saveDB();
    }

    function deleteFarm(farmId) {
        DB.farms = DB.farms.filter(f => f.id !== farmId);
        saveDB();
        renderFarms();
    }

    function deleteUser(userId) {
        DB.users = DB.users.filter(u => u.id !== userId);
        saveDB();
        renderUsers();
    }

    function deleteOrder(orderId) {
        DB.orders = DB.orders.filter(o => o.id !== orderId);
        saveDB();
        renderOrders();
    }

    // ========== RENDERING FUNCTIONS ==========
    function renderKPIs() {
        document.getElementById('kpi-total-users').textContent = DB.users.length;
        document.getElementById('kpi-total-farms').textContent = DB.farms.length;
        document.getElementById('kpi-total-batches').textContent = DB.batches.length;
        document.getElementById('kpi-total-orders').textContent = DB.orders.length;
    }

    function renderUsers() {
        const tbody = document.querySelector('#table-admin-users tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        DB.users.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${u.id}</td><td>${u.hoTen}</td><td>${u.role}</td><td>${u.email}</td>
                <td><button class="btn small" onclick="deleteUser('${u.id}')">Xóa</button></td>`;
            tbody.appendChild(tr);
        });
    }

    function renderFarms() {
        const tbody = document.querySelector('#table-farms tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        DB.farms.forEach(f => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${f.id}</td><td>${f.ten}</td><td>${f.chu}</td><td>${f.diachi}</td>
                <td><button class="btn small" onclick="deleteFarm('${f.id}')">Xóa</button></td>`;
            tbody.appendChild(tr);
        });
    }

    function renderBatches() {
        const tbody = document.querySelector('#table-batches tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        DB.batches.forEach(b => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${b.ma}</td><td>${b.sanPham}</td><td>${b.soLuong}</td><td>${b.ngay}</td><td></td>`;
            tbody.appendChild(tr);
        });
    }

    function renderOrders() {
        const tbody = document.querySelector('#table-orders tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        DB.orders.forEach(o => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${o.ma}</td><td>${o.nguoi}</td><td>${o.daily}</td><td>${o.soLuong}</td><td>${o.trangThai}</td>
                <td><button class="btn small" onclick="deleteOrder('${o.ma}')">Xóa</button></td>`;
            tbody.appendChild(tr);
        });
    }

    function renderLogs() {
        const tbody = document.querySelector('#table-logs tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        DB.logs.slice().reverse().slice(0, 20).forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${log.time}</td><td>${log.user}</td><td>${log.action}</td>`;
            tbody.appendChild(tr);
        });
    }

    function refreshAll() {
        renderKPIs();
        renderUsers();
        renderFarms();
        renderBatches();
        renderOrders();
        renderLogs();
    }

    // ========== BUTTON HANDLERS ==========
    document.getElementById('btn-add-admin-user')?.addEventListener('click', () => openModal('add-user-template'));
    document.getElementById('btn-add-farm')?.addEventListener('click', () => openModal('add-farm-template'));
    
    document.getElementById('btn-seed-data')?.addEventListener('click', () => {
        DB.users = [
            { id: 'admin1', hoTen: 'Quản trị viên', role: 'admin', email: 'admin@example.com' },
            { id: 'nd1', hoTen: 'Nguyễn Nông Dân', role: 'nongdan', email: 'nd1@example.com' },
            { id: 'dl1', hoTen: 'Trần Đại Lý', role: 'daily', email: 'dl1@example.com' }
        ];
        DB.farms = [
            { id: 'F1', ten: 'Trang trại A', chu: 'Nguyễn Nông Dân', diachi: 'Hà Nội' },
            { id: 'F2', ten: 'Trang trại B', chu: 'Nguyễn Nông Dân', diachi: 'Hải Phòng' }
        ];
        DB.batches = [
            { ma: 'L001', sanPham: 'Lúa gạo', soLuong: 1000, ngay: '2025-10-01' },
            { ma: 'L002', sanPham: 'Khoai tây', soLuong: 500, ngay: '2025-10-05' }
        ];
        DB.orders = [
            { ma: 'O001', nguoi: 'Khách', daily: 'DL1', soLuong: 100, trangThai: 'Đã giao' }
        ];
        saveDB();
        refreshAll();
    });

    // ========== INITIAL RENDER ==========
    refreshAll();

    // Make functions globally accessible for inline handlers
    window.deleteFarm = deleteFarm;
    window.deleteUser = deleteUser;
    window.deleteOrder = deleteOrder;
});

