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
});

function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.round((now - date) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    const clockIcon = `<svg viewBox="0 0 24 24" style="width:14px; height:14px; fill:currentColor; margin-left:4px;"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>`;

    if (seconds < 60) return `<div style="display:flex;align-items:center;">${clockIcon} منذ لحظات</div>`;
    if (minutes < 60) return `<div style="display:flex;align-items:center;">${clockIcon} منذ ${minutes} دقيقة</div>`;
    if (hours < 24) return `<div style="display:flex;align-items:center;">${clockIcon} منذ ${hours} ساعة</div>`;
    
    // Fallback for more than 24h
    const d = date.getDate();
    const m = date.getMonth() + 1;
    const y = date.getFullYear();
    return `<div style="display:flex;align-items:center;">${clockIcon} ${y}/${m}/${d}</div>`;
}

function stripHtml(html) {
    let tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    let text = tmp.textContent || tmp.innerText || "";
    return text.substring(0, 120) + (text.length > 120 ? '...' : '');
}

async function fetchInitialData() {
    try {
        // Fetch posts
        const { data: postsData, error: postsError } = await supabaseClient
            .from('posts')
            .select('*')
            .eq('published', true)
            .order('created_at', { ascending: false });

        if (postsError) throw postsError;
        allPosts = postsData || [];

        // Fetch user's liked posts to know which hearts to highlight
        const { data: likesData, error: likesError } = await supabaseClient
            .from('post_likes')
            .select('post_id')
            .eq('user_fingerprint', userFingerprint);

        if (!likesError && likesData) {
            userLikedPosts = likesData.map(l => l.post_id);
        }

        renderGrid();
        
        // Handle deep link from hash
        const hash = window.location.hash;
        if (hash && hash.startsWith('#post-')) {
            const postId = hash.replace('#post-', '');
            const targetPost = allPosts.find(p => p.id === postId);
            if (targetPost) {
                setTimeout(() => openArticle(targetPost), 100);
            }
        }
        
    } catch (err) {
        console.error("Error fetching news:", err);
        document.getElementById('news-grid').innerHTML = '<div style="color:var(--danger); text-align:center; grid-column: 1/-1;">فشل في تحميل المقالات. يرجى تحديث الصفحة.</div>';
    }
}

function setupTabs() {
    const tabs = document.querySelectorAll('.news-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.dataset.filter;
            renderGrid();
        });
    });
}

function createCardElement(post) {
    const isLiked = userLikedPosts.includes(post.id);
    const card = document.createElement('div');
    card.className = 'news-card fade-in';
    card.onclick = (e) => {
        if (e.target.closest('.news-icon-btn') || e.target.closest('.news-card-cta-btn') || e.target.closest('.news-read-more') || e.target.closest('.card-share-wrapper')) return;
        openArticle(post);
    };

    // Category label + dot class
    let catName = 'أخبار';
    if (post.category === 'prediction') catName = 'توقعات';
    if (post.category === 'analysis')   catName = 'تحليل';

    const dotClass = post.category === 'prediction' ? 'dot-prediction'
                   : post.category === 'analysis'   ? 'dot-analysis'
                   : 'dot-news';

    // Cover image content
    const imgContent = post.cover_image_url
        ? `<img src="${post.cover_image_url}" loading="lazy" alt="${(post.title || '').replace(/"/g, '&quot;')}">`
        : `<div class="news-card-img-box-fallback"></div>`;

    // Excerpt (plain text)
    const excerptText = stripHtml(post.content);

    // CTA button — only if both fields are set
    const ctaHTML = (post.cta_text && post.cta_url)
        ? `<button class="news-card-cta-btn" onclick="event.stopPropagation();window.open('${post.cta_url}','_blank')">${post.cta_text}</button>`
        : '';

    // Build Mac-window HTML
    card.innerHTML = `
        <div class="news-card-mac-header">
            <span class="news-card-mac-dot mac-dot-red"></span>
            <span class="news-card-mac-dot mac-dot-yellow"></span>
            <span class="news-card-mac-dot mac-dot-green"></span>
            <span class="news-card-time-inline" id="time-${post.id}"></span>
        </div>
        <div class="news-card-img-box">
            ${imgContent}
            <span class="news-cat-overlay-badge">
                <span class="cat-badge-dot ${dotClass}"></span>
                ${catName}
            </span>
        </div>
        <div class="news-card-body">
            <h3 class="news-card-title">${post.title || ''}</h3>
            <p class="news-card-excerpt">${excerptText}</p>
        </div>
        <div class="news-card-actions">
            <div class="news-card-actions-left">
                <button class="news-read-more" onclick="event.stopPropagation();openArticle_byId('${post.id}')" aria-label="قراءة المزيد">
                    قراءة المزيد
                    <svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:currentColor;transform:scaleX(-1);"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>
                </button>
                ${ctaHTML}
            </div>
            <div class="news-card-actions-right">
                <div class="card-share-wrapper" id="csw-${post.id}">
                    <button class="news-icon-btn" onclick="toggleCardShare('${post.id}', event)" aria-label="مشاركة">
                        <svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
                    </button>
                    <div class="card-share-dropdown" id="csd-${post.id}">
                        <div class="csd-option csd-copy" onclick="copyCardPostLink('${post.id}', event)">
                            <div class="csd-icon csd-icon-copy"><svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg></div>
                            نسخ الرابط
                        </div>
                        <a class="csd-option csd-wa" href="#" id="csd-wa-${post.id}" target="_blank" rel="noopener" onclick="event.stopPropagation()">
                            <div class="csd-icon csd-icon-wa"><svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.48 2 2 6.48 2 12c0 1.82.49 3.52 1.33 5L2 22l5.13-1.31C8.56 21.55 10.23 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.72 0-3.34-.47-4.73-1.28l-.34-.2-3.04.78.81-2.95-.22-.35C3.47 15.26 3 13.69 3 12 3 7.03 7.03 3 12 3s9 4.03 9 9-4.03 9-9 9z"/></svg></div>
                            واتساب
                        </a>
                        <a class="csd-option csd-tg" href="#" id="csd-tg-${post.id}" target="_blank" rel="noopener" onclick="event.stopPropagation()">
                            <div class="csd-icon csd-icon-tg"><svg viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.892-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg></div>
                            تيليجرام
                        </a>
                        <a class="csd-option csd-tw" href="#" id="csd-tw-${post.id}" target="_blank" rel="noopener" onclick="event.stopPropagation()">
                            <div class="csd-icon csd-icon-tw"><svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.627L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg></div>
                            تويتر
                        </a>
                        <a class="csd-option csd-fb" href="#" id="csd-fb-${post.id}" target="_blank" rel="noopener" onclick="event.stopPropagation()">
                            <div class="csd-icon csd-icon-fb"><svg viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></div>
                            فيسبوك
                        </a>
                    </div>
                </div>
                <button class="news-icon-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike('${post.id}', event)" aria-label="إعجاب" id="like-btn-${post.id}">
                    <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                    <span id="like-count-${post.id}">${post.likes || 0}</span>
                </button>
            </div>
        </div>
    `;

    // Set time in header via innerHTML so SVG clock renders
    const timeEl = card.querySelector(`#time-${post.id}`);
    if (timeEl) timeEl.innerHTML = formatTimeAgo(post.created_at);

    return card;
}

// Helper: open article by ID (used from read-more button)
function openArticle_byId(postId) {
    const post = allPosts.find(p => p.id === postId);
    if (post) openArticle(post);
}

// Toggle per-card share dropdown
function toggleCardShare(id, event) {
    if (event) event.stopPropagation();
    const post = allPosts.find(p => p.id === id);

    // Close all other open card dropdowns first
    document.querySelectorAll('.card-share-dropdown.open').forEach(el => {
        if (el.id !== 'csd-' + id) el.classList.remove('open');
    });

    const dd = document.getElementById('csd-' + id);
    if (!dd) return;

    // Populate share links if opening
    if (!dd.classList.contains('open') && post) {
        const shareUrl = window.location.origin + window.location.pathname + '#post-' + id;
        const text = encodeURIComponent((post.title || 'مقال من SpinBetter') + ' — ' + shareUrl);
        const urlEnc = encodeURIComponent(shareUrl);
        const waEl = document.getElementById('csd-wa-' + id);
        const tgEl = document.getElementById('csd-tg-' + id);
        const twEl = document.getElementById('csd-tw-' + id);
        const fbEl = document.getElementById('csd-fb-' + id);
        if (waEl) waEl.href = `https://wa.me/?text=${text}`;
        if (tgEl) tgEl.href = `https://t.me/share/url?url=${urlEnc}&text=${encodeURIComponent(post.title || 'مقال من SpinBetter')}`;
        if (twEl) twEl.href = `https://twitter.com/intent/tweet?text=${text}`;
        if (fbEl) fbEl.href = `https://www.facebook.com/sharer/sharer.php?u=${urlEnc}`;
    }

    dd.classList.toggle('open');
}

function copyCardPostLink(id, event) {
    if (event) event.stopPropagation();
    const shareUrl = window.location.origin + window.location.pathname + '#post-' + id;
    navigator.clipboard.writeText(shareUrl)
        .then(() => showToast('تم نسخ الرابط ✓'))
        .catch(() => prompt('انسخ الرابط:', shareUrl));
    const dd = document.getElementById('csd-' + id);
    if (dd) dd.classList.remove('open');
}


function toggleShareDropdown(event) {
    if (event) event.stopPropagation();
    const dd = document.getElementById('share-dropdown');
    dd.classList.toggle('open');
}

function copyArticleLink() {
    const shareUrl = window.location.origin + window.location.pathname + '#post-' + (currentViewingPost?.id || '');
    navigator.clipboard.writeText(shareUrl)
        .then(() => showToast('تم نسخ الرابط ✓'))
        .catch(() => { prompt('انسخ الرابط:', shareUrl); });
    document.getElementById('share-dropdown').classList.remove('open');
}

function updateShareLinks(post) {
    const shareUrl = window.location.origin + window.location.pathname + '#post-' + post.id;
    const text = encodeURIComponent((post.title || 'مقال من SpinBetter') + ' — ' + shareUrl);
    const urlEnc = encodeURIComponent(shareUrl);

    const waEl = document.getElementById('share-wa-link');
    const tgEl = document.getElementById('share-tg-link');
    const twEl = document.getElementById('share-tw-link');
    const fbEl = document.getElementById('share-fb-link');

    if (waEl) waEl.href = `https://wa.me/?text=${text}`;
    if (tgEl) tgEl.href = `https://t.me/share/url?url=${urlEnc}&text=${encodeURIComponent(post.title || 'مقال من SpinBetter')}`;
    if (twEl) twEl.href = `https://twitter.com/intent/tweet?text=${text}`;
    if (fbEl) fbEl.href = `https://www.facebook.com/sharer/sharer.php?u=${urlEnc}`;
}

// ─── Unified global click handler for all share dropdowns ───
document.addEventListener('click', function(e) {
    // Close article overlay share dropdown
    const articleDd = document.getElementById('share-dropdown');
    const articleWrapper = document.getElementById('share-wrapper');
    if (articleDd && articleWrapper && !articleWrapper.contains(e.target)) {
        articleDd.classList.remove('open');
    }
    // Close card share dropdowns
    if (!e.target.closest('.card-share-wrapper')) {
        document.querySelectorAll('.card-share-dropdown.open').forEach(el => el.classList.remove('open'));
    }
});

// Reading progress bar
function setupReadingProgress() {
    const overlay = document.getElementById('article-view');
    const bar = document.getElementById('readingProgress');
    if (!overlay || !bar) return;
    overlay.addEventListener('scroll', function() {
        const scrollTop = overlay.scrollTop;
        const total = overlay.scrollHeight - overlay.clientHeight;
        const pct = total > 0 ? (scrollTop / total) * 100 : 0;
        bar.style.width = pct + '%';
    });
}
setupReadingProgress();

function estimateReadTime(html) {
    const text = html ? html.replace(/<[^>]+>/g, ' ') : '';
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const mins = Math.max(1, Math.ceil(words / 200));
    return `${mins} دقيقة قراءة`;
}

function renderGrid() {
    const grid = document.getElementById('news-grid');
    grid.innerHTML = '';
    
    let filteredPosts = allPosts;
    if (currentFilter !== 'all') {
        filteredPosts = allPosts.filter(p => p.category === currentFilter);
    }
    
    if (filteredPosts.length === 0) {
        grid.innerHTML = '<div style="color:var(--text-muted); text-align:center; grid-column: 1/-1; padding:40px;">لا توجد مقالات في هذا القسم حالياً.</div>';
        return;
    }

    filteredPosts.forEach(post => {
        grid.appendChild(createCardElement(post));
    });
}

function openArticle(post) {
    currentViewingPost = post;
    const isLiked = userLikedPosts.includes(post.id);

    // Set URL Hash for sharing
    window.history.pushState(null, null, '#post-' + post.id);

    // Title
    document.getElementById('article-title').textContent = post.title || '';

    // Date
    document.getElementById('article-date').innerHTML = formatTimeAgo(post.created_at);

    // Estimated read time
    const rtEl = document.querySelector('#article-read-time span');
    if (rtEl) rtEl.textContent = estimateReadTime(post.content);

    // Body content
    document.getElementById('article-body').innerHTML = post.content || '';

    // Likes count
    document.getElementById('article-like-count').textContent = post.likes || 0;

    // Like button state
    const likeBtn = document.getElementById('article-like-btn');
    if (isLiked) likeBtn.classList.add('liked');
    else likeBtn.classList.remove('liked');

    // Category badge (helper)
    function buildCatBadge(catEl) {
        if (!catEl) return;
        catEl.className = 'cat-badge';
        if (post.category === 'news')       { catEl.textContent = 'أخبار';   catEl.classList.add('cat-news'); }
        else if (post.category === 'prediction') { catEl.textContent = 'توقعات'; catEl.classList.add('cat-prediction'); }
        else                                { catEl.textContent = 'تحليل';  catEl.classList.add('cat-analysis'); }
    }
    buildCatBadge(document.getElementById('article-cat'));
    buildCatBadge(document.getElementById('article-cat-hero'));

    // Cover image (hero)
    const heroWrap = document.getElementById('article-hero-wrap');
    const imgEl = document.getElementById('article-img');
    const contentWrap = document.getElementById('article-content-wrap');
    if (post.cover_image_url) {
        imgEl.src = post.cover_image_url;
        imgEl.alt = post.title || '';
        heroWrap.style.display = 'block';
        // Hide inline cat badge (shown in hero overlay instead)
        document.getElementById('article-cat').style.display = 'none';
        contentWrap.classList.add('has-hero');
    } else {
        imgEl.src = '';
        heroWrap.style.display = 'none';
        document.getElementById('article-cat').style.display = '';
        contentWrap.classList.remove('has-hero');
    }

    // CTA Button
    const ctaContainer = document.getElementById('article-cta-container');
    if (post.cta_text && post.cta_url) {
        ctaContainer.innerHTML = `<a href="${post.cta_url}" target="_blank" rel="noopener" class="btn-glowing-massive" style="display:inline-block;margin-bottom:25px;">${post.cta_text}</a>`;
        ctaContainer.style.display = 'block';
    } else {
        ctaContainer.innerHTML = '';
        ctaContainer.style.display = 'none';
    }

    // Wire up share links in dropdown
    updateShareLinks(post);
    // Also wire the card share button
    const shareBtn = document.getElementById('article-share-btn');
    if (shareBtn) shareBtn.onclick = toggleShareDropdown;

    // Reset share dropdown
    const dd = document.getElementById('share-dropdown');
    if (dd) dd.classList.remove('open');

    // Open overlay
    const drawer = document.getElementById('article-view');
    drawer.style.display = 'block';
    drawer.scrollTop = 0;
    // Reset progress bar
    const bar = document.getElementById('readingProgress');
    if (bar) bar.style.width = '0%';

    // Force a reflow so the transition fires
    void drawer.offsetWidth;

    drawer.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Close via ESC
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && document.getElementById('article-view').classList.contains('active')) {
        closeArticle();
    }
});

// Close via Click outside content
document.getElementById('article-view').addEventListener('click', function(e) {
    if (e.target === this) {
        closeArticle();
    }
});

function closeArticle() {
    const drawer = document.getElementById('article-view');
    drawer.classList.remove('active');
    document.body.style.overflow = '';
    const bar = document.getElementById('readingProgress');
    if (bar) bar.style.width = '0%';
    // Close share dropdown if open
    const dd = document.getElementById('share-dropdown');
    if (dd) dd.classList.remove('open');
    
    // Remove hash from URL when closing
    window.history.pushState(null, null, window.location.pathname);
    
    // Wait for transition before hiding
    setTimeout(() => {
        drawer.style.display = 'none';
    }, 350);
    
    currentViewingPost = null;
}

async function toggleLike(postId, event = null) {
    if (event) event.stopPropagation();
    
    const postIndex = allPosts.findIndex(p => p.id === postId);
    if(postIndex === -1) return;

    const isLiked = userLikedPosts.includes(postId);
    // Use the new class-named like button
    const likeBtn = document.getElementById(`like-btn-${postId}`) || document.getElementById(`like-count-${postId}`)?.parentElement;
    const countDisplay = document.getElementById(`like-count-${postId}`);
    
    let newLikesCount = allPosts[postIndex].likes || 0;
    
    // Optimistic UI update
    if (isLiked) {
        userLikedPosts = userLikedPosts.filter(id => id !== postId);
        newLikesCount = Math.max(0, newLikesCount - 1);
        if(likeBtn) likeBtn.classList.remove('liked');
    } else {
        userLikedPosts.push(postId);
        newLikesCount++;
        if(likeBtn) likeBtn.classList.add('liked');
    }

    if(countDisplay) countDisplay.textContent = newLikesCount;
    allPosts[postIndex].likes = newLikesCount;
    
    // Sync with DB
    try {
        if (isLiked) {
            await supabaseClient.from('post_likes')
                .delete()
                .match({ post_id: postId, user_fingerprint: userFingerprint });
        } else {
            await supabaseClient.from('post_likes')
                .insert([{ post_id: postId, user_fingerprint: userFingerprint }]);
        }
    } catch(err) {
        console.error("Like toggle failed", err);
    }
}

async function toggleLikeFromArticle() {
    if (!currentViewingPost) return;
    await toggleLike(currentViewingPost.id);

    // Sync UI back into article overlay
    const isLiked = userLikedPosts.includes(currentViewingPost.id);
    const likeBtn = document.getElementById('article-like-btn');
    const countDisplay = document.getElementById('article-like-count');

    if (isLiked) likeBtn.classList.add('liked');
    else likeBtn.classList.remove('liked');

    const postIndex = allPosts.findIndex(p => p.id === currentViewingPost.id);
    if (countDisplay) countDisplay.textContent = allPosts[postIndex]?.likes || 0;
}

// Global Toast logic for public page (lightweight version)
function showToast(message) {
    let container = document.getElementById('news-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'news-toast-container';
        container.style.cssText = 'position:fixed; bottom:20px; right:20px; z-index:10000; display:flex; flex-direction:column; gap:10px;';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.style.cssText = 'background:var(--accent); color:#fff; padding:12px 20px; border-radius:8px; font-weight:bold; cursor:pointer; box-shadow:0 10px 25px rgba(0,0,0,0.5); opacity:0; transform:translateY(20px); transition:all 0.3s ease;';
    toast.innerText = message;
    
    toast.onclick = () => { window.scrollTo({top:0, behavior:'smooth'}); fetchInitialData(); toast.remove(); };
    
    container.appendChild(toast);
    
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// Supabase Real-time Changes
function setupRealtime() {
    supabaseClient
      .channel('public:posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, payload => {
            if (payload.new && payload.new.published) {
                // Add to memory
                allPosts.unshift(payload.new);
                
                // If the user filter matches, inject live to the grid!
                if (currentFilter === 'all' || currentFilter === payload.new.category) {
                    const grid = document.getElementById('news-grid');
                    // Remove Empty state if exists
                    if (grid.innerHTML.includes('لا توجد مقالات')) grid.innerHTML = '';
                    
                    const newCard = createCardElement(payload.new);
                    grid.insertBefore(newCard, grid.firstChild);
                    
                    // Trigger reflow for fade-in
                    void newCard.offsetWidth;
                    newCard.classList.add('show');
                }
            }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, payload => {
          // If a post likes are updated from DB trigger, we update silently
          if (payload.new) {
              const idx = allPosts.findIndex(p => p.id === payload.new.id);
              if (idx !== -1) {
                  allPosts[idx] = payload.new;
                  const cD = document.getElementById(`like-count-${payload.new.id}`);
                  if (cD) cD.textContent = payload.new.likes;

                  if (currentViewingPost && currentViewingPost.id === payload.new.id) {
                      const articleCount = document.getElementById('article-like-count');
                      if (articleCount) articleCount.textContent = payload.new.likes;
                  }
              }
          }
      })
      .subscribe();
}
