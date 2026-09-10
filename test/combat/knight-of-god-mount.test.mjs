// test/combat/knight-of-god-mount.test.mjs
//
// wdbc-1rno, «Рыцарь Бога»: демон-скакун вселён в уже имеющегося скакуна/
// технику (module/apps/demon-mount.mjs) — фиксированные книжные бонусы,
// читаемые движком напрямую по flags.warhammer-dbc.mountPossession.
//  • Рыцарь Кхорна: +8 AP от стрелковых атак (module/combat/damage.mjs) и
//    доп. кубик урона Тарана (module/combat/vehicle.mjs::_resolveRam).
//  • Рыцарь Нургла: автопрохождение Трудного Ландшафта верхом
//    (module/combat/mount.mjs::showMountTerrainDialog) без единого броска.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { applyDamageToActor } from "../../module/combat/damage.mjs";
import { _resolveRam, applyDamageToVehicle } from "../../module/combat/vehicle.mjs";
import { showMountTerrainDialog } from "../../module/combat/mount.mjs";

function possessedActor({ god = "khorne", extra = {}, armorAP = 0, toughnessBonus = 0, wounds = 20 } = {}) {
  return {
    id: "mount1", name: "Джаггернаут", type: "character",
    flags: { "warhammer-dbc": { mountPossession: { god, demonName: "Джаггернаут", ...extra } } },
    system: {
      absorption: { body: armorAP + toughnessBonus, toughnessBonus, propFlags: {} },
      wounds: { value: wounds, critical: 0, max: wounds }
    },
    items: Object.assign([], { contents: [] }),
    getFlag: () => undefined,
    async update(data) {
      if (data["system.wounds.value"] !== undefined) this.system.wounds.value = data["system.wounds.value"];
      if (data["system.wounds.critical"] !== undefined) this.system.wounds.critical = data["system.wounds.critical"];
    }
  };
}

const damage = (over = {}) => ({
  rawDamage: 10, penetration: 0, damageType: "impact", hitLocation: "Торс",
  attackerName: "Стрелок", weaponName: "Лазган", ...over
});

beforeEach(resetCaptured);

describe("Рыцарь Кхорна: +8 AP от стрелковых атак", () => {
  it("стрелковая атака (melee:false) — AP одержимого скакуна выше на 8", async () => {
    const actor = possessedActor({ extra: { apRanged: 8 }, armorAP: 2, wounds: 20 });
    await applyDamageToActor(actor, damage({ rawDamage: 10, melee: false }));
    // Поглощение 2 (броня) + 8 (Рыцарь Кхорна) = 10; непоглощённый 10−10=0.
    expect(actor.system.wounds.value).toBe(20);
  });

  it("рукопашная атака (melee:true) — бонус НЕ применяется", async () => {
    const actor = possessedActor({ extra: { apRanged: 8 }, armorAP: 2, wounds: 20 });
    await applyDamageToActor(actor, damage({ rawDamage: 10, melee: true }));
    expect(actor.system.wounds.value).toBe(12); // 10 − 2, без +8
  });

  it("не одержимый обычный актор — бонуса нет вовсе", async () => {
    const actor = possessedActor({ extra: {}, armorAP: 2, wounds: 20 });
    delete actor.flags["warhammer-dbc"].mountPossession;
    await applyDamageToActor(actor, damage({ rawDamage: 10, melee: false }));
    expect(actor.system.wounds.value).toBe(12); // 10 − 2, флага нет
  });
});

// Ритуал «Вселение Скакуна в Технику» книга адресует ИМЕННО машине, и
// apps/demon-mount.mjs отдельно обрабатывает mount.type === "vehicle"
// (Структура вместо Ран). Но урон по технике уходит в applyDamageToVehicle
// РАНЬШЕ общего расчёта брони, поэтому проверять бонус только на
// type:"character" мало — так он и остался недоставленным машине.
describe("Рыцарь Кхорна: +8 AP доезжает и до ТЕХНИКИ, не только до живого скакуна", () => {
  function possessedVehicle(extra = {}) {
    const system = {
      armour: { front: 10 },
      structure: { value: 20, critical: 0, ablative: 0, ablativeMax: 0 },
      derived: { traitFlags: {} }
    };
    return {
      type: "vehicle", name: "Рейдер",
      flags: { "warhammer-dbc": { mountPossession: { god: "khorne", demonName: "Джаггернаут", ...extra } } },
      system,
      getActiveTokens: () => [],
      update: async data => {
        if (data["system.structure.value"] !== undefined) system.structure.value = data["system.structure.value"];
      }
    };
  }

  it("стрелковая атака по одержимой машине — +8 к AP борта", async () => {
    const actor = possessedVehicle({ apRanged: 8 });
    // AP 10 + 8 = 18 против урона 15 → поглощено полностью.
    await applyDamageToVehicle(actor, { rawDamage: 15, side: "front", melee: false });
    expect(actor.system.structure.value).toBe(20);
  });

  it("рукопашная атака по одержимой машине — бонус НЕ применяется", async () => {
    const actor = possessedVehicle({ apRanged: 8 });
    await applyDamageToVehicle(actor, { rawDamage: 15, side: "front", melee: true });
    expect(actor.system.structure.value).toBe(15); // 15 − AP10 = 5 в Структуру
  });

  it("не одержимая машина — бонуса нет", async () => {
    const actor = possessedVehicle({ apRanged: 8 });
    delete actor.flags["warhammer-dbc"].mountPossession;
    await applyDamageToVehicle(actor, { rawDamage: 15, side: "front", melee: false });
    expect(actor.system.structure.value).toBe(15);
  });
});

describe("Рыцарь Кхорна: доп. кубик урона Тарана (_resolveRam)", () => {
  it("без флага, обычная скорость — 1 кубик 1d10", async () => {
    const actor = { type: "vehicle", name: "Джаггернаут", flags: {}, system: { armour: { front: 5 } } };
    captured.dice = [7];
    await _resolveRam(actor, false, false);
    expect(captured.chat.at(-1).content).toContain("Урон I(Cr): Лоб.AP <b>5</b> + <b>7</b> (1×1d10) = <b>12</b>");
  });

  it("флаг ramExtraDie — доп. кубик складывается с обычным (не заменяет)", async () => {
    const actor = {
      type: "vehicle", name: "Джаггернаут",
      flags: { "warhammer-dbc": { mountPossession: { god: "khorne", ramExtraDie: true } } },
      system: { armour: { front: 5 } }
    };
    captured.dice = [7, 3];
    await _resolveRam(actor, false, false);
    const card = captured.chat.at(-1).content;
    expect(card).toContain("2×1d10");
    expect(card).toContain("Рыцарь Кхорна: доп. кубик");
    expect(card).toContain("= <b>15</b>"); // 5 + 7 + 3
  });

  it("флаг ramExtraDie + fast (≥1,5 SPD) — 3 кубика (обычный доп. + скоростной доп.)", async () => {
    const actor = {
      type: "vehicle", name: "Джаггернаут",
      flags: { "warhammer-dbc": { mountPossession: { god: "khorne", ramExtraDie: true } } },
      system: { armour: { front: 5 } }
    };
    captured.dice = [4, 4, 4];
    await _resolveRam(actor, true, false);
    const card = captured.chat.at(-1).content;
    expect(card).toContain("3×1d10");
    expect(card).toContain("= <b>17</b>"); // 5 + 4+4+4
  });
});

const realFromUuid = globalThis.fromUuid;
const resolveMountAs = doc => { globalThis.fromUuid = async () => doc; };
afterEach(() => { globalThis.fromUuid = realFromUuid; });

function nurgleMount({ autoTerrain = false } = {}) {
  return {
    type: "character", uuid: "Actor.mount", name: "Паланкин Нургла", items: [],
    flags: autoTerrain ? { "warhammer-dbc": { mountPossession: { god: "nurgle", autoTerrain: true } } } : {},
    system: { size: 3, movement: { halfMove: 8 }, wounds: { value: 40, max: 40, critical: 0 } }
  };
}

function nurgleRider() {
  return {
    type: "character", uuid: "Actor.rider", name: "Всадник", items: [],
    system: {
      size: 0, characteristics: {}, skills: { survival: { rank: "trained", total: 30 } },
      groupSkills: { operate: [] },
      mount: { uuid: "Actor.mount", role: "rider", speed: "half" }
    }
  };
}

describe("Рыцарь Нургла: автопрохождение Трудного Ландшафта верхом", () => {
  it("одержимый Паланкин Нургла — карточка успеха без единого броска, диалог не открывается", async () => {
    resolveMountAs(nurgleMount({ autoTerrain: true }));
    await showMountTerrainDialog(nurgleRider());

    expect(captured.dialog).toBeFalsy();
    expect(captured.rolls).toEqual([]);
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Трудный Ландшафт");
    expect(card).toContain("автоматически");
  });

  it("обычный (не одержимый) скакун — обычный диалог с тестом по-прежнему открывается", async () => {
    resolveMountAs(nurgleMount({ autoTerrain: false }));
    await showMountTerrainDialog(nurgleRider());

    expect(captured.dialog).toBeTruthy();
  });
});
