// test/combat/resilience-b-damage.test.mjs
//
// Таланты Стойкости (глава 3, пакет B) в конвейере урона (combat/damage.mjs):
//   Прикрытие Головы — раз в Раунд перенос попадания в голову на руку, до поглощения;
//   Адская Живучесть — Очко Бесчестия → +Cor.b поглощения, эффект «до конца следующего Хода»;
//   Взор Богов — не больше 10 потерянных Ран на корзину, значимый — отдельно, щиты обходят;
//   Залегание — AP укрытия ×2, выглядывающим частям обычное AP;
//   Аблативное Укрепление — заряд прочности гасит потерю AP (Разъедающее, Касание Энтропии, аблативный мод).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { applyDamageToActor, applyMonofilamentHit } from "../../module/combat/damage.mjs";
import { headGuardOffer } from "../../module/combat/head-guard.mjs";
import { hellishResilienceOffer, hellishResilienceTurnEnd, clearHellishResilience } from "../../module/combat/hellish-resilience.mjs";
import { applyEyeOfTheGods, resetEyeOfTheGodsWindow } from "../../module/combat/eye-of-the-gods.mjs";
import { applyHunkerDown, hunkerDownBlockReason } from "../../module/combat/hunker-down.mjs";
import { maintainArmorForHardening, offerHardeningSpend } from "../../module/combat/ablative-hardening.mjs";

const flush = () => new Promise(r => setTimeout(r, 0));
const talent = name => ({ type: "talent", name, system: {}, flags: {}, getFlag: () => undefined });

/** Предмет-броня с живым update по пути system.*. */
function armorItem(id, ap, charges = 0, equipped = true) {
  const it = {
    id, type: "armor", name: `Броня ${id}`,
    system: { equipped, hardeningCharges: charges, ...ap },
    getFlag: () => undefined,
    async update(data) {
      for (const [path, value] of Object.entries(data)) {
        const keys = path.split(".").slice(1);
        let node = it.system;
        for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
        node[keys.at(-1)] = value;
      }
    }
  };
  return it;
}

/** Персонаж с флагами по строкам "scope.key", эффектами и предметами. */
function hero({ items = [], wounds = 20, critical = 0, tb = 0, cor = 3, fate = 2, absorption = {}, cover = { ap: 0 },
  uuid = "Actor.hero", extra = {} } = {}) {
  const store = {};
  const list = [...items];
  list.contents = list;
  list.get = id => list.find(i => i.id === id) ?? null;
  const effects = [];
  effects.contents = effects;
  const a = {
    id: uuid.replace("Actor.", ""), name: "Герой", type: "character", uuid, isToken: false, updates: [], _store: store,
    system: {
      absorption: { head: 0, body: 0, rightArm: 0, leftArm: 0, leftLeg: 0, rightLeg: 0, toughnessBonus: tb, propFlags: {}, armorOnly: {}, ...absorption },
      characteristics: { t: { bonus: tb, total: tb * 10 }, wp: { bonus: 3, total: 30 }, int: { bonus: 5, total: 50 } },
      wounds: { value: wounds, critical, max: 20 },
      corruptionBonus: cor, fate: { value: fate }, cover, incomingDamageReduction: 0,
      armorCorrosion: { head: 0, body: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 },
      actionPoints: { value: 2, max: 2 }, conditions: {}
    },
    items: list, effects,
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
    async createEmbeddedDocuments(type, docs) {
      if (type !== "ActiveEffect") return [];
      return docs.map((d, i) => {
        const fx = {
          id: `fx${effects.length + i}`, ...structuredClone(d),
          getFlag: (scope, key) => fx.flags?.[scope]?.[key],
          setFlag: async (scope, key, v) => { fx.flags = { ...(fx.flags ?? {}), [scope]: { ...(fx.flags?.[scope] ?? {}), [key]: v } }; },
          delete: async () => { effects.splice(effects.indexOf(fx), 1); }
        };
        effects.push(fx);
        return fx;
      });
    },
    async updateEmbeddedDocuments(type, updates) {
      for (const u of updates) {
        const it = list.find(i => i.id === u._id);
        if (it) await it.update(Object.fromEntries(Object.entries(u).filter(([k]) => k !== "_id")));
      }
    },
    async deleteEmbeddedDocuments(type, ids) {
      if (type !== "ActiveEffect") return;
      for (const id of ids) { const i = effects.findIndex(f => f.id === id); if (i >= 0) effects.splice(i, 1); }
    },
    ...extra
  };
  return a;
}

const damage = (over = {}) => ({
  rawDamage: 10, penetration: 0, damageType: "impact", hitLocation: "Торс",
  attackerName: "Стрелок", weaponName: "Тестовое оружие", ...over
});

const inCombat = (actor, { round = 1, current = null } = {}) => {
  const combatant = { actor: current ?? actor };
  globalThis.game.combat = { id: "c1", round, started: true, combatant, combatants: [{ actor }] };
  globalThis.game.combats = [globalThis.game.combat];
};

// foundry.utils.getProperty в стенде всегда отдаёт undefined, а spendFromInfamyPool читает им пул.
const realGetProperty = globalThis.foundry.utils.getProperty;
beforeEach(() => {
  resetCaptured();
  globalThis.foundry.utils.getProperty = (o, p) => String(p).split(".").reduce((x, k) => x?.[k], o);
});
afterEach(() => {
  globalThis.foundry.utils.getProperty = realGetProperty;
  globalThis.game.combat = undefined; delete globalThis.game.combats; delete globalThis.fromUuid;
});

// ── Прикрытие Головы ────────────────────────────────────────────────────────

describe("Прикрытие Головы: перенос попадания в голову на руку", () => {
  const HG = "Head Guard / Прикрытие Головы";

  /** Запускает урон, жмёт кнопку диалога, дожидается итога. */
  async function hitHead(actor, action, over = {}) {
    const p = applyDamageToActor(actor, damage({ hitLocation: "Голова", ...over }));
    await flush();
    if (action) await captured.press(action, null);
    else captured.dismiss?.();
    await p;
  }

  it("попадание в голову с Талантом: диалог; «в правую руку» — поглощает рука, а не голова", async () => {
    const a = hero({ items: [talent(HG)], absorption: { head: 0, rightArm: 6 } });
    inCombat(a);
    await hitHead(a, "rightArm");
    expect(captured.dialog.window.title).toBe("Прикрытие Головы");
    expect(a.system.wounds.value).toBe(16);                 // 10 − AP руки 6 = 4
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Прикрытие Головы");
    expect(card).toContain("Место: <b>П. Рука</b>");
  });

  it("«в левую руку» — поглощает левая", async () => {
    const a = hero({ items: [talent(HG)], absorption: { head: 0, rightArm: 0, leftArm: 8 } });
    inCombat(a);
    await hitHead(a, "leftArm");
    expect(a.system.wounds.value).toBe(18);
    expect(captured.chat.at(-1).content).toContain("Место: <b>Л. Рука</b>");
  });

  it("«Не переносить» — попадание остаётся в голове и Раунд не тратится", async () => {
    const a = hero({ items: [talent(HG)], absorption: { head: 0, rightArm: 6 } });
    inCombat(a);
    await hitHead(a, "no");
    expect(a.system.wounds.value).toBe(10);
    expect(a._store["warhammer-dbc.usageLimits.resilience-headGuard"]).toBeUndefined();
  });

  it("закрыли диалог — попадание остаётся в голове", async () => {
    const a = hero({ items: [talent(HG)], absorption: { rightArm: 6 } });
    inCombat(a);
    await hitHead(a, null);
    expect(a.system.wounds.value).toBe(10);
  });

  it("раз в Раунд: второе попадание в голову в том же Раунде диалога не вызывает", async () => {
    const a = hero({ items: [talent(HG)], absorption: { rightArm: 6 } });
    inCombat(a, { round: 1 });
    await hitHead(a, "rightArm");
    expect(a.system.wounds.value).toBe(16);
    resetCaptured();
    await applyDamageToActor(a, damage({ hitLocation: "Голова" }));
    expect(captured.dialog).toBeNull();
    expect(a.system.wounds.value).toBe(6);                  // голова без брони: 10
  });

  it("в новом Раунде способность снова доступна", async () => {
    const a = hero({ items: [talent(HG)], absorption: { rightArm: 6 } });
    inCombat(a, { round: 1 });
    await hitHead(a, "rightArm");
    resetCaptured();
    inCombat(a, { round: 2 });
    await hitHead(a, "rightArm");
    expect(captured.dialog).not.toBeNull();
    expect(a.system.wounds.value).toBe(12);                 // 16 − 4
  });

  it("Избирательный в глаз и в сочленения шеи — диалога нет", async () => {
    for (const hitLocation of ["Глаз (Голова)", "Сочленение / Шея"]) {
      const a = hero({ items: [talent(HG)] });
      inCombat(a);
      resetCaptured();
      await applyDamageToActor(a, damage({ hitLocation }));
      expect(captured.dialog).toBeNull();
    }
  });

  it("без Таланта — диалога нет, попадание в голове", async () => {
    const a = hero({ absorption: { rightArm: 6 } });
    await applyDamageToActor(a, damage({ hitLocation: "Голова" }));
    expect(captured.dialog).toBeNull();
    expect(a.system.wounds.value).toBe(10);
  });

  it("headGuardOffer напрямую: без боя Раунда нет — предлагается каждый раз", async () => {
    const a = hero({ items: [talent(HG)] });
    for (let i = 0; i < 2; i++) {
      resetCaptured();
      const p = headGuardOffer(a, "Голова");
      await flush();
      await captured.press("leftArm", null);
      expect((await p).hitLocation).toBe("Л. Рука");
    }
  });
});

// ── Адская Живучесть ────────────────────────────────────────────────────────

describe("Адская Живучесть: Очко Бесчестия → +Cor.b поглощения", () => {
  const HR = "Hellish Resilience / Адская Живучесть";

  it("согласие: урон 10 − Cor.b 3 = 7, Очко списано, эффект на следующий Ход", async () => {
    const a = hero({ items: [talent(HR)], cor: 3, fate: 2 });
    inCombat(a, { current: { uuid: "Actor.enemy" } });
    await applyDamageToActor(a, damage());
    expect(a.system.wounds.value).toBe(13);
    expect(a.system.fate.value).toBe(1);
    expect(a.effects).toHaveLength(1);
    const fx = a.effects[0];
    expect(fx.system.changes).toEqual([{ key: "system.incomingDamageReduction", type: "add", value: 3, phase: "initial", priority: 0 }]);
    expect(fx.flags["warhammer-dbc"].hellishResilience).toEqual({ combatId: "c1", ends: 1 });
    expect(captured.chat.at(-1).content).toContain("Адская Живучесть");
  });

  it("бонус не удваивается в этом же попадании: эффект создан, но урон считан один раз", async () => {
    const a = hero({ items: [talent(HR)], cor: 3 });
    inCombat(a);
    await applyDamageToActor(a, damage({ rawDamage: 10 }));
    expect(a.system.wounds.value).toBe(13);                 // 10 − 3, а не 10 − 6
  });

  it("отказ: урон полный, Очко цело, эффекта нет", async () => {
    const a = hero({ items: [talent(HR)], cor: 3, fate: 2 });
    inCombat(a);
    captured.confirmAnswer = false;
    await applyDamageToActor(a, damage());
    expect(a.system.wounds.value).toBe(10);
    expect(a.system.fate.value).toBe(2);
    expect(a.effects).toHaveLength(0);
  });

  it("нет Очков Бесчестия — вопроса нет", async () => {
    const a = hero({ items: [talent(HR)], cor: 3, fate: 0 });
    inCombat(a);
    await applyDamageToActor(a, damage());
    expect(captured.dialog).toBeNull();
    expect(a.system.wounds.value).toBe(10);
  });

  it("урон поглощён полностью — вопроса нет", async () => {
    const a = hero({ items: [talent(HR)], cor: 3, absorption: { body: 20 } });
    await applyDamageToActor(a, damage());
    expect(captured.dialog).toBeNull();
    expect(a.system.fate.value).toBe(2);
  });

  it("вне боя: бонус действует на это попадание, эффект не создаётся", async () => {
    const a = hero({ items: [talent(HR)], cor: 3 });
    await applyDamageToActor(a, damage());
    expect(a.system.wounds.value).toBe(13);
    expect(a.effects).toHaveLength(0);
    expect(captured.chat.at(-1).content).toContain("вне боя");
  });

  it("не носитель — вопроса нет", async () => {
    const a = hero({ cor: 3 });
    await applyDamageToActor(a, damage());
    expect(captured.dialog).toBeNull();
  });

  it("урон меньше Cor.b — до нуля, не в минус", async () => {
    const a = hero({ items: [talent(HR)], cor: 6, absorption: { body: 7 } });
    await applyDamageToActor(a, damage({ rawDamage: 10 }));     // net 3 → 0
    expect(a.system.wounds.value).toBe(20);
  });

  it("получил урон в СВОЙ Ход — снимается только после второго конца Хода; в чужой — после первого", async () => {
    const own = hero({ items: [talent(HR)], cor: 3 });
    inCombat(own);                                    // в трекере ходит сам носитель
    await applyDamageToActor(own, damage());
    expect(own.effects[0].flags["warhammer-dbc"].hellishResilience.ends).toBe(2);
    await hellishResilienceTurnEnd(own);
    expect(own.effects).toHaveLength(1);
    await hellishResilienceTurnEnd(own);
    expect(own.effects).toHaveLength(0);

    const other = hero({ items: [talent(HR)], cor: 3, uuid: "Actor.other" });
    inCombat(other, { current: { uuid: "Actor.enemy" } });
    await applyDamageToActor(other, damage());
    await hellishResilienceTurnEnd(other);
    expect(other.effects).toHaveLength(0);
  });

  it("конец боя снимает эффект", async () => {
    const a = hero({ items: [talent(HR)], cor: 3 });
    inCombat(a, { current: { uuid: "Actor.enemy" } });
    await applyDamageToActor(a, damage());
    await clearHellishResilience(globalThis.game.combat);
    expect(a.effects).toHaveLength(0);
  });

  it("hellishResilienceOffer: Пустота Парии (трата не состоялась) — урон не меняется", async () => {
    const a = hero({ items: [talent(HR)], cor: 3 });
    a.getActiveTokens = () => [];
    // Очков нет вовсе при fate 0 — отдельная ветка выше; здесь только контракт возврата
    const r = await hellishResilienceOffer(hero({ cor: 3 }), 5);
    expect(r).toEqual({ net: 5, note: "" });
  });
});

// ── Взор Богов ──────────────────────────────────────────────────────────────

describe("Взор Богов: лимит 10 Ран в промежутке между Ходами носителя", () => {
  const EYE = "Eye of the Gods / Взор Богов";
  const rank = (uuid = "Actor.grunt") => ({ uuid, name: "Рядовой", flags: {}, getFlag: () => undefined });
  const boss = (uuid = "Actor.boss") => ({ uuid, name: "Босс", flags: { "warhammer-dbc": { notableCharacter: true } }, getFlag: () => undefined });
  const withAttackers = (...list) => { globalThis.fromUuid = async u => list.find(x => x.uuid === u) ?? null; };

  it("рядовые суммарно: 7 + 7 → 7 и 3, лишнее отражено", async () => {
    withAttackers(rank("Actor.g1"), rank("Actor.g2"));
    const a = hero({ items: [talent(EYE)], wounds: 40 });
    a.system.wounds.max = 40;
    inCombat(a);
    await applyDamageToActor(a, damage({ rawDamage: 7, attackerUuid: "Actor.g1" }));
    await applyDamageToActor(a, damage({ rawDamage: 7, attackerUuid: "Actor.g2" }));
    expect(a.system.wounds.value).toBe(30);                 // потеряно 7 + 3 = 10
    expect(captured.chat.at(-1).content).toContain("Взор Богов");
    await applyDamageToActor(a, damage({ rawDamage: 5, attackerUuid: "Actor.g1" }));
    expect(a.system.wounds.value).toBe(30);                 // корзина рядовых исчерпана
  });

  it("значимый — своя корзина: 10 от рядовых и ещё 10 от босса", async () => {
    withAttackers(rank(), boss());
    const a = hero({ items: [talent(EYE)], wounds: 60 });
    a.system.wounds.max = 60;
    inCombat(a);
    await applyDamageToActor(a, damage({ rawDamage: 15, attackerUuid: "Actor.grunt" }));
    expect(a.system.wounds.value).toBe(50);
    await applyDamageToActor(a, damage({ rawDamage: 15, attackerUuid: "Actor.boss" }));
    expect(a.system.wounds.value).toBe(40);
    await applyDamageToActor(a, damage({ rawDamage: 15, attackerUuid: "Actor.boss" }));
    expect(a.system.wounds.value).toBe(40);                 // босс уже выбрал свои 10
    expect(captured.chat.at(-1).content).toContain("значимого персонажа");
  });

  it("два разных значимых — у каждого свои 10", async () => {
    withAttackers(boss("Actor.b1"), boss("Actor.b2"));
    const a = hero({ items: [talent(EYE)], wounds: 60 });
    a.system.wounds.max = 60;
    inCombat(a);
    await applyDamageToActor(a, damage({ rawDamage: 12, attackerUuid: "Actor.b1" }));
    await applyDamageToActor(a, damage({ rawDamage: 12, attackerUuid: "Actor.b2" }));
    expect(a.system.wounds.value).toBe(40);
  });

  it("начало Хода носителя сбрасывает окно", async () => {
    withAttackers(rank());
    const a = hero({ items: [talent(EYE)], wounds: 40 });
    a.system.wounds.max = 40;
    inCombat(a);
    await applyDamageToActor(a, damage({ rawDamage: 12, attackerUuid: "Actor.grunt" }));
    expect(a.system.wounds.value).toBe(30);
    await resetEyeOfTheGodsWindow(a);
    await applyDamageToActor(a, damage({ rawDamage: 12, attackerUuid: "Actor.grunt" }));
    expect(a.system.wounds.value).toBe(20);
  });

  it("игнор щитов и Освящённое обходят Талант", async () => {
    withAttackers(rank());
    for (const bypass of [{ ignoreShield: true }, { sanctified: true }]) {
      const a = hero({ items: [talent(EYE)], wounds: 40 });
      a.system.wounds.max = 40;
      inCombat(a);
      await applyDamageToActor(a, damage({ rawDamage: 15, attackerUuid: "Actor.grunt", ...bypass }));
      expect(a.system.wounds.value).toBe(25);               // все 15 прошли
      expect(captured.chat.at(-1).content).toContain("Талант игнорируется");
    }
  });

  it("вне боя окна нет — Талант не действует", async () => {
    const a = hero({ items: [talent(EYE)], wounds: 40 });
    a.system.wounds.max = 40;
    await applyDamageToActor(a, damage({ rawDamage: 15 }));
    expect(a.system.wounds.value).toBe(25);
  });

  it("без Таланта — лимита нет", async () => {
    const a = hero({ wounds: 40 });
    a.system.wounds.max = 40;
    inCombat(a);
    await applyDamageToActor(a, damage({ rawDamage: 15 }));
    expect(a.system.wounds.value).toBe(25);
  });

  it("урон без источника (attackerUuid пуст) считается рядовым", async () => {
    const a = hero({ items: [talent(EYE)], wounds: 40 });
    a.system.wounds.max = 40;
    inCombat(a);
    await applyDamageToActor(a, damage({ rawDamage: 15 }));
    expect(a.system.wounds.value).toBe(30);
  });

  it("Настоящая Выдержка режет первой, Взор Богов считает то, что дошло до Ран", async () => {
    withAttackers(rank());
    const a = hero({ items: [talent(EYE), talent("True Grit / Настоящая Выдержка")], wounds: 0, critical: 2, tb: 4 });
    inCombat(a);
    await applyDamageToActor(a, damage({ rawDamage: 20, attackerUuid: "Actor.grunt" }));   // 20 − T.b 4 = 16 → лимит 10
    expect(a.system.wounds.critical).toBe(12);
  });

  it("applyEyeOfTheGods: потерянное записывается в метку носителя", async () => {
    withAttackers(rank());
    const a = hero({ items: [talent(EYE)] });
    inCombat(a);
    const r = await applyEyeOfTheGods(a, "Actor.grunt", 6);
    expect(r.net).toBe(6);
    expect(a._store["warhammer-dbc.eyeOfTheGods"]).toEqual({ combatId: "c1", buckets: { general: 6 } });
  });
});

// ── Залегание ───────────────────────────────────────────────────────────────

describe("Залегание: кнопка и AP укрытия в конвейере урона", () => {
  const HD = "Hunker Down / Залегание";

  it("кнопка: в укрытии (cover.ap > 0) тратит 1 ОД и ставит метку", async () => {
    const a = hero({ items: [talent(HD)], cover: { ap: 3 } });
    inCombat(a);
    expect(hunkerDownBlockReason(a)).toBe("");
    await applyHunkerDown(a);
    expect(a.system.actionPoints.value).toBe(1);
    expect(a._store["warhammer-dbc.hunkerDown"]).toBe(true);
    expect(captured.chat.at(-1).content).toContain("Залегание");
  });

  it("вне укрытия — отказ, ОД целы", async () => {
    const a = hero({ items: [talent(HD)], cover: { ap: 0 } });
    inCombat(a);
    expect(hunkerDownBlockReason(a)).toContain("только в укрытии");
    await applyHunkerDown(a);
    expect(a.system.actionPoints.value).toBe(2);
    expect(a._store["warhammer-dbc.hunkerDown"]).toBeUndefined();
  });

  it("нет Таланта и уже залёг — отказ", async () => {
    expect(hunkerDownBlockReason(hero({ cover: { ap: 3 } }))).toContain("Нужен Талант");
    const a = hero({ items: [talent(HD)], cover: { ap: 3 } });
    inCombat(a);
    await applyHunkerDown(a);
    expect(hunkerDownBlockReason(a)).toContain("Уже залёг");
  });

  it("токен в зоне Укрытия тоже считается укрытием", () => {
    const a = hero({ items: [talent(HD)], cover: { ap: 0 } });
    a.getActiveTokens = () => [{ document: { regions: new Set([{ behaviors: [{ type: "warhammer-dbc.cover", system: { coverAp: 4 } }] }]) } }];
    // тип поведения зоны сверяется с COVER_TYPE — подставляем его
    return import("../../module/regions/cover.mjs").then(({ COVER_TYPE }) => {
      a.getActiveTokens = () => [{ document: { regions: new Set([{ behaviors: [{ type: COVER_TYPE, system: { coverAp: 4 } }] }]) } }];
      expect(hunkerDownBlockReason(a)).toBe("");
    });
  });

  it("урон: общее укрытие (отметок нет) — AP ×2 везде", async () => {
    const a = hero({ cover: { ap: 3 } });
    a._store["warhammer-dbc.hunkerDown"] = true;
    await applyDamageToActor(a, damage({ rawDamage: 10 }));
    expect(a.system.wounds.value).toBe(16);                 // 10 − 6
    expect(captured.chat.at(-1).content).toContain("Укрытие: +6 AP (Залегание)");
  });

  it("урон: без Залегания — обычное укрытие", async () => {
    const a = hero({ cover: { ap: 3 } });
    await applyDamageToActor(a, damage({ rawDamage: 10 }));
    expect(a.system.wounds.value).toBe(13);                 // 10 − 3
  });

  it("урон: отмечена прикрытая часть (корпус) — корпус ×2, голова (выглядывает) — обычное AP", async () => {
    const mk = () => { const a = hero({ cover: { ap: 3, body: true } }); a._store["warhammer-dbc.hunkerDown"] = true; return a; };
    const torso = mk();
    await applyDamageToActor(torso, damage({ rawDamage: 10, hitLocation: "Торс" }));
    expect(torso.system.wounds.value).toBe(16);             // ×2 = 6
    const head = mk();
    await applyDamageToActor(head, damage({ rawDamage: 10, hitLocation: "Голова" }));
    expect(head.system.wounds.value).toBe(13);              // обычное 3 вместо 0
  });

  it("урон: без Залегания выглядывающая часть не защищена (как раньше)", async () => {
    const a = hero({ cover: { ap: 3, body: true } });
    await applyDamageToActor(a, damage({ rawDamage: 10, hitLocation: "Голова" }));
    expect(a.system.wounds.value).toBe(10);
  });

  it("Взрывное: множитель взрыва поверх Залегания (×2 · ×2)", async () => {
    const a = hero({ cover: { ap: 3 } });
    a._store["warhammer-dbc.hunkerDown"] = true;
    await applyDamageToActor(a, damage({ rawDamage: 30, blast: 3, damageType: "impact" }));
    expect(a.system.wounds.value).toBe(2);                  // укрытие 3·2(Залегание)·2(Взрывное) = 12, 30 − 12 = 18 урона, 20 − 18
  });

  it("износ укрытия: пробивающее попадание снимает 1 AP с исходного числа, не с удвоенного", async () => {
    const a = hero({ cover: { ap: 3 } });
    a._store["warhammer-dbc.hunkerDown"] = true;
    await applyDamageToActor(a, damage({ rawDamage: 20 }));   // 20 > 6 — пробивает
    expect(a.system.cover.ap).toBe(2);
  });
});

// ── Аблативное Укрепление ───────────────────────────────────────────────────

describe("Аблативное Укрепление: заряды прочности", () => {
  const AH = "Ablative Hardening / Аблативное Укрепление";

  it("«Обслужить (1 ч)»: заряды = I.b; повторно не копится сверх", async () => {
    const armor = armorItem("a1", { body: 4 }, 2);
    const a = hero({ items: [talent(AH), armor] });
    expect(await maintainArmorForHardening(a, armor)).toBe(5);
    expect(armor.system.hardeningCharges).toBe(5);
    await maintainArmorForHardening(a, armor);
    expect(armor.system.hardeningCharges).toBe(5);
    expect(captured.chat.at(-1).content).toContain("заряды прочности");
  });

  it("не носитель — обслуживание ничего не даёт", async () => {
    const armor = armorItem("a1", { body: 4 }, 0);
    const a = hero({ items: [armor] });
    await maintainArmorForHardening(a, armor);
    expect(armor.system.hardeningCharges).toBe(0);
  });

  it("Разъедающее: согласие — AP не теряется, заряд потрачен, остаток сверх AP всё равно уходит в Раны", async () => {
    const armor = armorItem("a1", { body: 2 }, 3);
    const a = hero({ items: [talent(AH), armor], absorption: { body: 2, armorOnly: { body: 2 } } });
    await applyDamageToActor(a, damage({ rawDamage: 1, corrosiveRating: 5 }));
    expect(a.system.armorCorrosion.body).toBe(0);
    expect(armor.system.hardeningCharges).toBe(2);
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Аблативное Укрепление");
    expect(a.system.wounds.value).toBe(17);                 // остаток 5 − 2 = 3 в Раны
  });

  it("Разъедающее: отказ — AP теряется как обычно, заряд цел", async () => {
    const armor = armorItem("a1", { body: 2 }, 3);
    const a = hero({ items: [talent(AH), armor], absorption: { body: 2, armorOnly: { body: 2 } } });
    captured.confirmAnswer = false;
    await applyDamageToActor(a, damage({ rawDamage: 1, corrosiveRating: 1 }));
    expect(a.system.armorCorrosion.body).toBe(1);
    expect(armor.system.hardeningCharges).toBe(3);
  });

  it("Разъедающее: зарядов нет — вопроса нет", async () => {
    const armor = armorItem("a1", { body: 2 }, 0);
    const a = hero({ items: [talent(AH), armor], absorption: { body: 2, armorOnly: { body: 2 } } });
    await applyDamageToActor(a, damage({ rawDamage: 1, corrosiveRating: 1 }));
    expect(captured.dialog).toBeNull();
    expect(a.system.armorCorrosion.body).toBe(1);
  });

  it("Касание Энтропии: согласие — AP на это попадание не снят", async () => {
    const armor = armorItem("a1", { body: 6 }, 1);
    const a = hero({ items: [talent(AH), armor], absorption: { body: 6, armorOnly: { body: 6 } } });
    await applyDamageToActor(a, damage({ rawDamage: 10, entropyRating: 3 }));
    expect(a.system.armorCorrosion.body).toBe(0);
    expect(armor.system.hardeningCharges).toBe(0);
    expect(a.system.wounds.value).toBe(16);                 // броня 6 цела: 10 − 6
  });

  it("Касание Энтропии: отказ — AP снят до поглощения", async () => {
    const armor = armorItem("a1", { body: 6 }, 1);
    const a = hero({ items: [talent(AH), armor], absorption: { body: 6, armorOnly: { body: 6 } } });
    captured.confirmAnswer = false;
    await applyDamageToActor(a, damage({ rawDamage: 10, entropyRating: 3 }));
    expect(a.system.armorCorrosion.body).toBe(3);
    expect(a.system.wounds.value).toBe(13);                 // броня 3: 10 − 3 = 7
  });

  it("платит броня, закрывающая участок: заряды на шлеме удар в торс не гасят", async () => {
    const helm = armorItem("h", { head: 3 }, 4);
    const a = hero({ items: [talent(AH), helm], absorption: { body: 2, armorOnly: { body: 2 } } });
    await applyDamageToActor(a, damage({ rawDamage: 1, corrosiveRating: 1 }));
    expect(captured.dialog).toBeNull();
    expect(helm.system.hardeningCharges).toBe(4);
  });

  it("offerHardeningSpend: конкретная броня без зарядов — false без вопроса", async () => {
    const armor = armorItem("a1", { body: 4 }, 0);
    const a = hero({ items: [talent(AH), armor] });
    expect(await offerHardeningSpend(a, { armor, reason: "тест" })).toBe(false);
    expect(captured.dialog).toBeNull();
  });
});

describe("Аблативное Укрепление: Моносеть и аблативный мод брони", () => {
  const AH = "Ablative Hardening / Аблативное Укрепление";

  it("Моносеть: заряд любой надетой брони гасит −1 AP на всех участках", async () => {
    const armor = armorItem("a1", { body: 4 }, 2);
    const a = hero({ items: [talent(AH), armor] });
    await applyMonofilamentHit(a, { rating: 0, damage: 1, weaponName: "Моносеть" });
    expect(Object.values(a.system.armorCorrosion).every(v => v === 0)).toBe(true);
    expect(armor.system.hardeningCharges).toBe(1);
  });

  it("Моносеть: отказ — по 1 AP снято на всех участках, заряд цел", async () => {
    const armor = armorItem("a1", { body: 4 }, 2);
    const a = hero({ items: [talent(AH), armor] });
    captured.confirmAnswer = false;
    await applyMonofilamentHit(a, { rating: 0, damage: 1, weaponName: "Моносеть" });
    expect(Object.values(a.system.armorCorrosion).every(v => v === 1)).toBe(true);
    expect(armor.system.hardeningCharges).toBe(2);
  });

  const withAblativeMod = (charges, { confirm = true } = {}) => {
    const armor = armorItem("a1", { body: 4 }, charges);
    const mod = {
      id: "m1", type: "armorMod", name: "Аблативная накладка", getFlag: () => undefined,
      system: { installedOn: "a1", ablative: true, ablativeCharge: 5, category: "armor", activatable: false, active: true },
      async update(d) { for (const [k, v] of Object.entries(d)) this.system[k.replace("system.", "")] = v; }
    };
    const a = hero({ items: [talent(AH), armor, mod] });
    captured.confirmAnswer = confirm;
    return { a, armor, mod };
  };

  it("аблативный мод: без Таланта-заряда мод теряет заряд с попадания", async () => {
    const { a, mod } = withAblativeMod(0);
    await applyDamageToActor(a, damage({ rawDamage: 1 }));
    expect(mod.system.ablativeCharge).toBe(4);
  });

  it("аблативный мод: согласие — мод не теряет заряд, заряд прочности потрачен", async () => {
    const { a, armor, mod } = withAblativeMod(2);
    await applyDamageToActor(a, damage({ rawDamage: 1 }));
    expect(mod.system.ablativeCharge).toBe(5);
    expect(armor.system.hardeningCharges).toBe(1);
    expect(captured.chat.at(-1).content).toContain("не теряет заряд");
  });

  it("аблативный мод: отказ — мод теряет заряд, заряд прочности цел", async () => {
    const { a, armor, mod } = withAblativeMod(2, { confirm: false });
    await applyDamageToActor(a, damage({ rawDamage: 1 }));
    expect(mod.system.ablativeCharge).toBe(4);
    expect(armor.system.hardeningCharges).toBe(2);
  });
});
