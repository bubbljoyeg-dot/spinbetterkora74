/**
 * Professional Lazy Loading with IntersectionObserver
 * Loads images only when they enter the viewport
 */

(function() {
  'use strict';

  // Configuration
  const config = {
    rootMargin: '50px 0px', // Start loading 50px before image enters viewport
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
    /* Specific styles for game images in marquee */
    .ph-game-link img {
      background: linear-gradient(135deg, #16213e 0%, #1a1a2e 100%);
      min-height: 46px;
    }
    /* Placeholder for hero slides */
    .ph-slide[data-src] {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    }
    /* Content images placeholder */
    img[loading="lazy"]:not([src*=".webp"]) {
      background: linear-gradient(90deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%);
      background-size: 200% 100%;
      animation: lazyShimmer 1.5s infinite;
    }
  `;
  document.head.appendChild(style);

  // Create IntersectionObserver
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        loadImage(img);
        observer.unobserve(img);
      }
    });
  }, {
    rootMargin: config.rootMargin,
    threshold: config.threshold
  });

  // Function to load image
  function loadImage(img) {
    const src = img.dataset.src || img.src;
    
    if (!src || img.classList.contains('loaded')) return;

    // Create new image to preload
    const preloadImg = new Image();
    
    preloadImg.onload = () => {
      img.src = src;
      img.classList.add('loaded');
      img.classList.remove('lazy-placeholder');
    };
    
    preloadImg.onerror = () => {
      // Fallback if image fails to load
      img.classList.add('loaded');
      img.classList.remove('lazy-placeholder');
    };
    
    preloadImg.src = src;
  }

  // Initialize lazy loading
  function initLazyLoad() {
    // Get all images with loading="lazy" or data-src
    const lazyImages = document.querySelectorAll('img[loading="lazy"], img[data-src]');
    
    lazyImages.forEach(img => {
      // Add lazy classes
      img.classList.add('lazy-img', 'lazy-placeholder');
      
      // Store original src in data-src if not already set
      if (!img.dataset.src && img.src) {
        img.dataset.src = img.src;
        // Clear src to prevent immediate loading
        img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E';
      }
      
      // Observe this image
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
