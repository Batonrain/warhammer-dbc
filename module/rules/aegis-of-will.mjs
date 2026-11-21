// module/rules/aegis-of-will.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Aegis of Will / Эгида Воли (Талант Псайканы; Разобрать o2964).
//  Книга: «При психосилах, действующих на площадь (аура, психический взрыв,
//  дыхание), псайкер может исключить до ½PR (окр.▲) целей из воздействия.»
//
//  Шаблон психосилы (кнопка «Разместить шаблон», hooks.mjs) отмечает целями
//  всех накрытых; с Талантом псайкер сразу выбирает, кого из накрытых снять
//  (combat/aegis-of-will.mjs). Вторая половина («психосилы с множеством
//  выстрелов теряют половину попаданий о защищённого союзника») — памятка.
// ════════════════════════════════════════════════════════════════════════════

import { hasAbility } from "./ability-by-key.mjs";

export function hasAegisOfWill(actor) {
  return hasAbility(actor, "psyker.core.aegisOfWill", "Aegis of Will", "talent");
}

/** Текущий PR псайкера (с учётом усиления/сдерживания, если записан). */
export function psykerRatingOf(actor) {
  const p = actor?.system?.psyker ?? {};
  return Number(p.currentRating) || Number(p.rating) || 0;
}

/** Сколько накрытых можно исключить: ½PR, округление вверх. */
export function aegisLimit(pr) {
  return Math.max(0, Math.ceil((Number(pr) || 0) / 2));
}

/** Работает ли Эгида на этом шаблоне: предмет — психосила, у кастующего Талант и PR > 0. */
export function aegisApplies(caster, item) {
  return item?.type === "psychicPower" && hasAegisOfWill(caster) && aegisLimit(psykerRatingOf(caster)) > 0;
}

/** Оставить цели: всех, кроме исключённых (не больше лимита, лишние игнорируются). */
export function applyAegisExclusion(tokens, excludedIds, limit) {
  const drop = new Set([...(excludedIds ?? [])].slice(0, Math.max(0, limit)));
  return (tokens ?? []).filter(t => !drop.has(t.id));
}
