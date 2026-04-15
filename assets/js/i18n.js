(function () {
    /* ─────────────────────────────────────────────
       1. RESOLVE BASE PATH (works at any folder depth)
    ───────────────────────────────────────────── */
    let basePrefix = '';
    const scriptTag = document.currentScript || document.querySelector('script[src*="i18n.js"]');
    if (scriptTag && scriptTag.getAttribute('src')) {
        const src = scriptTag.getAttribute('src');
        const idx = src.indexOf('assets/js/i18n.js');
        if (idx !== -1) basePrefix = src.substring(0, idx);
        else if (src.startsWith('/')) basePrefix = '/';
    }

    /* ─────────────────────────────────────────────
       2. INJECT GLOBAL STYLES (sidebar controls + hides old header btn)
    ───────────────────────────────────────────── */
    const style = document.createElement('style');
    style.textContent = `
        /* Remove the old injected header language button */
        .hdr-actions .i18n-toggle-btn { display: none !important; }

        /* ── Sidebar controls row ── */
        .sb-controls-row {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 16px;
            border-top: 1px solid rgba(255,255,255,0.07);
            margin-top: 4px;
        }

        /* Language selector */
        .sb-lang-selector {
            position: relative;
            flex: 1;
        }
        .sb-lang-btn {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 10px;
            padding: 8px 12px;
            color: #e2e8f0;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s, border-color 0.2s;
            letter-spacing: 0.3px;
        }
        .sb-lang-btn:hover {
            background: rgba(255,255,255,0.11);
            border-color: rgba(56,189,248,0.4);
        }
        .sb-lang-btn .sb-lang-caret {
            width: 14px;
            height: 14px;
            opacity: 0.6;
            transition: transform 0.25s;
            flex-shrink: 0;
        }
        .sb-lang-selector.open .sb-lang-caret { transform: rotate(180deg); }
        .sb-lang-dropdown {
            display: none;
            position: absolute;
            bottom: calc(100% + 6px);
            left: 0; right: 0;
            background: #0f172a;
            border: 1px solid rgba(56,189,248,0.25);
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 -8px 24px rgba(0,0,0,0.5);
            z-index: 9999;
        }
        .sb-lang-selector.open .sb-lang-dropdown { display: block; }
        .sb-lang-option {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 14px;
            font-size: 13px;
            color: #cbd5e1;
            cursor: pointer;
            transition: background 0.15s;
            border: none;
            background: transparent;
            width: 100%;
            text-align: right;
        }
        .sb-lang-option:hover { background: rgba(56,189,248,0.1); color: #38bdf8; }
        .sb-lang-option.active { color: #38bdf8; font-weight: 700; }
        .sb-lang-option .sb-lang-flag { font-size: 18px; line-height: 1; }
        .sb-lang-option .sb-lang-label { flex: 1; }
        .sb-lang-option .sb-lang-check {
            width: 16px; height: 16px;
            opacity: 0;
            color: #38bdf8;
        }
        .sb-lang-option.active .sb-lang-check { opacity: 1; }

        /* Theme toggle pill */
        .sb-theme-toggle {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 42px;
            height: 42px;
            flex-shrink: 0;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 10px;
            cursor: pointer;
            transition: background 0.2s, border-color 0.2s;
            color: #e2e8f0;
        }
        .sb-theme-toggle:hover {
            background: rgba(255,255,255,0.11);
            border-color: rgba(251,191,36,0.4);
        }
        .sb-theme-toggle svg { width: 18px; height: 18px; }
        /* moon icon initially visible, sun hidden */
        .sb-theme-toggle .icon-moon { display: block; }
        .sb-theme-toggle .icon-sun  { display: none; }
        .theme-light .sb-theme-toggle .icon-moon { display: none; }
        .theme-light .sb-theme-toggle .icon-sun  { display: block; }
    `;
    document.head.appendChild(style);

    /* ─────────────────────────────────────────────
       3. STATE
    ───────────────────────────────────────────── */
    const LANGUAGES    = ['ar', 'en'];
    const DEFAULT_LANG = 'ar';
    const STORAGE_KEY  = 'kora74_lang';

    const ARABIC_COUNTRIES = new Set([
        'EG','SA','AE','KW','QA','BH','OM','JO','LB','IQ',
        'SY','YE','LY','TN','DZ','MA','SD','PS','MR','SO','DJ','KM'
    ]);


    // Sync helper: best-effort guess from browser locale (used for immediate dir= painting)
    function guessBrowserLang() {
        const loc = (navigator.language || navigator.userLanguage || '').toLowerCase();
        return loc.startsWith('ar') ? 'ar' : 'en';
    }

    // Async helper: geo-detection → browser-lang fallback
    async function detectLang() {
        try {
            const res = await fetch('https://ipapi.co/json/', { cache: 'force-cache' });
            if (!res.ok) throw new Error('geo fail');
            const data = await res.json();
            const lang = ARABIC_COUNTRIES.has(data.country_code) ? 'ar' : 'en';
            localStorage.setItem(STORAGE_KEY, lang);
            return lang;
        } catch (_) {
            // Geo failed → fall back to browser language
            const lang = guessBrowserLang();
            localStorage.setItem(STORAGE_KEY, lang);
            return lang;
        }
    }

    // For the synchronous dir= pre-paint, use best available guess
    let currentLang = localStorage.getItem(STORAGE_KEY);
    if (!currentLang || !LANGUAGES.includes(currentLang)) {
        currentLang = guessBrowserLang(); // provisional — will be overwritten by geo in init()
    }

    let translations = {};

    /* ─────────────────────────────────────────────
       4. SET LANGUAGE
    ───────────────────────────────────────────── */
    window.i18n_setLanguage = async function (lang) {
        if (!LANGUAGES.includes(lang)) return;
        
        return new Promise((resolve) => {
            if (window[`translations_${lang}`]) {
                translations = window[`translations_${lang}`];
                applyLangState(lang);
                return resolve();
            }

            const script = document.createElement('script');
            script.src = `${basePrefix}locales/${lang}.js`;
            script.onload = () => {
                if (window[`translations_${lang}`]) {
                    translations = window[`translations_${lang}`];
                    applyLangState(lang);
                }
                resolve();
            };
            script.onerror = (e) => {
                console.error('[i18n] Script load failed:', script.src, e);
                resolve();
            };
            document.head.appendChild(script);
        });
    };

    function applyLangState(lang) {
        currentLang = lang;
        localStorage.setItem(STORAGE_KEY, lang);

        document.documentElement.dir  = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;
        document.body.classList.remove('lang-ar', 'lang-en');
        document.body.classList.add(`lang-${lang}`);

        applyTranslations();
        updateSidebarControls();
    }

    window.i18n_toggle = function () {
        window.i18n_setLanguage(currentLang === 'ar' ? 'en' : 'ar');
    };

    /* ─────────────────────────────────────────────
       5. APPLY TRANSLATIONS
    ───────────────────────────────────────────── */
    function applyTranslations() {
        if (!Object.keys(translations).length) return;

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (translations[key]) el.textContent = translations[key];
        });

        ['placeholder', 'aria-label', 'title', 'alt'].forEach(attr => {
            document.querySelectorAll(`[data-i18n-${attr}]`).forEach(el => {
                const key = el.getAttribute(`data-i18n-${attr}`);
                if (translations[key]) el.setAttribute(attr, translations[key]);
            });
        });
    }

    /* ─────────────────────────────────────────────
       6. BUILD SIDEBAR CONTROLS (runs once after DOM ready)
    ───────────────────────────────────────────── */
    function buildSidebarControls() {
        const sbFoot = document.querySelector('.sb-foot');
        if (!sbFoot || document.getElementById('sb-controls-row')) return;

        const row = document.createElement('div');
        row.className = 'sb-controls-row';
        row.id = 'sb-controls-row';

        /* ── Language Selector ── */
        row.innerHTML = `
            <div class="sb-lang-selector" id="sbLangSelector">
                <button class="sb-lang-btn" id="sbLangBtn" onclick="window._sbLangToggle()" aria-haspopup="listbox" aria-expanded="false">
                    <span id="sbLangCurrent" style="display:flex;align-items:center;gap:7px;">
                        <span id="sbLangFlag" style="font-size:17px"></span>
                        <span id="sbLangCode" style="font-family:'Oswald',sans-serif;font-size:13px;font-weight:700;letter-spacing:1px;"></span>
                    </span>
                    <svg class="sb-lang-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="6 9 12 15 18 9"/>
                    </svg>
                </button>
                <div class="sb-lang-dropdown" role="listbox" id="sbLangDropdown">
                    <button class="sb-lang-option" id="sbOptAr" onclick="window._sbLangSelect('ar')" role="option">
                        <span class="sb-lang-flag">🇸🇦</span>
                        <span class="sb-lang-label">العربية &nbsp;<strong>AR</strong></span>
                        <svg class="sb-lang-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                    </button>
                    <button class="sb-lang-option" id="sbOptEn" onclick="window._sbLangSelect('en')" role="option">
                        <span class="sb-lang-flag">🇬🇧</span>
                        <span class="sb-lang-label">English &nbsp;<strong>EN</strong></span>
                        <svg class="sb-lang-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                    </button>
                </div>
            </div>
            <button class="sb-theme-toggle" onclick="console.log('theme toggle')" title="Toggle theme">
                <!-- Moon (dark mode) -->
                <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
                <!-- Sun (light mode) -->
                <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/>
                    <line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/>
                    <line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
            </button>
        `;

        /* Insert BEFORE the register button so controls sit above it */
        sbFoot.insertBefore(row, sbFoot.firstChild);

        /* Wire up dropdown toggle */
        window._sbLangToggle = function () {
            const sel = document.getElementById('sbLangSelector');
            const btn = document.getElementById('sbLangBtn');
            if (!sel) return;
            const isOpen = sel.classList.toggle('open');
            btn.setAttribute('aria-expanded', isOpen);
        };

        /* Wire up option select */
        window._sbLangSelect = function (lang) {
            const sel = document.getElementById('sbLangSelector');
            if (sel) sel.classList.remove('open');
            window.i18n_setLanguage(lang);
        };

        /* Close dropdown on outside click */
        document.addEventListener('click', function (e) {
            const sel = document.getElementById('sbLangSelector');
            if (sel && !sel.contains(e.target)) sel.classList.remove('open');
        });

        /* Set initial UI state */
        updateSidebarControls();
    }

    /* ─────────────────────────────────────────────
       7. UPDATE SIDEBAR CONTROLS UI
    ───────────────────────────────────────────── */
    function updateSidebarControls() {
        const flagEl = document.getElementById('sbLangFlag');
        const codeEl = document.getElementById('sbLangCode');
        const optAr  = document.getElementById('sbOptAr');
        const optEn  = document.getElementById('sbOptEn');
        if (!flagEl) return;

        if (currentLang === 'ar') {
            flagEl.textContent = '🇸🇦';
            codeEl.textContent = 'AR';
            if (optAr) optAr.classList.add('active');
            if (optEn) optEn.classList.remove('active');
        } else {
            flagEl.textContent = '🇬🇧';
            codeEl.textContent = 'EN';
            if (optEn) optEn.classList.add('active');
            if (optAr) optAr.classList.remove('active');
        }
    }

    /* ─────────────────────────────────────────────
       8. MUTATION OBSERVER (dynamic content like news cards)
    ───────────────────────────────────────────── */
    const observer = new MutationObserver(mutations => {
        let needsApply = false;
        for (const m of mutations) {
            for (const n of m.addedNodes) {
                if (n.nodeType === 1 && (n.hasAttribute('data-i18n') || n.querySelector('[data-i18n]'))) {
                    needsApply = true;
                    break;
                }
            }
            if (needsApply) break;
        }
        if (needsApply) applyTranslations();
    });

    /* ─────────────────────────────────────────────
       9. INIT
    ───────────────────────────────────────────── */
    const init = async () => {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved && LANGUAGES.includes(saved)) {
            // localStorage preference exists → use it directly, no network call
            currentLang = saved;
        } else {
            // No preference → geo-detect (with browser-lang fallback inside detectLang)
            currentLang = await detectLang();
        }

        document.documentElement.dir  = currentLang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = currentLang;

        buildSidebarControls();
        window.i18n_setLanguage(currentLang);
        observer.observe(document.body, { childList: true, subtree: true });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
