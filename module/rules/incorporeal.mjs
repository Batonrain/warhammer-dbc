// module/rules/incorporeal.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Бестелесный (Incorporeal) и Фаза (Phase) — dbc-114, 14.11.2026. Чистая логика без Foundry.
//
//  Бестелесный: «Проходит сквозь любые препятствия; считается имеющим Flyer (6). Не может
//  физически взаимодействовать с другими персонажами, атаковать их или быть атакован ими, если
//  оба не находятся на одном плане. Получает +30 на тесты Stealth.»
//  Фаза: «за полудействие получает или теряет Incorporeal».
//
//  Модель: состояние «бестелесен» = (есть Черта Бестелесный) XOR (флаг переключения). Фаза
//  переключает флаг. Не смоделированы: Flyer (6) и «сквозь препятствия» — проверки стен в системе нет.
//  Читает записи Конструктора напрямую (как predicates.mjs::holdsCapabilityKey): hasRuleFlag
//  здесь замкнул бы круг импортов — предикат правила зовёт этот модуль.
// ════════════════════════════════════════════════════════════════════════════

export const INCORPOREAL_CAP = "plane.incorporeal";
export const PHASE_CAP = "plane.phase";
export const PLANE_TOGGLE_FLAG = "planeToggled";
export const INCORPOREAL_STEALTH_BONUS = 30;

/** Есть ли на акторе запись Конструктора kind:"capability" с этим ключом. */
export function holdsCap(actor, key) {
  for (const item of actor?.items ?? []) {
    const groups = item?.flags?.["warhammer-dbc"]?.mechanics;
    if (!Array.isArray(groups)) continue;
    for (const g of groups) {
      for (const e of g?.entries ?? []) {
        if (e?.kind === "capability" && e.capabilityKey === key) return true;
      }
    }
  }
  return false;
}

const toggled = actor => !!(actor?.flags?.["warhammer-dbc"]?.[PLANE_TOGGLE_FLAG] ?? actor?.getFlag?.("warhammer-dbc", PLANE_TOGGLE_FLAG));

/** Бестелесен ли актор сейчас. */
export function isIncorporealNow(actor) {
  return holdsCap(actor, INCORPOREAL_CAP) !== toggled(actor);
}

/** Может ли актор переключать состояние (Черта Фаза). */
export function canPhase(actor) {
  return holdsCap(actor, PHASE_CAP);
}

/**
 * Причина запрета атаки: атакующий и цель на разных планах. "" — можно.
 * Неизвестная цель (нет актора) — не блокируем.
 */
export function planeAttackBlockReason(attacker, target) {
  if (!attacker || !target) return "";
  const a = isIncorporealNow(attacker);
  const t = isIncorporealNow(target);
  if (a === t) return "";
  return a
    ? "бестелесный не может атаковать того, кто на материальном плане"
    : "цель бестелесна и находится на другом плане — атаковать её нельзя";
}
