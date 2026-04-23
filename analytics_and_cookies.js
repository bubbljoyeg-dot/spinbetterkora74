
// ===[ GOOGLE ANALYTICS CONSENT & EVENT TRACKING ]===
// Measurement ID: G-G3720G0G5X
// Stream ID: 13772358071

window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }

// 1. Set Google Analytics default consent to 'denied'
gtag('consent', 'default', {
    'ad_storage': 'denied',
    'analytics_storage': 'denied'
});

// Load GA4
(function () {
    var gaScript = document.createElement('script');
    gaScript.async = true;
    gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-G3720G0G5X';
    document.head.appendChild(gaScript);

    gtag('js', new Date());
    gtag('config', 'G-G3720G0G5X', { send_page_view: true });
})();

document.addEventListener('DOMContentLoaded', () => {
    // 2. Build Cookie Consent Banner
    const cookieConsent = localStorage.getItem('spinbetter_cookie_consent');

    if (!cookieConsent) {
        const banner = document.createElement('div');
        banner.id = 'cookie-banner';
        banner.innerHTML = `
            <div style="position: fixed; bottom: 0; left: 0; width: 100%; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(10px); border-top: 1px solid #38bdf8; padding: 15px 20px; z-index: 99999; display: flex; flex-direction: column; md:flex-row; justify-content: space-between; align-items: center; gap: 15px; box-shadow: 0 -10px 40px rgba(0,0,0,0.5);">
                <div style="color: #f8fafc; font-size: 14px; text-align: right; max-width: 800px; line-height: 1.6;">
                    <strong>🍪 استخدام ملفات تعريف الارتباط (Cookies)</strong><br>
                    نحن نستخدم ملفات تعريف الارتباط والتقنيات المشابهة لتقديم أفضل تجربة مستخدم، ولتحليل زيارات الموقع وتخصيص المحتوى. استمرارك في تصفح الموقع أو النقر على "موافق" يعني قبولك لـ <a href="https://kora74.online/spinbetter-cookies/" style="color: #38bdf8; text-decoration: underline;">سياسة ملفات تعريف الارتباط</a>.
                </div>
                <div style="display: flex; gap: 10px; width: 100%; max-width: 300px;">
                    <button id="accept-cookies" style="flex: 1; background: #38bdf8; color: #000; border: none; padding: 10px 15px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;">موافق</button>
                    <button id="reject-cookies" style="flex: 1; background: transparent; color: #94a3b8; border: 1px solid #94a3b8; padding: 10px 15px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s;">رفض</button>
                </div>
            </div>
        `;
        document.body.appendChild(banner);

        document.getElementById('accept-cookies').addEventListener('click', () => {
            localStorage.setItem('spinbetter_cookie_consent', 'accepted');
            updateConsent('granted');
            banner.style.display = 'none';
        });

        document.getElementById('reject-cookies').addEventListener('click', () => {
            localStorage.setItem('spinbetter_cookie_consent', 'rejected');
            updateConsent('denied');
            banner.style.display = 'none';
        });
    } else if (cookieConsent === 'accepted') {
        updateConsent('granted');
    }

    // 3. Track All Clicks
    document.body.addEventListener('click', (e) => {
        // Only track if consent is granted, or track anonymously regardless (GA4 handles consent mode)
        let target = e.target;
        // Find closest anchor or button
        let interactiveEl = target.closest('a') || target.closest('button');

        if (interactiveEl) {
            let elText = interactiveEl.innerText ? interactiveEl.innerText.trim().substring(0, 50) : '';
            let elHref = interactiveEl.getAttribute('href') || interactiveEl.getAttribute('data-href') || 'none';
            let elClass = interactiveEl.className || 'none';
            let elId = interactiveEl.id || 'none';

            if (!elText && interactiveEl.querySelector('img')) {
                elText = 'Image Link: ' + (interactiveEl.querySelector('img').alt || 'unnamed');
            }

            gtag('event', 'user_click', {
                'event_category': 'Engagement',
                'event_label': interactiveEl.tagName.toLowerCase(),
                'element_text': elText || 'icon/svg',
                'element_href': elHref,
                'element_class': elClass,
                'element_id': elId,
                'page_path': window.location.pathname
            });
        } else {
            // Track generic body clicks on non-interactive elements if they contain important classes
            let clickTarget = target.className ? target.className : target.tagName;
            gtag('event', 'generic_click', {
                'event_category': 'Exploration',
                'element_type': clickTarget,
                'page_path': window.location.pathname
            });
        }
    });
});

function updateConsent(status) {
    gtag('consent', 'update', {
        'ad_storage': status,
        'analytics_storage': status
    });
}

// ===[ GLOBAL INTERSECTION OBSERVER ]===
document.addEventListener('DOMContentLoaded', () => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('active');
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
});
