// test/sheets/dreadnought-panel.test.mjs
//
// wdbc-a7s: контекст панели «ЗДРАВОМЫСЛИЕ» на вкладке БОЙ. Видимость зависит от
// мира (кто-то должен держать этого персонажа пилотом), поэтому проверяется
// отдельно от derived-расчёта (test/documents/dreadnought-sanity.test.mjs),
// который зависит только от самого персонажа.

import { describe, it, expect } from "vitest";
import { dreadnoughtPanelContext } from "../../module/sheets/tabs/dreadnought-panel.mjs";

const pilot = (uuid, sanity = {}, items = [], over = {}) => ({
  type: "character", uuid, name: "Брат Кассий", items,
  system: { sanity: { value: 40, max: 58, thresholds: [], ...sanity }, characteristics: { wp: { bonus: 4 } }, ...over }
});
const dread = (pilotUuid, items = []) => ({
  type: "vehicle", uuid: "Actor.dread1", name: "Гнев Первого Легиона", items,
  system: { vehicleClass: "Дредноут", stations: [{ id: "s1", role: "pilot", uuid: pilotUuid }] }
});

describe("dreadnoughtPanelContext: когда панель скрыта", () => {
  it("персонаж, которого никто не держит пилотом", () => {
    const actors = [pilot("Actor.hero"), dread("")];
    expect(dreadnoughtPanelContext(actors[0], actors)).toEqual({ sanityAvailable: false });
  });

  it("не персонаж (сама техника, даже если она Дредноут)", () => {
    const d = dread("Actor.hero");
    expect(dreadnoughtPanelContext(d, [d])).toEqual({ sanityAvailable: false });
  });

  it("пустой список акторов мира", () => {
    const hero = pilot("Actor.hero");
    expect(dreadnoughtPanelContext(hero, [])).toEqual({ sanityAvailable: false });
  });
});

describe("dreadnoughtPanelContext: пилот показан верно", () => {
  it("значение/максимум/процент/имя Дредноута доходят до контекста", () => {
    const hero = pilot("Actor.hero", { value: 29, max: 58 });
    const actors = [hero, dread("Actor.hero")];
    const ctx = dreadnoughtPanelContext(hero, actors);

    expect(ctx.sanityAvailable).toBe(true);
    expect(ctx.sanity.value).toBe(29);
    expect(ctx.sanity.max).toBe(58);
    expect(ctx.sanity.pct).toBe(50);
    expect(ctx.sanity.dreadnoughtName).toBe("Гнев Первого Легиона");
  });

  it("уровень цвета обратный шкалам Безумия/Порчи: мало осталось — тревога", () => {
    const actors = h => [h, dread("Actor.hero")];
    expect(dreadnoughtPanelContext(pilot("Actor.hero", { value: 58, max: 58 }), actors(pilot("Actor.hero", { value: 58, max: 58 }))).sanity.level).toBe("ok");
    expect(dreadnoughtPanelContext(pilot("Actor.hero", { value: 25, max: 58 }), actors(pilot("Actor.hero", { value: 25, max: 58 }))).sanity.level).toBe("heavy");
    expect(dreadnoughtPanelContext(pilot("Actor.hero", { value: 5,  max: 58 }), actors(pilot("Actor.hero", { value: 5,  max: 58 }))).sanity.level).toBe("over");
  });

  it("сработавшие пороги приходят с короткими метками", () => {
    const hero = pilot("Actor.hero", { value: 35, max: 58, thresholds: [50, 40] });
    const ctx = dreadnoughtPanelContext(hero, [hero, dread("Actor.hero")]);
    expect(ctx.sanity.thresholds).toEqual([
      { value: 50, label: "провалы Навыков I/F" },
      { value: 40, label: "штраф на общение" }
    ]);
  });

  it("max 0 не делит на ноль", () => {
    const hero = pilot("Actor.hero", { value: 0, max: 0 });
    const ctx = dreadnoughtPanelContext(hero, [hero, dread("Actor.hero")]);
    expect(ctx.sanity.pct).toBe(0);
  });

  it("без Талантов восстановления кнопок нет", () => {
    const hero = pilot("Actor.hero");
    const ctx = dreadnoughtPanelContext(hero, [hero, dread("Actor.hero")]);
    expect(ctx.sanity.recoveries).toEqual([]);
  });

  it("Талант на листе даёт кнопку восстановления с ключом/меткой", () => {
    const hero = pilot("Actor.hero", {}, [{ type: "talent", name: "Triumph / Триумф" }]);
    const ctx = dreadnoughtPanelContext(hero, [hero, dread("Actor.hero")]);
    expect(ctx.sanity.recoveries).toEqual([
      { key: "triumph", label: "Триумф", hint: "добит сильный противник" }
    ]);
  });

  it("без Электростимуляторов на технике — блока нет", () => {
    const hero = pilot("Actor.hero");
    const ctx = dreadnoughtPanelContext(hero, [hero, dread("Actor.hero")]);
    expect(ctx.sanity.electrostim).toBeNull();
  });

  it("Электростимуляторы на технике — числа считаются от W.b пилота", () => {
    const hero = pilot("Actor.hero");
    const d = dread("Actor.hero", [{ type: "vehicleGear", name: "Электростимуляторы / Electrostimulators" }]);
    const ctx = dreadnoughtPanelContext(hero, [hero, d]);
    expect(ctx.sanity.electrostim).toEqual({ active: false, amount: 0, boostAmount: 18, delayMinutes: 8 });
  });

  it("активный буст доходит до контекста как есть", () => {
    const hero = pilot("Actor.hero", {}, [], { electrostim: { active: true, amount: 18 } });
    const d = dread("Actor.hero", [{ type: "vehicleGear", name: "Электростимуляторы / Electrostimulators" }]);
    const ctx = dreadnoughtPanelContext(hero, [hero, d]);
    expect(ctx.sanity.electrostim.active).toBe(true);
    expect(ctx.sanity.electrostim.amount).toBe(18);
  });

  it("без Таланта «Ферум Инфернус» — блока нет", () => {
    const hero = pilot("Actor.hero");
    const ctx = dreadnoughtPanelContext(hero, [hero, dread("Actor.hero")]);
    expect(ctx.sanity.ferumInfernus).toBeNull();
  });

  it("с Талантом — порог и активность считаются от Inf и текущего Здравомыслия", () => {
    const hero = pilot("Actor.hero", { value: 20 },
      [{ type: "talent", name: "Ferum Infernus / Ферум Инфернус" }],
      { characteristics: { wp: { bonus: 4 }, inf: { total: 40 } } });
    const ctx = dreadnoughtPanelContext(hero, [hero, dread("Actor.hero")]);
    expect(ctx.sanity.ferumInfernus).toEqual({ threshold: 25, active: true });
  });

  it("Здравомыслие на пороге или выше — пассивка не активна", () => {
    const hero = pilot("Actor.hero", { value: 25 },
      [{ type: "talent", name: "Ferum Infernus / Ферум Инфернус" }],
      { characteristics: { wp: { bonus: 4 }, inf: { total: 40 } } });
    const ctx = dreadnoughtPanelContext(hero, [hero, dread("Actor.hero")]);
    expect(ctx.sanity.ferumInfernus.active).toBe(false);
  });

  it("вне Гибернации — блок отдан просто как active:false", () => {
    const hero = pilot("Actor.hero");
    const ctx = dreadnoughtPanelContext(hero, [hero, dread("Actor.hero")]);
    expect(ctx.sanity.hibernation).toEqual({ active: false });
  });

  it("в Гибернации — флаг доходит до контекста", () => {
    const hero = pilot("Actor.hero", {}, [], { hibernation: { active: true } });
    const ctx = dreadnoughtPanelContext(hero, [hero, dread("Actor.hero")]);
    expect(ctx.sanity.hibernation).toEqual({ active: true });
  });
});

describe("dreadnoughtPanelContext: sarcophagus (стр. 57, wdbc-drn)", () => {
  it("ауспекс/яд — константы книги, эффективный максимум Ран приходит как есть", () => {
    const hero = pilot("Actor.hero", {}, [], { wounds: { value: 20, max: 25, effectiveMax: 20 } });
    const ctx = dreadnoughtPanelContext(hero, [hero, dread("Actor.hero")]);
    expect(ctx.sarcophagus.auspexRange).toBe(450);
    expect(ctx.sarcophagus.poisonBonus).toBe(30);
    expect(ctx.sarcophagus.woundsEffectiveMax).toBe(20);
  });

  it("effectiveMax отсутствует — откат на обычный max", () => {
    const hero = pilot("Actor.hero", {}, [], { wounds: { value: 20, max: 25 } });
    const ctx = dreadnoughtPanelContext(hero, [hero, dread("Actor.hero")]);
    expect(ctx.sarcophagus.woundsEffectiveMax).toBe(25);
  });

  it("лечение доступно, только пока Раны ниже эффективного максимума", () => {
    const full = pilot("Actor.hero", {}, [], { wounds: { value: 20, max: 25, effectiveMax: 20 } });
    expect(dreadnoughtPanelContext(full, [full, dread("Actor.hero")]).sarcophagus.healAvailable).toBe(false);
    const hurt = pilot("Actor.hero", {}, [], { wounds: { value: 19, max: 25, effectiveMax: 20 } });
    expect(dreadnoughtPanelContext(hurt, [hurt, dread("Actor.hero")]).sarcophagus.healAvailable).toBe(true);
  });

  it("без максимума аблативных против варп-оружия — блока нет", () => {
    const hero = pilot("Actor.hero", {}, [], { sarcophagusWarpWounds: { value: 0, max: 0 } });
    const ctx = dreadnoughtPanelContext(hero, [hero, dread("Actor.hero")]);
    expect(ctx.sarcophagus.warpWounds).toBeNull();
  });

  it("с максимумом — значение/максимум доходят до контекста", () => {
    const hero = pilot("Actor.hero", {}, [], { sarcophagusWarpWounds: { value: 3, max: 4 } });
    const ctx = dreadnoughtPanelContext(hero, [hero, dread("Actor.hero")]);
    expect(ctx.sarcophagus.warpWounds).toEqual({ value: 3, max: 4 });
  });

  it("interred/helplessNow доходят до контекста как есть", () => {
    const hero = pilot("Actor.hero", {}, [], { sarcophagusInterred: true, sarcophagusHelplessNow: false });
    const ctx = dreadnoughtPanelContext(hero, [hero, dread("Actor.hero")]);
    expect(ctx.sarcophagus.interred).toBe(true);
    expect(ctx.sarcophagus.helplessNow).toBe(false);
  });
});
