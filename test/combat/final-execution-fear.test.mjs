// test/combat/final-execution-fear.test.mjs
//
// Fear(2) за убийство Окончательной Казнью (Мастер Казней; Sahara fear-2, решение владельца 30.10.2026).
// Книга: «Если такая атака убивает добычу, Мастер Казни получает Трейт Fear (2) (сверхъестественный) на 1 Раунд.»
// «Убивает» = смерть цели констатирована (sheets/tabs/body.mjs::setDeceased — единственная точка, где система
// признаёт смерть; то же решение владельца, что у Жнеца и Трофея). Поток: атака с Окончательной Казнью метит
// карточку урона → урон метит жертву «последний удар — Окончательная Казнь» → констатация смерти выдаёт убийце
// Трейт «Страх (2)» на срок «1 Раунд» (rules/temp-grant.mjs: снимется сам на смене Раунда).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { applyDamageToActor } from "../../module/combat/damage.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { setDeceased } from "../../module/sheets/tabs/body.mjs";
import { LAST_DAMAGE_WEAPON_FLAG } from "../../module/combat/blood-flame.mjs";
import {
  FINAL_EXECUTION_HIT_FLAG, FINAL_EXECUTION_FEAR_FLAG, FEAR_TRAIT_PACK_ID, markLastFinalExecutionHit,
  finalExecutionFearItemData, grantFinalExecutionFear
} from "../../module/combat/final-execution.mjs";
import { isTempGrantExpired } from "../../module/rules/temp-grant.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
function packDoc(dir, idTail) {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(f => {
    const p = path.join(d, f.name);
    return f.isDirectory() ? walk(p) : (f.name.endsWith(`_${idTail}.json`) ? [p] : []);
  });
  const [file] = walk(path.join(ROOT, "packs-src", dir));
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
const FEAR = () => packDoc("traits", FEAR_TRAIT_PACK_ID);
const FINAL = () => packDoc("talents", "WVsAgRZSj7cPhzoM");
const card = () => captured.chat.at(-1)?.content ?? "";

let registry, prevFromUuid, prevCombat;
beforeEach(() => {
  resetCaptured(); setTargets([]);
  registry = {}; prevFromUuid = globalThis.fromUuid; globalThis.fromUuid = async u => registry[u] ?? null;
  prevCombat = game.combat; game.combat = { id: "cb", round: 2, started: true };
  globalThis.game.user = { id: "gm", isGM: true };
  registry[`Compendium.warhammer-dbc.traits.Item.${FEAR_TRAIT_PACK_ID}`] = { toObject: () => structuredClone(FEAR()) };
});
afterEach(() => { globalThis.fromUuid = prevFromUuid; game.combat = prevCombat; globalThis.game.user = {}; });

describe("данные: Трейт «Страх (2)» из пака на 1 Раунд", () => {
  it("копия настоящего Трейта Fear: рейтинг 2, эффект system.fearRating = 2, без _id, метка срока «раунд»", () => {
    const data = finalExecutionFearItemData(FEAR(), { id: "cb", round: 4 });
    expect(data._id).toBeUndefined();
    expect(data.type).toBe("trait");
    expect(data.system.rating).toBe(2);
    expect(data.name).toContain("2");
    expect(data.effects[0].system.changes[0]).toMatchObject({ key: "system.fearRating", value: 2 });
    const tg = data.flags["warhammer-dbc"].tempGrant;
    expect(tg).toMatchObject({ unit: "round", combatId: "cb", expiresAtRound: 5 });   // 1 Раунд: round + 1, как у прочих «N Раундов»
    expect(data.flags["warhammer-dbc"][FINAL_EXECUTION_FEAR_FLAG]).toBe(true);
    expect(tg.label).toContain("Окончательная Казнь");
  });
  it("метка срока работает с настоящим temp-grant: жива в Раунде 4–5, истекла в 6 и в другом бою", () => {
    const tg = finalExecutionFearItemData(FEAR(), { id: "cb", round: 4 }).flags["warhammer-dbc"].tempGrant;
    expect(isTempGrantExpired(tg, { combat: { id: "cb", round: 5 } })).toBe(false);
    expect(isTempGrantExpired(tg, { combat: { id: "cb", round: 6 } })).toBe(true);
    expect(isTempGrantExpired(tg, { combat: { id: "other", round: 4 } })).toBe(true);
  });
});

describe("карточка атаки несёт метку Окончательной Казни", () => {
  async function swing(finalExecution) {
    const w = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "2р", damage: "1d10" });
    const actor = actorFor({ items: [w], characteristics: { ws: char(45), bs: char(45), s: char(9), t: char(40), ag: char(35) } });
    captured.dice = [10, 5, 5, 5, 5, 5];
    await _executeAttackRoll(actor, w, "ws", 45, "melee", null, { baseKey: "standard", finalExecution });
  }
  it("атака с Окончательной Казнью — data-final-execution=1; без неё — 0", async () => {
    await swing(true);
    expect(card()).toContain('data-final-execution="1"');
    await swing(false);
    expect(card()).toContain('data-final-execution="0"');
  });
});

/** Жертва/убийца для конвейера урона и констатации смерти. */
function victimActor() {
  const ch = total => ({ total, bonus: Math.floor(total / 10) });
  const store = {};
  return {
    id: "v", name: "Жертва", type: "character", uuid: "Actor.v", isOwner: true, token: { uuid: "Scene.s.Token.victim" },
    system: {
      absorption: { head: 0, body: 0, rightArm: 0, leftArm: 0, leftLeg: 0, rightLeg: 0, toughnessBonus: 0, propFlags: {}, armorOnly: {} },
      characteristics: { s: ch(50), t: ch(40), wp: ch(40), ag: ch(40), int: ch(40) },
      wounds: { value: 5, critical: 0, max: 20 }, fate: { value: 2 }, cover: { ap: 0 },
      armorCorrosion: { head: 0, body: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 },
      actionPoints: { value: 2, max: 2 }, conditions: {}, fatigue: { value: 0, max: 10 }, patronGod: "", size: 4
    },
    items: Object.assign([], { contents: [], get: () => null }), effects: Object.assign([], { contents: [] }),
    getFlag: (s2, k) => store[k], setFlag: async (s2, k, v) => { store[k] = v; }, unsetFlag: async (s2, k) => { delete store[k]; },
    getActiveTokens: () => [], async update() {}, async updateEmbeddedDocuments() { return []; }, store
  };
}
function killerActor({ talent = true, owner = true } = {}) {
  const store = {};
  const created = [];
  const killer = {
    id: "f", name: "Мастер Казней", type: "character", uuid: "Actor.f", system: {}, isOwner: owner,
    items: Object.assign(talent ? [{ id: "t", type: "talent", name: FINAL().name, system: {} }] : [], { get: () => null }),
    getFlag: (s2, k) => store[k], setFlag: async (s2, k, v) => { store[k] = v; },
    createEmbeddedDocuments: async (type, docs) => { created.push(...docs); return docs; },
    deleteEmbeddedDocuments: async () => [], created
  };
  return killer;
}
const swordOf = f => ({ uuid: "Item.sword", name: "меч", system: { weaponClass: "melee" }, parent: f, actor: f });
const hit = (f, v, extra = {}) => {
  registry["Actor.f"] = f; registry["Item.sword"] = swordOf(f);
  return applyDamageToActor(v, { rawDamage: 20, penetration: 0, damageType: "rending", hitLocation: "Торс",
    melee: true, finalExecution: true, attackerName: "Мастер Казней", attackerUuid: "Actor.f", weaponUuid: "Item.sword", ...extra });
};

describe("запись последнего удара на жертве", () => {
  it("удар Окончательной Казнью метит жертву атакующим, боем и Раундом", async () => {
    const v = victimActor();
    await hit(killerActor(), v);
    expect(v.store[FINAL_EXECUTION_HIT_FLAG]).toEqual({ attackerUuid: "Actor.f", combatId: "cb", round: 2 });
  });
  it("следующий удар без Окончательной Казни стирает метку («последний» и есть тот, от которого умерли)", async () => {
    const v = victimActor();
    await hit(killerActor(), v);
    await hit(killerActor(), v, { finalExecution: false });
    expect(v.store[FINAL_EXECUTION_HIT_FLAG]).toBeUndefined();
  });
  it("стрелковый удар метку не ставит", async () => {
    const v = victimActor();
    await hit(killerActor(), v, { melee: false });
    expect(v.store[FINAL_EXECUTION_HIT_FLAG]).toBeUndefined();
  });
  it("markLastFinalExecutionHit напрямую: без атакующего метки нет", async () => {
    const v = victimActor();
    await markLastFinalExecutionHit(v, { melee: true, finalExecution: true, attackerUuid: "" });
    expect(v.store[FINAL_EXECUTION_HIT_FLAG]).toBeUndefined();
  });
});

describe("констатация смерти (setDeceased) → Страх (2) убийце", () => {
  function scene({ talent = true, owner = true, flag = true, round = 2 } = {}) {
    const killer = killerActor({ talent, owner });
    const victim = victimActor();
    registry["Actor.f"] = killer; registry["Item.sword"] = swordOf(killer);
    victim.store[LAST_DAMAGE_WEAPON_FLAG] = "Item.sword";
    if (flag) victim.store[FINAL_EXECUTION_HIT_FLAG] = { attackerUuid: "Actor.f", combatId: "cb", round };
    return { killer, victim };
  }

  it("убил Окончательной Казнью: убийца получает Трейт «Страх (2)» на 1 Раунд, в чате карточка", async () => {
    const { killer, victim } = scene();
    await setDeceased(victim, true);
    expect(killer.created).toHaveLength(1);
    expect(killer.created[0].name).toContain("Страх");
    expect(killer.created[0].flags["warhammer-dbc"].tempGrant).toMatchObject({ unit: "round", combatId: "cb", expiresAtRound: 3 });
    expect(captured.chat.some(m => /Страх \(2\)/.test(m.content) && /сверхъестественн/.test(m.content))).toBe(true);
    expect(victim.store[FINAL_EXECUTION_HIT_FLAG]).toBeUndefined();   // метка использована
  });

  it("повторная констатация (уже мёртв) — второго Трейта нет", async () => {
    const { killer, victim } = scene();
    await setDeceased(victim, true);
    await setDeceased(victim, true);
    expect(killer.created).toHaveLength(1);
  });

  it("умер позже — в другом Раунде, чем удар — Страха нет", async () => {
    const { killer, victim } = scene({ round: 1 });
    await setDeceased(victim, true);
    expect(killer.created).toHaveLength(0);
  });

  it("последний удар не был Окончательной Казнью — Страха нет", async () => {
    const { killer, victim } = scene({ flag: false });
    await setDeceased(victim, true);
    expect(killer.created).toHaveLength(0);
  });

  it("у убийцы нет Таланта (метка устарела / Талант сняли) — Страха нет", async () => {
    const { killer, victim } = scene({ talent: false });
    await setDeceased(victim, true);
    expect(killer.created).toHaveLength(0);
  });

  it("убийца не принадлежит нажавшему и тот не ГМ — Трейт не создаётся, в чат уходит карточка с кнопкой для владельца/ГМа", async () => {
    globalThis.game.user = { id: "p", isGM: false };
    const { killer, victim } = scene({ owner: false });
    await setDeceased(victim, true);
    expect(killer.created).toHaveLength(0);
    expect(captured.chat.some(m => (m.content ?? "").includes("wh-fe-fear-btn"))).toBe(true);
  });

  it("повторная выдача заменяет прежний Страх Окончательной Казни, а не складывает", async () => {
    const killer = killerActor();
    const old = { id: "old", flags: { "warhammer-dbc": { [FINAL_EXECUTION_FEAR_FLAG]: true } } };
    killer.items.push(old);
    const deleted = [];
    killer.deleteEmbeddedDocuments = async (t, ids) => { deleted.push(...ids); return []; };
    await grantFinalExecutionFear(killer);
    expect(deleted).toEqual(["old"]);
    expect(killer.created).toHaveLength(1);
  });
});
