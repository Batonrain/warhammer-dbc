// test/rules/disease-immunity.test.mjs
//
// Метка Нургла (корбук, Метки): «иммунитет к негативным эффектам болезней».
// Возможность defence.diseaseEffectsImmune (task-0469-c5ab) читается так:
// предмет типа disease на акторе-носителе Метки НЕ активен (isItemActive,
// apps/effects.mjs), а значит все его записи Конструктора (charRecovery —
// «Гниль Нургла: T не восстанавливается», PR #524) в сбор правил не попадают.
//
// Данные — настоящие JSON packs-src (болезни и Метка), копия на акторе — с
// parent и флагами, как у живого документа.
//
// Возможность НЕ запрашивается через hasRuleFlag: isItemActive зовёт сам сбор
// правил (rules/sources.mjs, источник «items»), и запрос правил изнутри него
// замкнул бы круг — читаем ключ прямо с предметов актора (как vision-aids).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { allPackDocuments, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";
import { isItemActive } from "../../module/apps/effects.mjs";
import { actorRecoveryPolicy } from "../../module/rules/char-loss.mjs";
import {
  DISEASE_IMMUNE_CAP, actorImmuneToDiseaseEffects, diseaseEffectsSuppressed
} from "../../module/rules/disease-immunity.mjs";

const SYS = "warhammer-dbc";
const enName = d => d.name.split("/")[0].trim();

const DISEASES = allPackDocuments("diseases").map(d => d.doc);
const TRAITS = allPackDocuments("traits").map(d => d.doc);
const diseaseDoc = en => DISEASES.find(d => enName(d) === en);
const traitDoc = en => TRAITS.find(d => enName(d) === en);

/** Копия документа пака на акторе: parent, getFlag, плоский flags — как у живого. */
function owned(doc, actor, id) {
  const item = {
    // Болезнь на этом тесте — «больной»: включена (wdbc-dbveg, isItemActive для
    // disease возвращает system.active; в паке болезни выдаются выключенными).
    id, name: doc.name, type: doc.type,
    system: { ...structuredClone(doc.system ?? {}), ...(doc.type === "disease" ? { active: true } : {}) },
    flags: structuredClone(doc.flags ?? {}), parent: actor
  };
  item.getFlag = (s, k) => item.flags?.[s]?.[k];
  return item;
}

function actorWith(docs) {
  const actor = { system: { characteristics: {} }, items: [] };
  docs.forEach((d, i) => actor.items.push(owned(d, actor, `i${i}`)));
  return actor;
}

const ROT = diseaseDoc("Nurgle's Rot");
const NURGLE = traitDoc("Mark of Nurgle");
const SLAANESH = traitDoc("Mark of Slaanesh");

describe("данные", () => {
  it("Гниль Нургла несёт запись charRecovery, Метка Нургла — defence.diseaseEffectsImmune", () => {
    expect(ROT, "Nurgle's Rot в packs-src/diseases").toBeTruthy();
    expect(NURGLE, "Mark of Nurgle в packs-src/traits").toBeTruthy();
    const kinds = ROT.flags[SYS].mechanics.flatMap(g => g.entries).map(e => e.kind);
    expect(kinds).toContain("charRecovery");
    const caps = NURGLE.flags[SYS].mechanics.flatMap(g => g.entries).map(e => e.capabilityKey);
    expect(caps).toContain(DISEASE_IMMUNE_CAP);
  }, PACK_SCAN_TIMEOUT);
});

describe("actorImmuneToDiseaseEffects / diseaseEffectsSuppressed", () => {
  it("без Метки Нургла иммунитета нет, болезнь не гасится", () => {
    const actor = actorWith([ROT]);
    expect(actorImmuneToDiseaseEffects(actor)).toBe(false);
    expect(diseaseEffectsSuppressed(actor.items[0])).toBe(false);
  }, PACK_SCAN_TIMEOUT);

  it("с Меткой Нургла — иммунитет, болезнь гасится", () => {
    const actor = actorWith([ROT, NURGLE]);
    expect(actorImmuneToDiseaseEffects(actor)).toBe(true);
    expect(diseaseEffectsSuppressed(actor.items[0])).toBe(true);
  }, PACK_SCAN_TIMEOUT);

  it("Метка Слаанеш (иммунитет к пыткам) болезни не гасит", () => {
    expect(SLAANESH, "Mark of Slaanesh").toBeTruthy();
    const actor = actorWith([ROT, SLAANESH]);
    expect(actorImmuneToDiseaseEffects(actor)).toBe(false);
  }, PACK_SCAN_TIMEOUT);

  it("гасится только болезнь: прочие предметы с той же механикой не затронуты", () => {
    const actor = actorWith([NURGLE, ROT]);
    const poison = owned({ ...structuredClone(ROT), type: "trait", name: "Яд" }, actor, "p1");
    expect(diseaseEffectsSuppressed(poison)).toBe(false);
  }, PACK_SCAN_TIMEOUT);

  it("болезнь вне актора (компендиум, список мира) — не гасится: носителя Метки нет", () => {
    const loose = owned(ROT, null, "x");
    expect(diseaseEffectsSuppressed(loose)).toBe(false);
  }, PACK_SCAN_TIMEOUT);

  it("предмет типа disease сам не может выдать иммунитет (защита от круга)", () => {
    const actor = { items: [] };
    const fake = owned({ ...structuredClone(NURGLE), type: "disease" }, actor, "d1");
    actor.items.push(fake);
    expect(actorImmuneToDiseaseEffects(actor)).toBe(false);
  }, PACK_SCAN_TIMEOUT);

  it("активность носителя спрашивается: выключенная Метка иммунитета не даёт", () => {
    const actor = actorWith([NURGLE]);
    expect(actorImmuneToDiseaseEffects(actor, () => false)).toBe(false);
    expect(actorImmuneToDiseaseEffects(actor, () => true)).toBe(true);
  }, PACK_SCAN_TIMEOUT);
});

describe("isItemActive: болезнь у носителя Метки Нургла", () => {
  it("болезнь без Метки активна, с Меткой — нет; Метка сама остаётся активной", () => {
    const sick = actorWith([ROT]);
    expect(isItemActive(sick.items[0])).toBe(true);
    const marked = actorWith([ROT, NURGLE]);
    expect(isItemActive(marked.items[0])).toBe(false);
    expect(isItemActive(marked.items[1])).toBe(true);
  }, PACK_SCAN_TIMEOUT);

  it("потеряли Метку — болезнь снова активна (флаг читается живьём, без пересохранения)", () => {
    const actor = actorWith([ROT, NURGLE]);
    const [rot, mark] = actor.items;
    expect(isItemActive(rot)).toBe(false);
    actor.items.splice(actor.items.indexOf(mark), 1);
    expect(isItemActive(rot)).toBe(true);
  }, PACK_SCAN_TIMEOUT);
});

describe("Гниль Нургла → политика восстановления урона в Характеристики (actorRecoveryPolicy)", () => {
  it("без Метки болезнь тормозит восстановление", () => {
    const policy = actorRecoveryPolicy(actorWith([ROT]));
    const slowed = Object.values(policy).filter(p => p.blocked || p.hours > 1);
    expect(slowed.length, "Гниль что-то да замедляет/блокирует").toBeGreaterThan(0);
  }, PACK_SCAN_TIMEOUT);

  it("с Меткой Нургла — восстановление как у здорового (иммунитет к негативным эффектам болезни)", () => {
    const policy = actorRecoveryPolicy(actorWith([ROT, NURGLE]));
    for (const [k, p] of Object.entries(policy)) {
      expect(p.blocked, `${k} blocked`).toBe(false);
      expect(p.hours, `${k} hours`).toBe(1);
      expect(p.sources, `${k} sources`).toEqual([]);
    }
  }, PACK_SCAN_TIMEOUT);

  it("прочие болезни Варпа и обычные тоже гасятся (все записи charRecovery из packs-src)", () => {
    const withRecovery = DISEASES.filter(d =>
      (d.flags?.[SYS]?.mechanics ?? []).some(g => g.entries.some(e => e.kind === "charRecovery")));
    expect(withRecovery.length).toBeGreaterThanOrEqual(5);
    for (const d of withRecovery) {
      const sick = actorRecoveryPolicy(actorWith([d]));
      const slowed = Object.values(sick).some(p => p.blocked || p.hours > 1);
      expect(slowed, `${enName(d)} без Метки`).toBe(true);
      const immune = actorRecoveryPolicy(actorWith([d, NURGLE]));
      expect(Object.values(immune).some(p => p.blocked || p.hours > 1), `${enName(d)} с Меткой`).toBe(false);
    }
  }, PACK_SCAN_TIMEOUT);

  it("Метка Слаанеш болезнь не гасит", () => {
    const policy = actorRecoveryPolicy(actorWith([ROT, SLAANESH]));
    expect(Object.values(policy).some(p => p.blocked || p.hours > 1)).toBe(true);
  }, PACK_SCAN_TIMEOUT);
});
