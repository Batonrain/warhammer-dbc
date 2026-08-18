// module/sheets/item-picker.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Общий пикер Талантов и Черт. Изначально жил в листе персонажа, но им уже
//  пользуется Орда; поэтому расчёт и диалог принимают актора, а не лист.
// ════════════════════════════════════════════════════════════════════════════

import { CHARACTERISTICS, APTITUDES } from "../constants/characteristics.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../constants/skills.mjs";
import { talentCostXP, aptitudeCat, charAptitudeSet, ALIGN_LABEL,
         raceAllyTalent, dynamicAptKind, CHAR_APTITUDES,
         resolveTalentAptitudes } from "../constants/advancement.mjs";
import { cultureCat, resolveCultureFx } from "../constants/legions.mjs";
import { checkRequirement } from "../constants/talent-requirements.mjs";
import { DREADNOUGHT_PILOT_FLAG } from "../rules/dreadnought.mjs";
import { masteryTargets, masteryAptitudes } from "../rules/mastery-targets.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { isMinionTalent } from "../rules/minion-build.mjs";
import { promptMinionSlot, applyMinionSlot } from "../apps/minion-talent.mjs";
import { centerPicker, pickerPos } from "./picker-ui.mjs";
import { esc } from "../helpers/utils.mjs";

function cultFxOf(actor) {
  const gs = actor?.system?.geneSeed;
  if (!gs) return null;
  return resolveCultureFx(gs.cultureLegion || gs.legion, gs.cultureChapter || gs.chapter);
}

/**
 * Категория таланта для расчёта цены: раса может делать талант всегда
 * Дружественным (Total Recall у Астартес), иначе решает культура легиона.
 */
export function talentCategory(actor, name, folder = "") {
  if (raceAllyTalent(actor?.system?.race, name)) return "ally";
  return cultureCat("talent", name, folder, cultFxOf(actor));
}

/**
 * Доступность целой папки-группы в пикере Талантов по условиям листа
 * (не путать с requirement отдельного таланта — тут гейтится вся папка).
 * Возвращает null (открыто) либо причину блокировки для бейджа/тултипа.
 */
export function talentGroupLock(actor, kind, parent, folderName) {
  if (kind !== "talent") return null;
  const sys = actor?.system || {};
  const items = actor?.items || [];
  const DRUKHARI_RACES = ["drukhari", "truebornDrukhari", "mandrake", "wrack"];

  if (parent === "Книга Пустоты" && folderName === "Ген навигатора") {
    const has = items.some(i => i.type === "trait" && i.name === "Navigator's Gen / Ген Навигатора");
    return has ? null : "Нужна Черта Navigator's Gen / Ген Навигатора";
  }
  if (parent === "Элитные архетипы") {
    // Архетип бывает и предметом на листе, и строкой в шапке: предметом — когда
    // куплен пикером, строкой — когда вписан руками или пришёл со старого листа.
    const has = sys.eliteArchetype === folderName
      || (sys.eliteArchetypesExtra || []).includes(folderName)
      || items.some(i => i.type === "eliteArchetype" && i.name === folderName);
    return has ? null : `Нужен Элитный архетип «${folderName}»`;
  }
  if (parent === "Таланты одержимых") {
    return sys.possessed ? null : "Нужна включённая опция «Одержимый» (вкладка Записи)";
  }
  if (parent === "Таланты Астартес" && folderName === "Повелители Ночи") {
    return sys.geneSeed?.legion === "VIII" ? null : "Нужно Геносемя Повелителей Ночи (или одной из их варбанд)";
  }
  if (parent === "Книга Пустоты" && folderName === "Псайкер") {
    return (Number(sys.psyker?.rating) || 0) > 0 ? null : "Нужен Пси-Рейтинг больше 0";
  }
  if (!parent && folderName.startsWith("Экзодиты — ")) {
    return sys.race === "exodite" ? null : "Нужна раса Экзодит";
  }
  if (!parent && folderName === "Друкхари") {
    return DRUKHARI_RACES.includes(sys.race) ? null : "Нужна раса Друкхари";
  }
  if (!parent && folderName === "Азуриани") {
    return sys.race === "azuriane" ? null : "Нужна раса Азуриане";
  }
  if (!parent && folderName.startsWith("Арлекины — ")) {
    return sys.race === "harlequin" ? null : "Нужна раса Арлекин";
  }
  if (!parent && folderName === "Иннари") {
    return sys.race === "ynnari" ? null : "Нужна раса Иннари";
  }
  if (!parent && folderName === "Псайкана") {
    return (Number(sys.psyker?.rating) || 0) > 0 ? null : "Нужен Пси-Рейтинг больше 0";
  }
  if (!parent && folderName === "Скитарии") {
    const has = items.some(i => i.type === "implant" && i.name === "Skitarii War Plate / Боевые Латы Скитарии");
    return has ? null : "Нужны установленные Боевые Латы Скитарии";
  }
  if (!parent && folderName === "Таланты Боли") {
    return DRUKHARI_RACES.includes(sys.race) ? null : "Нужна раса Друкхари";
  }
  if (!parent && (folderName === "Механикум" || folderName === "Техномистик")) {
    const has = items.some(i => i.type === "trait" && i.name === "Mechanicum Implants / Импланты Механикум");
    return has ? null : "Нужна Черта Mechanicum Implants / Импланты Механикум";
  }
  // Возможность, а не раса: доступ открывает правило «astartes.geneseed»
  // (module/rules/library/astartes.mjs). Любая другая раса с Геносеменем
  // получит ту же папку из своих данных, без правки этой строки.
  if (!parent && folderName === "Геносемя") {
    return hasRuleFlag(actor, "talents.geneSeed") ? null : "Нужно Геносемя (раса Астартес)";
  }
  // Таланты Дредноутов (Книга Машин, стр. 58) книга даёт только заключённому в
  // саркофаг. Возможность раздаёт источник «dreadnought» (module/rules/
  // sources.mjs) по месту экипажа с ролью «пилот» — то есть по связи, которая
  // живёт на ЧУЖОМ акторе, и в полях самого персонажа её не найти.
  if (!parent && folderName === "Дредноуты") {
    return hasRuleFlag(actor, DREADNOUGHT_PILOT_FLAG)
      ? null : "Нужно быть назначенным пилотом Дредноута";
  }
  return null;
}

/**
 * Список вариантов привязки для Mastery / Beyond Human (стр. 62) с ценой
 * каждого: талант наследует ОБЕ склонности выбранной Характеристики/Навыка.
 * @returns {{key,label,apts,cat,cost}[]} отсортировано по возрастанию цены
 */
export function dynamicTalentOptions(actor, doc, kind, charApts) {
  const defs = { skills: SKILLS_DEF, groupSkills: GROUP_SKILLS_DEF };
  const tier = doc.system?.tier || 3;
  // «Мастерство» владеет не абстрактным Навыком, а конкретным: у групп это
  // специализация («Запретные знания (Демоны)»), и склонности берутся у неё —
  // у Навигации (Варп) первая склонность Воля, а не Интеллект группы.
  const src  = kind === "char"
    ? Object.entries(CHAR_APTITUDES).map(([k]) => [k, CHARACTERISTICS[k]?.label || k.toUpperCase()])
    : masteryTargets().map(t => [t.key, t.label]);
  return src.map(([key, label]) => {
    const apts = kind === "char"
      ? resolveTalentAptitudes(doc.name, doc.system?.aptitudes || [], key, defs)
      : masteryAptitudes(key);
    const cat  = aptitudeCat(charApts, apts);
    return { key, label, apts, cat, cost: talentCostXP(tier, apts, charApts,
      talentCategory(actor, label)) };
  }).sort((a, b) => a.cost - b.cost || a.label.localeCompare(b.label, "ru"));
}

/** Компактная запись «мин–макс XP» для бейджа в пикере. */
export function dynamicTalentCostRange(actor, doc, charApts, kind) {
  const opts = dynamicTalentOptions(actor, doc, kind, charApts);
  if (!opts.length) return "?";
  const lo = opts[0].cost, hi = opts[opts.length - 1].cost;
  return lo === hi ? String(lo) : `${lo}–${hi}`;
}

/**
 * Диалог привязки Mastery / Beyond Human: выбор Характеристики или Навыка,
 * от которого талант берёт склонности (и, как следствие, цену).
 */
export function promptDynamicAptTalent(actor, doc, kind, charApts) {
  const opts = dynamicTalentOptions(actor, doc, kind, charApts);
  const what = kind === "char" ? "Характеристика" : "Навык";
  const rows = opts.map(o =>
    `<option value="${esc(o.key)}" data-cost="${o.cost}" data-cat="${o.cat}">
       ${esc(o.label)} — ${o.cost} XP (${ALIGN_LABEL[o.cat]})
     </option>`).join("");

  return new Promise(resolve => {
    new Dialog({
      title: `${doc.name}: выбор привязки`,
      content: `
        <form class="wh-dyn-apt">
          <p class="dyn-hint">Талант наследует склонности выбранн${kind === "char" ? "ой Характеристики" : "ого Навыка"}
             (стр. 62), поэтому от выбора зависит цена (стр. 23-24).</p>
          <div class="atk-dlg-row">
            <label>${what}:</label>
            <select id="dyn-apt-sel" class="pm-input pm-wide">${rows}</select>
          </div>
          <div class="dyn-preview" id="dyn-preview"></div>
        </form>`,
      buttons: {
        ok: {
          label: "Купить",
          callback: html => {
            const key = String(html.find("#dyn-apt-sel").val() || "");
            resolve(opts.find(o => o.key === key) || null);
          }
        },
        cancel: { label: "Отмена", callback: () => resolve(null) }
      },
      default: "ok",
      close: () => resolve(null),
      render: html => {
        const upd = () => {
          const o = opts.find(x => x.key === String(html.find("#dyn-apt-sel").val() || ""));
          if (!o) return;
          html.find("#dyn-preview").html(
            `<span class="pick-cost cost-${o.cat}">${o.cost} XP</span>
             <span class="dyn-apts">склонности: ${o.apts.map(a => APTITUDES[a] || a).join(" + ")}</span>`);
        };
        html.find("#dyn-apt-sel").on("change", upd);
        upd();
      }
    }, { classes: ["dialog", "warhammer-dbc", "wh-holo", "wh-dyn-apt-dialog"], width: 460 }).render(true);
  });
}

/**
 * Пикер добавления Талантов/Черт прямо с листа (без лазания в компендиум).
 * Группировка по типам корбука (папки компендиума, стр. 62-105) + Аэльдари.
 * Поиск, раскрытие описания стрелкой, добавление по «＋». kind: "talent"|"trait".
 */
export async function openItemPicker(actor, kind) {
  const PACKS = { trait: "warhammer-dbc.traits", mutation: "warhammer-dbc.mutations",
                  talent: "warhammer-dbc.talents" };
  const packName = PACKS[kind] || PACKS.talent;
  const pack = game.packs.get(packName);
  if (!pack) return ui.notifications.warn(`Компендиум не найден: ${packName}`);
  const docs = await pack.getDocuments();
  // Группировка по папкам (учёт родителя) + порядок по folder.sort (порядок корбука).
  const groups = new Map();
  for (const d of docs) {
    const f = d.folder;
    const parent = f?.folder?.name || "";
    const label  = f ? (parent ? `${parent} · ${f.name}` : f.name) : "Прочее";
    const sort   = (f?.folder?.sort ?? 900000) * 1000 + (f?.sort ?? 0);
    const lock   = f ? talentGroupLock(actor, kind, parent, f.name) : null;
    if (!groups.has(label)) groups.set(label, { sort, items: [], lock });
    groups.get(label).items.push(d);
  }
  const ordered = [...groups.entries()].sort((a, b) => a[1].sort - b[1].sort || a[0].localeCompare(b[0], "ru"));
  const kindLabel = kind === "trait" ? "черты" : (kind === "mutation" ? "мутации" : "таланта");
  // Склонности персонажа — для авто-цены таланта (стр. 23-24).
  // У Орды нет ни Склонностей, ни Опыта: цены не показываем и не начисляем.
  const hasXP    = Array.isArray(actor.system.aptitudes);
  const charApts = charAptitudeSet(actor.system.aptitudes || []);

  const body = ordered.map(([label, g]) => {
    const rows = g.items
      .sort((a, b) => ((a.system.tier || 0) - (b.system.tier || 0)) || a.name.localeCompare(b.name, "ru"))
      .map(d => {
        const tier = (kind === "talent" && d.system.tier) ? `<span class="pick-tier">Ур.${d.system.tier}</span>` : "";
        // Требования сверяются с листом: невыполненные подсвечиваются красным.
        const chk  = d.system.requirement ? checkRequirement(actor, d.system.requirement)
                                          : { state: "ok", unmet: [] };
        const reqTitle = chk.state === "fail"
          ? `Не выполнено: ${esc(chk.unmet.join(", "))}`
          : (chk.state === "unknown" ? "Требование не удалось проверить автоматически" : "Требования выполнены");
        const req  = d.system.requirement
          ? `<span class="pick-req pick-req-${chk.state}" title="${reqTitle}">${esc(d.system.requirement)}</span>`
          : "";
        const ben  = esc(d.system.benefit || d.system.description || "—");
        let cost = "";
        if (kind === "talent" && hasXP) {
          // Mastery / Beyond Human наследуют склонности выбранной Х-ки/Навыка
          // (стр. 62) — цена станет известна только после выбора привязки.
          const dyn = dynamicAptKind(d.name);
          if (dyn) {
            const range = dynamicTalentCostRange(actor, d, charApts, dyn);
            cost = `<span class="pick-cost cost-dyn" title="Склонности «как у ${dyn === "char" ? "Характеристики" : "Навыка"}» — цена зависит от выбора при покупке (стр. 62)">${range} XP</span>`;
          } else {
            const forced = talentCategory(actor, d.name, d.folder);
            const cat = forced === "ally" ? "ally" : aptitudeCat(charApts, d.system.aptitudes || []);
            const xp  = talentCostXP(d.system.tier, d.system.aptitudes || [], charApts,
              talentCategory(actor, d.name, d.folder),
              { name: d.name, patron: actor.system.patronGod });
            cost = `<span class="pick-cost cost-${cat}" title="${ALIGN_LABEL[cat]} — совпадений склонностей: ${(d.system.aptitudes||[]).filter(a=>charApts.has(a)).length}">${xp} XP</span>`;
          }
        }
        const addBtn = g.lock
          ? `<button type="button" class="pick-add" data-id="${d.id}" disabled title="${esc(g.lock)}">🔒</button>`
          : `<button type="button" class="pick-add" data-id="${d.id}" title="Купить и добавить на лист">＋</button>`;
        return `<div class="pick-row${chk.state === "fail" ? " pick-unmet" : ""}${g.lock ? " pick-row-locked" : ""}" data-name="${esc(String(d.name).toLowerCase())}" data-req="${chk.state}">
          <div class="pick-head">
            <button type="button" class="pick-exp" title="Показать описание">▸</button>
            <span class="pick-name" title="Раскрыть">${esc(d.name)}</span>${tier}${req}${cost}
            ${addBtn}
          </div>
          <div class="pick-desc" style="display:none;">${ben}</div>
        </div>`;
      }).join("");
    const unmet = (rows.match(/class="pick-row[^"]*pick-unmet/g) || []).length;
    const lockHtml = g.lock
      ? `<span class="pick-count pick-count-locked" title="${esc(g.lock)}">🔒 ${esc(g.lock)}</span>` : "";
    return `<div class="pick-group pick-collapsed${g.lock ? " pick-group-locked" : ""}">
      <div class="pick-group-head" title="Свернуть / развернуть">
        <span class="pick-caret">▸</span>${esc(label)}
        <span class="pick-count">${g.items.length}</span>
        ${unmet ? `<span class="pick-count pick-count-unmet" title="Требования не выполнены">${unmet}</span>` : ""}
        ${lockHtml}
      </div>
      <div class="pick-group-body">${rows}</div></div>`;
  }).join("");

  // Гейтинг папок действует только у Талантов — только там и показываем
  // управление им (скрыть недоступное / разблокировать покупку).
  const gateControls = kind === "talent" ? `
    <div class="pick-top pick-top-gate">
      <label class="pick-hide-locked-label">
        <input type="checkbox" class="pick-hide-locked-cb"/> Скрывать недоступные
      </label>
      <button type="button" class="pick-force-unlock"
              title="Разблокирует покупку талантов из закрытых групп, даже если персонаж не подходит под условие">
        🔒 Разрешить покупку при несоответствии
      </button>
    </div>` : "";

  const content = `<div class="wh-item-picker">
    <div class="pick-top">
      <input type="text" class="pick-search" placeholder="Поиск ${kindLabel}…"/>
      <button type="button" class="pick-custom" title="Создать свой ${kindLabel} с нуля">＋ Своё</button>
    </div>
    ${gateControls}
    <div class="pick-list">${body || "<em>Пусто</em>"}</div>
  </div>`;

  new Dialog({
    title: kind === "trait" ? "Добавить черту" : (kind === "mutation" ? "Добавить мутацию / Дар" : "Добавить талант"),
    content,
    buttons: { close: { label: "Закрыть" } },
    default: "close",
    render: html => {
      centerPicker(html);
      // Скрыть недоступные группы / разблокировать покупку из них вопреки
      // условию — только пока диалог открыт, ничего не сохраняется.
      let hideLocked = false;
      let forceUnlock = false;
      // Своё с нуля — пустой предмет + открыть его лист.
      html.find(".pick-custom").on("click", async ev => {
        ev.preventDefault();
        const item = await Item.create({ name: kind === "trait" ? "Новая черта" : (kind === "mutation" ? "Новая мутация" : "Новый талант"), type: kind }, { parent: actor });
        item?.sheet?.render(true);
      });
      html.find(".pick-add").on("click", async ev => {
        ev.preventDefault(); ev.stopPropagation();
        const d = docs.find(x => x.id === ev.currentTarget.dataset.id);
        if (!d) return;
        const dFolder = d.folder;
        const lock = dFolder ? talentGroupLock(actor, kind, dFolder.folder?.name || "", dFolder.name) : null;
        if (lock && !forceUnlock) return ui.notifications.warn(`Недоступно: ${lock}`);
        const obj = d.toObject();
        if (kind === "talent" && hasXP) {
          // Авто-цена по склонностям; помечаем как купленный (учитывается в Опыте).
          obj.system = obj.system || {};
          const dyn = dynamicAptKind(d.name);
          if (isMinionTalent(d)) {
            // «Миньон Хаоса» — один Талант на двадцать разных слуг (стр. 111):
            // группа и сила спрашиваются до оплаты, потому что от них зависит
            // уровень Таланта, а значит и цена.
            const pick = await promptMinionSlot(actor, d);
            if (!pick) return;                       // отмена — ничего не покупаем
            applyMinionSlot(obj, pick);
            obj.system.cost = talentCostXP(pick.talentTier, d.system.aptitudes || [], charApts,
              talentCategory(actor, d.name, d.folder),
              { name: d.name, patron: actor.system.patronGod });
          } else if (dyn) {
            // Mastery / Beyond Human: сначала выбор привязки (стр. 62), затем
            // цена по склонностям выбранной Характеристики/Навыка (стр. 23-24).
            const pick = await promptDynamicAptTalent(actor, d, dyn, charApts);
            if (!pick) return;                       // отмена — ничего не покупаем
            obj.system.specialization = pick.label;
            obj.system.aptitudes      = pick.apts;   // фиксируем на предмете
            obj.system.aptSource      = pick.key;    // ключ Х-ки/навыка для пересчёта
            obj.system.cost           = pick.cost;
          } else {
            obj.system.cost = talentCostXP(d.system.tier, d.system.aptitudes || [], charApts,
              talentCategory(actor, d.name, d.folder),
              { name: d.name, patron: actor.system.patronGod });
          }
          obj.system.purchased = true;
        }
        await actor.createEmbeddedDocuments("Item", [obj]);
        ui.notifications.info(kind === "talent" && obj.system?.cost
          ? `Куплено: ${d.name} (−${obj.system.cost} XP)` : `Добавлено: ${d.name}`);
        $(ev.currentTarget).closest(".pick-row").addClass("just-added");
      });
      const toggle = row => {
        const desc = row.querySelector(".pick-desc");
        const exp  = row.querySelector(".pick-exp");
        const open = desc.style.display !== "none";
        desc.style.display = open ? "none" : "block";
        exp.textContent = open ? "▸" : "▾";
      };
      html.find(".pick-exp").on("click", ev => { ev.preventDefault(); toggle(ev.currentTarget.closest(".pick-row")); });
      html.find(".pick-name").on("click", ev => toggle(ev.currentTarget.closest(".pick-row")));

      // Категории свёрнуты по умолчанию — раскрываются кликом по заголовку.
      html.find(".pick-group-head").on("click", ev => {
        const grp = ev.currentTarget.closest(".pick-group");
        const collapsed = grp.classList.toggle("pick-collapsed");
        const caret = grp.querySelector(".pick-caret");
        if (caret) caret.textContent = collapsed ? "▸" : "▾";
      });

      // Видимость групп: скрытые по поиску (нет совпадений) ИЛИ, если включён
      // чекбокс «Скрывать недоступные», заблокированные по условию листа.
      const applyGroupVisibility = () => {
        const q = html.find(".pick-search").val().toLowerCase().trim();
        html.find(".pick-group").each((_, gr) => {
          if (hideLocked && gr.classList.contains("pick-group-locked")) { gr.style.display = "none"; return; }
          const hits = gr.querySelectorAll(".pick-row:not(.pick-hidden)").length;
          gr.style.display = hits ? "" : "none";
          // При поиске раскрываем найденное, при пустой строке — снова свернуть.
          gr.classList.toggle("pick-collapsed", !q);
          const caret = gr.querySelector(".pick-caret");
          if (caret) caret.textContent = q ? "▾" : "▸";
        });
      };

      html.find(".pick-search").on("input", ev => {
        const q = ev.currentTarget.value.toLowerCase().trim();
        html.find(".pick-row").each((_, r) => { r.classList.toggle("pick-hidden", !!q && !(r.dataset.name || "").includes(q)); });
        applyGroupVisibility();
      });

      html.find(".pick-hide-locked-cb").on("change", ev => {
        hideLocked = ev.currentTarget.checked;
        applyGroupVisibility();
      });

      // Разрешить покупку из закрытых групп вопреки условию — снимает
      // disabled и меняет 🔒 на ＋ у всех уже отрисованных «недоступных» кнопок.
      html.find(".pick-force-unlock").on("click", ev => {
        ev.preventDefault();
        forceUnlock = !forceUnlock;
        const btn = ev.currentTarget;
        btn.classList.toggle("on", forceUnlock);
        btn.textContent = forceUnlock ? "🔓 Покупка разрешена вопреки условию" : "🔒 Разрешить покупку при несоответствии";
        html.find(".pick-row-locked .pick-add").each((_, b) => {
          b.disabled = !forceUnlock;
          b.textContent = forceUnlock ? "＋" : "🔒";
          if (forceUnlock) b.title = `Доступно вопреки условию: ${b.title}`;
          else b.title = b.title.replace(/^Доступно вопреки условию: /, "");
        });
      });
    }
  }, { classes: ["dialog", "warhammer-dbc", "wh-holo", "wh-item-picker-dialog"], ...pickerPos(580, 660) }).render(true);
}

/**
 * Подключает окно выбора Талантов/Черт к листу, которому нужен тот же пикер,
 * но не нужен весь лист персонажа.
 */
export function attachItemPicker(SheetClass) {
  if (!SheetClass.prototype._openItemPicker) {
    SheetClass.prototype._openItemPicker = function(kind) {
      return openItemPicker(this.actor, kind);
    };
  }
}
