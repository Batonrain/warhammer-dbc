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

/**
 * Сквозной Выстрел (Талант Питати): «вместо вплетения психосилы за
 * полудействие пройти психотест W+0 и удвоить свой тPR в расчёте бонуса к Dmg
 * и Pen». Метку PIERCING_SHOT_FLAG ставит кнопка Таланта (combat/pitati.mjs),
 * снимает выстрел рунной пулей (combat/attack.mjs).
 */
export const PIERCING_SHOT_FLAG = "piercingShotReady";

export function piercingShotReady(actor) {
  return !!(actor?.getFlag?.("warhammer-dbc", PIERCING_SHOT_FLAG) ?? actor?.flags?.["warhammer-dbc"]?.[PIERCING_SHOT_FLAG]);
}

/** Бонус выстрела рунной пулей: только одиночный, при выбранной галочке и пуле в запасе. */
export function runicShotBonus(actor, { toggles = {}, isMelee = false, rofMode = "" } = {}) {
  if (isMelee || rofMode !== "single" || !toggles.runicShot) return { dmg: 0, pen: 0, used: false, piercing: false };
  if (!hasRunicShot(actor) || runicBulletsLeft(actor) < 1) return { dmg: 0, pen: 0, used: false, piercing: false };
  const piercing = piercingShotReady(actor);
  const pr = currentPsyRating(actor) * (piercing ? 2 : 1);
  return { dmg: pr, pen: Math.floor(pr / 2), used: true, piercing };
}

const hasTalent = (actor, name) => [...(actor?.items ?? [])].some(i => i?.type === "talent" && itemHasName(i, name));
export const hasLivingBullet   = a => hasTalent(a, "Living Bullet");
export const hasPiercingShot   = a => hasTalent(a, "Piercing Shot");
export const hasRunicArtillery = a => hasTalent(a, "Runic Artillery");
export const hasSeekerBullet   = a => hasTalent(a, "Seeker Bullet");
export const hasTimedExplosion = a => hasTalent(a, "Timed Explosion");

/**
 * Можно ли вплести эту психосилу в Рунный Выстрел: сила на себя — нет
 * (применяется к цели попадания); на Касание — только Биомантия с Живой Пулей.
 */
export function runicWeaveAllowed(actor, power) {
  if (power?.type !== "psychicPower") return false;
  const range = String(power.system?.range ?? "").trim().toLowerCase();
  if (range === "сам" || range === "self") return false;
  const touch = power.system?.powerType === "touch" || /касани|контакт/.test(range);
  if (touch) return hasLivingBullet(actor) && power.system?.discipline === "biomancy";
  return true;
}

/** Психический взрыв (Выдержанный Взрыв): у силы есть свойство Blast или тип стрельбы «взрыв». */
export function isPsychicBlast(power) {
  const props = power?.system?.weaponProps ?? [];
  return props.some(p => String(p?.key ?? p).toLowerCase() === "blast") || /blast|взрыв/i.test(String(power?.system?.shootSubtype ?? ""));
}

/** Пуля Искатель: эффекты выстрела вместо эффекта Mind Over Matter на цели. */
export const SEEKER_EFFECTS = Object.freeze([
  "игнорировать штраф Избирательной стрельбы и Размера ниже 0",
  "игнорировать Укрытие цели, штрафы стрельбы в рукопашную и Талант «Живой Щит»",
  "поразить цель вне прямой видимости",
  "после успешного Избегания развернуть пулю и нанести ещё одно Попадание со спины цели"
]);

/** Рунная Артиллерия: Полное Прицеливание и поддерживаемая Сверхъестественная Внимательность. */
export function runicArtilleryActive(actor, { aiming = "" } = {}) {
  if (aiming !== "full" || !hasRunicArtillery(actor) || !hasRunicShot(actor)) return false;
  return [...(actor?.items ?? [])].some(i => i?.type === "psychicPower" && i.system?.isSustained
    && itemHasName(i, "Preternatural Awareness"));
}
