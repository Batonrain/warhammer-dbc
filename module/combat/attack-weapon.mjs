// module/combat/attack-weapon.mjs
//
// Фаза 1 конвейера со стороны оружия: чем именно бьют в этой атаке. Профиль
// (стр. 207–221), хват (стр. 39), боеприпас (стр. 203) и выключенное оружие
// (стр. 209–211) меняют урон, Пробитие и набор особых свойств ещё до броска.
//
// Как и attack-outcome.mjs, файл не знает про Foundry: сюда приходят уже
// прочитанные `system` оружия и список свойств, а обратно уходят числа и строки.

/** Приписать плоский мод к формуле урона: «1d10+5» + 3 → «1d10+5+3». */
function withFlat(damage, flat) {
  if (!flat || !damage) return damage;
  return `${damage}${flat > 0 ? "+" : ""}${flat}`;
}

/**
 * Урон, тип и Пробитие этой атаки.
 *
 * Профиль переопределяет всё, что в нём указано. Пробитие он задаёт всегда, даже
 * когда поля нет: у профилей-захватов в книге Пробитие 0, а не «как у оружия».
 */
export function effectiveDamage({ sys, profile = null, gripDmgFlat = 0 }) {
  const flat = Number(gripDmgFlat) || 0;
  return {
    damage:      withFlat((profile && profile.damage) ? profile.damage : sys.damage, flat),
    damageType:  (profile && profile.damageType) ? profile.damageType : sys.damageType,
    penetration: profile ? (Number(profile.penetration) || 0) : (Number(sys.penetration) || 0)
  };
}

/** Ключ и рейтинги записи свойства: в данных она бывает и строкой, и объектом. */
function propEntry(p) {
  if (typeof p === "string") return { key: p, rating: 0, rating2: 0 };
  return { key: p?.key, rating: p?.rating || 0, rating2: p?.rating2 || 0 };
}

/**
 * Долить к свойствам оружия то, что даёт эта конкретная атака: хват, боеприпас и
 * отмеченные игроком условные свойства боеприпаса.
 *
 * При совпадении ключа остаётся больший рейтинг. Строковый рейтинг — формула
 * кубика («1d5» у Взрыва) — в сравнении не участвует: числа с формулой не
 * сравнить, и попытка дала бы NaN.
 *
 * Исходный список не изменяется.
 */
export function mergeExtraProps(entries, { gripProps = [], gripKey = "", gripProps2h = [], ammoProps = [], condProps = [] } = {}) {
  const result = entries.map(e => ({ ...e }));
  const has    = key => result.some(x => x.key === key);

  // Хват может добавлять свойства (Бл → Precise, Хв → Cheap Shot; стр. 39).
  for (const key of gripProps) if (!has(key)) result.push({ key, rating: 0, rating2: 0 });

  // Боеприпас (стр. 203): постоянные свойства плюс отмеченные игроком условные.
  const fromAmmo = [...ammoProps, ...condProps];
  for (const p of fromAmmo) {
    const { key, rating, rating2 } = propEntry(p);
    if (!key) continue;
    const existing = result.find(x => x.key === key);
    if (!existing) { result.push({ key, rating, rating2 }); continue; }
    if (typeof existing.rating  !== "string" && typeof rating  !== "string")
      existing.rating  = Math.max(existing.rating  || 0, rating);
    if (typeof existing.rating2 !== "string" && typeof rating2 !== "string")
      existing.rating2 = Math.max(existing.rating2 || 0, rating2);
  }

  // Свойства только двуручного хвата (стр. 211, 220): Силовая Булава и оба
  // Крозиуса — «в 2р Хвате получает Concussive (0)».
  if (String(gripKey || "") === "2р") {
    for (const g of gripProps2h) {
      const e = typeof g === "string" ? { key: g, rating: 0, rating2: 0 } : { rating: 0, rating2: 0, ...g };
      if (e.key && !has(e.key)) result.push(e);
    }
  }
  return result;
}

/** Что теряет выключенное оружие каждого типа. */
const OFF_DROPS = { chain: ["tearing"], shock: ["shocking"], power: ["powerField"] };

/**
 * Выключенное оружие (стр. 209–211). Сюда же попадает подавление полем Haywire —
 * правило то же самое.
 *
 *   цепное  — −2 урона, −1 Пробитие, без Рвущего;
 *   шоковое — считается примитивным, −2 урона;
 *   силовое — работает как свой примитивный аналог (offProfile).
 *
 * `damage` в ответе — null, когда формула не меняется: её задаёт только силовое.
 *
 * @returns {{entries: object[], damage: ?string, dmgMod: number, penMod: number, note: string}}
 */
export function weaponOffEffects({ sys, entries, on, basePen = 0, gripDmgFlat = 0 }) {
  const type  = sys.weaponType || "";
  const quiet = { entries: entries.map(e => ({ ...e })), damage: null, dmgMod: 0, penMod: 0, note: "" };
  if (!on || !Object.hasOwn(OFF_DROPS, type)) return quiet;

  const kept = quiet.entries.filter(e => !OFF_DROPS[type].includes(e.key));
  // Всё, кроме цепного, считается примитивным оружием.
  if (type !== "chain" && !kept.some(e => e.key === "primitive"))
    kept.push({ key: "primitive", rating: 0, rating2: 0 });

  if (type === "chain")
    return { entries: kept, damage: null, dmgMod: -2, penMod: -1,
             note: "Оружие выключено: −2 урона, −1 Пробитие, без Рвущего." };

  if (type === "shock")
    return { entries: kept, damage: null, dmgMod: -2, penMod: 0,
             note: "Оружие выключено: считается соответствующим примитивным, −2 урона." };

  const off = sys.offProfile;
  if (!off?.damage)
    return { entries: kept, damage: null, dmgMod: 0, penMod: 0,
             note: "Оружие выключено: работает как соответствующее примитивное оружие." };

  const offPen = Number(off.penetration) || 0;
  return {
    entries: kept,
    damage:  withFlat(off.damage, Number(gripDmgFlat) || 0),
    dmgMod:  0,
    penMod:  offPen - basePen,
    note:    `Оружие выключено: работает как «${off.name}» (${off.damage}, Проб. ${offPen}).`
  };
}
