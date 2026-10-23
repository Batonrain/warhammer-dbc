// test/combat/saddle-jump-trot.test.mjs
//
// Таланты Всадника (корбук, гл. 3):
//  • Saddle Jump / Прыжок в Седло: «Он может Оседлать/Спешиться за свободное
//    действие» (вместо Полудействия, стр. 477) — setMount/clearMount не тратят ОД;
//  • Trot / Рысь: «Когда он двигается не более SPD в Ход, скакун или байк
//    игнорируют Трудный Ландшафт и не дают штрафов на действия всадника» —
//    SPD = Полудвижение (таблица «Движение в бою», стр. 29), то есть скорости
//    «без движения» и «полудвижение»: тест Трудного Ландшафта верхом не бросается,
//    штраф стрельбы с седла (−10 на полудвижении) снят.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { setMount, clearMount } from "../../module/sheets/tabs/mount-panel.mjs";
import { showMountTerrainDialog } from "../../module/combat/mount.mjs";
import { rangedPenalty, mountRangedPenalty, trotApplies, TROT_SPEEDS } from "../../module/rules/mount.mjs";
import { packDocById } from "../support/pack-doc.mjs";

const talent = name => ({ type: "talent", name, system: {}, flags: {} });

function makeRider({ ap = 2, items = [], speed = "half", mountUuid = "" } = {}) {
  const rider = {
    id: "r1", uuid: "Actor.rider", name: "Всадник", type: "character", items,
    system: {
      size: 0, initiative: 5, actionPoints: { value: ap, max: 2 },
      characteristics: { ag: { total: 40 } },
      skills: { survival: { rank: "trained", total: 30 } },
      groupSkills: { operate: [] },
      conditions: {},
      mount: { uuid: mountUuid, role: "rider", speed }
    },
    updates: [],
    getFlag: () => undefined, setFlag: async () => {},
    update: async function (d) { this.updates.push(d); }
  };
  return rider;
}

const beast = () => ({
  type: "character", uuid: "Actor.beast", name: "Скакун", items: [],
  system: { size: 1, initiative: 3, movement: { halfMove: 8 }, wounds: { value: 14, max: 14, critical: 0 } }
});

const inCombat = actor => {
  globalThis.game.combat = { id: "c1", round: 1, started: true, combatant: { actor, actorId: actor.id } };
};

const realFromUuid = globalThis.fromUuid;
beforeEach(() => { resetCaptured(); });
afterEach(() => { globalThis.game.combat = null; globalThis.fromUuid = realFromUuid; });

describe("Прыжок в Седло: Оседлать/Спешиться за свободное действие", () => {
  it("без Таланта: Оседлать — полудействие, 2 → 1 ОД", async () => {
    const r = makeRider({ ap: 2 });
    inCombat(r);
    await setMount(r, beast());
    expect(r.updates.some(u => u["system.actionPoints.value"] === 1)).toBe(true);
    expect(r.updates.some(u => u["system.mount.uuid"] === "Actor.beast")).toBe(true);
  });

  it("с Талантом: Оседлать не тратит ОД даже при нуле — связь заведена", async () => {
    const r = makeRider({ ap: 0, items: [talent("Saddle Jump / Прыжок в Седло")] });
    inCombat(r);
    await setMount(r, beast());
    expect(r.updates.some(u => "system.actionPoints.value" in u)).toBe(false);
    expect(r.updates.some(u => u["system.mount.uuid"] === "Actor.beast")).toBe(true);
    expect(captured.warnings.filter(w => /ОД/.test(w))).toEqual([]);
  });

  it("страж: без Таланта при 0 ОД Оседлать не получается", async () => {
    const r = makeRider({ ap: 0 });
    inCombat(r);
    await setMount(r, beast());
    expect(r.updates.some(u => u["system.mount.uuid"])).toBe(false);
    expect(captured.warnings.some(w => /Не хватает ОД/.test(w))).toBe(true);
  });

  it("с Талантом: Спешиться не тратит ОД и не просит подтверждения ГМа", async () => {
    const r = makeRider({ ap: 0, items: [talent("Saddle Jump")], mountUuid: "Actor.beast" });
    inCombat(r);
    await clearMount(r);
    expect(r.updates.some(u => "system.actionPoints.value" in u)).toBe(false);
    expect(r.updates.some(u => u["system.mount.uuid"] === "")).toBe(true);
    expect(captured.dialog).toBeFalsy();
  });

  it("с Талантом вне боя всё как обычно: связь снимается", async () => {
    const r = makeRider({ items: [talent("Прыжок в Седло")], mountUuid: "Actor.beast" });
    await clearMount(r);
    expect(r.updates.at(-1)["system.mount.uuid"]).toBe("");
  });

  it("запись пака: заметка больше не «Не смоделировано»", () => {
    const doc = packDocById("packs-src/talents/Всадник", "66Vxqat8ewjgbuGl");
    expect(doc.system.notes).not.toMatch(/^Не смоделировано/);
  });
});

describe("Рысь: скорости до SPD (Полудвижение)", () => {
  it("рысью считаются «без движения» и «полудвижение», но не полное, Натиск и Бег", () => {
    expect(TROT_SPEEDS).toEqual(["still", "half"]);
    const r = makeRider({ items: [talent("Trot / Рысь")] });
    expect(trotApplies(r, "still")).toBe(true);
    expect(trotApplies(r, "half")).toBe(true);
    expect(trotApplies(r, "full")).toBe(false);
    expect(trotApplies(r, "charge")).toBe(false);
    expect(trotApplies(r, "run")).toBe(false);
    expect(trotApplies(makeRider(), "half")).toBe(false);
  });

  it("штраф стрельбы с седла: на полудвижении −10 → 0 с Рысью; на полном по-прежнему −20", () => {
    expect(rangedPenalty("half")).toBe(-10);
    expect(rangedPenalty("half", { trot: true })).toBe(0);
    // флаг trot — уже решённый вызывающим (trotApplies), сама функция скорость не сверяет
    const r = makeRider({ items: [talent("Trot")] });
    expect(mountRangedPenalty("half", beast(), { rider: r })).toBe(0);
    expect(mountRangedPenalty("full", beast(), { rider: r })).toBe(-20);
    expect(mountRangedPenalty("half", beast(), { rider: makeRider() })).toBe(-10);
    expect(mountRangedPenalty("half", beast())).toBe(-10);
  });

  it("Трудный Ландшафт верхом на полудвижении с Рысью: диалога и броска нет, в чате — Рысь", async () => {
    globalThis.fromUuid = async () => beast();
    await showMountTerrainDialog(makeRider({ items: [talent("Trot / Рысь")], speed: "half", mountUuid: "Actor.beast" }));
    expect(captured.dialog).toBeFalsy();
    expect(captured.rolls).toEqual([]);
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Трудный Ландшафт");
    expect(card).toContain("Рысь");
  });

  it("и на месте (без движения) тоже", async () => {
    globalThis.fromUuid = async () => beast();
    await showMountTerrainDialog(makeRider({ items: [talent("Trot")], speed: "still", mountUuid: "Actor.beast" }));
    expect(captured.dialog).toBeFalsy();
    expect(captured.chat.at(-1).content).toContain("Рысь");
  });

  it("на полном движении с Рысью тест по-прежнему нужен: диалог открывается", async () => {
    globalThis.fromUuid = async () => beast();
    await showMountTerrainDialog(makeRider({ items: [talent("Trot")], speed: "full", mountUuid: "Actor.beast" }));
    expect(captured.dialog).toBeTruthy();
  });

  it("на полудвижении без Рыси тест нужен (страж)", async () => {
    globalThis.fromUuid = async () => beast();
    await showMountTerrainDialog(makeRider({ speed: "half", mountUuid: "Actor.beast" }));
    expect(captured.dialog).toBeTruthy();
  });

  it("запись пака: заметка больше не «Не смоделировано»", () => {
    const doc = packDocById("packs-src/talents/Всадник", "YOBMd8EeTNAqrkdf");
    expect(doc.system.notes).not.toMatch(/^Не смоделировано/);
  });
});
