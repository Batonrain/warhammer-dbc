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
