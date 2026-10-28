// Штраф пассажира верхом на ВСЕ физические тесты (Sahara trait-stand п.1+3,
// решение владельца 26.10.2026).
//
// Книга (корбук, «Пассажиры», стр. 477): «Пассажир получает дополнительно −10 на
// все физические действия с байка (поднимающийся до −20 на скорости Натиска или
// Бега)». Рысь (Талант Всадника): «скакун или байк … не дают штрафов на
// действия всадника или пассажира» — Рысь ведущего всадника снимает и этот штраф.
//
// Список «физических» тестов не ведётся именами: атака — всегда; Навык — по
// характеристике из данных (constants/skills.mjs: Ловкость/Сила/Стойкость);
// тест самой Характеристики — Ловкость/Сила (Стойкость там — стойкость к яду
// и болезни, не действие).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { passengerTestMod, isPhysicalTest } from "../../module/rules/mount.mjs";
import { situationalRules } from "../../module/rules/situational.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../../module/constants/skills.mjs";

const talent = name => ({ type: "talent", name, system: {}, flags: {} });
const horse = { uuid: "Actor.horse", type: "character", name: "Конь", system: {}, items: [] };
const lead = (items = []) => ({ uuid: "Actor.lead", type: "character", name: "Ведущий", items,
  system: { mount: { uuid: "Actor.horse", role: "rider", speed: "half" } } });
const pass = (speed = "half", items = []) => ({ uuid: "Actor.pass", type: "character", name: "Пассажир", items,
  system: { fatigue: { value: 0 }, mount: { uuid: "Actor.horse", role: "passenger", speed } } });
const world = (...rest) => [horse, ...rest];

describe("какие тесты физические — по данным, а не по списку имён", () => {
  it("атака — всегда; Навык — по характеристике Навыка из constants/skills.mjs", () => {
    expect(isPhysicalTest({ kind: "attack", char: "ws" })).toBe(true);
    expect(isPhysicalTest({ kind: "attack", char: "bs" })).toBe(true);
    const all = { ...SKILLS_DEF, ...GROUP_SKILLS_DEF };
    for (const [key, def] of Object.entries(all)) {
      const ctx = SKILLS_DEF[key] ? { kind: "skill", skill: key, char: def.char } : { kind: "skill", group: key, char: def.char };
      expect(isPhysicalTest(ctx), `${key} (${def.char})`).toBe(["ag", "s", "t", "ws"].includes(def.char));
    }
    // Парирование (WS) — физическое действие пассажира, как и атака
    // (решение владельца 26.10.2026): Навыки на WS входят в список.
    expect(isPhysicalTest({ kind: "skill", skill: "parry", char: "ws" })).toBe(true);
    expect(isPhysicalTest({ kind: "skill", skill: "parry" })).toBe(true);
    // Акробатика/Атлетика — физические; Логика/Командование — нет.
    expect(isPhysicalTest({ kind: "skill", skill: "acrobatics", char: "ag" })).toBe(true);
    expect(isPhysicalTest({ kind: "skill", skill: "athletics", char: "s" })).toBe(true);
    expect(isPhysicalTest({ kind: "skill", skill: "logic", char: "int" })).toBe(false);
  });
  it("тест Характеристики: Ловкость и Сила — да; Стойкость и прочие — нет", () => {
    expect(isPhysicalTest({ kind: "skill", char: "ag" })).toBe(true);
    expect(isPhysicalTest({ kind: "skill", char: "s" })).toBe(true);
    expect(isPhysicalTest({ kind: "skill", char: "t" })).toBe(false);
    expect(isPhysicalTest({ kind: "skill", char: "wp" })).toBe(false);
  });
  it("Парирование пассажира получает штраф скорости; Рысь ведущего его снимает", () => {
    const p = pass("full"), a = world(lead(), p);
    expect(passengerTestMod(p, { kind: "skill", skill: "parry", char: "ws" }, { actors: a })).toBe(-10);
    expect(passengerTestMod(pass("charge"), { kind: "skill", skill: "parry", char: "ws" }, { actors: a })).toBe(-20);
    const t = lead([talent("Trot")]), p2 = pass("half");
    expect(passengerTestMod(p2, { kind: "skill", skill: "parry", char: "ws" }, { actors: world(t, p2) })).toBe(0);
  });
  it("Навык, брошенный не своей характеристикой, считается по той, что в броске", () => {
    expect(isPhysicalTest({ kind: "skill", skill: "acrobatics", char: "int" })).toBe(false);
    expect(isPhysicalTest({ kind: "skill", skill: "logic", char: "s" })).toBe(true);
  });
});

describe("passengerTestMod: штраф самого пассажира", () => {
  it("−10 на полудвижении, −20 на Натиске и Беге; не физический тест — 0", () => {
    const p = pass("half"), a = world(lead(), p);
    expect(passengerTestMod(p, { kind: "attack", char: "bs" }, { actors: a })).toBe(-10);
    expect(passengerTestMod(pass("charge"), { kind: "attack", char: "ws" }, { actors: a })).toBe(-20);
    expect(passengerTestMod(pass("run"), { kind: "skill", skill: "athletics", char: "s" }, { actors: a })).toBe(-20);
    expect(passengerTestMod(p, { kind: "skill", skill: "logic", char: "int" }, { actors: a })).toBe(0);
  });
  it("не пассажир (всадник) и не едущий — штрафа нет", () => {
    const a = world(lead(), pass());
    expect(passengerTestMod(a[1], { kind: "attack", char: "bs" }, { actors: a })).toBe(0);
    const foot = { uuid: "Actor.foot", items: [], system: {} };
    expect(passengerTestMod(foot, { kind: "attack", char: "bs" }, { actors: a })).toBe(0);
  });
  it("скакун не найден среди акторов — как на панели, считается, что не верхом", () => {
    expect(passengerTestMod(pass(), { kind: "attack", char: "bs" }, { actors: [] })).toBe(0);
  });
  it("Оруженосец смягчает штраф на 10", () => {
    const p = pass("half", [talent("Squire / Оруженосец")]), a = world(lead(), p);
    expect(passengerTestMod(p, { kind: "attack", char: "bs" }, { actors: a })).toBe(0);
    const q = pass("run", [talent("Squire / Оруженосец")]);
    expect(passengerTestMod(q, { kind: "attack", char: "bs" }, { actors: world(lead(), q) })).toBe(-10);
  });
});

describe("Рысь у ведущего снимает штраф пассажиру (п.1 тикета)", () => {
  it("Рысь у ведущего: на полудвижении и на месте штрафа нет; на Полном движении — есть", () => {
    const t = lead([talent("Trot / Рысь")]);
    for (const speed of ["still", "half"]) {
      const p = pass(speed), a = world(t, p);
      expect(passengerTestMod(p, { kind: "attack", char: "bs" }, { actors: a })).toBe(0);
    }
    const f = pass("full"), a2 = world(t, f);
    expect(passengerTestMod(f, { kind: "attack", char: "bs" }, { actors: a2 })).toBe(-10);
  });
  it("Рысь у самого пассажира тоже снимает; у чужого всадника на другом скакуне — нет", () => {
    const own = pass("half", [talent("Trot")]);
    expect(passengerTestMod(own, { kind: "attack", char: "bs" }, { actors: world(lead(), own) })).toBe(0);
    const stranger = { uuid: "Actor.s", items: [talent("Trot")], system: { mount: { uuid: "Actor.other", role: "rider" } } };
    const p = pass("half");
    expect(passengerTestMod(p, { kind: "attack", char: "bs" }, { actors: world(lead(), p, stranger) })).toBe(-10);
  });
});

describe("упаковка в конвейер: источник situational", () => {
  const withWorld = (actors, fn) => {
    const prev = globalThis.game;
    globalThis.game = { ...(prev ?? {}), actors };
    try { return fn(); } finally { globalThis.game = prev; }
  };

  it("запись situational.passenger — автоматический модификатор для атаки и физического Навыка", () => {
    const p = pass("half"), a = world(lead(), p);
    withWorld(a, () => {
      const rules = situationalRules(p, { kind: "attack", char: "bs" });
      const hit = rules.find(r => r.id === "situational.passenger");
      expect(hit?.effects[0]).toMatchObject({ kind: "rollBonus", target: "all", value: -10, auto: true });
      expect(situationalRules(p, { kind: "skill", skill: "acrobatics", char: "ag" })
        .some(r => r.id === "situational.passenger")).toBe(true);
      expect(situationalRules(p, { kind: "skill", skill: "logic", char: "int" })
        .some(r => r.id === "situational.passenger")).toBe(false);
    });
  });
  it("Парирование пассажира (тот же контекст, что собирает defense.mjs) получает штраф в autoMods", () => {
    const p = pass("half"), a = world(lead(), p);
    withWorld(a, () => {
      const r = resolveTest({ actor: p, kind: "skill", skill: "parry", char: "ws" });
      expect(r.autoMods.find(m => m.ruleId === "situational.passenger")?.value).toBe(-10);
    });
  });
  it("в итоговом resolveTest штраф лежит в autoMods; с Рысью ведущего — исчезает", () => {
    const p = pass("full"), a = world(lead(), p);
    withWorld(a, () => {
      const r = resolveTest({ actor: p, kind: "skill", skill: "athletics", char: "s" });
      expect(r.autoMods.find(m => m.ruleId === "situational.passenger")?.value).toBe(-10);
    });
    const t = lead([talent("Trot")]);
    const p2 = pass("half");
    withWorld(world(t, p2), () => {
      const r = resolveTest({ actor: p2, kind: "attack", char: "bs" });
      expect(r.autoMods.some(m => m.ruleId === "situational.passenger")).toBe(false);
    });
  });
});
