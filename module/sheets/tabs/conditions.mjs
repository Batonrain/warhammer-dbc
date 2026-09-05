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
import { isItemActive } from "../../apps/effects.mjs";
import { rollIcon } from "../../constants/roll-icons.mjs";
import { hasRuleFlag } from "../../rules/flags.mjs";
import { esc, on } from "../../helpers/utils.mjs";

function fatigueThreshold(actor) {
  const system = actor.system || {};
  const tb = system.characteristics?.t?.bonus ?? 0;
  const wb = system.characteristics?.wp?.bonus ?? 0;
  return { tb, wb, threshold: tb + wb };
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
  if (hasRuleFlag(actor, "sarcophagus.immuneBleedingFatigue")) return;
  const system = actor.system;
  const { tb, threshold } = fatigueThreshold(actor);
  const current = system.fatigue?.value ?? 0;
  const newVal = current + amount;

  const updates = {
    "system.fatigue.value": newVal,
    "system.fatigue.max": threshold
  };

  // Форсированный марш (стр. 29): Усталость от него восстанавливается
  // вдвое медленнее — считаем отдельно, сколько очков текущей Усталости
  // «медленные» (fatiguePeriodRest снимает их раз в 2 вызова, см. ниже).
  if (slow && actor.setFlag) {
    const slowNow = Number(actor.getFlag?.("warhammer-dbc", "slowFatigue")) || 0;
    await actor.setFlag("warhammer-dbc", "slowFatigue", Math.min(newVal, slowNow + amount));
  }

  if (threshold > 0 && newVal >= threshold) {
    const unconsciousMinutes = Math.max(1, 10 - tb);
    Object.assign(updates, conditionApplyFields("unconscious"));

    await actor.update(updates);

    const rollMode = game.settings.get("core", "rollMode");
    // Уведомление о состоянии, а не карточка теста (ни броска, ни Порога) —
    // на общий сборщик helpers/test-card.mjs не переводится (wdbc-kuun).
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="wh-roll-result">
        <div class="roll-header">${rollIcon("warn","#ff6b6b")}${esc(actor.name)} — Потеря сознания!</div>
        <div class="roll-threshold">
          Усталость: <b>${newVal}</b> ≥ порог T.b + W.b (<b>${threshold}</b>) — превышен.
        </div>
        <div class="roll-outcome">
          <span class="roll-failure">
            Персонаж без сознания <b>${unconsciousMinutes}</b> мин.
            (10 − ${tb} = ${unconsciousMinutes}, мин. 1)
          </span>
        </div>
        <div class="roll-threshold" style="font-size:0.85em;">
          После прихода в себя — снимается 1 Усталость автоматически.
        </div>
      </div>`
    }, rollMode));

    ui.notifications.warn(`${actor.name} потерял сознание на ${unconsciousMinutes} минут!`);
  } else {
    await actor.update(updates);
    if (newVal >= 1 && current < 1) {
      ui.notifications.info(`${actor.name}: Усталость 1+ — штраф −10 на все тесты (кроме T, Inf, Cog).`);
    }
  }
}

export async function removeFatigue(actor, amount = 1) {
  const system = actor.system;
  const current = system.fatigue?.value ?? 0;
  const { threshold } = fatigueThreshold(actor);
  const newVal = Math.max(0, current - amount);

  const updates = {
    "system.fatigue.value": newVal,
    "system.fatigue.max": threshold
  };

  if (system.conditions?.unconscious && newVal < threshold) {
    Object.assign(updates, conditionRemoveFields("unconscious"));
  }

  await actor.update(updates);

  // Не может остаться «медленных» очков больше, чем самой Усталости.
  if (actor.setFlag) {
    const slowNow = Number(actor.getFlag?.("warhammer-dbc", "slowFatigue")) || 0;
    if (slowNow > newVal) await actor.setFlag("warhammer-dbc", "slowFatigue", newVal);
  }
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
    ui.notifications.info(`${actor.name}: Усталость и так 0.`);
    return;
  }

  const slowNow = Number(actor.getFlag?.("warhammer-dbc", "slowFatigue")) || 0;
  if (slowNow > 0 && actor.setFlag) {
    const parity = !!actor.getFlag?.("warhammer-dbc", "slowFatigueParity");
    if (!parity) {
      await actor.setFlag("warhammer-dbc", "slowFatigueParity", true);
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
        </div>`
      }, rollMode));
      return;
    }
    await actor.setFlag("warhammer-dbc", "slowFatigueParity", false);
    await actor.setFlag("warhammer-dbc", "slowFatigue", Math.max(0, slowNow - 1));
  }

  await removeFatigue(actor, 1);

  const rollMode = game.settings.get("core", "rollMode");
  // Уведомление о состоянии, а не карточка теста (ни броска, ни Порога) —
  // на общий сборщик helpers/test-card.mjs не переводится (wdbc-kuun).
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("spark","#4dffa6")}${esc(actor.name)} — Час отдыха</div>
      <div class="roll-outcome">
        <span class="roll-success">Снята 1 Усталость. Осталось: <b>${Math.max(0, current - 1)}</b></span>
      </div>
    </div>`
  }, rollMode));
}

export async function fatigueSleep(actor) {
  const current = actor.system.fatigue?.value ?? 0;
  const { threshold } = fatigueThreshold(actor);

  await actor.update({
    "system.fatigue.value": 0,
    "system.fatigue.max": threshold,
    ...conditionRemoveFields("unconscious")
  });
  if (actor.getFlag?.("warhammer-dbc", "slowFatigue")) await actor.unsetFlag?.("warhammer-dbc", "slowFatigue");
  if (actor.getFlag?.("warhammer-dbc", "slowFatigueParity")) await actor.unsetFlag?.("warhammer-dbc", "slowFatigueParity");

  const rollMode = game.settings.get("core", "rollMode");
  // Уведомление о состоянии, а не карточка теста (ни броска, ни Порога) —
  // на общий сборщик helpers/test-card.mjs не переводится (wdbc-kuun).
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("spark","#4dffa6")}${esc(actor.name)} — Полноценный сон</div>
      <div class="roll-outcome">
        <span class="roll-success">Вся Усталость снята (было: <b>${current}</b>).</span>
      </div>
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
  if (actor && isImmuneToCondition(actor, key, isItemActive)) return {};
  const fields = { [`system.conditions.${key}`]: true };
  if (def.hasLevel && def.levelField && level != null) {
    fields[`system.conditions.${def.levelField}`] = Number(level) || 0;
  }
  return fields;
}

/** Патч на снятие — флаг false и (если у Состояния есть счётчик) счётчик 0. */
export function conditionRemoveFields(key) {
  if (key === "fatigued") return {};
  const def    = CONDITIONS_DEF[key];
  const fields = { [`system.conditions.${key}`]: false };
  if (def?.hasLevel && def.levelField) fields[`system.conditions.${def.levelField}`] = 0;
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
  if (!def || key === "fatigued") return {};
  // Иммунитет гасит только НАКОПЛЕНИЕ: снять уровень (delta < 0) он мешать не
  // должен — иначе предмет-иммунитет запер бы Состояние, наложенное до него.
  if (delta > 0 && isImmuneToCondition(actor, key, isItemActive)) return {};
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
  const fields = conditionApplyFields(key, level, actor);
  if (Object.keys(fields).length) await actor.update(fields);
}

/** Крестик в строке состояния: снять его, а со счётчиком — обнулить и счётчик. */
export async function removeCondition(actor, key) {
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
  await actor.update({ [`system.conditions.${def.levelField}`]: val });
}

export function showAddConditionDialog(actor) {
  const conditions = actor.system.conditions || {};
  const inactive = Object.entries(CONDITIONS_DEF)
    // «Усталость» — не ручное состояние: тег зеркалит system.fatigue.value
    // (см. actor.mjs prepareDerivedData), в диалоге добавления ей делать
    // нечего — включать нужно самой Усталостью на вкладке ТЕЛО.
    .filter(([key]) => key !== "fatigued" && !conditions[key])
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
          for (const cb of button.form.querySelectorAll(".add-cond-cb:checked"))
            Object.assign(updates, conditionApplyFields(cb.dataset.condition, null, actor));
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
