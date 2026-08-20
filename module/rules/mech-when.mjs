// module/rules/mech-when.mjs
//
// Условие «Когда» (entry.when) — гейт по Геносемени актора, общий для ЛЮБОЙ
// записи Конструктора и ЛЮБОГО места, что читает Механику предмета: разовая
// выдача и живая пересинхронизация (module/apps/mechanics.mjs), живые запросы
// «Переброс»/«Модификатор теста»/«Возможность» (module/rules/item-rules.mjs),
// «Ландшафт» (module/combat/movement-terrain.mjs), «Усталость»
// (module/rules/fatigue-grace.mjs). Живёт в module/rules/, а не в
// apps/mechanics.mjs, — чтобы её мог позвать fatigue-grace.mjs, который
// нарочно не тянет apps/mechanics.mjs целиком (см. его шапку). Чистая
// функция: никаких обращений к Foundry, только actor.system.geneSeed.
//
// Формат: when.conditions — список вариантов {legion, chapter, ageAtLeast},
// между вариантами ИЛИ (Железа Бетчера не работает СРАЗУ у трёх линий — три
// условия одной записи, не три её копии). Пустой список — условия нет, запись
// работает всем, как раньше. Орден в варианте не задан — условие держит
// только легион, подходит и наследникам без своей более узкой записи.
// ageAtLeast — необязательное дополнительное сужение варианта: Геносемя
// подошло, но нужен ещё и Возраст (вкладка Записи, system.bio.age) не меньше
// указанного — «клыки у Космического Волка отрастают через 20 лет после
// имплантации» книга привязывает к возрасту, а не к легиону одному. Внутри
// одного варианта легион/орден и возраст — И. when.negate переворачивает
// результат целиком: «выдать этим» ⇄ «выдать всем, КРОМЕ этих».

/** Заполненные варианты (легион задан) из entry.when.conditions. */
export function whenConditions(when) {
  return (when?.conditions || []).filter(c => c?.legion);
}

/** Выполняет ли актор условие «Когда» одной записи Механики. */
export function entryWhenOk(actor, entry) {
  const conditions = whenConditions(entry?.when);
  if (!conditions.length) return true;
  if (!actor) return true;
  const gs = actor.system?.geneSeed || {};
  const age = Number(actor.system?.bio?.age) || 0;
  const matches = conditions.some(c => {
    if (c.chapter ? (gs.legion !== c.legion || gs.chapter !== c.chapter) : gs.legion !== c.legion) return false;
    if (c.ageAtLeast != null && c.ageAtLeast !== "" && age < Number(c.ageAtLeast)) return false;
    return true;
  });
  return entry.when.negate ? !matches : matches;
}
