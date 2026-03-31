// Supabase Project Keys
const SUPABASE_URL = 'https://whwilmaizmfqgcgowrwf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indod2lsbWFpem1mcWdjZ293cndmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDQyNDcsImV4cCI6MjA5MDQ4MDI0N30.plNnsahhJPXPo6uNOrW2GwRSwAPVcDp2PEcSlb7Wgs0';

// Initialize Supabase Client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    }
}

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
                alert('عذراً، حجم الصورة يجب ألا يتعدى 5 ميجابايت.');
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
    for (let i = 0; i < 6; i++) {
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
        // ✅ FIX: الصورة اختيارية - مش إجبارية
        const file = document.getElementById('ticket-image').files[0] || null;

        const submitBtn = document.getElementById('submitBtn');
        const spinner = document.getElementById('submitSpinner');
        const resultDiv = document.getElementById('ticket-result');

        // ✅ FIX: Validation قبل ما نبعت أي حاجة
        if (!name) {
            resultDiv.className = 'ticket-result error';
            resultDiv.innerHTML = '⚠️ يرجى كتابة اسمك أولاً.';
            resultDiv.style.display = 'block';
            return;
        }
        if (!issue || issue === '' || issue === 'اختر نوع المشكلة') {
            resultDiv.className = 'ticket-result error';
            resultDiv.innerHTML = '⚠️ يرجى اختيار نوع المشكلة.';
            resultDiv.style.display = 'block';
            return;
        }

        submitBtn.disabled = true;
        spinner.style.display = 'block';
        resultDiv.style.display = 'none';
        resultDiv.className = 'ticket-result';

        try {
            // ✅ FIX: رفع الصورة بس لو موجودة
            let imageUrl = null;
            if (file) {
                const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                if (!allowedTypes.includes(file.type)) {
                    throw new Error('نوع الملف غير مدعوم. يرجى رفع صورة بصيغة JPG أو PNG أو GIF.');
                }

                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                const filePath = `tickets/${fileName}`;

                const { data: uploadData, error: uploadError } = await supabaseClient
                    .storage
                    .from('ticket')
                    .upload(filePath, file);

                if (uploadError) throw new Error('فشل رفع الصورة: ' + uploadError.message);

                const { data: publicUrlData } = supabaseClient.storage.from('ticket').getPublicUrl(filePath);
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
                        image_url: imageUrl, // ✅ هيكون null لو مفيش صورة - وده مقبول
                        status: 'قيد الانتظار'
                    }
                ]);

            if (dbError) throw new Error('فشل حفظ التذكرة: ' + dbError.message);

            // Success
            resultDiv.classList.add('success');
            resultDiv.innerHTML = `
                <div style="font-size: 20px; font-weight: bold; margin-bottom: 5px;">✅ تم استلام تذكرتك بنجاح</div>
                <div>الرجاء الاحتفاظ برقم التذكرة التالي لمتابعة الرد:</div>
                <div class="tracking-code-display">${trackingCode}</div>
                <div style="font-size: 14px;">(يرجى الانتظار من 1 إلى 6 ساعات للرد)</div>
            `;
            resultDiv.style.display = 'block';
            createForm.reset();
            if (previewImage) previewImage.style.display = 'none';
            if (uploadPlaceholder) uploadPlaceholder.style.display = 'block';

        } catch (error) {
            console.error(error);
            resultDiv.classList.add('error');
            let errMsg = error.message || JSON.stringify(error);
            resultDiv.innerHTML = `❌ فشل الإرسال!<br><br><span style="color:#ffcc00; font-family:monospace; font-size:12px;">${errMsg}</span>`;
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

        // ✅ FIX: Validation للكود
        if (!codeInput || codeInput.length < 5) {
            resultDiv.className = 'ticket-tracking-result error';
            resultDiv.innerHTML = '⚠️ يرجى إدخال رقم التذكرة كاملاً.';
            resultDiv.style.display = 'block';
            return;
        }

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

            // ✅ FIX: error من supabase لما مش لاقي record بييجي كـ PGRST116
            // مش لازم نعامله كـ crash - ده expected behavior
            if (!data) {
                resultDiv.classList.add('error');
                resultDiv.innerHTML = `❌ لم يتم العثور على تذكرة بهذا الرقم. تأكد من رقم التذكرة.`;
                resultDiv.style.display = 'block';
                return;
            }

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
            if (data.admin_reply && data.admin_reply.trim() !== '') {
                document.getElementById('detail-reply').innerText = data.admin_reply;
                replySection.style.display = 'block';
            } else {
                replySection.style.display = 'none';
            }

            detailsCard.style.display = 'block';

        } catch (error) {
            console.error(error);
            resultDiv.classList.add('error');
            let errMsg = error.message || JSON.stringify(error);
            resultDiv.innerHTML = `❌ حدث خطأ بالاتصال بقاعدة البيانات:<br><br><span style="color:#ffcc00; font-family:monospace; font-size:12px;">${errMsg}</span>`;
            resultDiv.style.display = 'block';
        } finally {
            trackBtn.disabled = false;
            spinner.style.display = 'none';
        }
    });
}
