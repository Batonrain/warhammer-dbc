// module/rules/note-warrior-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Воин Ноты (Элитный архетип) — Таланты поверх музыки (rules/battle-music.mjs).
//  Чистая часть без Foundry.
//
//   • Waltz / Вальс — Напролом через Trade(Dancer)(A)+0 vs Awareness(P)+0:
//     лишний вариант окна приёма (combat/techniques.mjs); успешный Напролом
//     так не смещает, не сбивает и не ранит.
//   • Crescendo / Крещендо — Избирательные Быстрая/Молниеносная Атаки: первые
//     ½A.b (окр.▲) попаданий — в выбранное место вместо первых 2-х
//     (combat/attack.mjs → combat/attack-outcome.mjs::locationForHit).
//   • Finale / Финале и Leitmotif / Лейтмотив — кнопки, combat/note-warrior.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";
import { SKILL_RANKS } from "../constants/characteristics.mjs";

const hasNamed = (actor, name) => [...(actor?.items ?? [])].some(i => i?.type === "talent" && itemHasName(i, name));
export const hasWaltz     = a => hasNamed(a, "Waltz");
export const hasCrescendo = a => hasNamed(a, "Crescendo");
export const hasFinale    = a => hasNamed(a, "Finale");
export const hasLeitmotif = a => hasNamed(a, "Leitmotif");

/** Trade (Dancer)(A): Ag + Ранг записи специализации (нет записи — −20). */
export function dancerAgValue(actor) {
  const list = actor?.system?.groupSkills?.trade;
  const e = Array.isArray(list) ? list.find(x => x?.specKey === "dancer" || /dancer|танц/i.test(String(x?.specialty ?? x?.name ?? ""))) : null;
  const ag = Number(actor?.system?.characteristics?.ag?.total) || 0;
  return ag + (e ? (SKILL_RANKS[e.rank]?.bonus ?? -20) + (Number(e.mod) || 0) : -20);
}

export const WALTZ_NOTE = "Вальс: Trade(Dancer)(A)+0 vs Awareness(P)+0. Успех — Воин проскальзывает мимо помех на пути: цели не смещаются, не сбиваются с ног и не получают урона.";

/** Ключ варианта Вальса в окне приёма (combat/techniques.mjs подменяет по нему исход успеха). */
export const WALTZ_KEY = "noteWarrior:waltz";

/** Вариант окна Напролома у Воина с Вальсом. */
export function waltzContestOptions(actor, techDef) {
  if (!hasWaltz(actor) || techDef?.label !== "Напролом") return [];
  return [{
    key: WALTZ_KEY, label: "Trade(Dancer)(A) — Вальс", value: dancerAgValue(actor),
    skillKey: "trade", charKey: "ag", resist: [{ skill: "awareness" }], techNote: WALTZ_NOTE
  }];
}

/** Крещендо: сколько первых попаданий Избирательной Быстрой/Молниеносной атаки идут в выбранное место. */
export function crescendoAimedHits(actor, { aimed = false, technique = "" } = {}) {
  if (!aimed || (technique !== "swift" && technique !== "lightning") || !hasCrescendo(actor)) return 2;
  const agB = Math.floor((Number(actor?.system?.characteristics?.ag?.total) || 0) / 10);
  return Math.max(2, Math.ceil(agB / 2));
}

/** Финале: «не меньше 6» проигравших врагов, чтобы восстановить 1d5 Очков. */
export const FINALE_ALL_MIN = 6;

/** Сколько Очков Бесчестия вернуть Финале: 0, 1 или «1d5». */
export function finaleRestore(losers, total) {
  if (!(losers > 0)) return 0;
  return (losers === total && total >= FINALE_ALL_MIN) ? "1d5" : 1;
}

/** Лейтмотив: чемпион с Inf 30+ даёт музыку на ½Inf.b (окр.▲) Успехов. */
export const LEITMOTIF_MIN_INF = 30;
export function leitmotifDeg(champion) {
  const inf = Number(champion?.system?.characteristics?.inf?.total) || 0;
  if (inf < LEITMOTIF_MIN_INF) return 0;
  return Math.ceil(Math.floor(inf / 10) / 2);
}
