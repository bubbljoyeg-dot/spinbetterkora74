// Supabase Configuration
const SUPABASE_URL = 'https://whwilmaizmfqgcgowrwf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indod2lsbWFpem1mcWdjZ293cndmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDQyNDcsImV4cCI6MjA5MDQ4MDI0N30.plNnsahhJPXPo6uNOrW2GwRSwAPVcDp2PEcSlb7Wgs0';

let supabaseClient;
try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
    console.error("Supabase failed to load:", e);
    alert("تنبيه: لم يتم تحميل مكتبة قاعدة البيانات! إذا كنت تستخدم إضافة لمنع الإعلانات (AdBlocker) يرجى إيقافها، وتأكد من اتصالك بالإنترنت.");
}

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
    } catch(err) {
        showLogin();
    }
}

// Login execution
window.handleLogin = async function() {
    try {
        const email = document.getElementById('admin-email').value;
        const password = document.getElementById('admin-password').value;
        const loginError = document.getElementById('login-error');
        const loginBtn = document.getElementById('loginBtn');
        const spinner = document.getElementById('loginSpinner');
        
        loginError.style.display = 'none';
        
        if (!email || !password) {
            loginError.innerText = 'يرجى إدخال البريد الإلكتروني وكلمة المرور.';
            loginError.style.display = 'block';
            return;
        }
        
        if (!supabaseClient) {
            loginError.innerText = 'يوجد مانع إعلانات (AdBlocker) يوقف السكربت أو لا يوجد اتصال إنترنت. يرجى إيقافه وتحديث الصفحة.';
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
            alert("تم تسجيل الدخول لكن لا توجد جلسة نشطة (Session). قد تحتاج لتأكيد إيميلك.");
        }
        
        currentAdminSession = data.session || { user: data.user || {email: email} };
        showDashboard();
    } catch (err) {
        console.error("Login Error:", err);
        loginError.innerText = (err.message === 'Invalid login credentials') 
            ? 'خطأ: لم يتم العثور على هذا الحساب أو نسيان كلمة المرور.' 
            : 'عذراً: ' + err.message;
        loginError.style.display = 'block';
    } finally {
        if(document.getElementById('loginBtn')) document.getElementById('loginBtn').disabled = false;
        if(document.getElementById('loginSpinner')) document.getElementById('loginSpinner').style.display = 'none';
    }
    } catch (criticalErr) {
        alert("حدث خطأ غير متوقع أثناء المعالجة: " + criticalErr.message);
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
        
        document.getElementById('admin-user-display').innerText = userEmail;
        loadTickets();
    } catch (e) {
        alert("حدث خطأ أثناء فتح اللوحة: " + e.message);
    }
}

// Load Tickets Logic
refreshBtn.addEventListener('click', loadTickets);

async function loadTickets() {
    ticketsTbody.innerHTML = `<tr><td colspan="6" class="text-center">🔄 جاري تحميل البيانات...</td></tr>`;
    try {
        const { data: tickets, error } = await supabaseClient
            .from('support_tickets')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) {
            alert('خطأ في تحميل التذاكر: ' + error.message);
            throw error;
        }
        
        // Update Stats
        document.getElementById('stat-total').innerText = tickets.length;
        document.getElementById('stat-pending').innerText = tickets.filter(t => t.status === 'قيد الانتظار').length;
        document.getElementById('stat-replied').innerText = tickets.filter(t => t.status !== 'قيد الانتظار').length;
        
        // Render Table
        ticketsTbody.innerHTML = '';
        if (tickets.length === 0) {
            ticketsTbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color:var(--text-muted)">لا توجد تذاكر حالياً!</td></tr>`;
            return;
        }
        
        tickets.forEach(ticket => {
            const tr = document.createElement('tr');
            
            // Format Date
            const d = new Date(ticket.created_at);
            const formattedDate = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
            
            // Status Badge Formatting
            let badgeClass = 'badge';
            if (ticket.status === 'قيد الانتظار') badgeClass += ' badge-pending';
            else badgeClass += ' badge-replied';
            
            tr.innerHTML = `
                <td><strong style="color:var(--accent);">${ticket.tracking_code}</strong></td>
                <td style="color:var(--text-muted);">${formattedDate}</td>
                <td>${ticket.customer_name}</td>
                <td>${ticket.issue_type}</td>
                <td><span class="${badgeClass}">${ticket.status}</span></td>
                <td>
                    <button class="btn btn-secondary btn-sm review-btn">مراجعة ورد</button>
                </td>
            `;
            
            tr.querySelector('.review-btn').addEventListener('click', () => openModal(ticket));
            ticketsTbody.appendChild(tr);
        });
        
    } catch (err) {
        console.error(err);
        ticketsTbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color:var(--danger)">فشل تحميل التذاكر!</td></tr>`;
    }
}

// Modal Logic
function openModal(ticket) {
    currentViewingTicket = ticket;
    document.getElementById('ticket-modal').classList.add('active');
    
    const d = new Date(ticket.created_at);
    document.getElementById('modal-track-code').innerText = ticket.tracking_code;
    document.getElementById('model-customer-name').innerText = ticket.customer_name;
    document.getElementById('model-date').innerText = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} - ${d.getHours()}:${d.getMinutes()}`;
    document.getElementById('model-issue-type').innerText = ticket.issue_type;
    document.getElementById('model-issue-desc').innerText = ticket.issue_description || 'العميل لم يكتب تفاصيل إضافية.';
    document.getElementById('model-status').innerText = ticket.status;
    
    // Setup Image
    const imgEl = document.getElementById('modal-image');
    const linkEl = document.getElementById('modal-image-link');
    if (ticket.image_url) {
        imgEl.src = ticket.image_url;
        linkEl.href = ticket.image_url;
        imgEl.style.display = 'block';
    } else {
        imgEl.style.display = 'none';
        linkEl.href = '#';
    }
    
    // Setup Admin Inputs
    document.getElementById('modal-status-select').value = ticket.status;
    document.getElementById('modal-admin-reply').value = ticket.admin_reply || '';
}

// Close Modal
document.querySelector('.close-modal').addEventListener('click', () => {
    document.getElementById('ticket-modal').classList.remove('active');
    currentViewingTicket = null;
});

// Update Ticket (Reply / Save)
document.getElementById('modal-save-btn').addEventListener('click', async () => {
    if (!currentViewingTicket) return;
    const btn = document.getElementById('modal-save-btn');
    btn.innerHTML = 'جاري الحفظ...';
    btn.disabled = true;
    
    const newStatus = document.getElementById('modal-status-select').value;
    const newReply = document.getElementById('modal-admin-reply').value;
    
    try {
        const { error } = await supabaseClient
            .from('support_tickets')
            .update({ status: newStatus, admin_reply: newReply })
            .eq('id', currentViewingTicket.id);
            
        if (error) throw error;
        
        alert('تم حفظ التعديلات والرد بنجاح!');
        document.getElementById('ticket-modal').classList.remove('active');
        loadTickets(); // Refresh table
    } catch (err) {
        alert('فشل حفظ البيانات: ' + err.message);
    } finally {
        btn.innerHTML = '💾 حفظ التعديلات والرد';
        btn.disabled = false;
    }
});

// Delete Ticket
document.getElementById('modal-delete-btn').addEventListener('click', async () => {
    if (!currentViewingTicket) return;
    
    const confirmAsk = confirm('هل أنت متأكد من مسح هذه التذكرة نهائياً؟ لا يمكن التراجع عن هذا الإجراء.');
    if (!confirmAsk) return;
    
    const btn = document.getElementById('modal-delete-btn');
    btn.innerHTML = 'جاري المسح...';
    btn.disabled = true;
    
    try {
        // Attempt to extract image path to delete from storage
        if (currentViewingTicket.image_url) {
            const urlObj = new URL(currentViewingTicket.image_url);
            const pathSegments = urlObj.pathname.split('/');
            // public/ticket-images/tickets/xxx.jpg
            const ticketsIndex = pathSegments.indexOf('tickets');
            if (ticketsIndex !== -1) {
                const filePath = pathSegments.slice(ticketsIndex).join('/'); // outputs: tickets/xxx.jpg
                await supabaseClient.storage.from('ticket-images').remove([filePath]);
            }
        }
        
        // Delete from Database
        const { error } = await supabaseClient
            .from('support_tickets')
            .delete()
            .eq('id', currentViewingTicket.id);
            
        if (error) throw error;
        
        alert('تم مسح التذكرة بالكامل!');
        document.getElementById('ticket-modal').classList.remove('active');
        loadTickets(); // Refresh table
    } catch (err) {
        alert('فشل المسح: ' + err.message);
    } finally {
        btn.innerHTML = '🗑️ مسح التذكرة بالكامل';
        btn.disabled = false;
    }
});

// Initialize
checkAuth();
