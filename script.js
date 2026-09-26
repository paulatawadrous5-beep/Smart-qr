/**
 * Smart QR Studio — Dynamic Evidence-Based QR Platform
 * Final Two-Issue Hardening Patch:
 * - Structural 7x7 finder pattern safety: Canvas and SVG render exact, unclipped 7x7 structural QR Finders
 *   (outer 7x7 box, 1-module clear separator ring, solid 3x3 core) preserving standard 1:1:3:1:1 proportions
 *   without decorative clipping, while allowing creative dot styles on data modules.
 * - Server theme-color validation: incoming metadata themeColor is strictly validated via isValidHexColor()
 *   and normalized before entering the application state, canvas, SVG, or luminance calculations.
 */

(function () {
  'use strict';

  // --- 1. APPLICATION STATE ---
  const state = {
    url: '',
    theme: localStorage.getItem('smart_qr_app_theme') || 'system',
    detection: null,
    smartMode: 'identity', // 'identity' | 'context'
    designVariationIndex: 0,
    activePreset: null,
    activeLogoImg: null,
    activeLogoDataUrl: null,
    activeLogoIsVerified: false,
    customLogoImg: null,
    customLogoDataUrl: null,
    isManualOverride: false,
    currentAnalysisId: 0,
    currentRenderToken: 0,
    options: {
      dotStyle: 'square', // 'square' | 'rounded' | 'dots' | 'classy' | 'smooth'
      eyeStyle: 'square', // 'square' | 'rounded' | 'circle' | 'leaf'
      fgColor: '#0F172A',
      bgColor: '#FFFFFF',
      useGradient: false,
      fgGradColor: '#2563EB',
      logoMode: 'auto', // 'auto' | 'none' | 'custom'
      centerBadgeText: '',
      frameStyle: 'none', // 'none' | 'badge-top' | 'badge-bottom' | 'pill'
      frameText: 'SCAN ME',
      ecc: 'H',
      quietZone: 4,
      size: 1024
    }
  };

  // --- 2. VALIDATION, COLOR, XML, URI & URL UTILITIES ---

  function isValidHexColor(hex) {
    if (!hex || typeof hex !== 'string') return false;
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex.trim());
  }

  function normalizeHexColor(hex) {
    const clean = hex.trim();
    if (clean.length === 4) {
      return `#${clean[1]}${clean[1]}${clean[2]}${clean[2]}${clean[3]}${clean[3]}`.toUpperCase();
    }
    return clean.toUpperCase();
  }

  function hexToRgb(hex) {
    const clean = normalizeHexColor(hex).replace('#', '');
    const rgbInt = parseInt(clean, 16);
    return {
      r: (rgbInt >> 16) & 0xff,
      g: (rgbInt >> 8) & 0xff,
      b: rgbInt & 0xff
    };
  }

  function rgbToHex(r, g, b) {
    const clamp = (val) => Math.max(0, Math.min(255, Math.round(val)));
    const toHex = (c) => clamp(c).toString(16).padStart(2, '0').toUpperCase();
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  function adjustColorBrightness(hex, factor) {
    const { r, g, b } = hexToRgb(hex);
    if (factor < 0) {
      const mult = 1 + factor;
      return rgbToHex(r * mult, g * mult, b * mult);
    }
    return rgbToHex(r + (255 - r) * factor, g + (255 - g) * factor, b + (255 - b) * factor);
  }

  function escapeXml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe).replace(/[<>&'"]/g, function (c) {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }

  function safeDecodeURIComponent(str) {
    if (!str) return '';
    try {
      return decodeURIComponent(str);
    } catch (e) {
      return String(str).replace(/%(?![0-9a-fA-F]{2})/g, '%25');
    }
  }

  function normalizeURL(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    const trimmed = rawUrl.trim();
    try {
      const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);
      const parsed = new URL(hasScheme ? trimmed : `https://${trimmed}`);

      if ((parsed.protocol === 'http:' && parsed.port === '80') ||
          (parsed.protocol === 'https:' && parsed.port === '443')) {
        parsed.port = '';
      }

      parsed.hostname = parsed.hostname.toLowerCase();

      if (parsed.pathname === '/') {
        parsed.pathname = '';
      }

      return parsed.href;
    } catch (e) {
      return trimmed;
    }
  }

  function isSafeScheme(rawUrl) {
    try {
      const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawUrl.trim());
      const parsed = new URL(hasScheme ? rawUrl.trim() : `https://${rawUrl.trim()}`);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  // --- 3. QR SPECIFICATION STRUCTURAL FUNCTION-PATTERN PROTECTION ---
  const QRStructure = {
    alignmentPatternCenters: [
      [], // V0
      [], // V1
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170]
    ],

    getVersion(moduleCount) {
      return Math.round((moduleCount - 21) / 4) + 1;
    },

    createFunctionModuleMask(moduleCount) {
      const mask = Array.from({ length: moduleCount }, () => new Uint8Array(moduleCount));
      const v = this.getVersion(moduleCount);

      // 1. Finder patterns + separators (8x8 module regions)
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (r < moduleCount && c < moduleCount) mask[r][c] = 1;
          if (r < moduleCount && (moduleCount - 1 - c) >= 0) mask[r][moduleCount - 1 - c] = 1;
          if ((moduleCount - 1 - r) >= 0 && c < moduleCount) mask[moduleCount - 1 - r][c] = 1;
        }
      }

      // 2. Format Information Areas
      for (let i = 0; i <= 8; i++) {
        if (i < moduleCount) {
          mask[8][i] = 1;
          mask[i][8] = 1;
        }
      }
      for (let c = moduleCount - 8; c < moduleCount; c++) {
        if (c >= 0) mask[8][c] = 1;
      }
      for (let r = moduleCount - 8; r < moduleCount; r++) {
        if (r >= 0) mask[r][8] = 1;
      }

      // 3. Timing patterns
      for (let i = 0; i < moduleCount; i++) {
        mask[6][i] = 1;
        mask[i][6] = 1;
      }

      // 4. Alignment patterns
      if (v >= 2 && v <= 40 && this.alignmentPatternCenters[v]) {
        const centers = this.alignmentPatternCenters[v];
        for (let i = 0; i < centers.length; i++) {
          for (let j = 0; j < centers.length; j++) {
            const cr = centers[i];
            const cc = centers[j];
            if ((cr <= 8 && cc <= 8) ||
                (cr <= 8 && cc >= moduleCount - 9) ||
                (cr >= moduleCount - 9 && cc <= 8)) {
              continue;
            }
            for (let ar = -2; ar <= 2; ar++) {
              for (let ac = -2; ac <= 2; ac++) {
                const pr = cr + ar;
                const pc = cc + ac;
                if (pr >= 0 && pr < moduleCount && pc >= 0 && pc < moduleCount) {
                  mask[pr][pc] = 1;
                }
              }
            }
          }
        }
      }

      // 5. Version info areas
      if (v >= 7) {
        for (let r = 0; r < 6; r++) {
          for (let c = 0; c < 3; c++) {
            mask[r][moduleCount - 11 + c] = 1;
            mask[moduleCount - 11 + c][r] = 1;
          }
        }
      }

      // 6. Dark module
      const darkModuleRow = 4 * v + 9;
      if (darkModuleRow < moduleCount) {
        mask[darkModuleRow][8] = 1;
      }

      return mask;
    }
  };

  // --- 4. INTERNATIONAL UNICODE-AWARE IDENTITY SYNTHESIZER ---
  const IdentitySynthesizer = {
    generateMeaningfulAbbreviation(name, maxChars = 4) {
      if (!name) return '';
      const stopWords = new Set(['and', 'of', 'the', 'for', 'in', 'at', 'on', 'a', 'an', 'to', 'by', 'with', 'co', 'inc', 'corp', 'llc', 'ltd']);

      let tokens = [];
      try {
        tokens = name
          .replace(/[^\p{L}\p{N}\s]/gu, ' ')
          .split(/\s+/)
          .filter(t => t.length > 0 && !stopWords.has(t.toLowerCase()));
      } catch (e) {
        tokens = name
          .replace(/[^a-zA-Z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter(t => t.length > 0 && !stopWords.has(t.toLowerCase()));
      }

      if (tokens.length >= 2) {
        const letters = tokens.map(t => Array.from(t)[0].toUpperCase()).slice(0, maxChars);
        return letters.join('');
      }

      return '';
    },

    synthesizeBadgeLabel(displayName, username, platform, maxChars = 4) {
      if (displayName && displayName !== platform) {
        const abbr = this.generateMeaningfulAbbreviation(displayName, maxChars);
        if (abbr && abbr.length >= 2 && abbr.length <= maxChars) return abbr;
      }

      if (displayName && !displayName.includes(' ')) {
        const chars = Array.from(displayName);
        if (chars.length <= maxChars) return displayName.toUpperCase();
      }

      if (username) {
        const cleanUser = username.replace(/^@/, '');
        const chars = Array.from(cleanUser);
        if (chars.length <= maxChars) return cleanUser.toUpperCase();

        const userAbbr = this.generateMeaningfulAbbreviation(cleanUser.replace(/[._-]/g, ' '), maxChars);
        if (userAbbr && userAbbr.length >= 2) return userAbbr;
        return chars.slice(0, maxChars).join('').toUpperCase();
      }

      if (platform) {
        const pChars = Array.from(platform);
        if (pChars.length <= maxChars) return platform.toUpperCase();
      }

      if (displayName) {
        const words = displayName.split(/\s+/).filter(Boolean);
        if (words.length >= 2) {
          return (Array.from(words[0])[0] + Array.from(words[1])[0]).toUpperCase();
        }
        return Array.from(displayName).slice(0, maxChars).join('').toUpperCase();
      }

      return 'QR';
    }
  };

  // --- 5. PLUGGABLE METADATA PROVIDER ---
  const MetadataProvider = {
    cache: new Map(),
    activeAbortController: null,
    apiEndpoint: '',

    sanitize(str) {
      if (!str) return '';
      const div = document.createElement('div');
      div.textContent = String(str).trim();
      return div.textContent;
    },

    extractDomainRoot(host) {
      const parts = host.replace(/^www\./, '').split('.');
      if (parts.length >= 2) {
        const root = parts[parts.length - 2];
        return root.charAt(0).toUpperCase() + root.slice(1);
      }
      return host;
    },

    async fetchEvidence(rawUrl, analysisId) {
      const normalized = normalizeURL(rawUrl);

      if (this.cache.has(normalized)) {
        return { evidence: this.cache.get(normalized), isStale: false };
      }

      if (this.activeAbortController) {
        this.activeAbortController.abort();
      }
      this.activeAbortController = new AbortController();
      const signal = this.activeAbortController.signal;

      if (!isSafeScheme(normalized)) {
        const rawResult = {
          valid: false,
          platform: 'Raw Data',
          displayName: this.sanitize(rawUrl.slice(0, 24)),
          username: null,
          category: 'Direct Text / Payload',
          confidence: 'Basic heuristic detection',
          brandColor: '#0F172A',
          badgeText: 'TXT',
          imageCandidates: [],
          isVerifiedServerMetadata: false
        };
        this.cache.set(normalized, rawResult);
        return { evidence: rawResult, isStale: analysisId !== state.currentAnalysisId };
      }

      const parsed = new URL(normalized);
      const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
      const path = parsed.pathname;
      const pathParts = path.split('/').filter(Boolean);

      let platform = this.extractDomainRoot(host);
      let displayName = null;
      let username = null;
      let category = 'Web Destination';
      let confidence = 'Structural path detection';
      let brandColor = '#2563EB';
      let isVerifiedServerMetadata = false;
      const imageCandidates = [];

      const matchesDomain = (targetDomain) => host === targetDomain || host.endsWith(`.${targetDomain}`);

      if (matchesDomain('wikipedia.org')) {
        platform = 'Wikipedia';
        brandColor = '#1F2937';
        if (pathParts[0] === 'wiki' && pathParts[1]) {
          displayName = safeDecodeURIComponent(pathParts[1]).replace(/_/g, ' ');
          category = 'Reference / Editorial';
        } else {
          displayName = 'Wikipedia';
          category = 'Encyclopedia';
        }
      } else if (matchesDomain('github.com')) {
        platform = 'GitHub';
        brandColor = '#181717';
        if (pathParts.length === 1) {
          username = `@${pathParts[0]}`;
          category = 'Developer Profile';
        } else if (pathParts.length >= 2) {
          displayName = `${pathParts[0]}/${pathParts[1]}`;
          category = 'Source Repository';
        }
      } else if (matchesDomain('linkedin.com')) {
        platform = 'LinkedIn';
        brandColor = '#0A66C2';
        if (path.includes('/in/') && pathParts[1]) {
          username = `@${pathParts[1]}`;
          category = 'Professional Profile';
        } else if (path.includes('/company/') && pathParts[1]) {
          displayName = safeDecodeURIComponent(pathParts[1]).replace(/[-_]/g, ' ');
          category = 'Enterprise';
        }
      } else if (matchesDomain('instagram.com')) {
        platform = 'Instagram';
        brandColor = '#E1306C';
        if (pathParts.length >= 1 && !['p', 'reel', 'stories', 'explore'].includes(pathParts[0])) {
          username = `@${pathParts[0]}`;
          category = 'Creator Profile';
        }
      } else if (matchesDomain('youtube.com') || host === 'youtu.be') {
        platform = 'YouTube';
        brandColor = '#FF0000';
        if (path.includes('/@') && pathParts[0]) {
          username = pathParts[0];
          category = 'Creator Channel';
        } else if (path.includes('/watch') || host === 'youtu.be') {
          category = 'Video Streaming';
        }
      } else if (matchesDomain('facebook.com')) {
        platform = 'Facebook';
        brandColor = '#1877F2';
        if (pathParts.length >= 1 && !['groups', 'pages', 'watch'].includes(pathParts[0])) {
          username = `@${pathParts[0]}`;
          category = 'Social Profile';
        }
      } else if (matchesDomain('twitter.com') || host === 'x.com') {
        platform = 'X / Twitter';
        brandColor = '#000000';
        if (pathParts.length >= 1 && !['explore', 'i', 'messages'].includes(pathParts[0])) {
          username = `@${pathParts[0]}`;
          category = 'Social Profile';
        }
      } else if (matchesDomain('tiktok.com')) {
        platform = 'TikTok';
        brandColor = '#000000';
        if (pathParts.length >= 1 && pathParts[0].startsWith('@')) {
          username = pathParts[0];
          category = 'Creator Profile';
        } else {
          category = 'Short Video Destination';
        }
      } else if (matchesDomain('pinterest.com') || matchesDomain('pinterest.co.uk')) {
        platform = 'Pinterest';
        brandColor = '#BD081C';
        if (pathParts.length >= 1 && !['pin', 'search', 'today', 'explore'].includes(pathParts[0])) {
          username = `@${pathParts[0]}`;
          category = 'Visual Board / Creator';
        } else {
          category = 'Visual Discovery';
        }
      } else if (matchesDomain('whatsapp.com') || host === 'wa.me') {
        platform = 'WhatsApp';
        brandColor = '#25D366';
        category = 'Direct Messaging';
      } else if (matchesDomain('telegram.org') || host === 't.me') {
        platform = 'Telegram';
        brandColor = '#24A1DE';
        if (pathParts.length >= 1) {
          username = `@${pathParts[0]}`;
          category = 'Public Channel / Contact';
        } else {
          category = 'Direct Messaging';
        }
      } else if (matchesDomain('reddit.com')) {
        platform = 'Reddit';
        brandColor = '#FF4500';
        if (path.includes('/r/') && pathParts[1]) {
          displayName = `r/${pathParts[1]}`;
          category = 'Community Subreddit';
        }
      } else if (matchesDomain('spotify.com')) {
        platform = 'Spotify';
        brandColor = '#1DB954';
        category = 'Audio Streaming';
      } else if (matchesDomain('discord.com') || host === 'discord.gg') {
        platform = 'Discord';
        brandColor = '#5865F2';
        category = 'Community Server';
      } else if (host.endsWith('.edu') || host.includes('.edu.')) {
        category = 'Higher Education';
        brandColor = '#1E3A8A';
      }

      if (category === 'Web Destination') {
        const lowerPath = path.toLowerCase();
        if (lowerPath.includes('menu') || lowerPath.includes('restaurant') || lowerPath.includes('dining')) {
          category = 'Hospitality / Menu';
          brandColor = '#9A3412';
        } else if (lowerPath.includes('doc') || lowerPath.includes('guide') || lowerPath.includes('api')) {
          category = 'Documentation';
        } else if (lowerPath.includes('shop') || lowerPath.includes('product') || lowerPath.includes('store')) {
          category = 'E-Commerce / Store';
        } else if (lowerPath.includes('blog') || lowerPath.includes('article') || lowerPath.includes('news')) {
          category = 'Editorial / Article';
        }
      }

      if (this.apiEndpoint) {
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Provider timeout')), 3500)
          );
          const fetchPromise = fetch(`${this.apiEndpoint}${encodeURIComponent(parsed.href)}`, { signal });
          const response = await Promise.race([fetchPromise, timeoutPromise]);

          if (response.ok) {
            const meta = await response.json();
            if (meta.siteName) platform = this.sanitize(meta.siteName);
            if (meta.ogTitle || meta.title) {
              displayName = this.sanitize(meta.ogTitle || meta.title);
            }
            // Validate incoming server theme color strictly before assignment
            if (meta.themeColor && isValidHexColor(meta.themeColor)) {
              brandColor = normalizeHexColor(meta.themeColor);
            }
            if (meta.author && !username) displayName = this.sanitize(meta.author);

            if (meta.profileImage) imageCandidates.push({ priority: 1, type: 'profile', url: meta.profileImage, isVerified: Boolean(meta.profileImageVerified) });
            if (meta.ogImage) imageCandidates.push({ priority: 2, type: 'og', url: meta.ogImage, isVerified: Boolean(meta.ogImageVerified) });
            if (meta.logo) imageCandidates.push({ priority: 3, type: 'logo', url: meta.logo, isVerified: Boolean(meta.logoVerified) });

            isVerifiedServerMetadata = true;
            confidence = 'Verified server metadata';
          }
        } catch (err) {
          // Fallback to structural heuristics
        }
      }

      imageCandidates.push({
        priority: 4,
        type: 'favicon',
        url: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`,
        isVerified: false
      });

      const effectiveDisplayName = displayName || (username ? username : platform);
      const badgeText = IdentitySynthesizer.synthesizeBadgeLabel(displayName, username, platform, 4);

      // Guarantee brandColor is always a normalized valid hex color
      const safeBrandColor = isValidHexColor(brandColor) ? normalizeHexColor(brandColor) : '#2563EB';

      const result = {
        valid: true,
        url: parsed.href,
        domain: host,
        platform,
        displayName: this.sanitize(effectiveDisplayName),
        username: username ? this.sanitize(username) : null,
        category,
        confidence,
        brandColor: safeBrandColor,
        badgeText,
        imageCandidates,
        isVerifiedServerMetadata
      };

      this.cache.set(normalized, result);
      return { evidence: result, isStale: analysisId !== state.currentAnalysisId };
    }
  };

  // --- 6. PRESETS DEFINITION ---
  const PRESETS = [
    { id: 'minimal', name: 'Minimal', dot: 'square', eye: 'square', fg: '#0F172A', bg: '#FFFFFF', grad: false, ecc: 'M', frame: 'none', frameText: 'SCAN ME' },
    { id: 'professional', name: 'Professional', dot: 'rounded', eye: 'square', fg: '#1E3A8A', bg: '#F8FAFC', grad: false, ecc: 'H', frame: 'badge-bottom', frameText: 'LEARN MORE' },
    { id: 'business', name: 'Corporate', dot: 'square', eye: 'square', fg: '#047857', bg: '#F0FDF4', grad: false, ecc: 'H', frame: 'badge-bottom', frameText: 'VISIT' },
    { id: 'social', name: 'Social Pop', dot: 'rounded', eye: 'square', fg: '#E11D48', bg: '#FFF1F2', grad: true, gradColor: '#FB7185', ecc: 'H', frame: 'pill', frameText: 'FOLLOW' },
    { id: 'creator', name: 'Creator', dot: 'dots', eye: 'square', fg: '#7C3AED', bg: '#FAF5FF', grad: true, gradColor: '#EC4899', ecc: 'H', frame: 'pill', frameText: 'CONNECT' },
    { id: 'editorial', name: 'Editorial', dot: 'classy', eye: 'square', fg: '#334155', bg: '#FDFBF7', grad: false, ecc: 'H', frame: 'none', frameText: 'READ' },
    { id: 'restaurant', name: 'Dining Menu', dot: 'smooth', eye: 'square', fg: '#9A3412', bg: '#FFFBEB', grad: false, ecc: 'H', frame: 'badge-bottom', frameText: 'VIEW MENU' },
    { id: 'tech', name: 'Cyber Tech', dot: 'dots', eye: 'square', fg: '#0284C7', bg: '#0B132B', grad: false, ecc: 'H', frame: 'none', frameText: 'EXPLORE' },
    { id: 'organic', name: 'Eco Organic', dot: 'smooth', eye: 'square', fg: '#15803D', bg: '#F0FDF4', grad: false, ecc: 'H', frame: 'pill', frameText: 'DISCOVER' },
    { id: 'neon', name: 'Neon Glow', dot: 'dots', eye: 'square', fg: '#06B6D4', bg: '#030712', grad: true, gradColor: '#3B82F6', ecc: 'H', frame: 'none', frameText: 'SCAN' },
    { id: 'luxury', name: 'Luxury Gold', dot: 'classy', eye: 'square', fg: '#854D0E', bg: '#FEFCE8', grad: false, ecc: 'H', frame: 'pill', frameText: 'EXCLUSIVE' },
    { id: 'playful', name: 'Playful', dot: 'dots', eye: 'square', fg: '#EA580C', bg: '#FFF7ED', grad: true, gradColor: '#EAB308', ecc: 'H', frame: 'badge-bottom', frameText: 'OPEN' }
  ];

  // --- 7. TELEMETRY, CONSERVATIVE FOOTPRINT & HARDWARE SCAN TEST ---
  const TelemetryEngine = {
    getLuminance(hex) {
      const clean = hex.replace('#', '');
      const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
      const rgb = parseInt(full, 16);
      const r = (rgb >> 16) & 0xff;
      const g = (rgb >> 8) & 0xff;
      const b = (rgb >> 0) & 0xff;
      const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    },

    getContrast(hex1, hex2) {
      const l1 = this.getLuminance(hex1);
      const l2 = this.getLuminance(hex2);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    },

    getEffectiveContrast() {
      let contrast = this.getContrast(state.options.fgColor, state.options.bgColor);
      if (state.options.useGradient && state.options.fgGradColor) {
        const gradContrast = this.getContrast(state.options.fgGradColor, state.options.bgColor);
        contrast = Math.min(contrast, gradContrast);
      }
      return contrast;
    },

    repairColorContrast(color, bgColor, targetContrast = 4.0) {
      if (this.getContrast(color, bgColor) >= targetContrast) {
        return color;
      }

      const bgLum = this.getLuminance(bgColor);
      const shouldDarken = bgLum > 0.4;
      const steps = [0.15, 0.30, 0.45, 0.60, 0.75, 0.88];

      for (const step of steps) {
        const factor = shouldDarken ? -step : step;
        const candidate = adjustColorBrightness(color, factor);
        if (this.getContrast(candidate, bgColor) >= targetContrast) {
          return candidate;
        }
      }

      return shouldDarken ? '#0F172A' : '#FFFFFF';
    },

    computeCenterFootprint(moduleCount, isExportMode = false) {
      if (state.options.logoMode === 'none') {
        return { sideCells: 0, coverageRatio: 0 };
      }

      const hasSafeCustom = state.options.logoMode === 'custom' &&
        (isExportMode ? (Boolean(state.customLogoDataUrl) || Boolean(state.customLogoImg)) : Boolean(state.customLogoImg));

      const hasSafeAuto = state.options.logoMode === 'auto' &&
        (isExportMode
          ? (Boolean(state.activeLogoDataUrl) || Boolean(state.options.centerBadgeText))
          : (Boolean(state.activeLogoImg) || Boolean(state.options.centerBadgeText)));

      const hasEntity = hasSafeCustom || hasSafeAuto;

      if (!hasEntity) {
        return { sideCells: 0, coverageRatio: 0 };
      }

      const functionMask = QRStructure.createFunctionModuleMask(moduleCount);
      const conservativeEccLimits = { L: 0.04, M: 0.08, Q: 0.12, H: 0.16 };
      const maxAreaAllowed = (moduleCount * moduleCount) * (conservativeEccLimits[state.options.ecc] || 0.08);

      const mid = Math.floor(moduleCount / 2);
      let bestSide = 0;

      for (let s = 3; s <= moduleCount; s += 2) {
        if (s * s > maxAreaAllowed) break;

        const half = Math.floor(s / 2);
        let overlapsFunctionModule = false;

        for (let r = mid - half; r <= mid + half; r++) {
          for (let c = mid - half; c <= mid + half; c++) {
            if (r < 0 || r >= moduleCount || c < 0 || c >= moduleCount || functionMask[r][c] === 1) {
              overlapsFunctionModule = true;
              break;
            }
          }
          if (overlapsFunctionModule) break;
        }

        if (!overlapsFunctionModule) {
          bestSide = s;
        } else {
          break;
        }
      }

      const actualArea = bestSide * bestSide;
      return {
        sideCells: bestSide,
        coverageRatio: (actualArea / (moduleCount * moduleCount)) * 100
      };
    },

    async testScanDecoding(canvas, renderToken) {
      const statusText = document.getElementById('scanStatusText');
      if (typeof window.BarcodeDetector !== 'undefined') {
        try {
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
          const barcodes = await detector.detect(canvas);
          if (renderToken === state.currentRenderToken) {
            if (barcodes && barcodes.length > 0) {
              statusText.textContent = 'Hardware Scan Decoded ✓';
              return;
            }
          }
        } catch (e) {
          // Fall through
        }
      }
      if (renderToken === state.currentRenderToken) {
        statusText.textContent = 'Scan Safety Calculated';
      }
    },

    evaluateAndRepair(moduleCount = 33, isExportMode = false) {
      if (!state.url) {
        document.getElementById('contrastVal').textContent = '—';
        document.getElementById('logoAreaVal').textContent = '—';
        document.getElementById('eccVal').textContent = '—';
        document.getElementById('scanStatusText').textContent = 'Awaiting Input';
        document.getElementById('repairAlert').classList.add('hidden-field');
        return { sideCells: 0, coverageRatio: 0 };
      }

      let repaired = false;

      // 1. Multi-stage smart brand color repair for foreground & gradient
      const initialFgContrast = this.getContrast(state.options.fgColor, state.options.bgColor);
      if (initialFgContrast < 4.0) {
        const repairedFg = this.repairColorContrast(state.options.fgColor, state.options.bgColor, 4.0);
        state.options.fgColor = repairedFg;

        const fgInput = document.getElementById('fgColor');
        const fgTextInput = document.getElementById('fgColorText');
        if (fgInput) fgInput.value = repairedFg;
        if (fgTextInput) fgTextInput.value = repairedFg;
        repaired = true;
      }

      if (state.options.useGradient && state.options.fgGradColor) {
        const initialGradContrast = this.getContrast(state.options.fgGradColor, state.options.bgColor);
        if (initialGradContrast < 4.0) {
          const repairedGrad = this.repairColorContrast(state.options.fgGradColor, state.options.bgColor, 4.0);
          state.options.fgGradColor = repairedGrad;

          const gradInput = document.getElementById('fgGradColor');
          const gradTextInput = document.getElementById('fgGradColorText');
          if (gradInput) gradInput.value = repairedGrad;
          if (gradTextInput) gradTextInput.value = repairedGrad;
          repaired = true;
        }
      }

      // 2. Elevate to ECC H when center cutout exists and ECC is lower
      const hasCenterEntity = (state.options.logoMode === 'custom' && state.customLogoImg) ||
                              (state.options.logoMode === 'auto' && (state.activeLogoImg || state.options.centerBadgeText));

      if (hasCenterEntity && (state.options.ecc === 'L' || state.options.ecc === 'M')) {
        state.options.ecc = 'H';
        const eccSelect = document.getElementById('eccSelect');
        if (eccSelect) eccSelect.value = 'H';
        repaired = true;
      }

      // 3. Final post-repair recomputations
      const finalFootprint = this.computeCenterFootprint(moduleCount, isExportMode);
      const finalEffectiveContrast = this.getEffectiveContrast();

      document.getElementById('contrastVal').textContent = `${finalEffectiveContrast.toFixed(1)}:1`;
      document.getElementById('logoAreaVal').textContent = finalFootprint.coverageRatio > 0 ? `${finalFootprint.coverageRatio.toFixed(1)}%` : '0%';
      document.getElementById('eccVal').textContent = state.options.ecc;

      const repairAlert = document.getElementById('repairAlert');
      if (repaired) {
        repairAlert.classList.remove('hidden-field');
        document.getElementById('scanStatusText').textContent = 'Auto-Repaired for Scanning';
      } else {
        repairAlert.classList.add('hidden-field');
      }

      return finalFootprint;
    }
  };

  // --- 8. DYNAMIC MULTI-SIGNAL SYNTHETIC DESIGN ENGINES ---
  function composeIdentityDesign(detection, variationIndex = 0) {
    const brand = detection.brandColor || '#0F172A';
    const hasImage = Boolean(state.activeLogoImg);
    const badge = detection.badgeText || 'QR';
    const tag = detection.username || detection.displayName;

    const variations = [
      { dot: 'rounded', eye: 'square', useGrad: false, gradColor: brand },
      { dot: 'square', eye: 'square', useGrad: false, gradColor: brand },
      { dot: 'classy', eye: 'square', useGrad: true, gradColor: '#3B82F6' }
    ];

    const pick = variations[variationIndex % variations.length];

    let explanation = `Identity Mode: Dynamically composed for "${detection.displayName}".`;
    if (hasImage) {
      const assetDescriptor = state.activeLogoIsVerified ? 'verified server asset' : 'resolved identity asset';
      explanation += ` Center integrated with ${assetDescriptor} and brand geometry.`;
    } else {
      explanation += ` Center integrated with generated badge [${badge}] and safe contrast.`;
    }

    return {
      dotStyle: pick.dot,
      eyeStyle: 'square', // Strictly preserved structural finder
      fgColor: brand,
      bgColor: '#FFFFFF',
      useGradient: pick.useGrad,
      fgGradColor: pick.gradColor,
      centerBadgeText: hasImage ? '' : badge,
      ecc: 'H',
      quietZone: 4,
      frameStyle: 'pill',
      frameText: tag.toUpperCase().slice(0, 16),
      explanation
    };
  }

  function composeContextDesign(detection, variationIndex = 0) {
    const url = (detection.url || '').toLowerCase();
    const platform = (detection.platform || '').toLowerCase();
    const cat = (detection.category || '').toLowerCase();
    const name = (detection.displayName || '').toLowerCase();
    const username = (detection.username || '').toLowerCase();

    const isSocialCreator = platform === 'instagram' || platform === 'tiktok' || platform === 'pinterest' ||
      cat.includes('creator') || cat.includes('profile') || username.startsWith('@');

    const isVideoDestination = platform === 'youtube' || url.includes('/watch') || url.includes('youtu.be') ||
      cat.includes('video') || cat.includes('streaming');

    const isEditorialReference = platform === 'wikipedia' || cat.includes('editorial') || cat.includes('reference') ||
      cat.includes('article') || url.includes('/wiki/') || url.includes('/blog/');

    const isDiningHospitality = cat.includes('hospitality') || cat.includes('menu') || url.includes('menu') ||
      url.includes('restaurant') || url.includes('dining') || name.includes('cafe') || name.includes('bistro');

    const isEducational = platform.includes('college') || platform.includes('university') || cat.includes('education') ||
      url.includes('.edu') || name.includes('college') || name.includes('school');

    const isMessaging = platform === 'whatsapp' || platform === 'telegram' || platform === 'discord' ||
      cat.includes('messaging') || url.includes('wa.me') || url.includes('t.me');

    let dotStyle = 'square';
    let eyeStyle = 'square'; // Strictly preserved structural finder
    let fgColor = detection.brandColor || '#0F172A';
    let bgColor = '#FFFFFF';
    let useGradient = false;
    let fgGradColor = '#2563EB';
    let frameStyle = 'none';
    let frameText = 'SCAN ME';
    let explanation = '';

    if (isSocialCreator) {
      dotStyle = 'dots';
      fgColor = detection.brandColor && detection.brandColor !== '#0F172A' ? detection.brandColor : '#BE185D';
      useGradient = true;
      fgGradColor = '#7C3AED';
      frameStyle = 'pill';
      frameText = username ? username.toUpperCase().slice(0, 16) : 'CONNECT';
      explanation = `Context Mode (Social/Creator): Recognized creator profile for "${detection.displayName}". Fluid curved modules and connection framing applied.`;
    } else if (isVideoDestination) {
      dotStyle = variationIndex % 2 === 0 ? 'rounded' : 'square';
      fgColor = '#DC2626';
      useGradient = true;
      fgGradColor = '#991B1B';
      frameStyle = 'badge-bottom';
      frameText = 'WATCH NOW';
      explanation = `Context Mode (Streaming/Video): Video destination identified. Media streaming palette and action banner configured.`;
    } else if (isEditorialReference) {
      dotStyle = variationIndex % 2 === 0 ? 'classy' : 'square';
      fgColor = '#334155';
      bgColor = '#FDFBF7';
      frameStyle = 'none';
      explanation = `Context Mode (Editorial/Reference): Structured document/article destination. Classical geometry and high readability contrast applied.`;
    } else if (isDiningHospitality) {
      dotStyle = 'smooth';
      fgColor = '#9A3412';
      bgColor = '#FFFBEB';
      frameStyle = 'badge-bottom';
      frameText = 'VIEW MENU';
      explanation = `Context Mode (Hospitality): Dining/menu destination detected. Warm culinary tones and tabletop scanning geometry selected.`;
    } else if (isEducational) {
      dotStyle = 'rounded';
      fgColor = '#002855';
      frameStyle = 'badge-bottom';
      frameText = 'LEARN MORE';
      explanation = `Context Mode (Education): Academic/institutional signals detected. Balanced geometry and maximum error correction chosen.`;
    } else if (isMessaging) {
      dotStyle = 'rounded';
      fgColor = '#0F766E';
      frameStyle = 'pill';
      frameText = 'CHAT NOW';
      explanation = `Context Mode (Messaging): Direct communication destination identified. Compact conversation framing and high contrast applied.`;
    } else {
      dotStyle = 'square';
      fgColor = '#0F172A';
      bgColor = '#FFFFFF';
      frameStyle = 'none';
      explanation = `Context Mode (Intelligent Minimal): Universal web destination. Unobstructed standard geometry composed for reliable general scanning.`;
    }

    return {
      dotStyle,
      eyeStyle,
      fgColor,
      bgColor,
      useGradient,
      fgGradColor,
      centerBadgeText: '',
      ecc: 'H',
      quietZone: 4,
      frameStyle,
      frameText,
      explanation
    };
  }

  // --- 9. SHARED GEOMETRY ENGINE ---
  const GeometryEngine = {
    computeLayout(baseSize, moduleCount, quietZone, frameStyle) {
      const qrTotalModules = moduleCount + quietZone * 2;
      const cellSize = baseSize / qrTotalModules;
      const qrPixelSize = baseSize;

      let topOffset = 0;
      let totalWidth = qrPixelSize;
      let totalHeight = qrPixelSize;
      let frameHeight = 0;

      if (frameStyle === 'badge-top') {
        frameHeight = Math.round(baseSize * 0.12);
        topOffset = frameHeight;
        totalHeight = qrPixelSize + frameHeight;
      } else if (frameStyle === 'badge-bottom' || frameStyle === 'pill') {
        frameHeight = Math.round(baseSize * 0.12);
        totalHeight = qrPixelSize + frameHeight;
      }

      return {
        baseSize,
        moduleCount,
        quietZone,
        cellSize,
        qrPixelSize,
        topOffset,
        totalWidth,
        totalHeight,
        frameHeight
      };
    }
  };

  // --- 10. UNIFIED CANVAS & SVG RENDERER ---
  const QRRenderer = {
    getQRMatrix() {
      if (!state.url || typeof qrcode === 'undefined') return null;
      try {
        const qr = qrcode(0, state.options.ecc || 'M');
        qr.addData(state.url);
        qr.make();
        return qr;
      } catch (err) {
        return null;
      }
    },

    isFinderEyeRegion(r, c, count) {
      return (
        (r < 7 && c < 7) ||
        (r < 7 && c >= count - 7) ||
        (r >= count - 7 && c < 7)
      );
    },

    isCenterReserved(r, c, count, sideCells) {
      if (!sideCells || sideCells <= 0) return false;
      const half = Math.floor(sideCells / 2);
      const mid = Math.floor(count / 2);
      return (r >= mid - half && r <= mid + half && c >= mid - half && c <= mid + half);
    },

    renderCanvas(canvas, requestedSize = 480, isExport = false) {
      const ctx = canvas.getContext('2d');
      const baseSize = requestedSize;

      if (!state.url) {
        canvas.width = baseSize;
        canvas.height = baseSize;
        ctx.fillStyle = state.theme === 'dark' ? '#111827' : '#F8FAFC';
        ctx.fillRect(0, 0, baseSize, baseSize);
        ctx.fillStyle = '#64748B';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Paste a URL to generate Smart QR', baseSize / 2, baseSize / 2);
        return;
      }

      const qr = this.getQRMatrix();
      if (!qr) {
        canvas.width = baseSize;
        canvas.height = baseSize;
        ctx.fillStyle = state.theme === 'dark' ? '#111827' : '#F8FAFC';
        ctx.fillRect(0, 0, baseSize, baseSize);
        ctx.fillStyle = '#DC2626';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Content payload too large or invalid for QR generation', baseSize / 2, baseSize / 2);
        return;
      }

      const moduleCount = qr.getModuleCount();
      const footprint = TelemetryEngine.evaluateAndRepair(moduleCount, isExport);
      const functionMask = QRStructure.createFunctionModuleMask(moduleCount);
      const geo = GeometryEngine.computeLayout(baseSize, moduleCount, state.options.quietZone, state.options.frameStyle);

      canvas.width = geo.totalWidth;
      canvas.height = geo.totalHeight;
      ctx.clearRect(0, 0, geo.totalWidth, geo.totalHeight);

      // 1. Draw Overall Background
      ctx.fillStyle = state.options.bgColor;
      ctx.fillRect(0, 0, geo.totalWidth, geo.totalHeight);

      // 2. Setup Foreground / Gradient Fill
      let fill = state.options.fgColor;
      if (state.options.useGradient) {
        const grad = ctx.createLinearGradient(0, geo.topOffset, geo.baseSize, geo.topOffset + geo.baseSize);
        grad.addColorStop(0, state.options.fgColor);
        grad.addColorStop(1, state.options.fgGradColor || state.options.fgColor);
        fill = grad;
      }
      ctx.fillStyle = fill;

      // 3. Render Data Modules & Structural Function Modules
      for (let r = 0; r < moduleCount; r++) {
        for (let c = 0; c < moduleCount; c++) {
          if (this.isFinderEyeRegion(r, c, moduleCount)) continue;
          if (this.isCenterReserved(r, c, moduleCount, footprint.sideCells)) continue;

          if (qr.isDark(r, c)) {
            const x = (c + geo.quietZone) * geo.cellSize;
            const y = geo.topOffset + (r + geo.quietZone) * geo.cellSize;

            if (functionMask[r][c] === 1) {
              ctx.fillRect(x, y, geo.cellSize, geo.cellSize);
            } else {
              if (state.options.dotStyle === 'dots') {
                ctx.beginPath();
                ctx.arc(x + geo.cellSize / 2, y + geo.cellSize / 2, geo.cellSize * 0.42, 0, Math.PI * 2);
                ctx.fill();
              } else if (state.options.dotStyle === 'rounded') {
                this.roundRect(ctx, x, y, geo.cellSize * 0.92, geo.cellSize * 0.92, geo.cellSize * 0.28);
                ctx.fill();
              } else if (state.options.dotStyle === 'classy') {
                ctx.beginPath();
                ctx.moveTo(x + geo.cellSize / 2, y);
                ctx.lineTo(x + geo.cellSize, y + geo.cellSize / 2);
                ctx.lineTo(x + geo.cellSize / 2, y + geo.cellSize);
                ctx.lineTo(x, y + geo.cellSize / 2);
                ctx.closePath();
                ctx.fill();
              } else if (state.options.dotStyle === 'smooth') {
                this.roundRect(ctx, x + geo.cellSize * 0.05, y + geo.cellSize * 0.05, geo.cellSize * 0.9, geo.cellSize * 0.9, geo.cellSize * 0.45);
                ctx.fill();
              } else {
                ctx.fillRect(x, y, geo.cellSize, geo.cellSize);
              }
            }
          }
        }
      }

      // 4. Render Strictly Preserved Structural 7x7 Finder Eyes
      const eyeDim = geo.cellSize * 7;
      this.drawCanvasEye(ctx, geo.quietZone * geo.cellSize, geo.topOffset + geo.quietZone * geo.cellSize, eyeDim, geo.cellSize, fill);
      this.drawCanvasEye(ctx, (geo.quietZone + moduleCount - 7) * geo.cellSize, geo.topOffset + geo.quietZone * geo.cellSize, eyeDim, geo.cellSize, fill);
      this.drawCanvasEye(ctx, geo.quietZone * geo.cellSize, geo.topOffset + (geo.quietZone + moduleCount - 7) * geo.cellSize, eyeDim, geo.cellSize, fill);

      // 5. Render Central Cutout
      if (footprint.sideCells > 0) {
        this.drawCanvasCenter(ctx, geo, footprint.sideCells, isExport);
      }

      // 6. Render Frame Completely Outside QR Area
      this.drawCanvasFrame(ctx, geo);

      // 7. Tokenized Hardware Scan Telemetry Test (Preview only)
      if (!isExport) {
        const renderToken = ++state.currentRenderToken;
        TelemetryEngine.testScanDecoding(canvas, renderToken);
      }
    },

    /**
     * Renders an exact, unclipped 7x7 structural QR Finder pattern:
     * - Outer 7x7 module box
     * - Clear 1-module separator ring (5x5 module area)
     * - Solid 3x3 module central core
     * Strict 1:1:3:1:1 module proportions are preserved exactly without clipping corners.
     */
    drawCanvasEye(ctx, x, y, size, cellSize, fill) {
      const outerSize = size;
      const innerClearOffset = cellSize;
      const innerClearSize = cellSize * 5;
      const coreOffset = cellSize * 2;
      const coreSize = cellSize * 3;

      // Layer 1: Solid 7x7 module outer square
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, outerSize, outerSize);

      // Layer 2: 5x5 module clear separator ring
      ctx.fillStyle = state.options.bgColor;
      ctx.fillRect(x + innerClearOffset, y + innerClearOffset, innerClearSize, innerClearSize);

      // Layer 3: Solid 3x3 module central square core
      ctx.fillStyle = fill;
      ctx.fillRect(x + coreOffset, y + coreOffset, coreSize, coreSize);
    },

    drawCanvasCenter(ctx, geo, sideCells, isExport = false) {
      const pixelSize = sideCells * geo.cellSize;
      const x = (geo.baseSize - pixelSize) / 2;
      const y = geo.topOffset + (geo.baseSize - pixelSize) / 2;

      let img = null;
      let isCORSUnsafeForExport = false;

      if (state.options.logoMode === 'custom') {
        if (isExport) {
          if (state.customLogoDataUrl && state.customLogoImg) {
            img = state.customLogoImg;
          } else {
            isCORSUnsafeForExport = true;
          }
        } else {
          img = state.customLogoImg;
        }
      } else if (state.options.logoMode === 'auto') {
        if (isExport) {
          if (state.activeLogoDataUrl && state.activeLogoImg) {
            img = state.activeLogoImg;
          } else {
            isCORSUnsafeForExport = true;
          }
        } else {
          img = state.activeLogoImg;
        }
      }

      ctx.fillStyle = state.options.bgColor;
      this.roundRect(ctx, x - 2, y - 2, pixelSize + 4, pixelSize + 4, 6);
      ctx.fill();

      if (img && !isCORSUnsafeForExport) {
        ctx.save();
        this.roundRect(ctx, x, y, pixelSize, pixelSize, 6);
        ctx.clip();

        const nw = img.naturalWidth || img.width || 1;
        const nh = img.naturalHeight || img.height || 1;
        const scale = Math.min(pixelSize / nw, pixelSize / nh);
        const dw = nw * scale;
        const dh = nh * scale;
        const dx = x + (pixelSize - dw) / 2;
        const dy = y + (pixelSize - dh) / 2;

        ctx.drawImage(img, dx, dy, dw, dh);
        ctx.restore();
      } else if (state.options.centerBadgeText || (isExport && isCORSUnsafeForExport)) {
        const badgeLabel = state.options.centerBadgeText || (state.detection ? state.detection.badgeText : 'QR');
        ctx.fillStyle = state.options.fgColor;
        this.roundRect(ctx, x, y, pixelSize, pixelSize, 6);
        ctx.fill();
        ctx.fillStyle = state.options.bgColor;
        ctx.font = `bold ${Math.round(pixelSize * 0.36)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeLabel, x + pixelSize / 2, y + pixelSize / 2);
      }
    },

    drawCanvasFrame(ctx, geo) {
      if (state.options.frameStyle === 'none') return;
      const text = state.options.frameText || 'SCAN ME';

      ctx.fillStyle = state.options.fgColor;
      ctx.font = `bold ${Math.round(geo.baseSize * 0.04)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (state.options.frameStyle === 'badge-top') {
        ctx.fillRect(0, 0, geo.totalWidth, geo.frameHeight);
        ctx.fillStyle = state.options.bgColor;
        ctx.fillText(text, geo.totalWidth / 2, geo.frameHeight / 2);
      } else if (state.options.frameStyle === 'badge-bottom') {
        const y = geo.baseSize;
        ctx.fillRect(0, y, geo.totalWidth, geo.frameHeight);
        ctx.fillStyle = state.options.bgColor;
        ctx.fillText(text, geo.totalWidth / 2, y + geo.frameHeight / 2);
      } else if (state.options.frameStyle === 'pill') {
        const pillWidth = geo.baseSize * 0.65;
        const pillHeight = geo.frameHeight * 0.75;
        const x = (geo.totalWidth - pillWidth) / 2;
        const y = geo.baseSize + (geo.frameHeight - pillHeight) / 2;
        this.roundRect(ctx, x, y, pillWidth, pillHeight, pillHeight / 2);
        ctx.fill();
        ctx.fillStyle = state.options.bgColor;
        ctx.fillText(text, geo.totalWidth / 2, y + pillHeight / 2);
      }
    },

    roundRect(ctx, x, y, w, h, r) {
      if (typeof r === 'number') r = [r, r, r, r];
      ctx.beginPath();
      ctx.moveTo(x + r[0], y);
      ctx.lineTo(x + w - r[1], y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r[1]);
      ctx.lineTo(x + w, y + h - r[2]);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r[2], y + h);
      ctx.lineTo(x + r[3], y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r[3]);
      ctx.lineTo(x, y + r[0]);
      ctx.quadraticCurveTo(x, y, x + r[0], y);
      ctx.closePath();
    },

    generateSVG() {
      const qr = this.getQRMatrix();
      if (!qr) return '';

      const moduleCount = qr.getModuleCount();
      const footprint = TelemetryEngine.evaluateAndRepair(moduleCount, true);
      const functionMask = QRStructure.createFunctionModuleMask(moduleCount);
      const baseSize = 512;
      const geo = GeometryEngine.computeLayout(baseSize, moduleCount, state.options.quietZone, state.options.frameStyle);

      let defs = '';
      let fillAttr = `fill="${state.options.fgColor}"`;

      if (state.options.useGradient) {
        defs += `<defs>
          <linearGradient id="qrGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${state.options.fgColor}" />
            <stop offset="100%" stop-color="${state.options.fgGradColor || state.options.fgColor}" />
          </linearGradient>
        </defs>`;
        fillAttr = 'fill="url(#qrGrad)"';
      }

      // 1. Data Modules & Structural Function Modules (SVG)
      let modulesSVG = '';
      for (let r = 0; r < moduleCount; r++) {
        for (let c = 0; c < moduleCount; c++) {
          if (this.isFinderEyeRegion(r, c, moduleCount)) continue;
          if (this.isCenterReserved(r, c, moduleCount, footprint.sideCells)) continue;

          if (qr.isDark(r, c)) {
            const x = (c + geo.quietZone) * geo.cellSize;
            const y = geo.topOffset + (r + geo.quietZone) * geo.cellSize;

            if (functionMask[r][c] === 1) {
              modulesSVG += `<rect x="${x}" y="${y}" width="${geo.cellSize}" height="${geo.cellSize}" ${fillAttr} />`;
            } else {
              if (state.options.dotStyle === 'dots') {
                modulesSVG += `<circle cx="${x + geo.cellSize / 2}" cy="${y + geo.cellSize / 2}" r="${geo.cellSize * 0.42}" ${fillAttr} />`;
              } else if (state.options.dotStyle === 'rounded') {
                modulesSVG += `<rect x="${x}" y="${y}" width="${geo.cellSize * 0.92}" height="${geo.cellSize * 0.92}" rx="${geo.cellSize * 0.28}" ${fillAttr} />`;
              } else if (state.options.dotStyle === 'classy') {
                const mx = x + geo.cellSize / 2;
                const my = y + geo.cellSize / 2;
                modulesSVG += `<polygon points="${mx},${y} ${x + geo.cellSize},${my} ${mx},${y + geo.cellSize} ${x},${my}" ${fillAttr} />`;
              } else if (state.options.dotStyle === 'smooth') {
                modulesSVG += `<rect x="${x + geo.cellSize * 0.05}" y="${y + geo.cellSize * 0.05}" width="${geo.cellSize * 0.9}" height="${geo.cellSize * 0.9}" rx="${geo.cellSize * 0.45}" ${fillAttr} />`;
              } else {
                modulesSVG += `<rect x="${x}" y="${y}" width="${geo.cellSize}" height="${geo.cellSize}" ${fillAttr} />`;
              }
            }
          }
        }
      }

      // 2. Finder Eyes Subroutine (Strict 7x7 structural modules in SVG matching Canvas)
      const renderSVGEye = (x, y, eyeSize, cellSize) => {
        const outerSize = eyeSize;
        const innerClearOffset = cellSize;
        const innerClearSize = cellSize * 5;
        const coreOffset = cellSize * 2;
        const coreSize = cellSize * 3;

        return `
          <rect x="${x}" y="${y}" width="${outerSize}" height="${outerSize}" ${fillAttr} />
          <rect x="${x + innerClearOffset}" y="${y + innerClearOffset}" width="${innerClearSize}" height="${innerClearSize}" fill="${state.options.bgColor}" />
          <rect x="${x + coreOffset}" y="${y + coreOffset}" width="${coreSize}" height="${coreSize}" ${fillAttr} />
        `;
      };

      const eyeDim = geo.cellSize * 7;
      const eyesSVG =
        renderSVGEye(geo.quietZone * geo.cellSize, geo.topOffset + geo.quietZone * geo.cellSize, eyeDim, geo.cellSize) +
        renderSVGEye((geo.quietZone + moduleCount - 7) * geo.cellSize, geo.topOffset + geo.quietZone * geo.cellSize, eyeDim, geo.cellSize) +
        renderSVGEye(geo.quietZone * geo.cellSize, geo.topOffset + (geo.quietZone + moduleCount - 7) * geo.cellSize, eyeDim, geo.cellSize);

      // 3. Center Entity Subroutine (SVG)
      let centerSVG = '';
      if (footprint.sideCells > 0) {
        const pSize = footprint.sideCells * geo.cellSize;
        const x = (geo.baseSize - pSize) / 2;
        const y = geo.topOffset + (geo.baseSize - pSize) / 2;
        const imgDataUrl = state.options.logoMode === 'custom' ? state.customLogoDataUrl : state.activeLogoDataUrl;
        const badgeLabel = state.options.centerBadgeText || (state.detection ? state.detection.badgeText : 'QR');

        centerSVG += `<rect x="${x - 2}" y="${y - 2}" width="${pSize + 4}" height="${pSize + 4}" rx="4" fill="${state.options.bgColor}" />`;

        if (imgDataUrl && (state.options.logoMode === 'custom' || state.options.logoMode === 'auto')) {
          centerSVG += `
            <clipPath id="logoClip"><rect x="${x}" y="${y}" width="${pSize}" height="${pSize}" rx="4" /></clipPath>
            <image href="${imgDataUrl}" x="${x}" y="${y}" width="${pSize}" height="${pSize}" preserveAspectRatio="xMidYMid meet" clip-path="url(#logoClip)" />
          `;
        } else {
          centerSVG += `
            <rect x="${x}" y="${y}" width="${pSize}" height="${pSize}" rx="4" ${fillAttr} />
            <text x="${x + pSize / 2}" y="${y + pSize / 2}" fill="${state.options.bgColor}" font-size="${pSize * 0.36}" font-weight="bold" font-family="sans-serif" text-anchor="middle" dominant-baseline="central">${escapeXml(badgeLabel)}</text>
          `;
        }
      }

      // 4. Frame Area (SVG)
      let frameSVG = '';
      if (state.options.frameStyle !== 'none') {
        const text = escapeXml(state.options.frameText || 'SCAN ME');
        const fontSize = Math.round(geo.baseSize * 0.04);
        if (state.options.frameStyle === 'badge-top') {
          frameSVG = `
            <rect x="0" y="0" width="${geo.totalWidth}" height="${geo.frameHeight}" ${fillAttr} />
            <text x="${geo.totalWidth / 2}" y="${geo.frameHeight / 2}" fill="${state.options.bgColor}" font-size="${fontSize}" font-weight="bold" font-family="sans-serif" text-anchor="middle" dominant-baseline="central">${text}</text>
          `;
        } else if (state.options.frameStyle === 'badge-bottom') {
          const y = geo.baseSize;
          frameSVG = `
            <rect x="0" y="${y}" width="${geo.totalWidth}" height="${geo.frameHeight}" ${fillAttr} />
            <text x="${geo.totalWidth / 2}" y="${y + geo.frameHeight / 2}" fill="${state.options.bgColor}" font-size="${fontSize}" font-weight="bold" font-family="sans-serif" text-anchor="middle" dominant-baseline="central">${text}</text>
          `;
        } else if (state.options.frameStyle === 'pill') {
          const pillWidth = geo.baseSize * 0.65;
          const pillHeight = geo.frameHeight * 0.75;
          const x = (geo.totalWidth - pillWidth) / 2;
          const y = geo.baseSize + (geo.frameHeight - pillHeight) / 2;
          frameSVG = `
            <rect x="${x}" y="${y}" width="${pillWidth}" height="${pillHeight}" rx="${pillHeight / 2}" ${fillAttr} />
            <text x="${geo.totalWidth / 2}" y="${y + pillHeight / 2}" fill="${state.options.bgColor}" font-size="${fontSize * 0.9}" font-weight="bold" font-family="sans-serif" text-anchor="middle" dominant-baseline="central">${text}</text>
          `;
        }
      }

      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${geo.totalWidth} ${geo.totalHeight}">
        ${defs}
        <rect width="${geo.totalWidth}" height="${geo.totalHeight}" fill="${state.options.bgColor}" />
        ${modulesSVG}
        ${eyesSVG}
        ${centerSVG}
        ${frameSVG}
      </svg>`;
    }
  };

  // --- 11. ABORTABLE AUTO-IMAGE CASCADE RESOLUTION (3.5s TIMEOUT) ---
  async function resolveAutoImageCascade(candidates, analysisId) {
    if (!candidates || candidates.length === 0) return { img: null, dataUrl: null, isVerified: false };

    const sorted = [...candidates].sort((a, b) => a.priority - b.priority);

    for (const item of sorted) {
      if (!item.url) continue;
      if (analysisId !== state.currentAnalysisId) {
        return { img: null, dataUrl: null, isVerified: false };
      }

      try {
        const result = await new Promise((resolve, reject) => {
          let isTimedOut = false;
          const timeoutId = setTimeout(() => {
            isTimedOut = true;
            img.src = '';
            reject(new Error('Candidate timeout: 3.5s exceeded'));
          }, 3500);

          const img = new Image();
          img.crossOrigin = 'anonymous';

          img.onload = () => {
            if (isTimedOut) return;
            clearTimeout(timeoutId);
            if (analysisId !== state.currentAnalysisId) {
              reject(new Error('Stale analysis request'));
              return;
            }
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth || 64;
              canvas.height = img.naturalHeight || 64;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
              const dataUrl = canvas.toDataURL('image/png');
              resolve({ img, dataUrl, isVerified: Boolean(item.isVerified) });
            } catch (err) {
              resolve({ img, dataUrl: null, isVerified: Boolean(item.isVerified) });
            }
          };

          img.onerror = () => {
            if (isTimedOut) return;
            clearTimeout(timeoutId);
            reject(new Error('Network or CORS load failure'));
          };

          img.src = item.url;
        });

        if (analysisId === state.currentAnalysisId) {
          return result;
        }
      } catch (e) {
        // Continue to next candidate
      }
    }

    return { img: null, dataUrl: null, isVerified: false };
  }

  // --- 12. UI COORDINATION & EVENT SYNC ---
  function syncControlsFromState() {
    document.getElementById('dotStyleSelect').value = state.options.dotStyle;
    document.getElementById('eyeStyleSelect').value = state.options.eyeStyle;
    document.getElementById('fgColor').value = state.options.fgColor;
    document.getElementById('fgColorText').value = state.options.fgColor;
    document.getElementById('bgColor').value = state.options.bgColor;
    document.getElementById('bgColorText').value = state.options.bgColor;
    document.getElementById('enableGradient').checked = state.options.useGradient;
    document.getElementById('fgGradColor').value = state.options.fgGradColor || '#2563EB';
    document.getElementById('fgGradColorText').value = state.options.fgGradColor || '#2563EB';
    document.getElementById('frameStyleSelect').value = state.options.frameStyle;
    document.getElementById('frameText').value = state.options.frameText;
    document.getElementById('eccSelect').value = state.options.ecc;
    document.getElementById('quietZoneSelect').value = String(state.options.quietZone);

    updateSmartModeUI();
    updateQuietZoneWarning();
    renderPresets();
  }

  function updateSmartModeUI() {
    const identityBtn = document.getElementById('modeIdentityBtn');
    const contextBtn = document.getElementById('modeContextBtn');
    if (identityBtn && contextBtn) {
      identityBtn.classList.toggle('active', state.smartMode === 'identity');
      contextBtn.classList.toggle('active', state.smartMode === 'context');
    }
  }

  function updateQuietZoneWarning() {
    let warning = document.getElementById('quietZoneWarning');
    if (state.options.quietZone < 4) {
      if (!warning) {
        warning = document.createElement('small');
        warning.id = 'quietZoneWarning';
        warning.style.color = '#CA8A04';
        warning.style.display = 'block';
        warning.style.marginTop = '4px';
        warning.textContent = 'Reduced quiet zone (< 4 modules) may reduce scanning reliability.';
        document.getElementById('quietZoneSelect').parentElement.appendChild(warning);
      }
      warning.style.display = 'block';
    } else if (warning) {
      warning.style.display = 'none';
    }
  }

  function render() {
    const canvas = document.getElementById('qrCanvas');
    QRRenderer.renderCanvas(canvas, 480, false);
  }

  function updateDetectionUI(det) {
    if (!det) {
      document.getElementById('confidenceBadge').textContent = 'Awaiting Input';
      document.getElementById('detectedPlatformText').textContent = '—';
      document.getElementById('detectedTitle').textContent = 'Paste a URL to analyze';
      document.getElementById('detectedCategory').textContent = 'Destination will appear here';
      document.getElementById('detectedDomain').textContent = '';
      document.getElementById('detectedAvatar').textContent = '—';
      document.getElementById('smartExplanation').textContent = 'Smart QR dynamically synthesizes destination evidence.';
      return;
    }

    document.getElementById('confidenceBadge').textContent = det.confidence;
    document.getElementById('detectedPlatformText').textContent = det.platform;
    document.getElementById('detectedTitle').textContent = det.displayName;
    document.getElementById('detectedCategory').textContent = det.category;
    document.getElementById('detectedDomain').textContent = det.domain || '';

    const avatar = document.getElementById('detectedAvatar');
    if (state.activeLogoImg) {
      avatar.innerHTML = '';
      const clone = state.activeLogoImg.cloneNode();
      clone.style.width = '100%';
      clone.style.height = '100%';
      clone.style.objectFit = 'contain';
      avatar.appendChild(clone);
    } else {
      avatar.textContent = det.badgeText || 'QR';
    }
  }

  async function handleAnalyze() {
    const rawUrl = document.getElementById('urlInput').value.trim();
    if (!rawUrl) return;

    const analysisId = ++state.currentAnalysisId;
    state.url = rawUrl;
    state.isManualOverride = false;
    state.activePreset = null;

    const { evidence: det, isStale } = await MetadataProvider.fetchEvidence(rawUrl, analysisId);
    if (isStale || analysisId !== state.currentAnalysisId) return;

    state.detection = det;

    const { img, dataUrl, isVerified } = await resolveAutoImageCascade(det.imageCandidates, analysisId);
    if (analysisId !== state.currentAnalysisId) return;

    state.activeLogoImg = img;
    state.activeLogoDataUrl = dataUrl;
    state.activeLogoIsVerified = isVerified;

    updateDetectionUI(det);
    applySmartDesign();
  }

  function applySmartDesign() {
    if (!state.detection) return;
    state.isManualOverride = false;
    state.activePreset = null;

    const chosen = state.smartMode === 'identity'
      ? composeIdentityDesign(state.detection, state.designVariationIndex)
      : composeContextDesign(state.detection, state.designVariationIndex);

    state.options.dotStyle = chosen.dotStyle;
    state.options.eyeStyle = chosen.eyeStyle;
    state.options.fgColor = chosen.fgColor;
    state.options.bgColor = chosen.bgColor;
    state.options.useGradient = chosen.useGradient;
    state.options.fgGradColor = chosen.fgGradColor;
    state.options.centerBadgeText = chosen.centerBadgeText || '';
    state.options.frameStyle = chosen.frameStyle;
    state.options.frameText = chosen.frameText;
    state.options.ecc = chosen.ecc;
    state.options.quietZone = chosen.quietZone || 4;

    document.getElementById('smartExplanation').textContent = chosen.explanation;
    syncControlsFromState();
    render();
  }

  function applyPreset(preset) {
    state.activePreset = preset.id;
    state.isManualOverride = true;
    state.options.dotStyle = preset.dot;
    state.options.eyeStyle = preset.eye;
    state.options.fgColor = preset.fg;
    state.options.bgColor = preset.bg;
    state.options.useGradient = Boolean(preset.grad);
    state.options.fgGradColor = preset.gradColor || preset.fg;
    state.options.ecc = preset.ecc || 'H';
    state.options.frameStyle = preset.frame || 'none';
    state.options.frameText = preset.frameText || 'SCAN ME';
    state.options.centerBadgeText = '';

    syncControlsFromState();
    render();
  }

  function renderPresets() {
    const grid = document.getElementById('presetsGrid');
    if (!grid) return;
    grid.innerHTML = '';
    PRESETS.forEach(p => {
      const chip = document.createElement('div');
      chip.className = `preset-chip ${state.activePreset === p.id ? 'active' : ''}`;
      chip.innerHTML = `
        <span class="preset-badge-icon" style="background: ${p.fg}; border: 2px solid ${p.bg}"></span>
        <span>${escapeXml(p.name)}</span>
      `;
      chip.onclick = () => applyPreset(p);
      grid.appendChild(chip);
    });
  }

  function init() {
    document.getElementById('urlInput').value = '';
    updateDetectionUI(null);

    document.documentElement.setAttribute('data-theme', state.theme);
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.themeVal === state.theme);
      btn.onclick = () => {
        state.theme = btn.dataset.themeVal;
        localStorage.setItem('smart_qr_app_theme', state.theme);
        document.documentElement.setAttribute('data-theme', state.theme);
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b === btn));
      };
    });

    renderPresets();

    document.getElementById('analyzeBtn').onclick = handleAnalyze;
    document.getElementById('applySmartBtn').onclick = () => {
      state.designVariationIndex = 0;
      applySmartDesign();
    };
    document.getElementById('shuffleSmartBtn').onclick = () => {
      state.designVariationIndex++;
      applySmartDesign();
    };

    // Smart Mode toggle bindings (Identity vs Context)
    const identityBtn = document.getElementById('modeIdentityBtn');
    const contextBtn = document.getElementById('modeContextBtn');
    if (identityBtn && contextBtn) {
      identityBtn.onclick = () => {
        if (state.smartMode !== 'identity') {
          state.smartMode = 'identity';
          state.designVariationIndex = 0;
          updateSmartModeUI();
          applySmartDesign();
        }
      };
      contextBtn.onclick = () => {
        if (state.smartMode !== 'context') {
          state.smartMode = 'context';
          state.designVariationIndex = 0;
          updateSmartModeUI();
          applySmartDesign();
        }
      };
    }

    const handleManualChange = () => {
      state.isManualOverride = true;
      state.activePreset = null;
      renderPresets();
    };

    document.getElementById('dotStyleSelect').onchange = e => { handleManualChange(); state.options.dotStyle = e.target.value; render(); };
    document.getElementById('eyeStyleSelect').onchange = e => { handleManualChange(); state.options.eyeStyle = e.target.value; render(); };

    // Validated color controls
    document.getElementById('fgColor').oninput = e => {
      if (isValidHexColor(e.target.value)) {
        handleManualChange();
        state.options.fgColor = normalizeHexColor(e.target.value);
        document.getElementById('fgColorText').value = state.options.fgColor;
        render();
      }
    };
    document.getElementById('fgColorText').onchange = e => {
      if (isValidHexColor(e.target.value)) {
        handleManualChange();
        state.options.fgColor = normalizeHexColor(e.target.value);
        document.getElementById('fgColor').value = state.options.fgColor;
        document.getElementById('fgColorText').value = state.options.fgColor;
        render();
      } else {
        document.getElementById('fgColorText').value = state.options.fgColor;
      }
    };

    document.getElementById('bgColor').oninput = e => {
      if (isValidHexColor(e.target.value)) {
        handleManualChange();
        state.options.bgColor = normalizeHexColor(e.target.value);
        document.getElementById('bgColorText').value = state.options.bgColor;
        render();
      }
    };
    document.getElementById('bgColorText').onchange = e => {
      if (isValidHexColor(e.target.value)) {
        handleManualChange();
        state.options.bgColor = normalizeHexColor(e.target.value);
        document.getElementById('bgColor').value = state.options.bgColor;
        document.getElementById('bgColorText').value = state.options.bgColor;
        render();
      } else {
        document.getElementById('bgColorText').value = state.options.bgColor;
      }
    };

    document.getElementById('enableGradient').onchange = e => {
      handleManualChange();
      state.options.useGradient = e.target.checked;
      render();
    };

    document.getElementById('fgGradColor').oninput = e => {
      if (isValidHexColor(e.target.value)) {
        handleManualChange();
        state.options.fgGradColor = normalizeHexColor(e.target.value);
        document.getElementById('fgGradColorText').value = state.options.fgGradColor;
        render();
      }
    };
    document.getElementById('fgGradColorText').onchange = e => {
      if (isValidHexColor(e.target.value)) {
        handleManualChange();
        state.options.fgGradColor = normalizeHexColor(e.target.value);
        document.getElementById('fgGradColor').value = state.options.fgGradColor;
        document.getElementById('fgGradColorText').value = state.options.fgGradColor;
        render();
      } else {
        document.getElementById('fgGradColorText').value = state.options.fgGradColor;
      }
    };

    document.getElementById('frameStyleSelect').onchange = e => { handleManualChange(); state.options.frameStyle = e.target.value; render(); };
    document.getElementById('frameText').oninput = e => { handleManualChange(); state.options.frameText = e.target.value; render(); };
    document.getElementById('eccSelect').onchange = e => { handleManualChange(); state.options.ecc = e.target.value; render(); };

    document.getElementById('quietZoneSelect').onchange = e => {
      handleManualChange();
      state.options.quietZone = parseInt(e.target.value, 10);
      updateQuietZoneWarning();
      render();
    };

    document.querySelectorAll('input[name="logoMode"]').forEach(radio => {
      radio.onchange = e => {
        handleManualChange();
        state.options.logoMode = e.target.value;
        const uploadCont = document.getElementById('customUploadContainer');
        if (uploadCont) uploadCont.classList.toggle('hidden-field', e.target.value !== 'custom');
        render();
      };
    });

    const logoUpload = document.getElementById('logoUpload');
    if (logoUpload) {
      logoUpload.onchange = e => {
        handleManualChange();
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = ev => {
            const img = new Image();
            img.onload = () => {
              state.customLogoImg = img;
              state.customLogoDataUrl = ev.target.result;
              render();
            };
            img.src = ev.target.result;
          };
          reader.readAsDataURL(file);
        }
      };
    }

    document.getElementById('downloadPngBtn').onclick = () => {
      if (!state.url) return;
      const exportCanvas = document.createElement('canvas');
      QRRenderer.renderCanvas(exportCanvas, 1600, true);
      try {
        const dataUrl = exportCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `smart-qr-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error('PNG Export Error:', err);
      }
    };

    document.getElementById('downloadSvgBtn').onclick = () => {
      if (!state.url) return;
      const svg = QRRenderer.generateSVG();
      if (!svg) return;
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `smart-qr-${Date.now()}.svg`;
      link.href = objectUrl;
      link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    };

    render();
  }

  window.addEventListener('DOMContentLoaded', init);
})();
