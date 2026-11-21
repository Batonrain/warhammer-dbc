// test/combat/burning-body.test.mjs
//
// Пылающее Тело (wdbc-1rno.16): подавление W+0 на час, ответное пламя, Борьба, субмутации.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import {
  burningSubKind, burningRetaliates, burningHitProfile, suppressionExpired, SUPPRESS_FLAG, BURNING_BODY_CAP
} from "../../module/rules/burning-body.mjs";
import {
  burningBodyActive, suppressBurningBody, restoreBurningBody, burningExpiryTick, burningRetaliationHtml,
  burningGrappleTurnStart
} from "../../module/combat/burning-body.mjs";
import { hasRuleFlag } from "../../module/rules/flags.mjs";
import { ELITE_SCRIPT_API } from "../../module/combat/elite-api/index.mjs";

const NS = "warhammer-dbc";
const DOC = packDocById("packs-src/mutations/Общие_мутации", "ZZJAzGhDQ3NNPiwe");

function mkMutation(sub = "") {
  const it = structuredClone(DOC);
  it.id = "bb";
  it.system.submutation = { label: sub };
  it.getFlag = (s, k) => it.flags?.[s]?.[k];
  it.setFlag = async (s, k, v) => { it.flags[s][k] = v; };
  it.unsetFlag = async (s, k) => { delete it.flags[s][k]; };
  return it;
}
function mkActor({ name = "Пылающий", items = [], ag = 40, wp = 40, flags = {}, type = "character" } = {}) {
  const list = [...items];
  return {
    id: name, uuid: `Actor.${name}`, name, type,
    system: { characteristics: { ag: { total: ag }, wp: { total: wp } } },
    items: Object.assign(list, { contents: list }),
    getFlag: (_s, k) => flags[k]
  };
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.time ??= {};
  game.time.worldTime = 1000;
});

describe("правила", () => {
  it("строки субмутаций", () => {
    expect(["1", "2-3", "4-5", "6", "7", "8", "9", "10"].map(burningSubKind))
      .toEqual(["flicker", "flare", "entwine", "invisible", "choking", "khorne", "sorcerous", "controlled"]);
  });
  it("триггер: рукопашная Rng 0-1 или Захват", () => {
    expect(burningRetaliates({ isMelee: true, edgeM: 1 })).toBe(true);
    expect(burningRetaliates({ isMelee: true, edgeM: 2 })).toBe(false);
    expect(burningRetaliates({ isMelee: true })).toBe(true);
    expect(burningRetaliates({ isMelee: false, edgeM: 0 })).toBe(false);
    expect(burningRetaliates({ isMelee: false, technique: "grapple" })).toBe(true);
  });
  it("профиль пламени по субмутации", () => {
    expect(burningHitProfile("")).toMatchObject({ formula: "1d10", tearing: false });
    expect(burningHitProfile("flare").tearing).toBe(true);
    expect(burningHitProfile("flare", { attackMissed: true }).tearing).toBe(false);
    expect(burningHitProfile("khorne").formula).toBe("2d10");
    expect(burningHitProfile("khorne", { psyker: true }).formula).toBe("3d10");
    expect(burningHitProfile("sorcerous").corruption).toBe(true);
  });
  it("истечение подавления", () => {
    expect(suppressionExpired({ until: 2000 }, 1999)).toBe(false);
    expect(suppressionExpired({ until: 2000 }, 2000)).toBe(true);
    expect(suppressionExpired(null, 5000)).toBe(false);
  });
});

describe("подавление пламени", () => {
  it("успех W+0 гасит мутацию и её иммунитеты на час, по истечении — само", async () => {
    const m = mkMutation();
    const a = mkActor({ items: [m] });
    expect(hasRuleFlag(a, BURNING_BODY_CAP)).toBe(true);
    captured.nextRoll = 10;
    expect(await suppressBurningBody(a)).toBe(true);
    expect(m.getFlag(NS, SUPPRESS_FLAG)).toEqual({ until: 4600 });
    expect(burningBodyActive(a)).toBe(false);
    expect(hasRuleFlag(a, BURNING_BODY_CAP)).toBe(false);
    expect(await burningExpiryTick(a, 4000)).toBe(false);
    expect(await burningExpiryTick(a, 4600)).toBe(true);
    expect(burningBodyActive(a)).toBe(true);
  });
  it("провал — пламя горит; «Вернуть пламя» снимает подавление досрочно", async () => {
    const m = mkMutation();
    const a = mkActor({ items: [m] });
    captured.nextRoll = 90;
    expect(await suppressBurningBody(a)).toBe(false);
    expect(burningBodyActive(a)).toBe(true);
    captured.nextRoll = 5;
    await suppressBurningBody(a);
    expect(await restoreBurningBody(a, { silent: true })).toBe(true);
    expect(burningBodyActive(a)).toBe(true);
  });
});

describe("ответное пламя", () => {
  it("провал A+0 — кнопка 1d10 E(Fl) Pen 0 по атакующему", async () => {
    const def = mkActor({ items: [mkMutation()] });
    const atk = mkActor({ name: "Враг", ag: 30 });
    captured.dice = [80, 7];
    const r = await burningRetaliationHtml(def, atk, { isMelee: true, hit: true });
    expect(r.html).toContain(`data-force-target="Actor.Враг"`);
    expect(r.html).toContain(`data-damage="7"`);
    expect(r.html).toContain(`data-damage-subtype="flame"`);
    expect(r.html).toContain("Tainted");
  });
  it("успех A+0 — без урона; подавленное пламя — ничего", async () => {
    const m = mkMutation();
    const def = mkActor({ items: [m] });
    const atk = mkActor({ name: "Враг", ag: 50 });
    captured.dice = [20];
    const r = await burningRetaliationHtml(def, atk, { isMelee: true, hit: false });
    expect(r.html).not.toContain("wh-apply-dmg-btn");
    m.flags[NS][SUPPRESS_FLAG] = { until: 9999 };
    expect((await burningRetaliationHtml(def, atk, { isMelee: true })).html).toBe("");
  });
  it("дальняя атака не обжигает", async () => {
    const def = mkActor({ items: [mkMutation()] });
    expect((await burningRetaliationHtml(def, mkActor({ name: "Стрелок" }), { isMelee: false })).html).toBe("");
  });
  it("«2-3» Вспыхивающее: Рвущее, кроме ответа на промах", async () => {
    const def = mkActor({ items: [mkMutation("2-3")] });
    const atk = mkActor({ name: "Враг", ag: 10 });
    captured.dice = [90, 3, 8];
    const hitR = await burningRetaliationHtml(def, atk, { isMelee: true, hit: true });
    expect(hitR.html).toContain(`data-damage="8"`);
    expect(hitR.html).toContain("Рвущее");
    captured.dice = [90, 3];
    const missR = await burningRetaliationHtml(def, atk, { isMelee: true, hit: false });
    expect(missR.html).toContain(`data-damage="3"`);
    expect(missR.html).not.toContain("Рвущее");
  });
  it("«8» Пламя Кхорна: 3d10 по псайкеру", async () => {
    const def = mkActor({ items: [mkMutation("8")] });
    const psy = mkActor({ name: "Псайкер", ag: 10 });
    psy.system.isPsyker = true;
    captured.dice = [90, 4, 5, 6];
    const r = await burningRetaliationHtml(def, psy, { isMelee: true, hit: true });
    expect(r.html).toContain("3d10");
    expect(r.html).toContain(`data-damage="15"`);
    captured.dice = [90, 4, 5];
    expect((await burningRetaliationHtml(def, mkActor({ name: "Враг", ag: 10 }), { isMelee: true, hit: true })).html).toContain("2d10");
  });
});

describe("Борьба", () => {
  it("противник носителя горит в начале своего Хода", async () => {
    const def = mkActor({ items: [mkMutation()] });
    const foe = mkActor({ name: "Борец", flags: { grapplePartner: "Actor.Пылающий" } });
    globalThis.fromUuidSync = uuid => (uuid === def.uuid ? def : null);
    const { PARTNER_FLAG } = await import("../../module/combat/grapple.mjs");
    foe.getFlag = (_s, k) => (k === PARTNER_FLAG ? def.uuid : undefined);
    captured.dice = [6];
    expect(await burningGrappleTurnStart(foe)).toBe(true);
    expect(captured.chat.at(-1).content).toContain(`data-damage="6"`);
    expect(await burningGrappleTurnStart(mkActor({ name: "Свободный" }))).toBe(false);
  });
});

describe("пак", () => {
  it("кнопки на мутации и помощники видны скриптам", () => {
    const codes = DOC.flags[NS].mechanics.flatMap(g => g.entries).filter(e => e.kind === "script").map(e => e.code).join("\n");
    expect(codes).toContain("suppressBurningBody(actor)");
    expect(codes).toContain("restoreBurningBody(actor)");
    expect(typeof ELITE_SCRIPT_API.suppressBurningBody).toBe("function");
    expect(typeof ELITE_SCRIPT_API.restoreBurningBody).toBe("function");
  });
});
