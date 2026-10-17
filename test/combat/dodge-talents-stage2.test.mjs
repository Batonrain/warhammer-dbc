// test/combat/dodge-talents-stage2.test.mjs
//
// Таланты Избегания (глава 3), второй проход: Освобождение от Пут, Ускользнуть,
// Чтец Клинков, Контрфинт, Пируэт, Отбить Выстрел, Телохранитель, Кусака,
// Размашистый Танец, Кувырок.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured, fakeHtml, fakeForm } from "../support/foundry-stub.mjs";
import { resistButtonData } from "../support/contest.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";
import { _showContestDialog } from "../../module/combat/techniques.mjs";
import {
  grappleTechDef, TARGET_TESTS, resolveGrappleSuccess
} from "../../module/combat/grapple.mjs";
import {
  registerContest, resolveResistClick, resolvePirouetteClick, _resetPendingContests
} from "../../module/combat/opposed-contest.mjs";
import { _performDodge, _performParry } from "../../module/combat/defense.mjs";
import { bodyguardsFor } from "../../module/combat/bodyguard.mjs";
import { defenseSection } from "../../module/combat/attack-card.mjs";
import { applyFlourishDance, flourishPenaltyAgainst } from "../../module/combat/flourish-dance.mjs";
import { flipTriggered, offerFlip, rollFlip, VOLUNTARY_PRONE_OPTION } from "../../module/combat/flip.mjs";

const DEFAULT_SOURCES = getRuleSources();
const flush = () => new Promise(r => setTimeout(r, 0));
const talent = name => ({ id: `t-${name}`, type: "talent", name, system: {}, getFlag: () => undefined });

/** Актор с флагами, update по пути (flags.* и -= разбираются как у Foundry). */
function fighter(name = "Боец", uuid = `Actor.${name}`, { items = [], size = 0, skills = {}, chars = {}, ...system } = {}) {
  const a = actorFor({ items, ...system });
  const flags = {};
  a.name = name; a.uuid = uuid; a.type = "character";
  a.system.sizeTotal = size;
  a.system.conditions = a.system.conditions ?? { grappling: false };
  a.system.skills = skills;
  a.system.characteristics = { ...a.system.characteristics, ...chars };
  a.system.meleeStance = "standard";
  a.system.encumbrance = { carry: 0 };
  a.system.actionPoints = { value: 2, max: 2 };
  a.getFlag = (_s, k) => flags[k];
  a.setFlag = async (_s, k, v) => { flags[k] = v; return v; };
  a.unsetFlag = async (_s, k) => { delete flags[k]; };
  a.update = async changes => {
    for (const [path, v] of Object.entries(changes)) {
      let m = path.match(/^flags\.[^.]+\.-=(.+)$/);
      if (m) { delete flags[m[1]]; continue; }
      m = path.match(/^flags\.[^.]+\.(.+)$/);
      if (m) { flags[m[1]] = v; continue; }
      const keys = path.split(".");
      let node = a;
      for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
      node[keys.at(-1)] = v;
    }
    return changes;
  };
  a._flags = flags;
  a.getActiveTokens = () => a._token ? [a._token] : [];
  return a;
}

const chars = (o = {}) => ({
  ws: { total: 45, bonus: 4 }, bs: { total: 45, bonus: 4 }, s: { total: 40, bonus: 4 }, t: { total: 40, bonus: 4 },
  ag: { total: 40, bonus: 4 }, per: { total: 40, bonus: 4 }, ...o
});

beforeEach(() => {
  resetCaptured();
  _resetPendingContests();
  globalThis.game.user = { ...globalThis.game.user, id: "user-1", isGM: true, targets: new Set() };
  globalThis.game.combat = undefined;
});
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
});

// ── Борьба: Освобождение от Пут и Ускользнуть ───────────────────────────────

describe("Выкрутиться: Освобождение от Пут и Ускользнуть", () => {
  async function grappledHeld(heldItems = [], squeeze = 0) {
    const holder = fighter("Держащий", "Actor.h");
    const held = fighter("Удерживаемый", "Actor.t", { items: heldItems, chars: chars(), skills: { acrobatics: { total: 55 } } });
    const byUuid = { [holder.uuid]: holder, [held.uuid]: held };
    globalThis.fromUuidSync = u => byUuid[u] ?? null;
    globalThis.fromUuid = async u => byUuid[u] ?? null;
    await resolveGrappleSuccess(holder, { target: held });
    if (squeeze) await held.setFlag("warhammer-dbc", "grappleSqueezeActive", squeeze);
    return { holder, held };
  }
  const roll = async (held, extraFields = {}) => {
    await _showContestDialog(held, grappleTechDef(held, TARGET_TESTS.twistFree));
    await captured.dialog.buttons.roll.callback(fakeHtml({ "#contest-char": "ag", "#contest-self": "55", "#contest-mod": "0", ...extraFields }));
  };
  const EA = "Escape Artist / Освобождение от Пут";
  const SA = "Slip Away / Ускользнуть";

  it("без Таланта штраф Сжатия остаётся: порог 55 − 20 = 35, бросок 30 — 1 Успех", async () => {
    const { held } = await grappledHeld([], 2);
    captured.dice = [30];
    await roll(held);
    expect(captured.chat.at(-1).content).toContain("Успех — 1");
  });

  it("с Освобождением от Пут штраф −20 снят (A.b×5 = 20), порог 55, бросок 30 → 3 Успеха ×2 = 6", async () => {
    const { held } = await grappledHeld([talent(EA)], 2);
    captured.dice = [30];
    await roll(held);
    const html = captured.chat.at(-1).content;
    expect(html).toContain("Успех — 6");
    expect(html).toContain("Освобождение от Пут");
  });

  it("малый штраф (−10 < A.b×3) разрешает переброс: бросается дважды, берётся лучший", async () => {
    const { held } = await grappledHeld([talent(EA)], 1);
    captured.dice = [95, 20];
    await roll(held);
    const html = captured.chat.at(-1).content;
    expect(html).toContain("Успех");
    expect(html).toContain("отброшено 95");
    expect(captured.dice).toEqual([]);
  });

  it("Освобождение от Пут действует только на Выкрутиться: Вырваться (Athletics) не затронуто", async () => {
    const { held } = await grappledHeld([talent(EA)], 2);
    held.system.skills.athletics = { total: 50 };
    captured.dice = [30];
    await _showContestDialog(held, grappleTechDef(held, TARGET_TESTS.breakFree));
    await captured.dialog.buttons.roll.callback(fakeHtml({ "#contest-char": "s", "#contest-self": "50", "#contest-mod": "0" }));
    expect(captured.chat.at(-1).content).not.toContain("Освобождение от Пут");
  });

  it("Ускользнуть: окно предлагает выбор раз в Раунд; «+30» поднимает порог и тратит возможность", async () => {
    globalThis.game.combat = { started: true, round: 1 };
    const { held } = await grappledHeld([talent(SA)]);
    captured.dice = [60];
    await _showContestDialog(held, grappleTechDef(held, TARGET_TESTS.twistFree));
    expect(captured.dialog.content).toContain('name="slip-away"');
    await captured.dialog.buttons.roll.callback(fakeHtml({
      "#contest-char": "ag", "#contest-self": "55", "#contest-mod": "0", 'input[name="slip-away"]:checked': "bonus" }));
    const html = captured.chat.at(-1).content;
    expect(html).toContain("Ускользнуть +30");
    expect(html).toContain("Успех"); // 85 ≥ 60

    // второй раз в том же Раунде — выбора больше нет
    resetCaptured();
    await _showContestDialog(held, grappleTechDef(held, TARGET_TESTS.twistFree));
    expect(captured.dialog.content).not.toContain('name="slip-away"');
  });

  it("Ускользнуть: переброс — два d100, лучший", async () => {
    const { held } = await grappledHeld([talent(SA)]);
    captured.dice = [95, 10];
    await roll(held, { 'input[name="slip-away"]:checked': "reroll" });
    expect(captured.chat.at(-1).content).toContain("отброшено 95");
  });

  it("без Таланта окно выбора Ускользнуть не показывается", async () => {
    const { held } = await grappledHeld([]);
    await _showContestDialog(held, grappleTechDef(held, TARGET_TESTS.twistFree));
    expect(captured.dialog.content).not.toContain('name="slip-away"');
  });
});

describe("Ускользнуть: Уклонение от атаки Захватом", () => {
  const SA = "Slip Away / Ускользнуть";
  const dodger = () => fighter("Юркий", "Actor.d", { items: [talent(SA)], chars: chars({ ag: { total: 50, bonus: 5 } }), skills: { dodge: { total: 40 } }, reactions: { value: 2, defenseValue: 0 } });

  it("спрашивает выбор; «+30» — в подписи и порог выше", async () => {
    globalThis.game.combat = { started: true, round: 1 };
    const a = dodger();
    captured.dice = [10];
    const p = _performDodge(a, { extraMod: 0, grappleAttack: true });
    await flush();
    expect(captured.dialog?.window?.title).toContain("Ускользнуть");
    await captured.press("bonus", fakeForm());
    await p;
    expect(captured.chat.at(-1).content).toContain("Ускользнуть +30");
  });

  it("не атака Захватом — диалога нет", async () => {
    globalThis.game.combat = { started: true, round: 1 };
    captured.dice = [10];
    await _performDodge(dodger(), { extraMod: 0 });
    expect(captured.dialog).toBeNull();
  });

  it("отмена диалога — бросок не сделан", async () => {
    const a = dodger();
    const p = _performDodge(a, { extraMod: 0, grappleAttack: true });
    await flush();
    captured.dismiss();
    await p;
    expect(captured.chat).toHaveLength(0);
  });
});

// ── Финт и Напролом ─────────────────────────────────────────────────────────

describe("Контрфинт и Чтец Клинков", () => {
  const initiator = fighter("Фехтовальщик", "Actor.i");
  const side = { char: "ws" };
  const registerFeint = opp => registerContest(initiator, { label: "Финт", note: "x" },
    { success: true, deg: 1, threshold: 60, rv: 10, side }, [opp]);

  it("Контрфинт: Awareness(P) среди вариантов сопротивления только у носителя", () => {
    const gifted = fighter("Бдительный", "Actor.g", { items: [talent("Counterfeint / Контрфинт")] });
    const plain = fighter("Обычный", "Actor.p");
    const optsOf = html => JSON.parse(html.match(/data-resist='([^']*)'/)[1].replace(/&quot;/g, '"'));
    expect(optsOf(registerFeint(gifted)).some(o => o.skill === "awareness")).toBe(true);
    expect(optsOf(registerFeint(plain)).some(o => o.skill === "awareness")).toBe(false);
  });

  it("Контрфинт работает только против Финта, не против Давления", () => {
    const gifted = fighter("Бдительный", "Actor.g", { items: [talent("Counterfeint / Контрфинт")] });
    const html = registerContest(initiator, { label: "Давление", note: "x" },
      { success: true, deg: 1, threshold: 60, rv: 10, side }, [gifted]);
    expect(html).not.toContain("awareness");
  });

  async function resist(opponent, { rolls }) {
    const byUuid = { [initiator.uuid]: initiator, [opponent.uuid]: opponent };
    globalThis.fromUuid = async u => byUuid[u] ?? null;
    captured.dice = rolls;
    const ds = {
      opponentUuid: opponent.uuid, actorUuid: initiator.uuid, label: "Финт", userId: "user-1", contestId: "nope",
      success: "1", deg: "1", threshold: "60", resist: JSON.stringify([{ char: "ws", mod: 0 }]), resistMods: "[]", rolls: "1"
    };
    return resolveResistClick(ds);
  }

  it("Чтец Клинков: Финт удался — предлагается переброс через Scrutiny(WS), второй результат заменяет первый", async () => {
    const reader = fighter("Чтец", "Actor.r", { items: [talent("Blade Reader / Чтец Клинков")], chars: chars({ ws: { total: 50, bonus: 5 } }),
      skills: { scrutiny: { rank: "trained", total: 0 } } });
    captured.confirmAnswer = true;
    const res = await resist(reader, { rolls: [95, 5] }); // первый провал, переброс — яркий успех
    expect(res.initiatorWins).toBe(false);
    const cards = captured.chat.map(c => c.content).join("\n");
    expect(cards).toContain("Чтец Клинков: переброс");
    expect(cards).toContain("Scrutiny(WS)");
  });

  it("Чтец Клинков: отказ от переброса — остаётся первый результат", async () => {
    const reader = fighter("Чтец", "Actor.r", { items: [talent("Blade Reader / Чтец Клинков")], chars: chars() });
    captured.confirmAnswer = false;
    const res = await resist(reader, { rolls: [95] });
    expect(res.initiatorWins).toBe(true);
    expect(captured.chat.map(c => c.content).join("\n")).not.toContain("переброс");
  });

  it("без Таланта переброс не предлагается", async () => {
    const plain = fighter("Обычный", "Actor.p", { chars: chars() });
    captured.confirmAnswer = true;
    const res = await resist(plain, { rolls: [95] });
    expect(res.initiatorWins).toBe(true);
    expect(captured.dialog).toBeNull();
  });

  it("Чтец Клинков: если сопротивление и так удалось — переброса нет", async () => {
    const reader = fighter("Чтец", "Actor.r", { items: [talent("Blade Reader / Чтец Клинков")], chars: chars({ ws: { total: 60, bonus: 6 } }) });
    captured.confirmAnswer = true;
    const res = await resist(reader, { rolls: [5] });
    expect(res.initiatorWins).toBe(false);
    expect(captured.chat).toHaveLength(1);
  });
});

describe("Пируэт: Напролом", () => {
  const bulldozer = fighter("Таран", "Actor.b");
  const reg = opp => registerContest(bulldozer, { label: "Напролом", note: "x" },
    { success: true, deg: 2, threshold: 60, rv: 10, side: { skill: "athletics" } }, [opp]);

  it("кнопка Пируэта есть только у носителя и только на Напроломе", () => {
    const dancer = fighter("Танцор", "Actor.t", { items: [talent("Pirouette / Пируэт")] });
    const plain = fighter("Обычный", "Actor.p");
    expect(reg(dancer)).toContain("wh-contest-pirouette-btn");
    expect(reg(plain)).not.toContain("wh-contest-pirouette-btn");
    const other = registerContest(bulldozer, { label: "Повалить", note: "x" },
      { success: true, deg: 2, threshold: 60, rv: 10, side: { skill: "athletics" } }, [dancer]);
    expect(other).not.toContain("wh-contest-pirouette-btn");
  });

  async function click(dancer, roll) {
    const byUuid = { [bulldozer.uuid]: bulldozer, [dancer.uuid]: dancer };
    globalThis.fromUuid = async u => byUuid[u] ?? null;
    captured.dice = [roll];
    return resolvePirouetteClick({
      opponentUuid: dancer.uuid, actorUuid: bulldozer.uuid, label: "Напролом", userId: "user-1", contestId: "nope"
    });
  }

  it("успех Acrobatics+0 — Напролом не удаётся, без Реакции", async () => {
    const dancer = fighter("Танцор", "Actor.t", { items: [talent("Pirouette / Пируэт")], skills: { acrobatics: { total: 50 } }, chars: chars() });
    const res = await click(dancer, 20);
    expect(res.success).toBe(true);
    expect(captured.chat.at(-1).content).toContain("не удаётся");
  });

  it("провал — Напролом остаётся в силе, обычное сопротивление доступно", async () => {
    const dancer = fighter("Танцор", "Actor.t", { items: [talent("Pirouette / Пируэт")], skills: { acrobatics: { total: 50 } }, chars: chars() });
    const res = await click(dancer, 90);
    expect(res.success).toBe(false);
    expect(captured.chat.at(-1).content).toContain("Пируэт не удался");
  });
});

// ── Отбить Выстрел, Кусака, Телохранитель ───────────────────────────────────

describe("Парирование: Отбить Выстрел", () => {
  const DEFLECT = "Deflect Shot / Отбить Выстрел";
  const sword = (balance = 1) => {
    const w = weaponFor({ weaponClass: "melee", balance, equipped: true, hands: 1, meleeCategory: "Меч" }, { id: "s1", name: "Меч" });
    w.type = "weapon";
    return w;
  };
  const shooter = fighter("Стрелок", "Actor.s");
  const projectile = (system, uuid) => {
    const w = weaponFor(system, { id: "p1", name: "Снаряд" });
    w.uuid = uuid;
    return w;
  };
  function hero(items) {
    clearRuleSources();
    const a = fighter("Защитник", "Actor.h", { items, chars: chars({ ws: { total: 45, bonus: 4 } }), skills: { parry: { rank: "expert", total: 75 } } });
    return a;
  }
  function wire(w) {
    const byUuid = { [shooter.uuid]: shooter, [w.uuid]: w };
    globalThis.fromUuid = async u => byUuid[u] ?? null;
  }

  it("без Таланта метательное без контакта парировать нельзя", async () => {
    const grenade = projectile({ weaponClass: "thrown", weaponType: "grenade" }, "Item.g");
    wire(grenade);
    await _performParry(hero([sword()]), { extraMod: 0, attackerUuid: shooter.uuid, isMelee: false, attackerWeaponUuid: grenade.uuid, hitsCount: 3 });
    expect(captured.chat.at(-1).content).toContain("Отбить Выстрел");
    expect(captured.chat.at(-1).content).not.toContain("Парирование успешно");
  });

  it("с Талантом и мечом Баланса 1: граната парируется, степени снимают попадания (не «одно»)", async () => {
    const grenade = projectile({ weaponClass: "thrown", weaponType: "grenade" }, "Item.g");
    wire(grenade);
    captured.dice = [5];
    await _performParry(hero([sword(), talent(DEFLECT)]), { extraMod: 0, attackerUuid: shooter.uuid, isMelee: false, attackerWeaponUuid: grenade.uuid, hitsCount: 3 });
    const html = captured.chat.at(-1).content;
    expect(html).toContain("Парирование успешно");
    expect(html).toContain("Отбить Выстрел");
    expect(html).toContain("снимает все 3");
  });

  it("5+ Успехов на гранате — «отбить обратно»", async () => {
    const grenade = projectile({ weaponClass: "thrown", weaponType: "grenade" }, "Item.g");
    wire(grenade);
    captured.dice = [1];
    await _performParry(hero([sword(), talent(DEFLECT)]), { extraMod: 0, attackerUuid: shooter.uuid, isMelee: false, attackerWeaponUuid: grenade.uuid });
    expect(captured.chat.at(-1).content).toContain("обратно в противника");
  });

  it("лазерная винтовка — не подходит, остаётся отказ", async () => {
    const laser = projectile({ weaponClass: "basic", weaponType: "laser" }, "Item.l");
    wire(laser);
    await _performParry(hero([sword(), talent(DEFLECT)]), { extraMod: 0, attackerUuid: shooter.uuid, isMelee: false, attackerWeaponUuid: laser.uuid });
    expect(captured.chat.at(-1).content).toContain("Щит Клинков");
    expect(captured.chat.at(-1).content).not.toContain("Парирование успешно");
  });

  it("оружие Баланса 0 — требуется Баланс 1+", async () => {
    const arrow = projectile({ weaponClass: "basic", weaponType: "lowtech" }, "Item.a");
    wire(arrow);
    await _performParry(hero([sword(0), talent(DEFLECT)]), { extraMod: 0, attackerUuid: shooter.uuid, isMelee: false, attackerWeaponUuid: arrow.uuid });
    expect(captured.chat.at(-1).content).toContain("Балансом 1 и выше");
  });

  it("стрела из лука: подходит", async () => {
    const arrow = projectile({ weaponClass: "basic", weaponType: "lowtech" }, "Item.a");
    wire(arrow);
    captured.dice = [5];
    await _performParry(hero([sword(), talent(DEFLECT)]), { extraMod: 0, attackerUuid: shooter.uuid, isMelee: false, attackerWeaponUuid: arrow.uuid });
    expect(captured.chat.at(-1).content).toContain("Парирование успешно");
  });
});

describe("Парирование: Кусака", () => {
  const bite = (balance = -1) => {
    const w = weaponFor({ weaponClass: "melee", balance, equipped: true, hands: 0, damage: "1d5" }, { id: "b1", name: "Bite / Укус" });
    w.type = "weapon";
    return w;
  };
  const attacker = fighter("Нападающий", "Actor.a");
  const hero = (items) => {
    const a = fighter("Зверь", "Actor.z", { items, chars: chars(), skills: { parry: { rank: "trained", total: 60 } } });
    globalThis.fromUuid = async u => ({ [attacker.uuid]: attacker, [a.uuid]: a })[u] ?? null;
    return a;
  };

  it("без Таланта — отказ с причиной, Реакция не тратится", async () => {
    await _performParry(hero([bite()]), { extraMod: 0, attackerUuid: attacker.uuid, chomper: true });
    expect(captured.chat.at(-1).content).toContain("нужен Талант");
  });

  it("с Талантом: парирует укусом, Баланс 0 (а не −1), кнопка Обезоружить и строка про голову", async () => {
    captured.dice = [10];
    await _performParry(hero([bite(-1), talent("Chomper / Кусака")]), { extraMod: 0, attackerUuid: attacker.uuid, chomper: true });
    const html = captured.chat.at(-1).content;
    expect(html).toContain("Оружие: Bite / Укус (Баланс +0)");
    expect(html).toContain("Кусака");
    expect(html).toContain("идут в голову");
    expect(html).toContain("wh-chomper-disarm-btn");
  });

  it("провал парирования: кнопки Обезоружить нет", async () => {
    captured.dice = [99];
    await _performParry(hero([bite(), talent("Chomper / Кусака")]), { extraMod: 0, attackerUuid: attacker.uuid, chomper: true });
    expect(captured.chat.at(-1).content).not.toContain("wh-chomper-disarm-btn");
  });

  it("кнопка «Парировать укусом» на карточке — только у цели с Талантом и укусом", () => {
    const html = defenseSection({ chomper: true }, { wp: {}, attackerUuid: "Actor.a", isMelee: true });
    expect(html).toContain("wh-chomper-parry-btn");
    expect(html).toContain('data-chomper="1"');
    expect(defenseSection({}, { wp: {}, attackerUuid: "Actor.a", isMelee: true })).not.toContain("wh-chomper-parry-btn");
    expect(defenseSection({ chomper: true }, { wp: {}, attackerUuid: "Actor.a", isMelee: false })).not.toContain("wh-chomper-parry-btn");
  });
});

describe("Телохранитель", () => {
  const BG = "Bodyguard / Телохранитель";
  beforeEach(() => { globalThis.canvas = { grid: { size: 100 }, tokens: { placeables: [] } }; });
  afterEach(() => { globalThis.canvas = {}; });
  const token = (id, x, y, actor, disposition = 1) => ({
    id, name: actor?.name, actor, document: { id, x, y, width: 1, height: 1, disposition }
  });

  it("находит носителя в контакте с атакующим на стороне цели", () => {
    const guard = fighter("Страж", "Actor.g", { items: [talent(BG)] });
    const ally = fighter("Союзник", "Actor.y");
    const foe = fighter("Враг", "Actor.f");
    const attackerToken = token("A", 0, 0, foe, -1);
    const targetToken = token("T", 0, 300, ally);
    const guardToken = token("G", 100, 0, guard);              // рядом с атакующим
    const farGuard = token("F", 500, 500, fighter("Далёкий", "Actor.far", { items: [talent(BG)] })); // далеко
    const list = bodyguardsFor({ attackerToken, targetToken, tokens: [attackerToken, targetToken, guardToken, farGuard] });
    expect(list).toEqual([{ uuid: "Actor.g", name: "Страж" }]);
  });

  it("не предлагает самой цели, атакующего и тех, кто на чужой стороне или без Таланта", () => {
    const ally = fighter("Союзник", "Actor.y", { items: [talent(BG)] });
    const foe = fighter("Враг", "Actor.f", { items: [talent(BG)] });
    const enemyGuard = fighter("Чужой", "Actor.e", { items: [talent(BG)] });
    const noTalent = fighter("Простой", "Actor.n");
    const attackerToken = token("A", 0, 0, foe, -1);
    const targetToken = token("T", 100, 0, ally);
    const tokens = [attackerToken, targetToken, token("E", 0, 100, enemyGuard, -1), token("N", 100, 100, noTalent)];
    expect(bodyguardsFor({ attackerToken, targetToken, tokens })).toEqual([]);
  });

  it("без токенов — пусто", () => {
    expect(bodyguardsFor({ attackerToken: null, targetToken: null })).toEqual([]);
  });

  it("кнопки на карточке: по одной на телохранителя, с uuid и именем союзника", () => {
    const html = defenseSection({ bodyguards: [{ uuid: "Actor.g", name: "Страж" }], allyName: "Союзник" },
      { wp: {}, attackerUuid: "Actor.a", isMelee: true });
    expect(html).toContain('data-bodyguard-uuid="Actor.g"');
    expect(html).toContain('data-for-ally="Союзник"');
    expect(html).toContain("Телохранитель: Страж");
  });

  it("парирование за союзника: в заголовке «за <имя>»", async () => {
    const guard = fighter("Страж", "Actor.g", { items: [talent(BG)], chars: chars(), skills: { parry: { rank: "trained", total: 60 } } });
    const w = weaponFor({ weaponClass: "melee", balance: 0, equipped: true, hands: 1, meleeCategory: "Меч" }, { id: "s1", name: "Меч" });
    w.type = "weapon"; guard.items.push(w);
    captured.dice = [10];
    await _performParry(guard, { extraMod: 0, attackerUuid: "Actor.f", forAlly: "Союзник" });
    expect(captured.chat.at(-1).content).toContain("за Союзник");
  });
});

// ── Размашистый Танец ───────────────────────────────────────────────────────

describe("Размашистый Танец", () => {
  const FD = "Flourish Dance / Размашистый Танец";
  const dancer = (items = [talent(FD)], trade = [{ specialty: "Dancer", total: 60 }]) => {
    const a = fighter("Танцор", "Actor.d", { items, chars: chars() });
    a.system.groupSkills = { trade };
    return a;
  };
  const victim = () => fighter("Жертва", "Actor.v", { chars: chars(), skills: { awareness: { total: 30 } } });

  async function dance(a, free = false) {
    const p = applyFlourishDance(a);
    await flush();
    await captured.press("go", fakeForm({ '[name="free"]': free }));
    await p;
  }

  it("победа танцора: −5 за каждый его Успех, флаг на танцоре, штраф виден атаке цели", async () => {
    const a = dancer(); const v = victim();
    setTargets([v]);
    captured.dice = [20, 80]; // танцор 60: Успех 5; цель 30: провал
    await dance(a);
    expect(a._flags.flourishDance.penalty).toBe(-25);
    expect(flourishPenaltyAgainst(a, v)).toBe(-25);
    expect(flourishPenaltyAgainst(a, fighter("Посторонний", "Actor.x"))).toBe(0);
    expect(a.system.actionPoints.value).toBe(2); // вне боя ОД не берутся
  });

  it("в бою полудействие стоит 1 ОД, «как часть движения» — бесплатно", async () => {
    globalThis.game.combat = { started: true, round: 1 };
    setTargets([victim()]);
    const a = dancer();
    captured.dice = [20, 80];
    await dance(a, false);
    expect(a.system.actionPoints.value).toBe(1);
    const b = dancer();
    captured.dice = [20, 80];
    await dance(b, true);
    expect(b.system.actionPoints.value).toBe(2);
  });

  it("проигрыш танцора — штрафа нет", async () => {
    const a = dancer(); const v = victim();
    setTargets([v]);
    captured.dice = [90, 5];
    await dance(a);
    expect(a._flags.flourishDance).toBeUndefined();
    expect(captured.chat.at(-1).content).toContain("штрафа нет");
  });

  it("без цели, без Таланта или без Trade (Dancer) — предупреждение", async () => {
    await applyFlourishDance(dancer());
    expect(captured.warnings.some(w => w.includes("цель"))).toBe(true);
    resetCaptured(); setTargets([victim()]);
    await applyFlourishDance(dancer([]));
    expect(captured.warnings.some(w => w.includes("Flourish Dance"))).toBe(true);
    resetCaptured(); setTargets([victim()]);
    await applyFlourishDance(dancer([talent(FD)], []));
    expect(captured.warnings.some(w => w.includes("Dancer"))).toBe(true);
  });
});

// ── Кувырок ─────────────────────────────────────────────────────────────────

describe("Кувырок", () => {
  const FLIP = "Flip / Кувырок";
  const flipper = () => {
    const a = fighter("Акробат", "Actor.f", { items: [talent(FLIP)], chars: chars(), skills: { acrobatics: { total: 60 } } });
    a.system.conditions = { prone: true };
    return a;
  };

  it("flipTriggered: Повален стал истиной, но не по своей воле", () => {
    expect(flipTriggered({ system: { conditions: { prone: true } } }, {})).toBe(true);
    expect(flipTriggered({ system: { conditions: { prone: true } } }, { [VOLUNTARY_PRONE_OPTION]: true })).toBe(false);
    expect(flipTriggered({ system: { conditions: { prone: false } } }, {})).toBe(false);
    expect(flipTriggered({ system: { conditions: { blinded: true } } }, {})).toBe(false);
    expect(flipTriggered(undefined)).toBe(false);
  });

  it("offerFlip: карточка с кнопкой только у носителя", async () => {
    expect(await offerFlip(flipper())).toBe(true);
    expect(captured.chat.at(-1).content).toContain("wh-flip-btn");
    resetCaptured();
    const plain = flipper(); plain.items.length = 0;
    expect(await offerFlip(plain)).toBe(false);
    expect(captured.chat).toHaveLength(0);
  });

  it("rollFlip: успех снимает Повален", async () => {
    const a = flipper();
    captured.dice = [20];
    const res = await rollFlip(a);
    expect(res.success).toBe(true);
    expect(a.system.conditions.prone).toBeFalsy();
  });

  it("rollFlip: провал оставляет Повален", async () => {
    const a = flipper();
    captured.dice = [95];
    const res = await rollFlip(a);
    expect(res.success).toBe(false);
    expect(a.system.conditions.prone).toBe(true);
  });

  it("rollFlip: уже не Повален — предупреждение, броска нет", async () => {
    const a = flipper();
    a.system.conditions.prone = false;
    await rollFlip(a);
    expect(captured.warnings.length).toBeGreaterThan(0);
    expect(captured.chat).toHaveLength(0);
  });
});
