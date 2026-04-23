const SUPABASE_URL = 'https://whwilmaizmfqgcgowrwf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indod2lsbWFpem1mcWdjZ293cndmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDQyNDcsImV4cCI6MjA5MDQ4MDI0N30.plNnsahhJPXPo6uNOrW2GwRSwAPVcDp2PEcSlb7Wgs0';

function safeDecodeB64(str) {
    return decodeURIComponent(Array.prototype.map.call(atob(str), function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
}

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ── Constants ───────────────────────────────────────────── */
const PAGE_SIZE = 9;

/* ── State ───────────────────────────────────────────────── */
let allPosts = [];
let filteredPosts = [];
let currentFilter = 'all';
let currentSearch = '';
let currentPage = 1;
let userFingerprint = localStorage.getItem('newsUserFingerprint');
let userLikedPosts = [];
let currentViewingPost = null;

if (!userFingerprint) {
    userFingerprint = 'anon-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem('newsUserFingerprint', userFingerprint);
}

/* ── Init ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    fetchInitialData();
    setupTabs();
    // setupRealtime(); // DISABLED: Causing excessive load on Supabase Realtime (wal operations)
    setupReadingProgress();
    injectNewsSearchBar();
});

/* ── SVG Icons Library ───────────────────────────────────── */
// Centralized, semantically correct SVG icons for the news portal

const ICONS = {
    // 🔍 Search — magnifying glass, standard and universally understood
    search: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
    </svg>`,

    // ✕ Clear/Close — simple X for clearing search or closing overlay
    close: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5"
              stroke-linecap="round" fill="none"/>
    </svg>`,

    // 🕐 Time/Clock — used next to "published X minutes ago"
    clock: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" fill="none"/>
        <path d="M12 7v5l3.5 3.5" stroke="currentColor" stroke-width="1.8"
              stroke-linecap="round" fill="none"/>
    </svg>`,

    // 📅 Calendar — used next to exact publish date
    calendar: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor"
              stroke-width="1.8" fill="none"/>
        <path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" stroke-width="1.8"
              stroke-linecap="round" fill="none"/>
    </svg>`,

    // ❤️ Like/Heart — for liking news articles
    heart: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
              stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
              stroke-linejoin="round" fill="none"/>
    </svg>`,

    // 👁️ Views — eye icon for view count on news articles
    eye: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
              stroke="currentColor" stroke-width="1.8" fill="none"/>
        <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8" fill="none"/>
    </svg>`,

    // 🔗 Share — branching nodes, represents sharing/spreading news
    share: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="18" cy="5" r="3" stroke="currentColor" stroke-width="1.8" fill="none"/>
        <circle cx="6" cy="12" r="3" stroke="currentColor" stroke-width="1.8" fill="none"/>
        <circle cx="18" cy="19" r="3" stroke="currentColor" stroke-width="1.8" fill="none"/>
        <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"
              stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>
    </svg>`,

    // 📋 Copy Link — two overlapping documents
    copy: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor"
              stroke-width="1.8" fill="none"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
              stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>
    </svg>`,

    // ✅ Success/Prediction Won — checkmark in circle
    checkCircle: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8" fill="none"/>
        <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>`,

    // ❌ Failure/Prediction Lost — X in circle
    xCircle: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8" fill="none"/>
        <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" fill="none"/>
    </svg>`,

    // ⏳ Pending — hourglass, represents awaited outcome
    hourglass: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 2h14M5 22h14M6 2v6l4 4-4 4v6M18 2v6l-4 4 4 4v6"
              stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
              stroke-linejoin="round" fill="none"/>
    </svg>`,

    // 📰 Newspaper — the hero "latest news" badge icon
    newspaper: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a4 4 0 0 1-4-4V6"
              stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>
        <path d="M10 7h8M10 11h8M10 15h5" stroke="currentColor" stroke-width="1.8"
              stroke-linecap="round" fill="none"/>
        <rect x="10" y="2" width="0" height="0" fill="none"/>
    </svg>`,

    // 🏆 Trophy — for trending/popular articles sidebar
    trophy: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 21h8M12 17v4M17 3h3v4a5 5 0 0 1-3.5 4.75M7 3H4v4a5 5 0 0 0 3.5 4.75"
              stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>
        <path d="M7 3h10v7a5 5 0 0 1-10 0V3z" stroke="currentColor"
              stroke-width="1.8" stroke-linecap="round" fill="none"/>
    </svg>`,

    // ⚽ Football/Soccer — used in match cards, football news
    football: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8" fill="none"/>
        <path d="M12 2c0 0-2 3-2 6s2 4 2 4 2-1 2-4-2-6-2-6z"
              stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
        <path d="M2.5 9.5l3.5 2M18 11.5l3.5-2M5 18l3-2M16 16l3 2M9 20l1-3M14 17l1 3"
              stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    </svg>`,

    // ← Previous page arrow
    arrowLeft: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>`,

    // → Next page arrow
    arrowRight: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>`,

    // 📖 Read More — open book, represents reading an article
    book: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" stroke="currentColor"
              stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" stroke="currentColor"
              stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>`,

    // 🔔 Breaking News notification bell
    bell: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
              stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor"
              stroke-width="1.8" stroke-linecap="round" fill="none"/>
    </svg>`,

    // 🌐 Live/Realtime — broadcast signal waves
    broadcast: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="2" fill="currentColor"/>
        <path d="M4.93 4.93a10 10 0 0 0 0 14.14M19.07 4.93a10 10 0 0 1 0 14.14"
              stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>
        <path d="M7.76 7.76a6 6 0 0 0 0 8.48M16.24 7.76a6 6 0 0 1 0 8.48"
              stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>
    </svg>`,

    // 📊 Analysis/Statistics — bar chart for analysis posts
    barChart: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" fill="none"/>
    </svg>`,

    // 🎯 Prediction — target/bullseye for prediction posts
    target: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8" fill="none"/>
        <circle cx="12" cy="12" r="6" stroke="currentColor" stroke-width="1.8" fill="none"/>
        <circle cx="12" cy="12" r="2" stroke="currentColor" stroke-width="1.8" fill="none"/>
    </svg>`,

    // 🖼️ Image placeholder — photo frame with mountain silhouette
    imagePlaceholder: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor"
              stroke-width="1.5" fill="none"/>
        <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/>
        <path d="M21 15l-5-5L5 21" stroke="currentColor" stroke-width="1.5"
              stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>`,

    // ↗️ External CTA arrow (used in match card "details" button)
    chevronLeft: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>`,

    // 🔴 Live dot (CSS animated, but SVG version for static use)
    liveCircle: `<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
        <circle cx="5" cy="5" r="4" fill="currentColor"/>
    </svg>`,

    // WhatsApp brand icon
    whatsapp: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" fill="currentColor"/>
        <path d="M12 2C6.48 2 2 6.48 2 12c0 1.82.49 3.52 1.33 5L2 22l5.13-1.31C8.56 21.55 10.23 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.72 0-3.34-.47-4.73-1.28l-.34-.2-3.04.78.81-2.95-.22-.35C3.47 15.26 3 13.69 3 12 3 7.03 7.03 3 12 3s9 4.03 9 9-4.03 9-9 9z" fill="currentColor"/>
    </svg>`,

    // Telegram brand icon
    telegram: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.892-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" fill="currentColor"/>
    </svg>`,

    // 🛡️ Shield — for security/verification badges
    shield: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2l7 4v6c0 4.5-3.5 7.5-7 8.5-3.5-1-7-4-7-8.5V6l7-4z"
              stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
              stroke-linejoin="round" fill="none"/>
        <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>`,

    // 🎬 Play button — for video/carousel content in hero
    play: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8" fill="none"/>
        <path d="M10 8l6 4-6 4V8z" stroke="currentColor" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>`,

    // 📡 News ticker satellite/antenna
    antenna: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 22v-8M4.93 10.93a10 10 0 0 0 14.14 0"
              stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>
        <path d="M7.76 7.76a6 6 0 0 0 8.48 8.48"
              stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>
        <circle cx="12" cy="5" r="3" stroke="currentColor" stroke-width="1.8" fill="none"/>
    </svg>`,

    // 🏟️ Stadium — match venue
    stadium: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 18c0-5 2-10 9-10s9 5 9 10" stroke="currentColor"
              stroke-width="1.8" stroke-linecap="round" fill="none"/>
        <path d="M1 18h22M6 18v2m5-2v2m5-2v2"
              stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>
        <path d="M8 8c0-2 1.5-4 4-4s4 2 4 4"
              stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>
    </svg>`,
};

// Helper: inject SVG with size and color
function icon(name, size = 16, color = 'currentColor') {
    const svg = ICONS[name];
    if (!svg) return '';
    return svg
        .replace('<svg ', `<svg width="${size}" height="${size}" style="color:${color};flex-shrink:0;" `)
        .replace('fill="currentColor"', `fill="${color}"`)
        .replace(/stroke="currentColor"/g, `stroke="${color}"`);
}

/* ── Search Bar Injection ────────────────────────────────── */
function injectNewsSearchBar() {
    const tabsEl = document.getElementById('news-tabs');
    if (!tabsEl) return;

    const wrap = document.createElement('div');
    wrap.id = 'news-search-wrap';
    wrap.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        padding: 10px 16px;
        margin-bottom: 28px;
        transition: border-color 0.2s;
    `;

    // Search icon: magnifying glass — semantically correct for search
    wrap.innerHTML = `
        <span style="width:18px;height:18px;color:#475569;flex-shrink:0;display:flex;align-items:center;">
            ${icon('search', 18, '#475569')}
        </span>
        <input
            id="news-search-input"
            type="text"
            placeholder="ابحث في الأخبار والتحليلات..."
            autocomplete="off"
            style="
                flex:1;
                background:transparent;
                border:none;
                outline:none;
                color:#e2e8f0;
                font-family:'Tajawal',sans-serif;
                font-size:14px;
                direction:rtl;
            "
        >
        <button id="news-search-clear" onclick="clearNewsSearch()" style="
            display:none;
            background:rgba(255,255,255,0.08);
            border:none;
            border-radius:6px;
            color:#94a3b8;
            width:24px;height:24px;
            cursor:pointer;
            padding:0;
            align-items:center;
            justify-content:center;
            flex-shrink:0;
        ">
            ${icon('close', 14, '#94a3b8')}
        </button>
    `;

    tabsEl.insertAdjacentElement('afterend', wrap);

    const input = document.getElementById('news-search-input');
    const clearBtn = document.getElementById('news-search-clear');

    wrap.addEventListener('focusin', () => {
        wrap.style.borderColor = 'rgba(6,182,212,0.4)';
    });
    wrap.addEventListener('focusout', () => {
        wrap.style.borderColor = 'rgba(255,255,255,0.08)';
    });

    let searchDebounceTimeout;
    input.addEventListener('input', () => {
        currentSearch = input.value.trim();
        clearBtn.style.display = currentSearch ? 'flex' : 'none';

        clearTimeout(searchDebounceTimeout);
        searchDebounceTimeout = setTimeout(() => {
            currentPage = 1;
            applyFiltersAndRender();
        }, 300);
    });
}

function clearNewsSearch() {
    const input = document.getElementById('news-search-input');
    const clearBtn = document.getElementById('news-search-clear');
    if (input) input.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    currentSearch = '';
    currentPage = 1;
    applyFiltersAndRender();
}

/* ── Helpers ─────────────────────────────────────────────── */
function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const seconds = Math.round((Date.now() - date) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    const clockSVG = icon('clock', 12, 'currentColor');
    
    let label;
    if (seconds < 60) label = 'منذ لحظات';
    else if (minutes < 60) label = `منذ ${minutes} دقيقة`;
    else if (hours < 24) label = `منذ ${hours} ساعة`;
    else if (days < 30) label = `منذ ${days} يوم`;
    else {
        label = new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
    }

    return `<span style="display:inline-flex;align-items:center;gap:4px;color:#64748b;font-size:11px;white-space:nowrap;">${clockSVG} ${label}</span>`;
}

function estimateReadTime(html) {
    const words = (html || '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
}

function stripHtml(html) {
    const cleanHtml = (html || '')
        .replace(/<blockquote[^>]*>.*?\[MATCH_CARD:[A-Za-z0-9+/=]+\].*?<\/blockquote>/gs, '')
        .replace(/<blockquote[^>]*>.*?\[INSTAGRAM:.*?\].*?<\/blockquote>/gs, '')
        .replace(/<blockquote[^>]*>.*?\[EMBED_CODE:.*?\].*?<\/blockquote>/gs, '');
    const d = document.createElement('div');
    d.innerHTML = cleanHtml;
    const t = d.textContent || d.innerText || '';
    return t.substring(0, 120) + (t.length > 120 ? '...' : '');
}

function getCatInfo(category) {
    const map = {
        prediction: { name: 'توقعات',          dot: 'dot-prediction', badge: 'cat-prediction', color: '#f59e0b' },
        analysis:   { name: 'قسايم اليوم',       dot: 'dot-analysis',   badge: 'cat-analysis',   color: '#a78bfa' },
        ai:         { name: 'ذكاء اصطناعي',    dot: 'dot-ai',         badge: 'cat-ai',         color: '#8b5cf6' },
        business:   { name: 'المال والأعمال',  dot: 'dot-business',   badge: 'cat-business',   color: '#f59e0b' },
        phones:     { name: 'هواتف',             dot: 'dot-phones',     badge: 'cat-phones',     color: '#22c55e' },
        reviews:    { name: 'مراجعات',           dot: 'dot-reviews',    badge: 'cat-reviews',    color: '#ec4899' },
        gaming:     { name: 'الألعاب',            dot: 'dot-gaming',     badge: 'cat-gaming',     color: '#f97316' },
        casino:     { name: 'كازينو',             dot: 'dot-casino',     badge: 'cat-casino',     color: '#e31e24' },
        news:       { name: 'أخبار',             dot: 'dot-news',       badge: 'cat-news',       color: '#38bdf8' },
    };
    return map[category] || { name: 'أخبار', dot: 'dot-news', badge: 'cat-news', color: '#38bdf8' };
}

/* ── Fallback & Image Extraction ────────────────────────────── */
window.getFallbackImgHTML = function () {
    // Newspaper/article placeholder: represents missing article cover image
    // Uses newspaper + subtle gradient — visually communicates "news content"
    return `
    <div style="
        width:100%;min-height:160px;
        background:linear-gradient(135deg,#0d1117 0%,#1a2235 50%,#0d1520 100%);
        border-radius:0.5rem;
        display:flex;flex-direction:column;
        align-items:center;justify-content:center;
        gap:10px;
        height:100%;
    ">
        <svg viewBox="0 0 24 24" width="44" height="44" style="opacity:0.18;" xmlns="http://www.w3.org/2000/svg">
            <!-- Newspaper icon: correct placeholder for a news article with missing image -->
            <rect x="2" y="3" width="20" height="18" rx="2"
                  stroke="#06b6d4" stroke-width="1.5" fill="none"/>
            <path d="M6 7h12M6 11h12M6 15h7"
                  stroke="#06b6d4" stroke-width="1.5" stroke-linecap="round" fill="none"/>
            <rect x="2" y="3" width="5" height="5" rx="1"
                  stroke="#475569" stroke-width="1.2" fill="rgba(6,182,212,0.08)"/>
        </svg>
        <svg viewBox="0 0 64 20" width="64" height="20" style="opacity:0.1;" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="15" font-family="monospace" font-size="9" fill="#06b6d4"
                  letter-spacing="2">KORA74 NEWS</text>
        </svg>
    </div>`;
};

function getMatchOrFallback(post, mode = 'card') {
    if (post.cover_image_url) {
        let firstImageUrl = post.cover_image_url;
        if (firstImageUrl.includes(',')) firstImageUrl = firstImageUrl.split(',')[0];
        const fall = btoa(encodeURIComponent(window.getFallbackImgHTML ? window.getFallbackImgHTML() : ''));
        if (mode === 'hero') {
            return `<img src="${firstImageUrl}" class="p-hero-bg" style="object-fit:cover; width:100%; height:100%; position:absolute; inset:0; transition: transform 10s ease, opacity 0.8s ease;" onerror="this.outerHTML=decodeURIComponent(atob('${fall}'))">`;
        } else if (mode === 'sidebar') {
            return `<img src="${firstImageUrl}" loading="lazy" style="width:100%;height:140px;object-fit:cover;display:block;" onerror="this.outerHTML=decodeURIComponent(atob('${fall}'))">`;
        } else {
            return `<img src="${firstImageUrl}" loading="lazy" alt="" onerror="this.onerror=null; this.parentElement.innerHTML=window.getFallbackImgHTML()">`;
        }
    }

    const matchMatch = (post.content || '').match(/\[MATCH_CARD:([A-Za-z0-9+/=]+)\]/);
    if (matchMatch) {
        try {
            const data = JSON.parse(safeDecodeB64(matchMatch[1]));
            const fallbackSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='10' stroke='%23334155' stroke-width='1.5' fill='none'/%3E%3Ctext x='50%25' y='57%25' text-anchor='middle' font-size='12' fill='%23475569'%3E%E2%9A%BD%3C/text%3E%3C/svg%3E`;
            const cleanScore = (data.score || '').replace(/<[^>]*>/g, '').trim() || 'VS';

            if (mode === 'hero') {
                return `
                <div class="p-hero-bg" style="width:100%;height:100%;position:absolute;inset:0;background:linear-gradient(135deg,rgba(6,182,212,0.15),rgba(15,23,42,0.8),rgba(227,30,36,0.15));display:flex;flex-direction:column;align-items:center;justify-content:center;padding:15px;font-family:'Tajawal',sans-serif;transition: transform 10s ease;">
                    <div style="font-size:16px;font-weight:800;color:#06b6d4;margin-bottom:25px;text-transform:uppercase;letter-spacing:1px;background:rgba(0,0,0,0.6);padding:6px 20px;border-radius:20px;border:1px solid rgba(6,182,212,0.3);">${data.lName}</div>
                    <div style="display:flex;align-items:center;gap:40px;width:100%;justify-content:center;">
                        <img src="${data.hLogo}" alt="" style="width:100px;height:100px;object-fit:contain;filter:drop-shadow(0 0 15px rgba(255,255,255,0.2));" onerror="this.src='${fallbackSvg}'">
                        <div style="font-size:54px;font-weight:900;color:#fff;font-family:'Inter',sans-serif;letter-spacing:2px;white-space:nowrap;background:rgba(0,0,0,0.6);padding:10px 24px;border-radius:16px;border:2px solid rgba(255,255,255,0.1);">${cleanScore}</div>
                        <img src="${data.aLogo}" alt="" style="width:100px;height:100px;object-fit:contain;filter:drop-shadow(0 0 15px rgba(255,255,255,0.2));" onerror="this.src='${fallbackSvg}'">
                    </div>
                </div>`;
            } else if (mode === 'sidebar') {
                return `
                <div style="width:100%;height:140px;background:linear-gradient(135deg,rgba(2,6,23,0.8),rgba(15,23,42,0.9));display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px;font-family:'Tajawal',sans-serif;border-bottom:1px solid rgba(255,255,255,0.05);">
                    <div style="font-size:10px;font-weight:800;color:#06b6d4;margin-bottom:10px;text-transform:uppercase;text-align:center;width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${data.lName}</div>
                    <div style="display:flex;align-items:center;gap:16px;width:100%;justify-content:center;">
                        <img src="${data.hLogo}" alt="" style="width:38px;height:38px;object-fit:contain;filter:drop-shadow(0 0 4px rgba(255,255,255,0.1));" onerror="this.src='${fallbackSvg}'">
                        <div style="font-size:20px;font-weight:900;color:#fff;font-family:'Inter',sans-serif;letter-spacing:1px;white-space:nowrap;background:rgba(0,0,0,0.5);padding:4px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.05);">${cleanScore}</div>
                        <img src="${data.aLogo}" alt="" style="width:38px;height:38px;object-fit:contain;filter:drop-shadow(0 0 4px rgba(255,255,255,0.1));" onerror="this.src='${fallbackSvg}'">
                    </div>
                </div>`;
            } else {
                return `
                <div style="width:100%;min-height:140px;background: url('../kora74matchcards.webp') center/cover no-repeat; display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;font-family:'Tajawal',sans-serif;height:100%;position:relative;">
                    <div style="position:absolute;inset:0;background:rgba(2,6,23,0.7);"></div>
                    <div style="font-size:11px;font-weight:800;color:#06b6d4;margin-bottom:14px;text-transform:uppercase;letter-spacing:1px;text-align:center;width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;position:relative;z-index:2;">${data.lName}</div>
                    <div style="display:flex;align-items:center;gap:12px;width:100%;justify-content:center;position:relative;z-index:2;">
                        <img src="${data.hLogo}" alt="" style="width:40px;height:40px;object-fit:contain;filter:drop-shadow(0 0 8px rgba(255,255,255,0.15));" onerror="this.src='${fallbackSvg}'">
                        <div style="font-size:24px;font-weight:900;color:#fff;font-family:'Inter',sans-serif;letter-spacing:1px;white-space:nowrap;background:rgba(0,0,0,0.6);padding:4px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.05);">${cleanScore}</div>
                        <img src="${data.aLogo}" alt="" style="width:40px;height:40px;object-fit:contain;filter:drop-shadow(0 0 8px rgba(255,255,255,0.15));" onerror="this.src='${fallbackSvg}'">
                    </div>
                </div>`;
            }
        } catch (e) {
            // fallthrough to fallback
        }
    }

    const fall = window.getFallbackImgHTML ? window.getFallbackImgHTML() : '';
    if (mode === 'hero') {
        return `<div class="p-hero-bg" style="width:100%; height:100%; position:absolute; inset:0; transition: transform 10s ease, opacity 0.8s ease;">${fall}</div>`;
    } else if (mode === 'sidebar') {
        return `<div style="width:100%;height:140px;overflow:hidden;">${fall}</div>`;
    } else {
        return fall;
    }
}

/* ── Fake Stats ──────────────────────────────────────────── */
function seededRnd(seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
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
    const grow = Math.min(ageH / 24, 20);
    const rv = seededRnd(id + 'v'), rs = seededRnd(id + 's'), rl = seededRnd(id + 'l');
    return {
        views: Math.floor(8000 + rv * 18000 + grow * 2500) + (post.views || 0),
        shares: Math.floor(300 + rs * 1200 + grow * 60),
        likes: Math.floor(120 + rl * 480 + grow * 25) + (post.likes || 0),
    };
}

/* ── OG Meta Tags ────────────────────────────────────────── */
function updateMetaTags(post) {
    document.title = (post.title || '') + ' | Kora74';
    const set = (prop, val) => {
        let el = document.querySelector(`meta[property="${prop}"]`);
        if (!el) { el = document.createElement('meta'); el.setAttribute('property', prop); document.head.appendChild(el); }
        el.setAttribute('content', val);
    };
    const setName = (name, val) => {
        let el = document.querySelector(`meta[name="${name}"]`);
        if (!el) { el = document.createElement('meta'); el.setAttribute('name', name); document.head.appendChild(el); }
        el.setAttribute('content', val);
    };
    // Ensure Absolute URL for image
    let absoluteImageUrl = '';
    if (post.cover_image_url) {
        let firstImageUrl = post.cover_image_url;
        if (firstImageUrl.includes(',')) firstImageUrl = firstImageUrl.split(',')[0];
        try {
            absoluteImageUrl = new URL(firstImageUrl, location.origin).href;
        } catch (e) {
            absoluteImageUrl = firstImageUrl;
        }
    }

    // ✅ FIX: Always use the canonical kora74.online domain — never rely on location.origin
    // which could be a dev server, old host, or still show spinbetter-news on cached deploys.
    const canonicalBase = 'https://kora74.online/kora74-news/';
    const articleUrl = canonicalBase + '?post=' + post.id;

    // Open Graph tags
    set('og:type',        'article');
    set('og:site_name',   'Kora74');
    set('og:locale',      'ar_EG');
    set('og:url',         articleUrl);
    set('og:title',       post.title || '');
    set('og:description', stripHtml(post.content || ''));
    if (absoluteImageUrl) {
        set('og:image',     absoluteImageUrl);
        set('og:image:alt', post.title || '');
    }

    // Twitter Card tags
    setName('twitter:card',        'summary_large_image');
    setName('twitter:title',       post.title || '');
    setName('twitter:description', stripHtml(post.content || ''));
    if (absoluteImageUrl) setName('twitter:image', absoluteImageUrl);

    // Meta description
    setName('description', stripHtml(post.content || ''));

    // JSON-LD Schema (BlogPosting)
    let ldEl = document.getElementById('ld-article');
    if (!ldEl) {
        ldEl = document.createElement('script');
        ldEl.type = 'application/ld+json';
        ldEl.id = 'ld-article';
        document.head.appendChild(ldEl);
    }
    ldEl.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": post.title || '',
        "description": stripHtml(post.content || ''),
        "datePublished": post.created_at,
        "dateModified": post.updated_at || post.created_at,
        "image": absoluteImageUrl || '',
        "url": articleUrl,
        "author": {
            "@type": "Organization",
            "name": "Kora74 News"
        },
        "publisher": {
            "@type": "Organization",
            "name": "Kora74",
            "url": "https://kora74.online/"
        }
    });
}

function resetMetaTags() {
    document.title = 'الأخبار والتحليلات | Kora74 News';
    const ldEl = document.getElementById('ld-article');
    if (ldEl) ldEl.remove();
    // Restore static og: defaults so the page og: reflects kora74-news, not the last article
    const set = (prop, val) => {
        const el = document.querySelector(`meta[property="${prop}"]`);
        if (el) el.setAttribute('content', val);
    };
    set('og:type',        'website');
    set('og:url',         'https://kora74.online/kora74-news/');
    set('og:title',       'الأخبار والتحليلات | Kora74 News ⚽');
    set('og:description', 'تابع أحدث أخبار وتوقعات وتحليلات المراهنات الرياضية الحصرية على Kora74.');
}

/* ── Hero Bar Setup ─────────────────────────────────────── */
function setupHeroBar() {
    const pills = document.querySelectorAll('.hcb-cat-pill');
    const validCats = ['all','news','analysis','ai','business','phones','reviews','gaming','casino','prediction'];

    // Read URL tab param
    const qTab = new URLSearchParams(location.search).get('tab');
    if (qTab && validCats.includes(qTab)) currentFilter = qTab;

    pills.forEach(pill => {
        // Set active from current filter
        if (pill.dataset.filter === currentFilter) {
            pill.classList.add('active');
            pill.setAttribute('aria-selected', 'true');
        } else {
            pill.classList.remove('active');
            pill.setAttribute('aria-selected', 'false');
        }

        pill.addEventListener('click', () => {
            pills.forEach(p => { p.classList.remove('active'); p.setAttribute('aria-selected','false'); });
            pill.classList.add('active');
            pill.setAttribute('aria-selected', 'true');
            currentFilter = pill.dataset.filter;
            currentPage = 1;

            const url = new URL(window.location);
            if (currentFilter === 'all') url.searchParams.delete('tab');
            else url.searchParams.set('tab', currentFilter);
            window.history.replaceState({}, '', url);

            applyFiltersAndRender();
        });
    });
}

/* ── Promo Banner ────────────────────────────────────────── */
async function loadPromoBanner() {
    const container = document.getElementById('promo-banner-widget');
    if (!container) return;
    try {
        const { data, error } = await supabaseClient
            .from('promo_banner')
            .select('*')
            .eq('active', true)
            .order('created_at', { ascending: false })
            .limit(1);
            
        if (error || !data || !data.length) {
            container.style.display = 'none';
            return;
        }
        
        const b = data[0];
        if (!b.image_url && !b.title) {
            container.style.display = 'none';
            return;
        }
        
        container.style.display = 'block';
        
        let innerContent = '';
        if (b.image_url) {
            innerContent += `<img src="${b.image_url}" style="width: 100%; border-radius: 12px; opacity: 0.9; cursor: pointer; object-fit: cover;" alt="Promo Banner" onerror="this.style.display='none'">`;
        }
        if (b.title) {
            innerContent += `<div style="text-align:center; padding:10px 0; color:#cbd5e1; font-family:'Tajawal',sans-serif; font-weight:700;">${b.title}</div>`;
        }

        if (b.link_url) {
            container.innerHTML = `<a href="${b.link_url}" target="_blank" rel="noopener" style="text-decoration:none; display:block;">${innerContent}</a>`;
        } else {
            container.innerHTML = innerContent;
        }
        
    } catch (e) {
        container.style.display = 'none';
    }
}

/* ── Featured Spotlight ──────────────────────────────────── */
async function loadFeaturedSpotlight() {
    const container = document.getElementById('spotlight-widget-body');
    if (!container) return;
    try {
        const { data, error } = await supabaseClient
            .from('featured_spotlight')
            .select('*')
            .eq('active', true)
            .order('created_at', { ascending: false })
            .limit(1);
        if (error || !data || !data.length) {
            container.innerHTML = `<div class="spotlight-empty">لا يوجد محتوى مميز حالياً</div>`;
            return;
        }
        const s = data[0];
        const imgHtml = s.image_url
            ? `<img src="${s.image_url}" class="ep-img" alt="" onerror="this.outerHTML='<div class=\\'ep-img\\' style=\\'background:#1e293b;display:flex;align-items:center;justify-content:center;font-size:30px;\\'>📰</div>'">`
            : `<div class="ep-img" style="background:#1e293b;display:flex;align-items:center;justify-content:center;font-size:30px;">📰</div>`;
        const ctaHtml = s.link_url
            ? `<div class="ep-cta">${s.link_text || 'اكتشف الآن'} <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg></div>`
            : '';
        container.innerHTML = `
        <a class="editor-pick-card fade-in" href="${s.link_url || '#'}" target="${s.link_url ? '_blank' : '_self'}" rel="noopener" onclick="${!s.link_url ? 'return false;' : ''}">
            <div class="ep-image-wrap">
                <div class="ep-badge">🔥 مميز</div>
                ${imgHtml}
            </div>
            <div class="ep-body">
                <h4 class="ep-title">${s.title}</h4>
                ${s.subtitle ? `<p class="ep-sub">${s.subtitle}</p>` : ''}
                ${ctaHtml}
            </div>
        </a>`;
    } catch (e) {
        container.innerHTML = `<div class="spotlight-empty">خطأ في تحميل المحتوى</div>`;
    }
}

/* ── Community Reviews ───────────────────────────────────── */
async function loadCommunityReviews() {
    const container = document.getElementById('reviews-widget-body');
    if (!container) return;
    try {
        const { data, error } = await supabaseClient
            .from('community_reviews')
            .select('*')
            .eq('active', true)
            .order('created_at', { ascending: false })
            .limit(50);
        if (error || !data || !data.length) {
            container.innerHTML = `<div class="spotlight-empty">لا توجد تقييمات حالياً</div>`;
            return;
        }
        container.innerHTML = data.map(r => {
            const stars = Array.from({length: 5}, (_, i) =>
                `<span class="review-star-${i < r.rating ? 'filled' : 'empty'}">★</span>`
            ).join('');
            const defaultAvatarSvg = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
            const avatarHtml = r.reviewer_avatar
                ? `<img src="${r.reviewer_avatar}" class="mr-avatar" alt="" onerror="this.outerHTML='<div class=\\'mr-avatar\\' style=\\'background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;color:#64748b;font-size:20px;box-sizing:border-box;\\'>👤</div>'">`
                : `<div class="mr-avatar" style="background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;color:#64748b;padding:8px;box-sizing:border-box;">${defaultAvatarSvg}</div>`;
            const verifiedBadge = r.verified
                ? `<div class="review-verified" style="color:#0ea5e9; font-size:11px; margin-bottom:4px; display:flex; align-items:center; gap:3px;"><svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1.25 14.5L6.5 12.25l1.41-1.41 2.84 2.84 6.84-6.84 1.41 1.41-8.25 8.25z"/></svg> مراجع موثق</div>`
                : `<div class="review-verified" style="color:#94a3b8; font-size:11px; margin-bottom:4px; display:flex; align-items:center; gap:3px;"><svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg> مجهول</div>`;
            return `
            <div class="modern-review-card fade-in">
                <div class="mr-header">
                    ${avatarHtml}
                    <div class="mr-meta">
                        ${verifiedBadge}
                        <div class="mr-name" style="margin-bottom:2px;">${r.reviewer_name}</div>
                        <div class="mr-stars">${stars}</div>
                    </div>
                    <div class="mr-quote-icon">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="rgba(6, 182, 212, 0.2)"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/></svg>
                    </div>
                </div>
                <p class="mr-text">${r.review_text}</p>
            </div>`;
        }).join('');
    } catch (e) {
        container.innerHTML = `<div class="spotlight-empty">خطأ في تحميل التقييمات</div>`;
    }
}

/* ── Data ────────────────────────────────────────────────── */
/* ── Data Fetching with Retry ────────────────────────────── */
let _fetchRetryCount = 0;
const _MAX_RETRIES = 3;

async function fetchInitialData() {
    showSkeletons();
    _fetchRetryCount = 0;
    await _doFetch();
}

async function _doFetch() {
    try {
        // ✅ FIX: Added .limit(60) to prevent statement timeout (error 57014).
        // Fetching ALL posts with full content at once was causing Supabase to cancel the query.
        const { data: postsData, error } = await supabaseClient
            .from('posts')
            .select('*')
            .eq('published', true)
            .order('created_at', { ascending: false })
            .limit(60);

        if (error) throw error;
        allPosts = postsData || [];

        const { data: likesData } = await supabaseClient
            .from('post_likes').select('post_id').eq('user_fingerprint', userFingerprint);
        if (likesData) userLikedPosts = likesData.map(l => l.post_id);

        const qPost = new URLSearchParams(location.search).get('post');
        const hPost = location.hash.startsWith('#post-') ? location.hash.replace('#post-', '') : null;
        const targetId = qPost || hPost;

        setupHeroBar();
        updateNewsTicker();
        initHeroCarousel();
        loadSidebarMatches();
        updateImportantTopicsSidebar();
        initSearchPlaceholderAnim();
        applyFiltersAndRender();

        // ✅ FIX: Stagger sidebar DB queries to avoid 5 simultaneous Supabase calls on load.
        setTimeout(() => updateTrendingSidebar(),     300);
        setTimeout(() => loadFeaturedSpotlight(),     600);
        setTimeout(() => loadCommunityReviews(),      900);
        setTimeout(() => loadRecommendedSidebar(),   1200);
        setTimeout(() => loadPromoBanner(),          1500);

        if (targetId) {
            const p = allPosts.find(x => x.id === targetId);
            if (p) setTimeout(() => openArticle(p), 150);
        }

        _fetchRetryCount = 0; // reset on success

    } catch (err) {
        console.error('fetchInitialData error:', err);
        _fetchRetryCount++;

        if (_fetchRetryCount < _MAX_RETRIES) {
            // ✅ Auto-retry: wait 2 seconds then try again silently
            const waitSec = _fetchRetryCount * 2;
            const grid = document.getElementById('news-grid');
            if (grid) grid.innerHTML = `
                <div style="grid-column:1/-1;text-align:center;padding:60px 20px;font-family:'Tajawal',sans-serif;">
                    <div style="font-size:32px;margin-bottom:12px;">&#x1F504;</div>
                    <p style="color:#94a3b8;font-size:15px;">جاري إعادة المحاولة ${_fetchRetryCount}/${_MAX_RETRIES} خلال ${waitSec} ثواني...</p>
                    <div style="width:40px;height:4px;background:rgba(6,182,212,0.3);border-radius:4px;margin:16px auto 0;overflow:hidden;">
                        <div style="width:100%;height:100%;background:#06b6d4;border-radius:4px;animation:shimmer 1s linear infinite;"></div>
                    </div>
                </div>`;
            setTimeout(() => _doFetch(), waitSec * 1000);
        } else {
            // All retries exhausted → show friendly error with manual retry button
            const grid = document.getElementById('news-grid');
            if (grid) grid.innerHTML = `
                <div style="grid-column:1/-1;text-align:center;padding:60px 20px;font-family:'Tajawal',sans-serif;">
                    <div style="font-size:48px;margin-bottom:16px;">&#x26A0;&#xFE0F;</div>
                    <h3 style="color:#f1f5f9;font-size:20px;margin:0 0 10px;">تعذر تحميل المقالات</h3>
                    <p style="color:#64748b;font-size:14px;margin:0 0 24px;max-width:400px;line-height:1.7;display:inline-block;">حدثت مشكلة في الاتصال بقاعدة البيانات. قد يكون الخادم مصغولاً مؤقتاً.</p>
                    <br>
                    <button onclick="fetchInitialData()" style="background:#06b6d4;color:#000;border:none;padding:12px 28px;border-radius:10px;font-family:'Tajawal',sans-serif;font-size:15px;font-weight:800;cursor:pointer;">
                        ↺ حاول مرة أخرى
                    </button>
                </div>`;
        }
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
            document.querySelectorAll('.news-tab').forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');
            currentFilter = tab.dataset.filter;
            currentPage = 1;

            const url = new URL(window.location);
            if (currentFilter === 'all') url.searchParams.delete('tab');
            else url.searchParams.set('tab', currentFilter);
            window.history.replaceState({}, '', url);

            applyFiltersAndRender();
        });
    });
}

/* ── Filter + Search + Render ────────────────────────────── */
function applyFiltersAndRender() {
    filteredPosts = allPosts.filter(p => {
        const matchCat = currentFilter === 'all' || p.category === currentFilter;
        const searchQuery = currentSearch.toLowerCase();
        const matchSearch = !searchQuery || [p.title, p.content].some(f =>
            (f || '').toLowerCase().includes(searchQuery)
        );
        return matchCat && matchSearch;
    });

    renderGrid();
    renderPagination();
}

/* ── News Ticker ─────────────────────────────────────────── */
function updateNewsTicker() {
    const wrap = document.getElementById('news-ticker-wrap');
    const track = document.getElementById('ticker-track');
    if (!wrap || !track) return;

    const staticItems = [
        { title: '🔥 بونص ترحيبي 200% — استخدم كود W300 الآن!', url: '../spinbetter-promo-code/' },
        { title: '⚽ أفضل احتمالات الدوري الإنجليزي على SpinBetter اليوم', url: '../spinbetter-sports-betting/' },
        { title: '🏆 دوري أبطال أوروبا — راهن على أقوى المباريات', url: '../spinbetter-sports-betting/' },
        { title: '🎰 أكثر من 7,000 لعبة كازينو ومراهنات مباشرة', url: '../spinbetter-casino/' },
        { title: '💸 الإيداع والسحب بفودافون كاش وانستاباي بدون عمولات', url: '../spinbetter-deposit/' },
        { title: '🏆 بطولات يومية وجوائز نقدية فورية لكل اللاعبين', url: '../spinbetter-registration/' },
        { title: '📱 حمّل تطبيق SpinBetter على iOS وأجهزة الأندرويد', url: '../spinbetter-ios/' },
        { title: '🎯 توقعات MisterMedia لأهم مباريات الجولة القادمة', url: './' },
        { title: '🛡️ لعب آمن ومرخص — Curacao eGaming License', url: '../spinbetter-about/' },
        { title: '📊 SpinBetter — أعلى نسبة ربح في المراهنات الرياضية', url: '../spinbetter-sports-betting/' },
        { title: '🥇 الدوري المصري — الأهلي والزمالك — تابع التغطية الحصرية', url: './' },
        { title: '⚽ كرة القدم الأوروبية مباشرة — أهداف وحوادث لحظة بلحظة', url: './' },
        { title: '🎁 مكافآت Cashback أسبوعية حتى 15% على كل خسائرك', url: '../spinbetter-promo-code/' },
        { title: '📣 اشترك في النشرة البريدية — احصل على تحليلات حصرية', url: '../spinbetter-registration/' },
        { title: '🔔 تنبيهات فورية لأهم نتائج وأخبار الملاعب', url: './' },
        { title: '💰 أسرع عمليات سحب في المنطقة — خلال 5 دقائق فقط!', url: '../spinbetter-deposit/' },
        { title: '🏟️ دوري السيريا آ — مباريات اليوم وأفضل الاحتمالات', url: '../spinbetter-sports-betting/' },
        { title: '🇩🇪 البوندسليغا الألماني — بايرن ميونيخ في الصدارة', url: '../spinbetter-sports-betting/' },
        { title: '🇪🇸 لالیگا — ريال مدريد وبرشلونة — كلاسيكو بلا حدود', url: '../spinbetter-sports-betting/' },
        { title: '🎲 لعبة الحظ اليومية — ادخل واربح مع SpinBetter', url: '../spinbetter-casino/' },
        { title: '🗓️ جدول المباريات الكامل لهذا الأسبوع على Kora74', url: './' },
    ];

    const dynamicItems = allPosts.slice(0, 12).map(p => ({
        isPost: true,
        id: p.id,
        title: `📰 ${p.title || stripHtml(p.content).substring(0, 70) + '...'}`,
        url: `${location.pathname}?post=${p.id}`,
    }));

    const interleaved = [];
    const maxLen = Math.max(dynamicItems.length, staticItems.length);
    for (let i = 0; i < maxLen; i++) {
        if (i < dynamicItems.length) interleaved.push(dynamicItems[i]);
        if (i < staticItems.length) interleaved.push(staticItems[i]);
    }

    const fullInterleaved = [];
    for (let k = 0; k < 10; k++) {
        fullInterleaved.push(...interleaved);
    }

    const sep = '<span class="ticker-sep"></span>';

    const makeHTML = (items) => items.map(item => {
        if (item.isPost) {
            return `<a href="${item.url}" class="ticker-item" onclick="event.preventDefault(); openArticle(allPosts.find(x => x.id === '${item.id}'));">${item.title}</a>${sep}`;
        }
        return `<a href="${item.url}" class="ticker-item">${item.title}</a>${sep}`;
    }).join('');

    const html = makeHTML(fullInterleaved);
    track.innerHTML = html + html;

    wrap.style.display = 'flex';
}

function toEngDigits(str) {
    if (!str) return str;
    return str.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

function loadSidebarMatches() {
    const matchesContainer = document.getElementById('sidebar-matches-container');
    if (!matchesContainer) return;

    const analysisPosts = allPosts.filter(p => p.category === 'analysis').slice(0, 5);

    if (!analysisPosts.length) {
        // Football/play icon for empty match state — relevant because this section is about matches
        matchesContainer.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:14px;padding:32px 20px;text-align:center;position:relative;overflow:hidden;border-radius:16px;">
            <div class="match-card-bg-blur" style="opacity:0.5;"></div>
            <div style="position:relative;z-index:1;color:rgba(6,182,212,0.35);">
                ${icon('football', 48, 'rgba(6,182,212,0.35)')}
            </div>
            <p style="color:#94a3b8;font-size:13px;font-family:'Tajawal',sans-serif;margin:0;line-height:1.7;position:relative;z-index:1;">
                لا توجد مباريات متوفرة حالياً<br>
                <span style="color:#475569;font-size:11px;">تابعنا قريبًا للمزيد!</span>
            </p>
        </div>`;
        return;
    }

    const fallbackSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='19' fill='%230d1a2e' stroke='%231e3a5f' stroke-width='2'/%3E%3Ctext x='50%25' y='57%25' text-anchor='middle' font-size='18' fill='%23475569'%3E%E2%9A%BD%3C/text%3E%3C/svg%3E`;

    matchesContainer.innerHTML = analysisPosts.map((m, i) => {
        let leagueName = '';
        let homeTeam = { name: '', logo: fallbackSvg };
        let awayTeam = { name: '', logo: fallbackSvg };
        let scoreStr = 'VS';
        let hasMatchData = false;

        const matchMatch = (m.content || '').match(/\[MATCH_CARD:([A-Za-z0-9+/=]+)\]/);
        if (matchMatch) {
            try {
                const data = JSON.parse(safeDecodeB64(matchMatch[1]));
                leagueName = data.lName || '';
                homeTeam = { name: data.hName || '', logo: data.hLogo || fallbackSvg };
                awayTeam = { name: data.aName || '', logo: data.aLogo || fallbackSvg };
                scoreStr = toEngDigits((data.score || '').replace(/<[^>]*>/g, '').trim()) || 'VS';
                hasMatchData = true;
            } catch (e) { }
        }

        const dateStr = m.created_at
            ? new Date(m.created_at).toLocaleDateString('ar-EG', { day: '2-digit', month: 'short' })
            : '';
        const shortTitle = (m.title || '').length > 45
            ? (m.title || '').substring(0, 45) + '...'
            : (m.title || '');

        // Chevron-left (RTL "go to details"): correct for Arabic RTL navigation
        const detailsArrow = icon('chevronLeft', 12, 'currentColor');

        if (hasMatchData) {
            return `
            <a href="${location.pathname}?post=${m.id}"
               onclick="event.preventDefault(); openArticle(allPosts.find(x => x.id === '${m.id}'));"
               class="match-sidebar-card fade-in" style="animation-delay:${i * 0.08}s;">
                <div class="match-card-bg-blur"></div>
                <div class="match-card-inner">
                    <div class="match-card-league">
                        <span class="match-card-league-dot"></span>
                        ${leagueName || 'MATCH OF THE DAY'}
                    </div>
                    <div class="match-card-body">
                        <div class="match-team">
                            <img src="${homeTeam.logo}" alt="${homeTeam.name}" onerror="this.src='${fallbackSvg}'">
                            <span class="match-team-name">${homeTeam.name || 'الفريق الأول'}</span>
                        </div>
                        <div class="match-score-box">
                            <div class="match-score">${scoreStr}</div>
                            <span class="match-time-badge">${dateStr}</span>
                        </div>
                        <div class="match-team">
                            <img src="${awayTeam.logo}" alt="${awayTeam.name}" onerror="this.src='${fallbackSvg}'">
                            <span class="match-team-name">${awayTeam.name || 'الفريق الثاني'}</span>
                        </div>
                    </div>
                    <div class="match-card-footer">
                        <span class="match-card-title-text">${shortTitle}</span>
                        <span class="match-card-cta">
                            ${detailsArrow}
                            تفاصيل
                        </span>
                    </div>
                </div>
            </a>`;
        } else {
            const imgHTML = m.cover_image_url
                ? `<img src="${m.cover_image_url}" style="width:100%;height:130px;object-fit:cover;display:block;position:relative;z-index:2;" onerror="this.style.display='none'">`
                : '';
            return `
            <a href="${location.pathname}?post=${m.id}"
               onclick="event.preventDefault(); openArticle(allPosts.find(x => x.id === '${m.id}'));"
               class="match-sidebar-card fade-in" style="animation-delay:${i * 0.08}s;">
                <div class="match-card-bg-blur"></div>
                ${imgHTML}
                <div class="match-card-inner">
                    <div class="match-card-league" style="justify-content:flex-start;padding-top:14px;">
                        <span class="match-card-league-dot"></span>
                        قسيمة اليوم
                    </div>
                    <div style="padding:10px 18px 6px;">
                        <p style="font-family:'Tajawal',sans-serif;font-size:14px;font-weight:800;color:#e2e8f0;margin:0 0 8px;line-height:1.5;">${shortTitle}</p>
                    </div>
                    <div class="match-card-footer">
                        <span class="match-card-title-text">${dateStr}</span>
                        <span class="match-card-cta">
                            ${detailsArrow}
                            تفاصيل
                        </span>
                    </div>
                </div>
            </a>`;
        }
    }).join('');
}

let searchPlaceholderTimer;
function initSearchPlaceholderAnim() {
    const searchInput = document.getElementById('news-search-input');
    if (!searchInput || allPosts.length === 0) return;
    const latestTitles = allPosts.slice(0, 5).map(p => stripHtml(p.content).substring(0, 30) + '...');
    let currentIdx = 0;
    if (searchPlaceholderTimer) clearInterval(searchPlaceholderTimer);
    searchPlaceholderTimer = setInterval(() => {
        searchInput.setAttribute('placeholder', `ابحث عن: ${latestTitles[currentIdx]}`);
        currentIdx = (currentIdx + 1) % latestTitles.length;
    }, 3000);
    searchInput.setAttribute('placeholder', `ابحث عن: ${latestTitles[0]}`);
}

async function updateTrendingSidebar() {
    const list = document.getElementById('trending-widget-body');
    if (!list) return;

    // Try to load manually pinned trending items from Supabase
    try {
        const { data: pinnedItems, error } = await supabaseClient
            .from('trending_posts')
            .select('*')
            .eq('active', true)
            .order('sort_order', { ascending: true })
            .limit(10);

        if (!error && pinnedItems && pinnedItems.length > 0) {
            list.innerHTML = pinnedItems.map((t, i) => {
                const d = new Date(t.created_at);
                const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
                const imgHTML = t.image_url
                    ? `<img src="${t.image_url}" loading="lazy" onerror="this.style.display='none'" style="width:65px;height:65px;object-fit:cover;border-radius:10px;flex-shrink:0;">`
                    : `<div style="width:65px;height:65px;border-radius:10px;background:linear-gradient(135deg,rgba(6,182,212,0.12),rgba(139,92,246,0.08));display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:22px;">📰</div>`;
                return `
                <a href="${t.link_url}" class="trending-ranked-item fade-in" style="animation-delay:${i * 0.05}s;">
                    <div class="tr-rank">${i + 1}</div>
                    <div class="tr-content">
                        <h4 class="tr-title">${t.title}</h4>
                        <div class="tr-meta">${t.subtitle || `مقال مميز`}</div>
                    </div>
                    <div class="tr-img-wrap">${imgHTML.replace('width:65px;height:65px;', 'width:100%;height:100%;')}</div>
                </a>`;
            }).join('');
            return;
        }
    } catch (err) {
        console.warn('trending_posts table not available, using auto-generated list');
    }

    // Fallback: auto-generate from news posts
    const trPosts = allPosts.filter(p => p.category === 'news').slice(1, 11);
    list.innerHTML = trPosts.map((p, i) => {
        const d = new Date(p.created_at);
        const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
        const fallbackHTML = window.getFallbackImgHTML ? window.getFallbackImgHTML() : '';
        const fallbackB64 = btoa(encodeURIComponent(fallbackHTML));
        const firstImg = p.cover_image_url ? (p.cover_image_url.includes(',') ? p.cover_image_url.split(',')[0] : p.cover_image_url) : null;
        const img = firstImg ?
            `<img src="${firstImg}" loading="lazy" onerror="this.outerHTML=decodeURIComponent(atob('${fallbackB64}'))" style="width:65px;height:65px;object-fit:cover;border-radius:10px;flex-shrink:0;">` :
            `<div style="width:65px;height:65px;border-radius:10px;overflow:hidden;flex-shrink:0;">${fallbackHTML}</div>`;
        return `
        <a href="${location.pathname}?post=${p.id}" class="trending-ranked-item fade-in" style="animation-delay:${i * 0.05}s" onclick="event.preventDefault(); openArticle(allPosts.find(x => x.id === '${p.id}'));">
            <div class="tr-rank">${i + 1}</div>
            <div class="tr-content">
                <h4 class="tr-title">${p.title || stripHtml(p.content).substring(0, 40)}</h4>
                <div class="tr-meta">نُشر في ${dateStr}</div>
            </div>
            <div class="tr-img-wrap">${img.replace('width:65px;height:65px;', 'width:100%;height:100%;')}</div>
        </a>`;
    }).join('');
}


function updateImportantTopicsSidebar() {
    const list = document.getElementById('topics-widget-body');
    if (!list) return;

    // Trophy icon for the premium partner widget
    list.parentElement.querySelector('.widget-title').innerHTML = `
        ${icon('trophy', 20, '#f59e0b')}
        <span style="margin-right:8px;">شريكنا المميز</span>
    `;

    list.innerHTML = `
        <div style="
            position:relative;
            border-radius:14px;
            overflow:hidden;
            background: linear-gradient(145deg, #0d1a2e 0%, #0f2744 50%, #0a1628 100%);
            border:1px solid rgba(6,182,212,0.2);
            box-shadow: 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
        ">
            <!-- Glow effect top -->
            <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#06b6d4,#3b82f6,transparent);"></div>

            <!-- Header with logo -->
            <div style="padding:20px 20px 16px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.05);">
                <a href="/" style="display:inline-block;margin-bottom:12px;">
                    <img src="../logo-spinbetter-official.png"
                         alt="Kora74"
                         style="height:44px;width:auto;object-fit:contain;filter:drop-shadow(0 2px 12px rgba(6,182,212,0.4));"
                         onerror="this.style.display='none'">
                </a>
                <div style="
                    display:inline-flex;align-items:center;gap:6px;
                    background:rgba(6,182,212,0.1);border:1px solid rgba(6,182,212,0.25);
                    border-radius:20px;padding:4px 12px;margin:0 auto;
                ">
                    <span style="width:6px;height:6px;border-radius:50%;background:#06b6d4;box-shadow:0 0 8px #06b6d4;animation:pulse-dot 2s infinite;flex-shrink:0;"></span>
                    <span style="font-size:11px;font-weight:700;letter-spacing:1px;color:#06b6d4;font-family:'Tajawal',sans-serif;">منصة رائدة #1</span>
                </div>
            </div>

            <!-- Stars + Rating -->
            <div style="padding:14px 20px 0;text-align:center;">
                <div style="color:#f59e0b;font-size:16px;letter-spacing:2px;margin-bottom:6px;">★★★★★</div>
                <p style="font-family:'Tajawal',sans-serif;font-size:13px;color:#94a3b8;line-height:1.65;margin:0;">
                    أفضل منصة مراهنات في الشرق الأوسط مع دعم عربي على مدار الساعة وأسرع سحب للأرباح.
                </p>
            </div>

            <!-- Promo code badge -->
            <div style="margin:14px 20px 0;padding:10px 14px;background:rgba(227,30,36,0.08);border:1px dashed rgba(227,30,36,0.35);border-radius:10px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
                <div>
                    <div style="font-size:9px;font-weight:700;letter-spacing:1.5px;color:#94a3b8;font-family:'Tajawal',sans-serif;margin-bottom:2px;">كود بروموكود حصري</div>
                    <div style="font-size:20px;font-weight:900;color:#fff;font-family:'Oswald',sans-serif;letter-spacing:3px;">W300</div>
                </div>
                <div style="text-align:left;">
                    <div style="font-size:9px;color:#94a3b8;font-family:'Tajawal',sans-serif;margin-bottom:2px;">بونص ترحيبي</div>
                    <div style="font-size:18px;font-weight:900;color:#4ade80;font-family:'Oswald',sans-serif;">200%</div>
                </div>
            </div>

            <!-- CTA Button -->
            <div style="padding:16px 20px 20px;">
                <a href="https://redirspinner.com/2N0q?p=%2Fregistration%2F"
                   target="_blank" rel="noopener"
                   style="
                       display:block;text-align:center;
                       background:linear-gradient(135deg,#06b6d4,#0ea5e9);
                       color:#000;font-family:'Tajawal',sans-serif;
                       font-weight:900;font-size:14px;
                       padding:12px 16px;border-radius:10px;
                       text-decoration:none;letter-spacing:0.5px;
                       box-shadow:0 4px 20px rgba(6,182,212,0.3);
                       transition:all 0.25s;
                   "
                   onmouseover="this.style.boxShadow='0 6px 30px rgba(6,182,212,0.55)';this.style.transform='translateY(-1px)'"
                   onmouseout="this.style.boxShadow='0 4px 20px rgba(6,182,212,0.3)';this.style.transform='translateY(0)'"
                >
                    سجّل الآن واستلم البونص
                </a>
            </div>

            <!-- Glow effect bottom -->
            <div style="position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(6,182,212,0.3),transparent);"></div>
        </div>
    `;
}

async function loadRecommendedSidebar() {
    const list = document.getElementById('recommended-widget-body');
    if (!list) return;

    try {
        const { data: recItems, error } = await supabaseClient
            .from('recommended_articles')
            .select('*')
            .eq('active', true)
            .order('sort_order', { ascending: true })
            .limit(10);

        if (!error && recItems && recItems.length > 0) {
            list.innerHTML = recItems.map((t, i) => {
                const cleanImg = t.image_url
                    ? `<img src="${t.image_url}" loading="lazy" onerror="this.style.display='none'" class="rec-img">`
                    : `<div class="rec-img-fallback">📰</div>`;
                return `
                <a href="${t.link_url}" class="rec-item fade-in" style="animation-delay:${i * 0.05}s;">
                    <div class="rec-img-wrap">${cleanImg}</div>
                    <div class="rec-content">
                        ${t.subtitle ? `<div class="rec-meta">${t.subtitle}</div>` : ''}
                        <h4 class="rec-title">${t.title}</h4>
                    </div>
                    <div class="rec-cta-arrow">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
                    </div>
                </a>`;
            }).join('');
            return;
        } else {
             list.innerHTML = `<div style="text-align:center;color:#64748b;padding:20px;font-size:13px;">لا توجد مقالات مضافة حالياً.</div>`;
        }
    } catch (err) {
        console.warn('recommended_articles error:', err);
    }
}

/* ── Grid ────────────────────────────────────────────────── */
function getEmptyStateMessage(filter, hasSearch) {
    if (hasSearch) return {
        icon: '🔍',
        title: 'لا توجد نتائج',
        sub: `لم نجد أي مقالات تطابق "${currentSearch}". جرب كلمة بحث مختلفة.`
    };
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
    if (grid) grid.innerHTML = '';

    if (!filteredPosts.length) {
        const msg = getEmptyStateMessage(currentFilter, !!currentSearch);
        grid.innerHTML = `
            <div style="
                grid-column:1/-1;display:flex;flex-direction:column;
                align-items:center;justify-content:center;
                padding:80px 20px;text-align:center;gap:16px;
            ">
                <div style="
                    width:80px;height:80px;border-radius:50%;
                    background:rgba(255,255,255,0.04);
                    border:1px solid rgba(255,255,255,0.08);
                    display:flex;align-items:center;justify-content:center;
                    font-size:32px;margin-bottom:8px;
                ">${msg.icon}</div>
                <h3 style="font-size:20px;font-weight:700;color:#e2e8f0;margin:0;font-family:'Tajawal',sans-serif;">${msg.title}</h3>
                <p style="font-size:14px;color:#475569;margin:0;font-family:'Tajawal',sans-serif;max-width:320px;line-height:1.6;">${msg.sub}</p>
                ${currentSearch ? `<button onclick="clearNewsSearch()" style="margin-top:8px;background:rgba(6,182,212,0.1);border:1px solid rgba(6,182,212,0.3);color:#06b6d4;padding:8px 20px;border-radius:8px;cursor:pointer;font-family:'Tajawal',sans-serif;font-size:14px;">مسح البحث</button>` : ''}
            </div>`;
        return;
    }

    const start = (currentPage - 1) * PAGE_SIZE;
    const pagePosts = filteredPosts.slice(start, start + PAGE_SIZE);

    pagePosts.forEach((post, i) => {
        const card = createCardElement(post);
        card.style.animationDelay = (i * 0.05) + 's';
        grid.appendChild(card);
    });
}

/* ── Pagination ──────────────────────────────────────────── */
function renderPagination() {
    const old = document.getElementById('news-pagination');
    if (old) old.remove();

    const totalPages = Math.ceil(filteredPosts.length / PAGE_SIZE);
    if (totalPages <= 1) return;

    const wrap = document.createElement('div');
    wrap.id = 'news-pagination';
    wrap.style.cssText = `
        display:flex;justify-content:center;align-items:center;
        gap:8px;margin:0 0 60px;flex-wrap:wrap;
    `;

    // Arrow icons: chevron-left/right for RTL Arabic pagination — semantically correct
    const prev = makePagBtn(icon('arrowRight', 18, 'currentColor'), currentPage > 1, () => {
        currentPage--;
        applyFiltersAndRender();
        scrollToGrid();
    });
    wrap.appendChild(prev);

    for (let i = 1; i <= totalPages; i++) {
        const isActive = i === currentPage;
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.style.cssText = `
            width:38px;height:38px;border-radius:8px;border:1px solid;
            font-family:'Tajawal',sans-serif;font-size:14px;font-weight:700;
            cursor:pointer;transition:all 0.2s;
            background:${isActive ? '#06b6d4' : 'transparent'};
            color:${isActive ? '#000' : '#64748b'};
            border-color:${isActive ? '#06b6d4' : 'rgba(255,255,255,0.1)'};
        `;
        if (!isActive) {
            btn.addEventListener('mouseover', () => { btn.style.borderColor = 'rgba(6,182,212,0.4)'; btn.style.color = '#e2e8f0'; });
            btn.addEventListener('mouseout', () => { btn.style.borderColor = 'rgba(255,255,255,0.1)'; btn.style.color = '#64748b'; });
        }
        btn.addEventListener('click', () => { currentPage = i; applyFiltersAndRender(); scrollToGrid(); });
        wrap.appendChild(btn);
    }

    const next = makePagBtn(icon('arrowLeft', 18, 'currentColor'), currentPage < totalPages, () => {
        currentPage++;
        applyFiltersAndRender();
        scrollToGrid();
    });
    wrap.appendChild(next);

    const counter = document.createElement('div');
    const start = (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(currentPage * PAGE_SIZE, filteredPosts.length);
    counter.style.cssText = 'width:100%;text-align:center;color:#475569;font-size:12px;font-family:Tajawal,sans-serif;margin-top:4px;';
    counter.textContent = `عرض ${start}–${end} من ${filteredPosts.length} مقال`;
    wrap.appendChild(counter);

    document.getElementById('news-grid').insertAdjacentElement('afterend', wrap);
}

function makePagBtn(svgContent, enabled, onClick) {
    const btn = document.createElement('button');
    btn.innerHTML = svgContent;
    btn.disabled = !enabled;
    btn.style.cssText = `
        width:38px;height:38px;border-radius:8px;
        border:1px solid rgba(255,255,255,0.1);
        background:transparent;
        color:${enabled ? '#94a3b8' : '#1e293b'};
        font-size:16px;cursor:${enabled ? 'pointer' : 'default'};
        transition:all 0.2s;
        display:flex;align-items:center;justify-content:center;
        padding:0;
    `;
    if (enabled) btn.addEventListener('click', onClick);
    return btn;
}

function scrollToGrid() {
    const tabsEl = document.getElementById('news-tabs');
    if (tabsEl) tabsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Hero Carousel ───────────────────────────────────────── */
let heroCarouselTimer;
let currentHeroIdx = 0;

function initHeroCarousel() {
    const container = document.getElementById('hero-article-container');
    if (!container) return;
    if (allPosts.length === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }
    container.style.display = 'block';

    const heroPosts = allPosts.filter(p => p.category === 'news').slice(0, 4);
    if (heroCarouselTimer) clearInterval(heroCarouselTimer);
    currentHeroIdx = 0;

    renderHeroSlide(heroPosts, container);

    if (heroPosts.length > 1) {
        heroCarouselTimer = setInterval(() => {
            currentHeroIdx = (currentHeroIdx + 1) % heroPosts.length;
            renderHeroSlide(heroPosts, container);
        }, 8000);
    }
}

function renderHeroSlide(heroPosts, container) {
    const post = heroPosts[currentHeroIdx];
    let imgHTML = getMatchOrFallback(post, 'hero');

    container.innerHTML = `
    <a href="${location.pathname}?post=${post.id}" class="p-hero-overlay-card fade-in" onclick="event.preventDefault(); openArticle(allPosts.find(x => x.id === '${post.id}'));">
        ${imgHTML}
        <div class="p-hero-gradient"></div>
        <div class="p-hero-content-over">
            <div class="p-hero-badge">
                ${icon('newspaper', 16, 'currentColor')}
                <span style="margin-right:4px;">أحدث الأخبار</span>
            </div>
            <h2 class="p-hero-title-over">${post.title || ''}</h2>
            <p class="p-hero-excerpt-over">${stripHtml(post.content).substring(0, 180)}...</p>
            <div style="display:flex; gap:6px; margin-top:20px;">
                ${heroPosts.map((_, i) => `<div style="width:24px; height:4px; border-radius:2px; background:${i === currentHeroIdx ? '#06b6d4' : 'rgba(255,255,255,0.2)'}; transition:background 0.3s;"></div>`).join('')}
            </div>
        </div>
    </a>`;
}

/* ── Card ────────────────────────────────────────────────── */
function createCardElement(post) {
    const isLiked = userLikedPosts.includes(post.id);
    const cat = getCatInfo(post.category);
    const excerpt = stripHtml(post.content);
    const stats = getFakeStats(post);
    const exactDate = new Date(post.created_at);
    const exactDateStr = `${exactDate.getDate()}/${exactDate.getMonth() + 1}/${exactDate.getFullYear()}`;

    let imgHTML = '';
    const hasMultipleImages = post.cover_image_url && post.cover_image_url.includes(',');
    const captionsArray = [];
    
    if (hasMultipleImages) {
        const images = post.cover_image_url.split(',');
        let slidesHtml = '';
        let dotsHtml = '';
        const fallbackB64 = btoa(encodeURIComponent(window.getFallbackImgHTML ? window.getFallbackImgHTML() : ''));
        
        images.forEach((item, i) => {
            const parts = item.split('|');
            const imgUrl = parts[0].trim();
            const imgCap = parts[1] || '';
            captionsArray.push(imgCap); // We will use this in the observer
            
            slidesHtml += `
                <div class="card-slide" style="flex:0 0 100%; height:100%; scroll-snap-align:start; position:relative; display:flex; align-items:center; justify-content:center;">
                    <img src="${imgUrl}" loading="lazy" style="width:100%; height:100%; max-height:240px; object-fit:contain; border-radius:0.5rem; display:block;" onerror="this.outerHTML=decodeURIComponent(atob('${fallbackB64}'))">
                </div>
            `;
            
            dotsHtml += `<div class="card-dot" data-index="${i}" style="width:6px; height:6px; border-radius:50%; background:${i === 0 ? '#e31e24' : 'rgba(255,255,255,0.4)'}; transition:background 0.3s; box-shadow:0 0 4px rgba(0,0,0,0.5);"></div>`;
        });
        
        const sliderId = 'card-slider-' + post.id;
        
        // Hide scrollbar using inline CSS trick or classes
        imgHTML = `
            <div style="position:relative; width:100%; height:100%;">
                <style>#${sliderId}::-webkit-scrollbar { display: none; }</style>
                <div id="${sliderId}" style="width:100%; height:100%; display:flex; flex-direction:row; overflow-x:auto; scroll-snap-type:x mandatory; scroll-behavior:smooth; -ms-overflow-style:none; scrollbar-width:none; z-index:1;">
                    ${slidesHtml}
                </div>
                <button type="button" onclick="event.preventDefault(); event.stopPropagation(); const s=document.getElementById('${sliderId}'); s.scrollBy({left: s.clientWidth, behavior: 'smooth'});" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); width:26px; height:26px; border-radius:50%; background:rgba(0,0,0,0.65); border:1px solid rgba(255,255,255,0.4); color:#fff; font-size:12px; cursor:pointer; z-index:10; display:flex; align-items:center; justify-content:center; padding-bottom:2px; box-shadow:0 2px 5px rgba(0,0,0,0.5);">❯</button>
                <button type="button" onclick="event.preventDefault(); event.stopPropagation(); const s=document.getElementById('${sliderId}'); s.scrollBy({left: -s.clientWidth, behavior: 'smooth'});" style="position:absolute; left:8px; top:50%; transform:translateY(-50%); width:26px; height:26px; border-radius:50%; background:rgba(0,0,0,0.65); border:1px solid rgba(255,255,255,0.4); color:#fff; font-size:12px; cursor:pointer; z-index:10; display:flex; align-items:center; justify-content:center; padding-bottom:2px; box-shadow:0 2px 5px rgba(0,0,0,0.5);">❮</button>
                <div id="dots-${sliderId}" style="position:absolute; bottom:8px; left:0; right:0; display:flex; justify-content:center; gap:5px; z-index:10; pointer-events:none;">
                    ${dotsHtml}
                </div>
            </div>
        `;
    } else {
        imgHTML = getMatchOrFallback(post, 'card');
    }

    const ctaHTML = (post.cta_text && post.cta_url)
        ? `<a class="mc-cta" href="${post.cta_url}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${post.cta_text}</a>`
        : '';

    function buildOutcomeHTML(text, color) {
        if (!text) return '';
        const isGreen = color === 'green';
        const isRed = color === 'red';
        const cssClass = isGreen ? 'green' : isRed ? 'red' : 'pending';
        const label = isGreen ? 'نجح' : isRed ? 'فشل' : 'معلق';
        const shortText = text.length > 60 ? text.substring(0, 60) + '...' : text;

        // ✅ checkCircle for success, ❌ xCircle for failure, ⏳ hourglass for pending
        // These directly communicate prediction outcome — critical semantic correctness
        let svgIcon;
        if (isGreen) svgIcon = icon('checkCircle', 20, 'currentColor');
        else if (isRed) svgIcon = icon('xCircle', 20, 'currentColor');
        else svgIcon = icon('hourglass', 20, 'currentColor');

        return `<div class="mc-outcome ${cssClass}">
            ${svgIcon}
            <div class="mc-outcome-text-wrap">
                <span class="mc-outcome-label">${label}</span>
                <span class="mc-outcome-value">${shortText}</span>
            </div>
        </div>`;
    }
    const outcomeHTML = buildOutcomeHTML(post.outcome_text, post.outcome_color);

    const card = document.createElement('a');
    card.href = `${location.pathname}?post=${post.id}`;
    card.className = 'news-card fade-in';
    card.style.textDecoration = 'none';
    card.style.color = 'inherit';
    card.style.display = 'flex';

    // Clock: time since publish — semantically correct
    // Calendar: exact publish date — semantically correct
    // Heart: article like — semantically correct
    // Eye: view count — semantically correct
    // Share: share branching network — semantically correct
    card.innerHTML = `
        <div class="mc-img">${imgHTML}</div>
        <div class="mc-body">
            <div class="mc-cat-row" style="margin-bottom: 10px; justify-content: flex-end; align-items: center;">
                <div class="mc-cat-label ${cat.badge}">
                    <span class="mc-cat-dot"></span>${cat.name}
                </div>
            </div>
            <p class="mc-title" id="mc-title-${post.id}" style="transition: opacity 0.2s ease;">${hasMultipleImages && captionsArray[0] ? captionsArray[0] : (post.title || '')}</p>
            <p class="mc-excerpt" id="mc-excerpt-${post.id}" style="transition: opacity 0.2s ease;">${excerpt}</p>
            ${outcomeHTML}
            ${ctaHTML}
        </div>
        <div class="mc-footer">
            <div class="mc-actions">
                <button id="like-btn-${post.id}" class="mc-action ${isLiked ? 'liked' : ''}" onclick="event.preventDefault();event.stopPropagation();toggleLike('${post.id}',event)" title="إعجاب">
                    ${icon('heart', 16, 'currentColor')}
                    <span id="like-count-${post.id}">${fmtNum(stats.likes)}</span>
                </button>
                <span class="mc-action" title="مشاهدات">
                    ${icon('eye', 16, 'currentColor')}
                    ${fmtNum(stats.views)}
                </span>
                <div class="card-share-wrapper">
                    <button class="mc-action" onclick="event.preventDefault();event.stopPropagation();toggleCardShare('${post.id}',event)" title="مشاركة">
                        ${icon('share', 16, 'currentColor')}
                    </button>
                    <div class="card-share-dropdown" id="card-share-${post.id}">
                        <div class="csd-option" onclick="event.preventDefault();event.stopPropagation();copyCardLink('${post.id}')">
                            <span class="csd-icon csd-icon-copy">${icon('copy', 16, 'currentColor')}</span>
                            نسخ الرابط
                        </div>
                        <a class="csd-option" href="https://wa.me/?text=${encodeURIComponent(location.origin + location.pathname + '?post=' + post.id)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">
                            <span class="csd-icon csd-icon-wa">${icon('whatsapp', 16, 'currentColor')}</span>
                            واتساب
                        </a>
                        <a class="csd-option" href="https://t.me/share/url?url=${encodeURIComponent(location.origin + location.pathname + '?post=' + post.id)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">
                            <span class="csd-icon csd-icon-tg">${icon('telegram', 16, 'currentColor')}</span>
                            تيليجرام
                        </a>
                    </div>
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
                <span id="ntime-${post.id}" style="color:#64748b;font-size:10px;font-family:'Tajawal',sans-serif;"></span>
                <button class="mc-readmore" onclick="event.preventDefault();event.stopPropagation();openArticle(allPosts.find(p=>p.id==='${post.id}'))">اقرأ المزيد</button>
            </div>
        </div>`;

    card.addEventListener('click', (e) => {
        if (e.target.closest('.mc-action, .mc-cta, .card-share-wrapper, .csd-option, .mc-readmore')) return;
        // Do not block scroll clicks if not standard
        e.preventDefault();
        openArticle(post);
    });

    // BUG FIX: Use innerHTML instead of formatTimeAgo HTML injection to avoid XSS risk
    // and ensure the clock SVG renders inside the already-rendered card correctly
    setTimeout(() => {
        const el = document.getElementById(`ntime-${post.id}`);
        if (el) el.innerHTML = formatTimeAgo(post.created_at);
        
        // Bind slider observer if multiple images exist
        if (hasMultipleImages) {
            const sliderDiv = card.querySelector('#card-slider-' + post.id);
            const dotsWrap = card.querySelector('#dots-card-slider-' + post.id);
            if (sliderDiv && dotsWrap) {
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const slideTarget = entry.target;
                            const idx = Array.from(sliderDiv.children).indexOf(slideTarget);
                            if (idx !== -1) {
                                Array.from(dotsWrap.children).forEach((d, a) => {
                                    d.style.background = a === idx ? '#e31e24' : 'rgba(255,255,255,0.4)';
                                });
                                
                                // Update text dynamically (Update the Title to the image caption, as requested)
                                const titleEl = card.querySelector('#mc-title-' + post.id);
                                if (titleEl) {
                                    const newText = captionsArray[idx] || (post.title || '');
                                    if (titleEl.innerHTML !== newText) {
                                        titleEl.style.opacity = '0';
                                        setTimeout(() => {
                                            titleEl.innerHTML = newText;
                                            titleEl.style.opacity = '1';
                                        }, 200);
                                    }
                                }
                            }
                        }
                    });
                }, { root: sliderDiv, threshold: 0.5 });
                
                // Note: sliderDiv.children contains slides (we have a <style> block but it's not observable, so safe)
                Array.from(sliderDiv.querySelectorAll('.card-slide')).forEach(child => observer.observe(child));
            }
        }
    }, 0);

    return card;
}

/* ── Card Share ──────────────────────────────────────────── */
function toggleCardShare(postId, event) {
    if (event) event.stopPropagation();
    const dd = document.getElementById('card-share-' + postId);
    if (!dd) return;
    const isOpen = dd.classList.contains('open');
    document.querySelectorAll('.card-share-dropdown.open').forEach(el => el.classList.remove('open'));
    if (!isOpen) dd.classList.add('open');
}

function copyCardLink(postId) {
    const url = location.origin + location.pathname + '?post=' + postId;
    navigator.clipboard.writeText(url)
        .then(() => showNewsToast('تم نسخ الرابط ✓'))
        .catch(() => prompt('الرابط:', url));
    const dd = document.getElementById('card-share-' + postId);
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
            const data = JSON.parse(safeDecodeB64(b64));
            const fallbackSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='10' stroke='%23334155' stroke-width='1.5' fill='none'/%3E%3Ctext x='50%25' y='57%25' text-anchor='middle' font-size='12' fill='%23475569'%3E%E2%9A%BD%3C/text%3E%3C/svg%3E`;
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
    ${data.venue && data.venue !== 'غير معروف' ? `<div style="text-align:center;padding:7px 14px;border-top:1px solid rgba(255,255,255,0.05);font-size:10px;color:#334155;">${icon('stadium', 12, '#475569')} ${data.venue}</div>` : ''}
  </div>
</div>`;
    } catch (e) { return fullMatch; }
    }).replace(/<blockquote[^>]*>.*?\[INSTAGRAM:(.+?)\].*?<\/blockquote>/gs, (fullMatch, cleanUrl) => {
        // Legacy Instagram shortcode support
        return `<div style="margin:20px auto;max-width:540px;">
                    <blockquote class="instagram-media" data-instgrm-permalink="${cleanUrl}" data-instgrm-version="14" style=" background:#FFF; border:0; border-radius:3px; box-shadow:0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15); margin: 1px; max-width:540px; min-width:326px; padding:0; width:99.375%; width:-webkit-calc(100% - 2px); width:calc(100% - 2px);"></blockquote>
                </div>`;
    }).replace(/<blockquote[^>]*>.*?\[EMBED_CODE:([A-Za-z0-9+/=]+)\].*?<\/blockquote>/gs, (fullMatch, b64) => {
        try {
            return decodeURIComponent(escape(atob(b64)));
        } catch(e) { return fullMatch; }
    });
}

function openArticle(post) {
    if (!post) return;
    try {
        currentViewingPost = post;
        const isLiked = userLikedPosts.includes(post.id);

        try { history.pushState(null, null, '?post=' + post.id); } catch (e) { }
        try { updateMetaTags(post); } catch (e) { }

        const titleEl = document.getElementById('article-title');
        if (titleEl) titleEl.textContent = post.title || '';

        const dateEl = document.getElementById('article-date');
        if (dateEl) {
            const dDate = new Date(post.created_at);
            const dateStr = new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }).format(dDate);
            const timeStr = new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: 'numeric', hour12: true }).format(dDate);
            
            dateEl.innerHTML = `
                <span style="display:inline-flex;align-items:center;gap:6px;">${icon('calendar', 14, 'currentColor')} ${dateStr}</span>
                <span style="opacity:0.3;margin:0 4px;">|</span>
                <span style="display:inline-flex;align-items:center;gap:6px;">${icon('clock', 14, 'currentColor')} ${timeStr}</span>
            `;
        }

        const rtEl = document.querySelector('#article-read-time span');
        if (rtEl) rtEl.textContent = estimateReadTime(post.content) + ' دقائق قراءة';

        const viewsEl = document.getElementById('article-views-val');
        if (viewsEl) viewsEl.textContent = fmtNum(getFakeStats(post).views);

        const bodyEl = document.getElementById('article-body');
        if (bodyEl) {
            let processed = replaceMatchCards(post.content || '');

            if (window.DOMPurify) {
                processed = DOMPurify.sanitize(processed, { 
                    ADD_TAGS: ['iframe', 'blockquote', 'script'], 
                    ADD_ATTR: ['style', 'target', 'rel', 'class', 'allowfullscreen', 'frameborder', 'scrolling', 'border', 'dir', 'data-instgrm-permalink', 'data-instgrm-version', 'charset', 'src', 'async', 'width', 'height'] 
                });
            }
            bodyEl.innerHTML = processed;

            // Execute scripts inserted via innerHTML natively (Crucial for Twitter, TikTok, FB, etc.)
            const runScripts = () => {
                const scripts = bodyEl.querySelectorAll('script');
                scripts.forEach(oldScript => {
                    const newScript = document.createElement('script');
                    Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                    if (oldScript.innerHTML) newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                    oldScript.parentNode.replaceChild(newScript, oldScript);
                });
            };
            setTimeout(runScripts, 100);

            // Process legacy instagram embeds if script is loaded
            if (window.instgrm && window.instgrm.Embeds) {
                setTimeout(() => { try { window.instgrm.Embeds.process(); } catch(e){} }, 200);
            }
        }

        // Outcome banner
        const existingBanner = document.getElementById('article-outcome-banner');
        if (existingBanner) existingBanner.remove();
        if (post.outcome_text && post.outcome_color) {
            // 🏆 trophy for won prediction, ❌ for failed — emotionally resonant and clear
            const icon_html = post.outcome_color === 'green'
                ? icon('trophy', 24, 'currentColor')
                : icon('xCircle', 24, 'currentColor');
            const label = post.outcome_color === 'green' ? 'نجح التوقع' : 'فشل التوقع';
            const banner = document.createElement('div');
            banner.id = 'article-outcome-banner';
            banner.className = `article-outcome-banner ${post.outcome_color}`;
            banner.innerHTML = `
                <span class="aob-icon">${icon_html}</span>
                <div>
                    <span class="aob-label">${label}</span>
                    <span class="aob-text">${post.outcome_text}</span>
                </div>`;
            if (bodyEl) bodyEl.insertAdjacentElement('beforebegin', banner);
        }

        const likesEl = document.getElementById('article-like-count');
        if (likesEl) likesEl.textContent = post.likes || 0;

        const likeBtn = document.getElementById('article-like-btn');
        if (likeBtn) { if (isLiked) likeBtn.classList.add('liked'); else likeBtn.classList.remove('liked'); }

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
            const images = post.cover_image_url.split(',');
            // Clean up previous slider elements if any
            document.querySelectorAll('.article-slider-elem').forEach(el => el.remove());
            
            if (images.length === 1) {
                const parts = images[0].split('|');
                const imgU = parts[0].trim();
                const imgCap = parts[1] || '';
                if (imgEl) { imgEl.style.display = 'block'; imgEl.style.opacity = '1'; imgEl.src = imgU; imgEl.alt = post.title || ''; }
                // Optional: add caption below single image if desired, but default is to just show it in slider
            } else {
                if (imgEl) { 
                    imgEl.style.display = 'block'; 
                    imgEl.style.opacity = '0'; // Keep image to enforce height of heroWrap natively
                    const fallbackParts = images[0].split('|');
                    imgEl.src = fallbackParts[0].trim();
                }
                const sliderDiv = document.createElement('div');
                sliderDiv.id = 'article-image-slider';
                sliderDiv.className = 'article-slider-elem';
                sliderDiv.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; display:flex; flex-direction:row; overflow-x:auto; scroll-snap-type:x mandatory; scroll-behavior:smooth; -ms-overflow-style:none; scrollbar-width:none; z-index:1;';
                
                // Observer for dots
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if(entry.isIntersecting) {
                            const idx = entry.target.dataset.index;
                            images.forEach((_, a) => {
                                const d = document.getElementById('slider-dot-' + a);
                                if (d) d.style.background = a == idx ? '#06b6d4' : 'rgba(255,255,255,0.4)';
                            });
                        }
                    });
                }, { root: sliderDiv, threshold: 0.5 });
                
                images.forEach((item, i) => {
                    const parts = item.split('|');
                    const imgUrl = parts[0].trim();
                    const imgCap = parts[1] || '';

                    const slide = document.createElement('div');
                    slide.dataset.index = i;
                    slide.style.cssText = 'flex:0 0 100%; height:100%; scroll-snap-align:start; position:relative;';
                    
                    let html = `<img src="${imgUrl}" loading="lazy" style="width:100%; height:100%; object-fit:contain; display:block; border-radius:inherit; background:rgba(0,0,0,0.4);">`;
                    if (imgCap) {
                        html += `<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent, rgba(0,0,0,0.8), rgba(0,0,0,1));padding:50px 15px 32px;color:#fff;font-size:14px;line-height:1.6;font-weight:700;font-family:'Tajawal',sans-serif;text-align:center;pointer-events:none;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;text-shadow:0 1px 3px rgba(0,0,0,0.9);">${imgCap}</div>`;
                    }
                    slide.innerHTML = html;
                    
                    sliderDiv.appendChild(slide);
                    observer.observe(slide);
                });
                
                const style = document.createElement('style');
                style.className = 'article-slider-elem';
                style.innerHTML = '#article-image-slider::-webkit-scrollbar { display: none; }';
                
                // Left is visually right in RTL if dir=rtl is applied, but standard arrows
                const prevBtn = document.createElement('button');
                prevBtn.className = 'article-slider-elem';
                prevBtn.innerHTML = '❯'; // Right arrow (Prev in RTL)
                prevBtn.style.cssText = 'position:absolute;right:10px;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:50%;background:rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.2);color:#fff;font-size:18px;cursor:pointer;z-index:10;display:flex;align-items:center;justify-content:center;transition:background 0.3s;';
                prevBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); sliderDiv.scrollBy({left: sliderDiv.clientWidth, behavior: 'smooth'}); };
                
                const nextBtn = document.createElement('button');
                nextBtn.className = 'article-slider-elem';
                nextBtn.innerHTML = '❮'; // Left arrow (Next in RTL)
                nextBtn.style.cssText = 'position:absolute;left:10px;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:50%;background:rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.2);color:#fff;font-size:18px;cursor:pointer;z-index:10;display:flex;align-items:center;justify-content:center;transition:background 0.3s;';
                nextBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); sliderDiv.scrollBy({left: -sliderDiv.clientWidth, behavior: 'smooth'}); };
                
                heroWrap.appendChild(style);
                heroWrap.appendChild(sliderDiv);
                heroWrap.appendChild(prevBtn);
                heroWrap.appendChild(nextBtn);
                
                const dotsWrap = document.createElement('div');
                dotsWrap.className = 'article-slider-elem';
                dotsWrap.style.cssText = 'position:absolute;bottom:10px;left:0;right:0;display:flex;justify-content:center;gap:6px;z-index:10;';
                images.forEach((_, i) => {
                    const dot = document.createElement('div');
                    dot.id = 'slider-dot-' + i;
                    dot.style.cssText = `width:8px;height:8px;border-radius:50%;background:${i===0?'#06b6d4':'rgba(255,255,255,0.4)'};transition:all 0.3s;`;
                    dotsWrap.appendChild(dot);
                });
                heroWrap.appendChild(dotsWrap);
            }
            if (heroWrap) heroWrap.style.display = 'block';
            const ac = document.getElementById('article-cat');
            if (ac) ac.style.display = 'none';
            if (contentWrap) contentWrap.classList.add('has-hero');
        } else {
            // Clean up slider
            document.querySelectorAll('.article-slider-elem').forEach(el => el.remove());
            if (imgEl) { imgEl.style.display = ''; imgEl.src = ''; }
            if (heroWrap) heroWrap.style.display = 'none';
            const ac = document.getElementById('article-cat');
            if (ac) ac.style.display = '';
            if (contentWrap) contentWrap.classList.remove('has-hero');
        }

        const ctaContainer = document.getElementById('article-cta-container');
        if (ctaContainer) {
            if (post.cta_text && post.cta_url) {
                ctaContainer.innerHTML = `<a href="${post.cta_url}" target="_blank" rel="noopener" class="article-cta-btn" style="display:inline-block;margin-bottom:25px;">${post.cta_text}</a>`;
                ctaContainer.style.display = 'block';
            } else {
                ctaContainer.innerHTML = '';
                ctaContainer.style.display = 'none';
            }
        }

        try { updateShareLinks(post); } catch (e) { }

        const shareBtnEl = document.getElementById('article-share-btn');
        if (shareBtnEl) shareBtnEl.onclick = toggleShareDropdown;

        const shareDd = document.getElementById('share-dropdown');
        if (shareDd) shareDd.classList.remove('open');

        try { renderRelatedPosts(post); } catch (e) { }
        try { renderRecommendedPosts(); } catch (e) { }
        try { renderMostLikedPosts(post); } catch (e) { }
        try { loadPostComments(post.id); } catch (e) { }

        // FIX: Use async IIFE — supabaseClient.rpc() returns PostgrestFilterBuilder, not a raw Promise
        (async () => { try { await supabaseClient.rpc('increment_views', { post_id: post.id }); } catch (_) { } })();

        const drawer = document.getElementById('article-view');
        if (drawer) {
            drawer.style.display = 'block';
            drawer.scrollTop = 0;
            const bar = document.getElementById('readingProgress');
            if (bar) bar.style.width = '0%';
            void drawer.offsetWidth;
            drawer.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    } catch (err) {
        console.error('Error opening article:', err);
        alert('حدث خطأ أثناء فتح المقال: ' + err.message);
    }
}

function renderRelatedPosts(currentPost) {
    const section = document.getElementById('related-posts-section');
    const list = document.getElementById('related-posts-list');
    if (!section || !list) return;

    const related = allPosts.filter(p => p.id !== currentPost.id && p.category === currentPost.category).slice(0, 3);
    if (!related.length) { section.style.display = 'none'; return; }
    
    section.style.display = 'block';
    list.innerHTML = related.map((rp, i) => {
        const firstImg = rp.cover_image_url ? (rp.cover_image_url.includes(',') ? rp.cover_image_url.split(',')[0] : rp.cover_image_url) : null;
        const imgH = firstImg
            ? `<img src="${firstImg}" loading="lazy" alt="" style="width:100%;height:140px;object-fit:cover;display:block;" onerror="this.style.display='none'">`
            : `<div style="width:100%;height:140px;overflow:hidden;">${window.getFallbackImgHTML ? window.getFallbackImgHTML() : ''}</div>`;
        return `
        <div class="related-card fade-in" style="animation-delay:${i * 0.1}s;" onclick="openArticle(allPosts.find(x => x.id === '${rp.id}'))">
            <div class="related-card-inner">
                ${imgH}
                <div style="padding:14px;">
                    <p style="font-size:14px;font-weight:800;color:#f8fafc;margin:0;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${rp.title || ''}</p>
                </div>
            </div>
        </div>`;
    }).join('');
}

async function renderRecommendedPosts() {
    const section = document.getElementById('recommended-posts-section');
    const list = document.getElementById('recommended-posts-list');
    if (!section || !list) return;

    try {
        const { data: recItems, error } = await supabaseClient
            .from('recommended_articles')
            .select('*')
            .eq('active', true)
            .order('sort_order', { ascending: true })
            .limit(3);

        if (!error && recItems && recItems.length > 0) {
            section.style.display = 'block';
            list.innerHTML = recItems.map((rp, i) => {
                const imgH = rp.image_url
                    ? `<img src="${rp.image_url}" loading="lazy" alt="" style="width:100%;height:140px;object-fit:cover;display:block;" onerror="this.style.display='none'">`
                    : `<div style="width:100%;height:140px;background:linear-gradient(135deg,rgba(14,165,233,0.15),rgba(56,189,248,0.05));display:flex;align-items:center;justify-content:center;font-size:32px;">📰</div>`;
                return `
                <a href="${rp.link_url}" class="related-card fade-in" style="animation-delay:${i * 0.1}s; text-decoration:none;">
                    <div class="related-card-inner">
                        ${imgH}
                        <div style="padding:14px;">
                            <p style="font-size:14px;font-weight:800;color:#f8fafc;margin:0 0 6px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${rp.title || ''}</p>
                            <p style="font-size:12px;color:#94a3b8;margin:0;">${rp.subtitle || ''}</p>
                        </div>
                    </div>
                </a>`;
            }).join('');
        } else {
            section.style.display = 'none';
        }
    } catch(e) { console.error(e); }
}

function renderMostLikedPosts(currentPost) {
    const section = document.getElementById('most-liked-posts-section');
    const list = document.getElementById('most-liked-posts-list');
    if (!section || !list) return;

    const topPosts = allPosts
        .filter(p => p.id !== currentPost.id)
        .sort((a, b) => (b.likes || 0) - (a.likes || 0))
        .slice(0, 3);

    if (!topPosts.length) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    
    list.innerHTML = topPosts.map((rp, i) => {
        const firstImg = rp.cover_image_url ? (rp.cover_image_url.includes(',') ? rp.cover_image_url.split(',')[0] : rp.cover_image_url) : null;
        const imgH = firstImg
            ? `<img src="${firstImg}" loading="lazy" alt="" style="width:100%;height:140px;object-fit:cover;display:block;" onerror="this.style.display='none'">`
            : `<div style="width:100%;height:140px;overflow:hidden;">${window.getFallbackImgHTML ? window.getFallbackImgHTML() : ''}</div>`;
        return `
        <div class="related-card fade-in" style="animation-delay:${i * 0.1}s;" onclick="openArticle(allPosts.find(x => x.id === '${rp.id}'))">
            <div class="related-card-inner">
                ${imgH}
                <div style="padding:14px;">
                    <p style="font-size:14px;font-weight:800;color:#f8fafc;margin:0 0 6px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${rp.title || ''}</p>
                    <div style="display:flex;align-items:center;gap:6px;color:#ec4899;font-size:12px;font-weight:700;">
                        <svg viewBox="0 0 24 24" style="width:14px;fill:currentColor;"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                        ${rp.likes || 0}
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

function closeArticle() {
    const drawer = document.getElementById('article-view');
    if (!drawer) return; // BUG FIX: guard
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
    const drawer = document.getElementById('article-view');
    if (e.key === 'Escape' && drawer && drawer.classList.contains('active')) closeArticle();
});

// BUG FIX: Use optional chaining to avoid crash if element doesn't exist at load time
document.addEventListener('click', function handleArticleOverlayClick(e) {
    const drawer = document.getElementById('article-view');
    if (drawer && e.target === drawer) closeArticle();
}, true);

// Separate the article-view click handler to avoid duplicate listener issues
document.addEventListener('DOMContentLoaded', () => {
    const av = document.getElementById('article-view');
    if (av) {
        av.addEventListener('click', function (e) {
            if (e.target === this) closeArticle();
        });
    }
});

/* ── Article Share ───────────────────────────────────────── */
function toggleShareDropdown(event) {
    if (event) event.stopPropagation();
    const dd = document.getElementById('share-dropdown');
    if (dd) dd.classList.toggle('open');
}

function buildShareMsg(post, shareUrl) {
    const title = post.title || '';
    const waTxt = `${title}\n${shareUrl}`;
    const tgTxt = title;
    return { waTxt, tgTxt, ogUrl: shareUrl };
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
    navigator.clipboard.writeText(url)
        .then(() => showNewsToast('تم نسخ الرابط ✓'))
        .catch(() => prompt('الرابط:', url));
    const dd = document.getElementById('share-dropdown');
    if (dd) dd.classList.remove('open');
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
        newCount = Math.max(0, newCount - 1);
    } else {
        newCount++;
    }

    try {
        if (isLiked) {
            const { error } = await supabaseClient.from('post_likes').delete().match({ post_id: postId, user_fingerprint: userFingerprint });
            if (error) throw error;
        } else {
            const { error } = await supabaseClient.from('post_likes').insert([{ post_id: postId, user_fingerprint: userFingerprint }]);
            if (error) throw error;
        }
        await supabaseClient.from('posts').update({ likes: newCount }).eq('id', postId);

        if (isLiked) {
            userLikedPosts = userLikedPosts.filter(id => id !== postId);
            if (likeBtn) likeBtn.classList.remove('liked');
        } else {
            userLikedPosts.push(postId);
            if (likeBtn) likeBtn.classList.add('liked');
        }
        if (countEl) countEl.textContent = newCount;
        allPosts[idx].likes = newCount;
    } catch (err) {
        console.error('Like error:', err);
        showNewsToast('حدث خطأ أثناء تسجيل الإعجاب. حاول مرة أخرى.');
    }
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
            applyFiltersAndRender();
            showNewsToast('📰 مقال جديد تم نشره!');
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

/* ═══════════════════════════════════════════════════════════════
   COMMENTS & REVIEWS SYSTEM
   ═══════════════════════════════════════════════════════════════ */

// ── Device Fingerprint ────────────────────────────────────────
function getDeviceFingerprint() {
    const key = '_kora74_fp';
    let fp = localStorage.getItem(key);
    if (!fp) {
        const raw = [
            navigator.userAgent,
            navigator.language,
            screen.width + 'x' + screen.height,
            new Date().getTimezoneOffset(),
            navigator.hardwareConcurrency,
            navigator.platform
        ].join('|');
        let hash = 0;
        for (let i = 0; i < raw.length; i++) {
            hash = ((hash << 5) - hash) + raw.charCodeAt(i);
            hash |= 0;
        }
        fp = 'fp_' + Math.abs(hash).toString(36) + '_' + Date.now().toString(36);
        localStorage.setItem(key, fp);
    }
    return fp;
}

// ── Check Ban ─────────────────────────────────────────────────
async function isUserBanned() {
    const fp = getDeviceFingerprint();
    try {
        const { data } = await supabaseClient
            .from('banned_users')
            .select('fingerprint')
            .eq('fingerprint', fp)
            .maybeSingle();
        return !!data;
    } catch (e) {
        return false;
    }
}

// ── Modal State ───────────────────────────────────────────────
let _cmMode = 'article'; // 'article' | 'review'

function openCommentModal(mode) {
    _cmMode = mode || 'article';
    const modal = document.getElementById('comment-modal');
    const title = document.getElementById('cm-title');
    const ratingSection = document.getElementById('cm-rating-section');

    if (_cmMode === 'review') {
        if (title) title.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"/></svg> أضف رأيك`;
        if (ratingSection) ratingSection.style.display = 'block';
    } else {
        if (title) title.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> اترك تعليقاً`;
        if (ratingSection) ratingSection.style.display = 'none';
    }

    // Reset fields
    const nameEl = document.getElementById('cm-name');
    const textEl = document.getElementById('cm-text');
    if (nameEl) nameEl.value = '';
    if (textEl) textEl.value = '';
    document.getElementById('cm-rating-val').value = '5';
    initStars(5);

    if (modal) { modal.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
}

function closeCommentModal() {
    const modal = document.getElementById('comment-modal');
    if (modal) { modal.style.display = 'none'; document.body.style.overflow = ''; }
}

// Close modal on backdrop click
document.addEventListener('click', (e) => {
    const modal = document.getElementById('comment-modal');
    if (modal && e.target === modal) closeCommentModal();
});

// ── Star Rating ───────────────────────────────────────────────
function initStars(selected) {
    const starsEl = document.getElementById('cm-stars');
    if (!starsEl) return;
    const spans = starsEl.querySelectorAll('span');
    spans.forEach(s => {
        const v = parseInt(s.dataset.val);
        s.style.color = v <= selected ? '#f59e0b' : '#475569';
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const starsEl = document.getElementById('cm-stars');
    if (!starsEl) return;
    starsEl.querySelectorAll('span').forEach(s => {
        s.addEventListener('mouseenter', () => initStars(parseInt(s.dataset.val)));
        s.addEventListener('mouseleave', () => initStars(parseInt(document.getElementById('cm-rating-val').value)));
        s.addEventListener('click', () => {
            document.getElementById('cm-rating-val').value = s.dataset.val;
            initStars(parseInt(s.dataset.val));
        });
    });
    initStars(5);
});

// ── Submit ────────────────────────────────────────────────────
async function submitComment() {
    const textEl = document.getElementById('cm-text');
    const nameEl = document.getElementById('cm-name');
    const spinner = document.getElementById('cm-spinner');
    const btn = document.getElementById('cm-submit-btn');

    const content = textEl?.value.trim();
    if (!content) { showNewsToast('⚠️ الرجاء كتابة رسالتك أولاً'); return; }

    const fp = getDeviceFingerprint();

    // Ban check
    const banned = await isUserBanned();
    if (banned) {
        showNewsToast('🚫 تم حظرك من التعليق في هذا الموقع.');
        closeCommentModal();
        return;
    }

    if (btn) btn.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';

    try {
        const authorName = nameEl?.value.trim() || 'زائر';
        const isAnon = !nameEl?.value.trim();

        if (_cmMode === 'review') {
            const rating = parseInt(document.getElementById('cm-rating-val').value) || 5;
            const { error } = await supabaseClient.from('community_reviews').insert([{
                reviewer_name: isAnon ? 'زائر' : authorName,
                review_text: content,
                rating: rating,
                verified: false,
                active: true,
                fingerprint: fp
            }]);
            if (error) throw error;
            showNewsToast('✅ شكراً! تم نشر رأيك.');
            // Refresh reviews widget
            setTimeout(() => loadCommunityReviews(), 500);
        } else {
            if (!currentViewingPost) throw new Error('لم يتم تحديد المقال');
            const { error } = await supabaseClient.from('post_comments').insert([{
                post_id: String(currentViewingPost.id),
                author_name: isAnon ? 'زائر' : authorName,
                content: content,
                fingerprint: fp,
                is_anonymous: isAnon
            }]);
            if (error) throw error;
            showNewsToast('✅ تم نشر تعليقك!');
            // Refresh comments list
            setTimeout(() => loadPostComments(currentViewingPost.id), 500);
        }
        closeCommentModal();
    } catch (err) {
        showNewsToast('❌ حدث خطأ: ' + err.message);
    } finally {
        if (btn) btn.disabled = false;
        if (spinner) spinner.style.display = 'none';
    }
}

// ── Load Comments for Article ─────────────────────────────────
async function loadPostComments(postId) {
    const list = document.getElementById('comments-list');
    const countEl = document.getElementById('comments-count');
    if (!list) return;

    list.innerHTML = '<div style="text-align:center;color:#64748b;padding:16px;font-size:13px;">جاري التحميل...</div>';

    try {
        const { data, error } = await supabaseClient
            .from('post_comments')
            .select('*')
            .eq('post_id', String(postId))
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        if (countEl) countEl.textContent = data?.length || 0;

        if (!data || data.length === 0) {
            list.innerHTML = '<div style="text-align:center;color:#64748b;font-size:14px;padding:20px;">كن أول من يعلق! 💬</div>';
            return;
        }

        list.innerHTML = data.map(c => {
            const timeAgo = formatTimeAgo(new Date(c.created_at));
            const initial = (c.author_name || 'ز').charAt(0).toUpperCase();
            const avatarColor = stringToColor(c.author_name || 'زائر');
            return `
            <div style="display:flex;gap:12px;padding:14px;background:rgba(255,255,255,0.03);border-radius:10px;border:1px solid rgba(255,255,255,0.06);animation:fadeIn 0.3s ease;">
                <div style="width:38px;height:38px;border-radius:50%;background:${avatarColor};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;color:#fff;flex-shrink:0;">
                    ${initial}
                </div>
                <div style="flex:1;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                        <span style="font-weight:700;color:#e2e8f0;font-size:14px;">${escapeHtml(c.author_name || 'زائر')}</span>
                        ${c.is_anonymous ? '<span style="background:rgba(100,116,139,0.15);color:#94a3b8;font-size:11px;padding:2px 8px;border-radius:20px;">زائر</span>' : ''}
                        <span style="color:#475569;font-size:12px;margin-right:auto;">${timeAgo}</span>
                    </div>
                    <p style="margin:0;color:#cbd5e1;font-size:14px;line-height:1.7;">${escapeHtml(c.content)}</p>
                </div>
            </div>`;
        }).join('');
    } catch (err) {
        list.innerHTML = '<div style="text-align:center;color:#ef4444;font-size:13px;padding:16px;">خطأ في تحميل التعليقات</div>';
    }
}

// ── Helpers ───────────────────────────────────────────────────
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 55%, 38%)`;
}

function formatTimeAgo(date) {
    const diff = Math.floor((Date.now() - date) / 1000);
    if (diff < 60) return 'الآن';
    if (diff < 3600) return Math.floor(diff / 60) + ' دقيقة';
    if (diff < 86400) return Math.floor(diff / 3600) + ' ساعة';
    if (diff < 2592000) return Math.floor(diff / 86400) + ' يوم';
    return Math.floor(diff / 2592000) + ' شهر';
}

/* ── Reviews Scroll Arrows ───────────────────────────────────── */
function scrollReviews(direction) {
    const body = document.getElementById('reviews-widget-body');
    if (!body) return;

    // 4 cards × ~142px each
    const scrollAmount = 142 * 4;
    body.scrollBy({ top: direction * scrollAmount, behavior: 'smooth' });

    // Visual press feedback
    const btnId = direction < 0 ? 'reviews-scroll-up' : 'reviews-scroll-down';
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.style.opacity = '1';
        setTimeout(() => { btn.style.opacity = '0.55'; }, 250);
    }
}
