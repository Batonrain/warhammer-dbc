// ════════════════════════════════════════════════════════════════════════
//  SVG-иконки состояний (Warhammer DBC). Замена эмодзи на единый набор.
//  Каждая иконка — компактный глиф 16×16, цвет задаётся через currentColor.
//  condIconHTML(key) возвращает готовый <span class="wh-cond-ico"> со svg.
// ════════════════════════════════════════════════════════════════════════

// Тематический цвет + тело svg (currentColor наследует цвет с обёртки).
export const CONDITION_ICONS = {
  bleeding: { color: "#ff5a5a", body:
    `<path fill="currentColor" d="M8 1.5C8 1.5 12.5 7 12.5 10.2A4.5 4.5 0 0 1 3.5 10.2C3.5 7 8 1.5 8 1.5Z"/>` },
  haemorrhaging: { color: "#c0392b", body:
    `<path fill="currentColor" d="M5.4 2C5.4 2 8.6 5.5 8.6 7.7A3.2 3.2 0 0 1 2.2 7.7C2.2 5.5 5.4 2 5.4 2Z"/>
     <path fill="currentColor" d="M11 6.2C11 6.2 13.6 9 13.6 10.8A2.6 2.6 0 0 1 8.4 10.8C8.4 9 11 6.2 11 6.2Z"/>` },
  stunned: { color: "#ffcf4d", body:
    `<g fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="2"/><circle cx="8" cy="8" r="5.2"/></g>` },
  fatigued: { color: "#6fd6e0", body:
    `<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M4 4H11L4 12H11"/>` },
  poisoned: { color: "#7fdc5f", body:
    `<path fill="currentColor" d="M8 2C5.2 2 3 4 3 6.8c0 1.9 1 3 2.2 3.7V12h5.6v-1.5C12 9.8 13 8.7 13 6.8 13 4 10.8 2 8 2Z"/>
     <circle cx="6" cy="6.8" r="1.2" fill="#06140d"/><circle cx="10" cy="6.8" r="1.2" fill="#06140d"/>
     <path stroke="#06140d" stroke-width="1" d="M6.8 12v-1.5M8 12v-1.6M9.2 12v-1.5"/>` },
  prone: { color: "#9fb4ff", body:
    `<circle cx="3.6" cy="9" r="1.8" fill="currentColor"/>
     <path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" d="M5.6 10.6H13M6.2 10.6L9 8"/>` },
  helpless: { color: "#ff6b6b", body:
    `<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
     <path d="M3 4.5H13M4.5 4.5V11.5M11.5 4.5V11.5"/>
     <path d="M4.5 8H11.5"/></g>
     <circle cx="4.5" cy="4.5" r="1.3" fill="currentColor" stroke="none"/>
     <circle cx="11.5" cy="4.5" r="1.3" fill="currentColor" stroke="none"/>` },
  unconscious: { color: "#b6c2cc", body:
    `<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M3.5 5L6 7.5M6 5L3.5 7.5M10 5L12.5 7.5M12.5 5L10 7.5M5 11.5C7 10 9 10 11 11.5"/>` },
  blinded: { color: "#cf9fff", body:
    `<g fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 8Q8 3 14 8Q8 13 2 8Z"/><circle cx="8" cy="8" r="1.9" fill="currentColor" stroke="none"/></g>
     <path stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M3 13L13 3"/>` },
  deafened: { color: "#b6c2cc", body:
    `<path fill="currentColor" d="M3 6.2H5L8 3.2V12.8L5 9.8H3Z"/>
     <path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M10.5 6L14 9.5M14 6L10.5 9.5"/>` },
  burning: { color: "#ff8a3a", body:
    `<path fill="currentColor" d="M8 1.5C8 1.5 4.2 5 4.2 9A3.8 3.8 0 0 0 11.8 9C11.8 6.2 9.4 5.2 9.4 3.2 8.7 4.2 8 4.7 8 6 8 4.2 8 2.8 8 1.5Z"/>` },
  radiation: { color: "#ffe14d", body:
    `<g fill="currentColor"><path d="M8 8L5.3 3.2A5.5 5.5 0 0 1 10.7 3.2Z"/>
     <path d="M8 8L5.3 3.2A5.5 5.5 0 0 1 10.7 3.2Z" transform="rotate(120 8 8)"/>
     <path d="M8 8L5.3 3.2A5.5 5.5 0 0 1 10.7 3.2Z" transform="rotate(240 8 8)"/>
     <circle cx="8" cy="8" r="1.7" fill="#06140d"/><circle cx="8" cy="8" r="1.1"/></g>` },
  hallucinogenic: { color: "#c06fff", body:
    `<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M8 8a1.1 1.1 0 1 1 1.2-1.1A3 3 0 1 1 6 9.9 4.9 4.9 0 1 1 11.6 5.6"/>` },
  pinned: { color: "#ff9a4d", body:
    `<path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" d="M8 2V9.5M5 6.8L8 9.8L11 6.8M4 13.2H12"/>` },
  crippling: { color: "#d8b89a", body:
    `<g stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"><path d="M4 5.5L11.5 13"/></g>
     <circle cx="3.8" cy="4.8" r="1.7" fill="currentColor"/><circle cx="12" cy="13.5" r="1.7" fill="currentColor"/>
     <path fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" d="M6.6 7.6l1.4-1 -0.8 2 1.6-0.7"/>` },
  addicted: { color: "#6fd6ff", body:
    `<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
     <path d="M2.5 13.5L9 7"/><path d="M7 5L11 9"/><path d="M9.6 3.4L12.6 6.4"/>
     <path d="M2.5 13.5L1.6 14.4"/><path d="M5 11L6.4 12.4"/><path d="M7 9L8.4 10.4"/></g>` },
  // ── Стр. 30-31 (Раны и Урон, «Статусы») — довели набор до книги ──────────
  dazed: { color: "#c9a8ff", body:
    `<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="5.2"/>
     <path d="M5.8 9.4C6.4 10.2 9.6 10.2 10.2 9.4"/></g>
     <circle cx="5.7" cy="6.3" r="0.9" fill="currentColor" stroke="none"/>
     <circle cx="10.3" cy="6.3" r="0.9" fill="currentColor" stroke="none"/>` },
  suffocating: { color: "#8fb0c4", body:
    `<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" d="M3 6.5Q8 3 13 6.5M3 9.5Q8 13 13 9.5"/>
     <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M3.2 3.2L12.8 12.8"/>` },
  gangrene: { color: "#7a8a4d", body:
    `<path fill="currentColor" d="M8 2C5.5 2 4 4.5 4 7.2 4 10.5 6 13 8 14.5 10 13 12 10.5 12 7.2 12 4.5 10.5 2 8 2Z" fill-opacity="0.35"/>
     <circle cx="6.6" cy="6.8" r="0.9" fill="currentColor"/><circle cx="9.6" cy="8.2" r="0.7" fill="currentColor"/>
     <circle cx="7.6" cy="10.4" r="0.8" fill="currentColor"/>` },
  lostHands: { color: "#c99a7a", body:
    `<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M3 12V6.5M3 12H9M9 12V8.5"/>
     <path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M10.5 4L14.5 12"/>` },
  lostArms: { color: "#c99a7a", body:
    `<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M3.5 3V7.5A3 3 0 0 0 6.3 10.5H9" stroke-dasharray="1.6 1.6"/>
     <path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M10 6L14 13"/>` },
  lostFeet: { color: "#c99a7a", body:
    `<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M6 3V8.5H12"/>
     <path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M3.5 10.5L9 13.5"/>` },
  lostLegs: { color: "#c99a7a", body:
    `<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M7 2.5V7L9.5 10.5" stroke-dasharray="1.6 1.6"/>
     <path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M4 12.5L12.5 9"/>` },
  lostEyes: { color: "#cf9fff", body:
    `<path fill="none" stroke="currentColor" stroke-width="1.5" d="M4 8Q8 5.4 12 8"/>
     <path fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" d="M5 9.5L6 8M7.3 10L7.6 8.3M9.6 10L9.3 8.3M11 9.5L10 8"/>` },
  grappling: { color: "#e08a3a", body:
    `<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
     <path d="M2.5 5.5C4 4 5.5 4.5 6 6.5S5 10.5 6.5 12.5"/>
     <path d="M13.5 5.5C12 4 10.5 4.5 10 6.5S11 10.5 9.5 12.5"/></g>` }
};

/** Готовый HTML-глиф состояния (inline svg в цветной обёртке). */
export function condIconHTML(key, size = 16) {
  const ic = CONDITION_ICONS[key];
  if (!ic) return "";
  return `<span class="wh-cond-ico" style="color:${ic.color};width:${size}px;height:${size}px;">`
       + `<svg viewBox="0 0 16 16" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">${ic.body}</svg>`
       + `</span>`;
}
