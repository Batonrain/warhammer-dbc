// test/combat/mount-iron-mount.test.mjs
//
// Iron Mount / Железный Скакун (Всадник, Sahara 3-cross-actor-5482; DoomBC —
// Основная книга): «Получив попадание верхом (после Избеганий), персонаж может
// пройти Operate−10 или Survival−10, чтобы перенести его на скакуна/байк (один
// тест переносит все попадания одной атаки). На 3+ Успеха также +АР (Успехи−2)
// скакуну/байку от этой атаки. Не более ½P.b (окр.▲) раз в Раунд и только от
// засекаемых атак.»

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { resolveHitAllocation, ironMountTest } from "../../module/combat/mount.mjs";
import { ironMountLimit, ironMountArmor } from "../../module/rules/mount.mjs";

const talent = name => ({ type: "talent", name, system: {}, flags: {} });
const ironMount = () => talent("Iron Mount / Железный Скакун");

function rider({ items = [ironMount()], perB = 3, survival = 50 } = {}) {
  const flags = {};
  const a = {
    id: "r1", uuid: "Actor.rider", name: "Всадник", type: "character", items, isOwner: true,
    system: {
      size: 0, initiative: 5, actionPoints: { value: 2, max: 2 },
      characteristics: { ag: { total: 40 }, per: { total: perB * 10, bonus: perB } },
      skills: { survival: { rank: "trained", total: survival } }, groupSkills: { operate: [] }, conditions: {},
      mount: { uuid: "Actor.beast", role: "rider", speed: "half" }
    },
    getFlag: (s, k) => flags[`${s}.${k}`], setFlag: async (s, k, v) => { flags[`${s}.${k}`] = v; },
    update: async () => {}
  };
  return a;
}
const beast = () => ({
  type: "character", uuid: "Actor.beast", name: "Скакун", items: [],
  system: { size: 1, initiative: 3, movement: { halfMove: 8 }, wounds: { value: 14, max: 14, critical: 0 } }
});

const realFromUuid = globalThis.fromUuid;
beforeEach(() => {
  resetCaptured();
  globalThis.fromUuid = async () => beast();
  globalThis.game.combat = undefined;
});
afterEach(() => { globalThis.fromUuid = realFromUuid; globalThis.game.combat = undefined; });

describe("Железный Скакун: числа", () => {
  it("раз в Раунд — ½P.b вверх (минимум 1 при P.b ≥ 1)", () => {
    expect(ironMountLimit(rider({ perB: 3 }))).toBe(2);
    expect(ironMountLimit(rider({ perB: 4 }))).toBe(2);
    expect(ironMountLimit(rider({ perB: 1 }))).toBe(1);
    expect(ironMountLimit(rider({ perB: 0 }))).toBe(0);
  });
  it("AP скакуну: на 3+ Успехах Успехи−2, иначе 0", () => {
    expect(ironMountArmor(2)).toBe(0);
    expect(ironMountArmor(3)).toBe(1);
    expect(ironMountArmor(5)).toBe(3);
  });
});

describe("кнопка в карточке попадания верхом", () => {
  const html = () => captured.chat.at(-1).content;

  it("попадание по ВСАДНИКУ (дубль) + Талант: в карточке есть кнопка переноса", async () => {
    await resolveHitAllocation(rider(), 33);
    expect(html()).toContain("wh-iron-mount-btn");
  });
  it("попадание по скакуну — переносить нечего, кнопки нет", async () => {
    await resolveHitAllocation(rider(), 34);
    expect(html()).not.toContain("wh-iron-mount-btn");
  });
  it("Незримая атака — «только от засекаемых атак», кнопки нет", async () => {
    await resolveHitAllocation(rider(), 33, { unseen: true });
    expect(html()).not.toContain("wh-iron-mount-btn");
  });
  it("без Таланта кнопки нет", async () => {
    await resolveHitAllocation(rider({ items: [] }), 33);
    expect(html()).not.toContain("wh-iron-mount-btn");
  });
});

describe("тест Железного Скакуна (Operate/Survival−10)", () => {
  it("успех: попадание на скакуна, Успехи названы, на 3+ — AP скакуну", async () => {
    captured.nextRoll = 5;              // порог Survival 50−10=40 → 4 Успеха
    await ironMountTest(rider());
    const c = captured.chat.at(-1).content;
    expect(c).toContain("Железный Скакун");
    expect(c).toMatch(/перенесено на скакуна/i);
    expect(c).toContain("+2 AP");        // 4 Успеха − 2
  });
  it("провал: попадание остаётся на всаднике, попытка засчитана", async () => {
    captured.nextRoll = 95;
    const r = rider();
    await ironMountTest(r);
    expect(captured.chat.at(-1).content).toMatch(/остаётся на всаднике/i);
  });
  it("в бою не больше ½P.b раз в Раунд: третья попытка при P.b 3 (лимит 2) отклоняется", async () => {
    globalThis.game.combat = { id: "c1", round: 2, started: true };
    captured.nextRoll = 5;
    const r = rider({ perB: 3 });
    await ironMountTest(r);
    await ironMountTest(r);
    const before = captured.chat.length;
    await ironMountTest(r);
    expect(captured.chat.length).toBe(before);
    expect(captured.warnings.join()).toContain("раз в Раунд");
    // новый Раунд — лимит обновился
    globalThis.game.combat = { id: "c1", round: 3, started: true };
    await ironMountTest(r);
    expect(captured.chat.length).toBe(before + 1);
  });
  it("без Таланта тест не проводится", async () => {
    const before = captured.chat.length;
    await ironMountTest(rider({ items: [] }));
    expect(captured.chat.length).toBe(before);
    expect(captured.warnings.length).toBeGreaterThan(0);
  });
});
