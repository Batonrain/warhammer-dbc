// module/combat/condition-clock.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Часы Состояний (сверка «Статусы», wdbc-x1nz.2.95/.96): всё, что по книге
//  длится минуты и часы, идёт по игровому времени Календаря (решение
//  владельца 2), а не по кнопке «прошло N часов».
//
//  Точка входа одна — хук updateWorldTime (warhammer-dbc.mjs, рядом с
//  sweepSweetMistExpiry/sweepLimbLossGangrene): sweepAllConditionClocks
//  обходит акторов мира и зовёт sweepConditionClock(actor, { from, to }) —
//  from/to в секундах worldTime, отрезок, который только что прошёл.
//
//  Устройство — список обработчиков CONDITION_CLOCK_HANDLERS: каждый сам
//  решает, касается ли его этот актор, и сам наверстывает ВСЕ сработавшие в
//  отрезке моменты (прыжок Календаря на сутки — это несколько тиков
//  Гангрены, а не один). Обработчики независимы: ошибка одного не мешает
//  остальным. Новое часовое правило = новая запись в списке, без правки
//  хука и обхода акторов.
//
//  Двойного срабатывания от кнопок отдыха/сна (они сами сдвигают Календарь,
//  sheets/tabs/conditions.mjs::advanceRestClock) нет: кнопки пишут Усталость
//  и гасят таймер обморока ДО сдвига времени, и этот файл видит уже
//  погашенный таймер.
// ════════════════════════════════════════════════════════════════════════════

import { fatigueChangeFields, announceFatigueChange, conditionApplyFields } from "../sheets/tabs/conditions.mjs";
import { uselessClockStep, SIDE_LABELS } from "../rules/useless-limbs.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";
import { gangreneTick, gangreneIntervalSeconds } from "./gangrene.mjs";
import { haemorrhageHourly, suffocationRestClock } from "./condition-ticks.mjs";

const NS = "warhammer-dbc";

/** Предел тиков одного правила за один сдвиг — страховка от бесконечного цикла. */
const MAX_TICKS = 50;

/**
 * Пробуждение из обморока от Усталости («Статусы»: «теряет сознание на
 * 10–T.b минут… и после прихода в себя снимает 1 Усталости»; «Без
 * Сознания»: «после прихода в себя уменьшает Усталость до T.b+W.b−1»).
 * Момент — conditions.fatigueFaintWakeAt, его ставит fatigueChangeFields.
 */
async function fatigueFaintClock(actor, { to }) {
  const at = Number(actor.system?.conditions?.fatigueFaintWakeAt) || 0;
  if (!at || to < at) return;
  // Уже привели в себя другим путём, а таймер остался — только погасить.
  if (!actor.system?.conditions?.unconscious) {
    await actor.update({ "system.conditions.fatigueFaintWakeAt": 0 });
    return;
  }
  const stored = Math.max(0, Number(actor.system?.fatigue?.value) || 0);
  const res = fatigueChangeFields(actor, stored - 1, { wake: true });
  // Порог 0 (T.b+W.b = 0) — ветка пробуждения не срабатывает сама; таймер
  // всё равно истёк, персонаж очнулся.
  if (!res.woke) Object.assign(res.fields, {
    "system.conditions.unconscious": false, "system.conditions.fatigueFaintWakeAt": 0
  });
  await actor.update(res.fields);
  await announceFatigueChange(actor, { ...res, woke: true });
}

/**
 * Гангрена: «каждые T.b×2 часов он получает 1d10 урона в Т, пока это не
 * убьёт его» — по тику на каждый истёкший интервал отрезка (combat/
 * gangrene.mjs::gangreneTick: тест Т+0 космодесантника, урон, смерть).
 * Отсчёт — flags.warhammer-dbc.gangreneTestAt (ставится при наложении,
 * sheets/tabs/conditions.mjs::conditionApplyFields, и сдвигается кнопкой).
 * Нет метки (Гангрену поставили в обход единой точки) — отсчёт с начала
 * отрезка.
 *
 * При T.b = 0 интервал — 1 час (gangreneIntervalSeconds: книга вырождается
 * в «каждые 0 часов»); MAX_TICKS только страхует цикл.
 */
async function gangreneClock(actor, { from, to }) {
  if (!actor.system?.conditions?.gangrene) return;
  let testAt = Number(actor.getFlag?.(NS, "gangreneTestAt"));
  if (!Number.isFinite(testAt) || actor.getFlag?.(NS, "gangreneTestAt") == null) {
    testAt = from;
    await actor.update({ [`flags.${NS}.gangreneTestAt`]: from });
  }
  for (let i = 0; i < MAX_TICKS; i++) {
    if (!actor.system?.conditions?.gangrene || actor.getFlag?.(NS, "deceased")) return;
    const due = testAt + gangreneIntervalSeconds(actor.system?.characteristics?.t?.bonus);
    if (due > to) return;
    const res = await gangreneTick(actor, { at: due });
    testAt = due;
    if (res?.healed || res?.died || res?.skipped) return;
  }
}

/**
 * Бесполезные Конечности (wdbc-x1nz.2.99): без помощи 2×T.b часов —
 * перманентно; срок в лубке (2d10−T.b суток) вышел — конечность в строю;
 * перманентная через T.b дней — бросок Гангрены (1-7 на 1d10 без помощи,
 * 1-6 после проваленных попыток). Вся арифметика — rules/useless-limbs.mjs.
 */
async function uselessLimbsClock(actor, { to }) {
  const tb = Number(actor.system?.characteristics?.t?.bonus) || 0;
  const { patch, events } = uselessClockStep(actor.system, { to, tb });
  if (!events.length) return;
  const lines = [];
  const rolls = [];
  for (const ev of events) {
    const side = SIDE_LABELS[ev.side];
    if (ev.kind === "noAid") {
      lines.push(`<b>${side}</b>: медпомощи не было 2×T.b ч. — конечность <span class="roll-failure">перманентно бесполезна</span>. Нужна ампутация, иначе через T.b дн. возможна Гангрена.`);
    } else if (ev.kind === "healed") {
      lines.push(`<b>${side}</b>: срок в лубке вышел — <span class="roll-success">конечность снова в строю</span>.`);
    } else if (ev.kind === "gangreneDue") {
      const roll = await new Roll("1d10").evaluate();
      rolls.push(roll);
      const gangrene = roll.total * 10 <= ev.chance;
      if (gangrene) Object.assign(patch, conditionApplyFields("gangrene", null, actor));
      lines.push(`<b>${side}</b>: не ампутирована — проверка Гангрены (${ev.chance}%, 1-${ev.chance / 10} на 1d10): бросок <b>${roll.total}</b> — ${gangrene
        ? `<span class="roll-failure">загноилась, наложена Гангрена</span>`
        : `<span class="roll-success">обошлось</span>`}.`);
    }
  }
  await actor.update(patch);
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("warn", "#d9a066")}${esc(actor.name)} — Бесполезная конечность</div>
      <div class="roll-threshold">${lines.join("<br/>")}</div>
    </div>`,
    rolls,
    sound: rolls.length ? CONFIG.sounds.dice : null
  }, game.settings.get("core", "rollMode")));
}

/**
 * Обработчики часов Состояний, по порядку. { id, run(actor, { from, to }) }.
 *
 * Порядок значим: пробуждение из обморока идёт раньше урона Гангрены —
 * иначе смерть от Гангрены в том же отрезке оставила бы мёртвого «в
 * обмороке» с таймером.
 */
export const CONDITION_CLOCK_HANDLERS = [
  { id: "fatigueFaint", run: fatigueFaintClock },
  { id: "gangrene",     run: gangreneClock },
  // Обескровливание: «снимает с себя 1 Обескровливания в час» (wdbc-x1nz.2.92)
  // и пробуждение, когда уровень сошёл до предела — combat/condition-ticks.mjs.
  { id: "haemorrhage",  run: haemorrhageHourly },
  // Удушье в покое: T.b минут, тест T+0 раз в минуту, без сознания — смерть
  // через T.b Раундов (wdbc-x1nz.2.94) — combat/condition-ticks.mjs.
  { id: "suffocationRest", run: suffocationRestClock },
  // Бесполезные Конечности: 2×T.b ч без помощи, лубок, Гангрена (wdbc-x1nz.2.99).
  { id: "uselessLimbs", run: uselessLimbsClock },
];

/**
 * Прогнать часы Состояний одного актора за отрезок игрового времени.
 * Отрезок пустой или назад (Календарь откатили) — ничего не делается:
 * откат не отменяет уже случившегося.
 * @param {Actor} actor
 * @param {{from: number, to: number}} span worldTime в секундах
 */
export async function sweepConditionClock(actor, { from, to } = {}) {
  if (!actor || !(Number(to) > Number(from))) return;
  // Мёртвому часы Состояний не идут: он не просыпается и не гниёт дальше.
  if (actor.getFlag?.(NS, "deceased")) return;
  for (const handler of CONDITION_CLOCK_HANDLERS) {
    try {
      await handler.run(actor, { from: Number(from), to: Number(to) });
    } catch (err) {
      console.error(`warhammer-dbc | часы Состояний «${handler.id}» — ${actor.name}:`, err);
    }
  }
}

/**
 * Обход акторов мира по хуку updateWorldTime (worldTime, dt). GM-гейт — тот
 * же приём, что apps/wrapped-in-chaos.mjs::sweepSweetMistExpiry: считает
 * только основной активный ГМ, не каждый подключённый клиент.
 */
export async function sweepAllConditionClocks(worldTime, dt) {
  if (!game.users?.activeGM || game.user?.id !== game.users.activeGM.id) return;
  const to = Number(worldTime);
  const from = to - (Number(dt) || 0);
  for (const actor of game.actors ?? []) await sweepConditionClock(actor, { from, to });
}
