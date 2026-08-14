// module/data/actor/squad.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ОТРЯД — группа персонажей под общим командованием: Сплочённость вместо ран,
//  три поста (лидер, командир, координатор) и приказы — короткий (`shortCommand`)
//  и подробный (`detailCommand`), каждый со своими успехами броска.
// ════════════════════════════════════════════════════════════════════════════

export class SquadData extends foundry.abstract.TypeDataModel {

  /** @override */
  static defineSchema() {
    const { StringField, BooleanField, NumberField, ObjectField, SchemaField, ArrayField } = foundry.data.fields;
    const num = (initial, label) => new NumberField({ initial, nullable: false, label });
    const str = label => new StringField({ initial: "", label });
    /** Пост: занят персонажем по uuid, имя и портрет закэшированы для списка. */
    const post = label => new SchemaField({
      uuid: str("Персонаж"), name: str("Имя"), img: str("Портрет")
    }, { label });
    return {
      designation: str("Название"),
      faction:     str("Фракция"),
      mission:     str("Задача"),
      deployment:  str("Развёртывание"),
      delegated:   new BooleanField({ initial: false, label: "Делегировано" }),
      risk:        num(3, "Риск"),
      cohesion: new SchemaField({
        base:  num(0, "База"), start: num(0, "Начальная"), value: num(0, "Текущая")
      }, { label: "Сплочённость" }),
      posts: new SchemaField({
        leader:      post("Лидер"),
        commander:   post("Командир"),
        coordinator: post("Координатор")
      }, { label: "Посты" }),
      members: new ArrayField(new ObjectField(), { label: "Состав" }),
      presence: new SchemaField({
        active:  new BooleanField({ initial: false, label: "Присутствие" }),
        benefit: new StringField({ initial: "extreme", label: "Преимущество" })
      }, { label: "Присутствие командира" }),
      shortCommand: new SchemaField({
        active:    new BooleanField({ initial: false, label: "Отдан" }),
        key:       new StringField({ initial: "inspire", label: "Приказ" }),
        successes: num(0, "Успехи"),
        note:      str("Пометка")
      }, { label: "Короткий приказ" }),
      detailCommand: new SchemaField({
        active:    new BooleanField({ initial: false, label: "Отдан" }),
        successes: num(0, "Успехи"),
        picks:     new ArrayField(new ObjectField(), { label: "Выбранное" })
      }, { label: "Подробный приказ" }),
      briefing: new SchemaField({ successes: num(0, "Успехи") }, { label: "Инструктаж" }),
      notes:   str("Заметки"),
      gmNotes: str("Заметки ГМ")
    };
  }
}
