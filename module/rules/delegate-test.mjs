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
 *
 * `extra` (wdbc-uez7, раскатка на обычные тесты Навыка/Характеристики) —
 * плоский объект ПРИМИТИВОВ (не документов), который openDelegatedTest
 * отдаёт opener'у как есть: для Лечения он не нужен (весь контекст — это сам
 * пациент), а для обычного теста именно тут едут skillKey/charKey/label —
 * без них исполнитель не знает, какой диалог открывать. Приходится через
 * ChatMessage (JSON), поэтому НИКАКИХ документов/функций внутри — только
 * строки/числа/booleans.
 */
export async function requestDelegatedTest({ requesterActor, executorActor, effectTargetActor, kind, label, buttonLabel, extra = {} }) {
  const owner = activeOwnerOf(executorActor);
  if (!owner) {
    ui.notifications?.warn(`У «${executorActor?.name ?? "исполнителя"}» нет активного игрока-владельца — попросите ГМа выполнить тест вручную.`);
    return false;
  }
  const payload = { kind, targetActorUuid: effectTargetActor.uuid, requesterActorUuid: requesterActor?.uuid ?? null, ...extra };
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

/** @param {(executorActor:object, effectTargetActor:object, payload:object) => void|Promise<void>} openFn
 *  payload — весь пришедший объект (kind/targetActorUuid/requesterActorUuid + extra) — opener читает
 *  из него то, что сам туда положил через requestDelegatedTest's extra. */
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
  await opener(executorActor, effectTargetActor, payload);
}

/**
 * Открывает диалог теста НАПРЯМУЮ, без карточки в чате — для исполнителя без
 * активного игрока-владельца (NPC ГМа и подобное, wdbc-mhds): спрашивать
 * там некого, а сам ГМ (или кто угодно с правами на этого актора) обычно уже
 * за столом. payload по форме идентичен тому, что openDelegatedTest строит
 * из пришедшего по чату сообщения (kind/targetActorUuid/requesterActorUuid +
 * extra) — опенеры (hooks.mjs) от источника payload не зависят вовсе.
 */
export async function openDelegatedTestDirect(kind, executorActor, effectTargetActor, extra = {}) {
  const opener = OPENERS.get(kind);
  if (!opener) return console.warn(`Warhammer DBC | Делегированный тест: неизвестный kind «${kind}».`);
  const payload = { kind, targetActorUuid: effectTargetActor?.uuid ?? null, requesterActorUuid: null, ...extra };
  await opener(executorActor, effectTargetActor, payload);
}

/**
 * Ждёт, пока пользователь укажет исполнителя нацеливанием — тем же способом,
 * каким цель выбирается везде в системе (T на наведённом токене, стр. атак),
 * а не своим обработчиком клика по токенам (wdbc-mhds: держаться одного
 * способа targeting на всю игру). Второй путь — клик по заголовку уже
 * открытого окна листа актора (foundry.applications.sheets.ActorSheetV2,
 * см. .window.header — ядро вешает pointerdown для драга, не click, конфликта
 * нет; .header-control — кнопки закрытия/сворачивания/меню в шапке (реальный
 * класс Foundry v13, application.mjs — не .header-button) — игнорируются,
 * иначе клик по «✕» во время ожидания и закрывал бы лист, и выбирал бы его
 * актора исполнителем одновременно; поймано живым тестом 2026-09-03.
 * Esc отменяет. Первый сработавший источник резолвит и снимает оба слушателя.
 */
export function pickDelegateActor(effectTargetActor, openSheets) {
  return new Promise(resolve => {
    let done = false;
    const sheetHandlers = [];
    const cleanup = () => {
      Hooks.off("targetToken", onTarget);
      document.removeEventListener("keydown", onKey);
      for (const { header, fn } of sheetHandlers) header.removeEventListener("click", fn);
    };
    const finish = actor => {
      if (done) return;
      done = true;
      cleanup();
      resolve(actor ?? null);
    };
    const onTarget = (user, token, targeted) => {
      if (user !== game.user || !targeted) return;
      finish(token?.actor ?? null);
    };
    const onKey = ev => { if (ev.key === "Escape") finish(null); };
    Hooks.on("targetToken", onTarget);
    document.addEventListener("keydown", onKey);
    for (const app of openSheets()) {
      const header = app?.window?.header;
      if (!header || !app.actor || app.actor.id === effectTargetActor?.id) continue;
      const fn = ev => {
        if (ev.target.closest(".header-control")) return;
        finish(app.actor);
      };
      header.addEventListener("click", fn);
      sheetHandlers.push({ header, fn });
    }
    ui.notifications?.info("Наведите курсор на токен сцены и нажмите T, или кликните заголовок открытого листа актора — Esc для отмены.");
  });
}

/**
 * Выбор исполнителя нацеливанием (wdbc-mhds) вместо списка кандидатов: уже
 * есть таргет сцены — берём его сразу (тот же приём, что у авто-встречного
 * теста, wdbc-j814), иначе ждём через pickDelegateActor. Исполнитель без
 * активного владельца (NPC) — тест открывается СРАЗУ локально
 * (openDelegatedTestDirect), спрашивать через чат некого; с владельцем — как
 * раньше, шёпот через requestDelegatedTest.
 */
export async function showDelegateTestPicker(effectTargetActor, {
  kind = "healing", label, buttonLabel, extra = {},
  openSheets = () => [...foundry.applications.sheets.ActorSheetV2.instances()]
} = {}) {
  const already = [...(game.user?.targets ?? [])][0]?.actor ?? null;
  const picked = (already && already.id !== effectTargetActor?.id) ? already : await pickDelegateActor(effectTargetActor, openSheets);
  if (!picked) return;
  if (activeOwnerOf(picked)) {
    await requestDelegatedTest({
      requesterActor: effectTargetActor, executorActor: picked, effectTargetActor, kind, label, buttonLabel, extra
    });
  } else {
    await openDelegatedTestDirect(kind, picked, effectTargetActor, extra);
  }
}
