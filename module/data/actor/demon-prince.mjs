// module/data/actor/demon-prince.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ПРИНЦ ДЕМОНОВ — тот же Демон, но вознесённый: к схеме Демона добавлен блок
//  `dp` (Благосклонность, слоги истинного имени, дары, смертное имя) и ранг
//  по умолчанию «принц».
// ════════════════════════════════════════════════════════════════════════════

import { DaemonData } from "./daemon.mjs";

export class DemonPrinceData extends DaemonData {

  /**
   * @override — свободный текстовый инпут `dp.anointed` («Помазанники»,
   * заглушка-заметка) снят со схемы: дар «Помазанник» теперь реальная
   * механика (system.dp.gifts, targetUuid — wdbc-yo6r, см. sheets/tabs/
   * patron-panel.mjs), и дублирующая заметка только путала бы со структурным
   * блоком «ПРОТЕЖЕ» на СОЦИУМ. Непустой текст переезжает в Заметки, не
   * теряется — тот же приём, что и у ship.mjs:shipClass (wdbc-zuf4).
   */
  static migrateData(source) {
    super.migrateData(source);
    const note = String(source?.dp?.anointed || "").trim();
    if (note) {
      const notes = String(source.notes || "");
      if (!notes.includes(note)) source.notes = `<p>Помазанники (заметка до переезда на дар): ${note}</p>${notes}`;
    }
    if (source?.dp) delete source.dp.anointed;
    return source;
  }

  /** @override */
  static defineSchema() {
    const { StringField, BooleanField, NumberField, ObjectField, SchemaField, ArrayField } = foundry.data.fields;
    return {
      ...super.defineSchema(),
      rank: new StringField({ initial: "prince", label: "Ранг" }),
      // Вкладка «ТЕЛО» у Принца та же, что у Персонажа (голо-скан фигуры,
      // Хирургикон, жизнеобеспечение), поэтому нужны и её хранимые поля.
      bodyType: new StringField({ initial: "male", label: "Телосложение" }),
      vitals: new SchemaField({
        hunger: new NumberField({ initial: 0, nullable: false, label: "Голод" }),
        thirst: new NumberField({ initial: 0, nullable: false, label: "Жажда" }),
        sleep:  new NumberField({ initial: 0, nullable: false, label: "Сон" })
      }, { label: "Потребности" }),
      dp: new SchemaField({
        favor:        new NumberField({ initial: 0, nullable: false, label: "Благосклонность" }),
        // Слогов истинного имени у принца пять — по одному на ступень восхождения.
        syllables:    new NumberField({ initial: 5, nullable: false, label: "Слоги истинного имени" }),
        gifts:        new ArrayField(new ObjectField(), { label: "Дары" }),
        banished:     new BooleanField({ initial: false, label: "Изгнан" }),
        trueFormDesc: new StringField({ initial: "", label: "Описание истинной формы" }),
        retinueNotes: new StringField({ initial: "", label: "Свита" }),
        mortalName:   new StringField({ initial: "", label: "Смертное имя" }),
        ascended:     new BooleanField({ initial: false, label: "Вознёсся" }),
        ip:           new NumberField({ initial: 0, nullable: false, label: "Очки Нестабильности" })
      }, { label: "Принц Демонов" })
    };
  }
}
