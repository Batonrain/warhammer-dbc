// test/apps/cannon-fodder-sheet.test.mjs
//
// Cannon Fodder / Пушечное Мясо: выпадающий список «чей Миньон» на листе
// Таланта (Sahara inspire-wrath-cannon-fodder, п. 3). Слот «Миньон Хаоса»
// меняет id, если Хозяин пересоздаст Талант, — выбор не должен теряться молча.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  cannonFodderOptions, cannonFodderSelectModel, cannonFodderPanelHtml, setCannonFodderMinion, isCannonFodder
} from "../../module/apps/cannon-fodder.mjs";
import { cannonFodderPenalty } from "../../module/rules/minion-build.mjs";

const slotTalent = (id, group = "human", tier = "weak") => ({
  id, type: "talent", name: "Minion of Chaos / Миньон Хаоса", system: {},
  flags: { "warhammer-dbc": { minionSlot: { group, tier } } }
});
const fodderItem = (target, parent) => {
  const it = { id: "cf1", type: "talent", name: "Cannon Fodder / Пушечное Мясо", parent,
    system: { targetMinion: target, specialization: "" }, updates: [] };
  it.update = async d => { it.updates.push(d); };
  return it;
};
const master = items => ({ uuid: "Actor.master", items });
const minion = (uuid, name, slotTalentId = "") => ({ uuid, name, type: "minion", system: { masterUuid: "Actor.master", slotTalentId } });

let prevActors;
beforeEach(() => { prevActors = globalThis.game.actors; globalThis.game.actors = []; });
afterEach(() => { globalThis.game.actors = prevActors; });

describe("модель выпадающего списка", () => {
  const opts = [{ value: "slot:s1", label: "Люди, Слабый (ещё не создан)" }, { value: "Actor.m9", label: "Бродяга" }];

  it("выбор есть среди кандидатов — он помечен выбранным, предупреждения нет", () => {
    const m = cannonFodderSelectModel(opts, "Actor.m9");
    expect(m.stale).toBe(false);
    expect(m.rows.find(r => r.selected).value).toBe("Actor.m9");
    expect(m.rows).toHaveLength(2);
  });

  it("пусто — первой строкой «не выбран»", () => {
    const m = cannonFodderSelectModel(opts, "");
    expect(m.rows[0]).toMatchObject({ value: "", selected: true });
    expect(m.stale).toBe(false);
  });

  it("слот пересоздан (старый id пропал) — выбор остаётся видимой пометкой, а не молча пустеет", () => {
    const m = cannonFodderSelectModel(opts, "slot:OLD");
    expect(m.stale).toBe(true);
    expect(m.rows[0]).toMatchObject({ value: "slot:OLD", selected: true });
    expect(m.rows[0].label).toContain("не найден");
  });
});

describe("панель на листе", () => {
  it("только у Пушечного Мяса на акторе", () => {
    const m = master([slotTalent("s1")]);
    expect(cannonFodderPanelHtml(fodderItem("slot:s1", m), m)).toContain("cannon-fodder-pick");
    expect(cannonFodderPanelHtml({ type: "talent", name: "Прочее", system: {} }, m)).toBe("");
    expect(cannonFodderPanelHtml(fodderItem("", null), null)).toBe("");
  });

  it("в списке — слот без слуги и живой Миньон без слота; текущий выбран", () => {
    const m = master([slotTalent("s1")]);
    globalThis.game.actors = [minion("Actor.m9", "Бродяга")];
    const html = cannonFodderPanelHtml(fodderItem("Actor.m9", m), m);
    expect(html).toContain('value="slot:s1"');
    expect(html).toContain('value="Actor.m9" selected');
    expect(html).toContain("теряет 20 Лояльности");
  });

  it("устаревший слот — в панели предупреждение", () => {
    const m = master([slotTalent("s2")]);
    const html = cannonFodderPanelHtml(fodderItem("slot:OLD", m), m);
    expect(html).toContain("больше не найден");
  });
});

describe("смена слуги", () => {
  it("пишет и выбор, и подпись для списка Талантов; штраф переезжает на нового слугу", async () => {
    const m = master([slotTalent("s1")]);
    const item = fodderItem("", m);
    m.items.push(item);
    expect(isCannonFodder(item)).toBe(true);
    expect(await setCannonFodderMinion(item, "slot:s1")).toBe(true);
    expect(item.updates.at(-1)["system.targetMinion"]).toBe("slot:s1");
    expect(item.updates.at(-1)["system.specialization"]).toContain("ещё не создан");
    // Тот самый Талант, как его применит расчёт Лояльности:
    item.system.targetMinion = item.updates.at(-1)["system.targetMinion"];
    expect(cannonFodderPenalty(m, { uuid: "Actor.zz", slotTalentId: "s1" })).toBe(20);
    expect(cannonFodderPenalty(m, { uuid: "Actor.zz", slotTalentId: "s9" })).toBe(0);
  });

  it("значение вне списка (пометка «не найден», пустое) ничего не пишет", async () => {
    const m = master([slotTalent("s1")]);
    const item = fodderItem("slot:OLD", m);
    expect(await setCannonFodderMinion(item, "slot:OLD")).toBe(false);
    expect(await setCannonFodderMinion(item, "")).toBe(false);
    expect(item.updates).toEqual([]);
  });

  it("список кандидатов не меняется от выбора (пересоздание слота — новые id подхватываются)", () => {
    const m1 = master([slotTalent("s1")]);
    const m2 = master([slotTalent("s77")]);
    expect(cannonFodderOptions(m1).map(o => o.value)).toEqual(["slot:s1"]);
    expect(cannonFodderOptions(m2).map(o => o.value)).toEqual(["slot:s77"]);
  });
});
