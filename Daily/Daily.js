// Tab Navigation
document.querySelectorAll('.menu-link').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
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

function initCreateOrderModal() {
    const farmerSelect = modalBody.querySelector('select[name="farmerId"]');
    const fromManual = modalBody.querySelector('input[name="fromAddressManual"]');
    const productSelect = modalBody.querySelector('select[name="product"]');
    const productManual = modalBody.querySelector('input[name="productManual"]');

    if (!farmerSelect || !productSelect) return;

    const farms = (window.DB && Array.isArray(window.DB.farms)) ? window.DB.farms : [];
    const batches = (window.DB && Array.isArray(window.DB.batches)) ? window.DB.batches : [];

    farmerSelect.innerHTML = '<option value="">-- Chọn nông dân --</option>';
    if (farms.length) {
        farms.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f.id;
            opt.textContent = f.name || f.id;
            farmerSelect.appendChild(opt);
        });
        farmerSelect.appendChild(new Option('Khác (nhập tay)', 'manual'));
    } else {
        // no farms available -> allow manual entry
        farmerSelect.innerHTML += '<option value="manual">Khác (nhập tay)</option>';
        fromManual.style.display = 'block';
    }

    // initial state for product select
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

        // selected a farm id -> hide manual farmer input
        fromManual.style.display = 'none';
        productManual.style.display = 'none';

        // find products associated with this farmer via batches
        const prods = batches.filter(b => b.farmId === fid).map(b => b.product).filter(Boolean);
        const unique = [...new Set(prods)];

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

// open create order modal from header/dashboard or orders page
document.querySelectorAll('#btn-create-order, #btn-new-order').forEach(btn => {
    btn?.addEventListener('click', () => openModalWithTemplate('create-order-template'));
});

// handle cancel inside injected form
document.addEventListener('click', (e) => {
    if (e.target?.classList?.contains('modal-close-btn')) closeModal();
});

// Helper to add a row and attach listeners
function addOrderRow(tableSelector, data) {
    const table = document.querySelector(tableSelector + ' tbody');
    if (!table) return;
    const tr = document.createElement('tr');
    const batchCell = data.batchCode + (data.product ? (' — ' + data.product) : '');
    tr.innerHTML = `
        <td>${data.orderId}</td>
        <td>${batchCell}</td>
        <td>${data.quantity}</td>
        <td>${data.fromAddress || ''}</td>
        <td>${data.toAddress || ''}</td>
        <td>${data.date || new Date().toLocaleDateString()}</td>
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
            tr.remove();
        }
    });
    tr.querySelector('.btn-edit')?.addEventListener('click', () => {
        alert('Chức năng sửa sẽ được bổ sung sau.');
    });
}

// Handle form submit for the modal create order form (delegated)
document.addEventListener('submit', (e) => {
    const form = e.target;
    if (form && form.id === 'createOrderFormModal') {
        e.preventDefault();
        const f = new FormData(form);
        // determine farmer and product values (support selecting from DB or manual input)
        const farmerId = f.get('farmerId');
        let fromAddress = '';
        if (farmerId && farmerId !== 'manual' && window.DB && Array.isArray(window.DB.farms)) {
            const farm = window.DB.farms.find(x => x.id === farmerId);
            fromAddress = farm ? (farm.name || farm.address || '') : '';
        }
        if (!fromAddress) fromAddress = f.get('fromAddressManual') || '';

        let product = f.get('product');
        if (!product || product === 'manual') product = f.get('productManual') || '';

        const data = {
            orderId: f.get('orderId') || `DH${Date.now()}`,
            batchCode: f.get('batchCode') || '-',
            product: product || '',
            quantity: f.get('quantity') || '0',
            fromAddress: fromAddress || '',
            toAddress: f.get('toAddress') || '',
            date: f.get('date') || new Date().toLocaleDateString(),
            status: 'Đã tạo'
        };

        // Add to main orders table and dashboard recent orders table
        addOrderRow('#table-orders-all', data);
        // The dashboard recent orders table has fewer columns; create a compact row
        const dashTable = document.querySelector('#table-orders tbody');
        if (dashTable) {
            const tr = document.createElement('tr');
            const batchCell = data.batchCode + (data.product ? (' — ' + data.product) : '');
            tr.innerHTML = `<td>${data.orderId}</td><td>${batchCell}</td><td>${data.quantity}</td><td>${data.toAddress}</td><td>${data.date}</td><td class="status-in-transit">${data.status}</td>`;
            dashTable.prepend(tr);
        }

        // update KPI
        const kpiEl = document.getElementById('kpi-orders');
        if (kpiEl) {
            const v = parseInt(kpiEl.textContent || '0', 10) || 0;
            kpiEl.textContent = v + 1;
        }

        closeModal();
        alert('Đã nhập hàng: ' + data.orderId);
    }
});

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


console.log('Daily Management System loaded successfully!');