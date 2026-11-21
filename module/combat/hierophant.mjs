// module/combat/hierophant.mjs
// ════════════════════════════════════════════════════════════════════════
//  Иерофант — кнопки Черт и Талантов (арифметика — rules/hierophant-talents.mjs).
//  Скрипты Конструктора зовут их по имени (combat/elite-api/cults.mjs).
//
//  Орду как актора создаёт ГМ: её характеристики «зависят от аудитории» —
//  это решение стола. Система считает Магнитуду, срок и все прибавки.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import {
  AGITATOR_FLAG, AGITATOR_HOURS, agitatorMagnitude, hailBonus, livingTide, mobJusticeHeal,
  hasGrandAgitator, hasHail, hasLivingTide, hasMobJustice, hasZealousMasses
} from "../rules/hierophant-talents.mjs";
import { NS, CANCEL, firstTarget, targetsOf, writeOrWarn, askNumber, askChoice, cultCard, rollCultTest } from "./cult-common.mjs";

const ICON = "🕯️";
const worldTime = () => Number(globalThis.game?.time?.worldTime) || 0;

/** Великий Агитатор: Charm+0 и Schol.Lore(Imperial Creed)+0 / For.Lore(Heresy)+0 → Орда 10×Успехи. */
export async function useGrandAgitator(actor) {
  if (!hasGrandAgitator(actor)) return ui.notifications.warn("⚠️ Нет Черты Великий Агитатор.");
  const path = await askChoice("Великий Агитатор", "Проповедь:", [
    { value: "creed", label: "Имперский Культ — Charm+0 и Schol.Lore(Imperial Creed)+0" },
    { value: "heresy", label: "Ересь — Charm+0 и For.Lore(Heresy)+0" }
  ], { hint: "Комбинированный тест: один бросок против меньшего Предела." });
  if (!path) return CANCEL;
  const lore = path === "creed"
    ? { group: "scholasticLore", spec: "imperialCreed", specLabel: "Imperial Creed" }
    : { group: "forbiddenLore", spec: "heresy", specLabel: "Heresy" };
  const r = await rollCultTest(actor, {
    title: "Великий Агитатор", icon: ICON, tests: [{ skill: "charm", mod: 0 }, { ...lore, mod: 0 }],
    success: "Толпа становится Ордой", failure: "Толпа не поднялась"
  });
  if (!r.success) return false;
  const magnitude = agitatorMagnitude(r.deg);
  const until = worldTime() + AGITATOR_HOURS * 3600;
  await actor.update({ [`flags.${NS}.${AGITATOR_FLAG}`]: { magnitude, until } });
  await cultCard(actor, "Великий Агитатор: Орда", [
    `Орда Магнитудой <b>${magnitude}</b> (10 × ${r.deg} Успехов) под командованием на <b>${AGITATOR_HOURS} часа</b> или пока не сломлена.`,
    "Характеристики Орды — по аудитории (ГМ выставляет Орду на сцену). Кровь Мучеников действует, пока срок не вышел."
  ], { icon: ICON });
  return false;
}

/** Град: Орда жертвует 1–3 стрелковые атаки ради одной метательной: +10/+1d10 за каждую. */
export async function useHail(actor) {
  if (!hasHail(actor)) return ui.notifications.warn("⚠️ Нет Таланта Град.");
  const n = await askNumber("Град", "Пожертвовано атак (1–3):", { min: 1, max: 3, value: 1,
    hint: "Орда под Командным Присутствием отказывается от части стрелковых атак ради одной метательной." });
  if (!n) return CANCEL;
  const b = hailBonus(n);
  const roll = await new Roll(b.dice).evaluate();
  await cultCard(actor, "Град", [
    `Пожертвовано атак: <b>${b.sacrificed}</b>. Одна метательная атака Орды: <b>+${b.hit}</b> на попадание и <b>+${b.dice}</b> к урону.`,
    `Бросок ${b.dice}: <b>${roll.total}</b> — прибавьте к урону этой атаки.`
  ], { icon: "🪨" });
  return false;
}

/** Живая Волна: детальная команда 4+ Успехов → Атлетика Орды, усилие и урон давки по ней. */
export async function useLivingTide(actor) {
  if (!hasLivingTide(actor)) return ui.notifications.warn("⚠️ Нет Таланта Живая Волна.");
  const horde = firstTarget();
  if (horde?.type !== "horde") return ui.notifications.warn("⚠️ Живая Волна: выберите Орду (T на токене).");
  const s = await askNumber("Живая Волна", "Успехов детальной команды:", { min: 4, max: 20, value: 4,
    hint: "Нужна детальная команда с 4+ Успехами; усилие — на одной цели Размером 2+." });
  if (!s) return CANCEL;
  const magnitude = Number(horde.system?.magnitude?.value) || 0;
  const t = livingTide({ magnitude, successes: s });
  const roll = await new Roll(t.selfDamage).evaluate();
  const after = Math.max(0, magnitude - roll.total);
  const wrote = await writeOrWarn(horde, { "system.magnitude.value": after }, "урон давки в Магнитуду");
  const sb = Number(horde.system?.characteristics?.s?.bonus) || 0;
  await cultCard(actor, `Живая Волна — Орда «${horde.name}»`, [
    `Бонус к тестам Атлетики: <b>+${t.athleticsBonus}</b> (Магнитуда ${magnitude} + 10 × ${s - 4}).`,
    `За ${s} Успехов: сдвинуть <b>${t.moveKg} кг</b>, перевернуть <b>${t.flipKg} кг</b> или нанести взятому в Захват <b>${sb + t.grappleDamage}</b> урона (S.b ${sb} + ${s}) мимо брони и половины T.b.`,
    `Давка: ${t.selfDamage} = <b>${roll.total}</b> урона в Магнитуду — ${magnitude} → ${after}${wrote ? "" : " (внесёт ГМ)"}.`
  ], { icon: "🌊" });
  return false;
}

/** Правосудие Толпы: Charm+0 → Страх 2 против рядовых, дружественные Орды (T) восстанавливают 2d10+Успехи. */
export async function useMobJustice(actor) {
  if (!hasMobJustice(actor)) return ui.notifications.warn("⚠️ Нет Таланта Правосудие Толпы.");
  const r = await rollCultTest(actor, {
    title: "Правосудие Толпы", icon: "⚖️", tests: [{ skill: "charm", mod: 0 }],
    success: "Орда оскверняет труп лидера", failure: "Толпа не воодушевилась"
  });
  if (!r.success) return false;
  const lines = [
    "Орда пропускает свой следующий Ход, но получает рейтинг <b>Страха 2</b> против рядовых солдат Ненавистного врага до конца следующего Хода.",
  ];
  const hordes = targetsOf().filter(a => a.type === "horde");
  for (const h of hordes) {
    const roll = await new Roll(mobJusticeHeal(r.deg)).evaluate();
    const value = Number(h.system?.magnitude?.value) || 0;
    const start = Number(h.system?.magnitude?.start) || 0;
    const after = start > 0 ? Math.min(start, value + roll.total) : value + roll.total;
    const wrote = await writeOrWarn(h, { "system.magnitude.value": after }, "восстановление Магнитуды");
    lines.push(`«${esc(h.name)}»: ${mobJusticeHeal(r.deg)} = <b>${roll.total}</b> → Магнитуда ${value} → ${after}${wrote ? "" : " (внесёт ГМ)"}.`);
  }
  if (!hordes.length) lines.push(`Дружественные Орды, что видели, восстанавливают ${mobJusticeHeal(r.deg)} Магнитуды — выберите их (T) до нажатия, и система применит сама.`);
  await cultCard(actor, "Правосудие Толпы", lines, { icon: "⚖️" });
  return false;
}

/** Фанатичные Толпы: Очко Бесчестия (цена записи) — Орде (T) Талант Frenzy до конца сцены/боя и Ярость. */
export async function useZealousMasses(actor) {
  if (!hasZealousMasses(actor)) return ui.notifications.warn("⚠️ Нет Таланта Фанатичные Толпы.");
  const horde = firstTarget();
  if (horde?.type !== "horde") return ui.notifications.warn("⚠️ Фанатичные Толпы: выберите Орду (T на токене).");
  if (!(game.user?.isGM || horde.isOwner)) return ui.notifications.warn("⚠️ Орда не ваша — нажмёт ГМ.");
  const frenzy = await fromUuid("Compendium.warhammer-dbc.talents.Item.FP1xN9yNXHr9vWw8").catch(() => null);
  const combat = game.combat?.started ? game.combat : null;
  if (frenzy && !horde.items?.some(i => i.type === "talent" && i.name === frenzy.name)) {
    const data = frenzy.toObject();
    delete data._id;
    data.flags = { ...(data.flags ?? {}), [NS]: { ...(data.flags?.[NS] ?? {}),
      tempGrant: combat
        ? { unit: "round", combatId: combat.id, expiresAtRound: 9999, label: `${frenzy.name} (Фанатичные Толпы)` }
        : { unit: "worldTime", expiresAt: (Number(game.time?.worldTime) || 0) + 3600, label: `${frenzy.name} (Фанатичные Толпы)` } } };
    await horde.createEmbeddedDocuments("Item", [data]);
  }
  await horde.update({ [`flags.${NS}.zealousRage`]: combat?.id ?? "scene" });
  await cultCard(actor, `Фанатичные Толпы — Орда «${horde.name}»`, [
    `Орда получает Талант <b>Frenzy</b> до конца ${combat ? "боя" : "сцены"} и сразу впадает в <b>Ярость</b>.`,
    "Пока Орда в Ярости, урон в Магнитуду, полученный с конца её прошлого Хода, откладывается до конца её текущего Хода (отмечает ГМ)."
  ], { icon: "🔥" });
  return false;
}
