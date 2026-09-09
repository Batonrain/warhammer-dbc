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
export async function startDestabilizeCountdown(actor, worldTime, durationSeconds) {
  if (durationSeconds == null) {
    if (actor?.getFlag?.("warhammer-dbc", DESTABILIZE_FLAG)) await actor.unsetFlag("warhammer-dbc", DESTABILIZE_FLAG);
    return;
  }
  await actor.setFlag("warhammer-dbc", DESTABILIZE_FLAG, { deadlineAt: Number(worldTime) + Number(durationSeconds) });
}

/**
 * updateWorldTime-тик (module/hooks.mjs): демон без метки — не наш случай.
 * Хозяин сейчас верхом — срок отодвигается на dt (эффект «паузы»). Иначе,
 * если время вышло, — ГМу персональная карточка с кнопкой удаления (само
 * удаление не автоматическое, см. заголовок файла).
 */
export async function processDestabilizeTick(actor, worldTime, dt) {
  const info = actor?.getFlag?.("warhammer-dbc", DESTABILIZE_FLAG);
  if (!info) return;
  if (isRiddenByMaster(actor)) {
    await actor.setFlag("warhammer-dbc", DESTABILIZE_FLAG, { deadlineAt: Number(info.deadlineAt) + (Number(dt) || 0) });
    return;
  }
  if (Number(worldTime) < Number(info.deadlineAt)) return;
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
