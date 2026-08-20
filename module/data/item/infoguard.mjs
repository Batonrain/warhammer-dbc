// module/data/item/infoguard.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ИНФОГРАЖДЕНИЕ — Успехи встречного теста, которые высокотехнологичный
//  предмет копит против Техночудес Ноотеургии/Аниматеургии (module/apps/
//  infoguard.mjs). Общее поле для weapon/armor/gear/tool — примитивным,
//  мистическим, демоническим предметам и имплантам/бионике оно недоступно
//  (supportsInfoguard в том же module/apps/infoguard.mjs).
// ════════════════════════════════════════════════════════════════════════════

export function infoguardField() {
  const { NumberField } = foundry.data.fields;
  return new NumberField({ initial: 0, integer: true, nullable: false,
    label: "Успехи Инфограждения" });
}
