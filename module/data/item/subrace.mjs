// module/data/item/subrace.mjs
// ════════════════════════════════════════════════════════════════════════════
//  СУБРАСА — ветвь расы: стоит опыта, меняет характеристики, добавляет свои
//  Черты и иногда ОТМЕНЯЕТ расовые (субрасы друкхари). Привязка к родителю —
//  поле `parentKey` с ключом расы: субрасу нельзя выдать чужой расе. Имя НЕ
//  `parent` — так называется собственное свойство DataModel (документ-
//  владелец), и поле схемы с таким именем до кода не доходит вовсе.
//
//  Черты, как и у расы, живут в Конструкторе Механики, а не в схеме.
// ════════════════════════════════════════════════════════════════════════════

export class SubraceData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { HTMLField, StringField, NumberField, ObjectField, ArrayField, BooleanField } = foundry.data.fields;
    return {
      key:           new StringField({ initial: "", label: "Ключ" }),
      parentKey:     new StringField({ initial: "", label: "Раса-родитель" }),
      cost:          new NumberField({ initial: 0, integer: true, label: "Стоимость в опыте" }),
      // Покупка уровнями (Затупленный: 500/750/1000/1250 → Blunted 1–4):
      // цена уровня N — tierCosts[N-1]; пусто — один уровень по `cost`.
      // Выбранный уровень живёт на акторе (system.subraceTier), формулы
      // Механики читают его как «subtier».
      tierCosts:     new ArrayField(new NumberField({ integer: true }), { label: "Цены уровней" }),
      // Ключи Архетипов, закрытых субрасе (Пария: witch, renegadePsyker) —
      // Мастер их не показывает (apps/archetypes.mjs::archetypesForRace).
      bannedArchetypes: new ArrayField(new StringField(), { label: "Запрещённые Архетипы" }),
      // «Получает мутации как Космодесантник» (Затупленный): пороги мутаций
      // по таблице Астартес (rules/character.mjs).
      mutationsAsAstartes: new BooleanField({ initial: false, label: "Мутации как у Астартес" }),
      effect:        new StringField({ initial: "", label: "Действие" }),
      god:           new StringField({ initial: "", label: "Бог" }),
      charMods:      new ObjectField({ label: "Изменения характеристик" }),
      // Бросок «с Преимуществом» на одну характеристику Мастера создания —
      // {char:"inf", rolls:3}: кидается N раз, берётся лучший итог
      // (module/rules/roll-advantage.mjs). Пусто — обычный одиночный бросок.
      charRollAdvantage: new ObjectField({ label: "Бросок х-ки с Преимуществом" }),
      talents:       new StringField({ initial: "", label: "Стартовые таланты" }),
      // Имена расовых Черт, которые субраса снимает.
      removesTraits: new ArrayField(new StringField(), { label: "Снимает Черты" }),
      description:   new HTMLField({ initial: "", label: "Описание" }),
      notes:         new HTMLField({ initial: "", label: "Заметки" }),
      bookSource:    new StringField({ initial: "", label: "Книга-источник" })
    };
  }
}
