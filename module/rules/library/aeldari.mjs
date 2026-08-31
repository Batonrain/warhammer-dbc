// module/rules/library/aeldari.mjs
//
// Правила Эльдари. Заполняется после этапа 3 плана по образцу Астартес.

export const AELDARI_RULES = [];

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
    effects: [{ kind: "grantFlag", target: "talents.exodite" }] }
];

export const DRUKHARI_RULES = [
  { id: "drukhari.talents", label: "Друкхари: своя папка Талантов",
    effects: [{ kind: "grantFlag", target: "talents.drukhari" }] }
];

export const AZURIANE_RULES = [
  { id: "azuriane.talents", label: "Азуриане: своя папка Талантов",
    effects: [{ kind: "grantFlag", target: "talents.azuriane" }] }
];

export const HARLEQUIN_RULES = [
  { id: "harlequin.talents", label: "Арлекин: своя папка Талантов",
    effects: [{ kind: "grantFlag", target: "talents.harlequin" }] }
];

export const YNNARI_RULES = [
  { id: "ynnari.talents", label: "Иннари: своя папка Талантов",
    effects: [{ kind: "grantFlag", target: "talents.ynnari" }] }
];
