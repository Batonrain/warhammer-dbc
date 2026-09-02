// test/combat/warp-weapon.test.mjs
//
// Проверка автоматизации «Варп-Оружие» (module/constants/weapon-properties.mjs,
// auto: { warpSoak: true, ignoreShield: true }) в конвейере урона
// (module/combat/damage.mjs). Правило (стр. 166): варп-оружие игнорирует броню
// и обычную Стойкость цели — поглощение считается по бонусу Силы Воли (W.b),
// и щит вообще не бросается против такой атаки.
//
// Повод: игрок сообщил, что свойство «не работает». Тест проверяет реальный
// код конвейера, а не пересказывает документацию.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor, refillSarcophagusWarpWounds } from "../../module/combat/damage.mjs";

/** Подставной Персонаж: броня, Стойкость, W.b и опционально активный щит. */
function characterActor({
  armorAP = 0, toughnessBonus = 0, wpBonus = 0, wounds = 20,
  shield = null, aegisOfGnelle = false, apVsWarpFull = false,
  sarcophagusWarpWounds = null
} = {}) {
  const updates = [];
  const items = shield ? [{
    id: "shield1", type: "forcefield",
    system: {
      equipped: true, status: "active",
      currentRating: shield.currentRating ?? 99,
      overloadThreshold: shield.overloadThreshold ?? 0,
      shieldType: "dome", shieldNature: shield.shieldNature ?? "technological"
    },
    async update() {}
  }] : [];
  if (aegisOfGnelle) items.push({
    id: "rw1", name: "Эгида Г'Нелле", type: "runicWeave",
    system: { installedOnType: "vehicle" }, // кратчайший путь через isItemActive
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: "runicWeave.aegisOfGnelle", label: "" }
    ] }] } }
  });
  if (apVsWarpFull) items.push({
    id: "am1", name: "Гексаграмматические Печати", type: "armorMod",
    system: { installedOn: "armor-host", category: "armor" },
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: "armor.apVsWarpFull", label: "" }
    ] }] } }
  });
  return {
    id: "char1", name: "Псайкер", type: "character", updates,
    system: {
      absorption: { body: armorAP + toughnessBonus, toughnessBonus, propFlags: {} },
      characteristics: { wp: { bonus: wpBonus } },
      wounds: { value: wounds, critical: 0, max: wounds },
      ...(sarcophagusWarpWounds ? { sarcophagusWarpWounds } : {})
    },
    items: Object.assign([...items], { contents: items }),
    async update(data) {
      updates.push(data);
      if (data["system.wounds.value"]    !== undefined) this.system.wounds.value    = data["system.wounds.value"];
      if (data["system.wounds.critical"] !== undefined) this.system.wounds.critical = data["system.wounds.critical"];
      if (data["system.sarcophagusWarpWounds.value"] !== undefined)
        this.system.sarcophagusWarpWounds.value = data["system.sarcophagusWarpWounds.value"];
    }
  };
}

const damage = (over = {}) => ({
  rawDamage: 15, penetration: 0, damageType: "energy", hitLocation: "Торс",
  attackerName: "Псайкер-Ересиарх", weaponName: "Посох Разрушения", ...over
});

beforeEach(resetCaptured);

describe("Варп-Оружие (warpSoak): игнор брони/T.b, поглощение = W.b", () => {
  it("без warpSoak та же цель поглощает урон бронёй и T.b как обычно (контроль)", async () => {
    // AP 10 + T.b 5 = 15 поглощения, урон 15 → непоглощённого 0.
    const actor = characterActor({ armorAP: 10, toughnessBonus: 5, wpBonus: 3, wounds: 20 });
    await applyDamageToActor(actor, damage({ rawDamage: 15, warpSoak: false }));
    expect(actor.system.wounds.value).toBe(20);
    expect(actor.updates).toHaveLength(0);
  });

  it("с warpSoak та же броня/T.b НЕ спасают — поглощение считается по W.b", async () => {
    // Та же цель: AP 10 + T.b 5 обычно поглотили бы весь урон, но warpSoak их
    // игнорирует и подставляет W.b = 3 → непоглощённого 15 − 3 = 12.
    const actor = characterActor({ armorAP: 10, toughnessBonus: 5, wpBonus: 3, wounds: 20 });
    await applyDamageToActor(actor, damage({ rawDamage: 15, warpSoak: true, ignoreShield: true }));
    expect(actor.system.wounds.value).toBe(8);
  });

  it("поглощение растёт вместе с W.b цели, а не с бронёй", async () => {
    const softButWilled = characterActor({ armorAP: 0, toughnessBonus: 0, wpBonus: 6, wounds: 20 });
    await applyDamageToActor(softButWilled, damage({ rawDamage: 15, warpSoak: true, ignoreShield: true }));
    expect(softButWilled.system.wounds.value).toBe(11); // 15 − 6

    const armoredButWeakWilled = characterActor({ armorAP: 20, toughnessBonus: 10, wpBonus: 1, wounds: 20 });
    await applyDamageToActor(armoredButWeakWilled, damage({ rawDamage: 15, warpSoak: true, ignoreShield: true }));
    expect(armoredButWeakWilled.system.wounds.value).toBe(6); // 15 − 1, тяжёлая броня не помогла
  });

  it("щит вообще не бросается — ignoreShield пропускает бросок даже при мощном активном щите", async () => {
    const actor = characterActor({
      armorAP: 0, toughnessBonus: 0, wpBonus: 0, wounds: 20,
      shield: { currentRating: 99 } // при обычном броске 1d100 ≤ 99 почти гарантированно блокирует
    });
    await applyDamageToActor(actor, damage({ rawDamage: 15, warpSoak: true, ignoreShield: true }));
    expect(captured.rolls).toHaveLength(0); // бросок щита не состоялся
    expect(actor.system.wounds.value).toBe(5); // урон прошёл, 15 − 0 (W.b=0)
  });

  it("карточка урона в чате явно показывает игнор брони/T.b и поглощение по W.b", async () => {
    const actor = characterActor({ armorAP: 10, toughnessBonus: 5, wpBonus: 3, wounds: 20 });
    await applyDamageToActor(actor, damage({ rawDamage: 15, warpSoak: true, ignoreShield: true }));
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Варп-Оружие");
    expect(card).toContain("игнор брони/T.b");
    expect(card).toContain("W.b");
    expect(card).not.toContain("AP брони:");
  });
});

describe("Руническая Вязь «Эгида Г'Нелле» (wdbc-unku): ½AP брони против Варп-оружия", () => {
  it("без Вязи — AP брони не учитывается вовсе (контроль, тот же случай выше)", async () => {
    const actor = characterActor({ armorAP: 10, toughnessBonus: 5, wpBonus: 3, wounds: 20 });
    await applyDamageToActor(actor, damage({ rawDamage: 15, warpSoak: true, ignoreShield: true }));
    expect(actor.system.wounds.value).toBe(8); // 15 − 3 (W.b), AP полностью игнорируется
  });

  it("с Вязью — ½AP брони (окр.▼) добавляется к поглощению W.b", async () => {
    // absorption.body = armorAP+toughnessBonus = 15, но T.b против Варпа не
    // считается: ½AP(10) = 5; поглощение = W.b(3)+5 = 8.
    const actor = characterActor({ armorAP: 10, toughnessBonus: 5, wpBonus: 3, wounds: 20, aegisOfGnelle: true });
    await applyDamageToActor(actor, damage({ rawDamage: 15, warpSoak: true, ignoreShield: true }));
    expect(actor.system.wounds.value).toBe(13); // 20 − (15 − 8) = 13
  });

  it("округление ½AP вниз — нечётный AP не даёт лишнего очка поглощения", async () => {
    // absorption.body = armorAP(9)+toughnessBonus(0) = 9 → ½ = 4 (не 4.5/5).
    const actor = characterActor({ armorAP: 9, toughnessBonus: 0, wpBonus: 0, wounds: 20, aegisOfGnelle: true });
    await applyDamageToActor(actor, damage({ rawDamage: 15, warpSoak: true, ignoreShield: true }));
    expect(actor.system.wounds.value).toBe(20 - (15 - 4)); // W.b=0 + ½AP=4 → непогл. 11
  });
});

describe("Модификация брони «armor.apVsWarpFull» (wdbc-sg57): AP локации целиком против Варп-оружия", () => {
  it("без модификации — AP полностью игнорируется (контроль)", async () => {
    const actor = characterActor({ armorAP: 10, toughnessBonus: 5, wpBonus: 3, wounds: 20 });
    await applyDamageToActor(actor, damage({ rawDamage: 15, warpSoak: true, ignoreShield: true }));
    expect(actor.system.wounds.value).toBe(8); // 15 − 3 (W.b)
  });

  it("с модификацией — AP локации применяется целиком, не половиной", async () => {
    // AP(10) целиком (не ½=5), T.b(5) по-прежнему не считается: + W.b(3) = 13 поглощения.
    const actor = characterActor({ armorAP: 10, toughnessBonus: 5, wpBonus: 3, wounds: 20, apVsWarpFull: true });
    await applyDamageToActor(actor, damage({ rawDamage: 15, warpSoak: true, ignoreShield: true }));
    expect(actor.system.wounds.value).toBe(18); // 20 − (15 − 13) = 18
  });

  it("armor.apVsWarpFull приоритетнее runicWeave.aegisOfGnelle при наличии обоих", async () => {
    const actor = characterActor({
      armorAP: 10, toughnessBonus: 5, wpBonus: 3, wounds: 20,
      aegisOfGnelle: true, apVsWarpFull: true
    });
    await applyDamageToActor(actor, damage({ rawDamage: 15, warpSoak: true, ignoreShield: true }));
    expect(actor.system.wounds.value).toBe(18); // целиком (13), не половина (8) — та же защита, что и без Вязи
  });
});

describe("Саркофаг Дредноута: аблативные Раны ПРОТИВ ВАРП-ОРУЖИЯ (стр. 57, wdbc-drn)", () => {
  it("пул поглощает варп-урон ДО обычных Ран", async () => {
    // W.b 3 + пул 4 → поглощение по W.b (3) как обычно, ОСТАТОК (12) идёт в пул.
    const actor = characterActor({
      armorAP: 10, toughnessBonus: 5, wpBonus: 3, wounds: 20,
      sarcophagusWarpWounds: { value: 4, max: 4 }
    });
    await applyDamageToActor(actor, damage({ rawDamage: 15, warpSoak: true, ignoreShield: true }));
    // Без пула ушло бы 12 обычных Ран (20→8, см. тест выше) — с пулом пул
    // берёт на себя 4, обычным Ранам достаётся только 12 − 4 = 8.
    expect(actor.system.sarcophagusWarpWounds.value).toBe(0);
    expect(actor.system.wounds.value).toBe(20 - 8);
  });

  it("пула хватает целиком — обычные Раны не трогаются вовсе", async () => {
    const actor = characterActor({
      armorAP: 0, toughnessBonus: 0, wpBonus: 0, wounds: 20,
      sarcophagusWarpWounds: { value: 20, max: 20 }
    });
    await applyDamageToActor(actor, damage({ rawDamage: 15, warpSoak: true, ignoreShield: true }));
    expect(actor.system.sarcophagusWarpWounds.value).toBe(5); // 20 − 15
    expect(actor.system.wounds.value).toBe(20); // не тронуты
  });

  it("пустой пул (value 0) — как без Саркофага (контроль)", async () => {
    const actor = characterActor({
      armorAP: 0, toughnessBonus: 0, wpBonus: 3, wounds: 20,
      sarcophagusWarpWounds: { value: 0, max: 4 }
    });
    await applyDamageToActor(actor, damage({ rawDamage: 15, warpSoak: true, ignoreShield: true }));
    expect(actor.system.wounds.value).toBe(20 - (15 - 3)); // W.b=3, как обычно
  });

  it("без warpSoak пул не расходуется вовсе (только против варп-оружия)", async () => {
    const actor = characterActor({
      armorAP: 10, toughnessBonus: 5, wpBonus: 3, wounds: 20,
      sarcophagusWarpWounds: { value: 4, max: 4 }
    });
    await applyDamageToActor(actor, damage({ rawDamage: 15, warpSoak: false }));
    expect(actor.system.sarcophagusWarpWounds.value).toBe(4); // не тронут
    expect(actor.system.wounds.value).toBe(20); // AP+T.b поглотили всё, как в контроле выше
  });
});

describe("refillSarcophagusWarpWounds: полное восполнение к концу боя (wdbc-drn)", () => {
  it("восполняет истощённый пул до максимума", async () => {
    const actor = characterActor({ sarcophagusWarpWounds: { value: 1, max: 4 } });
    await refillSarcophagusWarpWounds({ combatants: [{ actor }] });
    expect(actor.system.sarcophagusWarpWounds.value).toBe(4);
  });

  it("уже полный пул — документ не дёргается", async () => {
    const actor = characterActor({ sarcophagusWarpWounds: { value: 4, max: 4 } });
    await refillSarcophagusWarpWounds({ combatants: [{ actor }] });
    expect(actor.updates).toHaveLength(0);
  });

  it("нет пула (не пилот) — пропускается без ошибки", async () => {
    const actor = characterActor();
    await refillSarcophagusWarpWounds({ combatants: [{ actor }] });
    expect(actor.updates).toHaveLength(0);
  });

  it("пустой/отсутствующий combat не роняет вызов", async () => {
    await expect(refillSarcophagusWarpWounds(null)).resolves.toBeUndefined();
    await expect(refillSarcophagusWarpWounds({ combatants: [] })).resolves.toBeUndefined();
  });
});
