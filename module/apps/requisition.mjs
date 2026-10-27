// module/apps/requisition.mjs
// ════════════════════════════════════════════════════════════════════════
//  «Достать снаряжение» — тест Реквизиции (Foundry-обвязка к
//  module/rules/requisition.mjs; кнопка во вкладке «Снаряжение» листа).
//
//  Порядок: 1) предмет — из Обозревателя компендиумов или вручную; 2) окно
//  «Редкость / Качество / Количество»: Редкость берётся у предмета
//  (system.availability, у Записи ритуала — system.record), Талантам,
//  снижающим Редкость, класс предмета известен сам; 3) обычное окно теста
//  Inf на листе — модификатор таблиц книги (стр. 165) уже вписан в поле
//  «Модификатор», галочки Талантов (Чрезмерное Богатство, Сеть Контактов,
//  Дело Фактотума) и авто-бонус Повелителя Войны приходят из реестра правил
//  (rules/requisition-talents.mjs); 4) карточка «откуда модификатор» и, при
//  Успехе, выдача предмета.
//
//  Режим «Узел корабля» (Книга Пустоты, «Реквизиция узлов»): узел выбирается из
//  пака ship-components, Редкость берётся у узла (system.rarity), вместо
//  Количества — таблица по типу узла (оружейные −30, эфирные −20, энергетические
//  −10, структурные 0; rules/requisition.mjs::NODE_TYPES); предмет персонажу не
//  выдаётся — узел ставят на корабль сами; «+10» Дела Фактотума цепляется
//  автоматически (rules/requisition-talents.mjs).
//
//  Книга о сроках Реквизиции молчит («тест на Inf+0») — времени и ограничения
//  числа попыток здесь нет, их ведёт стол. Срок установки узла (Книга Пустоты:
//  от 2 недель, +1 неделя за каждое SP) тоже не ведётся — решение владельца
//  26.10.2026.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { AVAILABILITY } from "../constants/items.mjs";
import { ITEM_QUALITY, ITEM_QUALITY_LIST } from "../constants/quality.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { openCompendiumBrowser } from "./compendium-browser.mjs";
import {
  REQUISITION_PACKS, NODE_PACKS, NODE_TYPES, nodeTypeOf, itemRarity, isConsumableItem, requisitionPlan,
  requisitionSummaryLines, hasRequisitionTalent
} from "../rules/requisition.mjs";

/** Сколько отдельных копий создаётся предмету без поля «Количество» (оружие, броня). */
const MAX_COPIES = 10;

const optionsHtml = (entries, selected) => entries
  .map(([value, label]) => `<option value="${esc(String(value))}"${String(value) === String(selected) ? " selected" : ""}>${esc(label)}</option>`)
  .join("");

/**
 * Окно «Редкость / Качество / Количество». null — отмена.
 * @param {{node?: boolean}} [opts] node — режим «Узел корабля»: вместо Количества
 *   выбор типа узла, предмет не выдаётся
 */
async function askDetails(actor, item, { node = false } = {}) {
  const rarity = itemRarity(item);
  const manual = !item;
  const hint = item && rarity == null
    ? `<p class="hint" style="margin:2px 0 6px;">⚠ У предмета нет Редкости (импланты без книжной Редкости, Ритуалы без Записи не продаются). Укажите её вручную, если ГМ разрешает.</p>`
    : "";
  const content = `
    <div class="wh-requisition-form" style="display:grid;gap:6px;min-width:340px;">
      ${hint}
      <label>Предмет ${item
        ? `<b>${esc(item.name)}</b>`
        : `<input type="text" name="name" placeholder="название" autofocus/>`}</label>
      <label>Редкость
        <select name="rarity">${optionsHtml(Object.entries(AVAILABILITY), rarity ?? 0)}</select></label>
      <label>Качество
        <select name="quality">${optionsHtml(ITEM_QUALITY_LIST.map(k => [k, `${ITEM_QUALITY[k].abbr} · ${ITEM_QUALITY[k].label}`]), node ? (item?.system?.quality ?? "common") : "common")}</select></label>
      ${node ? `
      <label title="Книга Пустоты, таблица Реквизиции узлов (вместо Количества). Спорные узлы — двигатели, Поля Геллера, астропатические, окулумы, мостики — считаются структурными; ГМ может выбрать иначе.">
        Тип узла <select name="nodeType">${optionsHtml(Object.entries(NODE_TYPES).map(([k, t]) => [k, `${t.label} (${t.mod > 0 ? "+" : (t.mod < 0 ? "−" : "")}${Math.abs(t.mod)})`]), nodeTypeOf(item))}</select></label>` : `
      <label>Количество <input type="number" name="quantity" value="1" min="1" step="1"/></label>
      <label title="Гранаты, магазины, медикаменты: книга считает их на 2 ступени Количества легче (стр. 165)">
        <input type="checkbox" name="consumable"${(item ? isConsumableItem(item) : false) ? " checked" : ""}/> Расходное (гранаты, магазины, медикаменты)</label>`}
      ${manual ? `
      <fieldset style="border:1px solid #6665;padding:2px 6px;"><legend>Вид предмета (для Талантов, снижающих Редкость)</legend>
        <label><input type="checkbox" name="exotic"/> Экзотическое</label>
        <label title="Кибернетика, Бионика, Псибернетика, Механикус, Скитарии — вся имплант-техника (Повелитель Войны)"><input type="checkbox" name="cybernetic"/> Кибернетика / Бионика / Механикус / Скитарии</label>
        <label><input type="checkbox" name="legion"/> Легион</label>
        <label><input type="checkbox" name="ritual"/> Запись ритуала</label>
      </fieldset>` : ""}
      <label title="Книга: предмета может не быть в пределах досягаемости контактов, или его мало. Поправка ГМа — число, оно просто прибавится.">
        Поправка ГМа (местная распространённость) <input type="number" name="local" value="0" step="5"/></label>
      ${hasRequisitionTalent(actor, "whateverYouWant") ? `
      <label title="Талант «Что Захотите»: когда Архонт требует реквизицию для своих нужд, бонус F.b×2 (с вашего листа) + Inf.b Архонта. Впишите Бонус Влияния Архонта числом; оставьте пустым, если реквизиция не по его требованию.">
        Inf.b Архонта (реквизиция по требованию Архонта) <input type="number" name="archonInf" value="" min="0" step="1" placeholder="пусто — нет"/></label>` : ""}
      ${item && !node ? `<label><input type="checkbox" name="grant" checked/> При Успехе выдать предмет персонажу</label>` : ""}
    </div>`;
  const get = (f, n) => f.elements.namedItem(n);
  const values = await foundry.applications.api.DialogV2.prompt({
    window: { title: node ? `Достать узел корабля — ${actor.name}` : `Достать снаряжение — ${actor.name}` },
    classes: ["warhammer-dbc", "wh-holo"],
    content,
    rejectClose: false,
    ok: {
      label: "К тесту Inf",
      callback: (_ev, btn) => {
        const f = btn.form;
        return {
          name: get(f, "name")?.value?.trim() ?? "",
          rarity: Number(get(f, "rarity").value),
          quality: get(f, "quality").value,
          quantity: Number(get(f, "quantity")?.value) || 1,
          consumable: !!get(f, "consumable")?.checked,
          nodeType: get(f, "nodeType")?.value ?? null,
          cls: manual ? {
            exotic: !!get(f, "exotic").checked, cybernetic: !!get(f, "cybernetic").checked,
            legion: !!get(f, "legion").checked, ritual: !!get(f, "ritual").checked
          } : null,
          local: Number(get(f, "local").value) || 0,
          // Пусто — не по требованию Архонта (null), число — Inf.b Архонта.
          archonInf: get(f, "archonInf")?.value?.trim() ? Number(get(f, "archonInf").value) : null,
          grant: !!get(f, "grant")?.checked
        };
      }
    }
  }).catch(() => null);
  return values;
}

/** Выдать добытое: предмет с полем «Количество» — одной записью, остальной — копиями. */
async function grantRequisitioned(actor, item, plan) {
  const data = item.toObject();
  delete data._id;
  const system = data.system ?? (data.system = {});
  if ("quality" in system) system.quality = plan.quality;
  const stackable = "quantity" in system;
  let copies = 1;
  // Базовое Количество записи — упаковка («Упаковка 10 таблеток»): умножаем,
  // а не затираем (так же считает Мастер создания, character-wizard.mjs).
  if (stackable) system.quantity = (Number(system.quantity) || 1) * plan.quantity;
  else copies = Math.min(plan.quantity, MAX_COPIES);
  await actor.createEmbeddedDocuments("Item", Array.from({ length: copies }, () => foundry.utils.deepClone(data)));
  const rest = !stackable && plan.quantity > copies ? plan.quantity - copies : 0;
  return { copies, rest, stackable };
}

/**
 * Кнопка «Достать снаряжение» на листе персонажа.
 * @param {Actor} actor
 * @param {object} [sheet] лист, у которого есть _rollCharacteristic (окно теста)
 */
export async function openRequisition(actor, sheet = actor?.sheet) {
  if (!actor) return;
  if (typeof sheet?._rollCharacteristic !== "function") {
    return ui.notifications.warn(`У актора «${actor.name}» нет обычного листа персонажа — тест Реквизиции так не открыть.`);
  }

  const how = await foundry.applications.api.DialogV2.wait({
    window: { title: "Достать снаряжение" },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<p style="margin:4px 6px;">Реквизиция — тест на Inf с модификаторами Редкости, Качества и Количества (стр. 165). Что добываем? Для узла корабля вместо Количества считается тип узла (Книга Пустоты).</p>`,
    rejectClose: false,
    buttons: [
      { action: "pick", label: "Выбрать из компендиума", default: true },
      { action: "manual", label: "Ввести вручную" },
      { action: "node", label: "Узел корабля" }
    ]
  }).catch(() => null);
  if (!how) return;

  const node = how === "node";
  let item = null;
  if (how === "pick" || node) {
    const picked = await openCompendiumBrowser(false, node
      ? { pack: [...NODE_PACKS], filters: { type: "component" }, budget: { mode: "count", value: 1, min: 1 },
          prompt: "Достать узел корабля: какой именно?" }
      : { pack: [...REQUISITION_PACKS], filters: {}, budget: { mode: "count", value: 1, min: 1 },
          prompt: "Достать снаряжение: что именно?" });
    const uuid = Array.isArray(picked) ? picked[0] : picked;
    if (!uuid) return;
    item = await fromUuid(uuid).catch(() => null);
    if (!item) return ui.notifications.warn("Не удалось получить выбранный предмет.");
  }

  const v = await askDetails(actor, item, { node });
  if (!v) return;
  if (!item && !v.name) return ui.notifications.warn("Укажите название — что добываем.");

  const plan = requisitionPlan(actor, {
    item, name: v.name, rarity: v.rarity, quantity: v.quantity, quality: v.quality,
    consumable: v.consumable, cls: v.cls ?? undefined, local: v.local, archonInf: v.archonInf,
    node, nodeType: node ? v.nodeType : undefined
  });

  const inf = Number(actor.system?.characteristics?.inf?.total) || 0;
  // label вставляется в шапку окна и карточки теста Inf как есть, без экранирования.
  const result = await sheet._rollCharacteristic(`Реквизиция: ${esc(plan.label)}`, "Inf", inf, "inf", false, {
    presetModifier: plan.total, rollContext: plan.rollContext
  });
  if (!result) return;   // окно теста закрыли без броска

  let granted = "";
  if (result.success && item && v.grant && !node) {
    const g = await grantRequisitioned(actor, item, plan);
    granted = `Выдано: <b>${esc(item.name)}</b>${g.stackable ? ` ×${plan.quantity}` : (g.copies > 1 ? ` ×${g.copies}` : "")}.`
      + (g.rest ? ` Ещё ${g.rest} шт. впишите вручную — копий создаётся не больше ${MAX_COPIES}.` : "");
  }

  await postTestCard(actor, {
    icon: rollIcon("gear", "#c9a86a"),
    title: `${esc(actor.name)} — Реквизиция: ${esc(plan.label)}`,
    lines: [
      ...requisitionSummaryLines(plan).map(l => `<div class="roll-threshold">${esc(l)}</div>`),
      granted ? `<div>${granted}</div>` : ""
    ],
    outcome: result.success
      ? `<span class="roll-success">Достал — Успех (${result.deg})</span>`
      : `<span class="roll-failure">Не достал — Провал (${result.deg})</span>`,
    sections: [
      result.success && !granted
        ? `<div style="opacity:.75">${node
          ? `Узел «${esc(item?.name ?? plan.label)}» добыт — поставьте его на корабль сами.`
          : `Предмет впишите на лист сами${item ? "" : " (выбран вручную)"}.`}</div>` : ""
    ]
  }, { sound: false });   // режим броска соблюдается: карточка раскрывает исход
}
