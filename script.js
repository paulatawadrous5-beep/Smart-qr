/* =========================================================
   SMART QR DESIGNER
   Static, client-side QR designer. No backend, no API keys.
   Libraries (loaded from a CDN, with a backup CDN):
     - qrcode-generator  -> creates the QR matrix
     - jsQR              -> optional "scan test" of the finished design
   ========================================================= */
(function () {
  'use strict';

  /* ---------------------------------------------------------
     1. CONFIGURATION
     --------------------------------------------------------- */
  var QR_SOURCES = [
    'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js',
    'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js',
    'https://unpkg.com/qrcode-generator@1.4.4/qrcode.js'
  ];
  var JSQR_SOURCES = [
    'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js',
    'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
    'https://unpkg.com/jsqr@1.4.0/dist/jsQR.js'
  ];

  var MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5 MB
  var LOGO_MAX_PX = 320;                // logos are downscaled to this size in the browser

  // Domain lists used for platform detection (plain JavaScript URL parsing, no API).
  var PLATFORM_DOMAINS = {
    facebook: ['facebook.com', 'fb.com', 'fb.me', 'fb.watch'],
    instagram: ['instagram.com', 'instagr.am'],
    youtube: ['youtube.com', 'youtu.be'],
    tiktok: ['tiktok.com'],
    whatsapp: ['wa.me', 'whatsapp.com'],
    linkedin: ['linkedin.com', 'lnkd.in']
  };

  // Platform-inspired themes: colours + a sensible default style. No official artwork.
  var THEMES = {
    generic:   { name: 'Website',   style: 'rounded',  eye: 'rounded', fg: '#111827', fg2: '#4f46e5', mid: null,      bg: '#ffffff', caption: 'Scan me' },
    facebook:  { name: 'Facebook',  style: 'rounded',  eye: 'rounded', fg: '#1877f2', fg2: '#0b4fb0', mid: null,      bg: '#ffffff', caption: 'Find us on Facebook' },
    instagram: { name: 'Instagram', style: 'gradient', eye: 'rounded', fg: '#833ab4', fg2: '#f56040', mid: '#d62976', bg: '#ffffff', caption: 'Open on Instagram' },
    youtube:   { name: 'YouTube',   style: 'classic',  eye: 'rounded', fg: '#d90000', fg2: '#7f0000', mid: null,      bg: '#ffffff', caption: 'Watch on YouTube' },
    tiktok:    { name: 'TikTok',    style: 'neon',     eye: 'rounded', fg: '#25f4ee', fg2: '#fe2c55', mid: null,      bg: '#0b0b12', caption: 'Watch on TikTok' },
    whatsapp:  { name: 'WhatsApp',  style: 'organic',  eye: 'leaf',    fg: '#128c7e', fg2: '#075e54', mid: null,      bg: '#ffffff', caption: 'Chat on WhatsApp' },
    linkedin:  { name: 'LinkedIn',  style: 'glass',    eye: 'rounded', fg: '#0a66c2', fg2: '#00a0dc', mid: null,      bg: '#ffffff', caption: 'Connect on LinkedIn' }
  };

  // Finder ("eye") shapes: outer radius, inner-hole radius, centre radius.
  // Each keeps the required 7x7 ring + 3x3 centre structure of a QR finder pattern.
  var EYES = {
    square:  { o: 0,            h: 0,            i: 0 },
    rounded: { o: 2,            h: 1,            i: 0.8 },
    circle:  { o: 3.5,          h: 2.5,          i: 1.5 },
    leaf:    { o: [3, 0, 3, 0], h: [2, 0, 2, 0], i: [1.5, 0, 1.5, 0] }
  };

  var FONT_STACK = "-apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

  /* ---------------------------------------------------------
     2. SMALL HELPERS
     --------------------------------------------------------- */
  function fmt(v) { return +(+v).toFixed(3); }

  function escapeXml(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[ch];
    });
  }

  function hexToRgb(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(rgb) {
    return '#' + rgb.map(function (v) {
      return Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
    }).join('');
  }
  function mix(a, b, t) {
    var A = hexToRgb(a), B = hexToRgb(b);
    return rgbToHex(A.map(function (v, i) { return v + (B[i] - v) * t; }));
  }
  function lum(hex) {
    var c = hexToRgb(hex).map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) {
    var l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  // Nudge a colour lighter/darker until it has enough contrast with the background.
  function ensureContrast(color, bg, min) {
    if (contrast(color, bg) >= min) return color;
    var target = lum(bg) < 0.5 ? '#ffffff' : '#000000';
    for (var t = 0.05; t <= 1.0001; t += 0.05) {
      var cand = mix(color, target, t);
      if (contrast(cand, bg) >= min) return cand;
    }
    return target;
  }
  function autoLogoBg(bg) { return lum(bg) < 0.2 ? '#ffffff' : bg; }

  /* ---------------------------------------------------------
     3. URL VALIDATION + PLATFORM DETECTION
     --------------------------------------------------------- */
  function parseUrl(raw) {
    var s = String(raw || '').trim();
    if (!s) return { error: 'Please enter a URL first.' };
    if (/\s/.test(s)) return { error: 'Please enter a valid URL.' };
    var candidate = /^[a-z][a-z0-9+.\-]*:\/\//i.test(s) ? s : 'https://' + s;
    var u;
    try { u = new URL(candidate); } catch (e) { return { error: 'Please enter a valid URL.' }; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return { error: 'Please enter a valid URL.' };
    var host = u.hostname.toLowerCase();
    var ok = host === 'localhost' ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ||
      host.charAt(0) === '[' ||
      /^([a-z0-9-]+\.)+[a-z][a-z0-9-]{1,}$/.test(host);
    if (!ok) return { error: 'Please enter a valid URL.' };
    return { url: candidate, host: host };
  }

  function detectPlatform(host) {
    host = String(host || '').toLowerCase().replace(/\.$/, '');
    var ids = Object.keys(PLATFORM_DOMAINS);
    for (var i = 0; i < ids.length; i++) {
      var list = PLATFORM_DOMAINS[ids[i]];
      for (var j = 0; j < list.length; j++) {
        if (host === list[j] || host.slice(-(list[j].length + 1)) === '.' + list[j]) return ids[i];
      }
    }
    return 'generic';
  }

  /* ---------------------------------------------------------
     4. SVG PATH BUILDERS (everything is drawn in "module" units)
     --------------------------------------------------------- */
  // Rounded rectangle with per-corner radii [tl, tr, br, bl]. Always drawn clockwise.
  function rr(x, y, w, h, r) {
    var t = Array.isArray(r) ? r : [r, r, r, r];
    var m = Math.min(w, h) / 2;
    var tl = Math.min(t[0], m), tr = Math.min(t[1], m), br = Math.min(t[2], m), bl = Math.min(t[3], m);
    var d = 'M' + fmt(x + tl) + ' ' + fmt(y) + 'H' + fmt(x + w - tr);
    if (tr > 0) d += 'A' + fmt(tr) + ' ' + fmt(tr) + ' 0 0 1 ' + fmt(x + w) + ' ' + fmt(y + tr);
    d += 'V' + fmt(y + h - br);
    if (br > 0) d += 'A' + fmt(br) + ' ' + fmt(br) + ' 0 0 1 ' + fmt(x + w - br) + ' ' + fmt(y + h);
    d += 'H' + fmt(x + bl);
    if (bl > 0) d += 'A' + fmt(bl) + ' ' + fmt(bl) + ' 0 0 1 ' + fmt(x) + ' ' + fmt(y + h - bl);
    d += 'V' + fmt(y + tl);
    if (tl > 0) d += 'A' + fmt(tl) + ' ' + fmt(tl) + ' 0 0 1 ' + fmt(x + tl) + ' ' + fmt(y);
    return d + 'Z';
  }

  // Classic: square modules, merged into horizontal runs.
  function pathSquare(g, n) {
    var d = '';
    for (var r = 0; r < n; r++) {
      var c = 0;
      while (c < n) {
        if (g[r][c]) {
          var s = c;
          while (c < n && g[r][c]) c++;
          d += 'M' + s + ' ' + r + 'h' + (c - s) + 'v1h' + (-(c - s)) + 'z';
        } else c++;
      }
    }
    return d;
  }

  // Separate soft squares / dots (Gradient + Neon).
  function pathDots(g, n, inset, radius) {
    var d = '', size = 1 - 2 * inset;
    for (var r = 0; r < n; r++)
      for (var c = 0; c < n; c++)
        if (g[r][c]) d += rr(c + inset, r + inset, size, size, radius);
    return d;
  }

  // Connected "liquid" modules (Rounded, Glass, Organic). Only outer corners are rounded.
  // With fillets = true, inner (concave) corners are filled with curves as well (Organic).
  function pathConnected(g, n, R, fillets) {
    function at(r, c) { return r >= 0 && c >= 0 && r < n && c < n && g[r][c]; }
    var d = '';
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (!g[r][c]) continue;
        var u = at(r - 1, c), dn = at(r + 1, c), l = at(r, c - 1), rt = at(r, c + 1);
        d += rr(c, r, 1, 1, [
          (!u && !l) ? R : 0,
          (!u && !rt) ? R : 0,
          (!dn && !rt) ? R : 0,
          (!dn && !l) ? R : 0
        ]);
        if (fillets) {
          var f = fmt(R);
          if (u && l && !at(r - 1, c - 1))
            d += 'M' + c + ' ' + r + 'L' + fmt(c - R) + ' ' + r + 'A' + f + ' ' + f + ' 0 0 0 ' + c + ' ' + fmt(r - R) + 'Z';
          if (u && rt && !at(r - 1, c + 1))
            d += 'M' + (c + 1) + ' ' + r + 'L' + (c + 1) + ' ' + fmt(r - R) + 'A' + f + ' ' + f + ' 0 0 0 ' + fmt(c + 1 + R) + ' ' + r + 'Z';
          if (dn && rt && !at(r + 1, c + 1))
            d += 'M' + (c + 1) + ' ' + (r + 1) + 'L' + fmt(c + 1 + R) + ' ' + (r + 1) + 'A' + f + ' ' + f + ' 0 0 0 ' + (c + 1) + ' ' + fmt(r + 1 + R) + 'Z';
          if (dn && l && !at(r + 1, c - 1))
            d += 'M' + c + ' ' + (r + 1) + 'L' + c + ' ' + fmt(r + 1 + R) + 'A' + f + ' ' + f + ' 0 0 0 ' + fmt(c - R) + ' ' + (r + 1) + 'Z';
        }
      }
    }
    return d;
  }

  // One finder pattern (ring + centre). Use with fill-rule="evenodd".
  function eyeShape(x, y, e) {
    return rr(x, y, 7, 7, e.o) + rr(x + 1, y + 1, 5, 5, e.h) + rr(x + 2, y + 2, 3, 3, e.i);
  }

  function inFinder(r, c, n) {
    return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  }

  /* ---------------------------------------------------------
     5. QR CREATION + SVG COMPOSITION
     --------------------------------------------------------- */
  function makeQr(st) {
    var ec = st.logo ? 'H' : 'Q'; // "H" (30% recovery) whenever a logo covers the centre
    var qr = window.qrcode(0, ec);
    qr.addData(st.url, 'Byte');
    qr.make();
    return { qr: qr, ec: ec, count: qr.getModuleCount() };
  }

  // Boolean grid of the DATA modules only (finder patterns and the logo zone are removed).
  function buildGrid(st, q) {
    var n = q.count;
    var clearLogo = !!st.logo && st.logoShape !== 'none';
    var half = n * st.logoSize / 100 / 2 + 0.35;
    var mid = n / 2;
    var g = [];
    for (var r = 0; r < n; r++) {
      var row = [];
      for (var c = 0; c < n; c++) {
        var dark = q.qr.isDark(r, c);
        if (dark && inFinder(r, c, n)) dark = false;
        if (dark && clearLogo) {
          var dx = Math.abs(c + 0.5 - mid), dy = Math.abs(r + 0.5 - mid);
          if (st.logoShape === 'circle') { if (Math.sqrt(dx * dx + dy * dy) <= half) dark = false; }
          else if (dx <= half && dy <= half) dark = false;
        }
        row.push(dark);
      }
      g.push(row);
    }
    return g;
  }

  function logoLayer(st, n) {
    if (!st.logo) return '';
    var bs = n * st.logoSize / 100, c = n / 2, out = '';
    if (st.logoShape !== 'none') {
      var rad = st.logoShape === 'circle' ? bs / 2 : bs * 0.22;
      out += '<path d="' + rr(c - bs / 2, c - bs / 2, bs, bs, rad) + '" fill="' + st.logoBg + '"/>';
    }
    var iw = st.logoShape === 'none' ? bs : (st.logoShape === 'circle' ? bs * 0.66 : bs * 0.76);
    out += '<image x="' + fmt(c - iw / 2) + '" y="' + fmt(c - iw / 2) + '" width="' + fmt(iw) + '" height="' + fmt(iw) +
           '" preserveAspectRatio="xMidYMid meet" xlink:href="' + st.logo + '"/>';
    return out;
  }

  // Returns { svg, w, h }. w/h are the pixel size used for the width/height attributes.
  function buildSvg(st, q, opts) {
    opts = opts || {};
    var n = q.count, m = st.margin, N = n + 2 * m;
    var capText = (st.caption && String(st.captionText || '').trim()) ? String(st.captionText).trim() : '';
    var capH = capText ? Math.max(3.4, N * 0.085) : 0;
    var W = N, H = N + capH;
    var px = opts.px || st.size;
    var pw = px, ph = Math.round(px * H / W);
    var style = st.style;
    var g = buildGrid(st, q);
    var defs = [], bgLayer, codeLayer, capLayer = '';

    // ----- fills
    var useGrad = style === 'gradient' || style === 'neon';
    if (useGrad) {
      defs.push('<linearGradient id="sqGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="' + n + '" y2="' + n + '">' +
        '<stop offset="0" stop-color="' + st.fg + '"/>' +
        (st.mid ? '<stop offset="0.5" stop-color="' + st.mid + '"/>' : '') +
        '<stop offset="1" stop-color="' + st.fg2 + '"/></linearGradient>');
    }
    var dataFill = useGrad ? 'url(#sqGrad)' : st.fg;
    var eyeFill = style === 'neon' ? st.fg2 : dataFill;

    // ----- modules + finder patterns
    var modPath;
    if (style === 'classic') modPath = pathSquare(g, n);
    else if (style === 'rounded') modPath = pathConnected(g, n, 0.5, false);
    else if (style === 'organic') modPath = pathConnected(g, n, 0.5, true);
    else if (style === 'glass') modPath = pathConnected(g, n, 0.38, false);
    else if (style === 'gradient') modPath = pathDots(g, n, 0.05, 0.3);
    else modPath = pathDots(g, n, 0.1, 0.4); // neon

    var e = EYES[st.eye] || EYES.square;
    var eyePath = eyeShape(0, 0, e) + eyeShape(n - 7, 0, e) + eyeShape(0, n - 7, e);
    var shapes = '<path d="' + modPath + '" fill="' + dataFill + '"/>' +
                 '<path d="' + eyePath + '" fill="' + eyeFill + '" fill-rule="evenodd"/>';

    // ----- style-specific background + effects
    if (style === 'neon') {
      defs.push('<filter id="sqGlow" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">' +
        '<feGaussianBlur stdDeviation="0.38" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>');
      bgLayer = '<rect width="' + fmt(W) + '" height="' + fmt(H) + '" fill="' + st.bg + '"/>';
      if (m >= 3) {
        bgLayer += '<rect x="0.9" y="0.9" width="' + fmt(W - 1.8) + '" height="' + fmt(H - 1.8) + '" rx="1.8" fill="none" stroke="' +
                   st.fg2 + '" stroke-width="0.14" opacity="0.9" filter="url(#sqGlow)"/>';
      }
      shapes = '<g filter="url(#sqGlow)">' + shapes + '</g>';
    } else if (style === 'glass') {
      var c1 = mix(st.bg, st.fg, 0.16), c2 = mix(st.bg, st.fg2, 0.30);
      defs.push('<linearGradient id="sqGlassBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient>');
      defs.push('<filter id="sqBlur" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="' + fmt(N * 0.06) + '"/></filter>');
      defs.push('<filter id="sqCard" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="0.3" stdDeviation="0.55" flood-color="#000000" flood-opacity="0.18"/></filter>');
      defs.push('<filter id="sqSoft" x="-5%" y="-5%" width="110%" height="110%"><feDropShadow dx="0" dy="0.08" stdDeviation="0.12" flood-color="#000000" flood-opacity="0.22"/></filter>');
      var inset = Math.min(1, m * 0.3);
      bgLayer = '<rect width="' + fmt(W) + '" height="' + fmt(H) + '" fill="url(#sqGlassBg)"/>' +
        '<circle cx="' + fmt(W * 0.12) + '" cy="' + fmt(N * 0.1) + '" r="' + fmt(N * 0.28) + '" fill="' + st.fg2 + '" opacity="0.55" filter="url(#sqBlur)"/>' +
        '<circle cx="' + fmt(W * 0.9) + '" cy="' + fmt(N * 0.92) + '" r="' + fmt(N * 0.3) + '" fill="' + st.fg + '" opacity="0.4" filter="url(#sqBlur)"/>' +
        '<rect x="' + fmt(inset) + '" y="' + fmt(inset) + '" width="' + fmt(N - 2 * inset) + '" height="' + fmt(N - 2 * inset) +
        '" rx="1.8" fill="' + mix(st.bg, '#ffffff', 0.85) + '" fill-opacity="0.92" stroke="#ffffff" stroke-opacity="0.85" stroke-width="0.12" filter="url(#sqCard)"/>';
      shapes = '<g filter="url(#sqSoft)">' + shapes + '</g>';
    } else {
      bgLayer = '<rect width="' + fmt(W) + '" height="' + fmt(H) + '" fill="' + st.bg + '"/>';
    }

    codeLayer = '<g transform="translate(' + m + ' ' + m + ')">' + shapes + logoLayer(st, n) + '</g>';

    // ----- optional caption under the code
    if (capText) {
      var fs = capH * 0.42, maxW = N * 0.86, est = capText.length * fs * 0.58;
      if (est > maxW) fs = maxW / (capText.length * 0.58);
      var capColor = style === 'gradient' ? st.fg2 : st.fg;
      capLayer = '<text x="' + fmt(W / 2) + '" y="' + fmt(N + capH * 0.5 + fs * 0.35) + '" text-anchor="middle" font-family="' + FONT_STACK +
                 '" font-weight="700" font-size="' + fmt(fs) + '" fill="' + capColor + '"' +
                 (style === 'neon' ? ' filter="url(#sqGlow)"' : '') + '>' + escapeXml(capText) + '</text>';
    }

    var label = 'QR code for ' + st.url;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + pw + '" height="' + ph +
      '" viewBox="0 0 ' + fmt(W) + ' ' + fmt(H) + '" role="img" aria-label="' + escapeXml(label) + '">' +
      '<title>' + escapeXml(label) + '</title><defs>' + defs.join('') + '</defs>' + bgLayer + codeLayer + capLayer + '</svg>';
    return { svg: svg, w: pw, h: ph };
  }

  // Honest "scan-safety" hints based on the current design.
  function assess(st, q) {
    var tips = [];
    var effBg = st.style === 'glass' ? mix(st.bg, '#ffffff', 0.85) : st.bg;
    var cols = [st.fg];
    if (st.style === 'gradient' || st.style === 'neon') { cols.push(st.fg2); if (st.mid) cols.push(st.mid); }
    var minC = Math.min.apply(null, cols.map(function (c) { return contrast(c, effBg); }));
    var inverted = cols.some(function (c) { return lum(c) > lum(effBg); });
    if (minC < 3) tips.push({ level: 'bad', text: 'Low contrast (' + minC.toFixed(1) + ':1). Use a darker code colour or a lighter background.' });
    else if (minC < 4.5) tips.push({ level: 'warn', text: 'Contrast is on the low side (' + minC.toFixed(1) + ':1). Test it before printing.' });
    if (inverted) tips.push({ level: 'warn', text: 'Light-on-dark codes scan on most modern phones, but some older scanner apps cannot read them.' });
    if (st.logo) {
      tips.push(st.logoSize > 26
        ? { level: 'warn', text: 'Large logo. Keep it at 26% or less for the most reliable scanning.' }
        : { level: 'ok', text: 'Logo added with maximum error correction (H).' });
    }
    if (st.margin < 3) tips.push({ level: 'warn', text: 'A quiet zone under 3 modules can make scanning harder.' });
    if (q.count >= 57) tips.push({ level: 'warn', text: 'Long link = dense code. A shorter link scans faster.' });
    if (!tips.length) tips.push({ level: 'ok', text: 'Good contrast and quiet zone. Error correction level ' + q.ec + '.' });
    return tips;
  }

  /* ---------------------------------------------------------
     6. LIBRARY LOADING
     --------------------------------------------------------- */
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { s.remove(); reject(new Error('Failed: ' + src)); };
      document.head.appendChild(s);
    });
  }
  function loadLib(isReady, sources) {
    if (isReady()) return Promise.resolve(true);
    var chain = Promise.resolve(false);
    sources.forEach(function (src) {
      chain = chain.then(function (done) {
        if (done) return true;
        return loadScript(src).then(function () { return isReady(); }, function () { return false; });
      });
    });
    return chain;
  }
  function qrReady() { return typeof window.qrcode === 'function'; }
  function jsqrReady() { return typeof window.jsQR === 'function'; }

  /* =========================================================
     7. APP (browser only)
     ========================================================= */
  function initApp() {
    var $ = function (id) { return document.getElementById(id); };

    function freshState() {
      return {
        url: '', host: '', detected: 'generic', themeId: 'generic',
        style: 'rounded', eye: 'rounded',
        fg: '#111827', fg2: '#4f46e5', mid: null, bg: '#ffffff',
        size: 512, margin: 4,
        logo: null, logoName: '', logoSize: 22, logoShape: 'rounded', logoBg: '#ffffff', logoBgAuto: true,
        caption: false, captionText: 'Scan me'
      };
    }
    var state = freshState();
    var current = null;         // latest QR matrix info
    var libsPromise = loadLib(qrReady, QR_SOURCES);
    var jsqrPromise = loadLib(jsqrReady, JSQR_SOURCES);

    // ----- element refs
    var urlForm = $('urlForm'), urlInput = $('urlInput'), urlError = $('urlError');
    var studio = $('studio'), preview = $('preview'), renderError = $('renderError');
    var scanStatus = $('scanStatus'), tipsList = $('tips');
    var themeSelect = $('themeSelect');
    var fgInput = $('fg'), fg2Input = $('fg2'), bgInput = $('bg');
    var sizeInput = $('size'), marginInput = $('margin');
    var logoInput = $('logoInput'), logoBtn = $('logoBtn'), removeLogoBtn = $('removeLogoBtn'), logoMsg = $('logoMsg');
    var logoSizeInput = $('logoSize'), logoShapeSelect = $('logoShape'), logoBgInput = $('logoBg');
    var captionOn = $('captionOn'), captionText = $('captionText');
    var styleChips = Array.prototype.slice.call(document.querySelectorAll('[data-style]'));
    var eyeChips = Array.prototype.slice.call(document.querySelectorAll('[data-eye]'));

    // ----- small UI helpers
    var toastTimer;
    function toast(msg) {
      var t = $('toast');
      t.textContent = msg; t.hidden = false; t.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { t.classList.remove('show'); t.hidden = true; }, 2600);
    }
    function showUrlError(msg) { urlError.textContent = msg; urlError.hidden = false; urlInput.setAttribute('aria-invalid', 'true'); }
    function clearUrlError() { urlError.hidden = true; urlInput.removeAttribute('aria-invalid'); }

    function applyTheme(id) {
      var t = THEMES[id] || THEMES.generic;
      state.themeId = THEMES[id] ? id : 'generic';
      state.style = t.style; state.eye = t.eye;
      state.fg = t.fg; state.fg2 = t.fg2; state.mid = t.mid; state.bg = t.bg;
      state.caption = state.themeId !== 'generic';
      state.captionText = t.caption;
      if (state.logoBgAuto) state.logoBg = autoLogoBg(state.bg);
    }

    function setBrandColors() {
      var root = document.documentElement.style;
      var c1 = state.fg, c2 = state.fg2;
      // keep UI accents readable: if the code colour is very light, use the second colour for UI
      if (contrast(c1, '#ffffff') < 2.2) c1 = state.fg2;
      if (contrast(c1, '#ffffff') < 2.2) c1 = '#4f46e5';
      root.setProperty('--brand', c1);
      root.setProperty('--brand-2', state.mid || c2);
    }

    function syncControls() {
      var t = THEMES[state.detected] || THEMES.generic;
      $('detectedName').textContent = state.detected === 'generic' ? 'Generic website' : t.name;
      $('detectedHost').textContent = state.host;
      themeSelect.value = state.themeId;
      styleChips.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-style') === state.style)); });
      eyeChips.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-eye') === state.eye)); });
      fgInput.value = state.fg; fg2Input.value = state.fg2; bgInput.value = state.bg;
      sizeInput.value = state.size; $('sizeOut').textContent = state.size + ' px';
      marginInput.value = state.margin; $('marginOut').textContent = state.margin + ' modules';
      logoSizeInput.value = state.logoSize; $('logoSizeOut').textContent = state.logoSize + '%';
      logoShapeSelect.value = state.logoShape; logoBgInput.value = state.logoBg;
      var has = !!state.logo;
      removeLogoBtn.disabled = !has; logoSizeInput.disabled = !has; logoShapeSelect.disabled = !has; logoBgInput.disabled = !has;
      logoBtn.textContent = has ? 'Replace logo' : 'Upload logo';
      if (has && state.logoName) logoMsg.textContent = state.logoName;
      captionOn.checked = state.caption; captionText.value = state.captionText;
      captionText.disabled = !state.caption;
      setBrandColors();
    }

    /* ----- rendering ----- */
    var rafPending = false;
    function renderSoon() {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(function () { rafPending = false; render(); });
    }

    function render() {
      if (!state.url) return;
      if (!qrReady()) { showRenderError('The QR library is not loaded yet. Check your internet connection and reload the page.'); return; }
      try {
        current = makeQr(state);
        var out = buildSvg(state, current);
        preview.innerHTML = out.svg;
        renderError.hidden = true;
        renderTips(assess(state, current));
        scheduleScanCheck();
      } catch (err) {
        current = null;
        var msg = /overflow|too long|code length/i.test(String(err && err.message))
          ? 'This link is too long to fit in a QR code. Please use a shorter link.'
          : 'Sorry, the QR code could not be generated. Please check the link and try again.';
        showRenderError(msg);
        if (window.console) console.error(err);
      }
    }
    function showRenderError(msg) {
      renderError.textContent = msg; renderError.hidden = false;
      preview.innerHTML = ''; tipsList.innerHTML = ''; setBadge('hidden');
    }

    function renderTips(tips) {
      tipsList.innerHTML = '';
      tips.slice(0, 4).forEach(function (t) {
        var li = document.createElement('li');
        li.className = 'tip tip-' + t.level;
        li.textContent = t.text;
        tipsList.appendChild(li);
      });
    }

    /* ----- scan test (jsQR) ----- */
    var scanToken = 0, scanTimer;
    function setBadge(kind, extra) {
      var map = {
        checking: ['Checking scan…', 'scan-checking'],
        ok: ['Scan test passed', 'scan-ok'],
        fail: ['Scan test failed. Try more contrast, a bigger quiet zone or a smaller logo.', 'scan-fail'],
        off: ['Scan test unavailable (offline). Test with your phone.', 'scan-off']
      };
      if (kind === 'hidden') { scanStatus.hidden = true; return; }
      var m = map[kind];
      scanStatus.hidden = false;
      scanStatus.className = 'scan-status ' + m[1];
      scanStatus.textContent = m[0];
    }
    function scheduleScanCheck() {
      setBadge('checking');
      clearTimeout(scanTimer);
      scanTimer = setTimeout(runScanCheck, 400);
    }
    function runScanCheck() {
      var token = ++scanToken;
      var snapshot = current, url = state.url;
      if (!snapshot) return;
      jsqrPromise.then(function (ok) {
        if (token !== scanToken) return;
        if (!ok) { setBadge('off'); return; }
        var out = buildSvg(state, snapshot, { px: 640 });
        return svgToCanvas(out.svg, out.w, out.h).then(function (canvas) {
          if (token !== scanToken) return;
          var ctx = canvas.getContext('2d');
          var img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          var res = window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
          setBadge(res && res.data === url ? 'ok' : 'fail');
        });
      }).catch(function () { if (token === scanToken) setBadge('off'); });
    }

    /* ----- export ----- */
    function svgToCanvas(svgString, w, h) {
      return new Promise(function (resolve, reject) {
        var blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        var objUrl = URL.createObjectURL(blob);
        var img = new Image();
        img.onload = function () {
          var c = document.createElement('canvas');
          c.width = w; c.height = h;
          var ctx = c.getContext('2d');
          ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(objUrl);
          resolve(c);
        };
        img.onerror = function () { URL.revokeObjectURL(objUrl); reject(new Error('Could not render the image.')); };
        img.src = objUrl;
      });
    }
    function saveBlob(blob, name) {
      var a = document.createElement('a');
      var href = URL.createObjectURL(blob);
      a.href = href; a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(function () { a.remove(); URL.revokeObjectURL(href); }, 2000);
    }
    function fileName(ext) {
      var slug = state.themeId === 'generic' ? 'website' : state.themeId;
      return 'smart-qr-' + slug + '.' + ext;
    }
    function downloadPng() {
      if (!current) { toast('Generate a QR code first.'); return; }
      var out = buildSvg(state, current, { px: state.size });
      svgToCanvas(out.svg, out.w, out.h).then(function (canvas) {
        canvas.toBlob(function (blob) {
          if (!blob) { toast('PNG export failed. Try the SVG download.'); return; }
          saveBlob(blob, fileName('png'));
          toast('Saved ' + fileName('png'));
        }, 'image/png');
      }).catch(function () { toast('PNG export failed. Try the SVG download.'); });
    }
    function downloadSvg() {
      if (!current) { toast('Generate a QR code first.'); return; }
      var out = buildSvg(state, current, { px: state.size });
      var xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + out.svg;
      saveBlob(new Blob([xml], { type: 'image/svg+xml' }), fileName('svg'));
      toast('Saved ' + fileName('svg'));
    }

    /* ----- logo upload (processed locally) ----- */
    function handleLogoFile(file) {
      if (!file) return;
      logoMsg.classList.remove('is-error');
      if (!/^image\//.test(file.type)) { logoError('Please choose an image file (PNG, JPG, SVG or WebP).'); return; }
      if (file.size > MAX_LOGO_BYTES) { logoError('That image is larger than 5 MB. Please choose a smaller one.'); return; }
      var reader = new FileReader();
      reader.onerror = function () { logoError('The image could not be read. Please try another file.'); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { logoError('The image could not be opened. Please try another file.'); };
        img.onload = function () {
          try {
            var w = img.naturalWidth || LOGO_MAX_PX, h = img.naturalHeight || LOGO_MAX_PX;
            var scale = Math.min(1, LOGO_MAX_PX / Math.max(w, h));
            var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
            var c = document.createElement('canvas');
            c.width = cw; c.height = ch;
            c.getContext('2d').drawImage(img, 0, 0, cw, ch);
            state.logo = c.toDataURL('image/png');
            state.logoName = file.name;
            syncControls(); render();
          } catch (e) { logoError('The image could not be processed. Please try another file.'); }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    }
    function logoError(msg) {
      logoMsg.textContent = msg; logoMsg.classList.add('is-error');
    }

    /* ----- style switching keeps colours readable ----- */
    function setStyle(s) {
      var prev = state.style;
      state.style = s;
      var keys = ['fg', 'fg2', 'mid'];
      if (s === 'neon' && prev !== 'neon') {
        if (lum(state.bg) > 0.25) { state.bg = '#0b0b12'; if (state.logoBgAuto) state.logoBg = autoLogoBg(state.bg); }
        keys.forEach(function (k) { if (state[k]) state[k] = ensureContrast(state[k], state.bg, 4.5); });
      } else if (prev === 'neon' && s !== 'neon' && lum(state.bg) < 0.2) {
        state.bg = '#ffffff'; if (state.logoBgAuto) state.logoBg = autoLogoBg(state.bg);
        keys.forEach(function (k) { if (state[k]) state[k] = ensureContrast(state[k], state.bg, 4.5); });
      }
    }

    /* ----- events ----- */
    urlForm.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var parsed = parseUrl(urlInput.value);
      if (parsed.error) { showUrlError(parsed.error); return; }
      clearUrlError();
      libsPromise.then(function (ok) {
        if (!ok) { showUrlError('The QR library could not be loaded. Check your internet connection and reload the page.'); return; }
        var detected = detectPlatform(parsed.host);
        var firstTime = studio.hidden;
        state.url = parsed.url; state.host = parsed.host;
        if (firstTime || detected !== state.detected) {
          state.detected = detected;
          applyTheme(detected);
        }
        studio.hidden = false;
        syncControls();
        render();
        if (firstTime) studio.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    urlInput.addEventListener('input', clearUrlError);

    themeSelect.addEventListener('change', function () { applyTheme(themeSelect.value); syncControls(); render(); });
    styleChips.forEach(function (b) {
      b.addEventListener('click', function () { setStyle(b.getAttribute('data-style')); syncControls(); render(); });
    });
    eyeChips.forEach(function (b) {
      b.addEventListener('click', function () { state.eye = b.getAttribute('data-eye'); syncControls(); render(); });
    });

    fgInput.addEventListener('input', function () { state.fg = fgInput.value; state.mid = null; setBrandColors(); renderSoon(); });
    fg2Input.addEventListener('input', function () { state.fg2 = fg2Input.value; state.mid = null; setBrandColors(); renderSoon(); });
    bgInput.addEventListener('input', function () {
      state.bg = bgInput.value;
      if (state.logoBgAuto) { state.logoBg = autoLogoBg(state.bg); logoBgInput.value = state.logoBg; }
      renderSoon();
    });

    sizeInput.addEventListener('input', function () { state.size = +sizeInput.value; $('sizeOut').textContent = state.size + ' px'; });
    marginInput.addEventListener('input', function () { state.margin = +marginInput.value; $('marginOut').textContent = state.margin + ' modules'; renderSoon(); });

    logoBtn.addEventListener('click', function () { logoInput.click(); });
    logoInput.addEventListener('change', function () { handleLogoFile(logoInput.files && logoInput.files[0]); logoInput.value = ''; });
    removeLogoBtn.addEventListener('click', function () {
      state.logo = null; state.logoName = ''; logoMsg.textContent = ''; logoMsg.classList.remove('is-error');
      syncControls(); render();
    });
    logoSizeInput.addEventListener('input', function () { state.logoSize = +logoSizeInput.value; $('logoSizeOut').textContent = state.logoSize + '%'; renderSoon(); });
    logoShapeSelect.addEventListener('change', function () { state.logoShape = logoShapeSelect.value; render(); });
    logoBgInput.addEventListener('input', function () { state.logoBg = logoBgInput.value; state.logoBgAuto = false; renderSoon(); });

    captionOn.addEventListener('change', function () { state.caption = captionOn.checked; captionText.disabled = !state.caption; render(); });
    captionText.addEventListener('input', function () { state.captionText = captionText.value.slice(0, 40); renderSoon(); });

    $('downloadPng').addEventListener('click', downloadPng);
    $('downloadSvg').addEventListener('click', downloadSvg);
    $('resetBtn').addEventListener('click', function () {
      var keep = { url: state.url, host: state.host, detected: state.detected };
      state = freshState();
      state.url = keep.url; state.host = keep.host; state.detected = keep.detected;
      applyTheme(state.detected);
      logoMsg.textContent = ''; logoMsg.classList.remove('is-error');
      syncControls(); render();
      toast('Reset to the detected theme');
    });

    setBrandColors();
    libsPromise.then(function (ok) {
      if (!ok) showUrlError('The QR library could not be loaded. Check your internet connection and reload the page.');
    });
  }

  /* ---------------------------------------------------------
     8. BOOT (browser) / EXPORTS (for tests)
     --------------------------------------------------------- */
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApp);
    else initApp();
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseUrl: parseUrl, detectPlatform: detectPlatform, buildSvg: buildSvg, assess: assess, THEMES: THEMES, EYES: EYES };
  }
})();
