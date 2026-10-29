// test/rules/psychic-vampire.test.mjs
//
// Пачка I2 (Псайкана, Sahara 3-28, решение владельца 26.10.2026): Психический Вампир — кнопка на
// карточке урона, когда психосила/психосиловое оружие вывели цель из строя; вопрос игроку «есть ли
// у цели душа» (как галочка «Бездушный» у Перемены); тест W+0; при успехе — 1d5 Ран или вся
// Усталость; считается применением наркотика «Зависимость: 6 | W+0 | 6 дней | Агрессия 2» через
// существующий механизм (флаг drugWithdrawal, недельный счётчик доз). Талант — из настоящего пака.

import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import {
  hasPsychicVampire, isPsychicDamage, vampireOffered, VAMPIRE_ADDICTION, vampireDrug,
  VAMPIRE_USAGE_KEY, VAMPIRE_HEAL_FORMULA, vampireWhy
} from "../../module/rules/psychic-vampire.mjs";
import { drugKey, parseFrequency, addictionTestParts, isAddictedTo, addictionRecords } from "../../module/rules/drug-withdrawal.mjs";
import { weeklyDoseLimit, addictionCheckFor } from "../../module/rules/drug-doses.mjs";
import { isKnownCapability } from "../../module/constants/capabilities.mjs";

const doc = () => packDocById("packs-src/talents/Псайкана", "nDoZKGwoQb1n6OdK");
const owned = () => { const d = doc(); return { type: "talent", name: d.name, system: { ...d.system }, flags: {} }; };
const actor = items => ({ type: "character", items, system: {}, getFlag: () => undefined });
const weapon = props => ({ type: "weapon", name: "Посох", system: { weaponProps: props.map(key => ({ key })) } });

describe("Психический Вампир — Талант в настоящем паке", () => {
  it("код опознаёт его по имени из пака", () => {
    expect(hasPsychicVampire(actor([owned()]))).toBe(true);
    expect(hasPsychicVampire(actor([]))).toBe(false);
    expect(hasPsychicVampire(actor([{ ...owned(), type: "gear" }]))).toBe(false);
  });
});

describe("урон «психической мощью»: сила или психосиловое оружие", () => {
  it("психосила — урон несёт тип силы, и пустая строка тоже тип", () => {
    expect(isPsychicDamage({ psychicPowerType: "attack", weapon: null })).toBe(true);
    expect(isPsychicDamage({ psychicPowerType: "", weapon: null })).toBe(true);
  });
  it("психосиловое оружие (свойство Force) — подходит", () => {
    expect(isPsychicDamage({ psychicPowerType: null, weapon: weapon(["force"]) })).toBe(true);
  });
  it("обычное оружие — нет; без оружия и силы — нет", () => {
    expect(isPsychicDamage({ psychicPowerType: null, weapon: weapon(["tearing"]) })).toBe(false);
    expect(isPsychicDamage({ psychicPowerType: null, weapon: null })).toBe(false);
  });
});

describe("когда на карточке урона появляется кнопка", () => {
  const base = { psychicPowerType: "attack", weapon: null, net: 8, woundsAfter: -2 };
  const a = () => actor([owned()]);

  it("есть Талант, психический урон, цель выведена из строя — кнопка", () => {
    expect(vampireOffered(a(), base)).toBe(true);
  });
  it("без Таланта — нет", () => expect(vampireOffered(actor([]), base)).toBe(false));
  it("цель стоит на ногах (Раны > 0) — нет", () => expect(vampireOffered(a(), { ...base, woundsAfter: 3 })).toBe(false));
  it("урон не прошёл (поглощён) — нет", () => expect(vampireOffered(a(), { ...base, net: 0 })).toBe(false));
  it("не психический урон — нет", () => expect(vampireOffered(a(), { ...base, psychicPowerType: null })).toBe(false));
  it("Раны ровно 0 — цель пала", () => expect(vampireOffered(a(), { ...base, woundsAfter: 0 })).toBe(true));
});

describe("Зависимость — через механизм наркотиков, а не своё поле", () => {
  const drug = vampireDrug();
  it("«Зависимость: 6 | W+0 | 6 дней» — те же поля, что у настоящего наркотика", () => {
    expect(VAMPIRE_ADDICTION.hasAddiction).toBe(true);
    expect(VAMPIRE_ADDICTION.minDose).toBe(6);
    expect(addictionTestParts(VAMPIRE_ADDICTION)).toEqual([{ charKey: "wp", mod: 0 }]);
    expect(parseFrequency(VAMPIRE_ADDICTION.frequency)).toBe(6 * 86400);
    expect(VAMPIRE_ADDICTION.penalty).toMatch(/Агрессия/);
    expect(VAMPIRE_ADDICTION.penalty).toMatch(/2/);
  });
  it("препарат-двойник: type drug, своё имя-ключ, без точек", () => {
    expect(drug.type).toBe("drug");
    expect(drugKey(drug)).toBe(drug.name);
    expect(drug.name).not.toMatch(/\./);
    expect(drug.system.addiction).toBe(VAMPIRE_ADDICTION);
  });
  it("недельный лимит доз — 6: шестое применение за неделю даёт тест Зависимости", () => {
    const limit = weeklyDoseLimit({ type: "character", items: [], system: {} }, VAMPIRE_ADDICTION.minDose);
    expect(limit).toBe(6);
    expect(addictionCheckFor(5, limit)).toBeNull();
    expect(addictionCheckFor(6, limit)).not.toBeNull();
  });
  it("запись флага зависимости читается тем же кодом (isAddictedTo, addictionRecords)", () => {
    const entries = { [drugKey(drug)]: { addicted: true, name: drug.name, addiction: VAMPIRE_ADDICTION, lastDose: 0 } };
    expect(isAddictedTo(entries, drug)).toBe(true);
    const recs = addictionRecords([], entries);
    expect(recs).toHaveLength(1);
    expect(recs[0].add.frequency).toBe("6 дней");
  });
});

describe("прочие константы и тексты", () => {
  it("лечение — 1d5 Ран", () => expect(VAMPIRE_HEAL_FORMULA).toBe("1d5"));
  it("раз в Раунд — ключ метки использования совпадает с ключом возможности из реестра", () => {
    expect(isKnownCapability(VAMPIRE_USAGE_KEY)).toBe(true);
    const keys = (doc().flags["warhammer-dbc"].mechanics ?? []).flatMap(g => g.entries ?? []).map(e => e.capabilityKey);
    expect(keys, "Талант в паке несёт тот же ключ").toContain(VAMPIRE_USAGE_KEY);
  });
  it("причины отказа названы по-русски", () => {
    expect(vampireWhy("round")).toMatch(/Раунд/);
    expect(vampireWhy("no-soul")).toMatch(/душ/);
  });
});
