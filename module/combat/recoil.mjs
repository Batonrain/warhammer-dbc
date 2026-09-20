// module/combat/recoil.mjs
// ════════════════════════════════════════════════════════════════════════
//  «Отскок» (стр. 12, wdbc-9wvm) — UI-половина: диалог выбора метров/Укрытия,
//  открываемый кнопкой на карточке успешного Уклонения от стрелковой атаки
//  (module/combat/defense.mjs::_performDodge, только !isMelee), и чат-
//  карточка исхода. Данные (пул/лимит) — recoil-pool.mjs, эта пара файлов —
//  то же разделение, что evasion-pool.mjs (данные+карточка в одном файле там,
//  потому что там нет отдельного диалога выбора) и showSkidDialog/mount.mjs
//  (диалог+карточка вместе, когда диалог есть).
//
//  Отскок «вне предела атаки» и «в Укрытие» — оба буквально то, что решает
//  игрок за столом (площадь карты в проекте не отслеживается вовсе — см.
//  module/rules/aoe-target.mjs, module/combat/resplendent-raiment.mjs про
//  тот же honest-compromise): диалог не проверяет геометрию, а просто
//  спрашивает, куда персонаж отскочил, и списывает метры из пула.
//
//  «Отскок из рукопашной считается как Вольт» (п.6 правила, wdbc-zik7,
//  обновлено wdbc-x1nz.2.40): при первом чтении (wdbc-zik7, PR #339)
//  отдельного действия «Вольт» со своим тестом в системе ещё не было, и по
//  сверке с пользователем ближайшим аналогом было выбрано безусловное
//  flags.warhammer-dbc.disengageActive («Выход из Боя»). Тем же сеансом, где
//  появился настоящий Вольт с тестом Acrobatics vs WS (movement-actions.mjs::
//  declareVault, wdbc-x1nz.2.37), пользователь явно решил перевести и это
//  место на него — см. movement-actions.mjs::rollRecoilVault (тот же тест,
//  без своей цены ОД, уже оплаченной состоявшимся Уклонением). Соседство
//  нескольких противников по карте код не отслеживает вовсе (тот же honest-
//  compromise, что у geometry выше) — showRecoilDialog только детектит САМ
//  ФАКТ рукопашного контакта через free-attack.mjs::enemyContactTokenDocs
//  (как suggestedAp детектит Укрытие), а решение «пытался ли враг тоже
//  Избегать» (книжное исключение, при котором Вольт вообще не нужен) —
//  ручной чекбокс, подтверждаемый игроком/ГМом за столом.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, outcomeHtml } from "../helpers/test-card.mjs";
import { spdMeters, recoilRemaining, spendRecoil } from "./recoil-pool.mjs";
import { coverApForToken } from "./cover.mjs";
import { spendPoolForRecoil } from "./evasion-pool.mjs";
import { coverApImperativeAdjust } from "./imperative-bonuses.mjs";
import { enemyContactTokenDocs } from "./free-attack.mjs";
import { rollRecoilVault } from "./movement-actions.mjs";

/** Цена входа в Отскок из банка Успехов (Voltagheist Blast, wdbc-16ss). */
export const POOL_RECOIL_COST = 2;

/**
 * Кнопка «Отскочить», приклеиваемая к карточке успешного Уклонения от
 * стрелковой атаки — только УСПЕХ и !isMelee зовут её (см. defense.mjs).
 */
export function recoilButtonHtml(actor) {
  const remaining = recoilRemaining(actor);
  const remLabel = Number.isFinite(remaining) ? `${remaining}` : "∞ (вне боя)";
  return `
    <div class="roll-defense-section">
      <button class="wh-recoil-btn" type="button" data-actor-uuid="${actor.uuid}">
        ${rollIcon("run")}Отскочить (вместо нивеляции) — остаток ${remLabel}м в этом Раунде
      </button>
    </div>`;
}

/**
 * Токен актора на текущей сцене, если есть — для авто-подстановки AP Укрытия.
 * getActiveTokens(), не поиск по t.actor?.uuid (найдено live-тестом): у
 * непривязанного токена (без «Синхронизировать с актором») t.actor — синтетик
 * со своим UUID вида Scene.…Token.…Actor.…, который никогда не равен
 * actor.uuid базового мирового актора — сравнение молча не находило токен, и
 * подсказка AP Укрытия оставалась 0/снятой даже когда цель реально стояла в
 * зоне. getActiveTokens() у Foundry сам разрешает и привязанные, и нет.
 */
function tokenFor(actor) {
  return actor?.getActiveTokens?.()?.[0] ?? null;
}

/**
 * Есть ли у актора СЕЙЧАС враг личного масштаба в Базовом/Глубоком контакте
 * (module/combat/free-attack.mjs) — только для того, чтобы решить, предлагать
 * ли чекбокс Вольта вообще: без токена на сцене (вне боя/тестами) контакт не
 * определить, чекбокс просто не показывается, как и suggestedAp Укрытия выше.
 */
function actorInMeleeContact(actor) {
  const token = tokenFor(actor);
  if (!token) return false;
  return enemyContactTokenDocs(token.document).length > 0;
}

/**
 * Диалог выбора метров/Укрытия (+ Вольт, если сейчас рукопашный контакт).
 * Возвращает null при отмене.
 * @returns {Promise<{meters:number, intoCover:boolean, coverAp:number, volt:boolean}|null>}
 */
export async function showRecoilDialog(actor) {
  const remaining = recoilRemaining(actor);
  if (remaining <= 0) {
    ui.notifications?.warn("⚠️ Дистанция Отскока в этом Раунде исчерпана.");
    return null;
  }
  const spd = spdMeters(actor);
  const defaultMeters = Math.min(spd || 1, Number.isFinite(remaining) ? remaining : (spd || 1));
  const token = tokenFor(actor);
  // Императив Крепости/Избегания (wdbc-yu32) может усилить/ослабить AP
  // укрытия для ЭТОГО актора — клапан «не более чем вдвое/×2» считается от
  // базового AP зоны, не от уже применённого. Поле всё равно редактируемое.
  const suggestedAp = token ? coverApImperativeAdjust(actor, coverApForToken(token)) : 0;
  const meleeContact = actorInMeleeContact(actor);

  const voltRow = meleeContact ? `
        <div class="roll-dlg-row"><label>Вольт (никто из соседних врагов не пытался тоже Избегать):</label>
          <input type="checkbox" name="volt">
        </div>
        <div class="roll-dlg-note">п.6, стр. 12: Отскок из рукопашной гасит Свободную Атаку соседних врагов (как «Выход из Боя»), только если ни один из них тоже не пытался Избегать этой же атаки.</div>` : "";

  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: `Отскок — ${actor.name}` },
    classes: ["wh-roll-dialog-window"],
    position: { width: 340 },
    content: `
      <div class="wh-skill-roll-form">
        <div class="roll-dlg-header"><span>Отскок — ${esc(actor.name)}</span></div>
        <div class="roll-dlg-row"><label>Дистанция (м, до ${Number.isFinite(remaining) ? remaining : spd}):</label>
          <input type="number" name="meters" value="${defaultMeters}" min="0" ${Number.isFinite(remaining) ? `max="${remaining}"` : ""} step="1">
        </div>
        <div class="roll-dlg-row"><label>Отскочил в Укрытие:</label>
          <input type="checkbox" name="intoCover" ${suggestedAp > 0 ? "checked" : ""}>
        </div>
        <div class="roll-dlg-row"><label>AP Укрытия:</label>
          <input type="number" name="coverAp" value="${suggestedAp}" min="0" step="1">
        </div>
        <div class="roll-dlg-note">Не в Укрытие — все попадания этой атаки промахиваются (вне предела атаки, стр. 12). В Укрытие — попадания проходят с доп. AP.</div>
        ${voltRow}
      </div>`,
    buttons: [
      {
        action: "recoil", icon: "fas fa-person-running", label: "Отскочить!", default: true,
        callback: (event, button) => {
          const form = button.form;
          return {
            meters: Math.max(0, parseInt(form.querySelector('[name="meters"]')?.value) || 0),
            intoCover: !!form.querySelector('[name="intoCover"]')?.checked,
            coverAp: Math.max(0, parseInt(form.querySelector('[name="coverAp"]')?.value) || 0),
            volt: meleeContact && !!form.querySelector('[name="volt"]')?.checked
          };
        }
      },
      { action: "cancel", label: "Отмена", callback: () => null }
    ],
    rejectClose: false
  });
  return result ?? null;
}

/**
 * Списывает дистанцию из пула, ставит разовый флаг AP Укрытия (если
 * применимо), при volt — запускает настоящий встречный тест Вольта
 * (movement-actions.mjs::rollRecoilVault, wdbc-x1nz.2.40: раньше здесь стоял
 * безусловный flags.warhammer-dbc.disengageActive, тот же исход, что у
 * «Выхода из Боя», без теста) отдельной карточкой следом, и постит исход
 * самого Отскока в чат. Зовётся из клика по wh-recoil-btn после
 * подтверждения showRecoilDialog.
 */
export async function performRecoil(actor, { meters, intoCover, coverAp, volt = false } = {}) {
  const spent = await spendRecoil(actor, meters);
  if (intoCover && coverAp > 0) {
    await actor.setFlag("warhammer-dbc", "recoilCoverBonus", coverAp);
  }
  const remaining = recoilRemaining(actor);
  const remLabel = Number.isFinite(remaining) ? `, остаток ${remaining}м в этом Раунде` : "";

  const outcome = outcomeHtml(true, intoCover
    ? `Отскочил на ${spent}м в Укрытие — попадания проходят, но со +${coverAp} AP (учтётся при следующем применении урона).`
    : `Отскочил на ${spent}м вне предела атаки — все попадания промахиваются.`);
  const voltNote = volt
    ? `<div class="roll-defense-note">Засчитан как Вольт (п.6) — встречный тест против соседних врагов следует отдельной карточкой.</div>` : "";

  await postTestCard(actor, {
    icon: rollIcon("run"), title: `Отскок — ${esc(actor.name)}`,
    outcome,
    sections: [
      `<div class="roll-defense-note">Потрачено ${spent}м из дистанции Отскока${remLabel}.</div>`,
      voltNote
    ]
  }, { sound: false });

  if (volt) await rollRecoilVault(actor);
}

/**
 * Voltagheist Blast (wdbc-16ss): открывает Отскок за счёт банка Успехов
 * Уклонения (module/combat/evasion-pool.mjs) вместо свежего Уклонения от
 * ЭТОЙ атаки — зовётся из клика по wh-pool-recoil-btn (кнопка приклеена рядом
 * с обычным «Пул Избегания» на карточке атаки, см. attack-card.mjs::
 * defenseSection). Стоимость (POOL_RECOIL_COST Успехов) списывается ДО показа
 * диалога метров: отмена диалога Успехи не возвращает — тот же компромисс,
 * что у Контратаки (hooks.mjs) и прочих трат-до-подтверждения кнопок.
 */
export async function performPoolRecoil(actor, attackerUuid) {
  if (recoilRemaining(actor) <= 0) {
    ui.notifications?.warn("⚠️ Дистанция Отскока в этом Раунде исчерпана.");
    return;
  }
  const spent = await spendPoolForRecoil(actor, attackerUuid, POOL_RECOIL_COST);
  if (!spent) {
    // Карточка отказа без шапки — вид сохранён: общий сборщик рисует шапку
    // всегда, поэтому здесь она заведена явно пустой (icon/title не заданы).
    await postTestCard(actor, {
      outcome: outcomeHtml(false, `${rollIcon("ban","#ff6b6b")}В банке недостаточно Успехов на Отскок (нужно ${POOL_RECOIL_COST}) или он устарел.`)
    }, { sound: false });
    return;
  }
  const choice = await showRecoilDialog(actor);
  if (!choice) return;
  await performRecoil(actor, choice);
}
