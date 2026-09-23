// test/combat/grapple-rules.test.mjs
//
// Борьба (core.json, «II. МЕХАНИКА → Борьба», стр. 12) после сверки
// wdbc-x1nz.2.73–.77: встречные тесты Навыком с броском партнёра, роли
// Атакующий/Цель, Сжать, Перехватить Контроль, ограничения атаки/Движения/
// Уклонения по роли, руки, укрытие друг другом.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured, fakeHtml } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { resistButtonData } from "../support/contest.mjs";
import {
  resolveGrappleSuccess, endGrapple, grappleRole, grappleHands, grappleFreeHands,
  grappleTechDef, grappleSizePenalty, grappleAttackBlockReason, grappleMoveAllowed,
  grappleDodgeBlockReason, inGrappleCoverArc, grappleCoverPartner, maybeAutoReleaseGrapple, grappleReleaseTriggered,
  _doSqueeze, _resolveTakeoverSuccess, setGrappleHands, SQUEEZE_PENDING_FLAG
} from "../../module/combat/grapple.mjs";
import { _showContestDialog } from "../../module/combat/techniques.mjs";
import { resolveResistClick, _resetPendingContests } from "../../module/combat/opposed-contest.mjs";
import { turnStartSqueezeCarryOver } from "../../module/rules/turn-flags.mjs";
import { situationalRules } from "../../module/rules/situational.mjs";
import { handsOccupied } from "../../module/rules/hands.mjs";

/** Актор с флагами, разбирающий flags.* и -= в update, как Foundry. */
function fighter(name, uuid, { size = 0, s = 40, ag = 35, ws = 45, skills = {}, carry = 0, items = [] } = {}) {
  const flags = {};
  const a = {
    id: uuid, name, uuid, type: "character", items,
    system: {
      conditions: { grappling: false }, sizeTotal: size,
      characteristics: { s: { total: s, bonus: Math.floor(s / 10) }, ag: { total: ag }, ws: { total: ws } },
      skills, meleeStance: "standard", encumbrance: { carry }, actionPoints: { value: 2, max: 2 }
    },
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; return v; },
    unsetFlag: async (_s, k) => { delete flags[k]; },
    update: async (changes) => {
      for (const [path, v] of Object.entries(changes)) {
        let m = path.match(/^flags\.[^.]+\.-=(.+)$/);
        if (m) { delete flags[m[1]]; continue; }
        m = path.match(/^flags\.[^.]+\.(.+)$/);
        if (m) { flags[m[1]] = v; continue; }
        const keys = path.split(".");
        let node = a;
        for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
        node[keys.at(-1)] = v;
      }
      return changes;
    },
    getActiveTokens: () => a._token ? [a._token] : [],
    _flags: flags
  };
  return a;
}

/** Двое сцеплены: holder держит, held — в Захвате. */
async function grappled(holderOpts = {}, heldOpts = {}) {
  const holder = fighter("Держащий", "Actor.h", holderOpts);
  const held = fighter("Удерживаемый", "Actor.t", heldOpts);
  const byUuid = { [holder.uuid]: holder, [held.uuid]: held };
  globalThis.fromUuidSync = uuid => byUuid[uuid] ?? null;
  globalThis.fromUuid = async uuid => byUuid[uuid] ?? null;
  await resolveGrappleSuccess(holder, { target: held });
  return { holder, held };
}

beforeEach(() => {
  resetCaptured();
  _resetPendingContests();
  globalThis.game.user = { ...globalThis.game.user, id: "user-1", isGM: true, targets: new Set() };
  globalThis.game.combat = undefined;
});

describe("роли Захвата", () => {
  it("успешный Захват: держащий — Атакующий (1 рука), цель — Цель (2 руки обездвижены)", async () => {
    const { holder, held } = await grappled();
    expect(grappleRole(holder)).toBe("attacker");
    expect(grappleRole(held)).toBe("target");
    expect(grappleHands(holder)).toBe(1);
    expect(held._flags.grappleHeldHands).toBe(2);
  });

  it("endGrapple снимает роли, руки и Сжатия с обоих", async () => {
    const { holder, held } = await grappled();
    await held.setFlag("warhammer-dbc", SQUEEZE_PENDING_FLAG, 2);
    await endGrapple(holder);
    expect(grappleRole(holder)).toBeNull();
    expect(grappleRole(held)).toBeNull();
    expect(held._flags[SQUEEZE_PENDING_FLAG]).toBeUndefined();
  });

  it("Перехватить Контроль меняет роли местами", async () => {
    const { holder, held } = await grappled();
    await _resolveTakeoverSuccess(held);
    expect(grappleRole(held)).toBe("attacker");
    expect(grappleRole(holder)).toBe("target");
  });
});

describe("встречный тест Борьбы: Навык, бросок партнёра, Размер, руки", () => {
  it("порог — Навык Атлетика (Ранг), противник — партнёр, сопротивляется Athletics(S)", async () => {
    const { holder, held } = await grappled({ skills: { athletics: { total: 60 } } });
    const def = grappleTechDef(holder, { label: "Заломить", defaultChar: "s" });
    expect(def.opponents()).toEqual([held]);
    expect(def.resist).toEqual([{ skill: "athletics" }]);
    expect(def.skills.s).toBe("athletics");
  });

  it("меньший участник: −10 за ступень Размера — и на своём броске, и на броске сопротивления", async () => {
    const { holder, held } = await grappled({ size: 2 }, { size: 0 });
    expect(grappleSizePenalty(held, holder)).toBe(-20);
    expect(grappleSizePenalty(holder, held)).toBe(0);
    const def = grappleTechDef(holder, { label: "Заломить", defaultChar: "s" });
    expect(def.resistMods(held, holder)).toEqual([{ label: "меньше Размером", value: -20 }]);
  });

  it("держит двумя руками — бросает лучший из двух (и когда сопротивляется)", async () => {
    const { holder, held } = await grappled({ items: [] });
    holder.system.skills = {};
    await setGrappleHands(holder, 2);
    expect(grappleHands(holder)).toBe(2);
    expect(held._flags.grappleHeldHands).toBe(4);
    expect(grappleTechDef(holder, { label: "Заломить" }).rollCount).toBe(2);
    expect(grappleTechDef(held, { label: "Вырваться" }).resistRolls(holder)).toBe(2);
  });

  it("Выкрутиться бросает Акробатику (раньше ключ «a» давал порог 0)", async () => {
    const { held } = await grappled({}, { skills: { acrobatics: { total: 55 } } });
    await _showContestDialog(held, grappleTechDef(held, { label: "Выкрутиться", defaultChar: "ag" }));
    expect(captured.dialog.content).toMatch(/id="contest-self"[^>]*value="55"/);
  });

  it("Вырваться: победа во встречном тесте снимает Захват сразу", async () => {
    const { holder, held } = await grappled({ skills: { athletics: { total: 30 } } }, { skills: { athletics: { total: 60 } } });
    // Вырваться — через общий диалог: бросок цели 10, сопротивление держащего 95.
    const breakFree = grappleTechDef(held, {
      label: "Вырваться", defaultChar: "s",
      onSuccess: async a => { await endGrapple(a); }
    });
    captured.nextRoll = 10;
    await _showContestDialog(held, breakFree);
    await captured.dialog.buttons.roll.callback(fakeHtml({ "#contest-char": "s", "#contest-self": "60", "#contest-mod": "0" }));
    const ds = resistButtonData(captured.chat.at(-1).content);
    expect(ds.opponentUuid).toBe(holder.uuid);
    captured.nextRoll = 95;
    await resolveResistClick(ds);
    expect(held.system.conditions.grappling).toBe(false);
    expect(holder.system.conditions.grappling).toBe(false);
  });

  it("проиграл встречный тест — Захват остаётся", async () => {
    const { holder, held } = await grappled();
    const breakFree = grappleTechDef(held, { label: "Вырваться", defaultChar: "s", onSuccess: async a => endGrapple(a) });
    captured.nextRoll = 60;
    await _showContestDialog(held, breakFree);
    await captured.dialog.buttons.roll.callback(fakeHtml({ "#contest-char": "s", "#contest-self": "20", "#contest-mod": "0" }));
    const ds = resistButtonData(captured.chat.at(-1).content);
    captured.nextRoll = 5;
    await resolveResistClick(ds);
    expect(held.system.conditions.grappling).toBe(true);
    expect(grappleRole(holder)).toBe("attacker");
  });
});

describe("Сжать: −10 за полудействие на Физические тесты в Ход цели", () => {
  it("копится во время Хода держащего и переезжает в действующий штраф в начале Хода цели", async () => {
    const { holder, held } = await grappled();
    await _doSqueeze(holder);
    await _doSqueeze(holder);
    expect(held._flags[SQUEEZE_PENDING_FLAG]).toBe(2);
    await held.update(turnStartSqueezeCarryOver(held));
    expect(held._flags.grappleSqueezeActive).toBe(2);
    expect(held._flags[SQUEEZE_PENDING_FLAG]).toBeUndefined();
  });

  it("штраф −20 на Атлетику и атаки, но не на социальные тесты", async () => {
    const { held } = await grappled();
    await held.setFlag("warhammer-dbc", "grappleSqueezeActive", 2);
    const val = ctx => situationalRules(held, ctx).find(r => r.id === "situational.grappleSqueeze")?.effects[0].value ?? 0;
    expect(val({ kind: "skill", skill: "athletics", char: "s" })).toBe(-20);
    expect(val({ kind: "attack" })).toBe(-20);
    expect(val({ kind: "skill", skill: "charm", char: "fel" })).toBe(0);
  });

  it("вырвался до своего Хода — штрафа нет", async () => {
    const { holder, held } = await grappled();
    await _doSqueeze(holder);
    await endGrapple(holder);
    expect(turnStartSqueezeCarryOver(held)).toEqual({});
  });
});

describe("атака в Захвате по роли", () => {
  const knife  = { system: { weaponClass: "melee", range: 1, equipped: true, grips: "1р" } };
  const spear  = { system: { weaponClass: "melee", range: 2, equipped: true, grips: "2р" } };
  const pistol = { system: { weaponClass: "pistol", equipped: true, grips: "1р" } };
  const rifle  = { system: { weaponClass: "basic", equipped: true, grips: "2р" } };

  it("держащий: по цели — нож Стандартной Атакой и пистолет можно, копьё/винтовку/Натиск — нет", async () => {
    const { holder, held } = await grappled();
    expect(grappleAttackBlockReason(holder, knife, held, { isMelee: true, baseKey: "standard" })).toBe("");
    expect(grappleAttackBlockReason(holder, knife, held, { isMelee: true, baseKey: "charge" })).toMatch(/Стандартной/);
    expect(grappleAttackBlockReason(holder, spear, held, { isMelee: true, baseKey: "standard" })).toMatch(/Rng 0–1/);
    expect(grappleAttackBlockReason(holder, pistol, held, { isMelee: false })).toBe("");
    expect(grappleAttackBlockReason(holder, rifle, held, { isMelee: false })).toMatch(/пистолета/);
  });

  it("держащий: третьего бьёт чем угодно", async () => {
    const { holder } = await grappled();
    const other = fighter("Третий", "Actor.x");
    expect(grappleAttackBlockReason(holder, rifle, other, { isMelee: false })).toBe("");
  });

  it("удерживаемый: без свободных рук — нельзя; четырёхрукий, держат одной — может свободными руками", async () => {
    const { held } = await grappled();
    expect(grappleAttackBlockReason(held, knife, null, { isMelee: true })).toMatch(/действия Цели/);
    const fourArms = { type: "trait", name: "Multiple Arms", system: { rating: 4 } };
    held.items = [fourArms];
    expect(grappleFreeHands(held)).toBe(2);
  });
});

describe("Движение и Уклонение в Захвате", () => {
  it("Движение — только держащему и только если он крупнее", async () => {
    const a = await grappled({ size: 1 }, { size: 0 });
    expect(grappleMoveAllowed(a.holder)).toBe(true);
    expect(grappleMoveAllowed(a.held)).toBe(false);
    const b = await grappled({ size: 0 }, { size: 0 });
    expect(grappleMoveAllowed(b.holder)).toBe(false);
  });

  it("Цель не Уклоняется; держащий — только тяжелее цели по Весу Ношения и не меньше Размером", async () => {
    const { holder, held } = await grappled({ carry: 10 }, {});
    held.system.bio = { weight: 80 };
    expect(grappleDodgeBlockReason(held)).toMatch(/не может Уклоняться/);
    expect(grappleDodgeBlockReason(holder)).toMatch(/Вес Ношения/);
    holder.system.encumbrance.carry = 1000;
    expect(grappleDodgeBlockReason(holder)).toBe("");
  });

  it("держащего Оглушили — Захват разорван сам", async () => {
    const { holder, held } = await grappled();
    holder.system.conditions.stunned = true;
    expect(await maybeAutoReleaseGrapple(holder)).toBe(true);
    expect(held.system.conditions.grappling).toBe(false);
  });

  // wdbc-x1nz.2.88 п.3: при потере сознания в changes приходит только
  // unconscious — производный helpless (rules/character.mjs) в диффе не виден,
  // и хук updateActor раньше молча пропускал это событие.
  it("хук: потеря сознания (в changes только unconscious) — повод проверить выпуск", () => {
    expect(grappleReleaseTriggered({ system: { conditions: { unconscious: true } } })).toBe(true);
    for (const key of ["stunned", "dazed", "helpless"])
      expect(grappleReleaseTriggered({ system: { conditions: { [key]: true } } })).toBe(true);
    expect(grappleReleaseTriggered({ system: { conditions: { prone: true } } })).toBe(false);
    expect(grappleReleaseTriggered({ system: { conditions: { unconscious: false } } })).toBe(false);
    expect(grappleReleaseTriggered({ name: "x" })).toBe(false);
  });

  it("держащий потерял сознание — Захват разорван, в карточке «без сознания»", async () => {
    const { holder, held } = await grappled();
    holder.system.conditions.unconscious = true;
    holder.system.conditions.helpless = true; // производное, как в prepareDerivedData
    expect(await maybeAutoReleaseGrapple(holder)).toBe(true);
    expect(held.system.conditions.grappling).toBe(false);
    expect(captured.chat.at(-1)?.content ?? "").toMatch(/без сознания/);
  });

  it("Оглушили удерживаемого — Захват остаётся", async () => {
    const { held } = await grappled();
    held.system.conditions.stunned = true;
    expect(await maybeAutoReleaseGrapple(held)).toBe(false);
  });
});

describe("руки: Захват занимает руки", () => {
  it("у держащего одна рука занята, у цели — две", async () => {
    const { holder, held } = await grappled();
    expect(handsOccupied(holder).used).toBe(1);
    expect(handsOccupied(held).used).toBe(2);
  });
});

describe("укрытие друг другом (±45° от направления на партнёра)", () => {
  it("атакующий за спиной партнёра — в секторе, сбоку — нет", () => {
    const target = { x: 0, y: 0 }, partner = { x: 100, y: 0 };
    expect(inGrappleCoverArc(target, partner, { x: 300, y: 50 })).toBe(true);
    expect(inGrappleCoverArc(target, partner, { x: 0, y: 300 })).toBe(false);
  });

  it("не-Избирательная атака с его стороны уходит в партнёра; Избирательная — нет, если цель не меньше", async () => {
    const { holder, held } = await grappled();
    holder._token = { center: { x: 100, y: 0 } };
    const targetToken = { center: { x: 0, y: 0 }, actor: held };
    const attackerToken = { center: { x: 400, y: 0 }, actor: { uuid: "Actor.shooter" } };
    expect(grappleCoverPartner({ attackerToken, targetToken, targetActor: held, aimed: false })).toBe(holder);
    expect(grappleCoverPartner({ attackerToken, targetToken, targetActor: held, aimed: true })).toBeNull();
  });

  it("меньшего за большим не выцелить и Избирательной", async () => {
    const { holder, held } = await grappled({ size: 2 }, { size: 0 });
    holder._token = { center: { x: 100, y: 0 } };
    const targetToken = { center: { x: 0, y: 0 }, actor: held };
    const attackerToken = { center: { x: 400, y: 0 }, actor: { uuid: "Actor.shooter" } };
    expect(grappleCoverPartner({ attackerToken, targetToken, targetActor: held, aimed: true })).toBe(holder);
  });
});
