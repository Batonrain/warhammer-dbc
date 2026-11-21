// module/combat/psyker-elite-hooks-state.mjs
// «Отложено до следующей манифестации»: кнопки Талантов (Пламя Сердца, Мощь
// Переполняет, Чародейский Посох, Варп-Танцор…) кладут сюда, что должно
// случиться с ближайшим психотестом, окно манифестации
// (combat/psyker-elite-hooks.mjs ← sheets/tabs/psychic.mjs) это забирает.
// Отдельный файл без импортов: его читают и кнопки, и окно манифестации.

const NS = "warhammer-dbc";
export const PENDING_MANIFEST_FLAG = "psyPendingManifest";

/** Что ждёт следующей манифестации: { heartFire?, overwhelming?, staff?, warpDance? }. */
export function pendingManifest(actor) {
  const v = actor?.getFlag?.(NS, PENDING_MANIFEST_FLAG) ?? actor?.flags?.[NS]?.[PENDING_MANIFEST_FLAG];
  return v && typeof v === "object" ? v : {};
}

/** Добавить к отложенному (поля сливаются). */
export async function setPendingManifest(actor, patch) {
  await actor.setFlag(NS, PENDING_MANIFEST_FLAG, { ...pendingManifest(actor), ...patch });
}

/** Забрать и очистить. */
export async function takePendingManifest(actor) {
  const v = pendingManifest(actor);
  if (Object.keys(v).length) await actor.unsetFlag(NS, PENDING_MANIFEST_FLAG);
  return v;
}
