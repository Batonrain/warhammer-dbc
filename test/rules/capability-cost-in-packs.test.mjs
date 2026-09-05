// test/rules/capability-cost-in-packs.test.mjs
//
// Возможности, которые ПОКУПАЮТСЯ Очком Бесчестия, несут цену данными
// (wdbc-m7we).
//
// У записи Конструктора «Возможность» давно есть поля цены
// (capabilityCostPool/capabilityCostAmount, wdbc-1dc8): панель «ВОЗМОЖНОСТИ
// СЕЙЧАС» рисует у такой строки кнопку «− 1 Очко Бесчестия», гейтит её по
// остатку пула и списывает при нажатии. Механизм был, а восемь Даров, которые
// по книге целиком сводятся к «потратить Очко и сделать X», цены не несли —
// игрок тратил очко по памяти и забывал.
//
// Отдельно оговорено, чего кнопка НЕ делает: она списывает ресурс, а сам
// эффект по-прежнему отыгрывается за столом. Это честно и полезно — забытое
// списание и есть самая частая ошибка; но обещать больше нельзя, поэтому
// колонка «Считает» у них остаётся «вручную».
//
// Сюда НЕ входят Дары со СМЕШАННОЙ подписью — где кроме платного действия есть
// ещё и пассивная часть (Лики богов, «Лжесвидетель», «Танец Обмана»). Кнопка
// на такой строке списывала бы очко и за пассивку тоже.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";
import { ruleFlagCost } from "../../module/rules/flags.mjs";
import { capabilityCostLabel } from "../../module/combat/capability-cost.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

/**
 * Возможности, которым цена положена по книге. Список закрытый.
 *
 * `system` — то, что нужно актору, чтобы запись вообще сработала. Вариант руны
 * Шамана гейтится Покровителем (entry.when.patronGod), и без него запись не
 * даёт ни возможности, ни цены — это правильно, а не поломка.
 */
const PAID = [
  { key: "gift.khorne.eyeOfChallenge" },
  { key: "gift.khorne.redSun" },
  { key: "gift.khorne.theHunter" },
  { key: "gift.tzeentch.akashicLibrary" },
  { key: "gift.tzeentch.hiddenThreat" },
  { key: "gift.tzeentch.wishGranter" },
  { key: "gift.tzeentch.sundering" },
  { key: "rune.beastmanShaman.boneRuneEtching.slaaneshVariant",
    system: { patronGod: "slaanesh" } }
];

/** Документы packs-src, несущие записи «Возможность». */
function docsWithCapabilities() {
  const root = path.join(ROOT, "packs-src");
  return fs.readdirSync(root, { withFileTypes: true, recursive: true })
    .filter(e => !e.isDirectory() && e.name.endsWith(".json"))
    .map(e => path.join(e.parentPath ?? e.path, e.name))
    .map(f => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } })
    .filter(d => d && JSON.stringify(d.flags ?? {}).includes("capabilityKey"));
}

const docs = docsWithCapabilities();

/** Документ, выдающий этот ключ. */
const carrierOf = key => docs.find(d => JSON.stringify(d.flags).includes(`"${key}"`));

describe("цена Очком Бесчестия лежит в данных, а не в памяти игрока", () => {
  it("все восемь имён вообще существуют в реестре", () => {
    const unknown = PAID.filter(p => !CAPABILITIES[p.key]).map(p => p.key);
    expect(unknown, "этих ключей нет в реестре — опечатка в списке").toEqual([]);
  });

  /** Актор из НАСТОЯЩИХ данных пака — проверяется заполнение записи. */
  const actorWith = (doc, extra = {}) => ({
    type: "character",
    system: { characteristics: {}, ...extra },
    items: [{ id: "it1", type: doc.type, name: doc.name, system: doc.system ?? {}, flags: doc.flags }]
  });

  for (const { key, system } of PAID) {
    it(`${key} — предмет несёт цену, и она доезжает до листа`, () => {
      const doc = carrierOf(key);
      expect(doc, `ни один документ packs-src не выдаёт ${key}`).toBeTruthy();

      const cost = ruleFlagCost(actorWith(doc, system), key);
      expect(cost, "цена не доехала до сборки правил — панель кнопки не покажет").toBeTruthy();
      expect(cost.pool).toBe("infamy");
      expect(cost.amount).toBe(1);
      expect(capabilityCostLabel(cost)).toBe("1 Очко Бесчестия");
    });
  }

  it("гейт Покровителя работает: без Слаанеш вариант руны не даёт ни возможности, ни цены", () => {
    // Не декоративная проверка. Если гейт перестанет срабатывать, Шаман
    // любого Покровителя получит чужой вариант руны и кнопку списания к нему.
    const key = "rune.beastmanShaman.boneRuneEtching.slaaneshVariant";
    const doc = carrierOf(key);
    expect(ruleFlagCost(actorWith(doc, { patronGod: "khorne" }), key)).toBeNull();
  });

  it("смешанные подписи цену НЕ получили — кнопка списывала бы и за пассивку", () => {
    // Лики богов и «Лжесвидетель» несут и платное действие, и постоянный
    // эффект в одной записи. Такую строку нельзя делать платной целиком.
    const mixed = ["gift.khorne.countenanceOfKhorne", "gift.nurgle.countenanceOfNurgle",
                   "gift.tzeentch.falseWitness", "gift.slaanesh.danceOfDeception"];
    for (const key of mixed) {
      const doc = carrierOf(key);
      if (!doc) continue;
      const item = { id: "it1", type: doc.type, name: doc.name, system: doc.system ?? {}, flags: doc.flags };
      const actor = { type: "character", system: { characteristics: {} }, items: [item] };
      expect(ruleFlagCost(actor, key), `${key} не должна быть платной целиком`).toBeNull();
    }
  });

  it("цена в Очках Действия доезжает до листа у тех, где действие — единственная цена", () => {
    // Четыре способности, у которых по книге платится ровно полудействие или
    // полное действие и больше ничего. Смешанные («Полудействие+1 Бесчестия»)
    // сюда не входят: поле цены одно, вторая половина потерялась бы молча.
    const AP = { "gift.khorne.fatherOfBattle": 1, "gift.nurgle.unseenBeggar": 1,
                 "gift.tzeentch.etherealSwarm": 2, "mutation.janus": 1 };
    for (const [key, amount] of Object.entries(AP)) {
      const doc = carrierOf(key);
      expect(doc, `ни один документ packs-src не выдаёт ${key}`).toBeTruthy();
      const cost = ruleFlagCost(actorWith(doc), key);
      expect(cost, `${key}: цена не доехала`).toBeTruthy();
      expect(cost.pool).toBe("action");
      expect(cost.amount).toBe(amount);
      expect(capabilityCostLabel(cost)).toBe(`${amount} ОД`);
    }
  });

  it("у одной записи не может быть двух цен сразу", () => {
    // Поле цены одно. Если кто-то попробует дать записи и Бесчестие, и ОД,
    // вторая молча затрёт первую — а за столом заплатят один раз не тем.
    const paidKeys = new Set(PAID.map(p => p.key));
    for (const key of ["gift.khorne.fatherOfBattle", "gift.nurgle.unseenBeggar",
                       "gift.tzeentch.etherealSwarm", "mutation.janus"])
      expect(paidKeys.has(key), `${key} назначена и в Бесчестии, и в ОД`).toBe(false);
  });

  it("цена не сделала возможность «авто» — эффект по-прежнему за столом", () => {
    // Кнопка списывает ресурс, а не применяет способность. Обещать обратное
    // хуже, чем не обещать ничего.
    for (const { key } of PAID) expect(String(CAPABILITIES[key].reader ?? "").trim()).toBe("");
  });
});
