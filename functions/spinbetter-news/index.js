const SUPABASE_URL = 'https://whwilmaizmfqgcgowrwf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indod2lsbWFpem1mcWdjZ293cndmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDQyNDcsImV4cCI6MjA5MDQ4MDI0N30.plNnsahhJPXPo6uNOrW2GwRSwAPVcDp2PEcSlb7Wgs0';
const SITE_URL = 'https://kora74.online';
const DEFAULT_IMAGE = 'https://kora74.online/LOGO74-1-1-1-15KORA74ONLINELOGOMAIN.webp';
const SITE_NAME = 'SpinBetter Portal';

// ── Logger ────────────────────────────────────────────────────────────────────
function log(step, data = {}) {
  console.log(`[PF] ${step}`, JSON.stringify(data));
}
function logError(step, err, extra = {}) {
  console.error(`[PF][ERROR] ${step}`, JSON.stringify({
    message: err?.message || String(err),
    stack: err?.stack?.split('\n')[0] || '',
    ...extra,
  }));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getValidImage(url) {
  return (url && typeof url === 'string' && url.startsWith('http')) ? url : DEFAULT_IMAGE;
}

function stripHtml(html = '') {
  return html
    .replace(/<blockquote[^>]*>.*?\[MATCH_CARD:[A-Za-z0-9+/=]+\].*?<\/blockquote>/gs, '')
    .replace(/\[MATCH_CARD:[A-Za-z0-9+/=]+\]/g, '')
    .replace(/<blockquote[^>]*>.*?\[INSTAGRAM:.*?\].*?<\/blockquote>/gs, '')
    .replace(/\[INSTAGRAM:.*?\]/g, '')
    .replace(/<blockquote[^>]*>.*?\[EMBED_CODE:.*?\].*?<\/blockquote>/gs, '')
    .replace(/\[EMBED_CODE:.*?\]/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function estimateReadingTime(text = '') {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function removeExistingMeta(html) {
  return html
    .replace(/<link[^>]*rel=["']canonical["'][^>]*\/?>/gi, '')
    .replace(/<meta[^>]*property=["']og:[^"']*["'][^>]*\/?>/gi, '')
    .replace(/<meta[^>]*name=["']twitter:[^"']*["'][^>]*\/?>/gi, '')
    .replace(/<meta[^>]*name=["']description["'][^>]*\/?>/gi, '')
    .replace(/<title[^>]*>[^<]*<\/title>/gi, '');
}

// ── Schema builders ───────────────────────────────────────────────────────────

function buildWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": SITE_NAME,
    "url": SITE_URL,
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${SITE_URL}/spinbetter-news/?search={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };
}

function buildOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": SITE_NAME,
    "url": SITE_URL,
    "logo": {
      "@type": "ImageObject",
      "url": DEFAULT_IMAGE,
      "width": 512,
      "height": 512
    },
    "sameAs": [SITE_URL]
  };
}

function buildArticleSchema(post, ogImage, ogDesc, ogUrl) {
  const rawText = stripHtml(post.content || '');
  const wordCount = rawText.split(/\s+/).filter(Boolean).length;
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": post.title || SITE_NAME,
    "description": ogDesc,
    "image": {
      "@type": "ImageObject",
      "url": ogImage,
      "width": 1200,
      "height": 630
    },
    "url": ogUrl,
    "datePublished": post.created_at || new Date().toISOString(),
    "dateModified": post.updated_at || post.created_at || new Date().toISOString(),
    "author": {
      "@type": "Organization",
      "name": SITE_NAME,
      "url": `${SITE_URL}/spinbetter-about/`
    },
    "publisher": {
      "@type": "Organization",
      "name": SITE_NAME,
      "url": SITE_URL,
      "logo": {
        "@type": "ImageObject",
        "url": DEFAULT_IMAGE,
        "width": 512,
        "height": 512
      }
    },
    "wordCount": wordCount,
    "timeRequired": `PT${estimateReadingTime(rawText)}M`,
    "inLanguage": "ar",
    "isAccessibleForFree": true,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": ogUrl
    }
  };
}

function buildBreadcrumbSchema(postTitle, postId) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "الرئيسية", "item": SITE_URL },
      { "@type": "ListItem", "position": 2, "name": "الأخبار", "item": `${SITE_URL}/spinbetter-news/` },
      { "@type": "ListItem", "position": 3, "name": postTitle || SITE_NAME, "item": `${SITE_URL}/spinbetter-news/?post=${postId}` }
    ]
  };
}

// ── صفحة OG نظيفة للبوتات ───────────────────────────────────────────────────

function buildOgPage(ogTitle, ogDesc, ogImage, ogUrl, schemaScripts) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(ogTitle)}</title>
<link rel="canonical" href="${esc(ogUrl)}" />
<meta name="description" content="${esc(ogDesc)}" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${esc(ogTitle)}" />
<meta property="og:description" content="${esc(ogDesc)}" />
<meta property="og:image" content="${esc(ogImage)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:type" content="image/webp" />
<meta property="og:url" content="${esc(ogUrl)}" />
<meta property="og:site_name" content="${esc(SITE_NAME)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(ogTitle)}" />
<meta name="twitter:description" content="${esc(ogDesc)}" />
<meta name="twitter:image" content="${esc(ogImage)}" />
${schemaScripts}
</head>
<body>
<h1>${esc(ogTitle)}</h1>
<p>${esc(ogDesc)}</p>
<img src="${esc(ogImage)}" alt="${esc(ogTitle)}" width="1200" height="630" />
</body>
</html>`;
}

// ── Main Handler (Cloudflare Pages Function) ──────────────────────────────────

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const userAgent = request.headers.get('User-Agent') || '';
  const postId = url.searchParams.get('post');

  log('request:in', {
    url: request.url,
    postId: postId || null,
    ua: userAgent.substring(0, 100),
  });

  // ── تجاهل الـ static assets ──────────────────────────────────────────────
  const staticExts = ['.js', '.css', '.png', '.jpg', '.jpeg', '.webp', '.ico', '.svg', '.woff', '.woff2', '.ttf'];
  if (staticExts.some(ext => url.pathname.endsWith(ext))) {
    log('route:static-passthrough');
    return next();
  }

  // ── لو مفيش post ID، مش شغلتنا ─────────────────────────────────────────
  if (!postId) {
    log('route:no-postId-passthrough');
    return next();
  }

  // ── Bot detection ────────────────────────────────────────────────────────
  const isBot = /googlebot|bingbot|yandex|duckduckbot|facebookexternalhit|facebookcatalog|facebookbot|twitterbot|linkedinbot|slurp|applebot|pinterestbot|whatsapp|telegrambot|discordbot|skypeuripreview|iframely|embedly|rogerbot|semrushbot|ahrefsbot|msnbot|baiduspider|meta-externalagent|meta-externalfetcher|vkshare|line-poker|kakaotalk-scrap|naver|daum/i.test(userAgent);

  log('request:classified', { isBot, postId });

  // ── جلب بيانات المقال من Supabase ────────────────────────────────────────
  let post = null;
  const supabaseReqUrl = `${SUPABASE_URL}/rest/v1/posts?id=eq.${encodeURIComponent(postId)}&published=eq.true&select=title,content,cover_image_url,created_at,updated_at&limit=1`;

  try {
    const res = await fetch(supabaseReqUrl, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      signal: AbortSignal.timeout(8000),
    });

    log('supabase:response', { status: res.status });

    if (!res.ok) {
      logError('supabase:not-ok', new Error(`HTTP ${res.status}`), { status: res.status, postId });
      return next();
    }

    const data = await res.json();
    post = data?.[0] || null;
    log('supabase:result', { found: !!post, postId });
  } catch (e) {
    logError('supabase:catch', e, { postId });
    return next();
  }

  if (!post) {
    log('post:not-found', { postId });
    return next();
  }

  log('post:data', { title: post.title, hasCover: !!post.cover_image_url });

  // ── الصورة: cover_image_url → MATCH_CARD → DEFAULT ───────────────────────
  let ogImage = getValidImage(post.cover_image_url);

  if (ogImage === DEFAULT_IMAGE) {
    const m = (post.content || '').match(/\[MATCH_CARD:([A-Za-z0-9+/=]+)\]/);
    if (m) {
      try {
        const d = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
        ogImage = getValidImage(d.hLogo || d.aLogo || '');
        log('post:image-from-match-card', { ogImage });
      } catch (e) {
        logError('post:match-card-parse', e);
      }
    }
  }

  log('post:final-image', { isDefault: ogImage === DEFAULT_IMAGE });

  const rawText = stripHtml(post.content || '');
  const ogTitle = `${post.title || SITE_NAME} | ${SITE_NAME}`;
  const ogDesc  = rawText.substring(0, 160) + (rawText.length > 160 ? '...' : '');
  const ogUrl   = `${SITE_URL}/spinbetter-news/?post=${postId}`;

  // ── بناء الـ Schema ───────────────────────────────────────────────────────
  const schemas = [
    buildArticleSchema(post, ogImage, ogDesc, ogUrl),
    buildBreadcrumbSchema(post.title, postId),
    buildWebSiteSchema(),
    buildOrganizationSchema(),
  ];

  const schemaScripts = schemas
    .map(s => `<script type="application/ld+json">${JSON.stringify(s)}<\/script>`)
    .join('\n');

  // ── البوتات: صفحة OG نظيفة كاملة بدون JS ────────────────────────────────
  // WhatsApp / Telegram / Discord / Facebook / Google وغيرهم
  if (isBot) {
    log('response:bot-og-page', { postId, ogTitle });
    return new Response(
      buildOgPage(ogTitle, ogDesc, ogImage, ogUrl, schemaScripts),
      {
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=300',
        }
      }
    );
  }

  // ── المستخدم العادي: inject OG tags في الصفحة الأصلية ────────────────────
  let originalRes;
  try {
    originalRes = await next();
    log('origin:fetched', { status: originalRes.status });
  } catch (e) {
    logError('origin:next-catch', e);
    return next();
  }

  let html;
  try {
    html = await originalRes.text();
    log('origin:html', { bytes: html.length, hasHead: html.includes('</head>') });
  } catch (e) {
    logError('origin:text-catch', e);
    return originalRes;
  }

  // إزالة الـ tags القديمة عشان منكررش
  html = removeExistingMeta(html);

  const ogTags = `
<title>${esc(ogTitle)}</title>
<link rel="canonical" href="${esc(ogUrl)}" />
<meta name="description" content="${esc(ogDesc)}" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${esc(ogTitle)}" />
<meta property="og:description" content="${esc(ogDesc)}" />
<meta property="og:image" content="${esc(ogImage)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:type" content="image/webp" />
<meta property="og:url" content="${esc(ogUrl)}" />
<meta property="og:site_name" content="${esc(SITE_NAME)}" />
<meta property="article:published_time" content="${esc(post.created_at || '')}" />
<meta property="article:modified_time" content="${esc(post.updated_at || post.created_at || '')}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(ogTitle)}" />
<meta name="twitter:description" content="${esc(ogDesc)}" />
<meta name="twitter:image" content="${esc(ogImage)}" />
${schemaScripts}`;

  if (html.includes('</head>')) {
    html = html.replace('</head>', ogTags + '\n</head>');
    log('inject:done', { method: 'replace-head' });
  } else {
    html = ogTags + html;
    log('inject:done', { method: 'prepend-fallback' });
  }

  return new Response(html, {
    status: originalRes.status,
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=300',
    }
  });
}
