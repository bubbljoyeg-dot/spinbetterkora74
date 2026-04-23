const SUPABASE_URL = 'https://whwilmaizmfqgcgowrwf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indod2lsbWFpem1mcWdjZ293cndmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDQyNDcsImV4cCI6MjA5MDQ4MDI0N30.plNnsahhJPXPo6uNOrW2GwRSwAPVcDp2PEcSlb7Wgs0';

document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log("Coupon JS Initializing...");
        const revealBtn = document.getElementById('couponRevealBtn');
        const revealedState = document.getElementById('couponRevealedState');
        const codeDisplay = document.getElementById('dailyCode');
        const descDisplay = document.getElementById('dailyDesc');
        const copyBtn = document.getElementById('copyBtn');
        
        let currentCouponCode = 'SPINBETTER2024';
        let currentCouponDesc = 'استخدم هذا الكود عند التسجيل للحصول على مكافأتك!';

        if (revealBtn && revealedState) {
            revealBtn.addEventListener('click', () => {
                revealBtn.style.display = 'none';
                revealedState.style.display = 'block';
            });
        }

        async function fetchDailyCoupon() {
            try {
                const res = await fetch(`${SUPABASE_URL}/rest/v1/daily_coupons?active=eq.true&order=created_at.desc&limit=1`, {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                    }
                });
                
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.length > 0) {
                        currentCouponCode = data[0].code;
                        currentCouponDesc = data[0].description || currentCouponDesc;
                        if(codeDisplay) codeDisplay.textContent = currentCouponCode;
                        if(descDisplay) descDisplay.textContent = currentCouponDesc;
                    }
                }
            } catch (e) {
                console.error('Failed to fetch daily coupon', e);
            }
        }

        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(currentCouponCode).then(() => {
                    const originalHTML = copyBtn.innerHTML;
                    copyBtn.innerHTML = 'تم النسخ! ✅';
                    copyBtn.classList.add('copied');
                    setTimeout(() => {
                        copyBtn.innerHTML = originalHTML;
                        copyBtn.classList.remove('copied');
                    }, 2000);
                }).catch(e => {
                    alert('فشل النسخ! يرجى النسخ يدويا.');
                });
            });
        }

        const commentsList = document.getElementById('commentsList');
        const submitBtn = document.getElementById('submitCommentBtn');
        const authorInput = document.getElementById('commentAuthorName');
        const bodyInput = document.getElementById('commentBody');

        function getVotedComments() {
            try {
                const stored = localStorage.getItem('coupon_votes');
                return stored ? JSON.parse(stored) : {};
            } catch(e) { return {}; }
        }

        function setVotedComment(id, type) {
            try {
                const stored = getVotedComments();
                stored[id] = type;
                localStorage.setItem('coupon_votes', JSON.stringify(stored));
            } catch(e) {}
        }

        async function loadComments() {
            if (!commentsList) return;
            try {
                const res = await fetch(`${SUPABASE_URL}/rest/v1/coupon_comments?order=is_featured.desc,likes.desc,created_at.desc`, {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                    }
                });
                
                if (!res.ok) {
                    commentsList.innerHTML = '<div class="loading-comments">لا توجد تعليقات حتى الآن. كن أول من يشارك قسيمتك!</div>';
                    return;
                }

                const data = await res.json();
                if (!data || data.length === 0) {
                    commentsList.innerHTML = '<div class="loading-comments">لا توجد تعليقات حتى الآن. كن أول من يشارك قسيمتك!</div>';
                    return;
                }

                commentsList.innerHTML = '';
                const votedState = getVotedComments();

                data.forEach(comment => {
                    const isUpvoted = votedState[comment.id] === 'up';
                    const isDownvoted = votedState[comment.id] === 'down';
                    const featuredBadge = comment.is_featured ? '<span class="featured-badge">⭐ تثبيت الإدارة</span>' : '';
                    const featuredClass = comment.is_featured ? 'featured' : '';
                    
                    const dateObj = new Date(comment.created_at);
                    const dateStr = dateObj.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });

                    const card = document.createElement('div');
                    card.className = `comment-card ${featuredClass}`;
                    card.innerHTML = `
                        <div class="comment-header">
                            <div class="comment-author">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                                ${comment.author_name}
                                ${featuredBadge}
                            </div>
                            <div class="comment-date">${dateStr}</div>
                        </div>
                        <div class="comment-body">${comment.content}</div>
                        <div class="comment-actions">
                            <button class="vote-btn ${isUpvoted ? 'upvoted' : ''}" onclick="voteComment('${comment.id}', 'up', this)" ${isUpvoted || isDownvoted ? 'disabled' : ''}>
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                                </svg>
                                <span class="like-count">${comment.likes || 0}</span>
                            </button>
                            <button class="vote-btn ${isDownvoted ? 'downvoted' : ''}" onclick="voteComment('${comment.id}', 'down', this)" ${isUpvoted || isDownvoted ? 'disabled' : ''}>
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(180deg);">
                                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                                </svg>
                                <span class="dislike-count">${comment.dislikes || 0}</span>
                            </button>
                        </div>
                    `;
                    commentsList.appendChild(card);
                });

            } catch (e) {
                if(commentsList) commentsList.innerHTML = '<div class="loading-comments">تم قطع الاتصال بالسيرفر. يرجى المحاولة بعد قليل...</div>';
            }
        }

        if (submitBtn) {
            submitBtn.addEventListener('click', async () => {
                const name = authorInput.value.trim() || 'زائر مجهول';
                const body = bodyInput.value.trim();

                if (!body) {
                    alert('الرجاء كتابة كود القسيمة أو التعليق.');
                    return;
                }

                submitBtn.disabled = true;
                submitBtn.textContent = 'جاري النشر...';

                try {
                    const res = await fetch(`${SUPABASE_URL}/rest/v1/coupon_comments`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                            'Prefer': 'return=representation'
                        },
                        body: JSON.stringify({
                            author_name: name,
                            content: body,
                            likes: 0,
                            dislikes: 0,
                            is_featured: false
                        })
                    });

                    if (res.ok) {
                        authorInput.value = '';
                        bodyInput.value = '';
                        await loadComments();
                    } else {
                        alert('حدث خطأ. تأكد من إعداد جدول coupon_comments في قاعدة البيانات.');
                    }
                } catch (e) {
                    alert('حدثت مشكلة في الاتصال بقاعدة البيانات.');
                }

                submitBtn.disabled = false;
                submitBtn.textContent = 'نشر القسيمة';
            });
        }

        window.voteComment = async function(id, type, btnElement) {
            const container = btnElement.parentElement;
            const upBtn = container.querySelector('.vote-btn:first-child');
            const downBtn = container.querySelector('.vote-btn:last-child');
            
            upBtn.disabled = true;
            downBtn.disabled = true;

            if (type === 'up') upBtn.classList.add('upvoted');
            if (type === 'down') downBtn.classList.add('downvoted');

            setVotedComment(id, type);

            const countSpan = btnElement.querySelector('span');
            countSpan.textContent = parseInt(countSpan.textContent) + 1;

            try {
                const res = await fetch(`${SUPABASE_URL}/rest/v1/coupon_comments?id=eq.${id}&select=${type === 'up' ? 'likes' : 'dislikes'}`, {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                    }
                });
                const data = await res.json();
                if (data && data.length > 0) {
                    const currentCount = data[0][type === 'up' ? 'likes' : 'dislikes'];
                    const bodyPayload = type === 'up' ? { likes: currentCount + 1 } : { dislikes: currentCount + 1 };
                    
                    await fetch(`${SUPABASE_URL}/rest/v1/coupon_comments?id=eq.${id}`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                        },
                        body: JSON.stringify(bodyPayload)
                    });
                }
            } catch (e) {
                console.error('Vote failed to sync', e);
            }
        };

        fetchDailyCoupon();
        loadComments();
    } catch (err) {
        console.error("Coupon JS Fatal Error:", err);
    }
});
