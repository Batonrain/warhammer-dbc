// module/rules/bronze-myrmidon.mjs
//
// Bronze Myrmidon / Бронзовый Мирмидон (Дар Кхорна, wdbc-1rno.1, d100 ?):
// «Когда персонаж находится в Ярости, он получает Трейт Machine
// (+½Cor.b (окр.▲)), и попадания по его сочленениям и визорам считаются
// попаданиями в конечности и голову соответственно.»
//
// Сам Трейт Machine выдаётся отдельной записью Конструктора (kind:"trait",
// when.requireRage — синхронизируется, пока актор в Ярости, wdbc-wyr3), эта
// находка — только редирект: пока Трейт активен (embedded Item на акторе),
// «Сочленение / Шея» и «Глаз (Голова)» (ключи module/combat/damage.mjs::
// LOCATION_TO_ARMOR) резолвятся как обычная Рука/Голова — полный AP вместо
// специальной уязвимости («AP÷3»/«AP шлема игнорируется», module/combat/
// armor-properties.mjs::resolveArmorAbsorptionAP), а не как отдельная
// сущность «конечность» — «конечности» книга не уточняет какая именно, взят
// генерик «Рука» (тот же приём неопределённости, что у Force Bolt/knockdown
// без стороны).
//
// «Визор» как отдельное место попадания в системе не существует вовсе —
// по прямому указанию пользователя (15.09.2026) он приравнен к уже
// существующей цели Избирательной атаки «Глаз (Голова)» (визор — прорезь
// шлема на месте глаз, тот же смысл).
//
// Редирект действует только когда защищающийся УЖЕ известен (module/combat/
// damage.mjs::applyDamageToActor, при применении урона) — карточка атаки
// строится раньше (attack.mjs), защищающегося ещё не выбрали, и там
// по-прежнему покажет исходную метку «Сочленение / Шея»/«Глаз (Голова)»; тот
// же компромисс, что у Compression (rules/compression.mjs).

// Полное двуязычное имя, не голое "Machine" — «Machine Empathy» (реальный
// Талант техножреца) тоже начинается на "Machine" и НЕ должен совпасть.
const MACHINE_TRAIT_NAME = "Machine / Машина";

/** Активен ли сейчас Трейт Machine (embedded Item, синкается с Яростью). */
export function hasActiveMachineTrait(actor) {
  return !!actor?.items?.some(i => i?.type === "trait" && i?.name?.startsWith(MACHINE_TRAIT_NAME));
}

/**
 * Редирект метки места попадания для актора с активным Трейтом Machine.
 * Актор БЕЗ активного Трейта получает исходную метку без изменений.
 */
export function redirectHitLocationForMachine(hitLocation, actor) {
  if (!hasActiveMachineTrait(actor)) return hitLocation;
  if (hitLocation === "Сочленение / Шея") return "Рука";
  if (hitLocation === "Глаз (Голова)") return "Голова";
  return hitLocation;
}
