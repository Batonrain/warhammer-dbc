// module/rules/library/aeldari.mjs
//
// Правила Эльдари.

// ── «Аэльдари всегда используют Природу псайкера "Древнее Мастерство"» (wdbc-l07y) ──
// Раньше зашито isAeldariRace() прямо в module/sheets/tabs/psychic.mjs
// (showManifestDialog) — образец правильного пути рядом, hasRuleFlag
// (см. psyker.alwaysBound у Серого Человека). Одна и та же запись добавлена
// в правила каждой из шести рас группы «Аэльдари» (packs-src/races/Аэльдари/
// */group), а не проверяется по имени расы в коде — новая раса той же группы
// просто получает ту же запись в своём RULES-массиве.
const ANCIENT_MASTERY_RULE =
  { id: "aeldari.psyker.ancient-mastery", label: "Аэльдари: Природа психосилы «Древнее Мастерство»",
    effects: [{ kind: "grantFlag", target: "psyker.ancientMastery" }] };

// ── Возможности «доступна своя папка Талантов» ──────────────────────────────
//
// Пять рас ниже раньше отпирали свою папку в пикере Талантов прямым
// сравнением `system.race === "…"` в module/sheets/item-picker.mjs
// (talentGroupLock, wdbc-sauo) — новая раса с той же полкой Талантов требовала
// правки этого файла. `when` пуст по тому же принципу, что у ASTARTES_RULES:
// источник «race» в rules/sources.mjs уже отбирает правило по расе актора,
// дублировать проверку в данных незачем.
//
// Друкхари — единственная запись без подпапок по субрасе: Истиннорождённый/
// Мандрагора/Развалина (system.subrace) не меняют system.race, поэтому одно
// правило на ключ расы «drukhari» покрывает все три (RACE_RULES в sources.mjs
// регистрирует эту же запись под всеми четырьмя историческими ключами расы —
// на случай листов, где раса была записана значением субрасы напрямую).
export const EXODITE_RULES = [
  { id: "exodite.talents", label: "Экзодит: своя папка Талантов",
    effects: [{ kind: "grantFlag", target: "talents.exodite" }] },
  ANCIENT_MASTERY_RULE
];

export const DRUKHARI_RULES = [
  { id: "drukhari.talents", label: "Друкхари: своя папка Талантов",
    effects: [{ kind: "grantFlag", target: "talents.drukhari" }] },
  ANCIENT_MASTERY_RULE
];

export const AZURIANE_RULES = [
  { id: "azuriane.talents", label: "Азуриане: своя папка Талантов",
    effects: [{ kind: "grantFlag", target: "talents.azuriane" }] },
  ANCIENT_MASTERY_RULE
];

export const HARLEQUIN_RULES = [
  { id: "harlequin.talents", label: "Арлекин: своя папка Талантов",
    effects: [{ kind: "grantFlag", target: "talents.harlequin" }] },
  ANCIENT_MASTERY_RULE
];

export const YNNARI_RULES = [
  { id: "ynnari.talents", label: "Иннари: своя папка Талантов",
    effects: [{ kind: "grantFlag", target: "talents.ynnari" }] },
  ANCIENT_MASTERY_RULE
];

// Полуэльдар (halfEldar) — в отличие от пяти рас выше, у него нет своей папки
// Талантов (talentGroupLock его никогда не отпирал отдельно), поэтому раньше
// в RACE_RULES вообще не было записи под этим ключом — Древнее Мастерство
// ему давал только голый isAeldariRace() в psychic.mjs. Без этого массива
// перенос на hasRuleFlag тихо забрал бы Древнее Мастерство у Полуэльдара.
export const HALF_ELDAR_RULES = [ANCIENT_MASTERY_RULE];
