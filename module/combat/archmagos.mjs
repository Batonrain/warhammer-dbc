// module/combat/archmagos.mjs
// ════════════════════════════════════════════════════════════════════════════
//  АРХИМАГОС — Foundry-сторона Черт и Талантов (арифметика —
//  rules/archmagos-talents.mjs):
//
//   • Конкордакс — источник правил «archmagosConcordax» (самозапись через
//     rules/source-registry.mjs, как combat/command-state.mjs): бонус ко всем
//     тестам, кроме T, Архимагосу и его машинным слугам «Под моим
//     Присутствием», пока Командное Присутствие отдано;
//   • Доктрина Императив — кнопка калибровки: +3×I.b / −3×I.b выбранным слугам;
//   • Аватар Металла — кнопка взять/отпустить слугу (I Архимагоса вместо WS/BS,
//     Процесс в Когниции считает rules/technomystic-talents.mjs);
//   • Архи-Доминус — Команда за 2/4 Когниции вместо действия, с обычным
//     тестом Командования (sheets/tabs/command.mjs::rollCommand);
//   • Лик Гнева — рейтинг Страха 3, пока Талант включён «до конца боя/сцены».
//
//  Самозаписывающийся источник обязан кто-то загрузить — это делает
//  module/hooks.mjs (импорт registerMech1Hooks из combat/mech1-hooks.mjs).
// ════════════════════════════════════════════════════════════════════════════

import { registerRuleSource } from "../rules/source-registry.mjs";
import {
  hasConcordax, hasInfernax, isMachineServant, concordaxBonus, isToughnessTest,
  CALIBRATION_PAIRS, calibrationChanges, calibrationValue, avatarOfMetalCost, AVATAR_FLAG,
  ARCH_DOMINUS_COMMAND_COST, VISIO_IRAE_FEAR, hasAvatarOfMetal, hasArchDominus, hasDoctrinaImperative
} from "../rules/archmagos-talents.mjs";
import { esc } from "../helpers/utils.mjs";
import { mech1Card } from "./mech1-rolls.mjs";
import { expectedPhase } from "../constants/effect-keys.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";

const NS = "warhammer-dbc";
const num = v => Number(v) || 0;

const docOf = uuid => {
  if (!uuid) return null;
  try { const d = fromUuidSync(uuid); return d?.actor ?? d ?? null; } catch { return null; }
};

/** Машинные слуги Архимагоса «Под моим Присутствием» (Присутствие отдано). */
export function concordaxServants(boss) {
  if (!boss?.system?.command?.presence?.active) return [];
  const infernax = hasInfernax(boss);
  const list = Array.isArray(boss.system?.followers) ? boss.system.followers : [];
  return list.map(f => docOf(f?.uuid)).filter(a => a && isMachineServant(a, { infernax }));
}

/** Бонус Конкордакса этому актору (0 — нет): сам Архимагос или его машинный слуга. */
export function concordaxBonusFor(actor) {
  if (!actor) return { value: 0, source: null };
  if (hasConcordax(actor) && actor.system?.command?.presence?.active) {
    return { value: concordaxBonus(concordaxServants(actor).length), source: actor };
  }
  const by = actor.getFlag?.(NS, "commandedBy");
  const boss = by?.uuid ? docOf(by.uuid) : null;
  if (!boss || boss === actor || !hasConcordax(boss)) return { value: 0, source: null };
  const servants = concordaxServants(boss);
  if (!servants.some(s => s === actor || s?.uuid === actor.uuid)) return { value: 0, source: null };
  return { value: concordaxBonus(servants.length), source: boss };
}

registerRuleSource("archmagosConcordax", (actor, ctx) => {
  if (typeof game === "undefined" || !ctx?.kind || isToughnessTest(ctx)) return [];
  const { value, source } = concordaxBonusFor(actor);
  if (!value) return [];
  return [{
    id: "archmagos.concordax",
    label: `Конкордакс (${source?.name ?? ""}): +${value} ко всем тестам, кроме T`,
    when: {},
    effects: [{ kind: "rollBonus", target: "all", value, label: `⚙ Конкордакс +${value}`, auto: true }]
  }];
});

// ── Общее: выбранные цели ────────────────────────────────────────────────────

const targetActors = () => [...(game.user?.targets ?? [])].map(t => t.actor).filter(Boolean);

async function selectDialog(title, label, options, hint = "") {
  const opts = options.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("");
  return foundry.applications.api.DialogV2.prompt({
    window: { title },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `${hint ? `<p style="margin:4px 6px;">${hint}</p>` : ""}<div class="form-group"><label>${esc(label)}</label><select name="pick">${opts}</select></div>`,
    ok: { label: "Готово", callback: (_ev, button) => button.form.querySelector("[name=pick]")?.value ?? null }
  }).catch(() => null);
}

// ── Доктрина Императив: калибровка ───────────────────────────────────────────

export const CALIBRATION_EFFECT_KEY = "doctrinaCalibration";

/**
 * «В свой Ход может дать любому числу подчинённых бонус +3×I.b к тесту
 * WS/BS/S/A за счёт такого же штрафа к BS/WS/A/S до начала следующего Хода».
 * Получатели — выбранные цели (T), машинные слуги.
 */
export async function useDoctrinaCalibration(actor) {
  if (!actor || !hasDoctrinaImperative(actor)) return ui.notifications?.warn("⚠️ У актора нет Черты Доктрина Императив.");
  const infernax = hasInfernax(actor);
  const all = targetActors().filter(a => a !== actor);
  const servants = all.filter(a => isMachineServant(a, { infernax }));
  const skipped = all.filter(a => !servants.includes(a));
  if (!servants.length) return ui.notifications?.warn("⚠️ Выберите целями (T) машинных слуг: машины или носителей Имплантов Механикум.");
  const ib = num(actor.system?.characteristics?.int?.bonus);
  const v = calibrationValue(ib);
  const key = await selectDialog(`Калибровка — ${actor.name}`, "Комбинация",
    Object.entries(CALIBRATION_PAIRS).map(([k, p]) => ({ value: k, label: `${p.label} (±${v})` })),
    `Одна комбинация для всех выбранных (${servants.length}).`);
  if (!key) return;
  const { grantTimedEffect } = await import("./timed-effects.mjs");
  const changes = calibrationChanges(key, ib);
  const done = [], foreign = [];
  for (const t of servants) {
    if (!(game.user?.isGM || t.isOwner)) { foreign.push(t.name); continue; }
    await grantTimedEffect(t, { key: CALIBRATION_EFFECT_KEY, name: `Калибровка Архимагоса: ${CALIBRATION_PAIRS[key].label}`, changes }, actor);
    done.push(t.name);
  }
  const p = CALIBRATION_PAIRS[key];
  await mech1Card(actor, {
    icon: "🎯", title: "Доктрина Императив: калибровка",
    lines: [
      `${CHARACTERISTICS[p.plus]?.abbr ?? p.plus} <b>+${v}</b>, ${CHARACTERISTICS[p.minus]?.abbr ?? p.minus} <b>−${v}</b> (3×I.b) до начала следующего Хода.`,
      done.length ? `Получили: ${done.map(esc).join(", ")}.` : "",
      foreign.length ? `Не ваши — наложите вручную или попросите ГМа: ${foreign.map(esc).join(", ")}.` : "",
      skipped.length ? `Не машинные слуги, пропущены: ${skipped.map(a => esc(a.name)).join(", ")}.` : ""
    ].filter(Boolean)
  });
}

// ── Аватар Металла ───────────────────────────────────────────────────────────

export const AVATAR_EFFECT_FLAG = "avatarOfMetalOf";

/** Изменения на слуге: его WS и BS становятся равны I Архимагоса. */
export function avatarChanges(servant, archInt) {
  const ws = num(servant?.system?.characteristics?.ws?.total);
  const bs = num(servant?.system?.characteristics?.bs?.total);
  const i = num(archInt);
  return [
    { key: "system.characteristics.ws.totalFx", type: "add", value: i - ws, phase: expectedPhase("system.characteristics.ws.totalFx"), priority: 0 },
    { key: "system.characteristics.bs.totalFx", type: "add", value: i - bs, phase: expectedPhase("system.characteristics.bs.totalFx"), priority: 0 }
  ];
}

const avatarEffectsOf = a => [...(a?.effects ?? [])].filter(e => e.getFlag?.(NS, AVATAR_EFFECT_FLAG) ?? e.flags?.[NS]?.[AVATAR_EFFECT_FLAG]);

/** Взять под прямой контроль выбранного слугу или отпустить нынешнего. */
export async function useAvatarOfMetal(actor) {
  if (!actor || !hasAvatarOfMetal(actor)) return ui.notifications?.warn("⚠️ У актора нет Таланта Аватар Металла.");
  const cur = actor.getFlag?.(NS, AVATAR_FLAG);
  if (cur?.uuid) {
    const servant = docOf(cur.uuid);
    if (servant && (game.user?.isGM || servant.isOwner)) {
      const ids = avatarEffectsOf(servant).map(e => e.id).filter(Boolean);
      if (ids.length) await servant.deleteEmbeddedDocuments("ActiveEffect", ids);
    }
    await actor.unsetFlag(NS, AVATAR_FLAG);
    return mech1Card(actor, { icon: "🤖", title: "Аватар Металла", lines: [`Контроль над «${esc(cur.name ?? "слугой")}» снят, Процесс больше не списывает Когницию.`] });
  }
  const [servant] = targetActors().filter(a => a !== actor);
  if (!servant) return ui.notifications?.warn("⚠️ Выберите целью (T) одного подчинённого — машину с Имплантами Механикус.");
  if (!isMachineServant(servant, { infernax: hasInfernax(actor) }))
    return ui.notifications?.warn(`⚠️ ${servant.name} — не машина и без Имплантов Механикум.`);
  const cost = avatarOfMetalCost(actor);
  const cog = num(actor.system?.cognition?.value);
  if (cog < cost) return ui.notifications?.warn(`⚠️ Не хватает Когниции: нужно ${cost}, есть ${cog}.`);
  await actor.update({ "system.cognition.value": cog - cost, [`flags.${NS}.${AVATAR_FLAG}`]: { uuid: servant.uuid, name: servant.name } });
  const archI = num(actor.system?.characteristics?.int?.total);
  let note = "";
  if (game.user?.isGM || servant.isOwner) {
    const old = avatarEffectsOf(servant).map(e => e.id).filter(Boolean);
    if (old.length) await servant.deleteEmbeddedDocuments("ActiveEffect", old);
    await servant.createEmbeddedDocuments("ActiveEffect", [{
      name: `Аватар Металла: I ${actor.name} вместо WS/BS`, img: "icons/svg/aura.svg",
      system: { changes: avatarChanges(servant, archI) },
      flags: { [NS]: { [AVATAR_EFFECT_FLAG]: actor.uuid } }
    }]);
  } else note = `${esc(servant.name)} не ваш: WS и BS = ${archI} пусть выставит ГМ.`;
  await mech1Card(actor, {
    icon: "🤖", title: "Аватар Металла",
    lines: [
      `Под прямым контролем: <b>${esc(servant.name)}</b>. Свободное действие, Когниция −<b>${cost}</b>${hasArchDominus(actor) ? " (Архи-Доминус −1)" : ""}.`,
      `WS и BS слуги = I Архимагоса (<b>${archI}</b>). Процесс: ${cost} ⚙ в Ход — списывает кнопка «↻» вкладки ТЕХ.`,
      "Аватар действует в Инициативу Архимагоса и получает 1 Очко Бесчестия, восстанавливающееся в начале каждого Хода — за столом.",
      note
    ].filter(Boolean)
  });
}

// ── Архи-Доминус: Команда за Когницию ────────────────────────────────────────

/** Отдать Команду за 2/4 ⚙ вместо полудействия/полного действия. */
export async function useArchDominusCommand(actor) {
  if (!actor || !hasArchDominus(actor)) return ui.notifications?.warn("⚠️ У актора нет Таланта Архи-Доминус.");
  const { SHORT_COMMANDS } = await import("../constants/squad.mjs");
  const kinds = [
    { value: "short", label: `Короткая Команда — ${ARCH_DOMINUS_COMMAND_COST.short} ⚙ вместо полудействия` },
    { value: "detail", label: `Детальная Команда — ${ARCH_DOMINUS_COMMAND_COST.detail} ⚙ вместо полного действия` },
    { value: "presence", label: `Командное Присутствие — ${ARCH_DOMINUS_COMMAND_COST.presence} ⚙ вместо полудействия` }
  ];
  const shortOpts = SHORT_COMMANDS.map(c => `<option value="${c.key}">${esc(c.label)}</option>`).join("");
  const picked = await foundry.applications.api.DialogV2.prompt({
    window: { title: `Архи-Доминус — ${actor.name}` },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<div class="form-group"><label>Команда</label><select name="kind">${kinds.map(k => `<option value="${k.value}">${esc(k.label)}</option>`).join("")}</select></div>
      <div class="form-group"><label>Приказ (Короткая)</label><select name="short">${shortOpts}</select></div>`,
    ok: { label: "Отдать", callback: (_ev, b) => ({ kind: b.form.querySelector("[name=kind]")?.value, shortKey: b.form.querySelector("[name=short]")?.value }) }
  }).catch(() => null);
  if (!picked?.kind) return;
  const cost = ARCH_DOMINUS_COMMAND_COST[picked.kind] ?? 2;
  const cog = num(actor.system?.cognition?.value);
  if (cog < cost) return ui.notifications?.warn(`⚠️ Не хватает Когниции: нужно ${cost}, есть ${cog}.`);
  await actor.update({ "system.cognition.value": cog - cost });
  await mech1Card(actor, { icon: "⚙️", title: "Архи-Доминус", lines: [`Команда отдана без действия: Когниция −<b>${cost}</b> (${cog} → ${cog - cost}).`] });
  const { rollCommand } = await import("../sheets/tabs/command.mjs");
  return rollCommand(actor, picked.kind, { shortKey: picked.kind === "short" ? picked.shortKey : "" });
}

// ── Лик Гнева ────────────────────────────────────────────────────────────────

export const VISIO_IRAE_FLAG = "visioIraeFear";

/** Эффект Страха 3 (чистая функция). */
export function visioIraeEffectData(itemId = "") {
  return {
    name: `Лик Гнева — рейтинг Страха ${VISIO_IRAE_FEAR}`, img: "icons/svg/terror.svg",
    system: { changes: [{ key: "system.fearRating", type: "upgrade", value: VISIO_IRAE_FEAR, phase: expectedPhase("system.fearRating"), priority: 0 }] },
    flags: { [NS]: { [VISIO_IRAE_FLAG]: itemId || true } }
  };
}

const visioEffectsOf = a => [...(a?.effects ?? [])].filter(e => e.getFlag?.(NS, VISIO_IRAE_FLAG) ?? e.flags?.[NS]?.[VISIO_IRAE_FLAG]);

/** Кнопка Лика Гнева (цена — Очко Бесчестия записи): включить Талант до конца боя/сцены и наложить Страх 3. */
export async function useVisioIrae(item) {
  const actor = item?.actor ?? item?.parent ?? null;
  const { activateItemUntil } = await import("../apps/item-activation.mjs");
  const refused = await activateItemUntil(item, {
    label: "Лик Гнева",
    text: `Рейтинг Страха ${VISIO_IRAE_FEAR} против недружественных, воспринимающих Ноосферу; их Таланты и Черты авто-прохода Страха не действуют.`
  });
  if (refused) return refused;
  const old = visioEffectsOf(actor).map(e => e.id).filter(Boolean);
  if (old.length) await actor.deleteEmbeddedDocuments("ActiveEffect", old);
  await actor.createEmbeddedDocuments("ActiveEffect", [visioIraeEffectData(item.id)]);
  return undefined;
}

/** Талант выключен (конец боя/сцены или вручную) — снять Страх. */
export async function onVisioIraeItemUpdate(item) {
  const actor = item?.actor ?? item?.parent;
  if (!actor || item.type !== "talent") return;
  const { activationState } = await import("../rules/item-activation.mjs");
  if (activationState(item)) return;
  const mine = visioEffectsOf(actor).filter(e => {
    const f = e.getFlag?.(NS, VISIO_IRAE_FLAG) ?? e.flags?.[NS]?.[VISIO_IRAE_FLAG];
    return f === item.id || f === true;
  }).map(e => e.id).filter(Boolean);
  if (mine.length) await actor.deleteEmbeddedDocuments("ActiveEffect", mine);
}
