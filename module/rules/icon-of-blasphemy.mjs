// module/rules/icon-of-blasphemy.mjs
//
// Мутация «Icon of Blasphemy / Икона Богохульства» (wdbc-zbc0, следом за
// Illusion of Normality): РАЗНЫЙ по форме пробел, несмотря на похожий текст
// в capabilities.mjs («засекшие пси-чутьём/ноосканированием — W+0») — при
// сверке с полным текстом пака (packs-src/mutations/Общие_мутации/
// Icon_of_Blasphemy...json) выяснилось, что это НЕ парный тест «наблюдатель
// заметил → наблюдатель видит сквозь» (как у Illusion of Normality), а
// самостоятельно активируемая раз за бой/сцену вспышка иллюзии:
//
//   «Один раз за бой или сцену, свободным действием, персонаж проявляет
//   образ на 1 Раунд. Любой противник-Имперец, что УВИДЕЛ его — тест W+0
//   или впадает в Ярость (пока не выйдет — считает персонажа единственным
//   врагом в поле зрения). Психайкеры/Механикум, что засекли его ПСИ-ЧУТЬЁМ
//   или НООСФЕРНЫМ СКАНИРОВАНИЕМ — отдельный тест W+0, при провале не
//   Ярость, а обязаны потратить свой следующий Ход на атаку персонажа.»
//
// Кулдаун — на самом МУТАНТЕ (это его свободное действие и его ресурс), а
// не на наблюдателе, как у Illusion of Normality — тем же приёмом, что
// Avatar of Slaughter (module/combat/avatar-of-slaughter.mjs).
//
// Ветка «видел» ↔ «засёк Пси-чутьём/Ноосферой» (указание пользователя,
// заменяет более ранний диалог-выбор ГМа) — автоопределение по данным
// актора-цели:
//   • «Имперец» из книги = system.alignment === "loyalist" (дефолт поля,
//     data/actor/_creature.mjs) — НЕ-Лоялисты иллюзией не затрагиваются
//     вовсе, ни в одной из групп.
//   • Из Лоялистов — «засёк Пси-чутьём/Ноосферой» (группа psychic), если
//     есть Черта «Psyker» (packs-src/traits/Psyker___Псайкер...json) ИЛИ
//     хирургически установлены (не неисправны) Boевые Латы Скитарии
//     (implant «Skitarii War Plate», тот же installed/disabled-гейт, что
//     у прочих имплантов, см. predicates.mjs::hasInstalledImplant).
//   • Остальные Лоялисты — группа visual («видел», тест на Ярость).
//
// Ярость: system.inRage — простой тумблер (module/combat/frenzy.mjs), уже
// ЯВНО задокументирован как открытый для «мутаций и т.п.» источников кроме
// Frenzy — включение его отсюда при провале цели ничего не ломает и не
// самовольничает. «Считает персонажа единственным врагом» и «обязан
// атаковать следующий Ход» — сама механика Ярости/принуждения нигде в
// движке не реализована (см. комментарий combat/frenzy.mjs) и здесь
// намеренно оставлена флажком/чат-запиской для стола, не новой системой
// принуждения целей.

import { itemHasName } from "./predicates.mjs";

const NAME = "Icon of Blasphemy";
const PSYKER_TRAIT = "Psyker";
const SKITARII_IMPLANT = "Skitarii War Plate";

/** Это предмет-Мутация «Икона Богохульства»? */
export function isIconOfBlasphemyItem(item) {
  return item?.type === "mutation" && itemHasName(item, NAME);
}

/** «Имперец» книги — Лоялист по Мировоззрению. */
export function isLoyalist(actor) {
  return actor?.system?.alignment === "loyalist";
}

/** Черта «Psyker» ИЛИ хирургически установленные (не неисправные) Боевые Латы Скитарии. */
export function isPsykerOrSkitarii(actor) {
  const items = [...(actor?.items ?? [])];
  const hasPsykerTrait = items.some(i => i?.type === "trait" && itemHasName(i, PSYKER_TRAIT));
  const hasSkitarii = items.some(i => i?.type === "implant" && itemHasName(i, SKITARII_IMPLANT) &&
    i?.flags?.["warhammer-dbc"]?.installed && !i?.flags?.["warhammer-dbc"]?.disabled);
  return hasPsykerTrait || hasSkitarii;
}

/**
 * Группа свидетеля для Иконы Богохульства: "visual" (видел — тест на
 * Ярость), "psychic" (засёк Пси-чутьём/Ноосферой — тест на принуждение
 * атаковать), или null — не Лоялист, иллюзия на него/неё не действует.
 */
export function classifyWitness(actor) {
  if (!isLoyalist(actor)) return null;
  return isPsykerOrSkitarii(actor) ? "psychic" : "visual";
}
