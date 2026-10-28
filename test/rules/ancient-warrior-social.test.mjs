// test/rules/ancient-warrior-social.test.mjs
//
// Древний Воин, вторая половина текста (DoomBC — Основная книга, «Арсенал»,
// стр. 62): «получает +10 на все социальные взаимодействия с персонажами,
// имеющими этот Талант и Космодесантниками Хаоса». Решение владельца
// 26.10.2026: предикат «собеседник — носитель Таланта / Космодесантник Хаоса» —
// через выбор фракции собеседника в окне броска (rules/social-faction.mjs) и
// через токен-цель.
//
// Хаос-Космодесантники в данных — фракция «Легионы предатели» (traitor-legions,
// packs-src/factions/Хаос) и её роты; без фракции — Астартес из фракции Хаос.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  socialTalentRules, ANCIENT_WARRIOR_BONUS, ANCIENT_WARRIOR_PEER_KEY, CHAOS_ASTARTES_FACTION
} from "../../module/rules/social-talents.mjs";
import {
  socialTalentFactionRefs, socialFactionPickerShown, socialFactionOptions
} from "../../module/rules/social-faction.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import { setFactionIndex, clearFactionIndex, getFactionIndex } from "../../module/rules/factions.mjs";
import { allPackDocuments } from "../support/pack-docs.mjs";

const TREE = [
  { key: "imperium", name: "Империум" },
  { key: "adeptus-astartes", name: "Адептус Астартес", parent: "imperium" },
  { key: "chaos", name: "Хаос" },
  { key: "traitor-legions", name: "Легионы предатели", parent: "chaos" },
  { key: "black-legion", name: "Чёрный Легион", parent: "traitor-legions" },
  { key: "chaos-cultists", name: "Культисты Хаоса", parent: "chaos" }
];
beforeEach(() => setFactionIndex(TREE));
afterEach(() => clearFactionIndex());

const AW = "Ancient Warrior / Древний Воин";
const talent = name => ({ type: "talent", name, system: {} });
const faction = key => ({ type: "faction", system: { key } });
const hero = (...items) => ({ type: "character", system: {}, items });
const withAW = () => hero(talent(AW));
const social = (extra = {}) => ({ kind: "skill", skill: "charm", char: "fel", ...extra });
const awMod = r => r.autoMods.find(m => m.ruleId === "social.ancientWarrior");

describe("Древний Воин: +10 к социальным с носителями Таланта и Космодесантниками Хаоса", () => {
  it("константы: ключ Хаос-Космодесантников есть в настоящем паке фракций", () => {
    const keys = allPackDocuments("factions").map(d => d.doc?.system?.key);
    expect(keys).toContain(CHAOS_ASTARTES_FACTION);
    expect(ANCIENT_WARRIOR_BONUS).toBe(10);
  });

  it("токен-цель из роты Легионов предателей: +10 автоматически", () => {
    const r = resolveTest({ actor: withAW(), ...social({ targetActor: hero(faction("black-legion")) }) });
    expect(awMod(r)?.value).toBe(10);
  });

  it("токен-цель — другой носитель Таланта: +10", () => {
    const r = resolveTest({ actor: withAW(), ...social({ targetActor: hero(talent("Ancient Warrior / Древний Воин")) }) });
    expect(awMod(r)?.value).toBe(10);
  });

  it("Астартес из фракции Хаос без фракции легиона — Космодесантник Хаоса", () => {
    const target = { type: "character", system: { race: "astartes" }, items: [faction("chaos")] };
    expect(awMod(resolveTest({ actor: withAW(), ...social({ targetActor: target }) }))?.value).toBe(10);
  });

  it("культист Хаоса (не Космодесантник) и лоялист Астартес — не подходят", () => {
    const cultist = hero(faction("chaos-cultists"));
    const loyalist = { type: "character", system: { race: "astartes" }, items: [faction("adeptus-astartes")] };
    expect(awMod(resolveTest({ actor: withAW(), ...social({ targetActor: cultist }) }))).toBeUndefined();
    expect(awMod(resolveTest({ actor: withAW(), ...social({ targetActor: loyalist }) }))).toBeUndefined();
  });

  it("выбор в окне без токена: роты легиона и «носитель Таланта» дают +10, чужая фракция — нет", () => {
    const pick = key => awMod(resolveTest({ actor: withAW(), ...social({ socialFaction: key }) }));
    expect(pick("black-legion")?.value).toBe(10);
    expect(pick("traitor-legions")?.value).toBe(10);
    expect(pick(ANCIENT_WARRIOR_PEER_KEY)?.value).toBe(10);
    expect(pick("chaos-cultists")).toBeUndefined();
    expect(pick("imperium")).toBeUndefined();
  });

  it("выбор фракции перекрывает токен, как у Связей (ctx.socialFaction главнее targetActor)", () => {
    const r = resolveTest({ actor: withAW(),
      ...social({ socialFaction: "imperium", targetActor: hero(faction("black-legion")) }) });
    expect(awMod(r)).toBeUndefined();
  });

  it("не социальный Навык и без Таланта — ничего", () => {
    const t = hero(faction("black-legion"));
    expect(awMod(resolveTest({ actor: withAW(), kind: "skill", skill: "awareness", char: "p", targetActor: t }))).toBeUndefined();
    expect(awMod(resolveTest({ actor: hero(), ...social({ targetActor: t }) }))).toBeUndefined();
    expect(socialTalentRules(hero(), social({ targetActor: t }))).toEqual([]);
  });

  it("без собеседника (ни токена, ни выбора) — ничего", () => {
    expect(awMod(resolveTest({ actor: withAW(), ...social() }))).toBeUndefined();
  });

  it("Связи с той же группой складываются с Древним Воином, а не заменяются", () => {
    const peer = { type: "talent", name: "Peer / Связи",
      system: { targets: [{ kind: "faction", ref: "traitor-legions", value: "", name: "", img: "" }] } };
    const r = resolveTest({ actor: hero(talent(AW), peer), ...social({ targetActor: hero(faction("black-legion")) }) });
    expect(r.autoMods.map(m => m.ruleId).sort()).toEqual(["social.ancientWarrior", "social.peer"]);
  });
});

describe("Древний Воин в выборе собеседника (окно броска)", () => {
  it("Талант добавляет «Легионы предатели» в группы Талантов и выбор «носитель Таланта»", () => {
    expect(socialTalentFactionRefs(withAW())).toEqual([CHAOS_ASTARTES_FACTION]);
    const { own } = socialFactionOptions(withAW(), getFactionIndex());
    expect(own.map(o => o.key)).toEqual([CHAOS_ASTARTES_FACTION, ANCIENT_WARRIOR_PEER_KEY]);
    expect(own[0].label).toBe("Легионы предатели");
  });

  it("выбор показывается Древнему Воину без токена-цели", () => {
    expect(socialFactionPickerShown(withAW(), social())).toBe(true);
    expect(socialFactionPickerShown(hero(), social())).toBe(false);
  });

  it("у персонажа без Таланта список групп не меняется", () => {
    expect(socialFactionOptions(hero(), getFactionIndex()).own).toEqual([]);
  });
});

describe("Древний Воин: данные Таланта в паке", () => {
  it("настоящий Талант из пака опознаётся по имени", () => {
    const doc = allPackDocuments("talents").map(d => d.doc).find(d => /Ancient Warrior/.test(d.name));
    expect(doc).toBeTruthy();
    const actor = hero({ type: "talent", name: doc.name, system: doc.system });
    expect(socialTalentFactionRefs(actor)).toEqual([CHAOS_ASTARTES_FACTION]);
  });
});
