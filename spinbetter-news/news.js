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
        if (e.target.closest('.news-icon-btn') || e.target.closest('.news-card-cta-btn') || e.target.closest('.news-read-more')) return;
        openArticle(post);
    };

    // Category label + class
    let catName = 'أخبار', catClass = 'cat-news';
    if (post.category === 'prediction') { catName = 'توقعات'; catClass = 'cat-prediction'; }
    if (post.category === 'analysis')   { catName = 'تحليل';  catClass = 'cat-analysis'; }

    // Cover image inside the code-editor-style box
    const imgBoxInner = post.cover_image_url
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
        <div class="news-card-body">
            <h3 class="news-card-title">${post.title || ''}</h3>
            <p class="news-card-excerpt">${excerptText}</p>
            <div class="news-cat-tags-row">
                <span class="news-cat-tag ${catClass}">${catName}</span>
            </div>
            <div class="news-card-img-box">${imgBoxInner}</div>
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
                <button class="news-icon-btn" onclick="sharePost('${post.id}', event)" aria-label="مشاركة">
                    <svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
                </button>
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

function sharePost(id, event) {
    if(event) event.stopPropagation();
    
    const shareUrl = window.location.origin + window.location.pathname + '#post-' + id;
    
    if (navigator.share) {
        navigator.share({
            title: 'مقال من SpinBetter',
            url: shareUrl
        }).catch((err) => {
            console.log("Share failed", err);
            // Fallback
            navigator.clipboard.writeText(shareUrl);
            showToast('تم نسخ الرابط ✓', 'success');
        });
    } else {
        navigator.clipboard.writeText(shareUrl);
        showToast('تم نسخ الرابط ✓', 'success');
    }
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

    // Title — use textContent (no SVG needed)
    document.getElementById('article-title').textContent = post.title || '';

    // Date — must use innerHTML because formatTimeAgo returns SVG HTML
    document.getElementById('article-date').innerHTML = formatTimeAgo(post.created_at);

    // Body content
    document.getElementById('article-body').innerHTML = post.content || '';

    // Likes count
    document.getElementById('article-like-count').textContent = post.likes || 0;

    // Like button state
    const likeBtn = document.getElementById('article-like-btn');
    if (isLiked) likeBtn.classList.add('liked');
    else likeBtn.classList.remove('liked');

    // Category badge
    const catBadge = document.getElementById('article-cat');
    catBadge.className = 'cat-badge';
    if (post.category === 'news') { catBadge.textContent = 'أخبار'; catBadge.classList.add('cat-news'); }
    else if (post.category === 'prediction') { catBadge.textContent = 'توقعات'; catBadge.classList.add('cat-prediction'); }
    else { catBadge.textContent = 'تحليل'; catBadge.classList.add('cat-analysis'); }

    // Cover image
    const imgEl = document.getElementById('article-img');
    if (post.cover_image_url) {
        imgEl.src = post.cover_image_url;
        imgEl.style.display = 'block';
    } else {
        imgEl.src = '';
        imgEl.style.display = 'none';
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

    // Wire up the share button in the article drawer
    const shareBtn = document.getElementById('article-share-btn');
    if (shareBtn) {
        shareBtn.onclick = (e) => sharePost(post.id, e);
    }

    // Open drawer: show then animate
    const drawer = document.getElementById('article-view');
    drawer.style.display = 'block';
    drawer.scrollTop = 0;

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
    drawer.style.transform = 'translateX(100%)';
    drawer.classList.remove('active');
    document.body.style.overflow = '';
    
    // Remove hash from URL when closing
    window.history.pushState(null, null, window.location.pathname);
    
    // Wait for transition before hiding
    setTimeout(() => {
        drawer.style.display = 'none';
    }, 300);
    
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
