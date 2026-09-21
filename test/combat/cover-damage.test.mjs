// test/combat/cover-damage.test.mjs
//
// Повреждение Укрытий (стр. 33, wdbc-x1nz.2.62): «каждый раз, когда укрытие
// получает попадание, пробивающее его, оно теряет 1 AP» — Pen оружия ≥ AP
// самого укрытия (не суммарного поглощения). Только ручное system.cover.ap
// (стол сам вписал число из книжной таблицы — персистентный объект сцены);
// разовый бонус Отскока (recoilCoverBonus) не портится — он не привязан к
// конкретному числу на листе.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

function characterActor({ armorAP = 0, toughnessBonus = 0, wounds = 30, coverAp = 0, recoilCoverBonus = 0 } = {}) {
  const flags = {};
  if (recoilCoverBonus) flags["warhammer-dbc.recoilCoverBonus"] = recoilCoverBonus;
  const actor = {
    id: "char1", name: "Защитник", type: "character",
    system: {
      absorption: { body: armorAP + toughnessBonus, toughnessBonus, propFlags: {} },
      wounds: { value: wounds, critical: 0, max: wounds },
      cover: { ap: coverAp }
    },
    items: Object.assign([], { contents: [] }),
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    async unsetFlag(scope, key) { delete flags[`${scope}.${key}`]; },
    async update(data) {
      if (data["system.wounds.value"]    !== undefined) actor.system.wounds.value    = data["system.wounds.value"];
      if (data["system.wounds.critical"] !== undefined) actor.system.wounds.critical = data["system.wounds.critical"];
      if (data["system.cover.ap"]        !== undefined) actor.system.cover.ap        = data["system.cover.ap"];
    }
  };
  return actor;
}

const damage = (over = {}) => ({
  rawDamage: 10, penetration: 0, damageType: "impact", hitLocation: "Торс",
  attackerName: "Стрелок", weaponName: "Лазган", ...over
});

beforeEach(resetCaptured);

describe("Повреждение Укрытий: Pen ≥ AP укрытия снимает ему 1 AP (wdbc-x1nz.2.62)", () => {
  it("Pen равен AP укрытия — пробивает, укрытие теряет 1 AP", async () => {
    const actor = characterActor({ coverAp: 6 });
    await applyDamageToActor(actor, damage({ penetration: 6 }));
    expect(actor.system.cover.ap).toBe(5);
  });

  it("Pen больше AP укрытия — тоже пробивает, −1 AP (не больше)", async () => {
    const actor = characterActor({ coverAp: 6 });
    await applyDamageToActor(actor, damage({ penetration: 20 }));
    expect(actor.system.cover.ap).toBe(5);
  });

  it("Pen меньше AP укрытия — не пробивает, AP не трогается", async () => {
    const actor = characterActor({ coverAp: 6 });
    await applyDamageToActor(actor, damage({ penetration: 3 }));
    expect(actor.system.cover.ap).toBe(6);
  });

  it("нет ручного укрытия (ap=0) — нечего портить, не падает", async () => {
    const actor = characterActor({ coverAp: 0 });
    await applyDamageToActor(actor, damage({ penetration: 20 }));
    expect(actor.system.cover.ap).toBe(0);
  });

  it("укрытие уже на последнем AP — снижается до 0, не в минус", async () => {
    const actor = characterActor({ coverAp: 1 });
    await applyDamageToActor(actor, damage({ penetration: 5 }));
    expect(actor.system.cover.ap).toBe(0);
  });

  it("несколько пробивающих попаданий подряд — снимается каждый раз", async () => {
    const actor = characterActor({ coverAp: 4 });
    await applyDamageToActor(actor, damage({ penetration: 4 }));
    expect(actor.system.cover.ap).toBe(3);
    await applyDamageToActor(actor, damage({ penetration: 4 }));
    expect(actor.system.cover.ap).toBe(2);
  });

  it("только разовый бонус Отскока (без ручного cover.ap) — не портится, даже если Pen его перекрывает", async () => {
    const actor = characterActor({ coverAp: 0, recoilCoverBonus: 8 });
    await applyDamageToActor(actor, damage({ penetration: 20 }));
    expect(actor.system.cover.ap).toBe(0);
  });
});

// Взрывы и Окружение (стр. 36, wdbc-x1nz.2.63): укрытие ×2 против любого
// Взрывного, ×3 против X Dmg (damageType "blast"), ×4 против X(Fr) Dmg
// (damageType "blast" + damageSubtype "fragmentation"). Применяется к ЛЮБОМУ
// источнику AP (и ручному, и разовому Отскоку), но само повреждение укрытия
// (описанный выше блок) продолжает мерить Pen против НЕ умноженного числа.
describe("Множитель укрытия против Взрыва: ×2/×3/×4 (wdbc-x1nz.2.63)", () => {
  it("не Взрывное — множителя нет, обычное поглощение", async () => {
    const actor = characterActor({ armorAP: 0, coverAp: 4 });
    await applyDamageToActor(actor, damage({ rawDamage: 10, penetration: 0, blast: 0 }));
    expect(actor.system.wounds.value).toBe(24); // 10 − 4 (обычное укрытие)
  });

  it("Взрывное, но не X Dmg (напр. impact) — ×2", async () => {
    const actor = characterActor({ armorAP: 0, coverAp: 4 });
    await applyDamageToActor(actor, damage({ rawDamage: 20, penetration: 0, blast: 3, damageType: "impact" }));
    // Поглощение 4×2=8, непоглощённый 20−8=12, Раны 30−12=18.
    expect(actor.system.wounds.value).toBe(18);
    expect(captured.chat.at(-1).content).toContain("Укрытие: +8 AP");
  });

  it("Взрывное, X Dmg (damageType blast) — ×3", async () => {
    const actor = characterActor({ armorAP: 0, coverAp: 4 });
    await applyDamageToActor(actor, damage({ rawDamage: 30, penetration: 0, blast: 3, damageType: "blast" }));
    // Поглощение 4×3=12, непоглощённый 30−12=18, Раны 30−18=12.
    expect(actor.system.wounds.value).toBe(12);
  });

  it("Взрывное, X(Fr) Dmg (damageType blast + subtype fragmentation) — ×4", async () => {
    const actor = characterActor({ armorAP: 0, coverAp: 4 });
    await applyDamageToActor(actor, damage({
      rawDamage: 30, penetration: 0, blast: 3, damageType: "blast", damageSubtype: "fragmentation"
    }));
    // Поглощение 4×4=16, непоглощённый 30−16=14, Раны 30−14=16.
    expect(actor.system.wounds.value).toBe(16);
  });

  it("множитель распространяется и на разовый бонус Отскока, не только на ручное cover.ap", async () => {
    const actor = characterActor({ armorAP: 0, coverAp: 0, recoilCoverBonus: 4 });
    await applyDamageToActor(actor, damage({ rawDamage: 30, penetration: 0, blast: 3, damageType: "blast" }));
    // Тот же множитель ×3, что и у ручного укрытия: поглощение 4×3=12, Раны 30−18=12.
    expect(actor.system.wounds.value).toBe(12);
  });

  it("повреждение укрытия мерит Pen против НЕ умноженного AP (только ×3/×4 из X Dmg, порча по сырому числу)", async () => {
    const actor = characterActor({ armorAP: 0, coverAp: 4 });
    // Pen=4 равен СЫРОМУ cover.ap (4), но меньше утроенного поглощения (12) —
    // укрытие всё равно портится, потому что порог порчи не умножается.
    await applyDamageToActor(actor, damage({ rawDamage: 30, penetration: 4, blast: 3, damageType: "blast" }));
    expect(actor.system.cover.ap).toBe(3);
  });
});
