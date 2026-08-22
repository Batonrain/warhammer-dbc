// module/sheets/tabs/advance.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Вкладка РАЗВИТИЕ: склонности персонажа, записи Групп Навыков и список
//  Талантов в Развитии. Здесь же накопительные цены продвижения (стр. 23-24),
//  которыми пользуются и соседние секции листа.
//  Функции принимают актора, а не лист.
// ════════════════════════════════════════════════════════════════════════════

import { APTITUDES } from "../../constants/characteristics.mjs";
import { charAptitudeSet, charCostXP, skillCostXP, talentCostXP,
         resolveTalentAptitudes } from "../../constants/advancement.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../../constants/skills.mjs";
import { cultureCat, resolveCultureFx } from "../../constants/legions.mjs";
import { isFriendlySpecialty } from "../../rules/friendly-specialties.mjs";
import { talentCategory } from "../item-picker.mjs";
import { openContextMenu, closeContextMenus } from "../context-menu.mjs";
import { esc } from "../../helpers/utils.mjs";

// Шаги продвижения характеристики (+5..+25) и ранги навыка — индексы в таблицах цен.
const CHAR_IMP_STEPS   = { none: 0, simple: 1, average: 2, trained: 3, significant: 4, expert: 5 };
const SKILL_RANK_STEPS = { untrained: 0, knows: 1, trained: 2, veteran: 3, expert: 4 };

/**
 * Машинная культура легиона персонажа. Культура может быть от ДРУГОГО легиона,
 * чем геносемя (в системе это отдельные поля), поэтому берём именно её.
 */
function cultFxOf(actor) {
  const gs = actor?.system?.geneSeed;
  if (!gs) return null;
  return resolveCultureFx(gs.cultureLegion || gs.legion, gs.cultureChapter || gs.chapter);
}

/**
 * Цена уровня улучшения характеристики (стр. 23-24): сумма шагов +5..+25 до
 * выбранного уровня, категория — по совпадению склонностей.
 * grantedImp — бесплатный уровень от архетипа/расы (кнопка ★): опыт считается
 * только за ступени ВЫШЕ выданного. Не передан — берётся с листа.
 */
export function charImpCost(actor, charKey, improvement, grantedImp) {
  const apts  = charAptitudeSet(actor.system.aptitudes);
  const steps = CHAR_IMP_STEPS[improvement] ?? 0;
  const floor = CHAR_IMP_STEPS[grantedImp ?? actor.system.characteristics?.[charKey]?.grantedImp] ?? 0;
  let sum = 0;
  for (let i = Math.max(floor, 0); i < steps; i++) sum += charCostXP(i, charKey, apts);
  return sum;
}

/**
 * Цена ранга навыка (стр. 23-24, 57): сумма ступеней выше выданного архетипом.
 * entryChar — своя Характеристика записи Группы Навыков (Operate (Voidship) —
 * Интеллект), она же меняет склонности, а значит и категорию цены.
 */
export function skillCumCost(actor, def, rank, entryChar, grantedRank, group, specialty) {
  const apts     = charAptitudeSet(actor.system.aptitudes);
  const itemApts = [entryChar || def?.char, def?.apt2].filter(Boolean);
  const steps    = SKILL_RANK_STEPS[rank] ?? 0;
  const floor    = SKILL_RANK_STEPS[grantedRank] ?? 0;
  let sum = 0;
  // Общие знания и Ремесло всегда Дружественные — это перебивает и Склонности,
  // и культуру легиона (стр. 58, 61). То же самое — специализация, отмеченная
  // как Дружественная на Родном мире (Исследовательская станция).
  const cat = def?.alwaysAlly ? "ally"
    : (group && isFriendlySpecialty(actor, group, specialty)) ? "ally"
    : cultureCat("skill", def?.label || def?.name || "", "", cultFxOf(actor));
  for (let i = Math.max(floor, 0); i < steps; i++) sum += skillCostXP(i, itemApts, apts, cat);
  return sum;
}

// ── Склонности персонажа ────────────────────────────────────────────────────

/** Текущий список как массив (защита от случая, когда значение стало объектом). */
function aptitudesOf(actor) {
  const v = actor.system.aptitudes;
  if (Array.isArray(v)) return [...v];
  if (v && typeof v === "object") return Object.values(v);
  return [];
}

export async function addAptitude(actor) {
  const arr = aptitudesOf(actor);
  // Первая незанятая склонность из списка (чтобы не плодить дубли/пустышки).
  const used = new Set(arr);
  const free = Object.keys(APTITUDES).find(k => k !== "general" && !used.has(k)) || "ws";
  arr.push(free);
  await actor.update({ "system.aptitudes": arr });
}

export async function removeAptitude(actor, index) {
  const arr = aptitudesOf(actor);
  arr.splice(index, 1);
  await actor.update({ "system.aptitudes": arr });
}

/**
 * Смена склонностей → пересчёт цен характеристик, навыков, групповых навыков
 * (стр. 24) и купленных талантов-предметов. Стартовые таланты с ценой 0 не
 * трогаем: за них опыт не платили.
 */
export async function setAptitudes(actor, list) {
  await actor.update({ "system.aptitudes": list });

  const upd = {};
  for (const [k, c] of Object.entries(actor.system.characteristics || {}))
    if (c?.improvement && c.improvement !== "none")
      upd[`system.characteristics.${k}.cost`] = charImpCost(actor, k, c.improvement, c.grantedImp || "none");
  for (const [k, s] of Object.entries(actor.system.skills || {}))
    if (s?.rank && s.rank !== "untrained")
      upd[`system.skills.${k}.cost`] = skillCumCost(actor, SKILLS_DEF[k], s.rank, null, s.grantedRank || "untrained");
  for (const [gk, entries] of Object.entries(actor.system.groupSkills || {})) {
    if (!Array.isArray(entries) || !entries.length) continue;
    const def = GROUP_SKILLS_DEF[gk];
    upd[`system.groupSkills.${gk}`] = entries.map(e => ({
      ...e,
      cost: (e?.rank && e.rank !== "untrained")
        ? skillCumCost(actor, def, e.rank, e.char, e.grantedRank || "untrained", gk, e.specialty)
        : (e.cost || 0)
    }));
  }
  if (Object.keys(upd).length) await actor.update(upd);

  const apts = charAptitudeSet(actor.system.aptitudes);
  const defs = { skills: SKILLS_DEF, groupSkills: GROUP_SKILLS_DEF };
  const talUpd = actor.items
    // costManual — ГМ вписал цену руками (вкладка «Развитие»): пересчёт по
    // Склонностям её не трогает, иначе правка терялась бы на следующую же
    // смену Склонности (wdbc-cct).
    .filter(it => it.type === "talent" && it.system?.purchased && !it.system?.costManual)
    .map(it => {
      // Mastery / Beyond Human считаем по склонностям привязанной Х-ки/Навыка
      // (aptSource), а не по записи компендиума (стр. 62).
      const a = it.system.aptSource
        ? resolveTalentAptitudes(it.name, it.system.aptitudes || [], it.system.aptSource, defs)
        : (it.system.aptitudes || []);
      return { _id: it.id, "system.cost": talentCostXP(it.system.tier, a, apts,
        talentCategory(actor, it.name), { name: it.name, patron: actor.system.patronGod }) };
    });
  if (talUpd.length) await actor.updateEmbeddedDocuments("Item", talUpd);
}

// ── Записи Групп Навыков ────────────────────────────────────────────────────

async function writeEntries(actor, group, entries) {
  await actor.update({ [`system.groupSkills.${group}`]: entries });
}

/** Правка одной записи. Ранг тянет за собой авто-цену, остальные поля — нет. */
export async function setGroupEntryField(actor, group, index, field, value) {
  const entries = foundry.utils.deepClone(actor.system.groupSkills?.[group] ?? []);
  const entry   = entries[index];
  if (entry) {
    if (field === "rank") {
      entry.rank = value;
      entry.cost = skillCumCost(actor, GROUP_SKILLS_DEF[group], value, entry.char, entry.grantedRank || "untrained", group, entry.specialty);
    } else if (field === "cost") {
      entry.cost = parseInt(value) || 0;
    } else {
      entry[field] = value;
    }
  }
  await writeEntries(actor, group, entries);
}

export async function renameGroupEntry(actor, group, index, name) {
  await setGroupEntryField(actor, group, index, "specialty", name);
}

export async function removeGroupEntry(actor, group, index) {
  const entries = foundry.utils.deepClone(actor.system.groupSkills?.[group] ?? []);
  entries.splice(index, 1);
  await writeEntries(actor, group, entries);
}

/** Переименование специализации: свободный ввод, пустая строка = отмена. */
export function showRenameDialog(currentName) {
  return new Promise(resolve => {
    let resolved = false;
    const d = new Dialog({
      title: "Переименовать специализацию",
      content: `<form style="padding:8px 4px;">
        <input type="text" id="rename-input" value="${currentName}"
          style="width:100%;padding:4px 6px;background:var(--wh-input-bg,#ccc8bc);
                 border:1px solid var(--wh-border,#7a5c2e);font-family:inherit;
                 font-size:1em;box-sizing:border-box;" autocomplete="off"/>
      </form>`,
      buttons: {
        ok: {
          icon: '<i class="fas fa-check"></i>', label: "Сохранить",
          callback: html => {
            if (!resolved) {
              resolved = true;
              resolve(html.find("#rename-input").val().trim() || null);
            }
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>', label: "Отмена",
          callback: () => { if (!resolved) { resolved = true; resolve(null); } }
        }
      },
      default: "ok",
      render: html => {
        setTimeout(() => {
          const inp = html.find("#rename-input")[0];
          if (inp) { inp.focus(); inp.select(); }
        }, 50);
        html.find("#rename-input").on("keydown", ev => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            if (!resolved) {
              resolved = true;
              const val = html.find("#rename-input").val().trim();
              d.close(); resolve(val || null);
            }
          }
        });
      },
      close: () => { if (!resolved) { resolved = true; resolve(null); } }
    }, { classes: ["dialog","wh-rename-dialog"], width: 360 });
    d.render(true);
  });
}

// ── Таланты в Развитии ──────────────────────────────────────────────────────

function advTalentsOf(actor) {
  const v = actor.system.advanceTalents;
  if (Array.isArray(v)) return foundry.utils.deepClone(v);
  if (v && typeof v === "object") return Object.values(v);
  return [];
}

export async function addAdvTalent(actor) {
  const arr = advTalentsOf(actor);
  arr.push({ name: "", cost: 0 });
  await actor.update({ "system.advanceTalents": arr });
}

export async function removeAdvTalent(actor, index) {
  const arr = advTalentsOf(actor);
  arr.splice(index, 1);
  await actor.update({ "system.advanceTalents": arr });
}

/**
 * Удаление КУПЛЕННОГО таланта-предмета прямо из «Развития» (возврат опыта
 * происходит сам: actor.mjs суммирует system.cost предметов-талантов).
 */
export async function removePurchasedTalent(actor, itemId) {
  const item = actor.items.get(itemId);
  if (!item) return;
  const ok = await Dialog.confirm({
    title: "Удалить талант",
    content: `<p>Удалить <b>${esc(item.name)}</b> с листа? Потраченный опыт (${parseInt(item.system?.cost) || 0}) вернётся.</p>`
  });
  if (ok) await item.delete();
}

export function activateAdvanceListeners(html, actor, { addGroupSkill, jq = globalThis.$ } = {}) {

  // ── Характеристики: значение, уровень улучшения и цена ────────────────────
  html.find(".char-input").change(ev => {
    const el = ev.currentTarget;
    actor.update({
      [`system.characteristics.${el.dataset.char}.${el.dataset.field}`]: parseInt(el.value) || 0
    });
  });
  html.find(".char-improvement-select").change(ev => {
    const el = ev.currentTarget;
    const charKey = el.dataset.char;
    // Ставим уровень И авто-цену (можно затем поправить вручную в поле «Цена»).
    actor.update({
      [`system.characteristics.${charKey}.improvement`]: el.value,
      [`system.characteristics.${charKey}.cost`]: charImpCost(actor, charKey, el.value)
    });
  });
  html.find(".char-cost-input").change(ev => {
    const el = ev.currentTarget;
    actor.update({ [`system.characteristics.${el.dataset.char}.cost`]: parseInt(el.value) || 0 });
  });

  // Цена психосилы и техночуда: поле есть и здесь, и на вкладках «ПСИ»/«ТЕХНО»,
  // а сумма из них уходит в «Потрачено» на этой вкладке — потому обработчик один.
  html.find(".psy-cost-input, .tech-cost-input").on("change", ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) item.update({ "system.cost": parseInt(ev.currentTarget.value) || 0 });
  });

  // ── Навыки: ранг и цена ───────────────────────────────────────────────────
  html.find(".skill-rank-select").change(ev => {
    const el = ev.currentTarget;
    const key = el.dataset.skill;
    const granted = actor.system.skills?.[key]?.grantedRank || "untrained";
    actor.update({
      [`system.skills.${key}.rank`]: el.value,
      [`system.skills.${key}.cost`]: skillCumCost(actor, SKILLS_DEF[key], el.value, null, granted)
    });
  });
  html.find(".skill-cost-input").change(ev => {
    const el = ev.currentTarget;
    actor.update({ [`system.skills.${el.dataset.skill}.cost`]: parseInt(el.value) || 0 });
  });

  // ── Ручная пометка «выдано архетипом» (★) ────────────────────────────────
  // Мастер выдаёт бесплатное автоматически (grantedRank/grantedImp), но то,
  // что вписано руками, считалось купленным: обнулённая цена возвращалась при
  // следующей смене ранга. Кнопка ★ фиксирует текущий уровень как бесплатный.
  html.find(".grant-toggle[data-char]").click(ev => {
    ev.preventDefault();
    const charKey = ev.currentTarget.dataset.char;
    const c   = actor.system.characteristics?.[charKey] || {};
    const imp = c.improvement || "none";
    const on  = (c.grantedImp || "none") !== "none";
    const nextGranted = on ? "none" : imp;
    if (!on && imp === "none")
      return ui.notifications.warn("Сначала выберите уровень улучшения, потом помечайте его как выданный.");
    actor.update({
      [`system.characteristics.${charKey}.grantedImp`]: nextGranted,
      [`system.characteristics.${charKey}.cost`]: charImpCost(actor, charKey, imp, nextGranted)
    });
  });

  html.find(".grant-toggle[data-skill]").click(ev => {
    ev.preventDefault();
    const key = ev.currentTarget.dataset.skill;
    const sk  = actor.system.skills?.[key] || {};
    const rank = sk.rank || "untrained";
    const on   = (sk.grantedRank || "untrained") !== "untrained";
    const nextGranted = on ? "untrained" : rank;
    if (!on && rank === "untrained")
      return ui.notifications.warn("Сначала выберите ранг навыка, потом помечайте его как выданный.");
    actor.update({
      [`system.skills.${key}.grantedRank`]: nextGranted,
      [`system.skills.${key}.cost`]: skillCumCost(actor, SKILLS_DEF[key], rank, null, nextGranted)
    });
  });

  // ★ у таланта-предмета: «выдан архетипом» ↔ «куплен за опыт».
  html.find(".grant-toggle[data-talent]").click(async ev => {
    ev.preventDefault();
    const item = actor.items.get(ev.currentTarget.dataset.talent);
    if (!item) return;
    const cost = parseInt(item.system?.cost) || 0;
    const on   = !!item.system?.granted || (cost === 0 && !item.system?.purchased);
    if (on) {
      // Снимаем ★ → талант считается купленным, цена по склонностям (стр. 23-24).
      const apts = charAptitudeSet(actor.system.aptitudes);
      const a = item.system.aptSource
        ? resolveTalentAptitudes(item.name, item.system.aptitudes || [], item.system.aptSource,
            { skills: SKILLS_DEF, groupSkills: GROUP_SKILLS_DEF })
        : (item.system.aptitudes || []);
      // costManual снимается вместе с ★: обе ветки ставят цену сами, и оставить
      // талант помеченным «цена вручную» значило бы навсегда исключить его из
      // пересчёта по Склонностям — с числом, которое ГМ руками не вписывал.
      await item.update({
        "system.granted": false, "system.purchased": true, "system.costManual": false,
        "system.cost": talentCostXP(item.system.tier, a, apts, talentCategory(actor, item.name),
          { name: item.name, patron: actor.system.patronGod })
      });
    } else {
      await item.update({ "system.granted": true, "system.purchased": false,
                          "system.costManual": false, "system.cost": 0 });
    }
  });

  // Ручная цена таланта-предмета (wdbc-cct): не все Таланты редактируются на
  // «Способностях» (там только выданные генерацией отмечаются ★, число не
  // тронуть), а старый ручной список advanceTalents — отдельные строки без
  // связи с реальным предметом. Здесь — то же поле system.cost, что считает
  // авто-цена, просто со взведённым costManual, чтобы setAptitudes его
  // больше не перезаписывал при смене Склонностей.
  html.find(".advtal-cost-input").on("change", async ev => {
    const id = ev.currentTarget.dataset.talent;
    const item = actor.items.get(id);
    if (!item) return;
    const value = Math.max(0, parseInt(ev.currentTarget.value) || 0);
    await item.update({ "system.cost": value, "system.costManual": true });
  });

  // Вернуть авто-цену по Склонностям — снимает ручную правку и сразу же
  // пересчитывает, а не просто снимает флаг до следующей смены Склонности.
  html.find(".advtal-cost-reset").click(async ev => {
    ev.preventDefault();
    const item = actor.items.get(ev.currentTarget.dataset.talent);
    if (!item) return;
    const apts = charAptitudeSet(actor.system.aptitudes);
    const a = item.system.aptSource
      ? resolveTalentAptitudes(item.name, item.system.aptitudes || [], item.system.aptSource,
          { skills: SKILLS_DEF, groupSkills: GROUP_SKILLS_DEF })
      : (item.system.aptitudes || []);
    await item.update({
      "system.costManual": false,
      "system.cost": talentCostXP(item.system.tier, a, apts, talentCategory(actor, item.name),
        { name: item.name, patron: actor.system.patronGod })
    });
  });

  html.find(".grant-toggle[data-group]").click(ev => {
    ev.preventDefault();
    const el      = ev.currentTarget;
    const gk      = el.dataset.group;
    const idx     = parseInt(el.dataset.index);
    const entries = foundry.utils.deepClone(actor.system.groupSkills?.[gk] ?? []);
    const e = entries[idx]; if (!e) return;
    const rank = e.rank || "untrained";
    const on   = (e.grantedRank || "untrained") !== "untrained";
    if (!on && rank === "untrained")
      return ui.notifications.warn("Сначала выберите ранг навыка, потом помечайте его как выданный.");
    e.grantedRank = on ? "untrained" : rank;
    e.cost = skillCumCost(actor, GROUP_SKILLS_DEF[gk], rank, e.char, e.grantedRank, gk, e.specialty);
    actor.update({ [`system.groupSkills.${gk}`]: entries });
  });

  html.find(".add-group-skill").click(ev => {
    ev.preventDefault(); ev.stopPropagation();
    addGroupSkill(ev.currentTarget.dataset.group);
  });

  const entryField = field => async ev => {
    const el = ev.currentTarget;
    await setGroupEntryField(actor, el.dataset.group, parseInt(el.dataset.index), field, el.value);
  };
  html.find(".group-skill-rank-select").change(entryField("rank"));
  html.find(".group-skill-cost-input").change(entryField("cost"));
  html.find(".group-skill-char-select").change(entryField("char"));

  html.find(".group-skill-entry-row").on("contextmenu", ev => {
    ev.preventDefault(); ev.stopPropagation();
    const group = ev.currentTarget.dataset.group;
    const idx   = parseInt(ev.currentTarget.dataset.index);
    openContextMenu(ev, [
      {
        cls: "wh-ctx-rename",
        label: "✏️ Переименовать",
        onClick: () => {
          const current = (actor.system.groupSkills?.[group] ?? [])[idx]?.specialty ?? "";
          showRenameDialog(current).then(newName => {
            if (!newName || newName === current) return;
            renameGroupEntry(actor, group, idx, newName);
          });
        }
      },
      {
        cls: "wh-ctx-delete",
        label: "🗑️ Удалить",
        onClick: () => removeGroupEntry(actor, group, idx)
      }
    ], jq);
  });
  html.find(".skills-advance-scroll").on("scroll", () => closeContextMenus(jq));

  html.find(".apt-char-add-btn").click(async ev => {
    ev.preventDefault();
    await addAptitude(actor);
  });
  html.find(".apt-char-remove").click(async ev => {
    ev.preventDefault();
    await removeAptitude(actor, parseInt(ev.currentTarget.dataset.index));
  });
  html.find(".apt-char-select").on("change", async () => {
    const arr = [];
    html.find(".apt-char-select").each((_, el) => arr.push(el.value));
    await setAptitudes(actor, arr);
  });

  html.find(".advtal-add-btn").click(async ev => {
    ev.preventDefault();
    await addAdvTalent(actor);
  });
  html.find(".advtal-remove").click(async ev => {
    ev.preventDefault();
    await removeAdvTalent(actor, parseInt(ev.currentTarget.dataset.index));
  });
  html.find(".advtal-item-remove").click(async ev => {
    ev.preventDefault();
    await removePurchasedTalent(actor, ev.currentTarget.dataset.itemId);
  });
  html.find(".advtal-input").on("change", async () => {
    const arr = [];
    html.find(".advtal-input").each((_, el) => {
      const i = parseInt(el.dataset.index);
      if (!arr[i]) arr[i] = { name: "", cost: 0 };
      if (el.dataset.field === "cost") arr[i].cost = parseInt(el.value) || 0;
      else                             arr[i].name = el.value;
    });
    await actor.update({ "system.advanceTalents": arr });
  });
}
