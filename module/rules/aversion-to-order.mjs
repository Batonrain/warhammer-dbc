// module/rules/aversion-to-order.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Aversion to Order / Отвращение к Порядку (Зверолюд): «Бионика и
//  кибернетика, будучи воплощениями Порядка, отвергаются мутировавшим телом
//  Зверолюда – установка каждой бионики или кибернетики уменьшает его запас
//  Ран на 2 и Т на 5».
//
//  Живой расчёт, а не разовая правка при установке: снял имплант — штраф
//  ушёл сам (rules/character.mjs, пересчёт листа). Бионика и кибернетика —
//  категории имплантов бионики, кибернетики, псибернетики и Механикус;
//  органы Астартес и биоимпланты Друкхари — плоть, а не Порядок.
//
//  Чистый модуль, без Foundry.
// ════════════════════════════════════════════════════════════════════════════

/** Возможность; выдаёт Механика Черты Aversion to Order. */
export const REJECTS_BIONICS_FLAG = "implants.rejectOrder";

/** Штраф за один отвергнутый имплант. */
export const REJECT_WOUNDS = 2;
export const REJECT_T = 5;

const ORDER_CATEGORIES = new Set([
  "bionic", "bionic-arm", "bionic-leg", "cybernetic", "psybernetic",
  "mechanicus", "mechEnergy", "mechFocus", "mechOther", "mechadendrite", "skitarii"
]);

/** Установлен ли имплант (флаг installed — тот же, что у isItemActive). */
const installed = i => !!(i?.getFlag?.("warhammer-dbc", "installed") ?? i?.flags?.["warhammer-dbc"]?.installed);

/** Сколько бионики/кибернетики установлено на акторе. */
export function orderImplantCount(items) {
  let n = 0;
  for (const i of items ?? []) {
    if (i?.type !== "implant" || !installed(i)) continue;
    if (ORDER_CATEGORIES.has(String(i.system?.category || ""))) n++;
  }
  return n;
}

/** Штраф {wounds, t} (отрицательные числа) за установленную бионику/кибернетику. */
export function bionicsRejection(items, rejects = true) {
  const n = rejects ? orderImplantCount(items) : 0;
  return { count: n, wounds: -REJECT_WOUNDS * n, t: -REJECT_T * n };
}
