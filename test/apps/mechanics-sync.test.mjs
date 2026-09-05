// test/apps/mechanics-sync.test.mjs
//
// Отчёт игроков (wdbc-gak, симптом 1): Черта, добавленная из библиотеки, механику
// не применяет; работает только предмет, настроенный ВНЕ листа и брошенный на
// актора, а после броска правки в нём ничего не меняют.
//
// Причина одна на оба случая: applyItemMechanics висела на хуке createItem и
// защищалась флагом mechanicsApplied — механика отыгрывалась РАЗ, в момент
// получения предмета. Настройка же происходит позже, на листе.
//
// Долговечные записи (характеристика, вес, перемещение) — не разовое действие, а
// живая конфигурация: их эффекты пересобираются при каждой правке. Тем же
// приёмом уже жил kind:"weaponProp" (syncWeaponPropItemEffects).
//
// Разовые записи (Порча, Раны, выдача предмета, Код) повторять нельзя — бросок
// кубика и выданное снаряжение задвоились бы. Их sync не трогает.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { syncMechanicsEffects, describeMechEntry } from "../../module/apps/mechanics.mjs";

const FLAG = "warhammer-dbc";

/** Предмет с механикой и списком эффектов: столько, сколько читает sync. */
function itemDoc({ mechanics = [], fx = [], type = "trait", system = {} } = {}) {
  const flags = { mechanics };
  const item = {
    id: "item-1", type, name: "Черта", img: "icons/svg/aura.svg",
    system,
    effects: fx.map((f, i) => ({
      id: f.id ?? `fx-${i}`, name: f.name, system: f.system, disabled: f.disabled ?? false,
      getFlag: (_s, k) => f.flags?.[k]
    })),
    getFlag: (_scope, key) => flags[key],
    async createEmbeddedDocuments(_type, docs) {
      item.effects.push(...docs.map((d, i) => ({
        id: `new-${i}`, name: d.name, system: d.system, disabled: false,
        getFlag: (_s, k) => d.flags?.[FLAG]?.[k]
      })));
      return docs;
    },
    async deleteEmbeddedDocuments(_type, ids) {
      item.effects = item.effects.filter(e => !ids.includes(e.id));
      return ids;
    },
    // syncItemEffectsDisabled (wdbc-s9dj) — правит disabled у уже созданных
    // эффектов ПОСЛЕ createEmbeddedDocuments, тем же приёмом, что психосилы/
    // техночудеса переключаются тумблером «Поддерживать» на листе.
    async updateEmbeddedDocuments(_type, updates) {
      for (const u of updates) {
        const fx = item.effects.find(e => e.id === u._id);
        if (fx) fx.disabled = u.disabled;
      }
      return updates;
    }
  };
  return item;
}

/** Группа И с записями характеристик. */
const andGroup = (...entries) => ({ id: "g1", operator: "AND", entries });
const charEntry = (id, charKey, value, field = "bonus") =>
  ({ id, kind: "characteristic", charKey, field, op: "add", value });

/** Эффект, отыгрывающий запись: как его заводит Конструктор. */
const fxFor = (entryId, key, value, name = "эффект") => ({
  id: `fx-${entryId}`, name,
  system: { changes: [{ key, type: "add", value, phase: "initial", priority: 0 }] },
  flags: { mechEntry: entryId }
});

const keysOf = item => item.effects.flatMap(e => e.system.changes.map(c => c.key));
const valuesOf = item => item.effects.flatMap(e => e.system.changes.map(c => c.value));

describe("пересборка эффектов Конструктора", () => {
  it("запись без эффекта — эффект заводится", async () => {
    const item = itemDoc({ mechanics: [andGroup(charEntry("e1", "t", 2))] });

    await syncMechanicsEffects(item);

    expect(keysOf(item)).toEqual(["system.characteristics.t.bonusFx"]);
    expect(valuesOf(item)).toEqual([2]);
  });

  it("правка значения доходит до эффекта", async () => {
    const item = itemDoc({
      mechanics: [andGroup(charEntry("e1", "t", 3))],
      fx: [fxFor("e1", "system.characteristics.t.bonusFx", 2)]
    });

    await syncMechanicsEffects(item);

    expect(item.effects).toHaveLength(1);
    expect(valuesOf(item)).toEqual([3]);
  });

  it("смена цели переносит эффект на новую характеристику", async () => {
    const item = itemDoc({
      mechanics: [andGroup(charEntry("e1", "s", 2))],
      fx: [fxFor("e1", "system.characteristics.t.bonusFx", 2)]
    });

    await syncMechanicsEffects(item);

    expect(keysOf(item)).toEqual(["system.characteristics.s.bonusFx"]);
  });

  it("удалённая запись уносит свой эффект", async () => {
    const item = itemDoc({
      mechanics: [andGroup(charEntry("e1", "t", 2))],
      fx: [fxFor("e1", "system.characteristics.t.bonusFx", 2),
           fxFor("e2", "system.characteristics.s.bonusFx", 4)]
    });

    await syncMechanicsEffects(item);

    expect(keysOf(item)).toEqual(["system.characteristics.t.bonusFx"]);
  });

  it("ничего не изменилось — ничего не пишется", async () => {
    const item = itemDoc({
      mechanics: [andGroup(charEntry("e1", "t", 2))],
      fx: [fxFor("e1", "system.characteristics.t.bonusFx", 2,
                 describeMechEntry(charEntry("e1", "t", 2)))]
    });
    const before = item.effects[0];

    await syncMechanicsEffects(item);

    expect(item.effects[0]).toBe(before);   // тот же объект: не пересоздавали
  });

  // Чужой эффект — ручной у ГМа или след миграции. Метки записи на нём нет, и
  // пересборка его не трогает: иначе правка Конструктора стирала бы ручную.
  it("эффект без метки записи не трогается", async () => {
    const item = itemDoc({
      mechanics: [andGroup(charEntry("e1", "t", 2))],
      fx: [{ id: "manual", name: "Ручной", system: { changes: [
        { key: "system.fearRating", type: "upgrade", value: 2, phase: "final", priority: 0 }] } }]
    });

    await syncMechanicsEffects(item);

    expect(item.effects.find(e => e.id === "manual")).toBeDefined();
  });

  // Выбор в ИЛИ-группе делается ОДИН РАЗ диалогом при получении предмета.
  // Пересборка обязана обойти её стороной, иначе выбор переигрывался бы или,
  // хуже, отыгрывались бы сразу все альтернативы.
  it("ИЛИ-группу пересборка не трогает", async () => {
    const item = itemDoc({
      mechanics: [{ id: "g1", operator: "OR",
        entries: [charEntry("e1", "t", 2), charEntry("e2", "s", 2)] }],
      fx: [fxFor("e1", "system.characteristics.t.bonusFx", 2)]
    });

    await syncMechanicsEffects(item);

    expect(keysOf(item)).toEqual(["system.characteristics.t.bonusFx"]);
  });

  // Разовые записи — побочные действия (бросок Порчи, выдача предмета): у них
  // эффекта нет вовсе, и пересборка не должна ничего заводить.
  it("разовые записи эффектов не порождают", async () => {
    const item = itemDoc({ mechanics: [andGroup(
      { id: "e1", kind: "corruption", op: "add", corruptionValue: "2d10" },
      { id: "e2", kind: "wounds", op: "add", woundsValue: "3" }
    )] });

    await syncMechanicsEffects(item);

    expect(item.effects).toEqual([]);
  });

  it("вложенная И-подгруппа тоже пересобирается", async () => {
    const item = itemDoc({ mechanics: [andGroup(
      { id: "g2", kind: "group", group: andGroup(charEntry("e1", "t", 2)) })] });

    await syncMechanicsEffects(item);

    expect(keysOf(item)).toEqual(["system.characteristics.t.bonusFx"]);
  });
});

// wdbc-s9dj: durable-эффект (poolMax/characteristic/movement/armour) не должен
// висеть включённым, пока источник (психосила/техночудо с isSustained) не
// активирован — createEmbeddedDocuments сам по себе ставит disabled:false
// безусловно, синхронизация с isItemActive() должна произойти следом же.
describe("пересборка эффектов Конструктора: гейт по активности источника (wdbc-s9dj)", () => {
  const poolEntry = id => ({ id, kind: "poolMax", poolTarget: "ablativeWounds", op: "add", value: "7" });

  it("психосила с isSustained:false — новый durable-эффект создаётся выключенным", async () => {
    const item = itemDoc({
      type: "psychicPower", system: { isSustained: false },
      mechanics: [andGroup(poolEntry("e1"))]
    });

    await syncMechanicsEffects(item);

    expect(item.effects).toHaveLength(1);
    expect(item.effects[0].disabled).toBe(true);
  });

  it("психосила с isSustained:true — durable-эффект создаётся включённым", async () => {
    const item = itemDoc({
      type: "psychicPower", system: { isSustained: true },
      mechanics: [andGroup(poolEntry("e1"))]
    });

    await syncMechanicsEffects(item);

    expect(item.effects).toHaveLength(1);
    expect(item.effects[0].disabled).toBe(false);
  });

  it("уже существующий включённый эффект гасится, когда пересборка находит isSustained:false", async () => {
    const item = itemDoc({
      type: "psychicPower", system: { isSustained: false },
      mechanics: [andGroup(poolEntry("e1"))],
      fx: [{ ...fxFor("e1", "system.wounds.ablativeMax", 7, describeMechEntry(poolEntry("e1"))), disabled: false }]
    });

    await syncMechanicsEffects(item);

    expect(item.effects[0].disabled).toBe(true);
  });

  it("трейт (нет понятия «активен») — durable-эффект как раньше включён", async () => {
    const item = itemDoc({ mechanics: [andGroup(poolEntry("e1"))] });

    await syncMechanicsEffects(item);

    expect(item.effects[0].disabled).toBe(false);
  });
});

// ── wdbc-cx1x: смена вида записи оставляла сироту ───────────────────────────
// Найдено живой проверкой wdbc-tl0f. Новая запись в Конструкторе всегда
// начинается видом «Характеристика», и он СРАЗУ заводит ActiveEffect. Автор
// переключает вид на нужный («Состояние», «Черта», «Код»…) — а эффект от
// первого выбора оставался приклеен к предмету навсегда и молча продолжал
// давать число. Не лечилось ни правкой записи, ни перезагрузкой страницы.
describe("syncMechanicsEffects: запись сменила вид на недолговечный", () => {
  const condEntry = (id) => ({ id, kind: "condition", condKey: "stunned", condMode: "apply", condLevel: "1" });

  it("эффект от прежнего вида уносится вместе с ним", async () => {
    const item = itemDoc({
      mechanics: [andGroup(condEntry("e1"))],
      fx: [fxFor("e1", "system.characteristics.s.bonusFx", 5, "Сила: + 5")]
    });

    await syncMechanicsEffects(item);

    expect(item.effects).toHaveLength(0);
  });

  it("то же для ИЛИ-ветки: вид уже не долговечный — эффекту не за чем держаться", async () => {
    const item = itemDoc({
      mechanics: [{ id: "g1", operator: "OR", entries: [condEntry("e1")] }],
      fx: [fxFor("e1", "system.characteristics.s.bonusFx", 5, "Сила: + 5")]
    });

    await syncMechanicsEffects(item);

    expect(item.effects).toHaveLength(0);
  });

  it("регресс: эффект долговечной записи в ИЛИ-ветке НЕ трогается", async () => {
    // Выбор в ИЛИ делается один раз диалогом при выдаче, и созданный тогда
    // эффект — единственный след этого выбора; пересборка его сносить не вправе.
    const entry = charEntry("e1", "s", 5);
    const item = itemDoc({
      mechanics: [{ id: "g1", operator: "OR", entries: [entry] }],
      fx: [fxFor("e1", "system.characteristics.s.bonusFx", 5, describeMechEntry(entry))]
    });

    await syncMechanicsEffects(item);

    expect(item.effects).toHaveLength(1);
  });
});
