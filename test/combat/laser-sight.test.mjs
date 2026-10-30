// test/combat/laser-sight.test.mjs
//
// Лазерный Прицел / Red-Dot (Основная книга, «Прицелы»): «Точка лазера может быть
// замечена врагами через тест Awareness–10, выдавая стрелка» (Sahara wdbc-1rno-39).
// Трактовка — в шапке rules/laser-sight.mjs. Образец — test/combat/terror-sniper.test.mjs.

import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import {
  laserDotObservers, whisperLaserDotToGM, rollLaserDotNotice, laserDotNoticeOnCard, laserSpotKey
} from "../../module/combat/laser-sight.mjs";
import { CARD_ONCE_FLAGS, cardOnceUsed } from "../../module/combat/card-once.mjs";
import { hasLaserDot, laserDotOffered, awarenessBase, LASER_SPOT_ROWS } from "../../module/rules/laser-sight.mjs";
import { allPackDocuments } from "../support/pack-docs.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

const mod = (name, over = {}) => ({
  id: "m-" + name, type: "weaponMod", name, getFlag: () => undefined,
  system: { installedOn: "weapon-1", modGroup: "sights", effects: {}, ...over }
});
const LASER = () => mod("Laser Sight / Лазерный Прицел");
const OMNI = (over) => mod("Omni-Sight / Омни-Прицел", over);
const COLLIMATOR = () => mod("Collimator Sight / Коллиматорный Прицел");

let msgSeq = 0;
const msg = () => {
  const flags = {};
  return { id: `lm${++msgSeq}`, isOwner: true, getFlag: (s, k) => flags[`${s}.${k}`], setFlag: async (s, k, v) => { flags[`${s}.${k}`] = v; } };
};

function scene(tokens) {
  const sc = { grid: { size: 100, distance: 1 }, tokens: { contents: [] } };
  for (const t of tokens) { t.parent = sc; sc.tokens.contents.push(t); }
  return sc;
}
const tok = (id, xMeters, disposition, extra = {}) => ({
  id, name: id, x: xMeters * 100, y: 0, width: 1, height: 1, elevation: 0, rotation: 0, disposition, hidden: false,
  actor: { uuid: `Actor.${id}`, name: id }, ...extra
});

describe("правила", () => {
  it("точку лазера выдают Лазерный и Омни-Прицел, прочие прицелы — нет", () => {
    expect(hasLaserDot([LASER()])).toBe(true);
    expect(hasLaserDot([OMNI()])).toBe(true);
    expect(hasLaserDot([COLLIMATOR()])).toBe(false);
    expect(hasLaserDot([])).toBe(false);
  });

  it("шёпот только после дальнобойной атаки", () => {
    expect(laserDotOffered({ isMelee: false, laserDot: true })).toBe(true);
    expect(laserDotOffered({ isMelee: true, laserDot: true })).toBe(false);
    expect(laserDotOffered({ isMelee: false, laserDot: false })).toBe(false);
  });

  it("база Внимательности: итог Навыка, а без записи Навыка — Восприятие", () => {
    expect(awarenessBase(actorFor({ skills: { awareness: { total: 45 } } }))).toBe(45);
    expect(awarenessBase(actorFor({ characteristics: { per: char(33) } }))).toBe(33);
  });

  it("данные пака: Лазерный Прицел несёт rofSingleAttackMod 10 (бонус и плата едут вместе)", () => {
    const doc = allPackDocuments("weapon-mods").find(({ doc }) => doc.name.startsWith("Laser Sight")).doc;
    expect(doc.system.effects.rofSingleAttackMod).toBe(10);
  });
});

describe("авто-шёпот ГМу после атаки", () => {
  const rifle = () => weaponFor({ damage: "1d10", penetration: 4 }, { name: "Винтовка" });
  const GM_IDS = ["gm1", "gm2"];
  const whispers = () => captured.chat.filter(m => String(m.content ?? "").includes("Лазерная точка"));
  // Сцена: стрелок, цель-враг и враг, видящий цель; fromUuid отдаёт токен цели.
  function sceneFor() {
    const me = tok("me", 0, 1);
    const target = tok("target", 40, -1); target.uuid = "Scene.s.Token.t1";
    const e = tok("e", 41, -1, { sight: { range: 60 } });
    scene([me, target, e]);
    globalThis.fromUuid = async uuid => (uuid === target.uuid ? target : null);
    return me;
  }
  const shoot = async (items, dice = [10, 5, 5, 5, 5, 5], isMelee = false, over = {}) => {
    const a = actorFor({ items: [...items], characteristics: { ws: char(45), bs: char(60), s: char(40), t: char(40), ag: char(35) } });
    a.uuid = "Actor.shooter";
    const me = sceneFor();
    a.getActiveTokens = () => [{ document: me }];
    captured.dice = dice;
    const w = isMelee ? weaponFor({ weaponClass: "melee", damage: "1d10", rof_single: 0, rof_semi: 0 }, { name: "Меч" }) : rifle();
    await _executeAttackRoll(a, w, isMelee ? "ws" : "bs", 60, isMelee ? "melee" : "single", null, over);
  };
  const withToken = () => { globalThis.game.user = { ...globalThis.game.user, targets: new Set([{ actor: { id: "t", type: "character" }, document: { uuid: "Scene.s.Token.t1" } }]) }; };
  let prevWhisper;
  beforeEach(() => {
    resetCaptured(); setTargets([]);
    prevWhisper = globalThis.ChatMessage.getWhisperRecipients;
    globalThis.ChatMessage.getWhisperRecipients = () => GM_IDS.map(id => ({ id }));
  });
  afterEach(() => { globalThis.ChatMessage.getWhisperRecipients = prevWhisper; });

  it("с Лазерным Прицелом ГМу уходит шёпот (скрытый от стрелка) со строкой на врага; на публичной карточке кнопки нет", async () => {
    withToken();
    await shoot([LASER()]);
    const [w, ...rest] = whispers();
    expect(rest).toHaveLength(0);
    expect(w.whisper).toEqual(GM_IDS);
    expect(w.blind).toBe(true);
    expect(w.content).toContain("wh-laser-row");
    expect(w.content).toContain('data-actor-uuid="Actor.e"');
    const pub = captured.chat.filter(m => !m.whisper?.length);
    expect(pub.length).toBeGreaterThan(0);
    for (const m of pub) {
      expect(m.content).not.toContain("wh-laser-dot-btn");
      expect(m.content).not.toContain("Лазерная точка");
    }
    // шёпот идёт после карточки атаки
    expect(captured.chat.indexOf(w)).toBeGreaterThan(0);
  });

  it("и после промаха — точка светит", async () => {
    withToken();
    await shoot([LASER()], [80, 5, 5, 5, 5, 5]);
    expect(whispers()).toHaveLength(1);
  });

  it("Омни-Прицел (без требований в тестовой копии) тоже даёт точку", async () => {
    withToken();
    await shoot([OMNI()]);
    expect(whispers()).toHaveLength(1);
  });

  it("Омни-Прицел «бесполезен» без Дисплея/Глаза — шёпота нет", async () => {
    withToken();
    await shoot([OMNI({ requiresWorn: ["Retinal Display", "Bionic Eye"] })]);
    expect(whispers()).toHaveLength(0);
  });

  it("без прицела, с другим прицелом и на рукопашной — шёпота нет", async () => {
    withToken();
    await shoot([]);
    expect(whispers()).toHaveLength(0);
    resetCaptured();
    await shoot([COLLIMATOR()]);
    expect(whispers()).toHaveLength(0);
    resetCaptured();
    await shoot([LASER()], [10, 5, 5, 5, 5, 5], true);
    expect(whispers()).toHaveLength(0);
  });

  it("при двух прицелах точку даёт только выбранный на оружии", async () => {
    withToken();
    const w = rifle();
    w.getFlag = (s, k) => (k === "hudSight" ? "m-Collimator Sight / Коллиматорный Прицел" : undefined);
    const a = actorFor({ items: [LASER(), COLLIMATOR()], characteristics: { ws: char(45), bs: char(60), s: char(40), t: char(40), ag: char(35) } });
    a.uuid = "Actor.shooter";
    captured.dice = [10, 5, 5, 5, 5, 5];
    await _executeAttackRoll(a, w, "bs", 60, "single", null, {});
    expect(whispers()).toHaveLength(0);
  });

  it("переброс той же атаки (forcedRoll) второго шёпота не шлёт: точка светила один раз", async () => {
    withToken();
    await shoot([LASER()]);
    expect(whispers()).toHaveLength(1);
    await shoot([LASER()], [10, 5, 5, 5, 5, 5], false, { forcedRoll: 20 });
    expect(whispers()).toHaveLength(1);
  });

  it("переброс за Очко Судьбы / Огневую Точку (skipAmmo без forcedRoll) — тоже без второго шёпота", async () => {
    withToken();
    await shoot([LASER()]);
    expect(whispers()).toHaveLength(1);
    await shoot([LASER()], [10, 5, 5, 5, 5, 5], false, { skipAmmo: true });
    expect(whispers()).toHaveLength(1);
  });

  it("стреляет игрок (не ГМ): шёпот всё равно создаётся от его клиента и адресован только ГМам", async () => {
    withToken();
    globalThis.game.user = { ...globalThis.game.user, isGM: false, id: "player1" };
    await shoot([LASER()]);
    const [w] = whispers();
    expect(w.whisper).toEqual(GM_IDS);
    expect(w.whisper).not.toContain("player1");
  });

  it("ГМов в игре нет — шёпот не создаётся (пустой список адресатов сделал бы карточку публичной)", async () => {
    withToken();
    globalThis.ChatMessage.getWhisperRecipients = () => [];
    await shoot([LASER()]);
    expect(whispers()).toHaveLength(0);
  });

  it("врагов, видящих точку, нет и токены найдены — шёпот не засоряет чат", async () => {
    withToken();
    const a = actorFor({ items: [LASER()], characteristics: { ws: char(45), bs: char(60), s: char(40), t: char(40), ag: char(35) } });
    a.uuid = "Actor.shooter";
    const me = tok("me", 0, 1);
    const target = tok("target", 40, -1); target.uuid = "Scene.s.Token.t1";
    scene([me, target]);
    target.actor = null; // у цели нет актора → она сама не наблюдатель
    globalThis.fromUuid = async uuid => (uuid === target.uuid ? target : null);
    a.getActiveTokens = () => [{ document: me }];
    captured.dice = [10, 5, 5, 5, 5, 5];
    await _executeAttackRoll(a, rifle(), "bs", 60, "single", null, {});
    expect(whispers()).toHaveLength(0);
  });

  it("токен цели не найден — ГМу уходит шёпот с просьбой определить наблюдателей вручную", async () => {
    withToken();
    const a = actorFor({ items: [LASER()], characteristics: { ws: char(45), bs: char(60), s: char(40), t: char(40), ag: char(35) } });
    a.uuid = "Actor.shooter";
    globalThis.fromUuid = async () => null;
    captured.dice = [10, 5, 5, 5, 5, 5];
    await _executeAttackRoll(a, rifle(), "bs", 60, "single", null, {});
    const [w] = whispers();
    expect(w.content).toContain("определите наблюдателей вручную");
    expect(w.whisper).toEqual(GM_IDS);
  });
});

describe("кому видна точка", () => {
  it("враги стрелка, видящие цель; союзники, слепые, скрытые и сам стрелок отсеяны; «знает» — стрелок в поле зрения; ближайшие к цели первыми", () => {
    const me = tok("me", 0, 1);
    const target = tok("target", 40, -1);
    const near = tok("near", 42, -1, { sight: { range: 5 } });       // видит цель (2 м), стрелка — нет
    const eyes = tok("eyes", 36, -1, { sight: { range: 60 } });      // видит и цель, и стрелка
    const far = tok("far", 90, -1, { sight: { range: 10 } });        // цель в 50 м — не видит
    const ally = tok("ally", 41, 1);
    const hid = tok("hid", 41, -1, { hidden: true });
    scene([me, target, near, eyes, far, ally, hid]);
    const got = laserDotObservers({ shooterDoc: me, targetDoc: target });
    expect(got.map(g => g.token.id)).toEqual(["target", "near", "eyes"]);
    const knows = Object.fromEntries(got.map(g => [g.token.id, g.knows]));
    expect(knows).toEqual({ target: false, eyes: true, near: false });
  });

  it("строк не больше, чем ключей отметок", () => {
    const me = tok("me", 0, 1);
    const target = tok("target", 40, -1);
    const crowd = Array.from({ length: 30 }, (_, i) => tok(`e${i}`, 41 + (i % 5), -1, { sight: { range: 60 } }));
    scene([me, target, ...crowd]);
    expect(laserDotObservers({ shooterDoc: me, targetDoc: target })).toHaveLength(LASER_SPOT_ROWS);
  });

  it("нет цели или сцены — никого", () => {
    expect(laserDotObservers({ shooterDoc: tok("me", 0, 1), targetDoc: null })).toEqual([]);
    expect(laserDotObservers({ shooterDoc: tok("me", 0, 1), targetDoc: tok("t", 5, -1) })).toEqual([]);
  });
});

describe("шёпот ГМу: карточка врагов", () => {
  let prevWhisper;
  beforeEach(() => {
    resetCaptured();
    prevWhisper = globalThis.ChatMessage.getWhisperRecipients;
    globalThis.ChatMessage.getWhisperRecipients = () => [{ id: "gm1" }];
  });
  afterEach(() => { globalThis.ChatMessage.getWhisperRecipients = prevWhisper; });
  function setup() {
    const a = actorFor({ items: [LASER()] });
    a.uuid = "Actor.shooter";
    const me = tok("me", 0, 1);
    a.getActiveTokens = () => [{ document: me }];
    const target = tok("target", 40, -1);
    target.uuid = "Scene.s.Token.target";
    const e = tok("e", 41, -1, { sight: { range: 60 } });
    scene([me, target, e]);
    globalThis.fromUuid = async uuid => ({ [target.uuid]: target })[uuid] ?? null;
    return a;
  }

  it("ряд на каждого врага; галочка «знает» отмечена там, где стрелок виден", async () => {
    const a = setup();
    expect(await whisperLaserDotToGM(a, "Scene.s.Token.target")).toBe(true);
    const html = card();
    expect(html.match(/wh-laser-row/g)).toHaveLength(2);                  // target и e
    expect(html).toContain('data-actor-uuid="Actor.e"');
    const rowE = html.split("wh-laser-row").find(r => r.includes('Actor.e"'));
    expect(rowE).toContain("checked");
    const rowT = html.split("wh-laser-row").find(r => r.includes('Actor.target"'));
    expect(rowT).not.toContain("checked");
  });

  it("сообщение адресовано только ГМам и скрыто от автора-игрока", async () => {
    const a = setup();
    await whisperLaserDotToGM(a, "Scene.s.Token.target");
    expect(captured.chat.at(-1).whisper).toEqual(["gm1"]);
    expect(captured.chat.at(-1).blind).toBe(true);
  });

  it("токена цели нет — карточка без рядов, с пояснением", async () => {
    const a = setup();
    expect(await whisperLaserDotToGM(a, "")).toBe(true);
    expect(card()).not.toContain("wh-laser-row");
    expect(card()).toContain("определите наблюдателей вручную");
  });

  it("нет ГМа — false и ничего не создано", async () => {
    const a = setup();
    globalThis.ChatMessage.getWhisperRecipients = () => [];
    expect(await whisperLaserDotToGM(a, "Scene.s.Token.target")).toBe(false);
    expect(captured.chat).toHaveLength(0);
  });
});

describe("тест Awareness−10 врага", () => {
  const enemy = () => {
    const e = actorFor({ characteristics: { per: char(40) }, skills: { awareness: { total: 45 } } });
    e.uuid = "Actor.e"; e.isOwner = true; e.name = "Враг";
    globalThis.fromUuid = async uuid => (uuid === "Actor.e" ? e : null);
    return e;
  };
  beforeEach(() => resetCaptured());

  it("порог — итог Внимательности −10; бросок ниже порога — заметил", async () => {
    enemy();
    captured.dice = [30];
    expect(await rollLaserDotNotice("Actor.e", "", false)).toBe(true);
    expect(card()).toMatch(/Порог[^0-9]*35/);
    expect(card()).toContain("Заметил");
  });

  it("бросок выше порога — не заметил", async () => {
    enemy();
    captured.dice = [50];
    await rollLaserDotNotice("Actor.e", "", false);
    expect(card()).toContain("Не заметил");
  });

  it("уже знает, где стрелок — броска нет, кнопка остаётся доступной", async () => {
    enemy();
    expect(await rollLaserDotNotice("Actor.e", "", true)).toBe(false);
    expect(captured.chat).toHaveLength(0);
  });

  it("враг не найден — тест не брошен", async () => {
    globalThis.fromUuid = async () => null;
    expect(await rollLaserDotNotice("Actor.nobody", "", false)).toBe(false);
  });

  describe("права: кнопку на шёпот-карточке нажимает ГМ, актор врага ему не «свой»", () => {
    let prevUser;
    beforeEach(() => { prevUser = globalThis.game.user; });
    afterEach(() => { globalThis.game.user = prevUser; });

    it("ГМ бросает за чужого NPC", async () => {
      const e = enemy(); e.isOwner = false;
      globalThis.game.user = { ...prevUser, isGM: true };
      captured.dice = [30];
      expect(await rollLaserDotNotice("Actor.e", "", false)).toBe(true);
      expect(card()).toContain("Заметил");
    });

    it("не ГМ и не владелец врага — отказ, броска нет", async () => {
      const e = enemy(); e.isOwner = false;
      globalThis.game.user = { ...prevUser, isGM: false };
      expect(await rollLaserDotNotice("Actor.e", "", false)).toBe(false);
      expect(captured.chat).toHaveLength(0);
    });
  });
});

describe("раз на врага и на карточку", () => {
  beforeEach(() => resetCaptured());

  it("ключи отметок есть в белом списке сокета (собираются в рантайме — сторож card-once их не видит)", () => {
    // «laserDotShown» (разбор карточки с кнопки атаки) снят: шёпот ГМу уходит сам, один на атаку.
    expect(CARD_ONCE_FLAGS).not.toContain("laserDotShown");
    for (let i = 0; i < LASER_SPOT_ROWS; i++) expect(CARD_ONCE_FLAGS).toContain(laserSpotKey(i));
    expect(laserSpotKey(LASER_SPOT_ROWS)).toBe("");
    expect(laserSpotKey(-1)).toBe("");
  });

  it("второй клик по той же строке тест не бросает; другая строка — бросает свой", async () => {
    const e = actorFor({ characteristics: { per: char(40) }, skills: { awareness: { total: 45 } } });
    e.uuid = "Actor.e"; e.isOwner = true;
    globalThis.fromUuid = async uuid => (uuid === "Actor.e" ? e : null);
    const m = msg();
    captured.dice = [50];
    expect(await laserDotNoticeOnCard(m, 0, "Actor.e", "", false)).toBe(true);
    const n = captured.chat.length;
    expect(await laserDotNoticeOnCard(m, 0, "Actor.e", "", false)).toBe(false);
    expect(captured.chat).toHaveLength(n);
    captured.dice = [50];
    expect(await laserDotNoticeOnCard(m, 1, "Actor.e", "", false)).toBe(true);
  });

  it("клик ГМа по строке шёпота, написанного клиентом игрока (сообщение ГМу «не своё»): тест бросается, отметка уходит сокетом", async () => {
    const e = actorFor({ characteristics: { per: char(40) }, skills: { awareness: { total: 45 } } });
    e.uuid = "Actor.e"; e.isOwner = false;
    globalThis.fromUuid = async uuid => (uuid === "Actor.e" ? e : null);
    const prevUser = globalThis.game.user, prevUsers = globalThis.game.users;
    globalThis.game.user = { ...prevUser, id: "gm1", isGM: true };
    globalThis.game.users = Object.assign([], { activeGM: { id: "gm1" } });
    try {
      const m = msg(); m.isOwner = false;
      captured.dice = [50];
      expect(await laserDotNoticeOnCard(m, 0, "Actor.e", "", false)).toBe(true);
      expect(cardOnceUsed(m, "laserSpot0")).toBe(true);
      expect(await laserDotNoticeOnCard(m, 0, "Actor.e", "", false)).toBe(false);
    } finally { globalThis.game.user = prevUser; globalThis.game.users = prevUsers; }
  });

  it("проводка в hooks.mjs: кнопки строк шёпота навешены и гасятся по флагу карточки; кнопки на карточке атаки нет", () => {
    const hooks = fs.readFileSync(path.resolve(import.meta.dirname, "../../module/hooks.mjs"), "utf8");
    expect(hooks).not.toMatch(/\.wh-laser-dot-btn/);
    expect(hooks).not.toMatch(/resolveLaserDotClick/);
    expect(hooks).toMatch(/\.wh-laser-notice-btn/);
    expect(hooks).toMatch(/cardOnceUsed\(message, rowKey\)/);
    expect(hooks).toMatch(/laserDotNoticeOnCard\(message, rowIndex/);
    const attackCard = fs.readFileSync(path.resolve(import.meta.dirname, "../../module/combat/attack-card.mjs"), "utf8");
    expect(attackCard).not.toMatch(/wh-laser-dot-btn/);
  });
});
