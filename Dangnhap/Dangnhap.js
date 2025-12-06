// ========== LOCALSTORAGE HELPERS ==========
function loadUsers() {
    return JSON.parse(localStorage.getItem('users') || '[]');
}

function saveUsers(users) {
    localStorage.setItem('users', JSON.stringify(users));
}

function initializeDefaultUsers() {
    const existing = loadUsers();
    if (existing.length > 0) return; // already initialized
    
    const defaultUsers = [
        { id: 1, role: 'admin', username: 'admin', password: 'admin123', fullName: 'Admin' },
        { id: 2, role: 'nongdan', username: 'nongdan1', password: 'pass123', fullName: 'Nông dân 1' },
        { id: 3, role: 'nongdan', username: 'nongdan2', password: 'pass123', fullName: 'Nông dân 2' },
        { id: 4, role: 'daily', username: 'daily1', password: 'pass123', fullName: 'Đại lý 1', maDaiLy: 'DL001' },
        { id: 5, role: 'daily', username: 'daily2', password: 'pass123', fullName: 'Đại lý 2', maDaiLy: 'DL002' },
        { id: 6, role: 'sieuthi', username: 'sieuthi1', password: 'pass123', fullName: 'Siêu thị 1' },
        { id: 7, role: 'sieuthi', username: 'sieuthi2', password: 'pass123', fullName: 'Siêu thị 2' }
    ];
    saveUsers(defaultUsers);
}

function findUser(accountType, username, password) {
    const users = loadUsers();
    return users.find(u => u.role === accountType && u.username === username && u.password === password);
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize default users on first load
    initializeDefaultUsers();

    const loginForm = document.getElementById('loginForm');
    const loginAlert = document.getElementById('loginAlert');

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const accountType = document.getElementById('accountType').value;
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        if (!accountType) {
            showAlert('Vui lòng chọn loại tài khoản', 'error');
            return;
        }

        // Check if user exists and credentials match
        const userExists = findUser(accountType, username, password);

        if (userExists) {
            // Store current logged-in user in sessionStorage for page-to-page access
            sessionStorage.setItem('currentUser', JSON.stringify(userExists));
            showAlert('Đăng nhập thành công!', 'success');
            // Redirect based on account type
            setTimeout(() => {
                const redirects = {
                    admin: '../Admin/Admin.html',
                    nongdan: '../Nongdan/Nongdan.html',
                    daily: '../Daily/Daily.html',
                    sieuthi: '../Sieuthi/Sieuthi.html'
                };
                window.location.href = redirects[accountType] || '../Admin/Admin.html';
            }, 1000);
        } else {
            showAlert('Tên đăng nhập hoặc mật khẩu không đúng!', 'error');
        }
    });

    function showAlert(message, type) {
        loginAlert.className = `alert ${type} show`;
        loginAlert.textContent = message;
        
        // Auto hide alert after 5 seconds
        setTimeout(() => {
            loginAlert.classList.remove('show');
        }, 5000);
    }
});