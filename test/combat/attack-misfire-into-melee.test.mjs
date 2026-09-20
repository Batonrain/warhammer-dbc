// test/combat/attack-misfire-into-melee.test.mjs
//
// Стр. 30, wdbc-x1nz.2.64: «Связан в Рукопашной» — промах по цели.
// Одиночный выстрел, промахнувший на 1 или 2 Провала, попадает в случайного
// персонажа в контакте с целью (враг или союзник) вместо неё. Короткая/
// Длинная Очередь — половина ПОТЕНЦИАЛЬНЫХ выстрелов (RoF), что не стали
// попаданиями (окр.▼), туда же. Получателя и урон/место выбирает бросок, не
// стол — data-force-target на кнопке ведёт урон прямо на него.

const HOSTILE = -1, FRIENDLY = 1;

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

let _tokenId = 0;
function enemyActor({ weaponClass = "melee", name = "Связывающий" } = {}) {
  return { name, type: "character", uuid: `Actor.${name}`, items: [{ type: "weapon", system: { equipped: true, weaponClass } }] };
}
function tokenAt({ actor, x = 0, y = 0, disposition = HOSTILE }) {
  const id = `t${_tokenId++}`;
  return { actor, document: { id, x, y, width: 1, height: 1, disposition, actor } };
}

beforeEach(() => {
  resetCaptured();
  globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [] } };
});

describe("Одиночный выстрел по цели в рукопашной: промах на 1-2 Провала рикошетит", () => {
  it("промах на 1 Провал, цель заперта — рикошет в контакт цели", async () => {
    const weapon = weaponFor({ weaponClass: "basic", damage: "1d10", rof_single: 1 });
    const shooterActor = actorFor({ items: [weapon] });
    const shooterToken = tokenAt({ actor: shooterActor, x: 50, y: 50, disposition: FRIENDLY });
    const targetActor = { name: "Цель", type: "character", uuid: "Actor.target" };
    const targetToken = tokenAt({ actor: targetActor, x: 0, y: 0, disposition: HOSTILE });
    const lockerToken = tokenAt({ actor: enemyActor(), x: 0, y: 0, disposition: FRIENDLY }); // враг ЦЕЛИ (та HOSTILE) — сам FRIENDLY
    globalThis.canvas.tokens.placeables = [shooterToken, targetToken, lockerToken];
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([targetToken]) };
    // rv=50, порог 45 → 1 Провал (floor((50-45)/10)+1=1); pickRoll/locRoll/dmg.
    captured.dice = [50, 10, 32, 7];

    await _executeAttackRoll(shooterActor, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain("Промах");
    expect(card()).toContain("Применить рикошет 1");
    expect(card()).toContain("Связывающий");
    expect(card()).toContain(`data-force-target="Actor.Связывающий"`);
    expect(card()).toContain("data-damage=\"7\"");
  });

  it("промах на 2 Провала — тоже рикошетит", async () => {
    const weapon = weaponFor({ weaponClass: "basic", damage: "1d10", rof_single: 1 });
    const shooterActor = actorFor({ items: [weapon] });
    const shooterToken = tokenAt({ actor: shooterActor, x: 50, y: 50, disposition: FRIENDLY });
    const targetActor = { name: "Цель", type: "character", uuid: "Actor.target" };
    const targetToken = tokenAt({ actor: targetActor, x: 0, y: 0, disposition: HOSTILE });
    const lockerToken = tokenAt({ actor: enemyActor(), x: 0, y: 0, disposition: FRIENDLY }); // враг ЦЕЛИ (та HOSTILE) — сам FRIENDLY
    globalThis.canvas.tokens.placeables = [shooterToken, targetToken, lockerToken];
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([targetToken]) };
    // rv=60, порог 45 → 2 Провала.
    captured.dice = [60, 10, 32, 7];

    await _executeAttackRoll(shooterActor, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain("Применить рикошет 1");
  });

  it("промах на 3 Провала — уже не рикошетит", async () => {
    const weapon = weaponFor({ weaponClass: "basic", damage: "1d10", rof_single: 1 });
    const shooterActor = actorFor({ items: [weapon] });
    const shooterToken = tokenAt({ actor: shooterActor, x: 50, y: 50, disposition: FRIENDLY });
    const targetActor = { name: "Цель", type: "character", uuid: "Actor.target" };
    const targetToken = tokenAt({ actor: targetActor, x: 0, y: 0, disposition: HOSTILE });
    const lockerToken = tokenAt({ actor: enemyActor(), x: 0, y: 0, disposition: FRIENDLY }); // враг ЦЕЛИ (та HOSTILE) — сам FRIENDLY
    globalThis.canvas.tokens.placeables = [shooterToken, targetToken, lockerToken];
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([targetToken]) };
    // rv=70, порог 45 → 3 Провала.
    captured.dice = [70];

    await _executeAttackRoll(shooterActor, weapon, "bs", 45, "single", null, {});

    expect(card()).not.toContain("рикошет");
  });

  it("попадание (не промах) — рикошета нет вовсе", async () => {
    const weapon = weaponFor({ weaponClass: "basic", damage: "1d10", rof_single: 1 });
    const shooterActor = actorFor({ items: [weapon] });
    const shooterToken = tokenAt({ actor: shooterActor, x: 50, y: 50, disposition: FRIENDLY });
    const targetActor = { name: "Цель", type: "character", uuid: "Actor.target" };
    const targetToken = tokenAt({ actor: targetActor, x: 0, y: 0, disposition: HOSTILE });
    const lockerToken = tokenAt({ actor: enemyActor(), x: 0, y: 0, disposition: FRIENDLY }); // враг ЦЕЛИ (та HOSTILE) — сам FRIENDLY
    globalThis.canvas.tokens.placeables = [shooterToken, targetToken, lockerToken];
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([targetToken]) };
    captured.dice = [10, 5]; // rv=10 попадание; урон 1d10=5

    await _executeAttackRoll(shooterActor, weapon, "bs", 45, "single", null, {});

    expect(card()).not.toContain("рикошет");
  });

  it("цель НЕ заперта (нет рукопашного/Пистолета в контакте) — промах на 1 Провал не рикошетит", async () => {
    const weapon = weaponFor({ weaponClass: "basic", damage: "1d10", rof_single: 1 });
    const shooterActor = actorFor({ items: [weapon] });
    const shooterToken = tokenAt({ actor: shooterActor, x: 50, y: 50, disposition: FRIENDLY });
    const targetActor = { name: "Цель", type: "character", uuid: "Actor.target" };
    const targetToken = tokenAt({ actor: targetActor, x: 0, y: 0, disposition: HOSTILE });
    const unarmedNeighbor = tokenAt({ actor: enemyActor({ weaponClass: "basic" }), x: 0, y: 0, disposition: FRIENDLY });
    globalThis.canvas.tokens.placeables = [shooterToken, targetToken, unarmedNeighbor];
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([targetToken]) };
    captured.dice = [50];

    await _executeAttackRoll(shooterActor, weapon, "bs", 45, "single", null, {});

    expect(card()).not.toContain("рикошет");
  });
});

describe("Очередь по цели в рукопашной: половина непопавших потенциальных выстрелов рикошетит", () => {
  it("Короткая очередь rof_semi=4, 1 попадание — потенциально 4, промазало 3, рикошет floor(3/2)=1", async () => {
    const weapon = weaponFor({ weaponClass: "basic", damage: "1d10", rof_semi: 4 });
    const shooterActor = actorFor({ items: [weapon] });
    const shooterToken = tokenAt({ actor: shooterActor, x: 50, y: 50, disposition: FRIENDLY });
    const targetActor = { name: "Цель", type: "character", uuid: "Actor.target" };
    const targetToken = tokenAt({ actor: targetActor, x: 0, y: 0, disposition: HOSTILE });
    const lockerToken = tokenAt({ actor: enemyActor(), x: 0, y: 0, disposition: FRIENDLY }); // враг ЦЕЛИ (та HOSTILE) — сам FRIENDLY
    globalThis.canvas.tokens.placeables = [shooterToken, targetToken, lockerToken];
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([targetToken]) };
    // rv=40 (попадание, deg=1 → hitCount semi = min(ceil(1/2),4)=1);
    // урон попадания=6; затем pickRoll/locRoll/dmg рикошета.
    captured.dice = [40, 6, 10, 32, 7];

    await _executeAttackRoll(shooterActor, weapon, "bs", 45, "semi", null, {});

    expect(card()).toContain("Применить рикошет 1");
    expect(card()).not.toContain("Применить рикошет 2");
  });

  it("Короткая очередь rof_semi=2, попало 2 (весь потенциал) — рикошета нет", async () => {
    const weapon = weaponFor({ weaponClass: "basic", damage: "1d10", rof_semi: 2 });
    const shooterActor = actorFor({ items: [weapon] });
    const shooterToken = tokenAt({ actor: shooterActor, x: 50, y: 50, disposition: FRIENDLY });
    const targetActor = { name: "Цель", type: "character", uuid: "Actor.target" };
    const targetToken = tokenAt({ actor: targetActor, x: 0, y: 0, disposition: HOSTILE });
    const lockerToken = tokenAt({ actor: enemyActor(), x: 0, y: 0, disposition: FRIENDLY }); // враг ЦЕЛИ (та HOSTILE) — сам FRIENDLY
    globalThis.canvas.tokens.placeables = [shooterToken, targetToken, lockerToken];
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([targetToken]) };
    // deg нужен >=3 чтобы hitCount semi = min(ceil(deg/2),2)=2 (весь потенциал).
    // rv=15, порог 45 → deg=floor((45-15)/10)+1=4 → ceil(4/2)=2, min(2,2)=2.
    captured.dice = [15, 6, 6];

    await _executeAttackRoll(shooterActor, weapon, "bs", 45, "semi", null, {});

    expect(card()).not.toContain("рикошет");
  });

  it("цель не заперта — рикошета нет даже при полном промахе очереди", async () => {
    const weapon = weaponFor({ weaponClass: "basic", damage: "1d10", rof_semi: 4 });
    const shooterActor = actorFor({ items: [weapon] });
    const shooterToken = tokenAt({ actor: shooterActor, x: 50, y: 50, disposition: FRIENDLY });
    const targetActor = { name: "Цель", type: "character", uuid: "Actor.target" };
    const targetToken = tokenAt({ actor: targetActor, x: 0, y: 0, disposition: HOSTILE });
    globalThis.canvas.tokens.placeables = [shooterToken, targetToken];
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([targetToken]) };
    captured.dice = [90]; // полный промах очереди

    await _executeAttackRoll(shooterActor, weapon, "bs", 45, "semi", null, {});

    expect(card()).not.toContain("рикошет");
  });
});
