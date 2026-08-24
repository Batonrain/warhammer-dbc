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
import { hasSubmutations }             from "../../rules/submutations.mjs";
import { rollSubmutation }             from "../../apps/submutations.mjs";
import { esc } from "../../helpers/utils.mjs";

/**
 * Все записи таблицы, достижимые набором бросков ± Inf.b (или без сдвига,
 * если результат от Порчи за Провал) — то же самое, что диалог показывает
 * списком под формой. Вынесено отдельно ради теста: как именно ограничен
 * сдвиг Бонусом Влияния, проверяется без Foundry — test/sheets/mutations.test.mjs.
 *
 * @param {"mutation"|"gift"} type
 * @param {string}  god     Ключ Бога-покровителя (для type "gift").
 * @param {number}  roll1   Первый бросок 1d100.
 * @param {?number} roll2   Второй бросок Неделимого (только для type "mutation").
 * @param {number}  infB    Бонус Влияния — задаёт диапазон сдвига в обе стороны.
 * @param {boolean} failed  От Порчи за Провал — закрывает и сдвиг, и второй бросок.
 * @returns {{name:string, range:string, text:string}[]} в порядке самой таблицы.
 */
export function mutationPool(type, god, roll1, roll2, infB, failed) {
  const cat = mutationCatalog();
  const source = type === "gift" ? (cat.gifts.find(g => g.god === god)?.items || []) : cat.common;
  const rolls = (type === "mutation" && roll2 != null && !failed) ? [roll1, roll2] : [roll1];
  const shifts = failed ? [0] : Array.from({ length: infB * 2 + 1 }, (_, i) => i - infB);
  const achievable = new Set();
  for (const r of rolls) for (const s of shifts) {
    const name = type === "gift" ? giftByRoll(god, r + s)?.name : mutationByRoll(r + s);
    if (name) achievable.add(name);
  }
  return source.filter(x => achievable.has(x.name));
}

/**
 * Бросок 1d100 по ОБЩЕМУ ПУЛУ — либо таблица Общих Мутаций (стр. 440), либо
 * таблица Даров выбранного Бога (стр. 453-460); тип выбирается в диалоге,
 * один и тот же бросок переинтерпретируется по нужной таблице.
 *
 * Сдвиг ±Inf.b больше не вводится вручную: диалог сам перебирает весь
 * диапазон через mutationPool() и выводит ВСЕ достижимые записи таблицы
 * разом списком внизу — клик по строке выбирает её как «Итог», стрелочка
 * разворачивает краткое описание, чтобы выбор был осознанным. Порча за
 * Провал закрывает и диапазон сдвига, и второй бросок Неделимых — тогда
 * достижима только запись под самим броском.
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
  const rollsLabel = roll2 ? `${roll1.total}, ${roll2.total}` : `${roll1.total}`;
  const poolFor = (type, god, failed) => mutationPool(type, god, roll1.total, roll2?.total ?? null, infB, failed);

  const optionRow = (x, god) => `
    <div class="pick-row" data-name="${esc(x.name)}" data-god="${esc(god)}">
      <div class="pick-head">
        <button type="button" class="pick-exp" title="Показать описание">▸</button>
        <span class="pick-name">${esc(x.name)}</span>
        <span class="pick-req">d100 ${esc(x.range)}</span>
      </div>
      <div class="pick-desc" style="display:none;">${esc(x.text) || "<em>Описание ещё не перенесено из книги</em>"}</div>
    </div>`;

  const defaultName = mutationByRoll(roll1.total);
  const content = `
    <form class="wh-attack-form" style="padding:6px;">
      <div class="atk-dlg-row"><label>Тип:</label>
        <select id="mg-type" class="pm-input">
          <option value="mutation">Мутация</option>
          <option value="gift">Дар Бога</option>
        </select></div>
      <div class="atk-dlg-row" id="mg-god-row"><label>Бог-покровитель:</label>
        <select id="mg-god" class="pm-input">${godOptions}</select></div>
      <div class="atk-dlg-row"><label>Бросок:</label><span><b>${rollsLabel}</b></span></div>
      <div class="atk-dlg-row">
        <label title="Мутация от Порчи за Провал не даёт ни сдвига ±Inf.b (${infB}), ни второго броска Неделимым — достижима только запись под самим броском">От Порчи за Провал:</label>
        <input type="checkbox" id="mg-fail"/>
      </div>
      <div class="atk-dlg-row"><label>Итог:</label><b id="mg-result">${defaultName}</b></div>
      <input type="hidden" id="mg-pick-name" value="${esc(defaultName)}"/>
      <input type="hidden" id="mg-pick-god" value=""/>
      <div class="wh-item-picker mg-pool" id="mg-pool"></div>
    </form>`;

  new Dialog({
    title: "🧬 Мутация / Дар Бога",
    content,
    buttons: {
      ok: { label: "Получить", callback: async (html) => {
        const type  = String(html.find("#mg-type").val() || "mutation");
        const god   = String(html.find("#mg-pick-god").val() || "");
        const failed = html.find("#mg-fail").is(":checked");
        const name  = String(html.find("#mg-pick-name").val() || defaultName);
        const data  = foundry.utils.deepClone(await mutationItemData(name, type === "gift" ? god : ""));
        delete data.folder; delete data.folderParent; delete data._id;
        const [item] = await actor.createEmbeddedDocuments("Item", [data]);
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: actor }),
          content: `<div class="wh-roll-result"><div class="roll-header">${type === "gift" ? `Дар ${GOD_GIFTS[god]?.label || god}` : "Мутация"}</div>
            <div class="roll-statline"><span class="roll-stat"><label>Бросок</label><b>${rollsLabel}</b></span></div>
            <div class="roll-outcome"><b>${esc(name)}</b></div></div>`,
          rolls: [roll1, ...(roll2 && !failed ? [roll2] : [])]
        });
        // Субмутация бросается сразу за мутацией — она часть той же выдачи
        // (стр. 440), и её сдвиг тоже закрыт Порчей за Провал.
        if (item && hasSubmutations(item.system?.benefit || ""))
          await rollSubmutation(item, { actor, fromFailure: failed });
        item?.sheet?.render(true);
      }},
      cancel: { label: "Отмена" }
    },
    default: "ok",
    render: html => {
      const select = (row, name, god) => {
        html.find(".mg-pool .pick-row").each((_, r) => r.classList.remove("mg-selected"));
        row?.classList.add("mg-selected");
        html.find("#mg-pick-name").val(name);
        html.find("#mg-pick-god").val(god);
        html.find("#mg-result").text(name || "—");
      };
      const renderPool = () => {
        const type = html.find("#mg-type").val();
        const god = html.find("#mg-god").val();
        const failed = html.find("#mg-fail").is(":checked");
        const pool = poolFor(type, god, failed);
        const pickGod = type === "gift" ? god : "";
        html.find("#mg-pool").html(pool.map(x => optionRow(x, pickGod)).join("")
          || "<p><em>Нет доступных результатов</em></p>");
        html.find(".mg-pool .pick-exp").on("click", ev => {
          ev.preventDefault(); ev.stopPropagation();
          const row = ev.currentTarget.closest(".pick-row");
          const desc = row.querySelector(".pick-desc");
          const open = desc.style.display !== "none";
          desc.style.display = open ? "none" : "block";
          ev.currentTarget.textContent = open ? "▸" : "▾";
        });
        html.find(".mg-pool .pick-head").on("click", ev => {
          const row = ev.currentTarget.closest(".pick-row");
          select(row, row.dataset.name, row.dataset.god);
        });
        // Умолчание — бросок без сдвига (первый бросок при Неделимом).
        const base = type === "gift" ? giftByRoll(god, roll1.total)?.name : mutationByRoll(roll1.total);
        const baseRow = pool.find(x => x.name === base) ? html.find(`.mg-pool .pick-row[data-name="${CSS.escape(base ?? "")}"]`)[0] : null;
        select(baseRow, base || pool[0]?.name || "—", pickGod);
      };
      html.find("#mg-type, #mg-fail").on("change", () => {
        html.find("#mg-god-row").toggle(html.find("#mg-type").val() === "gift");
        renderPool();
      });
      html.find("#mg-god").on("change", renderPool);
      html.find("#mg-god-row").toggle(html.find("#mg-type").val() === "gift");
      renderPool();
    }
  }, { classes: ["dialog", "warhammer-dbc", "wh-holo"], width: 480 }).render(true);
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
        const data = foundry.utils.deepClone(await mutationItemData(name, god));
        delete data.folder; delete data.folderParent; delete data._id;
        const [item] = await actor.createEmbeddedDocuments("Item", [data]);
        ui.notifications.info(`Добавлено: ${name}`);
        // Мутация с субмутациями сразу спрашивает свою строку — как и при броске.
        if (item && hasSubmutations(item.system?.benefit || ""))
          await rollSubmutation(item, { actor });
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
