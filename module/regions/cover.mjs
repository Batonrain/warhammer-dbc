// module/regions/cover.mjs
// ════════════════════════════════════════════════════════════════════════
//  Укрытие — Region Behavior (wdbc-8k0i), по образцу difficult-terrain.mjs.
//  ГМ рисует зону Укрытия на сцене штатным слоем Regions и вешает на неё
//  это поведение; единственное поле — числовой модификатор теста атаки
//  (книжную цифру за конкретный тип укрытия — лёгкое/тяжёлое и т.п. —
//  ГМ подставляет сам, точных значений таблицы стр. 30-31 в код не зашито).
//
//  Кто получает бонус — считает combat/cover.mjs: цель должна СТОЯТЬ в зоне
//  (её нога/База пересекает Region — используется штатный, уже посчитанный
//  Foundry `tokenDocument.regions`, тот же приём, что и у Трудного
//  Ландшафта), И линия атакующий→цель обязана пересекать ту же зону —
//  Укрытие «на линии огня», а не под любым углом.
// ════════════════════════════════════════════════════════════════════════

export const COVER_TYPE = "warhammer-dbc.cover";

export class CoverBehaviorType extends foundry.data.regionBehaviors.RegionBehaviorType {

  /** @override */
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      coverMod: new fields.NumberField({
        required: true, integer: true, initial: 0, nullable: false,
        label: "Модификатор атаки",
        hint: "К порогу теста атаки по цели в этом Укрытии (обычно отрицательный — ГМ ставит по книжной таблице Укрытий, стр. 30-31)."
      })
    };
  }
}
