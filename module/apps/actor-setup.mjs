// module/apps/actor-setup.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ВАРИАЦИИ БЕСТИАРИЯ — сторона Foundry: диалог выбора и применение плана.
//
//  Существо из книги нередко идёт с развилкой (Культист Фанатик: Берсерк,
//  Молотильщик, Оплот; Мутант: четыре благословения). Держать в компендиуме по
//  актору на каждую версию — плодить почти одинаковые листы, поэтому в паке
//  лежит базовая версия плюс описание развилки во флаге `warhammer-dbc.setup`.
//
//  Диалог открывается, когда актор создан В МИРЕ (перетащен из компендиума на
//  сцену или в боковую панель), и не открывается внутри компендиума: там актор
//  и должен оставаться базовым — иначе правка пака зафиксировала бы один
//  вариант навсегда.
//
//  Разбор описания и сборка плана — в module/rules/actor-setup.mjs, без
//  Foundry и под тестом. Здесь остаётся ровно то, что без неё не живёт:
//  компендиумы, предметы актора и разметка окна.
// ════════════════════════════════════════════════════════════════════════════

import { readSetup, defaultAnswers, buildSetupPlan, applyDeltas, pickKey, mergeGroupSkills }
  from "../rules/actor-setup.mjs";
import { SKILL_RANKS } from "../constants/characteristics.mjs";
// Экранирование одно на проект (wdbc-84g): свой вариант разошёлся бы с общим.
import { esc } from "../helpers/utils.mjs";

const SYSTEM = "warhammer-dbc";

/** Имя документа по UUID — для подписи в селекте; битая ссылка честно видна. */
async function uuidLabel(uuid) {
  try {
    const doc = await fromUuid(uuid);
    return doc?.name || `⚠ не найдено: ${uuid}`;
  } catch {
    return `⚠ не найдено: ${uuid}`;
  }
}

/** Подписи всех ссылок описания разом: одно чтение паков на весь диалог. */
async function collectLabels(setup) {
  const labels = new Map();
  for (const group of setup.groups) {
    for (const option of group.options) {
      for (const p of option.pick) {
        for (const uuid of p.from) if (!labels.has(uuid)) labels.set(uuid, await uuidLabel(uuid));
      }
    }
  }
  return labels;
}

/** Разметка одной развилки: радиокнопки для «одно из», галочки для «сколько угодно». */
function groupHtml(group, answers, labels) {
  const chosen = new Set(answers.groups[group.key] || []);
  const rows = group.options.map(option => {
    const id = `was-${group.key}-${option.key}`;
    const input = group.mode === "many"
      ? `<input type="checkbox" id="${id}" class="was-opt" data-group="${esc(group.key)}" value="${esc(option.key)}" ${chosen.has(option.key) ? "checked" : ""}/>`
      : `<input type="radio" id="${id}" class="was-opt" name="was-${esc(group.key)}" data-group="${esc(group.key)}" value="${esc(option.key)}" ${chosen.has(option.key) ? "checked" : ""}/>`;

    // Вложенный выбор показывается только у своей опции: пока вариант не выбран,
    // селект не нужен, а спрятать его целиком нельзя — из него читается ответ.
    const picks = option.pick.map((p, i) => {
      const opts = p.from.map(uuid =>
        `<option value="${esc(uuid)}">${esc(labels.get(uuid) || uuid)}</option>`).join("");
      return `<div class="was-pick" data-for="${esc(group.key)}.${esc(option.key)}" ${chosen.has(option.key) ? "" : 'style="display:none;"'}>
        <label class="was-pick-lbl">${esc(p.label)}</label>
        <select class="was-pick-sel" data-pick="${esc(pickKey(group.key, option.key, i))}">${opts}</select>
      </div>`;
    }).join("");

    return `<div class="was-row">
      <label class="was-opt-lbl" for="${id}">${input}<span class="was-opt-name">${esc(option.label)}</span></label>
      ${option.hint ? `<div class="was-hint">${esc(option.hint)}</div>` : ""}
      ${picks}
    </div>`;
  }).join("");

  return `<fieldset class="was-group">
    <legend class="was-group-title">${esc(group.label)}</legend>
    ${rows}
  </fieldset>`;
}

/**
 * Спрашивает ГМа. Возвращает ответы; закрытие окна крестиком — базовая версия
 * (в книге это существо без вариаций, а не «ничего не создалось»).
 */
export async function promptActorSetup(actor, setup) {
  const answers = defaultAnswers(setup);
  const labels = await collectLabels(setup);
  const content = `<form class="wh-actor-setup">
    <p class="was-lead">Книга даёт этому существу выбор. Отметьте версию — она применится к листу сразу.</p>
    ${setup.groups.map(g => groupHtml(g, answers, labels)).join("")}
    ${setup.source ? `<div class="was-source">${esc(setup.source)}</div>` : ""}
  </form>`;

  return new Promise(resolve => {
    let resolved = false;
    const finish = (value) => { if (!resolved) { resolved = true; resolve(value); } };

    new Dialog({
      title: `Вариации: ${actor.name}`,
      content,
      buttons: {
        apply: {
          icon: '<i class="fas fa-check"></i>', label: "Применить",
          callback: html => {
            const groups = {};
            html.find(".was-opt").each((_, el) => {
              if (!el.checked) return;
              (groups[el.dataset.group] ??= []).push(el.value);
            });
            // Группа без единой отметки должна остаться пустой, а не пропасть:
            // иначе план не отличит «ничего не выбрано» от «группы не было».
            for (const g of setup.groups) groups[g.key] ??= [];
            const picks = {};
            html.find(".was-pick-sel").each((_, el) => { picks[el.dataset.pick] = el.value; });
            finish({ groups, picks });
          }
        },
        base: {
          icon: '<i class="fas fa-user"></i>', label: "Базовая версия",
          callback: () => finish(answers)
        }
      },
      default: "apply",
      close: () => finish(answers),
      render: html => {
        // Селекты вложенного выбора идут за своей опцией.
        const sync = () => html.find(".was-pick").each((_, el) => {
          const [groupKey, optionKey] = el.dataset.for.split(".");
          const on = html.find(`.was-opt[data-group="${groupKey}"][value="${optionKey}"]`).is(":checked");
          el.style.display = on ? "" : "none";
        });
        html.find(".was-opt").on("change", sync);
        sync();
      }
    }, { classes: ["dialog", "warhammer-dbc", "wh-holo", "wh-actor-setup-dialog"], width: 520 }).render(true);
  });
}

/**
 * Применяет план: снимает лишнее, добавляет выбранное, правит числа и метит
 * актора флагом сделанного выбора. Флаг же не даёт диалогу открыться повторно
 * при копировании готового актора.
 */
export async function applySetupPlan(actor, plan) {
  // Снимаем по одному совпадению на строку: «вместо пистолета» — про один
  // пистолет, даже если у существа их два.
  const removeIds = [];
  for (const matcher of plan.remove) {
    const wanted = String(matcher.name).trim().toLowerCase();
    const item = actor.items.find(i =>
      !removeIds.includes(i.id)
      && (!matcher.type || i.type === matcher.type)
      && String(i.name).trim().toLowerCase() === wanted);
    if (item) removeIds.push(item.id);
    else plan.warnings.push(`Нечего снять: «${matcher.name}» на листе не найден.`);
  }
  if (removeIds.length) await actor.deleteEmbeddedDocuments("Item", removeIds);

  const docs = [];
  for (const uuid of plan.add) {
    const doc = await fromUuid(uuid);
    if (!doc) { plan.warnings.push(`Не найдено в компендиуме: ${uuid}`); continue; }
    const obj = doc.toObject();
    delete obj._id;
    docs.push(obj);
  }
  if (docs.length) await actor.createEmbeddedDocuments("Item", docs);

  const update = { ...applyDeltas(actor.system, plan.system) };

  // Групповые навыки лежат массивами записей: правится группа целиком, иначе
  // Foundry сольёт её по индексам и перепутает специализации местами.
  const merged = mergeGroupSkills(actor.system.groupSkills, plan.groupSkills, Object.keys(SKILL_RANKS));
  for (const [group, list] of Object.entries(merged)) update[`system.groupSkills.${group}`] = list;

  update[`flags.${SYSTEM}.setupApplied`] = { chosen: plan.chosen, at: Date.now() };
  await actor.update(update);

  return { added: docs.length, removed: removeIds.length };
}

/** Диалог + применение. Отдельно от хука, чтобы звать вручную с готового актора. */
export async function runActorSetup(actor) {
  const setup = readSetup(actor);
  if (!setup) return null;

  const answers = await promptActorSetup(actor, setup);
  const plan = buildSetupPlan(setup, answers);
  const result = await applySetupPlan(actor, plan);

  for (const w of plan.warnings) console.warn(`Warhammer DBC | Вариации (${actor.name}):`, w);
  if (plan.log.length) {
    ui.notifications?.info(`🧬 ${actor.name}: ${plan.log.join("; ")}.`);
    // НЕ карточка теста (wdbc-kuun): броска и Порога нет, это шёпот ГМу о том,
    // что за вариация досталась существу при перетаскивании. На общий
    // postTestCard не переводится и технически — нужны whisper GM и
    // alias-спикер, которых он не принимает.
    ChatMessage.create({
      content: `<div class="wh-roll-result"><div class="roll-header">🧬 Вариация: ${esc(actor.name)}</div>
        <ul style="margin:4px 0;padding-left:16px;font-size:.9em;">${plan.log.map(l => `<li>${esc(l)}</li>`).join("")}</ul>
        <div style="font-size:.8em;opacity:.7;">Добавлено предметов: ${result.added}, снято: ${result.removed}.</div></div>`,
      whisper: ChatMessage.getWhisperRecipients?.("GM") || [],
      speaker: { alias: actor.name }
    });
  }
  return plan;
}

// Очередь диалогов. Акторы приходят по одному хуку на каждого, а «Импортировать
// всё» из компендиума создаёт их пачкой — без очереди девять окон открылись бы
// поверх друг друга. Порог BATCH отличает осмысленное перетаскивание от пачки:
// дальше него варианты не спрашиваются, существа остаются базовыми.
const BATCH = 3;
let queue = Promise.resolve();
let waiting = 0;
let batchNotified = false;

function enqueueSetup(actor) {
  if (waiting >= BATCH) {
    if (!batchNotified) {
      batchNotified = true;
      ui.notifications?.info("Массовое создание акторов: вариации не спрашивались — существа базовые. "
        + "Нужную версию можно собрать вручную: game.warhammerDBC.runActorSetup(actor).");
    }
    return;
  }
  waiting++;
  queue = queue
    .then(() => runActorSetup(actor))
    .catch(e => console.error("Warhammer DBC | Вариации бестиария:", e))
    .finally(() => {
      waiting--;
      if (!waiting) batchNotified = false;
    });
}

/**
 * Хук создания актора. Диалог открывается только у ГМа, который сам создал
 * актора в мире; внутри компендиума, при программном создании
 * (`options.wdbcNoSetup`) и у копии уже настроенного актора — молчит.
 */
export function registerActorSetupHook() {
  Hooks.on("createActor", (actor, options, userId) => {
    try {
      if (userId !== game.user?.id || !game.user?.isGM) return;
      if (actor.pack) return;
      if (options?.wdbcNoSetup) return;
      if (actor.getFlag(SYSTEM, "setupApplied")) return;
      if (!readSetup(actor)) return;
      enqueueSetup(actor);
    } catch (e) {
      console.error("Warhammer DBC | Вариации бестиария:", e);
    }
  });
}
