// module/combat/condition-effects.mjs
// ════════════════════════════════════════════════════════════════════════════
//  СРОК СОСТОЯНИЯ, сторона Foundry (wdbc-uqco). Арифметика — рядом, в
//  module/rules/condition-duration.mjs (чистая, без Foundry); здесь только
//  документы: завести эффект со сроком, подмести истёкшие, обновить видимый
//  остаток.
//
//  ── Почему срок вешается на ТОТ ЖЕ эффект, что рисует иконку ───────────────
//  Мост «лист ↔ токен» (apps/token-conditions.mjs) уже заводит на акторе
//  статус-эффект со statuses:[ключ] — это и есть иконка на токене. Заводить
//  рядом ВТОРОЙ эффект ради срока значило бы две иконки на одно Состояние,
//  ровно тот симптом, за которым сессия уже гонялась (wdbc-meh9/wdbc-b3mz).
//  Поэтому эффект создаётся здесь СРАЗУ со сроком, а мост, увидев его,
//  проставляет Состояние на листе сам — и второй раз ничего не создаёт,
//  потому что его проверка «want === has» уже сходится.
//
//  ── Что остаётся как было ─────────────────────────────────────────────────
//  Состояние БЕЗ срока не трогается вовсе: висит до ручного снятия, пишется
//  тем же actor.update через единую точку (wdbc-fejd), никаких эффектов.
//  Новое живёт рядом со старым — срок появляется только там, где автор его
//  задал.
// ════════════════════════════════════════════════════════════════════════════

import { CONDITIONS_DEF, conditionLevelField } from "../constants/conditions.mjs";
import { conditionApplyFields } from "../sheets/tabs/conditions.mjs";
// Тот же глиф, что рисует иконку статуса на токене — эффект создаётся здесь,
// а не мостом, и обязан выглядеть ровно так же, как если бы его завёл мост.
import { statusIconUri } from "../apps/token-conditions.mjs";
import { durationDataFor, isDurationExpired, remainingRounds, remainingLabel }
  from "../rules/condition-duration.mjs";

const FLAG = "warhammer-dbc";
/** Метка «этот эффект несёт срок Состояния X» — по ней он и находится обратно. */
const DURATION_FLAG = "conditionDuration";

/** Снимок текущего момента игры для арифметики срока. */
export function nowSnapshot() {
  const combat = globalThis.game?.combat ?? null;
  return {
    round: Number(combat?.round) || 0,
    turn: Number(combat?.turn) || 0,
    combatId: combat?.id ?? null,
    worldTime: Number(globalThis.game?.time?.worldTime) || 0
  };
}

/** Эффекты актора, несущие срок Состояния: [{ effect, key }]. */
export function conditionDurationEffects(actor) {
  const out = [];
  for (const effect of actor?.effects ?? []) {
    const key = effect.getFlag?.(FLAG, DURATION_FLAG) ?? effect.flags?.[FLAG]?.[DURATION_FLAG];
    if (key && CONDITIONS_DEF[key]) out.push({ effect, key });
  }
  return out;
}

/** Срок именно этого Состояния, если он задан. */
export function conditionDurationEffect(actor, key) {
  return conditionDurationEffects(actor).find(e => e.key === key)?.effect ?? null;
}

/** Есть ли у Состояния свой срок — тем, кто иначе стал бы уменьшать счётчик сам. */
export function hasConditionDuration(actor, key) {
  return !!conditionDurationEffect(actor, key);
}

/**
 * Наложить Состояние СО СРОКОМ.
 *
 * Порядок важен и объясняется в шапке: сперва эффект (он же иконка, он же
 * срок), потом флаг и счётчик на листе. Иммунитет спрашивается ПЕРВЫМ и тем
 * же способом, что везде (wdbc-tl0f): пустой патч единой точки означает
 * «этому актору Состояние не накладывается» — тогда не заводится и эффект,
 * иначе на токене висела бы иконка того, чего на листе нет.
 *
 * @returns {boolean} наложилось ли (false — иммунитет или неизвестное Состояние)
 */
export async function applyConditionWithDuration(actor, key, { level = null, value = 0, unit = "" } = {}) {
  const def = CONDITIONS_DEF[key];
  if (!actor || !def) return false;
  const now = nowSnapshot();
  const duration = durationDataFor(value, unit, now);
  // Счётчик-зеркало заполняется СРАЗУ, а не ждёт первого подметания: игрок
  // должен увидеть «2 раунда» в момент наложения, а не ноль до конца Хода.
  // Явно заданная СИЛА (Кровотечение ур. 2) важнее зеркала — она про другое.
  const shown = (level == null && duration && conditionLevelField(key))
    ? remainingRounds(duration, now) : level;
  const fields = conditionApplyFields(key, shown, actor);
  if (!Object.keys(fields).length) return false;   // иммунитет — молча и без иконки

  if (duration) {
    const existing = conditionDurationEffect(actor, key);
    // Повторное наложение продлевает срок, а не плодит второй эффект: книга
    // нигде не говорит «два Оглушения», она говорит «Оглушён дольше».
    if (existing) await existing.update({ duration });
    else {
      await actor.createEmbeddedDocuments("ActiveEffect", [{
        name: def.label, img: statusIconUri(key),
        statuses: [key], duration,
        flags: { [FLAG]: { [DURATION_FLAG]: key } }
      }]);
    }
  }
  await actor.update(fields);
  return true;
}

/**
 * Снять срок Состояния (сам эффект). Снятие Состояния с листа проходит через
 * единую точку у вызывающей стороны — мост «лист ↔ токен» гасит иконку сам;
 * здесь уносится только носитель срока.
 */
export async function clearConditionDuration(actor, key) {
  const effect = conditionDurationEffect(actor, key);
  if (effect) await effect.delete();
}

/**
 * Подмести истёкшие сроки и освежить видимый остаток.
 *
 * Удаление эффекта — единственное действие на истечение: дальше мост
 * «лист ↔ токен» (deleteActiveEffect → conditionRemoveFields) сам гасит
 * Состояние на листе. Своего снятия здесь нет намеренно — иначе два пути
 * снятия разошлись бы, ровно как расходились двадцать путей наложения до
 * wdbc-fejd.
 *
 * Остаток зеркалится в прежнее поле-счётчик (system.conditions.<key>Rounds),
 * чтобы ни один нынешний его читатель не сломался: источник истины теперь
 * Duration, а поле — её отражение.
 *
 * @returns {{expired: string[], refreshed: string[]}} что сняли и что пересчитали
 */
export async function sweepConditionDurations(actor) {
  const now = nowSnapshot();
  const expired = [], refreshed = [];
  const updates = {};
  for (const { effect, key } of conditionDurationEffects(actor)) {
    const duration = effect.duration ?? effect.system?.duration ?? {};
    if (isDurationExpired(duration, now)) {
      await effect.delete();
      expired.push(key);
      continue;
    }
    const field = conditionLevelField(key);
    if (!field) continue;
    const left = remainingRounds(duration, now);
    if (left === null) continue;
    if (Number(actor.system?.conditions?.[field]) !== left) {
      updates[`system.conditions.${field}`] = left;
      refreshed.push(key);
    }
  }
  if (Object.keys(updates).length) await actor.update(updates);
  return { expired, refreshed };
}

/** Остаток срока словами — для тега на листе и подсказки на токене. */
export function conditionRemainingLabel(actor, key) {
  const effect = conditionDurationEffect(actor, key);
  if (!effect) return "";
  return remainingLabel(effect.duration ?? effect.system?.duration ?? {}, nowSnapshot());
}
