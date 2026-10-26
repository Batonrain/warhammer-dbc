// test/sheets/attack-selection-stock-grip.test.mjs
//
// Прикладный Хват / Stock Grip (Рукопашные, Sahara 3-8dc5): штык в одноручном
// хвате «1р» — WS −10 вместо −5. Данные штыка — настоящий JSON из packs-src
// (форма фикстуры сверена с паком: хват штыка «2р (Бл)», «1р» у него нет).

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { packDocById } from "../support/pack-doc.mjs";
import { buildSelection } from "../../module/sheets/attack/selection.mjs";
import { gripEffects, parseGrips } from "../../module/constants/combat.mjs";
import { stockGripActive, STOCK_GRIP_SECONDARY_WS } from "../../module/rules/melee-talents.mjs";

const talentByKey = key => ({
  id: "t-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }
  ] }] } }
});
const STOCK = "meleeCore.core.stockGrip";

const bayonetDoc = packDocById("packs-src/weapons/Имперское/Рукопашное/Примитивное", "Z0dpXv9pjaHp9dh2");
const bayonet = () => weaponFor({ ...bayonetDoc.system }, { name: bayonetDoc.name });
const sword = () => weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "1р (2р)" }, { name: "Меч" });

function selectionFor(actor, item, gripKey) {
  const { resolveSelectionSafe } = buildSelection({
    actor, atkProfiles: [], bowMarkedMod: 0, categoryFor: () => item.system.meleeCategory, fullAttackForced: false,
    gripKey: "2р", gripList: ["2р", "Бл", "1р"], hasShieldEquipped: false, isMelee: true, isMounted: false, item,
    maneuverKeyDefault: "standard", meleeBaseKey: "standard", primGrip: "2р", profIdx: -1, sBonus: 4,
    stance: "standard", sys: item.system, targetActor: null, trainingFor: () => ({ trained: true, source: "" }),
    wp: { cheapShot: false }
  });
  return resolveSelectionSafe({ gripKey, baseKey: "standard", maneuverKey: "standard" });
}

beforeEach(() => resetCaptured());

describe("Прикладный Хват: данные", () => {
  it("штык в паке — категория «Штык», хват «2р (Бл)», «1р» у него нет", () => {
    expect(bayonetDoc.system.meleeCategory).toBe("Штык");
    expect(parseGrips(bayonetDoc.system.grips)).toEqual(["2р", "Бл"]);
  });

  it("Талант в паке несёт запись Конструктора с ключом возможности", () => {
    const talent = packDocById("packs-src/talents/Рукопашные", "pzZBNeIgI2UrDGQ4");
    const keys = (talent.flags["warhammer-dbc"].mechanics ?? []).flatMap(g => g.entries).map(e => e.capabilityKey);
    expect(keys).toContain(STOCK);
  });
});

describe("Прикладный Хват: гейт", () => {
  it("с Талантом (ключ) штык — да", () => {
    expect(stockGripActive(actorFor({ items: [talentByKey(STOCK)] }), bayonet())).toBe(true);
  });
  it("с Талантом (имя без записи Конструктора) — да", () => {
    const a = actorFor({ items: [{ id: "s", name: "Stock Grip / Прикладный Хват", type: "talent", system: {} }] });
    expect(stockGripActive(a, bayonet())).toBe(true);
  });
  it("без Таланта — нет", () => {
    expect(stockGripActive(actorFor({}), bayonet())).toBe(false);
  });
  it("не штык (меч) — нет", () => {
    expect(stockGripActive(actorFor({ items: [talentByKey(STOCK)] }), sword())).toBe(false);
  });
});

describe("Прикладный Хват: WS −10 вместо −5 в окне атаки", () => {
  it("без Таланта вторичный «1р» — −5 (регрессия)", () => {
    expect(selectionFor(actorFor({}), bayonet(), "1р").gWs).toBe(-5);
  });
  it("с Талантом штык в «1р» — −10", () => {
    expect(selectionFor(actorFor({ items: [talentByKey(STOCK)] }), bayonet(), "1р").gWs).toBe(STOCK_GRIP_SECONDARY_WS);
    expect(STOCK_GRIP_SECONDARY_WS).toBe(-10);
  });
  it("остальное вторичного хвата как есть: Баланс −1", () => {
    expect(selectionFor(actorFor({ items: [talentByKey(STOCK)] }), bayonet(), "1р").gDef.balMod).toBe(-1);
  });
  it("с Талантом основной хват штыка «2р» не меняется", () => {
    expect(selectionFor(actorFor({ items: [talentByKey(STOCK)] }), bayonet(), "2р").gWs).toBe(0);
  });
  it("с Талантом меч в «1р» (вторичном) остаётся −5 — Талант только про штыки", () => {
    expect(selectionFor(actorFor({ items: [talentByKey(STOCK)] }), sword(), "1р").gWs).toBe(-5);
  });
});

describe("gripEffects: переопределение secWs", () => {
  it("opts.secWs подменяет вторичный WS только у вторичного хвата", () => {
    expect(gripEffects("1р", true, { secWs: -10 }).ws).toBe(-10);
    expect(gripEffects("1р", false, { secWs: -10 }).ws).toBe(0);
    expect(gripEffects("1р", true).ws).toBe(-5);
  });
});
