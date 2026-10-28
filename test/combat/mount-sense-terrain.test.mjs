// test/combat/mount-sense-terrain.test.mjs
//
// Mount Sense / Чувство Скакуна (Всадник, Sahara 3-cross-actor-5482; DoomBC —
// Основная книга): «Скакун получает бонус на тесты Трудного Ландшафта, равный
// уровню продвижения Survival персонажа». Уровень продвижения — ранг Навыка
// (Знает +0, Тренированное +10, Опытный +20, Ветеран +30), его бонус и прибавляется.
// Первый абзац Таланта (Инициатива) был сделан раньше.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { showMountTerrainDialog } from "../../module/combat/mount.mjs";
import { mountSenseTerrainBonus } from "../../module/rules/mount.mjs";

const talent = name => ({ type: "talent", name, system: {}, flags: {} });

function rider({ items = [], rank = "veteran", speed = "full" } = {}) {
  return {
    id: "r1", uuid: "Actor.rider", name: "Всадник", type: "character", items,
    system: {
      size: 0, initiative: 5, actionPoints: { value: 2, max: 2 }, characteristics: { ag: { total: 40 } },
      skills: { survival: { rank, total: 50 } }, groupSkills: { operate: [] }, conditions: {},
      mount: { uuid: "Actor.beast", role: "rider", speed }
    },
    getFlag: () => undefined, setFlag: async () => {}, update: async () => {}
  };
}
const beast = () => ({
  type: "character", uuid: "Actor.beast", name: "Скакун", items: [],
  system: { size: 1, initiative: 3, movement: { halfMove: 8 }, wounds: { value: 14, max: 14, critical: 0 } }
});

const realFromUuid = globalThis.fromUuid;
beforeEach(() => { resetCaptured(); globalThis.fromUuid = async () => beast(); });
afterEach(() => { globalThis.fromUuid = realFromUuid; });

describe("Чувство Скакуна: бонус Трудному Ландшафту скакуна = ранг Survival всадника", () => {
  const sense = () => talent("Mount Sense / Чувство Скакуна");

  it("бонус ранга: Знает 0, Тренированное +10, Опытный +20, Ветеран +30", () => {
    expect(mountSenseTerrainBonus(rider({ items: [sense()], rank: "knows" }))).toBe(0);
    expect(mountSenseTerrainBonus(rider({ items: [sense()], rank: "trained" }))).toBe(10);
    expect(mountSenseTerrainBonus(rider({ items: [sense()], rank: "veteran" }))).toBe(20);
    expect(mountSenseTerrainBonus(rider({ items: [sense()], rank: "expert" }))).toBe(30);
  });
  it("без Таланта, без навыка и с «нетренированным» (−20) — 0, а не штраф", () => {
    expect(mountSenseTerrainBonus(rider({ rank: "expert" }))).toBe(0);
    expect(mountSenseTerrainBonus(rider({ items: [sense()], rank: "untrained" }))).toBe(0);
    expect(mountSenseTerrainBonus({ items: [sense()], system: {} })).toBe(0);
  });

  it("диалог Трудного Ландшафта показывает бонус и включает его в порог (−20 + 20)", async () => {
    await showMountTerrainDialog(rider({ items: [sense()], rank: "veteran" }));
    expect(captured.dialog.content).toContain("Чувство Скакуна +20");
  });

  it("без Таланта строки нет", async () => {
    await showMountTerrainDialog(rider({ rank: "veteran" }));
    expect(captured.dialog.content).not.toContain("Чувство Скакуна");
  });
});
