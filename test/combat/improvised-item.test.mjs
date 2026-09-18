// test/combat/improvised-item.test.mjs
//
// Импровизированное Оружие / Метание — ОБЫЧНЫЙ ПРЕДМЕТ (не партнёр по
// Захвату, стр. 27-28). wdbc-x1nz.2.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { useSwingItem, useThrowItem } from "../../module/combat/improvised-item.mjs";

function actor({ ws = 40, s = 40, sb = 4, bs = 40, ag = 40, carry = 100 } = {}) {
  return {
    id: "a1", name: "Гвардеец", uuid: "Actor.a1",
    system: {
      characteristics: { ws: { total: ws }, s: { total: s, bonus: sb }, bs: { total: bs }, a: { total: ag } },
      encumbrance: { carry },
      meleeStance: "standard", meleeBase: "standard"
    },
    update: async () => {}
  };
}

function target(name = "Цель") {
  return { id: `t-${name}`, name, uuid: `Actor.${name}` };
}

function item(name, weight) {
  return { id: `i-${name}`, name, system: { weight } };
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.time = { worldTime: 0 };
  globalThis.game.user = { targets: [] };
});

describe("useSwingItem", () => {
  it("предмет тяжелее ¼ Ношения — отказ, без броска", async () => {
    const a = actor({ carry: 100 });
    globalThis.game.user.targets = [{ actor: target() }];
    await useSwingItem(a, item("Ящик", 30));
    expect(captured.warnings.length).toBe(1);
    expect(captured.chat.length).toBe(0);
  });

  it("нет отмеченной цели — предупреждает", async () => {
    const a = actor({ carry: 100 });
    await useSwingItem(a, item("Труба", 10));
    expect(captured.warnings.length).toBe(1);
  });

  it("успех — карточка с попаданием", async () => {
    captured.nextRoll = 5; // WS 40-20=20 → успех
    const a = actor({ ws: 40, carry: 100 });
    globalThis.game.user.targets = [{ actor: target("Орк") }];
    await useSwingItem(a, item("Труба", 10));
    expect(captured.chat.length).toBe(1);
    expect(captured.chat[0].content).toContain("Попадание");
    expect(captured.chat[0].content).toContain("wh-apply-dmg-btn");
  });

  it("промах — карточка без кнопки применения урона", async () => {
    captured.nextRoll = 90; // WS 40-20=20 → провал
    const a = actor({ ws: 40, carry: 100 });
    globalThis.game.user.targets = [{ actor: target("Орк") }];
    await useSwingItem(a, item("Труба", 10));
    expect(captured.chat[0].content).toContain("Промах");
    expect(captured.chat[0].content).not.toContain("wh-apply-dmg-btn");
  });
});

describe("useThrowItem", () => {
  it("предмет тяжелее полного Веса Ношения — метнуть нельзя, отказ", async () => {
    const a = actor({ carry: 10 });
    globalThis.game.user.targets = [{ actor: target() }];
    await useThrowItem(a, item("Наковальня", 50));
    expect(captured.warnings.length).toBe(1);
    expect(captured.chat.length).toBe(0);
  });

  it("нет отмеченной цели — предупреждает", async () => {
    const a = actor({ carry: 100 });
    await useThrowItem(a, item("Нож", 1));
    expect(captured.warnings.length).toBe(1);
  });

  it("лёгкий тир (≤¼ Ношения) — тест BS+0, успех даёт урон 1d5+S.b", async () => {
    captured.nextRoll = 5; // BS 40 → успех
    const a = actor({ bs: 40, sb: 4, carry: 100 });
    globalThis.game.user.targets = [{ actor: target("Култист") }];
    await useThrowItem(a, item("Нож", 5)); // ¼ от 100 = 25, 5 ≤ 25 → light
    expect(captured.chat.length).toBe(1);
    expect(captured.chat[0].content).toContain("BS");
    expect(captured.chat[0].content).toContain("Попадание");
  });

  it("тяжёлый тир (½-полный Ношения) — Athletics со штрафом −30", async () => {
    captured.nextRoll = 5;
    const a = actor({ s: 90, carry: 100 });
    globalThis.game.user.targets = [{ actor: target("Култист") }];
    await useThrowItem(a, item("Бочка", 80)); // >50, ≤100 → heavy
    expect(captured.chat.length).toBe(1);
    expect(captured.chat[0].content).toContain("Athletics(S)");
    expect(captured.chat[0].content).toContain("тир -30");
  });
});
