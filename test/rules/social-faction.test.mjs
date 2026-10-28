// test/rules/social-faction.test.mjs
//
// Выбор фракции собеседника в окне броска социального Навыка (Sahara task-240a):
// собеседник без токена-цели. Выбранный ключ уходит в ctx.socialFaction, и Связи,
// Хорошая Репутация, Враг и переброс Ненависти работают без токена.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  socialTalentFactionRefs, socialFactionPickerShown, socialFactionOptions, withSocialFaction
} from "../../module/rules/social-faction.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import { factionTarget, raceTarget } from "../../module/rules/talent-targets.mjs";
import { setFactionIndex, clearFactionIndex, getFactionIndex } from "../../module/rules/factions.mjs";

const TREE = [
  { key: "imperium", name: "Империум" },
  { key: "inquisition", name: "Инквизиция", parent: "imperium" },
  { key: "ordo-xenos", name: "Ордо Ксенос", parent: "inquisition" },
  { key: "chaos", name: "Хаос" }
];
beforeEach(() => setFactionIndex(TREE));
afterEach(() => clearFactionIndex());

const talent = (name, targets = [], system = {}) => ({ type: "talent", name, system: { targets, ...system } });
const INQ = factionTarget({ key: "inquisition", name: "Инквизиция" });
const CHAOS = factionTarget({ key: "chaos", name: "Хаос" });
const actorWith = (...items) => ({ items, system: {} });
const social = (extra = {}) => ({ kind: "skill", skill: "charm", char: "fel", ...extra });

describe("socialTalentFactionRefs", () => {
  it("собирает ключи фракций из Связей, Репутации, Врага и Ненависти без повторов", () => {
    const a = actorWith(
      talent("Peer / Связи", [INQ]),
      talent("Good Reputation / Хорошая Репутация", [INQ]),
      talent("Enemy / Враг", [CHAOS], { hasRating: true, rating: 1 }),
      talent("Hatred / Ненависть", [raceTarget("ork"), CHAOS])
    );
    expect(socialTalentFactionRefs(a)).toEqual(["inquisition", "chaos"]);
  });

  it("цели других видов (раса, признак) фракциями не считаются; Талантов нет — пусто", () => {
    expect(socialTalentFactionRefs(actorWith(talent("Hatred / Ненависть", [raceTarget("ork")])))).toEqual([]);
    expect(socialTalentFactionRefs(actorWith())).toEqual([]);
  });
});

describe("socialFactionPickerShown", () => {
  const a = actorWith(talent("Peer / Связи", [INQ]));

  it("социальный Навык, токена-цели нет, есть Талант с фракцией — показывать", () => {
    expect(socialFactionPickerShown(a, social())).toBe(true);
  });
  it("не социальный Навык — нет", () => {
    expect(socialFactionPickerShown(a, social({ skill: "awareness" }))).toBe(false);
    expect(socialFactionPickerShown(a, { kind: "characteristic", char: "fel" })).toBe(false);
  });
  it("токен-цель уже выбран — работает обычный путь, выбор не нужен", () => {
    expect(socialFactionPickerShown(a, social({ targetActor: { system: {}, items: [] } }))).toBe(false);
  });
  it("нет Талантов, которым выбор что-то даёт — не загромождать окно", () => {
    expect(socialFactionPickerShown(actorWith(), social())).toBe(false);
  });
});

describe("socialFactionOptions", () => {
  it("свои фракции Талантов — отдельным списком; весь каталог — по алфавиту с отступом по глубине", () => {
    const a = actorWith(talent("Peer / Связи", [INQ]));
    const { own, all } = socialFactionOptions(a, getFactionIndex());
    expect(own).toEqual([{ key: "inquisition", label: "Инквизиция" }]);
    expect(all.map(o => o.key)).toEqual(["imperium", "inquisition", "ordo-xenos", "chaos"].sort((x, y) =>
      TREE.find(f => f.key === x).name.localeCompare(TREE.find(f => f.key === y).name, "ru")));
    expect(all.find(o => o.key === "imperium").label).toBe("Империум");
    expect(all.find(o => o.key === "ordo-xenos").label).toBe("— — Ордо Ксенос");
  });
});

describe("withSocialFaction + resolveTest: бонусы работают без токена", () => {
  const a = actorWith(
    talent("Peer / Связи", [INQ]),
    talent("Good Reputation / Хорошая Репутация", [INQ]),
    talent("Enemy / Враг", [CHAOS], { hasRating: true, rating: 2 })
  );
  const total = ctx => resolveTest({ actor: { type: "character", ...a }, ...ctx }).autoMods.reduce((s, m) => s + (Number(m.value) || 0), 0);

  it("без выбора и без токена — никаких бонусов", () => {
    expect(total(social())).toBe(0);
  });

  it("собеседник из Ордо Ксенос (внутри Инквизиции): Связи +10 и Репутация +10", () => {
    expect(total(withSocialFaction(social(), "ordo-xenos"))).toBe(20);
  });

  it("собеседник из Хаоса: Враг ур. 2 даёт −20", () => {
    expect(total(withSocialFaction(social(), "chaos"))).toBe(-20);
  });

  it("чужая фракция — ничего; «никакой» снимает выбор", () => {
    expect(total(withSocialFaction(social(), "imperium"))).toBe(0);
    const picked = withSocialFaction(social(), "chaos");
    expect(withSocialFaction(picked, "").socialFaction).toBeUndefined();
    expect(picked.socialFaction).toBe("chaos");
  });

  it("не социальный Навык выбор игнорирует (область social)", () => {
    expect(total(withSocialFaction(social({ skill: "awareness" }), "ordo-xenos"))).toBe(0);
  });

  it("исходный ctx не мутируется", () => {
    const base = social();
    withSocialFaction(base, "chaos");
    expect(base.socialFaction).toBeUndefined();
  });
});
