// test/combat/spray-auto-hit.test.mjs
//
// Распыление (Spray, стр. 168): «Оно попадает автоматически, но каждая цель
// может отменить попадание броском A+0». До этого шага огнемёт бросал обычный
// тест BS и мог промазать — тест на отмену (wdbc-p06s) при этом уже был, то
// есть цель защищалась от попадания, которого движок мог и не дать.
//
// Здесь и правило в чистом виде (attackHitOutcome/sprayJamFace), и сквозной
// прогон настоящей атаки заглушкой — чтобы «Промах» не вернулся мимо тестов.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { attackHitOutcome } from "../../module/combat/attack-outcome.mjs";
import { sprayJamFace, sprayJams, jamThreshold } from "../../module/combat/weapon-properties.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

/** Строки «Попадание N | урон | место» из блока урона карточки. */
function hits() {
  return [...card().matchAll(
    /<span class="roll-hit-idx">Попадание (\d+)<\/span>\s*<span class="roll-hit-dmg">(\d+)<\/span>\s*<span class="roll-hit-loc">([^<]+)<\/span>/g
  )].map(m => ({ index: Number(m[1]), damage: Number(m[2]), location: m[3] }));
}

/** Огнемёт: Распыление плюс, если надо, свойство Надёжности. */
const flamerProps = (extra = []) => [{ key: "spray", rating: 0, rating2: 0 }, ...extra];

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

// ── Правило в чистом виде ───────────────────────────────────────────────────

describe("attackHitOutcome", () => {
  it("Распыление попадает автоматически даже на провальном броске", () => {
    expect(attackHitOutcome({ rv: 98, threshold: 45, isMelee: false, wp: { spray: true } }))
      .toEqual({ success: true, deg: 1, auto: "spray" });
  });

  it("Распыление даёт РОВНО 1 Успех — успешный бросок его не увеличивает", () => {
    expect(attackHitOutcome({ rv: 5, threshold: 45, isMelee: false, wp: { spray: true } }).deg).toBe(1);
  });

  it("без Распыления исход по-прежнему считает бросок", () => {
    expect(attackHitOutcome({ rv: 77, threshold: 45, isMelee: false, wp: {} }))
      .toEqual({ success: false, deg: 4, auto: "" });
    expect(attackHitOutcome({ rv: 23, threshold: 45, isMelee: false, wp: {} }))
      .toEqual({ success: true, deg: 3, auto: "" });
  });

  it("рукопашной Распыление не касается — Spray стрелковое свойство", () => {
    expect(attackHitOutcome({ rv: 77, threshold: 45, isMelee: true, wp: { spray: true } }).success).toBe(false);
  });

  it("Локус Неизбежности (fixedSuccessDeg) старше Распыления", () => {
    expect(attackHitOutcome({ rv: 98, threshold: 45, wp: { spray: true }, fixedSuccessDeg: 1 }).auto).toBe("fixed");
  });

  it("Беспомощная цель (forceHit) — успех минимум с 1 Успехом", () => {
    expect(attackHitOutcome({ rv: 98, threshold: 45, wp: {}, forceHit: true }))
      .toEqual({ success: true, deg: 1, auto: "" });
  });

  // Длань Кхорна (wdbc-1rno): «стрелковые атаки этой рукой автоматически
  // проваливаются» — forceFail игнорирует и удачный бросок, и forceHit,
  // старше даже Распыления (проверяется тем же порядком if-цепочки).
  it("Длань Кхорна (forceFail) — провал даже на удачном броске", () => {
    expect(attackHitOutcome({ rv: 5, threshold: 90, wp: {}, forceFail: true }))
      .toEqual({ success: false, deg: 1, auto: "forceFail" });
  });

  it("forceFail старше forceHit — беспомощная цель не спасает бронзовую руку от провала", () => {
    expect(attackHitOutcome({ rv: 5, threshold: 90, wp: {}, forceHit: true, forceFail: true }).success).toBe(false);
  });

  it("forceFail старше Распыления", () => {
    expect(attackHitOutcome({ rv: 5, threshold: 90, wp: { spray: true }, forceFail: true }))
      .toEqual({ success: false, deg: 1, auto: "forceFail" });
  });

  it("fixedSuccessDeg (Локус Неизбежности) старше forceFail — тот же порядок, что и Распыления", () => {
    expect(attackHitOutcome({ rv: 5, threshold: 90, wp: {}, forceFail: true, fixedSuccessDeg: 1 }).auto).toBe("fixed");
  });
});

describe("sprayJamFace", () => {
  it("обычное Распыление клинит только на 9", () => {
    expect(sprayJamFace({ reliabilityScore: 0 })).toBe(9);
  });

  it("Ненадёжное и хуже — на 8-9", () => {
    expect(sprayJamFace({ reliabilityScore: -1 })).toBe(8);
    expect(sprayJamFace({ reliabilityScore: -2 })).toBe(8);
  });

  it("Надёжное и лучше не клинит вовсе", () => {
    expect(sprayJamFace({ reliabilityScore: 1 })).toBeNull();
    expect(sprayJamFace({ reliabilityScore: 2 })).toBeNull();
  });

  // Найдено живой проверкой (wdbc-8n2c): книга называет грани «9» и «8-9», а
  // не «9+» — там, где имеется в виду «и выше», она пишет диапазон до десятки
  // (Выгорание «7-10»). Первая версия сравнивала через >= и клинила на 10.
  it("выпавшая десятка Распыление НЕ заклинивает", () => {
    expect(sprayJams(10, { reliabilityScore: 0 })).toBe(false);
    expect(sprayJams(10, { reliabilityScore: -1 })).toBe(false);
  });

  it("названные книгой грани клинят", () => {
    expect(sprayJams(9, { reliabilityScore: 0 })).toBe(true);
    expect(sprayJams(8, { reliabilityScore: 0 })).toBe(false);
    expect(sprayJams(8, { reliabilityScore: -1 })).toBe(true);
    expect(sprayJams(9, { reliabilityScore: -1 })).toBe(true);
    expect(sprayJams(9, { reliabilityScore: 1 })).toBe(false);
  });

  it("это не тот же порог, что общий клин по d100", () => {
    expect(jamThreshold({ reliabilityScore: -1 })).toBe(91);
  });
});

// ── Сквозной прогон атаки ───────────────────────────────────────────────────

describe("атака оружием с Распылением", () => {
  it("провальный бросок всё равно даёт попадание и урон", async () => {
    const weapon = weaponFor({ range: 20, weaponProps: flamerProps() });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [77, 6];   // d100 «провал» по порогу 45, d10 урона

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain("Авто-попадание (Распыление)");
    expect(card()).not.toContain("Промах");
    // Место попадания по-прежнему читается реверсом d100 (77 → 77): бросок
    // катается ради ChatMessage, и локацию по-прежнему берут из него.
    expect(hits()).toEqual([{ index: 1, damage: 11, location: "П. Нога" }]);
  });

  it("карточка не показывает Порог и Бросок — они ни на что не влияли", async () => {
    const weapon = weaponFor({ range: 20, weaponProps: flamerProps() });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [77, 6];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).not.toContain("<label>Порог</label>");
    expect(card()).not.toContain("<label>Бросок</label>");
    expect(card()).toContain("конус 30°, 20м");
  });

  it("цель по-прежнему получает свою кнопку теста на отмену (wdbc-p06s)", async () => {
    const weapon = weaponFor({ range: 20, weaponProps: flamerProps() });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [77, 6];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain("wh-spray-cancel-btn");
  });

  it("натуральные 96-100 не печатают Критический Провал: броска атаки не было", async () => {
    const weapon = weaponFor({ range: 20, weaponProps: flamerProps() });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [99, 6];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).not.toContain("Критический Провал");
    expect(hits()).toHaveLength(1);
  });
});

describe("клин Распыления (стр. 168)", () => {
  it("девятка на первом кубике урона клинит оружие, но попадание в силе", async () => {
    const weapon = weaponFor({ range: 20, weaponProps: flamerProps() });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [50, 9];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(weapon.system.jammed).toBe(true);
    expect(card()).toContain("Оружие заклинило");
    expect(hits()).toEqual([{ index: 1, damage: 14, location: "Голова" }]);   // 50 → реверс 05
  });

  it("десятка на первом кубике урона не клинит (грань 9, не «9 и выше»)", async () => {
    const weapon = weaponFor({ range: 20, weaponProps: flamerProps() });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [50, 10, 3];   // третий куб — d5 Экстремального урона от десятки

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(weapon.system.jammed).toBe(false);
    expect(hits()).toHaveLength(1);
  });

  it("восьмёрка обычное Распыление не клинит", async () => {
    const weapon = weaponFor({ range: 20, weaponProps: flamerProps() });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [50, 8];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(weapon.system.jammed).toBe(false);
  });

  it("Ненадёжное Распыление клинит и на восьмёрке", async () => {
    const weapon = weaponFor({ range: 20, weaponProps: flamerProps([{ key: "unreliable", rating: 0, rating2: 0 }]) });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [50, 8];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(weapon.system.jammed).toBe(true);
  });

  it("Надёжное Распыление не клинит даже на девятке", async () => {
    const weapon = weaponFor({ range: 20, weaponProps: flamerProps([{ key: "reliable", rating: 0, rating2: 0 }]) });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [50, 9];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(weapon.system.jammed).toBe(false);
  });

  it("высокий d100 больше не выбрасывает атаку Ненадёжного Распыления клином по броску", async () => {
    const weapon = weaponFor({ range: 20, weaponProps: flamerProps([{ key: "unreliable", rating: 0, rating2: 0 }]) });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [95, 6];   // 95 ≥ 91 — прежний порог клина по d100

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain("Авто-попадание (Распыление)");
    expect(hits()).toHaveLength(1);
    expect(weapon.system.jammed).toBe(false);
  });
});
