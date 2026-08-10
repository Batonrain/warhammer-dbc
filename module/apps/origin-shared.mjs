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

const FLAG = "warhammer-dbc";
const GRANT = "originGrant";           // помечает всё выданное (для отката)

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

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
        fields: ["system.key", "system.roll", "system.table", "system.n", "system.mods", "system.description"]
      });
      CACHE.set(tag, index.contents.map(e => ({
        key:  e.system?.key || e._id,
        name: e.name,
        roll: e.system?.roll || "",
        table: e.system?.table || "",
        n: e.system?.n ?? null,
        mods: e.system?.mods || "",
        description: e.system?.description || "",
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
 * Спрашивает про все выборы разом.
 * @returns {Promise<object|null>} null — окно закрыли, менять ничего не нужно
 */
export function promptGrantChoices({ title, head, desc, charChoices = [], choices = [], actor }) {
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
    } else if (ch.type === "text") {
      blocks.push(`<div class="hw-choice">
        <div class="hw-choice-label">${esc(ch.label)}</div>
        <div class="hw-choice-hint">${esc(ch.hint || "")}</div>
        <input type="text" data-choice="${ch.key}" placeholder="${esc(ch.placeholder || "")}"/></div>`);
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

  return new Promise(resolve => {
    let done = false;
    new Dialog({
      title,
      content: `<form class="hw-choice-form">
        <div class="hw-choice-head">${esc(head)}</div>
        <div class="hw-choice-desc">${esc(desc)}</div>
        ${blocks.join("")}
      </form>`,
      buttons: {
        ok: { icon: '<i class="fas fa-check"></i>', label: "Принять", callback: h => {
          if (done) return; done = true;
          const out = { charChoices: [], one: {}, text: {}, many: {} };
          h.find("select[data-charchoice]").each((_, el) =>
            { out.charChoices[parseInt(el.dataset.charchoice)] = parseInt(el.value) || 0; });
          h.find("select[data-choice]").each((_, el) => { out.one[el.dataset.choice] = parseInt(el.value) || 0; });
          h.find("input[data-choice]").each((_, el) => { out.text[el.dataset.choice] = String(el.value || "").trim(); });
          h.find("input[data-many]").each((_, el) => {
            (out.many[el.dataset.many] ||= []).push(...String(el.value || "").split(",")
              .map(s => s.trim()).filter(Boolean).map(s => ({ group: el.dataset.group, specialty: s })));
          });
          resolve(out);
        }},
        cancel: { label: "Отмена", callback: () => { if (!done) { done = true; resolve(null); } } }
      },
      default: "ok",
      render: h => {
        h.find("input[data-many]").on("input", ev => {
          const k = ev.currentTarget.dataset.many;
          let n = 0;
          h.find(`input[data-many="${k}"]`).each((_, el) =>
            { n += String(el.value || "").split(",").map(s => s.trim()).filter(Boolean).length; });
          const box = h.find(`[data-count-for="${k}"]`);
          const max = parseInt(box.text().split("/")[1]) || 0;
          box.text(`Выбрано: ${n} / ${max}`);
          box.toggleClass("hw-over", n > max);
        });
      },
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
    } else if (ch.type === "text") {
      const v = picks.text?.[ch.key] || "";
      if (v && ch.talentTemplate) g.talents.push(ch.talentTemplate.replace("{v}", v));
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
  if (g.talents.length) created.push(...await buildTalents(g.talents, sourceLabel, tag, owner));
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

/** Снимает предмет-источник и всё, что он выдал, возвращая ранги навыков. */
export async function clearGrantedBy(actor, tag, ownerItem) {
  const granted = actor.items.filter(i => i.getFlag(FLAG, GRANT) === tag);
  const ids = [...new Set([...(ownerItem ? [ownerItem.id] : []), ...granted.map(i => i.id)])];

  const update = {};
  for (const [key, rec] of Object.entries(ownerItem?.getFlag(FLAG, "skillRanks") || {})) {
    if (actor.system.skills?.[key]?.rank === rec.to) update[`system.skills.${key}.rank`] = rec.from;
  }
  const groups = foundry.utils.deepClone(actor.system.groupSkills || {});
  let touched = false;
  for (const [k, arr] of Object.entries(groups)) {
    if (!Array.isArray(arr)) continue;
    const kept = arr.filter(e => e?.originGranted !== tag && !(tag === "homeworld" && e?.hwGranted));
    if (kept.length !== arr.length) { groups[k] = kept; touched = true; }
  }
  if (touched) update["system.groupSkills"] = groups;

  const wb = Number(ownerItem?.getFlag(FLAG, "woundBonus")) || 0;
  if (wb) update["system.wounds.max"] = Math.max(0, (Number(actor.system.wounds?.max) || 0) - wb);

  if (Object.keys(update).length) await actor.update(update);
  if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
}

/** Таланты по именам: описание из библиотеки, скобки — в специализацию. */
async function buildTalents(names, sourceLabel, tag, owner) {
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
    data.flags  = { ...(data.flags || {}), [FLAG]: { [GRANT]: tag, grantedByItem: owner?.id } };
    return data;
  });
}
