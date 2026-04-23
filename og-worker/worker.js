// ══════════════════════════════════════════════════════════════════
// Kora74 — Dynamic OG Image Worker
// يولّد صور PNG ديناميكية لمشاركة المقالات على السوشيال ميديا
//
// Usage:
//   GET /og?t=TITLE&i=IMAGE_URL&d=DESCRIPTION
//
// Parameters:
//   t  = عنوان المقال (مطلوب)
//   i  = رابط صورة المقال (اختياري)
//   d  = وصف قصير (اختياري)
// ══════════════════════════════════════════════════════════════════

import { ImageResponse } from 'workers-og';

// ── ثوابت الـ Brand ──────────────────────────────────────────────
const SITE_NAME  = 'Kora74 News';
const SITE_URL   = 'kora74.online';
const RED        = '#e31e24';
const BG_DARK    = '#020617';
const BG_CARD    = '#0f172a';
const TEXT_LIGHT = '#f1f5f9';
const TEXT_MUTED = '#64748b';
const ACCENT     = '#06b6d4';

// ── Helper: اقتصر النص لحد معين ─────────────────────────────────
function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max).trimEnd() + '…' : str;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/') {
      return new Response('Kora74 OG Image Worker ⚽', { status: 200 });
    }

    if (url.pathname !== '/og') {
      return new Response('Not Found', { status: 404 });
    }

    // ── Parameters ──────────────────────────────────────────────
    const title   = truncate(url.searchParams.get('t') || 'أخبار كرة القدم', 80);
    const imgUrl  = url.searchParams.get('i') || '';
    const desc    = truncate(url.searchParams.get('d') || '', 100);

    // ── Font sizes based on title length ─────────────────────────
    const titleSize = title.length > 50 ? 36 : title.length > 30 ? 42 : 48;

    try {
      return new ImageResponse(
        // ── ROOT ──────────────────────────────────────────────────
        {
          type: 'div',
          props: {
            style: {
              display:         'flex',
              width:           '1200px',
              height:          '630px',
              background:      `linear-gradient(135deg, ${BG_DARK} 0%, ${BG_CARD} 100%)`,
              fontFamily:      'Arial, sans-serif',
              position:        'relative',
              overflow:        'hidden',
            },
            children: [

              // ── LEFT RED ACCENT BAR ──────────────────────────
              {
                type: 'div',
                props: {
                  style: {
                    position:   'absolute',
                    left:       0, top: 0,
                    width:      '6px',
                    height:     '100%',
                    background: `linear-gradient(to bottom, ${RED}, #b91c1c)`,
                  }
                }
              },

              // ── BACKGROUND NOISE PATTERN (Subtle circles) ────
              {
                type: 'div',
                props: {
                  style: {
                    position: 'absolute',
                    top: '-200px', right: '-100px',
                    width:  '600px',
                    height: '600px',
                    borderRadius: '50%',
                    background: `radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%)`,
                  }
                }
              },
              {
                type: 'div',
                props: {
                  style: {
                    position: 'absolute',
                    bottom: '-150px', left: '200px',
                    width:  '400px',
                    height: '400px',
                    borderRadius: '50%',
                    background: `radial-gradient(circle, rgba(227,30,36,0.05) 0%, transparent 70%)`,
                  }
                }
              },

              // ── ARTICLE IMAGE (RIGHT HALF) ───────────────────
              imgUrl
                ? {
                    type: 'div',
                    props: {
                      style: {
                        position: 'absolute',
                        right: 0, top: 0,
                        width:  '560px',
                        height: '630px',
                        overflow: 'hidden',
                      },
                      children: [
                        // Image
                        {
                          type: 'img',
                          props: {
                            src: imgUrl,
                            style: {
                              width:      '560px',
                              height:     '630px',
                              objectFit:  'cover',
                            }
                          }
                        },
                        // Gradient overlay (fades left)
                        {
                          type: 'div',
                          props: {
                            style: {
                              position:   'absolute',
                              inset:      0,
                              background: `linear-gradient(to right, ${BG_DARK} 0%, rgba(2,6,23,0.7) 40%, rgba(2,6,23,0.1) 100%)`,
                            }
                          }
                        },
                        // Top gradient overlay
                        {
                          type: 'div',
                          props: {
                            style: {
                              position:   'absolute',
                              inset:      0,
                              background: `linear-gradient(to bottom, rgba(2,6,23,0.4) 0%, transparent 40%, rgba(2,6,23,0.6) 100%)`,
                            }
                          }
                        },
                      ]
                    }
                  }
                : null,

              // ── LEFT CONTENT PANEL ───────────────────────────
              {
                type: 'div',
                props: {
                  style: {
                    position:       'absolute',
                    left:           0, top: 0,
                    width:          imgUrl ? '640px' : '1200px',
                    height:         '630px',
                    display:        'flex',
                    flexDirection:  'column',
                    justifyContent: 'space-between',
                    padding:        '50px 60px',
                  },
                  children: [

                    // ── TOP: Logo Badge ────────────────────────
                    {
                      type: 'div',
                      props: {
                        style: {
                          display:        'flex',
                          alignItems:     'center',
                          gap:            '12px',
                        },
                        children: [
                          // Football emoji badge
                          {
                            type: 'div',
                            props: {
                              style: {
                                display:      'flex',
                                alignItems:   'center',
                                gap:          '8px',
                                background:   RED,
                                borderRadius: '50px',
                                padding:      '8px 20px',
                                color:        'white',
                                fontSize:     '18px',
                                fontWeight:   'bold',
                                letterSpacing: '0.5px',
                              },
                              children: '⚽ KORA74 NEWS'
                            }
                          },
                          // LIVE dot
                          {
                            type: 'div',
                            props: {
                              style: {
                                display:      'flex',
                                alignItems:   'center',
                                gap:          '6px',
                                background:   'rgba(6,182,212,0.12)',
                                border:       `1px solid rgba(6,182,212,0.3)`,
                                borderRadius: '50px',
                                padding:      '8px 16px',
                                color:        ACCENT,
                                fontSize:     '14px',
                                fontWeight:   'bold',
                              },
                              children: [
                                {
                                  type: 'div',
                                  props: {
                                    style: {
                                      width:        '8px',
                                      height:       '8px',
                                      borderRadius: '50%',
                                      background:   ACCENT,
                                    }
                                  }
                                },
                                { type: 'span', props: { children: ' حصري' } }
                              ]
                            }
                          }
                        ]
                      }
                    },

                    // ── MIDDLE: Title + Description ────────────
                    {
                      type: 'div',
                      props: {
                        style: {
                          display:       'flex',
                          flexDirection: 'column',
                          gap:           '16px',
                          flex:          1,
                          justifyContent: 'center',
                          paddingTop:    '20px',
                        },
                        children: [
                          // Title
                          {
                            type: 'div',
                            props: {
                              style: {
                                color:        TEXT_LIGHT,
                                fontSize:     `${titleSize}px`,
                                fontWeight:   '900',
                                lineHeight:   '1.45',
                                direction:    'rtl',
                                textAlign:    'right',
                              },
                              children: title
                            }
                          },
                          // Description (if any)
                          desc
                            ? {
                                type: 'div',
                                props: {
                                  style: {
                                    color:      TEXT_MUTED,
                                    fontSize:   '22px',
                                    lineHeight: '1.6',
                                    direction:  'rtl',
                                    textAlign:  'right',
                                  },
                                  children: desc
                                }
                              }
                            : null,
                        ]
                      }
                    },

                    // ── BOTTOM: CTA + Domain ───────────────────
                    {
                      type: 'div',
                      props: {
                        style: {
                          display:     'flex',
                          alignItems:  'center',
                          justifyContent: 'space-between',
                          direction:   'rtl',
                        },
                        children: [
                          // CTA Button
                          {
                            type: 'div',
                            props: {
                              style: {
                                display:      'flex',
                                alignItems:   'center',
                                gap:          '10px',
                                background:   `linear-gradient(135deg, ${RED}, #b91c1c)`,
                                borderRadius: '50px',
                                padding:      '16px 36px',
                                color:        'white',
                                fontSize:     '22px',
                                fontWeight:   'bold',
                                boxShadow:    '0 8px 30px rgba(227,30,36,0.4)',
                              },
                              children: 'اقرأ الآن ←'
                            }
                          },
                          // Site URL pill
                          {
                            type: 'div',
                            props: {
                              style: {
                                display:      'flex',
                                alignItems:   'center',
                                gap:          '8px',
                                background:   'rgba(255,255,255,0.05)',
                                border:       '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '50px',
                                padding:      '10px 20px',
                                color:        TEXT_MUTED,
                                fontSize:     '18px',
                              },
                              children: `🌐 ${SITE_URL}`
                            }
                          }
                        ]
                      }
                    }

                  ]
                }
              }

            ]
          }
        },
        // ── Image dimensions ────────────────────────────────────
        { width: 1200, height: 630 }
      );

    } catch (err) {
      // Fallback: redirect to logo
      return Response.redirect(
        `https://kora74.online/LOGO74-1-1-1-15KORA74ONLINELOGOMAIN.webp`,
        302
      );
    }
  }
};
