// test/combat/resilience-c-status.test.mjs
//
// Таланты Стойкости (глава 3, пакет C): Стальная Челюсть (T+0 против Оглушения) и
// Стена (S+0 против падения, на 5+ Успехов — ответный сбив нападающего) в единой
// точке наложения Состояний — combat/status-resist.mjs — и во ВСЕХ источниках,
// которые к ней подключены. Подключённые источники проверяются поштучно: «подключено»
// без такого теста — слова.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { offerStatusResist, statusApplyFields } from "../../module/combat/status-resist.mjs";
import { applyDamageToActor } from "../../module/combat/damage.mjs";
import { resolveKnockdownSuccess } from "../../module/combat/knockdown.mjs";
import { resolveBulldozeSuccess } from "../../module/combat/bulldoze.mjs";
import { _resolveOverpowerSuccess } from "../../module/combat/grapple.mjs";
import { applyCritEffectPill } from "../../module/combat/crit-effect-parser.mjs";
import { applyFall } from "../../module/combat/mount.mjs";
import { applyDreadWailWave } from "../../module/combat/dread-wail.mjs";
import { applyOnTargetFailConditions } from "../../module/rules/on-target-fail.mjs";

const { _applyWeaponPropEffect } = await import("../../module/hooks.mjs");

const flush = () => new Promise(r => setTimeout(r, 0));
const ch = total => ({ total, bonus: Math.floor(total / 10) });
const talentItem = name => ({ type: "talent", name, system: {}, flags: {}, getFlag: () => undefined });

const IRON_JAW = "Iron Jaw / Стальная Челюсть";
const STONEWALL = "Stonewall / Стена";

/** Персонаж, достаточный и для applyDamageToActor, и для приёмов Борьбы. */
function person({ talents = [], items = [], s = 50, t = 50, name = "Носитель", uuid = "Actor.p1", conditions = {} } = {}) {
  const store = {};
  const list = [...talents.map(talentItem), ...items];
  list.contents = list;
  list.get = id => list.find(i => i.id === id) ?? null;
  const a = {
    id: uuid.replace("Actor.", ""), name, type: "character", uuid, isOwner: true, updates: [], _store: store,
    system: {
      absorption: { head: 0, body: 0, rightArm: 0, leftArm: 0, leftLeg: 0, rightLeg: 0, toughnessBonus: 0, propFlags: {}, armorOnly: {} },
      characteristics: { s: ch(s), t: ch(t), wp: ch(40), ag: ch(40), int: ch(40) },
      wounds: { value: 20, critical: 0, max: 20 }, fate: { value: 2 }, cover: { ap: 0 },
      armorCorrosion: { head: 0, body: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 },
      actionPoints: { value: 2, max: 2 }, conditions: { ...conditions }, fatigue: { value: 0, max: 10 }, patronGod: "", size: 4
    },
    items: list, effects: Object.assign([], { contents: [] }),
    getFlag: (scope, key) => store[`${scope}.${key}`],
    setFlag: async (scope, key, v) => { store[`${scope}.${key}`] = v; },
    unsetFlag: async (scope, key) => { delete store[`${scope}.${key}`]; },
    getActiveTokens: () => [],
    async update(data) {
      this.updates.push(data);
      for (const [path, value] of Object.entries(data)) {
        const m = path.match(/^flags\.([^.]+)\.(.+)$/);
        if (m) { store[`${m[1]}.${m[2]}`] = value; continue; }
        const keys = path.split(".").slice(1);
        let node = this.system;
        for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
        node[keys.at(-1)] = value;
      }
    },
    async updateEmbeddedDocuments() { return []; }
  };
  return a;
}

/** Предмет-иммунитет к Состоянию (запись Конструктора kind:"condition", режим «иммунитет»). */
const immunityTo = condKey => ({
  type: "trait", name: `Иммунитет ${condKey}`, system: {}, getFlag: () => undefined,
  flags: { "warhammer-dbc": { mechanics: [{ operator: "AND", entries: [
    { id: "i1", kind: "condition", condKey, condMode: "immunity", when: { negate: false, conditions: [] } }] }] } }
});

const chatText = () => captured.chat.map(m => m.content ?? "").join("\n");

beforeEach(resetCaptured);
afterEach(() => { delete globalThis.fromUuid; delete globalThis.game.combat; });

// ── Единая точка ────────────────────────────────────────────────────────────

describe("единая точка наложения: statusApplyFields / offerStatusResist", () => {
  it("не носитель — вопроса нет, патч наложения целиком", async () => {
    const a = person();
    const r = await statusApplyFields(a, "stunned", 2, { source: "тест" });
    expect(captured.dialog).toBeNull();
    expect(r).toMatchObject({ resisted: false });
    expect(r.fields).toMatchObject({ "system.conditions.stunned": true, "system.conditions.stunnedRounds": 2 });
  });

  it("Стальная Челюсть: тест T+0 пройден — Оглушение не накладывается (патч пуст)", async () => {
    const a = person({ talents: [IRON_JAW], t: 50 });
    captured.dice = [10];            // 10 ≤ 50 — успех, (50−10)/10+1 = 5 Успехов
    const r = await statusApplyFields(a, "stunned", 2, { source: "Грозный Вопль" });
    expect(r.resisted).toBe(true);
    expect(r.fields).toEqual({});
    expect(captured.dialog.window.title).toBe("Стальная Челюсть");
    expect(chatText()).toContain("Стальная Челюсть");
    expect(chatText()).toContain("Оглушение проигнорировано");
    expect(r.note).toContain("Оглушение проигнорировано");
  });

  it("Стальная Челюсть: тест провален — Оглушение накладывается как обычно", async () => {
    const a = person({ talents: [IRON_JAW], t: 50 });
    captured.dice = [95];
    const r = await statusApplyFields(a, "stunned", 3, {});
    expect(r.resisted).toBe(false);
    expect(r.fields).toMatchObject({ "system.conditions.stunned": true, "system.conditions.stunnedRounds": 3 });
    expect(chatText()).toContain("Оглушение накладывается");
  });

  it("отказ от теста («Принять эффект») — Состояние накладывается, кубы не брошены", async () => {
    const a = person({ talents: [IRON_JAW] });
    captured.confirmAnswer = false;
    captured.dice = [];              // бросок вызвал бы ошибку очереди
    const r = await statusApplyFields(a, "stunned", 1, {});
    expect(r.resisted).toBe(false);
    expect(Object.keys(r.fields).length).toBeGreaterThan(0);
    expect(captured.rolls).toEqual([]);
  });

  it("Стена гасит падение, не Оглушение; Стальная Челюсть — наоборот", async () => {
    const wall = person({ talents: [STONEWALL] });
    await statusApplyFields(wall, "stunned", 1, {});
    expect(captured.dialog).toBeNull();
    const jaw = person({ talents: [IRON_JAW] });
    await statusApplyFields(jaw, "prone", null, {});
    expect(captured.dialog).toBeNull();
  });

  it("иммунитет к Состоянию: вопроса нет (диалог только когда Состояние РЕАЛЬНО накладывается)", async () => {
    const a = person({ talents: [IRON_JAW], items: [immunityTo("stunned")] });
    const r = await statusApplyFields(a, "stunned", 1, {});
    expect(captured.dialog).toBeNull();
    expect(r.fields).toEqual({});
    expect(r.resisted).toBe(false);
  });

  it("иммунитет: прямой вызов offerStatusResist (путь пилюль и психосил) тоже молчит", async () => {
    const a = person({ talents: [IRON_JAW], items: [immunityTo("stunned")] });
    expect(await offerStatusResist(a, "stunned", {})).toMatchObject({ resisted: false });
    expect(captured.dialog).toBeNull();
    await applyCritEffectPill(a, { key: "stunned", formula: "1d5" });
    expect(captured.dialog).toBeNull();
    expect(a.system.conditions.stunned).toBeFalsy();     // иммунитет сработал сам, без Таланта
  });

  it("Сопротивление (Stun) даёт +10 к тесту Стальной Челюсти против Оглушения", async () => {
    const resist = { type: "talent", name: "Resistance / Сопротивление", system: { specialization: "Stun" }, flags: {}, getFlag: () => undefined };
    const a = person({ talents: [IRON_JAW], items: [resist], t: 50 });
    captured.dice = [58];            // 58 > 50, но ≤ 60 (50 + 10 Сопротивления)
    const r = await statusApplyFields(a, "stunned", 1, {});
    expect(r.resisted).toBe(true);
    const b = person({ talents: [IRON_JAW], t: 50 });
    captured.dice = [58];
    expect((await statusApplyFields(b, "stunned", 1, {})).resisted).toBe(false);
  });

  it("уже лежит — «сбить с ног» ничего не меняет, вопроса нет", async () => {
    const a = person({ talents: [STONEWALL], conditions: { prone: true } });
    const r = await statusApplyFields(a, "prone", null, {});
    expect(captured.dialog).toBeNull();
    expect(r.resisted).toBe(false);
  });

  it("повторный вход для того же актора и Состояния не спрашивает второй раз (рекурсия)", async () => {
    const a = person({ talents: [IRON_JAW] });
    captured.dice = [10];
    let inner = null;
    const real = captured.confirmAnswer;
    // Пока висит диалог первого вызова, второй вызов того же актора/Состояния должен промолчать.
    const origConfirm = foundry.applications.api.DialogV2.confirm;
    foundry.applications.api.DialogV2.confirm = async cfg => {
      inner = await offerStatusResist(a, "stunned", {});
      return origConfirm.call(foundry.applications.api.DialogV2, cfg);
    };
    try {
      const outer = await offerStatusResist(a, "stunned", {});
      expect(inner).toMatchObject({ resisted: false });
      expect(outer.resisted).toBe(true);
    } finally { foundry.applications.api.DialogV2.confirm = origConfirm; captured.confirmAnswer = real; }
  });

  it("без Foundry-диалога (отказ окна) — трактуется как «принять эффект»", async () => {
    const a = person({ talents: [IRON_JAW] });
    const orig = foundry.applications.api.DialogV2.confirm;
    foundry.applications.api.DialogV2.confirm = async () => { throw new Error("нет окна"); };
    try {
      const r = await statusApplyFields(a, "stunned", 1, {});
      expect(r.resisted).toBe(false);
    } finally { foundry.applications.api.DialogV2.confirm = orig; }
  });
});

// ── Стена: ответный сбив ────────────────────────────────────────────────────

describe("Стена: 5+ Успехов против рукопашного приёма", () => {
  it("5+ Успехов и выбор «Сбить»: носитель устоял, нападающий лёг", async () => {
    const wall = person({ talents: [STONEWALL], s: 50 });
    const foe = person({ name: "Враг", uuid: "Actor.foe" });
    captured.dice = [10];            // 5 Успехов
    const p = resolveKnockdownSuccess(foe, { deg: 3, target: wall });
    await flush();
    expect(captured.dialog.window.title).toBe("Стена");
    await captured.press("knock", null);
    await p;
    expect(wall.system.conditions.prone).toBeFalsy();
    expect(foe.system.conditions.prone).toBe(true);
    expect(chatText()).toContain("сбит с ног");
  });

  it("5+ Успехов, выбор «Просто устоять»: никто не лёг", async () => {
    const wall = person({ talents: [STONEWALL], s: 50 });
    const foe = person({ name: "Враг", uuid: "Actor.foe" });
    captured.dice = [10];
    const p = resolveKnockdownSuccess(foe, { deg: 3, target: wall });
    await flush();
    await captured.press("ignore", null);
    await p;
    expect(wall.system.conditions.prone).toBeFalsy();
    expect(foe.system.conditions.prone).toBeFalsy();
  });

  it("меньше 5 Успехов: устоял, но выбора нет", async () => {
    const wall = person({ talents: [STONEWALL], s: 50 });
    const foe = person({ name: "Враг", uuid: "Actor.foe" });
    captured.dice = [30];            // (50−30)/10+1 = 3 Успеха
    await resolveKnockdownSuccess(foe, { deg: 3, target: wall });
    expect(captured.dialog.window.title).toBe("Стена");     // это confirm теста; выбора нет — wait не открывался
    expect(captured.press).toBeNull();
    expect(wall.system.conditions.prone).toBeFalsy();
    expect(foe.system.conditions.prone).toBeFalsy();
  });

  it("тест провален — носитель сбит, нападающий цел", async () => {
    const wall = person({ talents: [STONEWALL], s: 50 });
    const foe = person({ name: "Враг", uuid: "Actor.foe" });
    captured.dice = [90];
    await resolveKnockdownSuccess(foe, { deg: 3, target: wall });
    expect(wall.system.conditions.prone).toBe(true);
    expect(foe.system.conditions.prone).toBeFalsy();
  });

  it("ответный сбив не зацикливается (защита — melee:false и noKnockBack): у нападающего тоже Стена — он вправе устоять, но не сбивать в ответ", async () => {
    const wall = person({ talents: [STONEWALL], s: 50 });
    const foe = person({ talents: [STONEWALL], s: 50, name: "Враг", uuid: "Actor.foe" });
    captured.dice = [10, 10];        // носитель: 5 Успехов; враг на ответный сбив — тоже 5 Успехов
    const p = resolveKnockdownSuccess(foe, { deg: 3, target: wall });
    await flush();
    await captured.press("knock", null);
    await p;
    // ответного выбора у врага быть не должно: после его теста wait не открывается второй раз
    expect(wall.system.conditions.prone).toBeFalsy();
    expect(foe.system.conditions.prone).toBeFalsy();    // враг успешно устоял от ответного сбива
  });
});

// ── Источники ───────────────────────────────────────────────────────────────

describe("источник: приём Оглушить (damage.mjs)", () => {
  const stun = over => ({ rawDamage: 15, penetration: 0, damageType: "impact", hitLocation: "Голова",
    attackerName: "Враг", weaponName: "Булава", melee: true, stunManeuver: true, ...over });

  it("носитель Стальной Челюсти устоял — Оглушения нет, карточка не врёт «урон поглощён»", async () => {
    const a = person({ talents: [IRON_JAW], t: 60 });
    captured.dice = [10];
    await applyDamageToActor(a, stun());
    expect(a.system.conditions.stunned).toBeFalsy();
    expect(a.system.wounds.value).toBe(20);
    const card = chatText();
    expect(card).toContain("Оглушение не наложено");
    expect(card).not.toContain("Урон поглощён полностью");
  });

  it("тест провален — Оглушение на ⌈15/2⌉=8 Раундов", async () => {
    const a = person({ talents: [IRON_JAW], t: 60 });
    captured.dice = [99];
    await applyDamageToActor(a, stun());
    expect(a.system.conditions.stunned).toBe(true);
    expect(a.system.conditions.stunnedRounds).toBe(8);
  });

  it("не носитель — как раньше, без вопросов", async () => {
    const a = person();
    await applyDamageToActor(a, stun());
    expect(captured.dialog).toBeNull();
    expect(a.system.conditions.stunnedRounds).toBe(8);
  });
});

describe("источник: Повалить / Напролом / Пересилить", () => {
  it("Повалить: Стена S+0 пройдена — цель не ложится, карточка называет причину", async () => {
    const wall = person({ talents: [STONEWALL], s: 60 });
    const foe = person({ uuid: "Actor.foe", name: "Враг" });
    captured.dice = [40];            // 3 Успеха — без выбора
    await resolveKnockdownSuccess(foe, { deg: 3, target: wall });
    expect(wall.system.conditions.prone).toBeFalsy();
    expect(chatText()).toContain("остаётся на ногах");
  });

  it("Напролом (5+ Успехов): носитель Стены вправе устоять", async () => {
    const wall = person({ talents: [STONEWALL], s: 60 });
    const foe = person({ uuid: "Actor.foe", name: "Враг" });
    captured.dice = [40];
    await resolveBulldozeSuccess(foe, { deg: 5, target: wall });
    expect(wall.system.conditions.prone).toBeFalsy();
    expect(chatText()).toContain("остаётся на ногах");
  });

  it("Напролом: не носитель падает как раньше", async () => {
    const t = person();
    const foe = person({ uuid: "Actor.foe", name: "Враг" });
    await resolveBulldozeSuccess(foe, { deg: 5, target: t });
    expect(t.system.conditions.prone).toBe(true);
  });

  it("Пересилить → «Повалить»: Стена гасит падение партнёра по Захвату", async () => {
    const wall = person({ talents: [STONEWALL], s: 60, uuid: "Actor.wall", name: "Стена" });
    const foe = person({ uuid: "Actor.foe", name: "Враг" });
    foe._store["warhammer-dbc.grapplePartnerUuid"] = wall.uuid;
    globalThis.fromUuidSync = u => (u === wall.uuid ? wall : null);
    captured.dice = [40];
    const p = _resolveOverpowerSuccess(foe, { deg: 2 });
    await flush();
    await captured.press("prone", null);       // «Повалить» (а не «Сдвинуть»)
    await flush();
    captured.dismiss?.();                       // 3 Успеха — выбора «Сбить» нет, но если окно открылось, закрываем
    await p;
    expect(wall.system.conditions.prone).toBeFalsy();
    expect(chatText()).toContain("Пересилить: устоял");
  });
});

describe("источник: Критический Эффект (пилюли)", () => {
  it("пилюля «Оглушена на 1d5 Раундов»: носитель Стальной Челюсти устоял", async () => {
    const a = person({ talents: [IRON_JAW], t: 60 });
    captured.dice = [10];
    await applyCritEffectPill(a, { key: "stunned", formula: "1d5" });
    expect(a.system.conditions.stunned).toBeFalsy();
    expect(chatText()).toContain("Оглушение проигнорировано");
  });

  it("пилюля «Сбит с ног»: Стена гасит", async () => {
    const a = person({ talents: [STONEWALL], s: 60 });
    captured.dice = [10];
    await applyCritEffectPill(a, { key: "prone", formula: null });
    expect(a.system.conditions.prone).toBeFalsy();
  });

  it("пилюля Оглушения проваленного теста: накладывается и кидает кубик длительности", async () => {
    const a = person({ talents: [IRON_JAW], t: 60 });
    captured.dice = [99, 4];         // тест провален, 1d5 = 4
    await applyCritEffectPill(a, { key: "stunned", formula: "1d5" });
    expect(a.system.conditions.stunned).toBe(true);
    expect(a.system.conditions.stunnedRounds).toBe(4);
  });

  it("другие пилюли (Кровотечение) носитель не спрашивает", async () => {
    const a = person({ talents: [IRON_JAW, STONEWALL] });
    await applyCritEffectPill(a, { key: "bleeding", formula: null });
    expect(captured.dialog).toBeNull();
    expect(a.system.conditions.bleeding).toBe(true);
  });
});

describe("источник: свойства оружия (hooks.mjs::_applyWeaponPropEffect)", () => {
  const ds = over => ({
    wpForceActorUuid: "Actor.p1", wpLabel: "Оглушающее", wpKey: "concussive",
    wpCondition: "stunned", wpTestChar: "t", wpDeg: "0", wpRounds: "1", wpFixedRounds: "2", ...over
  });

  it("Оглушающее: цель провалила T, но носитель Стальной Челюсти устоял второй проверкой", async () => {
    const a = person({ talents: [IRON_JAW], t: 50 });
    globalThis.fromUuid = async () => a;
    captured.dice = [95, 10];        // тест свойства провален (95 > 50), тест Челюсти успешен
    await _applyWeaponPropEffect(ds());
    expect(a.system.conditions.stunned).toBeFalsy();
    expect(chatText()).toContain("Стальная Челюсть");
  });

  it("Оглушающее: цель прошла собственный тест — Челюсть не спрашивается вовсе", async () => {
    const a = person({ talents: [IRON_JAW], t: 50 });
    globalThis.fromUuid = async () => a;
    captured.dice = [10];
    await _applyWeaponPropEffect(ds());
    expect(captured.dialog).toBeNull();
    expect(a.system.conditions.stunned).toBeFalsy();
  });

  it("Гравитационное (grav): Стена гасит падение", async () => {
    const a = person({ talents: [STONEWALL], s: 50, t: 50 });
    globalThis.fromUuid = async () => a;
    captured.dice = [95, 10];
    await _applyWeaponPropEffect(ds({ wpKind: "grav", wpCondition: "", wpLabel: "Гравитационное", wpKey: "graviton" }));
    expect(a.system.conditions.prone).toBeFalsy();
    expect(a.system.conditions.pinned).toBe(true);        // Прижата Стеной не гасится
  });

  it("Оглушающее без Таланта: накладывается без вопросов", async () => {
    const a = person({ t: 50 });
    globalThis.fromUuid = async () => a;
    captured.dice = [95];
    await _applyWeaponPropEffect(ds());
    expect(captured.dialog).toBeNull();
    expect(a.system.conditions.stunned).toBe(true);
  });
});

describe("остальные источники", () => {
  it("Грозный Вопль (волна): носитель Стальной Челюсти устоял, не носитель оглушён", async () => {
    const mk = (uuid, talents) => {
      const v = person({ talents, t: 60, uuid, name: uuid });
      v.system.characteristics.wp = ch(20);          // тест волны W−20 → Порог 0 → провал
      return v;
    };
    const jaw = mk("Actor.jaw", [IRON_JAW]);
    const plain = mk("Actor.plain", []);
    const caster = person({ uuid: "Actor.cast", name: "Шумовой" });
    caster.system.corruptionBonus = 6;               // радиус 3 м
    caster.system.fate = { value: 2, max: 5 };
    caster.items.push({ type: "trait", name: "Dread Wail / Грозный Вопль", system: {}, flags: {} });
    const tok = (id, actor, x) => ({ id, x, y: 0, width: 1, height: 1, hidden: false, actor });
    const casterToken = tok("c1", caster, 0);
    casterToken.parent = { grid: { size: 100, distance: 2 }, tokens: { contents: [casterToken, tok("t1", jaw, 100), tok("t2", plain, 100)] } };
    globalThis.game.combat = { id: "combat-1" };
    captured.dice = [99, 10, 99];   // волна: jaw провалил W−20, тест T Челюсти успешен; plain провалил W−20
    await applyDreadWailWave(caster, casterToken, "stunned");
    expect(jaw.system.conditions.stunned).toBeFalsy();
    expect(plain.system.conditions.stunned).toBe(true);
  });

  it("падение из седла: Стена оставляет всадника на ногах, урон падения остаётся", async () => {
    const rider = person({ talents: [STONEWALL], s: 60, name: "Всадник" });
    captured.dice = [3, 10];         // урон падения 1d10 = 3, затем тест Стены
    await applyFall(rider, "1d10");
    expect(rider.system.conditions.prone).toBeFalsy();
    expect(chatText()).toContain("остаётся на ногах");
  });

  it("падение из седла: не носитель ложится как раньше", async () => {
    const rider = person({ name: "Всадник" });
    captured.dice = [3];
    await applyFall(rider, "1d10");
    expect(rider.system.conditions.prone).toBe(true);
    expect(chatText()).toContain("лежит на земле");
  });

  it("Состояние цели при провале сопротивления психосилы (onTargetFail): носитель Челюсти устоял", async () => {
    const target = person({ talents: [IRON_JAW], t: 60 });
    const power = {
      name: "Хор Язв", actor: person({ uuid: "Actor.cast", name: "Кастер" }),
      flags: { "warhammer-dbc": { mechanics: [{ operator: "AND", entries: [
        { id: "e1", kind: "condition", condKey: "stunned", condMode: "onTargetFail", condLevel: "1",
          condDurationValue: "", condDurationUnit: "", when: { negate: false, conditions: [] } }] }] } }
    };
    globalThis.fromUuid = async () => power;
    captured.dice = [10];
    const res = await applyOnTargetFailConditions("Item.power", target);
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ applied: false, resisted: true });
    expect(target.system.conditions.stunned).toBeFalsy();
  });
});
