// test/combat/dodge-talents-stage1.test.mjs
//
// Таланты Избегания (глава 3), первый проход: Кошачье Приземление, Живой Щит,
// Мастер Боя, Осторожность, Скоростная Внимательность, Оплот, Высокая
// Защитная Стойка.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";
import { _resolveFallDamage, declareVault } from "../../module/combat/movement-actions.mjs";
import { inGrappleCoverArc, grappleCoverPartner, resolveGrappleSuccess } from "../../module/combat/grapple.mjs";
import { applyCaution, cautionBlockReason } from "../../module/combat/caution.mjs";
import { canSpendReaction } from "../../module/combat/action-economy.mjs";
import { _performDodge, _performParry } from "../../module/combat/defense.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

const DEFAULT_SOURCES = getRuleSources();
const flush = () => new Promise(r => setTimeout(r, 0));
const talent = name => ({ id: `t-${name}`, type: "talent", name, system: {}, getFlag: () => undefined });

/** Актор с флагами и update по пути. */
function fighter({ items = [], flagsInit = {}, ...system } = {}) {
  const a = actorFor({ items, ...system });
  const store = { ...flagsInit };
  a.type = "character";
  a.getFlag = (scope, key) => store[`${scope}.${key}`];
  a.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  a.unsetFlag = async (scope, key) => { delete store[`${scope}.${key}`]; };
  a.update = async data => {
    for (const [path, value] of Object.entries(data)) {
      const m = path.match(/^flags\.([^.]+)\.(.+)$/);
      if (m) { store[`${m[1]}.${m[2]}`] = value; continue; }
      const keys = path.split(".");
      let node = a;
      for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
      node[keys.at(-1)] = value;
    }
  };
  a._store = store;
  return a;
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.combat = undefined;
  setTargets([]);
});
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
});

// ── Кошачье Приземление ─────────────────────────────────────────────────────

describe("Кошачье Приземление", () => {
  const CATFALL = "Catfall / Кошачье Приземление";
  const faller = (items = []) => {
    const a = fighter({ items, characteristics: { ag: { total: 40, bonus: 4 } } });
    a.system.conditions = {};
    return a;
  };

  it("без Таланта: урон 1d10+высота, Лежачий, локация Торс", async () => {
    const a = faller();
    captured.dice = [5];
    await _resolveFallDamage(a, 6);
    const html = captured.chat.at(-1).content;
    expect(html).toContain('data-damage="11"'); // 5 + 6
    expect(html).toContain('data-hit-location="Торс"');
    expect(a.system.conditions.prone).toBe(true);
  });

  it("с Талантом: высота −A.b, не Лежачий, весь урон в левую ногу (d2=1)", async () => {
    const a = faller([talent(CATFALL)]);
    captured.dice = [5, 1]; // 1d10, d2 (локация)
    await _resolveFallDamage(a, 6);
    const html = captured.chat.at(-1).content;
    expect(html).toContain('data-damage="7"'); // 5 + (6 − 4)
    expect(html).toContain('data-hit-location="Левая нога"');
    expect(html).toContain("Кошачье Приземление");
    expect(a.system.conditions.prone).toBeUndefined();
  });

  it("d2=2 — правая нога", async () => {
    const a = faller([talent(CATFALL)]);
    captured.dice = [5, 2];
    await _resolveFallDamage(a, 6);
    expect(captured.chat.at(-1).content).toContain('data-hit-location="Правая нога"');
  });

  it("Группирование получает +20: Acrobatics 40+20=60, бросок 55 — успех", async () => {
    const a = faller([talent(CATFALL)]);
    a.system.skills = { acrobatics: { total: 40 } };
    captured.dice = [8, 55, 1]; // урон, Группирование (55 ≤ 60 — успех), нога
    await _resolveFallDamage(a, 6, { tuck: true });
    const html = captured.chat.at(-1).content;
    expect(html).toContain("Acrobatics 60");
    expect(html).toContain("Кошачье Приземление +20");
    expect(html).toContain("Успех");
  });

  it("падение ниже A.b: урон 1d10, на ногах", async () => {
    const a = faller([talent(CATFALL)]);
    captured.dice = [3, 1];
    await _resolveFallDamage(a, 2);
    expect(captured.chat.at(-1).content).toContain('data-damage="3"'); // 3 + 0
  });
});

// ── Живой Щит ───────────────────────────────────────────────────────────────

describe("Живой Щит: сектор укрытия 180°", () => {
  /** holder держит held; Талант — у holder. */
  async function grappled({ holderTalent }) {
    const mk = (name, uuid, items = []) => {
      const a = fighter({ items });
      a.name = name; a.uuid = uuid;
      a.system.conditions = { grappling: false };
      a.system.sizeTotal = 0;
      a.getActiveTokens = () => a._token ? [a._token] : [];
      return a;
    };
    const holder = mk("Держащий", "Actor.h", holderTalent ? [talent("Meat Shield / Живой Щит")] : []);
    const held = mk("Удерживаемый", "Actor.t");
    const byUuid = { [holder.uuid]: holder, [held.uuid]: held };
    globalThis.fromUuidSync = uuid => byUuid[uuid] ?? null;
    globalThis.fromUuid = async uuid => byUuid[uuid] ?? null;
    await resolveGrappleSuccess(holder, { target: held });
    return { holder, held };
  }

  it("inGrappleCoverArc: угол задаётся параметром", () => {
    const target = { x: 0, y: 0 }, partner = { x: 100, y: 0 };
    const side = { x: 0, y: 300 };           // 90° от направления на партнёра
    expect(inGrappleCoverArc(target, partner, side)).toBe(false);
    expect(inGrappleCoverArc(target, partner, side, 90)).toBe(true);
  });

  it("с Талантом: атака сбоку (90°) уходит в захваченного, в том числе Избирательная", async () => {
    const { holder, held } = await grappled({ holderTalent: true });
    held._token = { center: { x: 100, y: 0 } };
    const targetToken = { center: { x: 0, y: 0 }, actor: holder };
    const attackerToken = { center: { x: 0, y: 300 }, actor: { uuid: "Actor.shooter" } };
    expect(grappleCoverPartner({ attackerToken, targetToken, targetActor: holder, aimed: false })).toBe(held);
    expect(grappleCoverPartner({ attackerToken, targetToken, targetActor: holder, aimed: true })).toBe(held);
  });

  it("с Талантом: атака со спины держащего (из-за его спины, 180° от захваченного) — не в секторе", async () => {
    const { holder, held } = await grappled({ holderTalent: true });
    held._token = { center: { x: 100, y: 0 } };
    const targetToken = { center: { x: 0, y: 0 }, actor: holder };
    const attackerToken = { center: { x: -300, y: 0 }, actor: { uuid: "Actor.shooter" } };
    expect(grappleCoverPartner({ attackerToken, targetToken, targetActor: holder })).toBeNull();
  });

  it("без Таланта: та же атака сбоку (90°) в секторе ±45° не лежит", async () => {
    const { holder, held } = await grappled({ holderTalent: false });
    held._token = { center: { x: 100, y: 0 } };
    const targetToken = { center: { x: 0, y: 0 }, actor: holder };
    const attackerToken = { center: { x: 0, y: 300 }, actor: { uuid: "Actor.shooter" } };
    expect(grappleCoverPartner({ attackerToken, targetToken, targetActor: holder })).toBeNull();
  });

  it("Талант у ЗАХВАЧЕННОГО (он не Атакующий) ничего не расширяет", async () => {
    const { holder, held } = await grappled({ holderTalent: false });
    held.items.push(talent("Meat Shield / Живой Щит"));
    holder._token = { center: { x: 100, y: 0 } };
    const targetToken = { center: { x: 0, y: 0 }, actor: held };
    const attackerToken = { center: { x: 0, y: 300 }, actor: { uuid: "Actor.shooter" } };
    expect(grappleCoverPartner({ attackerToken, targetToken, targetActor: held })).toBeNull();
  });
});

// ── Мастер Боя ──────────────────────────────────────────────────────────────

describe("Мастер Боя: строки численного перевеса в окне рукопашной атаки", () => {
  const html = () => captured.dialog?.content ?? "";
  function modLine(label) {
    const idx = html().indexOf(`<span>${label}`);
    if (idx < 0) return null;
    const before = html().slice(Math.max(0, idx - 500), idx);
    const tag = before.slice(before.lastIndexOf("<input"));
    const m = tag.match(/data-value="(-?\d+)"/);
    return { value: m ? Number(m[1]) : null, disabled: /\sdisabled/.test(tag) };
  }
  const melee = () => weaponFor({ weaponClass: "melee" });

  it("против цели без Таланта: +10 и +20 на месте", () => {
    const weapon = melee();
    setTargets([fighter({ items: [] })]);
    showAttackDialog(fighter({ items: [weapon], fatigue: { value: 0 }, aiming: "none" }), weapon);
    expect(modLine("Числ. перевес 2к1").value).toBe(10);
    expect(modLine("Числ. перевес 3к1").value).toBe(20);
  });

  it("против цели с Мастером Боя: обе строки гасятся", () => {
    const weapon = melee();
    setTargets([fighter({ items: [talent("Combat Master / Мастер Боя")] })]);
    showAttackDialog(fighter({ items: [weapon], fatigue: { value: 0 }, aiming: "none" }), weapon);
    expect(modLine("Числ. перевес 2к1")).toMatchObject({ value: 0, disabled: true });
    expect(modLine("Числ. перевес 3к1")).toMatchObject({ value: 0, disabled: true });
    expect(html()).toContain("Мастер Боя");
  });

  it("Мастер Боя у АТАКУЮЩЕГО цели не мешает", () => {
    const weapon = melee();
    setTargets([fighter({ items: [] })]);
    showAttackDialog(fighter({ items: [weapon, talent("Combat Master / Мастер Боя")], fatigue: { value: 0 }, aiming: "none" }), weapon);
    expect(modLine("Числ. перевес 3к1").value).toBe(20);
  });
});

// ── Осторожность ────────────────────────────────────────────────────────────

describe("Осторожность: +1 Реакция за ментальное полудействие", () => {
  const CAUTION = "Caution / Осторожность";
  const inCombat = () => { globalThis.game.combat = { started: true }; };
  const hero = (items = [talent(CAUTION)]) => {
    const a = fighter({ items, actionPoints: { value: 2, max: 2 }, reactions: { value: 1 } });
    return a;
  };

  it("вне боя и без Таланта — причина отказа", () => {
    expect(cautionBlockReason(hero())).toContain("только в бою");
    inCombat();
    expect(cautionBlockReason(hero([]))).toContain("Нужен Талант");
  });

  it("в бою: −1 ОД, +1 Реакция, отметка Хода и Концентрации", async () => {
    inCombat();
    const a = hero();
    await applyCaution(a);
    expect(a.system.actionPoints.value).toBe(1);
    expect(a.system.reactions.value).toBe(2);
    expect(a._store["warhammer-dbc.cautionThisTurn"]).toBe(true);
    expect(a._store["warhammer-dbc.concentrationActionsThisTurn"]).toBe(1);
    expect(captured.chat.at(-1).content).toContain("+1 Реакция");
  });

  it("второй раз в том же Ходу — отказ, ОД и Реакции не тронуты", async () => {
    inCombat();
    const a = hero();
    await applyCaution(a);
    resetCaptured();
    await applyCaution(a);
    expect(a.system.actionPoints.value).toBe(1);
    expect(a.system.reactions.value).toBe(2);
    expect(captured.warnings.some(w => w.includes("уже использована"))).toBe(true);
  });

  it("в этом Ходу уже была Концентрация — отказ", async () => {
    inCombat();
    const a = hero();
    a._store["warhammer-dbc.concentrationActionsThisTurn"] = 1;
    await applyCaution(a);
    expect(a.system.reactions.value).toBe(1);
    expect(captured.warnings.some(w => w.includes("Концентрация"))).toBe(true);
  });

  it("не хватает ОД — Реакция не выдаётся", async () => {
    inCombat();
    const a = hero();
    a.system.actionPoints.value = 0;
    await applyCaution(a);
    expect(a.system.reactions.value).toBe(1);
    expect(a._store["warhammer-dbc.cautionThisTurn"]).toBeUndefined();
  });
});

// ── Скоростная Внимательность ───────────────────────────────────────────────

describe("Скоростная Внимательность", () => {
  const SA = "Speed Awareness / Скоростная Внимательность";
  const chars = { ws: { total: 45, bonus: 4 }, bs: { total: 45, bonus: 4 }, s: { total: 40, bonus: 4 }, t: { total: 40, bonus: 4 },
                  ag: { total: 60, bonus: 6 }, per: { total: 40, bonus: 4 } };
  const runner = (items) => fighter({
    items, characteristics: chars, reactions: { value: 1, defenseValue: 0 },
    skills: { dodge: { rank: "trained", total: 60 } }, movement: { run: 18 }, flagsInit: { "warhammer-dbc.running": true }
  });

  it("canSpendReaction: после Бега Реакции закрыты, у носителя Избегание открыто", () => {
    globalThis.game.combat = { started: true };
    const plain = runner([]);
    const gifted = runner([talent(SA)]);
    expect(canSpendReaction(plain, { forDefense: true })).toBe(false);
    expect(canSpendReaction(gifted, { forDefense: true })).toBe(true);
    // не Избегание — по-прежнему нельзя
    expect(canSpendReaction(gifted, { forDefense: false })).toBe(false);
  });

  it("Уклонение: спрашивает дистанцию, штраф −5 за каждые P.b м уходит в порог и подпись", async () => {
    const a = runner([talent(SA)]);
    captured.dice = [10];
    const p = _performDodge(a, { extraMod: 0 });
    await flush();
    expect(captured.dialog?.window?.title).toContain("Скоростная Внимательность");
    await captured.press("go", fakeForm({ '[name="meters"]': "20" }));
    await p;
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Скоростная Внимательность: бежал 20 м → -25");
  });

  it("дистанция по умолчанию — реально измеренный пробег токена (wdbc-l2urs), а не полный Бег", async () => {
    const a = runner([talent(SA)]);
    a._store["warhammer-dbc.ranMetersThisTurn"] = 7.9;
    captured.dice = [10];
    const p = _performDodge(a, { extraMod: 0 });
    await flush();
    // Округление вниз: 7,9 м при P.b 4 — одни полные 4 м (−5), а не 8 м (−10).
    expect(captured.dialog.content).toContain('value="7"');
    expect(captured.dialog.content).toContain("измерено");
    captured.dismiss();
    await p;
  });

  it("пробег не измеряли — по умолчанию полный Бег, как раньше", async () => {
    const a = runner([talent(SA)]);
    captured.dice = [10];
    const p = _performDodge(a, { extraMod: 0 });
    await flush();
    expect(captured.dialog.content).toContain('value="18"');
    expect(captured.dialog.content).not.toContain("измерено");
    captured.dismiss();
    await p;
  });

  it("Уклонение: отмена диалога — ничего не брошено, Реакция не потрачена", async () => {
    globalThis.game.combat = { started: true };
    const a = runner([talent(SA)]);
    a.system.reactions.defenseValue = 1;
    const p = _performDodge(a, { extraMod: 0 });
    await flush();
    captured.dismiss();
    await p;
    expect(captured.chat).toHaveLength(0);
    expect(a.system.reactions.defenseValue).toBe(1);
  });

  it("не бежал — диалога нет", async () => {
    const a = runner([talent(SA)]);
    delete a._store["warhammer-dbc.running"];
    captured.dice = [10];
    await _performDodge(a, { extraMod: 0 });
    expect(captured.dialog).toBeNull();
  });
});

// ── Оплот ───────────────────────────────────────────────────────────────────

describe("Оплот", () => {
  const BULWARK = "Bulwark / Оплот";
  const shield = ({ balance = 0 } = {}) => {
    const w = weaponFor({ weaponClass: "melee", balance, equipped: true, hands: 1, shieldAP: 4, meleeCategory: "Щит" },
      { id: "sh1", name: "Щит" });
    w.type = "weapon";
    return w;
  };
  const hero = (items, ...caps) => {
    clearRuleSources();
    registerRuleSource("test", () => caps.map(c => ({
      id: c, label: c, when: {}, effects: [{ kind: "grantFlag", target: c }]
    })));
    return fighter({ items });
  };

  it("Парирование щитом с Оплотом бросается дважды, берётся лучший", async () => {
    const a = hero([shield(), talent(BULWARK)]);
    captured.dice = [90, 10]; // первый — провал, второй — успех
    await _performParry(a, { extraMod: 0, attackerUuid: "Actor.attacker-1" });
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Парирование успешно");
    expect(card).toContain("Оплот");
  });

  it("без Оплота тот же бросок 90 — провал, кубов использован один", async () => {
    const a = hero([shield()]);
    captured.dice = [90, 10];
    await _performParry(a, { extraMod: 0, attackerUuid: "Actor.attacker-1" });
    expect(captured.chat.at(-1).content).toContain("Парирование провалено");
    expect(captured.dice).toEqual([10]);
  });

  it("не щит (обычный клинок) — Оплот Преимущества не даёт", async () => {
    const sword = weaponFor({ weaponClass: "melee", balance: 0, equipped: true, hands: 1, meleeCategory: "Меч" }, { id: "s1", name: "Меч" });
    sword.type = "weapon";
    const a = hero([sword, talent(BULWARK)]);
    captured.dice = [90, 10];
    await _performParry(a, { extraMod: 0, attackerUuid: "Actor.attacker-1" });
    expect(captured.chat.at(-1).content).toContain("Парирование провалено");
  });

  it("Щит Клинков: щит с Балансом −1 не годится, с Оплотом — Баланс считается 1", async () => {
    const without = hero([shield({ balance: -1 })], "dodge.core.bladeShield");
    captured.dice = [10];
    await _performParry(without, { extraMod: 0, attackerUuid: "Actor.attacker-1", isMelee: false });
    expect(captured.chat.at(-1).content).toContain("требует оружия с Балансом 1");

    resetCaptured();
    const withBulwark = hero([shield({ balance: -1 }), talent(BULWARK)], "dodge.core.bladeShield");
    captured.dice = [10, 10];
    await _performParry(withBulwark, { extraMod: 0, attackerUuid: "Actor.attacker-1", isMelee: false });
    expect(captured.chat.at(-1).content).not.toContain("требует оружия с Балансом 1");
    expect(captured.chat.at(-1).content).toContain("Парирование");
  });
});

// ── Высокая Защитная Стойка ─────────────────────────────────────────────────

describe("Высокая Защитная Стойка: Вольт через Parry(WS)", () => {
  const HG = "High Guard / Высокая Защитная Стойка";
  const sword = (balance) => {
    const w = weaponFor({ weaponClass: "melee", balance, equipped: true, hands: 1, meleeCategory: "Меч" }, { id: "s1", name: "Меч" });
    w.type = "weapon";
    return w;
  };
  const vaulter = (items) => {
    const a = fighter({ items, skills: { acrobatics: { total: 30 }, parry: { total: 55 } } });
    a.getActiveTokens = () => [];
    return a;
  };

  it("без Таланта Вольт бросает Acrobatics", async () => {
    captured.dice = [10];
    await declareVault(vaulter([sword(1)]));
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Acrobatics");
    expect(card).not.toContain("Высокая Защитная Стойка");
  });

  it("с Талантом: Parry 55 + Баланс 1 (+10) = 65", async () => {
    captured.dice = [10];
    await declareVault(vaulter([sword(1), talent(HG)]));
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Высокая Защитная Стойка");
    expect(card).toContain("Parry");
    expect(card).toContain("65");
  });

  it("оружие нельзя парировать (Баланс −2) — Вольт обычной Acrobatics", async () => {
    captured.dice = [10];
    await declareVault(vaulter([sword(-2), talent(HG)]));
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Acrobatics");
    expect(card).toContain("парировать нельзя");
  });
});
