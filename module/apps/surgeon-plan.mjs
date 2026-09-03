// module/apps/surgeon-plan.mjs
// ════════════════════════════════════════════════════════════════════════
//  Хирургеон — план установки ОДНОГО и того же протеза сразу на ОБЕ стороны
//  парной системы (глаза/руки/ноги). Кнопка «⚭ Обе стороны» в surgeon.mjs
//  осмысленна ТОЛЬКО пока свободны обе стороны системы — вторую сторону
//  другим предметом по-прежнему добирают одиночным select.
//
//  Чистая функция без Foundry (никаких Document/game/actor) — принимает
//  выбор из select ("own"/"lib" + ref) и список уже принадлежащих актору, но
//  НЕ установленных предметов этой системы (та же форма, что
//  `available.owned` из _prepareContext — [{id, name}]). Возвращает план,
//  что делать с этими данными; сам Foundry-код (createEmbeddedDocuments,
//  setFlag, sync...) остаётся в _onRender.
// ════════════════════════════════════════════════════════════════════════

/**
 * @param {"own"|"lib"} src
 * @param {string} ref  — id (own) или uuid (lib) выбранного в select пункта
 * @param {{id:string, name:string}[]} ownedInSystem — предметы актора этой
 *   системы, ещё не установленные (флаг installed не стоит)
 * @returns {{installExisting:string[], cloneSourceId:string|null,
 *            createFromLibCount:number}|null}
 *   - installExisting     — id уже существующих на акторе предметов, которым
 *                            нужно проставить установку + bodySide, в порядке
 *                            [left, right];
 *   - cloneSourceId        — если для второй стороны своей неустановленной
 *                            копии не нашлось: id предмета, чьи данные надо
 *                            склонировать (createEmbeddedDocuments), клон
 *                            встаёт на "right", ref — на "left";
 *   - createFromLibCount   — сколько НОВЫХ экземпляров создать из компендиума
 *                            (0 для "own", 2 для "lib" — обе стороны новые).
 *   Возвращает null, если src не распознан или own:ref не найден среди
 *   ownedInSystem (рассинхрон списка с select — ничего не делаем).
 */
export function planBothSidesInstall(src, ref, ownedInSystem = []) {
  if (src === "lib") {
    return { installExisting: [], cloneSourceId: null, createFromLibCount: 2 };
  }
  if (src === "own") {
    const selected = ownedInSystem.find(o => o.id === ref);
    if (!selected) return null;
    const other = ownedInSystem.find(o => o.id !== ref && o.name === selected.name);
    if (other) return { installExisting: [ref, other.id], cloneSourceId: null, createFromLibCount: 0 };
    return { installExisting: [ref], cloneSourceId: ref, createFromLibCount: 0 };
  }
  return null;
}
