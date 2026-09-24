// test/regions/vortex-zone.test.mjs
//
// module/regions/vortex-zone.mjs — Vortex of Doom (wdbc-ufns): персистентная
// зона с раундовым тестом поддержания контролёра и Реакциями других
// псайкеров (попарное состязание за «чемпиона», см. шапку модуля). Тот же
// приём мок-обвязки, что test/regions/linger-zone.test.mjs — тестируется
// ветвящаяся логика через мок-сцену/регион/поведение, не сам canvas.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, vi, beforeEach } from "vitest";
import { VORTEX_ZONE_TYPE, processVortexTurnStart, beatsChampion, reactToVortex, spendVortexSuccess }
  from "../../module/regions/vortex-zone.mjs";

const CONTROLLER = "Actor.controller123456";

describe("beatsChampion (тай-брейк Успехи/тPR/W, стр. 313)", () => {
  it("нет чемпиона — любой успех побеждает автоматически", () => {
    expect(beatsChampion({ success: true, deg: 1, tpr: 0, w: 0 }, null)).toBe(true);
  });

  it("провал не может побить чемпиона, даже без него", () => {
    expect(beatsChampion({ success: false, deg: 5, tpr: 9, w: 9 }, null)).toBe(false);
  });

  it("успех побеждает провал независимо от степеней", () => {
    const champion = { success: false, deg: 5, tpr: 9, w: 9 };
    expect(beatsChampion({ success: true, deg: 1, tpr: 0, w: 0 }, champion)).toBe(true);
  });

  it("провал не побеждает успех, даже с большей степенью провала", () => {
    const champion = { success: true, deg: 1, tpr: 0, w: 0 };
    expect(beatsChampion({ success: false, deg: 9, tpr: 9, w: 9 }, champion)).toBe(false);
  });

  it("оба успеха — больше Успехов (deg) побеждает", () => {
    const champion = { success: true, deg: 2, tpr: 5, w: 5 };
    expect(beatsChampion({ success: true, deg: 3, tpr: 0, w: 0 }, champion)).toBe(true);
    expect(beatsChampion({ success: true, deg: 1, tpr: 9, w: 9 }, champion)).toBe(false);
  });

  it("Успехи равны — больше тPR побеждает", () => {
    const champion = { success: true, deg: 2, tpr: 5, w: 5 };
    expect(beatsChampion({ success: true, deg: 2, tpr: 6, w: 0 }, champion)).toBe(true);
    expect(beatsChampion({ success: true, deg: 2, tpr: 4, w: 9 }, champion)).toBe(false);
  });

  it("Успехи и тPR равны — больше W побеждает", () => {
    const champion = { success: true, deg: 2, tpr: 5, w: 5 };
    expect(beatsChampion({ success: true, deg: 2, tpr: 5, w: 6 }, champion)).toBe(true);
    expect(beatsChampion({ success: true, deg: 2, tpr: 5, w: 4 }, champion)).toBe(false);
  });

  it("Успехи/тPR/W все равны — не побеждает (строгое неравенство)", () => {
    const champion = { success: true, deg: 2, tpr: 5, w: 5 };
    expect(beatsChampion({ success: true, deg: 2, tpr: 5, w: 5 }, champion)).toBe(false);
  });
});

function fakeBehavior({ controllerUuid = CONTROLLER, xValue = 2, disabled = false, itemUuid = "" } = {}) {
  const sys = { itemUuid, ownerUuid: CONTROLLER, controllerUuid, xValue, facingDeg: 0,
    championRv: null, championThreshold: null, championDeg: 0, championTpr: 0, championW: 0,
    championSuccess: false, spendLeft: 0 };
  const behavior = {
    id: "b1", type: VORTEX_ZONE_TYPE, disabled, system: sys,
    // СТРОГО как настоящий RegionBehaviorDocument#update: пишет только в
    // system.* при явном префиксе "system." в ключе (dotted-path на
    // embedded-документе) — голый ключ (`championRv` вместо `"system.
    // championRv"`) реальный Foundry молча проигнорировал бы, не найдя такое
    // поле на самом документе. Мок раньше прощал оба варианта и из-за этого
    // не поймал реальный баг (wdbc-up7x, отсутствующий префикс "system."
    // в module/regions/vortex-zone.mjs) — не повторять эту ошибку здесь.
    update: vi.fn(async (patch) => {
      for (const [k, v] of Object.entries(patch)) {
        if (!k.startsWith("system.")) continue;
        sys[k.slice(7)] = v;
      }
    })
  };
  return behavior;
}

function fakeRegion(behavior, { id = "r1", tokens = [] } = {}) {
  const scene = {
    id: "s1", tokens: { contents: tokens }, grid: { size: 100 },
    deleteEmbeddedDocuments: vi.fn().mockResolvedValue(undefined),
    regions: { get: (rid) => (rid === id ? region : undefined) }
  };
  const region = {
    id, parent: scene, behaviors: { find: (fn) => [behavior].find(fn), get: (bid) => (bid === behavior.id ? behavior : undefined) },
    toObject: () => ({ shapes: [{ type: "circle", x: 1000, y: 1000, radius: 200 }] }),
    update: vi.fn().mockResolvedValue(undefined)
  };
  scene.regions = [region];
  scene.regions.get = (rid) => (rid === id ? region : undefined);
  return { region, scene };
}

function fakeCombatant(scene, actorUuid = CONTROLLER) {
  return { actor: { uuid: actorUuid }, combat: { scene } };
}

function fakeControllerActor(uuid = CONTROLLER, over = {}) {
  return {
    uuid, name: "Кастер",
    system: { characteristics: { wp: { total: 40 } }, psyker: { currentRating: 3 } },
    ...over
  };
}

beforeEach(() => {
  resetCaptured();
  globalThis.game = { ...globalThis.game, user: { isGM: true }, scenes: [] };
});

describe("processVortexTurnStart: гейты (не-ГМ/нет актора/чужой контролёр/отключено)", () => {
  it("не-ГМ — ничего не делает", async () => {
    globalThis.game.user.isGM = false;
    const behavior = fakeBehavior();
    const { scene } = fakeRegion(behavior);
    await processVortexTurnStart(fakeCombatant(scene));
    expect(behavior.update).not.toHaveBeenCalled();
  });

  it("без актора у combatant — ничего не делает", async () => {
    const behavior = fakeBehavior();
    const { scene } = fakeRegion(behavior);
    await processVortexTurnStart({ actor: null, combat: { scene } });
    expect(behavior.update).not.toHaveBeenCalled();
  });

  it("зона другого контролёра (controllerUuid не совпадает) — не трогается", async () => {
    const behavior = fakeBehavior({ controllerUuid: "Actor.someoneElse" });
    const { scene } = fakeRegion(behavior);
    await processVortexTurnStart(fakeCombatant(scene));
    expect(behavior.update).not.toHaveBeenCalled();
  });

  it("отключённое поведение — не трогается", async () => {
    const behavior = fakeBehavior({ disabled: true });
    const { scene } = fakeRegion(behavior);
    await processVortexTurnStart(fakeCombatant(scene));
    expect(behavior.update).not.toHaveBeenCalled();
  });
});

describe("processVortexTurnStart: успешный тест поддержания контролёра", () => {
  it("успех — champion записан, карточка траты Успехов постится, зона не удаляется", async () => {
    const behavior = fakeBehavior({ xValue: 2 });
    const { scene } = fakeRegion(behavior);
    globalThis.fromUuid = async (uuid) => (uuid === CONTROLLER ? fakeControllerActor() : null);
    captured.nextRoll = 10; // W40+5*3-5*2=45, 10<=45 успех, deg=|10-45|/10+1=4

    await processVortexTurnStart(fakeCombatant(scene));

    expect(behavior.system.championSuccess).toBe(true);
    expect(behavior.system.spendLeft).toBe(4);
    expect(scene.deleteEmbeddedDocuments).not.toHaveBeenCalled();
    expect(captured.chat.some(c => c.content.includes("тратит Успехи"))).toBe(true);
  });
});

describe("processVortexTurnStart: провал контролёра — случайный дрейф Х", () => {
  it("провал — Х меняется на 1d10-6, зона смещается, удаляется только при Х<=0", async () => {
    const behavior = fakeBehavior({ xValue: 2 });
    const { scene, region } = fakeRegion(behavior);
    globalThis.fromUuid = async (uuid) => (uuid === CONTROLLER ? fakeControllerActor() : null);
    captured.dice = [90, 10, 3]; // 90 > порог(45) — провал; 1d10=10→delta=4; 1d8=3 направление
    captured.nextRoll = 90;

    await processVortexTurnStart(fakeCombatant(scene));

    expect(behavior.system.championSuccess).toBe(false);
    // Очередь кубов детерминирована (captured.dice важнее nextRoll): 1d10=10 →
    // Х 2 + (10−6) = 6 (wdbc-bjy1.8 — раньше «Х меняется» не проверялось).
    expect(behavior.system.xValue).toBe(6);
    expect(region.update).toHaveBeenCalled();
    expect(scene.deleteEmbeddedDocuments).not.toHaveBeenCalled();
  });
});

describe("reactToVortex: Реакция другого псайкера", () => {
  it("зона уже не существует (region/behavior не найдены) — предупреждение, не бросает", async () => {
    globalThis.ui = { notifications: { warn: vi.fn(), info: vi.fn() } };
    globalThis.game.scenes = { get: () => null };
    await reactToVortex(fakeControllerActor("Actor.reactor"), { regionId: "gone", sceneId: "s1", behaviorId: "b1" });
    expect(globalThis.ui.notifications.warn).toHaveBeenCalledWith(expect.stringContaining("не существует"));
  });

  it("реагирующий проигрывает — контроль не переходит, champion не меняется", async () => {
    const behavior = fakeBehavior({ xValue: 2 });
    behavior.system.championRv = 5; behavior.system.championThreshold = 45;
    behavior.system.championDeg = 5; behavior.system.championTpr = 3; behavior.system.championW = 40;
    behavior.system.championSuccess = true;
    const { scene } = fakeRegion(behavior);
    globalThis.game.scenes = { get: (id) => (id === "s1" ? scene : null) };
    globalThis.ui = { notifications: { warn: vi.fn() } };
    // Слабый реагирующий: низкий W/тPR, плохой бросок — не должен побить champion (deg=5).
    const weakActor = fakeControllerActor("Actor.reactor", {
      system: { characteristics: { wp: { total: 20 } }, psyker: { currentRating: 1 },
        reactions: { value: 1 } }
    });
    captured.nextRoll = 50; // низкий Порог у слабого актора, скорее всего провал/маленький deg

    await reactToVortex(weakActor, { regionId: "r1", sceneId: "s1", behaviorId: "b1" });

    expect(behavior.system.controllerUuid).toBe(CONTROLLER);
    expect(captured.chat.some(c => c.content.includes("не перехвачен"))).toBe(true);
  });

  // wdbc-up7x: этот сценарий раньше проходил "зелёным" с мягким моком
  // (голый ключ без "system." тихо прощался) — реальный Foundry так не
  // делает, controllerUuid/champion/spendLeft НЕ переживали .update()
  // вовсе. Строгий мок (см. fakeBehavior выше) теперь ловит именно это.
  it("реагирующий побеждает — контроль переходит, champion и spendLeft реально записаны", async () => {
    const behavior = fakeBehavior({ xValue: 2 });
    behavior.system.championRv = 90; behavior.system.championThreshold = 20;
    behavior.system.championDeg = 1; behavior.system.championTpr = 0; behavior.system.championW = 0;
    behavior.system.championSuccess = false; // слабый действующий чемпион — легко побить
    const { scene } = fakeRegion(behavior);
    globalThis.game.scenes = { get: (id) => (id === "s1" ? scene : null) };
    const strongActor = fakeControllerActor("Actor.reactor", {
      system: { characteristics: { wp: { total: 90 } }, psyker: { currentRating: 9 },
        reactions: { value: 1 } }
    });
    captured.nextRoll = 10; // высокий Порог у сильного актора — уверенный успех

    await reactToVortex(strongActor, { regionId: "r1", sceneId: "s1", behaviorId: "b1" });

    expect(behavior.system.controllerUuid).toBe("Actor.reactor");
    expect(behavior.system.championSuccess).toBe(true);
    expect(behavior.system.spendLeft).toBeGreaterThan(0);
    expect(captured.chat.some(c => c.content.includes("перехватывает контроль"))).toBe(true);
  });
});

describe("spendVortexSuccess: трата Успеха победителем", () => {
  it("x+1 — увеличивает Х, списывает spendLeft", async () => {
    const behavior = fakeBehavior({ xValue: 2 });
    behavior.system.spendLeft = 2;
    const { scene } = fakeRegion(behavior);
    globalThis.game.scenes = { get: (id) => (id === "s1" ? scene : null) };

    await spendVortexSuccess({ regionId: "r1", sceneId: "s1", behaviorId: "b1" }, "x+1");

    expect(behavior.system.xValue).toBe(3);
    expect(behavior.system.spendLeft).toBe(1);
  });

  it("x-1 до 0 — зона развеивается (deleteEmbeddedDocuments)", async () => {
    const behavior = fakeBehavior({ xValue: 1 });
    behavior.system.spendLeft = 1;
    const { scene } = fakeRegion(behavior);
    globalThis.game.scenes = { get: (id) => (id === "s1" ? scene : null) };

    await spendVortexSuccess({ regionId: "r1", sceneId: "s1", behaviorId: "b1" }, "x-1");

    expect(behavior.system.xValue).toBe(0);
    expect(scene.deleteEmbeddedDocuments).toHaveBeenCalledWith("Region", ["r1"]);
  });

  it("spendLeft уже 0 — предупреждение, ничего не трогает", async () => {
    globalThis.ui = { notifications: { warn: vi.fn() } };
    const behavior = fakeBehavior({ xValue: 2 });
    behavior.system.spendLeft = 0;
    const { scene } = fakeRegion(behavior);
    globalThis.game.scenes = { get: (id) => (id === "s1" ? scene : null) };

    await spendVortexSuccess({ regionId: "r1", sceneId: "s1", behaviorId: "b1" }, "x+1");

    expect(behavior.system.xValue).toBe(2);
    expect(globalThis.ui.notifications.warn).toHaveBeenCalledWith(expect.stringContaining("уже потрачены"));
  });
});

// wdbc-bjy1.7 — четыре расхождения с книгой/столом.
describe("Вихрь Рока: создатель, кубы, развеивание, имя силы (wdbc-bjy1.7)", () => {
  const inCombat = () => { globalThis.game.combat = { started: true }; };
  const noReactions = (uuid) => fakeControllerActor(uuid, {
    type: "character",
    system: { characteristics: { wp: { total: 90 } }, psyker: { currentRating: 9 }, reactions: { value: 0 } },
    getFlag: () => undefined, update: vi.fn()
  });

  it("создатель перехватывает контроль без Реакции (книга, стр. 313)", async () => {
    inCombat();
    const behavior = fakeBehavior({ controllerUuid: "Actor.other" }); // ownerUuid = CONTROLLER
    const { scene } = fakeRegion(behavior);
    globalThis.game.scenes = { get: (id) => (id === "s1" ? scene : null) };
    globalThis.ui = { notifications: { warn: vi.fn() } };
    captured.nextRoll = 10;
    await reactToVortex(noReactions(CONTROLLER), { regionId: "r1", sceneId: "s1", behaviorId: "b1" });
    expect(globalThis.ui.notifications.warn).not.toHaveBeenCalled();
    expect(behavior.system.controllerUuid).toBe(CONTROLLER);
    delete globalThis.game.combat;
  });

  it("чужой псайкер без Реакций — не может вмешаться", async () => {
    inCombat();
    const behavior = fakeBehavior({ controllerUuid: CONTROLLER });
    const { scene } = fakeRegion(behavior);
    globalThis.game.scenes = { get: (id) => (id === "s1" ? scene : null) };
    globalThis.ui = { notifications: { warn: vi.fn() } };
    await reactToVortex(noReactions("Actor.reactor"), { regionId: "r1", sceneId: "s1", behaviorId: "b1" });
    expect(globalThis.ui.notifications.warn).toHaveBeenCalledWith(expect.stringContaining("Реакций"));
    expect(behavior.system.controllerUuid).toBe(CONTROLLER);
    delete globalThis.game.combat;
  });

  it("карточка теста поддержания несёт кубы (rolls) — их видит стол и Dice So Nice", async () => {
    const behavior = fakeBehavior({ xValue: 2 });
    const { scene } = fakeRegion(behavior);
    globalThis.fromUuid = async (uuid) => (uuid === CONTROLLER ? fakeControllerActor() : null);
    captured.nextRoll = 10;
    await processVortexTurnStart(fakeCombatant(scene));
    const card = captured.chat.find(c => c.content?.includes("Поддержание Вихря"));
    expect(card?.rolls?.length).toBe(1);
  });

  it("провал развеял Вихрь (Х≤0) — приглашений на Реакцию нет", async () => {
    const reactor = { x: 1000, y: 1000, width: 1, height: 1, actor: {
      uuid: "Actor.reactor", name: "Сосед", testUserPermission: () => true,
      items: [{ type: "psychicPower", name: "Mind Over Matter / Разум Превыше Материи" }]
    } };
    const behavior = fakeBehavior({ xValue: 1 });
    const { scene } = fakeRegion(behavior, { tokens: [reactor] });
    globalThis.fromUuid = async (uuid) => (uuid === CONTROLLER ? fakeControllerActor() : null);
    globalThis.game.users = Object.assign([], { players: [] });
    captured.nextRoll = 95; // провал; 1d10 тем же числом → Х падает до 0
    captured.dice = [95, 1, 1];
    await processVortexTurnStart(fakeCombatant(scene));
    expect(scene.deleteEmbeddedDocuments).toHaveBeenCalled();
    expect(captured.chat.some(c => c.content?.includes("перехватить контроль?"))).toBe(false);
  });

  it("Mind Over Matter узнаётся и по русскому имени", async () => {
    const reactor = { x: 1000, y: 1000, width: 1, height: 1, actor: {
      uuid: "Actor.reactor", name: "Сосед", testUserPermission: () => true,
      items: [{ type: "psychicPower", name: "Разум Превыше Материи" }]
    } };
    const behavior = fakeBehavior({ xValue: 2 });
    const { scene } = fakeRegion(behavior, { tokens: [reactor] });
    globalThis.fromUuid = async (uuid) => (uuid === CONTROLLER ? fakeControllerActor() : null);
    globalThis.game.users = Object.assign([], { players: [] });
    captured.nextRoll = 10;
    await processVortexTurnStart(fakeCombatant(scene));
    expect(captured.chat.some(c => c.content?.includes("перехватить контроль?"))).toBe(true);
  });
});
