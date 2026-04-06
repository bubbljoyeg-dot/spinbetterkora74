const SUPABASE_URL = 'https://whwilmaizmfqgcgowrwf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indod2lsbWFpem1mcWdjZ293cndmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDQyNDcsImV4cCI6MjA5MDQ4MDI0N30.plNnsahhJPXPo6uNOrW2GwRSwAPVcDp2PEcSlb7Wgs0';

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // 1. DYNAMIC SITEMAP EDGE FUNCTION
        if (url.pathname === '/sitemap.xml') {
            try {
                // Fetch the static original sitemap.xml
                const originalRes = await env.ASSETS.fetch(request);
                let xml = await originalRes.text();

                // Fetch published posts from Supabase
                const supabaseRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/posts?published=eq.true&select=id,updated_at,created_at`,
                    {
                        headers: {
                            'apikey': SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        }
                    }
                );
                
                if (supabaseRes.ok) {
                    const posts = await supabaseRes.json();
                    let dynamicUrls = "";
                    
                    posts.forEach(post => {
                        const postUrl = `https://kora74.online/spinbetter-news/?post=${post.id}`;
                        // Use updated_at if available, else created_at
                        const lastModRaw = post.updated_at || post.created_at || new Date().toISOString();
                        const lastMod = lastModRaw.split('T')[0]; // Format: YYYY-MM-DD
                        
                        dynamicUrls += `
  <url>
    <loc>${escapeHtml(postUrl)}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
                    });

                    // Inject dynamic URLs right before the closing tag of urlset
                    if (dynamicUrls !== "") {
                        xml = xml.replace('</urlset>', dynamicUrls + '\n</urlset>');
                    }
                }

                return new Response(xml, {
                    headers: {
                        'Content-Type': 'application/xml;charset=UTF-8',
                        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour to reduce DB hits
                    }
                });
            } catch (err) {
                // If anything fails, fallback to original static sitemap
                return env.ASSETS.fetch(request);
            }
        }

        // 2. OPEN GRAPH META TAGS INJECTION FOR NEWS
        if (!url.pathname.includes('spinbetter-news')) {
            return env.ASSETS.fetch(request);
        }

        const postId = url.searchParams.get('post');

        if (!postId) {
            return env.ASSETS.fetch(request);
        }

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
            return env.ASSETS.fetch(request);
        }

        if (!post) {
            return env.ASSETS.fetch(request);
        }

        const ogTitle = (post.title || 'SpinBetter Portal') + ' | SpinBetter';
        const rawText = (post.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const ogDesc = rawText.substring(0, 160) + (rawText.length > 160 ? '...' : '');
        const ogImage = post.cover_image_url || 'https://kora74.online/og-default.jpg';
        const ogUrl = `https://kora74.online/spinbetter-news/?post=${postId}`;

        const originalRes = await env.ASSETS.fetch(request);
        let html = await originalRes.text();

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
