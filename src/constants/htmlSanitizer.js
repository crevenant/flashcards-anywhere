// src/constants/htmlSanitizer.js
// Constants for HTML sanitization

export const ALLOWED_TAGS = new Set([
  'b', 'strong', 'i', 'em', 'u', 's', 'br', 'p', 'ul', 'ol', 'li', 'code', 'pre',
  'ruby', 'rt', 'rb', 'rp', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'font',
  'a', 'img', 'sup', 'sub', 'mark',
]);

export const ALLOWED_ATTRS = {
  font: new Set(['color', 'size', 'face']),
  a: new Set(['href']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
};
