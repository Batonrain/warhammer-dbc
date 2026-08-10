// module/sheets/active-effect-config.mjs
// ════════════════════════════════════════════════════════════════════════
//  Штатный редактор эффекта Foundry (ActiveEffectConfig) поле "phase" рисует
//  как <input type="hidden"> (templates/sheets/active-effect/change.hbs ядра)
//  — GM физически не может выставить фазу через UI, только через код. Раз
//  вся вкладка «Эффекты» построена вокруг того, что числовые бонусы должны
//  идти с phase:"final" (см. module/constants/effect-keys.mjs), это дыра,
//  через которую GM молча получает нерабочий эффект.
//
//  Правим минимально: два скопированных шаблона ядра (changes.hbs/change.hbs)
//  с добавленным видимым select для "Фаза", и переопределённый _renderChange,
//  указывающий на них вместо шаблонов ядра. Всё остальное (Details, Duration,
//  сама логика сохранения формы) — из штатного класса без изменений.
// ════════════════════════════════════════════════════════════════════════

const PHASE_CHOICES = {
  initial: "Начальная (до расчёта листа)",
  final:   "Финальная (обычный числовой бонус — после расчёта)"
};

export class WarhammerActiveEffectConfig extends foundry.applications.sheets.ActiveEffectConfig {
  static DEFAULT_OPTIONS = {
    classes: ["warhammer-dbc", "wh-holo", "wh-ae-config"]
  };

  // ВАЖНО: в отличие от DEFAULT_OPTIONS, статическое поле PARTS в ApplicationV2
  // НЕ мёрджится по цепочке наследования (обычная семантика static-полей JS —
  // просто перекрывается). Раньше здесь стояло PARTS = { changes: {...} } —
  // это стирало header/tabs/details/duration/footer целиком (пустое окно).
  // Мёрджим явно сами: всё от ядра, кроме "changes" — своя копия шаблона.
  static PARTS = foundry.utils.mergeObject(
    foundry.applications.sheets.ActiveEffectConfig.PARTS,
    {
      changes: {
        template: "systems/warhammer-dbc/templates/apps/active-effect-changes.hbs",
        templates: ["systems/warhammer-dbc/templates/apps/active-effect-change.hbs"],
        scrollable: ["ol[data-changes]"]
      }
    },
    { inplace: false }
  );

  /** @override — та же логика ядра, только рендерит нашу копию change.hbs с видимой «Фазой». */
  async _renderChange(context) {
    const { change, index } = context;
    if (("value" in change) && (typeof change.value !== "string")) change.value = JSON.stringify(change.value);
    Object.assign(change, ["key", "type", "value", "phase", "priority"].reduce((paths, fieldName) => {
      if (fieldName in change) paths[`${fieldName}Path`] = `system.changes.${index}.${fieldName}`;
      return paths;
    }, {}));
    const changeType = ActiveEffect.CHANGE_TYPES[change.type];
    context.changeType = changeType;
    context.phaseChoices = PHASE_CHOICES;
    return changeType?.render?.(context)
      ?? foundry.applications.handlebars.renderTemplate("systems/warhammer-dbc/templates/apps/active-effect-change.hbs", context);
  }
}
