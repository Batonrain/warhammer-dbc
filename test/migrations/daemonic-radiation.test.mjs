// test/migrations/daemonic-radiation.test.mjs
//
// daemonic-46e0 + daemonic-force-sanctified-warp-weapon (п.1–2): книга (core.json,
// Трейт Daemonic (X)) — «Он иммунен к ядам, болезням, и радиации». Три группы
// Конструктора (радиация, яды, болезни) лежали только на базовой Черте в паке
// traits; у 31 демона Бестиария (Демоны_Хаоса) своя копия «Daemonic (N)» без
// ссылки на источник и без записи, а копии на живых акторах — снимки момента
// выдачи. Кроме них та же Черта у Кхимеры и Мандрагоры Друкхари (в Аэльдари-
// книгах Daemonic не определён — это Черта core). Пак поправлен, миграция
// догоняет акторов мира (версия 2: радиацию v1 уже могли отработать).
//
// Данные — настоящие JSON packs-src: образец берётся из базовой Черты, копия
// «до правки» — это запись пака со снятым flags.mechanics.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import path from "node:path";
import { allPackDocuments, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";
import { packDocById } from "../support/pack-doc.mjs";
import {
  buildDaemonicContext, daemonicRadiationPatch, daemonicRadiationUpdates, daemonicContextComplete,
  hasRadiationImmunity, hasPoisonImmunity, hasDiseaseImmunity, radiationGroupOf, daemonicGroupsOf,
  migrateDaemonicRadiation, DAEMONIC_BASE_NAME, DAEMONIC_IMMUNITIES
} from "../../module/migrations/daemonic-radiation.mjs";
import { isImmuneToCondition } from "../../module/rules/condition-guards.mjs";
import { applyRadHit } from "../../module/combat/radiation.mjs";
import { hasRuleFlag } from "../../module/rules/flags.mjs";
import { actorImmuneToDiseaseEffects } from "../../module/rules/disease-immunity.mjs";
import { infectionBlockedBy } from "../../module/rules/disease-infection.mjs";
import { poisonImmunitySource } from "../../module/apps/naga-traits.mjs";

const FLAG = "warhammer-dbc";
const BASE_ID = "brwXUX5nKFR5tOjG";

const baseDoc = () => ({
  ...packDocById("packs-src/traits", BASE_ID),
  uuid: `Compendium.warhammer-dbc.traits.Item.${BASE_ID}`
});
const CTX = buildDaemonicContext([baseDoc()]);
/** Все три группы-образца в порядке реестра иммунитетов — то, что должна нести каждая копия после правки. */
const ALL = DAEMONIC_IMMUNITIES.map(imm => CTX.groups[imm.key]);

/** Демоны Бестиария из Демонов Хаоса: актор + его Черта «Daemonic (N)». */
const DEMONS = allPackDocuments("bestiary")
  .filter(({ file }) => file.replaceAll("\\", "/").includes("/Демоны_Хаоса/"))
  .map(({ file, doc }) => ({ file, doc, daemonic: (doc.items ?? []).filter(i => i.type === "trait" && /^Daemonic \(\d+\)$/.test(i.name)) }))
  .filter(d => d.daemonic.length);

/** Копия на акторе «до правки»: запись пака без Механики. */
function staleCopy(src, { name = src.name, id = "it1", source = null } = {}) {
  const copy = structuredClone(src);
  delete copy.flags?.[FLAG]?.mechanics;
  return { ...copy, id, name, _stats: source ? { compendiumSource: source } : {} };
}

/** Применить плоский патч к копии, как сделал бы Foundry. */
function applyPatch(item, patch) {
  for (const [p, v] of Object.entries(patch)) {
    const keys = p.split(".");
    let o = item;
    for (const k of keys.slice(0, -1)) o = (o[k] ??= {});
    o[keys.at(-1)] = v;
  }
  return item;
}

describe("Пак: иммунитеты к радиации, ядам и болезням у Daemonic", () => {
  it("базовая Черта несёт три группы иммунитетов, каждая опознаётся", () => {
    const doc = baseDoc();
    expect(doc.name).toBe(DAEMONIC_BASE_NAME);
    const mech = doc.flags[FLAG].mechanics;
    expect(hasRadiationImmunity(mech)).toBe(true);
    expect(hasPoisonImmunity(mech)).toBe(true);
    expect(hasDiseaseImmunity(mech)).toBe(true);
    expect(radiationGroupOf(doc)).toBeTruthy();
    expect(daemonicContextComplete(CTX)).toBe(true);
    expect(CTX.group).toEqual(CTX.groups.radiation);
    expect(daemonicGroupsOf(doc)).toEqual({ radiation: CTX.groups.radiation, poison: CTX.groups.poison, disease: CTX.groups.disease });
    // По одной группе на иммунитет: ГМ снимает их по отдельности.
    expect(new Set(ALL.map(g => g.id)).size).toBe(3);
    expect(mech).toEqual(ALL);
  });

  it("яды: возможность poison.immune и иммунитет к Состоянию «Отравление» — обе записи, как у Abominable Physiology", () => {
    const entries = CTX.groups.poison.entries;
    expect(entries.map(e => e.kind)).toEqual(["capability", "condition"]);
    expect(entries[0].capabilityKey).toBe("poison.immune");
    expect(entries[1]).toMatchObject({ condKey: "poisoned", condMode: "immunity" });
    expect(CTX.groups.disease.entries.map(e => e.capabilityKey)).toEqual(["defence.diseaseEffectsImmune"]);
  });

  it("31 демон Бестиария (Демоны Хаоса), у каждого «Daemonic (N)» с тремя иммунитетами, как у базовой Черты", () => {
    expect(DEMONS).toHaveLength(31);
    for (const { file, daemonic } of DEMONS) {
      expect(daemonic, file).toHaveLength(1);
      const mech = daemonic[0].flags?.[FLAG]?.mechanics;
      expect(hasRadiationImmunity(mech) && hasPoisonImmunity(mech) && hasDiseaseImmunity(mech), file).toBe(true);
      expect(mech, file).toEqual(ALL);
    }
  }, PACK_SCAN_TIMEOUT);

  it("Armament, Presence и Dread иммунитета не получили", () => {
    const others = [];
    for (const { doc } of DEMONS) {
      for (const i of doc.items) if (/^Daemonic (Armament|Presence)/.test(i.name)) others.push(i);
    }
    expect(others.length).toBeGreaterThan(30);
    const any = m => hasRadiationImmunity(m) || hasPoisonImmunity(m) || hasDiseaseImmunity(m);
    expect(others.filter(i => any(i.flags?.[FLAG]?.mechanics))).toEqual([]);
    for (const { doc } of allPackDocuments("traits").filter(d => /^Daemonic (Presence|Dread)/.test(d.doc.name))) {
      expect(any(doc.flags?.[FLAG]?.mechanics), doc.name).toBe(false);
    }
  }, PACK_SCAN_TIMEOUT);

  it("Друкхари (Кхимера и Мандрагора, «Daemonic (N) / Демонический (N)») — та же Черта core, иммунитет есть", () => {
    const drukhari = allPackDocuments("bestiary")
      .filter(({ file }) => file.replaceAll("\\", "/").includes("/Друкхари/"))
      .flatMap(({ doc }) => doc.items ?? []).filter(i => /^Daemonic \(\d+\) \/ Демонический/.test(i.name));
    expect(drukhari.length).toBe(2);
    for (const i of drukhari) expect(i.flags?.[FLAG]?.mechanics, i.name).toEqual(ALL);
  }, PACK_SCAN_TIMEOUT);

  it("известный пробел: «Daemonic (+X)» Элитных архетипов Друкхари иммунитета не несут (отдельная задача)", () => {
    const elite = allPackDocuments("traits").filter(({ file }) => path.basename(file).startsWith("Daemonic___") && file.includes("Элитные_архетипы"));
    expect(elite.length).toBe(5);
    for (const { doc } of elite) {
      const m = doc.flags?.[FLAG]?.mechanics;
      expect(hasRadiationImmunity(m) || hasPoisonImmunity(m) || hasDiseaseImmunity(m), doc.name).toBe(false);
    }
  }, PACK_SCAN_TIMEOUT);

  it("демон из Бестиария (Кровопускатель) не получает урон в T от Rad — на настоящих данных пака", async () => {
    resetCaptured();
    globalThis.game.time = { worldTime: 1000 };
    globalThis.game.combats = [];
    const bloodletter = DEMONS.find(d => d.file.includes("Bloodletter")).doc;
    const flags = {};
    const items = bloodletter.items.map(i => ({ ...i, getFlag: (s, k) => i.flags?.[s]?.[k] }));
    const actor = {
      uuid: "Actor.d1", name: "Кровопускатель", type: "character", isOwner: true, items,
      system: { characteristics: { t: { total: 40 } }, charLoss: { t: 0 }, charLossAt: {}, conditions: {} },
      getFlag: (_s, k) => flags[k], setFlag: async (_s, k, v) => { flags[k] = v; },
      update: async data => { if ("system.charLoss.t" in data) actor.system.charLoss.t = data["system.charLoss.t"]; }
    };
    captured.dice = [4];
    await applyRadHit(actor, { formula: "1d5", label: "Рад" });
    expect(actor.system.charLoss.t).toBe(0);
    expect(captured.chat.some(c => String(c.content).includes("Иммунитет к радиации"))).toBe(true);
  });
});

describe("Живые пути: демон из Бестиария не травится и не болеет — на настоящих данных пака", () => {
  /** Актор с копиями Черт из документа пака: parent, getFlag, плоский flags — как у живого документа. */
  function actorFromDoc(doc) {
    const actor = { id: "a1", uuid: "Actor.a1", name: doc.name, type: "character", system: { characteristics: {}, conditions: {} }, items: [] };
    doc.items.forEach((d, i) => {
      const item = { id: "i" + i, name: d.name, type: d.type, system: structuredClone(d.system ?? {}), flags: structuredClone(d.flags ?? {}), parent: actor };
      item.getFlag = (s, k) => item.flags?.[s]?.[k];
      actor.items.push(item);
    });
    return actor;
  }
  const bloodletter = () => DEMONS.find(d => d.file.includes("Bloodletter")).doc;

  it("яды: возможность poison.immune видна правилам актора (Токсичное оружие и яды-препараты не действуют)", () => {
    const actor = actorFromDoc(bloodletter());
    expect(hasRuleFlag(actor, "poison.immune")).toBe(true);
    expect(poisonImmunitySource(actor)).not.toBe("");
  });

  it("Отравление не накладывается никаким путём (иммунитет к Состоянию)", () => {
    expect(isImmuneToCondition(actorFromDoc(bloodletter()), "poisoned")).toBe(true);
  });

  it("болезни: актор не заражается и эффекты болезней на нём не действуют", () => {
    const actor = actorFromDoc(bloodletter());
    expect(actorImmuneToDiseaseEffects(actor)).toBe(true);
    expect(infectionBlockedBy(actor, () => true)).toContain("Иммунитет к болезням");
  });

  it("контроль: у актора без Daemonic ничего этого нет", () => {
    const doc = structuredClone(bloodletter());
    doc.items = doc.items.filter(i => !/^Daemonic \(\d+\)$/.test(i.name));
    const actor = actorFromDoc(doc);
    expect(hasRuleFlag(actor, "poison.immune")).toBe(false);
    expect(isImmuneToCondition(actor, "poisoned")).toBe(false);
    expect(isImmuneToCondition(actor, "radiation")).toBe(false);
  });
});

describe("daemonicRadiationPatch: копия до правки пака", () => {
  const bestiaryItem = () => DEMONS[0].daemonic[0];

  it("«Daemonic (N)» бестиария без ссылки на источник — по имени, группа ложится в Механику", () => {
    const item = staleCopy(bestiaryItem());
    expect(isImmuneToCondition({ items: [item] }, "radiation")).toBe(false);
    const patch = daemonicRadiationPatch(item, CTX);
    expect(patch).not.toBeNull();
    applyPatch(item, patch);
    expect(item.flags[FLAG].mechanics).toEqual(ALL);
    expect(isImmuneToCondition({ items: [item] }, "radiation")).toBe(true);
  });

  it("все 31 «Daemonic (N)» демонов получают иммунитеты миграцией, каждая — ровно по одной группе", () => {
    for (const { file, daemonic } of DEMONS) {
      const item = staleCopy(daemonic[0]);
      applyPatch(item, daemonicRadiationPatch(item, CTX));
      expect(item.flags[FLAG].mechanics, file).toEqual(ALL);
    }
  }, PACK_SCAN_TIMEOUT);

  it("мир, где версия 1 (только радиация) уже отработала: дописываются яды и болезни, радиация не дублируется", () => {
    const item = staleCopy(bestiaryItem());
    item.flags = { [FLAG]: { mechanics: [CTX.groups.radiation] } };
    applyPatch(item, daemonicRadiationPatch(item, CTX));
    expect(item.flags[FLAG].mechanics).toEqual(ALL);
    expect(item.flags[FLAG].mechanics.filter(g => hasRadiationImmunity([g]))).toHaveLength(1);
    expect(daemonicRadiationPatch(item, CTX)).toBeNull();
  });

  it("опора «Обновить мир» помнит все три — ГМ снял иммунитеты осознанно, не возвращаем; помнит два — третий догоняется", () => {
    const item = staleCopy(bestiaryItem());
    item.flags = { [FLAG]: { mechanics: [CTX.groups.poison],
      contentSync: { mechanicsBaseline: [CTX.groups.poison, CTX.groups.radiation, CTX.groups.disease] } } };
    expect(daemonicRadiationPatch(item, CTX)).toBeNull();
    item.flags[FLAG].contentSync.mechanicsBaseline = [CTX.groups.poison, CTX.groups.radiation];
    applyPatch(item, daemonicRadiationPatch(item, CTX));
    expect(item.flags[FLAG].mechanics).toEqual([CTX.groups.poison, CTX.groups.disease]);
    expect(item.flags[FLAG].contentSync.mechanicsBaseline).toEqual([CTX.groups.poison, CTX.groups.radiation, CTX.groups.disease]);
  });

  it("яды и болезни начинают работать у копии демона после миграции", () => {
    const item = staleCopy(bestiaryItem());
    const actor = { id: "a", uuid: "Actor.a", type: "character", system: { characteristics: {}, conditions: {} }, items: [item] };
    item.parent = actor;
    item.getFlag = (s, k) => item.flags?.[s]?.[k];
    expect(isImmuneToCondition(actor, "poisoned")).toBe(false);
    expect(actorImmuneToDiseaseEffects(actor)).toBe(false);
    applyPatch(item, daemonicRadiationPatch(item, CTX));
    expect(isImmuneToCondition(actor, "poisoned")).toBe(true);
    expect(actorImmuneToDiseaseEffects(actor)).toBe(true);
    expect(hasRuleFlag(actor, "poison.immune")).toBe(true);
  });

  it("копия базовой Черты по ссылке на источник (в том числе переименованная)", () => {
    const base = baseDoc();
    for (const name of [base.name, "Одержимость Варпом"]) {
      const item = staleCopy(base, { name, source: base.uuid });
      applyPatch(item, daemonicRadiationPatch(item, CTX));
      expect(isImmuneToCondition({ items: [item] }, "radiation"), name).toBe(true);
    }
  });

  it("копия базовой Черты без ссылки — по имени, любой половиной двуязычного", () => {
    const base = baseDoc();
    for (const name of ["Daemonic", "Демонический (X)"]) {
      const item = staleCopy(base, { name });
      expect(daemonicRadiationPatch(item, CTX), name).not.toBeNull();
    }
  });

  it("идемпотентна: после применения патч больше ничего не даёт", () => {
    const item = staleCopy(bestiaryItem());
    applyPatch(item, daemonicRadiationPatch(item, CTX));
    expect(daemonicRadiationPatch(item, CTX)).toBeNull();
  });

  it("чужая Механика копии сохраняется, иммунитет дописывается после неё", () => {
    const item = staleCopy(bestiaryItem());
    const mine = { id: "mine", operator: "AND", entries: [{ id: "x", kind: "trait" }] };
    item.flags = { [FLAG]: { mechanics: [mine] } };
    applyPatch(item, daemonicRadiationPatch(item, CTX));
    expect(item.flags[FLAG].mechanics).toEqual([mine, ...ALL]);
  });

  it("иммунитеты, уже вписанные ГМом руками (в любых группах), не дублируются", () => {
    const item = staleCopy(bestiaryItem());
    item.flags = { [FLAG]: { mechanics: [
      { id: "g1", operator: "AND", entries: [{ id: "e1", kind: "condition", condMode: "immunity", condKey: "radiation" }] },
      { id: "g2", operator: "AND", entries: [{ id: "e2", kind: "capability", capabilityKey: "poison.immune" }] },
      { id: "g3", operator: "AND", entries: [{ id: "e3", kind: "capability", capabilityKey: "defence.diseaseEffectsImmune" }] }
    ] } };
    expect(daemonicRadiationPatch(item, CTX)).toBeNull();
  });

  it("вписан только один иммунитет — дописываются остальные два", () => {
    const item = staleCopy(bestiaryItem());
    item.flags = { [FLAG]: { mechanics: [
      { id: "g1", operator: "AND", entries: [{ id: "e1", kind: "condition", condMode: "immunity", condKey: "radiation" }] }
    ] } };
    applyPatch(item, daemonicRadiationPatch(item, CTX));
    expect(item.flags[FLAG].mechanics.slice(1)).toEqual([CTX.groups.poison, CTX.groups.disease]);
  });

  it("иммунитет к ДРУГОМУ Состоянию не считается — группа дописывается", () => {
    const item = staleCopy(bestiaryItem());
    item.flags = { [FLAG]: { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "condition", condMode: "immunity", condKey: "stunned" }
    ] }] } };
    expect(daemonicRadiationPatch(item, CTX)).not.toBeNull();
  });

  it("опора «Обновить мир» догоняется той же группой; если ГМ принял и снял иммунитет сам — не возвращается", () => {
    const withBaseline = staleCopy(bestiaryItem());
    withBaseline.flags = { [FLAG]: { contentSync: { mechanicsBaseline: [] } } };
    const patch = daemonicRadiationPatch(withBaseline, CTX);
    expect(patch[`flags.${FLAG}.contentSync.mechanicsBaseline`]).toEqual(ALL);

    const removed = staleCopy(bestiaryItem());
    removed.flags = { [FLAG]: { contentSync: { mechanicsBaseline: ALL } } };
    expect(daemonicRadiationPatch(removed, CTX)).toBeNull();
  });

  it.each([
    "Daemonic Armament (Адский Клинок)",
    "Daemonic Presence / Демоническое Присутствие (10/10)",
    "Daemonic Dread (−10 W) / Демонический Ужас (−10 к W)",
    "Daemonic (+3) / Демонический",
    "Nurgle's Blessing"
  ])("«%s» — не Daemonic этой правки, не трогается", name => {
    const item = staleCopy(bestiaryItem(), { name });
    expect(daemonicRadiationPatch(item, CTX)).toBeNull();
  });

  it("двуязычное «Daemonic (4) / Демонический (4)» Друкхари — по имени, как и «Daemonic (4)»", () => {
    const item = staleCopy(DEMONS[0].daemonic[0], { name: "Daemonic (4) / Демонический (4)" });
    expect(daemonicRadiationPatch(item, CTX)).not.toBeNull();
  });

  it("не Черта (предмет другого типа с тем же именем) не трогается", () => {
    const item = { ...staleCopy(bestiaryItem()), type: "talent" };
    expect(daemonicRadiationPatch(item, CTX)).toBeNull();
  });

  it("пак пересобран не до конца (есть радиация, нет ядов и болезней) — контекст неполный, дописывается только имеющееся", () => {
    const old = baseDoc();
    old.flags[FLAG].mechanics = [CTX.groups.radiation];
    const partial = buildDaemonicContext([old]);
    expect(daemonicContextComplete(partial)).toBe(false);
    expect(partial.groups.poison).toBeNull();
    const item = staleCopy(bestiaryItem());
    applyPatch(item, daemonicRadiationPatch(item, partial));
    expect(item.flags[FLAG].mechanics).toEqual([CTX.groups.radiation]);
  });

  it("в паке нет образца — чинить нечем, патча нет", () => {
    const empty = buildDaemonicContext([]);
    expect(empty.group).toBeNull();
    expect(daemonicContextComplete(empty)).toBe(false);
    expect(daemonicRadiationPatch(staleCopy(bestiaryItem()), empty)).toBeNull();
    expect(daemonicRadiationPatch(staleCopy(baseDoc(), { source: baseDoc().uuid }), empty)).toBeNull();
  });

  it("updates набора копий: только нуждающиеся, с _id", () => {
    const a = staleCopy(bestiaryItem(), { id: "a" });
    const b = staleCopy(bestiaryItem(), { id: "b", name: "Daemonic Armament (X)" });
    const c = applyPatch(staleCopy(bestiaryItem(), { id: "c" }), daemonicRadiationPatch(staleCopy(bestiaryItem()), CTX));
    expect(daemonicRadiationUpdates([a, b, c], CTX).map(u => u._id)).toEqual(["a"]);
  });
});

describe("migrateDaemonicRadiation: прогон по миру", () => {
  beforeEach(() => resetCaptured());

  function world({ actorItems, noPack = false } = {}) {
    const base = baseDoc();
    const updated = [];
    const actor = {
      name: "Демон", items: actorItems,
      updateEmbeddedDocuments: async (_t, ups) => { updated.push(...ups); }
    };
    globalThis.game.user = { isGM: true };
    globalThis.game.items = [];
    globalThis.game.actors = [actor];
    globalThis.game.scenes = [];
    globalThis.game.packs = noPack ? [] : [{
      documentName: "Item", metadata: { packageName: "warhammer-dbc" },
      getDocuments: async () => [base]
    }];
    return { updated };
  }

  it("дописывает иммунитет демону мира и сообщает число", async () => {
    const { updated } = world({ actorItems: [staleCopy(DEMONS[0].daemonic[0], { id: "dd" })] });
    const res = await migrateDaemonicRadiation();
    expect(res).toEqual({ fixed: 1, failed: 0 });
    expect(updated).toHaveLength(1);
    expect(updated[0]._id).toBe("dd");
    expect(updated[0][`flags.${FLAG}.mechanics`]).toEqual(ALL);
  });

  it("повторный прогон по уже починенному ничего не пишет", async () => {
    const { updated } = world({ actorItems: [DEMONS[0].daemonic[0]].map(i => ({ ...i, id: "dd" })) });
    expect(await migrateDaemonicRadiation()).toEqual({ fixed: 0, failed: 0 });
    expect(updated).toEqual([]);
  });

  it("пак без групп ядов и болезней (не пересобран) — сбой, а не частичная правка", async () => {
    const old = baseDoc();
    old.flags[FLAG].mechanics = [CTX.groups.radiation];
    const updated = [];
    const actor = {
      name: "Демон", items: [staleCopy(DEMONS[0].daemonic[0], { id: "dd" })],
      updateEmbeddedDocuments: async (_t, ups) => { updated.push(...ups); }
    };
    globalThis.game.user = { isGM: true };
    globalThis.game.items = [];
    globalThis.game.actors = [actor];
    globalThis.game.scenes = [];
    globalThis.game.packs = [{ documentName: "Item", metadata: { packageName: "warhammer-dbc" }, getDocuments: async () => [old] }];
    const res = await migrateDaemonicRadiation();
    expect(res.failed).toBeGreaterThan(0);
    expect(updated).toEqual([]);
  });

  it("нет образца в компендиуме — это сбой (версия не штампуется), а не «чинить нечего»", async () => {
    const { updated } = world({ actorItems: [staleCopy(DEMONS[0].daemonic[0], { id: "dd" })], noPack: true });
    const res = await migrateDaemonicRadiation();
    expect(res.failed).toBeGreaterThan(0);
    expect(updated).toEqual([]);
  });
});
