// test/sheets/attack-dialog-combat-talents.test.mjs
//
// Таланты боевых бонусов главы 3, та часть, что живёт в окне атаки
// (sheets/attack/mods.mjs и sheets/attack-dialog.mjs; Sahara 3-8dc5 / 3-5fbf):
//   Надёжная Стойка — нет штрафа Трудного ландшафта к WS;
//   Гурьбой — ещё +10 при численном перевесе 2к1 и выше;
//   Драгун / Мастер-Драгун — штраф нестабильной платформы (стрельба с седла);
//   Выбор Целей — нет штрафа −20 за стрельбу по цели, связанной в рукопашной.
//
// Таланты даются двумя путями: записью Конструктора с ключом Возможности (у
// предмета нарочно испорчено имя) и просто по имени — как у персонажа, купившего
// Талант до появления записи в паке.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";
import { DIFFICULT_TERRAIN_TYPE } from "../../module/regions/difficult-terrain.mjs";

const html = () => captured.dialog?.content ?? "";

function modLine(label) {
  const idx = html().indexOf(`<span>${label}`);
  if (idx < 0) return null;
  const before = html().slice(Math.max(0, idx - 500), idx);
  const tag = before.slice(before.lastIndexOf("<input"));
  return {
    value: (tag.match(/data-value="(-?\d+)"/) || [])[1] ?? null,
    checked: /\schecked(\s|\/|>)/.test(tag),
    disabled: /\sdisabled/.test(tag)
  };
}

const talentByKey = (key, label = "") => ({
  id: "t-" + key, name: "ИСПОРЧЕННОЕ ИМЯ " + key, type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label }
  ] }] } }
});
const talentByName = name => ({ id: "t-" + name, name, type: "talent", system: {} });

const K = {
  steady:  { key: "meleeCore.core.steadyFootwork",   name: "Steady Footwork / Надёжная Стойка" },
  team:    { key: "meleeCore.core.doubleTeam",       name: "Double Team / Гурьбой" },
  dragoon: { key: "rangedCore.core.dragoon",         name: "Dragoon / Драгун" },
  master:  { key: "rangedCore.core.masterDragoon",   name: "Master Dragoon / Мастер-Драгун" },
  target:  { key: "rangedCore.core.targetSelection", name: "Target Selection / Выбор Целей" }
};

function fighter(items = []) {
  const a = actorFor({ items, fatigue: { value: 0 }, aiming: "none" });
  a.type = "character";
  a.uuid = "Actor.fighter";
  a.update = async () => {};
  return a;
}

const prevCanvas = globalThis.canvas;
beforeEach(() => {
  resetCaptured();
  setTargets([]);
  globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [] } };
});
afterEach(() => { globalThis.canvas = prevCanvas; });

// ── Надёжная Стойка ─────────────────────────────────────────────────────────

describe("Надёжная Стойка: штраф Трудного ландшафта к WS", () => {
  const terrain = () => new Set([{ behaviors: [{ type: DIFFICULT_TERRAIN_TYPE, disabled: false, system: { activeProps: [], extraMod: 0 } }] }]);
  function open(talents) {
    const sword = weaponFor({ weaponClass: "melee" });
    const actor = fighter([sword, ...talents]);
    const token = { actor, document: { id: "me", x: 0, y: 0, width: 1, height: 1, disposition: 1, actor, regions: terrain() } };
    globalThis.canvas.tokens.placeables = [token];
    showAttackDialog(actor, sword);
  }

  it("без Таланта в зоне Трудного ландшафта: −10, отмечено само", () => {
    open([]);
    expect(modLine("Трудный ландшафт")).toMatchObject({ value: "-10", checked: true });
    expect(modLine("Очень трудный ландшафт")).toMatchObject({ value: "-20" });
  });

  it("с Талантом (ключ): оба штрафа ландшафта сняты, причина названа", () => {
    open([talentByKey(K.steady.key)]);
    expect(modLine("Трудный ландшафт")).toMatchObject({ value: "0", checked: false, disabled: true });
    expect(modLine("Очень трудный ландшафт")).toMatchObject({ value: "0", disabled: true });
    expect(html()).toContain("Надёжная Стойка");
  });

  it("с Талантом (имя, без записи Конструктора) — то же", () => {
    open([talentByName(K.steady.name)]);
    expect(modLine("Трудный ландшафт")).toMatchObject({ value: "0", disabled: true });
  });

  // Порог суммирует отмеченные галочки уже в живом окне (скрипт окна), заглушка
  // этого не исполняет — поэтому проверяется то, что он суммирует: у снятой
  // строки значение 0 и она не отмечена (см. тесты выше).
});

// ── Гурьбой ─────────────────────────────────────────────────────────────────

describe("Гурьбой: ещё +10 за численное превосходство 2 к 1 и выше", () => {
  const DOUBLE_TEAM_ROW = "Числ. перевес: Гурьбой";
  const tok = ({ x, y, disposition, actor = undefined }) => ({ actor, document: { x, y, width: 1, height: 1, disposition, actor } });

  /** n союзников атакующего в контакте с целью. */
  function open(talents, allies, { targetActor } = {}) {
    const target = tok({ x: 0, y: 0, disposition: -1, actor: targetActor });
    const around = [[1, 0], [0, 1], [-1, 0]].slice(0, allies).map(([x, y]) => tok({ x, y, disposition: 1 }));
    globalThis.canvas.tokens.placeables = [target, ...around];
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([target]) };
    const sword = weaponFor({ weaponClass: "melee" });
    showAttackDialog(fighter([sword, ...talents]), sword);
  }

  it("без Таланта строки нет вовсе", () => {
    open([], 2);
    expect(modLine(DOUBLE_TEAM_ROW)).toBeNull();
  });

  it("с Талантом, двое в контакте с целью: +10, отмечено само, поверх обычного 2к1", () => {
    open([talentByKey(K.team.key)], 2);
    expect(modLine(DOUBLE_TEAM_ROW)).toMatchObject({ value: "10", checked: true });
    expect(modLine("Числ. перевес 2к1")).toMatchObject({ value: "10", checked: true });
  });

  it("с Талантом, трое: и «3к1» +20, и Гурьбой +10", () => {
    open([talentByKey(K.team.key)], 3);
    expect(modLine(DOUBLE_TEAM_ROW)).toMatchObject({ value: "10", checked: true });
    expect(modLine("Числ. перевес 3к1")).toMatchObject({ value: "20", checked: true });
  });

  it("с Талантом, один на один: строка есть, но не отмечена (перевеса нет)", () => {
    open([talentByKey(K.team.key)], 1);
    expect(modLine(DOUBLE_TEAM_ROW)).toMatchObject({ value: "10", checked: false });
  });

  it("по имени (без записи Конструктора) — то же", () => {
    open([talentByName(K.team.name)], 2);
    expect(modLine(DOUBLE_TEAM_ROW)).toMatchObject({ value: "10", checked: true });
  });

  it("против цели с Мастером Боя бонуса за численное превосходство нет, и Гурьбой тоже гасится", () => {
    const master = { type: "talent", name: "Combat Master / Мастер Боя" };
    open([talentByKey(K.team.key)], 2, { targetActor: { name: "Мастер", type: "character", items: [master], system: {} } });
    expect(modLine(DOUBLE_TEAM_ROW)).toMatchObject({ value: "0", disabled: true });
  });
});

// ── Драгун / Мастер-Драгун ──────────────────────────────────────────────────

describe("Драгун / Мастер-Драгун: штраф стрельбы с седла (нестабильная платформа)", () => {
  beforeEach(() => {
    globalThis.game.actors = [{ uuid: "Actor.bike", type: "vehicle", system: {} }];
  });

  function field(speed, weaponSys, talents = []) {
    const weapon = weaponFor({ rof_single: 1, ...weaponSys });
    const actor = actorFor({
      items: [weapon, ...talents], fatigue: { value: 0 }, aiming: "none",
      mount: { uuid: "Actor.bike", role: "rider", speed }
    });
    actor.update = async () => {};
    showAttackDialog(actor, weapon);
    return Number((html().match(/id="atk-mount-ranged"[^>]*value="(-?\d+)"/) || [])[1]);
  }

  it("без Талантов штраф как был: Полное движение −20", () => {
    expect(field("full", { weaponClass: "basic" })).toBe(-20);
  });

  it("Драгун: на 10 меньше — −20 → −10, −10 → 0, и ниже нуля не уходит", () => {
    const d = () => [talentByKey(K.dragoon.key)];
    expect(field("full", { weaponClass: "basic" }, d())).toBe(-10);
    expect(field("charge", { weaponClass: "pistol" }, d())).toBe(-20);
    expect(field("half", { weaponClass: "basic" }, d())).toBe(0);
    expect(field("still", { weaponClass: "basic" }, d())).toBe(0);
  });

  it("Драгун по имени (без записи Конструктора) — то же", () => {
    expect(field("full", { weaponClass: "basic" }, [talentByName(K.dragoon.name)])).toBe(-10);
  });

  it("Мастер-Драгун: штрафа нет вовсе, даже на Натиске; приоритет над Драгуном", () => {
    const both = [talentByKey(K.dragoon.key), talentByKey(K.master.key)];
    expect(field("charge", { weaponClass: "basic" }, both)).toBe(0);
    expect(field("run", { weaponClass: "pistol" }, [talentByName(K.master.name)])).toBe(0);
  });

  it("Тяжёлое и метательное — Таланты не касаются (книга: пистолеты, винтовки, длинные винтовки)", () => {
    const both = [talentByKey(K.dragoon.key), talentByKey(K.master.key)];
    expect(field("full", { weaponClass: "heavy" }, both)).toBe(-20);
    expect(field("full", { weaponClass: "thrown" }, both)).toBe(-20);
  });

  it("Гиро-Стабилизированное по-прежнему 0 (книга: игнорирует) — Талант ничего не портит", () => {
    const gyro = [{ key: "gyroStabilized", rating: 0, rating2: 0 }];
    expect(field("full", { weaponClass: "basic", weaponProps: gyro }, [talentByKey(K.dragoon.key)])).toBe(0);
  });

  it("поле подписано: видно, что снял Талант", () => {
    field("full", { weaponClass: "basic" }, [talentByKey(K.dragoon.key)]);
    expect(html()).toMatch(/id="atk-mount-ranged"[^>]*title="[^"]*Драгун/);
  });
});

// ── Выбор Целей ─────────────────────────────────────────────────────────────

describe("Выбор Целей: стрельба по цели, связанной в рукопашной", () => {
  const LABEL = "Цель связана в рукопашной (с другим персонажем)";
  let id = 0;
  const token = ({ actor, x, y, disposition }) => ({ actor, document: { id: `t${id++}`, x, y, width: 1, height: 1, disposition, actor } });

  function open(talents, weaponClass = "basic") {
    const weapon = weaponFor({ weaponClass });
    const actor = actorFor({ items: [weapon, ...talents], aiming: "none" });
    const shooter = token({ actor, x: 20, y: 20, disposition: 1 });
    const target = token({ actor: { name: "Цель", type: "character" }, x: 0, y: 0, disposition: -1 });
    const locker = token({
      actor: { name: "Союзник цели", type: "character", items: [{ type: "weapon", system: { equipped: true, weaponClass: "melee" } }] },
      x: 0, y: 0, disposition: 1
    });
    globalThis.canvas.tokens.placeables = [shooter, target, locker];
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([target]) };
    showAttackDialog(actor, weapon);
  }

  it("без Таланта: −20, отмечено само", () => {
    open([]);
    expect(modLine(LABEL)).toMatchObject({ value: "-20", checked: true });
  });

  it("с Талантом (ключ): штрафа нет, строка заперта, причина названа", () => {
    open([talentByKey(K.target.key)]);
    expect(modLine(LABEL)).toMatchObject({ value: "0", checked: false, disabled: true });
    expect(html()).toContain("Выбор Целей");
  });

  it("с Талантом (имя) — то же; Пистолет тоже", () => {
    open([talentByName(K.target.name)], "pistol");
    expect(modLine(LABEL)).toMatchObject({ value: "0", disabled: true });
  });

});
