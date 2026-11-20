// module/rules/runic-shot.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Runic Shot / Рунный Выстрел и Runic Bullet / Рунная Пуля (Черты Питати;
//  Разобрать u6c9x). Книга: «Одиночные выстрелы рунной пулей получают +тPR Dmg
//  и +½тPR Pen (окр.▼)»; рунную пулю Питати вырезает за 5 минут.
//
//  Запас вырезанных пуль — счётчик RUNIC_BULLETS_FLAG на акторе (кнопка
//  «▶ Запустить» Черты Рунная Пуля прибавляет одну). В окне стрельбы галочка
//  «Рунная пуля» (sheets/attack/talent-toggles.mjs); на одиночном выстреле
//  attack.mjs прибавляет бонус и списывает пулю. Вплетение второй психосилы в
//  выстрел остаётся за столом: манифестация идёт из вкладки психосил.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

export const RUNIC_BULLETS_FLAG = "runicBullets";

export function hasRunicShot(actor) {
  return [...(actor?.items ?? [])].some(i => i?.type === "trait" && itemHasName(i, "Runic Shot"));
}

export function runicBulletsLeft(actor) {
  return Math.max(0, Number(actor?.getFlag?.("warhammer-dbc", RUNIC_BULLETS_FLAG)
    ?? actor?.flags?.["warhammer-dbc"]?.[RUNIC_BULLETS_FLAG]) || 0);
}

/** Текущий Пси-Рейтинг: бPR минус поддерживаемые силы. */
export function currentPsyRating(actor) {
  const psy = actor?.system?.psyker ?? {};
  return Math.max(0, (Number(psy.rating) || 0) - (Number(psy.sustain) || 0));
}

/** Бонус выстрела рунной пулей: только одиночный, при выбранной галочке и пуле в запасе. */
export function runicShotBonus(actor, { toggles = {}, isMelee = false, rofMode = "" } = {}) {
  if (isMelee || rofMode !== "single" || !toggles.runicShot) return { dmg: 0, pen: 0, used: false };
  if (!hasRunicShot(actor) || runicBulletsLeft(actor) < 1) return { dmg: 0, pen: 0, used: false };
  const pr = currentPsyRating(actor);
  return { dmg: pr, pen: Math.floor(pr / 2), used: true };
}
