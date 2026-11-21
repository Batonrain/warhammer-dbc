// module/combat/worm-king.mjs
// ════════════════════════════════════════════════════════════════════════
//  Король Червей — кнопки Талантов и Руки Изобилия (арифметика —
//  rules/worm-king-talents.mjs). Рои — акторы с меткой wormMasterUuid
//  (combat/worm-master.mjs). Рои и чужие токены пишет ГМ или их владелец.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { woundLossUpdates } from "../rules/wounds.mjs";
import { tokensWithinRadius } from "../rules/aoe-target.mjs";
import { WORM_SWARM_FLAG, wormSwarmCap } from "../rules/worm-master.mjs";
import {
  WORM_RELEASED_FLAG, MAGGOT_MARK_FLAG, SHELL_GUARD_FLAG, WORMWALKER_RADIUS,
  hasFreeRoamer, hasMaggotMark, hasShellGuard, hasWormwalker, hasHandOfPlenty, isReleasedSwarm,
  shellGuardTemplates, shellGuardTemplateOk, wormwalkerTake, wormwalkerStats, handOfPlentyPeople
} from "../rules/worm-king-talents.mjs";
import { activeSwarmsOf } from "./worm-master.mjs";
import { NS, CANCEL, firstTarget, writeOrWarn, payActions, askChoice, cultCard } from "./cult-common.mjs";

const ICON = "🪱";
const isMySwarm = (king, a) => a?.getFlag?.(NS, WORM_SWARM_FLAG) === king?.uuid;

/** Свободный Скиталец: отпустить Рой (T) из-под прямого контроля — он выходит из лимита Cor.b. */
export async function releaseSwarm(actor) {
  if (!hasFreeRoamer(actor)) return ui.notifications.warn("⚠️ Нет Таланта Свободный Скиталец.");
  const swarm = firstTarget();
  if (!isMySwarm(actor, swarm)) return ui.notifications.warn("⚠️ Свободный Скиталец: выберите своего Роя (T на токене).");
  if (isReleasedSwarm(swarm)) return ui.notifications.warn(`⚠️ «${swarm.name}» уже свободен.`);
  if (!await writeOrWarn(swarm, { [`flags.${NS}.${WORM_RELEASED_FLAG}`]: true }, "метку «свободен»")) return CANCEL;
  const active = activeSwarmsOf(actor).length;
  await cultCard(actor, "Свободный Скиталец", [
    `«${esc(swarm.name)}» отпущен: в лимит Cor.b больше не входит (под прямым контролем ${active} из ${wormSwarmCap(actor)}).`,
    "Понимает простейшие вербальные команды Короля и отмеченных Опарышем союзников и выполняет последнюю полученную."
  ], { icon: ICON });
  return false;
}

/** Метка Опарыша: союзник (T) становится «своим» для конструктов Короля. */
export async function markWithMaggot(actor) {
  if (!hasMaggotMark(actor)) return ui.notifications.warn("⚠️ Нет Таланта Метка Опарыша.");
  const ally = firstTarget();
  if (!ally) return ui.notifications.warn("⚠️ Метка Опарыша: выберите слугу или союзника (T на токене).");
  if (!await writeOrWarn(ally, { [`flags.${NS}.${MAGGOT_MARK_FLAG}`]: actor.uuid }, "Метку Опарыша")) return CANCEL;
  await cultCard(actor, "Метка Опарыша", [
    `Опарыш зарылся в плоть «${esc(ally.name)}»: конструкты Короля считают его союзником и слушают его команды (Свободный Скиталец).`
  ], { icon: ICON });
  return false;
}

/** Стражи Панциря: Рой (T) окукливается — через 77 минут Страж выбранного шаблона (не больше трёх шаблонов). */
export async function pupateShellGuard(actor) {
  if (!hasShellGuard(actor)) return ui.notifications.warn("⚠️ Нет Таланта Стражи Панциря.");
  const swarm = firstTarget();
  if (!isMySwarm(actor, swarm) || isReleasedSwarm(swarm))
    return ui.notifications.warn("⚠️ Стражи Панциря: выберите Роя под прямым контролем (T на токене).");
  const list = shellGuardTemplates(actor);
  const options = [...list.map(t => ({ value: t, label: `Шаблон: ${t}` })), { value: "__new", label: "Новый шаблон…" }];
  const pick = await askChoice("Стражи Панциря", "Шаблон Стража:", options,
    { hint: `Шаблонов: ${list.length} из 3. Рой поглощает от 200 кг плоти за три полных действия.` });
  if (!pick) return CANCEL;
  let template = pick;
  if (pick === "__new") {
    template = await foundry.applications.api.DialogV2.prompt({
      window: { title: "Стражи Панциря — новый шаблон" },
      content: `<div class="atk-dlg-row"><label>Название:</label><input type="text" name="t" class="pm-input"/></div>`,
      ok: { label: "Применить", callback: (ev, b) => String(b.form.elements.t.value || "").trim() }, rejectClose: false
    }).catch(() => null);
    if (!template) return CANCEL;
  }
  if (!shellGuardTemplateOk(actor, template))
    return ui.notifications.warn("⚠️ Уже три шаблона Стражей — сперва избавьтесь от всех Стражей одного из прежних шаблонов (удалите шаблон из метки).");
  if (!await payActions(actor, 2, { what: "Стражи Панциря (первое из трёх полных действий)" })) return CANCEL;
  if (!list.includes(template)) await actor.update({ [`flags.${NS}.${SHELL_GUARD_FLAG}`]: [...list, template] });
  await writeOrWarn(swarm, { [`flags.${NS}.shellGuardPupa`]: { template, hatchAt: (Number(game.time?.worldTime) || 0) + 77 * 60 } }, "метку куколки");
  await cultCard(actor, "Стражи Панциря", [
    `«${esc(swarm.name)}» окукливается (беспомощен, теряет Трейт Swarm). Через <b>77 минут</b> вылупится Страж Панциря «${esc(template)}» — Миньон-Зверь под прямым контролем, уменьшает лимит Роёв, может быть Отпущен.`,
    "Три полных действия на поглощение плоти — в бою отметьте ещё два Хода."
  ], { icon: "🐚" });
  return false;
}

/** Червеход: Рой (T) за полное действие занимает трупы в 7 м — 5 Ран за труп, ближние первыми. */
export async function useWormwalker(actor) {
  if (!hasWormwalker(actor)) return ui.notifications.warn("⚠️ Нет Таланта Червеход.");
  const swarm = firstTarget();
  if (!isMySwarm(actor, swarm)) return ui.notifications.warn("⚠️ Червеход: выберите своего Роя (T на токене).");
  const tok = swarm.getActiveTokens?.(false, true)?.[0] ?? null;
  if (!tok) return ui.notifications.warn("⚠️ Рой не на сцене.");
  const scene = tok.parent;
  const dist = t => Math.hypot((t.x ?? 0) - (tok.x ?? 0), (t.y ?? 0) - (tok.y ?? 0));
  const corpses = tokensWithinRadius(tok, WORMWALKER_RADIUS, { includeHidden: true })
    .filter(t => t.actor?.getFlag?.(NS, "deceased"))
    .sort((a, b) => dist(a) - dist(b));
  if (!corpses.length) return ui.notifications.warn(`⚠️ В ${WORMWALKER_RADIUS} м от Роя трупов нет (метка «мёртв» на листе).`);
  const take = wormwalkerTake(swarm.system?.wounds?.value, corpses.length);
  if (!take.count) return ui.notifications.warn("⚠️ У Роя слишком мало Ран: каждый труп стоит 5.");
  if (!await payActions(actor, 2, { what: "Червеход" })) return CANCEL;
  await writeOrWarn(swarm, woundLossUpdates(swarm.system, take.woundsLost), "потерю Ран Роя");
  const taken = corpses.slice(0, take.count);
  const lines = [`Рой «${esc(swarm.name)}» теряет <b>${take.woundsLost}</b> Ран и занимает ${take.count} ${take.count === 1 ? "труп" : "трупов"}:`];
  for (const t of taken) {
    const st = wormwalkerStats(t.actor?.system?.characteristics?.t?.bonus);
    lines.push(`• «${esc(t.name)}» — Червеход: ${st.charPenalty} ко всем Характеристикам кроме T, <b>${st.wounds}</b> Ран (T.b×4), Инициатива 1, ведёт себя как Освобождённый Рой, без ментальных действий.`);
    await writeOrWarn(t.actor, { [`flags.${NS}.wormwalker`]: { king: actor.uuid, collapseAt: (Number(game.time?.worldTime) || 0) + 7 * 3600 } }, "метку Червехода");
  }
  lines.push("Через 7 часов каждый Червеход разваливается в свободный Извивающийся Рой с 10 Ранами.");
  if (scene && !game.user?.isGM) lines.push("Характеристики Червеходов на их листах правит ГМ.");
  await cultCard(actor, "Червеход", lines, { icon: "🧟" });
  return false;
}

/** Рука Изобилия: на сколько человек хватит даров роя. */
export async function useHandOfPlenty(actor) {
  if (!hasHandOfPlenty(actor)) return ui.notifications.warn("⚠️ Нет Черты Рука Изобилия.");
  const n = handOfPlentyPeople(actor.system?.corruptionBonus);
  await cultCard(actor, "Рука Изобилия", [
    `Еда, питьё, одежда и примитивные инструменты из кожи, хитина, роговины и кости — на коммуну до <b>${n}</b> человек (Cor.b × 100).`,
    "Не поклоняющиеся Нурглу находят эти дары отвратительными и непригодными."
  ], { icon: "🧺" });
  return false;
}
