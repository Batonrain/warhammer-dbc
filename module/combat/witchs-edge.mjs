// module/combat/witchs-edge.mjs
// ─────────────────────────────────────────────────────────────────────────────
//  КОЛДОВСКОЕ ЛЕЗВИЕ / WITCH'S EDGE (стр. 74 Книги Аэльдари): перед боем
//  владелец выбирает бонус — свойства Force (если оно у оружия есть) либо
//  набор Dueling Weapon, Reinforced, Power Field, Precise, Mighty. Независимо
//  от выбора оружие всегда считается имеющим Force в расчёте прочих механик
//  (Выжигание Души и т.п.) — поэтому {key:"force"} добавляется безусловно, а
//  выбор влияет только на бандл из пяти доп. свойств.
//
//  Выбор хранится флагом на ПРЕДМЕТЕ (живёт весь Encounter, спрашивается
//  заново в начале следующего) — тем же местом, что читает aggregateAuto
//  через resolveWeaponPropsList, поэтому внедряется как доп. записи entries
//  ДО резолва, а не как отдельный auto на самом witchsEdge.
// ─────────────────────────────────────────────────────────────────────────────

import { resolveWeaponPropsList } from "./weapon-properties.mjs";

export const WITCHS_EDGE_FLAG_SCOPE = "warhammer-dbc";
export const WITCHS_EDGE_FLAG_KEY   = "witchsEdgeChoice";

/** Есть ли на оружии свойство Witch's Edge. */
export function hasWitchsEdge(item) {
  return resolveWeaponPropsList(item?.system?.weaponProps).some(p => p.key === "witchsEdge");
}

/**
 * Доп. записи свойств от выбора Witch's Edge — добавить в entries ДО
 * resolveWeaponPropsList/aggregateAuto. Пустой массив, если оружие не несёт
 * Witch's Edge вовсе.
 */
export function witchsEdgeExtraEntries(item) {
  if (!hasWitchsEdge(item)) return [];
  const choice = item.getFlag?.(WITCHS_EDGE_FLAG_SCOPE, WITCHS_EDGE_FLAG_KEY);
  const entries = [{ key: "force" }];
  if (choice === "bundle") {
    entries.push(
      { key: "duelingWeapon" }, { key: "reinforced" },
      { key: "powerField" },    { key: "precise" }, { key: "mighty" }
    );
  }
  return entries;
}

/** Подмешивает доп. записи Witch's Edge в уже собранный список entries. */
export function withWitchsEdge(item, entries) {
  const extra = witchsEdgeExtraEntries(item);
  return extra.length ? [...entries, ...extra] : entries;
}

/** Диалог выбора на одно оружие — сохраняет флаг на предмете. */
export async function promptWitchsEdgeChoice(actor, item) {
  return new Promise(resolve => {
    new Dialog({
      title: `Колдовское Лезвие — ${item.name} (${actor.name})`,
      content: `<p>Выберите бонус на этот Encounter:</p>`,
      buttons: {
        force: {
          label: "Force (если есть)",
          callback: async () => {
            await item.setFlag(WITCHS_EDGE_FLAG_SCOPE, WITCHS_EDGE_FLAG_KEY, "force");
            resolve("force");
          }
        },
        bundle: {
          label: "Dueling/Reinforced/Power Field/Precise/Mighty",
          callback: async () => {
            await item.setFlag(WITCHS_EDGE_FLAG_SCOPE, WITCHS_EDGE_FLAG_KEY, "bundle");
            resolve("bundle");
          }
        }
      },
      default: "force",
      close: () => resolve(null)
    }).render(true);
  });
}

/** В начале Encounter — спросить выбор у всех, у кого в руках оружие с Witch's Edge. */
export async function processWitchsEdgeCombatStart(combat) {
  if (!game.user?.isGM) return;
  for (const combatant of combat.combatants ?? []) {
    const actor = combatant.actor;
    if (!actor) continue;
    const weapons = (actor.items ?? []).filter(i => i.type === "weapon" && i.system?.equipped && hasWitchsEdge(i));
    for (const item of weapons) await promptWitchsEdgeChoice(actor, item);
  }
}
