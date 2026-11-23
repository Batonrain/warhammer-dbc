// test/rules/twin-spirit.test.mjs
// Лист демона Двойного Духа (Sahara 577-02de, 577-18eb, 585-…): числа, которых
// у хоста нет, берутся с Актора-демона (rules/twin-spirit.mjs).
import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import {
  twinDemonOf, twinDemonStats, controlTime, sharedSlaughterThreshold, sharedSlaughterOffered,
  auraOfChaosRating, auraOfChaosPhenomenon, introspectionBonus, introspectionThresholds, introspectionExtraGift,
  sharedSorceryAvailable, sharedSorceryMark, mentorChoices, mentorSkillRestore, greaterPossessedInf,
  demonAscensionUpdate, manifestTraitPlan, manifestTraitDiff, MANIFEST_GRANT_FLAG, demonLoci, locusRadius,
  symbioteLocusActive, isManifestedPossessed
} from "../../module/rules/twin-spirit.mjs";
import { auraAffects } from "../../module/regions/auras.mjs";

const ch = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { total: v }]));
const demon = (extra = {}) => ({
  uuid: "Actor.d1", name: "Кровопускатель", type: "daemon",
  system: { characteristics: ch({ ws: 50, bs: 25, wp: 38, inf: 22 }), psyker: { rating: 0 }, wounds: { value: 18, max: 18 },
    rank: "lesser", skills: { parry: { rank: "expert" }, dodge: { rank: "knows" }, athletics: { rank: "trained" } } },
  items: [
    { id: "t1", type: "talent", name: "Frenzy / Бешенство" },
    { id: "t2", type: "talent", name: "Ambidextrous / Обоерукий" },
    { id: "l1", uuid: "Actor.d1.Item.l1", type: "trait", name: "Locus of Wrath / Локус Гнева" },
    { id: "p1", type: "psychicPower", name: "Smite", system: { action: "half" } }
  ],
  ...extra
});
const host = ({ manifested = true, items = [], possession = {}, chars = { ws: 40, bs: 45, wp: 35, inf: 70 }, skills = {} } = {}) => ({
  type: "character", uuid: "Actor.h1",
  system: { possessed: true, possession: { manifested, demonUuid: "Actor.d1", demon: "bloodletter", ...possession },
    characteristics: ch(chars), skills, groupSkills: {} },
  items, flags: {}
});
const gift = n => ({ type: "talent", name: `X / Дар: ${n}` });
const talent = n => ({ type: "talent", name: n });

describe("лист демона: связь и числа", () => {
  it("хост находит демона по uuid; без ссылки — null", () => {
    const d = demon();
    expect(twinDemonOf(host(), u => (u === "Actor.d1" ? d : null))).toBe(d);
    expect(twinDemonOf(host({ possession: { demonUuid: "" } }), () => d)).toBe(null);
  });
  it("числа демона: WS/BS/W/Inf/пси-рейтинг/Раны", () => {
    expect(twinDemonStats(demon())).toMatchObject({ ws: 50, bs: 25, wp: 38, wpBonus: 3, inf: 22, psyRating: 0, wounds: { value: 18, max: 18 } });
    expect(twinDemonStats(null)).toBe(null);
  });
  it("время контроля: 10−W.b хоста, без предела при W демона выше", () => {
    expect(controlTime(35, 38)).toEqual({ hours: 7, unlimited: true });
    expect(controlTime(45, 38)).toEqual({ hours: 6, unlimited: false });
    expect(controlTime(95, null)).toEqual({ hours: 1, unlimited: false });
  });
});

describe("Общая Бойня: переброс меньшим WS/BS", () => {
  it("демон ниже — Предел падает на разницу", () => {
    expect(sharedSlaughterThreshold(55, "bs", host(), demon())).toMatchObject({ threshold: 35, lower: 25 });
  });
  it("хост ниже — Предел прежний", () => {
    expect(sharedSlaughterThreshold(50, "ws", host(), demon())).toMatchObject({ threshold: 50, lower: 40 });
  });
  it("только WS/BS и только с листом демона", () => {
    expect(sharedSlaughterThreshold(50, "s", host(), demon())).toBe(null);
    expect(sharedSlaughterThreshold(50, "ws", host(), null)).toBe(null);
  });
  it("предлагается на промахе в Проявлении с Талантом, раз в Ход, не на перебросе", () => {
    const h = host({ items: [talent("Shared Slaughter / Общая Бойня")] });
    const base = { charKey: "ws", rv: 70, threshold: 50, demon: demon() };
    expect(sharedSlaughterOffered(h, base)).toBe(true);
    expect(sharedSlaughterOffered(h, { ...base, rv: 30 })).toBe(false);
    expect(sharedSlaughterOffered(h, { ...base, rerolled: true })).toBe(false);
    expect(sharedSlaughterOffered(h, { ...base, turnAvailable: false })).toBe(false);
    expect(sharedSlaughterOffered(host({ manifested: false, items: h.items }), base)).toBe(false);
    expect(sharedSlaughterOffered(host(), base)).toBe(false);
  });
});

describe("Аура Хаоса: щит 1-W демона, Феномен на дубле", () => {
  it("рейтинг = W демона в Проявлении с Даром", () => {
    expect(auraOfChaosRating(host({ items: [gift("Аура Хаоса")] }), demon())).toBe(38);
    expect(auraOfChaosRating(host({ manifested: false, items: [gift("Аура Хаоса")] }), demon())).toBe(0);
    expect(auraOfChaosRating(host({ items: [gift("Аура Хаоса")] }), null)).toBe(0);
  });
  it("Феномен — дубль при успешном броске щита", () => {
    expect(auraOfChaosPhenomenon(22, true)).toBe(true);
    expect(auraOfChaosPhenomenon(22, false)).toBe(false);
    expect(auraOfChaosPhenomenon(23, true)).toBe(false);
    expect(auraOfChaosPhenomenon(100, true)).toBe(false);
  });
});

describe("Интроспекция", () => {
  const withLore = rank => {
    const h = host({ items: [talent("Introspection / Интроспекция")], skills: { charm: { total: 40 }, logic: { total: 30 } } });
    h.system.groupSkills = { forbiddenLore: [{ specialty: "Daemons", rank }] };
    return h;
  };
  it("бонус = бонус Навыка Forbidden Lore (Daemons)", () => {
    expect(introspectionBonus(withLore("trained"))).toBe(10);
    expect(introspectionBonus(withLore("expert"))).toBe(30);
    expect(introspectionBonus(host())).toBe(0);
  });
  it("пороги: Charm/Logic хоста + бонус против W демона", () => {
    expect(introspectionThresholds(withLore("veteran"), demon(), "charm")).toEqual({ skill: "charm", host: 60, demon: 38 });
    expect(introspectionThresholds(withLore("veteran"), demon(), "logic")).toMatchObject({ host: 50 });
  });
  it("доп. Дар держится только в Проявлении", () => {
    const h = host();
    h.flags = { "warhammer-dbc": { introspectionGift: true } };
    expect(introspectionExtraGift(h)).toBe(1);
    h.system.possession.manifested = false;
    expect(introspectionExtraGift(h)).toBe(0);
  });
});

describe("Общее Колдовство: раз в Раунд и простой", () => {
  it("свободное — раз в Раунд", () => {
    const m = sharedSorceryMark("free", 3, "c");
    expect(sharedSorceryAvailable(m, 3, "c")).toBe(false);
    expect(sharedSorceryAvailable(m, 4, "c")).toBe(true);
  });
  it("полудействие — простой 1 Раунд, полное — 3", () => {
    expect(sharedSorceryAvailable(sharedSorceryMark("half", 3, "c"), 4, "c")).toBe(false);
    expect(sharedSorceryAvailable(sharedSorceryMark("half", 3, "c"), 5, "c")).toBe(true);
    expect(sharedSorceryAvailable(sharedSorceryMark("full", 3, "c"), 6, "c")).toBe(false);
    expect(sharedSorceryAvailable(sharedSorceryMark("full", 3, "c"), 7, "c")).toBe(true);
  });
  it("простой не переживает бой: другой бой или старая метка без combatId не держат", () => {
    expect(sharedSorceryAvailable(sharedSorceryMark("full", 3, "c"), 4, "other")).toBe(true);
    expect(sharedSorceryAvailable({ round: 3, lockUntil: 6 }, 4, "c")).toBe(true);
  });
  it("вне боя ограничений нет", () => {
    expect(sharedSorceryAvailable(sharedSorceryMark("full", 3, "c"), null)).toBe(true);
  });
});

describe("Ментор", () => {
  it("предлагает Таланты, которых нет, и Навыки, где демон сильнее", () => {
    const h = host({ items: [talent("Frenzy / Бешенство")], skills: { parry: { rank: "trained" }, athletics: { rank: "trained" } } });
    const c = mentorChoices(h, demon());
    expect(c.talents.map(t => t.id)).toEqual(["t2"]);
    expect(c.skills.map(s => s.key).sort()).toEqual(["dodge", "parry"]);
  });
  it("возврат ранга — только если он всё ещё ранг Ментора", () => {
    const h = host({ skills: { parry: { rank: "expert" }, dodge: { rank: "trained" } } });
    expect(mentorSkillRestore(h, [{ key: "parry", rank: "expert", prevRank: "trained" }, { key: "dodge", rank: "knows", prevRank: "untrained" }]))
      .toEqual({ "system.skills.parry.rank": "trained" });
  });
});

describe("Восходя Вместе / Высший Одержимый", () => {
  it("Inf Герольда = ½ Inf хоста (окр.▲)", () => {
    expect(greaterPossessedInf(85)).toBe(43);
    expect(demonAscensionUpdate("greater", host({ chars: { inf: 87 } }), demon()))
      .toEqual({ "system.rank": "herald", "system.characteristics.inf.base": 44 });
    expect(demonAscensionUpdate("rising", host(), demon())).toEqual({ "system.rank": "exalted" });
  });
});

describe("Дары-формы: Черты на время Проявления", () => {
  it("Текучий — Amorphous и Crawler", () => {
    expect(manifestTraitPlan(host({ items: [gift("Текучий")] })).map(p => p.name)).toEqual(["Amorphous", "Crawler"]);
    expect(manifestTraitPlan(host({ manifested: false, items: [gift("Текучий")] }))).toEqual([]);
  });
  it("Наслоение — Daemonic Presence (10/10) и Черты своего демона", () => {
    const plan = manifestTraitPlan(host({ items: [gift("Наслоение")] }));
    expect(plan[0]).toMatchObject({ name: "Daemonic Presence", rating: 10, rating2: 10 });
    expect(plan.map(p => p.name)).toContain("Жажда Крови");
  });
  it("сверка: выданное лишнее снимается, недостающее выдаётся", () => {
    const granted = { id: "x", flags: { "warhammer-dbc": { [MANIFEST_GRANT_FLAG]: { gift: "Текучий", name: "Amorphous" } } } };
    const stale = { id: "y", flags: { "warhammer-dbc": { [MANIFEST_GRANT_FLAG]: { gift: "Наслоение", name: "Daemonic Presence" } } } };
    const h = host({ items: [gift("Текучий"), granted, stale] });
    const d = manifestTraitDiff(h);
    expect(d.remove).toEqual(["y"]);
    expect(d.create.map(p => p.name)).toEqual(["Crawler"]);
  });
});

describe("Локус Симбиоза", () => {
  it("Локусы — с листа демона, радиус ½W", () => {
    expect(demonLoci(demon()).map(l => l.id)).toEqual(["l1"]);
    expect(locusRadius(demon())).toBe(19);
  });
  it("действует у Высшего Одержимого в Проявлении с Даром", () => {
    const items = [gift("Локус Симбиоза")];
    expect(symbioteLocusActive(host({ items, possession: { greaterPossessed: true } }))).toBe(true);
    expect(symbioteLocusActive(host({ items }))).toBe(false);
  });
  it("аура с requireManifested задевает только Проявленных Одержимых", () => {
    const d = { radius: 10, affects: "allies", includesSelf: true, requireManifested: true };
    const ctx = { isSelf: false, relationship: "ally", distance: 3 };
    expect(auraAffects(d, { ...ctx, targetActor: host() })).toBe(true);
    expect(auraAffects(d, { ...ctx, targetActor: host({ manifested: false }) })).toBe(false);
    expect(auraAffects(d, { ...ctx, targetActor: { system: {} } })).toBe(false);
    expect(isManifestedPossessed(host())).toBe(true);
  });
});
