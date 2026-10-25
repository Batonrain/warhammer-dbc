// test/combat/calm-winds.test.mjs
//
// Штиль / Calm Winds (Псайкана, Sahara 3-28): «Когда он использует Очко
// Бесчестия для Усмирения Варпа, он может выбрать отменить второй бросок и
// вернуть потраченное Очко Бесчестия, чтобы использовать изначальный результат
// Феномена или Прорыва.»

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

beforeEach(() => { resetCaptured(); captured.nextRoll = 30; });

describe("Усмирение Варпа и Штиль", () => {
  it("без Штиля вопроса нет: Очко потрачено, переброс остаётся", async () => {
    const a = makeActor();
    await click(a);
    expect(a.system.fate.value).toBe(1);
    expect(captured.dialog).toBeNull();
    expect(chatText()).toContain("переброс");
  });

  it("со Штилем и отказом от отмены: переброс остаётся, Очко потрачено", async () => {
    captured.confirmAnswer = false;
    const a = makeActor([talent("Calm Winds / Штиль")]);
    await click(a);
    expect(a.system.fate.value).toBe(1);
    expect(captured.dialog.content).toContain("Штиль");
    expect(chatText()).toContain("Психический Феномен");
  });

  it("со Штилем и согласием: Очко возвращено, изначальный результат остаётся", async () => {
    captured.confirmAnswer = true;
    const a = makeActor([talent("Calm Winds / Штиль")]);
    await click(a);
    expect(a.system.fate.value).toBe(2);
    expect(chatText()).toContain("Штиль — переброс отменён");
    expect(chatText()).not.toContain("Психический Феномен (переброс");
  });

  it("Прорыв: то же самое для таблицы Прорывов", async () => {
    captured.confirmAnswer = true;
    const a = makeActor([talent("Calm Winds / Штиль")]);
    await click(a, "peril");
    expect(a.system.fate.value).toBe(2);
    expect(chatText()).toContain("Штиль — переброс отменён");
  });
});
