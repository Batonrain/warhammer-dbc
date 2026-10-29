// test/combat/speed-talents-actions.test.mjs
//
// Таланты Скорости (глава 3): как Таланты меняют цену и ход действий —
// Вскочить, Технический Трюк, Быстрая Перезарядка, Быстрое Выхватывание /
// Складывание, Прыгун, Спринт (Усталость), Смена Позиции, Прорыв.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  _standUpPlain, declareStandUp, _resolveJump, applySprintTurnEnd, declareReposition,
  actorCanReposition, actorCanBreach, declareBreach, postRepositionCard, movementMenuItems,
  declareRun, declareFullMove, declareCharge
} from "../../module/combat/movement-actions.mjs";
import { _reloadWeapon } from "../../module/combat/reload.mjs";
import { rollClearJam } from "../../module/combat/clear-jam.mjs";
import { quickDrawFree } from "../../module/combat/quick-draw.mjs";
import { inAwkwardRigLocation } from "../../module/constants/rig.mjs";
import { equipItem } from "../../module/sheets/tabs/gear.mjs";
import { weaponFor, ammoFor } from "../support/combat-fixtures.mjs";

const talent = name => ({ id: `t-${name}`, type: "talent", name });

/** Актор в бою: ОД, флаги, update по пути. */
function fighter({ items = [], ap = 2, prone = false, system = {} } = {}) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const flags = {};
  const a = {
    id: "actor-1", name: "Бегун", type: "character", uuid: "Actor.a1", items: list,
    system: {
      actionPoints: { value: ap, max: 2 },
      conditions: { prone },
      characteristics: { ag: { total: 40, bonus: 4 }, s: { total: 40, bonus: 4 }, int: { total: 40 } },
      skills: { techUse: { total: 30 }, acrobatics: { total: 40 } },
      movement: { halfMove: 4, move: 8, charge: 12, run: 24, sprintRun: 48 },
      fatigue: { value: 0 },
      ...system
    },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
    unsetFlag: async (scope, key) => { delete flags[`${scope}.${key}`]; },
    getActiveTokens: () => [],
    update: async data => {
      for (const [path, value] of Object.entries(data)) {
        const keys = path.split(".");
        let node = a;
        for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
        node[keys.at(-1)] = value;
      }
    }
  };
  for (const item of list) item.parent = a;
  return a;
}

beforeEach(() => { resetCaptured(); globalThis.game.combat = { started: true, id: "c1", round: 1 }; });
afterEach(() => { resetCaptured(); globalThis.game.combat = undefined; });

describe("Вскочить: Встать за свободное действие", () => {
  it("без Таланта обычное Вставание стоит 1 ОД", async () => {
    const a = fighter({ prone: true });
    await _standUpPlain(a);
    expect(a.system.actionPoints.value).toBe(1);
    expect(a.system.conditions.prone).toBe(false);
  });
  it("с Талантом — 0 ОД, Повален снят", async () => {
    const a = fighter({ prone: true, items: [talent("Leap Up / Вскочить")] });
    await _standUpPlain(a);
    expect(a.system.actionPoints.value).toBe(2);
    expect(a.system.conditions.prone).toBe(false);
    expect(captured.chat.at(-1).content).toContain("Вскочить");
  });
  it("с Талантом и нулём ОД всё равно встаёт — свободное действие", async () => {
    const a = fighter({ prone: true, ap: 0, items: [talent("Leap Up / Вскочить")] });
    await _standUpPlain(a);
    expect(a.system.conditions.prone).toBe(false);
  });
  it("declareStandUp с Талантом не открывает диалог выбора способа", async () => {
    const a = fighter({ prone: true, items: [talent("Leap Up / Вскочить")] });
    await declareStandUp(a);
    expect(captured.dialog).toBeNull();
    expect(a.system.conditions.prone).toBe(false);
  });
});

describe("Технический Трюк: Расклин за полудействие", () => {
  const jammed = () => {
    const item = { name: "Болтер", system: { jammed: true, jamLockedRound: 0 },
      update: async patch => { for (const [p, v] of Object.entries(patch)) item.system[p.replace(/^system\./, "")] = v; } };
    return item;
  };
  it("без Таланта — 2 ОД", async () => {
    const a = fighter();
    await rollClearJam(a, jammed());
    expect(a.system.actionPoints.value).toBe(0);
  });
  it("с Талантом — 1 ОД", async () => {
    const a = fighter({ items: [talent("Technical Knock / Технический Трюк")] });
    await rollClearJam(a, jammed());
    expect(a.system.actionPoints.value).toBe(1);
  });
  it("с Талантом и 1 ОД — хватает; без Таланта на 1 ОД — отказ", async () => {
    const withKnock = fighter({ ap: 1, items: [talent("Technical Knock / Технический Трюк")] });
    const item = jammed();
    await rollClearJam(withKnock, item);
    expect(withKnock.system.actionPoints.value).toBe(0);
    expect(captured.chat.length).toBeGreaterThan(0);

    resetCaptured();
    const without = fighter({ ap: 1 });
    await rollClearJam(without, jammed());
    expect(without.system.actionPoints.value).toBe(1);
    expect(captured.warnings.length).toBeGreaterThan(0);
  });
});

describe("Быстрая Перезарядка: время вдвое (окр.▼) в ОД", () => {
  const reloadWith = async (reload, talents) => {
    const weapon = weaponFor({ magazineCur: 0, magazineMax: 10, reload }, { id: "w1" });
    const ammo = ammoFor({ quantity: 3, weaponTypes: ["any"] });
    ammo.update = async data => { for (const [p, v] of Object.entries(data)) ammo.system[p.replace(/^system\./, "")] = v; };
    const a = fighter({ items: [weapon, ammo, ...talents.map(talent)] });
    await _reloadWeapon(a, weapon);
    return { a, weapon };
  };
  const RR = "Rapid Reload / Быстрая Перезарядка";

  it("«½» (1 ОД) с Талантом — бесплатно", async () => {
    const { a, weapon } = await reloadWith("½", [RR]);
    expect(weapon.system.magazineCur).toBe(10);
    expect(a.system.actionPoints.value).toBe(2);
  });
  it("«1» (2 ОД) с Талантом — 1 ОД", async () => {
    const { a } = await reloadWith("1", [RR]);
    expect(a.system.actionPoints.value).toBe(1);
  });
  it("«2» (4 ОД) с Талантом — 2 ОД, строка Таланта на карточке", async () => {
    const { a } = await reloadWith("2", [RR]);
    expect(a.system.actionPoints.value).toBe(0);
    expect(captured.chat.at(-1).content).toContain("Быстрая Перезарядка");
  });
  it("«–» (бесплатно) остаётся бесплатной, строки Таланта нет", async () => {
    const { a } = await reloadWith("–", [RR]);
    expect(a.system.actionPoints.value).toBe(2);
    expect(captured.chat.at(-1).content).not.toContain("Быстрая Перезарядка");
  });
});

describe("Быстрое Выхватывание / Складывание", () => {
  const QD = "Quick Draw / Быстрое Выхватывание";
  const QS = "Quick Store / Быстрое Складывание";
  const gun = (weaponClass = "pistol") => {
    const w = weaponFor({ weaponClass }, { id: "w1" });
    return w;
  };
  it("пистолет: Выхватывание и Складывание бесплатны с соответствующим Талантом", () => {
    const w = gun();
    const a = fighter({ items: [w, talent(QD), talent(QS)] });
    expect(quickDrawFree(a, w, "draw")).toBe(true);
    expect(quickDrawFree(a, w, "stow")).toBe(true);
  });
  it("Талант на одно направление не открывает другое", () => {
    const w = gun();
    expect(quickDrawFree(fighter({ items: [w, talent(QD)] }), w, "stow")).toBe(false);
    expect(quickDrawFree(fighter({ items: [w, talent(QS)] }), w, "draw")).toBe(false);
  });
  it("без Таланта и для тяжёлого оружия — нет", () => {
    const w = gun();
    expect(quickDrawFree(fighter({ items: [w] }), w, "draw")).toBe(false);
    const h = gun("heavy");
    expect(quickDrawFree(fighter({ items: [h, talent(QD)] }), h, "draw")).toBe(false);
  });
  it("не оружие (броня, предмет) — нет", () => {
    const a = fighter({ items: [talent(QD)] });
    expect(quickDrawFree(a, { type: "gear", system: {} }, "draw")).toBe(false);
    expect(quickDrawFree(a, null, "draw")).toBe(false);
  });
  it("неудобная Разгрузка отменяет Выхватывание, но не Складывание", () => {
    const w = gun();
    const rig = { id: "rig1", type: "gear", system: { isRig: true, rig: { comfort: "awkward" } } };
    const a = fighter({ items: [w, rig, talent(QD), talent(QS)] });
    const flags = { stowage: { w1: "rig1:s1" } };
    a.getFlag = (scope, key) => flags[key];
    expect(inAwkwardRigLocation(a, w)).toBe(true);
    expect(quickDrawFree(a, w, "draw")).toBe(false);
    expect(quickDrawFree(a, w, "stow")).toBe(true);
  });
  it("не размещённое в Разгрузке оружие не штрафуется", () => {
    const w = gun();
    const a = fighter({ items: [w, talent(QD)] });
    expect(inAwkwardRigLocation(a, w)).toBe(false);
    expect(quickDrawFree(a, w, "draw")).toBe(true);
  });
});

describe("Прыгун: Прыжок за полудействие или частью Натиска", () => {
  const jump = (a, opts) => _resolveJump(a, "hplace", 40, 0, 0, 4, opts);
  it("без Таланта — 2 ОД, как раньше", async () => {
    const a = fighter();
    await jump(a);
    expect(a.system.actionPoints.value).toBe(0);
  });
  it("с Талантом — 1 ОД", async () => {
    const a = fighter({ items: [talent("Jumper / Прыгун")] });
    await jump(a);
    expect(a.system.actionPoints.value).toBe(1);
  });
  it("с Талантом как часть Натиска — 0 ОД", async () => {
    const a = fighter({ items: [talent("Jumper / Прыгун")] });
    await jump(a, { partOfCharge: true });
    expect(a.system.actionPoints.value).toBe(2);
  });
  it("«часть Натиска» без Таланта ничего не даёт — 2 ОД", async () => {
    const a = fighter();
    await jump(a, { partOfCharge: true });
    expect(a.system.actionPoints.value).toBe(0);
  });
});

describe("Спринт: Усталость в конце второго дальнего Хода", () => {
  it("флага нет — ничего не происходит", async () => {
    const a = fighter();
    await applySprintTurnEnd(a);
    expect(a.system.fatigue.value).toBe(0);
    expect(captured.chat).toHaveLength(0);
  });
  it("флаг есть — +1 Усталости, флаг снят, карточка", async () => {
    const a = fighter({ system: { characteristics: { t: { total: 40, bonus: 4 }, w: { total: 40, bonus: 4 }, ag: { total: 40, bonus: 4 }, s: { total: 40, bonus: 4 }, int: { total: 40 } } } });
    await a.setFlag("warhammer-dbc", "sprintFatigueDue", true);
    await applySprintTurnEnd(a);
    expect(a.system.fatigue.value).toBe(1);
    expect(a.getFlag("warhammer-dbc", "sprintFatigueDue")).toBeUndefined();
    expect(captured.chat.at(-1).content).toContain("Спринт");
    // второй вызов ничего не добавляет
    await applySprintTurnEnd(a);
    expect(a.system.fatigue.value).toBe(1);
  });
});

describe("Смена Позиции: Полудвижение в начале боя", () => {
  const RP = "Reposition / Смена Позиции";
  it("доступна в первом Раунде боя, один раз за бой", async () => {
    const a = fighter({ items: [talent(RP)] });
    expect(actorCanReposition(a)).toBe(true);
    await declareReposition(a);
    expect(a.system.actionPoints.value).toBe(2); // 0 ОД
    expect(captured.chat.at(-1).content).toContain("Смена Позиции");
    expect(actorCanReposition(a)).toBe(false);
  });
  it("во втором Раунде и вне боя — недоступна", () => {
    const a = fighter({ items: [talent(RP)] });
    globalThis.game.combat = { started: true, id: "c1", round: 2 };
    expect(actorCanReposition(a)).toBe(false);
    globalThis.game.combat = undefined;
    expect(actorCanReposition(a)).toBe(false);
  });
  it("без Таланта — недоступна и в меню не появляется", () => {
    const a = fighter();
    expect(actorCanReposition(a)).toBe(false);
    expect(movementMenuItems(a).some(i => i.key === "reposition")).toBe(false);
  });
  it("пункт меню появляется у носителя в бою", () => {
    const a = fighter({ items: [talent(RP)] });
    expect(movementMenuItems(a).some(i => i.key === "reposition")).toBe(true);
  });
  it("карточка старта боя — носители в порядке Инициативы", async () => {
    const mk = (name, initiative, items) => ({ name, initiative, actor: fighter({ items }) });
    const combat = { combatants: [
      mk("Тихий", 8, [talent(RP)]),
      mk("Без Таланта", 30, []),
      mk("Быстрый", 22, [talent(RP)])
    ] };
    await postRepositionCard(combat);
    const html = captured.chat.at(-1).content;
    expect(html.indexOf("Быстрый")).toBeGreaterThan(-1);
    expect(html.indexOf("Быстрый")).toBeLessThan(html.indexOf("Тихий"));
    expect(html).not.toContain("Без Таланта");
  });
  it("карточка не создаётся, если носителей нет", async () => {
    await postRepositionCard({ combatants: [{ name: "Х", initiative: 5, actor: fighter() }] });
    expect(captured.chat).toHaveLength(0);
  });
});

describe("Прорыв (Прорыватель): Полудвижение бесплатно в Защитной Стойке со щитом", () => {
  const BR = "Breacher / Прорыватель";
  const shield = { id: "sh1", type: "weapon", name: "Щит", system: { equipped: true, weaponClass: "melee", shieldAP: 4 } };
  it("без щита или не в Защитной Стойке — недоступен", () => {
    expect(actorCanBreach(fighter({ items: [talent(BR)], system: { meleeStance: "defensive" } }))).toBe(false);
    expect(actorCanBreach(fighter({ items: [talent(BR), shield], system: { meleeStance: "standard" } }))).toBe(false);
  });
  it("без Таланта — недоступен", () => {
    expect(actorCanBreach(fighter({ items: [shield], system: { meleeStance: "defensive" } }))).toBe(false);
  });
  it("щит убран (не экипирован) — недоступен", () => {
    const down = { ...shield, system: { ...shield.system, equipped: false } };
    expect(actorCanBreach(fighter({ items: [talent(BR), down], system: { meleeStance: "defensive" } }))).toBe(false);
  });
  it("Талант + щит + Защитная Стойка — доступен, пункт меню есть", () => {
    const a = fighter({ items: [talent(BR), shield], system: { meleeStance: "defensive" } });
    expect(actorCanBreach(a)).toBe(true);
    expect(movementMenuItems(a).some(i => i.key === "breach")).toBe(true);
  });
  it("Прорыв: Полудвижение за 0 ОД, второй раз в том же Ходу — отказ", async () => {
    const a = fighter({ items: [talent(BR), shield], system: { meleeStance: "defensive" } });
    await declareBreach(a);
    expect(a.system.actionPoints.value).toBe(2);
    expect(captured.chat.at(-1).content).toContain("Прорыв");
    resetCaptured();
    await declareBreach(a);
    expect(captured.chat).toHaveLength(0);
    expect(captured.warnings.some(w => w.includes("уже использован"))).toBe(true);
  });
  it("попытка без условий — предупреждение, ОД не тронуты", async () => {
    const a = fighter({ items: [talent(BR)] });
    await declareBreach(a);
    expect(captured.warnings.length).toBeGreaterThan(0);
    expect(a.system.actionPoints.value).toBe(2);
  });
});

// ── Бег со Спринтом: диалог и Усталость ─────────────────────────────────────

const flush = () => new Promise(r => setTimeout(r, 0));

describe("Бег со Спринтом", () => {
  const SPRINT = "Sprint / Спринт";
  const runWith = async (a, action) => {
    const p = declareRun(a);
    await flush();
    if (action) await captured.press(action, {});
    else captured.dismiss();
    await p;
  };

  it("без Спринта диалога нет: 2 ОД, SPD×6", async () => {
    const a = fighter();
    await declareRun(a);
    expect(captured.dialog).toBeNull();
    expect(a.system.actionPoints.value).toBe(0);
    expect(captured.chat.at(-1).content).toContain("SPD×6");
  });

  it("со Спринтом спрашивает; «нет» — обычный Бег, метки дальнего Бега нет", async () => {
    const a = fighter({ items: [talent(SPRINT)] });
    await runWith(a, "normal");
    expect(a.system.actionPoints.value).toBe(0);
    expect(captured.chat.at(-1).content).toContain("SPD×6");
    expect(a.getFlag("warhammer-dbc", "sprintFar")).toBeUndefined();
  });

  it("«да» — SPD×12, метка Раунда, Усталости пока нет", async () => {
    const a = fighter({ items: [talent(SPRINT)] });
    await runWith(a, "far");
    expect(captured.chat.at(-1).content).toContain("SPD×12");
    expect(a.getFlag("warhammer-dbc", "sprintFar")).toEqual({ combatId: "c1", round: 1 });
    expect(a.getFlag("warhammer-dbc", "sprintFatigueDue")).toBeUndefined();
  });

  it("отмена диалога — ОД не списаны, Бег не объявлен", async () => {
    const a = fighter({ items: [talent(SPRINT)] });
    await runWith(a, null);
    expect(a.system.actionPoints.value).toBe(2);
    expect(a.getFlag("warhammer-dbc", "running")).toBeUndefined();
  });

  it("дальний Бег в следующем Раунде — взводит Усталость на конец Хода", async () => {
    const a = fighter({ items: [talent(SPRINT)] });
    await runWith(a, "far");
    globalThis.game.combat = { started: true, id: "c1", round: 2 };
    a.system.actionPoints.value = 2;
    await runWith(a, "far");
    expect(a.getFlag("warhammer-dbc", "sprintFatigueDue")).toBe(true);
    expect(captured.chat.at(-1).content).toContain("+1 Усталости");
  });

  it("дальний Бег через Раунд — Усталость не взводится", async () => {
    const a = fighter({ items: [talent(SPRINT)] });
    await runWith(a, "far");
    globalThis.game.combat = { started: true, id: "c1", round: 3 };
    a.system.actionPoints.value = 2;
    await runWith(a, "far");
    expect(a.getFlag("warhammer-dbc", "sprintFatigueDue")).toBeUndefined();
  });

  it("обычный Бег посреди дальних сбивает цепочку", async () => {
    const a = fighter({ items: [talent(SPRINT)] });
    await runWith(a, "far");                                        // Раунд 1 — дальний
    globalThis.game.combat = { started: true, id: "c1", round: 2 };
    a.system.actionPoints.value = 2;
    await runWith(a, "normal");                                     // Раунд 2 — обычный
    globalThis.game.combat = { started: true, id: "c1", round: 3 };
    a.system.actionPoints.value = 2;
    await runWith(a, "far");                                        // Раунд 3 — дальний, но Раунд 2 не дальний
    expect(a.getFlag("warhammer-dbc", "sprintFatigueDue")).toBeUndefined();
  });
});

describe("тексты карточек Движения с Талантами", () => {
  it("Полное Движение: SPD×3 со Спринтом, SPD×2 без", async () => {
    const withSprint = fighter({ items: [talent("Sprint / Спринт")] });
    await declareFullMove(withSprint);
    expect(captured.chat.at(-1).content).toContain("SPD×3");
    resetCaptured();
    await declareFullMove(fighter());
    expect(captured.chat.at(-1).content).toContain("SPD×2");
  });
  it("Натиск: SPD×6 с Запредельной Скоростью, SPD×3 без", async () => {
    const a = fighter({ items: [talent("Preternatural Speed / Запредельная Скорость")] });
    await declareCharge(a);
    expect(captured.chat.at(-1).content).toContain("SPD×6");
    resetCaptured();
    await declareCharge(fighter());
    expect(captured.chat.at(-1).content).toContain("SPD×3");
  });
});

describe("Взять/Сложить оружие (equipItem) с Быстрым Выхватыванием", () => {
  const withGear = (talents, weaponClass = "pistol", equipped = false) => {
    const w = weaponFor({ weaponClass, equipped }, { id: "w1" });
    w.effects = { contents: [] };
    w.updateEmbeddedDocuments = async () => [];
    const a = fighter({ items: [w, ...talents.map(talent)] });
    return { a, w };
  };

  it("без Таланта Взять стоит 1 ОД", async () => {
    const { a, w } = withGear([]);
    await equipItem(w, true);
    expect(w.system.equipped).toBe(true);
    expect(a.system.actionPoints.value).toBe(1);
  });
  it("с Quick Draw пистолет берётся бесплатно", async () => {
    const { a, w } = withGear(["Quick Draw / Быстрое Выхватывание"]);
    await equipItem(w, true);
    expect(w.system.equipped).toBe(true);
    expect(a.system.actionPoints.value).toBe(2);
  });
  it("с Quick Draw тяжёлое оружие по-прежнему стоит 1 ОД", async () => {
    const { a, w } = withGear(["Quick Draw / Быстрое Выхватывание"], "heavy");
    await equipItem(w, true);
    expect(a.system.actionPoints.value).toBe(1);
  });
  it("Quick Store: Сложить бесплатно, а Quick Draw на Сложить не влияет", async () => {
    const { a, w } = withGear(["Quick Store / Быстрое Складывание"], "pistol", true);
    await equipItem(w, false);
    expect(w.system.equipped).toBe(false);
    expect(a.system.actionPoints.value).toBe(2);

    const other = withGear(["Quick Draw / Быстрое Выхватывание"], "pistol", true);
    await equipItem(other.w, false);
    expect(other.a.system.actionPoints.value).toBe(1);
  });
});
