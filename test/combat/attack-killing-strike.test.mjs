// test/combat/attack-killing-strike.test.mjs
//
// Смертельный Удар / Killing Strike (Берсерк, Sahara 3-861e): Полная Атака + Очко
// Бесчестия — Избегания цели от этой атаки невозможны (автопровал). Раз в Ход.
// Условие — rules/berserker-talents.mjs, плата и защита — combat/attack.mjs,
// галочка — sheets/attack/talent-toggles.mjs.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { killingStrikeApplies, killingStrikeOffered, KILLING_STRIKE_FLAG } from "../../module/rules/berserker-talents.mjs";
import { talentTogglesHtml } from "../../module/sheets/attack/talent-toggles.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
const byKey = key => ({
  id: "k-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});
const byName = name => ({ id: "t-" + name, name, type: "talent", system: {} });
const KS = { key: "berserker.core.killingStrike", name: "Killing Strike / Смертельный Удар" };

function who(items, { fate = 3 } = {}) {
  const a = actorFor({ items, fate: { value: fate, max: 5 },
    characteristics: { ws: char(45), bs: char(45), s: char(9), t: char(40), ag: char(35), inf: char(40) } });
  a.updates = [];
  a.update = async data => { a.updates.push(data); for (const [p, v] of Object.entries(data)) { const k = p.split("."); let c = a; for (const x of k.slice(0, -1)) c = c[x]; c[k.at(-1)] = v; } };
  const store = {};
  a.getFlag = (s, k) => store[`${s}.${k}`];
  a.setFlag = async (s, k, v) => { store[`${s}.${k}`] = v; };
  a.unsetFlag = async (s, k) => { delete store[`${s}.${k}`]; };
  return a;
}

const realGetProperty = (o, p) => String(p).split(".").reduce((c, k) => c?.[k], o);
let stubGetProperty;
beforeEach(() => {
  resetCaptured(); setTargets([]);
  stubGetProperty = globalThis.foundry.utils.getProperty;
  globalThis.foundry.utils.getProperty = realGetProperty;
});
afterEach(() => { globalThis.foundry.utils.getProperty = stubGetProperty; });

const blade = () => weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "П", damage: "1d10" });

async function swing(items, { toggles = { killingStrike: true }, baseKey = "fullatk", fate = 3, roll = 20, extra = {} } = {}) {
  const w = blade();
  const actor = who([w, ...items], { fate });
  captured.dice = [roll, 5];
  await _executeAttackRoll(actor, w, "ws", 45, "melee", null, { baseKey, talentToggles: toggles, ...extra });
  return actor;
}

describe("Смертельный Удар: Избегания цели невозможны", () => {
  it("по ключу, Полная Атака, попадание: оба Избегания недоступны, Очко потрачено", async () => {
    const a = await swing([byKey(KS.key)]);
    expect(card()).toContain("Уклонение (невозможно)");
    expect(card()).toMatch(/wh-parry-btn wh-dodge-disabled/);
    expect(a.system.fate.value).toBe(2);
    expect(card()).toContain("Смертельный Удар");
  });

  it("по имени (Талант без записи Конструктора) — то же", async () => {
    const a = await swing([byName(KS.name)]);
    expect(card()).toContain("Уклонение (невозможно)");
    expect(a.system.fate.value).toBe(2);
  });

  it("раз в Ход: метка ставится на атакующего", async () => {
    const a = await swing([byName(KS.name)]);
    expect(a.getFlag("warhammer-dbc", KILLING_STRIKE_FLAG)).toBe(true);
  });

  it("без галочки Очко не тратится, Избегание обычное", async () => {
    const a = await swing([byName(KS.name)], { toggles: {} });
    expect(card()).not.toContain("Уклонение (невозможно)");
    expect(a.system.fate.value).toBe(3);
  });

  it("не Полная Атака — Талант молчит, Очко цело", async () => {
    const a = await swing([byName(KS.name)], { baseKey: "standard" });
    expect(card()).not.toContain("Уклонение (невозможно)");
    expect(a.system.fate.value).toBe(3);
  });

  it("промах — Очко не тратится (Избегать нечего)", async () => {
    const a = await swing([byName(KS.name)], { roll: 90 });
    expect(a.system.fate.value).toBe(3);
    expect(a.getFlag("warhammer-dbc", KILLING_STRIKE_FLAG)).toBeUndefined();
  });

  it("нет Очков Бесчестия — эффекта нет", async () => {
    const a = await swing([byName(KS.name)], { fate: 0 });
    expect(card()).not.toContain("Уклонение (невозможно)");
    expect(a.system.fate.value).toBe(0);
  });

  it("без Таланта галочка ничего не делает", async () => {
    const a = await swing([]);
    expect(card()).not.toContain("Уклонение (невозможно)");
    expect(a.system.fate.value).toBe(3);
  });

  it("переброс той же атаки (skipAmmo + talentPaid): эффект сохраняется, второй раз не платит", async () => {
    const a = await swing([byName(KS.name)]);
    // Уже использован в этом Ходу (метка стоит), но оплаченный переброс не теряет эффекта.
    captured.dice = [20, 5];
    const w = a.items.find(i => i.type === "weapon");
    await _executeAttackRoll(a, w, "ws", 45, "melee", null,
      { baseKey: "fullatk", talentToggles: { killingStrike: true }, skipAmmo: true, talentPaid: { killingStrike: true } });
    expect(card()).toContain("Уклонение (невозможно)");
    expect(a.system.fate.value).toBe(2);
  });

  it("второй Смертельный Удар в том же Ходу (метка стоит) — не срабатывает", async () => {
    const a = await swing([byName(KS.name)]);
    captured.dice = [20, 5];
    const w = a.items.find(i => i.type === "weapon");
    await _executeAttackRoll(a, w, "ws", 45, "melee", null, { baseKey: "fullatk", talentToggles: { killingStrike: true } });
    expect(card()).not.toContain("Уклонение (невозможно)");
    expect(a.system.fate.value).toBe(2);
  });
});

describe("Смертельный Удар: чистые функции и галочка окна", () => {
  it("applies: нужны галочка + Полная Атака + Талант + не использован", () => {
    const a = who([byKey(KS.key)]);
    const t = { killingStrike: true };
    expect(killingStrikeApplies(a, { isMelee: true, baseKey: "fullatk", toggles: t })).toBe(true);
    expect(killingStrikeApplies(a, { isMelee: true, baseKey: "charge", toggles: t })).toBe(false);
    expect(killingStrikeApplies(a, { isMelee: true, baseKey: "fullatk", toggles: {} })).toBe(false);
    expect(killingStrikeApplies(a, { isMelee: false, baseKey: "fullatk", toggles: t })).toBe(false);
    expect(killingStrikeApplies(who([]), { isMelee: true, baseKey: "fullatk", toggles: t })).toBe(false);
  });

  it("offered: пропадает, когда метка Хода стоит", async () => {
    const a = who([byKey(KS.key)]);
    expect(killingStrikeOffered(a, { isMelee: true })).toBe(true);
    await a.setFlag("warhammer-dbc", KILLING_STRIKE_FLAG, true);
    expect(killingStrikeOffered(a, { isMelee: true })).toBe(false);
  });

  it("галочка в окне рукопашной с Талантом есть, без Таланта и у стрелкового — нет", () => {
    expect(talentTogglesHtml(who([byKey(KS.key)]), blade(), { isMelee: true })).toContain('data-key="killingStrike"');
    expect(talentTogglesHtml(who([]), blade(), { isMelee: true })).toBe("");
    expect(talentTogglesHtml(who([byKey(KS.key)]), blade(), { isMelee: false })).not.toContain("killingStrike");
  });

});
