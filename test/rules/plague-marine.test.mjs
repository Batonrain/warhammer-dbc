import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  hasAbominableReaction, hasInfectiousMiasma, hasPlagueGardener, hasRotsmith, hasBileSpit, hasGloriousRust,
  hasBlessedWithPus, hasWalkingWasteland, isNurgleDevoted, isBileSpitWeapon, abominableReduce, abominableThreshold,
  abominableReductionFor, abominableGuardNext, abominableFeared, miasmaStart, miasmaTick, miasmaActive, miasmaUsedIn,
  carrierDiseases, pickIndexByRoll, diseaseCopyData, sameDisease, isEnemyDisposition, infectionDueAdd, infectionGroups,
  rustQuality, rustApplies, isInfectableKnife, isSeveredHead, rotsmithResult, rotsmithMark, rotsmithDue, wastelandRect,
  ROTSMITH_PLAGUE_KNIFE_UUID, ROTSMITH_BLIGHT_UUID
} from "../../module/rules/plague-marine.mjs";
import { actorImmuneToDiseaseEffects, actorImmuneToInfection } from "../../module/rules/disease-immunity.mjs";
import { infectionBlockedBy } from "../../module/rules/disease-infection.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p) : p.endsWith(".json") ? [p] : [];
});
const docsIn = rel => walk(path.join(ROOT, "packs-src", rel)).map(f => JSON.parse(fs.readFileSync(f, "utf8"))).filter(d => d.name);
const named = (rel, part) => docsIn(rel).find(d => d.name.includes(part));
let seq = 0;
const asItem = doc => ({
  ...doc, id: `it${++seq}`, system: { ...(doc.system ?? {}), equipped: true },
  getFlag: (s, k) => doc.flags?.[s]?.[k], toObject: () => JSON.parse(JSON.stringify(doc))
});
const actorOf = (...docs) => ({ type: "character", items: docs.map(asItem), system: { characteristics: {} }, getFlag: () => undefined });

const PM = "traits/Элитные_архетипы/Чумной_Десантник";
const PMT = "talents/Элитные_архетипы/Чумной_Десантник";
const abominable = () => named(PM, "Отвратная");
const miasma = () => named(PM, "Infectious Miasma");
const talent = part => named(PMT, part);
const nagePhysiology = () => named("traits", "Изуверская Физиология");

describe("опознание способностей Чумного Десантника по настоящим записям пака", () => {
  it("Черты и все шесть Талантов читаются на актёре, владеющем записью", () => {
    expect(hasAbominableReaction(actorOf(abominable()))).toBe(true);
    expect(hasInfectiousMiasma(actorOf(miasma()))).toBe(true);
    expect(hasPlagueGardener(actorOf(talent("Plague Gardener")))).toBe(true);
    expect(hasRotsmith(actorOf(talent("Rotsmith")))).toBe(true);
    expect(hasBileSpit(actorOf(talent("Bile Spit")))).toBe(true);
    expect(hasGloriousRust(actorOf(talent("Glorious Rust")))).toBe(true);
    expect(hasBlessedWithPus(actorOf(talent("Blessed with Pus")))).toBe(true);
    expect(hasWalkingWasteland(actorOf(talent("Walking Wasteland")))).toBe(true);
  });

  it("одноимённая Черта Наги реакцию не даёт", () => {
    expect(nagePhysiology()).toBeTruthy();
    expect(hasAbominableReaction(actorOf(nagePhysiology()))).toBe(false);
  });

  it("если переименовать запись, ключ в Механике всё равно опознаёт способность", () => {
    for (const [doc, check] of [
      [abominable(), hasAbominableReaction], [miasma(), hasInfectiousMiasma],
      [talent("Plague Gardener"), hasPlagueGardener], [talent("Rotsmith"), hasRotsmith], [talent("Bile Spit"), hasBileSpit],
      [talent("Glorious Rust"), hasGloriousRust], [talent("Blessed with Pus"), hasBlessedWithPus],
      [talent("Walking Wasteland"), hasWalkingWasteland]
    ]) {
      const renamed = { ...doc, name: "Совсем другое имя" };
      expect(check(actorOf(renamed))).toBe(true);
    }
  });

  it("у актёра без этих записей — ничего", () => {
    const empty = actorOf();
    for (const check of [hasAbominableReaction, hasInfectiousMiasma, hasPlagueGardener, hasRotsmith, hasBileSpit, hasGloriousRust,
      hasBlessedWithPus, hasWalkingWasteland]) expect(check(empty)).toBe(false);
  });
});

describe("Отвратная Физиология: арифметика", () => {
  it("порог T+30 и уменьшение урона на Успехи", () => {
    expect(abominableThreshold(60, 5)).toBe(95);
    expect(abominableReduce(8, 3)).toEqual({ damage: 5, reducedToZero: false });
    expect(abominableReduce(3, 3)).toEqual({ damage: 0, reducedToZero: true });
    expect(abominableReduce(3, 9)).toEqual({ damage: 0, reducedToZero: true });
    expect(abominableReduce(0, 4)).toEqual({ damage: 0, reducedToZero: false });
  });

  it("уменьшение запоминается за противником и боем; новый тест заменяет запись, Страх не повторяется", () => {
    let flag = abominableGuardNext(undefined, { attackerUuid: "A", reduce: 2, combatId: "c1" });
    flag = abominableGuardNext(flag, { attackerUuid: "B", reduce: 4, combatId: "c1" });
    expect(abominableReductionFor(flag, "A", "c1")).toBe(2);
    expect(abominableReductionFor(flag, "B", "c1")).toBe(4);
    expect(abominableReductionFor(flag, "A", "c2")).toBe(0);
    expect(abominableReductionFor(flag, "", "c1")).toBe(0);
    flag = abominableGuardNext(flag, { attackerUuid: "A", reduce: 5, combatId: "c1", feared: true });
    flag = abominableGuardNext(flag, { attackerUuid: "A", reduce: 6, combatId: "c1" });
    expect(abominableReductionFor(flag, "A", "c1")).toBe(6);
    expect(abominableFeared(flag, "A")).toBe(true);
    expect(abominableFeared(flag, "B")).toBe(false);
  });
});

describe("Заразные Миазмы: счётчик Ходов", () => {
  it("N начал Хода, жертвы копятся без повторов, на нуле — конец", () => {
    let st = miasmaStart(2, "c1");
    expect(st).toEqual({ combatId: "c1", total: 2, left: 2, victims: [] });
    expect(miasmaActive(st, "c1")).toBe(true);
    expect(miasmaActive(st, "c2")).toBe(false);
    let t = miasmaTick(st, ["x", "y"]);
    expect(t.last).toBe(false);
    t = miasmaTick(t.state, ["y", "z"]);
    expect(t.last).toBe(true);
    expect(t.state.victims).toEqual(["x", "y", "z"]);
    expect(miasmaActive(t.state, "c1")).toBe(false);
  });

  it("минимум один Ход; «раз за бой» держится по id боя", () => {
    expect(miasmaStart(0, "c1").left).toBe(1);
    expect(miasmaUsedIn("c1", "c1")).toBe(true);
    expect(miasmaUsedIn("c1", "c2")).toBe(false);
    expect(miasmaUsedIn(undefined, "c2")).toBe(false);
  });
});

describe("болезни носителя и копия для жертвы", () => {
  const rot = () => {
    const d = named("diseases", "Nurgle's Rot");
    return { ...d, system: { ...d.system, active: true }, flags: { ...d.flags, "warhammer-dbc": { ...d.flags?.["warhammer-dbc"], grantedByItem: "arch1", equipEntryId: "e1" } } };
  };

  it("носитель заражён теми болезнями, что включены", () => {
    const off = { ...rot(), system: { ...rot().system, active: false }, name: "Другая" };
    const carrier = actorOf(rot(), off, abominable());
    expect(carrierDiseases(carrier).map(i => i.name)).toEqual([rot().name]);
  });

  it("копия: без id, выключена, без следов выдачи архетипом; исходник цел", () => {
    const src = asItem({ ...rot(), _id: "ABC" });
    const copy = diseaseCopyData(src);
    expect(copy._id).toBeUndefined();
    expect(copy.system.active).toBe(false);
    expect(copy.flags["warhammer-dbc"].grantedByItem).toBeUndefined();
    expect(copy.flags["warhammer-dbc"].equipEntryId).toBeUndefined();
    expect(src.system.active).toBe(true);
    expect(copy.system.vectorTests.length).toBeGreaterThan(0);
  });

  it("у жертвы та же болезнь находится по имени", () => {
    const victim = actorOf(rot());
    expect(sameDisease(victim, rot())).toBeTruthy();
    expect(sameDisease(actorOf(), rot())).toBeNull();
  });

  it("бросок определяет болезнь, границы защищены", () => {
    expect(pickIndexByRoll(1, 3)).toBe(0);
    expect(pickIndexByRoll(3, 3)).toBe(2);
    expect(pickIndexByRoll(9, 3)).toBe(2);
    expect(pickIndexByRoll(0, 3)).toBe(0);
    expect(pickIndexByRoll(1, 0)).toBe(-1);
  });
});

describe("кто враг, отложенное заражение", () => {
  it("враг — противоположное расположение; у нейтрального носителя враги все", () => {
    expect(isEnemyDisposition(-1, 1)).toBe(true);
    expect(isEnemyDisposition(-1, -1)).toBe(false);
    expect(isEnemyDisposition(1, -1)).toBe(true);
    expect(isEnemyDisposition(0, 1)).toBe(true);
    expect(isEnemyDisposition(0, 0)).toBe(true);
  });

  it("запись «заразить в конце боя» не дублируется и не переживает другой бой", () => {
    let f = infectionDueAdd(undefined, { combatId: "c1", carrierUuid: "P", via: "Плевок" });
    f = infectionDueAdd(f, { combatId: "c1", carrierUuid: "P", via: "Плевок" });
    f = infectionDueAdd(f, { combatId: "c1", carrierUuid: "P", via: "Касание" });
    expect(f.entries).toHaveLength(2);
    f = infectionDueAdd(f, { combatId: "c2", carrierUuid: "P", via: "Плевок" });
    expect(f).toEqual({ combatId: "c2", entries: [{ carrier: "P", via: "Плевок" }] });
    expect(infectionDueAdd(undefined, { combatId: "c1", via: "x" }).entries).toEqual([]);
  });

  it("группировка жертв по носителю", () => {
    const groups = infectionGroups([
      { victim: "v1", entries: [{ carrier: "P", via: "a" }, { carrier: "Q", via: "b" }] },
      { victim: "v2", entries: [{ carrier: "P", via: "a" }] }
    ]);
    expect(groups.get("P")).toEqual([{ victim: "v1", via: "a" }, { victim: "v2", via: "a" }]);
    expect(groups.get("Q")).toEqual([{ victim: "v1", via: "b" }]);
  });

  it("посвящённый Нурглу — по покровителю", () => {
    expect(isNurgleDevoted({ system: { patronGod: "nurgle" } })).toBe(true);
    expect(isNurgleDevoted({ system: { patronGod: "khorne" } })).toBe(false);
    expect(isNurgleDevoted({ system: {} })).toBe(false);
  });
});

describe("Славная Ржавчина", () => {
  const H = 3600, D = 24 * H;
  it("Poor.Q после 7 часов — Good.Q; раньше ничего", () => {
    expect(rustQuality("poor", 7 * H - 1)).toEqual({ quality: "poor", changed: false, steps: [] });
    expect(rustQuality("poor", 7 * H)).toEqual({ quality: "good", changed: true, steps: ["poor>good"] });
  });

  it("Comm.Q после 7 дней — Poor.Q и тут же Good.Q; раньше остаётся", () => {
    expect(rustQuality("common", 7 * D - 1).changed).toBe(false);
    expect(rustQuality("common", 7 * D)).toEqual({ quality: "good", changed: true, steps: ["common>poor", "poor>good"] });
  });

  it("Good.Q и Best.Q не трогаются", () => {
    expect(rustQuality("good", 99 * D).changed).toBe(false);
    expect(rustQuality("best", 99 * D).quality).toBe("best");
  });

  it("подходят оружие, броня, снаряжение; мистическое, пси-силы и демонически связанное — нет", () => {
    expect(rustApplies({ type: "armor", system: { quality: "common" } })).toBe(true);
    expect(rustApplies({ type: "gear", system: { quality: "poor", gearCategory: "mystic" } })).toBe(false);
    expect(rustApplies({ type: "tool", system: { quality: "poor", toolCategory: "mystic" } })).toBe(false);
    expect(rustApplies({ type: "weapon", system: { quality: "common", daemonWeapon: { bound: true } } })).toBe(false);
    expect(rustApplies({ type: "talent", system: {} })).toBe(false);
    expect(rustApplies({ type: "gear", system: {} })).toBe(false);
  });
});

describe("Кузнец Гнили и плевок", () => {
  const plagueKnife = () => named("weapons", "Plague Knife");
  const blight = () => named("weapons", "Blight");

  it("настоящие Чумной Нож и Моровая граната лежат в компендиуме по ссылкам, зашитым в код", () => {
    expect(ROTSMITH_PLAGUE_KNIFE_UUID.endsWith(`.${JSON.parse(JSON.stringify(plagueKnife()))._id}`)).toBe(true);
    expect(ROTSMITH_BLIGHT_UUID.endsWith(`.${blight()._id}`)).toBe(true);
  });

  it("нож заразить можно, чумной нож — нет; голова — в гранату", () => {
    const knife = { type: "weapon", name: "Combat Knife / Боевой Нож", system: { meleeCategory: "Нож" } };
    expect(isInfectableKnife(knife)).toBe(true);
    expect(isInfectableKnife(plagueKnife())).toBe(false);
    expect(isInfectableKnife({ type: "weapon", name: "Chainsword", system: { meleeCategory: "Цепное" } })).toBe(false);
    const head = { type: "gear", name: "Severed Head / Отрубленная голова", system: {} };
    expect(isSeveredHead(head)).toBe(true);
    expect(rotsmithResult(knife)).toEqual({ kind: "plagueKnife", uuid: ROTSMITH_PLAGUE_KNIFE_UUID });
    expect(rotsmithResult(head)).toEqual({ kind: "blight", uuid: ROTSMITH_BLIGHT_UUID });
    expect(rotsmithResult({ type: "gear", name: "Бинт", system: {} })).toBeNull();
  });

  it("метка срабатывает ровно через 7 часов", () => {
    const mark = rotsmithMark(1000, "blight");
    expect(mark.convertAt).toBe(1000 + 7 * 3600);
    expect(rotsmithDue(mark, mark.convertAt - 1)).toBe(false);
    expect(rotsmithDue(mark, mark.convertAt)).toBe(true);
    expect(rotsmithDue(undefined, 1e9)).toBe(false);
  });

  it("плевок Железы Бетчера опознаётся по имени настоящего оружия", () => {
    const spit = named("weapons/Интегральные_атаки", "Кислотный Плевок");
    expect(isBileSpitWeapon(spit)).toBe(true);
    expect(isBileSpitWeapon("Flame Spit / Огненный Плевок")).toBe(false);
    expect(isBileSpitWeapon({ name: "Bolter" })).toBe(false);
  });
});

describe("Ходячая Пустошь: квадрат 100×100 м", () => {
  it("центр токена — центр квадрата, размер по сетке", () => {
    expect(wastelandRect(500, 500, 100, 1)).toEqual({ x: -4500, y: -4500, width: 10000, height: 10000 });
    expect(wastelandRect(0, 0, 50, 2)).toEqual({ x: -1250, y: -1250, width: 2500, height: 2500 });
  });
});

describe("носитель болезней: эффекты не действуют, заражаться можно", () => {
  it("Отвратная Физиология глушит эффекты болезней, но не заражение", () => {
    const actor = actorOf(abominable());
    expect(actorImmuneToDiseaseEffects(actor)).toBe(true);
    expect(actorImmuneToInfection(actor)).toBe(false);
    expect(infectionBlockedBy(actor, () => true)).toBeNull();
  });

  it("Метка Нургла (defence.diseaseEffectsImmune) останавливает и то и другое", () => {
    const mark = { type: "mutation", name: "Mark", system: {}, flags: { "warhammer-dbc": { mechanics: [{ operator: "AND", entries: [{ kind: "capability", capabilityKey: "defence.diseaseEffectsImmune" }] }] } } };
    const actor = actorOf(mark);
    expect(actorImmuneToDiseaseEffects(actor)).toBe(true);
    expect(actorImmuneToInfection(actor)).toBe(true);
    expect(infectionBlockedBy(actor, () => true)).toContain("Иммунитет");
  });

  it("выключенный носитель не защищает", () => {
    expect(actorImmuneToDiseaseEffects(actorOf(abominable()), () => false)).toBe(false);
  });
});

describe("записи пака: Механика Черт и Талантов", () => {
  const caps = doc => (doc.flags["warhammer-dbc"].mechanics ?? []).flatMap(g => g.entries).map(e => e.capabilityKey || `${e.kind}:${e.condKey}`);

  it("Отвратная Физиология: иммунитеты к ядам, наркотикам, носитель болезней и реакция", () => {
    expect(caps(abominable())).toEqual([
      "poison.immune", "condition:poisoned", "drugs.afterEffectAddictionImmune", "defence.diseaseCarrier", "ability.abominableHitReaction"
    ]);
  });

  it("Благословенный Гноем: иммунитет к Горению и Corrosive", () => {
    expect(caps(talent("Blessed with Pus"))).toEqual(["ability.blessedWithPus", "condition:burning", "weaponPropertyImmunity.corrosive"]);
    const burning = talent("Blessed with Pus").flags["warhammer-dbc"].mechanics[0].entries[1];
    expect(burning.condMode).toBe("immunity");
  });

  it("у остальных шести записей по своему ключу ability.*", () => {
    expect(caps(miasma())).toEqual(["ability.infectiousMiasma"]);
    expect(caps(talent("Plague Gardener"))).toEqual(["ability.plagueGardener"]);
    expect(caps(talent("Rotsmith"))).toEqual(["ability.rotsmith"]);
    expect(caps(talent("Bile Spit"))).toEqual(["ability.bileSpit"]);
    expect(caps(talent("Glorious Rust"))).toEqual(["ability.gloriousRust"]);
    expect(caps(talent("Walking Wasteland"))).toEqual(["ability.walkingWasteland"]);
  });

  it("архетип при покупке заражает Гнилью Нургла: запись «Снаряжение» категории «Болезни» ведёт на настоящую болезнь", () => {
    const arch = named("elite-archetypes", "Plague Marine");
    const entry = arch.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries)
      .find(e => e.kind === "equipment" && e.equipCategoryPack === "diseases");
    expect(entry).toBeTruthy();
    const disease = named("diseases", "Nurgle's Rot");
    expect(entry.equipSourceUuid).toBe(`Compendium.warhammer-dbc.diseases.Item.${disease._id}`);
    expect(entry.equipMode).toBe("direct");
  });

  it("id новых записей — ровно 16 знаков", () => {
    for (const doc of [abominable(), miasma(), ...["Plague Gardener", "Rotsmith", "Bile Spit", "Glorious Rust", "Blessed with Pus", "Walking Wasteland"].map(talent)]) {
      for (const g of doc.flags["warhammer-dbc"].mechanics) {
        expect(g.id).toMatch(/^[A-Za-z0-9]{16}$/);
        for (const e of g.entries) expect(e.id).toMatch(/^[A-Za-z0-9]{16}$/);
      }
    }
  });
});
