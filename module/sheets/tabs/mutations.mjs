// module/sheets/tabs/mutations.mjs
// ════════════════════════════════════════════════════════════════════════════
//  МУТАЦИИ И ДАРЫ БОГОВ (корбук, стр. 440-460): бросок по общему пулу и пикер
//  всех записей обеих таблиц.
//
//  Функции принимают актора, а не лист: сюда переехали два метода листа
//  персонажа целиком, вместе с диалогами. Выбор результата (какой бросок
//  берётся, как ограничен сдвиг Бонусом Влияния) проверяется без Foundry —
//  test/sheets/mutations.test.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { mutationByRoll, giftByRoll, mutationCatalog,
         mutationItemData, GOD_GIFTS } from "../../constants/mutations.mjs";
import { centerPicker, pickerPos }     from "../picker-ui.mjs";
import { esc } from "../../helpers/utils.mjs";

/**
 * Бросок 1d100 по ОБЩЕМУ ПУЛУ — либо таблица Общих Мутаций (стр. 440), либо
 * таблица Даров выбранного Бога (стр. 453-460); тип выбирается в диалоге,
 * один и тот же бросок переинтерпретируется по нужной таблице. Сдвиг ±Inf.b
 * (если результат НЕ от Порчи за Провал) работает одинаково для обеих
 * веток — раньше был только у Мутаций. Неделимые бросают дважды и выбирают
 * результат — только для ветки Мутаций (по тексту книги, Дары привязаны к
 * конкретному Богу-покровителю и не имеют двойного броска).
 */
export async function rollMutationOrGift(actor) {
  const infB = actor.system.characteristics?.inf?.bonus ?? 0;
  const patron = actor.system.patronGod || "";
  const undivided = patron === "undivided";
  const roll1 = await new Roll("1d100").evaluate();
  const roll2 = undivided ? await new Roll("1d100").evaluate() : null;
  const defaultGod = GOD_GIFTS[patron] ? patron : Object.keys(GOD_GIFTS)[0];
  const godOptions = Object.entries(GOD_GIFTS)
    .map(([k, g]) => `<option value="${k}" ${k === defaultGod ? "selected" : ""}>${g.label}</option>`).join("");
  const resultName = (type, god, val) => type === "gift" ? (giftByRoll(god, val)?.name || "—") : mutationByRoll(val);

  const content = `
    <form class="wh-attack-form" style="padding:6px;">
      <div class="atk-dlg-row"><label>Тип:</label>
        <select id="mg-type" class="pm-input">
          <option value="mutation">Мутация (Общие, стр. 440)</option>
          <option value="gift">Дар Бога (стр. 453-460)</option>
        </select></div>
      <div class="atk-dlg-row" id="mg-god-row"><label>Бог-покровитель:</label>
        <select id="mg-god" class="pm-input">${godOptions}</select></div>
      <div class="atk-dlg-row"><label>Бросок:</label><span><b>${roll1.total}</b></span></div>
      ${roll2 ? `<div class="atk-dlg-row"><label>Второй (Неделимый):</label><span><b>${roll2.total}</b></span></div>
      <div class="atk-dlg-row" id="mg-which-row"><label>Использовать:</label>
        <select id="mg-which"><option value="1">Первый (${roll1.total})</option><option value="2">Второй (${roll2.total})</option></select></div>` : ""}
      <div class="atk-dlg-row">
        <label>Сдвиг (±Inf.b ${infB}):</label>
        <input type="number" id="mg-shift" value="0" min="-${infB}" max="${infB}"
               title="Только если результат НЕ от Порчи за Провал"/>
      </div>
      <div class="atk-dlg-row"><label>Итог:</label><b id="mg-result">${resultName("mutation", defaultGod, roll1.total)}</b></div>
    </form>`;

  new Dialog({
    title: "🧬 Мутация / Дар Бога",
    content,
    buttons: {
      ok: { label: "Получить", callback: async (html) => {
        const type  = String(html.find("#mg-type").val() || "mutation");
        const god   = String(html.find("#mg-god").val() || defaultGod);
        const base  = (roll2 && type === "mutation" && html.find("#mg-which").val() === "2") ? roll2.total : roll1.total;
        const shift = Math.max(-infB, Math.min(infB, parseInt(html.find("#mg-shift").val()) || 0));
        const val   = base + shift;
        const name  = resultName(type, god, val);
        const data  = foundry.utils.deepClone(mutationItemData(name, type === "gift" ? god : ""));
        delete data.folder; delete data.folderParent;
        const [item] = await actor.createEmbeddedDocuments("Item", [data]);
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: actor }),
          content: `<div class="wh-roll-result"><div class="roll-header">${type === "gift" ? `Дар ${GOD_GIFTS[god]?.label || god}` : "Мутация"}</div>
            <div class="roll-statline"><span class="roll-stat"><label>Бросок</label><b>${base}</b></span>
            ${shift ? `<span class="roll-stat"><label>Сдвиг</label><b>${shift > 0 ? "+" : ""}${shift}</b></span>` : ""}
            <span class="roll-stat"><label>Итог</label><b>${val}</b></span></div>
            <div class="roll-outcome"><b>${name}</b></div></div>`,
          rolls: [roll1, ...(roll2 ? [roll2] : [])]
        });
        item?.sheet?.render(true);
      }},
      cancel: { label: "Отмена" }
    },
    default: "ok",
    render: html => {
      const syncVisibility = () => {
        const type = html.find("#mg-type").val();
        html.find("#mg-god-row").toggle(type === "gift");
        html.find("#mg-which-row").toggle(!!roll2 && type === "mutation");
      };
      const upd = () => {
        const type  = html.find("#mg-type").val();
        const god   = html.find("#mg-god").val();
        const base  = (roll2 && type === "mutation" && html.find("#mg-which").val() === "2") ? roll2.total : roll1.total;
        const shift = Math.max(-infB, Math.min(infB, parseInt(html.find("#mg-shift").val()) || 0));
        html.find("#mg-result").text(resultName(type, god, base + shift));
      };
      syncVisibility();
      html.find("#mg-type").on("change", () => { syncVisibility(); upd(); });
      html.find("#mg-god, #mg-shift, #mg-which").on("input change", upd);
    }
  }, { classes: ["dialog", "warhammer-dbc", "wh-holo"], width: 420 }).render(true);
}

/**
 * Пикер общего пула Мутаций (стр. 440-452) и Даров Богов (стр. 453-460):
 * список прямо из таблиц книги, поэтому работает и до того, как соберётся
 * компендиум. Один объединённый пул — можно выбрать ЛЮБУЮ запись, не
 * ограничиваясь Богом-покровителем персонажа.
 */
export async function openMutationPicker(actor) {
  const cat = mutationCatalog();
  const row = (x) => `
    <div class="pick-row" data-name="${esc(x.name.toLowerCase())}">
      <div class="pick-head">
        <button type="button" class="pick-exp" title="Показать описание">▸</button>
        <span class="pick-name" title="Раскрыть">${esc(x.name)}</span>
        <span class="pick-req">d100 ${esc(x.range)}</span>
        <button type="button" class="pick-add" data-name="${esc(x.name)}" data-god="${esc(x.god)}"
                title="Добавить на лист">＋</button>
      </div>
      <div class="pick-desc" style="display:none;">${esc(x.text) || "<em>Описание ещё не перенесено из книги</em>"}</div>
    </div>`;
  const groups = [
    { label: "Общие мутации (стр. 440)", items: cat.common },
    ...cat.gifts.map(g => ({ label: `Дары — ${g.label}`, items: g.items }))
  ];

  const body = groups.map(g => `
    <div class="pick-group">
      <div class="pick-group-head">${esc(g.label)} <span class="pick-count">${g.items.length}</span></div>
      <div class="pick-group-body">${g.items.map(row).join("")}</div>
    </div>`).join("");

  new Dialog({
    title: "Добавить мутацию или Дар Бога",
    content: `<div class="wh-item-picker">
      <div class="pick-top"><input type="text" class="pick-search" placeholder="Поиск…"/></div>
      <div class="pick-list">${body}</div>
    </div>`,
    buttons: { close: { label: "Закрыть" } },
    default: "close",
    render: html => {
      centerPicker(html);
      html.find(".pick-add").on("click", async ev => {
        ev.preventDefault(); ev.stopPropagation();
        const { name, god } = ev.currentTarget.dataset;
        const data = foundry.utils.deepClone(mutationItemData(name, god));
        delete data.folder; delete data.folderParent;
        await actor.createEmbeddedDocuments("Item", [data]);
        ui.notifications.info(`Добавлено: ${name}`);
        $(ev.currentTarget).closest(".pick-row").addClass("just-added");
      });
      const toggle = (r) => {
        const d = r.querySelector(".pick-desc"), e = r.querySelector(".pick-exp");
        const open = d.style.display !== "none";
        d.style.display = open ? "none" : "block";
        e.textContent = open ? "▸" : "▾";
      };
      html.find(".pick-exp").on("click", ev => { ev.preventDefault(); toggle(ev.currentTarget.closest(".pick-row")); });
      html.find(".pick-name").on("click", ev => toggle(ev.currentTarget.closest(".pick-row")));
      html.find(".pick-search").on("input", ev => {
        const q = ev.currentTarget.value.toLowerCase().trim();
        // ВАЖНО: тело в фигурных скобках. classList.toggle возвращает булево, а
        // jQuery .each() прерывает обход, если колбэк вернул false — из-за этого
        // фильтр обрывался на первой же СОВПАВШЕЙ строке и остаток списка не
        // фильтровался вовсе.
        html.find(".pick-row").each((_, r) => {
          r.classList.toggle("pick-hidden", !!q && !(r.dataset.name || "").includes(q));
        });
        html.find(".pick-group").each((_, g) => {
          g.style.display = g.querySelectorAll(".pick-row:not(.pick-hidden)").length ? "" : "none";
        });
      });
    }
  }, { classes: ["dialog", "warhammer-dbc", "wh-holo", "wh-item-picker-dialog"], ...pickerPos(560, 640) }).render(true);
}
