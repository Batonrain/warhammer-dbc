// module/combat/gerold-talents.mjs
// ════════════════════════════════════════════════════════════════════════
//  Кнопки Талантов и Черт Герольда (правила — rules/gerold-talents.mjs,
//  дары соратникам — rules/astartes-elite-common.mjs). Живой Стяг —
//  combat/living-banner.mjs (оттуда зовётся ancientAfterBanner).
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { hasItemNamed } from "../rules/req-atom.mjs";
import { changeActorInfamy, actorInfamyValue, actorInfamyPath } from "../apps/infamy-points.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { postTestCard, rollStatLine } from "../helpers/test-card.mjs";
import { rollTraitTest } from "./trait-test.mjs";
import { BANNER_FLAG, plantedBanner, bannerRadius } from "../rules/gerold-talents.mjs";
import {
  actorToken, alliesInSight, chooseOne, confirmBox, grantBoon, infoCard, payActions,
  rollSkillCard, targetedActors
} from "./astartes-elite-ui.mjs";

const NS = "warhammer-dbc";

/**
 * Ancient / Древний: после Живого Стяга — тест W+0, при Успехе вернуть
 * потраченное Очко Бесчестия. Зовёт combat/living-banner.mjs::useLivingBanner.
 */
export async function ancientAfterBanner(actor) {
  if (!hasItemNamed(actor, "Ancient", ["talent"])) return;
  const res = await rollTraitTest(actor, {
    char: "wp", mod: 0, icon: "🚩", title: "Древний: знамя возвращает Очко Бесчестия",
    success: "Потраченное Очко Бесчестия восстановлено", failure: "Очко не возвращается"
  });
  if (res.success) await changeActorInfamy(actor, 1);
}

/** Ancient: знамя/икона уронены или отняты — все Очки Бесчестия сгорают, −10 себе и видевшим соратникам. */
export async function ancientBannerLost(actor) {
  if (!hasItemNamed(actor, "Ancient", ["talent"])) return ui.notifications.warn("⚠️ У актора нет Таланта Древний.");
  if (!(await confirmBox("Древний", `${esc(actor.name)} уронил знамя или его отнял противник?`, "Да, знамя утрачено", "Нет"))) return "отмена";
  const lost = actorInfamyValue(actor);
  if (lost) await actor.update({ [actorInfamyPath(actor)]: 0 });
  const label = `🏴 Знамя ${actor.name} осквернено −10`;
  await grantBoon(actor, "morale", { value: -10, label }, actor);
  const allies = alliesInSight(actor);
  const done = [];
  for (const a of allies) if (await grantBoon(a, "morale", { value: -10, label }, actor)) done.push(a.name);
  await infoCard(actor, "🏴", "Знамя утрачено", [
    `Сгорели все не потраченные Очки Бесчестия: ${lost}.`,
    `−10 на все действия до конца боя/сцены (сам считает в каждом тесте): ${[actor.name, ...done].map(esc).join(", ")}.`
  ]);
}

/** Greater Herald / Высший Герольд: полудействие + Очко Бесчестия, Charm+0 → Преимущество на Command/Charm/Intimidate. */
export async function useGreaterHerald(actor) {
  if (!hasItemNamed(actor, "Greater Herald", ["talent"])) return ui.notifications.warn("⚠️ У актора нет Таланта Высший Герольд.");
  const target = targetedActors()[0] ?? actor;
  if (!(await payActions(actor, 1, "Высший Герольд"))) return "нет ОД";
  const res = await rollSkillCard(actor, {
    skill: "charm", icon: "📯", title: `Высший Герольд → ${target.name}`,
    success: `${esc(target.name)}: Преимущество на все тесты Command, Charm и Intimidate до конца сцены или боя`,
    failure: "Представление не впечатлило слушателей"
  });
  if (res.success) await grantBoon(target, "herald", { label: `📯 Высший Герольд (${actor.name})` }, actor);
}

/** Stand Your Ground / Ни Шагу Назад: воткнуть знамя (полудействие) или поднять его. */
export async function useStandYourGround(actor) {
  if (!hasItemNamed(actor, "Stand Your Ground", ["talent"])) return ui.notifications.warn("⚠️ У актора нет Таланта Ни Шагу Назад.");
  if (plantedBanner(actor)) {
    await actor.unsetFlag(NS, BANNER_FLAG);
    return void await infoCard(actor, "🚩", "Ни Шагу Назад", ["Знамя поднято с позиции."]);
  }
  const tok = actorToken(actor);
  if (!tok || !canvas?.scene) return ui.notifications.warn("⚠️ Токен Герольда не на сцене — некуда втыкать знамя.");
  if (!(await payActions(actor, 1, "Ни Шагу Назад"))) return "нет ОД";
  const c = tok.center ?? { x: tok.document.x, y: tok.document.y };
  await actor.setFlag(NS, BANNER_FLAG, { sceneId: canvas.scene.id, x: c.x, y: c.y });
  await infoCard(actor, "🚩", "Ни Шагу Назад", [
    `Знамя воткнуто: позиция — ${bannerRadius(actor)} м (W.b×2) вокруг.`,
    "Пока Герольд в этом радиусе, он держит знамя «как в руках» (Древний, Живой Стяг).",
    "Все соратники в радиусе получают Преимущество на тесты Страха, Шока, Паники и Подавления — сами, в окне теста.",
    "Командиры: +20 к тестам Командования на защищающих позицию — добавляет стол."
  ]);
}

/** Villainous Honour / Честь Злодеев: победа в честном бою — +1 Очко, видевшим соратникам +10 до конца боя. */
export async function useVillainousHonour(actor) {
  if (!hasItemNamed(actor, "Villainous Honour", ["talent"])) return ui.notifications.warn("⚠️ У актора нет Таланта Честь Злодеев.");
  if (!(await confirmBox("Честь Злодеев", "Вражеский чемпион, знаменосец или лорд побеждён в честном бою?", "Да", "Нет"))) return "отмена";
  const res = await changeActorInfamy(actor, 1);
  const label = `⚔️ Честь Злодеев (${actor.name}) +10`;
  const done = [];
  for (const a of alliesInSight(actor)) if (await grantBoon(a, "morale", { value: 10, label }, actor)) done.push(a.name);
  await infoCard(actor, "⚔️", "Честь Злодеев", [
    res.changed ? `Восстановлено Очко Бесчестия: ${res.before} → ${res.after}.` : "Очки Бесчестия и так полны.",
    done.length ? `+10 на все действия до конца боя (сам считает в тестах): ${done.map(esc).join(", ")}.` : "Соратников, видевших победу, нет."
  ]);
}

/** Delegate / Делегат: тест Inf от имени члена банды, чья символика на броне. */
export async function useDelegate(actor) {
  if (!hasItemNamed(actor, "Delegate", ["trait"])) return ui.notifications.warn("⚠️ У актора нет Черты Делегат.");
  const members = (game.actors?.contents ?? []).filter(a => a !== actor && a.type === "character" && a.hasPlayerOwner);
  if (!members.length) return ui.notifications.warn("⚠️ В мире нет других персонажей игроков.");
  const saved = actor.getFlag(NS, "delegateOf");
  const ordered = [...members].sort((a, b) => (b.uuid === saved) - (a.uuid === saved));
  const pick = await chooseOne("Делегат", ordered.map(m => ({ id: m.uuid, label: m.name })),
    { prompt: "Чья символика на броне? Тест пойдёт его Влиянием, Талантами и Чертами." });
  if (!pick) return "отмена";
  const member = await fromUuid(pick.id);
  await actor.setFlag(NS, "delegateOf", member.uuid);
  const base = Number(member.system?.characteristics?.inf?.total) || 0;
  const rm = collectTestMods(member, { kind: "skill", char: "inf", requisition: true });
  const threshold = base + rm.total;
  const roll = await new Roll("1d100").evaluate();
  const { success, deg } = testOutcome(roll.total, threshold);
  await postTestCard(actor, {
    icon: "📜", title: `Делегат: Влияние ${esc(member.name)} — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: "Inf", base, parts: rm.parts, threshold, rv: roll.total }),
    outcome: `<span class="roll-${success ? "success" : "failure"}">${success ? "Успех" : "Провал"} — ${deg}</span>`,
    lines: [`<div class="roll-threshold">Переговоры, реквизиция или торговля от имени ${esc(member.name)}: его Inf и его модификаторы Inf (Таланты Peer — галочками стола).</div>`]
  }, { rolls: [roll] });
}

/** Noblesse Oblige / Благородство Обязывает: Критический Провал — −1 Очко Бесчестия (или W+0, если никто не видел). */
export async function noblesseObligeSlip(actor) {
  const choice = await chooseOne("Благородство Обязывает", [
    { id: "seen", label: "Оплошность видели — потерять Очко Бесчестия" },
    { id: "unseen", label: "Никто не видел — тест W+0, чтобы избежать штрафа" }
  ], { prompt: `${actor.name}: Критический Провал.` });
  if (!choice) return;
  if (choice.id === "unseen") {
    const res = await rollTraitTest(actor, { char: "wp", icon: "🎖️", title: "Благородство Обязывает: скрыть оплошность",
      success: "Штрафа нет", failure: "Теряет Очко Бесчестия" });
    if (res.success) return;
  }
  const r = await changeActorInfamy(actor, -1);
  await infoCard(actor, "🎖️", "Благородство Обязывает", [r.changed
    ? `Позор на всю банду: −1 Очко Бесчестия (${r.before} → ${r.after}).`
    : "Очков Бесчестия нет — терять нечего."]);
}
