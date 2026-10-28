// test/combat/wound-in-reality.test.mjs
//
// Рана в Реальности (Псайкана, Sahara 3-28, пачка I2): запись галочки «бесплатная» и согласование
// радиуса ауры с Конструктором (syncAuraFlag) — на настоящей записи Таланта из пака. Чистые
// правила — test/rules/wound-in-reality.test.mjs.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { setWoundFree, syncWoundAura, touchesWoundSustain, onWoundRelevantItemChange } from "../../module/combat/wound-in-reality.mjs";
import { WOUND_FREE_FLAG } from "../../module/rules/wound-in-reality.mjs";
import { sustainOffPatch } from "../../module/combat/psychic-sustain.mjs";
import { auraDescriptorsOf } from "../../module/regions/auras.mjs";

const NS = "warhammer-dbc";
const woundDoc = () => packDocById("packs-src/talents/Псайкана", "HlOOH4XLJ1Oilfjn");

function item(type, name, system = {}, flags = {}) {
  const store = JSON.parse(JSON.stringify(flags));
  const it = {
    id: name, type, name, system, uuid: `Item.${name}`, parent: null, _store: store,
    get flags() { return { [NS]: store }; },
    getFlag: (s, k) => store[k],
    setFlag: async (s, k, v) => { store[k] = v; },
    unsetFlag: async (s, k) => { delete store[k]; },
    update: async () => {}
  };
  return it;
}
function psyker(powers, cor = 5) {
  const d = woundDoc();
  const talent = item("talent", d.name, { ...d.system }, d.flags[NS]);
  const a = Object.assign(new Actor(), {
    id: "p1", uuid: "Actor.p1", type: "character", name: "Псайкер",
    items: [talent, ...powers],
    system: { corruptionBonus: cor, characteristics: {}, psyker: { rating: 9 } }
  });
  for (const i of a.items) i.parent = a;
  return { a, talent };
}
const power = (name, cost = 1, flags = {}) => item("psychicPower", name, { isSustained: true, sustainCost: cost }, flags);

beforeEach(resetCaptured);

describe("галочка «бесплатная»", () => {
  it("можно: ставится флаг на силу, радиус ауры пересчитан", async () => {
    const a1 = power("A", 3), f = power("F");
    const { a, talent } = psyker([a1, f]);
    expect(await setWoundFree(a, f, true)).toBe(true);
    expect(f._store[WOUND_FREE_FLAG]).toBe(true);
    expect(talent._store.aura.radius).toBe(10);          // Cor.b 5 × 2
  });
  it("нельзя, пока платного поддержания меньше 3 PR — предупреждение, флага нет", async () => {
    const f = power("F");
    const { a } = psyker([power("A", 2), f]);
    expect(await setWoundFree(a, f, true)).toBe(false);
    expect(f._store[WOUND_FREE_FLAG]).toBeUndefined();
    expect(captured.warnings.at(-1)).toMatch(/3 PR/);
  });
  it("в окне манифестации (сила ещё не поддерживается) можно с assumeSustained", async () => {
    const f = power("F"); f.system.isSustained = false;
    const { a } = psyker([power("A", 3), f]);
    expect(await setWoundFree(a, f, true)).toBe(false);
    expect(await setWoundFree(a, f, true, { assumeSustained: true })).toBe(true);
  });
  it("снятие гасит флаг и радиус ауры падает до нуля", async () => {
    const f = power("F", 1, { [WOUND_FREE_FLAG]: true });
    const { a, talent } = psyker([power("A", 3), f]);
    await syncWoundAura(a);
    expect(talent._store.aura.radius).toBe(10);
    expect(await setWoundFree(a, f, false)).toBe(true);
    expect(f._store[WOUND_FREE_FLAG]).toBeUndefined();
    expect(talent._store.aura.radius).toBe(0);
  });
});

describe("аура Таланта в движке аур", () => {
  it("флаг на Таланте: на всех, включая себя, метка из пака; дескриптор виден движку", async () => {
    const f = power("F", 1, { [WOUND_FREE_FLAG]: true });
    const { a } = psyker([power("A", 3), f]);
    await syncWoundAura(a);
    const [d] = auraDescriptorsOf(a);
    expect(d.radius).toBe(10);
    expect(d.affects).toBe("all");
    expect(d.includesSelf).toBe(true);
    expect(d.grant[0].uuid).toMatch(/\.WoundRealityAura$/);
  });
  it("нет бесплатных сил — радиус 0, движок ауры не видит", async () => {
    const { a } = psyker([power("A", 3), power("F")]);
    await syncWoundAura(a);
    expect(auraDescriptorsOf(a)).toEqual([]);
  });
  it("радиус растёт и падает вместе с Порчей (Cor.b)", async () => {
    const f = power("F", 1, { [WOUND_FREE_FLAG]: true });
    const { a, talent } = psyker([power("A", 3), f], 3);
    await syncWoundAura(a);
    expect(talent._store.aura.radius).toBe(6);
    a.system.corruptionBonus = 7;
    await syncWoundAura(a);
    expect(talent._store.aura.radius).toBe(14);
  });
});

describe("когда пересчитывать радиус", () => {
  it("правка поддержания/цены/флага «бесплатно» — да; прочие правки силы — нет", () => {
    expect(touchesWoundSustain({ system: { isSustained: true } })).toBe(true);
    expect(touchesWoundSustain({ system: { sustainCost: 2 } })).toBe(true);
    expect(touchesWoundSustain({ flags: { [NS]: { [WOUND_FREE_FLAG]: true } } })).toBe(true);
    expect(touchesWoundSustain({ flags: { [NS]: { [`-=${WOUND_FREE_FLAG}`]: null } } })).toBe(true);
    expect(touchesWoundSustain({ "flags.warhammer-dbc.woundFree": true })).toBe(true);
    expect(touchesWoundSustain({ system: { damage: "1d10" } })).toBe(false);
    expect(touchesWoundSustain({ name: "Другое имя" })).toBe(false);
  });
  it("хук правки силы пересчитывает радиус; у актора без Таланта ничего не делает", async () => {
    const f = power("F", 1, { [WOUND_FREE_FLAG]: true });
    const { talent } = psyker([power("A", 3), f]);
    await onWoundRelevantItemChange(f, { system: { isSustained: true } });
    expect(talent._store.aura.radius).toBe(10);
    const bare = Object.assign(new Actor(), { items: [], system: {} });
    const lone = power("L"); lone.parent = bare;
    await expect(onWoundRelevantItemChange(lone, { system: { isSustained: true } })).resolves.toBeUndefined();
  });
});

describe("общий сброс поддержания (sustainOffPatch) — используют галочка и Варп-Замок", () => {
  it("снимает «бесплатно» вместе с поддержанием", () => {
    const f = power("F", 1, { [WOUND_FREE_FLAG]: true });
    const patch = sustainOffPatch(f);
    expect(patch["system.isSustained"]).toBe(false);
    expect(patch[`flags.${NS}.-=${WOUND_FREE_FLAG}`]).toBeNull();
    expect(patch["system.sustainedDegree"]).toBeNull();
    expect(patch["system.sustainedEpr"]).toBeNull();
    expect(patch["system.sustainedTargetUuid"]).toBe("");
  });
  it("без метки лишних ключей нет", () => {
    expect(Object.keys(sustainOffPatch(power("F")))).toHaveLength(4);
  });
});
