// test/combat/whack.test.mjs
//
// Whack / Затрещина (Пугилист, стр. 62; задача Sahara 3-eddb, решение владельца
// 24.10.2026): «Он может совершать безоружные атаки руками, в которых он держит
// одноручное рукопашное оружие (кроме оружия с Хватом П+Л). Противники, которые
// еще не видели в этом бою как персонаж совершает подобный прием, получают
// штраф –30 на Избегания от такой атаки.»
//
// Память — автоматическая: противник «видел» приём, если токен сделавшего
// Затрещину был в его поле зрения (rules/vision-target.mjs), до конца боя.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { isWhackStrike, whackStrike, recordWhackSeen, clearWhackMemory, WHACK_SEEN_FLAG, WHACK_EVASION_PENALTY }
  from "../../module/combat/whack.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const NS = "warhammer-dbc";
const WHACK = { id: "wh", name: "Whack / Затрещина", type: "talent", system: {} };

function withFlags(actor) {
  const store = {};
  actor.getFlag = (scope, key) => store[`${scope}.${key}`];
  actor.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  actor.unsetFlag = async (scope, key) => { delete store[`${scope}.${key}`]; };
  return actor;
}

function fist() {
  const w = weaponFor({ weaponClass: "melee", meleeCategory: "Кулаки", balance: -1, grips: "Кист", damage: "1d5-3",
                        equipped: true }, { id: "fist", name: "Кулак" });
  w.getFlag = (scope, key) => (scope === NS && key === "integralAttack") ? true : undefined;
  return w;
}
function sword(grips = "1р", id = "sword") {
  return weaponFor({ weaponClass: "melee", meleeCategory: "Меч", balance: 0, grips, damage: "1d10", equipped: true },
    { id, name: "Меч" });
}

const tok = (id, x, y, extra = {}) => ({
  id, x, y, width: 1, height: 1, rotation: 0, disposition: -1, sight: { range: 30, angle: 360 }, ...extra
});

let savedCanvas;
beforeEach(() => { resetCaptured(); savedCanvas = globalThis.canvas; });
afterEach(() => { globalThis.canvas = savedCanvas; });

describe("isWhackStrike: безоружный удар рукой, в которой оружие", () => {
  it("Талант + кулак + обе руки заняты (меч и пистолет) → Затрещина", () => {
    const pistol = weaponFor({ weaponClass: "pistol", equipped: true, grips: "1р" }, { id: "gun", name: "Пистолет" });
    const f = fist();
    const a = withFlags(actorFor({ items: [WHACK, sword(), pistol, f] }));
    expect(isWhackStrike(a, f)).toBe(true);
  });

  it("одна рука свободна — удар свободной рукой, это не Затрещина", () => {
    const f = fist();
    const a = withFlags(actorFor({ items: [WHACK, sword(), f] }));
    expect(isWhackStrike(a, f)).toBe(false);
  });

  it("меч двумя руками (2р) — одноручного оружия нет, не Затрещина", () => {
    const f = fist();
    const a = withFlags(actorFor({ items: [WHACK, sword("2р"), f] }));
    expect(isWhackStrike(a, f)).toBe(false);
  });

  it("хват П+Л исключён книгой", () => {
    const pistol = weaponFor({ weaponClass: "pistol", equipped: true, grips: "1р" }, { id: "gun", name: "Пистолет" });
    const f = fist();
    const a = withFlags(actorFor({ items: [WHACK, sword("П+Л"), pistol, f] }));
    expect(isWhackStrike(a, f)).toBe(false);
  });

  it("без Таланта — нет", () => {
    const pistol = weaponFor({ weaponClass: "pistol", equipped: true, grips: "1р" }, { id: "gun", name: "Пистолет" });
    const f = fist();
    const a = withFlags(actorFor({ items: [sword(), pistol, f] }));
    expect(isWhackStrike(a, f)).toBe(false);
  });

  it("не безоружная атака (удар мечом) — нет", () => {
    const s = sword();
    const pistol = weaponFor({ weaponClass: "pistol", equipped: true, grips: "1р" }, { id: "gun", name: "Пистолет" });
    const a = withFlags(actorFor({ items: [WHACK, s, pistol, fist()] }));
    expect(isWhackStrike(a, s)).toBe(false);
  });
});

describe("whackStrike / recordWhackSeen: память «видел» на бой", () => {
  function setup() {
    const pistol = weaponFor({ weaponClass: "pistol", equipped: true, grips: "1р" }, { id: "gun", name: "Пистолет" });
    const f = fist();
    const actor = withFlags(actorFor({ items: [WHACK, sword(), pistol, f] }));
    return { actor, f };
  }

  it("первая Затрещина по ещё не видевшему: −30", () => {
    const { actor, f } = setup();
    const r = whackStrike(actor, f, { id: "t1" });
    expect(r.active).toBe(true);
    expect(r.penalty).toBe(WHACK_EVASION_PENALTY);
    expect(WHACK_EVASION_PENALTY).toBe(-30);
  });

  it("после записи цель «видела» — штрафа нет", async () => {
    const { actor, f } = setup();
    globalThis.canvas = { scene: { tokens: [], grid: { size: 100, distance: 1 } }, grid: { size: 100 } };
    await recordWhackSeen(actor, tok("me", 0, 0), { id: "t1" });
    expect(whackStrike(actor, f, { id: "t1" }).penalty).toBe(0);
    expect(whackStrike(actor, f, { id: "t2" }).penalty).toBe(-30);
  });

  it("запись включает всех противников, у кого токен атакующего в поле зрения; дальних и союзников — нет", async () => {
    const { actor } = setup();
    const near = tok("near", 200, 0);
    const far  = tok("far", 5000, 0, { sight: { range: 10, angle: 360 } });
    const ally = tok("ally", 100, 100, { disposition: 1 });
    globalThis.canvas = { scene: { tokens: [near, far, ally], grid: { size: 100, distance: 1 } }, grid: { size: 100 } };
    const me = tok("me", 0, 0, { disposition: 1 });
    await recordWhackSeen(actor, me, { id: "tgt" });
    const seen = actor.getFlag(NS, WHACK_SEEN_FLAG);
    expect(seen).toContain("tgt");
    expect(seen).toContain("near");
    expect(seen).not.toContain("far");
    expect(seen).not.toContain("ally");
  });

  it("токен противника, отвернувшегося (узкий сектор), атакующего не видит", async () => {
    const { actor } = setup();
    // Конвенция rotation: 0° — вверх, по часовой. Токен справа от атакующего,
    // смотрящий на восток (90°), уходит от него; токен слева, смотрящий на
    // восток, смотрит на него.
    const back = tok("back", 200, 0, { rotation: 90, sight: { range: 30, angle: 90 } });
    const facing = tok("facing", -200, 0, { rotation: 90, sight: { range: 30, angle: 90 } });
    globalThis.canvas = { scene: { tokens: [back, facing], grid: { size: 100, distance: 1 } }, grid: { size: 100 } };
    await recordWhackSeen(actor, tok("me", 0, 0, { disposition: 1 }), { id: "tgt" });
    const seen = actor.getFlag(NS, WHACK_SEEN_FLAG);
    expect(seen).toContain("tgt");
    expect(seen).toContain("facing");
    expect(seen).not.toContain("back");
  });

  it("clearWhackMemory забывает память у бойцов боя", async () => {
    const { actor } = setup();
    globalThis.canvas = { scene: { tokens: [], grid: { size: 100, distance: 1 } }, grid: { size: 100 } };
    await recordWhackSeen(actor, tok("me", 0, 0), { id: "t1" });
    expect(actor.getFlag(NS, WHACK_SEEN_FLAG)).toEqual(["t1"]);
    await clearWhackMemory({ combatants: [{ actor }] });
    expect(actor.getFlag(NS, WHACK_SEEN_FLAG)).toBeUndefined();
  });
});

describe("_executeAttackRoll: Затрещина урезает Избегания цели", () => {
  async function whackAttack({ seenTarget = false } = {}) {
    const pistol = weaponFor({ weaponClass: "pistol", equipped: true, grips: "1р" }, { id: "gun", name: "Пистолет" });
    const f = fist();
    const attacker = withFlags(actorFor({ items: [WHACK, sword(), pistol, f] }));
    attacker.uuid = "Actor.attacker";
    const target = actorFor({});
    target.uuid = "Actor.target";
    target.getFlag = () => undefined;
    target.setFlag = async () => {};
    const targetToken = { id: "tgtTok", actor: target, document: tok("tgtTok", 100, 0) };
    globalThis.canvas = { scene: { tokens: [targetToken.document], grid: { size: 100, distance: 1 } }, grid: { size: 100 } };
    if (seenTarget) await attacker.setFlag(NS, WHACK_SEEN_FLAG, ["tgtTok"]);
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([targetToken]) };
    captured.dice = [10, 3, 3, 3, 3];
    await _executeAttackRoll(attacker, f, "ws", 45, "melee", null, {});
    return { attacker, html: captured.chat.map(m => m.content).join("\n") };
  }

  it("первая Затрещина: Уклонение и Парирование цели −30, на карточке подпись, цель записана как видевшая", async () => {
    const { attacker, html } = await whackAttack();
    expect(html).toContain("Парирование (-30)");
    expect(html).toContain("Уклонение (-30)");
    expect(html).toContain("Затрещина");
    expect(attacker.getFlag(NS, WHACK_SEEN_FLAG)).toContain("tgtTok");
  });

  it("повторная Затрещина по тому же — штрафа нет", async () => {
    const { html } = await whackAttack({ seenTarget: true });
    expect(html).not.toContain("Парирование (-30)");
    expect(html).not.toContain("Уклонение (-30)");
  });
});
