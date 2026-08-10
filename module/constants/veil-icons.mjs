// module/constants/veil-icons.mjs
// SVG-иконки окна «Завеса и Мистика» (вместо эмодзи). 24×24, линейные,
// stroke=currentColor — цвет наследуется от кнопки/текста. Используются как
// {{{veilIcon "key"}}} в hbs и veilIcon("key") в JS чат-карточек.

const wrap = (inner, fill = false) =>
  `<svg class="wv-ico" viewBox="0 0 24 24" ${fill ? 'fill="currentColor" stroke="none"' : 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"'} aria-hidden="true">${inner}</svg>`;

export const VEIL_ICONS = {
  // Ритуалы
  ritual:   wrap(`<path d="M12 2.5c1.6 1.8 1.6 3.6 0 4.9-1.6-1.3-1.6-3.1 0-4.9z"/><rect x="10" y="8" width="4" height="10" rx="1"/><path d="M8.5 18.5h7"/>`),
  candle:   wrap(`<path d="M12 2.5c1.6 1.8 1.6 3.6 0 4.9-1.6-1.3-1.6-3.1 0-4.9z"/><rect x="10" y="8" width="4" height="10" rx="1"/><path d="M8.5 18.5h7"/>`),
  // Навигация
  die:      wrap(`<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="15" cy="15" r="1.2"/>`),
  hourglass:wrap(`<path d="M7 3h10M7 21h10"/><path d="M8 3v3.2c0 1.7 4 3.3 4 5.8 0-2.5 4-4.1 4-5.8V3"/><path d="M8 21v-3.2c0-1.7 4-3.3 4-5.8 0 2.5 4 4.1 4 5.8V21"/>`),
  eye:      wrap(`<path d="M2.5 12s3.8-6 9.5-6 9.5 6 9.5 6-3.8 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.6"/>`),
  spiral:   wrap(`<path d="M12 12a2 2 0 112.1 2 4.3 4.3 0 11-4.4-4.4 6.6 6.6 0 116.7 6.7"/>`),
  star:     wrap(`<path d="M12 2l1.6 8.4L22 12l-8.4 1.6L12 22l-1.6-8.4L2 12l8.4-1.6z"/>`, true),
  compass:  wrap(`<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2.4 5-4.6 2.6 2.4-5z"/>`),
  warning:  wrap(`<path d="M12 3.5l8.5 15h-17z"/><path d="M12 9.5v4.5"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>`),
  demon:    wrap(`<path d="M6.5 3l2.8 3.8M17.5 3l-2.8 3.8"/><path d="M7 9.5a5 5 0 0110 0v3a5 5 0 01-2.4 4.2L12 21l-2.6-4.3A5 5 0 017 12.5z"/><circle cx="10" cy="12" r="1"/><circle cx="14" cy="12" r="1"/>`),
  door:     wrap(`<rect x="6" y="3" width="12" height="18" rx="1"/><path d="M5 21h14"/><circle cx="14.5" cy="12.5" r="1" fill="currentColor"/>`),
  storm:    wrap(`<path d="M7 14.5a4 4 0 01.4-8 5 5 0 019.3-.6 3.6 3.6 0 011 7"/><path d="M12.5 12l-2.5 3.6h2.8L11 20"/>`),
  announce: wrap(`<path d="M4 10v4h3l6 4V6l-6 4z"/><path d="M16.5 9a4.5 4.5 0 010 6"/>`),
  scan:     wrap(`<circle cx="11" cy="11" r="6"/><path d="M15.5 15.5L20 20"/><path d="M11 8v6M8 11h6"/>`),
  // Прочее
  veil:     wrap(`<path d="M4 6c2.7-1.6 5.3-1.6 8 0s5.3 1.6 8 0v3c-2.7 1.6-5.3 1.6-8 0s-5.3-1.6-8 0z"/><path d="M4 13c2.7-1.6 5.3-1.6 8 0s5.3 1.6 8 0"/>`),
  cog:      wrap(`<circle cx="12" cy="12" r="3"/><path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4"/>`)
};

export function veilIcon(key) { return VEIL_ICONS[key] || ""; }
