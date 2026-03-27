function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sbOverlay');
    sb.classList.toggle('open');
    ov.classList.toggle('open');
    document.body.style.overflow = sb.classList.contains('open') ? 'hidden' : '';
}
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sbOverlay').classList.remove('open');
    document.body.style.overflow = '';
}
function copyCodeSb() {
    navigator.clipboard.writeText("W300").catch(() => { });
    const btn = document.querySelector('.sb-promo-btn');
    const orig = btn.textContent;
    btn.textContent = 'تم النسخ!';
    btn.style.background = '#22c55e';
    setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 2000);
}
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSidebar();
});


function toggleFAQ(id) {
    const el = document.getElementById('faq-content-' + id);
    const icon = document.getElementById('faq-icon-' + id);
    if (!el || !icon) return;

    // Toggle logic for display and icon rotation based on generic fa-icons
    if (el.style.display === 'block') {
        el.style.display = 'none';
        if (icon.classList.contains('fa-chevron-up')) {
            icon.classList.remove('fa-chevron-up');
            icon.classList.add('fa-chevron-down');
        } else {
            icon.style.transform = 'rotate(0deg)';
        }
    } else {
        el.style.display = 'block';
        if (icon.classList.contains('fa-chevron-down')) {
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-up');
        } else {
            icon.style.transform = 'rotate(180deg)';
        }
    }
}

// Modern Accordion Logic
function toggleAcc(btn) {
    const item = btn.closest('.acc-item');
    if (!item) return;

    item.classList.toggle('active');
    const body = item.querySelector('.acc-body');
    const icon = btn.querySelector('span, i');
    
    if (item.classList.contains('active')) {
        body.style.maxHeight = body.scrollHeight + 40 + 'px';
        body.style.padding = '0 18px 16px';
        if (icon) icon.style.transform = 'rotate(180deg)';
        if (icon) icon.style.transition = 'transform 0.3s ease';
    } else {
        body.style.maxHeight = null;
        body.style.padding = '0 18px 0';
        if (icon) icon.style.transform = 'rotate(0deg)';
    }
}
