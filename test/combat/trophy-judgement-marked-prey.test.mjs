// test/combat/trophy-judgement-marked-prey.test.mjs
//
// Трофеи Приговора и Отмеченная Добыча (Мастер Казней; Sahara fear-2, решение владельца 30.10.2026 — автоматизировать).
//
// Трофеи Приговора (Талант): «Если он честно (по мнению ГМа) определил вину члена своей банды (но не раба или
// слуги), нарушившего ее законы и уставы, приговорил его к смерти, и привел этот приговор в исполнение, Мастер
// Казней восстанавливает очко Трофеев. Это позволяет восстанавливать очки Трофеев при наличии перерывов между
// миссиями по усмотрению ГМа.» — кнопка ГМа: карточка «Трофей» (убийство) и ячейка «Трофеи» в шапке листа.
//
// Отмеченная Добыча (Талант): «Он может за свободное действие потратить очко Трофеев, чтобы отметить достойную
// трофея цель в пределах прямой видимости или Трейта Unnatural Senses, пока та не умрет, или он не отметит другую
// цель. Мастер Казней получает Преимущества на все атаки Казни по отмеченной цели…» — кнопка в шапке листа тратит
// Очко и метит цель; Преимущество (два броска d100, лучший) идёт в атаки Казни по ней.
// Актор — настоящая схема + пересчёт листа, Таланты и Черты — документы пака.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { hasTrophiesOfJudgement, hasMarkedPrey, trophyMax } from "../../module/rules/trophy-points.mjs";
import {
  offerTrophyAfterKill, restoreJudgementTrophy, judgementDecision, JUDGEMENT_CARD_FLAG
} from "../../module/combat/trophy-kill.mjs";
import {
  MARKED_PREY_FLAG, markedPreyOf, markPrey, markedPreyAdvantage, MARKED_PREY_ADVANTAGE_REROLL
} from "../../module/combat/marked-prey.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
function packDoc(dir, idTail) {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(f => {
    const p = path.join(d, f.name);
    return f.isDirectory() ? walk(p) : (f.name.endsWith(`_${idTail}.json`) ? [p] : []);
  });
  const [file] = walk(path.join(ROOT, "packs-src", dir));
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
const JUDGEMENT = () => packDoc("talents", "RqpPumWY3ItOHSKI");
const MARKED = () => packDoc("talents", "Bxm4rknKzewAo9sG");
const HEX_MARKED = () => packDoc("talents", "J0Px3fx7v1bttlhg");
const TROPHY_TAKER = () => packDoc("traits", "tsDD6o4bwQ6Nxawy");
const EXECUTION = () => packDoc("traits", "OWulIfHDWHU1DvxB");

function actorWith(docs = [], { perBase = 40, value = 0, name = "Мастер Казней", uuid = "Actor.k", infBase = 0, deceased = false } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.characteristics.per.base = perBase;
  system.characteristics.inf.base = infBase;
  system.trophyPoints.value = value;
  const items = docs.map((d, i) => ({ id: `i${i}`, name: d.name, type: d.type, system: d.system, flags: d.flags ?? {}, getFlag: () => undefined }));
  items.get = () => null;
  const store = deceased ? { deceased: true } : {};
  const actor = {
    type: "character", name, uuid, system, items, isOwner: true, store,
    getFlag: (s, k) => store[k], setFlag: async (s, k, v) => { store[k] = v; }, unsetFlag: async (s, k) => { delete store[k]; },
    async update(data) {
      for (const [p, v] of Object.entries(data)) {
        const keys = p.split(".");
        let node = actor;
        for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
        node[keys.at(-1)] = v;
      }
    }
  };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return actor;
}

let registry, prevFromUuid;
beforeEach(() => {
  resetCaptured();
  registry = {};
  prevFromUuid = globalThis.fromUuid;
  globalThis.fromUuid = async u => registry[u] ?? null;
  globalThis.game.user = { id: "gm", isGM: true, targets: new Set() };
});
afterEach(() => { globalThis.fromUuid = prevFromUuid; globalThis.game.user = {}; });

describe("опознание Талантов по точному имени", () => {
  it("Трофеи Приговора и Отмеченная Добыча — Таланты пака; тёзка Шамана («Проклятая Метка») Отмеченной Добычей не считается", () => {
    expect(hasTrophiesOfJudgement(actorWith([JUDGEMENT()]))).toBe(true);
    expect(hasMarkedPrey(actorWith([MARKED()]))).toBe(true);
    expect(hasMarkedPrey(actorWith([HEX_MARKED()]))).toBe(false);
    expect(hasTrophiesOfJudgement(actorWith([TROPHY_TAKER()]))).toBe(false);
  });
  it("носители получают пул Очков Трофеев (максимум P.b)", () => {
    expect(trophyMax(actorWith([JUDGEMENT()], { perBase: 40 }))).toBe(4);
    expect(trophyMax(actorWith([MARKED()], { perBase: 50 }))).toBe(5);
  });
});

describe("Трофеи Приговора: возврат Очка по решению ГМа", () => {
  const yes = async () => true;

  it("ГМ подтвердил: +1 Очко (не выше P.b), в чате карточка", async () => {
    const a = actorWith([JUDGEMENT()], { perBase: 40, value: 1 });
    expect(await restoreJudgementTrophy(a, { decide: yes })).toMatchObject({ restored: true, added: 1 });
    expect(a.system.trophyPoints.value).toBe(2);
    expect(captured.chat.at(-1).content).toContain("Трофеи Приговора");
  });

  it("пул полон — Очко не добавляется, ГМ даже не спрашивают", async () => {
    const a = actorWith([JUDGEMENT()], { perBase: 40, value: 4 });
    let asked = false;
    expect(await restoreJudgementTrophy(a, { decide: async () => { asked = true; return true; } })).toMatchObject({ restored: false, reason: "full" });
    expect(asked).toBe(false);
    expect(a.system.trophyPoints.value).toBe(4);
  });

  it("ГМ отказал — ничего не записано", async () => {
    const a = actorWith([JUDGEMENT()], { value: 0 });
    expect(await restoreJudgementTrophy(a, { decide: async () => false })).toMatchObject({ restored: false, reason: "declined" });
    expect(a.system.trophyPoints.value).toBe(0);
  });

  it("не ГМ — отказ (возврат по усмотрению ГМа): диалога нет, Очко не добавлено", async () => {
    globalThis.game.user = { id: "p", isGM: false };
    const a = actorWith([JUDGEMENT()], { value: 0 });
    let asked = false;
    expect(await restoreJudgementTrophy(a, { decide: async () => { asked = true; return true; } })).toMatchObject({ restored: false, reason: "notGM" });
    expect(asked).toBe(false);
    expect(a.system.trophyPoints.value).toBe(0);
  });

  it("без Таланта — отказ", async () => {
    const a = actorWith([TROPHY_TAKER()], { value: 0 });
    expect(await restoreJudgementTrophy(a, { decide: yes })).toMatchObject({ restored: false, reason: "noTalent" });
  });

  it("диалог ГМа называет условия книги и возвращает решение", async () => {
    const p = judgementDecision({ killerName: "Мастер Казней" });
    await new Promise(r => setTimeout(r, 0));
    expect(captured.dialog.content).toContain("раб");
    expect(captured.dialog.content).toContain("честно");
    await captured.press("ok", {});
    expect(await p).toBe(true);
    const p2 = judgementDecision({ killerName: "Мастер Казней" });
    await new Promise(r => setTimeout(r, 0));
    await captured.press("no", {});
    expect(await p2).toBe(false);
  });

  it("карточка «Трофей» после убийства: носителю Приговора — вторая кнопка; без Приговора — только «Трофей»", async () => {
    const sword = killer => ({ uuid: "Item.sword", name: "меч", system: { weaponClass: "melee" }, parent: killer, actor: killer });
    const victim = actorWith([], { name: "Жертва", uuid: "Actor.v" });
    const holder = actorWith([TROPHY_TAKER(), JUDGEMENT()]);
    await offerTrophyAfterKill(victim, sword(holder));
    expect(captured.chat.at(-1).content).toContain("wh-trophy-judgement-btn");
    expect(captured.chat.at(-1).content).toContain('data-killer-uuid="Actor.k"');
    resetCaptured();
    await offerTrophyAfterKill(victim, sword(actorWith([TROPHY_TAKER()])));
    expect(captured.chat.at(-1).content).not.toContain("wh-trophy-judgement-btn");
    expect(JUDGEMENT_CARD_FLAG).toBe("trophyJudgementUsed");
  });
});

describe("Отмеченная Добыча: отметить цель за Очко Трофеев", () => {
  const prey = (patch = {}) => actorWith([], { name: "Чемпион", uuid: "Actor.v", infBase: 55, ...patch });
  const yes = async () => ({ inf: 55 });

  it("ГМ: цель достойна — Очко списано, цель отмечена, в чате карточка", async () => {
    const a = actorWith([MARKED()], { value: 2 });
    expect(await markPrey(a, prey(), { targetTokenUuid: "Scene.s.Token.v", decide: yes })).toMatchObject({ marked: true });
    expect(a.system.trophyPoints.value).toBe(1);
    expect(markedPreyOf(a)).toEqual({ targetUuid: "Actor.v", tokenUuid: "Scene.s.Token.v", name: "Чемпион" });
    expect(captured.chat.at(-1).content).toContain("Отмеченная Добыча");
  });

  it("«не достойна» — Очко не потрачено, отметки нет", async () => {
    const a = actorWith([MARKED()], { value: 2 });
    expect(await markPrey(a, prey(), { decide: async () => null })).toMatchObject({ marked: false, reason: "declined" });
    expect(a.system.trophyPoints.value).toBe(2);
    expect(markedPreyOf(a)).toBe(null);
  });

  it("нет Очков — отказ, диалога нет", async () => {
    const a = actorWith([MARKED()], { value: 0 });
    let asked = false;
    expect(await markPrey(a, prey(), { decide: async () => { asked = true; return yes(); } })).toMatchObject({ marked: false, reason: "noPoints" });
    expect(asked).toBe(false);
  });

  it("та же цель уже отмечена — Очко не тратится повторно; другая цель — отметка переходит, ещё Очко", async () => {
    const a = actorWith([MARKED()], { value: 3 });
    await markPrey(a, prey(), { decide: yes });
    expect(await markPrey(a, prey(), { decide: yes })).toMatchObject({ marked: false, reason: "already" });
    expect(a.system.trophyPoints.value).toBe(2);
    expect(await markPrey(a, prey({ uuid: "Actor.w", name: "Другой" }), { decide: yes })).toMatchObject({ marked: true });
    expect(a.system.trophyPoints.value).toBe(1);
    expect(markedPreyOf(a).targetUuid).toBe("Actor.w");
  });

  it("без Таланта, без цели, сам себя, мёртвую цель — отказ без списаний", async () => {
    const holder = () => actorWith([MARKED()], { value: 2 });
    expect(await markPrey(actorWith([], { value: 2 }), prey(), { decide: yes })).toMatchObject({ reason: "noTalent" });
    expect(await markPrey(holder(), null, { decide: yes })).toMatchObject({ reason: "noTarget" });
    const me = holder();
    expect(await markPrey(me, me, { decide: yes })).toMatchObject({ reason: "self" });
    expect(await markPrey(holder(), prey({ deceased: true }), { decide: yes })).toMatchObject({ reason: "dead" });
    expect(holder().system.trophyPoints.value).toBe(2);
  });

  it("диалог ГМа не спрашивает Inf (метке он не нужен)", async () => {
    const a = actorWith([MARKED()], { value: 1 });
    let info = null;
    await markPrey(a, prey(), { decide: async i => { info = i; return yes(); } });
    expect(info.askInf).toBeFalsy();
    expect(info.victimName).toBe("Чемпион");
  });
});

describe("Отмеченная Добыча: Преимущество на атаки Казни по отмеченной цели", () => {
  const sword = grips => ({ system: { weaponClass: "melee", grips } });
  const setup = () => {
    const a = actorWith([MARKED(), EXECUTION()], { value: 1 });
    a.store[MARKED_PREY_FLAG] = { targetUuid: "Actor.v", tokenUuid: "", name: "Чемпион" };
    return a;
  };
  const victim = (patch = {}) => actorWith([], { uuid: "Actor.v", ...patch });

  it("отмеченная цель, двуручное оружие в двуручном хвате — Преимущество (два броска, лучший)", () => {
    expect(markedPreyAdvantage(setup(), victim(), sword("2р (1р)"), "2р")).toEqual(MARKED_PREY_ADVANTAGE_REROLL);
    expect(MARKED_PREY_ADVANTAGE_REROLL).toEqual({ mode: "keepBest", rolls: 2 });
  });
  it("другая цель, не двуручный хват, одноручное оружие, мёртвая цель, нет Казни, нет Таланта — нет", () => {
    const a = setup();
    expect(markedPreyAdvantage(a, victim({ uuid: "Actor.w" }), sword("2р"), "2р")).toBeUndefined();
    expect(markedPreyAdvantage(a, victim(), sword("2р (1р)"), "1р")).toBeUndefined();
    expect(markedPreyAdvantage(a, victim(), sword("1р (2р)"), "2р")).toBeUndefined();
    expect(markedPreyAdvantage(a, victim({ deceased: true }), sword("2р"), "2р")).toBeUndefined();
    expect(markedPreyAdvantage(a, null, sword("2р"), "2р")).toBeUndefined();
    const noExec = actorWith([MARKED()]);
    noExec.store[MARKED_PREY_FLAG] = { targetUuid: "Actor.v" };
    expect(markedPreyAdvantage(noExec, victim(), sword("2р"), "2р")).toBeUndefined();
    const noTalent = actorWith([EXECUTION()]);
    noTalent.store[MARKED_PREY_FLAG] = { targetUuid: "Actor.v" };
    expect(markedPreyAdvantage(noTalent, victim(), sword("2р"), "2р")).toBeUndefined();
  });
});
