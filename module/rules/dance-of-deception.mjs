// module/rules/dance-of-deception.mjs
// ════════════════════════════════════════════════════════════════════════
//  Dance of Deception / Танец Обмана (Слаанеш, wdbc-1rno, d100 88…91):
//  «Персонаж может проводить Финт, используя Acrobatics(A)+0 или Trade
//  (Dancer)(A)+20 вместо WS+0. Он также может потратить Очко Бесчестия,
//  чтобы провести Финт как свободное действие.»
//
//  «Trade(Dancer)» — не выдумка книги, а существующая каталожная
//  специализация (constants/skill-specializations.mjs:
//  S("dancer","Dancer","Танцор",{char:"ag"})) — если у персонажа она
//  заведена, entry.char/entry.total уже посчитаны верно
//  (rules/character.mjs, групповые Навыки) — эта функция читает готовое,
//  не пересчитывает заново.
//
//  «Свободное действие» — проверено (12.09.2026): Состязания (combat/
//  techniques.mjs) не списывают ОД программно ни для одной из четырёх
//  техник, это решение стола на все времена. Механизируема только ЦЕНА —
//  Очко Бесчестия списывается по галочке (apps/infamy-points.mjs::
//  spendFromInfamyPool, тот же путь, что и обычная трата Бесчестия).
// ════════════════════════════════════════════════════════════════════════

export const DANCE_OF_DECEPTION_CAPABILITY = "gift.slaanesh.danceOfDeception";

/**
 * Альтернативные варианты Финта — только те Навыки, которыми персонаж
 * реально владеет: Acrobatics есть в схеме у всех (пусть с −20 неопытности),
 * Trade (Танцор) — только если специализация заведена (specKey:"dancer").
 * @returns {{key:string, label:string, value:number, skillKey:string, charKey:string}[]}
 */
export function danceOfDeceptionFeintOptions(actor) {
  const out = [];
  const acro = Number(actor?.system?.skills?.acrobatics?.total) || 0;
  out.push({ key: "dance:acrobatics", label: "Acrobatics(A)+0", value: acro, skillKey: "acrobatics", charKey: "ag" });

  const tradeEntries = actor?.system?.groupSkills?.trade ?? [];
  tradeEntries.forEach((entry, i) => {
    if (entry?.specKey !== "dancer") return;
    const value = (Number(entry.total) || 0) + 20;
    out.push({ key: `dance:trade:${i}`, label: "Trade (Танцор)+20", value, skillKey: "trade", charKey: "ag" });
  });
  return out;
}
