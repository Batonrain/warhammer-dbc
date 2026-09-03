// module/rules/delegate-test.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Делегирование теста другому игроку (wdbc-uez7/wdbc-j814, вариант A —
//  карточка в чат с кнопкой, не живой сокет-пуш). Три роли, которые здесь
//  различаются по имени явно (спутать их — сломать всю схему):
//    - requesterActor  — кто просит (обычно сам effectTargetActor, но не
//      обязательно — ГМ или третий игрок тоже может попросить за кого-то);
//    - executorActor   — кто ФАКТИЧЕСКИ бросает кубик, своим листом и своими
//      модификаторами (снаряжение/Таланты уже в его skill.total);
//    - effectTargetActor — на кого ложится эффект теста, и чьи собственные
//      Таланты/Черты могут поднимать или снижать Порог ЭТОГО теста (см.
//      healing.mjs::patientHealingMod, resolve-test.mjs — суффикс области
//      ":recipient"). При Лечении это пациент; при Инфограждении — владелец
//      снаряжения. requesterActor и effectTargetActor чаще всего один и тот
//      же актор («полечи МЕНЯ»), но не всегда (ГМ просит за NPC).
//
//  Доставка — обычный ChatMessage с шёпотом владельцу executorActor и кнопкой
//  в карточке (тот же принцип «сообщение уходит всем, реагирует только
//  адресат», что уже отработан у action:"characterStarted",
//  warhammer-dbc.mjs) — никакой новой сокет-инфраструктуры не заводится.
//
//  Кто открывает диалог по клику — решает реестр OPENERS (заполняется по kind
//  в hooks.mjs при инициализации): здесь только доставка запроса и разбор
//  ответа, сама механика теста (Лечение, позже Инфограждение и т.п.) не знает
//  про делегирование вовсе, кроме опционального параметра «принудительная
//  цель», который уже принимает (healing.mjs::showHealingDialog forcedPatient).
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";

const NS = "warhammer-dbc";

/** Активный игрок-владелец актора (не ГМ) — тот, чей клиент должен открыть диалог. */
export function activeOwnerOf(actor) {
  if (!actor) return null;
  return game.users?.players?.find(u => u.active && actor.testUserPermission?.(u, "OWNER")) ?? null;
}

/**
 * Актор, за которого сейчас, скорее всего, действует ЭТОТ клиент — назначенный
 * персонаж (стандартное поле Foundry), иначе актор выбранного на сцене токена.
 * Не гадаем дальше: пусто — пусть откроют диалог вручную со своего листа.
 */
export function myLikelyActor() {
  return game.user?.character ?? canvas?.tokens?.controlled?.[0]?.actor ?? null;
}

/**
 * Просит владельца executorActor открыть у себя диалог теста kind, уже
 * нацеленного на effectTargetActor. Без активного игрока-владельца у
 * исполнителя — предупреждение и false: автоброска за NPC силами ГМа здесь
 * нет (отдельный путь, wdbc-j814 п.1, ещё не реализован).
 */
export async function requestDelegatedTest({ requesterActor, executorActor, effectTargetActor, kind, label, buttonLabel }) {
  const owner = activeOwnerOf(executorActor);
  if (!owner) {
    ui.notifications?.warn(`У «${executorActor?.name ?? "исполнителя"}» нет активного игрока-владельца — попросите ГМа выполнить тест вручную.`);
    return false;
  }
  const payload = { kind, targetActorUuid: effectTargetActor.uuid, requesterActorUuid: requesterActor?.uuid ?? null };
  const content = `
    <div class="wh-roll-result delegated-test-card">
      <div class="roll-header">📨 Запрос теста${label ? `: ${esc(label)}` : ""}</div>
      <div class="roll-threshold">${esc(requesterActor?.name ?? "Кто-то")} просит вас выполнить тест за <b>${esc(effectTargetActor.name)}</b> — Порог и последствия останутся привязаны к ней/нему, бросаете своим листом.</div>
      <button type="button" class="delegated-test-open" data-payload="${esc(JSON.stringify(payload))}">${esc(buttonLabel ?? "Открыть тест")}</button>
    </div>`;
  await ChatMessage.create({
    whisper: [owner.id, ...(game.users?.filter(u => u.isGM).map(u => u.id) ?? [])],
    speaker: ChatMessage.getSpeaker({ actor: requesterActor ?? effectTargetActor }),
    content,
    flags: { [NS]: { delegatedTest: payload } }
  });
  return true;
}

/** Реестр «kind → как открыть диалог теста» — заполняется в hooks.mjs при инициализации. */
const OPENERS = new Map();

/** @param {(executorActor:object, effectTargetActor:object) => void|Promise<void>} openFn */
export function registerDelegatedTestOpener(kind, openFn) {
  OPENERS.set(kind, openFn);
}

/** Клик по кнопке карточки — открывает диалог у адресата с преднастроенной целью. */
export async function openDelegatedTest(payload) {
  const opener = OPENERS.get(payload?.kind);
  if (!opener) return console.warn(`Warhammer DBC | Делегированный тест: неизвестный kind «${payload?.kind}».`);
  const effectTargetActor = payload.targetActorUuid ? await fromUuid(payload.targetActorUuid).catch(() => null) : null;
  if (!effectTargetActor) return ui.notifications?.warn("Цель запрошенного теста не найдена (удалена?).");
  const executorActor = myLikelyActor();
  if (!executorActor) return ui.notifications?.warn("Нет назначенного персонажа/выбранного токена — откройте диалог вручную со своего листа и укажите цель сами.");
  await opener(executorActor, effectTargetActor);
}

/**
 * Диалог выбора исполнителя: список акторов с активным игроком-владельцем,
 * кроме самого effectTargetActor (нельзя поручить тест самой цели — это
 * просто обычный, не делегированный тест). Пусто — предупреждение вместо
 * пустого диалога.
 */
export async function showDelegateTestPicker(effectTargetActor, { title = "Запросить тест", kind = "healing", label, buttonLabel } = {}) {
  const candidates = (game.actors ?? []).filter(a => a.id !== effectTargetActor?.id && a.hasPlayerOwner && activeOwnerOf(a));
  if (!candidates.length) {
    ui.notifications?.warn("Нет других акторов с активным игроком-владельцем, кому можно поручить тест.");
    return;
  }
  const options = candidates.map(a => `<option value="${a.uuid}">${esc(a.name)} (${esc(activeOwnerOf(a)?.name ?? "?")})</option>`).join("");
  const content = `
    <div class="wh-wizard-form" style="padding:6px;">
      <div class="atk-dlg-row"><label>Кто выполнит тест:</label><select id="delegate-executor">${options}</select></div>
    </div>`;
  await foundry.applications.api.DialogV2.wait({
    window: { title },
    classes: ["wh-attack-dialog", "warhammer-dbc"],
    content,
    rejectClose: false,
    buttons: [
      {
        action: "go", label: "Отправить запрос", icon: "fas fa-paper-plane", default: true,
        callback: async (event, button) => {
          const uuid = button.form.querySelector("#delegate-executor")?.value;
          const executorActor = uuid ? await fromUuid(uuid).catch(() => null) : null;
          if (!executorActor) return;
          await requestDelegatedTest({
            requesterActor: effectTargetActor, executorActor, effectTargetActor, kind, label, buttonLabel
          });
        }
      },
      { action: "cancel", label: "Отмена" }
    ]
  });
}
