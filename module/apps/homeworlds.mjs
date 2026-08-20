// module/apps/homeworlds.mjs
// ════════════════════════════════════════════════════════════════════════
//  Родные миры: выбор Происхождения и применение.
//
//  Выбор мира кладёт на актора предмет-мир (он несёт модификаторы
//  Характеристик), Черту-Особенность и всё, что мир выдаёт: навыки, таланты,
//  черты, Раны, Порчу. Всё выданное помечается флагом, чтобы смена мира
//  чисто откатывалась.
// ════════════════════════════════════════════════════════════════════════

import { HOMEWORLDS, HOMEWORLD_BY_KEY, HOMEWORLD_SOURCE,
         charModLabel, hasChoices } from "../constants/homeworlds.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../constants/skills.mjs";
import { SKILL_SPECIALIZATIONS } from "../constants/skill-specializations.mjs";
import { SKILL_RANKS } from "../constants/characteristics.mjs";
import { isFeatureEnabled } from "../constants/features.mjs";
import { registerPackCache, packEntries, clearGrantedBy, charBonusesToMechanics } from "./origin-shared.mjs";
import { esc } from "../helpers/utils.mjs";
import { SKIP_MECHANICS_HOOK } from "./races.mjs";
import { applyItemMechanics } from "./mechanics.mjs";
import { friendlySpecKey } from "../rules/friendly-specialties.mjs";

const PACK = "warhammer-dbc.homeworlds";
const FLAG = "warhammer-dbc";
const GRANT = "originGrant";
const TAG   = "homeworld";

// Список в дропдауне берётся из компендиума: запись, заведённая ГМом руками,
// появляется в нём наравне с книжными.
registerPackCache(PACK, TAG);

// ── Чтение состояния актора ──────────────────────────────────────────────

/** Предмет-мир, лежащий на акторе (или null). */
export function actorHomeworldItem(actor) {
  return actor?.items?.find(i => i.type === "homeworld") || null;
}

/** Ключ родного мира персонажа (или ""). */
export function actorHomeworldKey(actor) {
  return actorHomeworldItem(actor)?.system?.key || "";
}

/** Данные для дропдауна в шапке листа. */
export function homeworldSheetContext(actor) {
  if (!isFeatureEnabled("homeworlds")) return null;
  const item = actorHomeworldItem(actor);
  const cur  = item?.system?.key || "";
  const hw   = HOMEWORLD_BY_KEY[cur];
  return {
    enabled: true,
    current: cur,
    itemId: item?.id || "",
    label: hw?.label || "",
    featureName: hw?.feature?.name || "",
    charLabel: item?.system?.charModLabel || (hw ? charModLabel(hw.chars) : ""),
    options: packEntries(TAG, () => HOMEWORLDS.map(h => ({ key: h.key, name: h.label })))
      // Черты-Особенности лежат в том же компендиуме — в список миров они не идут.
      .filter(o => !!HOMEWORLD_BY_KEY[o.key] || o.key === o.name)
      .map(o => ({
        key: o.key,
        label: HOMEWORLD_BY_KEY[o.key]?.label || o.name,
        chars: HOMEWORLD_BY_KEY[o.key] ? charModLabel(HOMEWORLD_BY_KEY[o.key].chars) : "",
        selected: o.key === cur
      }))
  };
}

// ── Применение и очистка ─────────────────────────────────────────────────

/** Всё, что было выдано родным миром, помечено флагом — снимаем разом. */
export async function clearHomeworld(actor) {
  await clearGrantedBy(actor, TAG, actorHomeworldItem(actor));
}

/**
 * Есть ли у мира выбор специализаций, число которых зависит от Бонуса
 * Интеллекта (сейчас единственный такой — Исследовательская станция).
 * Нужен вызывающим, которые могут применять Родной мир ДО того, как у
 * персонажа вообще есть Интеллект (напр. Мастер создания — Родной мир
 * выбирается на Этапе 1, Характеристики только на Этапе 2): без Int.b
 * диалог показал бы «доступно 0» вместо настоящего числа.
 * @param {string} key ключ мира
 */
export function needsIntBonusChoice(key) {
  const hw = HOMEWORLD_BY_KEY[key];
  return !!(hw?.choices || []).some(c => c.countFormula === "intBonus2");
}

/**
 * Выбор родного мира: очищает прежний, спрашивает про выборы и применяет всё.
 * @param {Actor} actor
 * @param {string} key   ключ мира или "random" для случайного
 */
export async function applyHomeworld(actor, key) {
  if (!isFeatureEnabled("homeworlds")) return;

  if (key === "random") {
    const roll = await new Roll(`1d${HOMEWORLDS.length}`).evaluate();
    key = HOMEWORLDS[roll.total - 1].key;
    ui.notifications?.info(`Происхождение брошено: ${HOMEWORLD_BY_KEY[key].label}.`);
  }

  const hw = HOMEWORLD_BY_KEY[key];
  if (!key || !hw) { await clearHomeworld(actor); return; }

  // Сначала спрашиваем — чтобы отмена не оставила персонажа без прежнего мира.
  let picks = null;
  if (hasChoices(hw)) {
    picks = await promptChoices(hw, actor);
    if (picks === null) return;                       // игрок закрыл окно
  }

  await clearHomeworld(actor);
  await grantHomeworld(actor, hw, picks || {});
}

/** Диалог выборов мира: характеристика, пакеты, специализации, свободный текст. */
function promptChoices(hw, actor) {
  const intBonus = actor.system.characteristics?.int?.bonus ?? 0;
  const blocks = [];

  if (hw.charChoice) {
    const opts = hw.charChoice.options
      .map((o, i) => `<option value="${i}" ${i === 0 ? "selected" : ""}>${esc(o.label)}</option>`).join("");
    blocks.push(`<div class="hw-choice">
      <div class="hw-choice-label">${esc(hw.charChoice.label)}</div>
      <div class="hw-choice-hint">${esc(hw.charChoice.hint || "")}</div>
      <select id="hw-charchoice">${opts}</select></div>`);
  }

  for (const ch of (hw.choices || [])) {
    if (ch.type === "one") {
      const opts = ch.options
        .map((o, i) => `<option value="${i}" ${i === 0 ? "selected" : ""}>${esc(o.label)}</option>`).join("");
      blocks.push(`<div class="hw-choice">
        <div class="hw-choice-label">${esc(ch.label)}</div>
        <div class="hw-choice-hint">${esc(ch.hint || "")}</div>
        <select data-choice="${ch.key}">${opts}</select></div>`);
    }
    else if (ch.type === "text") {
      blocks.push(`<div class="hw-choice">
        <div class="hw-choice-label">${esc(ch.label)}</div>
        <div class="hw-choice-hint">${esc(ch.hint || "")}</div>
        <input type="text" data-choice="${ch.key}" placeholder="${esc(ch.placeholder || "")}"/></div>`);
    }
    else if (ch.type === "many") {
      // Число специализаций считается от Бонуса Интеллекта на момент выбора.
      const count = ch.countFormula === "intBonus2" ? intBonus * 2 : (ch.count || 0);
      // Общий пул канонических специализаций из всех перечисленных групп —
      // выпадающий список вместо слепого «впиши через запятую» (был источником
      // опечаток, которые matchSpec потом не мог сопоставить с каталогом).
      // Записи с free:true (вида «<Регион>») в пул не идут — под них нет
      // короткого выпадающего варианта, их по-прежнему вписывают вручную
      // на самом Навыке после создания.
      const pool = [];
      for (const g of (ch.groups || [])) {
        const def = GROUP_SKILLS_DEF[g];
        for (const s of (SKILL_SPECIALIZATIONS[g] || [])) {
          if (s.free) continue;
          pool.push({ value: `${g}:${s.key}`, label: `${def?.label || g} — ${s.ru || s.label}` });
        }
      }
      const optsHtml = pool.map(o => `<option value="${o.value}">${esc(o.label)}</option>`).join("");
      const rows = Array.from({ length: Math.max(count, 0) }, (_, i) => `
        <select class="hw-many-sel" data-many="${ch.key}">
          <option value="">— выбрать —</option>
          ${optsHtml}
        </select>`).join("");
      blocks.push(`<div class="hw-choice">
        <div class="hw-choice-label">${esc(ch.label)} — доступно ${count}</div>
        <div class="hw-choice-hint">${esc(ch.hint || "")}</div>
        <div class="hw-many-grid">${rows}</div>
        <div class="hw-choice-count" data-count-for="${ch.key}">Выбрано: 0 / ${count}</div></div>`);
    }
  }

  return new Promise(resolve => {
    let done = false;
    new Dialog({
      title: `Родной мир: ${hw.label}`,
      content: `<form class="hw-choice-form">
        <div class="hw-choice-head">${esc(hw.feature.name)}</div>
        <div class="hw-choice-desc">${esc(hw.feature.desc)}</div>
        ${blocks.join("")}
      </form>`,
      buttons: {
        ok: { icon: '<i class="fas fa-check"></i>', label: "Принять", callback: h => {
          if (done) return; done = true;
          const out = { charChoice: null, one: {}, text: {}, many: {} };
          if (hw.charChoice) out.charChoice = parseInt(h.find("#hw-charchoice").val()) || 0;
          h.find("select[data-choice]").each((_, el) => { out.one[el.dataset.choice] = parseInt(el.value) || 0; });
          h.find("input[data-choice]").each((_, el) => { out.text[el.dataset.choice] = String(el.value || "").trim(); });
          h.find("select.hw-many-sel").each((_, el) => {
            const val = String(el.value || "");
            if (!val) return;
            const k = el.dataset.many;
            const sep = val.indexOf(":");
            const group = val.slice(0, sep), specKey = val.slice(sep + 1);
            const specDef = (SKILL_SPECIALIZATIONS[group] || []).find(s => s.key === specKey);
            (out.many[k] ||= []).push({ group, specialty: specDef?.ru || specDef?.label || specKey });
          });
          resolve(out);
        }},
        cancel: { label: "Отмена", callback: () => { if (!done) { done = true; resolve(null); } } }
      },
      default: "ok",
      render: h => {
        // Живой счётчик для «выберите N специализаций».
        h.find("select.hw-many-sel").on("change", ev => {
          const k = ev.currentTarget.dataset.many;
          let n = 0;
          h.find(`select.hw-many-sel[data-many="${k}"]`).each((_, el) => { if (el.value) n++; });
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

/** Собственно выдача: предмет-мир, Черта, навыки, таланты, черты, Раны, Порча. */
async function grantHomeworld(actor, hw, picks) {
  const charBonuses = Object.entries(hw.chars || {}).map(([stat, value]) => ({ stat, value }));
  const chosenLabels = {};

  // Выбор характеристики (Схола Прогениум).
  if (hw.charChoice && picks.charChoice != null) {
    const o = hw.charChoice.options[picks.charChoice];
    if (o) {
      chosenLabels[hw.charChoice.label] = o.label;
      for (const [stat, value] of Object.entries(o.chars || {})) charBonuses.push({ stat, value });
    }
  }

  // Пакеты выбора (type: "one") и свободный текст (type: "text").
  const grants = { skills: [], groupSkills: [], talents: [], traits: [],
                   wounds: 0, corruptionRoll: null, ...cloneGrants(hw.grants) };

  for (const ch of (hw.choices || [])) {
    if (ch.type === "one") {
      const o = ch.options[picks.one?.[ch.key] ?? 0];
      if (!o) continue;
      chosenLabels[ch.label] = o.label;
      mergeGrants(grants, o.grants);
      for (const [stat, value] of Object.entries(o.grants?.chars || {})) charBonuses.push({ stat, value });
    }
    else if (ch.type === "text") {
      const v = picks.text?.[ch.key] || "";
      if (!v) continue;
      chosenLabels[ch.label] = v;
      if (ch.talentTemplate) grants.talents.push(ch.talentTemplate.replace("{v}", v));
    }
    else if (ch.type === "many") {
      const list = picks.many?.[ch.key] || [];
      if (list.length) chosenLabels[ch.label] = list.map(s => `${GROUP_SKILLS_DEF[s.group]?.label || s.group} (${s.specialty})`).join(", ");
    }
  }

  // ── Предмет-мир: несёт модификаторы Характеристик ──
  const friendly = (picks.many?.["research-lore"] || []);
  // Механику носителя ждём синхронно (SKIP_MECHANICS_HOOK, как у applyRace/
  // applyArchetype) — сама выдача мира интерактивных выборов не просит (те
  // уже отвечены выше, в promptChoices), но ГМ мог дописать в Механику
  // записи компендиума что угодно вручную, и без этого асинхронный хук
  // createItem мог бы отработать уже ПОСЛЕ того, как applyHomeworld вернул
  // управление вызывающему коду.
  const [worldItem] = await actor.createEmbeddedDocuments("Item", [{
    name: hw.label, type: "homeworld", img: "icons/svg/city.svg",
    system: {
      key: hw.key, description: hw.feature.desc, source: HOMEWORLD_SOURCE,
      featureName: hw.feature.name, featureDesc: hw.feature.desc,
      charModLabel: charBonuses.map(c => `${c.value >= 0 ? "+" : "−"}${Math.abs(c.value)} ${c.stat.toUpperCase()}`).join(", "),
      choices: chosenLabels, friendlySpecs: friendly.map(f => friendlySpecKey(f.group, f.specialty))
    },
    flags: { [FLAG]: { mechanics: charBonusesToMechanics(charBonuses) } }
  }], { [SKIP_MECHANICS_HOOK]: true });
  if (worldItem) await applyItemMechanics(worldItem);

  // ── Черта-Особенность ──
  const created = [{
    name: hw.feature.name, type: "trait", img: "icons/svg/aura.svg",
    system: {
      description: hw.feature.desc, benefit: hw.feature.desc,
      source: `${HOMEWORLD_SOURCE} — ${hw.label}`, hasRating: false, rating: 0,
      effects: { charBonusStat: "", charBonusValue: 0, charBonuses: [], charValueBonuses: [],
                 armourAll: 0, fearRating: 0, sizeMod: 0, initMod: 0, speedMod: 0 }
    },
    flags: { [FLAG]: { [GRANT]: TAG, grantedByItem: worldItem.id } }
  }];

  // ── Черты мира (Brutal Charge и т.п.) — тянем из библиотеки по английской
  //    части имени, как и таланты ниже; иначе получается пустая заглушка
  //    без описания/эффектов вместо настоящей Черты ──
  if (grants.traits.length) created.push(...await buildTraits(grants.traits, hw.label, worldItem));

  // ── Таланты: тянем описание из библиотеки по английской части имени ──
  if (grants.talents.length) created.push(...await buildTalents(grants.talents, hw.label, worldItem));

  if (created.length) await actor.createEmbeddedDocuments("Item", created);

  // ── Навыки, Раны, Порча ──
  const update = {};
  const skillRanks = {};
  for (const s of grants.skills) {
    const cur = actor.system.skills?.[s.key];
    if (!cur || !SKILLS_DEF[s.key]) continue;
    // Не понижаем то, что персонаж уже развил.
    if (rankIdx(cur.rank) >= rankIdx(s.rank)) continue;
    skillRanks[s.key] = { from: cur.rank || "untrained", to: s.rank };
    update[`system.skills.${s.key}.rank`] = s.rank;
  }

  if (grants.groupSkills.length) {
    const groups = foundry.utils.deepClone(actor.system.groupSkills || {});
    for (const g of grants.groupSkills) {
      const arr = (groups[g.group] ||= []);
      const norm = s => String(s || "").toLowerCase().trim();
      const ex = arr.find(e => norm(e.specialty) === norm(g.specialty));
      if (ex) { if (rankIdx(ex.rank) < rankIdx(g.rank)) ex.rank = g.rank; }
      else arr.push({ specialty: g.specialty, rank: g.rank, grantedRank: g.rank, cost: 0, hwGranted: true });
    }
    update["system.groupSkills"] = groups;
  }

  if (grants.wounds) {
    update["system.wounds.max"] = (Number(actor.system.wounds?.max) || 0) + grants.wounds;
    update["system.wounds.value"] = (Number(actor.system.wounds?.value) || 0) + grants.wounds;
  }

  let corruption = 0;
  const rolls = [];
  if (grants.corruptionRoll) {
    const r = await new Roll(grants.corruptionRoll).evaluate();
    rolls.push(r); corruption = r.total;
    update["system.corruption.value"] = (Number(actor.system.corruption?.value) || 0) + corruption;
  }

  if (Object.keys(update).length) await actor.update(update);
  if (Object.keys(skillRanks).length) await worldItem.setFlag(FLAG, "skillRanks", skillRanks);
  if (grants.wounds) await worldItem.setFlag(FLAG, "woundBonus", grants.wounds);

  await postSummary(actor, hw, { charBonuses, grants, chosenLabels, corruption, friendly, rolls });
}

const RANK_ORDER = ["untrained", "knows", "trained", "veteran", "expert"];
const rankIdx = r => Math.max(0, RANK_ORDER.indexOf(r || "untrained"));

function cloneGrants(g) {
  return {
    skills: [...(g?.skills || [])],
    groupSkills: [...(g?.groupSkills || [])],
    talents: [...(g?.talents || [])],
    traits: [...(g?.traits || [])],
    wounds: g?.wounds || 0,
    corruptionRoll: g?.corruptionRoll || null
  };
}
function mergeGrants(base, add) {
  if (!add) return;
  base.skills.push(...(add.skills || []));
  base.groupSkills.push(...(add.groupSkills || []));
  base.talents.push(...(add.talents || []));
  base.traits.push(...(add.traits || []));
  if (add.wounds) base.wounds += add.wounds;
  if (add.corruptionRoll) base.corruptionRoll = add.corruptionRoll;
}

/** Таланты по именам: описание из компендиума, скобки — в специализацию. */
async function buildTalents(names, worldLabel, worldItem) {
  let lib = [];
  try {
    const pack = game.packs.get("warhammer-dbc.talents");
    if (pack) lib = await pack.getDocuments();
  } catch (e) { /* библиотека недоступна — создадим заглушки */ }
  const norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
  const byEng = new Map();
  for (const d of lib) byEng.set(norm(d.name.split("/")[0]), d);

  return names.map(full => {
    const m = /^([^(]+)(?:\(([^)]*)\))?$/.exec(full.trim());
    const base = norm(m?.[1]);
    const spec = (m?.[2] || "").trim();
    const src  = byEng.get(base);
    const data = src ? src.toObject() : { name: full, type: "talent", system: {} };
    delete data._id;
    data.name = src ? src.name : full;
    data.system = { ...(data.system || {}), specialization: spec,
                    source: `${HOMEWORLD_SOURCE} — ${worldLabel}` };
    data.flags = { ...(data.flags || {}), [FLAG]: { [GRANT]: TAG, grantedByItem: worldItem?.id } };
    return data;
  });
}

/**
 * Черты, выдаваемые Родным миром (Brutal Charge и т.п.) — та же логика, что
 * и у buildTalents: ищем реальную Черту в библиотеке по английской части
 * имени (до "/"), клонируем (с описанием/эффектами), проставляя рейтинг из
 * grants.traits[].rating. Не нашли — заглушка (пустая, без описания), как
 * раньше, чтобы выдача Родного мира не падала на отсутствующей записи.
 */
async function buildTraits(traitGrants, worldLabel, worldItem) {
  let lib = [];
  try {
    const pack = game.packs.get("warhammer-dbc.traits");
    if (pack) lib = await pack.getDocuments();
  } catch (e) { /* библиотека недоступна — создадим заглушки */ }
  const norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
  const byEng = new Map();
  for (const d of lib) byEng.set(norm(d.name.split("/")[0]), d);

  return traitGrants.map(t => {
    const src = byEng.get(norm(t.name));
    const data = src ? src.toObject() : {
      name: t.name, type: "trait", img: "icons/svg/aura.svg",
      system: { description: "", benefit: "", hasRating: !!t.hasRating, rating: t.rating || 0,
                effects: { charBonusStat: "", charBonusValue: 0, charBonuses: [], charValueBonuses: [],
                           armourAll: 0, fearRating: 0, sizeMod: 0, initMod: 0, speedMod: 0 } }
    };
    delete data._id;
    data.name = src ? src.name : t.name;
    data.system = { ...(data.system || {}), source: `${HOMEWORLD_SOURCE} — ${worldLabel}` };
    if (src && t.hasRating) data.system.rating = t.rating ?? data.system.rating;
    data.flags = { ...(data.flags || {}), [FLAG]: { [GRANT]: TAG, grantedByItem: worldItem?.id } };
    return data;
  });
}

/** Карточка в чат: что именно дал родной мир. */
async function postSummary(actor, hw, { charBonuses, grants, chosenLabels, corruption, friendly, rolls }) {
  const lines = [];
  const chars = charBonuses.map(c => `${c.value >= 0 ? "+" : "−"}${Math.abs(c.value)} ${c.stat.toUpperCase()}`).join(", ");
  if (chars) lines.push(`<b>Характеристики:</b> ${esc(chars)}`);
  for (const [k, v] of Object.entries(chosenLabels)) lines.push(`<b>${esc(k)}:</b> ${esc(v)}`);
  if (grants.skills.length)
    lines.push(`<b>Навыки:</b> ${esc(grants.skills.map(s => `${SKILLS_DEF[s.key]?.label || s.key} (${SKILL_RANKS[s.rank]?.label || s.rank})`).join(", "))}`);
  if (grants.groupSkills.length)
    lines.push(`<b>Знания:</b> ${esc(grants.groupSkills.map(g => `${GROUP_SKILLS_DEF[g.group]?.label || g.group} (${g.specialty})`).join(", "))}`);
  if (grants.talents.length) lines.push(`<b>Таланты:</b> ${esc(grants.talents.join(", "))}`);
  if (grants.traits.length)  lines.push(`<b>Черты:</b> ${esc(grants.traits.map(t => `${t.name}${t.hasRating ? ` (${t.rating})` : ""}`).join(", "))}`);
  if (grants.wounds)  lines.push(`<b>Раны:</b> +${grants.wounds}`);
  if (corruption)     lines.push(`<b>Порча:</b> +${corruption} (${grants.corruptionRoll})`);
  if (friendly?.length)
    lines.push(`<b>Дружественные специализации:</b> ${esc(friendly.map(f => f.specialty).join(", "))}`);

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result hw-chat">
      <div class="roll-header">Родной мир — ${esc(actor.name)}</div>
      <div class="hw-chat-world">${esc(hw.label)}</div>
      <div class="hw-chat-feature"><b>${esc(hw.feature.name)}</b><div>${esc(hw.feature.desc)}</div></div>
      ${lines.length ? `<div class="hw-chat-grants">${lines.join("<br/>")}</div>` : ""}
    </div>`,
    rolls
  }, game.settings.get("core", "rollMode")));
}

