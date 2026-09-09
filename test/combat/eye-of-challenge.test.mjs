// test/combat/eye-of-challenge.test.mjs
//
// Око Вызова / Eye of Challenge (Дар Кхорна, wdbc-1rno): не брошенный за
// минуту вызов — 2d10+8 непоглощаемого урона в Раны чемпиону.

import "../support/foundry-stub.mjs";
import { captured } from "../support/foundry-stub.mjs";
import fs   from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");

import { describe, it, expect, beforeEach } from "vitest";
import {
  eyeOfChallengeInfo, startEyeOfChallenge, clearEyeOfChallenge,
  isEyeOfChallengeExpired, processEyeOfChallengeDeadline
} from "../../module/combat/eye-of-challenge.mjs";

function mockActor() {
  const flags = { "warhammer-dbc": {} };
  const system = { wounds: { value: 12, critical: 0 } };
  return {
    name: "Чемпион",
    system,
    flags,
    getFlag: (sc, k) => flags[sc]?.[k],
    setFlag: async (sc, k, v) => { (flags[sc] ??= {})[k] = v; },
    unsetFlag: async (sc, k) => { delete flags[sc]?.[k]; },
    update: async data => Object.assign(system.wounds, {
      value: data["system.wounds.value"] ?? system.wounds.value,
      critical: data["system.wounds.critical"] ?? system.wounds.critical
    })
  };
}

beforeEach(() => { captured.nextRoll = 20; captured.dice = null; captured.chat.length = 0; });

describe("startEyeOfChallenge / clearEyeOfChallenge / eyeOfChallengeInfo", () => {
  it("запускает срок на 60 секунд от переданного worldTime", async () => {
    const actor = mockActor();
    await startEyeOfChallenge(actor, { targetUuid: "Actor.x", targetName: "Цель", worldTime: 1000 });
    expect(eyeOfChallengeInfo(actor)).toMatchObject({ targetName: "Цель", deadlineAt: 1060 });
  });

  it("новый вызов замещает старый, не копится", async () => {
    const actor = mockActor();
    await startEyeOfChallenge(actor, { targetName: "Первый", worldTime: 0 });
    await startEyeOfChallenge(actor, { targetName: "Второй", worldTime: 100 });
    expect(eyeOfChallengeInfo(actor)).toMatchObject({ targetName: "Второй", deadlineAt: 160 });
  });

  it("clearEyeOfChallenge снимает метку без штрафа", async () => {
    const actor = mockActor();
    await startEyeOfChallenge(actor, { targetName: "Цель", worldTime: 0 });
    await clearEyeOfChallenge(actor);
    expect(eyeOfChallengeInfo(actor)).toBe(null);
  });

  it("нет активного вызова — снятие ничего не ломает", async () => {
    const actor = mockActor();
    await expect(clearEyeOfChallenge(actor)).resolves.toBeUndefined();
    expect(eyeOfChallengeInfo(actor)).toBe(null);
  });
});

describe("isEyeOfChallengeExpired", () => {
  it("нет метки — не истёк", () => {
    expect(isEyeOfChallengeExpired(null, 99999)).toBe(false);
  });
  it("до дедлайна — не истёк, в момент/после — истёк", () => {
    const info = { deadlineAt: 1000 };
    expect(isEyeOfChallengeExpired(info, 999)).toBe(false);
    expect(isEyeOfChallengeExpired(info, 1000)).toBe(true);
    expect(isEyeOfChallengeExpired(info, 1001)).toBe(true);
  });
});

describe("processEyeOfChallengeDeadline", () => {
  it("срок не истёк — ничего не применяет", async () => {
    const actor = mockActor();
    await startEyeOfChallenge(actor, { targetName: "Цель", worldTime: 0 });
    await processEyeOfChallengeDeadline(actor, 30);
    expect(eyeOfChallengeInfo(actor)).not.toBe(null);
    expect(actor.system.wounds.value).toBe(12);
  });

  it("срок истёк — снимает метку и наносит непоглощаемый урон (2d10+8 через captured.nextRoll)", async () => {
    const actor = mockActor();
    await startEyeOfChallenge(actor, { targetName: "Цель", worldTime: 0 });
    captured.nextRoll = 20;
    await processEyeOfChallengeDeadline(actor, 60);
    expect(eyeOfChallengeInfo(actor)).toBe(null);
    expect(actor.system.wounds.value).toBe(0);
    expect(actor.system.wounds.critical).toBe(8); // 20 урона − 12 Ран = 8 в Критические
  });

  it("нет активного вызова — ничего не делает", async () => {
    const actor = mockActor();
    await processEyeOfChallengeDeadline(actor, 99999);
    expect(actor.system.wounds.value).toBe(12);
  });

  it("МУТАЦИЯ: без woundLossUpdates урон не применился бы — проверка ловит регресс", async () => {
    // Не мутирует код напрямую — проверяет, что тест действительно завязан на
    // реальное изменение system.wounds, а не только на снятие флага.
    const actor = mockActor();
    await startEyeOfChallenge(actor, { targetName: "Цель", worldTime: 0 });
    captured.nextRoll = 5;
    await processEyeOfChallengeDeadline(actor, 60);
    expect(actor.system.wounds.value).toBe(7);
    expect(actor.system.wounds.critical).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  Срок в БОЮ (wdbc-6dk) и единственный источник правды (wdbc-lhd)
//
//  Боевые Раунды в этой системе игровое время не двигают: CONFIG.time.roundTime
//  не задан, worldTime меняют только виджет «Летоисчисление» и авто-течение.
//  Пока срок жил только в секундах, «не бросил вызов за минуту» в бою не
//  срабатывал вовсе — штраф прилетал позже, когда ГМ перематывал время после
//  боя, по уже подлеченному чемпиону.
// ════════════════════════════════════════════════════════════════════════════

describe("срок Ока Вызова в бою считается Раундами", () => {
  const combat = (id, round) => ({ id, round });

  it("в бою запоминается Раунд срока — минута это десять Раундов", async () => {
    const actor = mockActor();
    await startEyeOfChallenge(actor, { targetName: "Цель", worldTime: 0, combat: combat("c1", 3) });
    const info = eyeOfChallengeInfo(actor);
    expect(info.deadlineRound).toBe(13);
    expect(info.combatId).toBe("c1");
  });

  it("десятый Раунд того же боя — срок истёк, хотя время стоит", async () => {
    const actor = mockActor();
    await startEyeOfChallenge(actor, { targetName: "Цель", worldTime: 0, combat: combat("c1", 1) });
    const info = eyeOfChallengeInfo(actor);
    expect(isEyeOfChallengeExpired(info, { worldTime: 0, combat: combat("c1", 10) })).toBe(false);
    expect(isEyeOfChallengeExpired(info, { worldTime: 0, combat: combat("c1", 11) })).toBe(true);
  });

  it("Раунды ЧУЖОГО боя срок не двигают", async () => {
    const actor = mockActor();
    await startEyeOfChallenge(actor, { targetName: "Цель", worldTime: 0, combat: combat("c1", 1) });
    const info = eyeOfChallengeInfo(actor);
    expect(isEyeOfChallengeExpired(info, { worldTime: 0, combat: combat("c2", 99) })).toBe(false);
  });

  it("вне боя работает прежний срок по времени", async () => {
    const actor = mockActor();
    await startEyeOfChallenge(actor, { targetName: "Цель", worldTime: 1000 });
    const info = eyeOfChallengeInfo(actor);
    expect(info.deadlineRound).toBe(null);
    expect(isEyeOfChallengeExpired(info, { worldTime: 1059, combat: null })).toBe(false);
    expect(isEyeOfChallengeExpired(info, { worldTime: 1060, combat: null })).toBe(true);
    // и голое число, как звали раньше
    expect(isEyeOfChallengeExpired(info, 1060)).toBe(true);
  });
});

describe("срок Ока Вызова живёт в одном месте", () => {
  it("скрипты предмета зовут модуль, а не пишут флаг и «+60» руками", () => {
    const doc = JSON.parse(fs.readFileSync(path.join(root,
      "packs-src/mutations/Дары_Богов/Кхорн/Eye_of_Challenge___Око_Вызова_bgJDJagGDH4WqPZH.json"), "utf8"));
    const code = doc.flags["warhammer-dbc"].mechanics
      .flatMap(g => g.entries).map(e => e.code).filter(Boolean).join("\n");
    expect(code).toContain("startEyeOfChallenge(actor");
    expect(code).toContain("clearEyeOfChallenge(actor)");
    expect(code, "своя копия срока вернулась").not.toContain("worldTime + 60");
    expect(code, "флаг пишется мимо модуля").not.toMatch(/setFlag\([^)]*eyeOfChallenge/);
  });
});
