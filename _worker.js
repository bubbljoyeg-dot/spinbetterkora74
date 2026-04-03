const SUPABASE_URL = 'https://whwilmaizmfqgcgowrwf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indod2lsbWFpem1mcWdjZ293cndmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDQyNDcsImV4cCI6MjA5MDQ4MDI0N30.plNnsahhJPXPo6uNOrW2GwRSwAPVcDp2PEcSlb7Wgs0';

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // ── مش صفحة الأخبار؟ رجّع الملف العادي ──
        if (!url.pathname.includes('spinbetter-news')) {
            return env.ASSETS.fetch(request);
        }

        // ── فيه post id في الـ query string? ──
        // مثال: /spinbetter-news/?post=xxxx  (هنستخدم query بدل hash لأن hash مش بييجي للسيرفر)
        const postId = url.searchParams.get('post');

        // لو مفيش post id، رجّع الصفحة العادية
        if (!postId) {
            return env.ASSETS.fetch(request);
        }

        // ── جيب بيانات المقال من Supabase ──
        let post = null;
        try {
            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/posts?id=eq.${postId}&published=eq.true&select=title,content,cover_image_url&limit=1`,
                {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    }
                }
            );
            const data = await res.json();
            post = data?.[0] || null;
        } catch (e) {
            // لو فشل، رجّع الصفحة العادية
            return env.ASSETS.fetch(request);
        }

        if (!post) {
            return env.ASSETS.fetch(request);
        }

        // ── جهّز بيانات OG ──
        const ogTitle = (post.title || 'SpinBetter Portal') + ' | SpinBetter';
        const rawText = (post.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const ogDesc = rawText.substring(0, 160) + (rawText.length > 160 ? '...' : '');
        const ogImage = post.cover_image_url || 'https://kora74.online/og-default.jpg';
        const ogUrl = `https://kora74.online/spinbetter-news/?post=${postId}`;

        // ── جيب الـ HTML الأصلي ──
        const originalRes = await env.ASSETS.fetch(request);
        let html = await originalRes.text();

        // ── حقن الـ OG tags في <head> ──
        const ogTags = `
    <title>${escapeHtml(ogTitle)}</title>
    <meta property="og:type"        content="article" />
    <meta property="og:title"       content="${escapeHtml(ogTitle)}" />
    <meta property="og:description" content="${escapeHtml(ogDesc)}" />
    <meta property="og:image"       content="${escapeHtml(ogImage)}" />
    <meta property="og:url"         content="${escapeHtml(ogUrl)}" />
    <meta name="twitter:card"       content="summary_large_image" />
    <meta name="twitter:title"      content="${escapeHtml(ogTitle)}" />
    <meta name="twitter:description"content="${escapeHtml(ogDesc)}" />
    <meta name="twitter:image"      content="${escapeHtml(ogImage)}" />`;

        html = html.replace('</head>', ogTags + '\n</head>');

        return new Response(html, {
            headers: {
                'Content-Type': 'text/html;charset=UTF-8',
                'Cache-Control': 'public, max-age=60',
            }
        });
    }
};

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}