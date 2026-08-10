// module/constants/drukhari-armor-fields.mjs
// ════════════════════════════════════════════════════════════════════════
//  Режимы встроенных защитных полей друкхарийской брони.
//
//  Психокостяной Тканый Костюм и Призрачная Броня несут генераторы поля с
//  четырьмя режимами. Два доступны всегда, два открываются качеством брони:
//  Амортизирующее — от Good.Q, Подавляющее — от Best.Q. Одновременно активен
//  ровно ОДИН режим; друкхари с Tech-Use (Друкхари)+10 может заранее
//  запрограммировать условия переключения.
//
//  Экспортирует: ARMOR_FIELD_SUITS, fieldSuitFor(), availableFieldModes(),
//  activeFieldMode(), fieldModeEffects().
// ════════════════════════════════════════════════════════════════════════

import { normQuality } from "./quality.mjs";

const Q_ORDER = ["poor", "common", "good", "best", "artisan"];
const qAtLeast = (q, min) => Q_ORDER.indexOf(normQuality(q)) >= Q_ORDER.indexOf(min);

// ─────────────────────────── Психокостяной Тканый Костюм ────────────────────
const WRAITH_MODES = [
  { key: "protective", label: "Защитное поле", need: "common",
    shield: { ratingMin: 1, ratingMax: 25, overload: 5 },
    text: "Чёрный нимб окружает аэльдари: щит-купол 1–25/5. При перегрузке режим недоступен минуту." },
  { key: "dispersal", label: "Рассеивающее поле", need: "common",
    nimble: 20,
    text: "В радиусе 2 м непросматриваемый чёрный дым. Носителю в работающем шлеме поле не мешает. Избирательные и Прицельные атаки на расстоянии по нему невозможны. Трейт Nimble растёт до 20." },
  { key: "damping", label: "Амортизирующее поле", need: "good",
    text: "Блестящее покрытие: носитель получает особенность Flak как у ксенопластикового доспеха Best.Q. Не может Загореться или Окислиться, кроме как от магии." },
  { key: "suppressing", label: "Подавляющее поле", need: "best",
    blunted: 0, psyMod: -10,
    text: "Носитель блёкнет в потустороннем свете: трейт Blunted (0), вражеские психотесты против него получают −10." }
];

// ─────────────────────────────── Призрачная Броня ───────────────────────────
// Тот же набор режимов, но каждый заметно сильнее.
const GHOST_MODES = [
  { key: "protective", label: "Защитное поле", need: "common",
    shield: { ratingMin: 1, ratingMax: 35, overload: 1 },
    text: "Чёрный нимб: щит-купол 1–35/1. При перегрузке режим недоступен минуту и вызывает попадание Blinding (2) по всем, кто смотрит на персонажа. Подключённый к броне друкхари может перегрузить поле осознанно, вызвав Ослепление." },
  { key: "dispersal", label: "Рассеивающее поле", need: "common",
    nimble: 30,
    text: "В радиусе 2 м непросматриваемый чёрный дым. Избирательные и Прицельные атаки на расстоянии невозможны, избирательные в упор тоже. Трейт Nimble растёт до 30." },
  { key: "damping", label: "Амортизирующее поле", need: "good",
    protective: 4,
    text: "Flak как у ксенопластикового доспеха Best.Q и Protective (4). Не может Загореться или Окислиться, кроме как от магии; при активации перестаёт Гореть и снимает эффекты на броне." },
  { key: "suppressing", label: "Подавляющее поле", need: "best",
    blunted: 1, psyMod: -20,
    text: "Носитель блёкнет в потустороннем свете: черта Blunted (1), вражеские психотесты против него получают −20." }
];

/** Брони с генератором поля: имя (по вхождению) → набор режимов. */
export const ARMOR_FIELD_SUITS = [
  { match: /Психокостяной Тканый|Wraithbone Woven/i, key: "wraith", label: "Психокостяной Тканый Костюм", modes: WRAITH_MODES },
  { match: /Призрачная Броня|Ghostplate/i,           key: "ghost",  label: "Призрачная Броня",            modes: GHOST_MODES }
];

/** Какой набор режимов у этой брони (или null). */
export function fieldSuitFor(item) {
  const name = String(item?.name || "");
  return ARMOR_FIELD_SUITS.find(s => s.match.test(name)) || null;
}

/**
 * Режимы, доступные при текущем качестве брони. Амортизирующее требует Good.Q,
 * Подавляющее — Best.Q; недоступные возвращаются с locked: true, чтобы игрок
 * видел, что он теряет на низком качестве.
 */
export function availableFieldModes(item) {
  const suit = fieldSuitFor(item);
  if (!suit) return [];
  const q = normQuality(item?.system?.quality);
  const active = item?.system?.fieldMode || "";
  return suit.modes.map(m => ({
    ...m,
    locked: !qAtLeast(q, m.need),
    active: m.key === active
  }));
}

/** Активный режим — только если он реально доступен по качеству. */
export function activeFieldMode(item) {
  return availableFieldModes(item).find(m => m.active && !m.locked) || null;
}

/**
 * Машинные эффекты активного режима: щит, Nimble, Blunted, штраф чужим
 * психотестам, Protective. Пустой объект, если режим не активен.
 */
export function fieldModeEffects(item) {
  const m = activeFieldMode(item);
  if (!m) return {};
  const fx = {};
  if (m.shield)     fx.shield     = { ...m.shield };
  if (m.nimble)     fx.nimble     = m.nimble;
  if (m.blunted != null) fx.blunted = m.blunted;
  if (m.psyMod)     fx.psyMod     = m.psyMod;
  if (m.protective) fx.protective = m.protective;
  return fx;
}
