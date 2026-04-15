/**
 * Professional Lazy Loading with IntersectionObserver
 * - Skips images with loading="eager" or fetchpriority="high"
 * - Loads images 200px before they enter viewport
 */

(function() {
  'use strict';

  // Configuration
  const config = {
    rootMargin: '200px 0px', // Start loading 200px before image enters viewport
    threshold: 0.01,
    placeholderColor: '#1a1a2e'
  };

  // Add styles for lazy load placeholders
  const style = document.createElement('style');
  style.textContent = `
    .lazy-img {
      opacity: 0;
      transition: opacity 0.4s ease-in-out;
      background-color: ${config.placeholderColor};
    }
    .lazy-img.loaded {
      opacity: 1;
    }
    .lazy-placeholder {
      background: linear-gradient(90deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%);
      background-size: 200% 100%;
      animation: lazyShimmer 1.5s infinite;
    }
    @keyframes lazyShimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .ph-game-link img {
      background: linear-gradient(135deg, #16213e 0%, #1a1a2e 100%);
      min-height: 46px;
    }
    .ph-slide[data-src] {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    }
  `;
  document.head.appendChild(style);

  // Function to load image
  function loadImage(img) {
    const src = img.dataset.src || img.getAttribute('src');
    if (!src || img.classList.contains('loaded')) return;
    if (src.startsWith('data:')) return;

    const preloadImg = new Image();

    preloadImg.onload = () => {
      img.src = src;
      img.classList.add('loaded');
      img.classList.remove('lazy-placeholder');
    };

    preloadImg.onerror = () => {
      img.classList.add('loaded');
      img.classList.remove('lazy-placeholder');
    };

    preloadImg.src = src;
  }

  // Create IntersectionObserver
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        loadImage(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, {
    rootMargin: config.rootMargin,
    threshold: config.threshold
  });

  // Initialize lazy loading
  function initLazyLoad() {
    const lazyImages = document.querySelectorAll('img[loading="lazy"], img[data-src]');

    lazyImages.forEach(img => {
      // ── Skip eager / high-priority images (hero, LCP) ──
      const loadAttr     = (img.getAttribute('loading') || '').toLowerCase();
      const priorityAttr = (img.getAttribute('fetchpriority') || img.getAttribute('fetchPriority') || '').toLowerCase();

      if (loadAttr === 'eager' || priorityAttr === 'high') {
        img.classList.add('loaded');
        return;
      }

      // Add shimmer placeholder classes
      img.classList.add('lazy-img', 'lazy-placeholder');

      // Move src -> data-src only if it's a real URL (not a data URI)
      const currentSrc = img.getAttribute('src') || '';
      if (!img.dataset.src && currentSrc && !currentSrc.startsWith('data:')) {
        img.dataset.src = currentSrc;
        img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E';
      }

      imageObserver.observe(img);
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLazyLoad);
  } else {
    initLazyLoad();
  }

  // Re-initialize for dynamically added images
  window.initLazyLoad = initLazyLoad;

})();
