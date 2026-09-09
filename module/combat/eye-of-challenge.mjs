// module/combat/eye-of-challenge.mjs
// ════════════════════════════════════════════════════════════════════════
//  Око Вызова / Eye of Challenge (Дар Кхорна, wdbc-1rno):
//  «...если в течение минуты он не бросит вызов этому персонажу, чемпион
//  получит 2d10+8 урона в W».
//
//  Разведка/опознание цели (WS/S/Parry/Берсерк-Таланты) читается с реального
//  актора цели без гадания — это делает kind:"script" на самом предмете
//  (packs-src, entry "eyeOfChallenge-reveal") и там же стартует срок. Сам
//  «бросок вызова» — событие за столом (см. Challenge of Honour), движку
//  сверять не с чем: снимается ТОЛЬКО кнопкой второй записи предмета
//  ("eyeOfChallenge-confirm", clearEyeOfChallenge). Штраф за нарушенный срок —
//  единственная часть, которую движок обязан посчитать сам, поэтому она и
//  живёт отдельным хуком (updateWorldTime), а не кнопкой.
//
//  Метка живёт на САМОМ ЧЕМПИОНЕ (не на предмете) — тот же приём, что у
//  temp-infamy.mjs: одна возможность активна за раз, новый вызов замещает
//  старый (см. startEyeOfChallenge).
// ════════════════════════════════════════════════════════════════════════

import { woundLossUpdates } from "../rules/wounds.mjs";
import { esc } from "../helpers/utils.mjs";

export const EYE_OF_CHALLENGE_FLAG = "eyeOfChallenge";
export const DEADLINE_SECONDS = 60; // книжная «минута»
// Та же минута, посчитанная Раундами боя (Раунд — 6 секунд, стр. 25). Нужна
// потому, что боевые Раунды в этой системе игровое время НЕ двигают:
// CONFIG.time.roundTime не задан, worldTime меняют только виджет
// «Летоисчисление» и авто-течение. По одному лишь worldTime срок в бою не
// истекал вовсе, а штраф прилетал потом — когда ГМ после боя перематывал
// время на отдых, по уже подлеченному чемпиону (wdbc-6dk).
export const DEADLINE_ROUNDS = DEADLINE_SECONDS / 6;
const PENALTY_FORMULA = "2d10+8";

/** Активная метка вызова актора, или null. */
export function eyeOfChallengeInfo(actor) {
  return actor?.getFlag?.("warhammer-dbc", EYE_OF_CHALLENGE_FLAG) ?? null;
}

/**
 * Запустить срок — новый вызов молча замещает предыдущий (не копится).
 *
 * Записываются ОБА срока: по игровому времени и, если вызов брошен в бою, по
 * Раунду того же боя. Вне боя второго просто нет, и работает первый.
 */
export async function startEyeOfChallenge(actor, { targetUuid, targetName, worldTime, combat = null }) {
  const round = Number(combat?.round);
  await actor.setFlag("warhammer-dbc", EYE_OF_CHALLENGE_FLAG, {
    targetUuid: targetUuid ?? null,
    targetName: targetName ?? "",
    deadlineAt: Number(worldTime) + DEADLINE_SECONDS,
    combatId: combat?.id ?? null,
    deadlineRound: Number.isFinite(round) ? round + DEADLINE_ROUNDS : null
  });
}

/** Вызов брошен вовремя (подтверждение игрока) — снять метку без штрафа. */
export async function clearEyeOfChallenge(actor) {
  if (eyeOfChallengeInfo(actor)) await actor.unsetFlag("warhammer-dbc", EYE_OF_CHALLENGE_FLAG);
}

/**
 * Истёк ли срок ПРЯМО СЕЙЧАС — чистая функция, время и бой приходят снаружи.
 *
 * Второй аргумент принимает и голое число (прежний вызов — только время), и
 * `{ worldTime, combat }`. Срок истёк, если прошла минута игрового времени ИЛИ
 * в ТОМ ЖЕ бою настал Раунд срока: в бою время стоит, а вне боя Раундов нет,
 * поэтому нужны оба — по отдельности каждый молчит ровно там, где считает
 * второй.
 */
export function isEyeOfChallengeExpired(info, at) {
  if (!info) return false;
  const { worldTime, combat } = (typeof at === "object" && at !== null) ? at : { worldTime: at, combat: null };
  if (Number(worldTime) >= Number(info.deadlineAt)) return true;
  const round = Number(combat?.round);
  return info.combatId != null && combat?.id === info.combatId
      && Number.isFinite(round) && Number.isFinite(Number(info.deadlineRound))
      && round >= Number(info.deadlineRound);
}

/**
 * updateWorldTime-хук: минута вышла, вызов не брошен — 2d10+8 непоглощаемого
 * урона в Раны чемпиону (woundLossUpdates — та же арифметика, что у любого
 * другого урона в системе, с уходом в Критические при нехватке Ран).
 */
export async function processEyeOfChallengeDeadline(actor, at) {
  const info = eyeOfChallengeInfo(actor);
  if (!isEyeOfChallengeExpired(info, at)) return;
  await actor.unsetFlag("warhammer-dbc", EYE_OF_CHALLENGE_FLAG);
  const roll = await new Roll(PENALTY_FORMULA).evaluate();
  await actor.update(woundLossUpdates(actor.system, roll.total));
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">Око Вызова — ${esc(actor.name)}</div>
      <div class="roll-threshold">Вызов${info.targetName ? ` «${esc(info.targetName)}»` : ""} не был брошен за минуту (${DEADLINE_ROUNDS} Раундов боя) — <b>${roll.total}</b> непоглощаемого урона в Раны.</div>
    </div>`,
    rolls: [roll]
  }, game.settings.get("core", "rollMode")));
}
