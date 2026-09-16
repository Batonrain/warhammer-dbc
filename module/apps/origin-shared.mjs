// module/apps/origin-shared.mjs
// ════════════════════════════════════════════════════════════════════════
//  Общая механика Происхождения и Предсказания: диалог выборов, выдача
//  талантов/навыков/Ран/Порчи, откат и кэш компендиума для дропдаунов.
//
//  Дропдауны читают компендиум, а не константы — поэтому запись, заведённая
//  ГМом руками, сразу появляется в списке.
// ════════════════════════════════════════════════════════════════════════

import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../constants/skills.mjs";
import { SKILL_RANKS } from "../constants/characteristics.mjs";
import { matchSpec } from "../constants/skill-specializations.mjs";
import { blankMechEntry } from "./mechanics.mjs";
import { esc } from "../helpers/utils.mjs";
import { targetChoiceHtml, wireTargetChoice, readTargetChoice, targetChoiceLabel } from "./target-choice.mjs";
import { openCompendiumBrowser } from "./compendium-browser.mjs";

const FLAG = "warhammer-dbc";
const GRANT = "originGrant";           // помечает всё выданное (для отката)

/**
 * Замок «clear-потом-grant» на актор+тег (wdbc-gbpe).
 *
 * applyHomeworld/applyHomeworldPicks/applyDivinationPicks и подобные читают
 * «есть ли уже носитель» (clearXxx), потом создают новый — без замка второй
 * параллельный вызов (быстрая повторная смена дропдауна, медленная сеть,
 * character-wizard.mjs раньше звал через .then(...) без await вовсе) читает
 * «носителя ещё нет» РАНЬШЕ, чем первый вызов успевал его создать/снять — оба
 * создают свой предмет, актор получает ДВА носителя одного типа. Лист их не
 * различает (везде `.find()` — виден только первый), задвоенные бонусы видны
 * только на вкладке ЭФФЕКТЫ (она честно перечисляет все ActiveEffect).
 *
 * Не запрет параллельного вызова, а ОЧЕРЕДЬ: второй вызов дожидается, пока
 * первый (clear+grant целиком) закончится, и только тогда стартует сам —
 * тот же результат, что у пользователя, terpelivo щёлкающего раз за разом,
 * просто без гонки между ними. Ключ — actor.uuid+tag, не только actor: смена
 * Родного мира и смена Предсказания на ОДНОМ акторе друг другу не мешают.
 */
const originLocks = new Map();
export async function withOriginLock(actor, tag, fn) {
  const key = `${actor?.uuid ?? actor?.id ?? ""}:${tag}`;
  const prior = originLocks.get(key) ?? Promise.resolve();
  // Предыдущий reject гасится ЗДЕСЬ (не должен блокировать очередь навечно),
  // но вызывающий ЭТОГО withOriginLock всё равно видит свою собственную
  // ошибку — run ниже её не глотает.
  const queued = prior.catch(() => {}).then(fn);
  originLocks.set(key, queued);
  return queued;
}

/**
 * [{stat, value}, ...] → одна И-группа Конструктора (kind:"characteristic",
 * field:"total" — обычный +X к значению, как раньше делал charValueBonuses,
 * см. effect-keys.mjs). Общий для Родных миров и Предсказаний: оба выдают
 * предмет-носитель с charBonuses и раньше писали их напрямую в
 * system.effects.charValueBonuses (легаси-путь, живой только через разовую
 * миграцию на "ready") — теперь предмет сам несёт flags.mechanics и
 * createItem-хук (applyItemMechanics) заводит ActiveEffect немедленно, без
 * ожидания следующего рестарта/миграции.
 */
export function charBonusesToMechanics(charBonuses) {
  const entries = (charBonuses || [])
    .filter(cb => cb?.stat)
    .map(cb => ({ ...blankMechEntry("characteristic"), charKey: cb.stat, field: "total", op: "add", value: cb.value }));
  if (!entries.length) return [];
  return [{ id: foundry.utils.randomID(), operator: "AND", entries }];
}

// ── Кэш компендиумов для дропдаунов ──────────────────────────────────────

const PACKS = new Map();   // tag -> packId
const CACHE = new Map();   // tag -> [{key, name, uuid, roll}]

/** Объявить компендиум источником списка для дропдауна. */
export function registerPackCache(packId, tag) { PACKS.set(tag, packId); }

/** Записи компендиума; пока он не прочитан — резервный список из констант. */
export function packEntries(tag, fallback) {
  const c = CACHE.get(tag);
  return (c && c.length) ? c : (typeof fallback === "function" ? fallback() : []);
}

/** Перечитать индексы всех объявленных компендиумов. */
export async function refreshPackCaches() {
  for (const [tag, packId] of PACKS) {
    try {
      const pack = game.packs.get(packId);
      if (!pack) continue;
      const index = await pack.getIndex({
        fields: ["system.key", "system.roll", "system.table", "system.n", "system.mods", "system.description", "system.effect"]
      });
      CACHE.set(tag, index.contents.map(e => ({
        key:  e.system?.key || e._id,
        name: e.name,
        roll: e.system?.roll || "",
        table: e.system?.table || "",
        n: e.system?.n ?? null,
        mods: e.system?.mods || "",
        description: e.system?.description || "",
        // Предсказания хранят текст эффекта в system.effect, не description —
        // нужен для предпросмотра в дропдауне (наведение на option до выбора).
        effect: e.system?.effect || "",
        uuid: e.uuid
      })).sort((a, b) =>
        (a.table || "").localeCompare(b.table || "") ||
        ((a.n ?? 0) - (b.n ?? 0)) ||
        String(a.roll || a.name).localeCompare(String(b.roll || b.name), "ru", { numeric: true })
      ));
    } catch (e) { console.warn(`Warhammer DBC | Кэш компендиума ${packId}:`, e); }
  }
}

/** Кэш строится после готовности мира и обновляется при правках библиотек. */
export function initPackCaches() {
  Hooks.once("ready", () => refreshPackCaches());
  const touched = (doc) => doc?.pack && [...PACKS.values()].includes(doc.pack);
  for (const h of ["createItem", "deleteItem", "updateItem"])
    Hooks.on(h, (doc) => { if (touched(doc)) refreshPackCaches(); });
}

// ── Диалог выборов ───────────────────────────────────────────────────────

/**
 * HTML всех блоков выбора (характеристика/пакеты/цель Таланта/специализации)
 * — общее для диалога (дропдаун Предсказания на листе персонажа, actor-
 * sheet.mjs — мир там меняют не по шагам, окно уместно) и инлайн-показа в
 * Мастере создания (character-wizard.mjs, тот же принцип, что уже был у
 * выборов Расы/Архетипа/Стремлений/Родного мира — строки видны прямо в
 * форме шага, без всплывающего Dialog).
 */
export function grantChoiceBlocksHtml({ charChoices = [], choices = [], actor }) {
  const intBonus = actor?.system?.characteristics?.int?.bonus ?? 0;
  const blocks = [];

  charChoices.forEach((cc, i) => {
    const opts = cc.options.map((o, j) =>
      `<option value="${j}" ${j === 0 ? "selected" : ""}>${esc(o.label)}</option>`).join("");
    blocks.push(`<div class="hw-choice">
      <div class="hw-choice-label">${esc(cc.label)}</div>
      <select data-charchoice="${i}">${opts}</select></div>`);
  });

  for (const ch of choices) {
    if (ch.type === "one") {
      const opts = ch.options.map((o, i) =>
        `<option value="${i}" ${i === 0 ? "selected" : ""}>${esc(o.label)}</option>`).join("");
      blocks.push(`<div class="hw-choice">
        <div class="hw-choice-label">${esc(ch.label)}</div>
        <div class="hw-choice-hint">${esc(ch.hint || "")}</div>
        <select data-choice="${ch.key}">${opts}</select></div>`);
    } else if (ch.type === "target") {
      // Против кого сработает Талант (Hatred/Peer/Good Reputation) — пикер
      // вид+значение (rules/talent-targets.mjs), а не свободный текст: строка
      // не даёт targetMatches() ничего сопоставить, и талант формально есть,
      // но никогда не срабатывает (wdbc-a4l, разбор игрока).
      blocks.push(targetChoiceHtml(ch));
    } else if (ch.type === "many") {
      const count = ch.countFormula === "intBonus2" ? intBonus * 2 : (ch.count || 0);
      const rows = (ch.groups || []).map(g =>
        `<div class="hw-many-group"><b>${esc(GROUP_SKILLS_DEF[g]?.label || g)}</b>
          <input type="text" data-many="${ch.key}" data-group="${g}" placeholder="Специализации через запятую"/></div>`).join("");
      blocks.push(`<div class="hw-choice">
        <div class="hw-choice-label">${esc(ch.label)} — доступно ${count}</div>
        <div class="hw-choice-hint">${esc(ch.hint || "")}</div>
        ${rows}
        <div class="hw-choice-count" data-count-for="${ch.key}">Выбрано: 0 / ${count}</div></div>`);
    }
  }

  return blocks.join("");
}

function openFactionTargetBrowser(prompt) {
  return openCompendiumBrowser(false, { filters: { type: "faction" }, prompt });
}

/**
 * Оживляет уже отрисованные блоки: живой счётчик специализаций, пикер цели
 * Таланта. `h` — jQuery-корень содержимого (у Dialog — аргумент render/ok,
 * у Мастера создания — this.element).
 */
export function wireGrantChoiceBlocks(h, { choices = [] }, state) {
  // Строки перерисовываются заново при КАЖДОМ рендере Мастера (не только по
  // ответу на них самих), а свежая HTML всегда начинается с пустых полей.
  // Без восстановления ответ тихо терялся при любом несвязанном клике рядом
  // (найдено живой проверкой на пикере цели — тот же приём здесь).
  const snap = (state.formSnapshot ??= {});
  h.find("select[data-charchoice]").each((_, el) => {
    const $el = h.find(el), key = `charChoice:${el.dataset.charchoice}`;
    if (snap[key] != null) $el.val(snap[key]);
    $el.on("change", () => { snap[key] = $el.val(); });
  });
  h.find("select[data-choice]").each((_, el) => {
    const $el = h.find(el), key = `one:${el.dataset.choice}`;
    if (snap[key] != null) $el.val(snap[key]);
    $el.on("change", () => { snap[key] = $el.val(); });
  });
  h.find("input[data-many]").each((_, el) => {
    const $el = h.find(el), key = `many:${el.dataset.many}:${el.dataset.group}`;
    if (snap[key] != null) $el.val(snap[key]);
    $el.on("input", () => { snap[key] = $el.val(); });
  });
  h.find("input[data-many]").on("input", ev => {
    const k = ev.currentTarget.dataset.many;
    let n = 0;
    h.find(`input[data-many="${k}"]`).each((_, el) =>
      { n += String(el.value || "").split(",").map(s => s.trim()).filter(Boolean).length; });
    const box = h.find(`[data-count-for="${k}"]`);
    const max = parseInt(box.text().split("/")[1]) || 0;
    box.text(`Выбрано: ${n} / ${max}`);
    box.toggleClass("hw-over", n > max);
  }).trigger("input");  // счётчик сразу отражает восстановленные значения, не только новый ввод
  for (const ch of choices.filter(c => c.type === "target")) wireTargetChoice(h, ch, state, openFactionTargetBrowser);
}

/** Читает ответы уже отрисованных блоков в форму picks, которую ждёт applyGrants. */
export function readGrantChoicePicks(h, { choices = [] }, state) {
  const out = { charChoices: [], one: {}, target: {}, many: {} };
  h.find("select[data-charchoice]").each((_, el) =>
    { out.charChoices[parseInt(el.dataset.charchoice)] = parseInt(el.value) || 0; });
  h.find("select[data-choice]").each((_, el) => { out.one[el.dataset.choice] = parseInt(el.value) || 0; });
  for (const ch of choices.filter(c => c.type === "target")) out.target[ch.key] = readTargetChoice(h, ch, state);
  h.find("input[data-many]").each((_, el) => {
    (out.many[el.dataset.many] ||= []).push(...String(el.value || "").split(",")
      .map(s => s.trim()).filter(Boolean).map(s => ({ group: el.dataset.group, specialty: s })));
  });
  return out;
}

/**
 * Диалог выборов — используется дропдауном Предсказания на листе персонажа
 * (actor-sheet.mjs); Мастер создания выборы показывает инлайн, см.
 * grantChoiceBlocksHtml выше.
 * @returns {Promise<object|null>} null — окно закрыли, менять ничего не нужно
 */
export function promptGrantChoices({ title, head, desc, charChoices = [], choices = [], actor }) {
  const blocksHtml = grantChoiceBlocksHtml({ charChoices, choices, actor });
  const state = { factionTargets: {} };
  const shape = { choices };

  return new Promise(resolve => {
    let done = false;
    new Dialog({
      title,
      content: `<form class="hw-choice-form">
        <div class="hw-choice-head">${esc(head)}</div>
        <div class="hw-choice-desc">${esc(desc)}</div>
        ${blocksHtml}
      </form>`,
      buttons: {
        ok: { icon: '<i class="fas fa-check"></i>', label: "Принять", callback: h => {
          if (done) return; done = true;
          resolve(readGrantChoicePicks(h, shape, state));
        }},
        cancel: { label: "Отмена", callback: () => { if (!done) { done = true; resolve(null); } } }
      },
      default: "ok",
      render: h => wireGrantChoiceBlocks(h, shape, state),
      close: () => { if (!done) { done = true; resolve(null); } }
    }, { classes: ["dialog", "warhammer-dbc", "wh-holo", "hw-choice-dialog"], width: 480 }).render(true);
  });
}

// ── Выдача ───────────────────────────────────────────────────────────────

const RANK_ORDER = ["untrained", "knows", "trained", "veteran", "expert"];
const rankIdx = r => Math.max(0, RANK_ORDER.indexOf(r || "untrained"));

/**
 * Выдаёт навыки, знания, таланты, черты, Раны и Порчу.
 * @returns {Promise<string[]>} строки для карточки в чат
 */
export async function applyGrants(actor, { def, picks = {}, tag, owner, sourceLabel }) {
  const g = {
    skills: [...(def.grants?.skills || [])],
    groupSkills: [...(def.grants?.groupSkills || [])],
    talents: [...(def.grants?.talents || [])],
    traits: [...(def.grants?.traits || [])],
    wounds: def.grants?.wounds || 0,
    corruption: def.grants?.corruption || 0,
    corruptionRoll: def.grants?.corruptionRoll || null
  };
  // Цель Таланта (Hatred/Peer/Good Reputation) из пикера вида+значения —
  // g.talents остаётся плоским списком строк (имя показывается в сводке),
  // а структурная запись system.targets для конкретного имени лежит здесь
  // отдельно и подхватывается buildTalents ниже.
  const talentTargets = {};

  // Выборы, которые сами что-то выдают.
  for (const ch of (def.choices || [])) {
    if (ch.type === "one") {
      const o = ch.options[picks.one?.[ch.key] ?? 0];
      if (!o?.grants) continue;
      g.skills.push(...(o.grants.skills || []));
      g.groupSkills.push(...(o.grants.groupSkills || []));
      g.talents.push(...(o.grants.talents || []));
      g.traits.push(...(o.grants.traits || []));
      if (o.grants.wounds) g.wounds += o.grants.wounds;
    } else if (ch.type === "target") {
      const v = picks.target?.[ch.key];
      if (v && ch.talentTemplate) {
        const name = ch.talentTemplate.replace("{v}", targetChoiceLabel(v));
        g.talents.push(name);
        talentTargets[name] = v;
      }
    }
  }

  // grantedByItem (в дополнение к старому FLAG/GRANT=tag) — тот же generic
  // deleteItem-откат, что и у Выдач Конструктора (см. warhammer-dbc.mjs,
  // Hooks.on("deleteItem",...)), теперь подхватывает и это: удалили Родной
  // мир/Предсказание прямо из списка предметов (не через дропдаун в шапке) —
  // выданное всё равно уйдёт вместе с ним.
  const created = [];
  for (const t of g.traits) {
    created.push({
      name: t.name, type: "trait", img: "icons/svg/aura.svg",
      system: { description: "", benefit: "", source: sourceLabel,
                hasRating: !!t.hasRating, rating: t.rating || 0,
                effects: { charBonusStat: "", charBonusValue: 0, charBonuses: [], charValueBonuses: [],
                           armourAll: 0, fearRating: 0, sizeMod: 0, initMod: 0, speedMod: 0 } },
      flags: { [FLAG]: { [GRANT]: tag, grantedByItem: owner?.id } }
    });
  }
  if (g.talents.length) created.push(...await buildTalents(g.talents, sourceLabel, tag, owner, talentTargets));
  if (created.length) await actor.createEmbeddedDocuments("Item", created);

  const update = {};
  const skillRanks = {};
  for (const s of g.skills) {
    const cur = actor.system.skills?.[s.key];
    if (!cur || !SKILLS_DEF[s.key] || rankIdx(cur.rank) >= rankIdx(s.rank)) continue;
    skillRanks[s.key] = { from: cur.rank || "untrained", to: s.rank };
    update[`system.skills.${s.key}.rank`] = s.rank;
  }
  if (g.groupSkills.length) {
    const groups = foundry.utils.deepClone(actor.system.groupSkills || {});
    const norm = x => String(x || "").toLowerCase().trim();
    for (const gs of g.groupSkills) {
      const arr = (groups[gs.group] ||= []);
      const ex = arr.find(e => norm(e.specialty) === norm(gs.specialty));
      if (ex) { if (rankIdx(ex.rank) < rankIdx(gs.rank)) ex.rank = gs.rank; }
      else {
        // Ключ каталога и своя Характеристика — чтобы механики находили навык.
        const sd = matchSpec(gs.group, gs.specialty);
        arr.push({ specialty: gs.specialty, rank: gs.rank, grantedRank: gs.rank, cost: 0,
                   originGranted: tag, ...(sd ? { specKey: sd.key } : {}), ...(sd?.char ? { char: sd.char } : {}) });
      }
    }
    update["system.groupSkills"] = groups;
  }
  if (g.wounds) {
    update["system.wounds.max"]   = (Number(actor.system.wounds?.max) || 0) + g.wounds;
    update["system.wounds.value"] = (Number(actor.system.wounds?.value) || 0) + g.wounds;
  }

  let corruption = g.corruption;
  const rolls = [];
  if (g.corruptionRoll) {
    const r = await new Roll(g.corruptionRoll).evaluate();
    rolls.push(r); corruption += r.total;
  }
  if (corruption) update["system.corruption.value"] = (Number(actor.system.corruption?.value) || 0) + corruption;

  if (Object.keys(update).length) await actor.update(update);
  if (owner) {
    if (Object.keys(skillRanks).length) await owner.setFlag(FLAG, "skillRanks", skillRanks);
    if (g.wounds) await owner.setFlag(FLAG, "woundBonus", g.wounds);
  }

  const lines = [];
  if (g.skills.length)
    lines.push(`<b>Навыки:</b> ${esc(g.skills.map(s => `${SKILLS_DEF[s.key]?.label || s.key} (${SKILL_RANKS[s.rank]?.label || s.rank})`).join(", "))}`);
  if (g.groupSkills.length)
    lines.push(`<b>Знания:</b> ${esc(g.groupSkills.map(x => `${GROUP_SKILLS_DEF[x.group]?.label || x.group} (${x.specialty})`).join(", "))}`);
  if (g.talents.length) lines.push(`<b>Таланты:</b> ${esc(g.talents.join(", "))}`);
  if (g.traits.length)  lines.push(`<b>Черты:</b> ${esc(g.traits.map(t => `${t.name}${t.hasRating ? ` (${t.rating})` : ""}`).join(", "))}`);
  if (g.wounds)     lines.push(`<b>Раны:</b> +${g.wounds}`);
  if (corruption)   lines.push(`<b>Порча:</b> +${corruption}`);
  return lines;
}

/**
 * Снимает предмет-источник и всё, что он выдал, возвращая ранги навыков.
 *
 * wdbc-gbpe: ownerItem — это то, что нашёл вызывающий (`actorXItem(actor)`,
 * почти везде голый `.find()` — берёт только ПЕРВЫЙ предмет этого типа).
 * Из-за гонки в применении (applyHomeworld/applyLegion и т.п. делают «clear,
 * потом grant» без замка от повторного/параллельного входа — конкретный
 * пример: character-wizard.mjs звал applyHomeworldPicks(...).then(...) без
 * await) на акторе иногда оказывается ВТОРОЙ, «осиротевший» предмет того же
 * типа: лист его не показывает (тот же `.find()` в дропдауне видит только
 * первый), но вкладка ЭФФЕКТЫ честно показывает оба набора бонусов —
 * пользователь видел это как «одни и те же значения по 2-3 раза».
 *
 * Носители двух разных форм в этой кодовой базе:
 *   - homeworld/divination — сам носитель НИЧЕМ не помечен (flags без
 *     originGrant), только то, что он выдал, несёт GRANT===tag. Сирота
 *     такого вида НЕ попадает ни в granted (не помечен), ни (раньше) в ids —
 *     это и есть дыра wdbc-gbpe.
 *   - race/subrace/archetype — САМ носитель тоже несёт GRANT===tag (см.
 *     races.mjs::applyRace, `data.flags[FLAG][GRANT] = tag`). Через это его
 *     уже ловит granted-фильтр ниже, сколько бы копий ни возникло — чинить
 *     здесь нечего, тег и есть источник истины.
 *
 * ВАЖНО: race/racePast — оба хранятся предметами ОДНОГО item.type ("race"),
 * различаясь только тегом (races.mjs: «Прошлое Иннари/Арлекина кладёт
 * документ той же расы»). Поэтому чистить «любой предмет того же типа, что
 * ownerItem» нельзя — задело бы чужой тег того же типа. Сироты (untagged)
 * ищутся ТОЛЬКО когда сам ownerItem тоже untagged (homeworld/divination) —
 * self-тегированный ownerItem (race/subrace/archetype) эту ветку не запускает.
 */
export async function clearGrantedBy(actor, tag, ownerItem) {
  const ownerIsUntagged = !!ownerItem && !ownerItem.getFlag(FLAG, GRANT);
  const orphansSameType = ownerIsUntagged
    ? actor.items.filter(i => i.type === ownerItem.type && !i.getFlag(FLAG, GRANT))
    : [];
  const ownerItems = ownerItem ? [ownerItem, ...orphansSameType.filter(i => i.id !== ownerItem.id)] : [];
  const granted = actor.items.filter(i => i.getFlag(FLAG, GRANT) === tag);
  const ids = [...new Set([...ownerItems.map(i => i.id), ...granted.map(i => i.id)])];

  const update = {};
  for (const owner of ownerItems) {
    for (const [key, rec] of Object.entries(owner?.getFlag(FLAG, "skillRanks") || {})) {
      if (actor.system.skills?.[key]?.rank === rec.to) update[`system.skills.${key}.rank`] = rec.from;
    }
  }
  const groups = foundry.utils.deepClone(actor.system.groupSkills || {});
  let touched = false;
  for (const [k, arr] of Object.entries(groups)) {
    if (!Array.isArray(arr)) continue;
    const kept = arr.filter(e => e?.originGranted !== tag && !(tag === "homeworld" && e?.hwGranted));
    if (kept.length !== arr.length) { groups[k] = kept; touched = true; }
  }
  if (touched) update["system.groupSkills"] = groups;

  const wb = ownerItems.reduce((sum, owner) => sum + (Number(owner?.getFlag(FLAG, "woundBonus")) || 0), 0);
  if (wb) update["system.wounds.max"] = Math.max(0, (Number(actor.system.wounds?.max) || 0) - wb);

  if (Object.keys(update).length) await actor.update(update);
  if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
}

/**
 * Таланты по именам: описание из библиотеки, скобки — в специализацию.
 * @param {object} [targetsByName]  имя → цель (rules/talent-targets.mjs) из
 *   пикера вида+значения (choices[].type "target") — пишется в
 *   system.targets, чтобы targetMatches() реально находил цель Ненависти/
 *   Связей/Доброго Имени, а не только показывал её в скобках имени.
 */
async function buildTalents(names, sourceLabel, tag, owner, targetsByName = {}) {
  let lib = [];
  try {
    const pack = game.packs.get("warhammer-dbc.talents");
    if (pack) lib = await pack.getDocuments();
  } catch (e) { /* библиотека недоступна — создадим заглушки */ }
  const norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
  const byEng = new Map();
  for (const d of lib) byEng.set(norm(d.name.split("/")[0]), d);

  return names.map(full => {
    const m = /^([^(]+)(?:\(([^)]*)\))?$/.exec(String(full).trim());
    const src  = byEng.get(norm(m?.[1]));
    const spec = (m?.[2] || "").trim();
    const data = src ? src.toObject() : { name: full, type: "talent", system: {} };
    delete data._id;
    data.system = { ...(data.system || {}), specialization: spec, source: sourceLabel };
    const target = targetsByName[full];
    if (target) data.system.targets = [target];
    data.flags  = { ...(data.flags || {}), [FLAG]: { [GRANT]: tag, grantedByItem: owner?.id } };
    return data;
  });
}
