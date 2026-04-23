const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const newsHtmlPath = path.join(rootDir, 'news', 'index.html');
const dailyCouponPath = path.join(rootDir, 'daily-coupon', 'index.html');

// 1. Fix daily-coupon/index.html by using news/index.html as a shell
const newsContent = fs.readFileSync(newsHtmlPath, 'utf8');
const couponHtmlParts = fs.readFileSync(dailyCouponPath, 'utf8').split(/<div class="coupon-page-wrapper">/);

if (couponHtmlParts.length === 2) {
    const couponInner = '<div class="coupon-page-wrapper">' + couponHtmlParts[1].split(/<script src="\.\.\/analytics/)[0];
    
    // Extract shell from news/index.html
    const shellTop = newsContent.split(/<main class="magazine-container".*?>/)[0];
    const shellBottom = '</main>' + newsContent.split('</main>')[1];
    
    let newCouponContent = shellTop + '\n<main class="magazine-container" style="padding-top: 30px;">\n' + couponInner + '\n' + shellBottom;
    
    // Add specific CSS/JS to head/body
    newCouponContent = newCouponContent.replace('</head>', '  <link rel="stylesheet" href="./coupon.css">\n  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\n</head>');
    newCouponContent = newCouponContent.replace('</body>', '  <script src="./coupon.js" defer></script>\n</body>');
    
    // Fix paths (news uses ../, daily-coupon uses ../) so it's fine
    newCouponContent = newCouponContent.replace(/<title>.*?<\/title>/, '<title>قسيمتك اليوم | أكواد حصرية</title>');
    
    fs.writeFileSync(dailyCouponPath, newCouponContent, 'utf8');
    console.log('Fixed daily-coupon/index.html layout');
}

// 2. Inject links into all index.html files
function processDirectory(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            if (file === 'backup' || file === 'admin-kora74-secure') continue;
            processDirectory(fullPath);
        } else if (file === 'index.html') {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;
            
            // Adjust path depending on folder depth
            const isRoot = dir === rootDir;
            const prefix = isRoot ? './' : '../';

            // 1. Add to sidebar (.sb-nav)
            if (content.includes('class="sb-nav"') && !content.includes(`href="${prefix}daily-coupon/"`) && !content.includes('قسيمة اليوم')) {
                const promoRegex = /(<a href="(?:[.\/]*?)promo-code\/?" class="sb-link">[\s\S]*?<\/a>)/;
                if (promoRegex.test(content)) {
                    content = content.replace(promoRegex, `$1\n      <a href="${prefix}daily-coupon/" class="sb-link" style="color:#d946ef;">\n        <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:currentColor;flex-shrink:0"><path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"/></svg> <span style="color:#d946ef;">قسيمة اليوم 🎯</span>\n      </a>`);
                    modified = true;
                }
            }

            // 2. Add to app-header (.header-nav)
            if (content.includes('class="header-nav"') && !content.includes(`href="${prefix}daily-coupon/"`) && !content.includes('قسيمة اليوم')) {
                const newsRegex = /(<a href="(?:[.\/]*?)news\/.*?">.*?<\/a>)/;
                if (newsRegex.test(content)) {
                    content = content.replace(newsRegex, `$1\n        <a href="${prefix}daily-coupon/" style="color:#d946ef; font-weight:bold;"><span>قسيمة اليوم 🎯</span></a>`);
                    modified = true;
                }
            }

            // 3. Add to footer (.footer-links)
            if (content.includes('class="footer-links"') && !content.includes(`href="${prefix}daily-coupon/"`) && !content.includes('قسيمة اليوم')) {
                const termsRegex = /(<a href="(?:[.\/]*?)terms\/.*?">.*?<\/a>)/;
                if (termsRegex.test(content)) {
                    content = content.replace(termsRegex, `$1\n          <a href="${prefix}daily-coupon/" style="color:#d946ef;">قسيمة اليوم 🎯</a>`);
                    modified = true;
                }
            }

            if (modified) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated links in ${fullPath}`);
            }
        }
    }
}

processDirectory(rootDir);
