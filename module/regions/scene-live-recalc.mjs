// module/regions/scene-live-recalc.mjs
//
// Общий регистратор «живой пересчёт по сцене»: движение/появление/исчезновение
// токена планирует повторный проход правила по сцене (recalc(scene)), плюс по
// подписке — правки предметов актора и Region-поведений. На нём сейчас Ауры
// (auras.mjs, wdbc-1pa) и Рунические Вязи (runic-weave-zone.mjs) — оба реагируют
// на одно и то же движение токена, но с разным набором полей и доп.триггеров,
// отсюда параметры, а не жёсткий список хуков.
export function registerSceneLiveRecalc({ recalc, tokenFields, onDeleteToken, itemWatch, regionBehavior }) {
  Hooks.on("canvasReady", () => recalc(canvas.scene));
  Hooks.on("createToken", doc => recalc(doc.parent));
  Hooks.on("deleteToken", doc => {
    onDeleteToken?.(doc);
    recalc(doc.parent);
  });
  Hooks.on("updateToken", (doc, changes) => {
    if (tokenFields.some(k => k in changes)) recalc(doc.parent);
  });

  if (itemWatch) {
    const { fields, filter } = itemWatch;
    const watched = item => item.actor && (!filter || filter(item));
    Hooks.on("createItem", item => { if (watched(item)) recalc(canvas.scene); });
    Hooks.on("deleteItem", item => { if (watched(item)) recalc(canvas.scene); });
    Hooks.on("updateItem", (item, changes) => {
      if (!item.actor) return;
      const touched = fields.some(k => k in changes || foundry.utils.hasProperty(changes, k));
      if (touched) recalc(canvas.scene);
    });
  }

  if (regionBehavior) {
    Hooks.on("createRegionBehavior", () => recalc(canvas.scene));
    Hooks.on("updateRegionBehavior", () => recalc(canvas.scene));
    Hooks.on("deleteRegionBehavior", () => recalc(canvas.scene));
  }
}
