// test/rules/talent-moves.test.mjs
//
// Движение по Таланту (Sahara task-bbe1, решение владельца 27.10.2026): таблица Талантов/Черт с
// Движением вне обычных кнопок меню — rules/talent-moves.mjs. Тест на НАСТОЯЩИХ данных пака:
// имя в таблице опознаёт реальный предмет packs-src (с тем же типом), ключ Возможности существует.

import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  TALENT_MOVES, TALENT_MOVE_MODES, talentMoveDefsFor, resolveTalentMoveMeters, talentMoveGate,
  talentMoveCostLabel, talentMoveLimitKey
} from "../../module/rules/talent-moves.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const PACK_DIRS = ["talents", "aeldari-talents", "traits", "aeldari-traits"];

/** Все предметы нужных паков: имя → { type, file }. */
function packItems() {
  const out = [];
  const walk = d => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) walk(p);
      else if (f.name.endsWith(".json") && f.name !== "_Folder.json") {
        const j = JSON.parse(fs.readFileSync(p, "utf8"));
        out.push({ name: j.name, type: j.type, system: j.system });
      }
    }
  };
  for (const d of PACK_DIRS) walk(path.join(ROOT, "packs-src", d));
  return out;
}
const ITEMS = packItems();
const halves = name => String(name).split("/").map(s => s.trim().toLowerCase());

/** Актор-двойник с предметами в форме документа. */
function actorWith(...docs) {
  const items = docs.map((d, i) => ({ id: `i${i}`, name: d.name, type: d.type, system: d.system, flags: d.flags ?? {} }));
  return { items: Object.assign(items, { contents: items }), getFlag: () => undefined, system: {} };
}

describe("таблица Движения по Таланту — привязка к настоящим данным", () => {
  it("каждая запись: есть предмет в паке нужного типа, ключ Возможности существует, виды и цены осмысленны", () => {
    expect(TALENT_MOVES.length).toBe(5); // Танец Рассечения, Наёмник Дела, Скорость Сокола, Туманный Прыжок, Туманоходец
    for (const def of TALENT_MOVES) {
      const hits = ITEMS.filter(i => def.itemTypes.includes(i.type) && def.match.test(i.name));
      const found = hits.length > 0;
      expect(hits.length, `${def.id}: регулярка имени цепляет лишнее: ${hits.map(h => h.name).join(" | ")}`).toBe(1);
      expect(found, `${def.id}: в packs-src нет предмета по /${def.match.source}/ типа ${def.itemTypes}`).toBe(true);
      expect(CAPABILITIES[def.capabilityKey], `${def.id}: нет Возможности ${def.capabilityKey}`).toBeTruthy();
      expect(def.moves.length).toBeGreaterThan(0);
      const ids = def.moves.map(m => m.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const m of def.moves) {
        expect(TALENT_MOVE_MODES).toContain(m.mode);
        expect(m.label && m.condition).toBeTruthy();
        if (m.mode === "teleport") expect(m.distance.unlimited || m.distance.pb).toBeTruthy();
        if (m.mode === "walk") expect(m.distance.of).toBeTruthy();
      }
    }
  });

  it("Скорость Сокола: 1 Реакция — Полудвижение, 2 — Полное, без Свободной Атаки; Наёмник Дела — раз за бой в 1-м Раунде; Туманоходец — раз в Раунд на P.b м", () => {
    const by = id => TALENT_MOVES.find(d => d.id === id);
    expect(by("speedOfTheFaolchu").moves.map(m => [m.cost.reactions, m.distance.of, m.noFreeAttack])).toEqual([[1, "halfMove", true], [2, "move", true]]);
    expect(by("mercenaryOfTheMatter").moves[0]).toMatchObject({ limit: { unit: "battle" }, onlyRound: 1, distance: { of: "move" } });
    expect(by("mistwalker").moves[0]).toMatchObject({ mode: "teleport", limit: { unit: "round" }, distance: { pb: 1 } });
    expect(by("mistLeap").moves[0]).toMatchObject({ mode: "teleport", cost: { ap: 2 } });
  });
});

describe("talentMoveDefsFor: кому показывать пункт меню", () => {
  it("по имени предмета нужного типа (любая половина двуязычного имени)", () => {
    const dance = ITEMS.find(i => halves(i.name).includes("dance of carnage"));
    const mist = ITEMS.find(i => halves(i.name).includes("mistwalker"));
    expect(talentMoveDefsFor(actorWith(dance)).map(d => d.id)).toEqual(["danceOfCarnage"]);
    expect(talentMoveDefsFor(actorWith(dance, mist)).map(d => d.id).sort()).toEqual(["danceOfCarnage", "mistwalker"]);
    expect(talentMoveDefsFor(actorWith())).toEqual([]);
  });

  it("Черта-тёзка не того типа не считается (Mistwalker — Черта, не Талант)", () => {
    const fakeTalent = { name: "Mistwalker / Туманоходец", type: "talent", system: {} };
    expect(talentMoveDefsFor(actorWith(fakeTalent))).toEqual([]);
  });
});

describe("resolveTalentMoveMeters", () => {
  // У персонажа поля movement.spd нет: SPD = halfMove (Полудвижение = SPD×1). См. тест на схему ниже.
  const MV = { halfMove: 3, move: 6, charge: 9, run: 18 };
  const worshippers = id => TALENT_MOVES.find(d => d.id === "worshippersOfDance").moves.find(m => m.id === id);
  const acrobatic = id => TALENT_MOVES.find(d => d.id === "acrobaticMastery").moves.find(m => m.id === id);

  it("walk: дистанция с листа (halfMove/move)", () => {
    const dance = TALENT_MOVES.find(d => d.id === "danceOfCarnage").moves[0];
    expect(resolveTalentMoveMeters(dance, { movement: MV })).toEqual({ ok: true, meters: 3 });
    expect(resolveTalentMoveMeters(dance, { movement: {} }).ok).toBe(false);
  });

  it("поля, из которых читает таблица, есть в настоящей схеме персонажа: movement.halfMove и characteristics.per, а spd/p — нет", async () => {
    const { ACTOR_DATA_MODELS } = await import("../../module/data/index.mjs");
    const sys = new ACTOR_DATA_MODELS.character({}).toObject();
    expect(sys.movement).toHaveProperty("halfMove");
    expect(sys.movement).not.toHaveProperty("spd");
    expect(sys.characteristics).toHaveProperty("per");
    expect(sys.characteristics).not.toHaveProperty("p");
  });

  it("teleport: P.b метров, либо без потолка (Туманный Прыжок)", () => {
    const mist = TALENT_MOVES.find(d => d.id === "mistwalker").moves[0];
    expect(resolveTalentMoveMeters(mist, { pb: 4 })).toEqual({ ok: true, meters: 4 });
    expect(resolveTalentMoveMeters(mist, { pb: 0 }).ok).toBe(false);
    const leap = TALENT_MOVES.find(d => d.id === "mistLeap").moves[0];
    expect(resolveTalentMoveMeters(leap, {})).toEqual({ ok: true, meters: null, unlimited: true });
  });
});

describe("talentMoveGate", () => {
  const by = (def, id) => TALENT_MOVES.find(d => d.id === def).moves.find(m => m.id === id);

  it("Наёмник Дела: только 1-й Раунд и раз за бой", () => {
    const m = by("mercenaryOfTheMatter", "firstRoundFullMove");
    expect(talentMoveGate(m, { inCombat: true, round: 1, limitReady: true })).toEqual({ ok: true });
    expect(talentMoveGate(m, { inCombat: true, round: 2, limitReady: true }).ok).toBe(false);
    expect(talentMoveGate(m, { inCombat: true, round: 1, limitReady: false }).reason).toContain("в этом бою");
  });

  it("Скорость Сокола: 2 Реакции — одной мало; ОД не нужны", () => {
    const full = by("speedOfTheFaolchu", "reactionFull");
    expect(talentMoveGate(full, { inCombat: true, reactions: 1 }).ok).toBe(false);
    expect(talentMoveGate(full, { inCombat: true, reactions: 2 }).ok).toBe(true);
    const half = by("speedOfTheFaolchu", "reactionHalf");
    expect(talentMoveGate(half, { inCombat: true, reactions: 1, ap: 0 }).ok).toBe(true);
  });

  it("Туманный Прыжок: 2 ОД и Очко Трофеев; ОД вне боя не проверяются, Очко Трофеев — всегда", () => {
    const leap = by("mistLeap", "leap");
    expect(talentMoveGate(leap, { inCombat: true, ap: 1, trophy: 1 }).ok).toBe(false);
    expect(talentMoveGate(leap, { inCombat: true, ap: 2, trophy: 0 }).reason).toContain("Трофеев");
    expect(talentMoveGate(leap, { inCombat: false, ap: 0, trophy: 1 }).ok).toBe(true);
    expect(talentMoveGate(leap, { inCombat: false, ap: 0, trophy: 0 }).ok).toBe(false);
  });

  it("Скорость Сокола: «не двигался» меряется флагом «двигался»; ГМ обходит", () => {
    const half = by("speedOfTheFaolchu", "reactionHalf");
    expect(talentMoveGate(half, { inCombat: true, reactions: 1, moved: false }).ok).toBe(true);
    const moved = talentMoveGate(half, { inCombat: true, reactions: 1, moved: true });
    expect(moved.ok).toBe(false);
    expect(moved.reason).toContain("Двигался");
    expect(talentMoveGate(half, { inCombat: true, reactions: 1, moved: true, isGM: true }).ok).toBe(true);
    // условие только у Движений Скорости Сокола
    expect(talentMoveGate(by("danceOfCarnage", "carnage"), { inCombat: true, moved: true }).ok).toBe(true);
  });

  it("подписи цены и ключ ограничителя", () => {
    expect(talentMoveCostLabel(by("mistLeap", "leap"))).toBe("2 ОД + 1 Очко Трофеев");
    expect(talentMoveCostLabel(by("speedOfTheFaolchu", "reactionHalf"))).toBe("1 Реакция");
    expect(talentMoveCostLabel(by("speedOfTheFaolchu", "reactionFull"))).toBe("2 Реакции");
    expect(talentMoveCostLabel(by("danceOfCarnage", "carnage"))).toBe("бесплатно");
    expect(talentMoveLimitKey("mistwalker", "mist")).toBe("talentMove.mistwalker.mist");
  });
});
