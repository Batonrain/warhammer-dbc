// test/combat/aiming-action.test.mjs
//
// Прицеливание как HUD-действие (wdbc-1rno.5): module/combat/aiming-action.mjs.
// Раньше actor.system.aiming менялось радиокнопкой в диалоге атаки без
// расхода ОД вовсе — здесь проверяется, что aimMenuItems()/declareAim
// реально тратят ОД (или честно 0 при Чёрных Глазах) и ставят состояние.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  aimMenuItems, aimFocusToggleState, toggleAimFocusPending,
  trackingAimToggleState, toggleTrackingAimPending
} from "../../module/combat/aiming-action.mjs";

const blackEyesItem = () => ({
  type: "mutation", name: "Black Eyes / Чёрные Глаза",
  flags: { "warhammer-dbc": { mechanics: [{ id: "g1", operator: "AND", entries: [
    { id: "e1", kind: "capability", capabilityKey: "gift.slaanesh.blackEyes" }
  ] }] } }
});

const aimFocusItem = () => ({ type: "talent", name: "Aim Focus / Фокус на Прицеле", flags: {} });
const trackingAimItem = () => ({ type: "talent", name: "Tracking Aim / Прицел на Упреждение", flags: {} });
const psalmItem = () => ({ type: "techPower", name: "Psalm of the Guidance / Псалом Наставления", flags: {} });
const cognisWeapon = () => ({ type: "weapon", name: "Ружьё с духом", system: { equipped: true, weaponProps: [{ key: "cognis" }] } });
const blessingItem = (isSustained = true) => ({
  type: "psychicPower", name: "Blessing of Magnus / Благословение Магнуса", system: { isSustained }, flags: {}
});
const forceWeapon = () => ({ type: "weapon", name: "Психосиловой Клинок", system: { equipped: true, weaponProps: [{ key: "force" }] } });

function actorWith({ ap = 2, cor = 0, reactions = 1, per = 45, cognition = 0, woundTier = "healthy", items = [], type = "character" } = {}) {
  const flags = {};
  const a = {
    type, name: "Стрелок", items,
    system: {
      actionPoints: { value: ap, max: 2 }, reactions: { value: reactions, max: 1, defenseValue: 0, defenseMax: 0 },
      corruption: { value: cor }, aiming: "none",
      characteristics: { per: { total: per } },
      cognition: { value: cognition },
      wounds: { tier: woundTier }
    },
    getActiveTokens: () => [{ document: { id: "tok-attacker" } }],
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
    unsetFlag: async (scope, key) => { delete flags[`${scope}.${key}`]; },
    update: async data => {
      if (data["system.actionPoints.value"] !== undefined) a.system.actionPoints.value = data["system.actionPoints.value"];
      if (data["system.reactions.value"] !== undefined) a.system.reactions.value = data["system.reactions.value"];
      if (data["system.aiming"] !== undefined) a.system.aiming = data["system.aiming"];
      if (data["system.cognition.value"] !== undefined) a.system.cognition.value = data["system.cognition.value"];
    }
  };
  return a;
}

beforeEach(() => { resetCaptured(); globalThis.game.combat = { started: true }; globalThis.game.user.targets = new Set(); });
afterEach(() => { globalThis.game.combat = undefined; globalThis.game.user.targets = new Set(); });

describe("aimMenuItems", () => {
  it("вне Столкновения — пусто", () => {
    globalThis.game.combat = undefined;
    expect(aimMenuItems(actorWith({}))).toEqual([]);
  });

  it("не боевой тип актора (vehicle) — пусто", () => {
    expect(aimMenuItems(actorWith({ type: "vehicle" }))).toEqual([]);
  });

  it("обычно — две кнопки, цена 1/2 ОД", () => {
    const items = aimMenuItems(actorWith({ ap: 2 }));
    expect(items.map(i => i.key)).toEqual(["aimHalf", "aimFull"]);
    expect(items[0].cost).toBe("1 ОД");
    expect(items[1].cost).toBe("2 ОД");
  });

  it("Cold Eyes/Холодные Глаза: Полу «Свободное», Полное «1 ОД» — безусловно, без цели", () => {
    const items = aimMenuItems(actorWith({ ap: 2, items: [{ type: "gear", name: "Cold Eyes / Холодные Глаза", flags: {} }] }));
    expect(items[0].cost).toBe("Свободное");
    expect(items[1].cost).toBe("1 ОД");
  });

  it("Cor 80+ Чёрные Глаза без выбранной цели — Полу всё ещё платное", () => {
    const items = aimMenuItems(actorWith({ ap: 2, cor: 80, items: [blackEyesItem()] }));
    expect(items[0].cost).toBe("1 ОД");
  });

  it("Cor 80+ Чёрные Глаза с видимой целью — Полу «Свободное»", () => {
    globalThis.game.user.targets = new Set([{ document: { id: "tok-target" } }]);
    const items = aimMenuItems(actorWith({ ap: 2, cor: 80, items: [blackEyesItem()] }));
    expect(items[0].cost).toBe("Свободное");
    expect(items[1].cost).toBe("2 ОД"); // Полное не задето исключением
  });

  it("клик по Полу-прицеливанию: тратит 1 ОД, ставит system.aiming='half'", async () => {
    const actor = actorWith({ ap: 2 });
    const items = aimMenuItems(actor);
    const ok = await items[0].action();
    expect(ok).toBe(true);
    expect(actor.system.actionPoints.value).toBe(1);
    expect(actor.system.aiming).toBe("half");
  });

  it("клик по Полному Прицеливанию: тратит 2 ОД, ставит system.aiming='full'", async () => {
    const actor = actorWith({ ap: 2 });
    const items = aimMenuItems(actor);
    const ok = await items[1].action();
    expect(ok).toBe(true);
    expect(actor.system.actionPoints.value).toBe(0);
    expect(actor.system.aiming).toBe("full");
  });

  it("не хватает ОД — предупреждение, aiming не меняется", async () => {
    const actor = actorWith({ ap: 1 });
    const items = aimMenuItems(actor);
    const ok = await items[1].action();
    expect(ok).toBe(false);
    expect(actor.system.aiming).toBe("none");
    expect(captured.warnings.some(w => w.includes("ОД"))).toBe(true);
  });

  it("Cor 80+ Чёрные Глаза с видимой целью: клик по Полу не тратит ОД вовсе", async () => {
    globalThis.game.user.targets = new Set([{ document: { id: "tok-target" } }]);
    const actor = actorWith({ ap: 2, cor: 80, items: [blackEyesItem()] });
    const items = aimMenuItems(actor);
    const ok = await items[0].action();
    expect(ok).toBe(true);
    expect(actor.system.actionPoints.value).toBe(2);
    expect(actor.system.aiming).toBe("half");
  });
});

describe("Aim Focus/Фокус на Прицеле (wdbc-1rno.5)", () => {
  describe("aimFocusToggleState", () => {
    it("нет Таланта — null", () => {
      expect(aimFocusToggleState(actorWith({}))).toBeNull();
    });

    it("есть Талант, галочка выключена, Реакция есть — {pending:false, reactionOk:true}", () => {
      const actor = actorWith({ items: [aimFocusItem()], reactions: 1 });
      expect(aimFocusToggleState(actor)).toEqual({ pending: false, reactionOk: true });
    });

    it("нет Реакции — reactionOk:false, галочка всё равно доступна для чтения", () => {
      const actor = actorWith({ items: [aimFocusItem()], reactions: 0 });
      expect(aimFocusToggleState(actor)).toEqual({ pending: false, reactionOk: false });
    });
  });

  describe("toggleAimFocusPending", () => {
    it("переключает флаг туда-обратно", async () => {
      const actor = actorWith({ items: [aimFocusItem()] });
      await toggleAimFocusPending(actor);
      expect(aimFocusToggleState(actor).pending).toBe(true);
      await toggleAimFocusPending(actor);
      expect(aimFocusToggleState(actor).pending).toBe(false);
    });
  });

  describe("declareAim с включённой галочкой Фокуса", () => {
    it("тратит ещё 1 Реакцию и ставит aimFocusExtended='pending'", async () => {
      const actor = actorWith({ items: [aimFocusItem()], ap: 2, reactions: 1 });
      await toggleAimFocusPending(actor);
      const ok = await aimMenuItems(actor)[0].action();
      expect(ok).toBe(true);
      expect(actor.system.actionPoints.value).toBe(1);
      expect(actor.system.reactions.value).toBe(0);
      expect(actor.getFlag("warhammer-dbc", "aimFocusExtended")).toBe("pending");
      // Галочка — одноразовый выбор на этот клик, гасится сразу.
      expect(actor.getFlag("warhammer-dbc", "aimFocusPending")).toBeFalsy();
    });

    it("нет Реакции — Прицеливание всё равно объявляется, но без продления", async () => {
      const actor = actorWith({ items: [aimFocusItem()], ap: 2, reactions: 0 });
      await toggleAimFocusPending(actor);
      const ok = await aimMenuItems(actor)[0].action();
      expect(ok).toBe(true);
      expect(actor.system.aiming).toBe("half");
      expect(actor.getFlag("warhammer-dbc", "aimFocusExtended")).toBeUndefined();
      expect(captured.warnings.some(w => w.includes("Реакции"))).toBe(true);
    });

    it("галочка выключена — обычное Прицеливание, Реакция не тратится, extended не ставится", async () => {
      const actor = actorWith({ items: [aimFocusItem()], ap: 2, reactions: 1 });
      const ok = await aimMenuItems(actor)[0].action();
      expect(ok).toBe(true);
      expect(actor.system.reactions.value).toBe(1);
      expect(actor.getFlag("warhammer-dbc", "aimFocusExtended")).toBeUndefined();
    });

    it("повторное объявление без галочки снимает старый aimFocusExtended", async () => {
      const actor = actorWith({ items: [aimFocusItem()], ap: 2, reactions: 1 });
      await actor.setFlag("warhammer-dbc", "aimFocusExtended", "armed");
      const ok = await aimMenuItems(actor)[1].action();
      expect(ok).toBe(true);
      expect(actor.getFlag("warhammer-dbc", "aimFocusExtended")).toBeUndefined();
    });

    it("без Таланта — галочки нет, клик по кнопке не спрашивает Реакцию вовсе", async () => {
      const actor = actorWith({ ap: 2, reactions: 1 });
      const ok = await aimMenuItems(actor)[0].action();
      expect(ok).toBe(true);
      expect(actor.system.reactions.value).toBe(1);
    });
  });
});

describe("Tracking Aim/Прицел на Упреждение (wdbc-1rno.5)", () => {
  describe("trackingAimToggleState", () => {
    it("нет Таланта — null", () => {
      expect(trackingAimToggleState(actorWith({}))).toBeNull();
    });
    it("есть Талант, галочка выключена — {pending:false}", () => {
      expect(trackingAimToggleState(actorWith({ items: [trackingAimItem()] }))).toEqual({ pending: false });
    });
  });

  describe("toggleTrackingAimPending", () => {
    it("переключает флаг туда-обратно", async () => {
      const actor = actorWith({ items: [trackingAimItem()] });
      await toggleTrackingAimPending(actor);
      expect(trackingAimToggleState(actor).pending).toBe(true);
      await toggleTrackingAimPending(actor);
      expect(trackingAimToggleState(actor).pending).toBe(false);
    });
  });

  describe("declareAim с включённой галочкой Упреждения", () => {
    it("успех P+0 — ставит trackingAimActive, не тратит ОД/Реакцию сверх Прицеливания", async () => {
      const actor = actorWith({ items: [trackingAimItem()], ap: 2, per: 60 });
      await toggleTrackingAimPending(actor);
      captured.nextRoll = 20; // порог 60; успех
      const ok = await aimMenuItems(actor)[0].action();
      expect(ok).toBe(true);
      expect(actor.system.actionPoints.value).toBe(1);
      expect(actor.getFlag("warhammer-dbc", "trackingAimActive")).toBe(true);
      expect(captured.chat.at(-1).content).toContain("Прицел на Упреждение");
      expect(captured.chat.at(-1).content).toContain("успех");
      // Галочка — одноразовый выбор, гасится сразу.
      expect(actor.getFlag("warhammer-dbc", "trackingAimPending")).toBeFalsy();
    });

    it("провал P+0 — trackingAimActive не ставится, тест израсходован впустую", async () => {
      const actor = actorWith({ items: [trackingAimItem()], ap: 2, per: 30 });
      await toggleTrackingAimPending(actor);
      captured.nextRoll = 90; // порог 30; явный провал
      const ok = await aimMenuItems(actor)[0].action();
      expect(ok).toBe(true);
      expect(actor.getFlag("warhammer-dbc", "trackingAimActive")).toBeUndefined();
      expect(captured.chat.at(-1).content).toContain("провал");
    });

    it("галочка выключена — тест не катается вовсе, чат не пишется", async () => {
      const actor = actorWith({ items: [trackingAimItem()], ap: 2 });
      const before = captured.chat.length;
      const ok = await aimMenuItems(actor)[0].action();
      expect(ok).toBe(true);
      expect(captured.chat.length).toBe(before);
      expect(actor.getFlag("warhammer-dbc", "trackingAimActive")).toBeUndefined();
    });

    it("повторное объявление без галочки снимает старый trackingAimActive", async () => {
      const actor = actorWith({ items: [trackingAimItem()], ap: 2 });
      await actor.setFlag("warhammer-dbc", "trackingAimActive", true);
      const ok = await aimMenuItems(actor)[1].action();
      expect(ok).toBe(true);
      expect(actor.getFlag("warhammer-dbc", "trackingAimActive")).toBeUndefined();
    });

    it("без Таланта — галочки нет, клик не катает тест", async () => {
      const actor = actorWith({ ap: 2 });
      const before = captured.chat.length;
      const ok = await aimMenuItems(actor)[0].action();
      expect(ok).toBe(true);
      expect(captured.chat.length).toBe(before);
    });
  });
});

describe("Псалом Наставления/Psalm of the Guidance (wdbc-1rno.5, находка 8/12)", () => {
  it("метка цены: Техночудо + Cognis-оружие + хватает Когниции — «N Когниция/Когниции»", () => {
    const items = aimMenuItems(actorWith({ items: [psalmItem(), cognisWeapon()], cognition: 5 }));
    expect(items[0].cost).toBe("1 Когниция");
    expect(items[1].cost).toBe("2 Когниции");
  });

  it("метка цены: не хватает Когниции — обычная цена ОД", () => {
    const items = aimMenuItems(actorWith({ items: [psalmItem(), cognisWeapon()], cognition: 0, ap: 2 }));
    expect(items[0].cost).toBe("1 ОД");
  });

  it("клик по Полу-прицеливанию: платит Когницией, ОД не трогает", async () => {
    const actor = actorWith({ items: [psalmItem(), cognisWeapon()], cognition: 5, ap: 2 });
    const ok = await aimMenuItems(actor)[0].action();
    expect(ok).toBe(true);
    expect(actor.system.cognition.value).toBe(4);
    expect(actor.system.actionPoints.value).toBe(2);
    expect(actor.system.aiming).toBe("half");
  });

  it("клик по Полному Прицеливанию: платит 2 Когниции", async () => {
    const actor = actorWith({ items: [psalmItem(), cognisWeapon()], cognition: 5, ap: 2 });
    const ok = await aimMenuItems(actor)[1].action();
    expect(ok).toBe(true);
    expect(actor.system.cognition.value).toBe(3);
    expect(actor.system.actionPoints.value).toBe(2);
  });

  it("не хватает Когниции — тихий фоллбэк на обычный ОД, без предупреждения", async () => {
    const actor = actorWith({ items: [psalmItem(), cognisWeapon()], cognition: 0, ap: 2 });
    const before = captured.warnings.length;
    const ok = await aimMenuItems(actor)[0].action();
    expect(ok).toBe(true);
    expect(actor.system.actionPoints.value).toBe(1);
    expect(actor.system.aiming).toBe("half");
    expect(captured.warnings.length).toBe(before);
  });

  it("нет Cognis-оружия — обычный ОД, даже с Техночудом и Когницией", async () => {
    const actor = actorWith({ items: [psalmItem()], cognition: 5, ap: 2 });
    const ok = await aimMenuItems(actor)[0].action();
    expect(ok).toBe(true);
    expect(actor.system.cognition.value).toBe(5);
    expect(actor.system.actionPoints.value).toBe(1);
  });

  it("нет Техночуда — обычный ОД, даже с Cognis-оружием", async () => {
    const actor = actorWith({ items: [cognisWeapon()], cognition: 5, ap: 2 });
    const ok = await aimMenuItems(actor)[0].action();
    expect(ok).toBe(true);
    expect(actor.system.cognition.value).toBe(5);
    expect(actor.system.actionPoints.value).toBe(1);
  });
});

describe("Blessing of Magnus/Благословение Магнуса (wdbc-1rno.5, находка 10/12)", () => {
  it("всё сошлось — Полу-прицеливание «Свободное»", () => {
    const items = aimMenuItems(actorWith({ items: [blessingItem(), forceWeapon()], woundTier: "heavy", ap: 2 }));
    expect(items[0].cost).toBe("Свободное");
    expect(items[1].cost).toBe("2 ОД"); // Полное не задето
  });

  it("клик по Полу-прицеливанию: не тратит ОД вовсе", async () => {
    const actor = actorWith({ items: [blessingItem(), forceWeapon()], woundTier: "heavy", ap: 2 });
    const ok = await aimMenuItems(actor)[0].action();
    expect(ok).toBe(true);
    expect(actor.system.actionPoints.value).toBe(2);
    expect(actor.system.aiming).toBe("half");
  });

  it("не ранен тяжело/критически — обычная цена", () => {
    const items = aimMenuItems(actorWith({ items: [blessingItem(), forceWeapon()], woundTier: "light", ap: 2 }));
    expect(items[0].cost).toBe("1 ОД");
  });

  it("сила не поддерживается (isSustained:false) — обычная цена", () => {
    const items = aimMenuItems(actorWith({ items: [blessingItem(false), forceWeapon()], woundTier: "heavy", ap: 2 }));
    expect(items[0].cost).toBe("1 ОД");
  });
});
