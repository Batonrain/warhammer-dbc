// test/combat/beastman-shaman.test.mjs
//
// module/combat/beastman-shaman.mjs (wdbc-xxb7) — триггеры Шамана
// Зверолюдей: Primal Howl, Warp-Tainted Aura, Rite of Self-Sacrifice,
// Hex-Marked Prey (Таланты) + Ritual Bloodletting (Черта). Проверяется то,
// что модуль реально пишет актору — троттлинг, Ярость, Аблативные Раны,
// Усталость, Порча, самоурон, флаги меток; не проверяется текст карточки
// в чат построчно (см. заголовок модуля — часть эффектов информационная).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, afterEach } from "vitest";
import {
  activeGodBranch, primalHowlAvailable, applyPrimalHowl,
  warpTaintedAuraAvailable, applyWarpTaintedAura,
  riteOfSelfSacrificeAvailable, applyRiteOfSelfSacrifice,
  hexMarkedPreyAvailable, applyHexMarkedPrey, HEX_MARK_FLAG,
  ritualBloodlettingAvailable, applyRitualBloodletting
} from "../../module/combat/beastman-shaman.mjs";

function mutableActor({ name = "Шаман", items = [], patronGod = "", extra = {} } = {}) {
  const flags = {};
  const data = {
    name, items,
    system: {
      patronGod, corruptionBonus: 3,
      characteristics: { wp: { total: 40 }, fel: { bonus: 3 } },
      wounds: { value: 10, critical: 0, max: 14, ablative: 0, ablativeMax: 0 },
      fatigue: { value: 0 }, corruption: { value: 0 },
      psyker: { rating: 4 }, inRage: false,
      ...extra
    },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; return value; },
    update: async patch => {
      for (const [path, value] of Object.entries(patch)) {
        const parts = path.split(".");
        let cur = data;
        for (const p of parts.slice(0, -1)) { cur[p] ??= {}; cur = cur[p]; }
        cur[parts.at(-1)] = value;
      }
    }
  };
  return data;
}

function shamanWithTalent(name, extra = {}) {
  return mutableActor({ items: [{ type: "talent", name }], ...extra });
}
function shamanWithTrait(name, extra = {}) {
  return mutableActor({ items: [{ type: "trait", name }], ...extra });
}

function token(id, actor, disposition = 1) {
  return { id, x: 0, y: 0, width: 1, height: 1, hidden: false, actor, disposition };
}
function scene(tokens) { return { grid: { size: 100, distance: 2 }, tokens: { contents: tokens } }; }

afterEach(() => { resetCaptured(); globalThis.game.combat = undefined; globalThis.game.time = undefined; });

describe("activeGodBranch", () => {
  it("известный Бог — свой ключ", () => {
    expect(activeGodBranch(mutableActor({ patronGod: "khorne" }))).toBe("khorne");
  });
  it("undivided/пусто/неизвестное — базовая ветка", () => {
    expect(activeGodBranch(mutableActor({ patronGod: "undivided" }))).toBe("");
    expect(activeGodBranch(mutableActor({ patronGod: "" }))).toBe("");
    expect(activeGodBranch(mutableActor({ patronGod: "чужой-бог" }))).toBe("");
  });
});

describe("Primal Howl", () => {
  it("недоступен без Таланта", () => {
    expect(primalHowlAvailable(mutableActor())).toBe(false);
  });
  it("доступен раз за бой", async () => {
    globalThis.game.combat = { id: "c1" };
    const a = shamanWithTalent("Primal Howl / Первобытный Вой");
    expect(primalHowlAvailable(a)).toBe(true);
    await applyPrimalHowl(a, token("c", a));
    expect(primalHowlAvailable(a)).toBe(false);
  });

  it("Кхорн: союзники в радиусе входят в Ярость", async () => {
    globalThis.game.combat = { id: "c1" };
    const a = shamanWithTalent("Primal Howl / Первобытный Вой", { patronGod: "khorne" });
    const casterT = token("c", a, 1);
    const ally = mutableActor({ name: "Союзник" });
    const s = scene([casterT, token("t1", ally, 1)]);
    casterT.parent = s;

    await applyPrimalHowl(a, casterT);
    expect(ally.system.inRage).toBe(true);
  });

  it("Нургл: союзники получают аблативные раны", async () => {
    globalThis.game.combat = { id: "c1" };
    const a = shamanWithTalent("Primal Howl / Первобытный Вой", { patronGod: "nurgle" });
    const casterT = token("c", a, 1);
    const ally = mutableActor({ name: "Союзник" });
    const s = scene([casterT, token("t1", ally, 1)]);
    casterT.parent = s;

    captured.dice = [6];
    await applyPrimalHowl(a, casterT);
    expect(ally.system.wounds.ablative).toBe(6);
    expect(ally.system.wounds.ablativeMax).toBeGreaterThanOrEqual(6);
  });

  it("Слаанеш: снимает 1 Усталость союзникам", async () => {
    globalThis.game.combat = { id: "c1" };
    const a = shamanWithTalent("Primal Howl / Первобытный Вой", { patronGod: "slaanesh" });
    const casterT = token("c", a, 1);
    const ally = mutableActor({ name: "Союзник", extra: { fatigue: { value: 2 } } });
    const s = scene([casterT, token("t1", ally, 1)]);
    casterT.parent = s;

    await applyPrimalHowl(a, casterT);
    expect(ally.system.fatigue.value).toBe(1);
  });

  it("враги в радиусе не задеты применением к союзникам (Кхорн)", async () => {
    globalThis.game.combat = { id: "c1" };
    const a = shamanWithTalent("Primal Howl / Первобытный Вой", { patronGod: "khorne" });
    const casterT = token("c", a, 1);
    const enemy = mutableActor({ name: "Враг" });
    const s = scene([casterT, token("t1", enemy, -1)]);
    casterT.parent = s;

    await applyPrimalHowl(a, casterT);
    expect(enemy.system.inRage).toBe(false);
  });
});

describe("Warp-Tainted Aura", () => {
  it("недоступна без Таланта", () => {
    expect(warpTaintedAuraAvailable(mutableActor())).toBe(false);
  });

  it("доступна раз в час (worldTime)", async () => {
    globalThis.game.time = { worldTime: 0 };
    const a = shamanWithTalent("Warp-Tainted Aura / Аура Скверны");
    expect(warpTaintedAuraAvailable(a)).toBe(true);
    const casterT = token("c", a, 1);
    casterT.parent = scene([casterT]);
    await applyWarpTaintedAura(a, casterT);
    expect(warpTaintedAuraAvailable(a)).toBe(false);
    globalThis.game.time.worldTime = 3600;
    expect(warpTaintedAuraAvailable(a)).toBe(true);
  });

  it("провалившие тест враги получают +1 Порчу", async () => {
    globalThis.game.time = { worldTime: 0 };
    const a = shamanWithTalent("Warp-Tainted Aura / Аура Скверны");
    const casterT = token("c", a, 1);
    const enemy = mutableActor({ name: "Враг", extra: { characteristics: { wp: { total: 10 } } } });
    const s = scene([casterT, token("t1", enemy, -1)]);
    casterT.parent = s;

    captured.nextRoll = 90; // провал против низкого порога (10-10=0)
    await applyWarpTaintedAura(a, casterT);
    expect(enemy.system.corruption.value).toBe(1);
  });

  it("успешные враги не получают Порчу", async () => {
    globalThis.game.time = { worldTime: 0 };
    const a = shamanWithTalent("Warp-Tainted Aura / Аура Скверны");
    const casterT = token("c", a, 1);
    const enemy = mutableActor({ name: "Враг", extra: { characteristics: { wp: { total: 80 } } } });
    const s = scene([casterT, token("t1", enemy, -1)]);
    casterT.parent = s;

    captured.nextRoll = 5; // успех против высокого порога
    await applyWarpTaintedAura(a, casterT);
    expect(enemy.system.corruption.value).toBe(0);
  });
});

describe("Rite of Self-Sacrifice", () => {
  it("недоступен без Таланта", () => {
    expect(riteOfSelfSacrificeAvailable(mutableActor())).toBe(false);
  });

  it("наносит себе урон 1d5+1 непоглощаемого R Dmg", async () => {
    const a = shamanWithTalent("Rite of Self-Sacrifice / Ритуал Самопожертвования");
    captured.dice = [3]; // 1d5 = 3 → total 4
    await applyRiteOfSelfSacrifice(a);
    expect(a.system.wounds.value).toBe(6); // 10 - 4
  });

  it("Кхорн: доступен как обычно, урон себе применяется", async () => {
    const a = shamanWithTalent("Rite of Self-Sacrifice / Ритуал Самопожертвования", { patronGod: "khorne" });
    captured.dice = [2]; // total 3
    await applyRiteOfSelfSacrifice(a);
    expect(a.system.wounds.value).toBe(7);
  });
});

describe("Hex-Marked Prey", () => {
  it("недоступен без Таланта", () => {
    expect(hexMarkedPreyAvailable(mutableActor())).toBe(false);
  });

  it("без цели — предупреждение, ничего не происходит", async () => {
    const a = shamanWithTalent("Hex-Marked Prey / Проклятая Метка");
    await applyHexMarkedPrey(a, null);
    expect(a.getFlag("warhammer-dbc", HEX_MARK_FLAG)).toBeUndefined();
  });

  it("успех шамана против провала цели — метка накладывается", async () => {
    const a = shamanWithTalent("Hex-Marked Prey / Проклятая Метка", { patronGod: "tzeentch" });
    const target = mutableActor({ name: "Жертва" });
    captured.dice = [10, 90]; // шаман 10 (успех vs 40), цель 90 (провал vs 50)
    await applyHexMarkedPrey(a, target);
    const mark = a.getFlag("warhammer-dbc", HEX_MARK_FLAG);
    expect(mark).toMatchObject({ targetName: "Жертва", god: "tzeentch" });
  });

  it("провал шамана — метка не накладывается", async () => {
    const a = shamanWithTalent("Hex-Marked Prey / Проклятая Метка");
    const target = mutableActor({ name: "Жертва" });
    captured.dice = [95, 10]; // шаман проваливает, цель проходит
    await applyHexMarkedPrey(a, target);
    expect(a.getFlag("warhammer-dbc", HEX_MARK_FLAG)).toBeUndefined();
  });
});

describe("Ritual Bloodletting", () => {
  it("недоступен без Черты", () => {
    expect(ritualBloodlettingAvailable(mutableActor())).toBe(false);
  });

  it("ставит информационный флаг бонуса", async () => {
    const a = shamanWithTrait("Ritual Bloodletting / Ритуал Кровопускания");
    const casterT = token("c", a, 1);
    casterT.parent = scene([casterT]);
    await applyRitualBloodletting(a, casterT);
    expect(a.getFlag("warhammer-dbc", "ritualBloodletting")).toMatchObject({ bonus: 5, active: true });
  });

  it("особо важная жертва — бонус удвоен (10)", async () => {
    const a = shamanWithTrait("Ritual Bloodletting / Ритуал Кровопускания");
    const casterT = token("c", a, 1);
    casterT.parent = scene([casterT]);
    await applyRitualBloodletting(a, casterT, { importantKill: true });
    expect(a.getFlag("warhammer-dbc", "ritualBloodletting")).toMatchObject({ bonus: 10 });
  });
});
