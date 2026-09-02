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

// Без префикса пакета — см. комментарий у LINGER_ZONE_TYPE (module/regions/linger-zone.mjs).
export const COVER_TYPE = "cover";

export class CoverBehaviorType extends foundry.data.regionBehaviors.RegionBehaviorType {

  /** @override */
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      coverMod: new fields.NumberField({
        required: true, integer: true, initial: 0, nullable: false,
        label: "Модификатор атаки",
        hint: "К порогу теста атаки по цели в этом Укрытии (обычно отрицательный — ГМ ставит по книжной таблице Укрытий, стр. 30-31)."
      }),
      // AP укрытия (стр. 12, «Отскок» — wdbc-9wvm): отдельное от coverMod
      // число — та же зона Укрытия одновременно штрафует ПОРОГ атаки по цели
      // (coverMod) и даёт цели доп. AP при поглощении урона, если попадание
      // всё же прошло (см. combat/cover.mjs::coverApForToken,
      // combat/damage.mjs — потребитель флага recoilCoverBonus).
      coverAp: new fields.NumberField({
        required: true, integer: true, initial: 0, min: 0, nullable: false,
        label: "AP укрытия",
        hint: "Доп. AP поглощения цели, стоящей в этом Укрытии, при Отскоке в него (стр. 12) — книжная цифра по типу Укрытия, стр. 30-31."
      })
    };
  }
}
