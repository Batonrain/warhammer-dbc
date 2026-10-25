// test/combat/attack-gunner-toggles.test.mjs
//
// Таланты Стрелка и Оружейника, включаемые галочкой окна атаки
// (opts.talentToggles; Sahara 3-5fbf / 3-9d40): Верный Выстрел, Око Мщения,
// Контролируемая Очередь, Огневая Клеть, Облучить. Логика решений —
// rules/gunner-talents.mjs и rules/gunsmith-talents.mjs.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { talentTogglesHtml } from "../../module/sheets/attack/talent-toggles.mjs";
import { armorBreachOutcome } from "../../module/combat/armor-properties.mjs";
import { sureShotApplies, sureShotDodgePenalty, eyeOfVengeanceBonus, controlledBurstRof, controlledBurstApplies,
  cageFiringApplies } from "../../module/rules/gunner-talents.mjs";
import { irradiateMode } from "../../module/rules/gunsmith-talents.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
const damage = () => Number(card().match(/<button class="wh-apply-dmg-btn[^>]*data-damage="(\d+)"/)?.[1]);
const pen = () => Number(card().match(/<button class="wh-apply-dmg-btn[^>]*data-penetration="(-?\d+)"/)?.[1]);
const dodgeMod = () => Number(card().match(/class="wh-dodge-btn"[^>]*data-extra-mod="(-?\d+)"/)?.[1]);
const byKey = key => ({
  id: "k-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});
const byName = name => ({ id: "t-" + name, name, type: "talent", system: {} });

const SURE  = { key: "rangedCore.core.sureShot", name: "Sure Shot / Верный Выстрел" };
const EYE   = { key: "rangedCore.core.eyeOfVengeance", name: "Eye of Vengeance / Око Мщения" };
const CTRL  = { key: "rangedCore.core.controlledBurst", name: "Controlled Burst / Контролируемая Очередь" };
const CAGE  = { key: "rangedCore.core.cageFiring", name: "Cage Firing / Огневая Клеть" };
const IRRAD = { key: "weaponsmith.core.irradiate", name: "Irradiate / Облучить" };

/** Актор с пулом Очков Бесчестия, флагами и update, как у документа. */
function who(items, { fate = 3, inf = 40 } = {}) {
  const a = actorFor({ items, fate: { value: fate, max: 5 },
    characteristics: { ws: char(45), bs: char(45), s: char(40), t: char(40), ag: char(35), inf: char(inf) } });
  a.updates = [];
  a.update = async data => { a.updates.push(data); for (const [p, v] of Object.entries(data)) { const k = p.split("."); let c = a; for (const x of k.slice(0, -1)) c = c[x]; c[k.at(-1)] = v; } };
  const store = {};
  a.getFlag = (s, k) => store[`${s}.${k}`];
  a.setFlag = async (s, k, v) => { store[`${s}.${k}`] = v; };
  a.unsetFlag = async (s, k) => { delete store[`${s}.${k}`]; };
  return a;
}

// Заглушка foundry.utils.getProperty возвращает undefined; настоящая — обход по пути. Подменяем на неё же по смыслу.
const realGetProperty = (o, p) => String(p).split(".").reduce((c, k) => c?.[k], o);
let stubGetProperty;
beforeEach(() => {
  resetCaptured(); setTargets([]);
  stubGetProperty = globalThis.foundry.utils.getProperty;
  globalThis.foundry.utils.getProperty = realGetProperty;
});
afterEach(() => { globalThis.foundry.utils.getProperty = stubGetProperty; });

// ── Верный Выстрел ──────────────────────────────────────────────────────────

describe("Верный Выстрел: Очко Бесчестия → Уклонение цели −10 за Успех", () => {
  const gun = () => weaponFor({ damage: "1d10", penetration: 0 }, { name: "Снайперка" });
  async function snipe(items, toggles, { fate = 3, mode = "single", roll = 5 } = {}) {
    const w = gun();
    const actor = who([w, ...items], { fate });
    captured.dice = [roll, 6, 4];
    await _executeAttackRoll(actor, w, "bs", 45, mode, null, { talentToggles: toggles });
    return actor;
  }

  it("по ключу: 5 Успехов на попадание → −50 к Уклонению, Очко потрачено", async () => {
    const a = await snipe([byKey(SURE.key)], { sureShot: true });
    expect(dodgeMod()).toBeLessThanOrEqual(-50);
    expect(a.system.fate.value).toBe(2);
  });

  it("по имени: то же", async () => {
    const a = await snipe([byName(SURE.name)], { sureShot: true });
    expect(a.system.fate.value).toBe(2);
    expect(card()).toContain("Верный Выстрел");
  });

  it("без галочки — штрафа и траты нет", async () => {
    const a = await snipe([byName(SURE.name)], {});
    expect(a.system.fate.value).toBe(3);
    expect(card()).not.toContain("Верный Выстрел");
  });

  it("без Таланта галочка игнорируется", async () => {
    const a = await snipe([], { sureShot: true });
    expect(a.system.fate.value).toBe(3);
  });

  it("не одиночный выстрел — не работает", async () => {
    const w = weaponFor({ damage: "1d10", penetration: 0, rof_semi: 3 }, { name: "Автомат" });
    const actor = who([w, byName(SURE.name)]);
    captured.dice = [5, 6, 4, 4];
    await _executeAttackRoll(actor, w, "bs", 45, "semi", null, { talentToggles: { sureShot: true } });
    expect(actor.system.fate.value).toBe(3);
  });

  it("промах — Очко не тратится", async () => {
    const a = await snipe([byName(SURE.name)], { sureShot: true }, { roll: 90 });
    expect(a.system.fate.value).toBe(3);
  });

  it("нет Очков Бесчестия — предупреждение, штрафа нет", async () => {
    const a = await snipe([byName(SURE.name)], { sureShot: true }, { fate: 0 });
    expect(a.system.fate.value).toBe(0);
    expect(card()).not.toContain("Верный Выстрел");
  });

  it("переброс уже оплаченного выстрела (talentPaid) не платит повторно, но штраф сохраняет", async () => {
    const w = gun();
    const actor = who([w, byName(SURE.name)]);
    captured.dice = [5, 6, 4];
    await _executeAttackRoll(actor, w, "bs", 45, "single", null,
      { talentToggles: { sureShot: true }, skipAmmo: true, talentPaid: { sureShot: true } });
    expect(actor.system.fate.value).toBe(3);
    expect(card()).toContain("Верный Выстрел");
  });

  it("переброс, где промах стал попаданием, платит Очко сейчас; без Очков штрафа нет", async () => {
    const w = gun();
    const actor = who([w, byName(SURE.name)]);
    captured.dice = [5, 6, 4];
    await _executeAttackRoll(actor, w, "bs", 45, "single", null, { talentToggles: { sureShot: true }, skipAmmo: true });
    expect(actor.system.fate.value).toBe(2);
    resetCaptured();
    const broke = who([w, byName(SURE.name)], { fate: 0 });
    captured.dice = [5, 6, 4];
    await _executeAttackRoll(broke, w, "bs", 45, "single", null, { talentToggles: { sureShot: true }, skipAmmo: true });
    expect(card()).not.toContain("Верный Выстрел");
  });

  it("карточка запоминает оплату для следующих перебросов (storedOpts.talentPaid)", async () => {
    const w = gun();
    const actor = who([w, byName(SURE.name)]);
    captured.dice = [5, 6, 4];
    await _executeAttackRoll(actor, w, "bs", 45, "single", null, { talentToggles: { sureShot: true } });
    const stored = captured.chat.at(-1)?.flags?.["warhammer-dbc"]?.attack?.opts;
    expect(stored?.talentPaid?.sureShot).toBe(true);
  });

  it("чистые функции", () => {
    const a = who([byName(SURE.name)]);
    const base = { toggles: { sureShot: true }, isMelee: false, rofMode: "single", hit: true };
    expect(sureShotApplies(a, base)).toBe(true);
    expect(sureShotApplies(a, { ...base, hit: false })).toBe(false);
    expect(sureShotApplies(a, { ...base, rofMode: "full" })).toBe(false);
    expect(sureShotApplies(a, { ...base, isMelee: true })).toBe(false);
    expect([0, 1, 4].map(sureShotDodgePenalty)).toEqual([0, -10, -40]);
  });
});

// ── Око Мщения ──────────────────────────────────────────────────────────────

describe("Око Мщения: +Inf.b к Dmg и Pen стрелкового оружия до конца Хода", () => {
  const gun = () => weaponFor({ damage: "1d10", penetration: 2 }, { id: "gun-1", name: "Лазган" });
  async function shoot(actor, w) {
    captured.dice = [23, 6, 4];
    await _executeAttackRoll(actor, w, "bs", 45, "single", null, { talentToggles: actor._toggles ?? {} });
  }

  it("галочка: Очко потрачено, +4 к урону и Pen (Inf 40), флаг на оружие", async () => {
    const w = gun();
    const actor = who([w, byKey(EYE.key)]);
    actor._toggles = { eyeOfVengeance: true };
    await shoot(actor, w);
    expect(actor.system.fate.value).toBe(2);
    expect(damage()).toBe(6 + 4);
    expect(pen()).toBe(2 + 4);
    expect(actor.getFlag("warhammer-dbc", "eyeOfVengeanceWeapon")).toBe("gun-1");
    expect(card()).toContain("Око Мщения");
  });

  it("повторная атака тем же оружием в этот Ход — бонус без новой траты", async () => {
    const w = gun();
    const actor = who([w, byName(EYE.name)]);
    actor._toggles = { eyeOfVengeance: true };
    await shoot(actor, w);
    resetCaptured();
    actor._toggles = {};
    await shoot(actor, w);
    expect(actor.system.fate.value).toBe(2);
    expect(damage()).toBe(6 + 4);
  });

  it("другое оружие бонуса не получает", async () => {
    const w = gun(), other = weaponFor({ damage: "1d10", penetration: 2 }, { id: "gun-2", name: "Пистолет" });
    const actor = who([w, other, byName(EYE.name)]);
    actor._toggles = { eyeOfVengeance: true };
    await shoot(actor, w);
    resetCaptured();
    actor._toggles = {};
    await shoot(actor, other);
    expect(damage()).toBe(6);
  });

  it("без Очков — предупреждение и бонуса нет", async () => {
    const w = gun();
    const actor = who([w, byName(EYE.name)], { fate: 0 });
    actor._toggles = { eyeOfVengeance: true };
    await shoot(actor, w);
    expect(damage()).toBe(6);
  });

  it("без Таланта или в рукопашной — 0", () => {
    const a = who([byName(EYE.name)]);
    expect(eyeOfVengeanceBonus(a, { item: { id: "x" }, isMelee: false, activeWeaponId: "x" })).toBe(4);
    expect(eyeOfVengeanceBonus(a, { item: { id: "x" }, isMelee: true, activeWeaponId: "x" })).toBe(0);
    expect(eyeOfVengeanceBonus(a, { item: { id: "x" }, isMelee: false, activeWeaponId: "y" })).toBe(0);
    expect(eyeOfVengeanceBonus(who([]), { item: { id: "x" }, isMelee: false, activeWeaponId: "x" })).toBe(0);
  });
});

// ── Контролируемая Очередь ──────────────────────────────────────────────────

describe("Контролируемая Очередь: расход патронов до половины RoF, но не меньше попаданий+1", () => {
  const smg = () => weaponFor({ weaponClass: "basic", damage: "1d10", penetration: 0, rof_single: 1, rof_semi: 3, rof_full: 10,
    magazineCur: 30, magazineMax: 30 }, { name: "Автомат" });
  async function burst(items, toggles, roll = 35) {
    const w = smg();
    const actor = who([w, ...items]);
    captured.dice = [roll, 3, 4, 5, 6, 7];
    await _executeAttackRoll(actor, w, "bs", 45, "full", null, { talentToggles: toggles });
    return w;
  }

  it("без галочки — полный RoF 10", async () => {
    const w = await burst([byName(CTRL.name)], {});
    expect(w.system.magazineCur).toBe(20);
  });

  it("с галочкой (ключ): 1 Успех → попаданий 1 → max(⌈10/2⌉, 2)=5 патронов", async () => {
    const w = await burst([byKey(CTRL.key)], { controlledBurst: true });
    expect(w.system.magazineCur).toBe(25);
    expect(card()).toContain("Контролируемая Очередь");
  });

  it("по имени: то же", async () => {
    const w = await burst([byName(CTRL.name)], { controlledBurst: true });
    expect(w.system.magazineCur).toBe(25);
  });

  it("много попаданий: не меньше попаданий+1 (4 Успеха → 5, но половина 5 → 5)", async () => {
    const w = await burst([byName(CTRL.name)], { controlledBurst: true }, 5);
    expect(w.system.magazineCur).toBe(30 - Math.max(5, 5 + 1));
  });

  it("Широкая очередь — не работает", async () => {
    const w = smg();
    const actor = who([w, byName(CTRL.name)]);
    captured.dice = [35, 3, 4, 5];
    await _executeAttackRoll(actor, w, "bs", 45, "full", null, { talentToggles: { controlledBurst: true }, wideBurst: true });
    expect(w.system.magazineCur).toBe(20);
  });

  it("чистые функции", () => {
    expect(controlledBurstRof({ rof: 10, hits: 1 })).toBe(5);
    expect(controlledBurstRof({ rof: 10, hits: 7 })).toBe(8);
    expect(controlledBurstRof({ rof: 4, hits: 9 })).toBe(4);   // не больше настоящего RoF
    expect(controlledBurstRof({ rof: 3, hits: 0 })).toBe(2);   // ⌈3/2⌉
    const a = who([byName(CTRL.name)]);
    expect(controlledBurstApplies(a, { toggles: { controlledBurst: true }, isMelee: false, rofMode: "semi", wideBurst: false })).toBe(true);
    expect(controlledBurstApplies(a, { toggles: { controlledBurst: true }, isMelee: false, rofMode: "single", wideBurst: false })).toBe(false);
    expect(controlledBurstApplies(a, { toggles: { controlledBurst: true }, isMelee: false, rofMode: "suppression", wideBurst: false })).toBe(false);
  });
});

// ── Огневая Клеть ───────────────────────────────────────────────────────────

describe("Огневая Клеть: Широкая Длинная очередь — RoF ещё −3, Уклонение цели вдвое дороже", () => {
  const smg = () => weaponFor({ weaponClass: "basic", damage: "1d10", penetration: 0, rof_single: 1, rof_semi: 3, rof_full: 7,
    magazineCur: 30, magazineMax: 30 }, { name: "Автомат" });
  async function burst(items, toggles, opts = {}) {
    const w = smg();
    const actor = who([w, ...items]);
    captured.dice = [5, 3, 4, 5, 6, 7, 8, 9, 3, 4, 5, 6];
    await _executeAttackRoll(actor, w, "bs", 45, "full", null, { talentToggles: toggles, wideBurst: true, ...opts });
    return card();
  }
  const hitsOf = html => [...html.matchAll(/<button class="wh-apply-dmg-btn/g)].length;

  it("Клеть: попаданий на 3 меньше, чем у обычной Широкой очереди; кнопка Уклонения несёт цену 2", async () => {
    const plain = await burst([byName(CAGE.name)], {});
    const plainHits = hitsOf(plain);
    resetCaptured();
    const cage = await burst([byKey(CAGE.key)], { cageFiring: true });
    expect(hitsOf(cage)).toBe(plainHits - 3);
    expect(cage).toMatch(/class="wh-dodge-btn"[^>]*data-evade-cost="2"/);
    expect(plain).toMatch(/class="wh-dodge-btn"[^>]*data-evade-cost="1"/);
    expect(cage).toContain("Огневая Клеть");
  });

  it("без Широкой очереди галочка ничего не делает", async () => {
    const html = await burst([byName(CAGE.name)], { cageFiring: true }, { wideBurst: false });
    expect(html).toMatch(/data-evade-cost="1"/);
  });

  it("чистая функция", () => {
    const a = who([byName(CAGE.name)]);
    const base = { toggles: { cageFiring: true }, isMelee: false, rofMode: "full", wideBurst: true };
    expect(cageFiringApplies(a, base)).toBe(true);
    expect(cageFiringApplies(a, { ...base, rofMode: "semi" })).toBe(false);
    expect(cageFiringApplies(a, { ...base, wideBurst: false })).toBe(false);
    expect(cageFiringApplies(who([]), base)).toBe(false);
  });
});

// ── Облучить ────────────────────────────────────────────────────────────────

describe("Облучить: удвоить Felling ЛИБО пробитие Rad без удвоения AP", () => {
  const radGun = () => weaponFor({ damage: "1d10", penetration: 0, weaponProps: [{ key: "rad", rating: "1d5" }, { key: "felling", rating: 2 }] },
    { name: "Radium Carbine / Радиевый Карабин" });
  async function shoot(items, toggles, w = radGun()) {
    const actor = who([w, ...items]);
    captured.dice = [23, 6, 4];
    await _executeAttackRoll(actor, w, "bs", 45, "single", null, { talentToggles: toggles });
    return card();
  }

  it("Felling удваивается: 2 → 4", async () => {
    const html = await shoot([byKey(IRRAD.key)], { irradiate: "felling" });
    expect(html).toMatch(/<button class="wh-apply-dmg-btn[^>]*data-felling="4"/);
    expect(html).toContain("Облучить");
  });

  it("по имени: то же; без выбора — Felling 2", async () => {
    expect(await shoot([byName(IRRAD.name)], { irradiate: "felling" })).toMatch(/data-felling="4"/);
    resetCaptured();
    expect(await shoot([byName(IRRAD.name)], { irradiate: "" })).toMatch(/data-felling="2"/);
  });

  it("пробитие Rad без удвоения: кнопка урона несёт признак", async () => {
    expect(await shoot([byName(IRRAD.name)], { irradiate: "noDouble" })).toMatch(/data-breach-no-double="1"/);
    resetCaptured();
    expect(await shoot([byName(IRRAD.name)], {})).toMatch(/data-breach-no-double="0"/);
  });

  it("без Таланта выбор игнорируется", async () => {
    const html = await shoot([], { irradiate: "felling" });
    expect(html).toMatch(/data-felling="2"/);
  });

  it("оружие без Rad — не работает", async () => {
    const plain = weaponFor({ damage: "1d10", penetration: 0, weaponProps: [{ key: "felling", rating: 2 }] }, { name: "Лазган" });
    expect(await shoot([byName(IRRAD.name)], { irradiate: "felling" }, plain)).toMatch(/data-felling="2"/);
  });

  it("расчёт пробития: без удвоения AP цель пробивается легче", () => {
    // AP 4, урон 7: с удвоением 8 ≥ 7 — не пробита; без удвоения 4 < 7 — пробита
    expect(armorBreachOutcome({ rawDamage: 7, effArmorAP: 4 }).breached).toBe(false);
    expect(armorBreachOutcome({ rawDamage: 7, effArmorAP: 4, noDouble: true })).toEqual({ breached: true, breachAbsorption: 4 });
  });

  it("чистая функция режима", () => {
    const a = who([byName(IRRAD.name)]);
    const wProps = [{ key: "rad" }, { key: "felling" }];
    expect(irradiateMode(a, { toggles: { irradiate: "felling" }, isMelee: false, wProps })).toBe("felling");
    expect(irradiateMode(a, { toggles: { irradiate: "noDouble" }, isMelee: false, wProps })).toBe("noDouble");
    expect(irradiateMode(a, { toggles: { irradiate: "felling" }, isMelee: false, wProps: [{ key: "rad" }] })).toBe("");
    expect(irradiateMode(a, { toggles: { irradiate: "noDouble" }, isMelee: true, wProps })).toBe("");
  });
});

// ── Разметка окна ───────────────────────────────────────────────────────────

describe("блок «Таланты» окна атаки", () => {
  const radProps = [{ key: "rad" }, { key: "felling" }];
  const sys = { rof_semi: 3, rof_full: 10 };

  it("пуст без Талантов и в рукопашной", () => {
    expect(talentTogglesHtml(who([]), { id: "w" }, { isMelee: false, wProps: radProps, sys })).toBe("");
    expect(talentTogglesHtml(who([byName(SURE.name)]), { id: "w" }, { isMelee: true, wProps: [], sys })).toBe("");
  });

  it("показывает галочки носителю Талантов", () => {
    const a = who([byName(SURE.name), byName(EYE.name), byName(CTRL.name), byName(CAGE.name), byName(IRRAD.name)]);
    const html = talentTogglesHtml(a, { id: "w" }, { isMelee: false, wProps: radProps, sys });
    for (const k of ["sureShot", "eyeOfVengeance", "controlledBurst", "cageFiring", "irradiate"]) {
      expect(html).toContain(`data-key="${k}"`);
    }
  });

  it("Облучить — только у Рад-оружия; Контролируемая Очередь — только с Очередью", () => {
    const a = who([byName(IRRAD.name), byName(CTRL.name)]);
    const plain = talentTogglesHtml(a, { id: "w" }, { isMelee: false, wProps: [], sys: { rof_semi: 0, rof_full: 0 } });
    expect(plain).toBe("");
  });

  it("Око Мщения уже действует на этом оружии — галочка отмечена и заперта", () => {
    const a = who([byName(EYE.name)]);
    a.setFlag("warhammer-dbc", "eyeOfVengeanceWeapon", "w");
    const html = talentTogglesHtml(a, { id: "w" }, { isMelee: false, wProps: [], sys });
    expect(html).toMatch(/data-key="eyeOfVengeance" checked disabled/);
  });
});
