// module/apps/compendium-browser.mjs
// ════════════════════════════════════════════════════════════════════════
//  Обозреватель компендиумов — одно окно со ВСЕМ содержимым системных
//  компендиумов, разложенным по категориям (в основном 1 категория = 1
//  компендиум, папки внутри — как есть, вложенно). У категории может быть
//  НЕСКОЛЬКО источников (sources) — например «Элитные архетипы» склеена из
//  одноимённой папки в Чертах и Талантах (mergeTrees), а «Таланты — Книга
//  Пустоты» — вырезка одной папки из «Талантов» специально для вкладки
//  «Пустолёты» (allTab:false — на «Все» не дублируется, там и так есть
//  внутри обычных «Таланты»).
//
//  Вкладки (TAB_DEFS): «Все» — без фильтра; остальные показывают только
//  категории, у которых в cat.tabs есть соответствующий ключ. Поиск работает
//  ВНУТРИ активной вкладки (сначала фильтр по вкладке, потом по тексту).
//
//  Кнопка — в шапке вкладки компендиумов, см. регистрацию хука внизу файла.
//  Клик по предмету открывает его обычный (для запакованного — read-only)
//  лист через fromUuid(...).sheet.render(true) — как обычный клик по записи
//  компендиума в сайдбаре.
//
//  Деревья кэшируются на сессию (_treeCache) — компендиумы меняются редко;
//  кнопка «↻ Обновить» в шапке диалога форсирует пересборку.
// ════════════════════════════════════════════════════════════════════════
import { matchesFilters, normalizePick } from "./compendium-filters.mjs";
import { budgetLabel, budgetReady, budgetFits, budgetState, BUDGET_XP } from "../rules/pick-budget.mjs";
import { esc } from "../helpers/utils.mjs";

const TAB_DEFS = [
  { key: "all",       label: "Все" },
  { key: "abilities", label: "Способности" },
  { key: "mysticism", label: "Мистика" },
  { key: "arsenal",   label: "Арсенал" },
  { key: "vehicles",  label: "Машины" },
  { key: "voidcraft", label: "Пустолёты" }
];

// label — заголовок категории; sources — список {pack, onlyFolder?}, слитых
// в одно дерево (несколько источников — как у «Элитные архетипы»/«Таланты —
// Книга Пустоты»); pack — id без префикса "warhammer-dbc.", onlyFolder — если
// задано, берётся ТОЛЬКО одноимённая папка верхнего уровня из этого пака, не
// весь пак. tabs — на каких вкладках (кроме «Все») показывается категория;
// allTab:false — скрыть с «Все» (вырезка, дублирующая то, что и так видно
// внутри своей полной категории).
export const CATEGORIES = [
  { label: "Расы",                    sources: [{ pack: "races" }] },
  { label: "Черты",                   sources: [{ pack: "traits" }], tabs: ["abilities"] },
  { label: "Таланты",                 sources: [{ pack: "talents" }], tabs: ["abilities"] },
  { label: "Ритуалы",                 sources: [{ pack: "rituals" }], tabs: ["abilities"] },
  { label: "Архетипы",                sources: [{ pack: "archetypes" }], tabs: ["abilities"] },
  { label: "Элитные архетипы",        sources: [{ pack: "traits", onlyFolder: "Элитные архетипы" },
                                                  { pack: "talents", onlyFolder: "Элитные архетипы" }], tabs: ["abilities"] },
  { label: "Стремления",              sources: [{ pack: "aspirations" }] },
  { label: "Импланты",                sources: [{ pack: "implants" }], tabs: ["arsenal"] },
  { label: "Оружие",                  sources: [{ pack: "weapons" }], tabs: ["arsenal"] },
  { label: "Модификации оружия",      sources: [{ pack: "weapon-mods" }], tabs: ["arsenal"] },
  { label: "Свойства оружия",         sources: [{ pack: "weapon-properties" }], tabs: ["arsenal"] },
  { label: "Боеприпасы",              sources: [{ pack: "ammunition" }] },
  { label: "Броня",                   sources: [{ pack: "armor" }], tabs: ["arsenal"] },
  { label: "Модификации брони",       sources: [{ pack: "armor-mods" }], tabs: ["arsenal"] },
  { label: "Системы силовой брони",   sources: [{ pack: "armour-systems" }] },
  { label: "Истории силовой брони",   sources: [{ pack: "armour-histories" }] },
  { label: "Силовые щиты",            sources: [{ pack: "shields" }], tabs: ["arsenal"] },
  { label: "Снаряжение",              sources: [{ pack: "gear" }], tabs: ["arsenal"] },
  { label: "Инструменты",             sources: [{ pack: "tools" }], tabs: ["arsenal"] },
  { label: "Химия",                   sources: [{ pack: "chemistry" }] },
  { label: "Псайкана",                sources: [{ pack: "psychic-powers" }], tabs: ["mysticism"] },
  { label: "Техночудеса",             sources: [{ pack: "tech-powers" }], tabs: ["mysticism"] },
  { label: "Мутации и Дары Богов",    sources: [{ pack: "mutations" }] },
  { label: "Болезни",                 sources: [{ pack: "diseases" }] },
  { label: "Родные миры",             sources: [{ pack: "homeworlds" }] },
  { label: "Предсказания",            sources: [{ pack: "divinations" }] },
  { label: "Фракции",                 sources: [{ pack: "factions" }] },
  { label: "Корабельные узлы",        sources: [{ pack: "ship-components" }], tabs: ["voidcraft"] },
  { label: "Малые суда",              sources: [{ pack: "small-craft" }], tabs: ["voidcraft"] },
  { label: "Таланты — Книга Пустоты", sources: [{ pack: "talents", onlyFolder: "Книга Пустоты" }],
                                       tabs: ["voidcraft"], allTab: false },
  { label: "Снаряжение техники",      sources: [{ pack: "vehicle-equipment" }], tabs: ["vehicles"] },
  { label: "Черты техники",           sources: [{ pack: "vehicle-traits" }], tabs: ["vehicles"] },
  { label: "Орудия техники",          sources: [{ pack: "vehicle-weapons" }], tabs: ["vehicles"] },
  { label: "Техника",                 sources: [{ pack: "vehicles" }], tabs: ["vehicles"] },
  { label: "Бестиарий",               sources: [{ pack: "bestiary" }] }
];

/** Дерево папок пака от корня: {folders:[{id,name,folders,items}], items:[{id,name,img,uuid,...}]}.
 *  Дополнительные поля индекса (armorType/availability/properties) и folderId
 *  у каждого предмета — для пред-фильтра «Выбор» (kind:"equipment" Конструктора,
 *  см. mechanics.mjs: «Тип» оружия — это ИМЕННО папка компендиума, см.
 *  coreWeaponTypeFolders() ниже, не отдельное поле в системе предмета);
 *  обычному просмотру не мешают, просто едут с остальными данными узла. */
async function buildPackTree(pack) {
  const index = await pack.getIndex({
    // tier и cost нужны фильтрам «Талант такой-то ступени» и «Психосила до
    // такого-то ПР», а cost — ещё и бюджету в опыте (rules/pick-budget.mjs).
    // benefit/description — то же, что показывает лист по стрелочке у уже
    // взятых Талантов/Черт (см. templates/actor/parts/tab-abilities.hbs);
    // здесь тот же текст нужен ДО покупки — стрелочка есть только в pickMode
    // (renderItemsHtml), но поле читаем для всех категорий разом, второй
    // проход по компендиуму дороже лишних двух строк в индексе.
    fields: ["system.armorType", "system.availability", "system.properties",
             "system.tier", "system.cost", "system.aptitudes", "system.category",
             "system.benefit", "system.description"]
  });
  const folders = pack.folders?.contents ?? [];
  const byParent = new Map();
  for (const f of folders) {
    const pid = (typeof f.folder === "string" ? f.folder : f.folder?.id) ?? null;
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid).push(f);
  }
  const itemsByFolder = new Map();
  for (const it of index) {
    const fid = (typeof it.folder === "string" ? it.folder : it.folder?.id) ?? null;
    if (!itemsByFolder.has(fid)) itemsByFolder.set(fid, []);
    itemsByFolder.get(fid).push(it);
  }
  const build = folderId => {
    const subFolders = (byParent.get(folderId) || [])
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name, "ru"));
    const items = (itemsByFolder.get(folderId) || [])
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
    return {
      folders: subFolders.map(f => ({ id: f.id, name: f.name, ...build(f.id) })),
      items: items.map(it => ({
        id: it._id, name: it.name, img: it.img, uuid: `Compendium.${pack.collection}.${it._id}`,
        // type приходит в индексе компендиума сам, просить его полем не нужно;
        // по нему работает фильтр «тип предмета» режима выбора.
        type: it.type,
        // Род документа пака: «Item» или «Actor». Перетаскивание наружу шлёт
        // его в payload — Foundry по нему решает, что класть на сцену и в
        // боковую панель, и с чужим родом дроп молча ничего не делает.
        doc: pack.metadata?.type || "Item",
        folderId, armorType: it.system?.armorType,
        availability: it.system?.availability, properties: it.system?.properties || [],
        tier: it.system?.tier, cost: it.system?.cost, aptitudes: it.system?.aptitudes || [],
        category: it.system?.category,
        // Действие/эффект приоритетнее общего описания — у Талантов и Черт
        // именно в benefit лежит механический текст (см. item-picker.mjs),
        // у остальных типов benefit нет, и в ход идёт description.
        desc: it.system?.benefit || it.system?.description || ""
      }))
    };
  };
  return build(null);
}

/**
 * Папки-«Типы» оружия из корбука (АВТО И СТАБ, ДРОБОВИКИ, АВТОПУШКИ, СИЛОВОЕ,
 * ШОКОВОЕ и т.д.) — в этом проекте это НЕ поле в системе предмета, а прямые
 * дочерние папки «Рукопашное»/«Стрелковое» внутри «Имперское» (корбук; ветки
 * прочих фракций-источников — Астартес/Друкхари/Азуриане/... — сюда намеренно
 * не входят, kind:"equipment" режим «Выбор» ограничен основной книгой). Метка
 * содержит родителя в скобках — среди этих папок есть одноимённые дубли (своё
 * «Примитивное»/«Импровизированное» и для Рукопашного, и для Стрелкового).
 * @returns {{id:string, name:string}[]}
 */
export function coreWeaponTypeFolders() {
  const pack = game.packs.get("warhammer-dbc.weapons");
  const folders = pack?.folders?.contents ?? [];
  const parentId = f => (typeof f.folder === "string" ? f.folder : f.folder?.id) ?? null;
  const byId = new Map(folders.map(f => [f.id, f]));
  const core = folders.find(f => f.name === "Имперское" && !parentId(f));
  if (!core) return [];
  const branchIds = new Set(folders
    .filter(f => parentId(f) === core.id && (f.name === "Рукопашное" || f.name === "Стрелковое"))
    .map(f => f.id));
  return folders
    .filter(f => branchIds.has(parentId(f)))
    .map(f => ({ id: f.id, name: `${f.name} (${byId.get(parentId(f))?.name})` }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

/** Число предметов в узле рекурсивно — бейдж-счётчик у категории/папки. */
function countNode(node) {
  return (node.items?.length || 0) + (node.folders || []).reduce((s, f) => s + countNode(f), 0);
}

/** Сливает два дерева, объединяя папки с одинаковым именем на каждом уровне. */
function mergeTrees(a, b) {
  const items = [...(a?.items || []), ...(b?.items || [])];
  const byName = new Map();
  for (const f of [...(a?.folders || []), ...(b?.folders || [])]) {
    if (byName.has(f.name)) {
      const ex = byName.get(f.name);
      byName.set(f.name, { id: ex.id, name: f.name, ...mergeTrees(ex, f) });
    } else byName.set(f.name, f);
  }
  return { items, folders: [...byName.values()].sort((x, y) => x.name.localeCompare(y.name, "ru")) };
}

/** Первая папка с таким именем на любой глубине (для onlyFolder). */
function findFolderByName(node, name) {
  for (const f of node.folders || []) {
    if (f.name === name) return f;
    const deep = findFolderByName(f, name);
    if (deep) return deep;
  }
  return null;
}

let _treeCache = null;

/**
 * Паки, объявленные в system.json, но не упомянутые ни в одной категории.
 *
 * CATEGORIES — это кураторская раскладка: слитые источники, вырезки папок,
 * привязка к вкладкам. Вывести её из манифеста нельзя, там этого нет. Зато
 * можно не дать новому паку пропасть молча: он показывается отдельной
 * категорией с меткой из манифеста, пока ему не назначили место руками.
 *
 * Книги (JournalEntry) сюда не попадают: обозреватель показывает предметы и
 * акторов, а книги читаются своим окном.
 */
function orphanCategories() {
  const known = new Set(CATEGORIES.flatMap(c => c.sources.map(s => s.pack)));
  return (game.packs?.contents ?? [])
    .filter(p => p.metadata?.packageName === "warhammer-dbc"
      && p.metadata?.type !== "JournalEntry"
      && !known.has(p.metadata?.name))
    .map(p => ({ label: p.metadata.label || p.metadata.name, sources: [{ pack: p.metadata.name }] }));
}

async function buildAllTrees(force = false) {
  if (_treeCache && !force) return _treeCache;
  const categories = [...CATEGORIES, ...orphanCategories()];
  // Полное дерево каждого упомянутого пака строится один раз и переиспользуется
  // всеми категориями/вырезками, которые на него ссылаются.
  const packIds = [...new Set(categories.flatMap(c => c.sources.map(s => s.pack)))];
  const packTrees = {};
  await Promise.all(packIds.map(async id => {
    const pack = game.packs.get(`warhammer-dbc.${id}`);
    packTrees[id] = pack ? await buildPackTree(pack) : { folders: [], items: [] };
  }));
  const result = categories.map(cat => {
    const parts = cat.sources.map(src => {
      const full = packTrees[src.pack] || { folders: [], items: [] };
      return src.onlyFolder ? (findFolderByName(full, src.onlyFolder) || { folders: [], items: [] }) : full;
    });
    const tree = parts.reduce((acc, t) => mergeTrees(acc, t), { folders: [], items: [] });
    // packId — только для категорий с ОДНИМ источником (все «выдаваемые» ниже
    // такие); нужен для отбора категории по id пака в режиме «Выбор» (pickMode).
    const packId = cat.sources.length === 1 ? cat.sources[0].pack : null;
    return { label: cat.label, tree, count: countNode(tree), tabs: cat.tabs || [], allTab: cat.allTab !== false, packId };
  }).filter(c => c.count > 0);
  _treeCache = result;
  return result;
}

// Категории, которые можно «выдать» предметом (kind:"equipment" в Конструкторе,
// module/apps/mechanics.mjs) — подмножество CATEGORIES с одним источником-паком.
// Метки берутся из CATEGORIES, чтобы не разъезжались с обычным браузером.
// Не только снаряжение: «7 талантов 1 уровня» и «500хр на Психосилы» — тот же
// приём «компендиум с фильтрами плюс счётчик», просто пак другой.
const GRANTABLE_PACKS = ["weapons", "armor", "gear", "ammunition", "implants",
  "weapon-mods", "armor-mods", "tools", "shields",
  "talents", "traits", "psychic-powers", "tech-powers", "chemistry"];
export const GRANTABLE_CATEGORIES = GRANTABLE_PACKS.map(pack => ({
  pack, label: CATEGORIES.find(c => c.sources.length === 1 && c.sources[0].pack === pack)?.label || pack
}));

/** Рекурсивно отфильтровывает items по предикату, обрезая опустевшие папки. */
function pruneTree(node, pred) {
  const folders = (node.folders || [])
    .map(f => ({ id: f.id, name: f.name, ...pruneTree(f, pred) }))
    .filter(f => countNode(f) > 0);
  const items = (node.items || []).filter(pred);
  return { folders, items };
}

// Строка предмета + стрелочка раскрытия описания — тот же приём, что у уже
// взятых Талантов/Черт на листе (▸ у tab-abilities.hbs) и у пикера
// module/sheets/item-picker.mjs (.pick-exp/.pick-desc): раньше почитать, что
// даёт запись, ДО покупки можно было только открыв её отдельный лист.
function renderItemsHtml(items) {
  return items.map(it => `
    <div class="cbrowse-row">
      <div class="cbrowse-row-head">
        <button type="button" class="cbrowse-exp pick-exp" title="Показать описание">▸</button>
        <div class="cbrowse-item" draggable="true" data-uuid="${esc(it.uuid)}" data-doc="${esc(it.doc || "Item")}" data-name="${esc(it.name.toLowerCase())}">
          <img src="${esc(it.img || "icons/svg/item-bag.svg")}" class="cbrowse-item-img"/>
          <span class="cbrowse-item-name">${esc(it.name)}</span>
        </div>
      </div>
      <div class="cbrowse-desc pick-desc" style="display:none;">${esc(it.desc || "—")}</div>
    </div>`).join("");
}

function renderNodeHtml(node) {
  let html = renderItemsHtml(node.items || []);
  html += (node.folders || []).map(f => `
    <div class="cbrowse-folder pick-collapsed">
      <div class="cbrowse-folder-head">
        <span class="pick-caret">▸</span>${esc(f.name)}
        <span class="pick-count">${countNode(f)}</span>
      </div>
      <div class="cbrowse-folder-body">${renderNodeHtml(f)}</div>
    </div>`).join("");
  return html;
}

/**
 * @param {boolean} force  Пересобрать кэш деревьев.
 * @param {object|null} pickMode  Режим выбора. Поля:
 *   pack     — сузить окно до ОДНОЙ категории по id пака (как раньше);
 *   filters  — условия отбора, см. ITEM_FILTERS: {type, folderId, weaponProp,
 *              armorType, maxAvailability}. Без `pack` фильтры применяются ко
 *              всем категориям сразу — так «покажи только Фракции» работает
 *              и без привязки к конкретному паку;
 *   count    — сколько предметов требуется выбрать (по умолчанию 1);
 *   prompt   — что именно требуется от игрока («Выберите 3 ордена»).
 *
 *   Понимается и прежняя плоская форма (weaponFolderId/weaponProp/armorType/
 *   maxAvailability) — её шлёт kind:"equipment" Конструктора.
 *
 *   Неподходящие предметы не показываются вовсе: дерево обрезается по фильтрам
 *   до отрисовки, поэтому выбрать не подходящее под условие нельзя в принципе.
 *
 * @returns {Promise<string|string[]|null|undefined>}
 *   count = 1 — uuid выбранного (или null: отмена/закрытие), как было раньше;
 *   count > 1 — массив uuid длиной count (или null);
 *   без pickMode — undefined, обычный просмотр.
 */
export function openCompendiumBrowser(force = false, pickMode = null) {
  return new Promise(async resolveFn => {
    let resolved = false;
    const finish = v => { if (!resolved) { resolved = true; resolveFn(v); } };

    const pick = normalizePick(pickMode);
    const allCats = await buildAllTrees(force);
    let cats = allCats;
    let pickSuffix = "";
    if (pick) {
      const pred = it => matchesFilters(it, pick.filters);
      // Пак задан — сужаем до его категории; не задан — фильтруем все и
      // оставляем те, где после отбора что-то осталось.
      const source = pick.pack ? allCats.filter(c => c.packId === pick.pack) : allCats;
      cats = source
        .map(c => { const tree = pruneTree(c.tree, pred); return { ...c, tree, count: countNode(tree) }; })
        .filter(c => c.count > 0);
      if (!cats.length) {
        ui.notifications.warn("Под заданные условия не подошёл ни один предмет компендиумов.");
        finish(null);
        return;
      }
      pickSuffix = cats.length === 1 ? ` — ${cats[0].label}` : "";
    }

    const tabsHtml = pick ? "" : TAB_DEFS
      .filter(t => t.key === "all" || allCats.some(c => c.tabs.includes(t.key)))
      .map(t => `<button type="button" class="cbrowse-tab${t.key === "all" ? " active" : ""}" data-tab="${t.key}">${esc(t.label)}</button>`)
      .join("");

    const body = cats.map(c => `
      <div class="pick-group pick-collapsed" data-tabs="${esc(c.tabs.join(" "))}" data-all-tab="${c.allTab}">
        <div class="pick-group-head">
          <span class="pick-caret">▸</span>${esc(c.label)}
          <span class="pick-count">${c.count}</span>
        </div>
        <div class="pick-group-body">${renderNodeHtml(c.tree)}</div>
      </div>`).join("");

    // Шапка требования: что нужно выбрать и сколько уже выбрано. Показывается
    // только когда есть что сказать — при обычном выборе одного предмета без
    // пояснения она лишняя.
    // Бюджет: штуками («7 талантов 1 уровня») или опытом («500хр на Психосилы»).
    // Одна штука без пояснения — прежний одиночный выбор, шапка ему не нужна.
    const budget = pick?.budget ?? null;
    const multi = !!pick && (budget?.mode === BUDGET_XP || budget?.value > 1);
    // Цена одной записи в опыте зависит от того, кому выдают, поэтому приходит
    // снаружи; без неё берётся собственная цена записи компендиума.
    const xpCost = pickMode?.xpCost || null;
    const byUuid = new Map();
    for (const c of cats) {
      const collect = node => {
        for (const it of node.items || []) byUuid.set(it.uuid, it);
        for (const f of node.folders || []) collect(f);
      };
      collect(c.tree);
    }
    const headHtml = (pick && (pick.prompt || multi)) ? `
      <div class="cbrowse-pick-head">
        ${pick.prompt ? `<div class="cbrowse-pick-prompt">${esc(pick.prompt)}</div>` : ""}
        ${multi ? `<div class="cbrowse-pick-state">
          <span class="cbrowse-pick-n">${esc(budgetLabel([], budget, xpCost))}</span>
          <button type="button" class="cbrowse-pick-confirm" disabled>Готово</button>
        </div>` : ""}
      </div>` : "";

    const dlg = new Dialog({
      title: pick ? `📚 Выбор предмета${pickSuffix}` : "📚 Обозреватель компендиумов",
      content: `<div class="wh-item-picker cbrowse">
        <div class="pick-top">
          <input type="text" class="pick-search" placeholder="Поиск…"/>
          ${pick ? "" : `<button type="button" class="cbrowse-refresh" title="Пересобрать (если что-то поменялось в компендиумах)">↻</button>`}
        </div>
        ${pick ? "" : `<div class="cbrowse-tabs">${tabsHtml}</div>`}
        ${headHtml}
        <div class="pick-list">${body || "<em>Ничего не найдено под заданные фильтры.</em>"}</div>
      </div>`,
      buttons: pick ? { cancel: { label: "Отмена", callback: () => finish(null) } } : { close: { label: "Закрыть" } },
      default: pick ? "cancel" : "close",
      close: () => finish(null),
      render: html => {
        let activeTab = "all";
        // Выбранное при count > 1. Порядок сохраняется: он же порядок выдачи.
        const chosen = [];
        const picked = () => chosen.map(u => byUuid.get(u)).filter(Boolean);
        const syncPickState = () => {
          html.find(".cbrowse-item").each((_, el) =>
            el.classList.toggle("cbrowse-picked", chosen.includes(el.dataset.uuid)));
          html.find(".cbrowse-pick-n").text(budgetLabel(picked(), budget, xpCost));
          html.find(".cbrowse-pick-confirm").prop("disabled", !budgetReady(picked(), budget, xpCost));
        };

        html.find(".cbrowse-item").on("click", async ev => {
          const uuid = ev.currentTarget.dataset.uuid;
          if (pick && !multi) { finish(uuid); dlg.close(); return; }
          if (multi) {
            const at = chosen.indexOf(uuid);
            if (at >= 0) chosen.splice(at, 1);
            else if (!budgetFits(picked(), byUuid.get(uuid), budget, xpCost)) {
              const st = budgetState(picked(), budget, xpCost);
              return ui.notifications.warn(st.mode === BUDGET_XP
                ? `Не хватает опыта: осталось ${st.left} из ${st.value}.`
                : `Уже выбрано ${st.value} — снимите лишнее, чтобы выбрать другое.`);
            }
            else chosen.push(uuid);
            return syncPickState();
          }
          const doc = await fromUuid(uuid).catch(() => null);
          if (!doc) return ui.notifications.warn("Предмет не найден (возможно, компендиум изменился — нажмите ↻).");
          doc.sheet?.render(true);
        });

        // Стрелочка раскрытия описания — прочитать, что даёт запись, ДО
        // выбора/покупки (тот же приём, что у Талантов/Черт на листе и в
        // module/sheets/item-picker.mjs). Отдельная кнопка вне .cbrowse-item,
        // поэтому клик по ней не запускает ни выбор, ни драг.
        html.find(".cbrowse-exp").on("click", ev => {
          ev.preventDefault();
          const row = ev.currentTarget.closest(".cbrowse-row");
          const desc = row?.querySelector(".cbrowse-desc");
          if (!desc) return;
          const open = desc.style.display !== "none";
          desc.style.display = open ? "none" : "block";
          ev.currentTarget.textContent = open ? "▸" : "▾";
        });

        html.find(".cbrowse-pick-confirm").on("click", ev => {
          ev.preventDefault();
          if (!budgetReady(picked(), budget, xpCost)) return;
          finish(chosen.slice());
          dlg.close();
        });
        // Драг-н-дроп наружу — на лист актора (в инвентарь) или на дроп-зоны
        // вкладки МЕХАНИКА листа предмета (Черта/Талант/Свойство оружия).
        // Тот же payload-формат, что Foundry ждёт нативно (type:"Item", uuid) —
        // см. actor-sheet.mjs:2950-2961, тот же приём для драга из инвентаря.
        html.find(".cbrowse-item").each((_, el) => {
          el.addEventListener("dragstart", ev => {
            ev.stopPropagation();
            // Род документа берём из самой записи: пак бывает и с акторами, а
            // с жёстким «Item» дроп актора на сцену и в боковую панель молча
            // ничего не делал.
            ev.dataTransfer.setData("text/plain",
              JSON.stringify({ type: el.dataset.doc || "Item", uuid: el.dataset.uuid }));
            ev.dataTransfer.effectAllowed = "copy";
          });
        });
        if (!pick) {
          html.find(".cbrowse-refresh").on("click", async ev => {
            ev.preventDefault();
            dlg.close();
            openCompendiumBrowser(true);
          });
        }
        const toggleCollapse = ev => {
          const node = ev.currentTarget.closest(".pick-group, .cbrowse-folder");
          if (!node) return;
          const collapsed = node.classList.toggle("pick-collapsed");
          const caret = node.querySelector(":scope > .pick-group-head .pick-caret, :scope > .cbrowse-folder-head .pick-caret");
          if (caret) caret.textContent = collapsed ? "▸" : "▾";
        };
        html.find(".pick-group-head").on("click", toggleCollapse);
        html.find(".cbrowse-folder-head").on("click", toggleCollapse);

        // Видимость складывается из ДВУХ независимых условий: активная вкладка
        // (категория ей подходит, либо это «Все») и текст поиска (внутри узла
        // остался хотя бы один непустой хит). Вкладка проверяется ПЕРВОЙ и рубит
        // категорию целиком — поиск работает только внутри уже отфильтрованной
        // по вкладке выдачи, не поверх неё. В pickMode вкладок нет — категория
        // всегда одна и уже отфильтрована по pickMode, и раскрыта сразу (нечего
        // сворачивать — там и так только то, что подходит под фильтр).
        const applyVisibility = () => {
          const q = html.find(".pick-search").val().toLowerCase().trim();
          html.find(".cbrowse-item").each((_, r) => {
            r.classList.toggle("pick-hidden", !!q && !(r.dataset.name || "").includes(q));
          });
          html.find(".pick-group").each((_, el) => {
            const tabs = (el.dataset.tabs || "").split(" ").filter(Boolean);
            const inTab = pick ? true : (activeTab === "all" ? el.dataset.allTab !== "false" : tabs.includes(activeTab));
            if (!inTab) { el.style.display = "none"; return; }
            const hits = [...el.querySelectorAll(".cbrowse-item")].filter(i => !i.classList.contains("pick-hidden")).length;
            el.style.display = hits ? "" : "none";
            el.classList.toggle("pick-collapsed", pick ? false : !q);
            const caret = el.querySelector(":scope > .pick-group-head .pick-caret");
            if (caret) caret.textContent = (pick || q) ? "▾" : "▸";
          });
          html.find(".cbrowse-folder").each((_, el) => {
            const hits = [...el.querySelectorAll(".cbrowse-item")].filter(i => !i.classList.contains("pick-hidden")).length;
            el.style.display = hits ? "" : "none";
            el.classList.toggle("pick-collapsed", !q);
            const caret = el.querySelector(":scope > .cbrowse-folder-head .pick-caret");
            if (caret) caret.textContent = q ? "▾" : "▸";
          });
        };

        html.find(".pick-search").on("input", applyVisibility);
        html.find(".cbrowse-tab").on("click", ev => {
          html.find(".cbrowse-tab").removeClass("active");
          ev.currentTarget.classList.add("active");
          activeTab = ev.currentTarget.dataset.tab;
          applyVisibility();
        });

        applyVisibility();
      }
    }, { classes: ["dialog", "warhammer-dbc", "wh-holo", "wh-item-picker-dialog", "cbrowse-dialog"],
         width: 640, height: 740, resizable: true });
    dlg.render(true);
  });
}
