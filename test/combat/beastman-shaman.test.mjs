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
  activeGodBranch, primalHowlAvailable, applyPrimalHowl, clearBeastmanShamanTempEffects,
  warpTaintedAuraAvailable, applyWarpTaintedAura,
  riteOfSelfSacrificeAvailable, applyRiteOfSelfSacrifice,
  hexMarkedPreyAvailable, applyHexMarkedPrey, HEX_MARK_FLAG, clearHexMarkedPreyMarks,
  boneRuneEtchingAvailable, showBoneRuneEtchingText,
  ritualBloodlettingAvailable, applyRitualBloodletting,
  hasSymbolOfPower, applySymbolOfPowerGrant
} from "../../module/combat/beastman-shaman.mjs";

let _uuidSeq = 0;

function mutableActor({ name = "Шаман", items = [], patronGod = "", extra = {} } = {}) {
  const flags = {};
  const effects = [];
  const data = {
    name, items, uuid: `Actor.${name}-${_uuidSeq++}`, img: "icons/svg/upgrade.svg",
    system: {
      patronGod, corruptionBonus: 3,
      characteristics: { wp: { total: 40 }, fel: { bonus: 3 } },
      wounds: { value: 10, critical: 0, max: 14, ablative: 0, ablativeMax: 0 },
      fatigue: { value: 0 }, corruption: { value: 0 },
      conditions: {},
      psyker: { rating: 4 }, inRage: false,
      ...extra
    },
    effects: { contents: effects },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; return value; },
    unsetFlag: async (scope, key) => { delete flags[`${scope}.${key}`]; },
    createEmbeddedDocuments: async (type, docs) => {
      if (type === "ActiveEffect") {
        const created = docs.map((d, i) => ({
          id: `fx${effects.length + i}`, name: d.name, img: d.img,
          system: d.system, flags: d.flags,
          getFlag: (scope, key) => d.flags?.[scope]?.[key]
        }));
        effects.push(...created);
        return created;
      }
      if (type === "Item") {
        const created = docs.map((d, i) => ({
          id: `it${data.items.length + i}`, ...d,
          // Реальный Item несёт getFlag — grantTempTestMod/
          // clearBeastmanShamanTempEffects читают TEMP_FLAG именно так, не
          // напрямую через .flags (module/combat/beastman-shaman.mjs).
          getFlag: (scope, key) => d.flags?.[scope]?.[key]
        }));
        data.items.push(...created);
        return created;
      }
      return [];
    },
    deleteEmbeddedDocuments: async (type, ids) => {
      if (type === "ActiveEffect") {
        for (const id of ids) {
          const idx = effects.findIndex(fx => fx.id === id);
          if (idx >= 0) effects.splice(idx, 1);
        }
      } else if (type === "Item") {
        data.items = data.items.filter(i => !ids.includes(i.id));
      }
    },
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
    // Реальный временный ActiveEffect (не информационный флаг) — S/WS.
    const fx = ally.effects.contents.find(f => f.name.includes("Первобытный Вой"));
    expect(fx).toBeDefined();
    const keys = fx.system.changes.map(c => c.key);
    expect(keys).toContain("system.characteristics.s.totalFx");
    expect(keys).toContain("system.characteristics.ws.totalFx");
    expect(fx.flags["warhammer-dbc"].beastmanShamanTemp).toBe(a.uuid);
  });

  it("персонаж получает временный Fear(+1) как реальный ActiveEffect", async () => {
    globalThis.game.combat = { id: "c1" };
    const a = shamanWithTalent("Primal Howl / Первобытный Вой");
    const casterT = token("c", a, 1);
    casterT.parent = scene([casterT]);
    await applyPrimalHowl(a, casterT);
    const fx = a.effects.contents.find(f => f.name.includes("Fear"));
    expect(fx?.system.changes).toEqual([expect.objectContaining({ key: "system.fearRating", type: "add", value: 1 })]);
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

describe("clearBeastmanShamanTempEffects", () => {
  it("снимает эффекты, выданные ИМЕННО этим шаманом, не трогая чужие", async () => {
    globalThis.game.combat = { id: "c1" };
    const shaman = shamanWithTalent("Primal Howl / Первобытный Вой");
    const other = mutableActor({ name: "Другой шаман" });
    const ally = mutableActor({ name: "Союзник" });
    const casterT = token("c", shaman, 1);
    casterT.parent = scene([casterT, token("t1", ally, 1)]);

    await applyPrimalHowl(shaman, casterT);
    expect(ally.effects.contents.length).toBeGreaterThan(0);
    // Чужой эффект (другой источник) не должен быть снят.
    await ally.createEmbeddedDocuments("ActiveEffect", [{
      name: "Чужой эффект", img: "", system: { changes: [] },
      flags: { "warhammer-dbc": { beastmanShamanTemp: other.uuid } }
    }]);
    const before = ally.effects.contents.length;

    const combat = { combatants: [{ actor: shaman }, { actor: ally }] };
    await clearBeastmanShamanTempEffects(combat, shaman);

    expect(ally.effects.contents.length).toBe(before - 1);
    expect(ally.effects.contents.every(fx => fx.flags["warhammer-dbc"].beastmanShamanTemp !== shaman.uuid)).toBe(true);
    expect(ally.effects.contents.some(fx => fx.flags["warhammer-dbc"].beastmanShamanTemp === other.uuid)).toBe(true);
  });

  it("безопасно звать без боя/шамана", async () => {
    await expect(clearBeastmanShamanTempEffects(null, null)).resolves.toBeUndefined();
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

  it("Нургл: провалившие враги получают реальное Состояние «Удушье»", async () => {
    globalThis.game.time = { worldTime: 0 };
    const a = shamanWithTalent("Warp-Tainted Aura / Аура Скверны", { patronGod: "nurgle" });
    const casterT = token("c", a, 1);
    const enemy = mutableActor({ name: "Враг", extra: { characteristics: { wp: { total: 10 } } } });
    casterT.parent = scene([casterT, token("t1", enemy, -1)]);

    captured.nextRoll = 90;
    await applyWarpTaintedAura(a, casterT);
    expect(enemy.system.conditions.suffocating).toBe(true);
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

  // wdbc-j0ip: союзники в ауре получают РЕАЛЬНЫЙ +20 к тестам Стойкости
  // (Сопротивления) — не текст в чат-карточке, а временная Черта с записью
  // Конструктора kind:"testMod" (grantTempTestMod).
  it("союзники в ауре получают временную Черту с testMod +20 к Стойкости", async () => {
    globalThis.game.time = { worldTime: 0 };
    const a = shamanWithTalent("Warp-Tainted Aura / Аура Скверны");
    const casterT = token("c", a, 1);
    const ally = mutableActor({ name: "Союзник" });
    casterT.parent = scene([casterT, token("t1", ally, 1)]);

    captured.nextRoll = 5;
    await applyWarpTaintedAura(a, casterT);

    const granted = ally.items.find(i => i.flags?.["warhammer-dbc"]?.mechanics);
    expect(granted).toBeDefined();
    expect(granted.flags["warhammer-dbc"].beastmanShamanTemp).toBe(a.uuid);
    const [group] = granted.flags["warhammer-dbc"].mechanics;
    expect(group.operator).toBe("AND");
    const [entry] = group.entries;
    expect(entry).toMatchObject({ kind: "testMod", modScope: "char", rerollChar: "t", value: 20 });
  });

  // wdbc-elng: та же инфраструктура, знак/фильтр в другую сторону — враги
  // НЕ получают этот бонус (только союзники), мутационная проверка фильтра.
  it("враги в ауре НЕ получают бонус Сопротивления союзников", async () => {
    globalThis.game.time = { worldTime: 0 };
    const a = shamanWithTalent("Warp-Tainted Aura / Аура Скверны");
    const casterT = token("c", a, 1);
    const enemy = mutableActor({ name: "Враг", extra: { characteristics: { wp: { total: 80 } } } });
    casterT.parent = scene([casterT, token("t1", enemy, -1)]);

    captured.nextRoll = 5; // успех — не влияет на проверку testMod-гранта
    await applyWarpTaintedAura(a, casterT);

    expect(enemy.items.some(i => i.flags?.["warhammer-dbc"]?.mechanics)).toBe(false);
  });

  it("бонус реально резолвится в тесте Стойкости через resolveTest (не только лежит на предмете)", async () => {
    globalThis.game.time = { worldTime: 0 };
    const a = shamanWithTalent("Warp-Tainted Aura / Аура Скверны");
    const casterT = token("c", a, 1);
    const ally = mutableActor({ name: "Союзник" });
    casterT.parent = scene([casterT, token("t1", ally, 1)]);

    captured.nextRoll = 5;
    await applyWarpTaintedAura(a, casterT);

    const { resolveTest } = await import("../../module/rules/resolve-test.mjs");
    const { mods } = resolveTest({ actor: ally, char: "t" });
    expect(mods).toContainEqual(expect.objectContaining({ value: 20 }));
  });

  it("clearBeastmanShamanTempEffects снимает и временную Черту testMod (Item), не только ActiveEffect", async () => {
    globalThis.game.time = { worldTime: 0 };
    globalThis.game.combat = { id: "c1" };
    const a = shamanWithTalent("Warp-Tainted Aura / Аура Скверны");
    const casterT = token("c", a, 1);
    const ally = mutableActor({ name: "Союзник" });
    casterT.parent = scene([casterT, token("t1", ally, 1)]);

    captured.nextRoll = 5;
    await applyWarpTaintedAura(a, casterT);
    expect(ally.items.some(i => i.flags?.["warhammer-dbc"]?.mechanics)).toBe(true);

    const combat = { combatants: [{ actor: a }, { actor: ally }] };
    await clearBeastmanShamanTempEffects(combat, a);

    expect(ally.items.some(i => i.flags?.["warhammer-dbc"]?.mechanics)).toBe(false);
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

  it("успех шамана против провала цели — метка накладывается НА ЦЕЛЬ", async () => {
    const a = shamanWithTalent("Hex-Marked Prey / Проклятая Метка", { patronGod: "tzeentch" });
    const target = mutableActor({ name: "Жертва" });
    captured.dice = [10, 90]; // шаман 10 (успех vs 40), цель 90 (провал vs 50)
    await applyHexMarkedPrey(a, target);
    const mark = target.getFlag("warhammer-dbc", HEX_MARK_FLAG);
    expect(mark).toMatchObject({ shamanUuid: a.uuid, god: "tzeentch" });
  });

  it("провал шамана — метка не накладывается", async () => {
    const a = shamanWithTalent("Hex-Marked Prey / Проклятая Метка");
    const target = mutableActor({ name: "Жертва" });
    captured.dice = [95, 10]; // шаман проваливает, цель проходит
    await applyHexMarkedPrey(a, target);
    expect(target.getFlag("warhammer-dbc", HEX_MARK_FLAG)).toBeUndefined();
  });

  it("clearHexMarkedPreyMarks снимает метку со всех комбатантов боя", async () => {
    const a = shamanWithTalent("Hex-Marked Prey / Проклятая Метка");
    const target = mutableActor({ name: "Жертва" });
    captured.dice = [10, 90];
    await applyHexMarkedPrey(a, target);
    expect(target.getFlag("warhammer-dbc", HEX_MARK_FLAG)).toBeDefined();

    await clearHexMarkedPreyMarks({ combatants: [{ actor: a }, { actor: target }] });
    expect(target.getFlag("warhammer-dbc", HEX_MARK_FLAG)).toBeUndefined();
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

describe("Bone-Rune Etching", () => {
  it("недоступна без Таланта", () => {
    expect(boneRuneEtchingAvailable(mutableActor())).toBe(false);
  });
  it("доступна с Талантом, не требует троттлинга/боя", () => {
    expect(boneRuneEtchingAvailable(shamanWithTalent("Bone-Rune Etching / Костяная Рунопись"))).toBe(true);
  });
  it("showBoneRuneEtchingText не бросает без god-ветки", async () => {
    const a = shamanWithTalent("Bone-Rune Etching / Костяная Рунопись");
    await expect(showBoneRuneEtchingText(a)).resolves.toBeUndefined();
  });
});

function traitPack(entries) {
  return {
    getIndex: async () => entries,
    getDocument: async id => {
      const e = entries.find(x => x._id === id);
      return e ? { ...e, toObject: () => ({ ...e }) } : null;
    }
  };
}

describe("Symbol of Power — applySymbolOfPowerGrant", () => {
  it("hasSymbolOfPower определяет владение Чертой", () => {
    expect(hasSymbolOfPower(shamanWithTrait("Symbol of Power / Символ Власти"))).toBe(true);
    expect(hasSymbolOfPower(mutableActor())).toBe(false);
  });

  it("заменяет Natural Weapons на Deadly Natural Weapons и добавляет трейт рогов", async () => {
    globalThis.game.packs = new Map([
      ["warhammer-dbc.traits", traitPack([
        { _id: "d1", name: "Deadly Natural Weapons / Смертельное Естественное Оружие", system: { hasRating: false, rating: 0 } }
      ])]
    ]);
    const a = shamanWithTrait("Symbol of Power / Символ Власти", { extra: { psyker: { rating: 5 } } });
    a.items = [
      { id: "nw1", type: "trait", name: "Natural Weapons / Естественное Оружие" },
      ...a.items
    ];

    await applySymbolOfPowerGrant(a);

    expect(a.items.some(i => i.id === "nw1")).toBe(false); // Natural Weapons снят
    const horns = a.items.find(i => i.name?.includes("(Рога)"));
    expect(horns?.system?.rating).toBe(5);
  });

  it("снимает Stepchildren of the Gods", async () => {
    globalThis.game.packs = new Map();
    const a = shamanWithTrait("Symbol of Power / Символ Власти");
    a.items = [{ id: "sc1", type: "trait", name: "Stepchildren of the Gods / Пасынки Богов" }, ...a.items];
    await applySymbolOfPowerGrant(a);
    expect(a.items.some(i => i.id === "sc1")).toBe(false);
  });

  it("идемпотентна — повторный вызов ничего не делает второй раз", async () => {
    globalThis.game.packs = new Map();
    const a = shamanWithTrait("Symbol of Power / Символ Власти");
    a.items = [{ id: "sc1", type: "trait", name: "Stepchildren of the Gods / Пасынки Богов" }, ...a.items];
    await applySymbolOfPowerGrant(a);
    a.items.push({ id: "sc1", type: "trait", name: "Stepchildren of the Gods / Пасынки Богов" }); // будто снова появился
    await applySymbolOfPowerGrant(a);
    expect(a.items.some(i => i.id === "sc1")).toBe(true); // второй вызов не тронул — флаг уже стоял
  });
});
