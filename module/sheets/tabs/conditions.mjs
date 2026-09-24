// module/sheets/tabs/conditions.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Состояния и Усталость: кнопки +1/−1, отдых, сон и диалог добавления
//  состояний. Функции принимают актора, а не лист.
// ════════════════════════════════════════════════════════════════════════════

// Из constants/conditions.mjs (не sheet-helpers.mjs, wdbc-fejd) — этот файл
// теперь импортируют apps/combat-модули (единая точка наложения/снятия), а
// sheet-helpers.mjs тянет за собой тяжёлые модули листа (race-library.mjs и
// т.п.) с побочными эффектами при импорте (Hooks.once вне заглушки Foundry).
import { CONDITIONS_DEF } from "../../constants/conditions.mjs";
import { isImmuneToCondition } from "../../rules/condition-guards.mjs";
import { isMirroredCondition, mirrorClearPatch, isMirrorClearable }
  from "../../rules/condition-mirrors.mjs";
import { isItemActive } from "../../apps/effects.mjs";
import { rollIcon } from "../../constants/roll-icons.mjs";
import { hasRuleFlag } from "../../rules/flags.mjs";
import { effectiveFatigue, gangreneFatigueExtra } from "../../rules/situational.mjs";
import { raceMatches } from "../../rules/race.mjs";
import { LIMB_LOSS_KEYS, BODY_SIDES, lostCount, lostCountFields, lostSideFields } from "../../rules/limb-loss.mjs";
import { esc, on } from "../../helpers/utils.mjs";

const NS = "warhammer-dbc";
const SECONDS_PER_HOUR = 3600;
const worldNow = () => Number(globalThis.game?.time?.worldTime) || 0;

function fatigueThreshold(actor) {
  const system = actor.system || {};
  const tb = system.characteristics?.t?.bonus ?? 0;
  const wb = system.characteristics?.wp?.bonus ?? 0;
  return { tb, wb, threshold: tb + wb };
}

/** Книга: «теряет сознание на 10–T.b минут, до минимума в 1 минуту». */
export function fatigueFaintMinutes(tb) {
  return Math.max(1, 10 - (Number(tb) || 0));
}

/**
 * В обмороке ли актор ОТ УСТАЛОСТИ. Основной признак — таймер пробуждения
 * (conditions.fatigueFaintWakeAt). Второй — для обмороков, заведённых до
 * таймера (wdbc-x1nz.2.95): Без сознания при Усталости на пороге и выше —
 * иначе такой персонаж не просыпался бы ни от −1, ни от Календаря.
 */
export function isFatigueFaint(actor) {
  const c = actor?.system?.conditions ?? {};
  if ((Number(c.fatigueFaintWakeAt) || 0) > 0) return true;
  const { threshold } = fatigueThreshold(actor);
  return !!c.unconscious && threshold > 0 && effectiveFatigue(actor) >= threshold;
}

/**
 * ЕДИНЫЙ путь смены Усталости (wdbc-x1nz.2.95): патч под actor.update и
 * описание того, что случилось, — без записи. Раньше порог T.b+W.b и
 * иммунитет Саркофага знал только addFatigue, а Вой Ужаса, препараты,
 * Мастерская, Завеса и ручной ввод на листе писали fatigue.value напрямую —
 * персонаж стоял на ногах с Усталостью выше порога. Теперь каждый писатель
 * собирает патч здесь (и сливает со своими полями, если пишет одним
 * update), а после записи зовёт announceFatigueChange.
 *
 * - Саркофаг Дредноута (стр. 57): рост Усталости отбрасывается (снижение — нет).
 * - Порог считается по ДЕЙСТВУЮЩЕЙ Усталости (+1 Гангрены, wdbc-x1nz.2.96).
 * - Достиг порога — Без сознания и таймер пробуждения (10−T.b мин, мин. 1).
 * - Опустился ниже порога из обморока от Усталости — пришёл в себя.
 * - `wake: true` — «приход в себя» по книге (кнопка −1, Час отдыха, снятие
 *   Без сознания крестиком, таймер Календаря): «после прихода в себя снимает
 *   1 Усталости» + «уменьшает Усталость до T.b+W.b−1» — итог не выше
 *   min(действующая−1, порог−1), даже если её перекинуло за порог (Вой Ужаса
 *   до 9 при пороге 6 раньше требовал четырёх нажатий −1).
 *
 * @returns {{fields: object, before: number, value: number, effective: number,
 *   threshold: number, tb: number, fainted: {minutes:number}|null, woke: boolean, blocked: boolean}}
 */
export function fatigueChangeFields(actor, next, { wake = false } = {}) {
  const { tb, threshold } = fatigueThreshold(actor);
  const before = Math.max(0, Number(actor?.system?.fatigue?.value) || 0);
  const extra = gangreneFatigueExtra(actor);
  let value = Math.max(0, Math.round(Number(next) || 0));
  let blocked = false;
  if (value > before && hasRuleFlag(actor, "sarcophagus.immuneBleedingFatigue")) {
    value = before;
    blocked = true;
  }
  const faint = isFatigueFaint(actor);
  if (wake && faint && threshold > 0) value = Math.max(0, Math.min(value, threshold - 1 - extra));
  const effective = value + extra;

  const fields = { "system.fatigue.value": value, "system.fatigue.max": threshold };
  const result = { fields, before, value, effective, threshold, tb, fainted: null, woke: false, blocked };
  if (threshold > 0 && effective >= threshold) {
    // Уже без сознания (от Усталости или от чего-то ещё) — второй раз не
    // «теряет сознание», таймер не продлевается.
    if (!faint && !actor.system?.conditions?.unconscious) {
      const apply = conditionApplyFields("unconscious", null, actor);
      // Иммунитет к Без сознания (запись Конструктора) — обморока нет вовсе.
      if (Object.keys(apply).length) {
        const minutes = fatigueFaintMinutes(tb);
        Object.assign(fields, apply, { "system.conditions.fatigueFaintWakeAt": worldNow() + minutes * 60 });
        result.fainted = { minutes };
      }
    }
  } else if (faint) {
    Object.assign(fields, conditionRemoveFields("unconscious"));
    result.woke = true;
  }
  return result;
}

/** Карточка/уведомление по итогу fatigueChangeFields — звать ПОСЛЕ actor.update. */
export async function announceFatigueChange(actor, res) {
  if (!res) return;
  if (res.fainted) {
    const { minutes } = res.fainted;
    // Уведомление о состоянии, а не карточка теста (ни броска, ни Порога) —
    // на общий сборщик helpers/test-card.mjs не переводится (wdbc-kuun).
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="wh-roll-result">
        <div class="roll-header">${rollIcon("warn","#ff6b6b")}${esc(actor.name)} — Потеря сознания!</div>
        <div class="roll-threshold">
          Усталость: <b>${res.effective}</b> ≥ порог T.b + W.b (<b>${res.threshold}</b>).
        </div>
        <div class="roll-outcome">
          <span class="roll-failure">
            Без сознания <b>${minutes}</b> мин. (10 − ${res.tb} = ${minutes}, мин. 1)
          </span>
        </div>
        <div class="roll-threshold" style="font-size:0.85em;">
          Очнётся сам, когда Календарь отсчитает ${minutes} мин.; Усталость опустится до
          ${Math.max(0, res.threshold - 1)} (T.b + W.b − 1). Раньше — кнопкой −1 или снятием Без сознания.
        </div>
      </div>`
    }, game.settings.get("core", "rollMode")));
    ui.notifications.warn(`${actor.name} потерял сознание на ${minutes} мин.!`);
    return;
  }
  if (res.woke) {
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="wh-roll-result">
        <div class="roll-header">${rollIcon("spark","#4dffa6")}${esc(actor.name)} — приходит в себя</div>
        <div class="roll-outcome">
          <span class="roll-success">Без сознания снято. Усталость: <b>${res.effective}</b> (порог ${res.threshold}).</span>
        </div>
      </div>`
    }, game.settings.get("core", "rollMode")));
    return;
  }
  if (res.effective >= 1 && res.before + (res.effective - res.value) < 1) {
    ui.notifications.info(`${actor.name}: Усталость 1+ — штраф −10 на все тесты (кроме T, Inf, Cor).`);
  }
}

/**
 * Выставить Усталость (хранимую) и применить всё, что из этого следует:
 * порог обморока, пробуждение, Саркофаг. Для писателей, которым не нужно
 * сливать патч с другими полями.
 * @returns {Promise<object|null>} итог fatigueChangeFields; null — ничего не изменилось
 */
export async function setFatigue(actor, next, { wake = false } = {}) {
  const res = fatigueChangeFields(actor, next, { wake });
  // Саркофаг отбросил рост и больше ничего не случилось — не писать вовсе.
  if (res.blocked && res.value === res.before && !res.fainted && !res.woke) return null;
  await actor.update(res.fields);
  await announceFatigueChange(actor, res);
  return res;
}

// Усталость и Марш переехали в module/rules/situational.mjs (wdbc-n17t): их
// спрашивает реестр правил, а этот файл через hasRuleFlag тянет сам реестр
// обратно — получался круг импортов, на котором ES-загрузчик вставал насмерть.
// Реэкспорт оставлен, чтобы прежние импортёры (лист, combat/*, тесты и ссылки
// `reader:` в constants/capabilities.mjs) не трогать.
export { fatiguePenalty, marchPenalty } from "../../rules/situational.mjs";

export async function addFatigue(actor, amount = 1, { slow = false } = {}) {
  // Саркофаг Дредноута (стр. 57): иммунитет к Усталости — не отсрочка порога
  // (как grace выше) и не смягчение штрафа (как feelsNoPain в fatiguePenalty),
  // а полный запрет её накопления: тело пилота в саркофаге физически не
  // устаёт, откуда бы Усталость ни пришла (Марш, Горение, снаряжение).
  // (Сама проверка — в fatigueChangeFields, общая для всех писателей.)
  const current = Math.max(0, Number(actor.system?.fatigue?.value) || 0);
  const res = await setFatigue(actor, current + amount);
  if (!res) return null;

  // Форсированный марш (стр. 29): Усталость от него восстанавливается
  // вдвое медленнее — считаем отдельно, сколько очков текущей Усталости
  // «медленные» (fatiguePeriodRest снимает их раз в 2 вызова, см. ниже).
  if (slow && actor.setFlag && res.value > current) {
    const slowNow = Number(actor.getFlag?.("warhammer-dbc", "slowFatigue")) || 0;
    await actor.setFlag("warhammer-dbc", "slowFatigue", Math.min(res.value, slowNow + (res.value - current)));
  }
  return res;
}

/**
 * Снять Усталость (кнопка −1, Час отдыха). Для персонажа в обмороке от
 * Усталости это «приход в себя» по книге (wdbc-x1nz.2.95): Усталость
 * опускается до min(действующая − amount, T.b+W.b − 1) и Без сознания
 * снимается — даже если её перекинуло за порог на несколько единиц.
 */
export async function removeFatigue(actor, amount = 1) {
  const current = Math.max(0, Number(actor.system?.fatigue?.value) || 0);
  const res = await setFatigue(actor, current - amount, { wake: true });
  const newVal = res?.value ?? current;

  // Не может остаться «медленных» очков больше, чем самой Усталости.
  if (actor.setFlag) {
    const slowNow = Number(actor.getFlag?.("warhammer-dbc", "slowFatigue")) || 0;
    if (slowNow > newVal) await actor.setFlag("warhammer-dbc", "slowFatigue", newVal);
  }
  return res;
}

/**
 * Полноценный сон по книге: «8 часов для человека, 3 для космодесантника».
 * Космодесантник — не раса в коде, а возможность «Физиология Астартес»
 * (healing.astartes, rules/library/astartes.mjs — тот же признак, по
 * которому лечится healing.mjs); раса astartes — страховка на случай, если
 * правило расы у актора ещё не собрано (Прошлое, ручной лист).
 */
export function hasAstartesPhysiology(actor) {
  return hasRuleFlag(actor, "healing.astartes") || raceMatches(actor?.system, "astartes");
}
export function sleepHours(actor) {
  return hasAstartesPhysiology(actor) ? 3 : 8;
}

/**
 * Отдых и сон двигают Календарь сами (решение владельца, wdbc-x1nz.2.95):
 * game.time.advance доступен только ГМу (core.time — мировая настройка).
 * Игрок снимает Усталость как раньше, а карточка просит ГМа сдвинуть время.
 *
 * Звать ПОСЛЕ записи Усталости: сдвиг времени вызовет updateWorldTime →
 * combat/condition-clock.mjs, и таймер обморока, уже снятый здесь, там не
 * сработает второй раз (иначе персонаж «пришёл бы в себя» и потерял бы
 * Усталость дважды).
 * @returns {Promise<string>} строка для карточки
 */
async function advanceRestClock(hours) {
  const time = globalThis.game?.time;
  if (globalThis.game?.user?.isGM && typeof time?.advance === "function") {
    await time.advance(hours * SECONDS_PER_HOUR);
    return `Календарь сдвинут на ${hours} ч.`;
  }
  return `Время двигает ГМ — сдвиньте Календарь на ${hours} ч.`;
}

/**
 * Час отдыха: снимает 1 Усталость. Если часть текущей Усталости помечена
 * «медленной» (Форсированный марш, стр. 29 — восстанавливается вдвое
 * медленнее), каждая такая единица требует 2 вызовов этой функции —
 * flags.warhammer-dbc.slowFatigueParity считает чётность вызова.
 */
export async function fatiguePeriodRest(actor) {
  const current = actor.system.fatigue?.value ?? 0;
  if (current <= 0) {
    ui.notifications.info(gangreneFatigueExtra(actor)
      ? `${actor.name}: снимать нечего — осталась только Усталость Гангрены, она держится до излечения.`
      : `${actor.name}: Усталость и так 0.`);
    return;
  }

  const slowNow = Number(actor.getFlag?.("warhammer-dbc", "slowFatigue")) || 0;
  if (slowNow > 0 && actor.setFlag) {
    const parity = !!actor.getFlag?.("warhammer-dbc", "slowFatigueParity");
    if (!parity) {
      await actor.setFlag("warhammer-dbc", "slowFatigueParity", true);
      // Час всё равно прошёл — Календарь двигается и здесь.
      const clockLine = await advanceRestClock(1);
      const rollMode = game.settings.get("core", "rollMode");
      // Уведомление о состоянии, а не карточка теста (ни броска, ни Порога) —
      // на общий сборщик helpers/test-card.mjs не переводится (wdbc-kuun).
      await ChatMessage.create(ChatMessage.applyRollMode({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="wh-roll-result">
          <div class="roll-header">${rollIcon("spark","#4dffa6")}${esc(actor.name)} — Час отдыха</div>
          <div class="roll-outcome">
            <span class="roll-threshold">Усталость от Форсированного марша восстанавливается вдвое
            медленнее — этот час зачтён наполовину, Усталость не снята.</span>
          </div>
          <div class="roll-threshold" style="font-size:0.85em;">${clockLine}</div>
        </div>`
      }, rollMode));
      return;
    }
    await actor.setFlag("warhammer-dbc", "slowFatigueParity", false);
    await actor.setFlag("warhammer-dbc", "slowFatigue", Math.max(0, slowNow - 1));
  }

  const res = await removeFatigue(actor, 1);
  const clockLine = await advanceRestClock(1);

  const rollMode = game.settings.get("core", "rollMode");
  // Уведомление о состоянии, а не карточка теста (ни броска, ни Порога) —
  // на общий сборщик helpers/test-card.mjs не переводится (wdbc-kuun).
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("spark","#4dffa6")}${esc(actor.name)} — Час отдыха</div>
      <div class="roll-outcome">
        <span class="roll-success">Снята Усталость. Осталось: <b>${res?.effective ?? Math.max(0, current - 1)}</b></span>
      </div>
      <div class="roll-threshold" style="font-size:0.85em;">${clockLine}</div>
    </div>`
  }, rollMode));
}

export async function fatigueSleep(actor) {
  const current = actor.system.fatigue?.value ?? 0;
  const { threshold } = fatigueThreshold(actor);
  const hours = sleepHours(actor);

  // Без сознания снимается любое (не только обморок от Усталости) — как и
  // было: проспав полноценный сон, персонаж просыпается. conditionRemoveFields
  // гасит и таймер обморока — updateWorldTime от сдвига ниже его не найдёт.
  await actor.update({
    "system.fatigue.value": 0,
    "system.fatigue.max": threshold,
    ...conditionRemoveFields("unconscious")
  });
  if (actor.getFlag?.("warhammer-dbc", "slowFatigue")) await actor.unsetFlag?.("warhammer-dbc", "slowFatigue");
  if (actor.getFlag?.("warhammer-dbc", "slowFatigueParity")) await actor.unsetFlag?.("warhammer-dbc", "slowFatigueParity");
  const clockLine = await advanceRestClock(hours);

  const rollMode = game.settings.get("core", "rollMode");
  const gangreneNote = gangreneFatigueExtra(actor)
    ? `<div class="roll-threshold" style="font-size:0.85em;">Осталась 1 Усталость Гангрены — не снимается до излечения.</div>`
    : "";
  // Уведомление о состоянии, а не карточка теста (ни броска, ни Порога) —
  // на общий сборщик helpers/test-card.mjs не переводится (wdbc-kuun).
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("spark","#4dffa6")}${esc(actor.name)} — Полноценный сон (${hours} ч.)</div>
      <div class="roll-outcome">
        <span class="roll-success">Вся Усталость снята (было: <b>${current}</b>).</span>
      </div>
      ${gangreneNote}
      <div class="roll-threshold" style="font-size:0.85em;">${clockLine}</div>
    </div>`
  }, rollMode));
}

// ── Единая точка наложения/снятия Состояний (wdbc-fejd) ─────────────────────
// Раньше 19+ мест по всему коду (combat/*, apps/*, sheets/tabs/*) сами
// собирали пару «флаг + счётчик» вручную, каждое своим кодом — ровно так же,
// как когда-то разъехались флаг и счётчик Усталости (см. комментарий у
// prepareDerivedData в rules/character.mjs). Здесь — то место, которое НЕ
// умеет забыть про счётчик: даёт значение флага и счётчика ОДНИМ вызовом,
// каким бы способом ни считалось само число (задать явно, поднять «не ниже»,
// изменить на дельту).
//
// *Fields — чистые функции без побочных эффектов: собирают патч под ключи
// actor.update, но НЕ пишут сами — нужны местам, которые сливают несколько
// полей (Состояние + другие system.*/flags.*) в один вызов actor.update.
// addCondition/removeCondition — те же пары полей, но уже отправленные.

/**
 * Патч { "system.conditions.<key>": true, [.<levelField>]: level } — если у
 * Состояния нет счётчика или level не передан, второе поле не пишется.
 *
 * `actor` необязателен и нужен ровно для одного: спросить ИММУНИТЕТ (запись
 * Конструктора kind:"condition" режима «иммунитет», wdbc-tl0f). Невосприимчивый
 * актор получает ПУСТОЙ патч — Состояние не накладывается, каким бы путём его
 * ни накладывали, потому что все пути идут через эту функцию (wdbc-fejd).
 * Без актора иммунитет не спрашивается: вызов без владельца бывает только там,
 * где патч собирают «в воздухе» (предпросмотр, тест) — не молча гасить.
 */
export function conditionApplyFields(key, level = null, actor = null) {
  const def = CONDITIONS_DEF[key];
  if (!def || key === "fatigued") return {};
  // МЕТКА (wdbc-5uae) не хранится своим флагом, а зеркалит чужой источник:
  // запись сюда затрут производные данные на первом же пересчёте. Метку ставит
  // её собственное действие («объявить Бег», «войти в Ярость»), не эта функция.
  if (isMirroredCondition(key)) return {};
  if (actor && isImmuneToCondition(actor, key, isItemActive)) return {};
  // Потеря конечности (wdbc-x1nz.2.100) хранится по сторонам: число
  // переводится в стороны (новые — на первые целые), флаг/счётчик производные.
  if (LIMB_LOSS_KEYS.includes(key)) {
    const cur = lostCount(actor?.system, key);
    return lostCountFields(actor?.system, key, level != null ? Number(level) || 0 : Math.max(1, cur));
  }
  const fields = { [`system.conditions.${key}`]: true };
  if (def.hasLevel && def.levelField && level != null) {
    fields[`system.conditions.${def.levelField}`] = Number(level) || 0;
  }
  // Врасплох (стр. 12, wdbc-x1nz.2.26): «не получает Реакции в этот Раунд» —
  // не только на СВОЁМ Ходу (там 0 Реакций даёт resetActionEconomy), но и
  // ДО него, если по порядку Инициативы враги действуют раньше. Обнулить
  // нужно сразу здесь — в единственной точке, через которую проходит любое
  // наложение Состояния (диалог, драг карточки ритуала, скрипт эффекта).
  if (key === "surprised" && actor) {
    fields["system.reactions.value"] = 0;
    fields["system.reactions.defenseValue"] = 0;
  }
  // Гангрена (wdbc-x1nz.2.96): «каждые T.b×2 часов 1d10 урона в T» — отсчёт
  // идёт от начала болезни. Метка времени — тот же флаг, что у кнопки
  // (combat/gangrene.mjs, gangreneTestAt); её читает Календарь
  // (combat/condition-clock.mjs). Повторное наложение уже стоящей Гангрены
  // отсчёт не сбрасывает.
  if (key === "gangrene" && actor && !actor.system?.conditions?.gangrene) {
    fields[`flags.${NS}.gangreneTestAt`] = worldNow();
  }
  return fields;
}

/**
 * Таймер Гангрены обрубка (стр. 30-31, «через T.b дней с шансом 80%…»).
 * Один на тип конечности (conditions.lostXGangreneAt). Уже идущий таймер
 * НЕ переносится на более поздний срок (wdbc-x1nz.2.97): раньше вторая
 * потеря того же типа перезаписывала срок, и первый, более ранний обрубок
 * получал отсрочку. Раньший срок держится — обрубок, загноившийся первым,
 * и даёт Гангрену; второй бросок 80% по второму обрубку ничего бы не
 * добавил: Гангрена — одно Состояние без уровней.
 */
export function stumpTimerOpts(actor) {
  return { timer: true, worldTime: worldNow(), tb: Number(actor?.system?.characteristics?.t?.bonus) || 0 };
}

/**
 * Последствия НОВОЙ потери конечности, поставленной рукой (диалог, строка
 * уровня, addCondition — wdbc-x1nz.2.97): «Потеря конечностей всегда
 * приводит к Кровотечению» + таймер Гангрены обрубка. Крит-пилюля
 * (combat/crit-effect-parser.mjs) делает то же сама своим путём — сюда не
 * заходит (идёт через conditionAdjustFields); наложение Кровотечения — флаг
 * true, повтор ничего не удваивает. Ампутация (healing.mjs, стр. 231) и
 * Мутация Loss of Limb сюда тоже не заходят: у операции своё правило
 * Кровотечения, у Мутации обрубок уже закрыт.
 */
function limbLossSideFields(actor, key, target) {
  if (!LIMB_LOSS_KEYS.includes(key)) return {};
  // Таймер обрубка у каждой стороны свой (wdbc-x1nz.2.100) — заводится
  // только новым потерям, уже идущие не переносятся.
  return { ...conditionApplyFields("bleeding", null, actor),
           ...lostCountFields(actor.system, key, target, stumpTimerOpts(actor)) };
}

/** Патч на снятие — флаг false и (если у Состояния есть счётчик) счётчик 0. */
export function conditionRemoveFields(key) {
  if (key === "fatigued") return {};
  // Снятие МЕТКИ гасит её настоящий источник, а не отражение: записанное в
  // system.conditions производные данные вернут обратно на первом пересчёте
  // (wdbc-5uae). Патч собирает rules/condition-mirrors.mjs — он один знает,
  // где какая метка живёт.
  if (isMirroredCondition(key)) return mirrorClearPatch(key);
  if (LIMB_LOSS_KEYS.includes(key))
    return Object.assign({}, ...BODY_SIDES.map(side => lostSideFields(key, side, { lost: false })));
  const def    = CONDITIONS_DEF[key];
  const fields = { [`system.conditions.${key}`]: false };
  if (def?.hasLevel && def.levelField) fields[`system.conditions.${def.levelField}`] = 0;
  // Горение (wdbc-3pv5): снятие тушит и запомненные числа Cooler/Морозного
  // Сердца — иначе следующее загорание унаследовало бы чужие урон поджигания
  // и остаток окна от предыдущего пожара.
  if (key === "burning") {
    fields["system.conditions.burningSourceDamage"] = 0;
    fields["system.conditions.burningGraceRounds"]  = 0;
    // И формулу урона погасшего пламени (combat/condition-ticks.mjs::
    // BURNING_FORMULA_FLAG) — иначе следующее загорание горело бы чужой
    // формулой. Строкой, а не импортом: condition-ticks тянет damage.mjs и
    // сам импортирует этот файл. «-=» на отсутствующем флаге Foundry молча
    // пропускает. Все вызывающие пишут патч в actor.update, не в токен.
    fields["flags.warhammer-dbc.-=burningDamageFormula"] = null;
  }
  // Любое снятие Без сознания гасит таймер обморока от Усталости
  // (wdbc-x1nz.2.95) — иначе Календарь «разбудил» бы уже очнувшегося и
  // второй раз опустил бы ему Усталость.
  if (key === "unconscious") fields["system.conditions.fatigueFaintWakeAt"] = 0;
  return fields;
}

/**
 * Патч на «изменить счётчик на delta относительно текущего значения» —
 * Кровотечение +1 за неудачную ампутацию, снятый ур. Обескровливания от
 * препарата (−N), пришитая конечность (−1) и т.п. Флаг сам следует за
 * счётчиком: результат ⩽0 — снят, > 0 — наложен. У Состояния без счётчика
 * delta трактуется как булев тумблер (delta > 0 — наложить, иначе не трогать —
 * для явного снятия есть conditionRemoveFields).
 */
export function conditionAdjustFields(actor, key, delta) {
  const def = CONDITIONS_DEF[key];
  if (!def || key === "fatigued" || isMirroredCondition(key)) return {};
  // Иммунитет гасит только НАКОПЛЕНИЕ: снять уровень (delta < 0) он мешать не
  // должен — иначе предмет-иммунитет запер бы Состояние, наложенное до него.
  if (delta > 0 && isImmuneToCondition(actor, key, isItemActive)) return {};
  if (LIMB_LOSS_KEYS.includes(key)) return lostCountFields(actor.system, key, lostCount(actor.system, key) + delta);
  if (!def.hasLevel || !def.levelField) {
    return delta > 0 ? { [`system.conditions.${key}`]: true } : {};
  }
  const cur  = Number(actor.system.conditions?.[def.levelField]) || 0;
  const next = Math.max(0, cur + delta);
  return { [`system.conditions.${key}`]: next > 0, [`system.conditions.${def.levelField}`]: next };
}

/**
 * Наложить состояние (диалог добавления, драг состояния из карточки ритуала
 * в чате — module/sheets/actor-sheet.mjs, showRitualCastDialog). `level` —
 * только для состояний со счётчиком (Кровотечение, Оглушение и т.п.).
 */
export async function addCondition(actor, key, { level = null } = {}) {
  const fields = manualApplyFields(actor, key, level);
  if (Object.keys(fields).length) await actor.update(fields);
}

/**
 * Ручное наложение (диалог, addCondition): патч conditionApplyFields плюс,
 * для потери конечности, её последствия (limbLossSideFields). Счётчик
 * потерь без уровня ставится в 1: флаг без счётчика ничего не делал бы —
 * руки/ноги/глаза считают именно Count (rules/hands.mjs, movement.mjs).
 */
function manualApplyFields(actor, key, level = null) {
  const isLimb = LIMB_LOSS_KEYS.includes(key);
  const before = isLimb ? lostCount(actor.system, key) : 0;
  const lvl = isLimb && level == null ? Math.max(1, before) : level;
  if (isLimb && (Number(lvl) || 0) > before) {
    if (isImmuneToCondition(actor, key, isItemActive)) return {};
    return limbLossSideFields(actor, key, lvl);
  }
  return conditionApplyFields(key, lvl, actor);
}

/** Крестик в строке состояния: снять его, а со счётчиком — обнулить и счётчик. */
export async function removeCondition(actor, key) {
  // Без сознания от Усталости (wdbc-x1nz.2.95): снять крестиком — значит
  // привести в себя, а по книге это ещё и Усталость до T.b+W.b−1. Иначе
  // очнувшийся стоял бы с Усталостью на пороге и выше.
  if (key === "unconscious" && isFatigueFaint(actor)) {
    await removeFatigue(actor, 1);
    return;
  }
  // «Усталость» правится только Усталостью на ТЕЛЕ (см. showAddConditionDialog) —
  // крестик тут ничего не изменит, тег пересчитается обратно из fatigue.value.
  const fields = conditionRemoveFields(key);
  if (Object.keys(fields).length) await actor.update(fields);
}

/** Поле уровня: раунды оглушения, стадии кровотечения и прочие счётчики. */
export async function setConditionLevel(actor, key, value) {
  if (key === "fatigued") return;
  const def = CONDITIONS_DEF[key];
  const val = parseInt(value) || 0;
  if (!def?.hasLevel || !def.levelField) return;
  // Потеря конечности, поднятая числом в строке (wdbc-x1nz.2.97) — та же
  // новая потеря, что и из диалога: Кровотечение + таймер обрубка; хранится
  // по сторонам (wdbc-x1nz.2.100).
  if (LIMB_LOSS_KEYS.includes(key)) {
    const before = lostCount(actor.system, key);
    const fields = val > before ? limbLossSideFields(actor, key, val) : lostCountFields(actor.system, key, val);
    if (Object.keys(fields).length) await actor.update(fields);
    return;
  }
  const fields = { [`system.conditions.${def.levelField}`]: val };
  await actor.update(fields);
}

export function showAddConditionDialog(actor) {
  const conditions = actor.system.conditions || {};
  const inactive = Object.entries(CONDITIONS_DEF)
    // «Усталость» — не ручное состояние: тег зеркалит system.fatigue.value
    // (см. actor.mjs prepareDerivedData), в диалоге добавления ей делать
    // нечего — включать нужно самой Усталостью на вкладке ТЕЛО.
    // Метки (wdbc-5uae) сюда не попадают по той же причине, что «Усталость»:
    // их ставит своё действие, а не рука ГМа. Предложить и не сработать хуже,
    // чем не предлагать.
    .filter(([key]) => key !== "fatigued" && !isMirroredCondition(key) && !conditions[key])
    .map(([key, def]) => {
      // Состояние, к которому у актора ИММУНИТЕТ (wdbc-d9dp), показывается, но
      // не выбирается — с названной причиной. Спрятать его было бы хуже: ГМ
      // решил бы, что Состояние из системы потерялось, и пошёл бы искать баг.
      // Живая проверка нашла ровно эту дыру: через иконку токена и через
      // выдачу предмета иммунитет держал, а этой кнопкой продавливался.
      const immune = isImmuneToCondition(actor, key, isItemActive);
      const why = immune ? ` — иммунитет: не накладывается` : "";
      return `<label class="add-cond-label${immune ? " add-cond-immune" : ""}"
              style="--cond-color:${def.color || "#4dffa6"};" title="${esc(def.label + why)}">
        <input type="checkbox" class="add-cond-cb" data-condition="${key}" ${immune ? "disabled" : ""}/>
        <span class="add-cond-icon">${def.svg || def.icon}</span>
        <span class="add-cond-name">${def.label}${immune ? " (иммунитет)" : ""}</span>
      </label>`;
    }).join("");

  if (!inactive) {
    ui.notifications.info("Все состояния уже активны!");
    return;
  }

  // Не <form>: содержимое DialogV2 уже внутри его формы, вложенная недопустима.
  return foundry.applications.api.DialogV2.wait({
    window: { title: "Добавить состояние" },
    classes: ["wh-add-condition-dialog", "warhammer-dbc", "wh-holo"],
    position: { width: 360 },
    content: `
      <div class="wh-add-condition-form">
        <div class="add-cond-list">${inactive}</div>
      </div>`,
    rejectClose: false,
    buttons: [
      {
        action: "add", label: "Добавить", icon: "fas fa-plus", default: true,
        callback: async (event, button) => {
          const updates = {};
          // Актор передаётся третьим доводом не для красоты: без него единая
          // точка не спрашивает иммунитет, и Состояние продавливается вручную
          // мимо него (wdbc-d9dp). Галочка иммунного Состояния и так отключена
          // выше — это второй рубеж на случай подделанной формы/скрипта.
          // manualApplyFields, а не голый conditionApplyFields: потеря
          // конечности отсюда тоже тянет Кровотечение и таймер обрубка.
          for (const cb of button.form.querySelectorAll(".add-cond-cb:checked"))
            Object.assign(updates, manualApplyFields(actor, cb.dataset.condition));
          if (Object.keys(updates).length) await actor.update(updates);
        }
      },
      { action: "cancel", label: "Отмена" }
    ]
  });
}

export function activateConditionsListeners(root, actor) {
  on(root, ".conditions-add-btn", "click", ev => {
    ev.preventDefault();
    showAddConditionDialog(actor);
  });

  on(root, ".condition-remove-btn", "click", async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    await removeCondition(actor, ev.currentTarget.dataset.condition);
  });

  on(root, ".condition-level-input", "change", async ev => {
    ev.stopPropagation();
    await setConditionLevel(actor, ev.currentTarget.dataset.condition, ev.currentTarget.value);
  });

  // Ручной ввод числа Усталости (wdbc-x1nz.2.95): у поля нет name — форма
  // листа его не отправляет, число идёт тем же путём, что кнопки, с порогом
  // обморока и иммунитетом Саркофага. Раньше ввод «9» при пороге 6 оставлял
  // персонажа на ногах.
  on(root, ".fatigue-value-input", "change", async ev => {
    ev.stopPropagation();
    await setFatigue(actor, parseInt(ev.currentTarget.value) || 0);
  });
  on(root, ".fatigue-add-btn", "click", async ev => {
    ev.preventDefault();
    await addFatigue(actor, 1);
  });
  on(root, ".fatigue-remove-btn", "click", async ev => {
    ev.preventDefault();
    await removeFatigue(actor, 1);
  });
  on(root, ".fatigue-rest-btn", "click", async ev => {
    ev.preventDefault();
    await fatiguePeriodRest(actor);
  });
  on(root, ".fatigue-sleep-btn", "click", async ev => {
    ev.preventDefault();
    await fatigueSleep(actor);
  });
}
