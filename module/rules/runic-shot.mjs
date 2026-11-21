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

/**
 * Рунная Артиллерия: «поражает цели за пределами экстремальной дистанции при
 * прямой видимости. Пуля пролетает тройную дальность за 1 Раунд (цель за
 * экстремальной дистанцией получает попадание через Ход или несколько). Если
 * цель сдвинулась за время полёта, выстрел автоматически промахивается».
 * @returns {number} сколько Раундов летит пуля (0 — попадает сразу)
 */
export function runicFlightRounds(distM, rng) {
  const d = Number(distM), r = Number(rng);
  if (!Number.isFinite(d) || !(r > 0)) return 0;
  const perRound = r * 3;
  return d <= perRound ? 0 : Math.ceil(d / perRound) - 1;
}

/** Строка карточки выстрела: когда долетит пуля (пусто — попадает сразу). */
export function runicFlightLine(distM, rng) {
  const n = runicFlightRounds(distM, rng);
  if (!n) return "";
  return `ᚱ Рунная Артиллерия: до цели ${Math.round(Number(distM))} м, пуля летит ${Number(rng) * 3} м за Раунд — попадание через ${n} Раунд(а), в начале Хода Питати. Сдвинется цель за это время — выстрел промахивается сам.`;
}

// ── Пуля Искатель ───────────────────────────────────────────────────────────
// «Вплетая в Рунный Выстрел Mind Over Matter (W+0), может вместо эффекта на
// цели дать выстрелу один из эффектов». Успешная манифестация Mind Over Matter
// с выбранным эффектом (combat/pitati.mjs → combat/psyker-elite-hooks.mjs)
// кладёт номер эффекта флагом SEEKER_FLAG; его тратит следующий одиночный
// выстрел рунной пулей — тот же приём, что у Сквозного Выстрела.

export const SEEKER_FLAG = "seekerBulletReady";
export const SEEKER_SIZE_RULES = Object.freeze(["core.sizeToHit", "core.deadeyeSize", "core.sharpshooterSize"]);

/** Готовый эффект Пули Искателя (0…3) или null. */
export function seekerReady(actor) {
  const v = actor?.getFlag?.("warhammer-dbc", SEEKER_FLAG) ?? actor?.flags?.["warhammer-dbc"]?.[SEEKER_FLAG];
  const n = Number(v);
  return (v === null || v === undefined || v === "" || !Number.isInteger(n) || n < 0 || n >= SEEKER_EFFECTS.length) ? null : n;
}

const neg = v => Math.max(0, -(Number(v) || 0));

/**
 * Сколько вернуть в Порог эффект Пули Искателя по отмеченному в окне атаки:
 *  0 — штраф Избирательной стрельбы и Размера цели ниже 0;
 *  1 — Укрытие, штрафы стрельбы в рукопашную (своя и по связанной цели);
 *  2 — цель вне прямой видимости: штрафы обзора (свет, дым, тьма).
 * Эффект 3 (разворот после Избегания) Порога не трогает — кнопка карточки.
 * @param {number|null} idx
 * @param {{aimPenalty?:number, sizePenalty?:number, coverMod?:number, seekerMelee?:number, seekerLos?:number}} f
 */
export function seekerThresholdOffset(idx, f = {}) {
  if (idx === 0) return neg(f.aimPenalty) + neg(f.sizePenalty);
  if (idx === 1) return neg(f.coverMod) + neg(f.seekerMelee);
  if (idx === 2) return neg(f.seekerLos);
  return 0;
}

/** Пуля Искатель гасит Живой Щит (эффект 1): попадания не уходят на партнёра по Захвату. */
export const seekerIgnoresGrappleCover = idx => idx === 1;

// ── Выдержанный Взрыв ───────────────────────────────────────────────────────
/** Флаг актора: точка разряда вплетённого взрыва {x, y, sceneId} — тратит кнопка шаблона силы. */
export const TIMED_EXPLOSION_FLAG = "timedExplosionAt";

/**
 * «При промахе или успешном Избегании цели пуля разряжает вплетённый взрыв в
 * 1 м позади цели с позиции Питати»: точка на продолжении линии стрелок → цель,
 * за краем Базы цели ещё на 1 м. Координаты — пиксели сцены.
 * @param {{x:number,y:number}} from  центр стрелка
 * @param {{x:number,y:number}} to    центр цели
 * @param {number} targetRadiusPx     радиус Базы цели
 * @param {number} pxPerMeter
 */
export function timedExplosionPoint(from, to, targetRadiusPx, pxPerMeter) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  const ux = len ? dx / len : 1, uy = len ? dy / len : 0;
  const off = (Number(targetRadiusPx) || 0) + (Number(pxPerMeter) || 0);
  return { x: to.x + ux * off, y: to.y + uy * off };
}
