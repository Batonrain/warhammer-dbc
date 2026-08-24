// module/rules/mech-when.mjs
//
// Условие «Когда» (entry.when) — два независимых гейта одной записи
// Конструктора, общих для ЛЮБОГО места, что читает Механику предмета: разовая
// выдача и живая пересинхронизация (module/apps/mechanics.mjs), живые запросы
// «Переброс»/«Модификатор теста»/«Возможность» (module/rules/item-rules.mjs),
// «Ландшафт» (module/combat/movement-terrain.mjs), «Усталость»
// (module/rules/fatigue-grace.mjs). Живёт в module/rules/, а не в
// apps/mechanics.mjs, — чтобы её мог позвать fatigue-grace.mjs, который
// нарочно не тянет apps/mechanics.mjs целиком (см. его шапку). Чистая
// функция: никаких обращений к Foundry.
//
// ── Геносемя (when.conditions/when.negate) ──────────────────────────────────
// Список вариантов {legion, chapter, ageAtLeast}, между вариантами ИЛИ (Железа
// Бетчера не работает СРАЗУ у трёх линий — три условия одной записи, не три
// её копии). Пустой список — условия нет, запись работает всем, как раньше.
// Орден в варианте не задан — условие держит только легион, подходит и
// наследникам без своей более узкой записи. ageAtLeast — необязательное
// дополнительное сужение варианта: Геносемя подошло, но нужен ещё и Возраст
// (вкладка Записи, system.bio.age) не меньше указанного — «клыки у Космического
// Волка отрастают через 20 лет после имплантации» книга привязывает к
// возрасту, а не к легиону одному. Внутри одного варианта легион/орден и
// возраст — И. when.negate переворачивает результат целиком: «выдать этим» ⇄
// «выдать всем, КРОМЕ этих». Гейт смотрит на actor.system.geneSeed — нет
// актора (превью/сравнение вне владельца) — условие считается пройденным.
//
// ── Субмутация (when.submutations/when.negateSub) ───────────────────────────
// Список подписей строк ИЗ ТАБЛИЦЫ СУБМУТАЦИЙ САМОГО ПРЕДМЕТА (label из
// parseSubmutations, rules/submutations.mjs — «1», «2-3», «Кхорн»), между
// которыми ИЛИ. Мутация с субмутациями меняет своё действие в зависимости от
// того, какая строка выпала (system.submutation.label, apps/submutations.mjs)
// — так одна и та же Мутация несёт в Конструкторе несколько записей, каждая
// со своим набором строк, и включена только та, чья субмутация сейчас
// записана на предмете. Свой negateSub, а не общий negate: два условия
// независимы (Геносемя — про актора, субмутация — про сам предмет), у записи
// почти никогда не бывает обоих сразу, и совмещать их в один переключатель
// было бы путаницей. Гейт смотрит на item.system.submutation: нет самого
// предмета (вызов вне контекста Механики — тот же случай, что «нет актора» у
// Геносемени) — условие пройдено; предмет есть, но субмутация ещё не выбрана
// (label пуст) — не пройдено: запись не должна включиться ДО броска.

/** Заполненные варианты (легион задан) из entry.when.conditions. */
export function whenConditions(when) {
  return (when?.conditions || []).filter(c => c?.legion);
}

/** Заполненные подписи строк субмутации из entry.when.submutations. */
export function whenSubmutations(when) {
  return (when?.submutations || []).filter(Boolean);
}

/**
 * Выполняет ли актор/предмет условие «Когда» одной записи Механики.
 * @param {?object} actor  владелец — для гейта по Геносемени.
 * @param {object}  entry  запись Механики (entry.when).
 * @param {?object} item   предмет, несущий эту запись — для гейта по субмутации.
 */
export function entryWhenOk(actor, entry, item = null) {
  const conditions = whenConditions(entry?.when);
  const subs = whenSubmutations(entry?.when);
  if (!conditions.length && !subs.length) return true;

  let geneOk = true;
  if (conditions.length && actor) {
    const gs = actor.system?.geneSeed || {};
    const age = Number(actor.system?.bio?.age) || 0;
    const matches = conditions.some(c => {
      if (c.chapter ? (gs.legion !== c.legion || gs.chapter !== c.chapter) : gs.legion !== c.legion) return false;
      if (c.ageAtLeast != null && c.ageAtLeast !== "" && age < Number(c.ageAtLeast)) return false;
      return true;
    });
    geneOk = entry.when.negate ? !matches : matches;
  }

  let subOk = true;
  if (subs.length && item) {
    const label = item.system?.submutation?.label || "";
    if (!label) {
      // Субмутация ещё не выбрана — гейт не пройден НЕЗАВИСИМО от negateSub:
      // запись не должна включиться ДО броска (см. шапку), а «любая, КРОМЕ
      // этой» — это всё ещё «какая-то выпала».
      subOk = false;
    } else {
      const matches = subs.includes(label);
      subOk = entry.when.negateSub ? !matches : matches;
    }
  }

  return geneOk && subOk;
}
