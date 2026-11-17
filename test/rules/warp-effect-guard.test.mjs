// test/rules/warp-effect-guard.test.mjs
//
// wdbc-nzzgn: точка перехвата «эффект Варпа» для Талантов Пси-Стойкости.
//  • Божественная Защита — раз в Раунд d10, на 10 эффект игнорируется;
//  • Эфирный Кокон — +2 к Воле против психосил за каждую действующую на героя
//    силу (Вливание/Изменение/Аура/Призыв);
//  • Отверженный — −10 на Сопротивление силам демонических псайкеров и −10
//    на силы, действующие только на него.
// Правила читаются из НАСТОЯЩИХ данных (library/core.mjs, packs-src), а не из
// подставных записей.

import "../support/foundry-stub.mjs";
import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  DIVINE_PROTECTION_CAP, divineProtectionKey, divineProtectionAvailable,
  attemptDivineProtection, psychicPowersActingOn
} from "../../module/rules/warp-effect-guard.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import { PREDICATES, CTX_DEPENDENT_PREDICATES } from "../../module/rules/predicates.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";
import { hasRuleFlag } from "../../module/rules/flags.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const loadTalent = file => JSON.parse(fs.readFileSync(
  path.join(ROOT, "packs-src/talents/Пси_стойкость", file), "utf8"));
const findFile = prefix => fs.readdirSync(path.join(ROOT, "packs-src/talents/Пси_стойкость"))
  .find(f => f.startsWith(prefix));

const STUB_GAME = globalThis.game;
afterEach(() => { globalThis.game = STUB_GAME; });

const power = (powerType, extra = {}) => ({
  type: "psychicPower", uuid: `Item.${Math.random()}`,
  system: { powerType, extraTypes: [], isSustained: true, sustainedTargetUuid: "", ...extra }
});

describe("divineProtectionKey / divineProtectionAvailable", () => {
  it("вне боя ключа Раунда нет — ограничения «раз в Раунд» нет", () => {
    expect(divineProtectionKey(null)).toBe("");
    expect(divineProtectionAvailable({ getFlag: () => "c1:3" }, null)).toBe(true);
  });
  it("в бою: уже пробовал в этом Раунде — нельзя, в новом — можно", () => {
    const actor = { getFlag: () => "c1:3" };
    expect(divineProtectionAvailable(actor, { id: "c1", round: 3 })).toBe(false);
    expect(divineProtectionAvailable(actor, { id: "c1", round: 4 })).toBe(true);
    expect(divineProtectionAvailable(actor, { id: "c2", round: 3 })).toBe(true);
  });
});

describe("attemptDivineProtection", () => {
  it("только 10 игнорирует эффект", () => {
    expect(attemptDivineProtection(10)).toMatchObject({ ignored: true });
    for (const r of [1, 5, 9]) expect(attemptDivineProtection(r).ignored).toBe(false);
  });
});

describe("Божественная Защита в данных", () => {
  it("Талант выдаёт возможность, известную реестру и с читателем", () => {
    const talent = loadTalent(findFile("Divine_Protection"));
    const entries = talent.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
    expect(entries.some(e => e.kind === "capability" && e.capabilityKey === DIVINE_PROTECTION_CAP)).toBe(true);
    expect(CAPABILITIES[DIVINE_PROTECTION_CAP].reader).toMatch(/warp-effect-guard/);
  });

  it("актор с этим Талантом проходит hasRuleFlag", () => {
    const talent = loadTalent(findFile("Divine_Protection"));
    const actor = { type: "character", system: {}, items: [{ ...talent, id: "t1", type: "talent", system: { ...talent.system, purchased: true } }] };
    expect(hasRuleFlag(actor, DIVINE_PROTECTION_CAP)).toBe(true);
    expect(hasRuleFlag({ type: "character", system: {}, items: [] }, DIVINE_PROTECTION_CAP)).toBe(false);
  });
});

describe("psychicPowersActingOn", () => {
  it("считает только Вливание/Изменение/Ауру/Призыв, поддерживаемые на герое", () => {
    const own = [power("infusion"), power("change"), power("aura"), power("summon"),
      power("attack"), power("infusion", { isSustained: false })];
    const actor = { uuid: "Actor.me", items: own, system: {} };
    globalThis.game = { actors: [actor] };
    expect(psychicPowersActingOn(actor)).toBe(4);
  });
  it("считает и чужие силы, нацеленные на героя, но не нацеленные на других", () => {
    const me = { uuid: "Actor.me", items: [], system: {} };
    const caster = { uuid: "Actor.c", items: [power("aura", { sustainedTargetUuid: "Actor.me" }),
      power("aura", { sustainedTargetUuid: "Actor.other" })], system: {} };
    globalThis.game = { actors: [me, caster] };
    expect(psychicPowersActingOn(me)).toBe(1);
  });
  it("доп. тип из extraTypes тоже считается", () => {
    const me = { uuid: "Actor.me", items: [power("attack", { extraTypes: [{ type: "infusion" }] })], system: {} };
    globalThis.game = { actors: [me] };
    expect(psychicPowersActingOn(me)).toBe(1);
  });
  it("вне игры — 0", () => {
    expect(psychicPowersActingOn({ uuid: "Actor.me", items: [power("aura")] })).toBe(0);
  });
});

const talentItem = name => ({ type: "talent", name, system: { purchased: true }, flags: {} });
const resistCtx = (actor, extra = {}) => ({ actor, kind: "characteristic", char: "wp", psychicThreat: true, ...extra });
const modTotal = r => [...r.mods, ...r.autoMods].reduce((s, m) => s + (m.value ?? 0), 0);

describe("Эфирный Кокон: +2 за каждую действующую силу", () => {
  const mk = items => ({ type: "character", uuid: "Actor.me", system: { characteristics: { wp: { total: 40 } } }, items });

  it("две Ауры/Вливания — +4 на Сопротивление психосиле", () => {
    const actor = mk([talentItem("Aether Cocoon / Эфирный Кокон"), power("aura"), power("infusion")]);
    globalThis.game = { actors: [actor] };
    expect(modTotal(resolveTest(resistCtx(actor)))).toBe(4);
  });
  it("без Таланта бонуса нет", () => {
    const actor = mk([power("aura"), power("infusion")]);
    globalThis.game = { actors: [actor] };
    expect(modTotal(resolveTest(resistCtx(actor)))).toBe(0);
  });
  it("Непрямая сила бонуса не получает", () => {
    const actor = mk([talentItem("Aether Cocoon / Эфирный Кокон"), power("aura")]);
    globalThis.game = { actors: [actor] };
    expect(modTotal(resolveTest(resistCtx(actor, { psychicIndirect: true })))).toBe(0);
  });
  it("не Воля — не считается", () => {
    const actor = mk([talentItem("Aether Cocoon / Эфирный Кокон"), power("aura")]);
    globalThis.game = { actors: [actor] };
    expect(modTotal(resolveTest(resistCtx(actor, { char: "t" })))).toBe(0);
  });
});

describe("Отверженный", () => {
  const me = () => ({ type: "character", uuid: "Actor.me", system: { characteristics: { wp: { total: 40 } } },
    items: [talentItem("Forsaken / Отверженный")] });

  it("против демонического псайкера −10 на Сопротивление", () => {
    const actor = me();
    const caster = { type: "daemon", system: {}, items: [] };
    expect(modTotal(resolveTest(resistCtx(actor, { targetActor: caster })))).toBe(-10);
  });
  it("против обычного псайкера штрафа нет", () => {
    const actor = me();
    const caster = { type: "character", system: {}, items: [] };
    expect(modTotal(resolveTest(resistCtx(actor, { targetActor: caster })))).toBe(0);
  });
  it("без Таланта штрафа нет", () => {
    const actor = { type: "character", uuid: "Actor.x", system: {}, items: [] };
    const caster = { type: "daemon", system: {}, items: [] };
    expect(modTotal(resolveTest(resistCtx(actor, { targetActor: caster })))).toBe(0);
  });
  it("кастеру −10 к манифестации силы на Отверженного (галочкой)", () => {
    const caster = { type: "character", uuid: "Actor.c", system: {}, items: [] };
    const r = resolveTest({ actor: caster, kind: "power", power: "smite", targetActor: me() });
    const all = [...r.mods, ...r.autoMods];
    expect(all.some(m => m.value === -10)).toBe(true);
  });
  it("предикаты цели помечены как зависящие от контекста", () => {
    expect(CTX_DEPENDENT_PREDICATES.has("targetHasTalent")).toBe(true);
    expect(CTX_DEPENDENT_PREDICATES.has("targetIsDaemon")).toBe(true);
    expect(PREDICATES.targetIsDaemon({}, { targetActor: { type: "daemon" } })).toBe(true);
    expect(PREDICATES.targetHasTalent({}, { targetActor: talentHolder() }, "Forsaken")).toBe(true);
  });
});
function talentHolder() { return { items: [talentItem("Forsaken / Отверженный")] }; }

// ── Точка перехвата: Выжигание Души ────────────────────────────────────────
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
const { _executeSoulBurn } = await import("../../module/hooks.mjs");

function dpTarget(flags = {}) {
  const talent = loadTalent(findFile("Divine_Protection"));
  const updates = [];
  return {
    name: "Защищённый", uuid: "Actor.dp", isOwner: true, type: "character",
    system: { characteristics: { wp: { total: 30 } }, psyker: { currentRating: 0 }, wounds: { value: 10, max: 10, critical: 0 } },
    items: [{ ...talent, id: "dp", type: "talent", system: { ...talent.system, purchased: true } }],
    getFlag: (_ns, k) => flags[k], update: async u => { updates.push(u); }, _updates: updates
  };
}
const burner = () => ({
  name: "Псайкер", uuid: "Actor.b", system: { characteristics: { wp: { total: 90 } }, psyker: { currentRating: 0 }, wounds: { value: 10, max: 10, critical: 0 } },
  update: async () => {}
});

describe("Выжигание Души × Божественная Защита", () => {
  it("10 на d10 — Выжигание не бросается, эффект игнорируется, Раунд записан", async () => {
    resetCaptured();
    globalThis.game = { ...STUB_GAME, combat: { id: "c1", round: 2 } };
    const target = dpTarget();
    captured.dice = [10];
    await _executeSoulBurn(burner(), target);
    expect(captured.chat.at(-1).content).toContain("эффект игнорируется");
    expect(captured.chat).toHaveLength(1);
    expect(target._updates[0]).toEqual({ "flags.warhammer-dbc.warpGuardRound": "c1:2" });
  });

  it("не 10 — попытка потрачена, Выжигание идёт дальше", async () => {
    resetCaptured();
    globalThis.game = { ...STUB_GAME, combat: { id: "c1", round: 2 } };
    const target = dpTarget();
    captured.dice = [4, 95, 95];
    await _executeSoulBurn(burner(), target);
    expect(captured.chat[0].content).toContain("Попытка в этом Раунде потрачена");
    expect(captured.chat.length).toBeGreaterThan(1);
  });

  it("в этом Раунде уже пробовал — гейт молчит, Выжигание идёт сразу", async () => {
    resetCaptured();
    globalThis.game = { ...STUB_GAME, combat: { id: "c1", round: 2 } };
    const target = dpTarget({ warpGuardRound: "c1:2" });
    captured.dice = [95, 95];
    await _executeSoulBurn(burner(), target);
    expect(captured.chat.map(c => c.content).join("")).not.toContain("Божественная Защита");
  });
});

// ── Раунд 2 (ответы владельца): вопрос игроку, предложения, Щит Презрения ───
import {
  shieldOfContemptPasses, SHIELD_CAP
} from "../../module/rules/warp-effect-guard.mjs";
const guard = await import("../../module/combat/warp-guard.mjs");
const warpOffersFor = guard.warpOffersFor;

const packTalent = prefix => {
  const t = loadTalent(findFile(prefix));
  return { ...t, id: prefix, type: "talent", system: { ...t.system, purchased: true } };
};
const holder = (prefixes, extra = {}) => ({
  name: "Герой", uuid: "Actor.h", isOwner: true, type: "character",
  system: { characteristics: { wp: { total: 50 } }, skills: { awareness: { total: 40 } }, psyker: { currentRating: 2 }, ...extra.system },
  items: [...prefixes.map(packTalent), ...(extra.items ?? [])],
  getFlag: () => undefined, update: async function (u) { (this._updates ??= []).push(u); }
});

describe("Божественная Защита спрашивает игрока", () => {
  it("игрок отказался — d10 не брошен, попытка Раунда не потрачена", async () => {
    resetCaptured();
    globalThis.game = { ...STUB_GAME, combat: { id: "c1", round: 2 } };
    captured.confirmAnswer = false;
    const t = holder(["Divine_Protection"]);
    captured.dice = [10];
    expect(await guard.tryDivineProtection(t, "Сила")).toBe(false);
    expect(captured.dialog).toBeTruthy();
    expect(t._updates ?? []).toEqual([]);
    expect(captured.chat).toHaveLength(0);
  });
  it("игрок согласился — бросок и трата попытки", async () => {
    resetCaptured();
    globalThis.game = { ...STUB_GAME, combat: { id: "c1", round: 2 } };
    captured.confirmAnswer = true;
    const t = holder(["Divine_Protection"]);
    captured.dice = [10];
    expect(await guard.tryDivineProtection(t, "Сила")).toBe(true);
    expect(t._updates[0]).toEqual({ "flags.warhammer-dbc.warpGuardRound": "c1:2" });
  });
});

describe("warpOffersFor: кнопки карточки сопротивления", () => {
  it("по одной кнопке на Талант, если он есть", () => {
    const a = holder(["Neural_Trig", "Don_t_Trust", "Psychic_Coll"]);
    expect(warpOffersFor(a).map(o => o.action).sort()).toEqual(["collapse", "neural", "perception"]);
  });
  it("без Талантов — пусто; Щит выключен (manualOff) — тоже нет возможности", () => {
    expect(warpOffersFor(holder([]))).toEqual([]);
    const shield = holder(["Shield_of_"]);
    expect(hasRuleFlag(shield, SHIELD_CAP)).toBe(false); // в паке Щит по умолчанию выключен
  });
  it("Щит включили — возможность есть", () => {
    const a = holder(["Shield_of_"]);
    a.items[0].flags["warhammer-dbc"].manualOff = false;
    expect(hasRuleFlag(a, SHIELD_CAP)).toBe(true);
  });
});

describe("Щит Презрения: W+0", () => {
  it("успех при броске ≤ W", () => {
    expect(shieldOfContemptPasses(50, 50)).toBe(true);
    expect(shieldOfContemptPasses(50, 51)).toBe(false);
  });
  const shieldHolder = () => { const a = holder(["Shield_of_"]); a.items[0].flags["warhammer-dbc"].manualOff = false; return a; };
  const caster = () => ({ name: "Псайкер", uuid: "Actor.c", system: { characteristics: { wp: { total: 40 } } }, items: [], getFlag: () => undefined });

  it("Непрямая сила — Щит молчит", async () => {
    resetCaptured();
    expect(await guard.tryShieldOfContempt(shieldHolder(), caster(), { indirect: true })).toBe(false);
    expect(captured.chat).toHaveLength(0);
  });
  it("успех: эффект игнорируется; псайкер бросает W+0 — провал развеивает силу", async () => {
    resetCaptured();
    captured.dice = [30, 90];
    const r = await guard.tryShieldOfContempt(shieldHolder(), caster(), { indirect: false });
    expect(r).toBe(true);
    expect(captured.chat.at(-1).content).toContain("развеяна");
  });
  it("провал: эффект действует, носитель впадает в Ярость", async () => {
    resetCaptured();
    captured.dice = [90];
    const t = shieldHolder();
    const r = await guard.tryShieldOfContempt(t, caster(), { indirect: false });
    expect(r).toBe(false);
    expect(t._updates.some(u => u["system.inRage"] === true)).toBe(true);
  });
  it("без включённого Щита — ничего", async () => {
    resetCaptured();
    const a = holder(["Shield_of_"]);
    expect(await guard.tryShieldOfContempt(a, caster(), {})).toBe(false);
  });
});

describe("кнопки предложений", () => {
  it("Тайный бросок ГМ шепчет ГМам и называет порог Awareness−10", async () => {
    resetCaptured();
    captured.dice = [20];
    const a = holder(["Don_t_Trust"]);
    globalThis.ChatMessage.getWhisperRecipients = () => ["gm1"];
    await guard.runWarpOffer("perception", a);
    const msg = captured.chat.at(-1);
    expect(msg.content).toContain("30");
    expect(msg.whisper ?? msg.data?.whisper).toBeTruthy();
  });
  it("Обвал: снимает собственную поддерживаемую силу и кидает Феномен", async () => {
    resetCaptured();
    captured.dice = [40];
    const p = { ...power("infusion"), name: "Покров", update: async function (u) { (this._u ??= []).push(u); }, getFlag: () => undefined };
    const a = holder(["Psychic_Coll"], { items: [p] });
    await guard.runWarpOffer("collapse", a);
    expect(p._u?.[0]["system.isSustained"]).toBe(false);
    expect(captured.chat.at(-1).content).toContain("Феномен");
  });
});
