// ══════════════════════════════════════════════════════════════════════
// Kora74 — Cloudflare Worker
// الغرض: حقن OG/Meta tags ديناميكية للمقالات + Sitemap ديناميكي
//
// ⚠️  مهم: الـ Worker Route في Cloudflare يجب أن يكون محدداً هكذا:
//       kora74.online/kora74-news*
//       kora74.online/sitemap.xml
//   وليس  kora74.online/*  (ده بيكسر باقي الصفحات)
// ══════════════════════════════════════════════════════════════════════

const SUPABASE_URL     = 'https://whwilmaizmfqgcgowrwf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indod2lsbWFpem1mcWdjZ293cndmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDQyNDcsImV4cCI6MjA5MDQ4MDI0N30.plNnsahhJPXPo6uNOrW2GwRSwAPVcDp2PEcSlb7Wgs0';
const SITE_URL          = 'https://kora74.online';
const GITHUB_URL        = 'https://bubbljoyeg-dot.github.io/spinbetterkora74';
const NEWS_PATH         = '/kora74-news/';   // ✅ المسار في مكان واحد فقط
const DEFAULT_IMAGE     = 'https://kora74.online/LOGO74-1-1-1-15KORA74ONLINELOGOMAIN.webp';

// ─── Helper: HTML escape ───────────────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g,  '&amp;')
    .replace(/"/g,  '&quot;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;');
}

// ─── Helper: base64 → UTF-8 ───────────────────────────────────────────
function b64ToUtf8(b64) {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// ─── Helper: Supabase fetch مع headers ────────────────────────────────
async function supabaseFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey':         SUPABASE_ANON_KEY,
      'Authorization':  `Bearer ${SUPABASE_ANON_KEY}`,
    }
  });
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('Supabase returned non-array');
  return data;
}

// ─── Helper: استخرج أول صورة من المقال ───────────────────────────────
function extractImage(post) {
  if (post.cover_image_url?.startsWith('http')) return post.cover_image_url;

  // جرب MATCH_CARD
  const m = (post.content || '').match(/\[MATCH_CARD:([A-Za-z0-9+/=]+)\]/);
  if (m) {
    try {
      const d = JSON.parse(b64ToUtf8(m[1]));
      const img = d.hLogo || d.aLogo || '';
      if (img.startsWith('http')) return img;
    } catch (_) {}
  }

  // جرب أول <img> في المحتوى
  const imgTag = (post.content || '').match(/<img[^>]+src="([^"]+)"/i);
  if (imgTag?.[1]?.startsWith('http')) return imgTag[1];

  return DEFAULT_IMAGE;
}

// ─── Helper: نظّف HTML لعمل description نصي ──────────────────────────
function cleanText(html = '') {
  return html
    .replace(/<blockquote[^>]*>.*?\[MATCH_CARD:[A-Za-z0-9+/=]+\].*?<\/blockquote>/gs, '')
    .replace(/\[MATCH_CARD:[A-Za-z0-9+/=]+\]/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Helper: بناء JSON-LD للمقال ──────────────────────────────────────
function buildJsonLd(post, ogImage, ogDesc, ogUrl) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline":    post.title || 'Kora74 News',
    "description": ogDesc,
    "image":       [ogImage],
    "url":         ogUrl,
    "datePublished": post.created_at || new Date().toISOString(),
    "dateModified":  post.updated_at || post.created_at || new Date().toISOString(),
    "author": {
      "@type": "Organization",
      "name":  "Kora74 News",
      "url":   `${SITE_URL}${NEWS_PATH}`
    },
    "publisher": {
      "@type": "Organization",
      "name":  "Kora74",
      "url":   SITE_URL,
      "logo": {
        "@type":  "ImageObject",
        "url":    DEFAULT_IMAGE,
        "width":  600,
        "height": 60
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id":   ogUrl
    }
  };
}

// ─── Helper: حقن meta tags + canonical في الـ HTML ───────────────────
function injectMeta(html, { title, desc, image, url, type = 'article', jsonLd = null }) {
  let tags = `
    <title>${esc(title)}</title>
    <link rel="canonical" href="${esc(url)}" />
    <meta name="description"          content="${esc(desc)}" />
    <meta property="og:type"          content="${esc(type)}" />
    <meta property="og:site_name"     content="Kora74" />
    <meta property="og:locale"        content="ar_EG" />
    <meta property="og:title"         content="${esc(title)}" />
    <meta property="og:description"   content="${esc(desc)}" />
    <meta property="og:image"         content="${esc(image)}" />
    <meta property="og:url"           content="${esc(url)}" />
    <meta name="twitter:card"         content="summary_large_image" />
    <meta name="twitter:title"        content="${esc(title)}" />
    <meta name="twitter:description"  content="${esc(desc)}" />
    <meta name="twitter:image"        content="${esc(image)}" />`;

  if (jsonLd) {
    tags += `\n    <script type="application/ld+json">${JSON.stringify(jsonLd)}<\/script>`;
  }

  // احذف أي title أو canonical موجودين قبل ما نحط بتاعتنا
  html = html
    .replace(/<title>[^<]*<\/title>/i, '')
    .replace(/<link[^>]+rel="canonical"[^>]*>/i, '');

  return html.replace('</head>', tags + '\n  </head>');
}

// ══════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════════════
export default {
  async fetch(request) {
    const url = new URL(request.url);

    // ══════════════════════════════════════════════════════════════
    // 1. DYNAMIC SITEMAP
    // ══════════════════════════════════════════════════════════════
    if (url.pathname === '/sitemap.xml') {
      try {
        const [originalRes, posts] = await Promise.all([
          fetch(`${SITE_URL}/sitemap.xml`),
          supabaseFetch('posts?published=eq.true&select=id,title,cover_image_url,created_at,updated_at&order=created_at.desc')
        ]);

        let xml = await originalRes.text();

        if (posts.length > 0) {
          // أضف image namespace لو مش موجود
          if (!xml.includes('xmlns:image=')) {
            xml = xml.replace(
              /<urlset([^>]*)>/,
              '<urlset$1\n  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'
            );
          }

          let dynamicUrls = '\n  <!-- DYNAMIC POSTS -->';

          for (const post of posts) {
            const imgUrl  = extractImage(post);
            const lastmod = ((post.updated_at || post.created_at) || new Date().toISOString()).split('T')[0];
            const postUrl = `${SITE_URL}${NEWS_PATH}?post=${post.id}`;

            dynamicUrls += `
  <url>
    <loc>${esc(postUrl)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <image:image>
      <image:loc>${esc(imgUrl)}</image:loc>
      <image:title>${esc(post.title || 'Kora74 News')}</image:title>
    </image:image>
  </url>`;
          }

          xml = xml.replace('</urlset>', dynamicUrls + '\n</urlset>');
        }

        return new Response(xml, {
          headers: {
            'Content-Type':  'application/xml;charset=UTF-8',
            'Cache-Control': 'public, max-age=600',
          }
        });

      } catch (err) {
        console.error('[sitemap]', err.message);
        return fetch(`${SITE_URL}/sitemap.xml`);
      }
    }

    // ══════════════════════════════════════════════════════════════
    // 2. Static assets — pass-through مباشرة للـ origin
    // ══════════════════════════════════════════════════════════════
    if (/\.(js|css|png|jpg|jpeg|webp|ico|svg|woff2?|ttf|otf|gif|mp4|pdf)$/i.test(url.pathname)) {
      return fetch(request);
    }

    // ══════════════════════════════════════════════════════════════
    // 3. صفحة الـ News — كل الطلبات الجاية لـ /kora74-news/
    // ══════════════════════════════════════════════════════════════
    const postId = url.searchParams.get('post');

    // ── 3A. مقال معين (?post=UUID) ────────────────────────────────
    if (postId) {
      let post = null;
      try {
        const data = await supabaseFetch(
          `posts?id=eq.${encodeURIComponent(postId)}&published=eq.true&select=id,title,content,cover_image_url,created_at,updated_at&limit=1`
        );
        post = data[0] ?? null;
      } catch (e) {
        console.error('[post fetch]', e.message);
        return fetch(`${SITE_URL}${NEWS_PATH}`);
      }

      // المقال مش موجود أو غير منشور → redirect للصفحة الرئيسية
      if (!post) return Response.redirect(`${SITE_URL}${NEWS_PATH}`, 302);

      const rawText = cleanText(post.content);
      const ogImage = extractImage(post);
      const ogTitle = `${post.title || 'Kora74 News'} | Kora74`;
      const ogDesc  = rawText.substring(0, 160) + (rawText.length > 160 ? '...' : '')
                      || 'اقرأ آخر أخبار كرة القدم على Kora74 News';
      const ogUrl   = `${SITE_URL}${NEWS_PATH}?post=${post.id}`;
      const jsonLd  = buildJsonLd(post, ogImage, ogDesc, ogUrl);

      // جيب الـ HTML من GitHub Pages (مسار kora74-news الجديد)
      let html;
      try {
        const res = await fetch(`${GITHUB_URL}${NEWS_PATH}`);
        if (!res.ok) throw new Error(`GitHub fetch failed: ${res.status}`);
        html = await res.text();
      } catch (_) {
        // fallback: pass-through للـ origin
        return fetch(`${SITE_URL}${NEWS_PATH}`);
      }

      html = injectMeta(html, { title: ogTitle, desc: ogDesc, image: ogImage, url: ogUrl, jsonLd });

      return new Response(html, {
        headers: {
          'Content-Type':            'text/html;charset=UTF-8',
          'Cache-Control':           'public, max-age=120',
          'Content-Security-Policy': "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;",
        }
      });
    }

    // ── 3B. Bots → HTML مرئي لـ crawlers ─────────────────────────
    const ua    = request.headers.get('User-Agent') || '';
    const isBot = /googlebot|bingbot|yandex|duckduckbot|facebookexternalhit|twitterbot|linkedinbot|slurp|applebot|petalbot|semrushbot|ahrefsbot|mj12bot/i.test(ua);

    if (isBot) {
      try {
        const [pageRes, posts] = await Promise.all([
          fetch(`${GITHUB_URL}${NEWS_PATH}`),
          supabaseFetch('posts?published=eq.true&select=id,title,cover_image_url,created_at&order=created_at.desc&limit=50')
        ]);

        if (!pageRes.ok) throw new Error(`GitHub bot fetch failed: ${pageRes.status}`);
        let html = await pageRes.text();

        // حقن meta الصفحة الرئيسية للأخبار
        const newsUrl = `${SITE_URL}${NEWS_PATH}`;
        html = injectMeta(html, {
          title: 'أخبار كرة القدم | Kora74 News',
          desc:  'آخر أخبار كرة القدم، نتائج المباريات، وتحليلات Kora74 News',
          image: DEFAULT_IMAGE,
          url:   newsUrl,
          type:  'website'
        });

        // بناء HTML نصي للـ SEO
        let seoHtml = `<section id="seo-posts" aria-label="قائمة المقالات">`;

        for (const post of posts) {
          const imgSrc  = extractImage(post);
          const postUrl = `${SITE_URL}${NEWS_PATH}?post=${post.id}`;
          const date    = (post.created_at || '').split('T')[0];

          seoHtml += `
  <article>
    <a href="${esc(postUrl)}">
      <img src="${esc(imgSrc)}" alt="${esc(post.title || '')}" loading="lazy" width="600" height="338" />
      <h2>${esc(post.title || '')}</h2>
      <time datetime="${esc(date)}">${esc(date)}</time>
    </a>
  </article>`;
        }

        seoHtml += `\n</section>`;

        // حقن بعد الـ news-grid
        html = html.replace(
          /<div[^>]+id="news-grid"[^>]*><\/div>/,
          `<div class="news-grid" id="news-grid">${seoHtml}</div>`
        );

        return new Response(html, {
          headers: {
            'Content-Type':            'text/html;charset=UTF-8',
            'Cache-Control':           'public, max-age=300',
            'Content-Security-Policy': "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;",
          }
        });

      } catch (err) {
        console.error('[bot]', err.message);
        return fetch(`${SITE_URL}${NEWS_PATH}`);
      }
    }

    // ── 3C. زوار عاديين → pass-through للـ origin ────────────────
    // ✅ مش بنرجّع news page هنا — بنعدّي الطلب للـ origin بدون تعديل
    // (طالما الـ Worker Route محدد لـ kora74-news* فقط، هذا لن يُستدعى لغير صفحة الأخبار)
    return fetch(`${SITE_URL}${NEWS_PATH}`);
  }
};
