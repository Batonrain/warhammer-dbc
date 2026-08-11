// module/sheets/picker-ui.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Общая обвязка окон-пикеров (Таланты, Черты, Мутации, Снаряжение, Элитные
//  архетипы): размер и положение окна.
//
//  Жила приватными функциями в листе персонажа, а нужна каждому пикеру. Шаг 5.3
//  разносит пикеры по модулям, и первый же вынесенный тянул бы лист обратно —
//  ровно то, чего вынос и должен избежать.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Позиция окна-пикера: Foundry считает top по запрошенной высоте, а окно
 * потом дорастает содержимым и уезжает вниз за край экрана. Считаем сами:
 * ужимаем размер под окно браузера и центрируем.
 */
export function pickerPos(width, height) {
  const w = Math.min(width, window.innerWidth - 40);
  const h = Math.min(height, window.innerHeight - 80);
  return {
    width: w, height: h,
    left: Math.max(10, Math.round((window.innerWidth - w) / 2)),
    top:  Math.max(10, Math.round((window.innerHeight - h) / 2))
  };
}

/**
 * Доводит окно-пикер по месту ПОСЛЕ отрисовки. Foundry считает top по
 * запрошенной высоте, а окно потом дорастает содержимым и уезжает вниз —
 * поэтому меряем фактический размер элемента и центрируем сами.
 * Заодно гасим Enter в строке поиска: диалог принимал его за нажатие
 * кнопки по умолчанию и закрывался.
 */
export function centerPicker(html) {
  const el = html.closest?.(".app")?.[0] ?? html[0]?.closest?.(".app");
  if (!el) return;
  requestAnimationFrame(() => {
    const h = Math.min(el.offsetHeight || 0, window.innerHeight - 40);
    const w = Math.min(el.offsetWidth  || 0, window.innerWidth  - 40);
    if (!h || !w) return;
    el.style.height = `${h}px`;
    el.style.top    = `${Math.max(10, Math.round((window.innerHeight - h) / 2))}px`;
    el.style.left   = `${Math.max(10, Math.round((window.innerWidth  - w) / 2))}px`;
  });
  html.find(".pick-search").on("keydown", ev => {
    if (ev.key === "Enter") { ev.preventDefault(); ev.stopPropagation(); }
  });
}
