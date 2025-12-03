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