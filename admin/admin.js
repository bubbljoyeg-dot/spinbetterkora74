// Supabase Configuration
const SUPABASE_URL = 'https://whwilmaizmfqgcgowrwf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indod2lsbWFpem1mcWdjZ293cndmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDQyNDcsImV4cCI6MjA5MDQ4MDI0N30.plNnsahhJPXPo6uNOrW2GwRSwAPVcDp2PEcSlb7Wgs0';

let supabaseClient;
try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
    console.error("Supabase failed to load:", e);
    alert("Warning: Database library failed to load! If you are using an AdBlocker, please disable it and ensure you have internet connection.");
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
            alert("Logged in but no active session found. You may need to confirm your email.");
        }
        
        currentAdminSession = data.session || { user: data.user || {email: email} };
        showDashboard();
    } catch (err) {
        console.error("Login Error:", err);
        loginError.innerText = (err.message === 'Invalid login credentials') 
            ? 'Error: Account not found or incorrect credentials.' 
            : 'Error: ' + err.message;
        loginError.style.display = 'block';
    } finally {
        if(document.getElementById('loginBtn')) document.getElementById('loginBtn').disabled = false;
        if(document.getElementById('loginSpinner')) document.getElementById('loginSpinner').style.display = 'none';
    }
    } catch (criticalErr) {
        alert("Unexpected processing error: " + criticalErr.message);
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
        alert("Error loading dashboard: " + e.message);
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
            alert('Error loading tickets: ' + error.message);
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
    if(fileInput) fileInput.value = '';
    if(fileNameDisplay) fileNameDisplay.innerText = '';
    
    // Setup Admin Inputs
    document.getElementById('modal-status-select').value = ticket.status;
    document.getElementById('modal-admin-reply').value = ticket.admin_reply || '';
}

// Listen to admin image selection
const adminImageInput = document.getElementById('admin-image-upload');
if(adminImageInput) {
    adminImageInput.addEventListener('change', (e) => {
        if(e.target.files && e.target.files[0]) {
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
        
        alert('Ticket successfully updated and resolution saved!');
        document.getElementById('ticket-modal').classList.remove('active');
        loadTickets(); // Refresh table
    } catch (err) {
        alert('Failed to save data: ' + err.message);
    } finally {
        btn.disabled = false;
        spinner.style.display = 'none';
    }
});

// Delete Ticket feature disabled in new UI as requested to prioritize reply/resolve flows.

// Initialize
checkAuth();
