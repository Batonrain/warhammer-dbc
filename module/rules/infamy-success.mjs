// module/rules/infamy-success.mjs
// ════════════════════════════════════════════════════════════════════════════
//  «Проваливает тест … — может потратить Очко Бесчестия, чтобы вместо этого
//  преуспеть в нём на 1 Успех». Одна формулировка книги у нескольких Черт
//  Архетипов, различается только круг тестов:
//    Survivor / Выживальщик (Дикарь) — не-атакующий тест S, T, A или P.
//  Serpent's Tongue / Змеиный Язык (Отступник) — та же форма для социальных
//  тестов/Командования/Допроса; дописывается сюда ещё одной строкой реестра.
//
//  Здесь — только отбор: какие способности предлагаются на ЭТОМ проваленном
//  тесте. Кнопка на карточке теста (sheets/actor-sheet.mjs::_runTest) и
//  списание Очка (module/hooks.mjs, .wh-infamy-success-btn) — Foundry-обвязка.
//  Способность приходит возможностью (kind:"capability" на Черте), а не
//  именем Черты: выдать её можно любой записи Конструктора.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";

/**
 * Реестр. `applies({charKey, skillKey})` — подходит ли тест (вид теста —
 * атака/манифестация — отсекается снаружи, общим правилом «не-атакующий»).
 */
export const INFAMY_SUCCESS_ABILITIES = [
  {
    capability: "trait.survivor",
    label: "Survivor / Выживальщик",
    // Книга: «не-атакующий тест S, T, A или P». Тест Навыка через эти
    // Характеристики (Athletics(S), Acrobatics(A), Awareness(P)…) тоже
    // считается — [допущение]: оговорка «не-атакующий» имеет смысл, только
    // если Навыки входят (атаки идут по WS/BS, а Борьба — Athletics(S)).
    applies: ({ charKey }) => ["s", "t", "ag", "per"].includes(String(charKey ?? "").toLowerCase())
  }
];

/** Флаг карточки теста, из которого кнопка берёт свой контекст. */
export const INFAMY_SUCCESS_FLAG = "infamySuccess";


/**
 * Блок кнопок на карточке проваленного теста. Карточка одна на всех — блок
 * помечен wh-owner-only (hooks.mjs прячет его у не-владельцев, обработчик всё
 * равно перепроверяет права). Неактивна, если Очков нет.
 * @param {Array<{capability:string,label:string}>} options
 * @param {{actorUuid:string, hasPoint:boolean, pointOne?:string}} ctx
 */
export function infamySuccessSectionHtml(options, { actorUuid, hasPoint, pointOne = "Очко Бесчестия" }) {
  if (!options?.length) return "";
  const title = hasPoint ? `Потратить ${pointOne}: тест пройден с 1 Успехом` : `Нет Очков (${pointOne})`;
  const btns = options.map(o => `<button type="button" class="wh-infamy-success-btn" data-capability="${esc(o.capability)}"
      ${hasPoint ? "" : "disabled"} title="${esc(title)}">⚜ ${esc(o.label.split("/").pop().trim())}: успех на 1 Успех</button>`).join("");
  return `<div class="roll-defense-section roll-infamy-success wh-owner-only" data-actor-uuid="${esc(actorUuid)}">
    <div class="roll-defense-btns">${btns}</div>
  </div>`;
}

/**
 * Способности, которые можно применить к проваленному тесту.
 * @param {Set<string>} flags  возможности актора (rules/flags.mjs::ruleFlags)
 * @param {{kind?:string, charKey?:string, skillKey?:?string}} test
 * @returns {Array<{capability:string, label:string}>}
 */
export function infamySuccessOptions(flags, test = {}) {
  if (!flags?.size) return [];
  if (test.kind === "attack" || test.kind === "power") return [];
  return INFAMY_SUCCESS_ABILITIES
    .filter(a => flags.has(a.capability) && a.applies(test))
    .map(({ capability, label }) => ({ capability, label }));
}
