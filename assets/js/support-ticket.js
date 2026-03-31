// Supabase Project Keys
const SUPABASE_URL = 'https://whwilmaizmfqgcgowrwf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indod2lsbWFpem1mcWdjZ293cndmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDQyNDcsImV4cCI6MjA5MDQ4MDI0N30.plNnsahhJPXPo6uNOrW2GwRSwAPVcDp2PEcSlb7Wgs0';

// Initialize Supabase Client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Client-Side Toast System
window.showToast = function(message, type = 'success') {
    let container = document.getElementById('sp-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'sp-toast-container';
        container.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    const bColor = type === 'error' ? '#ef4444' : (type === 'warning' ? '#eab308' : '#38bdf8');
    const icon = type === 'error' ? '❌' : (type === 'warning' ? '⚠️' : '✅');
    
    toast.style.cssText = `background:rgba(15,23,42,0.95); backdrop-filter:blur(10px); color:#fff; padding:15px 20px; border-radius:12px; border-right:4px solid ${bColor}; box-shadow:0 10px 25px rgba(0,0,0,0.5); display:flex; align-items:center; gap:12px; font-family:'Tajawal',sans-serif; font-weight:700; transform:translateX(-100%); opacity:0; transition:all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);`;
    toast.innerHTML = `<span style="font-size:18px">${icon}</span> <span>${message}</span>`;
    
    container.appendChild(toast);
    
    // Animate in
    setTimeout(() => { toast.style.transform = 'translateX(0)'; toast.style.opacity = '1'; }, 10);
    
    // Animate out
    setTimeout(() => {
        toast.style.transform = 'translateX(-100%)'; toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
};

// Tab Switching functionality
function switchTicketTab(tabId) {
    document.querySelectorAll('.ticket-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.ticket-tab-content').forEach(c => c.classList.remove('active'));
    
    if(tabId === 'create') {
        document.querySelector('.ticket-tab:nth-child(1)').classList.add('active');
        document.getElementById('tab-create').classList.add('active');
    } else {
        document.querySelector('.ticket-tab:nth-child(2)').classList.add('active');
        document.getElementById('tab-track').classList.add('active');
        renderSavedTickets();
    }
}

// LocalStorage Logic (Max 2 Tickets)
function getSavedTickets() {
    try {
        const data = localStorage.getItem('spinbetter_user_tickets');
        if (data) return JSON.parse(data);
    } catch (e) {}
    return [];
}

function saveTicketToLocal(code) {
    let tickets = getSavedTickets();
    if (!tickets.includes(code)) {
        tickets.push(code);
        if (tickets.length > 2) tickets.shift(); // Keep only last 2 tickets as requested
        localStorage.setItem('spinbetter_user_tickets', JSON.stringify(tickets));
    }
}

function renderSavedTickets() {
    const list = document.getElementById('saved-tickets-list');
    const container = document.getElementById('saved-tickets-container');
    if(!list || !container) return;
    
    const tickets = getSavedTickets();
    if (tickets.length > 0) {
        list.innerHTML = '';
        tickets.forEach(code => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.style = 'padding: 14px 20px; border-radius: 12px; border: 1px solid var(--accent); background: rgba(56, 189, 248, 0.08); color: #fff; cursor: pointer; text-align: right; display: flex; justify-content: space-between; align-items: center; font-weight: bold; font-family: var(--font-family); font-size: 15px; transition: all 0.3s; box-shadow: 0 4px 10px rgba(0,0,0,0.2);';
            btn.onmouseover = () => { btn.style.background = 'rgba(56, 189, 248, 0.15)'; btn.style.transform = 'translateY(-2px)' };
            btn.onmouseout = () => { btn.style.background = 'rgba(56, 189, 248, 0.08)'; btn.style.transform = 'translateY(0)' };
            btn.innerHTML = `<span style="display:flex; align-items:center; gap:8px;">🎫 تذكرة ${code}</span> <span style="font-size:13px; color:var(--accent); background:rgba(0,0,0,0.5); padding:6px 12px; border-radius:8px;">استعلام فوري</span>`;
            btn.onclick = () => {
                document.getElementById('track-code').value = code;
                const form = document.getElementById('track-ticket-form');
                if(form) form.dispatchEvent(new Event('submit'));
            };
            list.appendChild(btn);
        });
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
    }
}

// Auto-load Track Tab if tickets exist
document.addEventListener('DOMContentLoaded', () => {
    if (getSavedTickets().length > 0 && window.location.pathname.includes('support')) {
        switchTicketTab('track');
    }
});

// Image Preview functionality
const fileInput = document.getElementById('ticket-image');
const previewImage = document.getElementById('preview-image');
const uploadPlaceholder = document.getElementById('upload-placeholder');

if (fileInput) {
    fileInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            const file = this.files[0];
            // Check size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                showToast('عذراً، حجم الصورة يجب ألا يتعدى 5 ميجابايت.', 'warning');
                this.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = function(e) {
                previewImage.src = e.target.result;
                previewImage.style.display = 'block';
                uploadPlaceholder.style.display = 'none';
            }
            reader.readAsDataURL(file);
        } else {
            previewImage.style.display = 'none';
            uploadPlaceholder.style.display = 'block';
        }
    });
}

// Generate Tracking Code
function generateTrackingCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'TCK-';
    for ( let i = 0; i < 6; i++ ) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Form Submission - Create Ticket
const createForm = document.getElementById('create-ticket-form');
if (createForm) {
    createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('ticket-name').value.trim();
        const issue = document.getElementById('ticket-issue').value;
        const message = document.getElementById('ticket-message').value.trim();
        const file = document.getElementById('ticket-image').files[0];
        
        const submitBtn = document.getElementById('submitBtn');
        const spinner = document.getElementById('submitSpinner');
        const resultDiv = document.getElementById('ticket-result');
        
        submitBtn.disabled = true;
        spinner.style.display = 'block';
        resultDiv.style.display = 'none';
        resultDiv.className = 'ticket-result';
        
        if (!name || name.length < 2 || !issue || !message || message.length < 5) {
            resultDiv.classList.add('error');
            resultDiv.innerHTML = `❌ الرجاء إدخال اسمك الحقيقي، واختيار نوع المشكلة، وكتابة مسودة عن التفاصيل (5 أحرف على الأقل).`;
            resultDiv.style.display = 'block';
            submitBtn.disabled = false;
            spinner.style.display = 'none';
            return;
        }
        
        try {
            // Upload Image (Optional)
            let imageUrl = null;
            if (file) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                const filePath = `tickets/${fileName}`; 
                
                const { data: uploadData, error: uploadError } = await supabaseClient
                    .storage
                    .from('ticket-images')
                    .upload(filePath, file);
                    
                if (uploadError) throw uploadError;
                
                // Get public URL
                const { data: publicUrlData } = supabaseClient.storage.from('ticket-images').getPublicUrl(filePath);
                imageUrl = publicUrlData.publicUrl;
            }
            
            // Generate tracking code
            const trackingCode = generateTrackingCode();
            
            // Save to database
            const { error: dbError } = await supabaseClient
                .from('support_tickets')
                .insert([
                    {
                        tracking_code: trackingCode,
                        customer_name: name,
                        issue_type: issue,
                        issue_description: message,
                        image_url: imageUrl,
                        status: 'قيد الانتظار' // Default
                    }
                ]);
                
            if (dbError) throw dbError;
            
            // Save to LocalStorage
            saveTicketToLocal(trackingCode);
            
            // Success Card UI
            resultDiv.classList.add('success');
            resultDiv.style.background = 'rgba(34, 197, 94, 0.1)';
            resultDiv.style.border = '1px solid #22c55e';
            resultDiv.style.padding = '25px';
            resultDiv.style.borderRadius = '12px';
            resultDiv.innerHTML = `
                <div style="font-size: 24px; margin-bottom: 10px;">✨</div>
                <div style="font-size: 20px; font-weight: 800; margin-bottom: 8px; color:#fff;">تم تسلّم طلبك بنجاح!</div>
                <div style="color:var(--text-muted); font-size:15px; margin-bottom: 15px;">شكراً لتواصلك معنا. هذا هو الكود المرجعي لطلبك، وقد تم حفظه تلقائياً في جهازك لمتابعته لاحقاً متى شئت.</div>
                
                <div style="background: rgba(0,0,0,0.5); border: 1px dashed var(--accent); padding: 15px; border-radius: 8px; display: inline-flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                    <strong style="font-size: 24px; color: var(--accent); font-family: monospace; letter-spacing: 2px;">${trackingCode}</strong>
                    <button type="button" onclick="navigator.clipboard.writeText('${trackingCode}'); this.innerText='تم النسخ!'; setTimeout(()=>this.innerText='نسخ الكود', 2000);" style="background:var(--accent); color:#000; border:none; padding:8px 12px; border-radius:6px; font-weight:bold; cursor:pointer; font-family:var(--font-family);">نسخ الكود</button>
                </div>
                
                <div style="font-size: 14px; color:#fff; font-weight: 600;">سيقوم الدعم الفني بالرد عليك في أسرع وقت. يمكنك مراجعة الرد من خانة (متابعة حالة التذكرة).</div>
            `;
            resultDiv.style.display = 'block';
            
            createForm.reset();
            previewImage.style.display = 'none';
            uploadPlaceholder.style.display = 'block';
            
        } catch (error) {
            console.error(error);
            resultDiv.classList.add('error');
            let errMsg = error.message || JSON.stringify(error);
            resultDiv.innerHTML = `❌ فشل الإرسال! السبب من الداتا بيز:<br><br><span style="color:#ffcc00; font-family:monospace; font-size:12px;">${errMsg}</span>`;
            resultDiv.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            spinner.style.display = 'none';
        }
    });
}

// Form Submission - Track Ticket
const trackForm = document.getElementById('track-ticket-form');
if (trackForm) {
    trackForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const codeInput = document.getElementById('track-code').value.trim().toUpperCase();
        
        const trackBtn = document.getElementById('trackBtn');
        const spinner = document.getElementById('trackSpinner');
        const resultDiv = document.getElementById('track-result');
        const detailsCard = document.getElementById('ticket-details-card');
        
        trackBtn.disabled = true;
        spinner.style.display = 'block';
        resultDiv.style.display = 'none';
        detailsCard.style.display = 'none';
        resultDiv.className = 'ticket-tracking-result';
        
        try {
            const { data, error } = await supabaseClient
                .from('support_tickets')
                .select('*')
                .eq('tracking_code', codeInput)
                .single();
                
            if (error || !data) {
                resultDiv.classList.add('error');
                resultDiv.innerHTML = `❌ لم يتم العثور على تذكرة بهذا الرقم. تآكد من رقم التذكرة.`;
                resultDiv.style.display = 'block';
            } else {
                // Populate details
                document.getElementById('detail-code').innerText = data.tracking_code;
                document.getElementById('detail-name').innerText = data.customer_name;
                document.getElementById('detail-issue').innerText = data.issue_type;
                
                const statusSpan = document.getElementById('detail-status');
                statusSpan.innerText = data.status;
                
                // Color formatting
                statusSpan.className = 'status-badge';
                if (data.status === 'قيد الانتظار') {
                    statusSpan.classList.add('status-pending');
                } else if (data.status === 'تم الرد' || data.status === 'مغلقة' || data.status === 'تم الحل') {
                    statusSpan.classList.add('status-replied');
                } else {
                    statusSpan.style.background = 'rgba(255,255,255,0.1)';
                    statusSpan.style.border = '1px solid #fff';
                }
                
                const replySection = document.getElementById('detail-reply-section');
                const replyContent = document.getElementById('detail-reply');
                replyContent.innerHTML = ''; // Clear previous content
                
                let hasReply = false;
                
                if (data.admin_reply && data.admin_reply.trim() !== '') {
                    const textDiv = document.createElement('div');
                    textDiv.innerText = data.admin_reply;
                    replyContent.appendChild(textDiv);
                    hasReply = true;
                }
                
                if (data.admin_image_url) {
                    const imgDiv = document.createElement('div');
                    imgDiv.style.marginTop = '15px';
                    imgDiv.style.textAlign = 'center';
                    const img = document.createElement('img');
                    img.src = data.admin_image_url;
                    img.style.maxWidth = '100%';
                    img.style.borderRadius = '8px';
                    img.style.border = '1px solid rgba(255,255,255,0.1)';
                    const aLink = document.createElement('a');
                    aLink.href = data.admin_image_url;
                    aLink.target = '_blank';
                    aLink.appendChild(img);
                    imgDiv.appendChild(aLink);
                    replyContent.appendChild(imgDiv);
                    hasReply = true;
                }
                
                if (hasReply) {
                    replySection.style.display = 'block';
                } else {
                    replySection.style.display = 'none';
                }
                
                detailsCard.style.display = 'block';
            }
        } catch (error) {
            console.error(error);
            resultDiv.classList.add('error');
            let errMsg = error.message || JSON.stringify(error);
            resultDiv.innerHTML = `❌ حدث خطأ بالاتصال بالداتا بيز:<br><br><span style="color:#ffcc00; font-family:monospace; font-size:12px;">${errMsg}</span>`;
            resultDiv.style.display = 'block';
        } finally {
            trackBtn.disabled = false;
            spinner.style.display = 'none';
        }
    });
}
