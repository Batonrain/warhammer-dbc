// test/support/contest.mjs
//
// Встречный тест приёма (wdbc-x1nz.2.73): кнопка «Сопротивляться» в карточке
// инициатора несёт всё, что нужно второй стороне, в data-* атрибутах. Тест
// достаёт их из HTML ровно как браузер — el.dataset.

/** data-* первой (или n-й) кнопки «Сопротивляться» в HTML карточки. */
export function resistButtonData(html, n = 0) {
  const buttons = String(html).match(/<button[^>]*wh-contest-resist-btn[^>]*>/g) || [];
  const tag = buttons[n];
  if (!tag) return null;
  const ds = {};
  for (const m of tag.matchAll(/data-([a-z-]+)=(?:"([^"]*)"|'([^']*)')/g)) {
    const key = m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const raw = m[2] ?? m[3] ?? "";
    ds[key] = raw.replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  }
  return ds;
}
