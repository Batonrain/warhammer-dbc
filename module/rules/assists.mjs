// module/rules/assists.mjs
//
// Ассистенты броска (корбук, стр. 25). Помощник даёт +10 к порогу и +1 степень
// успеха — но степень только тогда, когда бросок и без того удался: на провал
// помощники не влияют.
//
// Здесь только правила: кто вправе помогать и во что это превращается в
// числах. Перетаскивание актора в зону, чипы и счётчик — дело диалога
// (module/sheets/actor-sheet.mjs), Foundry сюда не заходит, и всё проверяется
// тестом без заглушки.

import { SKILL_RANKS } from "../constants/characteristics.mjs";
import { hasRuleFlag } from "./flags.mjs";

/**
 * Порядок рангов выводится из самой таблицы рангов, а не переписывается
 * четвёртой копией: `{untrained:0, knows:1, ...}` уже лежит отдельно в
 * apps/creation.mjs, apps/mechanics.mjs и sheets/tabs/advance.mjs, и любая
 * из этих копий разъедется с книгой при добавлении ранга.
 */
const RANK_ORDER = Object.fromEntries(Object.keys(SKILL_RANKS).map((key, i) => [key, i]));

/** Ранг, начиная с которого можно помогать: «Знает» (+0). */
export const MIN_ASSIST_RANK = "knows";

/** Сколько помощников допускается. Пока число, а не поле — задел под предметы. */
export const DEFAULT_ASSIST_MAX = 2;

/** Возможность «помогаю сверх лимита» (Промышленный мир, «Ну-ка вместе»). */
export const ASSIST_BEYOND_CAP_FLAG = "assist.beyondCap";

/**
 * Встаёт ли этот помощник СВЕРХ лимита. Такой слот не занимает и в максимум не
 * упирается, но помогает как обычный: +10 к порогу и +1 степень.
 */
export function assistsBeyondCap(candidate) {
  return hasRuleFlag(candidate, ASSIST_BEYOND_CAP_FLAG);
}

/** Сколько помощников занимают слоты — безлимитные в счёт не идут. */
export function countedAssists(assistants = []) {
  return assistants.filter(a => !a?.beyondCap).length;
}

const rankStep = rank => RANK_ORDER[String(rank ?? "")] ?? 0;
const norm = s => String(s ?? "").toLowerCase().trim();

/**
 * Вправе ли актор помогать в этом броске.
 *
 * Тест голой характеристики навыка не требует — помочь может кто угодно.
 * Тесту навыка нужен тот же навык рангом не ниже «Знает»; у группового навыка
 * проверяется КОНКРЕТНАЯ специализация, а не сам факт наличия группы: знаток
 * «Общих знаний (Империум)» не помогает в «Общих знаниях (Хаос)».
 */
export function canAssist(candidate, ctx = {}) {
  if (!candidate) return false;
  const min = rankStep(MIN_ASSIST_RANK);

  if (ctx.group) {
    const entry = (candidate.system?.groupSkills?.[ctx.group] || [])
      .find(e => norm(e?.specialty) === norm(ctx.specialty));
    return !!entry && rankStep(entry.rank) >= min;
  }
  if (ctx.skill) return rankStep(candidate.system?.skills?.[ctx.skill]?.rank) >= min;
  return true;
}

/**
 * Почему помощника не берут. Возвращает текст отказа либо null, если можно.
 * Отдельной функцией, чтобы диалог не решал сам, что именно сказать игроку, а
 * причины проверялись тестом.
 *
 * Переполнение проверяется ПОСЛЕ права помогать сверх лимита: иначе такой
 * помощник отсекался бы раньше, чем система успевала узнать, что он безлимитный.
 */
export function assistRejection(candidate, { actor, assistants = [], max = DEFAULT_ASSIST_MAX, ctx = {} } = {}) {
  if (!candidate) return "Не удалось определить, кого перетащили.";
  if (!assistsBeyondCap(candidate) && countedAssists(assistants) >= max)
    return `Достигнут максимум помощников (${max}).`;
  if (actor && candidate.id === actor.id) return "Актор не может ассистировать самому себе.";
  if (assistants.some(a => a.uuid === candidate.uuid)) return `${candidate.name} уже в списке помощников.`;
  if (!canAssist(candidate, ctx))
    return `${candidate.name}: нет нужного навыка на ранге «${SKILL_RANKS[MIN_ASSIST_RANK].label}» или выше — не может ассистировать.`;
  return null;
}

/** Прибавка к порогу броска: +10 за помощника. */
export function assistThresholdBonus(count = 0) {
  return (Number(count) || 0) * 10;
}

/**
 * Степени успеха с учётом помощников.
 *
 * Помощники добавляют по степени ТОЛЬКО к успеху. На провале их вклад
 * отбрасывается: иначе помощь ухудшала бы результат, что противоречит и книге,
 * и здравому смыслу.
 */
export function assistDegrees(base, count = 0, success = false) {
  const b = Number(base) || 0;
  return success ? b + (Number(count) || 0) : b;
}
