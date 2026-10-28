// test/combat/gunner-hints.test.mjs
//
// Таланты «Стрелка» главы 3, решённые подсказкой и запретом (Sahara 3-5fbf,
// решения владельца 24.10.2026):
//   Applied Physics / Прикладная Физика — подсказка предела сдвига шаблона ½BS.b;
//   On This Mark / По Этим Координатам  — запрет Избирательной атаки и
//     Прицеливания по галочке «по координатам» + подсказка.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";
import { appliedPhysicsShift, onThisMarkActive, onThisMarkAvailable } from "../../module/rules/gunner-talents.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
const byKey = key => ({
  id: "k-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});
const byName = name => ({ id: "t-" + name, name, type: "talent", system: {} });
const PHYS = { key: "rangedCore.core.appliedPhysics", name: "Applied Physics / Прикладная Физика" };
const MARK = { key: "rangedCore.core.onThisMark", name: "On This Mark / По Этим Координатам" };

beforeEach(() => { resetCaptured(); setTargets([]); });

describe("Прикладная Физика: подсказка сдвига шаблона", () => {
  const launcher = (props = [{ key: "blast", rating: 3 }]) =>
    weaponFor({ damage: "2d10", penetration: 0, weaponProps: props }, { name: "Гранатомёт" });
  async function fire(items, weapon, bs = 55) {
    const actor = actorFor({ items: [weapon, ...items], characteristics: { bs: char(bs), ws: char(40), s: char(40), t: char(40), ag: char(35) } });
    captured.dice = [23, 6, 4];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
  }

  it("с Талантом (ключ) и свойством Blast: до ½BS.b (окр.▲) м — BS.b 5 → 3 м", async () => {
    await fire([byKey(PHYS.key)], launcher());
    expect(card()).toContain("Прикладная Физика");
    expect(card()).toContain("до 3 м");
  });

  it("по имени: то же", async () => {
    await fire([byName(PHYS.name)], launcher(), 45);
    expect(card()).toContain("до 2 м");
  });

  it("без Таланта или без Blast — подсказки нет", async () => {
    await fire([], launcher());
    expect(card()).not.toContain("Прикладная Физика");
    resetCaptured();
    await fire([byName(PHYS.name)], launcher([]));
    expect(card()).not.toContain("Прикладная Физика");
  });

  it("чистая функция", () => {
    const a = actorFor({ items: [byName(PHYS.name)] });
    expect(appliedPhysicsShift(a, { blastRating: 2, bsBonus: 5 })).toBe(3);
    expect(appliedPhysicsShift(a, { blastRating: 0, bsBonus: 5 })).toBe(0);
    expect(appliedPhysicsShift(actorFor({ items: [] }), { blastRating: 2, bsBonus: 5 })).toBe(0);
  });
});

describe("По Этим Координатам: запрет Избирательной и Прицеливания", () => {
  const gun = () => weaponFor({ damage: "1d10", penetration: 0 }, { name: "Лазган" });
  const HEAD = { value: "head", label: "Голова" };
  async function shoot(items, aim, opts) {
    const w = gun();
    const actor = actorFor({ items: [w, ...items] });
    captured.dice = [23, 6, 4];
    await _executeAttackRoll(actor, w, "bs", 45, "single", aim, opts);
  }

  it("с галочкой Избирательная атака сбрасывается: место — по броску, не «Голова» по умолчанию", async () => {
    await shoot([byKey(MARK.key)], HEAD, { onThisMark: true });
    expect(card()).toContain("По Этим Координатам");
    expect(card()).not.toContain("Избирательная");
    expect(captured.chat.at(-1)?.content).not.toMatch(/data-hit-location="Голова"/);
  });

  it("без галочки — Талант ничего не запрещает", async () => {
    await shoot([byKey(MARK.key)], HEAD, {});
    expect(card()).not.toContain("По Этим Координатам");
    expect(card()).toMatch(/data-hit-location="Голова"/);
  });

  it("без Таланта галочка игнорируется", async () => {
    await shoot([], HEAD, { onThisMark: true });
    expect(card()).not.toContain("По Этим Координатам");
    expect(card()).toMatch(/data-hit-location="Голова"/);
  });

  it("с галочкой Прицеливание не даёт и преимуществ в броске: Меткое без доп. куба урона", async () => {
    const dmg = async opts => {
      resetCaptured();
      const w = weaponFor({ damage: "1d10", penetration: 0, weaponProps: [{ key: "accurate" }] }, { name: "Лонг-лас" });
      const actor = actorFor({ items: [w, byKey(MARK.key)] });
      captured.dice = [23, 6, 4, 4, 4];
      await _executeAttackRoll(actor, w, "bs", 45, "single", null, { aiming: "full", ...opts });
      return Number(card().match(/class="wh-apply-dmg-btn[^>]*data-damage="(\d+)"/)?.[1]);
    };
    const aimed = await dmg({});
    const marked = await dmg({ onThisMark: true });
    expect(aimed).toBeGreaterThan(marked);
  });

  it("активность и доступность (имя и ключ)", () => {
    const a = actorFor({ items: [byName(MARK.name)] });
    expect(onThisMarkActive(a, { opts: { onThisMark: true }, isMelee: false })).toBe(true);
    expect(onThisMarkActive(a, { opts: { onThisMark: true }, isMelee: true })).toBe(false);
    expect(onThisMarkActive(a, { opts: {}, isMelee: false })).toBe(false);
    expect(onThisMarkAvailable(a, { isMelee: false })).toBe(true);
    expect(onThisMarkAvailable(actorFor({ items: [byKey(MARK.key)] }), { isMelee: false })).toBe(true);
    expect(onThisMarkAvailable(actorFor({ items: [] }), { isMelee: false })).toBe(false);
  });

  it("галочка есть в окне атаки только у носителя Таланта", () => {
    const w = weaponFor({ weaponClass: "basic", equipped: true, grips: "2р" }, { id: "gun", name: "Лазган" });
    const mk = items => {
      const a = actorFor({ items: [w, ...items], fatigue: { value: 0 }, aiming: "none" });
      a.update = async () => {}; a.getFlag = () => undefined; a.setFlag = async () => {}; a.unsetFlag = async () => {};
      return a;
    };
    showAttackDialog(mk([byName(MARK.name)]), w);
    expect(captured.dialog.content).toContain('id="atk-on-this-mark"');
    resetCaptured();
    showAttackDialog(mk([]), w);
    expect(captured.dialog.content).not.toContain('id="atk-on-this-mark"');
  });
});
