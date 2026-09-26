// module/data/item/_activation.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Цена и срок включаемой способности (Черта, Мутация с activatable:true).
//
//  Книга пишет такие способности одной формулой: «за <действие> потратить
//  Очко Бесчестия, чтобы до конца боя или сцены …» (субрасы Зверолюда,
//  корбук гл. I; Дары Богов). Тумблер activatable/active уже был — не было
//  цены включения и срока. Поля общие для обоих типов, поэтому схема — здесь,
//  один раз; читает их rules/item-activation.mjs.
//
//    costPool/costAmount — цена включения в пуле (те же ключи, что
//                          capabilityCostPool у записи Конструктора:
//                          infamy/fate/pain), пусто — без цены;
//    apOn / apOff        — ОД на включение и выключение (Полное действие — 2,
//                          Полудействие — 1, Свободное — 0), тратятся только в
//                          бою, как любая трата экономики действий;
//    until               — "combat": выключается само в конце боя. Пусто —
//                          держится, пока не выключат.
// ════════════════════════════════════════════════════════════════════════════

/** Схема поля system.activation. */
export function activationSchema() {
  const { SchemaField, StringField, NumberField } = foundry.data.fields;
  return new SchemaField({
    costPool:   new StringField({ initial: "", label: "Цена включения: пул" }),
    costAmount: new NumberField({ initial: 1, integer: true, min: 1, nullable: false, label: "Цена включения: сколько" }),
    apOn:       new NumberField({ initial: 0, integer: true, min: 0, nullable: false, label: "ОД на включение" }),
    apOff:      new NumberField({ initial: 0, integer: true, min: 0, nullable: false, label: "ОД на выключение" }),
    until:      new StringField({ initial: "", label: "Держится до" })
  }, { label: "Включение" });
}
