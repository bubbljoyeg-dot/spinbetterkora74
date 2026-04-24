/*
===================================================================
SQL COMMANDS FOR SUPABASE (Run these in the SQL Editor)
===================================================================
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT CHECK (category IN ('news', 'prediction', 'analysis', 'ai', 'business', 'phones', 'reviews', 'gaming', 'casino')) NOT NULL,
  cover_image_url TEXT,
  cta_text TEXT,
  cta_url TEXT,
  outcome_text TEXT,
  outcome_color TEXT,
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published BOOLEAN DEFAULT TRUE
);

CREATE TABLE post_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_fingerprint TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_fingerprint)
);

-- Featured Spotlight Table
CREATE TABLE featured_spotlight (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT,
  link_url TEXT,
  link_text TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Community Reviews Table
CREATE TABLE community_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reviewer_name TEXT NOT NULL,
  reviewer_avatar TEXT,
  rating INTEGER DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT NOT NULL,
  verified BOOLEAN DEFAULT TRUE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- STORAGE SETUP (Run this separately if needed)
-- ==========================================
-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Allow public read access to the bucket
CREATE POLICY "Public Read Access for Post Images" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'post-images');

-- 3. Allow anonymous uploads (if you want admin to upload without logging in via Supabase Auth)
CREATE POLICY "Allow Anonymous Uploads for Post Images" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'post-images');

-- RLS for featured_spotlight (public read, authenticated write)
ALTER TABLE featured_spotlight ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read active spotlights" ON featured_spotlight FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage spotlights" ON featured_spotlight FOR ALL USING (auth.role() = 'authenticated');

-- RLS for community_reviews (public read, authenticated write)
ALTER TABLE community_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read active reviews" ON community_reviews FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage reviews" ON community_reviews FOR ALL USING (auth.role() = 'authenticated');

-- ==========================================
-- ⚡ PERFORMANCE INDEXES (CRITICAL — Run in Supabase SQL Editor!)
-- ==========================================
-- These indexes FIX the "canceling statement due to statement timeout" error 57014.
-- Without them, every query does a FULL TABLE SCAN even with LIMIT.
-- Run ONCE in Supabase Dashboard > SQL Editor:
--
-- CREATE INDEX IF NOT EXISTS idx_posts_published_created
--     ON posts (published, created_at DESC) WHERE published = true;
--
-- CREATE INDEX IF NOT EXISTS idx_posts_created_at
--     ON posts (created_at DESC);
--
-- CREATE INDEX IF NOT EXISTS idx_post_likes_fingerprint
--     ON post_likes (user_fingerprint);
--
-- After running: queries go from timeout → milliseconds.
===================================================================
*/

// Supabase Configuration
const SUPABASE_URL = 'https://whwilmaizmfqgcgowrwf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indod2lsbWFpem1mcWdjZ293cndmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDQyNDcsImV4cCI6MjA5MDQ4MDI0N30.plNnsahhJPXPo6uNOrW2GwRSwAPVcDp2PEcSlb7Wgs0';

let supabaseClient;
try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
    console.error("Supabase failed to load:", e);
    setTimeout(() => showToast("Warning: Database library failed to load! Check AdBlocker.", 'warning'), 1000);
}

// Toast Notification System
window.showToast = function (message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'error' ? '❌' : (type === 'warning' ? '⚠️' : '✅');
    toast.innerHTML = `<span style="font-size:18px">${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fadeOut');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
};

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logoutBtn');
const refreshBtn = document.getElementById('refreshBtn');
const ticketsTbody = document.getElementById('tickets-tbody');
const modal = document.getElementById('ticket-modal');

let currentAdminSession = null;
let currentViewingTicket = null;

// Auth Check on load
async function checkAuth() {
    if (!supabaseClient) return;
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            currentAdminSession = session;
            showDashboard();
        } else {
            showLogin();
        }
    } catch (err) {
        showLogin();
    }
}

// Login execution
window.handleLogin = async function () {
    try {
        const email = document.getElementById('admin-email').value;
        const password = document.getElementById('admin-password').value;
        const loginError = document.getElementById('login-error');
        const loginBtn = document.getElementById('loginBtn');
        const spinner = document.getElementById('loginSpinner');

        loginError.style.display = 'none';

        if (!email || !password) {
            loginError.innerText = 'Please enter both your email and password.';
            loginError.style.display = 'block';
            return;
        }

        if (!supabaseClient) {
            loginError.innerText = 'Network error or AdBlocker preventing execution. Please disable and refresh.';
            loginError.style.display = 'block';
            return;
        }

        loginBtn.disabled = true;
        spinner.style.display = 'block';

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email, password
            });
            if (error) throw error;

            if (!data.session) {
                showToast("Logged in but no active session found. Confirm email.", 'warning');
            }

            currentAdminSession = data.session || { user: data.user || { email: email } };
            showDashboard();
        } catch (err) {
            console.error("Login Error:", err);
            loginError.innerText = (err.message === 'Invalid login credentials')
                ? 'Error: Account not found or incorrect credentials.'
                : 'Error: ' + err.message;
            loginError.style.display = 'block';
        } finally {
            if (document.getElementById('loginBtn')) document.getElementById('loginBtn').disabled = false;
            if (document.getElementById('loginSpinner')) document.getElementById('loginSpinner').style.display = 'none';
        }
    } catch (criticalErr) {
        showToast("Unexpected processing error: " + criticalErr.message, 'error');
    }
};

// Logout
if (logoutBtn) logoutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    currentAdminSession = null;
    showLogin();
});

// Navigation
function showLogin() {
    loginScreen.classList.add('active');
    dashboardScreen.classList.remove('active');
}

function showDashboard() {
    try {
        loginScreen.classList.remove('active');
        dashboardScreen.classList.add('active');

        let userEmail = 'Admin';
        if (currentAdminSession && currentAdminSession.user && currentAdminSession.user.email) {
            userEmail = currentAdminSession.user.email;
        } else if (document.getElementById('admin-email') && document.getElementById('admin-email').value) {
            userEmail = document.getElementById('admin-email').value;
        }

        document.getElementById('admin-user-info').innerText = userEmail;
        loadTickets();
        if (typeof showSection === "function") showSection("dashboard");
    } catch (e) {
        showToast("Error loading dashboard: " + e.message, 'error');
    }
}

// Load Tickets Logic
if (refreshBtn) refreshBtn.addEventListener('click', loadTickets);

async function loadTickets() {
    ticketsTbody.innerHTML = `<tr><td colspan="6" class="text-center">🔄 Loading data...</td></tr>`;
    try {
        const { data: tickets, error } = await supabaseClient
            .from('support_tickets')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(300); // ✅ FIX: Added limit to prevent timeout on large datasets


        if (error) {
            showToast('Error loading tickets: ' + error.message, 'error');
            throw error;
        }

        // Update Stats
        document.getElementById('total-count').innerText = tickets.length;
        document.getElementById('pending-count').innerText = tickets.filter(t => t.status === 'قيد الانتظار').length;
        document.getElementById('resolved-count').innerText = tickets.filter(t => t.status === 'تم الرد').length;

        // Render Table
        ticketsTbody.innerHTML = '';
        if (tickets.length === 0) {
            ticketsTbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color:var(--text-muted)">No tickets found!</td></tr>`;
            return;
        }

        tickets.forEach(ticket => {
            const tr = document.createElement('tr');

            // Format Date
            const d = new Date(ticket.created_at);
            const formattedDate = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;

            // Status Badge Formatting
            let badgeClass = 'badge';
            if (ticket.status === 'قيد الانتظار') badgeClass += ' badge-pending';
            else badgeClass += ' badge-replied';

            tr.innerHTML = `
                <td data-label="Tracking ID"><strong style="color:var(--accent);">${ticket.tracking_code}</strong></td>
                <td data-label="Date" style="color:var(--text-muted);">${formattedDate}</td>
                <td data-label="Customer Name">${ticket.customer_name}</td>
                <td data-label="Issue Category">${ticket.issue_type}</td>
                <td data-label="Status"><span class="${badgeClass}">${ticket.status}</span></td>
                <td data-label="Actions">
                    <button class="btn btn-secondary btn-sm review-btn">Review</button>
                </td>
            `;

            tr.querySelector('.review-btn').addEventListener('click', () => openModal(ticket));
            ticketsTbody.appendChild(tr);
        });

    } catch (err) {
        console.error(err);
        ticketsTbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color:var(--danger)">Failed to fetch tickets!</td></tr>`;
    }
}

// Modal Logic
function openModal(ticket) {
    currentViewingTicket = ticket;
    document.getElementById('ticket-modal').classList.add('active');

    document.getElementById('model-code').innerText = ticket.tracking_code;
    document.getElementById('model-name').innerText = ticket.customer_name;
    document.getElementById('model-issue-type').innerText = ticket.issue_type;
    document.getElementById('model-issue-desc').innerText = ticket.issue_description || 'No detailed description provided by the customer.';
    document.getElementById('model-status').innerText = ticket.status;

    // Image handling
    const imgContainer = document.getElementById('model-image');
    if (ticket.image_url) {
        imgContainer.innerHTML = `<img src="${ticket.image_url}" alt="Customer Attachment">`;
        imgContainer.style.display = 'block';
    } else {
        imgContainer.innerHTML = '<div class="no-image">No attachment provided.</div>';
        imgContainer.style.display = 'block';
    }

    // Clear Admin Image Upload
    const fileInput = document.getElementById('admin-image-upload');
    const fileNameDisplay = document.getElementById('admin-upload-filename');
    if (fileInput) fileInput.value = '';
    if (fileNameDisplay) fileNameDisplay.innerText = '';

    // Setup Admin Inputs
    document.getElementById('modal-status-select').value = ticket.status;
    document.getElementById('modal-admin-reply').value = ticket.admin_reply || '';
}

// Listen to admin image selection
const adminImageInput = document.getElementById('admin-image-upload');
if (adminImageInput) {
    adminImageInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            document.getElementById('admin-upload-filename').innerText = "Selected: " + e.target.files[0].name;
        }
    });
}

// Close Modal
const closeModalBtn = document.getElementById('closeModalBtn');
const closeModalBtnFooter = document.getElementById('closeModalBtnFooter');
if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
if (closeModalBtnFooter) closeModalBtnFooter.addEventListener('click', closeModal);

function closeModal() {
    document.getElementById('ticket-modal').classList.remove('active');
    currentViewingTicket = null;
}

// Update Ticket (Reply / Save)
const saveReplyBtnEl = document.getElementById('saveReplyBtn');
if (saveReplyBtnEl) saveReplyBtnEl.addEventListener('click', async () => {
    if (!currentViewingTicket) return;
    const btn = document.getElementById('saveReplyBtn');
    const spinner = document.getElementById('saveSpinner');

    btn.disabled = true;
    spinner.style.display = 'inline-block';

    const newStatus = document.getElementById('modal-status-select').value;
    const newReply = document.getElementById('modal-admin-reply').value;
    const adminUploadFile = document.getElementById('admin-image-upload').files[0];

    try {
        let adminImgUrl = currentViewingTicket.admin_image_url; // Keep old if exists

        // Handle admin image upload if user selected one
        if (adminUploadFile) {
            const fileExt = adminUploadFile.name.split('.').pop();
            const fileName = `admin_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `admin-replies/${fileName}`;

            const { data: uploadData, error: uploadError } = await supabaseClient
                .storage
                .from('ticket-images')
                .upload(filePath, adminUploadFile);

            if (uploadError) throw new Error("Failed to upload admin image: " + uploadError.message);

            const { data: publicUrlData } = supabaseClient.storage.from('ticket-images').getPublicUrl(filePath);
            adminImgUrl = publicUrlData.publicUrl;
        }

        const updates = {
            status: newStatus,
            admin_reply: newReply
        };
        // Add admin_image_url only if we have one or if we're saving a new one
        if (adminImgUrl !== undefined) {
            updates.admin_image_url = adminImgUrl;
        }

        const { error } = await supabaseClient
            .from('support_tickets')
            .update(updates)
            .eq('id', currentViewingTicket.id);

        if (error) throw error;

        showToast('Ticket successfully updated and resolution saved!', 'success');
        document.getElementById('ticket-modal').classList.remove('active');
        loadTickets(); // Refresh table
    } catch (err) {
        showToast('Failed to save data: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        spinner.style.display = 'none';
    }
});

// Delete Ticket Logic
const deleteBtn = document.getElementById('deleteTicketBtn');
if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
        if (!currentViewingTicket) return;

        const confirmDelete = await uiConfirm("هل أنت متأكد من حذف هذه التذكرة نهائياً؟", "حذف التذكرة");
        if (!confirmDelete) return;

        const originalText = deleteBtn.innerHTML;
        deleteBtn.innerHTML = 'Deleting...';
        deleteBtn.disabled = true;

        try {
            const { error } = await supabaseClient
                .from('support_tickets')
                .delete()
                .eq('id', currentViewingTicket.id);

            if (error) throw error;

            showToast('Ticket has been permanently deleted.', 'success');
            document.getElementById('ticket-modal').classList.remove('active');
            loadTickets();
        } catch (err) {
            showToast('Failed to delete: ' + err.message, 'error');
        } finally {
            deleteBtn.innerHTML = originalText;
            deleteBtn.disabled = false;
        }
    });
}

// Initialize
checkAuth();

// Mobile Sidebar Toggle
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const openSidebarBtn = document.getElementById('openSidebarBtn');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');

function openAdminSidebar() {
    if (sidebar) sidebar.classList.add('active');
    if (sidebarOverlay) sidebarOverlay.classList.add('active');
}

function closeAdminSidebar() {
    if (sidebar) sidebar.classList.remove('active');
    if (sidebarOverlay) sidebarOverlay.classList.remove('active');
}

if (openSidebarBtn) openSidebarBtn.addEventListener('click', openAdminSidebar);
if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeAdminSidebar);
if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeAdminSidebar);

// ==========================================
// FULL POSTS MANAGER LOGIC
// ==========================================

let quillEditor = null;
let currentEditingPostId = null;
let selectedPostImages = [];
let _embeddedShortcodes = {};

function showSection(sectionName) {
    // Nav items
    const navDashboard   = document.getElementById('nav-dashboard');
    const navPosts       = document.getElementById('nav-posts');
    const navSpotlight   = document.getElementById('nav-spotlight');
    const navPromoBanner = document.getElementById('nav-promo-banner');
    const navReviews     = document.getElementById('nav-reviews');
    const navTrending    = document.getElementById('nav-trending');
    const navRecommended = document.getElementById('nav-recommended');
    const navComments    = document.getElementById('nav-comments');
    const navDailyCoupon = document.getElementById('nav-daily-coupon');

    // Section containers
    const secDashboard   = document.getElementById('dashboard-section');
    const secPosts       = document.getElementById('posts-section');
    const secPostEditor  = document.getElementById('post-editor-section');
    const secSpotlight   = document.getElementById('spotlight-section');
    const secPromoBanner = document.getElementById('promo-banner-section');
    const secReviews     = document.getElementById('community-reviews-section');
    const secTrending    = document.getElementById('trending-section');
    const secRecommended = document.getElementById('recommended-section');
    const secComments    = document.getElementById('comments-section');
    const secDailyCoupon = document.getElementById('daily-coupon-section');

    // Hide / deactivate all
    [navDashboard, navPosts, navSpotlight, navPromoBanner, navReviews, navTrending, navRecommended, navComments, navDailyCoupon].forEach(n => n && n.classList.remove('active'));
    [secDashboard, secPosts, secPostEditor, secSpotlight, secPromoBanner, secReviews, secTrending, secRecommended, secComments, secDailyCoupon].forEach(s => s && (s.style.display = 'none'));

    if (sectionName === 'dashboard') {
        if (navDashboard) navDashboard.classList.add('active');
        if (secDashboard) secDashboard.style.display = 'block';
    } else if (sectionName === 'posts') {
        if (navPosts) navPosts.classList.add('active');
        if (secPosts) secPosts.style.display = 'block';
        loadPosts();
    } else if (sectionName === 'post-editor') {
        if (navPosts) navPosts.classList.add('active');
        if (secPostEditor) secPostEditor.style.display = 'flex';
    } else if (sectionName === 'spotlight') {
        if (navSpotlight) navSpotlight.classList.add('active');
        if (secSpotlight) secSpotlight.style.display = 'block';
        loadSpotlight();
    } else if (sectionName === 'promo-banner') {
        if (navPromoBanner) navPromoBanner.classList.add('active');
        if (secPromoBanner) secPromoBanner.style.display = 'block';
        loadPromoBannerAdmin();
    } else if (sectionName === 'community-reviews') {
        if (navReviews) navReviews.classList.add('active');
        if (secReviews) secReviews.style.display = 'block';
        loadReviews();
    } else if (sectionName === 'trending') {
        if (navTrending) navTrending.classList.add('active');
        if (secTrending) secTrending.style.display = 'block';
        loadTrending();
    } else if (sectionName === 'recommended') {
        if (navRecommended) navRecommended.classList.add('active');
        if (secRecommended) secRecommended.style.display = 'block';
        loadRecommended();
    } else if (sectionName === 'comments') {
        if (navComments) navComments.classList.add('active');
        if (secComments) secComments.style.display = 'block';
        loadAllComments('post_comments');
    } else if (sectionName === 'daily-coupon') {
        if (navDailyCoupon) navDailyCoupon.classList.add('active');
        if (secDailyCoupon) secDailyCoupon.style.display = 'block';
        loadDailyCouponAdmin();
        loadCouponComments();
    }

    if (window.innerWidth <= 768) closeAdminSidebar();
}

async function loadPosts() {
    const tbody = document.getElementById('posts-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">جاري تحميل المقالات...</td></tr>';

    try {
        // ✅ FIX: Select only columns needed for the list view.
        // Full content was being fetched for every post unnecessarily, causing timeouts.
        // When the admin clicks 'Edit', we re-fetch the full post data on demand.
        const { data: posts, error } = await supabaseClient
            .from('posts')
            .select('id, title, category, published, created_at, cover_image_url, cta_text, cta_url, outcome_text, outcome_color, likes, content')
            .order('created_at', { ascending: false })
            .limit(200);

        if (error) throw error;

        updatePostStats(posts || []);

        tbody.innerHTML = '';
        if (!posts || posts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">لا توجد مقالات منشورة بعد!</td></tr>';
            return;
        }

        posts.forEach(post => {
            const tr = document.createElement('tr');

            // Format Date
            const d = new Date(post.created_at);
            const formattedDate = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;

            // Category badge with full color map
            const catMap = {
                news:       { label: 'أخبار',            color: '#38bdf8' },
                prediction: { label: 'توقعات',          color: '#f59e0b' },
                analysis:   { label: 'قسايم اليوم',       color: '#a78bfa' },
                ai:         { label: 'ذكاء اصطناعي',    color: '#8b5cf6' },
                business:   { label: 'المال والأعمال',  color: '#f59e0b' },
                phones:     { label: 'هواتف',             color: '#22c55e' },
                reviews:    { label: 'مراجعات',           color: '#ec4899' },
                gaming:     { label: 'الألعاب',            color: '#f97316' },
                casino:     { label: 'كازينو',             color: '#e31e24' },
            };
            const cat = catMap[post.category] || { label: 'أخبار', color: '#38bdf8' };
            const catName = cat.label;
            const catColor = cat.color;

            // Format Status Badge
            const statusText = post.published ? 'منشور' : 'مسودة';
            const statusClass = post.published ? 'badge-replied' : 'badge-pending';

            tr.innerHTML = `
                <td style="text-align:center;">
                    <input type="checkbox" id="cb-post-${post.id}" class="row-cb" value="${post.id}" onchange="updateBatchDeleteBtn('posts-tbody')">
                    <label for="cb-post-${post.id}" class="select-btn-label">تحديد</label>
                </td>
                <td data-label="العنوان" style="font-weight:bold; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${post.title}</td>
                <td data-label="التصنيف"><span class="badge" style="background:${catColor}; opacity:0.9">${catName}</span></td>
                <td data-label="التاريخ">${formattedDate}</td>
                <td data-label="الحالة"><span class="badge ${statusClass}">${statusText}</span></td>
                <td data-label="الإجراءات" style="display: flex; gap: 8px;">
                    <button class="btn btn-secondary btn-sm edit-post-btn" data-post-id="${post.id}">تعديل</button>
                    <button class="btn btn-danger btn-sm delete-post-btn" data-post-id="${post.id}" style="padding: 6px 12px; height: 35px; border-radius: 4px;">حذف</button>
                </td>
            `;
            // Event listeners بدل inline onclick
            tr.querySelector('.edit-post-btn').addEventListener('click', () => openPostModal(post));
            tr.querySelector('.delete-post-btn').addEventListener('click', () => deletePost(post.id));

            tbody.appendChild(tr);
        });

    } catch (err) {
        showToast('فشل في جلب المقالات: ' + err.message, 'error');
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--danger); padding: 30px;">خطأ في تحميل البيانات</td></tr>';
    }
}

function updatePostStats(posts) {
    document.getElementById('total-posts-count').innerText = posts.length;
    document.getElementById('published-posts-count').innerText = posts.filter(p => p.published).length;
    document.getElementById('draft-posts-count').innerText = posts.filter(p => !p.published).length;
}

function initQuill() {
    if (quillEditor) return; // already initialized

    // ── Register BlotFormatter (image resizing) ──────────────────────────
    if (window.QuillBlotFormatter) {
        try { Quill.register('modules/blotFormatter', window.QuillBlotFormatter.default); } catch(e) {}
    }

    // ── Register Table UI module ─────────────────────────────────────────
    if (window.QuillTableUI) {
        try { Quill.register({ 'modules/tableUI': window.QuillTableUI.default }, true); } catch(e) {}
    }

    // ── Build the editor ─────────────────────────────────────────────────
    quillEditor = new Quill('#quill-editor', {
        theme: 'snow',
        modules: {
            blotFormatter: window.QuillBlotFormatter ? {} : undefined,
            tableUI: window.QuillTableUI ? { backgroundColors: ['#1a1f2e','#0d1117','#111827'] } : undefined,
            toolbar: {
                container: [
                    [{ 'header': [1, 2, 3, 4, false] }],
                    [{ 'size': ['small', false, 'large', 'huge'] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'color': [] }, { 'background': [] }],
                    [{ 'script': 'sub' }, { 'script': 'super' }],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'list': 'check' }],
                    [{ 'indent': '-1' }, { 'indent': '+1' }],
                    [{ 'align': [] }],
                    [{ 'direction': 'rtl' }],
                    ['blockquote', 'code-block'],
                    ['link', 'image', 'video'],
                    ['clean']
                ],
                handlers: {
                    image: _quillImageHandler
                }
            },
            history: { delay: 1000, maxStack: 100, userOnly: true },
            clipboard: { matchVisual: false }
        }
    });

    quillEditor.format('direction', 'rtl');
    quillEditor.format('align', 'right');

    // ── Move toolbar INSIDE the sticky wrapper ───────────────────────────
    const stickyWrap = document.getElementById('quill-sticky-wrap');
    const toolbar = document.querySelector('.ql-toolbar');
    if (stickyWrap && toolbar) {
        stickyWrap.insertBefore(toolbar, stickyWrap.firstChild);
    }

    // ── Live word/char counter ──────────────────────────────────────────
    _initWordCounter();

    showToast('المحرر المتقدم جاهز ✅', 'success');
}

async function _quillImageHandler() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.click();
    input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        showToast('جاري رفع الصورة للسيرفر...', 'warning');
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `inline_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `inline-images/${fileName}`;
            const { error } = await supabaseClient.storage.from('post-images').upload(filePath, file);
            if (error) throw error;
            const { data: pub } = supabaseClient.storage.from('post-images').getPublicUrl(filePath);
            const range = quillEditor.getSelection(true);
            quillEditor.insertEmbed(range.index, 'image', pub.publicUrl);
            showToast('تم رفع الصورة بنجاح! ✅', 'success');
        } catch (err) {
            showToast('فشل في رفع الصورة: ' + err.message, 'error');
        }
    };
}

function _initWordCounter() {
    const editorEl = document.querySelector('#quill-editor .ql-editor');
    if (!editorEl) return;

    let counter = document.getElementById('ql-word-counter');
    if (!counter) {
        counter = document.createElement('div');
        counter.id = 'ql-word-counter';
        counter.style.cssText = 'text-align:left;font-size:11px;color:#475569;padding:4px 10px;background:#080f1d;border-top:1px solid rgba(255,255,255,0.05);border-radius:0 0 8px 8px;font-family:"Tajawal",sans-serif;';
        const container = document.querySelector('.quill-dark-theme');
        if (container) container.insertAdjacentElement('afterend', counter);
    }

    const update = () => {
        const text = quillEditor.getText().trim();
        const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
        counter.textContent = `الكلمات: ${words} | الحروف: ${text.length}`;
    };
    quillEditor.on('text-change', update);
    update();
}

// ── Custom block insertion helpers (called from HTML toolbar) ────────────

window.insertQuillTable = function() {
    if (!quillEditor) return;
    const rows    = parseInt(prompt('عدد الصفوف:', '3')) || 3;
    const cols    = parseInt(prompt('عدد الأعمدة:', '3')) || 3;

    // Try official table API first (quill-table-ui)
    if (quillEditor.getModule && quillEditor.getModule('tableUI')) {
        try {
            quillEditor.getModule('tableUI').insertTable(rows, cols);
            return;
        } catch(e) { /* fallthrough */ }
    }

    // Fallback: insert raw HTML table
    const range = quillEditor.getSelection(true) || { index: quillEditor.getLength() };
    let html = '<table border="1"><thead><tr>';
    for (let c = 0; c < cols; c++) html += `<th>عنوان ${c + 1}</th>`;
    html += '</tr></thead><tbody>';
    for (let r = 0; r < rows - 1; r++) {
        html += '<tr>';
        for (let c = 0; c < cols; c++) html += `<td>خلية ${r+1}-${c+1}</td>`;
        html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';
    quillEditor.clipboard.dangerouslyPasteHTML(range.index, html);
    showToast('تم إدراج الجدول ✅', 'success');
};

window.insertFaqBlock = function() {
    if (!quillEditor) return;
    const count = parseInt(prompt('عدد الأسئلة في الـ FAQ:', '3')) || 3;
    const range = quillEditor.getSelection(true) || { index: quillEditor.getLength() };

    let items = '';
    for (let i = 1; i <= count; i++) {
        items += `
        <div class="kora-faq-item">
            <div class="kora-faq-q">❓ السؤال رقم ${i}: اكتب سؤالك هنا</div>
            <div class="kora-faq-a">اكتب الإجابة التفصيلية هنا...</div>
        </div>`;
    }

    const html = `<div class="kora-faq-block">${items}</div><p><br></p>`;
    quillEditor.clipboard.dangerouslyPasteHTML(range.index, html);
    showToast(`تم إدراج ${count} أسئلة FAQ ✅`, 'success');
};

window.insertColorBox = function(type) {
    if (!quillEditor) return;
    const range = quillEditor.getSelection(true) || { index: quillEditor.getLength() };

    const configs = {
        info:   { cls: 'kora-info-box',   label: 'ℹ️ معلومة مهمة',  placeholder: 'اكتب المعلومة هنا...' },
        tip:    { cls: 'kora-tip-box',    label: '💡 نصيحة',         placeholder: 'اكتب النصيحة هنا...' },
        warn:   { cls: 'kora-warn-box',   label: '⚠️ تحذير',          placeholder: 'اكتب التحذير هنا...' },
        danger: { cls: 'kora-danger-box', label: '🚨 تنبيه خطر',     placeholder: 'اكتب التنبيه هنا...' },
    };
    const cfg = configs[type] || configs.info;
    const html = `<div class="${cfg.cls}"><div class="kora-box-label">${cfg.label}</div>${cfg.placeholder}</div><p><br></p>`;
    quillEditor.clipboard.dangerouslyPasteHTML(range.index, html);
    showToast('تم إدراج المربع ✅', 'success');
};

window.insertDivider = function() {
    if (!quillEditor) return;
    const range = quillEditor.getSelection(true) || { index: quillEditor.getLength() };
    quillEditor.clipboard.dangerouslyPasteHTML(range.index, '<hr/><p><br></p>');
};

function openPostModal(post = null) {
    _embeddedShortcodes = {};
    showSection('post-editor');
    initQuill();

    const titleInput = document.getElementById('post-title');
    const categorySelect = document.getElementById('post-category');
    const imgUpload = document.getElementById('post-image-upload');
    const imgFilename = document.getElementById('post-upload-filename');
    const imgCurrent = document.getElementById('post-current-image');
    const publishedCheck = document.getElementById('post-published');
    const deleteBtn = document.getElementById('deletePostBtn');
    const titleEle = document.getElementById('post-modal-title');
    const ctaTextInput = document.getElementById('post-cta-text');
    const ctaUrlInput = document.getElementById('post-cta-url');
    const outcomeTextInput = document.getElementById('post-outcome-text');

    // Clear/Reset fields
    selectedPostImages = [];
    imgUpload.value = '';
    imgFilename.innerText = '';
    imgCurrent.innerHTML = '';
    if (outcomeTextInput) outcomeTextInput.value = '';
    const noneRadio = document.getElementById('outcome-none');
    if (noneRadio) noneRadio.checked = true;

    if (post) {
        currentEditingPostId = post.id;
        titleEle.innerHTML = '<svg viewBox="0 0 24 24" style="width:24px;fill:var(--accent);"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg> تعديل المقال';
        titleInput.value = post.title;
        categorySelect.value = post.category;
        quillEditor.root.innerHTML = post.content;
        publishedCheck.checked = post.published;
        ctaTextInput.value = post.cta_text || '';
        ctaUrlInput.value = post.cta_url || '';
        // Load outcome
        if (outcomeTextInput) outcomeTextInput.value = post.outcome_text || '';
        const colorVal = post.outcome_color || '';
        const radioToCheck = document.querySelector(`input[name="outcome-color"][value="${colorVal}"]`);
        if (radioToCheck) radioToCheck.checked = true;
        else if (noneRadio) noneRadio.checked = true;

        if (post.cover_image_url) {
            const items = post.cover_image_url.split(',');
            imgCurrent.innerHTML = items.map(item => {
                const parts = item.split('|');
                const pUrl = parts[0];
                const pCap = parts[1] || '';
                return `<div style="display:inline-block; text-align:center; margin-left:10px;"><img src="${pUrl}" style="width: 100px; height: 80px; object-fit:cover; border-radius: 6px; border: 1px solid #333;" alt="Cover"><div style="font-size:10px; color:#aaa; margin-top:4px; max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${pCap}</div></div>`;
            }).join('');
        }
        deleteBtn.style.display = 'inline-block';
        deleteBtn.onclick = () => { deletePost(post.id); closePostModal(); };
    } else {
        currentEditingPostId = null;
        titleEle.innerHTML = '<svg viewBox="0 0 24 24" style="width:24px;fill:var(--accent);"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg> نشر مقال جديد';
        titleInput.value = '';
        categorySelect.value = 'news';
        quillEditor.root.innerHTML = '';
        publishedCheck.checked = true;
        ctaTextInput.value = '';
        ctaUrlInput.value = '';
        deleteBtn.style.display = 'none';
        deleteBtn.onclick = null;
    }

    // Set today as default date for match picker
    const datePicker = document.getElementById('match-date-picker');
    if (datePicker && !datePicker.value) {
        datePicker.value = new Date().toISOString().split('T')[0];
    }
    // Reset matches list
    const matchesList = document.getElementById('matches-list-container');
    if (matchesList) { matchesList.style.display = 'none'; matchesList.innerHTML = ''; }
}

function closePostModal() {
    showSection('posts');
    currentEditingPostId = null;
}

// closePostModalBtn was removed as part of the modal destruction.
const postImageInput = document.getElementById('post-image-upload');
if (postImageInput) {
    postImageInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            selectedPostImages.push(...Array.from(e.target.files));
            updateSelectedImagesUI();
            e.target.value = ''; // Reset input to allow picking the same file again
        }
    });
}

function updateSelectedImagesUI() {
    const container = document.getElementById('post-current-image');
    const nameLabel = document.getElementById('post-upload-filename');
    
    if (selectedPostImages.length === 0) {
        nameLabel.innerText = "لا توجد صور جديدة مختارة";
        container.innerHTML = '';
        return;
    }
    
    nameLabel.innerText = `تم اختيار ${selectedPostImages.length} صور جديدة (سيتم استبدال الصور القديمة بها)`;
    
    let html = '<div style="display:flex; flex-direction:column; gap:10px; margin-top:10px;">';
    selectedPostImages.forEach((f, idx) => {
        const tempUrl = URL.createObjectURL(f);
        html += `
            <div style="position:relative; display:flex; gap:15px; background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; align-items:center;">
                <div style="position:relative; flex-shrink:0;">
                    <img src="${tempUrl}" style="width:80px;height:60px;object-fit:cover;border-radius:6px;border:1px solid #444;" />
                    <button type="button" onclick="removeSelectedImage(${idx})" style="position:absolute;top:-5px;right:-5px;background:red;color:white;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:12px;line-height:1;display:flex;align-items:center;justify-content:center;">×</button>
                </div>
                <input type="text" id="caption-input-${idx}" placeholder="أضف تعليق (Caption) لهذه الصورة... (اختياري لكن مفيد للـ SEO)" style="flex:1; padding:10px; border-radius:6px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:white; font-family:'Tajawal', sans-serif;">
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

window.removeSelectedImage = function(idx) {
    selectedPostImages.splice(idx, 1);
    updateSelectedImagesUI();
};

async function savePost() {
    const title = document.getElementById('post-title').value.trim();
    const category = document.getElementById('post-category').value;
    let content = quillEditor.root.innerHTML;
    Object.keys(_embeddedShortcodes).forEach(uid => {
        const scText = _embeddedShortcodes[uid];
        content = content.replace(
            new RegExp(`(<blockquote[^>]*data-sc="${uid}"[^>]*>)(.*?)(</blockquote>)`, 's'),
            `$1$2<span style="display:none;">${scText}</span>$3`
        );
    });
    const published = document.getElementById('post-published').checked;
    const imageFiles = selectedPostImages;
    const ctaText = document.getElementById('post-cta-text').value.trim();
    const ctaUrl = document.getElementById('post-cta-url').value.trim();
    const outcomeTextEl = document.getElementById('post-outcome-text');
    const outcomeText = outcomeTextEl ? outcomeTextEl.value.trim() : '';
    const outcomeColorEl = document.querySelector('input[name="outcome-color"]:checked');
    const outcomeColor = outcomeColorEl ? outcomeColorEl.value : '';

    if (!title || quillEditor.getText().trim() === '') {
        showToast('يرجى ملء العنوان والمحتوى!', 'warning');
        return;
    }

    const btn = document.getElementById('savePostBtn');
    const spinner = document.getElementById('savePostSpinner');
    btn.disabled = true;
    spinner.style.display = 'inline-block';

    try {
        let coverImageUrl = undefined;

        // Handle new image upload
        if (imageFiles && imageFiles.length > 0) {
            let uploadedUrls = [];
            
            for (let i = 0; i < imageFiles.length; i++) {
                const imageFile = imageFiles[i];
                const captionEl = document.getElementById(`caption-input-${i}`);
                const captionText = captionEl ? captionEl.value.trim() : '';

                const fileExt = imageFile.name.split('.').pop();
                let baseTextForSlug = captionText !== '' ? captionText : title;
                let slug = baseTextForSlug;
                
                try {
                    // Call public translate API to convert Arabic title/caption to English for SEO filename
                    const translateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=en&dt=t&q=${encodeURIComponent(baseTextForSlug)}`;
                    const res = await fetch(translateUrl);
                    if (res.ok) {
                        const json = await res.json();
                        if (json && json[0] && json[0][0] && json[0][0][0]) {
                            slug = json[0][0][0];
                        }
                    }
                } catch (e) {
                    console.warn("Translation failed, using original title", e);
                }

                // Slugify: lowercase, replace non-alphanumeric with dashes, trim
                slug = slug.toLowerCase().trim()
                    .replace(/['"]/g, '') // remove quotes completely
                    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-') // replace spaces/symbols with dashes
                    .replace(/(^-|-$)/g, ''); // trim dashes from start and end
                    
                if (!slug) slug = 'post';

                // Example output: liverpool-match-goals-today.jpg (or liverpool-match-goals-today-x8vf.jpg for uniqueness)
                const fileName = `${slug}-${Math.random().toString(36).substring(7)}.${fileExt}`;
                const filePath = `covers/${fileName}`;

                // --- WATERMARK SCRIPT ---
                let fileToUpload = imageFile;
                try {
                    fileToUpload = await new Promise((resolve) => {
                        const img = new Image();
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            canvas.width = img.width;
                            canvas.height = img.height;
                            const ctx = canvas.getContext('2d');
                            
                            // Draw Original Image
                            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                            
                            // Set Watermark Styles
                            ctx.globalAlpha = 0.8;
                            ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
                            ctx.shadowBlur = Math.max(4, canvas.width * 0.005);
                            ctx.shadowOffsetX = 2;
                            ctx.shadowOffsetY = 2;
                            
                            // Responsive Font Size (about 4% of image height, min 16px)
                            const fontSize = Math.max(16, Math.floor(canvas.height * 0.04));
                            ctx.font = `bold ${fontSize}px Arial`;
                            ctx.textBaseline = 'bottom';
                            
                            // Starting positions (Bottom-Left)
                            let textX = Math.max(10, canvas.width * 0.02);
                            const textY = canvas.height - Math.max(10, canvas.height * 0.02);
                            const space = fontSize * 0.25; // gap between words
                            
                            // Draw "KORA" (White)
                            ctx.fillStyle = '#ffffff';
                            ctx.fillText('KORA', textX, textY);
                            textX += ctx.measureText('KORA').width + space;
                            
                            // Draw "74" (Red)
                            ctx.fillStyle = '#ff1a1a';
                            ctx.fillText('74', textX, textY);
                            textX += ctx.measureText('74').width + space;
                            
                            // Draw " - كوره 74 الاخباريه" (White)
                            ctx.fillStyle = '#ffffff';
                            ctx.fillText(' - كوره 74 الاخباريه', textX, textY);
                            
                            // Export back to Blob object
                            canvas.toBlob((blob) => {
                                if (blob) {
                                    try {
                                        // Try constructing a File (required by some Supabase versions)
                                        const watermarkedFile = new File([blob], fileName, { type: imageFile.type || 'image/jpeg' });
                                        resolve(watermarkedFile);
                                    } catch (fileErr) {
                                        // Fallback to pure blob if browser doesn't support File constructor
                                        resolve(blob);
                                    }
                                } else {
                                    resolve(imageFile); // Fallback
                                }
                            }, imageFile.type || 'image/jpeg', 0.92);
                        };
                        img.onerror = () => resolve(imageFile); // Fallback on error
                        img.src = URL.createObjectURL(imageFile);
                    });
                } catch (err) {
                    console.warn("Watermark failed, uploading original.", err);
                    fileToUpload = imageFile;
                }
                // --- END WATERMARK SCRIPT ---

                const { data: uploadData, error: uploadError } = await supabaseClient
                    .storage
                    .from('post-images')
                    .upload(filePath, fileToUpload, {
                        contentType: imageFile.type || 'image/jpeg',
                        upsert: false
                    });

                if (uploadError) throw new Error("فشل رفع الصورة: " + uploadError.message);

                const { data: publicUrlData } = supabaseClient.storage.from('post-images').getPublicUrl(filePath);
                const finalUrlStr = captionText ? `${publicUrlData.publicUrl}|${captionText}` : publicUrlData.publicUrl;
                uploadedUrls.push(finalUrlStr);
            }
            showToast('تم معالجة ورفع ' + imageFiles.length + ' صور بنجاح ✅', 'success');
            coverImageUrl = uploadedUrls.join(',');
        }

        const postData = {
            title,
            category,
            content,
            published,
            cta_text: ctaText || null,
            cta_url: ctaUrl || null,
            outcome_text: outcomeText || null,
            outcome_color: outcomeColor || null
        };

        if (coverImageUrl) postData.cover_image_url = coverImageUrl;

        if (currentEditingPostId) {
            // UPDATE
            const { error } = await supabaseClient.from('posts').update(postData).eq('id', currentEditingPostId);
            if (error) throw error;
            showToast('تم تحديث المقال بنجاح', 'success');
        } else {
            // INSERT
            const { error } = await supabaseClient.from('posts').insert([postData]);
            if (error) throw error;
            showToast('تم نشر المقال بنجاح', 'success');
        }

        closePostModal();
        loadPosts();

    } catch (err) {
        showToast('فشل في الحفظ: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        spinner.style.display = 'none';
    }
}

async function deletePost(id) {
    if (!id) {
        showToast('خطأ: معرف المقال غير موجود!', 'error');
        return;
    }
    const confirmDelete = await uiConfirm("هل أنت متأكد من حذف هذا المقال نهائياً؟", "حذف المقال");
    if (!confirmDelete) return;

    try {
        console.log('Attempting to delete post with id:', id);
        const { data, error } = await supabaseClient.from('posts').delete().eq('id', id).select();
        console.log('Delete result:', { data, error });
        if (error) throw error;
        if (!data || data.length === 0) {
            showToast('تحذير: لم يتم حذف أي مقال. تحقق من صلاحيات Supabase RLS.', 'warning');
            return;
        }
        showToast('تم حذف المقال بنجاح ✅', 'success');
        loadPosts();
    } catch (err) {
        console.error('Delete error:', err);
        showToast('حدث خطأ أثناء الحذف: ' + err.message, 'error');
    }
}


// ============================================================
//  MATCH API INTEGRATION
// ============================================================

const FOOTBALL_API_KEY = '2760bea07fc1d80862f9e15bb7e0fa9f';
const FOOTBALL_API_URL = 'https://v3.football.api-sports.io/fixtures';

let _cachedMatches = [];  // all matches for the day
let _allFetchedMatches = []; // master list for client-side filter

/**
 * Fetches fixtures from api-sports.io for the selected date.
 * Runs ONCE from admin → the result is embedded as static HTML,
 * so visitors never consume any API limits.
 */
async function fetchMatchesFromApi() {
    const dateInput = document.getElementById('match-date-picker');
    const searchInput = document.getElementById('match-team-search');
    const btn = document.getElementById('btn-fetch-matches');
    const container = document.getElementById('matches-list-container');

    const date = dateInput?.value;
    if (!date) { showToast('اختر تاريخاً أولاً', 'warning'); return; }

    btn.disabled = true;
    btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:15px;fill:currentColor;animation:spin 1s linear infinite"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 14.03 20 13.07 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg> جاري الجلب...`;
    container.style.display = 'flex';
    container.innerHTML = `<div class="matches-loading"><svg viewBox="0 0 24 24" style="width:32px;fill:#06b6d4;display:block;margin:0 auto 10px"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 14.03 20 13.07 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg> جاري جلب المباريات من API...</div>`;

    try {
        const url = `${FOOTBALL_API_URL}?date=${date}&timezone=Africa/Cairo`;
        const resp = await fetch(url, {
            method: 'GET',
            headers: { 'x-apisports-key': FOOTBALL_API_KEY }
        });

        if (!resp.ok) throw new Error('فشل الاتصال بالـ API (كود: ' + resp.status + ')');

        const json = await resp.json();
        
        let matches = json.response || [];
        matches.sort((a,b) => new Date(a.fixture.date) - new Date(b.fixture.date));
        _allFetchedMatches = matches;

        if (!_allFetchedMatches.length) {
            container.innerHTML = `<div class="matches-empty">⚽ لا توجد مباريات في هذا اليوم — جرب تاريخاً آخر</div>`;
            return;
        }

        const q = (searchInput?.value || '').trim().toLowerCase();
        const filtered = q
            ? _allFetchedMatches.filter(f =>
                f.teams.home.name.toLowerCase().includes(q) ||
                f.teams.away.name.toLowerCase().includes(q) ||
                f.league.name.toLowerCase().includes(q)
              )
            : _allFetchedMatches;

        renderMatchesList(filtered);

        if (searchInput) {
            searchInput.oninput = () => {
                const q2 = searchInput.value.trim().toLowerCase();
                const f2 = q2
                    ? _allFetchedMatches.filter(f =>
                        f.teams.home.name.toLowerCase().includes(q2) ||
                        f.teams.away.name.toLowerCase().includes(q2) ||
                        f.league.name.toLowerCase().includes(q2)
                      )
                    : _allFetchedMatches;
                renderMatchesList(f2);
            };
        }

    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="matches-empty">❌ ${err.message}</div>`;
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:15px;fill:currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg> جلب المباريات`;
    }
}

function renderMatchesList(fixtures) {
    const container = document.getElementById('matches-list-container');
    if (!fixtures.length) {
        container.innerHTML = `<div class="matches-empty">لم يتم العثور على مباريات تطابق البحث</div>`;
        return;
    }

    container.innerHTML = fixtures.map(f => {
        const status = f.fixture.status.short;
        const isFinished = ['FT', 'AET', 'PEN'].includes(status);
        const isLive = ['1H', '2H', 'HT', 'ET', 'BT', 'P'].includes(status);

        let scoreDisplay, statusLabel, statusClass;
        if (isFinished) {
            scoreDisplay = `${f.goals.home ?? 0} - ${f.goals.away ?? 0}`;
            statusLabel = 'انتهت';
            statusClass = 'match-status-ft';
        } else if (isLive) {
            scoreDisplay = `${f.goals.home ?? 0} - ${f.goals.away ?? 0}`;
            statusLabel = `🔴 ${f.fixture.status.elapsed}'`;
            statusClass = 'match-status-live';
        } else {
            const d = new Date(f.fixture.date);
            scoreDisplay = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
            statusLabel = f.league.name.substring(0, 18);
            statusClass = '';
        }

        return `
        <div class="match-item" onclick="insertMatchCard(${f.fixture.id})" title="انقر لإدراج بطاقة هذه المباراة">
            <div class="match-item-team">
                <img src="${f.teams.home.logo}" alt="${f.teams.home.name}" loading="lazy"
                    onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><text y=%2218%22 font-size=%2216%22>⚽</text></svg>'">
                <div class="match-item-team-name">${f.teams.home.name}</div>
            </div>
            <div class="match-item-center">
                <div class="match-item-score">${scoreDisplay}</div>
                <div class="match-item-status ${statusClass}">${statusLabel}</div>
                <div class="match-item-league">${f.league.country}</div>
            </div>
            <div class="match-item-team">
                <img src="${f.teams.away.logo}" alt="${f.teams.away.name}" loading="lazy"
                    onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><text y=%2218%22 font-size=%2216%22>⚽</text></svg>'">
                <div class="match-item-team-name">${f.teams.away.name}</div>
            </div>
        </div>`;
    }).join('');

    _cachedMatches = fixtures;
}

function insertMatchCard(fixtureId) {
    if (!quillEditor) { showToast('افتح المحرر أولاً', 'warning'); return; }

    const f = _cachedMatches.find(x => x.fixture.id === fixtureId);
    if (!f) { showToast('بيانات المباراة غير موجودة', 'error'); return; }

    const status = f.fixture.status.short;
    const isFinished = ['FT', 'AET', 'PEN'].includes(status);
    const isLive    = ['1H', '2H', 'HT', 'ET', 'BT', 'P'].includes(status);

    let scoreHTML, statusBadge;

    if (isFinished) {
        scoreHTML  = `${f.goals.home ?? 0} &nbsp;–&nbsp; ${f.goals.away ?? 0}`;
        statusBadge = `<span style="padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.3);">FT ✓</span>`;
    } else if (isLive) {
        scoreHTML  = `${f.goals.home ?? 0} &nbsp;–&nbsp; ${f.goals.away ?? 0}`;
        statusBadge = `<span style="padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);">🔴 LIVE ${f.fixture.status.elapsed}'</span>`;
    } else {
        const d = new Date(f.fixture.date);
        const timeStr = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        const dateStr = d.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
        scoreHTML  = `<span style="font-size:20px;letter-spacing:1px;">${timeStr}</span>`;
        statusBadge = `<span style="padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:rgba(6,182,212,0.12);color:#06b6d4;border:1px solid rgba(6,182,212,0.25);">${dateStr}</span>`;
    }

    const shortcodeObj = {
        lName: f.league.name,
        lCountry: f.league.country,
        lLogo: f.league.logo,
        hName: f.teams.home.name,
        hLogo: f.teams.home.logo,
        aName: f.teams.away.name,
        aLogo: f.teams.away.logo,
        score: scoreHTML,
        badge: statusBadge,
        venue: f.fixture.venue?.name || 'الملعب غير معروف'
    };

    const base64Data = btoa(unescape(encodeURIComponent(JSON.stringify(shortcodeObj))));
    const shortcodeText = `[MATCH_CARD:${base64Data}]`;
    
    const uid = 'sc_' + Date.now();
    _embeddedShortcodes[uid] = shortcodeText;
    const blockquote = `<blockquote style="border-left:3px solid #22c55e;padding:12px 16px;background:rgba(34,197,94,0.06);border-radius:6px;margin:10px 0;display:flex;align-items:center;gap:10px;" data-sc="${uid}"><span style="font-size:22px;">⚽</span><div><strong style="color:#22c55e;font-size:14px;">مباراة مدرجة</strong><div style="font-size:13px;color:#94a3b8;margin-top:2px;">${f.teams.home.name} ضد ${f.teams.away.name}</div></div></blockquote><p><br></p>`;

    const range = quillEditor.getSelection();
    const index = range ? range.index : quillEditor.getLength();
    quillEditor.clipboard.dangerouslyPasteHTML(index, blockquote);
    quillEditor.setSelection(quillEditor.getLength(), 0);

    showToast(`✅ تم إدراج مباراة ${f.teams.home.name} vs ${f.teams.away.name}`, 'success');
}

function insertUniversalEmbed() {
    if (!quillEditor) { showToast('افتح المحرر أولاً', 'warning'); return; }
    
    const embedInput = document.getElementById('universal-embed-input');
    const rawHtml = embedInput ? embedInput.value.trim() : '';
    
    if (!rawHtml) {
        showToast('يرجى إدخال كود الـ Embed', 'warning');
        return;
    }
    
    const base64Data = btoa(unescape(encodeURIComponent(rawHtml)));
    const shortcodeText = `[EMBED_CODE:${base64Data}]`;
    const uid = 'sc_' + Date.now();
    _embeddedShortcodes[uid] = shortcodeText;
    const blockquote = `<blockquote style="border-left:3px solid #06b6d4;padding:12px 16px;background:rgba(6,182,212,0.06);border-radius:6px;margin:10px 0;display:flex;align-items:center;gap:10px;" data-sc="${uid}"><span style="font-size:22px;">🌐</span><div><strong style="color:#06b6d4;font-size:14px;">محتوى مضمن (Embed)</strong><div style="font-size:13px;color:#94a3b8;margin-top:2px;">سيظهر في الموقع عند النشر</div></div></blockquote><p><br></p>`;
    
    const range = quillEditor.getSelection();
    const index = range ? range.index : quillEditor.getLength();
    quillEditor.clipboard.dangerouslyPasteHTML(index, blockquote);
    quillEditor.setSelection(quillEditor.getLength(), 0);
    
    embedInput.value = '';
    showToast('تم إدراج كود الـ Embed بنجاح', 'success');
}

function toggleLivePreview() {
    const previewDiv = document.getElementById('editor-live-preview');
    if (!previewDiv) return;
    
    if (previewDiv.style.display === 'block') {
        previewDiv.style.display = 'none';
        return;
    }
    
    if (!quillEditor) return;
    
    let content = quillEditor.root.innerHTML;
    
    // Replace EMBED_CODE
    content = content.replace(/<blockquote[^>]*>.*?\[EMBED_CODE:([A-Za-z0-9+/=]+)\].*?<\/blockquote>/gs, (fullMatch, b64) => {
        try {
            return decodeURIComponent(escape(atob(b64)));
        } catch(e) { return fullMatch; }
    });
    
    // Replace Legacy INSTAGRAM
    content = content.replace(/<blockquote[^>]*>.*?\[INSTAGRAM:(.+?)\].*?<\/blockquote>/gs, (fullMatch, cleanUrl) => {
        return `<div style="margin:20px auto;max-width:540px;">
                    <blockquote class="instagram-media" data-instgrm-permalink="${cleanUrl}" data-instgrm-version="14" style=" background:#FFF; border:0; margin: 1px; max-width:540px; width:100%;"></blockquote>
                </div>`;
    });
    
    // Replace MATCH_CARD
    content = content.replace(/<blockquote[^>]*>.*?\[MATCH_CARD:([A-Za-z0-9+/=]+)\].*?<\/blockquote>/gs, (fullMatch, b64) => {
        try {
            const data = JSON.parse(decodeURIComponent(escape(atob(b64))));
            return `<div style="background:#1e293b; border:1px solid #334155; padding:15px; text-align:center; border-radius:12px; margin:20px 0;">
                <h4 style="color:#fff; margin-bottom:10px;">⚽ مقاطع المباراة: ${data.hName} ضد ${data.aName}</h4>
            </div>`;
        } catch(e) { return fullMatch; }
    });
    
    previewDiv.innerHTML = `<h3 style="color:var(--accent); border-bottom:1px solid var(--accent); padding-bottom:10px; margin-bottom:20px;">المعاينة الحية:</h3><div style="font-size:1.15rem; line-height:1.8; color:#f8fafc; padding:20px; border-radius:8px; background:rgba(0,0,0,0.3);">${content}</div>`;
    previewDiv.style.display = 'block';
    
    // Scroll to preview
    previewDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Execute scripts (e.g. Twitter/FB embeds)
    const scripts = previewDiv.querySelectorAll('script');
    scripts.forEach(oldScript => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
        if (oldScript.innerHTML) newScript.appendChild(document.createTextNode(oldScript.innerHTML));
        oldScript.parentNode.replaceChild(newScript, oldScript);
    });

    if (window.instgrm && window.instgrm.Embeds) {
        setTimeout(() => { try { window.instgrm.Embeds.process(); } catch(e){} }, 200);
    }
}

// ============================================================
//  FEATURED SPOTLIGHT MANAGER
// ============================================================

let currentEditingSpotlightId = null;

async function loadSpotlight() {
    const tbody = document.getElementById('spotlight-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;">جاري التحميل...</td></tr>`;
    try {
        const { data, error } = await supabaseClient
            .from('featured_spotlight')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        if (!data || !data.length) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;">لا توجد إضاءات بعد</td></tr>`;
            return;
        }
        tbody.innerHTML = data.map(s => `
            <tr>
                <td style="font-weight:700;color:#f1f5f9;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.title}</td>
                <td style="color:#64748b;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.subtitle || '—'}</td>
                <td><span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:700;background:${s.active ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.12)'};color:${s.active ? '#4ade80' : '#64748b'};border:1px solid ${s.active ? 'rgba(34,197,94,0.25)' : 'rgba(100,116,139,0.2)'};">${s.active ? '✅ مفعل' : '⏸ موقوف'}</span></td>
                <td style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button onclick="editSpotlight(${JSON.stringify(s).replace(/"/g,'&quot;')})" style="padding:6px 14px;border-radius:6px;border:1px solid var(--accent);background:rgba(6,182,212,0.1);color:var(--accent);cursor:pointer;font-size:13px;">تعديل</button>
                    <button onclick="toggleSpotlightActive('${s.id}', ${!s.active})" style="padding:6px 14px;border-radius:6px;border:1px solid ${s.active ? 'rgba(245,158,11,0.4)' : 'rgba(34,197,94,0.4)'};background:${s.active ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)'};color:${s.active ? '#f59e0b' : '#4ade80'};cursor:pointer;font-size:13px;">${s.active ? '⏸ إيقاف' : '▶ تفعيل'}</button>
                    <button onclick="deleteSpotlight('${s.id}')" style="padding:6px 14px;border-radius:6px;border:1px solid rgba(239,68,68,0.4);background:rgba(239,68,68,0.08);color:#f87171;cursor:pointer;font-size:13px;">حذف</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        showToast('فشل في تحميل الإضاءات: ' + err.message, 'error');
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--danger);padding:20px;">خطأ في تحميل البيانات</td></tr>`;
    }
}

function editSpotlight(s) {
    currentEditingSpotlightId = s.id;
    document.getElementById('spotlight-title').value = s.title || '';
    document.getElementById('spotlight-subtitle').value = s.subtitle || '';
    document.getElementById('spotlight-link-text').value = s.link_text || '';
    document.getElementById('spotlight-link-url').value = s.link_url || '';
    document.getElementById('spotlight-image-url').value = s.image_url || '';
    // Update preview
    document.getElementById('spotlight-prev-title').textContent = s.title || 'العنوان سيظهر هنا...';
    document.getElementById('spotlight-prev-sub').textContent = s.subtitle || 'الوصف سيظهر هنا...';
    if (s.image_url) {
        document.getElementById('spotlight-preview-img').innerHTML = `<img src="${s.image_url}" style="width:100%;height:140px;object-fit:cover;" onerror="this.parentElement.innerHTML='<div style=height:140px;background:rgba(236,72,153,0.1);display:flex;align-items:center;justify-content:center;>⭐</div>'">`;
    }
    showToast('تم تحميل بيانات الإضاءة للتعديل', 'success');
}

async function saveSpotlight() {
    const titleEl = document.getElementById('spotlight-title');
    const subEl = document.getElementById('spotlight-subtitle');
    const linkTextEl = document.getElementById('spotlight-link-text');
    const linkUrlEl = document.getElementById('spotlight-link-url');
    const imgUrlEl = document.getElementById('spotlight-image-url');
    const spinner = document.getElementById('spotlightSpinner');

    const title = titleEl?.value.trim();
    if (!title) { showToast('العنوان مطلوب', 'warning'); return; }

    const spotlightData = {
        title,
        subtitle: subEl?.value.trim() || null,
        link_text: linkTextEl?.value.trim() || null,
        link_url: linkUrlEl?.value.trim() || null,
        image_url: imgUrlEl?.value.trim() || null,
        active: true
    };

    if (spinner) spinner.style.display = 'inline-block';
    try {
        let error;
        if (currentEditingSpotlightId) {
            ({ error } = await supabaseClient.from('featured_spotlight').update(spotlightData).eq('id', currentEditingSpotlightId));
        } else {
            ({ error } = await supabaseClient.from('featured_spotlight').insert([spotlightData]));
        }
        if (error) throw error;
        showToast(currentEditingSpotlightId ? 'تم تحديث الإضاءة بنجاح ✅' : 'تم إضافة الإضاءة بنجاح ✅', 'success');
        currentEditingSpotlightId = null;
        // Reset form
        ['spotlight-title','spotlight-subtitle','spotlight-link-text','spotlight-link-url','spotlight-image-url'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
        loadSpotlight();
    } catch (err) {
        showToast('فشل في الحفظ: ' + err.message, 'error');
    } finally {
        if (spinner) spinner.style.display = 'none';
    }
}

async function toggleSpotlightActive(id, newState) {
    try {
        const { error } = await supabaseClient.from('featured_spotlight').update({ active: newState }).eq('id', id);
        if (error) throw error;
        showToast(newState ? 'تم تفعيل الإضاءة ✅' : 'تم إيقاف الإضاءة', 'success');
        loadSpotlight();
    } catch (err) {
        showToast('فشل: ' + err.message, 'error');
    }
}

async function deleteSpotlight(id) {
    if (!(await uiConfirm('هل تريد حذف هذه الإضاءة نهائياً؟', 'حذف اختيار المحرر'))) return;
    try {
        const { error } = await supabaseClient.from('featured_spotlight').delete().eq('id', id);
        if (error) throw error;
        showToast('تم الحذف بنجاح', 'success');
        loadSpotlight();
    } catch (err) {
        showToast('فشل الحذف: ' + err.message, 'error');
    }
}

// Live preview update for spotlight form
['spotlight-title','spotlight-subtitle','spotlight-link-text','spotlight-image-url'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
        const titleEl = document.getElementById('spotlight-title');
        const subEl = document.getElementById('spotlight-subtitle');
        const imgEl = document.getElementById('spotlight-image-url');
        const ctaEl = document.getElementById('spotlight-link-text');
        if (titleEl) document.getElementById('spotlight-prev-title').textContent = titleEl.value || 'العنوان سيظهر هنا...';
        if (subEl) document.getElementById('spotlight-prev-sub').textContent = subEl.value || 'الوصف سيظهر هنا...';
        if (ctaEl) document.getElementById('spotlight-prev-cta').textContent = ctaEl.value || 'اكتشف الآن';
        if (imgEl && imgEl.value) {
            document.getElementById('spotlight-preview-img').innerHTML = `<img src="${imgEl.value}" style="width:100%;height:140px;object-fit:cover;" onerror="this.parentElement.innerHTML=''">`; 
        }
    });
});


// ============================================================
//  PROMO BANNER MANAGER
// ============================================================
let currentEditingPromoId = null;

async function loadPromoBannerAdmin() {
    const tbody = document.getElementById('promo-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;">جاري التحميل...</td></tr>`;
    try {
        const { data, error } = await supabaseClient
            .from('promo_banner')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;">لا توجد بانرات. أضف واحداً جديداً.</td></tr>`;
            return;
        }
        tbody.innerHTML = data.map(b => `
            <tr>
                <td>
                    ${b.image_url ? `<img src="${b.image_url}" style="width:100px;border-radius:6px;object-fit:cover;">` : '<span style="color:#64748b">لا يوجد</span>'}
                </td>
                <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" dir="ltr">${b.link_url || '-'}</td>
                <td>
                    <span style="display:inline-block;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:700;${b.active ? 'background:rgba(34,197,94,0.1);color:#4ade80;' : 'background:rgba(239,68,68,0.1);color:#ef4444;'}">
                        ${b.active ? '🟢 نشط' : '🔴 متوقف'}
                    </span>
                </td>
                <td style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button onclick="editPromoBanner(${JSON.stringify(b).replace(/"/g,'&quot;')})" style="padding:6px 14px;border-radius:6px;border:1px solid var(--accent);background:rgba(6,182,212,0.1);color:var(--accent);cursor:pointer;font-size:13px;">تعديل</button>
                    <button onclick="togglePromoBannerActive('${b.id}', ${!b.active})" style="padding:6px 14px;border-radius:6px;border:1px solid ${b.active ? 'rgba(245,158,11,0.4)' : 'rgba(34,197,94,0.4)'};background:${b.active ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)'};color:${b.active ? '#f59e0b' : '#4ade80'};cursor:pointer;font-size:13px;">${b.active ? '⏸ إيقاف' : '▶ تفعيل'}</button>
                    <button onclick="deletePromoBanner('${b.id}')" style="padding:6px 14px;border-radius:6px;border:1px solid rgba(239,68,68,0.4);background:rgba(239,68,68,0.08);color:#f87171;cursor:pointer;font-size:13px;">حذف</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        showToast('فشل في تحميل البانرات: ' + err.message, 'error');
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--danger);padding:20px;">خطأ في تحميل البيانات</td></tr>`;
    }
}

function editPromoBanner(b) {
    currentEditingPromoId = b.id;
    document.getElementById('promo-title').value = b.title || '';
    document.getElementById('promo-link-url').value = b.link_url || '';
    document.getElementById('promo-image-url').value = b.image_url || '';
    
    document.getElementById('promo-prev-title').textContent = b.title || '';
    if (b.image_url) {
        document.getElementById('promo-preview-img').innerHTML = `<img src="${b.image_url}" style="width:100%;height:100%;object-fit:cover;" onerror="this.innerHTML='🖼️'">`;
    } else {
        document.getElementById('promo-preview-img').innerHTML = `<span style="color:#8b5cf6;font-size:24px;">🖼️</span>`;
    }
    showToast('تم تحميل بيانات البانر للتعديل', 'success');
}

async function savePromoBanner() {
    const titleEl = document.getElementById('promo-title');
    const linkUrlEl = document.getElementById('promo-link-url');
    const imgUrlEl = document.getElementById('promo-image-url');
    const spinner = document.getElementById('promoSpinner');

    const image_url = imgUrlEl?.value.trim();
    if (!image_url) { showToast('رابط الصورة مطلوب', 'warning'); return; }

    const promoData = {
        title: titleEl?.value.trim() || null,
        link_url: linkUrlEl?.value.trim() || null,
        image_url: image_url,
        active: true
    };

    if (spinner) spinner.style.display = 'inline-block';
    try {
        let error;
        if (currentEditingPromoId) {
            ({ error } = await supabaseClient.from('promo_banner').update(promoData).eq('id', currentEditingPromoId));
        } else {
            ({ error } = await supabaseClient.from('promo_banner').insert([promoData]));
        }
        if (error) throw error;
        showToast(currentEditingPromoId ? 'تم تحديث البانر بنجاح ✅' : 'تم إضافة البانر بنجاح ✅', 'success');
        currentEditingPromoId = null;
        
        ['promo-title','promo-link-url','promo-image-url'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
        document.getElementById('promo-preview-img').innerHTML = `<span style="color:#8b5cf6;font-size:24px;">🖼️</span>`;
        document.getElementById('promo-prev-title').textContent = '';
        
        loadPromoBannerAdmin();
    } catch (err) {
        showToast('فشل في الحفظ: ' + err.message, 'error');
    } finally {
        if (spinner) spinner.style.display = 'none';
    }
}

async function togglePromoBannerActive(id, newState) {
    try {
        const { error } = await supabaseClient.from('promo_banner').update({ active: newState }).eq('id', id);
        if (error) throw error;
        showToast(newState ? 'تم تفعيل البانر ✅' : 'تم إيقاف البانر', 'success');
        loadPromoBannerAdmin();
    } catch (err) {
        showToast('فشل: ' + err.message, 'error');
    }
}

async function deletePromoBanner(id) {
    if (!(await uiConfirm('هل تريد حذف هذا البانر نهائياً؟', 'حذف البانر الترويجي'))) return;
    try {
        const { error } = await supabaseClient.from('promo_banner').delete().eq('id', id);
        if (error) throw error;
        showToast('تم الحذف بنجاح', 'success');
        loadPromoBannerAdmin();
    } catch (err) {
        showToast('فشل الحذف: ' + err.message, 'error');
    }
}

// Live preview update
['promo-title','promo-image-url'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
        const titleEl = document.getElementById('promo-title');
        const imgEl = document.getElementById('promo-image-url');
        if (titleEl) document.getElementById('promo-prev-title').textContent = titleEl.value || '';
        if (imgEl && imgEl.value) {
            document.getElementById('promo-preview-img').innerHTML = `<img src="${imgEl.value}" style="width:100%;height:100%;object-fit:cover;" onerror="this.innerHTML=''">`; 
        } else {
            document.getElementById('promo-preview-img').innerHTML = `<span style="color:#8b5cf6;font-size:24px;">🖼️</span>`;
        }
    });
});

// ============================================================
//  COMMUNITY REVIEWS MANAGER
// ============================================================

async function loadReviews() {
    const tbody = document.getElementById('reviews-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">جاري التحميل...</td></tr>`;
    try {
        const { data, error } = await supabaseClient
            .from('community_reviews')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        if (!data || !data.length) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">لا توجد تقييمات بعد</td></tr>`;
            return;
        }
        tbody.innerHTML = data.map(r => {
            const stars = '★'.repeat(r.rating || 5) + '☆'.repeat(5 - (r.rating || 5));
            return `
            <tr>
                <td style="font-weight:700;color:#e2e8f0;">${r.reviewer_name}</td>
                <td style="color:#f59e0b;letter-spacing:1px;font-size:14px;">${stars}</td>
                <td style="color:#64748b;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.review_text}</td>
                <td><span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${r.active ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.12)'};color:${r.active ? '#4ade80' : '#64748b'};border:1px solid ${r.active ? 'rgba(34,197,94,0.25)' : 'rgba(100,116,139,0.2)'};">${r.active ? 'مفعل' : 'موقوف'}</span></td>
                <td style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button onclick="toggleReviewActive('${r.id}', ${!r.active})" style="padding:5px 12px;border-radius:6px;border:1px solid ${r.active ? 'rgba(245,158,11,0.4)' : 'rgba(34,197,94,0.4)'};background:${r.active ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)'};color:${r.active ? '#f59e0b' : '#4ade80'};cursor:pointer;font-size:12px;">${r.active ? '⏸' : '▶'}</button>
                    <button onclick="deleteReview('${r.id}')" style="padding:5px 12px;border-radius:6px;border:1px solid rgba(239,68,68,0.4);background:rgba(239,68,68,0.08);color:#f87171;cursor:pointer;font-size:12px;">🗑</button>
                </td>
            </tr>`;
        }).join('');
    } catch (err) {
        showToast('فشل في تحميل التقييمات: ' + err.message, 'error');
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--danger);padding:20px;">خطأ في تحميل البيانات</td></tr>`;
    }
}

async function saveReview() {
    const name = document.getElementById('review-name')?.value.trim();
    const avatar = document.getElementById('review-avatar')?.value.trim();
    const rating = parseInt(document.getElementById('review-rating')?.value || '5');
    const text = document.getElementById('review-text')?.value.trim();
    const verified = document.getElementById('review-verified')?.checked ?? true;
    const spinner = document.getElementById('reviewSpinner');

    if (!name || !text) { showToast('الاسم ونص التقييم مطلوبان', 'warning'); return; }

    if (spinner) spinner.style.display = 'inline-block';
    try {
        const { error } = await supabaseClient.from('community_reviews').insert([{
            reviewer_name: name,
            reviewer_avatar: avatar || null,
            rating,
            review_text: text,
            verified,
            active: true
        }]);
        if (error) throw error;
        showToast('تم إضافة التقييم بنجاح ✅', 'success');
        // Reset form
        ['review-name','review-avatar','review-text'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
        const ratingEl = document.getElementById('review-rating');
        if (ratingEl) ratingEl.value = '5';
        const verEl = document.getElementById('review-verified');
        if (verEl) verEl.checked = true;
        loadReviews();
    } catch (err) {
        showToast('فشل في إضافة التقييم: ' + err.message, 'error');
    } finally {
        if (spinner) spinner.style.display = 'none';
    }
}

async function toggleReviewActive(id, newState) {
    try {
        const { error } = await supabaseClient.from('community_reviews').update({ active: newState }).eq('id', id);
        if (error) throw error;
        showToast(newState ? 'تم تفعيل التقييم ✅' : 'تم إيقاف التقييم', 'success');
        loadReviews();
    } catch (err) {
        showToast('فشل: ' + err.message, 'error');
    }
}

async function deleteReview(id) {
    if (!(await uiConfirm('هل تريد حذف هذا التقييم نهائياً؟', 'حذف التقييم'))) return;
    try {
        const { error } = await supabaseClient.from('community_reviews').delete().eq('id', id);
        if (error) throw error;
        showToast('تم الحذف بنجاح', 'success');
        loadReviews();
    } catch (err) {
        showToast('فشل الحذف: ' + err.message, 'error');
    }
}


// ============================================================
//  TRENDING / MOST READ MANAGER
// ============================================================
// SQL for trending_posts table:
// CREATE TABLE trending_posts (
//   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//   title TEXT NOT NULL,
//   subtitle TEXT,
//   image_url TEXT,
//   link_url TEXT NOT NULL,
//   sort_order INTEGER DEFAULT 1,
//   active BOOLEAN DEFAULT TRUE,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );

async function loadTrending() {
    const tbody = document.getElementById('trending-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">جاري التحميل...</td></tr>`;
    try {
        const { data, error } = await supabaseClient
            .from('trending_posts')
            .select('*')
            .order('sort_order', { ascending: true });
        if (error) throw error;
        if (!data || !data.length) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">لا توجد مقالات مثبتة بعد — أضف أول مقال!</td></tr>`;
            return;
        }
        tbody.innerHTML = data.map(t => `
            <tr>
                <td style="font-weight:900;color:#06b6d4;font-size:18px;text-align:center;">${t.sort_order}</td>
                <td>
                    <div style="display:flex;align-items:center;gap:10px;">
                        ${t.image_url ? `<img src="${t.image_url}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;flex-shrink:0;" onerror="this.style.display='none'">` : ''}
                        <div style="font-weight:700;color:#f1f5f9;font-size:13px;max-width:200px;">${t.title}</div>
                    </div>
                </td>
                <td style="color:#64748b;font-size:12px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.subtitle || '—'}</td>
                <td><span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${t.active ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.12)'};color:${t.active ? '#4ade80' : '#64748b'};border:1px solid ${t.active ? 'rgba(34,197,94,0.25)' : 'rgba(100,116,139,0.2)'};">${t.active ? '✅ ظاهر' : '⏸ مخفي'}</span></td>
                <td style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button onclick="toggleTrendingActive('${t.id}', ${!t.active})" style="padding:5px 12px;border-radius:6px;border:1px solid ${t.active ? 'rgba(245,158,11,0.4)' : 'rgba(34,197,94,0.4)'};background:${t.active ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)'};color:${t.active ? '#f59e0b' : '#4ade80'};cursor:pointer;font-size:12px;">${t.active ? '⏸ إخفاء' : '▶ إظهار'}</button>
                    <button onclick="deleteTrendingItem('${t.id}')" style="padding:5px 12px;border-radius:6px;border:1px solid rgba(239,68,68,0.4);background:rgba(239,68,68,0.08);color:#f87171;cursor:pointer;font-size:12px;">🗑 حذف</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        showToast('فشل في تحميل قسم الأكثر قراءة: ' + err.message, 'error');
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--danger);padding:20px;">خطأ في تحميل البيانات</td></tr>`;
    }
}

async function saveTrendingItem() {
    const title = document.getElementById('trending-title')?.value.trim();
    const imageUrl = document.getElementById('trending-image')?.value.trim();
    const linkUrl = document.getElementById('trending-url')?.value.trim();
    const subtitle = document.getElementById('trending-subtitle')?.value.trim();
    const sortOrder = parseInt(document.getElementById('trending-order')?.value || '1');
    const spinner = document.getElementById('trendingSpinner');

    if (!title) { showToast('العنوان مطلوب', 'warning'); return; }
    if (!linkUrl) { showToast('رابط المقال مطلوب', 'warning'); return; }

    if (spinner) spinner.style.display = 'inline-block';
    try {
        const { error } = await supabaseClient.from('trending_posts').insert([{
            title,
            subtitle: subtitle || null,
            image_url: imageUrl || null,
            link_url: linkUrl,
            sort_order: sortOrder,
            active: true
        }]);
        if (error) throw error;
        showToast('تم إضافة المقال للأكثر قراءة ✅', 'success');
        // Reset form
        ['trending-title','trending-image','trending-url','trending-subtitle'].forEach(id => {
            const el = document.getElementById(id); if(el) el.value = '';
        });
        const orderEl = document.getElementById('trending-order');
        if (orderEl) orderEl.value = '1';
        loadTrending();
    } catch (err) {
        showToast('فشل الإضافة: ' + err.message, 'error');
    } finally {
        if (spinner) spinner.style.display = 'none';
    }
}

async function toggleTrendingActive(id, newState) {
    try {
        const { error } = await supabaseClient.from('trending_posts').update({ active: newState }).eq('id', id);
        if (error) throw error;
        showToast(newState ? 'تم إظهار المقال ✅' : 'تم إخفاء المقال', 'success');
        loadTrending();
    } catch (err) {
        showToast('فشل: ' + err.message, 'error');
    }
}

async function deleteTrendingItem(id) {
    if (!(await uiConfirm('هل تريد إزالة هذا المقال من الأكثر قراءة؟', 'إزالة المقال'))) return;
    try {
        const { error } = await supabaseClient.from('trending_posts').delete().eq('id', id);
        if (error) throw error;
        showToast('تم الحذف بنجاح', 'success');
        loadTrending();
    } catch (err) {
        showToast('فشل الحذف: ' + err.message, 'error');
    }
}

// ============================================================
//  RECOMMENDED ARTICLES MANAGER (مقالات قد تهمك)
// ============================================================
// SQL for recommended_articles table:
// CREATE TABLE recommended_articles (
//   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//   title TEXT NOT NULL,
//   subtitle TEXT,
//   image_url TEXT,
//   link_url TEXT NOT NULL,
//   sort_order INTEGER DEFAULT 1,
//   active BOOLEAN DEFAULT TRUE,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );

async function loadRecommended() {
    const tbody = document.getElementById('recommended-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">جاري التحميل...</td></tr>`;
    try {
        const { data, error } = await supabaseClient
            .from('recommended_articles')
            .select('*')
            .order('sort_order', { ascending: true });
        if (error) throw error;
        if (!data || !data.length) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">لا توجد مقالات مضافة بعد.</td></tr>`;
            return;
        }
        tbody.innerHTML = data.map(t => `
            <tr>
                <td style="font-weight:900;color:#0ea5e9;font-size:18px;text-align:center;">${t.sort_order}</td>
                <td>
                    <div style="display:flex;align-items:center;gap:10px;">
                        ${t.image_url ? `<img src="${t.image_url}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;flex-shrink:0;" onerror="this.style.display='none'">` : ''}
                        <div style="font-weight:700;color:#f1f5f9;font-size:13px;max-width:200px;">${t.title}</div>
                    </div>
                </td>
                <td style="color:#64748b;font-size:12px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.subtitle || '—'}</td>
                <td><span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${t.active ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.12)'};color:${t.active ? '#4ade80' : '#64748b'};border:1px solid ${t.active ? 'rgba(34,197,94,0.25)' : 'rgba(100,116,139,0.2)'};">${t.active ? '✅ ظاهر' : '⏸ مخفي'}</span></td>
                <td style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button onclick="toggleRecommendedActive('${t.id}', ${!t.active})" style="padding:5px 12px;border-radius:6px;border:1px solid ${t.active ? 'rgba(245,158,11,0.4)' : 'rgba(34,197,94,0.4)'};background:${t.active ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)'};color:${t.active ? '#f59e0b' : '#4ade80'};cursor:pointer;font-size:12px;">${t.active ? '⏸ إخفاء' : '▶ إظهار'}</button>
                    <button onclick="deleteRecommendedItem('${t.id}')" style="padding:5px 12px;border-radius:6px;border:1px solid rgba(239,68,68,0.4);background:rgba(239,68,68,0.08);color:#f87171;cursor:pointer;font-size:12px;">🗑 حذف</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        showToast('فشل في تحميل المقالات المقترحة: ' + err.message, 'error');
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--danger);padding:20px;">خطأ في تحميل البيانات</td></tr>`;
    }
}

async function saveRecommendedItem() {
    const title = document.getElementById('recommended-title')?.value.trim();
    const imageUrl = document.getElementById('recommended-image')?.value.trim();
    const linkUrl = document.getElementById('recommended-url')?.value.trim();
    const subtitle = document.getElementById('recommended-subtitle')?.value.trim();
    const sortOrder = parseInt(document.getElementById('recommended-order')?.value || '1');
    const spinner = document.getElementById('recommendedSpinner');

    if (!title) { showToast('العنوان مطلوب', 'warning'); return; }
    if (!linkUrl) { showToast('رابط المقال مطلوب', 'warning'); return; }

    if (spinner) spinner.style.display = 'inline-block';
    try {
        const { error } = await supabaseClient.from('recommended_articles').insert([{
            title,
            subtitle: subtitle || null,
            image_url: imageUrl || null,
            link_url: linkUrl,
            sort_order: sortOrder,
            active: true
        }]);
        if (error) throw error;
        showToast('تم الإضافة بنجاح ✅', 'success');
        ['recommended-title','recommended-image','recommended-url','recommended-subtitle'].forEach(id => {
            const el = document.getElementById(id); if(el) el.value = '';
        });
        const orderEl = document.getElementById('recommended-order');
        if (orderEl) orderEl.value = '1';
        loadRecommended();
    } catch (err) {
        showToast('فشل الإضافة: ' + err.message, 'error');
    } finally {
        if (spinner) spinner.style.display = 'none';
    }
}

async function toggleRecommendedActive(id, newState) {
    try {
        const { error } = await supabaseClient.from('recommended_articles').update({ active: newState }).eq('id', id);
        if (error) throw error;
        showToast(newState ? 'تم الإظهار ✅' : 'تم الإخفاء', 'success');
        loadRecommended();
    } catch (err) {
        showToast('فشل: ' + err.message, 'error');
    }
}

// ✅ FIX: This function was called in HTML onclick but was MISSING from admin.js → caused ReferenceError crash
async function deleteRecommendedItem(id) {
    if (!(await uiConfirm('هل تريد إزالة هذا المقال من قسم "مقالات قد تهمك"؟', 'إزالة المقال'))) return;
    try {
        const { error } = await supabaseClient.from('recommended_articles').delete().eq('id', id);
        if (error) throw error;
        showToast('تم الحذف بنجاح ✅', 'success');
        loadRecommended();
    } catch (err) {
        showToast('فشل الحذف: ' + err.message, 'error');
    }
}


// ============================================================
//  SHARED IMAGE UPLOAD FOR SECTIONS (spotlight, trending, recommended)
// ============================================================

window.uploadSectionImage = async function(inputEl, targetInputId, statusId) {
    const file = inputEl.files[0];
    if (!file) return;

    const statusEl = document.getElementById(statusId);
    const targetInput = document.getElementById(targetInputId);

    if (statusEl) statusEl.innerHTML = '⏳ جاري الرفع...';

    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `section-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `sections/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabaseClient
            .storage
            .from('post-images')
            .upload(filePath, file, {
                contentType: file.type || 'image/jpeg',
                upsert: false
            });

        if (uploadError) throw new Error(uploadError.message);

        const { data: publicUrlData } = supabaseClient.storage.from('post-images').getPublicUrl(filePath);
        const publicUrl = publicUrlData?.publicUrl;

        if (!publicUrl) throw new Error('فشل في جلب رابط الصورة');

        if (targetInput) targetInput.value = publicUrl;
        if (statusEl) statusEl.innerHTML = `✅ تم الرفع بنجاح! <a href="${publicUrl}" target="_blank" style="color:#38bdf8;text-decoration:underline;">معاينة</a>`;

        // Trigger preview update for spotlight if applicable
        if (targetInputId === 'spotlight-image-url') {
            const prev = document.getElementById('spotlight-preview-img');
            if (prev) prev.style.backgroundImage = `url(${publicUrl})`;
        }

        showToast('تم رفع الصورة بنجاح ✅', 'success');
    } catch (err) {
        if (statusEl) statusEl.innerHTML = `❌ فشل الرفع: ${err.message}`;
        showToast('فشل رفع الصورة: ' + err.message, 'error');
    } finally {
        inputEl.value = ''; // Reset input
    }
};

// ============================================================
//  COMMENTS MODERATION
// ============================================================

let _currentCommentsTable = 'post_comments';

async function loadAllComments(tableName) {
    _currentCommentsTable = tableName || 'post_comments';
    const tbody = document.getElementById('comments-tbody');
    const thead = document.getElementById('comments-thead');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:30px;">جاري التحميل...</td></tr>`;

    try {
        let query = supabaseClient.from(_currentCommentsTable).select('*').order('created_at', { ascending: false }).limit(100);
        const { data, error } = await query;
        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:30px;">لا توجد تعليقات بعد</td></tr>`;
            return;
        }

        const isReviews = _currentCommentsTable === 'community_reviews';

        tbody.innerHTML = data.map(c => {
            const name = isReviews ? (c.reviewer_name || 'زائر') : (c.author_name || 'زائر');
            const content = isReviews ? c.review_text : c.content;
            const fp = c.fingerprint || '—';
            const shortFp = fp.length > 16 ? fp.substring(0, 16) + '…' : fp;
            const date = c.created_at ? new Date(c.created_at).toLocaleString('ar-EG') : '—';
            const starsHtml = isReviews ? `<br><span style="color:#f59e0b;font-size:13px;">${'★'.repeat(c.rating || 0)}${'☆'.repeat(5 - (c.rating || 0))}</span>` : '';

            return `<tr>
                <td style="text-align:center;">
                    <input type="checkbox" id="cb-comment-${c.id}" class="row-cb" value="${c.id}" onchange="updateBatchDeleteBtn('comments-tbody')">
                    <label for="cb-comment-${c.id}" class="select-btn-label">تحديد</label>
                </td>
                <td style="font-weight:700;color:#f1f5f9;">${escapeAdminStr(name)}${starsHtml}</td>
                <td style="max-width:220px;color:#94a3b8;font-size:13px;word-break:break-word;">${escapeAdminStr(content || '')}</td>
                <td style="color:#64748b;font-size:12px;white-space:nowrap;">${date}</td>
                <td style="font-size:11px;color:#475569;font-family:monospace;" title="${escapeAdminStr(fp)}">${escapeAdminStr(shortFp)}</td>
                <td style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button onclick="deleteAdminComment('${c.id}', '${_currentCommentsTable}')" style="padding:5px 12px;border-radius:6px;border:1px solid rgba(239,68,68,0.4);background:rgba(239,68,68,0.08);color:#f87171;cursor:pointer;font-size:12px;">🗑️ حذف</button>
                    ${fp !== '—' ? `<button onclick="banUser('${fp.replace(/'/g, "\\'")}', '${_currentCommentsTable}', '${c.id}')" style="padding:5px 12px;border-radius:6px;border:1px solid rgba(245,158,11,0.4);background:rgba(245,158,11,0.08);color:#f59e0b;cursor:pointer;font-size:12px;">🚫 حظر</button>` : ''}
                </td>
            </tr>`;
        }).join('');
    } catch (err) {
        showToast('فشل التحميل: ' + err.message, 'error');
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--danger);padding:20px;">خطأ في تحميل البيانات</td></tr>`;
    }
}

async function deleteAdminComment(id, tableName) {
    if (!(await uiConfirm('هل تريد حذف هذا التعليق نهائياً؟', 'حذف التعليق'))) return;
    try {
        const { error } = await supabaseClient.from(tableName).delete().eq('id', id);
        if (error) throw error;
        showToast('تم حذف التعليق ✅', 'success');
        loadAllComments(tableName);
    } catch (err) {
        showToast('فشل الحذف: ' + err.message, 'error');
    }
}

async function banUser(fingerprint, tableName, commentId) {
    if (!(await uiConfirm(`هل تريد حظر هذا الجهاز ومنعه من التعليق نهائياً؟\n\nبصمة الجهاز: ${fingerprint}`, 'حظر مستخدم'))) return;
    try {
        // Insert into banned_users
        const { error: banErr } = await supabaseClient.from('banned_users').upsert([{ fingerprint }]);
        if (banErr) throw banErr;

        // Optionally also delete the comment
        if (commentId && await uiConfirm('هل تريد حذف التعليق المسيء أيضاً؟', 'حذف التعليق')) {
            await supabaseClient.from(tableName).delete().eq('id', commentId);
        }
        showToast('تم حظر الجهاز بنجاح 🚫', 'success');
        loadAllComments(tableName);
    } catch (err) {
        showToast('فشل الحظر: ' + err.message, 'error');
    }
}

async function loadBannedUsers() {
    _currentCommentsTable = 'banned_users';
    const tbody = document.getElementById('comments-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:30px;">جاري التحميل...</td></tr>`;
    try {
        const { data, error } = await supabaseClient.from('banned_users').select('*').order('banned_at', { ascending: false });
        if (error) throw error;
        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:30px;">لا توجد أجهزة محظورة 🎉</td></tr>`;
            return;
        }
        tbody.innerHTML = data.map(b => {
            const date = b.banned_at ? new Date(b.banned_at).toLocaleString('ar-EG') : '—';
            return `<tr>
                <td colspan="2" style="font-family:monospace;font-size:12px;color:#94a3b8;">${escapeAdminStr(b.fingerprint)}</td>
                <td style="color:#64748b;font-size:12px;">${date}</td>
                <td>—</td>
                <td>
                    <button onclick="unbanUser('${b.fingerprint.replace(/'/g, "\\'")}')" style="padding:5px 12px;border-radius:6px;border:1px solid rgba(34,197,94,0.4);background:rgba(34,197,94,0.08);color:#4ade80;cursor:pointer;font-size:12px;">✅ إلغاء الحظر</button>
                </td>
            </tr>`;
        }).join('');
    } catch (err) {
        showToast('فشل التحميل: ' + err.message, 'error');
    }
}

async function unbanUser(fingerprint) {
    if (!(await uiConfirm('هل تريد إلغاء حظر هذا الجهاز؟', 'إلغاء حظر مستخدم', false))) return;
    try {
        const { error } = await supabaseClient.from('banned_users').delete().eq('fingerprint', fingerprint);
        if (error) throw error;
        showToast('تم إلغاء الحظر ✅', 'success');
        loadBannedUsers();
    } catch (err) {
        showToast('فشل: ' + err.message, 'error');
    }
}

function escapeAdminStr(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/* ── Batch Delete Logic ──────────────────────────────────────── */
function toggleAllCheckboxes(sourceCb, tbodyId) {
    const checkboxes = document.querySelectorAll(`#${tbodyId} .row-cb`);
    checkboxes.forEach(cb => cb.checked = sourceCb.checked);
    updateBatchDeleteBtn(tbodyId);
}

function updateBatchDeleteBtn(tbodyId) {
    const btn = document.getElementById(`btn-batch-${tbodyId}`);
    if (!btn) return;
    const checked = document.querySelectorAll(`#${tbodyId} .row-cb:checked`);
    if (checked.length > 0) {
        btn.style.display = 'inline-flex';
        btn.innerHTML = `🗑️ حذف المحدد (${checked.length})`;
    } else {
        btn.style.display = 'none';
    }
}

async function executeBatchDelete(tbodyId, tableName, primaryKey = 'id') {
    const checked = document.querySelectorAll(`#${tbodyId} .row-cb:checked`);
    if (checked.length === 0) return;
    
    if (!(await uiConfirm(`هل أنت متأكد من حذف ${checked.length} عنصر نهائياً؟`, 'حذف جماعي'))) return;

    const ids = Array.from(checked).map(cb => cb.value);
    try {
        const { error } = await supabaseClient.from(tableName).delete().in(primaryKey, ids);
        if (error) throw error;
        showToast('تم الحذف الجماعي بنجاح ✅', 'success');
        
        // Reload context
        if (tbodyId === 'posts-tbody') loadPosts();
        else if (tbodyId === 'comments-tbody') loadAllComments(_currentCommentsTable);
        
        updateBatchDeleteBtn(tbodyId);
        
        // Uncheck header checkbox
        const headerCb = document.querySelector(`th input[data-target="${tbodyId}"]`);
        if (headerCb) headerCb.checked = false;
    } catch (err) {
        showToast('فشل الحذف الجماعي: ' + err.message, 'error');
    }
}

/* ── Custom UI Confirm Modal ─────────────────────────────────── */
function uiConfirm(message, title = 'تأكيد الإجراء', isDanger = true) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm-modal');
        if (!modal) return resolve(confirm(message));

        const titleEl = document.getElementById('custom-confirm-title');
        const msgEl = document.getElementById('custom-confirm-message');
        const btnOk = document.getElementById('custom-confirm-ok');
        const btnCancel = document.getElementById('custom-confirm-cancel');

        titleEl.textContent = title;
        msgEl.innerHTML = message.replace(/\n/g, '<br>');
        
        if (isDanger) {
            btnOk.style.background = 'linear-gradient(135deg, #ef4444, #b91c1c)';
            btnOk.style.boxShadow = '0 4px 12px rgba(239,68,68,0.3)';
        } else {
            btnOk.style.background = 'linear-gradient(135deg, #0ea5e9, #2563eb)';
            btnOk.style.boxShadow = '0 4px 12px rgba(14,165,233,0.3)';
        }

        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);

        const cleanup = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.style.display = 'none', 300);
            btnOk.onclick = null;
            btnCancel.onclick = null;
        };

        btnOk.onclick = () => { cleanup(); resolve(true); };
        btnCancel.onclick = () => { cleanup(); resolve(false); };
    });
}

// ==========================================
// DAILY COUPON MANAGEMENT
// ==========================================
async function loadDailyCouponAdmin() {
    try {
        const { data, error } = await supabaseClient
            .from('daily_coupons')
            .select('*')
            .eq('active', true)
            .order('created_at', { ascending: false })
            .limit(1);
            
        if (data && data.length > 0) {
            document.getElementById('daily-coupon-code').value = data[0].code;
            document.getElementById('daily-coupon-desc').value = data[0].description || '';
        }
    } catch (e) {
        console.warn("Could not load daily coupon (table might not exist yet).");
    }
}

window.saveDailyCoupon = async function() {
    const code = document.getElementById('daily-coupon-code').value.trim();
    const desc = document.getElementById('daily-coupon-desc').value.trim();
    
    if (!code) {
        showToast("الرجاء إدخال الكود", "error");
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('daily_coupons')
            .insert([{ code: code, description: desc, active: true }]);
            
        if (error) throw error;
        showToast("تم تحديث القسيمة بنجاح!", "success");
    } catch (e) {
        showToast("حدث خطأ (هل أنشأت الجدول في قاعدة البيانات؟)", "error");
        console.error(e);
    }
};

window.loadCouponComments = async function() {
    const list = document.getElementById('admin-coupon-comments-list');
    list.innerHTML = '<div style="color: #64748b; text-align: center; padding: 20px;">جاري التحميل...</div>';
    
    try {
        const { data, error } = await supabaseClient
            .from('coupon_comments')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
            
        if (error) throw error;
        if (!data || data.length === 0) {
            list.innerHTML = '<div style="color: #64748b; text-align: center; padding: 20px;">لا توجد تعليقات بعد.</div>';
            return;
        }
        
        list.innerHTML = '';
        data.forEach(comment => {
            const dateStr = new Date(comment.created_at).toLocaleString('ar-EG');
            const featuredBtnText = comment.is_featured ? '⭐ إزالة التثبيت' : '📌 تثبيت';
            const featuredColor = comment.is_featured ? '#f59e0b' : '#94a3b8';
            
            const item = document.createElement('div');
            item.style.cssText = `background: rgba(255,255,255,0.05); border-radius: 8px; padding: 15px; border-right: 4px solid ${featuredColor};`;
            item.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                    <strong style="color: #e2e8f0;">${comment.author_name}</strong>
                    <span style="font-size: 12px; color: #64748b;">${dateStr}</span>
                </div>
                <div style="color: #cbd5e1; margin-bottom: 12px; font-size: 14px; white-space: pre-wrap;">${comment.content}</div>
                <div style="display:flex; justify-content:space-between; align-items: center;">
                    <div style="font-size: 13px; color: #94a3b8;">
                        👍 ${comment.likes || 0} &nbsp;|&nbsp; 👎 ${comment.dislikes || 0}
                    </div>
                    <div style="display:flex; gap: 10px;">
                        <button onclick="toggleFeatureCoupon('${comment.id}', ${comment.is_featured})" style="background: rgba(245, 158, 11, 0.2); color: #fcd34d; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                            ${featuredBtnText}
                        </button>
                        <button onclick="deleteCouponComment('${comment.id}')" style="background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                            🗑️ حذف
                        </button>
                    </div>
                </div>
            `;
            list.appendChild(item);
        });
        
    } catch (e) {
        list.innerHTML = '<div style="color: #ef4444; text-align: center; padding: 20px;">تعذر تحميل التعليقات. هل أنشأت الجدول؟</div>';
    }
};

window.toggleFeatureCoupon = async function(id, currentState) {
    if (!confirm("هل أنت متأكد من تغيير حالة التثبيت لهذه القسيمة؟")) return;
    try {
        const { error } = await supabaseClient
            .from('coupon_comments')
            .update({ is_featured: !currentState })
            .eq('id', id);
        if (error) throw error;
        showToast("تم تحديث حالة القسيمة", "success");
        loadCouponComments();
    } catch (e) {
        showToast("حدث خطأ", "error");
    }
};

window.deleteCouponComment = async function(id) {
    if (!confirm("هل أنت متأكد من الحذف النهائي؟")) return;
    try {
        const { error } = await supabaseClient
            .from('coupon_comments')
            .delete()
            .eq('id', id);
        if (error) throw error;
        showToast("تم الحذف بنجاح", "success");
        loadCouponComments();
    } catch (e) {
        showToast("حدث خطأ أثناء الحذف", "error");
    }
};
