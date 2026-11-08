import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { packDocById } from "../support/pack-doc.mjs";
import {
  PSYCHIC_SPRINT_KEY, PSYCHIC_SPRINT_EFFECT_KEY, PSYCHIC_SPRINT_PENDING_FLAG, psychicSprintEpr, psychicSprintTestMod, psychicSprintThreshold,
  psychicSprintSpeedBonus, discountedMovementAp
} from "../../module/rules/psychic-sprint.mjs";
import { startPsychicSprint, psychicSprintActive, movementApCost, processPsychicSprintCombatStart } from "../../module/combat/psychic-sprint.mjs";
import { talentActionsHtml, runTalentAction, isPsychicSprintItem } from "../../module/apps/talent-actions.mjs";
import { timedEffectData, timedEffectStale, TIMED_EFFECT_FLAG } from "../../module/combat/timed-effects.mjs";
import { expectedPhase } from "../../module/constants/effect-keys.mjs";
import { isCapabilityAvailable } from "../../module/rules/cooldown.mjs";
import { declareFullMove, declareRun } from "../../module/combat/movement-actions.mjs";

const NS = "warhammer-dbc";
const PACK_ITEM = packDocById("packs-src/aeldari-talents/Элитные_архетипы/Высший_Варлок", "f7kczW3tFshlKWGq");

const talent = () => ({
  id: "t1", type: "talent", name: "A Psychic Sprint / Психический Рывок",
  flags: { [NS]: { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: PSYCHIC_SPRINT_KEY }] }] } }
});

function warlock({ wp = 50, rating = 3 } = {}) {
  const flags = {};
  const a = {
    id: "a", uuid: "Actor.a", name: "Варлок", type: "character", items: [], effects: [],
    system: {
      characteristics: { wp: { total: wp, bonus: Math.floor(wp / 10) } }, psyker: { rating, currentRating: rating }, conditions: {},
      actionPoints: { value: 2, max: 2 }, movement: { move: 12, halfMove: 6, run: 24, charge: 12 }
    },
    getFlag: (ns, k) => flags[`${ns}.${k}`],
    setFlag: async (ns, k, v) => { flags[`${ns}.${k}`] = v; },
    unsetFlag: async (ns, k) => { delete flags[`${ns}.${k}`]; },
    update: async (changes = {}) => {
      for (const [path, value] of Object.entries(changes)) {
        const keys = path.split(".");
        let node = a;
        for (const key of keys.slice(0, -1)) node = (node[key] ??= {});
        node[keys.at(-1)] = value;
      }
      return a;
    },
    createEmbeddedDocuments: async (type, docs) => {
      const made = docs.map((d, i) => ({ ...d, id: `fx${a.effects.length + i}`, getFlag: (ns, k) => d.flags?.[ns]?.[k] }));
      a.effects.push(...made);
      return made;
    },
    deleteEmbeddedDocuments: async (type, ids) => { a.effects = a.effects.filter(e => !ids.includes(e.id)); }
  };
  return a;
}

const lastCard = () => String(captured.chat.at(-1)?.content ?? "");

beforeEach(() => { resetCaptured(); globalThis.game.combat = undefined; });
afterEach(() => { globalThis.game.combat = undefined; globalThis.game.combats = undefined; });

describe("Психический Рывок: чистые правила", () => {
  it("модификатор теста W — минус 30 плюс 3 за каждый эPR", () => {
    expect(psychicSprintTestMod(1)).toBe(-27);
    expect(psychicSprintTestMod(3)).toBe(-21);
    expect(psychicSprintTestMod(10)).toBe(0);
    expect(psychicSprintTestMod(0)).toBe(-30);
  });

  it("порог — W плюс модификатор и автоматические поправки листа", () => {
    expect(psychicSprintThreshold(50, 3)).toBe(29);
    expect(psychicSprintThreshold(50, 3, 5)).toBe(34);
    expect(psychicSprintThreshold(40, 1, -10)).toBe(3);
  });

  it("прибавка к SPD равна эPR, а эPR — текущий Пси-Рейтинг без дробей и минусов", () => {
    expect(psychicSprintSpeedBonus(4)).toBe(4);
    expect(psychicSprintSpeedBonus(-2)).toBe(0);
    expect(psychicSprintEpr({ system: { psyker: { currentRating: 3.9 } } })).toBe(3);
    expect(psychicSprintEpr({ system: { psyker: { currentRating: -1 } } })).toBe(0);
    expect(psychicSprintEpr({ system: {} })).toBe(0);
  });

  it("скидка в 1 ОД только при действующем Рывке и не ниже нуля", () => {
    expect(discountedMovementAp(2, true)).toBe(1);
    expect(discountedMovementAp(2, false)).toBe(2);
    expect(discountedMovementAp(0, true)).toBe(0);
  });

  it("SPD вешается на входное поле расчёта Движения (фаза initial)", () => {
    expect(expectedPhase("system.movement.spdBonus")).toBe("initial");
  });
});

describe("Психический Рывок: срок эффекта", () => {
  const data = () => timedEffectData({
    key: PSYCHIC_SPRINT_EFFECT_KEY, name: "Рывок", changes: [{ key: "system.movement.spdBonus", value: 3 }],
    combat: { id: "c1", round: 2 }, duration: { value: 1, units: "rounds", expiry: "turnEnd" }, span: 1
  });

  it("эффект кончается в конце Хода носителя в следующем Раунде", () => {
    expect(data().duration).toEqual({ value: 1, units: "rounds", expiry: "turnEnd" });
    expect(data().flags[NS][TIMED_EFFECT_FLAG]).toEqual({ key: PSYCHIC_SPRINT_EFFECT_KEY, combatId: "c1", round: 2, lastRound: 3 });
  });

  it("подметание в начале Хода не трогает эффект в Раунде выдачи и в следующем, снимает через один", () => {
    const flag = data().flags[NS][TIMED_EFFECT_FLAG];
    expect(timedEffectStale(flag, { id: "c1", round: 2 })).toBe(false);
    expect(timedEffectStale(flag, { id: "c1", round: 3 })).toBe(false);
    expect(timedEffectStale(flag, { id: "c1", round: 4 })).toBe(true);
    expect(timedEffectStale(flag, { id: "c2", round: 1 })).toBe(true);
  });

  it("эффект без span и duration — прежний срок «до начала следующего Хода»", () => {
    const d = timedEffectData({ key: "k", name: "x", changes: [{ key: "system.fearRating", value: 1 }], combat: { id: "c1", round: 3 } });
    expect(d.duration).toEqual({ value: 1, units: "rounds", expiry: "turnStart" });
    expect(d.flags[NS][TIMED_EFFECT_FLAG]).toEqual({ key: "k", combatId: "c1", round: 3 });
  });
});

describe("Психический Рывок: кнопка и бросок", () => {
  it("кнопка есть только на листе этого Таланта у актора", () => {
    expect(isPsychicSprintItem(talent())).toBe(true);
    expect(isPsychicSprintItem({ type: "talent", name: "A Psychic Sprint / Психический Рывок", flags: {} })).toBe(true);
    expect(isPsychicSprintItem({ type: "talent", name: "Другой", flags: {} })).toBe(false);
    expect(talentActionsHtml(talent(), warlock())).toContain('data-talent-action="psychicSprint"');
    expect(talentActionsHtml(talent(), null)).toBe("");
  });

  it("предмет из пака несёт запись Конструктора с ключом Таланта", () => {
    expect(PACK_ITEM).toBeTruthy();
    expect(isPsychicSprintItem(PACK_ITEM)).toBe(true);
    const entries = PACK_ITEM.flags[NS].mechanics.flatMap(g => g.entries);
    expect(entries.some(e => e.kind === "capability" && e.capabilityKey === PSYCHIC_SPRINT_KEY)).toBe(true);
  });

  it("успех: +эPR к SPD на этот и следующий Раунд, Талант отмечен на бой", async () => {
    const a = warlock({ wp: 50, rating: 3 });
    globalThis.game.combat = { id: "c1", round: 2, started: true, combatants: [{ actor: a }] };
    globalThis.game.combats = [globalThis.game.combat];
    captured.nextRoll = 29;
    expect(await runTalentAction("psychicSprint", talent(), a)).toBe(true);
    expect(a.effects).toHaveLength(1);
    const fx = a.effects[0];
    expect(fx.system.changes).toEqual([{ key: "system.movement.spdBonus", type: "add", value: 3, phase: "initial", priority: 0 }]);
    expect(fx.duration).toEqual({ value: 1, units: "rounds", expiry: "turnEnd" });
    expect(fx.flags[NS][TIMED_EFFECT_FLAG]).toMatchObject({ combatId: "c1", round: 2, lastRound: 3 });
    expect(isCapabilityAvailable(a, PSYCHIC_SPRINT_KEY, "battle")).toBe(false);
    expect(lastCard()).toContain("<b>29</b>");
    expect(lastCard()).toContain("+3");
    expect(lastCard()).toContain("1 ОД меньше");
    expect(psychicSprintActive(a)).toBe(true);
  });

  it("провал: эффекта нет, но попытка засчитана — второй раз в бою нельзя", async () => {
    globalThis.game.combat = { id: "c1", round: 1, started: true };
    const a = warlock({ wp: 50, rating: 3 });
    captured.nextRoll = 30;
    expect(await startPsychicSprint(a)).toBe(true);
    expect(a.effects).toEqual([]);
    expect(isCapabilityAvailable(a, PSYCHIC_SPRINT_KEY, "battle")).toBe(false);
    expect(psychicSprintActive(a)).toBe(false);
    const cards = captured.chat.length;
    expect(await startPsychicSprint(a)).toBe(false);
    expect(captured.chat.length).toBe(cards);
    expect(captured.warnings.some(w => w.includes("уже"))).toBe(true);
  });

  it("в другом бою Талант снова доступен", async () => {
    globalThis.game.combat = { id: "c1", round: 1, started: true };
    const a = warlock();
    captured.nextRoll = 99;
    await startPsychicSprint(a);
    globalThis.game.combat = { id: "c2", round: 1, started: true };
    expect(isCapabilityAvailable(a, PSYCHIC_SPRINT_KEY, "battle")).toBe(true);
  });

  it("без Пси-Рейтинга бросок не делается и Талант не тратится", async () => {
    globalThis.game.combat = { id: "c1", round: 1, started: true };
    const a = warlock({ rating: 0 });
    const rolls = captured.rolls.length;
    expect(await startPsychicSprint(a)).toBe(false);
    expect(captured.rolls.length).toBe(rolls);
    expect(isCapabilityAvailable(a, PSYCHIC_SPRINT_KEY, "battle")).toBe(true);
  });

  it("вне боя успех создаёт ожидание, а не эффект, и ячейку боя не тратит", async () => {
    const a = warlock({ wp: 50, rating: 3 });
    captured.nextRoll = 29;
    expect(await runTalentAction("psychicSprint", talent(), a)).toBe(true);
    expect(a.effects).toEqual([]);
    expect(a.getFlag(NS, PSYCHIC_SPRINT_PENDING_FLAG)).toEqual({ success: true, bonus: 3 });
    expect(psychicSprintActive(a)).toBe(false);
    expect(lastCard()).toContain("<b>29</b>");
    expect(lastCard()).toContain("начнётся с началом боя");
    expect(a.getFlag(NS, "usageLimits.talent-psychicSprint")).toBeUndefined();
    globalThis.game.combat = { id: "c1", round: 0, started: false };
    expect(isCapabilityAvailable(a, PSYCHIC_SPRINT_KEY, "battle")).toBe(true);
  });

  it("вне боя провал тоже занимает ожидание: эффекта нет, повторять до боя нельзя", async () => {
    const a = warlock({ wp: 50, rating: 3 });
    captured.nextRoll = 30;
    expect(await startPsychicSprint(a)).toBe(true);
    expect(a.effects).toEqual([]);
    expect(a.getFlag(NS, PSYCHIC_SPRINT_PENDING_FLAG)).toEqual({ success: false, bonus: 0 });
    expect(lastCard()).toContain("Провал");
    const rolls = captured.rolls.length;
    expect(await startPsychicSprint(a)).toBe(false);
    expect(captured.rolls.length).toBe(rolls);
  });

  it("повторный Рывок вне боя при висящем ожидании — отказ с причиной, ожидание не накапливается", async () => {
    const a = warlock({ wp: 50, rating: 3 });
    captured.nextRoll = 1;
    await startPsychicSprint(a);
    const rolls = captured.rolls.length;
    const cards = captured.chat.length;
    expect(await runTalentAction("psychicSprint", talent(), a)).toBe(false);
    expect(captured.rolls.length).toBe(rolls);
    expect(captured.chat.length).toBe(cards);
    expect(captured.warnings.some(w => w.includes("ждёт начала боя"))).toBe(true);
    expect(a.getFlag(NS, PSYCHIC_SPRINT_PENDING_FLAG)).toEqual({ success: true, bonus: 3 });
  });

  it("бой создан, но не начат — то же, что вне боя: ожидание, ячейка боя нетронута", async () => {
    globalThis.game.combat = { id: "c1", round: 0, started: false };
    const a = warlock();
    captured.nextRoll = 1;
    expect(await runTalentAction("psychicSprint", talent(), a)).toBe(true);
    expect(a.effects).toEqual([]);
    expect(a.getFlag(NS, PSYCHIC_SPRINT_PENDING_FLAG)).toEqual({ success: true, bonus: 3 });
    expect(a.getFlag(NS, "usageLimits.talent-psychicSprint")).toBeUndefined();
  });

  it("в начатом бою при висящем ожидании бросок не делается", async () => {
    const a = warlock();
    captured.nextRoll = 1;
    await startPsychicSprint(a);
    globalThis.game.combat = { id: "c1", round: 1, started: true };
    const rolls = captured.rolls.length;
    expect(await startPsychicSprint(a)).toBe(false);
    expect(captured.rolls.length).toBe(rolls);
    expect(a.effects).toEqual([]);
  });

  it("лист Таланта показывает, что эффект ждёт боя", async () => {
    const a = warlock();
    expect(talentActionsHtml(talent(), a)).not.toContain("ждёт боя");
    await a.setFlag(NS, PSYCHIC_SPRINT_PENDING_FLAG, { success: true, bonus: 3 });
    expect(talentActionsHtml(talent(), a)).toContain("SPD +3 ждёт боя");
    await a.setFlag(NS, PSYCHIC_SPRINT_PENDING_FLAG, { success: false, bonus: 0 });
    expect(talentActionsHtml(talent(), a)).toContain("провален: Талант на ближайший бой потрачен");
  });

  it("чужой предмет кнопкой не запускается", async () => {
    const a = warlock();
    expect(await runTalentAction("psychicSprint", { type: "talent", name: "Прочее", flags: {} }, a)).toBe(false);
    expect(a.effects).toEqual([]);
  });
});

describe("Психический Рывок: скидка ОД на Движение", () => {
  it("пока Рывок действует — Полное Движение, Бег и Натиск стоят на 1 ОД меньше", async () => {
    globalThis.game.combat = { id: "c1", round: 1, started: true };
    const a = warlock();
    expect(movementApCost(a, 2)).toBe(2);
    captured.nextRoll = 1;
    await startPsychicSprint(a);
    expect(movementApCost(a, 2)).toBe(1);
  });

  it("истёкший эффект скидки не даёт", async () => {
    globalThis.game.combat = { id: "c1", round: 1, started: true };
    const a = warlock();
    captured.nextRoll = 1;
    await startPsychicSprint(a);
    a.effects[0].duration = { expired: true };
    expect(movementApCost(a, 2)).toBe(2);
  });

  it("Полное Движение: со скидкой списывает 1 ОД, без Рывка — 2", async () => {
    globalThis.game.combat = { id: "c1", round: 1, started: true };
    const plain = warlock();
    await declareFullMove(plain);
    expect(plain.system.actionPoints.value).toBe(0);

    const rushed = warlock();
    captured.nextRoll = 1;
    await startPsychicSprint(rushed);
    await declareFullMove(rushed);
    expect(rushed.system.actionPoints.value).toBe(1);
    expect(lastCard()).toContain("Полное действие (1 ОД)");
    expect(lastCard()).toContain("на 1 ОД меньше");
  });

  it("Бег: со скидкой списывает 1 ОД", async () => {
    globalThis.game.combat = { id: "c1", round: 1, started: true };
    const rushed = warlock();
    captured.nextRoll = 1;
    await startPsychicSprint(rushed);
    await declareRun(rushed);
    expect(rushed.system.actionPoints.value).toBe(1);
    expect(lastCard()).toContain("Полное действие (1 ОД)");
  });
});

describe("Психический Рывок: ожидание превращается в эффект со стартом боя", () => {
  const started = (actors, id = "c9") => ({ id, round: 1, started: true, combatants: actors.map(actor => ({ actor })) });

  async function pendingWarlock({ roll = 1, rating = 3 } = {}) {
    const a = warlock({ rating });
    captured.nextRoll = roll;
    await startPsychicSprint(a);
    return a;
  }

  it("успешное ожидание даёт обычный эффект Рывка этого боя с Раундом 1 и очищается", async () => {
    const a = await pendingWarlock();
    const combat = started([a]);
    globalThis.game.combat = combat;
    await processPsychicSprintCombatStart(combat);
    expect(a.effects).toHaveLength(1);
    const fx = a.effects[0];
    expect(fx.system.changes).toEqual([{ key: "system.movement.spdBonus", type: "add", value: 3, phase: "initial", priority: 0 }]);
    expect(fx.duration).toEqual({ value: 1, units: "rounds", expiry: "turnEnd" });
    expect(fx.flags[NS][TIMED_EFFECT_FLAG]).toEqual({ key: PSYCHIC_SPRINT_EFFECT_KEY, combatId: "c9", round: 1, lastRound: 2 });
    expect(a.getFlag(NS, PSYCHIC_SPRINT_PENDING_FLAG)).toBeUndefined();
    expect(psychicSprintActive(a)).toBe(true);
    expect(movementApCost(a, 2)).toBe(1);
  });

  it("со стартом боя Талант в этом бою отмечен потраченным — второй раз в бою нельзя", async () => {
    const a = await pendingWarlock();
    const combat = started([a]);
    globalThis.game.combat = combat;
    await processPsychicSprintCombatStart(combat);
    expect(isCapabilityAvailable(a, PSYCHIC_SPRINT_KEY, "battle")).toBe(false);
    const rolls = captured.rolls.length;
    expect(await startPsychicSprint(a)).toBe(false);
    expect(captured.rolls.length).toBe(rolls);
  });

  it("проваленное ожидание эффекта не даёт, но очищается и Талант на бой потрачен", async () => {
    const a = await pendingWarlock({ roll: 99 });
    const combat = started([a]);
    globalThis.game.combat = combat;
    await processPsychicSprintCombatStart(combat);
    expect(a.effects).toEqual([]);
    expect(a.getFlag(NS, PSYCHIC_SPRINT_PENDING_FLAG)).toBeUndefined();
    expect(isCapabilityAvailable(a, PSYCHIC_SPRINT_KEY, "battle")).toBe(false);
  });

  it("боец не в бою — ожидание остаётся и ждёт своего боя", async () => {
    const a = await pendingWarlock();
    const other = warlock();
    const combat = started([other]);
    globalThis.game.combat = combat;
    await processPsychicSprintCombatStart(combat);
    expect(a.effects).toEqual([]);
    expect(a.getFlag(NS, PSYCHIC_SPRINT_PENDING_FLAG)).toEqual({ success: true, bonus: 3 });
    expect(other.effects).toEqual([]);
  });

  it("у участников без ожидания ничего не меняется", async () => {
    const a = warlock();
    const combat = started([a]);
    globalThis.game.combat = combat;
    await processPsychicSprintCombatStart(combat);
    expect(a.effects).toEqual([]);
    expect(isCapabilityAvailable(a, PSYCHIC_SPRINT_KEY, "battle")).toBe(true);
  });

  it("несвязанный токен: ожидание на мировом акторе, эффект ложится на актора токена, ожидание снимается с мирового", async () => {
    const world = await pendingWarlock();
    const token = warlock();
    token.isToken = true;
    token.token = { baseActor: world };
    const combat = started([token]);
    globalThis.game.combat = combat;
    await processPsychicSprintCombatStart(combat);
    expect(token.effects).toHaveLength(1);
    expect(world.effects).toEqual([]);
    expect(world.getFlag(NS, PSYCHIC_SPRINT_PENDING_FLAG)).toBeUndefined();
    expect(isCapabilityAvailable(token, PSYCHIC_SPRINT_KEY, "battle")).toBe(false);
  });

  it("повторный запуск на тот же бой эффект не удваивает", async () => {
    const a = await pendingWarlock();
    const combat = started([a]);
    globalThis.game.combat = combat;
    await processPsychicSprintCombatStart(combat);
    await processPsychicSprintCombatStart(combat);
    expect(a.effects).toHaveLength(1);
  });
});
