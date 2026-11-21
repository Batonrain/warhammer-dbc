// module/rules/soul-binding.mjs
// ════════════════════════════════════════════════════════════════════════
//  Ритуал Связывания Души (корбук, Ритуалы, «Контроль») — чистая часть
//  (Sahara 581-ddee). Кнопки и карточки — combat/soul-binding.mjs.
//
//  Книга: успех теста ритуала → «немедленно встречный тест W–30+10 за каждый
//  Успех предыдущего теста после первого vs W+0 против цели». Победа — связь:
//  общие чувства, Врасплох только вдвоём, автоуспех Лояльности, «урон от
//  Выжигания Души или Варп-Оружия после поглощения распределяется между ними
//  поровну», смерть цели — Ритуалисту W–30 или −2d10 W навсегда.
//
//  Связь хранится на обоих: flags.warhammer-dbc.soulBondPartners — uuid'ы
//  партнёров. Цель (Миньон) ещё несёт прежний флаг soulBound (автоуспех
//  Лояльности, rules/minion-loyalty.mjs) — его ритуал теперь ставит сам.
// ════════════════════════════════════════════════════════════════════════

export const SOUL_BOND_FLAG = "soulBondPartners";
export const SOUL_BINDING_RITUAL = "Rite of Soul Binding";
export const SOUL_BINDING_RITUALIST_MOD = -30;
export const SOUL_BINDING_DEATH_MOD = -30;

const num = v => Number(v) || 0;

/** uuid'ы душ, связанных с актором. */
export function soulBondPartners(actor) {
  const v = actor?.flags?.["warhammer-dbc"]?.[SOUL_BOND_FLAG] ?? actor?.getFlag?.("warhammer-dbc", SOUL_BOND_FLAG);
  return Array.isArray(v) ? v.filter(Boolean) : [];
}

/** Это предмет-ритуал Связывания Души. */
export function isSoulBindingRitual(item) {
  const name = String(item?.name ?? "");
  return name.includes(SOUL_BINDING_RITUAL) || name.includes("Ритуал Связывания Души");
}

/** Пороги встречного теста: Ритуалист W−30 +10 за каждый Успех ритуала после первого; цель W+0. */
export function soulBindingThresholds(ritualist, target, ritualDeg) {
  const extra = Math.max(0, Math.trunc(num(ritualDeg)) - 1) * 10;
  return {
    ritualist: num(ritualist?.system?.characteristics?.wp?.total) + SOUL_BINDING_RITUALIST_MOD + extra,
    target: num(target?.system?.characteristics?.wp?.total),
    extra
  };
}

/** Новый список партнёров с добавленным uuid (без повторов). */
export const withPartner = (list, uuid) => [...new Set([...(list ?? []), uuid].filter(Boolean))];

/**
 * Деление урона Выжигания Души / Варп-Оружия «после поглощения … поровну».
 * Пострадавший оставляет себе большую половину (окр.▲), остальное поровну
 * делят партнёры (у Ритуалиста их может быть несколько — каждый связан с
 * ним; прочтение: делят все связанные с ним души).
 * @returns {{self:number, shares:number[]}}
 */
export function splitSoulBondDamage(damage, partnerCount) {
  const d = Math.max(0, Math.trunc(num(damage)));
  const n = Math.max(0, Math.trunc(num(partnerCount)));
  if (!n || d < 2) return { self: d, shares: [] };
  const each = Math.floor(d / (n + 1));
  const shares = Array.from({ length: n }, () => each);
  return { self: d - each * n, shares };
}

/** Радиус связи: сумма W.b обоих, км (книга). */
export function soulBondRangeKm(a, b) {
  const wb = x => num(x?.system?.characteristics?.wp?.bonus) || Math.floor(num(x?.system?.characteristics?.wp?.total) / 10);
  return wb(a) + wb(b);
}
