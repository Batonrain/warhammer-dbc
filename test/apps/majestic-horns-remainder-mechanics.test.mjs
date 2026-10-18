// test/apps/majestic-horns-remainder-mechanics.test.mjs
//
// wdbc-1rno.10, остаток Majestic Horns: 1 (Однорогий — щит-дефлектор в голову),
// 7 (Рог Чумоноса — обломок в ране) и 9 (Зрящие Рога — запрет авточувств и
// визоров). Страж на РЕАЛЬНЫЕ данные пака + чистые функции движка.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import { resolveKindOutcome } from "../../module/rules/kind-outcome.mjs";
import { mechFormulaTotalSafe } from "../../module/rules/mech-formula.mjs";
import { _shieldCoversLocation } from "../../module/combat/damage.mjs";
import { ratingTemplateOf, applyRatingTemplate } from "../../module/rules/integral-rating.mjs";
import { hasLodgedHorn, lodgesHorn, isPlagueHorn, hornRegrowLeft, regrowLabel,
         HORN_REGROW_SECONDS } from "../../module/rules/lodged-horn.mjs";
import { isVisionAid, visionAidsBlocked, visionAidBlocked } from "../../module/rules/vision-aids.mjs";
import { isItemActive } from "../../module/apps/effects.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

const horns = packDocById("packs-src/mutations/Общие_мутации", "7gVtvzDAlpTU48cd");
const shield = packDocById("packs-src/shields/Чародейский", "NXVolJ8jj4rI18dA");
const WEAPONS = "packs-src/weapons/Интегральные_атаки";
const plagueHorn = packDocById(WEAPONS, "sH9dDNM8LIXVcDxw");
const breakOff = packDocById(WEAPONS, "QL8XzDdndPfW3C0a");
const entries = horns.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
const bySub = label => entries.filter(e => (e.when?.submutations ?? []).includes(label));
const flagsOf = d => d.flags?.["warhammer-dbc"] ?? {};
const withFlags = doc => ({ ...doc, getFlag: (s, k) => doc.flags?.[s]?.[k] });

describe("Majestic Horns: 1 — Однорогий (щит-дефлектор 1-50 в голову)", () => {
  it("запись выдаёт предмет-щит из пака, только при выпавшей 1", () => {
    const e = bySub("1").find(x => x.kind === "equipment");
    expect(e.equipSourceUuid).toBe(`Compendium.warhammer-dbc.shields.Item.${shield._id}`);
    expect(bySub("1")).toHaveLength(1);
  });

  it("щит: чародейский дефлектор 1-50, не перегружается, всегда включён", () => {
    expect(shield.type).toBe("forcefield");
    expect(shield.system).toMatchObject({ shieldNature: "warp", shieldType: "deflector", ratingMin: 1,
      ratingMax: 50, currentRating: 50, overloadThreshold: 0, equipped: true, status: "active" });
  });

  it("срабатывает на Голову, но не на Глаз и не на остальное тело", () => {
    const item = withFlags(shield);
    expect(_shieldCoversLocation(item, "Голова")).toBe(true);
    for (const loc of ["Глаз (Голова)", "Торс", "Сочленение / Шея", "Левая рука"])
      expect(_shieldCoversLocation(item, loc), loc).toBe(false);
  });

  it("обычный щит без флага защищает всё тело, как раньше", () => {
    expect(_shieldCoversLocation({ getFlag: () => undefined }, "Торс")).toBe(true);
    expect(_shieldCoversLocation({ getFlag: () => [] }, "Торс")).toBe(true);
  });
});

describe("Majestic Horns: 7 — Рог Чумоноса", () => {
  it("профиль: Rng 0, 1d10+X R, Pen X, Reinforced, Toxic (4) — а не 2d10 обычных Рогов", () => {
    for (const w of [plagueHorn, breakOff]) {
      expect(w.system.range).toBe(0);
      expect(w.system.damage).toBe("1d10+X");
      expect(w.system.damageType).toBe("rending");
      expect(flagsOf(w).penetrationFromRating).toBe(true);
      expect(w.system.weaponProps).toContainEqual({ key: "toxic", rating: 4 });
      expect(w.system.weaponProps).toContainEqual({ key: "reinforced" });
      expect(flagsOf(w).plagueHorn).toBe(true);
    }
  });

  it("X = ½Cor.b (окр.▼) подставляется в образец: Cor.b 7 → X 3", () => {
    const rating = mechFormulaTotalSafe("floor(cor/2)", { cor: 7 });
    const t = ratingTemplateOf(plagueHorn.system, flagsOf(plagueHorn));
    expect(applyRatingTemplate(t, rating)).toEqual({ damage: "1d10+3", penetration: 3 });
  });

  it("«Обломить Рог» — то же оружие плюс Проникающее и метка lodgesHorn; обычный удар без них", () => {
    expect(breakOff.system.weaponProps).toContainEqual({ key: "piercing" });
    expect(lodgesHorn(withFlags(breakOff))).toBe(true);
    expect(plagueHorn.system.weaponProps.map(p => p.key)).not.toContain("piercing");
    expect(lodgesHorn(withFlags(plagueHorn))).toBe(false);
    expect(isPlagueHorn(withFlags(plagueHorn)) && isPlagueHorn(withFlags(breakOff))).toBe(true);
  });

  it("обе записи выдачи — под 7, с формулой X", () => {
    const es = bySub("7").filter(x => x.kind === "integralAttack");
    expect(es.map(x => x.equipSourceUuid.split(".").pop()).sort()).toEqual([breakOff._id, plagueHorn._id].sort());
    for (const e of es) expect(e.integralRating).toBe("floor(cor/2)");
  });
});

describe("Рог в ране (rules/lodged-horn.mjs): тесты T цели", () => {
  const victim = ({ mark, wounds = {} } = {}) => ({
    system: { race: "human", characteristics: {}, conditions: {}, piercingWounds: wounds },
    items: [], setFlag: async () => {},
    getFlag: (s, k) => (k === "lodgedHorn" ? mark : undefined)
  });
  const tTest = a => ({ actor: a, kind: "skill", char: "t" });

  it("метка есть и Проникающее в той же локации не снято — рог в ране", () => {
    expect(hasLodgedHorn(victim({ mark: { armorKey: "head" }, wounds: { head: 1 } }))).toBe(true);
  });

  it("рог извлекли (рана 0), метки нет или рана в другой локации — эффекта нет", () => {
    expect(hasLodgedHorn(victim({ mark: { armorKey: "head" }, wounds: { head: 0 } }))).toBe(false);
    expect(hasLodgedHorn(victim({ wounds: { head: 1 } }))).toBe(false);
    expect(hasLodgedHorn(victim({ mark: { armorKey: "head" }, wounds: { body: 1 } }))).toBe(false);
  });

  it("правило автопроваливает только тесты T, со степенью 3", () => {
    const a = victim({ mark: { armorKey: "body" }, wounds: { body: 1 } });
    expect(resolveTest(tTest(a)).autoFail).toEqual([expect.objectContaining({ ruleId: "core.lodgedHorn", degrees: 3 })]);
    expect(resolveTest({ ...tTest(a), char: "ag" }).autoFail).toEqual([]);
    expect(resolveTest(tTest(victim())).autoFail).toEqual([]);
  });

  it("исход: бросок ниже Порога всё равно провал с 3 Провалами; глубже 3 — остаётся бросок", async () => {
    const a = victim({ mark: { armorKey: "body" }, wounds: { body: 1 } });
    const ok = await resolveKindOutcome(a, { baseEff: 60, rv: 20, ctx: tTest(a) });
    expect(ok.success).toBe(false);
    expect(ok.deg).toBe(3);
    const deep = await resolveKindOutcome(a, { baseEff: 60, rv: 99, ctx: tTest(a) });
    expect(deep.success).toBe(false);
    expect(deep.deg).toBeGreaterThanOrEqual(3);
  });

  it("автопровал Ослеплённого по-прежнему даёт 1 Провал (степень по умолчанию)", async () => {
    const a = { system: { race: "human", characteristics: {}, conditions: { blinded: true } }, items: [], getFlag: () => undefined };
    const o = await resolveKindOutcome(a, { baseEff: 60, rv: 20, ctx: { actor: a, kind: "skill", char: "bs" } });
    expect(o.deg).toBe(1);
  });
});

describe("Рог отрастает 3 игровых часа", () => {
  const owner = until => ({ getFlag: (s, k) => (k === "hornRegrowAt" ? until : undefined) });

  it("до срока — осталось время, после — рог на месте", () => {
    expect(HORN_REGROW_SECONDS).toBe(10800);
    expect(hornRegrowLeft(owner(10800), 3600)).toBe(7200);
    expect(hornRegrowLeft(owner(10800), 10800)).toBe(0);
    expect(hornRegrowLeft(owner(10800), 99999)).toBe(0);
    expect(hornRegrowLeft(owner(undefined), 5)).toBe(0);
  });

  it("подпись", () => {
    expect(regrowLabel(7200)).toBe("2 ч 0 мин");
    expect(regrowLabel(900)).toBe("15 мин");
  });
});

describe("Majestic Horns: 9 — Зрящие Рога не пользуются визорами и авточувствами", () => {
  const mutation = sub => ({ type: "mutation", name: horns.name, system: { submutation: { label: sub } },
    flags: horns.flags, getFlag: (s, k) => horns.flags[s]?.[k] });
  const aid = (type, name) => ({ type, name, system: { equipped: true, installed: true } });
  const wearer = items => { const a = { items }; items.forEach(i => { i.parent = a; }); return a; };

  it("запись возможности — под 9, ключ известен реестру и имеет читателя", () => {
    const e = bySub("9").find(x => x.kind === "capability");
    expect(CAPABILITIES[e.capabilityKey]?.reader).toBeTruthy();
  });

  it("перечень: книжные авточувства и визоры, но не прицелы, магнокуляры и забрало", () => {
    for (const [t, n] of [["armorMod", "Autosenses / Авточувства"], ["armorMod", "Y-Visor / Y-Визор"],
      ["gear", "Photo-Visor / Фото-Визор"], ["gear", "Preysense Visor / Охотничий Визор"],
      ["gear", "Sonar Visor / Сонарный Визор"], ["implant", "Ranger Visors / Визоры Рейнджера"]])
      expect(isVisionAid({ type: t, name: n }), n).toBe(true);
    for (const [t, n] of [["armorMod", "Open Visor / Забрало"], ["tool", "Magnoculars / Магнокуляры"],
      ["weaponMod", "Optical Sight / Оптический Прицел"], ["gear", "Лазерный фонарь"]])
      expect(isVisionAid({ type: t, name: n }), n).toBe(false);
  });

  it("с мутацией 9 визор гаснет, с другой субмутацией — нет", () => {
    const visor = aid("gear", "Photo-Visor / Фото-Визор");
    const a9 = wearer([mutation("9"), visor]);
    expect(visionAidsBlocked(a9)).toBe(true);
    expect(visionAidBlocked(visor)).toBe(true);
    expect(isItemActive(visor)).toBe(false);

    const other = aid("gear", "Photo-Visor / Фото-Визор");
    const a8 = wearer([mutation("8"), other]);
    expect(visionAidsBlocked(a8)).toBe(false);
    expect(isItemActive(other)).toBe(true);
  });

  it("подавленная мутация (Чистая Форма) запрета не даёт", () => {
    const m = mutation("9");
    m.getFlag = (s, k) => (k === "suppressed" ? true : horns.flags[s]?.[k]);
    expect(visionAidsBlocked(wearer([m]))).toBe(false);
  });
});
