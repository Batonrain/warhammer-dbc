// test/combat/monofilament-hit.test.mjs
//
// applyMonofilamentHit (wdbc-tejb, Monofilament X) — единственная часть
// Моносети, реализованная в этой сессии: урон (X×3+Провалы, R, Pen X) ЧЕРЕЗ
// поглощение брони (не минуя её, в отличие от Bane/Vibro), −1 AP брони цели
// во всех частях тела (тот же накопитель, что у Corrosive/armorCorrosion,
// сразу по всем локациям), и бросок 1d5≤X на попадание в Сочленение/Шею.
// Остальное (повторный удар в начале Хода связанной цели, повторный тест на
// освобождение, разрезание пут союзником, Crippling при высвобождении) не
// реализовано — нет ещё самой подсистемы «связанной цели», см. bd wdbc-tejb.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { applyMonofilamentHit } from "../../module/combat/damage.mjs";

const ARMOR_KEYS = ["head", "leftArm", "rightArm", "body", "leftLeg", "rightLeg"];

/** Подставной Персонаж: те же поля, что у incoming-damage-reduction.test.mjs. */
function characterActor({ armorAP = 0, toughnessBonus = 0, wounds = 10, corrosion = {} } = {}) {
  const updates = [];
  const actor = {
    id: "char1", name: "Опутанный", type: "character", updates,
    system: {
      absorption: { body: armorAP + toughnessBonus, toughnessBonus, propFlags: {} },
      wounds: { value: wounds, critical: 0, max: wounds },
      armorCorrosion: Object.fromEntries(ARMOR_KEYS.map(k => [k, corrosion[k] || 0]))
    },
    items: Object.assign([], { contents: [] }),
    async update(data) {
      updates.push(data);
      for (const [path, value] of Object.entries(data)) {
        const m = path.match(/^system\.(.+)$/);
        if (!m) continue;
        const parts = m[1].split(".");
        let node = actor.system;
        for (const k of parts.slice(0, -1)) node = (node[k] ??= {});
        node[parts.at(-1)] = value;
      }
    }
  };
  return actor;
}

beforeEach(resetCaptured);

describe("applyMonofilamentHit: AP брони −1 во ВСЕХ частях тела", () => {
  it("одно попадание — все 6 локаций теряют 1 AP", async () => {
    captured.dice = [5]; // 1d5 роль на Сочленение, не важно для этого теста
    const actor = characterActor({ armorAP: 6, toughnessBonus: 0, wounds: 20 });
    await applyMonofilamentHit(actor, { rating: 2, damage: 5, weaponName: "Моносеть" });
    for (const key of ARMOR_KEYS) expect(actor.system.armorCorrosion[key]).toBe(1);
  });

  it("накапливается поверх уже существующей коррозии (Corrosive другим оружием)", async () => {
    captured.dice = [5];
    const actor = characterActor({ armorAP: 6, wounds: 20, corrosion: { body: 2 } });
    await applyMonofilamentHit(actor, { rating: 2, damage: 5, weaponName: "Моносеть" });
    expect(actor.system.armorCorrosion.body).toBe(3);
    expect(actor.system.armorCorrosion.head).toBe(1);
  });
});

describe("applyMonofilamentHit: бросок 1d5≤X на Сочленение/Шею", () => {
  it("бросок ≤ рейтингу — попадание в Сочленение / Шея", async () => {
    captured.dice = [3];
    const actor = characterActor({ armorAP: 0, wounds: 20 });
    const { isJoint, hitLocation } = await applyMonofilamentHit(actor, { rating: 3, damage: 5, weaponName: "Моносеть" });
    expect(isJoint).toBe(true);
    expect(hitLocation).toBe("Сочленение / Шея");
  });

  it("бросок > рейтинга — обычное попадание в Торс", async () => {
    captured.dice = [4];
    const actor = characterActor({ armorAP: 0, wounds: 20 });
    const { isJoint, hitLocation } = await applyMonofilamentHit(actor, { rating: 3, damage: 5, weaponName: "Моносеть" });
    expect(isJoint).toBe(false);
    expect(hitLocation).toBe("Торс");
  });
});

describe("applyMonofilamentHit: урон идёт ЧЕРЕЗ поглощение брони (Pen X), не минуя её", () => {
  it("AP брони ≥ урона (даже с учётом Pen) — урон поглощён полностью", async () => {
    captured.dice = [5]; // Торс
    // system.absorption в фикстуре — отдельное статичное поле (как и у
    // applyDamageToActor в бою): AP 6 − Pen 2 = 4 эфф. AP; урон 4 ≤ 4 → поглощён.
    const actor = characterActor({ armorAP: 6, toughnessBonus: 0, wounds: 20 });
    await applyMonofilamentHit(actor, { rating: 2, damage: 4, weaponName: "Моносеть" });
    expect(actor.system.wounds.value).toBe(20); // Раны не тронуты
  });

  it("Pen X пробивает броню — остаток уходит в Раны как обычный урон", async () => {
    captured.dice = [5];
    const actor = characterActor({ armorAP: 4, toughnessBonus: 0, wounds: 20 });
    // AP 4 − Pen 3 = 1 эфф. AP; урон 10 − 1 = 9 в Раны.
    await applyMonofilamentHit(actor, { rating: 3, damage: 10, weaponName: "Моносеть" });
    expect(actor.system.wounds.value).toBe(11);
  });

  it("постит карточку через applyDamageToActor с указанным именем оружия", async () => {
    captured.dice = [5];
    const actor = characterActor({ armorAP: 0, wounds: 20 });
    await applyMonofilamentHit(actor, { rating: 2, damage: 5, weaponName: "Моносеть" });
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Моносеть");
    expect(card).toContain(actor.name);
  });
});
