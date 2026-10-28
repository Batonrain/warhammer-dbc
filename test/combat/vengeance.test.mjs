// test/combat/vengeance.test.mjs
//
// Месть / Vengeance (Берсерк, Sahara 3-861e): убив лидера или чемпиона Ненавистного
// врага в рукопашной, носитель восстанавливает 1 Очко Бесчестия (1d5, если враг — лорд
// сравнимого или выше могущества). Метки «лидер/чемпион» и «лорд» ставит ГМ в меню листа.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { registerVengeanceKill } from "../../module/combat/vengeance.mjs";
import {
  vengeanceReward, LEADER_OR_CHAMPION_FLAG, LORD_MIGHT_FLAG
} from "../../module/rules/berserker-talents.mjs";
import { raceTarget } from "../../module/rules/talent-targets.mjs";

const byKey = key => ({
  id: "k-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});
const VENGEANCE = "berserker.core.vengeance";
const hatred = targets => ({ type: "talent", name: "Hatred / Ненависть", system: { targets } });

function killer({ fate = 1, max = 5, vengeance = true, hates = [raceTarget("ork", "Орк")] } = {}) {
  const items = [hatred(hates)];
  if (vengeance) items.push(byKey(VENGEANCE));
  const a = {
    name: "Берсерк", uuid: "Actor.killer", type: "character", items,
    system: { fate: { value: fate, max }, characteristics: { inf: { total: 40, bonus: 4 } }, alignment: "heretic" },
    getFlag: () => undefined,
    updates: [],
    async update(data) { this.updates.push(data); for (const [p, v] of Object.entries(data)) { const k = p.split("."); let c = this; for (const x of k.slice(0, -1)) c = c[x]; c[k.at(-1)] = v; } }
  };
  a.items.get = () => null;
  return a;
}
function victim(flags = {}, race = "ork") {
  return { name: "Вождь", uuid: "Actor.boss", system: { race }, getFlag: (s, k) => flags[k] };
}
const sword = owner => ({ name: "Топор", actor: owner, parent: owner, system: { weaponClass: "melee" } });

beforeEach(() => { resetCaptured(); captured.dice = [3]; });

describe("Месть: когда она действует", () => {
  it("лидер/чемпион Ненавистной расы убит рукопашным оружием — 1 Очко", async () => {
    const k = killer();
    const res = await registerVengeanceKill(victim({ [LEADER_OR_CHAMPION_FLAG]: true }), sword(k));
    expect(res.after).toBe(2);
    expect(captured.chat.at(-1).content).toContain("Месть");
  });

  it("лорд сравнимого или выше могущества — 1d5 (здесь выпало 3)", async () => {
    const k = killer({ fate: 0, max: 5 });
    const res = await registerVengeanceKill(victim({ [LEADER_OR_CHAMPION_FLAG]: true, [LORD_MIGHT_FLAG]: true }), sword(k));
    expect(res.after).toBe(3);
  });

  it("не выходит за максимум пула Очков", async () => {
    const k = killer({ fate: 4, max: 4 });
    const res = await registerVengeanceKill(victim({ [LEADER_OR_CHAMPION_FLAG]: true, [LORD_MIGHT_FLAG]: true }), sword(k));
    expect(res.after).toBe(res.max);
  });

  it("рядовой враг (метки нет) — ничего", async () => {
    const k = killer();
    expect(await registerVengeanceKill(victim({}), sword(k))).toBeNull();
    expect(k.system.fate.value).toBe(1);
  });

  it("не Ненавистный враг — ничего", async () => {
    const k = killer({ hates: [raceTarget("eldar", "Эльдар")] });
    expect(await registerVengeanceKill(victim({ [LEADER_OR_CHAMPION_FLAG]: true }), sword(k))).toBeNull();
  });

  it("стрелковое оружие — ничего (книга: в рукопашной)", async () => {
    const k = killer();
    const gun = { ...sword(k), system: { weaponClass: "basic" } };
    expect(await registerVengeanceKill(victim({ [LEADER_OR_CHAMPION_FLAG]: true }), gun)).toBeNull();
  });

  it("без Таланта Мести — ничего", async () => {
    const k = killer({ vengeance: false });
    expect(await registerVengeanceKill(victim({ [LEADER_OR_CHAMPION_FLAG]: true }), sword(k))).toBeNull();
  });
});

describe("vengeanceReward: чистое условие", () => {
  const k = killer();
  it("формула зависит от метки лорда", () => {
    expect(vengeanceReward(k, victim({ [LEADER_OR_CHAMPION_FLAG]: true }), { melee: true, hated: true })).toEqual({ formula: "1" });
    expect(vengeanceReward(k, victim({ [LORD_MIGHT_FLAG]: true }), { melee: true, hated: true })).toEqual({ formula: "1d5" });
  });
  it("нужны рукопашная, Ненависть и метка", () => {
    const v = victim({ [LEADER_OR_CHAMPION_FLAG]: true });
    expect(vengeanceReward(k, v, { melee: false, hated: true })).toBeNull();
    expect(vengeanceReward(k, v, { melee: true, hated: false })).toBeNull();
    expect(vengeanceReward(k, victim({}), { melee: true, hated: true })).toBeNull();
  });
});
