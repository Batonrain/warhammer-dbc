// test/combat/terror-sniper.test.mjs
//
// Terror Sniper / Снайпер Ужаса (Талант Стрелка, Sahara 3-5fbf; решение
// владельца 24.10.2026, трактовка (Б) — см. шапку rules/terror-sniper.mjs).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import {
  terrorSniperAffected, resolveTerrorSniperClick, rollTerrorSniperSuppression
} from "../../module/combat/terror-sniper.mjs";
import {
  terrorSniperEligible, terrorSniperSuppressMod, terrorSniperThreshold
} from "../../module/rules/terror-sniper.mjs";

const KEY = "rangedCore.core.terrorSniper";
const byKey = {
  id: "k", name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [{ id: "e", kind: "capability", capabilityKey: KEY, label: "" }] }] } }
};
const byName = { id: "n", name: "Terror Sniper / Снайпер Ужаса", type: "talent", system: {} };
const card = () => captured.chat.at(-1)?.content ?? "";

function shooter(items = []) {
  const a = actorFor({
    items,
    characteristics: { ws: char(45), bs: char(60), s: char(40), t: char(40), ag: char(35), wp: char(40) },
    skills: { intimidate: { total: 45 } }   // WP 40 + Trained(+0..)… WP-основа: 45 − 40 + BS 60 = 65
  });
  a.uuid = "Actor.shooter"; a.isOwner = true;
  return a;
}
let msgSeq = 0;
const msg = () => {
  const flags = {};
  return { id: `m${++msgSeq}`, isOwner: true, getFlag: (s, k) => flags[`${s}.${k}`], setFlag: async (s, k, v) => { flags[`${s}.${k}`] = v; } };
};

// Сцена: сетка 100 px = 1 м.
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
  it("кнопка только при попадании Избирательной атакой Accurate после Прицеливания у стрелка с Талантом", () => {
    const a = shooter([byName]);
    const ok = { isMelee: false, hit: true, accurate: true, aimValue: "head", aiming: "half" };
    expect(terrorSniperEligible(a, ok)).toBe(true);
    expect(terrorSniperEligible(shooter([byKey]), ok)).toBe(true);
    expect(terrorSniperEligible(a, { ...ok, hit: false })).toBe(false);
    expect(terrorSniperEligible(a, { ...ok, accurate: false })).toBe(false);
    expect(terrorSniperEligible(a, { ...ok, aimValue: "" })).toBe(false);
    expect(terrorSniperEligible(a, { ...ok, aiming: "none" })).toBe(false);
    expect(terrorSniperEligible(a, { ...ok, aiming: "" })).toBe(false);
    expect(terrorSniperEligible(a, { ...ok, isMelee: true })).toBe(false);
    expect(terrorSniperEligible(shooter([]), ok)).toBe(false);
  });

  it("модификатор Подавления: не знает +0, знает −20", () => {
    expect(terrorSniperSuppressMod(false)).toBe(0);
    expect(terrorSniperSuppressMod(true)).toBe(-20);
  });

  it("порог Intimidate(BS): основа Запугивания с заменой WP на BS", () => {
    expect(terrorSniperThreshold(shooter()).threshold).toBe(65);   // 45 − 40 + 60
  });
});

describe("карточка попадания", () => {
  const rifle = () => weaponFor({ damage: "1d10", penetration: 4, weaponProps: [{ key: "accurate" }] }, { name: "Снайперская винтовка" });
  const shoot = async (items, aim, opts) => {
    const a = shooter([...items]);
    captured.dice = [10, 5, 5, 5, 5, 5];
    await _executeAttackRoll(a, rifle(), "bs", 60, "single", aim, opts);
  };
  const withToken = () => { globalThis.game.user = { ...globalThis.game.user, targets: new Set([{ actor: { id: "t", type: "character" }, document: { uuid: "Scene.s.Token.t1" } }]) }; };
  beforeEach(() => { resetCaptured(); setTargets([]); });

  it("Избирательное попадание после Прицеливания: есть кнопка с uuid токена цели", async () => {
    withToken();
    await shoot([byName], { value: "torso", label: "Торс" }, { aiming: "half" });
    expect(card()).toContain("wh-terror-sniper-btn");
    expect(card()).toContain('data-target-token-uuid="Scene.s.Token.t1"');
  });

  it("без Прицеливания, без Избирательной, без Таланта — кнопки нет", async () => {
    withToken();
    await shoot([byName], { value: "torso", label: "Торс" }, {});
    expect(card()).not.toContain("wh-terror-sniper-btn");
    resetCaptured();
    await shoot([byName], null, { aiming: "half" });
    expect(card()).not.toContain("wh-terror-sniper-btn");
    resetCaptured();
    await shoot([], { value: "torso", label: "Торс" }, { aiming: "half" });
    expect(card()).not.toContain("wh-terror-sniper-btn");
  });
});

describe("кто попадает под Подавление", () => {
  it("враги стрелка в радиусе, видевшие попадание; союзники, дальние и сам стрелок отсеяны; «знает» — стрелок в поле зрения", () => {
    const me = tok("me", 0, 1);
    const target = tok("target", 40, -1);
    const near = tok("near", 42, -1, { sight: { range: 5 } });       // видит цель (2 м), стрелка — нет (42 м)
    const eyes = tok("eyes", 41, -1, { sight: { range: 60 } });      // видит и цель, и стрелка
    const far = tok("far", 60, -1);                                  // 20 м от цели — вне радиуса 5
    const ally = tok("ally", 41, 1);
    const blind = tok("blind", 43, -1, { sight: { range: 1 } });     // не видит цель (3 м > 1 м) → не видел попадание
    scene([me, target, near, eyes, far, ally, blind]);
    const got = terrorSniperAffected({ shooterDoc: me, targetDoc: target, radius: 5 });
    const byId = Object.fromEntries(got.map(g => [g.token.id, g.knows]));
    expect(byId).toEqual({ target: false, near: false, eyes: true });
  });

  it("радиус — число Успехов в метрах", () => {
    const me = tok("me", 0, 1);
    const target = tok("target", 40, -1);
    const e = tok("e", 44, -1, { sight: { range: 60 } });           // края баз: 3 м от цели
    scene([me, target, e]);
    expect(terrorSniperAffected({ shooterDoc: me, targetDoc: target, radius: 2 }).map(g => g.token.id)).toEqual(["target"]);
    expect(terrorSniperAffected({ shooterDoc: me, targetDoc: target, radius: 3 }).map(g => g.token.id)).toEqual(["target", "e"]);
  });
});

describe("клик: Intimidate(BS)+0 и карточка врагов", () => {
  function setup() {
    const a = shooter([byName]);
    const me = tok("me", 0, 1);
    a.getActiveTokens = () => [{ document: me }];
    const target = tok("target", 40, -1);
    target.uuid = "Scene.s.Token.target";
    const e = tok("e", 41, -1, { sight: { range: 60 } });
    scene([me, target, e]);
    globalThis.fromUuid = async uuid => ({ [a.uuid]: a, [target.uuid]: target })[uuid] ?? null;
    return a;
  }
  beforeEach(() => resetCaptured());

  it("успех: карточка с рядом на каждого врага, галочка «знает» отмечена там, где стрелок виден", async () => {
    setup();
    captured.dice = [35];     // порог 65 → 4 степени успеха → радиус 4 м
    expect(await resolveTerrorSniperClick("Actor.shooter", "Scene.s.Token.target", msg())).toBe(true);
    const html = card();
    expect(html).toContain("радиусе 4 м");
    expect(html.match(/wh-terror-row/g)).toHaveLength(2);                 // target и e
    expect(html).toContain('data-actor-uuid="Actor.e"');
    expect(html).toMatch(/Actor\.e"[^]*?<\/div>/);
    // у «e» стрелок виден (дальность 60) — галочка отмечена
    const rowE = html.split("wh-terror-row").find(r => r.includes('Actor.e"'));
    expect(rowE).toContain("checked");
  });

  it("провал: врагов нет, карточка без рядов", async () => {
    setup();
    captured.dice = [90];
    await resolveTerrorSniperClick("Actor.shooter", "Scene.s.Token.target", msg());
    expect(card()).not.toContain("wh-terror-row");
    expect(card()).toContain("Провал");
  });

  it("повторный клик по той же карточке — второго броска нет", async () => {
    setup();
    const m = msg();
    captured.dice = [35];
    await resolveTerrorSniperClick("Actor.shooter", "Scene.s.Token.target", m);
    const n = captured.chat.length;
    captured.dice = [35];
    await resolveTerrorSniperClick("Actor.shooter", "Scene.s.Token.target", m);
    expect(captured.chat).toHaveLength(n);
  });

  it("Подавление врага: не знает — порог WP+0, знает — WP−20", async () => {
    const enemy = actorFor({ characteristics: { wp: char(40) } });
    enemy.uuid = "Actor.e"; enemy.isOwner = true; enemy.update = async () => {};
    globalThis.fromUuid = async uuid => (uuid === "Actor.e" ? enemy : null);
    resetCaptured();
    captured.dice = [50];
    await rollTerrorSniperSuppression("Actor.e", "", false);
    expect(card()).toMatch(/Порог[^0-9]*40/);
    resetCaptured();
    captured.dice = [50];
    await rollTerrorSniperSuppression("Actor.e", "", true);
    expect(card()).toMatch(/Порог[^0-9]*20/);
  });
});
