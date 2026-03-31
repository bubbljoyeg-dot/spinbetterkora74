// Supabase Configuration
const SUPABASE_URL = 'https://whwilmaizmfqgcgowrwf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indod2lsbWFpem1mcWdjZ293cndmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDQyNDcsImV4cCI6MjA5MDQ4MDI0N30.plNnsahhJPXPo6uNOrW2GwRSwAPVcDp2PEcSlb7Wgs0';

// ✅ FIX: إنشاء الكلاينت بشكل آمن مع رسالة خطأ واضحة
let supabaseClient;
try {
    if (!window.supabase) {
        throw new Error('مكتبة Supabase لم تُحمَّل. تأكد من اتصالك بالإنترنت وأن لا يوجد AdBlocker.');
    }
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
    console.error("Supabase failed to load:", e);
    document.addEventListener('DOMContentLoaded', () => {
        const err = document.getElementById('login-error');
        if (err) {
            err.innerText = '⚠️ تنبيه: لم يتم تحميل مكتبة قاعدة البيانات! إذا كنت تستخدم AdBlocker يرجى إيقافه وتحديث الصفحة.';
            err.style.display = 'block';
        }
    });
}

// ✅ FIX: انتظار تحميل الـ DOM بالكامل قبل ما نحاول نلاقي أي عناصر
document.addEventListener('DOMContentLoaded', function () {

    // DOM Elements
    const loginScreen = document.getElementById('login-screen');
    const dashboardScreen = document.getElementById('dashboard-screen');
    const logoutBtn = document.getElementById('logoutBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const ticketsTbody = document.getElementById('tickets-tbody');

    // ✅ FIX: فحص إن العناصر موجودة قبل استخدامها
    if (!loginScreen || !dashboardScreen) {
        console.error('عناصر HTML الأساسية غير موجودة! تأكد إن الـ HTML صح.');
        return;
    }

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
            console.error('Auth check error:', err);
            showLogin();
        }
    }

    // Login execution
    window.handleLogin = async function () {
        const emailInput = document.getElementById('admin-email');
        const passwordInput = document.getElementById('admin-password');
        const loginError = document.getElementById('login-error');
        const loginBtn = document.getElementById('loginBtn');
        const spinner = document.getElementById('loginSpinner');

        if (!emailInput || !passwordInput) return;

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        loginError.style.display = 'none';

        if (!email || !password) {
            loginError.innerText = 'يرجى إدخال البريد الإلكتروني وكلمة المرور.';
            loginError.style.display = 'block';
            return;
        }

        if (!supabaseClient) {
            loginError.innerText = 'لا يوجد اتصال بقاعدة البيانات. يرجى إيقاف AdBlocker وتحديث الصفحة.';
            loginError.style.display = 'block';
            return;
        }

        loginBtn.disabled = true;
        if (spinner) spinner.style.display = 'block';

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;

            currentAdminSession = data.session;
            showDashboard();
        } catch (err) {
            console.error("Login Error:", err);
            loginError.innerText = (err.message === 'Invalid login credentials')
                ? '❌ البريد الإلكتروني أو كلمة المرور غير صحيحة.'
                : '❌ خطأ: ' + err.message;
            loginError.style.display = 'block';
        } finally {
            loginBtn.disabled = false;
            if (spinner) spinner.style.display = 'none';
        }
    };

    // ✅ FIX: ربط زر الدخول بـ Enter
    const passwordInput = document.getElementById('admin-password');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') window.handleLogin();
        });
    }

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            currentAdminSession = null;
            showLogin();
        });
    }

    // Navigation
    function showLogin() {
        loginScreen.classList.add('active');
        dashboardScreen.classList.remove('active');
    }

    function showDashboard() {
        loginScreen.classList.remove('active');
        dashboardScreen.classList.add('active');
        const userDisplay = document.getElementById('admin-user-display');
        if (userDisplay && currentAdminSession) {
            userDisplay.innerText = currentAdminSession.user.email;
        }
        loadTickets();
    }

    // Load Tickets
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadTickets);
    }

    async function loadTickets() {
        if (!ticketsTbody) return;
        ticketsTbody.innerHTML = `<tr><td colspan="6" class="text-center">🔄 جاري تحميل البيانات...</td></tr>`;

        try {
            const { data: tickets, error } = await supabaseClient
                .from('support_tickets')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Update Stats
            const statTotal = document.getElementById('stat-total');
            const statPending = document.getElementById('stat-pending');
            const statReplied = document.getElementById('stat-replied');
            if (statTotal) statTotal.innerText = tickets.length;
            if (statPending) statPending.innerText = tickets.filter(t => t.status === 'قيد الانتظار').length;
            if (statReplied) statReplied.innerText = tickets.filter(t => t.status !== 'قيد الانتظار').length;

            // Render Table
            ticketsTbody.innerHTML = '';
            if (tickets.length === 0) {
                ticketsTbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color:var(--text-muted)">لا توجد تذاكر حالياً!</td></tr>`;
                return;
            }

            tickets.forEach(ticket => {
                const tr = document.createElement('tr');

                const d = new Date(ticket.created_at);
                const formattedDate = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;

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
            ticketsTbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color:var(--danger)">❌ فشل تحميل التذاكر: ${err.message}</td></tr>`;
        }
    }

    // Modal Logic
    function openModal(ticket) {
        currentViewingTicket = ticket;
        const modal = document.getElementById('ticket-modal');
        if (!modal) return;
        modal.classList.add('active');

        const d = new Date(ticket.created_at);
        document.getElementById('modal-track-code').innerText = ticket.tracking_code;
        document.getElementById('model-customer-name').innerText = ticket.customer_name;
        document.getElementById('model-date').innerText = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} - ${d.getHours()}:${d.getMinutes()}`;
        document.getElementById('model-issue-type').innerText = ticket.issue_type;
        document.getElementById('model-issue-desc').innerText = ticket.issue_description || 'العميل لم يكتب تفاصيل إضافية.';
        document.getElementById('model-status').innerText = ticket.status;

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

        document.getElementById('modal-status-select').value = ticket.status;
        document.getElementById('modal-admin-reply').value = ticket.admin_reply || '';
    }

    // Close Modal
    const closeBtn = document.querySelector('.close-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            document.getElementById('ticket-modal').classList.remove('active');
            currentViewingTicket = null;
        });
    }

    // ✅ FIX: إغلاق المودال بالنقر خارجه
    const modal = document.getElementById('ticket-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                currentViewingTicket = null;
            }
        });
    }

    // Update Ticket
    const saveBtn = document.getElementById('modal-save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            if (!currentViewingTicket) return;
            saveBtn.innerHTML = '⏳ جاري الحفظ...';
            saveBtn.disabled = true;

            const newStatus = document.getElementById('modal-status-select').value;
            const newReply = document.getElementById('modal-admin-reply').value;

            try {
                const { error } = await supabaseClient
                    .from('support_tickets')
                    .update({ status: newStatus, admin_reply: newReply })
                    .eq('id', currentViewingTicket.id);

                if (error) throw error;

                alert('✅ تم حفظ التعديلات والرد بنجاح!');
                document.getElementById('ticket-modal').classList.remove('active');
                loadTickets();
            } catch (err) {
                alert('❌ فشل حفظ البيانات: ' + err.message);
            } finally {
                saveBtn.innerHTML = '💾 حفظ التعديلات والرد';
                saveBtn.disabled = false;
            }
        });
    }

    // Delete Ticket
    const deleteBtn = document.getElementById('modal-delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            if (!currentViewingTicket) return;

            const confirmAsk = confirm('هل أنت متأكد من مسح هذه التذكرة نهائياً؟ لا يمكن التراجع عن هذا الإجراء.');
            if (!confirmAsk) return;

            deleteBtn.innerHTML = '⏳ جاري المسح...';
            deleteBtn.disabled = true;

            try {
                // ✅ FIX: حذف الصورة بشكل آمن لو موجودة
                if (currentViewingTicket.image_url) {
                    try {
                        const urlObj = new URL(currentViewingTicket.image_url);
                        const pathSegments = urlObj.pathname.split('/');
                        const ticketsIndex = pathSegments.indexOf('tickets');
                        if (ticketsIndex !== -1) {
                            const filePath = pathSegments.slice(ticketsIndex).join('/');
                            await supabaseClient.storage.from('ticket').remove([filePath]);
                        }
                    } catch (imgErr) {
                        console.warn('تعذر حذف الصورة (مش مشكلة كبيرة):', imgErr);
                    }
                }

                const { error } = await supabaseClient
                    .from('support_tickets')
                    .delete()
                    .eq('id', currentViewingTicket.id);

                if (error) throw error;

                alert('✅ تم مسح التذكرة بالكامل!');
                document.getElementById('ticket-modal').classList.remove('active');
                loadTickets();
            } catch (err) {
                alert('❌ فشل المسح: ' + err.message);
            } finally {
                deleteBtn.innerHTML = '🗑️ مسح التذكرة بالكامل';
                deleteBtn.disabled = false;
            }
        });
    }

    // Initialize
    checkAuth();

}); // end DOMContentLoaded
