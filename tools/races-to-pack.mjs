// tools/races-to-pack.mjs
// ════════════════════════════════════════════════════════════════════════
//  Черты расы из констант → ссылки на библиотеку Черт.
//
//  Расы переехали из констант в packs-src/races разовым генератором (wdbc-n1k,
//  08.2026); с тех пор пак правится руками и с константами разошёлся, а сам
//  генератор удалён (правило разовых скриптов, wdbc-4umq) — его --write завёл
//  бы рядом с живыми документами копии с теми же _id. Здесь осталось только
//  сопоставление, которым test/tools/race-numbers.test.mjs сверяет числа
//  констант RACES (их ещё читает apps/races.mjs) с библиотекой Черт.
// ════════════════════════════════════════════════════════════════════════

import { libraryTrait } from "./race-traits.mjs";

/**
 * Черты расы или субрасы → записи «Черта» со ссылкой на документ библиотеки.
 *
 * Ссылка идёт по UUID, а НЕ по имени: `resolveMechSource`
 * (module/apps/mechanics.mjs) сравнивает имена без отбрасывания скобок, и
 * «Unnatural Strength (4)» не совпало бы с шаблоном «… (X)».
 */
export function traitEntries(def) {
  return (def?.traits || []).map(t => {
    const doc = libraryTrait(t.name);
    // Пары нет — падение, а не тихо пустая ссылка с обнулённым бонусом.
    if (!doc) throw new Error(`Расовая Черта без пары в библиотеке Черт: «${t.name}» (${def.label})`);
    return {
      kind: "trait",
      sourceUuid: `Compendium.warhammer-dbc.traits.Item.${doc._id}`,
      sourceName: doc.name,
      sourceHasRating: !!(doc.system?.hasRating || t.hasRating),
      rating: t.hasRating ? (t.rating ?? 0) : ""
    };
  });
}
