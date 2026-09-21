// test/combat/movement-legacy-brave-heart.test.mjs
//
// Лучшая Часть Отваги/skilled 5-6, Оружие Наследия (wdbc-1rno.35, стр. 427):
//   - Рукопашная: Charm+0 vs Per+0 или Inf+0 vs Per+0 → Выход из Боя за
//     полудействие (1 ОД вместо 2) — двухшаговый встречный тест, тот же
//     приём, что Вольт (declareVault/resolveVaultContestClick).
//   - Стрелковая: выстрел не убил/не обезвредил цель → свободное
//     Полудвижение (declareLegacyBraveHeartMove).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  declareLegacyBraveDisengage, resolveLegacyBraveDisengageContest, declareLegacyBraveHeartMove
} from "../../module/combat/movement-actions.mjs";

function actorFor({ actionPoints = { value: 2, max: 2 }, fel = 30, inf = 30, uuid = "Actor.mover1" } = {}) {
  const store = {};
  const doc = {
    name: "Актёр", type: "character", uuid,
    system: {
      actionPoints, movement: { halfMove: 4 },
      characteristics: { fel: { total: fel }, inf: { total: inf } }
    }
  };
  doc.update = async data => {
    for (const [path, value] of Object.entries(data)) {
      const keys = path.split(".");
      let node = doc;
      for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
      node[keys.at(-1)] = value;
    }
    return doc;
  };
  doc.getFlag = (scope, key) => store[`${scope}.${key}`];
  doc.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  doc.unsetFlag = async (scope, key) => { delete store[`${scope}.${key}`]; };
  doc.getActiveTokens = () => [];
  return doc;
}

function enemyActor(per = 40, uuid = "Actor.enemy1") {
  return { name: "Враг", uuid, system: { characteristics: { per: { total: per } } } };
}

beforeEach(() => { resetCaptured(); globalThis.game.combat = undefined; });
afterEach(() => { globalThis.game.combat = undefined; });

describe("declareLegacyBraveDisengage", () => {
  it("в бою хватает ОД — катает свою характеристику (выше из Fel/Inf), постит карточку", async () => {
    globalThis.game.combat = { started: true };
    captured.dice = [30];
    const actor = actorFor({ fel: 30, inf: 50 });
    await declareLegacyBraveDisengage(actor);
    expect(captured.chat).toHaveLength(1);
    expect(captured.chat[0].content).toContain("Лучшая Часть Отваги");
    expect(captured.chat[0].content).toContain("Inf"); // 50 > 30 — Inf выбран
  });

  it("нет врагов в контакте — карточка отмечает «нет врагов», ОД не тратится ещё", async () => {
    captured.dice = [30];
    const actor = actorFor();
    await declareLegacyBraveDisengage(actor);
    expect(captured.chat[0].content).toContain("Нет врагов в рукопашной");
    expect(actor.system.actionPoints.value).toBe(2); // трата — только по факту победы в контесте
  });

  it("под Вызовом — переспрашивает подтверждение", async () => {
    captured.dice = [30];
    const actor = actorFor();
    actor.system.conditions = { challenged: true };
    captured.confirmAnswer = false;
    await declareLegacyBraveDisengage(actor);
    expect(captured.chat).toHaveLength(0);
  });
});

describe("resolveLegacyBraveDisengageContest", () => {
  it("мой встречный тест выигран — тратит 1 ОД, ставит disengageActive", async () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor();
    globalThis.fromUuid = async uuid => (uuid === actor.uuid ? actor : (uuid === "Actor.enemy1" ? enemyActor(40) : null));
    captured.dice = [95]; // Per 40, rv 95 — Провал их стороны
    await resolveLegacyBraveDisengageContest(actor.uuid, "Actor.enemy1", "fel", 10, 50); // мой Успех уже готов (50 vs 10, сильный успех)
    expect(actor.system.actionPoints.value).toBe(1);
    expect(actor.getFlag("warhammer-dbc", "disengageActive")).toBe(true);
    expect(captured.chat.at(-1).content).toContain("Выход из Боя");
  });

  it("противник выигрывает встречный тест — Выход из Боя не удаётся, ОД цел", async () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor();
    globalThis.fromUuid = async uuid => (uuid === actor.uuid ? actor : (uuid === "Actor.enemy1" ? enemyActor(80) : null));
    captured.dice = [10]; // Per 80, rv 10 — сильный успех их стороны
    await resolveLegacyBraveDisengageContest(actor.uuid, "Actor.enemy1", "fel", 90, 50); // мой провал (90 > 50)
    expect(actor.system.actionPoints.value).toBe(2);
    expect(actor.getFlag("warhammer-dbc", "disengageActive")).toBeUndefined();
    expect(captured.chat.at(-1).content).toContain("не вышло");
  });

  it("противник не найден — предупреждение, без карточки", async () => {
    globalThis.fromUuid = async uuid => (uuid === "Actor.mover1" ? actorFor() : null);
    await resolveLegacyBraveDisengageContest("Actor.mover1", "Actor.missing", "fel", 50, 50);
    expect(captured.warnings.some(w => w.includes("не найден"))).toBe(true);
    expect(captured.chat).toHaveLength(0);
  });
});

describe("declareLegacyBraveHeartMove", () => {
  it("нет актора — ничего не делает", async () => {
    await declareLegacyBraveHeartMove(null);
    expect(captured.chat).toHaveLength(0);
  });

  it("свободное действие — НЕ тратит ОД, помечает движение, постит карточку", async () => {
    const actor = actorFor({ actionPoints: { value: 0, max: 2 } }); // 0 ОД — свободное действие всё равно проходит
    await declareLegacyBraveHeartMove(actor);
    expect(actor.system.actionPoints.value).toBe(0); // не тронуто
    expect(captured.chat).toHaveLength(1);
    expect(captured.chat[0].content).toContain("Лучшая Часть Отваги");
    expect(captured.chat[0].content).toContain("0 ОД");
  });
});
