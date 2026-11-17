// test/combat/attack-pugilist-strikes.test.mjs
//
// Тяжёлый Хук, Направляющий Удар и Удар с Колена (Пугилист, Sahara 3-eddb), та часть, что живёт в
// combat/attack.mjs и на карточках: бонус Dmg и отказ от второй руки, кнопка свободного Давления,
// метка удара ногой и Concussive (0) при ударе в голову. Логика условий — rules/pugilist-talents.mjs.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { resolveGrappleSuccess } from "../../module/combat/grapple.mjs";
import { startKneeStrike } from "../../module/combat/pugilist-strikes.mjs";
import { HAYMAKER_FORFEIT_FLAG, LEG_ATTACKS_FLAG } from "../../module/rules/pugilist-talents.mjs";
import { talentTogglesHtml } from "../../module/sheets/attack/talent-toggles.mjs";
import { freeMeleeFlags } from "../../module/rules/melee-talents.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
const allCards = () => captured.chat.map(m => m.content).join("\n");
const dmg1 = () => Number(card().match(/Применить урон 1: <b>(\d+)<\/b>/)?.[1]);

const byKey = key => ({
  id: "k-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});
const byName = name => ({ id: "t-" + name, name, type: "talent", system: {} });
const HAY = { key: "pugilist.core.haymaker", name: "Haymaker / Тяжёлый Хук" };
const GOAD = { key: "pugilist.core.goadingStrike", name: "Goading Strike / Направляющий Удар" };
const KNEE = { key: "pugilist.core.kneeStrike", name: "Knee Strike / Удар с Колена" };

function who(items) {
  const a = actorFor({ items, fate: { value: 3, max: 5 }, wounds: { value: 20, max: 20, critical: 0 },
    characteristics: { ws: char(45), bs: char(45), s: char(40), t: char(40), wp: char(30), ag: char(35), inf: char(40) } });
  a.uuid = "Actor.fighter";
  a.updates = [];
  a.update = async data => { a.updates.push(data); };
  const store = {};
  a.getFlag = (s, k) => store[`${s}.${k}`];
  a.setFlag = async (s, k, v) => { store[`${s}.${k}`] = v; };
  a.unsetFlag = async (s, k) => { delete store[`${s}.${k}`]; };
  return a;
}
const foe = { id: "foe", uuid: "Actor.foe", name: "Враг", system: {}, items: [], getFlag: () => undefined };

const fistWeapon = () => weaponFor({ weaponClass: "melee", meleeCategory: "Кулаки", grips: "Кист", damage: "1d5", balance: -1 },
  { name: "Fist / Удар кулаком", flags: { "warhammer-dbc.integralAttack": true } });
const kickWeapon = () => weaponFor({ weaponClass: "melee", meleeCategory: "", grips: "Ног", damage: "1d5-1", balance: -2 },
  { id: "kick-1", name: "Kick / Пинок", flags: { "warhammer-dbc.integralAttack": true } });

const realGetProperty = (o, p) => String(p).split(".").reduce((c, k) => c?.[k], o);
let stubGetProperty;
beforeEach(() => {
  resetCaptured(); setTargets([foe]);
  stubGetProperty = globalThis.foundry.utils.getProperty;
  globalThis.foundry.utils.getProperty = realGetProperty;
});
afterEach(() => { globalThis.foundry.utils.getProperty = stubGetProperty; });

async function punch(items, { toggles = {}, roll = 20, extra = {}, weapon = fistWeapon() } = {}) {
  const actor = who([weapon, ...items]);
  setTargets([foe]);
  captured.dice = [roll, 5, 5, 5];
  await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, { baseKey: "standard", talentToggles: toggles, ...extra });
  return actor;
}

describe("Тяжёлый Хук: +½T.b Dmg и отказ от второй руки", () => {
  it("с галочкой урон на ½T.b больше (T.b 4 → +2), без галочки — обычный", async () => {
    await punch([byKey(HAY.key)]);
    const plain = dmg1();
    await punch([byKey(HAY.key)], { toggles: { haymaker: true } });
    expect(dmg1()).toBe(plain + 2);
    expect(card()).toContain("Тяжёлый Хук");
  });

  it("по имени Таланта (снимок без записи Конструктора) — то же", async () => {
    await punch([byName(HAY.name)]);
    const plain = dmg1();
    await punch([byName(HAY.name)], { toggles: { haymaker: true } });
    expect(dmg1()).toBe(plain + 2);
  });

  it("на мече галочка ничего не даёт", async () => {
    const sword = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "П", damage: "1d10" });
    await punch([byKey(HAY.key)], { weapon: sword });
    const plain = dmg1();
    await punch([byKey(HAY.key)], { weapon: sword, toggles: { haymaker: true } });
    expect(dmg1()).toBe(plain);
  });

  it("Хук ставит метку «отказался от второй руки» на Ход", async () => {
    const a = await punch([byKey(HAY.key)], { toggles: { haymaker: true } });
    expect(a.getFlag("warhammer-dbc", HAYMAKER_FORFEIT_FLAG)).toBe(true);
    const b = await punch([byKey(HAY.key)]);
    expect(b.getFlag("warhammer-dbc", HAYMAKER_FORFEIT_FLAG)).toBeUndefined();
  });

  it("переброс оплаченной атаки: бонус остаётся без галочки, метка не пишется заново", async () => {
    await punch([byKey(HAY.key)]);
    const plain = dmg1();
    const a = await punch([byKey(HAY.key)], { extra: { skipAmmo: true, talentPaid: { haymaker: true } } });
    expect(dmg1()).toBe(plain + 2);
    expect(a.getFlag("warhammer-dbc", HAYMAKER_FORFEIT_FLAG)).toBeUndefined();
  });

  it("кнопки урона несут метку Хука — карточка урона предложит встречный тест", async () => {
    await punch([byKey(HAY.key)], { toggles: { haymaker: true } });
    expect(card()).toContain('data-haymaker="1"');
    await punch([byKey(HAY.key)]);
    expect(card()).toContain('data-haymaker="0"');
  });
});

describe("Направляющий Удар: свободное Давление по Успеху", () => {
  it("попадание с галочкой — кнопка Давления, названа цель", async () => {
    await punch([byKey(GOAD.key)], { toggles: { goadingStrike: true } });
    expect(allCards()).toContain("wh-goading-btn");
    expect(allCards()).toContain('data-target-uuid="Actor.foe"');
  });

  it("промах — кнопки нет (нужен Успех)", async () => {
    await punch([byKey(GOAD.key)], { toggles: { goadingStrike: true }, roll: 95 });
    expect(allCards()).not.toContain("wh-goading-btn");
  });

  it("без галочки, на мече и без Таланта — кнопки нет", async () => {
    await punch([byKey(GOAD.key)]);
    expect(allCards()).not.toContain("wh-goading-btn");
    resetCaptured();
    await punch([byKey(GOAD.key)], { toggles: { goadingStrike: true }, weapon: weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "П", damage: "1d10" }) });
    expect(allCards()).not.toContain("wh-goading-btn");
    resetCaptured();
    await punch([], { toggles: { goadingStrike: true } });
    expect(allCards()).not.toContain("wh-goading-btn");
  });
});

describe("Галочки окна атаки", () => {
  it("Хук и Направляющий Удар видны только у кулака и носителя Таланта", () => {
    const a = who([byKey(HAY.key), byKey(GOAD.key)]);
    const html = talentTogglesHtml(a, fistWeapon(), { isMelee: true });
    expect(html).toContain('data-key="haymaker"');
    expect(html).toContain('data-key="goadingStrike"');
    const sword = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "П" });
    expect(talentTogglesHtml(a, sword, { isMelee: true })).toBe("");
    expect(talentTogglesHtml(who([]), fistWeapon(), { isMelee: true })).toBe("");
  });
});

describe("Удар с Колена: пинок в голову и метка ноги", () => {
  const kneeOpts = head => ({ techniqueOpts: { kneeStrike: { head } }, fixedSuccessDeg: 1 });

  it("в голову — у попадания свойство Оглушающее (0); в торс — нет", async () => {
    await punch([byKey(KNEE.key)], { weapon: kickWeapon(), extra: kneeOpts(true) });
    expect(card()).toContain("Оглушающее (0)");
    await punch([byKey(KNEE.key)], { weapon: kickWeapon(), extra: kneeOpts(false) });
    expect(card()).not.toContain("Оглушающее");
  });

  it("любой удар ногой засчитывается в счётчик ног этого Хода; кулак — нет", async () => {
    const a = await punch([], { weapon: kickWeapon() });
    expect(a.getFlag("warhammer-dbc", LEG_ATTACKS_FLAG)).toBe(1);
    const b = await punch([], { weapon: fistWeapon() });
    expect(b.getFlag("warhammer-dbc", LEG_ATTACKS_FLAG)).toBeUndefined();
  });

  it("переброс того же удара ногой счётчик не увеличивает", async () => {
    const a = await punch([], { weapon: kickWeapon(), extra: { forcedRoll: 20, skipAmmo: true } });
    expect(a.getFlag("warhammer-dbc", LEG_ATTACKS_FLAG)).toBeUndefined();
  });

  it("свободное действие: ни ОД, ни Лимита Атак", () => {
    expect(freeMeleeFlags({ kneeStrike: { head: false } })).toEqual({ noAp: true, uncounted: true, skipChargeGate: true });
  });
});

describe("Захват: карточка Удара с Колена", () => {
  const grabber = items => { const a = who(items); a.name = "Борец"; return a; };
  const victim = { ...foe, isOwner: true, update: async () => {} };

  it("с Талантом — кнопка в торс; на 5+ Успехов — ещё и кнопка в голову", async () => {
    await resolveGrappleSuccess(grabber([byKey(KNEE.key)]), { target: victim, margin: 2 });
    expect(allCards()).toContain("wh-knee-strike-btn");
    expect(allCards()).not.toContain('data-head="1"');
    resetCaptured();
    await resolveGrappleSuccess(grabber([byKey(KNEE.key)]), { target: victim, margin: 5 });
    expect(allCards()).toContain('data-head="1"');
    expect(allCards()).toContain('data-head="0"');
  });

  it("без Таланта кнопки нет", async () => {
    await resolveGrappleSuccess(grabber([]), { target: victim, margin: 9 });
    expect(allCards()).not.toContain("wh-knee-strike-btn");
  });
});

describe("startKneeStrike: что проверяется до открытия окна атаки", () => {
  function kneeFighter({ hands = 2, legsUsed = 0, kick = true } = {}) {
    const a = who([byKey(KNEE.key), ...(kick ? [kickWeapon()] : [])]);
    const flags = { grappleHands: hands, ...(legsUsed ? { [LEG_ATTACKS_FLAG]: legsUsed } : {}) };
    a.getFlag = (_s, k) => flags[k];
    a.sheet = { _showAttackDialog: vi.fn(async () => {}) };
    return a;
  }

  it("2 руки, нога свободна, пинок есть — окно атаки открыто: Стандартная База, авто-попадание, в голову по выбору", async () => {
    const a = kneeFighter();
    const ok = await startKneeStrike(a, { head: true });
    expect(ok).toBe(true);
    const [weapon, opts] = a.sheet._showAttackDialog.mock.calls[0];
    expect(weapon.name).toBe("Kick / Пинок");
    expect(opts.kneeStrike).toEqual({ head: true });
    expect(opts.forceBase).toBe("standard");
  });

  it("с карточкой Захвата плата «раз на карточку» едет в окно атаки (payOnRoll)", async () => {
    const a = kneeFighter();
    await startKneeStrike(a, { head: false, messageId: "m-1" });
    const [, opts] = a.sheet._showAttackDialog.mock.calls[0];
    expect(opts.payOnRoll).toEqual({ label: "Удар с Колена", cardId: "m-1", cardKey: "kneeStrikeUsed" });
  });

  it("берётся именно Пинок, а не Копыта или чужое оружие на ноге (хоть оно и первое в списке)", async () => {
    const a = kneeFighter({ kick: false });
    const hooves = weaponFor({ weaponClass: "melee", grips: "Ног", damage: "1d10" }, { id: "hoof", name: "Hooves / Копыта", flags: { "warhammer-dbc.integralAttack": true } });
    a.items.unshift(hooves, kickWeapon());
    await startKneeStrike(a, { head: false });
    expect(a.sheet._showAttackDialog.mock.calls[0][0].name).toBe("Kick / Пинок");
  });

  it("одной рукой — отказ, окно не открыто", async () => {
    const a = kneeFighter({ hands: 1 });
    expect(await startKneeStrike(a, { head: false })).toBe(false);
    expect(a.sheet._showAttackDialog).not.toHaveBeenCalled();
  });

  it("обе ноги уже били в этом Ходу — отказ", async () => {
    const a = kneeFighter({ legsUsed: 2 });
    expect(await startKneeStrike(a, { head: false })).toBe(false);
    expect(a.sheet._showAttackDialog).not.toHaveBeenCalled();
  });

  it("нет профиля безоружного пинка — отказ", async () => {
    const a = kneeFighter({ kick: false });
    expect(await startKneeStrike(a, { head: false })).toBe(false);
    expect(a.sheet._showAttackDialog).not.toHaveBeenCalled();
  });
});
