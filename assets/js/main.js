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
    // Inject News Icon for mobile
    const appHeader = document.querySelector('.app-header');
    if (appHeader && !document.getElementById('mobileNewsBtn')) {
        const pathPrefix = window.location.pathname.includes('/spinbetter-') || window.location.pathname.includes('/sports/') ? '../' : './';
        const newsBtn = document.createElement('a');
        newsBtn.id = 'mobileNewsBtn';
        newsBtn.href = pathPrefix + 'spinbetter-news/';
        newsBtn.title = "الأخبار والتحليلات";
        newsBtn.innerHTML = `
            <svg viewBox="0 -0.33 20.754 20.754" style="width:24px; height:24px;" xmlns="http://www.w3.org/2000/svg"><g transform="translate(-1.623 -1.913)"><circle cx="12" cy="12" r="8.5" fill="#ffffff" /><path fill="#2ca9bc" d="M14.33,3.31,12,5,9.67,3.31a8.91,8.91,0,0,1,4.66,0ZM4.46,7.1A9,9,0,0,0,3,11.53L5.34,9.84ZM8,17.89l-.07-.23H5A8.92,8.92,0,0,0,8.78,20.4ZM12,8,8.5,10.67,9.84,15h4.32l1.34-4.33Zm4.11,9.66-.07.23-.82,2.51A8.92,8.92,0,0,0,19,17.66ZM19.54,7.11l-.88,2.73L21,11.53a8.93,8.93,0,0,0-1.46-4.42Z"/><path d="M9.67,3.31,12,5l2.33-1.69M3.02,11.53,5.34,9.84,4.46,7.1M18,18l-1.92-.04-.73,2.38M6,18l1.92-.04.73,2.38M19.55,7.1l-.89,2.74,2.32,1.69M12,8V5M8.41,10.65,5.34,9.84M9.84,15,7.89,18m6.27-3,1.95,3m-.61-7.33,3.16-.83M12,8,8.5,10.67,9.84,15h4.32l1.34-4.33Zm0-5a9,9,0,1,0,9,9A9,9,0,0,0,12,3Z" fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></g></svg>
            <span class="bell-badge" id="newsBadge" style="display:none; position:absolute; top:-2px; left:-2px; background:#ef4444; color:#fff; border-radius:50%; width:16px; height:16px; font-size:10px; font-weight:bold; align-items:center; justify-content:center;"></span>
        `;
        newsBtn.style.cssText = 'position: absolute; top: var(--header-h, 56px); right: 20px; display: flex; align-items: center; justify-content: center; background: rgba(2, 6, 23, 0.98); border: 1px solid rgba(56, 189, 248, 0.12); border-top: none; border-radius: 0 0 10px 10px; padding: 6px 14px; cursor: pointer; text-decoration: none; box-shadow: 0 4px 12px rgba(0,0,0,0.3);';
        
        if (!document.getElementById('mobileNewsStyles')) {
            const style = document.createElement('style');
            style.id = 'mobileNewsStyles';
            style.innerHTML = `@media(min-width: 769px) { #mobileNewsBtn { display: none !important; } } #mobileNewsBtn:hover svg { fill: var(--accent) !important; transition: 0.3s; }`;
            document.head.appendChild(style);
        }
        
        appHeader.appendChild(newsBtn);
    }

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
        
        const SUPABASE_URL = 'https://whwilmaizmfqgcgowrwf.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indod2lsbWFpem1mcWdjZ293cndmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDQyNDcsImV4cCI6MjA5MDQ4MDI0N30.plNnsahhJPXPo6uNOrW2GwRSwAPVcDp2PEcSlb7Wgs0';

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
            history: [], // stores { title, text, timeStr, isLivePost, url }
            lastPostId: null,
            lastSeenNewsId: null
        };

        const topNewsBtn = document.getElementById('mobileNewsBtn');
        if (topNewsBtn) {
            topNewsBtn.addEventListener('click', () => {
                if (state.lastPostId) {
                    state.lastSeenNewsId = state.lastPostId;
                    try { sessionStorage.setItem('sb_notifs_v2', JSON.stringify(state)); } catch(e){}
                }
            });
        }

        try {
            const saved = sessionStorage.getItem('sb_notifs_v2');
            if (saved) state = JSON.parse(saved);
        } catch(e) {}

        function saveState() {
            sessionStorage.setItem('sb_notifs_v2', JSON.stringify(state));
        }

        if (state.history.length > 0 && notifEmpty) {
            notifEmpty.style.display = 'none';
        }
        
        function renderSingleNotifItem(msg, isHistoryLoad = true) {
            let innerHTML = '';
            let styleAttr = isHistoryLoad ? 'style="animation:none;"' : '';
            if (msg.isLivePost && msg.url) {
                const pathPrefix = window.location.pathname.includes('/spinbetter-') || window.location.pathname.includes('/sports/') ? '../' : './';
                innerHTML = `
                    <div class="notif-item live-post" ${styleAttr}>
                        <div class="n-title" style="color:var(--accent); font-weight:bold;">${msg.title} 🚨</div>
                        <div style="font-size: 11.5px; opacity:0.8; margin-top:2px;">${msg.text}</div>
                        <div style="margin-top: 5px;">
                            <a href="${pathPrefix}${msg.url}" style="color:var(--accent); font-size:11px; text-decoration:underline;">اقرأ المزيد...</a>
                        </div>
                        <div class="n-time">${msg.timeStr}</div>
                    </div>
                `;
            } else {
                innerHTML = `
                    <div class="notif-item" ${styleAttr}>
                        <div class="n-title">${msg.title}</div>
                        <div style="font-size: 11.5px; opacity:0.8; margin-top:2px;">${msg.text}</div>
                        <div class="n-time">${msg.timeStr}</div>
                    </div>
                `;
            }
            notifList.insertAdjacentHTML('afterbegin', innerHTML);
        }

        state.history.forEach(item => {
            renderSingleNotifItem(item, true);
        });

        if (state.unreadCount > 0) {
            bellBadge.style.display = 'flex';
            bellBadge.textContent = state.unreadCount;
        }

        function incrementUnread() {
            if (!notifDropdown.classList.contains('active')) {
                state.unreadCount++;
                bellBadge.style.display = 'flex';
                bellBadge.textContent = state.unreadCount;
                notifBell.classList.remove('shake');
                void notifBell.offsetWidth; // trigger reflow
                notifBell.classList.add('shake');
            }
            saveState();
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

        async function fetchLatestPost() {
            try {
                const res = await fetch(
                    `${SUPABASE_URL}/rest/v1/posts?published=eq.true&select=id,title,content&order=created_at.desc&limit=1`,
                    {
                        headers: {
                            'apikey': SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                        }
                    }
                );
                const data = await res.json();
                if (data && data.length > 0) {
                    const post = data[0];
                    if (state.lastPostId !== post.id) {
                        const rawContent = (post.content || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim();
                        const snippet = rawContent.substring(0, 60) + (rawContent.length > 60 ? '...' : '');
                        
                        const now = new Date();
                        const timeStr = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');

                        const notifData = {
                            isLivePost: true,
                            title: "حصري: " + post.title,
                            text: snippet,
                            url: `spinbetter-news/?post=${post.id}`,
                            timeStr: timeStr
                        };

                        state.lastPostId = post.id;
                        state.history.push(notifData);
                        
                        if (notifEmpty) notifEmpty.style.display = 'none';
                        renderSingleNotifItem(notifData, false);
                        incrementUnread();
                    }

                    if (window.location.pathname.includes('/spinbetter-news')) {
                        if (state.lastSeenNewsId !== post.id) {
                            state.lastSeenNewsId = post.id;
                            try { sessionStorage.setItem('sb_notifs_v2', JSON.stringify(state)); } catch(e){}
                        }
                    } else if (state.lastSeenNewsId !== post.id) {
                        const nBadge = document.getElementById('newsBadge');
                        if (nBadge) {
                            nBadge.style.display = 'flex';
                            nBadge.textContent = '1';
                        }
                    }
                }
            } catch (error) {
                console.error("Live notification fetch failed:", error);
            }
        }
        
        function triggerNextNotif() {
            if (state.msgIndex >= pushMessages.length) return;
            const pm = pushMessages[state.msgIndex];
            const now = new Date();
            const timeStr = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
            
            const notifItem = {
                title: pm.title,
                text: pm.text,
                timeStr: timeStr
            };
            
            if (notifEmpty) notifEmpty.style.display = 'none';
            state.history.push(notifItem);
            state.msgIndex++;
            renderSingleNotifItem(notifItem, false);
            incrementUnread();
        }

        if (state.msgIndex === 0) {
            setTimeout(triggerNextNotif, 500);
        }
        
        setInterval(triggerNextNotif, 25000); // 25 seconds for static
        
        fetchLatestPost();
        setInterval(fetchLatestPost, 15000); // 15 seconds to poll live posts
    }
});
