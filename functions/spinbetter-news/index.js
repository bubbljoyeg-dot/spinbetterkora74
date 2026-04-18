const SUPABASE_URL = 'https://whwilmaizmfqgcgowrwf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indod2lsbWFpem1mcWdjZ293cndmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDQyNDcsImV4cCI6MjA5MDQ4MDI0N30.plNnsahhJPXPo6uNOrW2GwRSwAPVcDp2PEcSlb7Wgs0';
const SITE_URL = 'https://kora74.online';
const DEFAULT_IMAGE = 'https://kora74.online/LOGO74-1-1-1-15KORA74ONLINELOGOMAIN.webp';
const SITE_NAME = 'SpinBetter Portal';

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

// ── Schema builders ───────────────────────────────────────────────────────────

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

function buildWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": SITE_NAME,
    "url": SITE_URL
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
    }
  };
}

// ── Main Function ─────────────────────────────────────────────────────────────

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  // ── Static assets — pass through ──────────────────────────────────────────
  const staticExts = ['.js', '.css', '.png', '.jpg', '.jpeg', '.webp', '.ico', '.svg', '.woff', '.woff2', '.ttf'];
  if (staticExts.some(ext => url.pathname.endsWith(ext))) {
    return next();
  }

  // ── لو مفيش postId — رجّع الصفحة الأصلية ─────────────────────────────────
  const postId = url.searchParams.get('post');
  if (!postId) {
    return next();
  }

  // ── جيب بيانات المقال من Supabase ─────────────────────────────────────────
  let post = null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/posts?id=eq.${encodeURIComponent(postId)}&published=eq.true&select=title,content,cover_image_url,created_at,updated_at&limit=1`,
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

  // ── الصورة: cover_image_url → MATCH_CARD → DEFAULT ─────────────────────────
  let ogImage = getValidImage(post.cover_image_url);
  if (ogImage === DEFAULT_IMAGE) {
    const m = (post.content || '').match(/\[MATCH_CARD:([A-Za-z0-9+/=]+)\]/);
    if (m) {
      try {
        const d = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
        ogImage = getValidImage(d.hLogo || d.aLogo || '');
      } catch (e) {}
    }
  }

  const rawText = stripHtml(post.content || '');
  const ogTitle = `${post.title || SITE_NAME} | ${SITE_NAME}`;
  const ogDesc  = rawText.substring(0, 160) + (rawText.length > 160 ? '...' : '');
  const ogUrl   = `${SITE_URL}/spinbetter-news/?post=${postId}`;

  // ── Schema scripts ─────────────────────────────────────────────────────────
  const schemas = [
    buildArticleSchema(post, ogImage, ogDesc, ogUrl),
    buildBreadcrumbSchema(post.title, postId),
    buildWebSiteSchema(),
    buildOrganizationSchema(),
  ];
  const schemaScripts = schemas
    .map(s => `<script type="application/ld+json">${JSON.stringify(s)}<\/script>`)
    .join('\n');

  // ── جيب الصفحة الأصلية وحقن الـ OG tags ───────────────────────────────────
  const originalRes = await next();
  let html = await originalRes.text();

  // امسح الـ canonical والـ OG القديمة عشان منكررش
  html = html.replace(/<link[^>]*rel=["']canonical["'][^>]*\/?>/gi, '');
  html = html.replace(/<meta[^>]*property=["']og:[^"']*["'][^>]*\/?>/gi, '');
  html = html.replace(/<meta[^>]*name=["']twitter:[^"']*["'][^>]*\/?>/gi, '');
  html = html.replace(/<meta[^>]*name=["']description["'][^>]*\/?>/gi, '');
  html = html.replace(/<title>[^<]*<\/title>/gi, '');

  const ogTags = `
<title>${esc(ogTitle)}</title>
<link rel="canonical" href="${esc(ogUrl)}" />
<meta name="description" content="${esc(ogDesc)}" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${esc(ogTitle)}" />
<meta property="og:description" content="${esc(ogDesc)}" />
<meta property="og:image" content="${esc(ogImage)}" />
<meta property="og:image:secure_url" content="${esc(ogImage)}" />
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

  html = html.replace('</head>', ogTags + '\n</head>');

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
    }
  });
}
