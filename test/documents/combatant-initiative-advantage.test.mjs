// test/documents/combatant-initiative-advantage.test.mjs
//
// wdbc-0tzr: Серый Человек/Oteshii кидает боевую Инициативу трижды и берёт
// лучший результат — механизм ОТДЕЛЬНЫЙ от Inf-Преимущества Эльданара
// (test/apps/creation.test.mjs), см. заголовок module/documents/combatant.mjs.
//
// wdbc-yqh: до этого теста на уровне WarhammerCombatant проверялась только
// «трёхбросковая» capability (INITIATIVE_ADVANTAGE_CAPABILITY, раса). Талант
// «Молниеносные Рефлексы» (INITIATIVE_EXTRA_ROLL_CAPABILITY, +1 к базовому —
// module/rules/initiative.mjs::initiativeRolls, wdbc-7zzr) был проверен там же
// на уровне initiativeRolls(), но не сквозь весь путь до формулы кубика в
// боевом трекере — а именно там баг и жил у 8 акторов Бестиария: embedded-
// копия Таланта не несла capability вовсе (флаги были пустые), и трекер
// бросал Инициативу один раз вместо двух. Добавлены проверки именно этого
// пути — Талант в одиночку (2 броска) и Талант вместе с расовой capability
// (4 броска, как в Книге Аэльдари).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { WarhammerCombatant, applyInitiativeAdvantage,
         INITIATIVE_ADVANTAGE_CAPABILITY } from "../../module/documents/combatant.mjs";
import { INITIATIVE_EXTRA_ROLL_CAPABILITY } from "../../module/rules/initiative.mjs";

beforeEach(resetCaptured);

describe("applyInitiativeAdvantage: подмена кубика формулы на «kh» (wdbc-0tzr)", () => {
  it("«1d10 + @initiative + @initiativeMod» → «3d10kh1 + …», N по умолчанию 3", () => {
    expect(applyInitiativeAdvantage("1d10 + @initiative + @initiativeMod"))
      .toBe("3d10kh1 + @initiative + @initiativeMod");
  });

  it("количество бросков настраивается явно", () => {
    expect(applyInitiativeAdvantage("1d10", 2)).toBe("2d10kh1");
  });

  it("подряд идущий кубик считается по count×rolls, а не отбрасывается", () => {
    expect(applyInitiativeAdvantage("2d10 + @mod", 3)).toBe("6d10kh1 + @mod");
  });
});

/**
 * @param {boolean|string[]} capabilities `true`/`false` — старый вид вызова,
 *   только расовая INITIATIVE_ADVANTAGE_CAPABILITY (обратная совместимость с
 *   тестами wdbc-0tzr); массив ключей — произвольный набор capability на
 *   один предмет-Талант/Черту, как приходят от нескольких источников сразу.
 */
function combatantOf(capabilities) {
  const keys = capabilities === true ? [INITIATIVE_ADVANTAGE_CAPABILITY]
    : capabilities === false ? []
    : capabilities;
  const traitItems = keys.map((key, i) => ({
    id: `trait${i}`, type: "trait",
    flags: { "warhammer-dbc": { mechanics: [{ id: `g${i}`, operator: "AND", entries: [
      { id: `e${i}`, kind: "capability", capabilityKey: key, label: "" }
    ] }] } }
  }));
  const actor = {
    items: Object.assign([...traitItems], { contents: traitItems }),
    getRollData: () => ({})
  };
  const c = Object.create(WarhammerCombatant.prototype);
  Object.defineProperty(c, "actor", { value: actor });
  c._getInitiativeFormula = () => "1d10 + @initiative + @initiativeMod";
  return c;
}

describe("WarhammerCombatant.getInitiativeRoll (wdbc-0tzr)", () => {
  it("без capability — обычная формула, без изменений", () => {
    const roll = combatantOf(false).getInitiativeRoll();
    expect(roll.formula).toBe("1d10 + @initiative + @initiativeMod");
  });

  it("с capability combat.initiativeAdvantage — формула подменяется на «kh»", () => {
    const roll = combatantOf(true).getInitiativeRoll();
    expect(roll.formula).toBe("3d10kh1 + @initiative + @initiativeMod");
  });

  it("явно переданная формула (override) тоже проходит через подмену", () => {
    const roll = combatantOf(true).getInitiativeRoll("1d10 + 5");
    expect(roll.formula).toBe("3d10kh1 + 5");
  });

  // wdbc-yqh: «Молниеносные Рефлексы» книга описывает как «2 броска, больший»
  // — не 3. Даёт capability INITIATIVE_EXTRA_ROLL_CAPABILITY (+1 к базовому
  // броску), а не расовую INITIATIVE_ADVANTAGE_CAPABILITY (+2). Баг был
  // именно в том, что 8 акторов Бестиария несли Талант вовсе БЕЗ capability
  // (embedded-копия отставала от библиотечной записи) — трекер бросал раз, а
  // не два. Проверяем весь путь: capability → формула кубика.
  it("Молниеносные Рефлексы (INITIATIVE_EXTRA_ROLL_CAPABILITY) — 2 броска, не 3", () => {
    const roll = combatantOf([INITIATIVE_EXTRA_ROLL_CAPABILITY]).getInitiativeRoll();
    expect(roll.formula).toBe("2d10kh1 + @initiative + @initiativeMod");
  });

  it("Молниеносные Рефлексы + расовая capability вместе — 4 броска (Книга Аэльдари)", () => {
    const roll = combatantOf([INITIATIVE_ADVANTAGE_CAPABILITY, INITIATIVE_EXTRA_ROLL_CAPABILITY])
      .getInitiativeRoll();
    expect(roll.formula).toBe("4d10kh1 + @initiative + @initiativeMod");
  });

  it("итог броска действительно берёт больший из трёх d10 (сквозная проверка через заглушку Roll)", async () => {
    // Заглушка Roll не разбирает @-переменные (rollData) — override без них,
    // сама подстановка @initiative/@initiativeMod уже покрыта тестами выше.
    const roll = combatantOf(true).getInitiativeRoll("1d10");
    captured.dice = [3, 9, 5]; // из трёх d10 лучший — 9
    await roll.evaluate();
    expect(roll.total).toBe(9);
  });
});
