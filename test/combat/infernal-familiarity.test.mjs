// test/combat/infernal-familiarity.test.mjs
//
// Инфернальное Знакомство (Sahara 3-defiance, корбук): «считает всех демонов
// имеющими Рейтинг Страха на 1 ниже настоящего и уменьшает штраф к W от Трейта
// Daemonic Presence на 5». Две половины:
//   1) Страх: против демона (галочка «Демон» в окне Страха) рейтинг на 1 меньше;
//      на 0 — тест не нужен (допущение по образцу Стального Сердца);
//   2) штраф Daemonic Dread, который аура Daemonic Presence выдаёт врагам в
//      радиусе, у носителя на 5 меньше, при нуле не выдаётся, а Талант
//      взяли/потеряли — штраф перевыдаётся.
// Предметы-штрафы Dread берутся из настоящих файлов packs-src/traits.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { _executeFearRoll } from "../../module/combat/fear.mjs";
import { fearIgnore } from "../../module/rules/fear-ignore.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";
import { allPackDocuments, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";
import { reduceDaemonicDread, isDaemonicDread, INFERNAL_FAMILIARITY_CAP } from "../../module/rules/defiance-talents.mjs";
import { sweepAurasOnScene, dreadReductionFor } from "../../module/regions/auras.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";
import fs from "node:fs";
import path from "node:path";

const FLAG = "warhammer-dbc";

/* ───────────────────────────── Страх ───────────────────────────── */

describe("fearIgnore: Инфернальное Знакомство", () => {
  it("демон: Страх 3 считается Страхом 2, автоуспеха нет", () => {
    expect(fearIgnore({ rating: 3, infernal: true })).toMatchObject({ rating: 2, autoPass: false, skip: false });
  });

  it("демон Страха 1: рейтинг 0 — тест не нужен (допущение по образцу Стального Сердца)", () => {
    expect(fearIgnore({ rating: 1, infernal: true })).toMatchObject({ rating: 0, autoPass: true });
  });

  it("без Знакомства рейтинг не меняется", () => {
    expect(fearIgnore({ rating: 3 })).toMatchObject({ rating: 3, autoPass: false });
  });

  it("снижает и порог Infamy: Страх 3 → порог Страха 2 (40+)", () => {
    expect(fearIgnore({ rating: 3, important: true, infamy: 40, infernal: true }).autoPass).toBe(true);
    expect(fearIgnore({ rating: 3, important: true, infamy: 40 }).autoPass).toBe(false);
  });

  it("складывается со Стальным Сердцем: Страх 3 → 1", () => {
    expect(fearIgnore({ rating: 3, infernal: true, steelHeart: true }).rating).toBe(1);
  });

  it("«нельзя игнорировать» снимает и это снижение", () => {
    const r = fearIgnore({ rating: 3, infernal: true, unignorable: true });
    expect(r).toMatchObject({ rating: 3, autoPass: false });
    expect(r.cancelled).toContain("infernal");
  });
});

function makeActor({ talent = false, wp = 40 } = {}) {
  const flags = {};
  return {
    id: "a1", name: "Инквизитор", effects: [],
    items: talent ? [{ type: "talent", name: "Infernal Familiarity / Инфернальное Знакомство", system: {}, flags: {}, getFlag: () => undefined }] : [],
    system: { characteristics: { wp: { total: wp } }, fatigue: { value: 0, max: 0 }, fate: { value: 0 }, fearRating: 0 },
    getFlag: (_s, k) => flags[k], setFlag: async (_s, k, v) => { flags[k] = v; },
    update: async () => {}, createEmbeddedDocuments: async () => [], flags
  };
}
const saved = getRuleSources();
beforeEach(() => { resetCaptured(); clearRuleSources(); });
afterEach(() => { clearRuleSources(); for (const [key, fn] of saved) registerRuleSource(key, fn); });

describe("_executeFearRoll: Инфернальное Знакомство в живом тесте Страха", () => {
  it("демон Страха 3: в карточке Страх 2 (с Талантом) против Страха 3 (без)", async () => {
    await _executeFearRoll(makeActor({ talent: true }), 3, "important", 0, 0, { demon: true });
    expect(captured.chat.at(-1).content).toContain("Страх 2");
    expect(captured.chat.at(-1).content).toContain("Инфернальное Знакомство: демон — Страх 3 → 2");
    resetCaptured();
    await _executeFearRoll(makeActor(), 3, "important", 0, 0, { demon: true });
    expect(captured.chat.at(-1).content).toContain("Страх 3");
  });

  it("Страх 3 НЕ от демона (галочки нет) — Талант не действует", async () => {
    await _executeFearRoll(makeActor({ talent: true }), 3, "important", 0, 0, { demon: false });
    expect(captured.chat.at(-1).content).toContain("Страх 3");
  });

  it("демон Страха 1: тест проходит сам (рейтинг 0)", async () => {
    captured.nextRoll = 99;
    await _executeFearRoll(makeActor({ talent: true }), 1, "important", 0, 0, { demon: true });
    expect(captured.chat.at(-1).content).toContain("выстоял");
    resetCaptured();
    captured.nextRoll = 99;
    await _executeFearRoll(makeActor(), 1, "important", 0, 0, { demon: true });
    expect(captured.chat.at(-1).content).toContain("Провал");
  });
});

/* ────────────────────── Штраф Daemonic Dread ────────────────────── */

const DREADS = Object.fromEntries(allPackDocuments("traits")
  .filter(({ doc }) => /^Daemonic Dread \(/.test(doc.name))
  .map(({ doc }) => [Number(/−(\d+) W/.exec(doc.name)[1]), doc]));
const dread = n => structuredClone(DREADS[n]);
const wpChange = data => data.effects[0].system.changes.find(c => c.key === "system.characteristics.wp.totalFx");

describe("reduceDaemonicDread: на настоящих предметах пака", () => {
  it("в паке четыре штрафа: −5, −10, −15, −20", () => {
    expect(Object.keys(DREADS).map(Number).sort((a, b) => a - b)).toEqual([5, 10, 15, 20]);
  }, PACK_SCAN_TIMEOUT);

  it("−10 → −5: эффект, название и описание пересчитаны, исходник не тронут", () => {
    const src = dread(10);
    const out = reduceDaemonicDread(src, 5);
    expect(wpChange(out).value).toBe(-5);
    expect(out.name).toBe("Daemonic Dread (−5 W) / Демонический Ужас (−5 к W)");
    expect(out.effects[0].name).toBe(out.name);
    expect(out.system.benefit).toContain("−5 к Итого Воли");
    expect(wpChange(src).value).toBe(-10);
  });

  it("−20 → −15, −15 → −10", () => {
    expect(wpChange(reduceDaemonicDread(dread(20), 5)).value).toBe(-15);
    expect(wpChange(reduceDaemonicDread(dread(15), 5)).value).toBe(-10);
  });

  it("−5 → штраф сошёл на нет: выдавать нечего (null)", () => {
    expect(reduceDaemonicDread(dread(5), 5)).toBeNull();
  });

  it("нулевое снижение и не-Dread предмет отдаются как были", () => {
    const d = dread(10);
    expect(reduceDaemonicDread(d, 0)).toBe(d);
    const other = { name: "Nimble (10)", effects: [] };
    expect(isDaemonicDread(other)).toBe(false);
    expect(reduceDaemonicDread(other, 5)).toBe(other);
  });
});

/* ───────────── Выдача штрафа аурой (sweepAurasOnScene) ───────────── */

function item(data, id) {
  const it = { id, name: data.name, type: data.type ?? "trait", system: data.system ?? {}, flags: data.flags ?? {}, effects: data.effects ?? [] };
  it.uuid = `Item.${id}`;
  it.getFlag = (s, k) => it.flags?.[s]?.[k];
  return it;
}

/** Сцена: демон-источник ауры (враг) и персонаж-цель рядом. Возвращает записи create/delete цели. */
function world({ targetItems = [], talent = false, grantDread = 10 } = {}) {
  const log = { created: [], deleted: [] };
  const sourceItem = item({
    name: "Daemonic Presence (10/10)",
    flags: { [FLAG]: { aura: { radius: 10, affects: "enemies", includesSelf: false, grant: [{ uuid: "Compendium.test.Dread", rating: null }], immuneTraitNames: [] } } }
  }, "src1");
  const sourceActor = { uuid: "Actor.demon", items: [sourceItem] };
  const items = [...targetItems];
  if (talent) items.push(item({ type: "talent", name: "Infernal Familiarity / Инфернальное Знакомство" }, "talent1"));
  const targetActor = {
    uuid: "Actor.hero", items,
    deleteEmbeddedDocuments: async (_t, ids) => { log.deleted.push(...ids); },
    createEmbeddedDocuments: async (_t, data) => { log.created.push(...data); return data; }
  };
  const tok = (actor, disposition, x) => ({ actor, disposition, hidden: false, x, y: 0, width: 1, height: 1, elevation: 0 });
  const scene = { id: "scene1", grid: { size: 100, distance: 1 }, tokens: { contents: [tok(sourceActor, -1, 0), tok(targetActor, 1, 300)] } };
  globalThis.game.user = { ...globalThis.game.user, isGM: true };
  globalThis.fromUuid = async uuid => uuid === "Compendium.test.Dread" ? { toObject: () => structuredClone(DREADS[grantDread]) } : null;
  return { scene, log, targetActor };
}

/** Штраф, уже выданный аурой при прошлом прогоне. */
const granted = (n, { reduce } = {}) => item({
  ...structuredClone(DREADS[n]),
  flags: { [FLAG]: { auraSource: "Item.src1", auraScene: "scene1", ...(reduce !== undefined ? { auraReduce: reduce } : {}) } }
}, `dread${n}`);

describe("sweepAurasOnScene: Инфернальное Знакомство смягчает штраф Daemonic Dread", () => {
  it("контроль: без Таланта выдан полный штраф −10, смягчения не записано", async () => {
    const { scene, log } = world();
    await sweepAurasOnScene(scene);
    expect(log.created).toHaveLength(1);
    expect(wpChange(log.created[0]).value).toBe(-10);
    expect(log.created[0].flags[FLAG]).toMatchObject({ auraSource: "Item.src1", auraReduce: 0 });
  }, PACK_SCAN_TIMEOUT);

  it("с Талантом выдан штраф −5, смягчение 5 записано", async () => {
    const { scene, log } = world({ talent: true });
    await sweepAurasOnScene(scene);
    expect(log.created).toHaveLength(1);
    expect(wpChange(log.created[0]).value).toBe(-5);
    expect(log.created[0].flags[FLAG].auraReduce).toBe(5);
  });

  it("штраф −5 с Талантом сходит на нет — ничего не выдаётся", async () => {
    const { scene, log } = world({ talent: true, grantDread: 5 });
    await sweepAurasOnScene(scene);
    expect(log.created).toEqual([]);
  });

  it("Талант взяли после выдачи: прежний −10 снят и выдан заново как −5", async () => {
    const { scene, log } = world({ talent: true, targetItems: [granted(10)] });
    await sweepAurasOnScene(scene);
    expect(log.deleted).toEqual(["dread10"]);
    expect(wpChange(log.created[0]).value).toBe(-5);
  });

  it("Талант потеряли: прежний −5 (смягчение 5) снят и выдан заново как −10", async () => {
    const { scene, log } = world({ targetItems: [granted(5, { reduce: 5 })], grantDread: 10 });
    await sweepAurasOnScene(scene);
    expect(log.deleted).toEqual(["dread5"]);
    expect(wpChange(log.created[0]).value).toBe(-10);
  });

  it("штраф уже выдан при нынешнем смягчении — прогон ничего не трогает (без дублей и перевыдач)", async () => {
    const withTalent = world({ talent: true, targetItems: [granted(10, { reduce: 5 })] });
    await sweepAurasOnScene(withTalent.scene);
    expect(withTalent.log).toEqual({ created: [], deleted: [] });
    const without = world({ targetItems: [granted(10, { reduce: 0 })] });
    await sweepAurasOnScene(without.scene);
    expect(without.log).toEqual({ created: [], deleted: [] });
  });

  it("штраф, выданный до этой правки (флага смягчения нет), у персонажа без Таланта не перевыдаётся", async () => {
    const { scene, log } = world({ targetItems: [granted(10)] });
    await sweepAurasOnScene(scene);
    expect(log).toEqual({ created: [], deleted: [] });
  });
});

describe("Инфернальное Знакомство: данные и реестр", () => {
  it("dreadReductionFor: 5 у носителя (по имени Таланта), 0 у остальных", () => {
    const talent = { type: "talent", name: "Infernal Familiarity / Инфернальное Знакомство", system: {}, flags: {}, getFlag: () => undefined };
    expect(dreadReductionFor({ items: [talent] })).toBe(5);
    expect(dreadReductionFor({ items: [] })).toBe(0);
  });

  it("Талант в паке несёт возможность, реестр называет читателей обеих половин", () => {
    const dir = path.resolve(import.meta.dirname, "../../packs-src/talents/Пси_стойкость");
    const file = fs.readdirSync(dir).find(f => f.startsWith("Infernal_Familiarity"));
    const doc = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    const keys = doc.flags[FLAG].mechanics.flatMap(g => g.entries).map(e => e.capabilityKey);
    expect(keys).toEqual([INFERNAL_FAMILIARITY_CAP]);
    expect(CAPABILITIES[INFERNAL_FAMILIARITY_CAP].reader).toContain("fear-ignore.mjs");
    expect(CAPABILITIES[INFERNAL_FAMILIARITY_CAP].reader).toContain("auras.mjs");
  });
});
