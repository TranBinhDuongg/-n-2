document.addEventListener('DOMContentLoaded', () => {
	// Navigation between pages
	const menuLinks = document.querySelectorAll('.menu-link');
	const pages = document.querySelectorAll('.page');

	function showSection(id) {
		pages.forEach(p => p.classList.toggle('active-page', p.id === id));
		menuLinks.forEach(l => l.classList.toggle('active', l.dataset.section === id));
	}

	menuLinks.forEach(link => {
		link.addEventListener('click', (e) => {
			// if it's a logout link or external, allow default
			const section = link.dataset.section;
			if (!section) return;
			e.preventDefault();
			showSection(section);
		});
	});

	// show default section (dashboard)
	showSection('dashboard');

	// show current user info if available
	try {
		const cu = sessionStorage.currentUser ? JSON.parse(sessionStorage.currentUser) : null;
		if (cu) {
			const name = cu.hoTen || cu.username || cu.id || cu.name || '';
			document.getElementById('current-user').textContent = name;
			document.getElementById('current-agency').textContent = cu.role ? cu.role : '';
		}
	} catch (e) {
		console.warn('Unable to parse currentUser', e);
	}

	// Modal handling (open templates and simple submit handlers)
	const modal = document.getElementById('modal');
	const modalBody = document.getElementById('modal-body');

	function openModal(templateId) {
		const tpl = document.getElementById(templateId);
		if (!tpl) return;
		modalBody.innerHTML = '';
		modalBody.appendChild(tpl.content.cloneNode(true));
		modal.classList.remove('hidden');

		// close buttons inside modal
		modal.querySelectorAll('.modal-close-btn').forEach(btn => btn.addEventListener('click', closeModal));
		modal.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', closeModal));

		// forms: prevent default and close (hook point for saving)
		modal.querySelectorAll('form').forEach(form => {
			form.addEventListener('submit', (ev) => {
				ev.preventDefault();
				const data = Object.fromEntries(new FormData(form).entries());
				console.log('[Sieuthi] form submit', templateId, data);
				closeModal();
			});
		});
	}

	function closeModal() {
		modal.classList.add('hidden');
		modalBody.innerHTML = '';
	}

	// close when clicking overlay
	modal.addEventListener('click', (ev) => { if (ev.target === modal) closeModal(); });

	// wire top-level buttons to templates
	document.getElementById('btn-new-user')?.addEventListener('click', () => openModal('add-user-template'));
	document.getElementById('btn-add-user')?.addEventListener('click', () => openModal('add-user-template'));
	document.getElementById('btn-new-product')?.addEventListener('click', () => openModal('add-product-template'));
	document.getElementById('btn-import-product')?.addEventListener('click', () => openModal('add-product-template'));
	document.getElementById('btn-new-invoice')?.addEventListener('click', () => openModal('create-invoice-template'));
});
