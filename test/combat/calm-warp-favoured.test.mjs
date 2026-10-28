// test/combat/calm-warp-favoured.test.mjs
//
// Любимец Варпа / Favoured by the Warp (Псайкана, Sahara 3-28, решение
// владельца 25.10.2026): «Персонаж бросает два кубика на Феномены (но не
// Прорывы) и может выбрать любой из них» — и при Усмирении Варпа, когда
// Феномен перебрасывается. Выше на таблице хуже (Прорыв в конце), поэтому взят
// меньший бросок, как и в самой манифестации (sheets/tabs/psychic.mjs).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { handleCalmWarpClick } from "../../module/combat/calm-warp.mjs";

foundry.utils.getProperty = (o, p) => String(p).split(".").reduce((x, k) => x?.[k], o);

const talent = name => ({ id: name, type: "talent", name, system: {}, flags: {}, getFlag: () => undefined });

function makeActor(items = [], fate = 2) {
  const a = Object.assign(new Actor(), {
    id: "a1", name: "Псайкер", uuid: "Actor.a1", type: "character", isOwner: true, items,
    system: { fate: { value: fate, max: 3 }, corruption: { value: 30 }, alignment: "" },
    updates: [],
    getFlag: () => undefined, setFlag: async () => {}, unsetFlag: async () => {},
    update: async d => { a.updates.push(d); if ("system.fate.value" in d) a.system.fate.value = d["system.fate.value"]; }
  });
  return a;
}

const click = async (actor, table = "phenomenon") => {
  globalThis.fromUuid = async () => actor;
  const message = { isOwner: true, getFlag: () => undefined, setFlag: async () => {} };
  const btn = { dataset: { actorUuid: actor.uuid, table, phenMod: "0" }, disabled: false };
  await handleCalmWarpClick(message, btn);
};
const chatText = () => captured.chat.map(m => String(m.content ?? "")).join("\n");
const d100 = () => captured.rolls.filter(f => String(f).startsWith("1d100"));
const favoured = () => talent("Favoured by the Warp / Любимец Варпа");

beforeEach(resetCaptured);

describe("Усмирение Варпа и Любимец Варпа", () => {
  it("с Любимцем Феномен перебрасывается ДВУМЯ кубиками, берётся меньший", async () => {
    captured.dice = [80, 20];            // 80 — Прорыв, 20 — безобидный Феномен
    const a = makeActor([favoured()]);
    await click(a);
    expect(d100().length).toBe(2);
    const text = chatText();
    expect(text).toContain("Любимец Варпа");
    expect(text).toContain("взят меньший");
    expect(text).toContain("Прорыва нет");    // 20 не даёт Прорыва
    expect(text).not.toContain("ВАРП-ПРОРЫВ");
  });

  it("порядок кубов не важен: меньший берётся и когда он выпал первым", async () => {
    captured.dice = [20, 80];
    const a = makeActor([favoured()]);
    await click(a);
    expect(chatText()).toContain("Прорыва нет");
  });

  it("меньший бросок всё равно даёт Прорыв — Прорыв бросается один раз (Прорывы без двух кубиков)", async () => {
    captured.dice = [90, 80, 55];        // два Феномена (оба ≥75) + один Прорыв
    const a = makeActor([favoured()]);
    await click(a);
    expect(d100().length).toBe(3);
    expect(chatText()).toContain("ВАРП-ПРОРЫВ");
  });

  it("без Любимца бросок один", async () => {
    captured.dice = [20];
    const a = makeActor();
    await click(a);
    expect(d100().length).toBe(1);
    expect(chatText()).not.toContain("Любимец Варпа");
  });

  it("переброс Прорыва (таблица peril) двух кубиков не получает — «но не Прорывы»", async () => {
    captured.dice = [55];
    const a = makeActor([favoured()]);
    await click(a, "peril");
    expect(d100().length).toBe(1);
  });
});
