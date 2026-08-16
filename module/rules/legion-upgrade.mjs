// module/rules/legion-upgrade.mjs
//
// Легион-вариант оружия. Свойство Legion — не только штрафы к тесту
// (rules/legion-fit.mjs): оружие, переделанное под Астартес, тяжелее, реже и
// бьёт сильнее. Правки профиля свои у каждого рода оружия:
//
//   Примитивное  — Редкость до 1 (или +1, если уже 1 и выше), вес ×2, Dmg +1,
//                  Pen +1, и по умолчанию модификации Hardened и Mono;
//   Цепное       — Редкость +1, вес ×2, Dmg +1, Pen +1;
//   Шоковое      — Редкость до 2, вес ×2, Dmg +1, Pen +1;
//   Силовое      — Редкость +1, вес ×2, Dmg +1, Pen +1;
//   Психосиловое — вес ×3, прочее без изменений;
//   Щиты         — Редкость +1, вес ×2, Dmg +1, Pen +1, AP +1 и модификация
//                  Hardened (то есть ещё +1 AP).
//
// Модификации (Hardened, Mono) и AP щита числовых полей у предмета не имеют:
// модификация — отдельный предмет weaponMod, а AP щита живёт в тексте. Их
// правка возвращается подписью `note`, чтобы вписать её в «Особенности», а не
// молча потерять.

/** Прибавка к плоской части формулы урона: «1d10+5» → «1d10+6», «1d10» → «1d10+1». */
export function addFlatDamage(formula, add) {
  const src = String(formula ?? "").trim();
  if (!src || !add) return src;
  // Хвостовая константа: последнее «+N» или «−N» в строке.
  const m = src.match(/([+-])\s*(\d+)\s*$/);
  if (!m) return `${src}${add > 0 ? "+" : "−"}${Math.abs(add)}`;
  const value = (m[1] === "-" ? -1 : 1) * Number(m[2]) + add;
  const head  = src.slice(0, m.index).trim();
  if (value === 0) return head;
  return `${head}${value > 0 ? "+" : "−"}${Math.abs(value)}`;
}

/** Род оружия для Легион-варианта: по свойству щита, иначе по типу оружия. */
export function legionKind(system = {}) {
  const props = (system.weaponProps || []).map(p => (typeof p === "string" ? p : p?.key));
  if (props.includes("defensive")) return "shield";
  if (props.includes("primitive")) return "primitive";
  switch (system.weaponType) {
    case "primitive": return "primitive";
    case "chain":     return "chain";
    case "shock":     return "shock";
    case "power":     return "power";
    case "psychic":   return "psychic";
    default:          return "";
  }
}

/** Правки Редкости: «до N» поднимает низкую, а уже дотянувшую двигает на +1. */
const raiseTo = (value, floor) => (value < floor ? floor : value + 1);

const KIND_NOTE = {
  primitive: "Легион-вариант: модификации Hardened и Mono по умолчанию, если применимы к профилю.",
  shield:    "Легион-вариант: +1 AP и модификация Hardened (ещё +1 AP), если применима к профилю."
};

/**
 * Что меняется в профиле, когда оружию добавили свойство Legion.
 *
 * @returns {{changes: object, note: string}|null} null — для этого рода оружия
 *   Легион-варианта книга не описывает (низкотехнологичное, экзотика и прочее).
 */
export function legionUpgrade(system = {}) {
  const kind = legionKind(system);
  if (!kind) return null;

  const weight = Number(system.weight) || 0;
  const avail  = Number(system.availability) || 0;
  const pen    = Number(system.penetration) || 0;

  // Психосиловое — только вес, профиль не трогаем.
  if (kind === "psychic") {
    return { changes: { weight: weight * 3 }, note: "" };
  }

  const changes = {
    weight:       weight * 2,
    damage:       addFlatDamage(system.damage, 1),
    penetration:  pen + 1,
    availability: kind === "primitive" ? raiseTo(avail, 1)
                : kind === "shock"     ? raiseTo(avail, 2)
                : avail + 1
  };
  return { changes, note: KIND_NOTE[kind] || "" };
}
