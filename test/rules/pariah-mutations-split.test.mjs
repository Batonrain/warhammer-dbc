// test/rules/pariah-mutations-split.test.mjs
//
// Спорные мутации и Дары в Пустоте Парии (task-f568, таблица
// docs/pariah-mutations-table.md, утверждена 21.11.2026): гаснут только
// варповые части, тело остаётся. Три вида гашения — запись Механики
// (when.predicates), кнопка kind:"script" (pariahVoidBlocks) и читатель по
// имени предмета (inVoidMark); плюс пересборка выданного при входе в Пустоту.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { hasRuleFlag } from "../../module/rules/flags.mjs";
import { entryWhenOk } from "../../module/rules/mech-when.mjs";
import { collectTestMods } from "../../module/rules/roll-mods.mjs";
import { inVoidMark, pariahVoidBlocks, hasVoidGatedEntries, withVoidGate } from "../../module/rules/void-split.mjs";
import { hasBlackEyesDarknessImmunity } from "../../module/rules/black-eyes.mjs";
import { blackEyesFreeHalfAim } from "../../module/rules/aiming.mjs";
import { darkMuseAssistBonus } from "../../module/rules/craft-advantage.mjs";
import { egomaniaAutoWins } from "../../module/rules/egomania.mjs";
import { ablativeRegenCap } from "../../module/combat/ablative-wounds.mjs";
import { resplendentRaimentAvailable } from "../../module/combat/resplendent-raiment.mjs";
import { ELITE_SCRIPT_API } from "../../module/combat/elite-api/index.mjs";

const NS = "warhammer-dbc";
const GEN = "packs-src/mutations/Общие_мутации";
const SL = "packs-src/mutations/Дары_Богов/Слаанеш";
const VOID = { type: "trait", name: "In the Pariah's Void / В Пустоте Парии", system: {} };

const doc = (dir, id, sub = null) => {
  const d = structuredClone(packDocById(dir, id));
  if (sub !== null) d.system.submutation = { label: sub };
  d.getFlag = (s, k) => d.flags?.[s]?.[k];
  return d;
};
function mkActor(items, { inVoid = false, system = {} } = {}) {
  const list = [...items, ...(inVoid ? [VOID] : [])];
  return { id: "A", uuid: "Actor.A", name: "Мутант", type: "character",
    system: { characteristics: {}, ...system },
    items: Object.assign(list, { contents: list }), getFlag: () => undefined };
}
const entry = (item, id) => item.flags[NS].mechanics.flatMap(g => g.entries).find(e => e.id === id);
const both = (items, opts = {}) => [mkActor(items, opts), mkActor(items, { ...opts, inVoid: true })];

describe("метка Пустоты и помощники", () => {
  it("inVoidMark по Черте-метке ауры", () => {
    expect(inVoidMark(mkActor([]))).toBe(false);
    expect(inVoidMark(mkActor([], { inVoid: true }))).toBe(true);
  });
  it("withVoidGate добавляет гейт, не трогая прочие условия", () => {
    expect(withVoidGate({ negate: false, conditions: [], submutations: ["9"] }))
      .toEqual({ negate: false, conditions: [], submutations: ["9"], predicates: { inPariahVoid: false } });
    expect(hasVoidGatedEntries([{ entries: [{ when: withVoidGate(null) }] }])).toBe(true);
    expect(hasVoidGatedEntries([{ entries: [{ when: {} }] }])).toBe(false);
  });
});

describe("вид 1: живые правила записи (capability/testMod/reroll)", () => {
  it("Панцирь 9 «Цветастые Перья» гаснет, Панцирь 8 (плоть) — нет", () => {
    const [out, inn] = both([doc(GEN, "2n52RpWDImyz3Ev1", "9")]);
    expect(hasRuleFlag(out, "armor.apVsWarpFull")).toBe(true);
    expect(hasRuleFlag(inn, "armor.apVsWarpFull")).toBe(false);
    expect(hasRuleFlag(mkActor([doc(GEN, "2n52RpWDImyz3Ev1", "8")], { inVoid: true }), "weaponPropertyImmunity.flame")).toBe(true);
  });
  it("Эгомания: автопобеды в соц. тесте в Пустоте нет", () => {
    const [out, inn] = both([doc(SL, "dGMt8yHC6KWNBohb")]);
    expect(egomaniaAutoWins(out, "charm")).toBe(true);
    expect(egomaniaAutoWins(inn, "charm")).toBe(false);
  });
  it("Абсурдно Толстый: реген аблативных гаснет", () => {
    const sys = { wounds: { ablativeMax: 10, ablative: 3 } };
    const [out, inn] = both([doc("packs-src/mutations/Дары_Богов/Нургл", "NEpfWFtgJU3Bb7iN")], { system: sys });
    expect(ablativeRegenCap(out)).toBe(10);
    expect(ablativeRegenCap(inn)).toBe(0);
  });
  it("Прародитель: +30 встречным психосилам гаснет, социальный +30 остаётся", () => {
    const [out, inn] = both([doc(SL, "STckfnn1Yvihb86U")]);
    const labels = a => collectTestMods(a, { kind: "skill", skill: "charm", char: "fel" }).parts.map(p => p.label).join("|");
    // social остаётся в обоих
    expect(labels(inn)).toBe(labels(out));
    const it2 = entry(doc(SL, "STckfnn1Yvihb86U"), "progenitor-opposed");
    expect(entryWhenOk(out, it2)).toBe(true);
    expect(entryWhenOk(inn, it2)).toBe(false);
  });
  it("Аватар Алчности, Гермафродит, Циклоп, Множественные Глаза 1 — записи гаснут", () => {
    const cases = [
      [SL, "GZizazJkEvy2U8P6", null, "gift.slaanesh.avatarOfGreed"],
      [SL, "KFkKkRuN2SKahOEh", null, "gift.slaanesh.hermaphrodite"],
      [GEN, "Hdb0dzfpQKp8TkkD", null, "mutation.cyclops"],
      [GEN, "QNkitLzwFw8vE4Gn", "1", "mutation.multipleEyes.pseudoNavigator"]
    ];
    for (const [dir, id, sub, key] of cases) {
      const [out, inn] = both([doc(dir, id, sub)]);
      expect(hasRuleFlag(out, key), key).toBe(true);
      expect(hasRuleFlag(inn, key), key).toBe(false);
    }
  });
});

describe("вид 2: выданное записью (Черты, атаки, снаряжение) — гейт и пересборка", () => {
  it("Центавр 9 «Вихрь» гаснет, Центавр 6 — нет", () => {
    const c9 = doc(GEN, "y8tSRrNuEXuD3KcP", "9");
    const [out, inn] = both([c9]);
    for (const id of ["centaur-9-crawler", "centaur-9-sturdy", "centaur-9-jumper", "centaur-9-catfall"]) {
      expect(entryWhenOk(out, entry(c9, id), c9), id).toBe(true);
      expect(entryWhenOk(inn, entry(c9, id), c9), id).toBe(false);
    }
    const c6 = doc(GEN, "y8tSRrNuEXuD3KcP", "6");
    expect(entryWhenOk(mkActor([c6], { inVoid: true }), entry(c6, "centaur-6-crawler"), c6)).toBe(true);
  });
  it("Пожиратель: вне Пустоты — укус Pen 20/Felling, в Пустоте — вариант без них", () => {
    const dv = doc(GEN, "JRFzM8VPy6L5IX7K");
    const [out, inn] = both([dv]);
    const full = entry(dv, "devourer-bite"), weak = entry(dv, "devourer-bite-void");
    expect([entryWhenOk(out, full, dv), entryWhenOk(out, weak, dv)]).toEqual([true, false]);
    expect([entryWhenOk(inn, full, dv), entryWhenOk(inn, weak, dv)]).toEqual([false, true]);
    const w = packDocById("packs-src/weapons/Интегральные_атаки", "DevourVoidBite01");
    expect(w.system.penetration).toBe(0);
    expect(w.system.weaponProps).toEqual([]);
    expect(weak.equipSourceUuid).toContain("DevourVoidBite01");
  });
  it("Стрелковая Атака: 9 гаснет, 7 (кислота) остаётся", () => {
    const r9 = doc(GEN, "7k8oYNLPdOI52qzx", "9"), r7 = doc(GEN, "7k8oYNLPdOI52qzx", "7");
    expect(entryWhenOk(mkActor([r9], { inVoid: true }), entry(r9, "ranged-9"), r9)).toBe(false);
    expect(entryWhenOk(mkActor([r7], { inVoid: true }), entry(r7, "ranged-7"), r7)).toBe(true);
  });
  it("Рога 1/6/8, Странные Руки 10, Красота, Интеллект — записи с гейтом", () => {
    const ids = {
      [`${GEN}|7gVtvzDAlpTU48cd`]: ["majestichorns-1-shield", "majestichorns-6-social", "majestichorns-6-command", "majestichorns-8-flame"],
      [`${GEN}|ApXVLD3qzW9ngnuC`]: ["strangeHands-sub10-ghostArms"],
      ["packs-src/mutations/Дары_Богов/Тзинч|nVS5HfCDMmCSC2Jl"]: ["massint-unnatural"]
    };
    for (const [k, list] of Object.entries(ids)) {
      const [dir, id] = k.split("|");
      const it3 = doc(dir, id);
      for (const e of list) expect(entry(it3, e).when.predicates, e).toEqual({ inPariahVoid: false });
      expect(hasVoidGatedEntries(it3.flags[NS].mechanics)).toBe(true);
    }
  });
  it("Бессмертная Красота: «тяжело ранен ИЛИ без части тела» — гейт Пустоты через «И» (predicatesAll)", () => {
    const ib = doc(SL, "sBzuRTFAO2ZN2Kmt");
    const e = entry(ib, "immortalBeauty-regen");
    expect(e.when.anyOf).toBe(true);
    expect(e.when.predicatesAll).toEqual({ inPariahVoid: false });
    const heavy = inVoid => ({ ...mkActor([ib], { inVoid }), system: { wounds: { tier: "heavy" }, conditions: {} } });
    expect(entryWhenOk(heavy(false), e, ib)).toBe(true);
    expect(entryWhenOk(heavy(true), e, ib)).toBe(false);
    expect(withVoidGate({ anyOf: true }).predicatesAll).toEqual({ inPariahVoid: false });
  });
  it("вход в Пустоту пересобирает выданное у спорной мутации (syncNullZoneSuppression)", async () => {
    const mech = await import("../../module/apps/mechanics.mjs");
    const c9 = doc(GEN, "y8tSRrNuEXuD3KcP", "9");
    c9.id = "cen"; c9.type = "mutation"; c9.effects = [];
    c9.setFlag = async (s, k, v) => { c9.flags[s][k] = v; };
    const granted = ["centaur-9-crawler", "centaur-9-sturdy"].map((eid, n) => ({
      id: `g${n}`, type: "trait", name: `G${n}`, system: {},
      flags: { [NS]: { grantedByItem: "cen", abilityEntryId: eid } },
      getFlag(s, k) { return this.flags[s]?.[k]; }
    }));
    const list = [c9, ...granted, { ...VOID, getFlag: () => undefined }];
    const actor = Object.assign(Object.create(globalThis.Actor.prototype), {
      id: "A", name: "Центавр", type: "character", system: {},
      items: Object.assign(list, { contents: list }), getFlag: () => undefined,
      deleteEmbeddedDocuments: async (_t, ids) => { for (const id of ids) list.splice(list.findIndex(i => i.id === id), 1); },
      createEmbeddedDocuments: async () => []
    });
    c9.parent = actor;
    await mech.syncNullZoneSuppression(actor);
    expect(list.some(i => i.flags?.[NS]?.abilityEntryId === "centaur-9-crawler")).toBe(false);
    expect(c9.flags[NS].nullSuppressed).toBeFalsy();
  });
});

describe("вид 3: кнопки kind:\"script\" — проверка внутри", () => {
  it("pariahVoidBlocks: в Пустоте блокирует, вне — нет; виден скриптам", () => {
    expect(pariahVoidBlocks(mkActor([]), "т")).toBe(false);
    expect(pariahVoidBlocks(mkActor([], { inVoid: true }), "т")).toBe(true);
    expect(typeof ELITE_SCRIPT_API.pariahVoidBlocks).toBe("function");
    expect(typeof ELITE_SCRIPT_API.inVoidMark).toBe("function");
  });
  it("Лики: проверка Пустоты стоит ДО траты Бесчестия; в Пустоте скрипт не тратит", async () => {
    const dirs = [["packs-src/mutations/Дары_Богов/Кхорн", "wkpvChQkINn5SodJ", "khorne"], ["packs-src/mutations/Дары_Богов/Нургл", "6Oya0s1omuOqYP8L", "nurgle"],
                  [SL, "YXV2wWWT2P8KrasN", "slaanesh"], ["packs-src/mutations/Дары_Богов/Тзинч", "Lci03nSWXLRbQ8ys", "tzeentch"]];
    for (const [dir, id, god] of dirs) {
      const code = entry(doc(dir, id), `countenanceOfGods-${god}-fear`).code;
      expect(code.indexOf("pariahVoidBlocks(")).toBeGreaterThan(-1);
      expect(code.indexOf("pariahVoidBlocks(")).toBeLessThan(code.indexOf("changeActorInfamy("));
      let spent = 0;
      const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
      const fn = new AsyncFn("actor", "speaker", "pariahVoidBlocks", "actorInfamyValue", "changeActorInfamy", "buildCountenanceFearFlag", code);
      await fn(mkActor([], { inVoid: true }), {}, pariahVoidBlocks, () => 3, async () => { spent++; }, () => ({}));
      expect(spent, god).toBe(0);
    }
  });
  it("Нарцисс: подпись о Пустоте в карточке", () => {
    const code = entry(doc(SL, "8qxZRIA1IT3N7h2k"), "narcissus-script").code;
    expect(code).toContain("inVoidMark(actor)");
  });
});

describe("вид 4: читатели по имени предмета", () => {
  const BE = () => doc(SL, "Hlw5CFjMVy0OCF9z");
  it("Чёрные Глаза: Cor 60+ морок и Cor 80+ Полу-Прицеливание гаснут", () => {
    const sys = { corruption: { value: 85 } };
    const [out, inn] = both([BE()], { system: sys });
    expect(hasBlackEyesDarknessImmunity(out)).toBe(true);
    expect(hasBlackEyesDarknessImmunity(inn)).toBe(false);
    expect(blackEyesFreeHalfAim(out, { seesTarget: true })).toBe(true);
    expect(blackEyesFreeHalfAim(inn, { seesTarget: true })).toBe(false);
  });
  it("Тёмная Муза: в Пустоте ассистент без +30", () => {
    const [out, inn] = both([doc(SL, "TsGibkPHbezrzIiA")]);
    expect(darkMuseAssistBonus(out)).toBe(30);
    expect(darkMuseAssistBonus(inn)).toBe(0);
  });
  it("Щупальце 9 и Освежеванный: кнопки листа отказывают в Пустоте", async () => {
    const { toggleTentacleHandForm } = await import("../../module/apps/tentacle-hand-form.mjs");
    const { useFlayed } = await import("../../module/apps/flayed.mjs");
    const warns = [];
    const prevUi = globalThis.ui;
    globalThis.ui = { ...(prevUi ?? {}), notifications: { warn: m => warns.push(m), info: () => {} } };
    try {
      const t = doc(GEN, "nUfrCbj7cIAEWope", "9");
      let set = 0;
      t.setFlag = async () => { set++; };
      await toggleTentacleHandForm(mkActor([t], { inVoid: true }), t);
      expect(set).toBe(0);
      const fl = doc(GEN, "tYexhV8bV5fx01XG");
      await useFlayed(mkActor([fl], { inVoid: true }), fl);
      expect(warns.join("|")).toMatch(/Щупальце.*Пустоте.*\|Освежеванный.*Пустоте/);
    } finally { globalThis.ui = prevUi; }
  });
  it("Блистательные Одеяния: «приковать всех» недоступно в Пустоте", () => {
    const [out, inn] = both([doc(SL, "1f0sr1mkg4k8Nybh")]);
    expect(resplendentRaimentAvailable(out)).toBe(true);
    expect(resplendentRaimentAvailable(inn)).toBe(false);
  });
});
