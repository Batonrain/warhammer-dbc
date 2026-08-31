// test/combat/weapon-property-effects.test.mjs
//
// wdbc-plsf: Corrosive/Piercing/Crippling/Haywire — раньше были только
// текстовой заметкой в чате (targetEffect.kind, buildTargetEffectButtons),
// теперь применяются напрямую в applyDamageToActor (combat/damage.mjs), где
// уже известны актор, место попадания и непоглощённый урон. Плюс общий
// гейт иммунитета weaponPropertyImmunity.<key> (hasWeaponPropertyImmunity).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor, extractPiercingWound, applyCripplingTrigger } from "../../module/combat/damage.mjs";
import { hasRuleFlag } from "../../module/rules/flags.mjs";

/** Подставной Персонаж с полями, которые читают/пишут новые свойства. */
function characterActor({
  armorAP = 0, toughnessBonus = 0, wounds = 20,
  armorCorrosion = {}, piercingWounds = {}, crippledWounds = [],
  immuneTo = null,       // ключ свойства (напр. "corrosive") — вешает capability-предмет
  inRageImmuneTo = null, // ключ свойства — вешает weaponPropertyImmunityInRage.<key> (Purity of Wrath)
  inRage = false
} = {}) {
  const updates = [];
  const items = [];
  if (immuneTo) {
    items.push({
      id: "immunity-item", name: "Тестовый иммунитет", type: "mutation",
      system: {},
      flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
        { id: "e", kind: "capability", capabilityKey: `weaponPropertyImmunity.${immuneTo}`, label: "" }
      ] }] } }
    });
  }
  if (inRageImmuneTo) {
    items.push({
      id: "rage-immunity-item", name: "Purity of Wrath", type: "mutation",
      system: {},
      flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
        { id: "e", kind: "capability", capabilityKey: `weaponPropertyImmunityInRage.${inRageImmuneTo}`, label: "" }
      ] }] } }
    });
  }
  return {
    id: "char1", name: "Стойкий", type: "character", uuid: "Actor.char1", updates,
    system: {
      absorption: {
        body: armorAP + toughnessBonus, toughnessBonus, propFlags: {},
        armorOnly: { head: armorAP, body: armorAP, leftArm: armorAP, rightArm: armorAP, leftLeg: armorAP, rightLeg: armorAP }
      },
      wounds: { value: wounds, critical: 0, max: wounds },
      armorCorrosion: { head: 0, body: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0, ...armorCorrosion },
      piercingWounds: { head: 0, body: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0, ...piercingWounds },
      crippledWounds: [...crippledWounds],
      inRage
    },
    items: Object.assign([...items], { contents: items }),
    async update(data) {
      updates.push(data);
      for (const [path, value] of Object.entries(data)) {
        const keys = path.split(".").slice(1); // отбрасываем "system"
        let cur = this.system;
        for (const k of keys.slice(0, -1)) cur = (cur[k] ??= {});
        cur[keys.at(-1)] = value;
      }
    }
  };
}

const damage = (over = {}) => ({
  rawDamage: 15, penetration: 0, damageType: "impact", hitLocation: "Торс",
  attackerName: "Стрелок", weaponName: "Тестовое оружие", ...over
});

beforeEach(resetCaptured);

describe("Corrosive: −X AP в месте попадания, остаток — непоглощ. урон", () => {
  it("AP хватает — теряется ровно X, доп. урона нет", async () => {
    const actor = characterActor({ armorAP: 10, toughnessBonus: 0, wounds: 20 });
    await applyDamageToActor(actor, damage({ rawDamage: 0, corrosiveRating: 4 }));
    expect(actor.system.armorCorrosion.body).toBe(4);
    expect(actor.system.wounds.value).toBe(20);
  });

  it("AP не хватает — остаток рейтинга идёт непоглощаемым уроном", async () => {
    const actor = characterActor({ armorAP: 3, toughnessBonus: 0, wounds: 20 });
    await applyDamageToActor(actor, damage({ rawDamage: 0, corrosiveRating: 5 }));
    expect(actor.system.armorCorrosion.body).toBe(3); // сгорело всё, что было
    expect(actor.system.wounds.value).toBe(18); // 20 − (5−3)
  });

  it("накапливается по нескольким попаданиям в одну локацию", async () => {
    const actor = characterActor({ armorAP: 10, toughnessBonus: 0, wounds: 20 });
    await applyDamageToActor(actor, damage({ rawDamage: 0, corrosiveRating: 3 }));
    await applyDamageToActor(actor, damage({ rawDamage: 0, corrosiveRating: 3 }));
    expect(actor.system.armorCorrosion.body).toBe(6);
  });

  it("иммунитет (weaponPropertyImmunity.corrosive) — AP не теряется", async () => {
    const actor = characterActor({ armorAP: 10, toughnessBonus: 0, wounds: 20, immuneTo: "corrosive" });
    await applyDamageToActor(actor, damage({ rawDamage: 0, corrosiveRating: 4 }));
    expect(actor.system.armorCorrosion.body).toBe(0);
  });

  it("заметка в чате называет место попадания и −X AP", async () => {
    const actor = characterActor({ armorAP: 10, toughnessBonus: 0, wounds: 20 });
    await applyDamageToActor(actor, damage({ rawDamage: 0, corrosiveRating: 4, hitLocation: "Торс" }));
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Разъедающее");
    expect(card).toContain("−4 AP брони (Торс)");
  });
});

describe("Piercing: снаряд в ране при непоглощённом уроне, извлечение", () => {
  it("непоглощённый урон прошёл — рана ставится", async () => {
    const actor = characterActor({ armorAP: 0, toughnessBonus: 0, wounds: 20 });
    await applyDamageToActor(actor, damage({ rawDamage: 10, piercing: true }));
    expect(actor.system.piercingWounds.body).toBe(1);
  });

  it("урон полностью поглощён — раны нет (нет непоглощённого урона)", async () => {
    const actor = characterActor({ armorAP: 20, toughnessBonus: 0, wounds: 20 });
    await applyDamageToActor(actor, damage({ rawDamage: 10, piercing: true }));
    expect(actor.system.piercingWounds.body).toBe(0);
  });

  it("иммунитет — рана не ставится, несмотря на непоглощённый урон", async () => {
    const actor = characterActor({ armorAP: 0, toughnessBonus: 0, wounds: 20, immuneTo: "piercing" });
    await applyDamageToActor(actor, damage({ rawDamage: 10, piercing: true }));
    expect(actor.system.piercingWounds.body).toBe(0);
  });

  it("заметка упоминает −1 SPD для торса/ноги, но не для руки", async () => {
    const actorBody = characterActor({ armorAP: 0, wounds: 20 });
    await applyDamageToActor(actorBody, damage({ rawDamage: 10, piercing: true, hitLocation: "Торс" }));
    expect(captured.chat.at(-1).content).toContain("−1 SPD");

    resetCaptured();
    const actorArm = characterActor({ armorAP: 0, wounds: 20 });
    await applyDamageToActor(actorArm, damage({ rawDamage: 10, piercing: true, hitLocation: "П. Рука" }));
    expect(captured.chat.at(-1).content).not.toContain("−1 SPD");
  });

  it("extractPiercingWound: снимает рану и наносит +1 непоглощ. R Dmg", async () => {
    const actor = characterActor({ piercingWounds: { body: true }, wounds: 20 });
    await extractPiercingWound(actor, "body");
    expect(actor.system.piercingWounds.body).toBe(0);
    expect(actor.system.wounds.value).toBe(19);
  });

  it("extractPiercingWound на пустой ране — ничего не меняет", async () => {
    const actor = characterActor({ wounds: 20 });
    await extractPiercingWound(actor, "body");
    expect(actor.system.wounds.value).toBe(20);
    expect(actor.updates).toHaveLength(0);
  });
});

describe("Crippling: рана с шипами записывается, триггер наносит урон без снятия раны", () => {
  it("непоглощённый урон — рана добавляется в crippledWounds", async () => {
    const actor = characterActor({ armorAP: 0, wounds: 20 });
    await applyDamageToActor(actor, damage({ rawDamage: 10, cripplingRating: 3, damageType: "rending" }));
    expect(actor.system.crippledWounds).toEqual([
      { location: "body", locationLabel: "Торс", rating: 3, damageType: "rending" }
    ]);
  });

  it("урон полностью поглощён — рана не добавляется", async () => {
    const actor = characterActor({ armorAP: 20, wounds: 20 });
    await applyDamageToActor(actor, damage({ rawDamage: 10, cripplingRating: 3 }));
    expect(actor.system.crippledWounds).toEqual([]);
  });

  it("иммунитет — рана не добавляется", async () => {
    const actor = characterActor({ armorAP: 0, wounds: 20, immuneTo: "crippling" });
    await applyDamageToActor(actor, damage({ rawDamage: 10, cripplingRating: 3 }));
    expect(actor.system.crippledWounds).toEqual([]);
  });

  it("applyCripplingTrigger наносит непоглощаемый урон и НЕ трогает crippledWounds", async () => {
    const actor = characterActor({ wounds: 20, crippledWounds: [{ location: "body", locationLabel: "Торс", rating: 3, damageType: "rending" }] });
    await applyCripplingTrigger(actor, 3, "Торс");
    expect(actor.system.wounds.value).toBe(17);
    expect(actor.system.crippledWounds).toHaveLength(1); // рана снимается только лечением
  });
});

describe("Haywire: мощность — чистый 1d10 по таблице, X — только радиус (стр. 168)", () => {
  it("низкий бросок — Незначительно, эффекта нет", async () => {
    captured.nextRoll = 1;
    const actor = characterActor({ armorAP: 0, wounds: 20 });
    // haywireRating: 0 — валидный рейтинг («привязан к цели», книга стр. 168),
    // гейт применения идёт по haywireActive (presence), а не rating>0: это
    // единственное отличие Haywire от Corrosive/Crippling в этом файле.
    await applyDamageToActor(actor, damage({ rawDamage: 0, haywireActive: true, haywireRating: 0 }));
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Незначительно");
  });

  it("рейтинг X к мощности НЕ прибавляется — он лишь радиус поля в заметке", async () => {
    captured.nextRoll = 8;
    const actor = characterActor({ armorAP: 0, wounds: 20 });
    await applyDamageToActor(actor, damage({ rawDamage: 0, haywireActive: true, haywireRating: 3 }));
    const card = captured.chat.at(-1).content;
    expect(card).toContain("=<b>8</b>");        // 8, не 8+3=11
    expect(card).toContain("радиус 3 м");
    expect(card).not.toContain("ЭМИ Шторм");    // до 11+ без «+X» не дотянуться на 8
  });

  it("иммунитет — броска не происходит вовсе, заметки нет", async () => {
    captured.nextRoll = 8;
    const actor = characterActor({ armorAP: 0, wounds: 20, immuneTo: "haywire" });
    await applyDamageToActor(actor, damage({ rawDamage: 0, haywireActive: true, haywireRating: 3 }));
    const card = captured.chat.at(-1).content;
    expect(card).not.toContain("ЭМИ");
  });
});

describe("Иммунитет ТОЛЬКО в Ярости (Дар Кхорна Purity of Wrath, wdbc-plsf)", () => {
  it("вне Ярости — иммунитет НЕ действует, эффект применяется как обычно", async () => {
    const actor = characterActor({ armorAP: 0, wounds: 20, inRageImmuneTo: "crippling", inRage: false });
    await applyDamageToActor(actor, damage({ rawDamage: 10, cripplingRating: 3 }));
    expect(actor.system.crippledWounds).toHaveLength(1);
  });

  it("в Ярости — иммунитет действует", async () => {
    const actor = characterActor({ armorAP: 0, wounds: 20, inRageImmuneTo: "crippling", inRage: true });
    await applyDamageToActor(actor, damage({ rawDamage: 10, cripplingRating: 3 }));
    expect(actor.system.crippledWounds).toEqual([]);
  });

  it("в Ярости, но без Purity of Wrath — иммунитета всё равно нет", async () => {
    const actor = characterActor({ armorAP: 0, wounds: 20, inRage: true });
    await applyDamageToActor(actor, damage({ rawDamage: 10, cripplingRating: 3 }));
    expect(actor.system.crippledWounds).toHaveLength(1);
  });

  it("иммунитет по одному ключу не перетекает на другой (crippling ≠ corrosive)", async () => {
    const actor = characterActor({ armorAP: 10, wounds: 20, inRageImmuneTo: "crippling", inRage: true });
    await applyDamageToActor(actor, damage({ rawDamage: 0, corrosiveRating: 4 }));
    expect(actor.system.armorCorrosion.body).toBe(4); // Corrosive не покрыт этим грантом
  });
});

describe("Иммунитет по субмутации (Animal Hybrid, субмутация 7 «Слизняк», wdbc-plsf)", () => {
  // Не через applyDamageToActor: проверяется сам гейт when.submutations
  // (mech-when.mjs, уже существующий механизм) на форме записи, которую
  // реально несёт packs-src/mutations/…/Animal_Hybrid…json.
  function actorWithHybrid(submutationLabel) {
    const item = {
      id: "hybrid1", name: "Animal Hybrid", type: "mutation",
      system: { submutation: submutationLabel ? { label: submutationLabel } : {} },
      flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
        {
          id: "hybrid-slug-wpi-corrosive", kind: "capability", capabilityKey: "weaponPropertyImmunity.corrosive",
          label: "", when: { negate: false, conditions: [], submutations: ["7"], negateSub: false }
        }
      ] }] } }
    };
    return { id: "char1", name: "Гибрид", type: "character", system: {}, items: Object.assign([item], { contents: [item] }) };
  }

  it("субмутация не выбрана — иммунитета нет", () => {
    expect(hasRuleFlag(actorWithHybrid(null), "weaponPropertyImmunity.corrosive")).toBe(false);
  });

  it("выпала другая субмутация (напр. «4») — иммунитета нет", () => {
    expect(hasRuleFlag(actorWithHybrid("4"), "weaponPropertyImmunity.corrosive")).toBe(false);
  });

  it("выпала субмутация «7» (Слизняк) — иммунитет есть", () => {
    expect(hasRuleFlag(actorWithHybrid("7"), "weaponPropertyImmunity.corrosive")).toBe(true);
  });
});
