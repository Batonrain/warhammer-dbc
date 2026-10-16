// module/rules/training-advantage.mjs
// ════════════════════════════════════════════════════════════════════════
//  Таланты/Трейты поверх базового курса Обучения (module/rules/training.mjs,
//  module/apps/craft-workshop.mjs mode:"training") — тот же приём, что
//  craft-advantage.mjs для Крафта.
//
//  Teacher / Учитель (capabilities.mjs: elite.elitnyeArhetipy.kognite.teacher)
//  — подключён ПОЛНОСТЬЮ: удваивает Успехи учителя в формуле xp, снимает
//  потолок учеников в курсе с I.b до 10×I.b, освобождает учителя от
//  Усталости/монотонности за сеанс, даёт NPC-ученикам 2×I.b курсов в месяц
//  вместо их обычных ½I.b (книга явно исключает ПК/Миньонов из этой льготы).
//  НЕ подключено: «сеанс за 1 час вместо смены» — то же допущение на слово
//  стола, что у Медленной Смены (module/rules/craft-advantage.mjs) — игровое
//  время в Мастерской нигде не тикает.
//
//  Clear Mind / Чистый Разум (capabilities.mjs: trait.treytyRas.clearMind) —
//  подключена ТОЛЬКО вторая половина книжного текста («При обучении других:
//  +60 к Trade(Instructor)(I), ÷2 если ученик не на том же Пути») — это
//  обычный Навык/Талант-курс, укладывается в движок как есть. ПЕРВАЯ половина
//  («При обучении Пути от более опытного: +30 к финальному тесту I/Logic и
//  ×2 Успехи») НЕ подключена: Пути Аэльдари (module/constants/aeldari-
//  paths.mjs, system.paths) не покупаются за опыт вообще — там нет цены,
//  которую можно было бы обосновать/заработать курсом, и «обучение Пути» не
//  является видом цели этого движка (только skill/group/talent).
//
//  Klaivex (capabilities.mjs: elite.elitnyeArhetipy.inkub.klaivex) — курс на
//  цель «Элитный архетип Инкуб» (kind:"archetype") доступен ученику ТОЛЬКО
//  когда учитель — Клэйвекс (module/constants/training.mjs::
//  buildTeachableTargets); при успехе финального теста курса ученик получает
//  скидку вдвое на покупку архетипа Инкуб (module/rules/training.mjs::
//  grantEliteDiscount, применяется в module/apps/elite-buy.mjs::eliteCostFor)
//  — это НЕ xp-запас, обычная механика Обучения (consumeTrainingEarmark) тут
//  не участвует.
//
//  Interpreter (найден в capabilities.mjs как заглушка на эту же механику) —
//  СОЗНАТЕЛЬНО не подключён: даёт Преимущество на тесты «Транскрипции», такой
//  механики в коде нет вовсе (grep по всему module/ — ни одного вызова, только
//  текст в capabilities.mjs и elite-archetypes.mjs). См. bd «Разобрать»
//  (wdbc-5yafq) — отдельная находка, построить саму механику Транскрипции
//  нужно раньше, чем подключать сюда бонус.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

const hasItem = (actor, type, name) =>
  !!actor?.items?.some(i => i.type === type && itemHasName(i, name));
const hasTalent = (actor, name) => hasItem(actor, "talent", name);

export const hasTeacherTalent = actor => hasTalent(actor, "Teacher");
export const hasKlaivexTalent = actor => hasTalent(actor, "Klaivex");
// Clear Mind — Трейт, не Талант: capabilities.mjs::trait.treytyRas.clearMind
// числится в capability-reachable-ratchet.test.mjs как ALLOWED-исключение
// («включается по имени Черты», как trait.sonarSense/trait.flyer) — анализатор
// достижимости (tools/capability-reachability.mjs) распознаёт только опознание
// через hasTalent/itemHasName-с-литералом напрямую, не через hasItem(actor,"trait",…).
export const hasClearMind = actor => hasItem(actor, "trait", "Clear Mind");

/** Делят ли учитель и ученик хотя бы один Путь (ключ в system.paths). */
export function sharePath(a, b) {
  const keysOf = x => new Set((x?.system?.paths ?? []).map(p => p?.key).filter(Boolean));
  const ak = keysOf(a);
  if (!ak.size) return false;
  for (const k of keysOf(b)) if (ak.has(k)) return true;
  return false;
}

/**
 * +60 от Чистого Разума при обучении ДРУГИХ (не Пути — обычный курс
 * Навыка/Таланта), ÷2 если ученик не делит с учителем ни одного Пути.
 * Проверяется ОДИН раз на курс (по первому/любому ученику) — книга говорит
 * «ученик» в единственном числе, групповая механика курса не уточняет, как
 * считать при разных учениках на разных Путях; здесь — по тому ученику, чей
 * тест считается (вызывается на каждого отдельно).
 */
export function clearMindTeachBonus(teacher, student) {
  if (!hasClearMind(teacher)) return 0;
  return sharePath(teacher, student) ? 60 : 30;
}
