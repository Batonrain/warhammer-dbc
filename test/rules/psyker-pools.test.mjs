// test/rules/psyker-pools.test.mjs
//
// Пачка I1 (Псайкана, Sahara 3-28, решения владельца 26.10.2026): Таланты с
// пулами и экономикой манифестации — Пропускание, Быстрое Плетение, Текучее
// Плетение, Ключевые Силы. Чистая логика — rules/psyker-talents.mjs; Таланты
// берутся из настоящего пака (packDocById), а не выдумываются: тест должен
// упасть, если имя в паке разойдётся с тем, что ищет код.

import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import {
  hasChannel, channelOutcome,
  FAST_WEAVING_POOL, FAST_WEAVING_FLAG, hasFastWeaving, isAttackPower, psychicApCost,
  fastWeavingStart, fastWeavingLeft, fastWeavingGate,
  FLUID_WEAVE_SPENT_FLAG, FLUID_WEAVE_TURN_FLAG, fluidWeaveTalent, fluidWeaveMax, fluidWeaveLeft,
  isFluidWeavePower, fluidWeaveGate,
  SIGNATURE_FLAG, signatureLimit, signatureNames, isSignaturePower, signatureToggle
} from "../../module/rules/psyker-talents.mjs";

const DIR = "packs-src/talents/Псайкана";
const channelDoc = () => packDocById(DIR, "3dNMHPBv9ewCkDbX");
const fastDoc    = () => packDocById(DIR, "T4is6m1SCnsePukP");
const fluidDoc   = () => packDocById(DIR, "CwohM0eNM9r0ODvZ");
const sigDoc     = () => packDocById(DIR, "jyq8XwnrmtLfQrjV");

/** Талант из документа пака, с живыми флагами (как у предмета на акторе). */
function owned(doc, flags = {}) {
  const store = { ...flags };
  const t = { id: doc._id, type: doc.type, name: doc.name, system: { ...doc.system },
    flags: { "warhammer-dbc": store },
    getFlag: (s, k) => store[k] };
  return t;
}
function actor(items = [], { int = 4, surprised = false } = {}) {
  return { type: "character", items, flags: { "warhammer-dbc": {} },
    getFlag(s, k) { return this.flags[s]?.[k]; },
    system: { characteristics: { int: { bonus: int } }, conditions: { surprised } } };
}
const power = (name, system = {}) => ({ type: "psychicPower", name, system: { powerType: "infusion", action: "half", ...system } });

describe("имена Талантов в паке — код опознаёт их по настоящим записям", () => {
  it("Пропускание", () => expect(hasChannel(actor([owned(channelDoc())]))).toBe(true));
  it("Быстрое Плетение", () => expect(hasFastWeaving(actor([owned(fastDoc())]))).toBe(true));
  it("Текучее Плетение", () => expect(fluidWeaveTalent(actor([owned(fluidDoc())]))).not.toBeNull());
  it("Ключевые Силы", () => expect(signatureLimit(actor([owned(sigDoc())]))).toBe(4));
  it("без Талантов — ничего", () => {
    const a = actor();
    expect(hasChannel(a)).toBe(false);
    expect(hasFastWeaving(a)).toBe(false);
    expect(fluidWeaveTalent(a)).toBeNull();
    expect(signatureLimit(a)).toBe(0);
  });
  it("одноимённая Черта/предмет другого типа не считается", () => {
    const fake = { ...owned(channelDoc()), type: "gear" };
    expect(hasChannel(actor([fake]))).toBe(false);
  });
});

describe("Пропускание (Channel): строка в карточке манифестации", () => {
  const a = () => actor([owned(channelDoc())]);

  it("Психофокус удался, Феномена нет — «Проявлений Силы нет»", () => {
    expect(channelOutcome(a(), { path: "psychofocus", focusPassed: true, phenomena: false })).toBe("quiet");
  });
  it("Психофокус удался, но сила вызвала Феномен — Талант не помогает", () => {
    expect(channelOutcome(a(), { path: "psychofocus", focusPassed: true, phenomena: true })).toBe("exposed");
  });
  it("Психофокус провален — строки нет", () => {
    expect(channelOutcome(a(), { path: "psychofocus", focusPassed: false, phenomena: false })).toBe("");
  });
  it("другой Путь Силы — строки нет", () => {
    expect(channelOutcome(a(), { path: "incantation", focusPassed: true, phenomena: false })).toBe("");
    expect(channelOutcome(a(), { path: "", focusPassed: true, phenomena: false })).toBe("");
  });
  it("без Таланта — строки нет", () => {
    expect(channelOutcome(actor(), { path: "psychofocus", focusPassed: true, phenomena: false })).toBe("");
  });
});

describe("тип «Атака» у психосилы", () => {
  it("Атака и Психострельба — это «Атака»; Вливание, Призыв, Клинок, Аура — нет", () => {
    expect(isAttackPower({ powerType: "attack" })).toBe(true);
    expect(isAttackPower({ powerType: "psychicShoot" })).toBe(true);
    expect(isAttackPower({ powerType: "infusion", extraTypes: [{ type: "attack" }] })).toBe(true);
    for (const t of ["infusion", "summon", "psychicBlade", "aura", "change", "touch", "other"])
      expect(isAttackPower({ powerType: t })).toBe(false);
  });
  it("цена действия силы в ОД: полудействие 1, полное 2, остальное — не из пула", () => {
    expect(psychicApCost("half")).toBe(1);
    expect(psychicApCost("full")).toBe(2);
    expect(psychicApCost("free")).toBe(0);
    expect(psychicApCost("reaction")).toBe(0);
    expect(psychicApCost("extended")).toBe(2);   // Длительное — 2 ОД за Ход (action-economy::apCostForActionType)
  });
  it("поле времени силы пусто — по умолчанию полудействие (1 ОД)", () => {
    expect(psychicApCost("")).toBe(1);
    expect(psychicApCost(undefined)).toBe(1);
    expect(psychicApCost(null)).toBe(1);
  });
});

describe("Быстрое Плетение (Fast Weaving): отдельный пул 2 ОД", () => {
  const withPool = (n, opts) => {
    const a = actor([owned(fastDoc())], opts);
    a.flags["warhammer-dbc"][FAST_WEAVING_FLAG] = n;
    return a;
  };

  it("в начале боя пул — 2 ОД, у Врасплох — 0, без Таланта — 0", () => {
    expect(FAST_WEAVING_POOL).toBe(2);
    expect(fastWeavingStart(actor([owned(fastDoc())]))).toBe(2);
    expect(fastWeavingStart(actor([owned(fastDoc())], { surprised: true }))).toBe(0);
    expect(fastWeavingStart(actor())).toBe(0);
  });

  it("остаток читается из метки; Врасплох обнуляет, пока висит состояние", () => {
    expect(fastWeavingLeft(withPool(2))).toBe(2);
    expect(fastWeavingLeft(withPool(1))).toBe(1);
    expect(fastWeavingLeft(withPool(2, { surprised: true }))).toBe(0);
    const noTalent = actor(); noTalent.flags["warhammer-dbc"][FAST_WEAVING_FLAG] = 2;
    expect(fastWeavingLeft(noTalent)).toBe(0);
  });

  it("полудействие не-«Атаки» — можно, цена 1 из 2", () => {
    const g = fastWeavingGate(withPool(2), power("Aura of Peace", { powerType: "aura", action: "half" }));
    expect(g).toMatchObject({ ok: true, cost: 1, left: 2 });
  });

  it("полное действие — 2 ОД; при остатке 1 пул покрывает только 1 (остальное — из обычных ОД)", () => {
    const p = power("Big Thing", { powerType: "summon", action: "full" });
    expect(fastWeavingGate(withPool(2), p)).toMatchObject({ ok: true, cost: 2, cover: 2 });
    expect(fastWeavingGate(withPool(1), p)).toMatchObject({ ok: true, cost: 2, cover: 1 });
  });

  it("сила с типом «Атака» — отказ", () => {
    expect(fastWeavingGate(withPool(2), power("Smite", { powerType: "attack" })))
      .toMatchObject({ ok: false, code: "attack" });
    expect(fastWeavingGate(withPool(2), power("Psy Shoot", { powerType: "psychicShoot" })))
      .toMatchObject({ ok: false, code: "attack" });
  });

  it("Врасплох — отказ с причиной", () => {
    expect(fastWeavingGate(withPool(2, { surprised: true }), power("X")))
      .toMatchObject({ ok: false, code: "surprised" });
  });

  it("свой Ход — пул уже сброшен, отказ", () => {
    expect(fastWeavingGate(withPool(2), power("X"), { ownTurn: true }))
      .toMatchObject({ ok: false, code: "own-turn" });
  });

  it("пустой пул и нет Таланта — отказ", () => {
    expect(fastWeavingGate(withPool(0), power("X"))).toMatchObject({ ok: false, code: "empty" });
    expect(fastWeavingGate(actor(), power("X"))).toMatchObject({ ok: false, code: "no-talent" });
  });

  it("бесплатное действие и Реакция пулом не оплачиваются — платить нечем; Длительное (2 ОД) покрывается", () => {
    for (const action of ["free", "reaction"])
      expect(fastWeavingGate(withPool(2), power("X", { action }))).toMatchObject({ ok: false, code: "cost" });
    expect(fastWeavingGate(withPool(2), power("X", { action: "extended" }))).toMatchObject({ ok: true, cover: 2 });
  });
});

describe("Текучее Плетение (Fluid Weave): пул I.b + «переплести»", () => {
  const fw = (spent = 0, int = 4) => {
    const t = owned(fluidDoc(), { [FLUID_WEAVE_SPENT_FLAG]: spent });
    return actor([t], { int });
  };
  const sustained = (type = "infusion", extra = {}) => power("Kinetic Shell", { powerType: type, isSustained: true, ...extra });

  it("пул — I.b, остаток — I.b минус потраченное, не ниже 0", () => {
    expect(fluidWeaveMax(fw(0, 4))).toBe(4);
    expect(fluidWeaveLeft(fw(1, 4))).toBe(3);
    expect(fluidWeaveLeft(fw(9, 4))).toBe(0);
    expect(fluidWeaveLeft(fw(0, 6))).toBe(6);
    expect(fluidWeaveMax(actor())).toBe(0);
  });

  it("Вливание, Призыв и Психический Клинок — можно; Атака и Аура — нет", () => {
    for (const t of ["infusion", "summon", "psychicBlade"]) {
      expect(isFluidWeavePower({ powerType: t })).toBe(true);
      expect(fluidWeaveGate(fw(), sustained(t)).ok).toBe(true);
    }
    for (const t of ["attack", "aura", "change"]) {
      expect(isFluidWeavePower({ powerType: t })).toBe(false);
      expect(fluidWeaveGate(fw(), sustained(t))).toMatchObject({ ok: false, code: "type" });
    }
  });

  it("«развеять» можно только то, что сейчас поддерживается", () => {
    expect(fluidWeaveGate(fw(), power("X", { powerType: "infusion", isSustained: false })))
      .toMatchObject({ ok: false, code: "not-sustained" });
  });

  it("очки кончились — отказ", () => {
    expect(fluidWeaveGate(fw(4, 4), sustained())).toMatchObject({ ok: false, code: "empty" });
  });

  it("раз в Ход: в бою вторая попытка отказ, вне боя метка Хода не учитывается", () => {
    const a = fw();
    a.flags["warhammer-dbc"][FLUID_WEAVE_TURN_FLAG] = true;
    expect(fluidWeaveGate(a, sustained(), { inCombat: true })).toMatchObject({ ok: false, code: "used-this-turn" });
    expect(fluidWeaveGate(a, sustained(), { inCombat: false }).ok).toBe(true);
  });

  it("без Таланта — отказ", () => {
    expect(fluidWeaveGate(actor(), sustained())).toMatchObject({ ok: false, code: "no-talent" });
  });
});

describe("Ключевые Силы (Signature Powers): до I.b выбранных сил", () => {
  const sig = (names, spec = "", int = 4) => {
    const t = owned(sigDoc(), names === undefined ? {} : { [SIGNATURE_FLAG]: names });
    t.system.specialization = spec;
    return actor([t], { int });
  };

  it("сила выбрана галочкой — ключевая; чужая — нет; двуязычное имя по любой половине", () => {
    const a = sig(["Smite"]);
    expect(isSignaturePower(a, power("Smite / Сокрушение"))).toBe(true);
    expect(isSignaturePower(a, power("Force Bolt / Силовой Снаряд"))).toBe(false);
  });

  it("выбор из поля «Специализация» тоже читается (список через запятую)", () => {
    const a = sig([], "Smite, Force Bolt");
    expect(isSignaturePower(a, power("Smite / Сокрушение"))).toBe(true);
    expect(isSignaturePower(a, power("Force Bolt / Силовой Снаряд"))).toBe(true);
    expect(isSignaturePower(a, power("Cleansing Flame / Очищающее Пламя"))).toBe(false);
  });

  it("сверх I.b — излишек отметается: считаются только первые I.b", () => {
    const a = sig(["A", "B", "C", "D", "E"], "", 4);
    expect(signatureNames(a)).toEqual(["A", "B", "C", "D"]);
    expect(isSignaturePower(a, power("E"))).toBe(false);
    // I упал до 3 — четвёртая отметается сама
    const b = sig(["A", "B", "C", "D"], "", 3);
    expect(isSignaturePower(b, power("D"))).toBe(false);
    expect(isSignaturePower(b, power("C"))).toBe(true);
  });

  it("урон в Интеллект ключевые силы не отметает (книга: «кроме как от урона в I»)", () => {
    const a = sig(["A", "B", "C", "D"], "", 3);          // I.b упал до 3 — обычное падение, четвёртая отметается
    expect(signatureNames(a)).toEqual(["A", "B", "C"]);
    const dmg = sig(["A", "B", "C", "D"], "", 3);         // то же, но потеря — именно от урона в I
    dmg.system.characteristics.int.total = 38;
    dmg.system.charLoss = { int: 5 };                     // без урона было бы 43 → I.b 4
    expect(signatureLimit(dmg)).toBe(4);
    expect(signatureNames(dmg)).toEqual(["A", "B", "C", "D"]);
  });

  it("без Таланта сил нет", () => {
    expect(isSignaturePower(actor(), power("Smite"))).toBe(false);
  });

  it("переключатель: добавляет в список до I.b, дальше — отказ с причиной", () => {
    let a = sig(["A", "B", "C"], "", 4);
    const add = signatureToggle(a, power("D / Д"));
    expect(add).toMatchObject({ ok: true, names: ["A", "B", "C", "D"] });
    a = sig(["A", "B", "C", "D"], "", 4);
    expect(signatureToggle(a, power("E"))).toMatchObject({ ok: false, code: "limit" });
  });

  it("переключатель: повторное нажатие снимает отметку", () => {
    const a = sig(["A", "B"], "", 4);
    expect(signatureToggle(a, power("B"))).toMatchObject({ ok: true, names: ["A"] });
  });

  it("сила, заданная в «Специализации», галочкой не снимается — подсказка, где править", () => {
    const a = sig([], "Smite", 4);
    expect(signatureToggle(a, power("Smite"))).toMatchObject({ ok: false, code: "spec" });
  });

  it("без Таланта переключатель отказывает", () => {
    expect(signatureToggle(actor(), power("X"))).toMatchObject({ ok: false, code: "no-talent" });
  });
});

describe("метки Хода: пул Быстрого Плетения и «раз в Ход» Текучего гаснут в начале СВОЕГО Хода", () => {
  it("обе метки — в реестре turn-flags и гасятся штатным сбросом", async () => {
    const { turnStartFlagClears } = await import("../../module/rules/turn-flags.mjs");
    const flags = { [FAST_WEAVING_FLAG]: 2, [FLUID_WEAVE_TURN_FLAG]: true };
    const upd = turnStartFlagClears({ flags: { "warhammer-dbc": flags }, getFlag: (_s, k) => flags[k] });
    expect(upd).toEqual({
      [`flags.warhammer-dbc.-=${FAST_WEAVING_FLAG}`]: null,
      [`flags.warhammer-dbc.-=${FLUID_WEAVE_TURN_FLAG}`]: null
    });
  });
});

describe("записи Конструктора в паке: ключи возможностей и заметки", () => {
  const entries = doc => (doc.flags["warhammer-dbc"].mechanics ?? []).flatMap(g => g.entries ?? []);
  it.each([
    ["Пропускание", channelDoc, "psyker.core.channel"],
    ["Быстрое Плетение", fastDoc, "psyker.core.fastWeaving"],
    ["Текучее Плетение", fluidDoc, "psyker.core.fluidWeave"],
    ["Ключевые Силы", sigDoc, "psyker.core.signaturePowers"]
  ])("%s: одна запись kind:capability с ключом %s и заметка «Реализовано»", (_n, load, key) => {
    const doc = load();
    const es = entries(doc);
    expect(es.map(e => [e.kind, e.capabilityKey])).toEqual([["capability", key]]);
    expect(doc.system.notes).toMatch(/^Реализовано/);
  });
});
