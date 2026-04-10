const SUPABASE_URL = 'https://whwilmaizmfqgcgowrwf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indod2lsbWFpem1mcWdjZ293cndmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDQyNDcsImV4cCI6MjA5MDQ4MDI0N30.plNnsahhJPXPo6uNOrW2GwRSwAPVcDp2PEcSlb7Wgs0';
const SITE_URL = 'https://kora74.online';
const DEFAULT_IMAGE = 'https://kora74.online/imgi_265_bookmaker-sb-001.webp';

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  // السماح للملفات الثابتة بالمرور مباشرة
  if (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.svg')
  ) {
    return next();
  }

  const postId = url.searchParams.get('post');

  if (!postId) {
    return next();
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
    return next();
  }

  if (!post) return next();

  // تنظيف النص
  const rawText = (post.content || '')
    .replace(/<blockquote[^>]*>.*?\[MATCH_CARD:[A-Za-z0-9+/=]+\].*?<\/blockquote>/gs, '')
    .replace(/\[MATCH_CARD:[A-Za-z0-9+/=]+\]/g, '')
    .replace(/<blockquote[^>]*>.*?\[INSTAGRAM:.*?\].*?<\/blockquote>/gs, '')
    .replace(/\[INSTAGRAM:.*?\]/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let ogImage = post.cover_image_url || '';
  if (!ogImage) {
    const m = (post.content || '').match(/\[MATCH_CARD:([A-Za-z0-9+/=]+)\]/);
    if (m) {
      try {
        const d = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
        ogImage = d.hLogo || d.aLogo || '';
      } catch (e) {}
    }
  }
  if (!ogImage) ogImage = DEFAULT_IMAGE;

  const ogTitle = (post.title || 'SpinBetter Portal') + ' | SpinBetter';
  const ogDesc  = rawText.substring(0, 160) + (rawText.length > 160 ? '...' : '');
  const ogUrl   = `${SITE_URL}/spinbetter-news/?post=${postId}`;

  // جلب صفحة HTML الأصلية
  const originalRes = await next();
  let html = await originalRes.text();

  const ogTags = `
    <title>${esc(ogTitle)}</title>
    <meta property="og:type"         content="article" />
    <meta property="og:title"        content="${esc(ogTitle)}" />
    <meta property="og:description"  content="${esc(ogDesc)}" />
    <meta property="og:image"        content="${esc(ogImage)}" />
    <meta property="og:url"          content="${esc(ogUrl)}" />
    <meta name="twitter:card"        content="summary_large_image" />
    <meta name="twitter:title"       content="${esc(ogTitle)}" />
    <meta name="twitter:description" content="${esc(ogDesc)}" />
    <meta name="twitter:image"       content="${esc(ogImage)}" />`;

  // حقن التاجات داخل الهيد
  html = html.replace('</head>', ogTags + '\n</head>');

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'public, max-age=60',
    }
  });
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
