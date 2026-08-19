// module/constants/weapon-categories.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Категории оружия для группы Талантов «Арсенал» (стр. 62): Melee Training
//  (рукопашное — по «форме» оружия: меч/топор/булава…) и Weapon Training
//  (дальнобойное+цепное+силовое — по «принципу действия»). Раньше нигде не
//  существовали как структурированные данные — только текст в описании
//  Талантов (module/constants/talents-library.mjs, группа "Арсенал").
// ════════════════════════════════════════════════════════════════════════════

// Все категории, встречающиеся в списках «Оружие:» у Приёмов рукопашного боя
// (стр. 14: Взмах/Выпад/Пила/Оглушить/Повалить/Захват) — источник истины для
// module/constants/combat.mjs, MELEE_MANEUVERS[*].categories.
export const MELEE_CATEGORIES = [
  "Глефа", "Кистень", "Кнут", "Копьё", "Меч", "Молот", "Нож", "Посох",
  "Топор", "Штык", "Булава", "Когти", "Кулаки", "Щит", "Крюк", "Укус"
];

// «Булавы, Когти, Крюки, Кулаки и Щиты не нуждаются в этом Таланте» — точная
// цитата Melee Training. Укус (только в приёме «Захват», естественная атака
// без предмета) книгой не оговорён явно, но по духу — туда же: он не «оружие»
// в смысле экипировки, тренировать нечего.
export const MELEE_TRAINING_EXEMPT = ["Булава", "Когти", "Кулаки", "Щит", "Крюк", "Укус"];

// Специализации Weapon Training (стр. 62), дословно из talents-library.mjs.
export const RANGED_TRAINING_CATEGORIES = [
  "Bolt", "Bow", "Chain", "Flame", "Grav", "Las", "Launcher",
  "Melta", "Plasma", "Power", "Primary", "Shock", "Solid Projectile"
];

// system.weaponType → категория Weapon Training. Grav получил СОБСТВЕННЫЙ
// weaponType:"grav" (19.08.2026: 18 предметов в packs-src/weapons вынесены
// из общей корзины exotic; один — Гравитационный Клинок, Азуриане — намеренно
// оставлен weaponType:"power", это по сути силовой меч с косметическим
// grav-свойством, не настоящее гравитонное оружие). Primary = Primitive:
// лук/арбалет/праща (weaponClass не melee) — весь этот пул уже лежит под
// weaponType:"lowtech" (см. Bow ниже — своего отдельного значения не имеет,
// это подмножество Primary, не отдельная проверяемая категория). ВАЖНО: у
// weaponType:"lowtech" есть ещё и РУКОПАШНЫЕ предметы (шаблоны Меч/Топор/
// Булава и т.п.) — те проверяются Melee Training по форме, а не Weapon
// Training по принципу действия; weaponTrainingPenalty() в
// module/rules/weapon-training.mjs поэтому пропускает категорию Primary для
// weaponClass:"melee" отдельным условием.
export const WEAPON_TYPE_TO_TRAINING = {
  bolt: "Bolt", chain: "Chain", flame: "Flame", launcher: "Launcher",
  melta: "Melta", plasma: "Plasma", power: "Power", shock: "Shock",
  laser: "Las", solid: "Solid Projectile", lowtech: "Primary", grav: "Grav"
};

// Bow — подмножество Primary (лук/арбалет/праща и т.п.), а не отдельно
// проверяемая категория: в данных нет способа отличить лук от любого другого
// примитивного дальнобойного оружия (оба — weaponType:"lowtech"). Специально
// купленный «Weapon Training (Bow)» засчитывается как владение Primary.
const CATEGORY_ALIASES = { bow: "primary" };

const norm = s => String(s || "").trim().toLowerCase();

/** Нормализованное сравнение категорий/специализаций — регистр, пробелы и алиасы (Bow↔Primary) не важны. */
export function sameCategory(a, b) {
  if (!a || !b) return false;
  const na = CATEGORY_ALIASES[norm(a)] || norm(a);
  const nb = CATEGORY_ALIASES[norm(b)] || norm(b);
  return na === nb;
}

// Таланты со специализацией из ФИКСИРОВАННОГО списка (по образцу
// DYNAMIC_APT_TALENTS, module/constants/advancement.mjs) — их покупка через
// Пикер (module/sheets/item-picker.mjs) открывает диалог выбора ОДНОЙ
// категории вместо копирования всей строки шаблона в system.specialization.
// Exotic Weapon Training сюда НЕ входит: по книге специализация там — имя
// КОНКРЕТНОГО экзотического предмета, а не категория из перечня, фиксированный
// список для неё не подходит — остаётся свободным текстом, как раньше.
const ARSENAL_SPEC_TALENTS = {
  "melee training": "melee", "рукопашная тренировка": "melee",
  "weapon training": "ranged", "оружейная тренировка": "ranged"
};

/** "melee" | "ranged" | null — какой список специализаций предложить при покупке. */
export function arsenalSpecKind(talentName) {
  for (const part of String(talentName || "").split("/")) {
    const k = ARSENAL_SPEC_TALENTS[norm(part)];
    if (k) return k;
  }
  return null;
}

/** Варианты специализации для диалога-пикера, по виду ("melee"/"ranged"). */
export function arsenalSpecOptions(kind) {
  if (kind === "melee") return MELEE_CATEGORIES.filter(c => !MELEE_TRAINING_EXEMPT.includes(c));
  if (kind === "ranged") return RANGED_TRAINING_CATEGORIES;
  return [];
}
