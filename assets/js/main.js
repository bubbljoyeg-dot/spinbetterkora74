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
    if(navigator.clipboard) navigator.clipboard.writeText("W300").catch(() => { });
    const btn = document.querySelector('.sb-promo-btn');
    if(btn) {
        const orig = btn.textContent;
        btn.textContent = 'تم النسخ!';
        btn.style.background = '#22c55e';
        setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 2000);
    }
}

function copyCode() {
    if (navigator.clipboard) {
        navigator.clipboard.writeText("W300").catch(() => { });
    } else {
        const textarea = document.createElement('textarea');
        textarea.value = "W300";
        document.body.appendChild(textarea);
        textarea.select();
        try { document.execCommand('copy'); } catch (e) { }
        document.body.removeChild(textarea);
    }

    const toast = document.getElementById('copyToast');
    if (toast) {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
    
    if (window.event) {
        const target = window.event.currentTarget || window.event.srcElement;
        if (target && target.tagName === 'BUTTON') {
            const orig = target.textContent;
            target.textContent = 'تم النسخ!';
            target.style.background = '#22c55e';
            target.style.color = '#000';
            setTimeout(() => {
                target.textContent = orig;
                target.style.background = '';
                target.style.color = '';
            }, 2000);
        }
    }
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




/* ─── Global Search Functionality ─── */
function openSearch() {
    document.getElementById('searchModal').classList.add('active');
    document.getElementById('searchInput').focus();
    renderSearch(""); // show default
}

function closeSearch() {
    document.getElementById('searchModal').classList.remove('active');
    document.getElementById('searchInput').value = "";
}

function getSnippet(content, query) {
    if (!query) return content.substring(0, 80) + "...";
    const idx = content.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return content.substring(0, 80) + "...";
    
    let start = Math.max(0, idx - 40);
    let end = Math.min(content.length, idx + query.length + 40);
    let snippet = content.substring(start, end);
    
    // Highlight
    const regex = new RegExp(`(${query})`, "gi");
    snippet = snippet.replace(regex, '<span style="color:var(--accent);font-weight:bold;">$1</span>');
    return "..." + snippet + "...";
}

function renderSearch(query) {
    const list = document.getElementById('searchResults');
    list.innerHTML = '';
    const q = query.toLowerCase().trim();
    
    const pathPrefix = window.location.pathname.includes('/spinbetter-') || window.location.pathname.includes('/sports/') ? '../' : './';

    let results = [];
    
    if (q === "") {
        // Just show 3 random pages or home
        results = fullSearchData.slice(0, 4);
    } else {
        // Full text Search
        fullSearchData.forEach(page => {
            const matchesTitle = page.title.toLowerCase().includes(q);
            const matchesContent = page.content.toLowerCase().includes(q);
            if (matchesTitle || matchesContent) {
                // Determine a score for sorting
                let score = matchesTitle ? 10 : 1;
                // Add exact match count score
                const regex = new RegExp(q, "gi");
                const count = (page.content.match(regex) || []).length;
                score += count;
                results.push({ page, score });
            }
        });
        
        // Sort
        results.sort((a, b) => b.score - a.score);
        results = results.map(r => r.page);
    }

    if (results.length === 0) {
        list.innerHTML = '<div class="no-results">لم يتم العثور على نتائج للكلمة "' + query + '" 😕</div>';
        return;
    }

    results.forEach(item => {
        const snippet = getSnippet(item.content, q);
        
        const a = document.createElement('a');
        a.href = pathPrefix + item.url;
        a.className = 'search-card';
        a.innerHTML = `
            <span class="icon">📄</span>
            <div class="s-text">
                <div class="s-title">${item.title}</div>
                <div class="s-desc" style="line-height:1.4;">${snippet}</div>
            </div>
        `;
        list.appendChild(a);
    });
}

function handleSearch(e) {
    renderSearch(e.target.value);
}

// Close search modal when clicking outside the content area
document.addEventListener('click', function(e) {
    const searchModal = document.getElementById('searchModal');
    if (searchModal && searchModal.classList.contains('active')) {
        if (e.target === searchModal) {
            closeSearch();
        }
    }
});

/* ─── Notification Bell System ─── */
document.addEventListener('DOMContentLoaded', () => {
    const logo = document.querySelector('.logo');
    if (logo && !document.getElementById('notifBell')) {
        const bellWrapper = document.createElement('div');
        bellWrapper.className = 'hdr-bell-wrap';
        bellWrapper.innerHTML = `
            <button class="hdr-bell" id="notifBell" aria-label="الإشعارات">
                <svg viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/></svg>
                <span class="bell-badge" id="bellBadge" style="display:none;">0</span>
            </button>
            <div class="notif-dropdown" id="notifDropdown">
                <div class="notif-header-title">أحدث الإشعارات 🔔</div>
                <div class="notif-body" id="notifList">
                    <div class="notif-empty" id="notifEmpty">لا توجد إشعارات جديدة حالياً</div>
                </div>
            </div>
        `;
        logo.insertAdjacentElement('afterend', bellWrapper);
        
        const notifBell = document.getElementById('notifBell');
        const notifDropdown = document.getElementById('notifDropdown');
        const bellBadge = document.getElementById('bellBadge');
        const notifList = document.getElementById('notifList');
        const notifEmpty = document.getElementById('notifEmpty');
        
        const pushMessages = [
            { title: "أهلاً بك في SpinBetter! 🎉", text: "نسعد بتواجدك في موقعنا. يمكنك الآن تصفح جميع مقالاتنا بكل سهولة، وشاركنا رأيك حول خدمات المنصة." },
            { title: "بونص ترحيبي بانتظارك 🎁", text: "استخدم الرمز الترويجي W300 الآن واستمتع بمكافأة 200% على إيداعك الأول." },
            { title: "سحب سريع وآمن ⚡", text: "هل قمت بتجربة نظام سحب الأرباح الفوري لدينا؟ لا توجد أية عمولات!" },
            { title: "ألعاب كازينو حصرية 🎰", text: "استمتع بأكثر من 7000 لعبة كازينو وماكينة سلوت مباشرة على هاتفك الآن." },
            { title: "نحن هنا لخدمتك 🎧", text: "فريق الدعم الفني متواجد على مدار 24 ساعة للرد على جميع استفساراتك." },
            { title: "تطبيق الموبايل متاح الآن 📱", text: "حمل تطبيق SpinBetter الأسرع واحصل على تنبيهات حصرية للمباريات والبطولات الكبرى." },
            { title: "أعلى احتمالات المراهنة 📈", text: "نحن نضمن توفير أفضل الاحتمالات وأعلى العوائد في سوق المراهنات الرياضية العربية." },
            { title: "كاش باك لكبار الشخصيات 💎", text: "ارتقِ في برنامج الـ VIP الخاص بنا واستمتع باسترداد نقدي كبير ومستمر يومياً." }
        ];
        
        // ── Persistent State Logic ──
        let state = {
            unreadCount: 0,
            msgIndex: 0,
            history: [] // stores { index, timeStr }
        };

        try {
            const saved = sessionStorage.getItem('sb_notifs');
            if (saved) state = JSON.parse(saved);
        } catch(e) {}

        function saveState() {
            sessionStorage.setItem('sb_notifs', JSON.stringify(state));
        }

        // Render previous notifications on load
        if (state.history.length > 0 && notifEmpty) {
            notifEmpty.style.display = 'none';
        }
        
        state.history.forEach(item => {
            const msg = pushMessages[item.index];
            if (!msg) return;
            const notifHTML = `
                <div class="notif-item" style="animation:none;">
                    <div class="n-title">${msg.title}</div>
                    <div style="font-size: 11.5px; opacity:0.8; margin-top:2px;">${msg.text}</div>
                    <div class="n-time">${item.timeStr}</div>
                </div>
            `;
            notifList.insertAdjacentHTML('afterbegin', notifHTML);
        });

        if (state.unreadCount > 0) {
            bellBadge.style.display = 'flex';
            bellBadge.textContent = state.unreadCount;
        }

        notifBell.addEventListener('click', (e) => {
            e.stopPropagation();
            const isActive = notifDropdown.classList.contains('active');
            if (!isActive) {
                notifDropdown.classList.add('active');
                state.unreadCount = 0;
                saveState();
                bellBadge.style.display = 'none';
                bellBadge.textContent = '0';
            } else {
                notifDropdown.classList.remove('active');
            }
        });
        
        document.addEventListener('click', (e) => {
            if (!bellWrapper.contains(e.target)) {
                notifDropdown.classList.remove('active');
            }
        });
        
        function triggerNextNotif() {
            if (state.msgIndex >= pushMessages.length) {
                return; // Stop when out of messages
            }
            
            const msgIdx = state.msgIndex;
            const msg = pushMessages[msgIdx];
            const now = new Date();
            const timeStr = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
            
            const notifHTML = `
                <div class="notif-item">
                    <div class="n-title">${msg.title}</div>
                    <div style="font-size: 11.5px; opacity:0.8; margin-top:2px;">${msg.text}</div>
                    <div class="n-time">${timeStr}</div>
                </div>
            `;
            
            if (notifEmpty) {
                notifEmpty.style.display = 'none';
            }
            
            notifList.insertAdjacentHTML('afterbegin', notifHTML);
            
            state.history.push({ index: msgIdx, timeStr: timeStr });
            state.msgIndex++;
            
            if (!notifDropdown.classList.contains('active')) {
                state.unreadCount++;
                bellBadge.style.display = 'flex';
                bellBadge.textContent = state.unreadCount;
                
                notifBell.classList.remove('shake');
                void notifBell.offsetWidth; // trigger reflow to restart css animation
                notifBell.classList.add('shake');
            }
            
            saveState(); // Update session storage
        }

        // Only push immediately if it's the very first time the user visits the site
        if (state.msgIndex === 0) {
            setTimeout(triggerNextNotif, 500);
        }

        // Push subsequent notifications every 10 seconds
        setInterval(triggerNextNotif, 10000);
    }
});
