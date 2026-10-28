// test/combat/full-attack-lock.test.mjs
//
// Запрет Физических Избеганий после Полной Атаки (Sahara riding-the-momentum,
// решение владельца 24.10.2026) и его смягчения: В Ногу с Моментом (Разбойник) и
// Реприз (Берсерк). Книга: «До начала своего следующего Хода он не может
// совершать Физические Избегания».

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";
import { _performDodge, _performParry } from "../../module/combat/defense.mjs";
import { markFullAttack, markFuriousChild, avoidanceVerdict } from "../../module/combat/full-attack-lock.mjs";
import {
  FULL_ATTACK_LOCK_FLAG, lockAfterFullAttack, physicalAvoidanceVerdict, RIDING_MOMENTUM_PENALTY, isLightFullAttackWeapon
} from "../../module/rules/full-attack-lock.mjs";
import { TURN_SCOPED_FLAGS, turnStartFlagClears } from "../../module/rules/turn-flags.mjs";

const NS = "warhammer-dbc";
const DEFAULT_SOURCES = getRuleSources();
const talent = name => ({ id: `t-${name}`, type: "talent", name, system: {}, getFlag: () => undefined });
const RIDING = "Riding the Momentum / В Ногу с Моментом";
const REPRISE = "Reprise / Реприз";

const knife = () => weaponFor({ weaponClass: "melee", meleeCategory: "Нож", equipped: true }, { id: "kn", name: "Нож" });
const fists = () => weaponFor({ weaponClass: "melee", meleeCategory: "Кулаки", equipped: true }, { id: "fi", name: "Кулак" });
const sword = () => { const w = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", balance: 0, equipped: true }, { id: "sw", name: "Меч" }); w.type = "weapon"; return w; };

function fighter({ items = [], flagsInit = {}, type = "character" } = {}) {
  const a = actorFor({ items, characteristics: { ag: { total: 40, bonus: 4 }, ws: { total: 45, bonus: 4 } },
    reactions: { value: 2, defenseValue: 0 }, skills: { dodge: { rank: "trained", total: 60 }, parry: { rank: "trained", total: 60 } } });
  const store = { ...flagsInit };
  a.type = type;
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
const locked = (extra = {}) => ({ [`${NS}.${FULL_ATTACK_LOCK_FLAG}`]: { light: true, repriseOpen: false, ...extra } });

beforeEach(() => {
  resetCaptured();
  captured.dice = [10];
  globalThis.game.combat = { started: true, id: "c1" };
});
afterEach(() => {
  globalThis.game.combat = undefined;
  clearRuleSources();
  for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
});

describe("rules: кулаки/ножи и накопление метки", () => {
  it("кулаки и нож — «лёгкие», меч — нет", () => {
    expect(isLightFullAttackWeapon(knife())).toBe(true);
    expect(isLightFullAttackWeapon(fists())).toBe(true);
    expect(isLightFullAttackWeapon(sword())).toBe(false);
  });

  it("«в любой комбинации»: кулак+нож остаётся лёгким, одна Полная Атака мечом снимает «лёгкость» насовсем", () => {
    let lock = lockAfterFullAttack(null, fists());
    lock = lockAfterFullAttack(lock, knife());
    expect(lock.light).toBe(true);
    lock = lockAfterFullAttack(lock, sword());
    expect(lock.light).toBe(false);
    expect(lockAfterFullAttack(lock, knife()).light).toBe(false);
  });
});

describe("rules: вердикт", () => {
  const actorWith = (items, lock) => ({ items, flags: { [NS]: { [FULL_ATTACK_LOCK_FLAG]: lock } } });

  it("метки нет — всё можно", () => {
    expect(physicalAvoidanceVerdict({ items: [] }, "dodge").blocked).toBe(false);
    expect(physicalAvoidanceVerdict({ items: [] }, "parry").blocked).toBe(false);
  });

  it("метка есть, Талантов нет — запрещены оба", () => {
    const a = actorWith([], { light: true });
    expect(physicalAvoidanceVerdict(a, "dodge").blocked).toBe(true);
    expect(physicalAvoidanceVerdict(a, "parry").blocked).toBe(true);
    expect(physicalAvoidanceVerdict(a, "dodge").reason).toContain("Физические Избегания");
  });

  it("В Ногу с Моментом: Уклонение со штрафом −10 после кулаков/ножей, Парирование — нет", () => {
    const a = actorWith([talent(RIDING)], { light: true });
    const d = physicalAvoidanceVerdict(a, "dodge");
    expect(d).toMatchObject({ blocked: false, penalty: RIDING_MOMENTUM_PENALTY });
    expect(RIDING_MOMENTUM_PENALTY).toBe(-10);
    const p = physicalAvoidanceVerdict(a, "parry");
    expect(p.blocked).toBe(true);
    expect(p.reason).toContain("но не Парирование");
  });

  it("В Ногу с Моментом не помогает после Полной Атаки мечом", () => {
    const a = actorWith([talent(RIDING)], { light: false });
    const d = physicalAvoidanceVerdict(a, "dodge");
    expect(d.blocked).toBe(true);
    expect(d.reason).toContain("не только кулаками и ножами");
  });

  it("Реприз: Парирование открыто только после успешной дополнительной атаки Яростного Штурма; Уклонение — нет", () => {
    const before = actorWith([talent(REPRISE)], { light: false, repriseOpen: false });
    expect(physicalAvoidanceVerdict(before, "parry").blocked).toBe(true);
    const after = actorWith([talent(REPRISE)], { light: false, repriseOpen: true });
    expect(physicalAvoidanceVerdict(after, "parry")).toMatchObject({ blocked: false, penalty: 0 });
    expect(physicalAvoidanceVerdict(after, "dodge").blocked).toBe(true);
  });

  it("repriseOpen без самого Таланта ничего не открывает", () => {
    const a = actorWith([], { light: false, repriseOpen: true });
    expect(physicalAvoidanceVerdict(a, "parry").blocked).toBe(true);
  });
});

describe("метка на Ход", () => {
  it("гасится в начале следующего Хода как все метки этого срока", () => {
    expect(TURN_SCOPED_FLAGS).toHaveProperty(FULL_ATTACK_LOCK_FLAG);
    const a = fighter({ flagsInit: locked() });
    expect(turnStartFlagClears(a)).toEqual({ [`flags.${NS}.-=${FULL_ATTACK_LOCK_FLAG}`]: null });
  });

  it("markFullAttack ставит метку только в бою", async () => {
    const a = fighter();
    globalThis.game.combat = undefined;
    expect(await markFullAttack(a, knife())).toBe(false);
    expect(a._store[`${NS}.${FULL_ATTACK_LOCK_FLAG}`]).toBeUndefined();
    globalThis.game.combat = { started: true, id: "c1" };
    expect(await markFullAttack(a, knife())).toBe(true);
    expect(a._store[`${NS}.${FULL_ATTACK_LOCK_FLAG}`]).toEqual({ light: true, repriseOpen: false, combatId: "c1" });
  });

  it("существо без экономики действий метки не получает (её некому погасить)", async () => {
    const a = fighter({ type: "npc" });
    expect(await markFullAttack(a, sword())).toBe(false);
  });

  it("markFuriousChild открывает Реприз только носителю Таланта и только при уже стоящей метке", async () => {
    const a = fighter({ items: [talent(REPRISE)] });
    expect(await markFuriousChild(a)).toBe(false);
    await markFullAttack(a, sword());
    expect(await markFuriousChild(a)).toBe(true);
    expect(a._store[`${NS}.${FULL_ATTACK_LOCK_FLAG}`].repriseOpen).toBe(true);
    const plain = fighter();
    await markFullAttack(plain, sword());
    expect(await markFuriousChild(plain)).toBe(false);
  });

  it("метка из ПРОШЛОГО боя в следующем бою не блокирует, пока у персонажа не было Хода (ревью, Б1)", async () => {
    const a = fighter({ flagsInit: locked({ combatId: "c1" }) });
    globalThis.game.combat = { started: true, id: "c2" };
    expect(avoidanceVerdict(a, "dodge").blocked).toBe(false);
    expect(avoidanceVerdict(a, "parry").blocked).toBe(false);
    await _performDodge(a, { extraMod: 0 });
    expect(captured.chat.at(-1).content).not.toContain("Физические Избегания");
    // тот же бой — блокирует
    globalThis.game.combat = { started: true, id: "c1" };
    expect(avoidanceVerdict(a, "dodge").blocked).toBe(true);
  });

  it("новая Полная Атака в новом бою начинает метку заново, а не наследует «лёгкость»/Реприз старого", async () => {
    const a = fighter({ flagsInit: locked({ combatId: "c0", light: false, repriseOpen: true }) });
    globalThis.game.combat = { started: true, id: "c1" };
    await markFullAttack(a, knife());
    expect(a._store[`${NS}.${FULL_ATTACK_LOCK_FLAG}`]).toEqual({ light: true, repriseOpen: false, combatId: "c1" });
  });

  it("метка оставшаяся от закончившегося боя вердикта не даёт", () => {
    const a = fighter({ flagsInit: locked() });
    expect(avoidanceVerdict(a, "dodge").blocked).toBe(true);
    globalThis.game.combat = undefined;
    expect(avoidanceVerdict(a, "dodge").blocked).toBe(false);
  });
});

describe("метку ставит сама атака (combat/attack.mjs)", () => {
  async function swing({ baseKey = "fullatk", roll = 20, items = [], weapon = {}, techniqueOpts } = {}) {
    const w = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "П", damage: "1d10", ...weapon });
    w.uuid = "Item.w";
    const actor = fighter({ items: [w, ...items] });
    actor.uuid = "Actor.bk";
    setTargets([]);
    captured.dice = [roll, 5];
    await _executeAttackRoll(actor, w, "ws", 45, "melee", null, { baseKey, techniqueOpts });
    return actor;
  }
  const lockOf = a => a._store[`${NS}.${FULL_ATTACK_LOCK_FLAG}`];

  it("Полная Атака — метка стоит и при ПРОМАХЕ (запрет не зависит от попадания)", async () => {
    expect(lockOf(await swing({ roll: 20 }))).toMatchObject({ light: false });
    expect(lockOf(await swing({ roll: 95 }))).toMatchObject({ light: false });
  });

  it("атака ножом — «лёгкая» Полная Атака", async () => {
    const a = await swing({ weapon: { meleeCategory: "Нож" } });
    expect(lockOf(a)).toMatchObject({ light: true });
  });

  it("другая База — метки нет", async () => {
    expect(lockOf(await swing({ baseKey: "standard" }))).toBeUndefined();
    expect(lockOf(await swing({ baseKey: "charge" }))).toBeUndefined();
  });

  it("дополнительная атака Яростного Штурма с Репризом открывает Парирование (даже если был промах по защите — важен бросок атаки)", async () => {
    const a = await swing({ items: [talent(REPRISE)], techniqueOpts: { furiousAssault: true } });
    expect(lockOf(a)).toMatchObject({ repriseOpen: true });
    const miss = await swing({ items: [talent(REPRISE)], roll: 95, techniqueOpts: { furiousAssault: true } });
    expect(lockOf(miss)).toMatchObject({ repriseOpen: false });
    const noTalent = await swing({ techniqueOpts: { furiousAssault: true } });
    expect(lockOf(noTalent)).toMatchObject({ repriseOpen: false });
  });
});

describe("Уклонение и Парирование в бою", () => {
  it("Уклонение после Полной Атаки: отказ, Реакция НЕ потрачена", async () => {
    const a = fighter({ flagsInit: locked() });
    await _performDodge(a, { extraMod: 0 });
    expect(captured.chat.at(-1).content).toContain("Физические Избегания");
    expect(a.system.reactions.defenseValue).toBe(0);
    expect(a.system.reactions.value).toBe(2);
  });

  it("Парирование после Полной Атаки: отказ, Реакция НЕ потрачена", async () => {
    const a = fighter({ items: [sword()], flagsInit: locked() });
    await _performParry(a, { extraMod: 0 });
    expect(captured.chat.at(-1).content).toContain("Физические Избегания");
    expect(a.system.reactions.value).toBe(2);
  });

  it("без метки Уклонение и Парирование работают как прежде (регрессия)", async () => {
    const a = fighter({ items: [sword()] });
    await _performDodge(a, { extraMod: 0 });
    expect(captured.chat.at(-1).content).not.toContain("Физические Избегания");
    captured.dice = [10];
    await _performParry(a, { extraMod: 0 });
    expect(captured.chat.at(-1).content).not.toContain("Физические Избегания");
  });

  it("В Ногу с Моментом: Уклонение проходит, штраф −10 виден в карточке и снижает порог", async () => {
    const plain = fighter();
    await _performDodge(plain, { extraMod: 0 });
    const base = captured.chat.at(-1).content;
    resetCaptured(); captured.dice = [10];
    const a = fighter({ items: [talent(RIDING)], flagsInit: locked() });
    await _performDodge(a, { extraMod: 0 });
    const card = captured.chat.at(-1).content;
    expect(card).toContain("В Ногу с Моментом -10");
    // Ячейка «Порог»: <label>Порог</label><b>N</b>
    const thr = html => Number(html.match(/<label>Порог<\/label><b>(-?\d+)<\/b>/)?.[1]);
    expect(card).not.toContain("Физические Избегания");
    expect(base).not.toContain("В Ногу с Моментом");
    expect(thr(base)).toBeGreaterThan(0);
    expect(thr(card)).toBe(thr(base) - 10);
  });

  it("Реприз: Парирование после Яростного Штурма проходит, Уклонение — нет", async () => {
    const a = fighter({ items: [talent(REPRISE), sword()], flagsInit: locked({ light: false, repriseOpen: true }) });
    await _performParry(a, { extraMod: 0 });
    expect(captured.chat.at(-1).content).not.toContain("Физические Избегания");
    resetCaptured(); captured.dice = [10];
    await _performDodge(a, { extraMod: 0 });
    expect(captured.chat.at(-1).content).toContain("Физические Избегания");
  });
});
