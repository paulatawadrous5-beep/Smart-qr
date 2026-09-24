# Smart QR Designer

QR codes that match your link (Facebook, Instagram, YouTube, TikTok, WhatsApp, LinkedIn or any website).
100% client-side: no server, no API keys. Your QR code and uploaded logo are processed locally in your browser.

## Files
    smart-qr/
    ├── index.html
    ├── style.css
    ├── script.js
    ├── README.md
    └── assets/favicon.svg

## Run locally
Double-click `index.html` (needs internet once per load for the QR library from a CDN).

## Upload to GitHub
1. Go to github.com -> New repository -> name it `smart-qr` -> Public -> Create.
2. Click "uploading an existing file", drag ALL files (index.html, style.css, script.js, README.md, and the assets folder).
3. Click "Commit changes".

## Enable GitHub Pages
1. Repository -> Settings -> Pages.
2. Source: "Deploy from a branch". Branch: `main`, folder `/ (root)`. Save.
3. After ~1 minute your site is at `https://YOUR-USERNAME.github.io/smart-qr/`.

## Notes
- Corner style "Square" is the most compatible with every scanner. Rounded/Circle/Leaf work on modern phones; test before printing.
- Neon uses light-on-dark (inverted) colors: fine on most modern phones, not on some old scanner apps.
- Themes use platform-inspired colors only, no official logos.
