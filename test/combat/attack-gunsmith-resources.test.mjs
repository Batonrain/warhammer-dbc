// test/combat/attack-gunsmith-resources.test.mjs
//
// Таланты «Оружейника» с ресурсом на предмете (Sahara 3-9d40): Тех-Оружейник
// (усиленный выстрел раз на оружие до новой настройки), Настройка Линз (заряды
// на лаз-оружии), Литания Чистки (метка «чищено за сутки» по типу оружия).
// Логика решений — rules/gunsmith-talents.mjs; проводка — combat/attack.mjs,
// окно — sheets/attack/talent-toggles.mjs.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { talentTogglesHtml } from "../../module/sheets/attack/talent-toggles.mjs";
import { weaponTechShot, lensTuningShot, litanyReliability, litanyWeaponType, litanyCoversWeapon,
  litanyUnresolved, LITANY_WINDOW_SECONDS } from "../../module/rules/gunsmith-talents.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
const damage = () => Number(card().match(/<button class="wh-apply-dmg-btn[^>]*data-damage="(\d+)"/)?.[1]);
const pen = () => Number(card().match(/<button class="wh-apply-dmg-btn[^>]*data-penetration="(-?\d+)"/)?.[1]);
const byKey = key => ({
  id: "k-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});
const byName = (name, system = {}) => ({ id: "t-" + name, name, type: "talent", system });

const TECH = { key: "weaponsmith.core.weaponTech", name: "Weapon-Tech / Тех-Оружейник" };
const LENS = { key: "weaponsmith.core.lensTuning", name: "Lens Tuning / Настройка Линз" };
const LITANY = "Litany of Cleaning / Литания Чистки";

/** Оружие с флагами-ресурсами на самом предмете. */
function gun(system, name = "Plasma Gun / Плазмаган", flags = {}) {
  const w = weaponFor({ damage: "1d10", penetration: 2, ...system }, { name, id: "w-" + name });
  const store = { ...flags };
  w.getFlag = (s, k) => store[`${s}.${k}`];
  w.setFlag = async (s, k, v) => { store[`${s}.${k}`] = v; };
  w.store = store;
  return w;
}
function who(items, { i = 40 } = {}) {
  const a = actorFor({ items, characteristics: { ws: char(45), bs: char(45), s: char(40), t: char(40), ag: char(35), i: char(i) } });
  const store = {};
  a.getFlag = (s, k) => store[`${s}.${k}`];
  a.setFlag = async (s, k, v) => { store[`${s}.${k}`] = v; };
  a.store = store;
  return a;
}
async function shoot(actor, w, toggles = {}, opts = {}) {
  captured.dice = [23, 6, 4, 4];
  await _executeAttackRoll(actor, w, "bs", 45, "single", null, { talentToggles: toggles, ...opts });
}

beforeEach(() => { resetCaptured(); setTargets([]); });

// ── Тех-Оружейник ───────────────────────────────────────────────────────────

describe("Тех-Оружейник: +I.b к Dmg и Pen раз на оружие до новой настройки", () => {
  it("усиленный выстрел (ключ): +4 к урону и Pen, оружие помечено", async () => {
    const w = gun({ weaponType: "plasma" });
    const a = who([w, byKey(TECH.key)]);
    await shoot(a, w, { weaponTech: true });
    expect(damage()).toBe(6 + 4);
    expect(pen()).toBe(2 + 4);
    expect(w.store["warhammer-dbc.weaponTechSpent"]).toBe(true);
    expect(card()).toContain("Тех-Оружейник");
  });

  it("по имени; второй раз без перенастройки — отказ и нет бонуса", async () => {
    const w = gun({ weaponType: "melta" });
    const a = who([w, byName(TECH.name)]);
    await shoot(a, w, { weaponTech: true });
    resetCaptured();
    await shoot(a, w, { weaponTech: true });
    expect(damage()).toBe(6);
    expect(card()).toContain("не настроено заново");
  });

  it("перенастройка снимает метку: бонус снова", async () => {
    const w = gun({ weaponType: "exotic" }, "Xeno Gun", { "warhammer-dbc.weaponTechSpent": true });
    const a = who([w, byName(TECH.name)]);
    await shoot(a, w, { weaponTech: true, weaponTechRetune: true });
    expect(damage()).toBe(6 + 4);
    expect(w.store["warhammer-dbc.weaponTechSpent"]).toBe(true);
  });

  it("перенастройка без выстрела только снимает метку", async () => {
    const w = gun({ weaponType: "plasma" }, "Plasma", { "warhammer-dbc.weaponTechSpent": true });
    const a = who([w, byName(TECH.name)]);
    await shoot(a, w, { weaponTechRetune: true });
    expect(w.store["warhammer-dbc.weaponTechSpent"]).toBe(false);
    expect(damage()).toBe(6);
  });

  it("переброс оплаченного выстрела не проверяет метку и не ставит её повторно", async () => {
    const w = gun({ weaponType: "plasma" }, "Plasma", { "warhammer-dbc.weaponTechSpent": true });
    const a = who([w, byName(TECH.name)]);
    await shoot(a, w, { weaponTech: true }, { skipAmmo: true, talentPaid: { weaponTech: true } });
    expect(damage()).toBe(6 + 4);
  });

  it("переброс неоплаченного (оружие уже потрачено): бонуса бесплатно нет", async () => {
    const w = gun({ weaponType: "plasma" }, "Plasma", { "warhammer-dbc.weaponTechSpent": true });
    const a = who([w, byName(TECH.name)]);
    await shoot(a, w, { weaponTech: true }, { skipAmmo: true });
    expect(damage()).toBe(6);
  });

  it("другой тип оружия и отсутствие Таланта — бонуса нет", async () => {
    const bolter = gun({ weaponType: "bolt" }, "Болтер");
    await shoot(who([bolter, byName(TECH.name)]), bolter, { weaponTech: true });
    expect(damage()).toBe(6);
    resetCaptured();
    const plasma = gun({ weaponType: "plasma" });
    await shoot(who([plasma]), plasma, { weaponTech: true });
    expect(damage()).toBe(6);
  });

  it("чистая функция", () => {
    const a = who([byName(TECH.name)]);
    const item = gun({ weaponType: "plasma" });
    expect(weaponTechShot(a, { item, isMelee: false, toggles: { weaponTech: true }, spent: false })).toMatchObject({ bonus: 4, spend: true });
    expect(weaponTechShot(a, { item, isMelee: false, toggles: { weaponTech: true }, spent: true })).toMatchObject({ bonus: 0, refused: true });
    expect(weaponTechShot(a, { item, isMelee: true, toggles: { weaponTech: true }, spent: false }).bonus).toBe(0);
  });
});

// ── Настройка Линз ──────────────────────────────────────────────────────────

describe("Настройка Линз: заряды лаз-оружия → Felling(I.b) и Precise", () => {
  const laser = (flags) => gun({ weaponType: "laser", weaponProps: [] }, "Lasgun / Лазган", flags);

  it("настроить и сразу потратить: заряды I.b = 4, остаётся 3, Felling 4 и Precise на карточке", async () => {
    const w = laser();
    const a = who([w, byKey(LENS.key)]);
    await shoot(a, w, { lensTune: true, lensUse: true });
    expect(w.store["warhammer-dbc.lensCharges"]).toBe(3);
    expect(card()).toMatch(/data-felling="4"/);
    expect(card()).toContain("Настройка Линз");
  });

  it("по имени: заряд из прежних", async () => {
    const w = laser({ "warhammer-dbc.lensCharges": 2 });
    const a = who([w, byName(LENS.name)]);
    await shoot(a, w, { lensUse: true });
    expect(w.store["warhammer-dbc.lensCharges"]).toBe(1);
    expect(card()).toMatch(/data-felling="4"/);
  });

  it("без зарядов — предупреждение, свойств нет", async () => {
    const w = laser();
    const a = who([w, byName(LENS.name)]);
    await shoot(a, w, { lensUse: true });
    expect(card()).toMatch(/data-felling="0"/);
    expect(w.store["warhammer-dbc.lensCharges"]).toBeUndefined();
  });

  it("без галочки заряды не тратятся", async () => {
    const w = laser({ "warhammer-dbc.lensCharges": 3 });
    await shoot(who([w, byName(LENS.name)]), w, {});
    expect(w.store["warhammer-dbc.lensCharges"]).toBe(3);
  });

  it("не лазерное оружие и без Таланта — ничего", async () => {
    const plasma = gun({ weaponType: "plasma" }, "Plasma", { "warhammer-dbc.lensCharges": 3 });
    await shoot(who([plasma, byName(LENS.name)]), plasma, { lensUse: true });
    expect(plasma.store["warhammer-dbc.lensCharges"]).toBe(3);
    resetCaptured();
    const w = laser({ "warhammer-dbc.lensCharges": 3 });
    await shoot(who([w]), w, { lensUse: true });
    expect(w.store["warhammer-dbc.lensCharges"]).toBe(3);
  });

  it("у оружия уже есть Felling — берётся больший рейтинг", async () => {
    const w = gun({ weaponType: "laser", weaponProps: [{ key: "felling", rating: 6 }] }, "Лазган", { "warhammer-dbc.lensCharges": 1 });
    await shoot(who([w, byName(LENS.name)]), w, { lensUse: true });
    expect(card()).toMatch(/data-felling="6"/);
  });

  it("чистая функция", () => {
    const a = who([byName(LENS.name)]);
    const item = laser();
    expect(lensTuningShot(a, { item, isMelee: false, toggles: { lensTune: true, lensUse: true }, charges: 0 }))
      .toMatchObject({ charges: 3, use: true, felling: 4 });
    expect(lensTuningShot(a, { item, isMelee: false, toggles: { lensTune: true }, charges: 1 })).toMatchObject({ charges: 4, use: false });
    expect(lensTuningShot(a, { item, isMelee: false, toggles: { lensUse: true }, charges: 0 })).toMatchObject({ use: false, empty: true });
    expect(lensTuningShot(a, { item, isMelee: false, toggles: { lensUse: true }, charges: 0, replay: true }).use).toBe(true);
  });
});

// ── Литания Чистки ──────────────────────────────────────────────────────────

describe("Литания Чистки: +1 Надёжность оружию выбранного типа, чищенному за сутки", () => {
  const litany = spec => byName(LITANY, { specialization: spec });
  const lasgun = () => gun({ weaponType: "laser", weaponProps: [] }, "Lasgun / Лазган");

  it("настоящая строка-шаблон из пака (весь список) — тип НЕ выбран, а не «болтеры»", () => {
    const raw = "Bolt, Flame, Grav, Las, Launcher, Melta, Solid Projectile, Exotic (1 любой)";
    expect(litanyWeaponType(litany(raw))).toBe("");
    const a = who([litany(raw)]);
    expect(litanyCoversWeapon(a, gun({ weaponType: "bolt" }, "Болтер"))).toBe(false);
  });

  // Sahara covering-fire-hip-shooting п.6: Литания, купленная до выбора типа, молчит — окно атаки говорит об этом.
  it("Литания с нерешённым типом попадает в litanyUnresolved, с выбранным — нет", () => {
    const raw = "Bolt, Flame, Grav, Las, Launcher, Melta, Solid Projectile, Exotic (1 любой)";
    expect(litanyUnresolved(who([litany(raw)])).length).toBe(1);
    expect(litanyUnresolved(who([litany("Las")])).length).toBe(0);
    expect(litanyUnresolved(who([]))).toEqual([]);
  });

  it("окно атаки: у оружия с нерешённой Литанией — подсказка вписать тип; при выбранном типе — галочка, без подсказки", () => {
    const raw = "Bolt, Flame, Grav, Las, Launcher, Melta, Solid Projectile, Exotic (1 любой)";
    const w = lasgun();
    const stale = talentTogglesHtml(who([w, litany(raw)]), w, { isMelee: false, wProps: [], sys: {} });
    expect(stale).toContain("тип оружия не выбран");
    expect(stale).not.toContain("litanyCleaned");
    const ok = talentTogglesHtml(who([w, litany("Las")]), w, { isMelee: false, wProps: [], sys: {} });
    expect(ok).toContain("litanyCleaned");
    expect(ok).not.toContain("тип оружия не выбран");
  });

  it("запертая галочка не продлевает чистку: метка не переписывается, пока жива", async () => {
    const w = lasgun();
    const a = who([w, litany("Las")]);
    a.store["warhammer-dbc.litanyCleaned"] = { laser: 500 };
    globalThis.game.time = { worldTime: 600 };
    await shoot(a, w, { litanyCleaned: true });
    expect(a.store["warhammer-dbc.litanyCleaned"]).toEqual({ laser: 500 });
  });

  it("специализация → тип оружия", () => {
    expect(litanyWeaponType(litany("Las"))).toBe("laser");
    expect(litanyWeaponType(litany("Bolt"))).toBe("bolt");
    expect(litanyWeaponType(litany("Solid Projectile"))).toBe("solid");
    expect(litanyWeaponType(litany("Launcher"))).toBe("launcher");
    expect(litanyWeaponType(byName("Litany of Cleaning (Melta) / Литания Чистки"))).toBe("melta");
    expect(litanyWeaponType(litany(""))).toBe("");
  });

  it("галочка «чищено» ставит метку, надёжность растёт на 1 (клин реже), карточка называет причину", async () => {
    const w = lasgun();
    const a = who([w, litany("Las")]);
    globalThis.game.time = { worldTime: 1000 };
    await shoot(a, w, { litanyCleaned: true });
    expect(a.store["warhammer-dbc.litanyCleaned"]).toEqual({ laser: 1000 });
    expect(card()).toContain("Литания Чистки");
  });

  it("метка сутки действует, потом гаснет; чужой тип не затронут", () => {
    const a = who([litany("Las")]);
    const item = lasgun();
    const base = { item, isMelee: false, cleaned: { laser: 1000 } };
    expect(litanyReliability(a, { ...base, worldTime: 1000 + LITANY_WINDOW_SECONDS - 1 })).toBe(1);
    expect(litanyReliability(a, { ...base, worldTime: 1000 + LITANY_WINDOW_SECONDS })).toBe(0);
    expect(litanyReliability(a, { ...base, worldTime: 999 })).toBe(0);
    const bolter = gun({ weaponType: "bolt" }, "Болтер");
    expect(litanyCoversWeapon(a, bolter)).toBe(false);
    expect(litanyReliability(a, { item: bolter, isMelee: false, cleaned: { bolt: 1000 }, worldTime: 1100 })).toBe(0);
    expect(litanyReliability(who([]), { ...base, worldTime: 1100 })).toBe(0);
  });

  it("без галочки и без метки надёжность прежняя", async () => {
    const w = lasgun();
    const a = who([w, litany("Las")]);
    globalThis.game.time = { worldTime: 1000 };
    await shoot(a, w, {});
    expect(card()).not.toContain("Литания Чистки");
  });
});

// ── Окно атаки ──────────────────────────────────────────────────────────────

describe("блок «Таланты»: ресурсы", () => {
  it("Тех-Оружейник — только у плазмы/мельты/экзотики; Линзы — у лазера; Литания — у выбранного типа", () => {
    const tech = byName(TECH.name), lens = byName(LENS.name), lit = byName(LITANY, { specialization: "Las" });
    const a = who([tech, lens, lit]);
    const plasma = gun({ weaponType: "plasma" }), las = gun({ weaponType: "laser" }), bolt = gun({ weaponType: "bolt" });
    const html = w => talentTogglesHtml(a, w, { isMelee: false, wProps: [], sys: {} });
    expect(html(plasma)).toContain('data-key="weaponTech"');
    expect(html(plasma)).not.toContain('data-key="lensUse"');
    expect(html(las)).toContain('data-key="lensUse"');
    expect(html(las)).toContain('data-key="litanyCleaned"');
    expect(html(las)).not.toContain('data-key="weaponTech"');
    expect(html(bolt)).toBe("");
  });

  it("Литания уже действует — галочка отмечена и заперта", () => {
    const a = who([byName(LITANY, { specialization: "Las" })]);
    a.store["warhammer-dbc.litanyCleaned"] = { laser: 500 };
    globalThis.game.time = { worldTime: 600 };
    const html = talentTogglesHtml(a, gun({ weaponType: "laser" }), { isMelee: false, wProps: [], sys: {} });
    expect(html).toMatch(/data-key="litanyCleaned" checked disabled/);
  });
});
