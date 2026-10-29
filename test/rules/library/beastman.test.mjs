// test/rules/library/beastman.test.mjs
//
// Сверка расы Зверолюд с корбуком (глава I). Перенесено из PR #528 (64a4c51c7),
// адаптировано к реализации main: Natural Weapons выбираются по integralPreset
// записи расы, Отвращение к Порядку — возможность order.rejectsBionics и
// rules/aversion-to-order.mjs (штраф считается от числа установленных
// имплантов). Дополняет test/rules/aversion-to-order*.test.mjs и др.

import { describe, it, expect } from "vitest";
import "../../support/foundry-stub.mjs";
import { packDocById } from "../../support/pack-doc.mjs";
import { resolveTest } from "../../../module/rules/resolve-test.mjs";
import { hasRuleFlag } from "../../../module/rules/flags.mjs";
import { resolveAptitudeOverride } from "../../../module/rules/aptitude-overrides.mjs";
import { skillAdvanceCat } from "../../../module/rules/advance-category.mjs";
import { GROUP_SKILLS_DEF } from "../../../module/constants/skills.mjs";
import { presetIntegralChoice } from "../../../module/rules/integral-rating.mjs";

const RACE = packDocById("packs-src/races/Люди", "aCWwJQUQSDbx1uEo");
const AVERSION = packDocById("packs-src/traits", "6v1NUWCYIc2Oosi8");
const CLOVEN = packDocById("packs-src/traits", "NOaPE0AYhvLGTVPI");
const STEP = packDocById("packs-src/traits", "PeUg4uJnrciYPkK8");
const NATURAL = packDocById("packs-src/traits", "SvLCLe1hbxSaWy3s");

const entries = doc => doc.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
const actorWith = items => ({ system: { race: "beastman", characteristics: {}, conditions: {}, aptitudes: [] }, items });

describe("раса Зверолюд против книги", () => {

  it("Естественное Оружие: Рога, Укус, Когти, Копыта выбираются сами", () => {
    const preset = entries(RACE).find(e => (e.sourceName || "").startsWith("Natural Weapons")).integralPreset;
    const ids = presetIntegralChoice(NATURAL.flags["warhammer-dbc"].mechanics, preset);
    const names = entries(NATURAL).filter(e => ids.includes(e.id)).map(e => e.equipSourceName.split(" ")[0]);
    expect(names.sort()).toEqual(["Bite", "Claws", "Hooves", "Horns"]);
    expect(presetIntegralChoice(NATURAL.flags["warhammer-dbc"].mechanics, "")).toBeNull();
  });
});

describe("Черты Зверолюда", () => {
  it("Отвращение к Порядку: Lore и Trade — Враждебные, сильнее «всегда Дружественных»", () => {
    const a = actorWith([AVERSION]);
    expect(resolveAptitudeOverride(a, "skill", "Ремесло", "trade")).toBe("enemy");
    expect(skillAdvanceCat(a, GROUP_SKILLS_DEF.trade, { group: "trade" }, new Set())).toBe("enemy");
    expect(skillAdvanceCat(a, GROUP_SKILLS_DEF.commonLore, { group: "commonLore" }, new Set())).toBe("enemy");
    expect(skillAdvanceCat(actorWith([]), GROUP_SKILLS_DEF.trade, { group: "trade" }, new Set())).toBe("ally");
    expect(hasRuleFlag(a, "order.rejectsBionics")).toBe(true);
  });

  it("Копытный: +20 в тесте Трудного Ландшафта, Sprint — Дружественный", () => {
    const a = actorWith([CLOVEN]);
    const t = resolveTest({ actor: a, kind: "skill", char: "ag", terrain: true });
    expect(t.mods.concat(t.autoMods).some(m => m.value === 20)).toBe(true);
    expect(resolveAptitudeOverride(a, "talent", "Sprint / Спринт")).toBe("ally");
    expect(resolveAptitudeOverride(a, "talent", "Frenzy / Бешенство")).toBeNull();
  });

  it("Пасынки Богов: мутации как у Астартес, один кубик, максимум Бесчестия −1", () => {
    const a = actorWith([STEP]);
    expect(hasRuleFlag(a, "mutations.asAstartes")).toBe(true);
    expect(hasRuleFlag(a, "mutation.singleDie")).toBe(true);
    expect(entries(STEP).find(e => e.kind === "poolMax")).toMatchObject({ poolTarget: "infamy", value: "-1" });
  });
});
