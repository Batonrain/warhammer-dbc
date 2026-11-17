// test/rules/dark-apostle.test.mjs
//
// Тёмный Апостол (Sahara 1-54b9): чистая часть rules/dark-apostle.mjs на настоящих записях пака, подключения в
// чужих правилах (число целей ×10, Литания Слаанеш в реестре правил, Extreme подчинённых Маловажных NPC),
// арифметика Возложения Рук и мистического щита Смертного Инструмента.

import "../support/foundry-stub.mjs";
import { describe, it, expect, afterEach } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import {
  hasHarbingerOfHeresy, hasDarkDevotion, hasTruePrayer, hasLayOnHands, hasLitanyOfChaos, hasMartyr, hasMortalInstrument,
  harbingerTargetMult, harbingerRerollBonus, isFaithful, isFaithfulOf, faithfulResistBonus, heresyThreshold, heresyLoreTotal,
  charmThreshold, litanyOptions, activeLitany, blessingGod, litanyGivesExtreme, litanyAutoPassesTerrain, litanyGrantsFor,
  litanyGrantItemData, isLitanyGrant, litanyMarks, darkApostleRules, layOnHandsPlan, layOnHandsPool, martyrChooser,
  isLethalBlow, mortalShieldAbsorbs, subordinateUuids, isSubordinateOf, subordinateActors, HATRED_PACK_ID, FRENZY_PACK_ID,
  FANATIC_PACK_ID
} from "../../module/rules/dark-apostle.mjs";
import { commandCapacity } from "../../module/rules/leadership-talents.mjs";
import { inspireWrathAudience } from "../../module/rules/inspire-wrath.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import { minionCanCauseExtremeDamage } from "../../module/rules/squad-roles.mjs";
import { mutationByRoll } from "../../module/constants/mutations.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

const TRAITS = "packs-src/traits/Элитные_архетипы/Т_мный_Апостол";
const TALENTS = "packs-src/talents/Элитные_архетипы/Т_мный_Апостол";
const HARBINGER = packDocById(TRAITS, "WKCWM6yQ5xrJyI2o");
const DEVOTION = packDocById(TRAITS, "l9fH4i9tP62kpX1T");
const PRAYER = packDocById(TALENTS, "ycZ1I5WtPWl18PUA");
const HANDS = packDocById(TALENTS, "RWPFDaUCBKK0LyDD");
const LITANY = packDocById(TALENTS, "e1ZeM9l6D9VgaViU");
const MARTYR = packDocById(TALENTS, "QgufMimQz6VN3HN3");
const MORTAL = packDocById(TALENTS, "mbCbCFSDjg2km7dG");
const HATRED = packDocById("packs-src/talents/Берсерк", HATRED_PACK_ID);
const FRENZY = packDocById("packs-src/talents/Берсерк", FRENZY_PACK_ID);
const FANATIC = packDocById("packs-src/traits", FANATIC_PACK_ID);
const ALL = [HARBINGER, DEVOTION, PRAYER, HANDS, LITANY, MARTYR, MORTAL];

const NS = "warhammer-dbc";
let seq = 0;
const asItem = doc => ({ ...doc, id: `it${++seq}`, getFlag: (s, k) => doc.flags?.[s]?.[k] });
function actorOf(docs = [], { flags = {}, patron = "", fel = 5, uuid = "Actor.apostle", system = {} } = {}) {
  return {
    type: "character", uuid, id: uuid.split(".").at(-1), name: "Апостол", items: docs.map(asItem),
    system: { patronGod: patron, characteristics: { fel: { bonus: fel, total: fel * 10 }, wp: { total: 50, bonus: 5 } }, ...system },
    getFlag: (s, k) => (s === NS ? flags[k] : undefined)
  };
}
const withCombat = id => { globalThis.game.combat = id ? { id } : undefined; };
afterEach(() => { globalThis.game.combat = undefined; });

describe("опознание способностей Тёмного Апостола по настоящим записям пака", () => {
  it("каждая из семи записей читается на актёре, владеющем ею, и только на нём", () => {
    const checks = [
      [HARBINGER, hasHarbingerOfHeresy], [DEVOTION, hasDarkDevotion], [PRAYER, hasTruePrayer], [HANDS, hasLayOnHands],
      [LITANY, hasLitanyOfChaos], [MARTYR, hasMartyr], [MORTAL, hasMortalInstrument]
    ];
    for (const [doc, check] of checks) {
      expect(check(actorOf([doc])), doc.name).toBe(true);
      expect(check(actorOf()), doc.name).toBe(false);
      for (const [other] of checks.filter(([d]) => d !== doc)) expect(check(actorOf([other])), `${doc.name} не ${other.name}`).toBe(false);
    }
  });

  it("если переименовать запись, ключ в Механике всё равно опознаёт способность", () => {
    expect(hasLayOnHands(actorOf([{ ...HANDS, name: "Совсем другое имя" }]))).toBe(true);
    expect(hasMartyr(actorOf([{ ...MARTYR, name: "Иное" }]))).toBe(true);
    expect(hasHarbingerOfHeresy(actorOf([{ ...HARBINGER, name: "Иное" }]))).toBe(true);
  });

  it("каждая запись несёт ключ Возможности, который есть в реестре", () => {
    for (const doc of ALL) {
      const keys = (doc.flags["warhammer-dbc"].mechanics ?? []).flatMap(g => g.entries.map(e => e.capabilityKey));
      expect(keys.length, doc.name).toBe(1);
      expect(CAPABILITIES[keys[0]], `${doc.name}: ${keys[0]}`).toBeTruthy();
      expect(CAPABILITIES[keys[0]].reader, keys[0]).toMatch(/Sahara 1-54b9/);
    }
  });
});

describe("Предвестник Ереси: ×10 целей и +10 на переброс", () => {
  it("число подчинённых одной Команды (F.b×2) умножается на 10", () => {
    expect(commandCapacity(actorOf([], { fel: 5 }))).toBe(10);
    expect(commandCapacity(actorOf([HARBINGER], { fel: 5 }))).toBe(100);
  });

  it("аудитория Вдохновить Гнев (F.b×10) умножается на 10", () => {
    expect(inspireWrathAudience(actorOf([], { fel: 5 }))).toBe(50);
    expect(inspireWrathAudience(actorOf([HARBINGER], { fel: 5 }))).toBe(500);
    expect(harbingerTargetMult(actorOf())).toBe(1);
  });

  it("+10 на переброс — только носителю и только в социальном взаимодействии", () => {
    expect(harbingerRerollBonus(actorOf([HARBINGER]), { social: true })).toBe(10);
    expect(harbingerRerollBonus(actorOf([HARBINGER]), { social: false })).toBe(0);
    expect(harbingerRerollBonus(actorOf(), { social: true })).toBe(0);
  });

  it("Правоверный: метка, принадлежность Апостолу и +30 на сопротивление убеждению", () => {
    const flags = { faithful: { apostleUuid: "Actor.apostle", apostleName: "Апостол" } };
    const npc = actorOf([], { flags, uuid: "Actor.npc" });
    expect(isFaithful(npc)).toBe(true);
    expect(isFaithful(actorOf())).toBe(false);
    expect(isFaithfulOf(npc, actorOf([], { uuid: "Actor.apostle" }))).toBe(true);
    expect(isFaithfulOf(npc, actorOf([], { uuid: "Actor.other" }))).toBe(false);
    expect(faithfulResistBonus(npc, { social: true })).toBe(30);
    expect(faithfulResistBonus(npc, { social: false })).toBe(0);
    expect(faithfulResistBonus(actorOf(), { social: true })).toBe(0);
  });

  it("пороги For.Lore (Heresy) и Charm: база + поправки", () => {
    const a = actorOf([], { system: { groupSkills: { forbiddenLore: [{ specialty: "Heresy", total: 45 }] }, skills: { charm: { total: 38 } } } });
    expect(heresyLoreTotal(a)).toBe(45);
    expect(heresyThreshold(a, 0, 5)).toBe(50);
    expect(heresyThreshold(actorOf())).toBeNull();
    expect(charmThreshold(a, 10, -5)).toBe(43);
  });
});

describe("Литания Хаоса: доступные Боги и действие метки", () => {
  it("Апостол Пантеона выбирает из пяти, посвящённый Богу — только его литанию", () => {
    expect(litanyOptions(actorOf([], { patron: "undivided" })).map(g => g.key)).toEqual(["undivided", "slaanesh", "nurgle", "khorne", "tzeentch"]);
    expect(litanyOptions(actorOf([], { patron: "" }))).toHaveLength(5);
    expect(litanyOptions(actorOf([], { patron: "khorne" })).map(g => g.key)).toEqual(["khorne"]);
    expect(litanyOptions(actorOf([], { patron: "tzeentch" })).map(g => g.key)).toEqual(["tzeentch"]);
  });

  it("метка подчинённого действует только в своём бою", () => {
    const marks = litanyMarks("undivided", { uuid: "Actor.apostle", name: "Апостол" }, "c1", [{ name: "Боец" }]);
    const sub = actorOf([], { flags: { litanyBlessing: marks.blessing } });
    withCombat("c1");
    expect(blessingGod(sub)).toBe("undivided");
    expect(litanyGivesExtreme(sub)).toBe(true);
    expect(litanyAutoPassesTerrain(sub)).toBe(false);
    withCombat("c2");
    expect(blessingGod(sub)).toBe("");
    expect(litanyGivesExtreme(sub)).toBe(false);
  });

  it("литания Нургла даёт автопроход Трудного Ландшафта", () => {
    withCombat("c1");
    const sub = actorOf([], { flags: { litanyBlessing: { god: "nurgle", combatId: "c1" } } });
    expect(litanyAutoPassesTerrain(sub)).toBe(true);
    expect(litanyGivesExtreme(sub)).toBe(false);
  });

  it("Маловажный NPC под литанией Неделимого может наносить Экстремальный Урон без Присутствия", () => {
    withCombat("c1");
    globalThis.game.actors = [];
    const grunt = (flags = {}) => ({ ...actorOf([], { flags, uuid: "Actor.grunt" }), type: "minion" });
    expect(minionCanCauseExtremeDamage(grunt())).toBe(false);
    expect(minionCanCauseExtremeDamage(grunt({ litanyBlessing: { god: "undivided", combatId: "c1" } }))).toBe(true);
    expect(minionCanCauseExtremeDamage(grunt({ litanyBlessing: { god: "nurgle", combatId: "c1" } }))).toBe(false);
  });

  it("Кхорн выдаёт Frenzy и Hatred, Тзинч — Fanatic; прочие боги предметов не дают", () => {
    expect(litanyGrantsFor("khorne").map(g => g.kind)).toEqual(["frenzy", "hatredAll"]);
    expect(litanyGrantsFor("tzeentch").map(g => g.kind)).toEqual(["fanatic"]);
    for (const god of ["undivided", "slaanesh", "nurgle"]) expect(litanyGrantsFor(god)).toEqual([]);
  });

  it("временный Hatred — «Все!», бесплатный, с меткой выдачи; Frenzy и Fanatic — копии шаблонов с меткой", () => {
    const apostle = { uuid: "Actor.apostle", name: "Апостол" };
    const hatred = litanyGrantItemData(HATRED, "hatredAll", apostle);
    expect(hatred.system.targets).toEqual([{ kind: "all", ref: "", value: "", name: "Все!", img: "" }]);
    expect(hatred.system.cost).toBe(0);
    expect(hatred._id).toBeUndefined();
    expect(isLitanyGrant(hatred)).toBe(true);
    expect(hatred.flags[NS].litanyGrant).toMatchObject({ apostleUuid: "Actor.apostle", kind: "hatredAll" });
    expect(litanyGrantItemData(FRENZY, "frenzy", apostle).name).toBe(FRENZY.name);
    expect(litanyGrantItemData(FANATIC, "fanatic", apostle).type).toBe("trait");
    expect(isLitanyGrant(FRENZY)).toBe(false);
  });

  it("активная литания Апостола читается по боя; правило Слаанеш даёт +30 на Командование и только на него", () => {
    const flags = { litany: { god: "slaanesh", combatId: "c1", names: [] } };
    withCombat("c1");
    const a = actorOf([LITANY], { flags });
    expect(activeLitany(a)?.god).toBe("slaanesh");
    expect(darkApostleRules(a)).toHaveLength(1);
    const command = resolveTest({ actor: a, kind: "skill", skill: "command", char: "fel" }).autoMods;
    expect(command.map(m => m.value)).toEqual([30]);
    expect(resolveTest({ actor: a, kind: "skill", skill: "charm", char: "fel" }).autoMods.some(m => m.value === 30)).toBe(false);
    withCombat("c2");
    expect(activeLitany(a)).toBeNull();
    expect(darkApostleRules(a)).toEqual([]);
  });

  it("правило не работает без Таланта и при литании другого Бога", () => {
    withCombat("c1");
    expect(darkApostleRules(actorOf([], { flags: { litany: { god: "slaanesh", combatId: "c1" } } }))).toEqual([]);
    expect(darkApostleRules(actorOf([LITANY], { flags: { litany: { god: "khorne", combatId: "c1" } } }))).toEqual([]);
  });
});

describe("подчинённые Апостола", () => {
  const squad = (posts, members) => ({ type: "squad", uuid: "Actor.squad", system: { posts, members } });
  it("«Под моим Присутствием» и Отряд, где Апостол Командир или Лидер, — без самого Апостола и без дублей", () => {
    const apostle = actorOf([LITANY], { system: { followers: [{ uuid: "Actor.f1" }, { uuid: "Actor.m1" }] } });
    const all = [
      squad({ commander: { uuid: "Actor.apostle" } }, [{ uuid: "Actor.m1" }, { uuid: "Actor.m2" }, { uuid: "Actor.apostle" }]),
      squad({ commander: { uuid: "Actor.other" } }, [{ uuid: "Actor.stranger" }])
    ];
    expect([...subordinateUuids(apostle, all)].sort()).toEqual(["Actor.f1", "Actor.m1", "Actor.m2"]);
    expect(isSubordinateOf(apostle, { uuid: "Actor.m2", id: "m2" }, all)).toBe(true);
    expect(isSubordinateOf(apostle, { uuid: "Actor.stranger", id: "stranger" }, all)).toBe(false);
    expect(isSubordinateOf(apostle, { uuid: "Actor.apostle" }, all)).toBe(false);
  });

  it("Отряд, где Апостол только рядовой, подчинённых не даёт; Лидер даёт", () => {
    const apostle = actorOf();
    expect(subordinateUuids(apostle, [squad({ commander: { uuid: "Actor.x" } }, [{ uuid: "Actor.apostle" }, { uuid: "Actor.y" }])]).size).toBe(0);
    expect(subordinateUuids(apostle, [squad({ leader: { uuid: "Actor.apostle" } }, [{ uuid: "Actor.y" }])]).has("Actor.y")).toBe(true);
  });

  it("subordinateActors раскрывает uuid через переданный резолвер и не дублирует", () => {
    const apostle = actorOf([], { system: { followers: [{ uuid: "Actor.f1" }, { uuid: "Token.f1" }] } });
    const f1 = { uuid: "Actor.f1", name: "Ф" };
    const found = subordinateActors(apostle, [], uuid => (uuid === "Actor.f1" || uuid === "Token.f1" ? { actor: f1 } : null));
    expect(found).toEqual([f1]);
  });
});

describe("Возложение Рук", () => {
  it("Порча до Порога Мутации, не выше Cor Апостола", () => {
    expect(layOnHandsPlan({ apostleCor: 60, targetCor: 12, nextThreshold: 20 })).toEqual({ ok: true, needed: 8 });
    expect(layOnHandsPlan({ apostleCor: 60, targetCor: 40, nextThreshold: 40 }).needed).toBe(1);
    const tooMuch = layOnHandsPlan({ apostleCor: 5, targetCor: 12, nextThreshold: 20 });
    expect(tooMuch.ok).toBe(false);
    expect(tooMuch.reason).toContain("больше Cor Апостола");
  });

  it("отказы: нет согласия, цель уже благословлена в этом месяце, нет следующего Порога", () => {
    expect(layOnHandsPlan({ apostleCor: 60, nextThreshold: 20, willing: false }).ok).toBe(false);
    expect(layOnHandsPlan({ apostleCor: 60, nextThreshold: 20, ready: false }).reason).toContain("месяц");
    expect(layOnHandsPlan({ apostleCor: 60, targetCor: 99, nextThreshold: null }).ok).toBe(false);
  });

  it("три броска ± Inf.b дают объединённый пул таблицы Мутаций", () => {
    const names = layOnHandsPool([10, 50, 90], 0, mutationByRoll);
    expect(names).toEqual(new Set([mutationByRoll(10), mutationByRoll(50), mutationByRoll(90)]));
    const shifted = layOnHandsPool([50], 3, mutationByRoll);
    expect(shifted.size).toBeGreaterThanOrEqual(1);
    for (let s = -3; s <= 3; s++) expect(shifted.has(mutationByRoll(50 + s))).toBe(true);
  });
});

describe("Мученик и Смертный Инструмент", () => {
  it("демона выбирает Апостол на 4+ Успеха, ГМ — на 1–3", () => {
    expect(martyrChooser(4)).toBe("apostle");
    expect(martyrChooser(7)).toBe("apostle");
    expect(martyrChooser(3)).toBe("gm");
    expect(martyrChooser(1)).toBe("gm");
  });

  const sys = (value, critical, max = 20, ablative = 0) => ({ wounds: { value, critical, max, ablative } });
  it("смертельный удар — Критические Раны доходят до Макс Ран + 7", () => {
    expect(isLethalBlow(sys(5, 0), 10)).toBe(false);
    expect(isLethalBlow(sys(5, 0), 5 + 27)).toBe(true);
    expect(isLethalBlow(sys(5, 0), 5 + 26)).toBe(false);
    expect(isLethalBlow(sys(0, 20), 7)).toBe(true);
    expect(isLethalBlow(sys(0, 20), 6)).toBe(false);
  });

  it("аблативные Раны принимают часть удара до проверки смертельности", () => {
    expect(isLethalBlow(sys(5, 0, 20, 10), 5 + 27 + 10)).toBe(true);
    expect(isLethalBlow(sys(5, 0, 20, 10), 5 + 27)).toBe(false);
  });

  it("мистический щит отражает только смертельный удар и только с меткой", () => {
    const shielded = { ...actorOf(), system: sys(0, 20), getFlag: (s, k) => (k === "mortalShield" ? true : undefined) };
    expect(mortalShieldAbsorbs(shielded, 8)).toBe(true);
    expect(mortalShieldAbsorbs(shielded, 3)).toBe(false);
    expect(mortalShieldAbsorbs({ ...shielded, getFlag: () => undefined }, 8)).toBe(false);
  });
});
