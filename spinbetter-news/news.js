const SUPABASE_URL = 'https://whwilmaizmfqgcgowrwf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indod2lsbWFpem1mcWdjZ293cndmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDQyNDcsImV4cCI6MjA5MDQ4MDI0N30.plNnsahhJPXPo6uNOrW2GwRSwAPVcDp2PEcSlb7Wgs0';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allPosts = [];
let currentFilter = 'all';
let userFingerprint = localStorage.getItem('newsUserFingerprint');
let userLikedPosts = [];
let currentViewingPost = null;

if (!userFingerprint) {
    userFingerprint = 'anon-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem('newsUserFingerprint', userFingerprint);
}

document.addEventListener('DOMContentLoaded', () => {
    fetchInitialData();
    setupTabs();
    setupRealtime();
    setupReadingProgress();
});

/* ── Helpers ─────────────────────────────────────────────── */

function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const seconds = Math.round((Date.now() - date) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);
    const clockSVG = `<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:currentColor;flex-shrink:0;"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>`;
    let label;
    if (seconds < 60) label = 'منذ لحظات';
    else if (minutes < 60) label = `منذ ${minutes} دقيقة`;
    else if (hours < 24) label = `منذ ${hours} ساعة`;
    else if (days < 30) label = `منذ ${days} يوم`;
    else {
        const d = date.getDate(), m = date.getMonth() + 1, y = date.getFullYear();
        label = `${d}/${m}/${y}`;
    }
    return `<span style="display:inline-flex;align-items:center;gap:4px;color:#64748b;font-size:12px;">${clockSVG}${label}</span>`;
}

function estimateReadTime(html) {
    const words = (html || '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
}

function stripHtml(html) {
    const cleanHtml = (html || '').replace(/<blockquote[^>]*>.*?\[MATCH_CARD:[A-Za-z0-9+/=]+\].*?<\/blockquote>/gs, '');
    const d = document.createElement('div');
    d.innerHTML = cleanHtml;
    const t = d.textContent || d.innerText || '';
    return t.substring(0, 120) + (t.length > 120 ? '...' : '');
}

function getCatInfo(category) {
    if (category === 'prediction') return { name: 'توقعات', dot: 'dot-prediction', badge: 'cat-prediction' };
    if (category === 'analysis') return { name: 'قسايم اليوم', dot: 'dot-analysis', badge: 'cat-analysis' };
    return { name: 'أخبار', dot: 'dot-news', badge: 'cat-news' };
}

/* ── Fake Stats (Seeded Random + Time Growth) ───────────────────── */

function seededRnd(seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
        h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
    }
    return (h >>> 0) / 4294967296;
}

function fmtNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return n.toString();
}

function getFakeStats(post) {
    const id = String(post.id);
    const ageH = (Date.now() - new Date(post.created_at).getTime()) / 3600000;
    const grow = Math.min(ageH / 24, 20); // cap growth at 20 ‘days’ worth

    const rv = seededRnd(id + 'v');
    const rs = seededRnd(id + 's');
    const rl = seededRnd(id + 'l');

    // Base: 8K–26K views, grows ~2.5K/day, then adds real server views
    const fakeViews  = Math.floor(8000  + rv * 18000 + grow * 2500) + (post.views  || 0);
    // Base: 300–1500 shares, grows ~60/day
    const fakeShares = Math.floor(300   + rs * 1200  + grow * 60);
    // Base: 120–600 likes, grows ~25/day, then adds real server likes
    const fakeLikes  = Math.floor(120   + rl * 480   + grow * 25)  + (post.likes  || 0);

    return {
        views:  fakeViews,
        shares: fakeShares,
        likes:  fakeLikes
    };
}

/* ── OG Meta Tags ────────────────────────────────────────── */

function updateMetaTags(post) {
    document.title = (post.title || '') + ' | SpinBetter';
    const set = (prop, val) => {
        let el = document.querySelector(`meta[property="${prop}"]`);
        if (!el) { el = document.createElement('meta'); el.setAttribute('property', prop); document.head.appendChild(el); }
        el.setAttribute('content', val);
    };
    set('og:title', post.title || '');
    set('og:description', stripHtml(post.content || ''));
    if (post.cover_image_url) set('og:image', post.cover_image_url);
    set('og:url', location.origin + location.pathname + '?post=' + post.id);
}

function resetMetaTags() {
    document.title = 'الأخبار والتحليلات | SpinBetter Portal';
}

/* ── Data ────────────────────────────────────────────────── */

async function fetchInitialData() {
    showSkeletons();
    try {
        const { data: postsData, error } = await supabaseClient
            .from('posts').select('*').eq('published', true).order('created_at', { ascending: false });
        if (error) throw error;
        allPosts = postsData || [];

        const { data: likesData } = await supabaseClient
            .from('post_likes').select('post_id').eq('user_fingerprint', userFingerprint);
        if (likesData) userLikedPosts = likesData.map(l => l.post_id);

        // Support both ?post=ID (SSR-friendly) and #post-ID (legacy hash)
        const qPost = new URLSearchParams(location.search).get('post');
        const hPost = location.hash.startsWith('#post-') ? location.hash.replace('#post-', '') : null;
        const targetId = qPost || hPost;
        const qTab = new URLSearchParams(location.search).get('tab');

        if (qTab && ['all', 'news', 'analysis'].includes(qTab)) {
            currentFilter = qTab;
            document.querySelectorAll('.news-tab').forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
                if (t.dataset.filter === currentFilter) {
                    t.classList.add('active');
                    t.setAttribute('aria-selected', 'true');
                }
            });
        }

        renderGrid();

        if (targetId) {
            const p = allPosts.find(x => x.id === targetId);
            if (p) setTimeout(() => openArticle(p), 150);
        }
    } catch (err) {
        console.error(err);
        document.getElementById('news-grid').innerHTML =
            '<div style="color:#ef4444;text-align:center;grid-column:1/-1;padding:60px;">فشل في تحميل المقالات. يرجى تحديث الصفحة.</div>';
    }
}

function showSkeletons() {
    document.getElementById('news-grid').innerHTML = Array(6).fill(0).map(() => `
        <div class="news-card-skeleton">
            <div class="sk-img"></div>
            <div class="sk-body">
                <div class="sk-line sk-short"></div>
                <div class="sk-line sk-long"></div>
                <div class="sk-line sk-mid"></div>
            </div>
        </div>`).join('');
}

/* ── Tabs ────────────────────────────────────────────────── */

function setupTabs() {
    document.querySelectorAll('.news-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.news-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
            tab.classList.add('active'); tab.setAttribute('aria-selected', 'true');
            currentFilter = tab.dataset.filter;
            
            const url = new URL(window.location);
            if (currentFilter === 'all') {
                url.searchParams.delete('tab');
            } else {
                url.searchParams.set('tab', currentFilter);
            }
            window.history.replaceState({}, '', url);

            renderGrid();
        });
    });
}

/* ── Grid ────────────────────────────────────────────────── */

function getEmptyStateMessage(filter) {
    const messages = {
        prediction: { icon: '🎯', title: 'لا توجد توقعات حالياً', sub: 'لم يتم نشر أي توقعات بعد. تابعنا قريباً!' },
        analysis: { icon: '🏷️', title: 'لا توجد قسايم اليوم', sub: 'لم يتم نشر أي قسايم بعد. تابعنا قريباً!' },
        news: { icon: '📰', title: 'لا توجد أخبار حالياً', sub: 'لم يتم نشر أي أخبار بعد. تابعنا قريباً!' },
        all: { icon: '📭', title: 'لا توجد مقالات بعد', sub: 'لم يتم نشر أي محتوى حتى الآن.' }
    };
    return messages[filter] || messages.all;
}

function renderGrid() {
    const grid = document.getElementById('news-grid');
    grid.innerHTML = '';
    const filtered = currentFilter === 'all' ? allPosts : allPosts.filter(p => p.category === currentFilter);
    if (!filtered.length) {
        const msg = getEmptyStateMessage(currentFilter);
        grid.innerHTML = `
            <div style="
                grid-column:1/-1;
                display:flex;
                flex-direction:column;
                align-items:center;
                justify-content:center;
                padding:80px 20px;
                text-align:center;
                gap:16px;
            ">
                <div style="
                    width:80px;height:80px;
                    border-radius:50%;
                    background:rgba(255,255,255,0.04);
                    border:1px solid rgba(255,255,255,0.08);
                    display:flex;align-items:center;justify-content:center;
                    font-size:32px;
                    margin-bottom:8px;
                ">${msg.icon}</div>
                <h3 style="
                    font-size:20px;font-weight:700;
                    color:#e2e8f0;margin:0;
                    font-family:'Tajawal',sans-serif;
                ">${msg.title}</h3>
                <p style="
                    font-size:14px;color:#475569;margin:0;
                    font-family:'Tajawal',sans-serif;
                    max-width:320px;line-height:1.6;
                ">${msg.sub}</p>
            </div>`;
        return;
    }
    filtered.forEach((post, i) => {
        const card = createCardElement(post);
        card.style.animationDelay = (i * 0.07) + 's';
        grid.appendChild(card);
    });
}

/* ── Card ────────────────────────────────────────────────── */

function createCardElement(post) {
    const isLiked = userLikedPosts.includes(post.id);
    const cat = getCatInfo(post.category);
    const mins = estimateReadTime(post.content);
    const excerpt = stripHtml(post.content);

    let imgHTML = `<div style="width:100%;min-height:130px;background:linear-gradient(135deg, #0d1117 0%, #1e293b 100%);border-radius:0.5rem;"></div>`;

    if (post.cover_image_url) {
        imgHTML = `<img src="${post.cover_image_url}" loading="lazy" alt="${(post.title || '').replace(/"/g, '&quot;')}">`;
    } else {
        const matchDataMatch = (post.content || '').match(/\[MATCH_CARD:([A-Za-z0-9+/=]+)\]/);
        if (matchDataMatch) {
            try {
                const data = JSON.parse(decodeURIComponent(escape(atob(matchDataMatch[1]))));
                const fallbackSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ctext y='18' font-size='16'%3E⚽%3C/text%3E%3C/svg%3E`;
                const cleanScore = (data.score || '').replace(/<[^>]*>/g, '').trim();
                imgHTML = `
                <div style="width:100%;min-height:140px;background:linear-gradient(135deg,rgba(6,182,212,0.12),rgba(14,165,233,0.08),rgba(139,92,246,0.12));display:flex;flex-direction:column;align-items:center;justify-content:center;padding:15px;font-family:'Tajawal',sans-serif;border-radius:0.5rem;">
                    <div style="font-size:10px;font-weight:700;color:#06b6d4;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">${data.lName}</div>
                    <div style="display:flex;align-items:center;gap:18px;width:100%;justify-content:center;">
                        <img src="${data.hLogo}" alt="" style="width:40px;height:40px;object-fit:contain;filter:drop-shadow(0 0 6px rgba(255,255,255,0.15));" onerror="this.src='${fallbackSvg}'">
                        <div style="font-size:22px;font-weight:900;color:#fff;font-family:'Inter',sans-serif;letter-spacing:1px;white-space:nowrap;">${cleanScore || 'VS'}</div>
                        <img src="${data.aLogo}" alt="" style="width:40px;height:40px;object-fit:contain;filter:drop-shadow(0 0 6px rgba(255,255,255,0.15));" onerror="this.src='${fallbackSvg}'">
                    </div>
                </div>`;
            } catch (e) { }
        }
    }

    const ctaHTML = (post.cta_text && post.cta_url)
        ? `<a class="mc-cta" href="${post.cta_url}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${post.cta_text}</a>`
        : '';

    function buildOutcomeHTML(text, color) {
        if (!text) return '';
        const isGreen   = color === 'green';
        const isRed     = color === 'red';
        const cssClass  = isGreen ? 'green' : isRed ? 'red' : 'pending';
        const label     = isGreen ? 'نجح' : isRed ? 'فشل' : 'معلق';
        const shortText = text.length > 60 ? text.substring(0, 60) + '...' : text;
        const iconSVG   = isGreen
            ? `<svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:currentColor;flex-shrink:0;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`
            : isRed
            ? `<svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:currentColor;flex-shrink:0;"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>`
            : `<svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:currentColor;flex-shrink:0;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;
        return `<div class="mc-outcome ${cssClass}">
            ${iconSVG}
            <div class="mc-outcome-text-wrap">
                <span class="mc-outcome-label">${label}</span>
                <span class="mc-outcome-value">${shortText}</span>
            </div>
        </div>`;
    }
    const outcomeHTML = buildOutcomeHTML(post.outcome_text, post.outcome_color);

    const card = document.createElement('div');
    card.className = 'news-card fade-in';

    const stats          = getFakeStats(post);
    const viewsFormatted = fmtNum(stats.views);
    const sharesFormatted = fmtNum(stats.shares);
    const likesFormatted  = fmtNum(stats.likes);

    const exactDate = new Date(post.created_at);
    const exactDateStr = `${exactDate.getDate()}/${exactDate.getMonth()+1}/${exactDate.getFullYear()}`;

    card.innerHTML = `
        <div class="mc-cat-row">
            <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px; line-height: 1;">
                <span id="ntime-${post.id}" class="mc-time"></span>
                <span class="mc-date-exact" style="font-size: 10.5px; color: #475569; font-weight: 700; letter-spacing: 0.5px; font-family: 'Inter', sans-serif;">${exactDateStr}</span>
            </div>
            <div class="mc-cat-label ${cat.badge}">
                <span class="mc-cat-dot"></span>${cat.name}
            </div>
        </div>
        <div class="mc-img">
            ${imgHTML}
        </div>
        <div class="mc-body">
            <h3 class="mc-title">${post.title || ''}</h3>
            <p class="mc-excerpt">${excerpt}</p>
            ${outcomeHTML}
        </div>
        ${ctaHTML}
        <div class="mc-footer">
            <button class="mc-readmore js-read-more">اقرأ المزيد</button>
            <div class="mc-actions">
                <div class="mc-action">
                    <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                    ${viewsFormatted}
                </div>
                <div class="card-share-wrapper" id="csw-${post.id}">
                    <button class="mc-action js-card-share" aria-label="مشاركة">
                        <svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
                        ${sharesFormatted}
                    </button>
                    <div class="card-share-dropdown" id="csd-${post.id}">
                        <div class="csd-option csd-copy js-card-copy">
                            <div class="csd-icon csd-icon-copy"><svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg></div>
                            نسخ الرابط
                        </div>
                        <a class="csd-option csd-wa" id="csd-wa-${post.id}" href="#" target="_blank" rel="noopener">
                            <div class="csd-icon csd-icon-wa"><svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.48 2 2 6.48 2 12c0 1.82.49 3.52 1.33 5L2 22l5.13-1.31C8.56 21.55 10.23 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.72 0-3.34-.47-4.73-1.28l-.34-.2-3.04.78.81-2.95-.22-.35C3.47 15.26 3 13.69 3 12 3 7.03 7.03 3 12 3s9 4.03 9 9-4.03 9-9 9z"/></svg></div>
                            واتساب
                        </a>
                        <a class="csd-option csd-tg" id="csd-tg-${post.id}" href="#" target="_blank" rel="noopener">
                            <div class="csd-icon csd-icon-tg"><svg viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.892-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg></div>
                            تيليجرام
                        </a>
                    </div>
                </div>
                <button class="mc-action js-like-btn ${isLiked ? 'liked' : ''}" id="like-btn-${post.id}" aria-label="إعجاب">
                    <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                    <span id="like-count-${post.id}">${likesFormatted}</span>
                </button>
            </div>
        </div>`;
    // Set time via innerHTML (critical — NOT textContent)
    card.querySelector(`#ntime-${post.id}`).innerHTML = formatTimeAgo(post.created_at);

    // Events
    card.querySelector('.js-read-more').addEventListener('click', e => { e.stopPropagation(); openArticle(post); });
    card.addEventListener('click', e => {
        if (e.target.closest('.mc-action,.mc-cta,.card-share-wrapper,.csd-option')) return;
        openArticle(post);
    });
    card.querySelector('.js-card-share').addEventListener('click', e => toggleCardShare(post.id, e));
    card.querySelector('.js-card-copy').addEventListener('click', e => copyCardPostLink(post.id, e));
    card.querySelector('.js-like-btn').addEventListener('click', e => toggleLike(post.id, e));

    // Share links
    const shareUrl = location.origin + location.pathname + '?post=' + post.id;
    const waEl = card.querySelector(`#csd-wa-${post.id}`);
    const tgEl = card.querySelector(`#csd-tg-${post.id}`);
    const { waTxt, tgTxt, ogUrl } = buildShareMsg(post, shareUrl);
    if (waEl) waEl.href = `https://wa.me/?text=${encodeURIComponent(waTxt)}`;
    if (tgEl) tgEl.href = `https://t.me/share/url?url=${encodeURIComponent(ogUrl)}&text=${encodeURIComponent(tgTxt)}`;

    return card;
}

/* ── Share Message Builder ───────────────────────────────── */

function buildShareMsg(post, shareUrl) {
    const title = post.title || 'SpinBetter';
    const cat = getCatInfo(post.category);
    const excerpt = stripHtml(post.content || '').substring(0, 180).trim();
    const imgUrl = post.cover_image_url || '';
    // Use ?post=ID so Cloudflare Function can serve OG tags
    const ogUrl = location.origin + location.pathname + '?post=' + post.id;

    // Try to extract match details from content
    let matchLine = '';
    const matchDataMatch = (post.content || '').match(/\[MATCH_CARD:([A-Za-z0-9+/=]+)\]/);
    if (matchDataMatch) {
        try {
            const data = JSON.parse(decodeURIComponent(escape(atob(matchDataMatch[1]))));
            const score = (data.score || '').replace(/<[^>]*>/g, '').trim();
            matchLine = `\n\n⚽ ${data.hName} ${score || 'vs'} ${data.aName}` +
                (data.lName ? ` | ${data.lName}` : '');
        } catch (e) { }
    }

    // Build sections
    const catLine = `🏷 ${cat.name}`;
    const titleLine = `📰 ${title}`;
    const excerptLine = excerpt ? `\n\n${excerpt}${excerpt.length >= 180 ? '...' : ''}` : '';
    const imgSection = imgUrl ? `\n\n🖼 ${imgUrl}` : '';
    const promoLine = `\n\n🔥 SpinBetter | الكود W300 → مكافأة 200% عند التسجيل!`;
    const linkLine = `\n\n🔗 ${shareUrl}`;

    const waTxt = `${catLine}\n${titleLine}${matchLine}${excerptLine}${imgSection}${promoLine}\n\n🔗 ${ogUrl}`;
    const tgTxt = `${catLine}\n${titleLine}${matchLine}${excerptLine}${imgSection}${promoLine}`;

    return { waTxt, tgTxt, ogUrl };
}


/* ── Card Share ──────────────────────────────────────────── */

function toggleCardShare(id, event) {
    if (event) event.stopPropagation();
    document.querySelectorAll('.card-share-dropdown.open').forEach(el => { if (el.id !== 'csd-' + id) el.classList.remove('open'); });
    const dd = document.getElementById('csd-' + id);
    if (dd) dd.classList.toggle('open');
}

function copyCardPostLink(id, event) {
    if (event) event.stopPropagation();
    const url = location.origin + location.pathname + '?post=' + id;
    navigator.clipboard.writeText(url).then(() => showNewsToast('تم نسخ الرابط ✓')).catch(() => prompt('الرابط:', url));
    const dd = document.getElementById('csd-' + id);
    if (dd) dd.classList.remove('open');
}

document.addEventListener('click', e => {
    const dd = document.getElementById('share-dropdown');
    const wrapper = document.getElementById('share-wrapper');
    if (dd && wrapper && !wrapper.contains(e.target)) dd.classList.remove('open');
    if (!e.target.closest('.card-share-wrapper'))
        document.querySelectorAll('.card-share-dropdown.open').forEach(el => el.classList.remove('open'));
});

/* ── Reading Progress ────────────────────────────────────── */

function setupReadingProgress() {
    const overlay = document.getElementById('article-view');
    const bar = document.getElementById('readingProgress');
    if (!overlay || !bar) return;
    overlay.addEventListener('scroll', () => {
        const total = overlay.scrollHeight - overlay.clientHeight;
        bar.style.width = total > 0 ? (overlay.scrollTop / total * 100) + '%' : '0%';
    });
}

/* ── Article Overlay ─────────────────────────────────────── */

function replaceMatchCards(content) {
    if (!content) return '';
    return content.replace(/<blockquote[^>]*>.*?\[MATCH_CARD:([A-Za-z0-9+/=]+)\].*?<\/blockquote>/gs, (fullMatch, b64) => {
        try {
            const data = JSON.parse(decodeURIComponent(escape(atob(b64))));
            const fallbackSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ctext y='18' font-size='16'%3E⚽%3C/text%3E%3C/svg%3E`;

            return `<div style="margin:20px 0;direction:ltr;font-family:'Tajawal',sans-serif;">
  <div style="background:#111827;border:1px solid rgba(255,255,255,0.08);border-radius:8px;overflow:hidden;">
    <div style="height:3px;background:#e31e24;"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:rgba(255,255,255,0.02);">
      <span style="font-size:10px;font-weight:800;color:#e31e24;text-transform:uppercase;letter-spacing:1px;">${data.lName}</span>
      <span style="font-size:10px;color:#475569;">${data.lCountry}</span>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;gap:8px;">
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px;flex:1;">
        <img src="${data.hLogo}" alt="${data.hName}" width="48" height="48" style="object-fit:contain;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5));" onerror="this.src='${fallbackSvg}'" loading="lazy">
        <span style="font-size:12px;font-weight:700;color:#e2e8f0;text-align:center;line-height:1.3;">${data.hName}</span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px;flex-shrink:0;min-width:110px;">
        <span style="font-size:32px;font-weight:900;color:#fff;letter-spacing:4px;line-height:1;white-space:nowrap;">${data.score}</span>
        ${data.badge}
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px;flex:1;">
        <img src="${data.aLogo}" alt="${data.aName}" width="48" height="48" style="object-fit:contain;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5));" onerror="this.src='${fallbackSvg}'" loading="lazy">
        <span style="font-size:12px;font-weight:700;color:#e2e8f0;text-align:center;line-height:1.3;">${data.aName}</span>
      </div>
    </div>
    ${data.venue && data.venue !== 'غير معروف' ? `<div style="text-align:center;padding:7px 14px;border-top:1px solid rgba(255,255,255,0.05);font-size:10px;color:#334155;">🏟️ ${data.venue}</div>` : ''}
  </div>
</div>`;
        } catch (e) {
            console.error('Match card parse error', e);
            return fullMatch;
        }
    });
}

function openArticle(post) {
    try {
        currentViewingPost = post;
        const isLiked = userLikedPosts.includes(post.id);

        try { history.pushState(null, null, '?post=' + post.id); } catch (e) { }

        try { updateMetaTags(post); } catch (e) { console.error("Meta tags error:", e); }

        const titleEl = document.getElementById('article-title');
        if (titleEl) titleEl.textContent = post.title || '';

        const dateEl = document.getElementById('article-date');
        if (dateEl) dateEl.innerHTML = formatTimeAgo(post.created_at);

        const rtEl = document.querySelector('#article-read-time span');
        if (rtEl) rtEl.textContent = estimateReadTime(post.content) + ' دقائق قراءة';

        const viewsEl = document.getElementById('article-views-val');
        if (viewsEl) {
            const s = getFakeStats(post);
            viewsEl.textContent = fmtNum(s.views);
        }

        const bodyEl = document.getElementById('article-body');
        if (bodyEl) bodyEl.innerHTML = replaceMatchCards(post.content || '');

        // Outcome banner
        const existingBanner = document.getElementById('article-outcome-banner');
        if (existingBanner) existingBanner.remove();
        if (post.outcome_text && post.outcome_color) {
            const icon = post.outcome_color === 'green' ? '🏆' : '❌';
            const label = post.outcome_color === 'green' ? 'نجح التوقع' : 'فشل التوقع';
            const banner = document.createElement('div');
            banner.id = 'article-outcome-banner';
            banner.className = `article-outcome-banner ${post.outcome_color}`;
            banner.innerHTML = `
                <span class="aob-icon">${icon}</span>
                <div>
                    <span class="aob-label">${label}</span>
                    <span class="aob-text">${post.outcome_text}</span>
                </div>`;
            if (bodyEl) bodyEl.insertAdjacentElement('beforebegin', banner);
        }

        const likesEl = document.getElementById('article-like-count');
        if (likesEl) likesEl.textContent = post.likes || 0;

        const likeBtn = document.getElementById('article-like-btn');
        if (likeBtn) {
            if (isLiked) likeBtn.classList.add('liked');
            else likeBtn.classList.remove('liked');
        }

        function setCat(el) {
            if (!el) return;
            const cat = getCatInfo(post.category);
            el.className = 'cat-badge ' + cat.badge;
            el.textContent = cat.name;
        }
        setCat(document.getElementById('article-cat'));
        setCat(document.getElementById('article-cat-hero'));

        const heroWrap = document.getElementById('article-hero-wrap');
        const imgEl = document.getElementById('article-img');
        const contentWrap = document.getElementById('article-content-wrap');
        if (post.cover_image_url) {
            if (imgEl) { imgEl.src = post.cover_image_url; imgEl.alt = post.title || ''; }
            if (heroWrap) heroWrap.style.display = 'block';
            const ac = document.getElementById('article-cat');
            if (ac) ac.style.display = 'none';
            if (contentWrap) contentWrap.classList.add('has-hero');
        } else {
            if (imgEl) imgEl.src = '';
            if (heroWrap) heroWrap.style.display = 'none';
            const ac = document.getElementById('article-cat');
            if (ac) ac.style.display = '';
            if (contentWrap) contentWrap.classList.remove('has-hero');
        }

        const ctaContainer = document.getElementById('article-cta-container');
        if (ctaContainer) {
            if (post.cta_text && post.cta_url) {
                ctaContainer.innerHTML = `<a href="${post.cta_url}" target="_blank" rel="noopener" class="btn-glowing-massive" style="display:inline-block;margin-bottom:25px;">${post.cta_text}</a>`;
                ctaContainer.style.display = 'block';
            } else {
                ctaContainer.innerHTML = '';
                ctaContainer.style.display = 'none';
            }
        }

        try { updateShareLinks(post); } catch (e) { console.error("Share links error:", e); }

        const shareBtnEl = document.getElementById('article-share-btn');
        if (shareBtnEl) shareBtnEl.onclick = toggleShareDropdown;

        const shareDd = document.getElementById('share-dropdown');
        if (shareDd) shareDd.classList.remove('open');

        try { renderRelatedPosts(post); } catch (e) { console.error("Related posts error:", e); }

        supabaseClient.rpc('increment_views', { post_id: post.id }).then(() => { }).catch(() => { });

        const drawer = document.getElementById('article-view');
        if (drawer) {
            drawer.style.display = 'block';
            drawer.scrollTop = 0;
            const bar = document.getElementById('readingProgress');
            if (bar) bar.style.width = '0%';
            void drawer.offsetWidth;
            drawer.classList.add('active');
            document.body.style.overflow = 'hidden';
        } else {
            console.error("article-view not found");
        }
    } catch (err) {
        console.error("Error opening article:", err);
        alert("حدث خطأ أثناء فتح المقال: " + err.message);
    }
}

function renderRelatedPosts(currentPost) {
    const section = document.getElementById('related-posts-section');
    if (!section) return;
    const related = allPosts.filter(p => p.id !== currentPost.id && p.category === currentPost.category).slice(0, 3);
    if (!related.length) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    const list = document.getElementById('related-posts-list');
    list.innerHTML = '';
    related.forEach(rp => {
        const imgH = rp.cover_image_url
            ? `<img src="${rp.cover_image_url}" loading="lazy" alt="" style="width:100%;height:110px;object-fit:cover;display:block;">`
            : `<div style="width:100%;height:110px;background:linear-gradient(135deg,#1e293b,#0d1117);"></div>`;
        const el = document.createElement('div');
        el.className = 'related-card';
        el.innerHTML = `<div class="related-card-inner">${imgH}<div style="padding:10px;"><p style="font-size:13px;font-weight:700;color:#fff;margin:0;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${rp.title || ''}</p></div></div>`;
        el.querySelector('.related-card-inner').addEventListener('click', () => openArticle(rp));
        list.appendChild(el);
    });
}

function closeArticle() {
    const drawer = document.getElementById('article-view');
    drawer.classList.remove('active');
    document.body.style.overflow = '';
    const bar = document.getElementById('readingProgress');
    if (bar) bar.style.width = '0%';
    const dd = document.getElementById('share-dropdown');
    if (dd) dd.classList.remove('open');
    history.pushState(null, null, location.pathname);
    resetMetaTags();
    setTimeout(() => { drawer.style.display = 'none'; }, 350);
    currentViewingPost = null;
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('article-view').classList.contains('active')) closeArticle();
});
document.getElementById('article-view').addEventListener('click', function (e) {
    if (e.target === this) closeArticle();
});

/* ── Article Share ───────────────────────────────────────── */

function toggleShareDropdown(event) {
    if (event) event.stopPropagation();
    document.getElementById('share-dropdown').classList.toggle('open');
}

function updateShareLinks(post) {
    const shareUrl = location.origin + location.pathname + '?post=' + post.id;
    const { waTxt, tgTxt, ogUrl } = buildShareMsg(post, shareUrl);
    const waEl = document.getElementById('share-wa-link');
    const tgEl = document.getElementById('share-tg-link');
    if (waEl) waEl.href = `https://wa.me/?text=${encodeURIComponent(waTxt)}`;
    if (tgEl) tgEl.href = `https://t.me/share/url?url=${encodeURIComponent(ogUrl)}&text=${encodeURIComponent(tgTxt)}`;
}

function copyArticleLink() {
    const url = location.origin + location.pathname + '?post=' + (currentViewingPost?.id || '');
    navigator.clipboard.writeText(url).then(() => showNewsToast('تم نسخ الرابط ✓')).catch(() => prompt('الرابط:', url));
    document.getElementById('share-dropdown').classList.remove('open');
}

/* ── Likes ───────────────────────────────────────────────── */

async function toggleLike(postId, event = null) {
    if (event) event.stopPropagation();
    const idx = allPosts.findIndex(p => p.id === postId);
    if (idx === -1) return;
    const isLiked = userLikedPosts.includes(postId);
    const likeBtn = document.getElementById('like-btn-' + postId);
    const countEl = document.getElementById('like-count-' + postId);
    let newCount = allPosts[idx].likes || 0;

    if (isLiked) {
        userLikedPosts = userLikedPosts.filter(id => id !== postId);
        newCount = Math.max(0, newCount - 1);
        if (likeBtn) likeBtn.classList.remove('liked');
    } else {
        userLikedPosts.push(postId);
        newCount++;
        if (likeBtn) likeBtn.classList.add('liked');
    }
    if (countEl) countEl.textContent = newCount;
    allPosts[idx].likes = newCount;

    try {
        if (isLiked) {
            await supabaseClient.from('post_likes').delete().match({ post_id: postId, user_fingerprint: userFingerprint });
        } else {
            await supabaseClient.from('post_likes').insert([{ post_id: postId, user_fingerprint: userFingerprint }]);
        }
        await supabaseClient.from('posts').update({ likes: newCount }).eq('id', postId);
    } catch (err) { console.error('Like error:', err); }
}

async function toggleLikeFromArticle() {
    if (!currentViewingPost) return;
    await toggleLike(currentViewingPost.id);
    const isLiked = userLikedPosts.includes(currentViewingPost.id);
    const likeBtn = document.getElementById('article-like-btn');
    const countEl = document.getElementById('article-like-count');
    if (likeBtn) { if (isLiked) likeBtn.classList.add('liked'); else likeBtn.classList.remove('liked'); }
    const idx = allPosts.findIndex(p => p.id === currentViewingPost.id);
    if (countEl) countEl.textContent = allPosts[idx]?.likes || 0;
}

/* ── Toast ───────────────────────────────────────────────── */

function showNewsToast(message) {
    let c = document.getElementById('news-toast-container');
    if (!c) {
        c = document.createElement('div');
        c.id = 'news-toast-container';
        c.style.cssText = 'position:fixed;bottom:80px;right:20px;z-index:20000;display:flex;flex-direction:column;gap:8px;';
        document.body.appendChild(c);
    }
    const t = document.createElement('div');
    t.style.cssText = 'background:#06b6d4;color:#fff;padding:10px 18px;border-radius:8px;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,0.4);opacity:0;transform:translateY(16px);transition:all 0.3s ease;font-family:Tajawal,sans-serif;font-size:14px;';
    t.textContent = message;
    c.appendChild(t);
    requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateY(0)'; });
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(16px)'; setTimeout(() => t.remove(), 300); }, 3000);
}

/* ── Real-time ───────────────────────────────────────────── */

function setupRealtime() {
    supabaseClient
        .channel('realtime-posts')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, payload => {
            if (!payload.new?.published) return;
            allPosts.unshift(payload.new);
            if (currentFilter === 'all' || currentFilter === payload.new.category) {
                const grid = document.getElementById('news-grid');
                if (grid.textContent.includes('لا توجد')) grid.innerHTML = '';
                const card = createCardElement(payload.new);
                grid.insertBefore(card, grid.firstChild);
            } else {
                showNewsToast('مقال جديد — اضغط للتحديث');
            }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, payload => {
            if (!payload.new) return;
            const idx = allPosts.findIndex(p => p.id === payload.new.id);
            if (idx !== -1) {
                allPosts[idx] = payload.new;
                const cEl = document.getElementById('like-count-' + payload.new.id);
                if (cEl) cEl.textContent = payload.new.likes;
                if (currentViewingPost?.id === payload.new.id) {
                    const aEl = document.getElementById('article-like-count');
                    if (aEl) aEl.textContent = payload.new.likes;
                }
            }
        })
        .subscribe(status => console.log('Realtime:', status));
}