// test/combat/movement-vault.test.mjs
//
// Стр. 30, wdbc-x1nz.2.37: Вольт — Полудействие, выходит из Рукопашной без
// обычной Свободной Атаки; каждый враг проверяет WS+0 против уже готовой
// Степени вольтующего (resolveVaultContestClick — клик по кнопке карточки).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { declareVault, resolveVaultContestClick } from "../../module/combat/movement-actions.mjs";

function actorFor({ actionPoints = { value: 2, max: 2 } } = {}) {
  const store = {};
  const doc = {
    name: "Вольтующий", type: "character", uuid: "Actor.mover1",
    system: { actionPoints, characteristics: { ag: { total: 40, bonus: 4 } }, skills: {} }
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

function enemyActor(ws = 40, uuid = "Actor.enemy1") {
  return { name: "Враг", uuid, system: { characteristics: { ws: { total: ws } } } };
}

beforeEach(() => { resetCaptured(); globalThis.game.combat = undefined; globalThis.game.actors = undefined; });
afterEach(() => { globalThis.game.combat = undefined; });

describe("declareVault", () => {
  it("в Захвате — блокируется (Физическое действие, wdbc-x1nz.2.31)", async () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor();
    actor.system.conditions = { grappling: true };
    await declareVault(actor);
    expect(captured.chat).toHaveLength(0);
  });

  it("в бою хватает ОД — списывает 1 ОД, катает Acrobatics, постит карточку", async () => {
    globalThis.game.combat = { started: true };
    captured.dice = [30];
    const actor = actorFor({ actionPoints: { value: 2, max: 2 } });
    await declareVault(actor);
    expect(actor.system.actionPoints.value).toBe(1);
    expect(captured.chat).toHaveLength(1);
    expect(captured.chat[0].content).toContain("Вольт");
  });

  it("без ОД — блокируется, карточка не постится", async () => {
    globalThis.game.combat = { started: true };
    const actor = actorFor({ actionPoints: { value: 0, max: 2 } });
    await declareVault(actor);
    expect(captured.chat).toHaveLength(0);
  });

  it("нет врагов в контакте (пустой canvas) — карточка отмечает «нет врагов»", async () => {
    globalThis.game.combat = { started: true };
    captured.dice = [30];
    const actor = actorFor();
    await declareVault(actor);
    expect(captured.chat[0].content).toContain("Нет врагов в рукопашной");
  });
});

describe("resolveVaultContestClick", () => {
  it("враг набирает больше Степеней, чем вольтующий — попадает", async () => {
    globalThis.game.actors = [];
    globalThis.fromUuid = async uuid => (uuid === "Actor.enemy1" ? enemyActor(60) : actorFor());
    captured.dice = [10]; // WS 60, rv 10 — большой Успех
    await resolveVaultContestClick("Actor.mover1", 1, "Actor.enemy1"); // мовер: слабый Успех (Степень 1)
    expect(captured.chat.at(-1).content).toContain("Попадает");
  });

  it("враг проваливает WS — вольтующий уходит", async () => {
    globalThis.fromUuid = async uuid => (uuid === "Actor.enemy1" ? enemyActor(40) : actorFor());
    captured.dice = [95]; // WS 40, rv 95 — Провал
    await resolveVaultContestClick("Actor.mover1", 1, "Actor.enemy1");
    expect(captured.chat.at(-1).content).toContain("Промахивается");
  });

  it("ничья по Степеням — вольтующий уходит (строго больше нужно для попадания)", async () => {
    globalThis.fromUuid = async uuid => (uuid === "Actor.enemy1" ? enemyActor(40) : actorFor());
    captured.dice = [35]; // WS 40, rv 35 — Успех 1 ст. (та же Степень, что у мовера — 1)
    await resolveVaultContestClick("Actor.mover1", 1, "Actor.enemy1");
    expect(captured.chat.at(-1).content).toContain("Промахивается");
  });

  it("враг не найден — предупреждение, без карточки", async () => {
    globalThis.fromUuid = async () => null;
    await resolveVaultContestClick("Actor.mover1", 1, "Actor.missing");
    expect(captured.warnings.some(w => w.includes("не найден"))).toBe(true);
    expect(captured.chat).toHaveLength(0);
  });
});
