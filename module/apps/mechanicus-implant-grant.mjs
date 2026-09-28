// module/apps/mechanicus-implant-grant.mjs
// ════════════════════════════════════════════════════════════════════════════
//  «Стартовый Трейт: Mechanicum Implants» (Еретех; тот же комплект получает
//  Технодесантник) — ЧТО именно кладётся актору. Общая часть двух выдач:
//  Мастера создания (apps/creation.mjs::grantMechanicusImplants) и селектора
//  Архетипа (apps/archetypes.mjs::grantArchetypeImplants) — там по-прежнему
//  свои обёртки (циклический импорт creation ↔ archetypes), а данные одни.
//
//  Раньше обе выдавали копии КОНСТАНТ (constants/implants.mjs): без Механики
//  (модификаторы по Качеству), без energyMax и НЕ установленными — Катушка
//  Потенции не давала ни одного заряда, пока игрок сам не «вживлял» каждый
//  имплант Хирургеоном. Теперь источник — документ компендиума имплантов
//  (packs-src/implants/Адептус_Механикус/Импланты_Механикус), константы —
//  только запас на случай, когда компендиум недоступен; оба держит в согласии
//  test/data/mechanicum-implants-vs-book.test.mjs. Выданное сразу
//  установлено: это Стартовый Трейт, импланты уже в теле [допущение].
// ════════════════════════════════════════════════════════════════════════════

import { MECHANICUS_IMPLANTS } from "../constants/implants.mjs";

const IMPLANTS_PACK = "warhammer-dbc.implants";

/**
 * Прежние имена того же импланта: уже выданные копии живут на акторах под
 * ними, и повторная выдача (смена Архетипа туда-обратно) не должна их
 * задваивать. «Electro-Graft / Электро-Имплантат» → книжное «Electro-Grafts /
 * Электро-Графты» (сверка 28.09.2026).
 */
export const LEGACY_IMPLANT_NAMES = {
  "Electro-Grafts / Электро-Графты": ["Electro-Graft / Электро-Имплантат"]
};

/** Базовые импланты, которых у актора ещё нет (по имени и прежним именам). */
export function missingMechanicusImplants(existingNames) {
  const have = new Set(existingNames);
  return MECHANICUS_IMPLANTS.filter(c =>
    ![c.name, ...(LEGACY_IMPLANT_NAMES[c.name] ?? [])].some(n => have.has(n)));
}

/**
 * Данные для createEmbeddedDocuments: недостающие импланты комплекта —
 * из компендиума, если он есть, иначе из констант; все установлены.
 * @param {Iterable<string>} existingNames имена имплантов, уже стоящих у актора
 */
export async function mechanicusImplantData(existingNames) {
  const missing = missingMechanicusImplants(existingNames);
  if (!missing.length) return [];
  let docs = [];
  try {
    const pack = game.packs?.get(IMPLANTS_PACK);
    docs = pack ? await pack.getDocuments() : [];
  } catch (err) {
    console.warn("Warhammer DBC | Импланты Механикум: компендиум имплантов недоступен, выдаю из констант", err);
  }
  return missing.map(c => {
    const doc = docs.find(d => d.name === c.name);
    const obj = doc ? doc.toObject() : foundry.utils.deepClone(c);
    delete obj._id;
    obj.flags = { ...(obj.flags ?? {}), "warhammer-dbc": { ...(obj.flags?.["warhammer-dbc"] ?? {}), installed: true } };
    return obj;
  });
}
