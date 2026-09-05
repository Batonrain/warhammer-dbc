// tools/bench-sheet.mjs
//
// Замер пересчёта листа персонажа (wdbc-uvap). Не тест: числа зависят от
// машины, гейты его не гоняют. Смысл — сравнимая цифра ДО и ПОСЛЕ правки на
// одной и той же машине за один прогон.
//
//   node tools/bench-sheet.mjs [числоПредметов] [числоПовторов]
//
// Актор синтетический, но по форме — как богатый персонаж: Черты/Таланты с
// записями Конструктора (источник правил "items" обходит их все), оружие,
// броня, импланты.

import "../test/support/foundry-stub.mjs";

const { WarhammerActor } = await import("../module/documents/actor.mjs");
const { ACTOR_DATA_MODELS } = await import("../module/data/index.mjs");
const { hasRuleFlag } = await import("../module/rules/flags.mjs");
const { collectRules, gatherRules } = await import("../module/rules/collect.mjs");
const { CAPABILITIES } = await import("../module/constants/capabilities.mjs");

// Имена берутся из реестра: выдуманное имя пишет console.error на каждый
// обход, и замер превратился бы в замер скорости консоли.
const CAP_KEYS = Object.keys(CAPABILITIES);

const ITEMS = Number(process.argv[2] || 120);
const REPEATS = Number(process.argv[3] || 200);

let seq = 0;
const uid = () => `id${++seq}`;

/** Запись Конструктора «Возможность» — самая частая форма в паках. */
const capabilityEntry = (key) => ({
  id: uid(), kind: "capability", capabilityKey: key, capabilityMode: "flag",
  when: "", group: null, label: `Возможность ${key}`
});

/** Запись «Модификатор теста» — вторая по частоте. */
const testModEntry = (n) => ({
  id: uid(), kind: "testMod", modScope: "all", modValueMode: "flat", value: n,
  when: "", group: null, label: `Модификатор ${n}`
});

const mechItem = (i) => ({
  id: uid(), name: `Черта ${i}`, type: i % 3 === 0 ? "talent" : "trait",
  system: { effects: {} },
  getFlag: (ns, k) => (ns === "warhammer-dbc" && k === "mechanics" ? mech : undefined),
  flags: { "warhammer-dbc": { mechanics: (mech = [{
    id: uid(), operator: "AND", entries: [capabilityEntry(CAP_KEYS[i % CAP_KEYS.length]), testModEntry(1)]
  }]) } }
});
let mech;

const weapon = (i) => ({
  id: uid(), name: `Оружие ${i}`, type: "weapon",
  system: { equipped: i < 3, damage: "1d10", props: {}, weight: 3 },
  getFlag: () => undefined, flags: {}
});

const armour = (i) => ({
  id: uid(), name: `Броня ${i}`, type: "armour",
  system: { equipped: true, locations: { body: true }, ap: 4, weight: 5, props: {} },
  getFlag: () => undefined, flags: {}
});

function buildActor(nItems) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  for (const k of Object.keys(system.characteristics ?? {})) system.characteristics[k].base = 35;
  const list = [];
  for (let i = 0; i < nItems; i++) {
    if (i % 10 === 8) list.push(weapon(i));
    else if (i % 10 === 9) list.push(armour(i));
    else list.push(mechItem(i));
  }
  list.get = id => list.find(i => i.id === id) ?? null;
  return { type: "character", name: "Замер", system, items: list,
           getFlag: () => undefined, uuid: "Actor.bench" };
}

function bench(label, fn, repeats) {
  fn(); // прогрев
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < repeats; i++) fn();
  const t1 = process.hrtime.bigint();
  const ms = Number(t1 - t0) / 1e6;
  console.log(`${label.padEnd(46)} ${(ms / repeats).toFixed(3)} мс/раз   (${repeats} раз, ${ms.toFixed(0)} мс всего)`);
  return ms / repeats;
}

const actor = buildActor(ITEMS);
console.log(`Актор: ${ITEMS} предметов (${actor.items.filter(i => i.flags?.["warhammer-dbc"]?.mechanics).length} с Механикой), ${REPEATS} повторов\n`);

bench("gatherRules(actor)  — сбор без отбора", () => gatherRules(actor), REPEATS);
bench("collectRules(actor) — сбор + отбор", () => collectRules(actor), REPEATS);
bench("hasRuleFlag(actor, …) — один вопрос", () => hasRuleFlag(actor, CAP_KEYS[5]), REPEATS);
bench("prepareDerivedData — пересчёт листа", () => {
  WarhammerActor.prototype.prepareDerivedData.call(actor);
}, REPEATS);
