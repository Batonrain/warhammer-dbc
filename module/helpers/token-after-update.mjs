// module/helpers/token-after-update.mjs
// Позиция токена после апдейта — общая для всех хуков updateToken, которые
// меряют геометрию (Свободная атака, Караул, Протискивание, поле ЭМИ).

/**
 * Где токен стоит ПОСЛЕ апдейта. Обычное перетаскивание мышью в Foundry v14 —
 * анимированное перемещение: в хуке updateToken документ ещё показывает
 * старые x/y (живая проверка 21.11.2026, Sahara task-bc09), и разрыв контакта
 * не находился — Свободную атаку не предлагали. Новые координаты приходят в
 * самих changes, поэтому они важнее документа; без них — документ как есть.
 * @returns {object} плоская копия с id/x/y/width/height/disposition
 */
export function tokenDocAfterUpdate(tokenDoc, changes = {}) {
  if (!tokenDoc) return tokenDoc;
  const pick = key => {
    const v = changes?.[key];
    return v === undefined || v === null || !Number.isFinite(Number(v)) ? tokenDoc[key] : Number(v);
  };
  return {
    id: tokenDoc.id, uuid: tokenDoc.uuid, name: tokenDoc.name, actor: tokenDoc.actor, parent: tokenDoc.parent,
    disposition: changes?.disposition ?? tokenDoc.disposition,
    x: pick("x"), y: pick("y"), width: pick("width"), height: pick("height")
  };
}
