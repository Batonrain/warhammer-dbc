// module/combat/demon-destabilize.mjs
// ════════════════════════════════════════════════════════════════════════
//  Дестабилизация формы демона — Foundry-обвязка над чистой арифметикой
//  module/rules/demon-destabilize.mjs (wdbc-1rno, Рыцарь Бога и общие Формы
//  Призыва, корбук «VI. МИСТИКА → РИТУАЛЫ»).
//
//  «Пока Хозяин едет верхом — демон стабилизируется, отсчёт дестабилизации
//  временно прекращается»: не настоящая пауза (Foundry не хранит «время
//  стояло»), а тот же приём, что у любого worldTime-тика — при каждом тике,
//  пока Хозяин верхом, срок сдвигается вперёд ровно на прошедшее dt, так что
//  для дестабилизации оно как будто не проходило вовсе.
//
//  Истечение срока НЕ удаляет актора само — необратимое действие остаётся
//  ГМу: карточка в чат, видимая только ему, с кнопкой «Удалить актора»
//  (module/hooks.mjs — клик снимает подтверждение и делает Actor.delete).
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { destabilizeRungSeconds } from "../rules/demon-destabilize.mjs";
import { SECONDS_PER_ROUND } from "../rules/condition-duration.mjs";

export const DESTABILIZE_FLAG = "destabilize";

/**
 * Кто-то из акторов игры сейчас едет верхом на этом демоне? Ссылку хранит
 * ВСАДНИК (module/rules/mount.mjs) — здесь конкретно спрашиваем про ЕГО ЖЕ
 * Хозяина (system.masterUuid), не про любого другого седока.
 */
export function isRiddenByMaster(demonActor) {
  const masterUuid = demonActor?.system?.masterUuid;
  if (!masterUuid || !demonActor?.uuid) return false;
  const master = (game.actors ?? []).find(a => a?.uuid === masterUuid);
  return !!master && master.system?.mount?.uuid === demonActor.uuid;
}

/**
 * Запустить срок дестабилизации. `durationSeconds` — уже готовое число из
 * destabilizeDurationSeconds (module/rules/demon-destabilize.mjs); null —
 * «Неограниченно» (Завеса истончена до предела) — флаг снимается/не ставится,
 * тикать нечему.
 */
export async function startDestabilizeCountdown(actor, worldTime, durationSeconds,
                                                { veilTotal = 0, combat = null } = {}) {
  if (durationSeconds == null) {
    if (actor?.getFlag?.("warhammer-dbc", DESTABILIZE_FLAG)) await actor.unsetFlag("warhammer-dbc", DESTABILIZE_FLAG);
    return;
  }
  // Записываются ОБА срока — тот же приём и та же причина, что у Ока Вызова
  // (combat/eye-of-challenge.mjs, wdbc-6dk): при Завесе ниже единицы книжный
  // срок меряется РАУНДАМИ, а боевые Раунды в этой системе игровое время не
  // двигают (CONFIG.time.roundTime не задан, worldTime меняют только виджет
  // «Летоисчисление» и авто-течение). По одному worldTime срок в бою не
  // истекал бы вовсе, а карточка «демон должен быть изгнан» прилетала бы ГМу
  // потом — когда он после боя перематывает время на отдых, по бою, которого
  // уже нет. На ступенях Минуты и выше второго срока нет и не нужно: те
  // единицы worldTime и правда двигают.
  const roundsRung = destabilizeRungSeconds(veilTotal) === SECONDS_PER_ROUND;
  const round = Number(combat?.round);
  await actor.setFlag("warhammer-dbc", DESTABILIZE_FLAG, {
    deadlineAt: Number(worldTime) + Number(durationSeconds),
    combatId: roundsRung && combat?.id ? combat.id : null,
    deadlineRound: roundsRung && Number.isFinite(round)
      ? round + Math.ceil(Number(durationSeconds) / SECONDS_PER_ROUND)
      : null
  });
}

/**
 * updateWorldTime-тик (module/hooks.mjs): демон без метки — не наш случай.
 * Хозяин сейчас верхом — срок отодвигается на dt (эффект «паузы»). Иначе,
 * если время вышло, — ГМу персональная карточка с кнопкой удаления (само
 * удаление не автоматическое, см. заголовок файла).
 */
export async function processDestabilizeTick(actor, worldTime, dt, combat = null) {
  const info = actor?.getFlag?.("warhammer-dbc", DESTABILIZE_FLAG);
  if (!info) return;
  if (isRiddenByMaster(actor)) {
    // Сдвигается только срок по времени: Раунды при езде верхом и так не
    // идут для этого демона — Хозяин в седле, а не в бою против него.
    await actor.setFlag("warhammer-dbc", DESTABILIZE_FLAG, {
      ...info, deadlineAt: Number(info.deadlineAt) + (Number(dt) || 0)
    });
    return;
  }
  // Истёк, если прошло игровое время ИЛИ в ТОМ ЖЕ бою настал Раунд срока: в
  // бою время стоит, а вне боя Раундов нет, поэтому нужны оба — по отдельности
  // каждый молчит ровно там, где считает второй (см. startDestabilizeCountdown).
  const round = Number(combat?.round);
  const byRound = info.combatId && combat?.id === info.combatId
                  && Number.isFinite(round) && Number.isFinite(Number(info.deadlineRound))
                  && round >= Number(info.deadlineRound);
  if (!byRound && Number(worldTime) < Number(info.deadlineAt)) return;
  await actor.unsetFlag("warhammer-dbc", DESTABILIZE_FLAG);
  await ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients?.("GM") || [],
    content: `<div class="wh-roll-result">
      <div class="roll-header">Дестабилизация формы — ${esc(actor.name)}</div>
      <div class="roll-threshold">Срок манифестации истёк — демон должен быть изгнан обратно в Варп.</div>
      <button type="button" class="wh-destabilize-delete-btn" data-actor-uuid="${esc(actor.uuid)}">Удалить актора</button>
    </div>`
  });
}
