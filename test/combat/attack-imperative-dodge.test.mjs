// test/combat/attack-imperative-dodge.test.mjs
//
// wdbc-yu32: активный Императив цели (module/rules/imperative.mjs) добавляет
// плоский бонус/штраф к dodgeMod карточки атаки — суммируется с базовым
// модификатором Карабина/рукопашной стрельбы (wdbc-z56a), не заменяет его.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
function dodgeExtraMod() {
  const m = card().match(/wh-dodge-btn"[^>]*data-extra-mod="(-?\d+)"/);
  return m ? Number(m[1]) : null;
}
// wdbc-hdxj: значение, которое кнопка Уклонения несёт для случая «планирую
// Отскочить в укрытие» — читает hooks.mjs::.wh-dodge-btn при отмеченном
// .wh-recoil-plan-checkbox вместо обычного data-extra-mod.
function dodgeExtraModRecoil() {
  const m = card().match(/data-extra-mod-recoil="(-?\d+)"/);
  return m ? Number(m[1]) : null;
}
const hasRecoilPlanCheckbox = () => card().includes("wh-recoil-plan-checkbox");

/** Актор с активным носителем Императива (тем же флагом, что module/rules/imperative.mjs). */
function imperativeCarrier(bonuses) {
  return { id: "carrier", type: "trait", getFlag: (s, k) => (k === "imperativeCarrier" ? true : k === "imperativeBonuses" ? bonuses : undefined) };
}

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Императив цели (wdbc-yu32): бонус/штраф к Уклонению в карточке атаки", () => {
  it("нет активного Императива у цели — бонус 0", async () => {
    const weapon = weaponFor();
    const attacker = actorFor({ items: [weapon] });
    const defender = actorFor();
    setTargets([defender]);
    captured.dice = [10, 5];
    await _executeAttackRoll(attacker, weapon, "bs", 45, "single", null, {});
    expect(dodgeExtraMod()).toBe(0);
  });

  it("Императив Избегания активен у цели — +30 к Уклонению", async () => {
    const weapon = weaponFor();
    const attacker = actorFor({ items: [weapon] });
    const defender = actorFor({ items: [imperativeCarrier({ evasionBonus: 30 })] });
    setTargets([defender]);
    captured.dice = [10, 5];
    await _executeAttackRoll(attacker, weapon, "bs", 45, "single", null, {});
    expect(dodgeExtraMod()).toBe(30);
  });

  it("Императив Крепости активен у цели — суммируется со штрафом от рукопашной стрельбы Карабином", async () => {
    const weapon = weaponFor({ weaponProps: [{ key: "carbine" }] });
    const attacker = actorFor({ items: [weapon] });
    const defender = actorFor({ items: [imperativeCarrier({ evasionBonus: -30 })] });
    setTargets([defender]);
    captured.dice = [10, 5];
    await _executeAttackRoll(attacker, weapon, "bs", 45, "single", null, { meleeShot: true });
    expect(dodgeExtraMod()).toBe(-20); // Карабин +10, Императив −30 → −20
  });
});

// wdbc-hdxj: Evasion/Fortress Imperative переворачивают знак СПЕЦИАЛЬНО для
// Отскока в укрытие («+30 на Избегания, КРОМЕ Отскока в укрытие −20», и
// наоборот у Fortress) — движок не может подставить это ПОСТ-ФАКТУМ (выбор
// «нивелировать/Отскочить» происходит уже ПОСЛЕ теста Уклонения), поэтому
// карточка атаки несёт ОБА значения заранее: обычное (data-extra-mod) и
// recoil-специфичное (data-extra-mod-recoil), а декларация «планирую
// Отскочить в укрытие?» — чекбокс .wh-recoil-plan-checkbox, который
// hooks.mjs::.wh-dodge-btn читает ДО броска (см. imperative-bonuses.test.mjs
// для самой арифметики planningRecoil).
describe("Императив Избегания/Крепости (wdbc-hdxj): декларация «планирую Отскочить в укрытие?» в карточке Уклонения", () => {
  it("(а) нет активного Императива у цели — чекбокс декларации не рендерится", async () => {
    const weapon = weaponFor();
    const attacker = actorFor({ items: [weapon] });
    const defender = actorFor();
    setTargets([defender]);
    captured.dice = [10, 5];
    await _executeAttackRoll(attacker, weapon, "bs", 45, "single", null, {});
    expect(hasRecoilPlanCheckbox()).toBe(false);
    // Кнопка всё равно несёт data-extra-mod-recoil как safety-фолбэк (равный
    // обычному значению) — без чекбокса hooks.mjs его никогда не прочитает,
    // но это не то же самое, что recoil-специфичный знак Императива.
    expect(dodgeExtraModRecoil()).toBe(dodgeExtraMod());
  });

  it("(а) активный Императив без evasionRecoilBonus (не Evasion/Fortress) — чекбокс тоже не рендерится", async () => {
    const weapon = weaponFor();
    const attacker = actorFor({ items: [weapon] });
    const defender = actorFor({ items: [imperativeCarrier({ evasionBonus: 10 })] });
    setTargets([defender]);
    captured.dice = [10, 5];
    await _executeAttackRoll(attacker, weapon, "bs", 45, "single", null, {});
    expect(hasRecoilPlanCheckbox()).toBe(false);
  });

  it("(б) активный Императив Избегания у цели — чекбокс декларации рендерится", async () => {
    const weapon = weaponFor();
    const attacker = actorFor({ items: [weapon] });
    const defender = actorFor({ items: [imperativeCarrier({ evasionBonus: 30, evasionRecoilBonus: -20 })] });
    setTargets([defender]);
    captured.dice = [10, 5];
    await _executeAttackRoll(attacker, weapon, "bs", 45, "single", null, {});
    expect(hasRecoilPlanCheckbox()).toBe(true);
  });

  it("(б) активный Императив Крепости у цели — чекбокс декларации рендерится", async () => {
    const weapon = weaponFor();
    const attacker = actorFor({ items: [weapon] });
    const defender = actorFor({ items: [imperativeCarrier({ evasionBonus: -30, evasionRecoilBonus: 20 })] });
    setTargets([defender]);
    captured.dice = [10, 5];
    await _executeAttackRoll(attacker, weapon, "bs", 45, "single", null, {});
    expect(hasRecoilPlanCheckbox()).toBe(true);
  });

  it("(в) отмеченный чекбокс (data-extra-mod-recoil) даёт ПРОТИВОПОЛОЖНЫЙ знак — Императив Избегания: −20 вместо +30", async () => {
    const weapon = weaponFor();
    const attacker = actorFor({ items: [weapon] });
    const defender = actorFor({ items: [imperativeCarrier({ evasionBonus: 30, evasionRecoilBonus: -20 })] });
    setTargets([defender]);
    captured.dice = [10, 5];
    await _executeAttackRoll(attacker, weapon, "bs", 45, "single", null, {});
    expect(dodgeExtraModRecoil()).toBe(-20);
  });

  it("(в) отмеченный чекбокс даёт ПРОТИВОПОЛОЖНЫЙ знак — Императив Крепости: +20 вместо −30", async () => {
    const weapon = weaponFor();
    const attacker = actorFor({ items: [weapon] });
    const defender = actorFor({ items: [imperativeCarrier({ evasionBonus: -30, evasionRecoilBonus: 20 })] });
    setTargets([defender]);
    captured.dice = [10, 5];
    await _executeAttackRoll(attacker, weapon, "bs", 45, "single", null, {});
    expect(dodgeExtraModRecoil()).toBe(20);
  });

  it("(г) не отмеченный чекбокс — обычное значение (data-extra-mod) не меняется активным Императивом", async () => {
    const weapon = weaponFor();
    const attacker = actorFor({ items: [weapon] });
    const defender = actorFor({ items: [imperativeCarrier({ evasionBonus: 30, evasionRecoilBonus: -20 })] });
    setTargets([defender]);
    captured.dice = [10, 5];
    await _executeAttackRoll(attacker, weapon, "bs", 45, "single", null, {});
    expect(dodgeExtraMod()).toBe(30);
  });

  it("recoil-значение суммируется с базовым модификатором (Карабин в рукопашной), как и обычное", async () => {
    const weapon = weaponFor({ weaponProps: [{ key: "carbine" }] });
    const attacker = actorFor({ items: [weapon] });
    const defender = actorFor({ items: [imperativeCarrier({ evasionBonus: -30, evasionRecoilBonus: 20 })] });
    setTargets([defender]);
    captured.dice = [10, 5];
    await _executeAttackRoll(attacker, weapon, "bs", 45, "single", null, { meleeShot: true });
    expect(dodgeExtraMod()).toBe(-20);       // Карабин +10, Крепость −30 → −20 (как раньше)
    expect(dodgeExtraModRecoil()).toBe(30);  // Карабин +10, Крепость recoil +20 → +30
  });
});
