// test/combat/runes-of-protection.test.mjs
//
// Runes of Protection (wdbc-tejb, книга Аэльдари): на попадание извне тест
// W+0+(бPR×5) — автоматический, тем же приёмом, что Активный Щит
// (_rollActiveShield): исход всегда ≥0, спрашивать игрока незачем. Успех →
// +(бPR+Успехи+4) AP этой локации, провал → +бPR AP. Уточнение книги: фраза
// «+бPR×5 на тесты против 9 состояний» из старого desc/тикета в первоисточнике
// отсутствует — не реализована умышленно (см. правку constants/items.mjs).
// НЕ покрыто: Выжигание Души (бьёт мимо applyDamageToActor, минуя броню
// совсем) и «считается чародейским силовым щитом» для способов обхода.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

function characterActor({ armorAP = 0, toughnessBonus = 0, wounds = 20, wp = 40, bPR = 0, hasRune = true } = {}) {
  const updates = [];
  const actor = {
    id: "char1", name: "Рунный", type: "character", updates,
    system: {
      absorption: {
        body: armorAP + toughnessBonus, toughnessBonus, propFlags: {},
        ...(hasRune ? { propFlags: { body: { runesOfProtection: true } } } : {})
      },
      characteristics: { wp: { total: wp } },
      psyker: { rating: bPR },
      wounds: { value: wounds, critical: 0, max: wounds }
    },
    items: Object.assign([], { contents: [] }),
    async update(data) {
      updates.push(data);
      if (data["system.wounds.value"]    !== undefined) actor.system.wounds.value    = data["system.wounds.value"];
      if (data["system.wounds.critical"] !== undefined) actor.system.wounds.critical = data["system.wounds.critical"];
    }
  };
  return actor;
}

const damage = (over = {}) => ({
  rawDamage: 10, penetration: 0, damageType: "impact", hitLocation: "Торс",
  attackerName: "Стрелок", weaponName: "Лазган", ...over
});

beforeEach(resetCaptured);

describe("Runes of Protection: без свойства на броне — ничего не происходит", () => {
  it("нет пропуска брони с этим свойством — нет броска, нет доп. сообщения", async () => {
    const actor = characterActor({ armorAP: 0, wounds: 20, hasRune: false });
    await applyDamageToActor(actor, damage({ rawDamage: 10 }));
    expect(captured.chat).toHaveLength(1); // только основная карточка урона
    expect(actor.system.wounds.value).toBe(10);
  });
});

describe("Runes of Protection: тест W+0+(бPR×5)", () => {
  it("успех — +(бPR+Успехи+4) AP; бPR=0, WP 40, бросок 30 (2 ст. Успеха) → +6 AP", async () => {
    captured.dice = [30];
    const actor = characterActor({ armorAP: 0, wounds: 20, wp: 40, bPR: 0, hasRune: true });
    await applyDamageToActor(actor, damage({ rawDamage: 10 }));
    // Поглощение 6 (руны) + T.b 0 = 6; непоглощённый 10−6=4.
    expect(actor.system.wounds.value).toBe(16);
    const runesCard = captured.chat.find(c => c.content.includes("Защитные Руны"));
    expect(runesCard).toBeTruthy();
    expect(runesCard.content).toContain("Успех");
    expect(runesCard.content).toContain("+6 AP");
  });

  it("провал — только +бPR AP; бPR=2, WP 40 → порог 50, бросок 70 (провал) → +2 AP", async () => {
    captured.dice = [70];
    const actor = characterActor({ armorAP: 0, wounds: 20, wp: 40, bPR: 2, hasRune: true });
    await applyDamageToActor(actor, damage({ rawDamage: 10 }));
    // Поглощение 2 (бPR); непоглощённый 10−2=8.
    expect(actor.system.wounds.value).toBe(12);
    const runesCard = captured.chat.find(c => c.content.includes("Защитные Руны"));
    expect(runesCard.content).toContain("Провал");
    expect(runesCard.content).toContain("+2 AP");
  });

  it("порог теста учитывает бPR×5, не текущий/эффективный PR", async () => {
    captured.dice = [65]; // ≤ 70 (40 + 6×5) — успех
    const actor = characterActor({ armorAP: 0, wounds: 20, wp: 40, bPR: 6, hasRune: true });
    await applyDamageToActor(actor, damage({ rawDamage: 1 }));
    const runesCard = captured.chat.find(c => c.content.includes("Защитные Руны"));
    expect(runesCard.content).toContain("Порог <b>70</b>");
  });

  it("складывается с обычным AP брони этой локации", async () => {
    captured.dice = [30]; // WP 40, бPR 0 → порог 40, deg 2 → +6 AP
    const actor = characterActor({ armorAP: 5, toughnessBonus: 0, wounds: 20, wp: 40, bPR: 0, hasRune: true });
    await applyDamageToActor(actor, damage({ rawDamage: 12 }));
    // Поглощение 5 (броня) + 6 (руны) = 11; непоглощённый 12−11=1.
    expect(actor.system.wounds.value).toBe(19);
  });
});
