/*
===================================================================
SQL COMMANDS FOR SUPABASE (Run these in the SQL Editor)
===================================================================
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT CHECK (category IN ('news', 'prediction', 'analysis')) NOT NULL,
  cover_image_url TEXT,
  cta_text TEXT,
  cta_url TEXT,
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
logoutBtn.addEventListener('click', async () => {
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
refreshBtn.addEventListener('click', loadTickets);

async function loadTickets() {
    ticketsTbody.innerHTML = `<tr><td colspan="6" class="text-center">🔄 Loading data...</td></tr>`;
    try {
        const { data: tickets, error } = await supabaseClient
            .from('support_tickets')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            showToast('Error loading tickets: ' + error.message, 'error');
            throw error;
        }

        // Update Stats
        document.getElementById('total-count').innerText = tickets.length;
        document.getElementById('pending-count').innerText = tickets.filter(t => t.status === 'قيد الانتظار').length;
        document.getElementById('resolved-count').innerText = tickets.filter(t => t.status !== 'قيد الانتظار').length;

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
document.getElementById('closeModalBtn').addEventListener('click', closeModal);
document.getElementById('closeModalBtnFooter').addEventListener('click', closeModal);

function closeModal() {
    document.getElementById('ticket-modal').classList.remove('active');
    currentViewingTicket = null;
}

// Update Ticket (Reply / Save)
document.getElementById('saveReplyBtn').addEventListener('click', async () => {
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

        const confirmDelete = confirm("Are you sure you want to PERMANENTLY delete this ticket?");
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

function showSection(sectionName) {
    // Determine menus
    const navDashboard = document.getElementById('nav-dashboard');
    const navPosts = document.getElementById('nav-posts');

    // Determine sections
    const secDashboard = document.getElementById('dashboard-section');
    const secPosts = document.getElementById('posts-section');

    // Reset Views
    if (navDashboard) navDashboard.classList.remove('active');
    if (navPosts) navPosts.classList.remove('active');
    if (secDashboard) secDashboard.style.display = 'none';
    if (secPosts) secPosts.style.display = 'none';

    if (sectionName === 'dashboard') {
        if (navDashboard) navDashboard.classList.add('active');
        if (secDashboard) secDashboard.style.display = 'block';
    } else if (sectionName === 'posts') {
        if (navPosts) navPosts.classList.add('active');
        if (secPosts) secPosts.style.display = 'block';
        loadPosts();
    }

    if (window.innerWidth <= 768) {
        closeAdminSidebar();
    }
}

async function loadPosts() {
    const tbody = document.getElementById('posts-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">جاري تحميل المقالات...</td></tr>';

    try {
        const { data: posts, error } = await supabaseClient
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });

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

            // Format Category Badge
            let catName = 'أخبار', catColor = '#3b82f6';
            if (post.category === 'prediction') { catName = 'توقعات'; catColor = '#f59e0b'; }
            if (post.category === 'analysis') { catName = 'تحليل'; catColor = '#8b5cf6'; }

            // Format Status Badge
            const statusText = post.published ? 'منشور' : 'مسودة';
            const statusClass = post.published ? 'badge-replied' : 'badge-pending';

            tr.innerHTML = `
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
    if (!quillEditor) {
        quillEditor = new Quill('#quill-editor', {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'color': [] }, { 'background': [] }],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    [{ 'align': [] }],
                    ['link', 'image', 'video'],
                    ['clean']
                ]
            }
        });
        quillEditor.format('direction', 'rtl');
        quillEditor.format('align', 'right');
    }
}

function openPostModal(post = null) {
    document.getElementById('post-modal').classList.add('active');
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
            imgCurrent.innerHTML = `<img src="${post.cover_image_url}" style="max-width: 200px; max-height: 120px; border-radius: 8px; border: 1px solid #333;" alt="Cover">`;
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
    document.getElementById('post-modal').classList.remove('active');
    currentEditingPostId = null;
}

document.getElementById('closePostModalBtn').addEventListener('click', closePostModal);

const postImageInput = document.getElementById('post-image-upload');
if (postImageInput) {
    postImageInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            document.getElementById('post-upload-filename').innerText = "تم اختيار الصورة: " + e.target.files[0].name;
            document.getElementById('post-current-image').innerHTML = ''; // Hide old image preview
        }
    });
}

async function savePost() {
    const title = document.getElementById('post-title').value.trim();
    const category = document.getElementById('post-category').value;
    const content = quillEditor.root.innerHTML;
    const published = document.getElementById('post-published').checked;
    const imageFile = document.getElementById('post-image-upload').files[0];
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
        if (imageFile) {
            const fileExt = imageFile.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `covers/${fileName}`;

            const { data: uploadData, error: uploadError } = await supabaseClient
                .storage
                .from('post-images')
                .upload(filePath, imageFile);

            if (uploadError) throw new Error("فشل رفع الصورة: " + uploadError.message);

            const { data: publicUrlData } = supabaseClient.storage.from('post-images').getPublicUrl(filePath);
            coverImageUrl = publicUrlData.publicUrl;
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
    const confirmDelete = confirm("هل أنت متأكد من حذف هذا المقال نهائياً؟");
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
    
    // We insert a placeholder quote for the admin to see visually
    const blockquote = `<blockquote>⚽ <strong>مباراة مدرجة:</strong> ${f.teams.home.name} ضد ${f.teams.away.name} <br><br><span style="font-size:8px;color:rgba(255,255,255,0.1);word-break:break-all;">${shortcodeText}</span></blockquote><p><br></p>`;

    const range = quillEditor.getSelection();
    const index = range ? range.index : quillEditor.getLength();
    quillEditor.clipboard.dangerouslyPasteHTML(index, blockquote);
    quillEditor.setSelection(quillEditor.getLength(), 0);

    showToast(`✅ تم إدراج مباراة ${f.teams.home.name} vs ${f.teams.away.name}`, 'success');
}