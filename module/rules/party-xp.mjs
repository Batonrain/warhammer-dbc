// module/rules/party-xp.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ОПЫТ НОВИЧКА (сверка «Опыт», стр. 23).
//
//  «При вводе нового персонажа в текущую игру, он получает столько опыта,
//  сколько есть у наименее опытного из текущих персонажей.»
//
//  «Текущие персонажи» — персонажи игроков, а не NPC ГМа: у тех опыт — просто
//  число в карточке, и брать по ним планку значило бы занизить её. Выбор
//  актёров делает вызывающий (у него есть game.actors); здесь только арифметика.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Наименее опытный из списка.
 * @param {{id:string,name:string,total:number}[]} entries
 * @param {string} [exceptId] сам новичок — себя планкой не считаем
 * @returns {{id:string,name:string,xp:number}|null} null — сравнивать не с кем
 */
export function leastExperienced(entries = [], exceptId = "") {
  let best = null;
  for (const e of entries) {
    if (!e || e.id === exceptId) continue;
    const xp = Number(e.total) || 0;
    if (!best || xp < best.xp) best = { id: e.id, name: e.name, xp };
  }
  return best;
}
