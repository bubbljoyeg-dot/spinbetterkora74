/**
 * Cloudflare Pages Function — /spinbetter-news/
 * Intercepts ?post=ID requests and returns SSR HTML with per-article OG tags.
 * All other requests fall through to the static index.html.
 *
 * Deploy: place in /functions/spinbetter-news/index.js
 * Cloudflare Pages auto-routes this to /spinbetter-news/*
 */

const SUPABASE_URL  = 'https://whwilmaizmfqgcgowrwf.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indod2lsbWFpem1mcWdjZ293cndmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDQyNDcsImV4cCI6MjA5MDQ4MDI0N30.plNnsahhJPXPo6uNOrW2GwRSwAPVcDp2PEcSlb7Wgs0';
const SITE_URL      = 'https://kora74.online';
const NEWS_PATH     = '/spinbetter-news/';
const DEFAULT_TITLE = 'الأخبار والتحليلات | SpinBetter Portal ⚽';
const DEFAULT_DESC  = 'تابع أحدث أخبار وتوقعات وتحليلات المراهنات الرياضية والكازينو الحصرية على SpinBetter.';
const DEFAULT_IMG   = `${SITE_URL}/logo-spinbetter-official.png`;
const DEFAULT_URL   = `${SITE_URL}${NEWS_PATH}`;

/* ─── Strip HTML tags & truncate ─── */
function stripHtml(html, maxLen = 160) {
  const text = (html || '')
    .replace(/<blockquote[^>]*>.*?\[MATCH_CARD:[A-Za-z0-9+/=]+\].*?<\/blockquote>/gs, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLen ? text.substring(0, maxLen) + '…' : text;
}

/* ─── Detect bots by User-Agent ─── */
function isBot(userAgent = '') {
  const ua = userAgent.toLowerCase();
  return (
    ua.includes('telegrambot') ||
    ua.includes('whatsapp')    ||
    ua.includes('facebookexternalhit') ||
    ua.includes('twitterbot')  ||
    ua.includes('linkedinbot') ||
    ua.includes('slackbot')    ||
    ua.includes('discordbot')  ||
    ua.includes('googlebot')   ||
    ua.includes('bingbot')     ||
    ua.includes('applebot')    ||
    ua.includes('curl')        ||
    ua.includes('wget')
  );
}

/* ─── Build OG HTML response ─── */
function buildOgHtml({ title, description, image, url, canonical }) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${canonical}">

  <!-- Open Graph -->
  <meta property="og:type"        content="article">
  <meta property="og:site_name"   content="SpinBetter Portal">
  <meta property="og:locale"      content="ar_AR">
  <meta property="og:title"       content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image"       content="${image}">
  <meta property="og:image:width"  content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt"   content="${title}">
  <meta property="og:url"         content="${url}">

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:title"       content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image"       content="${image}">

  <!-- Redirect human visitors to the real page -->
  <script>
    // Redirect to the hash-based URL for real users (JS-rendered app)
    var dest = '${url}'.replace('?post=', '#post-');
    // If already on hash URL don't loop
    if (location.hash.indexOf('#post-') === -1) {
      location.replace(dest);
    }
  </script>
</head>
<body>
  <p>جارٍ التحميل... <a href="${url}">اضغط هنا إذا لم تُوجَّه تلقائياً</a></p>
</body>
</html>`;
}

/* ─── Escape XML/HTML special chars ─── */
function esc(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ─── Main handler ─── */
export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const postId = url.searchParams.get('post');

  // No ?post= param → serve static HTML as normal
  if (!postId) {
    return next();
  }

  // Fetch post from Supabase
  let ogTitle = DEFAULT_TITLE;
  let ogDesc  = DEFAULT_DESC;
  let ogImage = DEFAULT_IMG;
  let ogUrl   = `${SITE_URL}${NEWS_PATH}?post=${postId}`;
  let canonical = ogUrl;

  try {
    const apiUrl = `${SUPABASE_URL}/rest/v1/posts?id=eq.${encodeURIComponent(postId)}&published=eq.true&select=id,title,content,cover_image_url,category&limit=1`;
    const res = await fetch(apiUrl, {
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type':  'application/json',
      },
      cf: { cacheTtl: 120, cacheEverything: true }
    });

    if (res.ok) {
      const posts = await res.json();
      if (posts && posts.length > 0) {
        const post = posts[0];
        ogTitle = esc(`${post.title || 'SpinBetter'} | SpinBetter`);
        ogDesc  = esc(stripHtml(post.content || DEFAULT_DESC));
        ogImage = post.cover_image_url ? esc(post.cover_image_url) : DEFAULT_IMG;
        ogUrl   = `${SITE_URL}${NEWS_PATH}?post=${post.id}`;
        canonical = ogUrl;
      }
    }
  } catch (err) {
    console.error('OG fetch error:', err);
    // Fall through with defaults — still serve something
  }

  const html = buildOgHtml({
    title: ogTitle,
    description: ogDesc,
    image: ogImage,
    url: ogUrl,
    canonical,
  });

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'public, max-age=120, s-maxage=120',
      'X-Robots-Tag': 'noindex', // OG shim page — don't index
    },
  });
}
