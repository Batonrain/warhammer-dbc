// module/rules/disease-infection.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ТЕСТ ЗАРАЖЕНИЯ БОЛЕЗНЬЮ (wdbc-dbveg) — чистая часть.
//
//  Единого «теста заражения» книга не даёт (core стр. 470 — на откуп ГМу), но в
//  тексте самих болезней лежат конкретные пути передачи с Порогом T±N («Кожа-к-
//  коже: Т+20; контакт жидкостей: Т−10»). Они вынесены в структурное поле
//  system.vectorTests [{label, char, mod}] (data/item/disease.mjs), а здесь —
//  его чтение и Порог. Болезни «на усмотрение МИ» и с авто-заражением
//  (Вирус Облитератора, Мемовирус) полей не несут — их заражение остаётся ГМу.
//
//  Бросок, карточка и включение болезни — module/combat/disease-infection.mjs.
//  Метка Нургла «не заражается» — иммунитет из rules/disease-immunity.mjs.
//
//  Файл читает только чистые модули (disease-immunity.mjs): его нет в графе
//  sources.mjs и он не должен туда попадать (source-registry-acyclic).
// ════════════════════════════════════════════════════════════════════════════

import { actorImmuneToDiseaseEffects } from "./disease-immunity.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";

const CHAR_LABELS = { t: "T", wp: "W", s: "S", ag: "Ag", int: "I", per: "P", fel: "F", inf: "Inf", ws: "WS", bs: "BS" };

/**
 * Векторы болезни — чистый список {label, char, mod}. Мусор отбрасывается:
 * пустая строка-запись, нечисловой модификатор — 0, нет подписи — «Заражение».
 * @param {object} item  предмет типа disease
 */
export function diseaseVectors(item) {
  const list = item?.system?.vectorTests;
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const v of list) {
    if (!v || typeof v !== "object") continue;
    const mod = Math.round(Number(v.mod));
    out.push({
      label: String(v.label ?? "").trim() || "Заражение",
      char: String(v.char ?? "").trim().toLowerCase() || "t",
      mod: Number.isFinite(mod) ? mod : 0
    });
  }
  return out;
}

/** «Кожа-к-коже T+20» — подпись вектора для кнопки и карточки. */
export function vectorLabel(v) {
  const sign = v.mod < 0 ? "−" : "+";
  return `${v.label} ${CHAR_LABELS[v.char] ?? v.char.toUpperCase()}${sign}${Math.abs(v.mod)}`;
}

/**
 * Порог теста заражения без модификаторов реестра правил (их добавляет бросок).
 * @returns {{base:number, mod:number, charLabel:string, threshold:number}}
 */
export function infectionPlan(actor, vector) {
  const base = Number(actor?.system?.characteristics?.[vector.char]?.total) || 0;
  return {
    base, mod: vector.mod, charLabel: CHAR_LABELS[vector.char] ?? vector.char.toUpperCase(),
    threshold: base + vector.mod
  };
}

// ── Последствия заражения (Sahara task-3ab7) ───────────────────────────────

/**
 * Виды последствий (system.infectionEffects):
 *  • charDamage       — «немедленно получает 2d10 урона в А» (Хворь Слабости):
 *                       при заражении бросается формула и ложится в Характеристику;
 *  • autoSuccessPoint — «Очки Бесчестия или Судьбы — автоматически проходить этот
 *                       тест после Провала» (Ходячая Оспа): после провала игроку
 *                       предлагают потратить Очко, и тест засчитывается.
 */
export const EFFECT_KINDS = {
  charDamage: "Урон в Характеристику при заражении",
  autoSuccessPoint: "Очко Бесчестия/Судьбы: авто-успех после провала"
};

const FORMULA_RE = /^\s*\d*d\d+(\s*[+\-]\s*\d+)?\s*$|^\s*\d+\s*$/i;

/**
 * Последствия болезни — чистый список {kind, label, char, formula}. Отбрасывается
 * то, что нечем исполнить: неизвестный вид, урон без известной Характеристики или
 * с неразбираемой формулой (кубы вроде «2d10», «1d5+2» или число).
 * @param {object} item  предмет типа disease
 */
export function infectionEffects(item) {
  const list = item?.system?.infectionEffects;
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const e of list) {
    if (!e || typeof e !== "object" || !Object.hasOwn(EFFECT_KINDS, e.kind)) continue;
    const label = String(e.label ?? "").trim() || EFFECT_KINDS[e.kind];
    if (e.kind === "charDamage") {
      const char = String(e.char ?? "").trim().toLowerCase();
      const formula = String(e.formula ?? "").trim();
      if (!Object.hasOwn(CHARACTERISTICS, char) || !FORMULA_RE.test(formula)) continue;
      out.push({ kind: e.kind, label, char, formula });
    } else {
      out.push({ kind: e.kind, label, char: "", formula: "" });
    }
  }
  return out;
}

/** Урон в Характеристики, который болезнь наносит при заражении. */
export const infectionDamage = item => infectionEffects(item).filter(e => e.kind === "charDamage");

/** Можно ли после провала теста заражения потратить Очко и пройти его автоматически. */
export const hasAutoSuccess = item => infectionEffects(item).some(e => e.kind === "autoSuccessPoint");

// ── Правка строк на листе болезни (vectorTests, infectionEffects) ───────────

/** Заготовка нового пути передачи: «Стойкость +0», подпись впишет автор болезни. */
export const BLANK_VECTOR = Object.freeze({ label: "", char: "t", mod: 0 });
/** Заготовка нового последствия: урон в Ловкость, формулу впишет автор. */
export const BLANK_EFFECT = Object.freeze({ kind: "charDamage", label: "", char: "ag", formula: "1d5" });

const copyRows = list => (Array.isArray(list) ? list : []).map(r => (r && typeof r === "object" ? { ...r } : r));

/** Добавить строку: исходный массив не меняется, заготовка копируется. */
export const rowsAdd = (list, blank) => [...copyRows(list), { ...blank }];

/** Убрать строку по индексу; чужой индекс — список без изменений. */
export const rowsRemove = (list, index) => copyRows(list).filter((_, i) => i !== index);

/**
 * Изменить одно поле строки. Числовые поля (`numeric`) приводятся к целому,
 * нечисло — 0; текст остаётся как введён (подчистит читатель). Чужой индекс —
 * список без изменений.
 */
export function rowsPatch(list, index, field, raw, numeric = []) {
  const out = copyRows(list);
  if (!out[index]) return out;
  out[index][field] = numeric.includes(field) ? (parseInt(raw, 10) || 0) : raw;
  return out;
}

/**
 * Что останавливает заражение: любой действующий источник иммунитета к
 * болезням (defence.diseaseEffectsImmune) — Метка Нургла или принятый Струп.
 * Возвращает текст причины или null — заражаться можно. isActive — активность
 * носителя возможности (apps/effects.mjs::isItemActive): подавленная мутация не защищает.
 */
export function infectionBlockedBy(actor, isActive) {
  return actorImmuneToDiseaseEffects(actor, isActive)
    ? "Иммунитет к болезням (Метка Нургла, Струп): носитель не заражается"
    : null;
}
