// test/combat/bone-head.test.mjs
//
// BONE-Head Огрина и поле Haywire — обвязка под Foundry (combat/bone-head.mjs):
// попадание Haywire пишет мощность поля, 7+ — Ступор на 1 Раунд, Раунды боя и
// прокрутка Календаря гасят поле по 2 за Раунд, вход в ауру Дискорданта —
// тоже 7+. Чистая часть — test/rules/bone-head.test.mjs.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import {
  applyHaywireToBoneHead, decayHaywireFields, haywireFieldClock, onDiscordantFieldEntered, onDiscordantFieldLeft
} from "../../module/combat/bone-head.mjs";
import { HAYWIRE_FIELD_FLAG } from "../../module/rules/bone-head.mjs";

const boneHead = { type: "trait", name: "BONE-Head / Костеголов", system: {} };

function makeActor(items = [boneHead], field = 0) {
  const flags = field ? { [HAYWIRE_FIELD_FLAG]: field } : {};
  const effects = [];
  const actor = {
    name: "Огрин", items, effects,
    flags: { "warhammer-dbc": flags },
    system: { conditions: {}, characteristics: {} },
    getFlag: (_s, k) => flags[k],
    createEmbeddedDocuments: async (_t, docs) => { effects.push(...docs); return docs; },
    update: async data => {
      for (const [path, value] of Object.entries(data)) {
        const m = path.match(/^flags\.warhammer-dbc\.(-=)?(.+)$/);
        if (m) { if (m[1]) delete flags[m[2]]; else flags[m[2]] = value; continue; }
        const parts = path.split(".");
        let t = actor;
        for (const p of parts.slice(0, -1)) t = (t[p] ??= {});
        t[parts.at(-1)] = value;
      }
    }
  };
  return actor;
}

beforeEach(() => resetCaptured());

describe("applyHaywireToBoneHead: попадание Haywire", () => {
  it("мощность 5: поле записано, Ступора нет, строка объясняет сбой импланта", async () => {
    const a = makeActor();
    const note = await applyHaywireToBoneHead(a, 5);
    expect(a.getFlag("warhammer-dbc", HAYWIRE_FIELD_FLAG)).toBe(5);
    expect(a.system.conditions.dazed).toBeUndefined();
    expect(note).toContain("BONE-Head");
    expect(note).toContain("тестов I");
  });

  it("мощность 7+: Ступор на 1 Раунд", async () => {
    const a = makeActor();
    const note = await applyHaywireToBoneHead(a, 8);
    expect(a.system.conditions.dazed).toBe(true);
    expect(a.effects[0]?.statuses).toContain("dazed");
    expect(note).toContain("Ступор");
  });

  it("мощность 2: импланту всё равно, поле не записывается", async () => {
    const a = makeActor();
    expect(await applyHaywireToBoneHead(a, 2)).toBe("");
    expect(a.getFlag("warhammer-dbc", HAYWIRE_FIELD_FLAG)).toBeUndefined();
  });

  it("не Огрин — ничего", async () => {
    const a = makeActor([]);
    expect(await applyHaywireToBoneHead(a, 9)).toBe("");
    expect(a.getFlag("warhammer-dbc", HAYWIRE_FIELD_FLAG)).toBeUndefined();
  });

  it("слабее уже стоящего поля — не ослабляет", async () => {
    const a = makeActor([boneHead], 6);
    await applyHaywireToBoneHead(a, 4);
    expect(a.getFlag("warhammer-dbc", HAYWIRE_FIELD_FLAG)).toBe(6);
  });
});

describe("затухание поля", () => {
  it("Раунд боя: −2 за Раунд, до нуля — флаг снимается", async () => {
    const a = makeActor([boneHead], 5);
    const combat = { previous: { round: 1 }, combatants: [{ actor: a }] };
    await decayHaywireFields(combat, { round: 2 });
    expect(a.getFlag("warhammer-dbc", HAYWIRE_FIELD_FLAG)).toBe(3);
    await decayHaywireFields({ ...combat, previous: { round: 2 } }, { round: 4 });
    expect(a.getFlag("warhammer-dbc", HAYWIRE_FIELD_FLAG)).toBeUndefined();
  });

  it("откат Раунда назад поле не трогает", async () => {
    const a = makeActor([boneHead], 5);
    await decayHaywireFields({ previous: { round: 3 }, combatants: [{ actor: a }] }, { round: 2 });
    expect(a.getFlag("warhammer-dbc", HAYWIRE_FIELD_FLAG)).toBe(5);
  });

  it("Календарь: 10 секунд — 2 Раунда по 5 с — −4", async () => {
    const a = makeActor([boneHead], 7);
    await haywireFieldClock(a, { from: 100, to: 110 });
    expect(a.getFlag("warhammer-dbc", HAYWIRE_FIELD_FLAG)).toBe(3);
  });
});

describe("вход в поле Дискорданта (Haywire 7)", () => {
  const marker = parent => ({ name: "In the Discordant's Field / В Поле Дискорданта", type: "trait", parent });

  it("Огрин — Ступор на 1 Раунд и карточка", async () => {
    const a = makeActor();
    await onDiscordantFieldEntered(marker(a));
    expect(a.system.conditions.dazed).toBe(true);
    expect(captured.chat[0].content).toContain("BONE-Head");
  });

  it("не Огрин, или не та Черта — ничего", async () => {
    const human = makeActor([]);
    await onDiscordantFieldEntered(marker(human));
    expect(human.system.conditions.dazed).toBeUndefined();
    const a = makeActor();
    await onDiscordantFieldEntered({ name: "Fanatic / Фанатик", type: "trait", parent: a });
    expect(a.system.conditions.dazed).toBeUndefined();
    expect(captured.chat).toHaveLength(0);
  });
});

describe("выход из поля Дискорданта снимает Ступор от поля (wdbc-7bm4z)", () => {
  const marker = parent => ({ name: "In the Discordant's Field / В Поле Дискорданта", type: "trait", parent });

  it("вышел раньше, чем прошёл Раунд — Ступор снят, карточка", async () => {
    const a = makeActor();
    // Эффект Ступора в фикстуре снимается через delete() — как настоящий ActiveEffect.
    a.createEmbeddedDocuments = async (_t, docs) => { docs.forEach(d => { d.delete = async () => {}; }); a.effects.push(...docs); return docs; };
    globalThis.game.time = { worldTime: 1000 };
    await onDiscordantFieldEntered(marker(a));
    expect(a.system.conditions.dazed).toBe(true);
    resetCaptured();
    await onDiscordantFieldLeft(marker(a));
    expect(a.system.conditions.dazed).toBe(false);
    expect(captured.chat.at(-1).content).toContain("вышел из поля Дискорданта");
  });

  it("вышел, когда Раунд уже прошёл — чужой Ступор не трогаем", async () => {
    const a = makeActor();
    globalThis.game.time = { worldTime: 1000 };
    await onDiscordantFieldEntered(marker(a));
    globalThis.game.time = { worldTime: 1000 + 600 };
    resetCaptured();
    await onDiscordantFieldLeft(marker(a));
    expect(a.system.conditions.dazed).toBe(true);
    expect(captured.chat).toHaveLength(0);
  });

  it("не Огрин или нет метки о Ступоре от поля — ничего", async () => {
    const human = makeActor([]);
    await onDiscordantFieldLeft(marker(human));
    const a = makeActor();
    a.system.conditions.dazed = true;
    await onDiscordantFieldLeft(marker(a));
    expect(a.system.conditions.dazed).toBe(true);
  });
});
