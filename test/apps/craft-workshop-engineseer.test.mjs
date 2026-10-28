// test/apps/craft-workshop-engineseer.test.mjs
//
// Мастер-Технопровидец (Таланты Механикума, Sahara 3-cc96 п.11; DoomBC —
// Основная книга): «Может потратить Очко Бесчестия, чтобы автоматически
// преуспеть в расширенном тесте Tech-Use на Крафт/ремонт, получая I.b Успехов за
// смену». Игрок на смене получает предложение; согласие — Очко потрачено, броска
// нет, смена даёт I.b Успехов (плюс по +1 за ассистента, как у обычной смены).

import { describe, it, expect, beforeEach } from "vitest";
import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { CraftWorkshop } from "../../module/apps/craft-workshop.mjs";
import { masterEngineseerAutoEligible, masterEngineseerAutoSuccesses, masterEngineseerNoParts, destroyedWeaponsOf }
  from "../../module/rules/craft-advantage.mjs";

foundry.utils.getProperty = (o, p) => String(p).split(".").reduce((x, k) => x?.[k], o);

const engineseer = () => ({ type: "talent", name: "Master Engineseer / Мастер Технопровидец", system: {}, flags: {} });

function crafterActor({ items = [engineseer()], fate = 2, intBonus = 4 } = {}) {
  const a = {
    id: "crafter-1", name: "Крейн", type: "character", items,
    system: {
      characteristics: { int: { total: intBonus * 10, bonus: intBonus } },
      skills: { techUse: { total: 50, rank: "trained" } },
      groupSkills: {}, fatigue: { value: 0 }, fate: { value: fate, max: 3 }
    },
    updates: [],
    update: async d => { a.updates.push(d); if ("system.fate.value" in d) a.system.fate.value = d["system.fate.value"]; }
  };
  return a;
}

function newApp({ mode = "craft", assistants = 0 } = {}) {
  const app = Object.create(CraftWorkshop.prototype);
  app.projects = [{
    id: "p1", title: "", collapsed: false, mode, crafterId: "crafter-1", categoryKey: "explosive",
    rarity: 0, quality: "common", toolKey: "common", gmMod: 0, assistants, baseBank: 40, improve: false,
    monotony: false, diceMode: "normal", slowShift: false, researchKind: "blueprint",
    vatKey: "common", bioTarget: "common", bioSkill: "medicae", bioImplant: "", bioAdvanced: false,
    bioLarge: false, bioHaem: false, bioCycle: 0, bioLog: [], skillChoices: {},
    project: { accumulated: 0, shifts: 0, fatigue: 0 }
  }];
  app.render = () => {};
  return app;
}

let crafter;
beforeEach(() => {
  resetCaptured();
  crafter = crafterActor();
  globalThis.game.actors = { get: id => (id === "crafter-1" ? crafter : null) };
});

describe("Мастер-Технопровидец: автоуспех за Очко Бесчестия", () => {
  it("правила применимости и число Успехов (I.b)", () => {
    expect(masterEngineseerAutoEligible(crafter, "craft", "skill:techUse")).toBe(true);
    expect(masterEngineseerAutoEligible(crafter, "research", "skill:techUse")).toBe(false);
    expect(masterEngineseerAutoEligible(crafter, "craft", "skill:trade")).toBe(false);
    expect(masterEngineseerAutoEligible(crafterActor({ items: [] }), "craft", "skill:techUse")).toBe(false);
    expect(masterEngineseerAutoSuccesses(crafter)).toBe(4);
    expect(masterEngineseerAutoSuccesses(crafterActor({ intBonus: 0 }))).toBe(0);
  });

  it("согласие: Очко потрачено, кубик НЕ брошен, смена даёт I.b Успехов", async () => {
    const app = newApp();
    captured.confirmAnswer = true;
    await app._rollShift("p1");
    expect(captured.rolls).toEqual([]);
    expect(crafter.system.fate.value).toBe(1);
    expect(app.projects[0].project.accumulated).toBe(4);
    expect(captured.chat.at(-1).content).toContain("Мастер-Технопровидец: автоуспех");
  });

  it("Очко платится один раз на проект: вторая смена за сутки — автоуспех без траты, через двое суток — снова платно", async () => {
    const app = newApp();
    captured.confirmAnswer = true;
    globalThis.game.time = { worldTime: 1000 };
    await app._rollShift("p1");
    expect(crafter.system.fate.value).toBe(1);
    globalThis.game.time = { worldTime: 1000 + 3600 };
    await app._rollShift("p1");
    expect(crafter.system.fate.value).toBe(1);                       // Очко не тронуто
    expect(app.projects[0].project.accumulated).toBe(8);
    globalThis.game.time = { worldTime: 1000 + 3600 + 3 * 86400 };
    await app._rollShift("p1");
    expect(crafter.system.fate.value).toBe(0);                       // перерыв больше суток — новое Очко
  });

  it("с ассистентами к I.b добавляется по +1 Успеху за каждого", async () => {
    const app = newApp({ assistants: 2 });
    captured.confirmAnswer = true;
    await app._rollShift("p1");
    expect(app.projects[0].project.accumulated).toBe(4 + 2);
  });

  it("отказ: обычный бросок, Очко цело", async () => {
    const app = newApp();
    captured.confirmAnswer = false;
    captured.nextRoll = 10;
    await app._rollShift("p1");
    expect(captured.rolls).toEqual(["1d100"]);
    expect(crafter.system.fate.value).toBe(2);
  });

  it("нет Очков Бесчестия — предложения нет, обычный бросок", async () => {
    crafter = crafterActor({ fate: 0 });
    globalThis.game.actors = { get: () => crafter };
    const app = newApp();
    captured.nextRoll = 10;
    await app._rollShift("p1");
    expect(captured.dialog).toBeNull();
    expect(captured.rolls).toEqual(["1d100"]);
  });

  it("не Крафт (Исследование) — предложения нет", async () => {
    const app = newApp({ mode: "research" });
    captured.nextRoll = 10;
    await app._rollShift("p1");
    expect(captured.dialog).toBeNull();
  });
});

// «…Он получает +10 к Tech-Use на Крафт и ремонт предметов … Кроме того,
// персонаж способен чинить механизмы вообще без запчастей под рукой, заставляя
// их работать в полную силу — хотя по их внешнему виду будет заметно, что их
// чинили без нужных ресурсов.» Ремонт в Мастерской — проект Крафта с галочкой
// «Ремонт» (решение владельца 26.10.2026); готовый ремонт снимает метку
// «Уничтожено» с выбранного оружия (combat/weapon-repair.mjs).
describe("Мастер-Технопровидец: ремонт и «без запчастей» в Мастерской", () => {
  const brokenGun = () => {
    const w = { id: "w1", type: "weapon", name: "Болтер", system: { destroyed: true }, updates: [] };
    w.update = async d => { w.updates.push(d); if ("system.destroyed" in d) w.system.destroyed = d["system.destroyed"]; };
    return w;
  };

  it("правила: «без запчастей» только у Мастера-Технопровидца и только в ремонте", () => {
    const base = { repair: true, noParts: true };
    expect(masterEngineseerNoParts(crafter, base)).toBe(true);
    expect(masterEngineseerNoParts(crafter, { ...base, repair: false })).toBe(false);
    expect(masterEngineseerNoParts(crafter, { ...base, noParts: false })).toBe(false);
    expect(masterEngineseerNoParts(crafterActor({ items: [] }), base)).toBe(false);
  });

  it("destroyedWeaponsOf берёт только сломанное оружие", () => {
    const ok = { id: "w2", type: "weapon", name: "Меч", system: { destroyed: false } };
    const a = crafterActor({ items: [engineseer(), brokenGun(), ok, { id: "g", type: "gear", name: "Х", system: { destroyed: true } }] });
    expect(destroyedWeaponsOf(a).map(i => i.id)).toEqual(["w1"]);
  });

  it("смена ремонта: заголовок «Смена ремонта», +10 Tech-Use, строка про запчасти", async () => {
    const app = newApp();
    Object.assign(app.projects[0], { repair: true, noParts: true });
    captured.confirmAnswer = false;
    captured.nextRoll = 10;
    await app._rollShift("p1");
    const html = captured.chat.at(-1).content;
    expect(html).toContain("Смена ремонта");
    expect(html).toContain("Мастер-Технопровидец: +10");
    expect(html).toContain("без запчастей");
  });

  it("обычный крафт остаётся «Сменой крафта» без строки про запчасти", async () => {
    const app = newApp();
    app.projects[0].noParts = true;        // галочка без «Ремонта» ничего не значит
    captured.confirmAnswer = false;
    captured.nextRoll = 10;
    await app._rollShift("p1");
    const html = captured.chat.at(-1).content;
    expect(html).toContain("Смена крафта");
    expect(html).not.toContain("без запчастей");
  });

  it("ремонт закрылся этой сменой — метка «Уничтожено» снята с выбранного оружия; раньше — нет", async () => {
    const gun = brokenGun();
    crafter = crafterActor({ items: [engineseer(), gun] });
    globalThis.game.actors = { get: () => crafter };
    const app = newApp();
    Object.assign(app.projects[0], { repair: true, repairWeaponId: "w1", baseBank: 100 });
    captured.confirmAnswer = true;           // автоуспех I.b = 4 Успеха
    await app._rollShift("p1");
    expect(gun.system.destroyed).toBe(true);                 // Банк 100 не набран
    Object.assign(app.projects[0].project, { accumulated: 99 });
    await app._rollShift("p1");
    expect(gun.system.destroyed).toBe(false);
    expect(captured.chat.some(m => String(m.content).includes("починено"))).toBe(true);
  });

  it("без выбранного оружия готовый ремонт ничего не трогает", async () => {
    const gun = brokenGun();
    crafter = crafterActor({ items: [engineseer(), gun] });
    globalThis.game.actors = { get: () => crafter };
    const app = newApp();
    Object.assign(app.projects[0], { repair: true, baseBank: 1 });
    captured.confirmAnswer = true;
    await app._rollShift("p1");
    expect(gun.system.destroyed).toBe(true);
  });
});
