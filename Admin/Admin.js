document.addEventListener('DOMContentLoaded', () => {
	// Basic navigation using hash and sidebar links
	const links = document.querySelectorAll('.menu-link');
	const pages = document.querySelectorAll('.page');
	const modal = document.getElementById('modal');
	const modalBody = document.getElementById('modal-body');

	function showSection(id){
		pages.forEach(p => p.classList.toggle('active-page', p.id === id));
		links.forEach(l => l.classList.toggle('active', l.dataset.section === id));
	}

	function currentHash(){ return (location.hash||'').replace(/^#/,'') || 'dashboard'; }
	showSection(currentHash());
	window.addEventListener('hashchange', () => showSection(currentHash()));

	links.forEach(link => {
		link.addEventListener('click', (e) => {
			const s = link.dataset.section; if (!s) return; e.preventDefault(); location.hash = s;
		});
	});

	// modal helpers
	function openModal(templateId){
		const tpl = document.getElementById(templateId); if (!tpl) return;
		modalBody.innerHTML = '';
		modalBody.appendChild(tpl.content.cloneNode(true));
		modal.classList.remove('hidden');
		modal.querySelectorAll('.modal-close-btn').forEach(b => b.addEventListener('click', closeModal));
		modal.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', closeModal));
		modal.querySelectorAll('form').forEach(f => f.addEventListener('submit', (ev) => {
			ev.preventDefault();
			const data = Object.fromEntries(new FormData(f).entries());
			console.log('[Admin] submit', templateId, data);
			// TODO: persist to localStorage / DB
			closeModal();
		}));
	}

	function closeModal(){ modal.classList.add('hidden'); modalBody.innerHTML = ''; }
	modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
	window.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

	// wire UI buttons
	document.getElementById('btn-add-admin-user')?.addEventListener('click', () => openModal('add-user-template'));
	document.getElementById('btn-add-farm')?.addEventListener('click', () => openModal('add-farm-template'));
	document.getElementById('btn-seed-data')?.addEventListener('click', seedDemo);

	// minimal demo seeding and rendering
	function seedDemo(){
		const users = [
			{id:'admin1',hoTen:'Quản trị viên',role:'admin',email:'admin@example.com'},
			{id:'nd1',hoTen:'Nguyễn Nông',role:'nongdan',email:'nd1@example.com'},
			{id:'dl1',hoTen:'Đại lý A',role:'daily',email:'dl1@example.com'}
		];
		localStorage.setItem('admin_users', JSON.stringify(users));
		const farms = [{id:'F001',ten:'Trang trại A',chu:'Nguyễn Nông',diachi:'Huyện X'}];
		localStorage.setItem('admin_farms', JSON.stringify(farms));
		const batches = [{ma:'L001',sanPham:'Khoai',soLuong:100,ngay:'2025-10-01'}];
		localStorage.setItem('admin_batches', JSON.stringify(batches));
		const orders = [{ma:'O001',nguoi:'Khách',daily:'DL1',soLuong:10,trangThai:'Đã giao'}];
		localStorage.setItem('admin_orders', JSON.stringify(orders));
		renderAll();
	}

	function renderAll(){ renderUsers(); renderFarms(); renderBatches(); renderOrders(); renderKPIs(); renderRecent(); }

	function renderUsers(){
		const tbody = document.querySelector('#table-admin-users tbody'); tbody.innerHTML='';
		const users = JSON.parse(localStorage.getItem('admin_users')||'[]');
		users.forEach(u=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${u.id}</td><td>${u.hoTen}</td><td>${u.role}</td><td>${u.email||''}</td><td><button class="btn btn-edit" data-id="${u.id}">Sửa</button></td>`; tbody.appendChild(tr); });
	}
	function renderFarms(){ const tbody=document.querySelector('#table-farms tbody'); tbody.innerHTML=''; const farms=JSON.parse(localStorage.getItem('admin_farms')||'[]'); farms.forEach(f=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${f.id||''}</td><td>${f.ten||''}</td><td>${f.chu||''}</td><td>${f.diachi||''}</td><td></td>`;tbody.appendChild(tr)});}
	function renderBatches(){ const tbody=document.querySelector('#table-batches tbody'); tbody.innerHTML=''; const batches=JSON.parse(localStorage.getItem('admin_batches')||'[]'); batches.forEach(b=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${b.ma}</td><td>${b.sanPham}</td><td>${b.soLuong}</td><td>${b.ngay}</td><td></td>`;tbody.appendChild(tr)});}
	function renderOrders(){ const tbody=document.querySelector('#table-orders tbody'); tbody.innerHTML=''; const orders=JSON.parse(localStorage.getItem('admin_orders')||'[]'); orders.forEach(o=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${o.ma}</td><td>${o.nguoi}</td><td>${o.daily}</td><td>${o.soLuong}</td><td>${o.trangThai||''}</td><td></td>`;tbody.appendChild(tr)});}
	function renderKPIs(){ const users=JSON.parse(localStorage.getItem('admin_users')||'[]'); const farms=JSON.parse(localStorage.getItem('admin_farms')||'[]'); const batches=JSON.parse(localStorage.getItem('admin_batches')||'[]'); const orders=JSON.parse(localStorage.getItem('admin_orders')||'[]'); document.getElementById('kpi-total-users').textContent=users.length; document.getElementById('kpi-total-farms').textContent=farms.length; document.getElementById('kpi-total-batches').textContent=batches.length; document.getElementById('kpi-total-orders').textContent=orders.length;}
	function renderRecent(){ const tbody=document.querySelector('#table-recent tbody'); tbody.innerHTML=''; const logs=JSON.parse(localStorage.getItem('admin_logs')||'[]'); logs.slice().reverse().slice(0,10).forEach(l=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${l.time}</td><td>${l.user||''}</td><td>${l.action||''}</td>`;tbody.appendChild(tr)})}

	// initial render
	renderAll();
});
