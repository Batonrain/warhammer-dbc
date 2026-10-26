// test/rules/reaper-show-off.test.mjs
//
// Чистые условия Талантов «Рукопашные» Жнец (Reaper) и Рисовка (Show-Off), Sahara 3-8dc5:
//   rules/melee-talents.mjs (reaperTriggered, reaperMeasure, freeMeleeFlags),
//   rules/show-off.mjs, rules/command-suppression.mjs.
// Данные Талантов — настоящие документы packs-src.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { actorFor } from "../support/combat-fixtures.mjs";
import { packDocById } from "../support/pack-doc.mjs";
import {
  reaperTriggered, reaperBonusLeft, REAPER_BONUS_FLAG, reaperMeasure, freeMeleeFlags, freeAttackLockProblem, tenacityOffered, hasMeleeTalent, MELEE_TALENTS, REAPER_CHAIN_FLAG
} from "../../module/rules/melee-talents.mjs";
import {
  showOffMaxTargets, showOffPickTargets, showOffFreeAttackWon, SHOW_OFF_FREE_ATTACK_MARGIN
} from "../../module/rules/show-off.mjs";
import { commandSuppression, commandSuppressedNow, commandSuppressionExpired } from "../../module/rules/command-suppression.mjs";
import { TURN_SCOPED_FLAG_KEYS } from "../../module/rules/turn-flags.mjs";

const byKey = key => ({
  id: "k-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});
const byName = name => ({ id: "t-" + name, name, type: "talent", system: {} });

describe("данные пака", () => {
  const caps = id => (packDocById("packs-src/talents/Рукопашные", id).flags["warhammer-dbc"].mechanics ?? [])
    .flatMap(g => g.entries).filter(e => e.kind === "capability").map(e => e.capabilityKey);
  it("Жнец и Рисовка несут запись Конструктора с ключом возможности", () => {
    expect(caps("KtbKaBaWpAGr9ulj")).toContain(MELEE_TALENTS.reaper.key);
    expect(caps("eGGyH6i9CZ26emZs")).toContain(MELEE_TALENTS.showOff.key);
  });
  it("служебные флаги Хода внесены в реестр", () => {
    expect(TURN_SCOPED_FLAG_KEYS).toContain(REAPER_CHAIN_FLAG);
  });
});

describe("Жнец: когда убийство на Натиске даёт кнопку Жнеца", () => {
  const ok = { melee: true, chargeBase: true };
  const reaper = () => actorFor({ items: [byKey(MELEE_TALENTS.reaper.key)] });
  it("Талант, рукопашный удар Базой Натиск — да (лимит Атак не нужен: Талант сам даёт +1)", () => {
    expect(reaperTriggered(reaper(), ok)).toBe(true);
  });
  it("Талант по имени (снимок без записи Конструктора) — тоже", () => {
    expect(reaperTriggered(actorFor({ items: [byName("Reaper / Жнец")] }), ok)).toBe(true);
  });
  it("«Лорд Жнец» — другой Талант, не считается", () => {
    expect(reaperTriggered(actorFor({ items: [byName("Lord Reaper / Лорд Жнец")] }), ok)).toBe(false);
  });
  it("не Натиск — нет", () => {
    expect(reaperTriggered(reaper(), { ...ok, chargeBase: false })).toBe(false);
  });
  it("не рукопашная — нет", () => {
    expect(reaperTriggered(reaper(), { ...ok, melee: false })).toBe(false);
  });
  it("без Таланта — нет", () => {
    expect(reaperTriggered(actorFor({}), ok)).toBe(false);
  });
});

describe("Жнец: замер по токенам", () => {
  const base = { charge: 9, halfMove: 3, walked: 0, initialToNext: 2, attackerToNext: 4 };
  it("в пределах Полудвижения от начальной цели и дистанции Натиска — можно", () => {
    const r = reaperMeasure(base);
    expect(r.ok).toBe(true);
    expect(r.problems).toEqual([]);
  });
  it("дальше Полудвижения (SPD) от начальной цели — отказ с числами", () => {
    const r = reaperMeasure({ ...base, initialToNext: 4 });
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toContain("Полудвижения");
    expect(r.problems.join(" ")).toContain("3");
  });
  it("ровно на границе Полудвижения — можно (допуск сетки)", () => {
    expect(reaperMeasure({ ...base, initialToNext: 3 }).ok).toBe(true);
    expect(reaperMeasure({ ...base, initialToNext: 3.005 }).ok).toBe(true);
  });
  it("пройденное + путь до цели больше Натиска — отказ", () => {
    const r = reaperMeasure({ ...base, walked: 6, attackerToNext: 4 });
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toContain("Натиска");
  });
  it("пройденное + путь ровно равны Натиску — можно", () => {
    expect(reaperMeasure({ ...base, walked: 5, attackerToNext: 4 }).ok).toBe(true);
  });
  it("оба предела нарушены — обе причины названы", () => {
    const r = reaperMeasure({ ...base, initialToNext: 5, walked: 8, attackerToNext: 4 });
    expect(r.problems).toHaveLength(2);
  });
  it("скорость неизвестна (нули) — отказ, а не молчаливое «можно»", () => {
    expect(reaperMeasure({ ...base, charge: 0 }).ok).toBe(false);
    expect(reaperMeasure({ ...base, halfMove: 0 }).ok).toBe(false);
  });
  it("нет измерения (null/NaN) — отказ", () => {
    expect(reaperMeasure({ ...base, initialToNext: null }).ok).toBe(false);
    expect(reaperMeasure({ ...base, attackerToNext: NaN }).ok).toBe(false);
  });
});

describe("Свободные атаки Талантов: что снимает окно атаки", () => {
  it("обычная атака — ничего", () => {
    expect(freeMeleeFlags({})).toEqual({ noAp: false, uncounted: false, skipChargeGate: false });
  });
  it("Упорство: ни ОД, ни лимита", () => {
    expect(freeMeleeFlags({ tenacityRepeat: true })).toEqual({ noAp: true, uncounted: true, skipChargeGate: true });
  });
  it("Рисовка: не считается атакой — ни ОД, ни лимита", () => {
    expect(freeMeleeFlags({ showOffFree: true })).toEqual({ noAp: true, uncounted: true, skipChargeGate: true });
  });
  it("Жнец: ОД не списываются (Натиск уже оплачен), атака не идёт в лимит — это дополнительная Атака Таланта", () => {
    expect(freeMeleeFlags({ reaperFollow: true })).toEqual({ noAp: true, uncounted: true, skipChargeGate: true });
  });
});

describe("Свободные атаки Талантов: База и Приём закреплены (ревью: иначе бесплатно поднять Базу/Приём)", () => {
  it("обычная атака — без ограничений", () => {
    expect(freeAttackLockProblem({}, { baseKey: "fullatk", maneuverKey: "swift" })).toBe("");
  });
  it("Рисовка: только Стандартная База и Обычная Атака", () => {
    const o = { showOffFree: true };
    expect(freeAttackLockProblem(o, { baseKey: "standard", maneuverKey: "standard" })).toBe("");
    expect(freeAttackLockProblem(o, { baseKey: "fullatk", maneuverKey: "standard" })).toContain("Стандартная");
    expect(freeAttackLockProblem(o, { baseKey: "charge", maneuverKey: "standard" })).not.toBe("");
    expect(freeAttackLockProblem(o, { baseKey: "standard", maneuverKey: "lightning" })).toContain("Обычная");
  });
  it("Упорство: та же База и тот же Приём, что у первой атаки", () => {
    const o = { tenacityRepeat: true, forceBase: "careful", technique: "thrust" };
    expect(freeAttackLockProblem(o, { baseKey: "careful", maneuverKey: "thrust" })).toBe("");
    expect(freeAttackLockProblem(o, { baseKey: "fullatk", maneuverKey: "thrust" })).toContain("Базой");
    expect(freeAttackLockProblem(o, { baseKey: "careful", maneuverKey: "swift" })).toContain("Приём");
  });
  it("Упорство без записанного Приёма — Обычная Атака", () => {
    const o = { tenacityRepeat: true, forceBase: "standard" };
    expect(freeAttackLockProblem(o, { baseKey: "standard", maneuverKey: "standard" })).toBe("");
    expect(freeAttackLockProblem(o, { baseKey: "standard", maneuverKey: "lightning" })).not.toBe("");
  });
  it("Жнец: только Натиск, Приём свободный", () => {
    const o = { reaperFollow: true };
    expect(freeAttackLockProblem(o, { baseKey: "charge", maneuverKey: "sweep" })).toBe("");
    expect(freeAttackLockProblem(o, { baseKey: "standard", maneuverKey: "standard" })).toContain("Натиск");
  });
});

describe("Упорство не предлагается на свободной атаке Рисовки", () => {
  const a = actorFor({ items: [byKey(MELEE_TALENTS.tenacity.key)] });
  const ok = { isMelee: true, technique: "standard", dual: false, attacksThisTurn: 1, tenacityChild: false };
  it("обычная атака — да; свободная атака Рисовки — нет", () => {
    expect(tenacityOffered(a, ok)).toBe(true);
    expect(tenacityOffered(a, { ...ok, showOffChild: true })).toBe(false);
  });
});

describe("Рисовка: до F.b целей в базовом контакте", () => {
  const fel = b => actorFor({ characteristics: { fel: { total: b * 10, bonus: b } } });
  it("предел — бонус Товарищества", () => {
    expect(showOffMaxTargets(fel(4))).toBe(4);
    expect(showOffMaxTargets(fel(0))).toBe(0);
    expect(showOffMaxTargets(actorFor({}))).toBe(0);
  });
  const e = n => ({ name: "враг" + n, uuid: "T." + n });
  it("врагов не больше F.b — берутся все", () => {
    const r = showOffPickTargets({ contact: [e(1), e(2)], targeted: [], max: 3 });
    expect(r.ok).toBe(true);
    expect(r.picked).toHaveLength(2);
  });
  it("врагов больше F.b, цели не выбраны — просим выцелить", () => {
    const r = showOffPickTargets({ contact: [e(1), e(2), e(3)], targeted: [], max: 2 });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("выцельте");
  });
  it("врагов больше F.b, выцелено не больше F.b из контакта — берутся выцеленные", () => {
    const r = showOffPickTargets({ contact: [e(1), e(2), e(3)], targeted: [e(3), e(1)], max: 2 });
    expect(r.ok).toBe(true);
    expect(r.picked.map(p => p.uuid)).toEqual(["T.3", "T.1"]);
  });
  it("выцелено больше F.b — отказ с числом", () => {
    const r = showOffPickTargets({ contact: [e(1), e(2), e(3)], targeted: [e(1), e(2), e(3)], max: 2 });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("2");
  });
  it("выцеленный не в контакте — отбрасывается; никого — отказ", () => {
    expect(showOffPickTargets({ contact: [e(1)], targeted: [e(9)], max: 2 }).picked.map(p => p.uuid)).toEqual(["T.1"]);
    const r = showOffPickTargets({ contact: [], targeted: [], max: 2 });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("контакте");
  });
  it("F.b = 0 — отказ", () => {
    expect(showOffPickTargets({ contact: [e(1)], targeted: [], max: 0 }).ok).toBe(false);
  });
  it("свободная атака — победа на 5+ Успехов (перевес), по книге «победил на 5+»", () => {
    expect(SHOW_OFF_FREE_ATTACK_MARGIN).toBe(5);
    expect(showOffFreeAttackWon({ margin: 5, deg: 5 })).toBe(true);
    expect(showOffFreeAttackWon({ margin: 4, deg: 6 })).toBe(false);
    expect(showOffFreeAttackWon({ margin: 7, deg: 0 })).toBe(false);   // победа меньшим провалом — Успехов нет
  });
});

describe("Рисовка: запрет Командования до начала следующего Хода Рисующегося", () => {
  const combat = { id: "C1", round: 3 };
  it("запись метки: кто, в каком бою и Раунде", () => {
    expect(commandSuppression("Actor.a", combat)).toEqual({ giverUuid: "Actor.a", combatId: "C1", round: 3 });
  });
  it("метка действует в том же бою; чужой бой и отсутствие метки — нет", () => {
    const f = commandSuppression("Actor.a", combat);
    expect(commandSuppressedNow(f, combat)).toBe(true);
    expect(commandSuppressedNow(f, { id: "C2", round: 3 })).toBe(false);
    expect(commandSuppressedNow(null, combat)).toBe(false);
    expect(commandSuppressedNow(f, null)).toBe(false);
  });
  it("истекает на следующем Ходу Рисующегося — раньше текущего Раунда метка не снимается", () => {
    const f = commandSuppression("Actor.a", combat);
    const same = id => id === "Actor.a";
    expect(commandSuppressionExpired(f, { combat: { id: "C1", round: 3 }, isGiver: same })).toBe(false);   // тот же Раунд
    expect(commandSuppressionExpired(f, { combat: { id: "C1", round: 4 }, isGiver: same })).toBe(true);
  });
  it("чужой Ход метку не снимает", () => {
    const f = commandSuppression("Actor.a", combat);
    expect(commandSuppressionExpired(f, { combat: { id: "C1", round: 4 }, isGiver: id => id === "Actor.b" })).toBe(false);
  });
  it("метка чужого (прошлого) боя считается истёкшей при любом Ходе", () => {
    const f = commandSuppression("Actor.a", combat);
    expect(commandSuppressionExpired(f, { combat: { id: "C2", round: 1 }, isGiver: () => false })).toBe(true);
  });
});

describe("hasMeleeTalent знает новые ключи", () => {
  it("по ключу и по имени", () => {
    expect(hasMeleeTalent(actorFor({ items: [byKey(MELEE_TALENTS.showOff.key)] }), "showOff")).toBe(true);
    expect(hasMeleeTalent(actorFor({ items: [byName("Show-Off / Рисовка")] }), "showOff")).toBe(true);
    expect(hasMeleeTalent(actorFor({}), "showOff")).toBe(false);
  });
});
