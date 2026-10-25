// module/apps/omophagea.mjs
// ════════════════════════════════════════════════════════════════════════
//  Омофагея (имплант Астартес) + Таланты Вор Памяти / Испробовать Душу
//  (3-b530). Арифметика — rules/omophagea.mjs.
//
//  Кнопка «Омофагея» на листе импланта: тест I+0 (Испробовать Душу даёт
//  +½ P окр.▲ — rules/situational.mjs, тег omophageaTest); успех — в чат
//  уходит число Успехов («воспоминания случайны и определяются ГМом в
//  зависимости от количества Успехов» — это книга, не код). С Вором Памяти
//  при успехе предлагается перенять Навык жертвы (цель — таргет, T): ступень
//  жертвы (не ниже своей) на I.b суток, не больше ½ I.b таких Навыков разом.
//  Срок снимает тик Календаря (hooks.mjs → sweepMemoryThief), как у Пожирателя
//  Знаний.
// ════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "../rules/flags.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { itemHasName } from "../rules/predicates.mjs";
import {
  MEMORY_THIEF_CAP, MEMORY_THIEF_FLAG, OMOPHAGEA_TEST_TAG,
  memoryThiefCandidates, memoryThiefRank, memoryThiefHasRoom, memoryThiefDurationSeconds,
  memoryThiefMax, expiredMemoryThief
} from "../rules/omophagea.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { clearForesight } from "./talent-actions.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

const NS = "warhammer-dbc";

/** Это имплант Омофагея? Опознаётся по имени предмета (в паке «Омофагея / Omophagea»). */
export function isOmophageaItem(item) {
  // Только английская часть имени: русская в паке с номером («8. Омофагея»), точное
  // сравнение по ней не совпало бы (тест talent-name-literals).
  return item?.type === "implant" && itemHasName(item, "Omophagea");
}

/** Панель для листа импланта; пусто у прочих имплантов и вне актора. */
export function omophageaPanelHtml(item, actor) {
  if (!isOmophageaItem(item) || !actor) return "";
  const active = actor.getFlag?.(NS, MEMORY_THIEF_FLAG) ?? [];
  const thief = hasRuleFlag(actor, MEMORY_THIEF_CAP);
  const ib = Number(actor.system?.characteristics?.int?.bonus) || 0;
  return `<div class="omophagea-panel">
    <button type="button" class="omophagea-btn" data-item-id="${esc(item.id)}"
      title="Съев мозг разумного существа — тест I+0 (Испробовать Душу: +½ P окр.▲). Число Успехов определяет, сколько воспоминаний выудил десантник — ГМ решает какие.${thief ? " Вор Памяти: при успехе можно взять Навык жертвы (таргет T)." : ""}">
      ${rollIcon("skull", "#c98bff")}Омофагея: съесть мозг
    </button>
    ${thief ? `<div class="omophagea-status">Вор Памяти: ${active.length} из ${memoryThiefMax(ib)} краденых Навыков${active.length ? " — " + active.map(r => esc(r.label)).join(", ") : ""}.</div>` : ""}
  </div>`;
}

/** Выбор Навыка жертвы из списка кандидатов; null — отмена. */
async function pickCandidate(candidates, victimName) {
  const options = candidates.map(c => `<option value="${esc(c.id)}">${esc(c.label)}</option>`).join("");
  const id = await foundry.applications.api.DialogV2.wait({
    window: { title: `Вор Памяти — ${victimName}` },
    content: `<div class="atk-dlg-row"><label>Навык жертвы:</label><select id="mt-skill">${options}</select></div>`,
    rejectClose: false,
    buttons: [
      { action: "go", label: "Перенять", default: true, callback: (ev, button) => button.form.querySelector("#mt-skill")?.value || null },
      { action: "cancel", label: "Отмена", callback: () => null }
    ]
  });
  return candidates.find(c => c.id === id) ?? null;
}

/**
 * Перенять Навык жертвы на I.b суток. Возвращает строку для карточки или null.
 * Пишет в актора ступень и запись во флаг — чтобы тик Календаря откатил её.
 */
export async function grantMemoryThiefSkill(actor, cand) {
  const ib = Number(actor.system?.characteristics?.int?.bonus) || 0;
  const list = actor.getFlag?.(NS, MEMORY_THIEF_FLAG) ?? [];
  if (!memoryThiefHasRoom(list, ib)) {
    ui.notifications?.warn(`Вор Памяти: уже ${list.length} из ${memoryThiefMax(ib)} краденых Навыков — дождитесь истечения срока.`);
    return null;
  }
  const now = game.time?.worldTime ?? 0;
  const rec = { key: foundry.utils.randomID(8), kind: cand.kind, skillKey: cand.skillKey, specialty: cand.specialty,
    specKey: cand.specKey, label: cand.label, expiresAt: now + memoryThiefDurationSeconds(ib), prev: null };

  if (cand.kind === "plain") {
    const cur = actor.system.skills?.[cand.skillKey] ?? {};
    const out = memoryThiefRank(cur.rank, cand.rank);
    if (!out.changed) return `«${cand.label}»: собственная ступень уже не ниже — ничего не меняется.`;
    rec.prev = cur.rank || "untrained";
    await actor.update({ [`system.skills.${cand.skillKey}.rank`]: out.rank });
  } else {
    const arr = foundry.utils.deepClone(actor.system.groupSkills?.[cand.skillKey] ?? []);
    const idx = arr.findIndex(e => (cand.specKey && e.specKey === cand.specKey) || (cand.specialty && e.specialty === cand.specialty));
    if (idx >= 0) {
      const out = memoryThiefRank(arr[idx].rank, cand.rank);
      if (!out.changed) return `«${cand.label}»: собственная ступень уже не ниже — ничего не меняется.`;
      rec.prev = arr[idx].rank || "untrained";
      arr[idx].rank = out.rank;
    } else {
      arr.push({ specialty: cand.specialty || cand.specKey || "?", ...(cand.specKey ? { specKey: cand.specKey } : {}),
        rank: cand.rank, grantedRank: cand.rank, cost: 0, memoryThief: rec.key });
    }
    await actor.update({ [`system.groupSkills.${cand.skillKey}`]: arr });
  }
  await actor.setFlag(NS, MEMORY_THIEF_FLAG, [...list, rec]);
  return `Вор Памяти: «${esc(cand.label)}» на ${ib} сут. (до истечения срока по Календарю).`;
}

/** Тик Календаря: откатить истёкшие краденые Навыки. */
export async function sweepMemoryThief(actor, worldTime) {
  const list = actor?.getFlag?.(NS, MEMORY_THIEF_FLAG) ?? [];
  const expired = expiredMemoryThief(list, worldTime);
  if (!expired.length) return;
  for (const rec of expired) {
    if (rec.kind === "plain") {
      await actor.update({ [`system.skills.${rec.skillKey}.rank`]: rec.prev || "untrained" });
    } else {
      let arr = foundry.utils.deepClone(actor.system.groupSkills?.[rec.skillKey] ?? []);
      if (rec.prev == null) arr = arr.filter(e => e.memoryThief !== rec.key);
      else {
        const e = arr.find(x => (rec.specKey && x.specKey === rec.specKey) || (rec.specialty && x.specialty === rec.specialty));
        if (e) e.rank = rec.prev;
      }
      await actor.update({ [`system.groupSkills.${rec.skillKey}`]: arr });
    }
  }
  const gone = new Set(expired.map(r => r.key));
  await actor.setFlag(NS, MEMORY_THIEF_FLAG, list.filter(r => !gone.has(r.key)));
  await postTestCard(actor, {
    icon: rollIcon("skull", "#c98bff"), title: `Вор Памяти — ${esc(actor.name)}`,
    threshold: `<div class="roll-threshold">Срок истёк, краденое забыто: ${expired.map(r => esc(r.label)).join("; ")}.</div>`
  }, { sound: false });
}

/** Кнопка «Омофагея»: тест I+0, при успехе — карточка и (с Вором Памяти) выбор Навыка жертвы. */
export async function runOmophagea(actor, item) {
  if (!actor) return;
  // Как везде в проекте (rules/character.mjs): работает только установленный и не «неисправный» имплант.
  if (item && (!item.getFlag?.(NS, "installed") || item.getFlag?.(NS, "disabled"))) {
    ui.notifications?.warn("Омофагея не имплантирована или не работает.");
    return;
  }
  const int = Number(actor.system?.characteristics?.int?.total) || 0;
  const ruleMods = collectTestMods(actor, { kind: "skill", char: "int", [OMOPHAGEA_TEST_TAG]: true });
  const threshold = int + ruleMods.total;
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const success = rv <= threshold;
  const deg = success ? Math.floor((threshold - rv) / 10) + 1 : Math.floor((rv - threshold) / 10) + 1;
  await clearForesight(actor); // +10 Предусмотрительности тратится первым же тестом I

  const sections = [];
  let victim = null;
  if (success && hasRuleFlag(actor, MEMORY_THIEF_CAP)) {
    victim = [...(game.user?.targets ?? [])][0]?.actor ?? null;
    if (!victim) sections.push(`<div class="roll-threshold">Вор Памяти: наведите таргет (T) на жертву и нажмите кнопку снова — тогда можно перенять её Навык (воспоминания этого поедания уже выданы).</div>`);
  }
  await postTestCard(actor, {
    icon: rollIcon("skull", "#c98bff"), title: `Омофагея — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: "I", base: int, parts: ruleMods.parts, threshold, rv }),
    outcome: success
      ? outcomeHtml(true, `Успех (${deg}): воспоминаний тем больше, чем больше Успехов — ГМ решает, какие и сколько`)
      : outcomeHtml(false, "Неудача: ничего полезного из туманных видений выудить не удалось"),
    sections
  }, { rolls: [roll] });

  if (victim) {
    const candidates = memoryThiefCandidates(victim);
    if (!candidates.length) {
      ui.notifications?.info(`Вор Памяти: у «${victim.name}» нет изученных Навыков.`);
      return;
    }
    const picked = await pickCandidate(candidates, victim.name);
    if (!picked) return;
    const line = await grantMemoryThiefSkill(actor, picked);
    if (line) {
      await postTestCard(actor, {
        icon: rollIcon("skull", "#c98bff"), title: `Вор Памяти — ${esc(actor.name)}`,
        threshold: `<div class="roll-threshold">${line}</div>`
      }, { sound: false });
    }
  }
}
