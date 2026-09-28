// module/rules/talent-spec-choice.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Талант «на выбор» в записи Конструктора: «Resistance (любые 2)»,
//  «Weapon Training (любые 3)», «Two Weapon Wielder (любой 1)».
//
//  Раньше запись kind:"talent" несла такую специализацию строкой как есть, и
//  персонаж получал Талант «Сопротивление (любые 2)» — не выбрав ничего, а
//  значит без единой настоящей специализации (сверка расы Репликант с книгой,
//  26.09.2026). У Навыков выбор давно есть (specKey:"__choice__",
//  resolveEntrySpecChoice в apps/mechanics.mjs), у Талантов его не было.
//
//  Здесь — чистая часть: узнать «на выбор ли» специализация записи и из чего
//  выбирать. Список вариантов берётся у САМОГО Таланта библиотеки (поле
//  system.specialization — «Cold, Blindness, Deafness, …»), а не дублируется
//  в записи: правка списка у Таланта сама доезжает до всех рас и Архетипов.
//  Если у Таланта список не перечислим («Любая организация», «Для каждого
//  экзотического оружия») — выбора нет, запись остаётся как была: игрок/ГМ
//  впишет специализацию руками, как раньше.
//
//  Выбранные специализации ложатся ОДНИМ Талантом через запятую («Cold,
//  Heat») — так уже записаны книжные «Resistance (Cold, Heat)» Огрина и
//  Йигори, и лист/сверка дублей читают именно такую форму.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Сколько специализаций нужно выбрать, если запись «на выбор».
 * «любые 2» → 2, «любой 1»/«любая»/«1 любое» → 1; конкретная специализация
 * («Cold, Heat») или пусто → null.
 *
 * Регулярки — без `\w`/`\b`: кириллица в них не входит (AGENTS.md,
 * «Кириллица в регулярках»).
 *
 * @param {string} spec
 * @returns {?number}
 */
export function anySpecCount(spec) {
  const s = String(spec ?? "").trim().toLowerCase();
  if (!s) return null;
  let m = /^люб(?:ые|ой|ая|ое|ых)(?:\s+(\d+))?$/u.exec(s);
  if (m) return Math.max(1, Number(m[1]) || 1);
  m = /^(\d+)\s+люб(?:ые|ой|ая|ое|ых)$/u.exec(s);
  if (m) return Math.max(1, Number(m[1]) || 1);
  return null;
}

/**
 * Варианты специализации из поля Таланта библиотеки. null — список не
 * перечислим (описан словами, а не перечнем).
 *
 * @param {string} talentSpec  system.specialization Таланта
 * @returns {?string[]}
 */
export function talentSpecOptions(talentSpec) {
  const s = String(talentSpec ?? "").trim();
  if (!s) return null;
  if (/люб|кажд|организац/iu.test(s)) return null;
  const list = s.split(",").map(x => x.trim()).filter(Boolean);
  return list.length > 1 ? list : null;
}

/**
 * Запись с выбранными специализациями вместо «любые N».
 *
 * @param {object}   entry   запись Конструктора kind:"talent"
 * @param {string[]} picked  выбранные специализации (ключи из talentSpecOptions)
 * @returns {object} копия записи
 */
export function withPickedSpecs(entry, picked) {
  return { ...entry, specialization: picked.map(p => String(p).trim()).filter(Boolean).join(", ") };
}
