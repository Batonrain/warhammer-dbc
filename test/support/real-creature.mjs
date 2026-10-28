// test/support/real-creature.mjs
//
// Существо НАСТОЯЩЕЙ схемы и настоящего пересчёта листа: `new ACTOR_DATA_MODELS[type]({}).toObject()` +
// `WarhammerActor.prototype.prepareDerivedData` на документе. Тест не выдумывает поля (`movement.spd`,
// которого у существа нет, держал пустую дальность Толкания — Sahara spd-0): SPD, Athletics, ОД и
// прочее приходят оттуда, откуда их берёт игра.
//
// Тот же приём, что в test/combat/speed-consumers-multipliers.test.mjs.

import "./foundry-stub.mjs";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

/**
 * @param {object} [o]
 * @param {"character"|"daemon"|"demonPrince"|"minion"} [o.type]
 * @param {number} [o.spd]        SPD = Ag.b (Размер 0, без модификаторов): spd 4 → Ловкость 40
 * @param {number} [o.athletics]  итог Athletics (нетренированный = S − 20 → S = athletics + 20)
 * @param {number} [o.ap]         ОД сейчас
 * @param {object[]} [o.docs]     Черты и прочее: { name, type, system, flags } (JSON из packs-src)
 * @param {(system:object)=>void} [o.mutate]  правка сырых данных ДО пересчёта
 */
export function realCreature({ type = "character", spd = 4, athletics = 40, ap = 2, docs = [], mutate = () => {} } = {}) {
  const system = new ACTOR_DATA_MODELS[type]({}).toObject();
  system.characteristics.ag.base = spd * 10;
  system.characteristics.s.base = athletics + 20;
  system.actionPoints.value = ap;
  mutate(system);
  const items = docs.map((d, i) => ({
    id: `i${i}`, name: d.name, type: d.type, system: d.system, flags: d.flags ?? {}, getFlag: () => undefined
  }));
  items.get = () => null;
  const actor = {
    id: `a-${Math.random()}`, name: "Гвардеец", type, system, items,
    getFlag: () => undefined, update: async () => {}
  };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return actor;
}
