// src/frontend/utils/htmlSanitizer.js
// Utility functions for HTML sanitization and safe rendering
// src/frontend/utils/htmlSanitizer.js
// Utility functions for HTML sanitization and safe rendering

// Inline constants (copied from ../../constants/htmlSanitizer.js)
const ALLOWED_TAGS = new Set([
  'b', 'strong', 'i', 'em', 'u', 's', 'br', 'p', 'ul', 'ol', 'li', 'code', 'pre',
  'ruby', 'rt', 'rb', 'rp', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'font',
  'a', 'img', 'sup', 'sub', 'mark',
]);
const ALLOWED_ATTRS = {
  font: new Set(['color', 'size', 'face']),
  a: new Set(['href']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
};

(function () {
  function sanitizeAttr(tag, name, value) {
    const allowed = ALLOWED_ATTRS[tag];
    if (!allowed || !allowed.has(name)) return null;
    if (tag === 'font') {
      if (name === 'color') {
        const v = String(value).trim();
        if (
          /^#[0-9a-fA-F]{3}$/.test(v) ||
          /^#[0-9a-fA-F]{6}$/.test(v) ||
          /^[a-zA-Z]+$/.test(v)
        )
          return v;
        return null;
      }
      if (name === 'size') {
        const v = String(value).trim();
        if (/^[1-7]$/.test(v)) return v;
        return null;
      }
      if (name === 'face') {
        const v = String(value).trim();
        if (/^[\w\s,-]+$/.test(v)) return v;
        return null;
      }
    }
    if (tag === 'a') {
      if (name === 'href') {
        const v = String(value).trim();
        if (/^(https?:)?\/\//i.test(v) || /^mailto:/i.test(v) || /^#/.test(v)) return v;
        return null;
      }
    }
    if (tag === 'img') {
      if (name === 'src') {
        const v = String(value).trim();
        if (/^(https?:)?\/\//i.test(v) || /^data:image\//i.test(v)) return v;
        return null;
      }
      if (name === 'alt' || name === 'title') {
        return String(value);
      }
      if (name === 'width' || name === 'height') {
        const v = String(value).trim();
        if (/^\d{1,4}$/.test(v)) return v;
        return null;
      }
    }
    return null;
  }

  function sanitizeHtmlToFragment(html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    function clean(node) {
      if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.nodeValue);
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();
        if (!ALLOWED_TAGS.has(tag)) {
          const frag = document.createDocumentFragment();
          node.childNodes.forEach((ch) => {
            const c = clean(ch);
            if (c) frag.appendChild(c);
          });
          return frag;
        }
        const el = document.createElement(tag);
        if (node.attributes && node.attributes.length) {
          for (const attr of Array.from(node.attributes)) {
            const name = attr.name.toLowerCase();
            const val = sanitizeAttr(tag, name, attr.value);
            if (val != null) el.setAttribute(name, val);
          }
        }
        node.childNodes.forEach((ch) => {
          const c = clean(ch);
          if (c) el.appendChild(c);
        });
        return el;
      }
      return document.createTextNode('');
    }
    const out = document.createDocumentFragment();
    template.content.childNodes.forEach((n) => {
      const c = clean(n);
      if (c) out.appendChild(c);
    });
    return out;
  }

  function renderSafe(el, text) {
    el.innerHTML = '';
    el.appendChild(sanitizeHtmlToFragment(String(text)));
  }

  // Attach to window
  window.sanitizeHtmlToFragment = sanitizeHtmlToFragment;
  window.renderSafe = renderSafe;
})();
