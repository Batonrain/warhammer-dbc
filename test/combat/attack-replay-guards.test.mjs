// test/combat/attack-replay-guards.test.mjs
//
// Переигровка той же атаки (сдвиг места, Горжет, Скрытые Сочленения, +10 за Очко, Успех за Бесчестие —
// opts.forcedRoll + skipAmmo; переброс за Судьбу — skipAmmo) повторяет карточку из storedOpts и не должна
// заново запускать разовые правила: Когнис, Квад, Момент Гладиатора, Кровавое Подношение, Резонанс
// (приёмка PR #568). Образец — talentPaid у Тяжёлого Хука / Одного Из Нас Падёт.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const NS = "warhammer-dbc";
const card = () => captured.chat.at(-1)?.content ?? "";
const stored = () => captured.chat.at(-1)?.flags?.[NS]?.attack;
const hitLines = () => (card().match(/roll-hit-dmg"/g) ?? []).length;
const damageOf = () => Number(card().match(/data-damage="(\d+)"/)?.[1]);
const setPath = (obj, path, value) => {
  const keys = path.split(".");
  let cur = obj;
  for (const k of keys.slice(0, -1)) cur = (cur[k] ??= {});
  cur[keys.at(-1)] = value;
};
const byKey = key => ({
  id: "k-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { [NS]: { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});

/** Актор, у которого update/setFlag действительно пишут в объект (чтобы повторный вызов видел итог первого). */
function liveActor(items, system = {}) {
  const a = actorFor({ items, ...system });
  a.uuid = "Actor.me";
  a.isOwner = true;
  a.flags = { [NS]: {} };
  a.updates = [];
  a.update = async data => { a.updates.push(data); for (const [p, v] of Object.entries(data)) setPath(a, p, v); };
  a.getFlag = (s, k) => a.flags[s]?.[k];
  a.setFlag = async (s, k, v) => { (a.flags[s] ??= {})[k] = v; };
  a.unsetFlag = async (s, k) => { delete a.flags[s]?.[k]; };
  return a;
}

/** Повтор той же атаки: storedOpts прошлой карточки + её rv (как кнопки сдвига места / +10 за Очко). */
async function replay(actor, weapon, charKey, threshold, rofMode, rv, extra = {}) {
  const atk = stored();
  await _executeAttackRoll(actor, weapon, charKey, threshold, rofMode, null,
    { ...(atk.opts || {}), forcedRoll: rv ?? atk.rv, skipAmmo: true, ...extra });
}

let prevUser, prevUsers, prevSocket, prevGetProperty;
beforeEach(() => {
  resetCaptured();
  prevUser = globalThis.game.user; prevUsers = globalThis.game.users; prevSocket = globalThis.game.socket;
  prevGetProperty = globalThis.foundry.utils.getProperty;
  globalThis.foundry.utils.getProperty = (o, p) => String(p).split(".").reduce((c, k) => c?.[k], o);
  globalThis.game.user = { id: "u1", isGM: false };
  setTargets([]);
});
afterEach(() => {
  globalThis.game.user = prevUser; globalThis.game.users = prevUsers; globalThis.game.socket = prevSocket;
  globalThis.foundry.utils.getProperty = prevGetProperty;
  globalThis.game.combat = undefined;
});

describe("Когнис: переигровка не списывает Когницию повторно", () => {
  const cognisGun = () => {
    const w = weaponFor({ weaponClass: "basic", damage: "1d10", damageType: "I", penetration: 0, rof_single: true,
      weaponProps: [{ key: "cognis" }] });
    w.type = "weapon";
    return w;
  };
  const implants = { id: "imp", name: "Mechanicum Implants / Импланты Механикум", type: "trait", system: {} };

  it("атака через Интеллект тратит 1 ⚙ один раз; переигровка при нуле не пропадает и не тратит", async () => {
    const w = cognisGun();
    const a = liveActor([w, implants], { cognition: { value: 1, max: 3 } });
    captured.dice = [10, 5];
    await _executeAttackRoll(a, w, "int", 45, "single", null, {});
    expect(a.system.cognition.value).toBe(0);
    const cards = captured.chat.length;
    captured.dice = [5];
    await replay(a, w, "int", 55, "single");
    expect(captured.chat.length).toBe(cards + 1);
    expect(a.system.cognition.value).toBe(0);
    expect(a.updates.filter(u => "system.cognition.value" in u)).toHaveLength(1);
  });
});

describe("Квад: переигровка сохраняет вторую атаку", () => {
  it("rv второй атаки хранится в storedOpts и снова даёт её попадания", async () => {
    const w = weaponFor({ weaponClass: "basic", damage: "1d10+5", damageType: "I", penetration: 0, rof_single: true,
      weaponProps: [{ key: "quad" }] });
    w.type = "weapon";
    const a = actorFor({ items: [w] });
    captured.dice = [10, 20, 4, 6];
    await _executeAttackRoll(a, w, "bs", 45, "single", null, {});
    expect(hitLines()).toBe(2);
    captured.dice = [4, 6];
    await replay(a, w, "bs", 45, "single");
    expect(hitLines()).toBe(2);
    expect(card()).toContain("Квад: вторая атака — бросок 20");
  });
});

describe("Момент Гладиатора: −1 за промах — один раз на атаку", () => {
  const sword = () => weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "П", damage: "1d10", damageType: "rending" });
  const gladiator = w => {
    const a = liveActor([w, byKey("pool.momentum")], { characteristics: { ws: char(45), bs: char(45), s: char(40), t: char(40), ag: char(50) } });
    a.flags[NS].momentum = 3;
    return a;
  };

  it("переигровка промаха второй раз не снимает", async () => {
    const w = sword(); const a = gladiator(w);
    captured.dice = [99];
    await _executeAttackRoll(a, w, "ws", 45, "melee", null, { baseKey: "standard" });
    expect(a.flags[NS].momentum).toBe(2);
    captured.dice = [];
    await replay(a, w, "ws", 45, "melee");
    expect(a.flags[NS].momentum).toBe(2);
  });

  it("переигровка, превратившая промах в попадание, очко возвращает", async () => {
    const w = sword(); const a = gladiator(w);
    captured.dice = [50];
    await _executeAttackRoll(a, w, "ws", 45, "melee", null, { baseKey: "standard" });
    expect(a.flags[NS].momentum).toBe(2);
    captured.dice = [5, 5, 5];
    await replay(a, w, "ws", 55, "melee");
    expect(a.flags[NS].momentum).toBe(3);
    // и ещё одна переигровка того же попадания ничего не меняет
    captured.dice = [5, 5, 5];
    await replay(a, w, "ws", 55, "melee");
    expect(a.flags[NS].momentum).toBe(3);
  });
});

describe("Кровавое Подношение: переигровка сохраняет +½Cor.b и Освящённое", () => {
  it("метка снята первым попаданием, но переброс получает тот же бонус", async () => {
    globalThis.game.combat = { id: "c1", started: true, round: 1 };
    globalThis.game.combats = [globalThis.game.combat];
    const w = weaponFor({ weaponClass: "melee", meleeCategory: "Топор", grips: "П", damage: "1d10", damageType: "rending", penetration: 1 });
    w.uuid = "Actor.me.Item.weapon-1";
    const blood = { id: "t-blood", name: "Blood Offering / Кровавое Подношение", type: "talent", system: {} };
    const a = liveActor([w, blood], { corruptionBonus: 4, characteristics: { ws: char(45), bs: char(45), s: char(9), t: char(40), ag: char(35) } });
    a.flags[NS].bloodOffering = { weaponUuid: w.uuid, turnsLeft: 3, combatId: "c1" };
    captured.dice = [20, 5, 5, 5];
    await _executeAttackRoll(a, w, "ws", 45, "melee", null, { baseKey: "standard" });
    const first = damageOf();
    expect(card()).toContain("Освящённое");
    expect(a.flags[NS].bloodOffering).toBeUndefined();
    captured.dice = [5, 5, 5];
    await replay(a, w, "ws", 45, "melee");
    expect(damageOf()).toBe(first);
    expect(card()).toContain("Освящённое");
  });
});

describe("Резонанс: чужой NPC через ГМа, переигровка не поднимает уровень", () => {
  it("игрок шлёт ГМу запись Резонанса; переигровка той же атаки уровень не повторяет", async () => {
    const emitted = [];
    globalThis.game.socket = { emit: (_c, p) => emitted.push(p) };
    globalThis.game.users = { activeGM: { id: "gm" } };
    const npc = { id: "npc", uuid: "Actor.npc", name: "Враг", type: "npc", isOwner: false, items: [],
      system: { size: 4, conditions: { resonance: false, resonanceLevel: 0 } }, getFlag: () => undefined,
      updates: [], async update(d) { this.updates.push(d); } };
    setTargets([npc]);
    const w = weaponFor({ weaponClass: "basic", damage: "1d10", damageType: "E", penetration: 0, rof_single: true,
      weaponProps: [{ key: "resonant" }] });
    w.type = "weapon";
    const a = liveActor([w]);
    captured.dice = [10, 5];
    await _executeAttackRoll(a, w, "bs", 45, "single", null, {});
    expect(npc.updates).toEqual([]);
    expect(emitted.map(e => e.op)).toEqual([{ kind: "resonance", level: 1 }]);
    // ГМ применил запрос — у цели уровень 1
    npc.system.conditions.resonance = true; npc.system.conditions.resonanceLevel = 1;
    captured.dice = [5];
    await replay(a, w, "bs", 45, "single");
    expect(emitted).toHaveLength(1);
    // кубы урона переигровки множатся от уровня ДО атаки (0), а не от накрученного ею же
    expect(stored().opts.talentPaid.resonanceStart).toBe(0);
  });
});
