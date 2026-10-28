// module/rules/show-off.mjs
// ════════════════════════════════════════════════════════════════════════════
//  РИСОВКА / SHOW-OFF — чистые условия (Таланты «Рукопашные», Sahara 3-8dc5).
//
//  Книга (core.json): «Действие: Полудействие. Тип: Физическое, Рукопашное, Ментальное.
//  Находясь в рукопашной, персонаж проводит тест WS+0 vs WS+0 против до F.b целей в базовом
//  контакте (бросая только раз против всех). Если он побеждает, цели до начала его следующего
//  Хода теряют все преимущества Командования и не могут получать новых, а он может немедленно
//  провести по одной базовой рукопашной атаке по каждой цели, против которой он победил на 5+
//  Успехов. Это не считается атакой, так что позволяет использовать второе полудействие на
//  атакующий прием.»
//
//  Бросок и сопротивление — общий встречный тест (combat/opposed-contest.mjs: инициатор бросает
//  ОДИН раз, кнопка «Сопротивляться» на каждого противника). Здесь — только выбор целей и
//  порог свободной атаки. Foundry-обвязка — combat/show-off.mjs.
// ════════════════════════════════════════════════════════════════════════════

/** Перевес в Успехах, дающий свободную базовую атаку («победил на 5+ Успехов»). */
export const SHOW_OFF_FREE_ATTACK_MARGIN = 5;

/** Предел числа целей — бонус Товарищества (F.b). */
export function showOffMaxTargets(actor) {
  return Math.max(0, Number(actor?.system?.characteristics?.fel?.bonus) || 0);
}

/**
 * Какие цели взять. Враги в базовом контакте — `contact`; выцеленные игроком — `targeted`.
 * Выцелены — берутся они (из тех, что в контакте, не больше F.b); иначе врагов не больше F.b —
 * берутся все; иначе просим выцелить. Совпадение — по `uuid` (токена) либо по самому объекту.
 * @returns {{ok:boolean, reason:string, picked:object[]}}
 */
export function showOffPickTargets({ contact = [], targeted = [], max = 0 }) {
  const same = (a, b) => a === b || (!!a?.uuid && a.uuid === b?.uuid);
  if (!(max > 0)) return { ok: false, reason: "бонус Товарищества (F.b) равен нулю — целей нет", picked: [] };
  if (!contact.length) return { ok: false, reason: "нет врага в базовом контакте", picked: [] };
  const aimed = targeted.filter(t => contact.some(c => same(c, t)));
  if (aimed.length > max) {
    return { ok: false, reason: `выцелено ${aimed.length} целей, а можно не больше ${max} (F.b)`, picked: [] };
  }
  if (aimed.length) return { ok: true, reason: "", picked: aimed };
  if (contact.length <= max) return { ok: true, reason: "", picked: [...contact] };
  return { ok: false, reason: `в контакте ${contact.length} врагов, а можно не больше ${max} (F.b) — выцельте тех, против кого Рисовка`, picked: [] };
}

/**
 * Победа «на 5+ Успехов» над целью. Перевес (margin) встречного теста, как у прочих книжных
 * «победа на N Успехов» (Захват, combat/grapple.mjs); победа меньшим провалом (у инициатора нет
 * Успехов, deg = 0) Успехов не даёт.
 */
export function showOffFreeAttackWon({ margin, deg }) {
  if (!(Number(deg) > 0)) return false;
  return Number(margin) >= SHOW_OFF_FREE_ATTACK_MARGIN;
}
