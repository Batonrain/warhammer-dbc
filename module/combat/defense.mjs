import { SKILL_RANKS }    from "../constants/characteristics.mjs";
import { MELEE_STANCES, BALANCE_PARRY_MOD } from "../constants/combat.mjs";
import { _degWord, _hitWord, _leftoverSuccessPhrase, negatedHits, esc } from "../helpers/utils.mjs";
import { resolveWeaponPropsList, aggregateAuto } from "./weapon-properties.mjs";
import { getModEffects, mergeWeaponPropEntries }  from "./weapon-mods.mjs";
import { rollIcon }       from "../constants/roll-icons.mjs";
import { pickReroll }     from "../rules/reroll-pick.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { postTestCard, thresholdLine } from "../helpers/test-card.mjs";
import { hasRuleFlag }    from "../rules/flags.mjs";
import { isRoundCapabilityAvailable } from "../apps/game-session.mjs";
import { equippedMeleeWeapon } from "./equipped-melee.mjs";
import { withWitchsEdge } from "./witchs-edge.mjs";
import { spendReaction }  from "./action-economy.mjs";
import { addEvasionSurplus } from "./evasion-pool.mjs";
import { recoilButtonHtml } from "./recoil.mjs";
import { danceOfFireAdvantage } from "../rules/dodge-advantage.mjs";
import { oneAgainstAHundredAdvantage } from "../rules/one-against-a-hundred.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { retractPart, extendPart, allLimbsCompressed } from "../rules/compression.mjs";
import { activeSwarm, consumeSwarmScreamer } from "../rules/ethereal-swarm.mjs";
import { degreesOfSuccess } from "../constants/craft.mjs";
import { determinationToFightParryBonus } from "../rules/determination-to-fight.mjs";
import { canParryPsychic, psychicParryOutcome, hasBladeShield } from "./blade-shield.mjs";
import { crossblockPair, CROSSBLOCK_SIZE_STEPS, maineGaucheParryReroll }
  from "../rules/dual-wield-talents.mjs";
import { attackedPrevTurn } from "../rules/turn-flags.mjs";
import { parrySizeGate } from "../rules/parry-size.mjs";
import { tokenRect } from "./horde-tokens.mjs";
import { contactType } from "../rules/tactical-map.mjs";
import { handOfKhorneAttackSizeBonus } from "../rules/hand-of-khorne.mjs";

// Контратака (стр. 12, Талант Counter Attack) — «раз в Раунд» ключ учёта,
// тот же примитив, что у Локуса Сокрушения (constants/capabilities.mjs).
export const COUNTER_ATTACK_CAPABILITY = "technique.counterAttack";

// Сжатие (мутация Compression) — capabilityKey уже зарегистрирован
// constants/capabilities.mjs; здесь читается через hasRuleFlag, как и
// COUNTER_ATTACK_CAPABILITY выше.
export const COMPRESSION_CAPABILITY = "mutation.compression";

// Уклонение/Парирование — Реакция (стр. 12): вне активного Encounter
// spendReaction ничего не считает и всегда отдаёт true, поэтому вне боя
// кнопки продолжают работать как раньше, без ограничений.
export async function _noReactionCard(actor, label) {
  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("sword")}${label} — ${esc(actor.name)}</div>
        <div class="roll-outcome">
          <span class="roll-failure">${rollIcon("ban","#ff6b6b")}Нет доступных Реакций в этом Ходу.</span>
        </div>
      </div>`
  }, rollMode));
}

/**
 * Порог Уклонения и всё, из чего он сложился, — ОДИН расчёт на всех, кто
 * Уклоняется (wdbc-6wzt). Ровно та же причина, по которой рядом живёт
 * parryProfile: у Уклонения появился второй вызывающий — Шагоход
 * (combat/walker.mjs, книжный п.5 «Уклонение со штрафом −Размер×10,
 * комбинированное с Operate−10»), и копия этого стека модификаторов означала
 * бы второе место, где живут Усталость, Клонирующее Поле и записи реестра
 * правил.
 *
 * Реакцию НЕ тратит и карточек не пишет: это делает вызывающий.
 *
 * @param {object} actor
 * @param {number} extraMod модификатор приёма/ситуации
 */
export function dodgeProfile(actor, extraMod = 0) {
  const agTotal    = actor.system.characteristics.ag?.total ?? 0;
  const dodgeSkill = actor.system.skills?.dodge;
  const rankBonus  = SKILL_RANKS[dodgeSkill?.rank ?? "untrained"]?.bonus ?? -20;
  const stance     = actor.system.meleeStance || "standard";
  const stBonus    = MELEE_STANCES[stance]?.dodgeBonus ?? 0;
  // Клонирующее Поле: голограммы срывают прицел — бонус носителю на физическое
  // избегание. Сила зависит от редкости поля (Poor.Q режет её вдвое).
  const cloneBonus = actor.system.cloneField?.bonus ?? 0;
  // Все модификаторы, которые система знает про этот тест, — одним сбором
  // (wdbc-ct65.1). Раньше здесь по одному дописывались Усталость, выключенная
  // силовая броня, Перевес инвентаря и Повален, а всё остальное, что книга
  // даёт Уклонению (Черты, Таланты, Происхождения, записи Конструктора),
  // сюда не доезжало вовсе: путь этой кнопки шёл мимо реестра правил.
  const ruleMods  = collectTestMods(actor, { kind: "skill", skill: "dodge", char: "ag" });
  const threshold = agTotal + rankBonus + stBonus + extraMod + cloneBonus + ruleMods.total;

  const modParts = [];
  if (rankBonus !== -20) modParts.push(`навык ${rankBonus >= 0 ? "+" : ""}${rankBonus}`);
  if (stBonus   !== 0)   modParts.push(`стойка ${stBonus >= 0 ? "+" : ""}${stBonus}`);
  if (extraMod  !== 0)   modParts.push(`приём ${extraMod >= 0 ? "+" : ""}${extraMod}`);
  if (cloneBonus !== 0)  modParts.push(`клон-поле +${cloneBonus}`);
  modParts.push(...ruleMods.parts);

  return { agTotal, rankBonus, stBonus, cloneBonus, ruleMods, threshold, modParts };
}

export async function _performDodge(actor, extraMod = 0, forcedReroll = "", hitsCount = 1, attackerUuid = "", isMelee = false, burst = false, attackerIsHorde = false) {
  // Потеря ног (стр. 30-31, wdbc-r5o7.5): «нельзя Уклоняться» — хватает одной
  // потерянной ноги (книга не требует «обеих», в отличие от полной
  // неподвижности при потере ОБЕИХ ног, см. rules/character.mjs). Реакция не
  // тратится — Уклонение физически недоступно, а не просто провалено.
  if ((Number(actor.system.conditions?.lostLegsCount) || 0) > 0)
    return _noReactionCard(actor, "Уклонение (нет ног)");
  if (!(await spendReaction(actor, { forDefense: true }))) return _noReactionCard(actor, "Уклонение");
  const { agTotal, threshold, modParts } = dodgeProfile(actor, extraMod);

  // Навязанный переброс (Локус Кровопролития: «заставить цель перебросить тест
  // Избегания»). Режим приходит с кнопки карточки: цель обязана оставить
  // ХУДШИЙ из двух — то есть больший на d100. Танец Среди Огня и Один Против
  // Сотни (wdbc-u0by) — собственное Преимущество защищающегося (против
  // Очереди / против атаки Орды), тот же приём (roll×2 + pickReroll), но mode
  // "keepBest" — forcedReroll, если задан, приоритетнее (внешнее навязывание
  // сильнее своего Преимущества).
  const dancerAdvantage = danceOfFireAdvantage(actor, burst);
  const hordeAdvantage  = oneAgainstAHundredAdvantage(actor, attackerIsHorde);
  const selfAdvantage   = dancerAdvantage || hordeAdvantage;
  const rolled = [];
  for (let i = 0; i < (forcedReroll || selfAdvantage ? 2 : 1); i++) rolled.push(await new Roll("1d100").evaluate());
  const picked = pickReroll(rolled.map(r => r.total), forcedReroll || "keepBest");
  const roll   = rolled[picked.index];
  const rv     = picked.value;
  // Формула степени успеха/провала — module/rules/roll-outcome.mjs (wdbc-5dvx,
  // раньше дублировалась вручную здесь же).
  const { success: passed, deg } = testOutcome(rv, threshold);

  // Стр. 12: при Успехе персонаж уклоняется от атаки и попадание становится
  // промахом — сравнивать степени успеха со степенью атакующего не нужно (это
  // не встречная проверка). Очередь/Быстрая/Молниеносная Атака дают больше
  // одного попадания за атаку — тогда Успех снимает их по одному за каждую
  // степень, не больше их числа («Избегание множественных попаданий», стр. 12).
  const { total: totalHits, negated, remaining } = negatedHits(passed, deg, hitsCount);
  // Излишек Успехов сверх того, что нужно было ЭТОЙ атаке — банкуется на
  // попадания ДРУГИХ атак того же противника в этом Ходу (стр. 12, «...после
  // успешного Избегания одной его атаки у персонажа остались не потраченные
  // Успехи...», module/combat/evasion-pool.mjs). Молча ничего не делает вне
  // боя или без attackerUuid (кнопки контратаки/старые вызовы его не несут).
  const leftover = passed ? deg - negated : 0;
  const banked = leftover > 0 && await addEvasionSurplus(actor, attackerUuid, leftover, extraMod);

  if (picked.dropped.length) {
    modParts.push(forcedReroll
      ? `навязанный переброс, отброшено ${picked.dropped.join(", ")}`
      : `${dancerAdvantage ? "Танец Среди Огня" : "Один Против Сотни"}: Преимущество, отброшено ${picked.dropped.join(", ")}`);
  }

  let outcomeHtml;
  if (!passed) {
    outcomeHtml = `<span class="roll-failure">Уклонение провалено — ${deg} ${_degWord(deg)}. ${
      totalHits > 1 ? `Все ${totalHits} ${_hitWord(totalHits)} проходят.` : "Получает попадание."}</span>`;
  } else if (remaining === 0) {
    outcomeHtml = `<span class="roll-success">Уклонение успешно — ${deg} ${_degWord(deg)}${
      totalHits > 1 ? `, снимает все ${totalHits} ${_hitWord(totalHits)}` : ""}! Атака промахивается.</span>`;
  } else {
    outcomeHtml = `<span class="roll-failure">${rollIcon("warn","#ffb84d")}Уклонение успешно — ${deg} ${_degWord(deg)}, снимает ${negated} из ${totalHits} ${_hitWord(totalHits)}. ${remaining} ${_hitWord(remaining)} всё ещё проходит.</span>`;
  }
  const leftoverNote = banked
    ? `<div class="roll-defense-note">Остаётся ${leftover} ${_leftoverSuccessPhrase(leftover)} — можно потратить на попадания других атак этого противника в этом Ходу (2 Усп./попадание).</div>`
    : "";

  // Отскок (стр. 12, wdbc-9wvm): вместо нивеляции — только от СТРЕЛКОВОЙ
  // атаки (isMelee=false) и только при успешном Уклонении. Рукопашный
  // Отскок = Вольт (п.6 правила) — отдельная точка входа, не эта кнопка
  // (см. заголовок module/combat/recoil.mjs).
  const recoilSection = (passed && !isMelee) ? recoilButtonHtml(actor) : "";

    await postTestCard(actor, {
    icon: rollIcon("run"), title: `Уклонение — ${esc(actor.name)}`, actorUuid: actor.uuid,
    threshold: thresholdLine({ label: "Ag", base: agTotal, parts: modParts, threshold }),
    rv, outcome: outcomeHtml, sections: [leftoverNote, recoilSection]
  }, { rolls: [roll] });
}

// Распыление/Spray (wdbc-p06s, свойство оружия «Дальнобойное», стр. 166-170):
// «Атака по каплевидному шаблону; попадает автоматически по всем на пути,
// цель отменяет попадание броском A+0 (без Реакции), при успехе — Отскок как
// при Уклонении, если её база полностью накрыта». Это НЕ Уклонение — другой
// Навык (Acrobatics, не Dodge), не тратит Реакцию (spendReaction здесь
// сознательно не зовётся) и не встречный тест. Геометрию накрытия Базы
// шаблоном код не отслеживает (тот же honest-compromise, что у blastRecoilNote
// в attack-card.mjs) — Отскок предлагается кнопкой на любом успехе, без гейта
// кодом; читающий карточку сам решает по столу, обязателен ли он здесь.
export async function _performSprayCancel(actor) {
  const agTotal   = actor.system.characteristics.ag?.total ?? 0;
  const acroSkill = actor.system.skills?.acrobatics;
  const rankBonus = SKILL_RANKS[acroSkill?.rank ?? "untrained"]?.bonus ?? -20;
  const cloneBonus = actor.system.cloneField?.bonus ?? 0;
  // Тест идёт Акробатикой, а не Уклонением, и Реакцию не тратит — поэтому
  // штраф выключенной брони берётся обычный физический (−10 характеристике),
  // а не реакционный −40: REACTION_SKILLS знает только Dodge/Parry, а ключ
  // навыка здесь другой. Ветвить это руками не нужно, сбор различает сам.
  const ruleMods  = collectTestMods(actor, { kind: "skill", skill: "acrobatics", char: "ag" });
  const threshold = agTotal + rankBonus + cloneBonus + ruleMods.total;

  const roll = await new Roll("1d100").evaluate();
  const rv     = roll.total;
  const passed = rv <= threshold;
  const deg    = passed
    ? Math.floor((threshold - rv) / 10) + 1
    : Math.floor((rv - threshold) / 10) + 1;

  const modParts = [];
  if (rankBonus !== -20) modParts.push(`навык ${rankBonus >= 0 ? "+" : ""}${rankBonus}`);
  if (cloneBonus !== 0)  modParts.push(`клон-поле +${cloneBonus}`);
  modParts.push(...ruleMods.parts);

  const outcomeHtml = passed
    ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}! Попадание отменено (если шаблон не накрывает Базу целиком — иначе годится только Отскок ниже, стр. 12).</span>`
    : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. Попадание проходит.</span>`;

  const recoilSection = passed ? recoilButtonHtml(actor) : "";

  await postTestCard(actor, {
    icon: rollIcon("run"),
    title: `Тест на отмену (Распыление, Acrobatics A+0) — ${esc(actor.name)}`, actorUuid: actor.uuid,
    threshold: thresholdLine({ label: "Ag", base: agTotal, parts: modParts, threshold }),
    rv, outcome: outcomeHtml, sections: [recoilSection]
  }, { rolls: [roll] });
}

/**
 * Порог Парирования и всё, из чего он сложился, — ОДИН расчёт на два вызова
 * (wdbc-bwf9). Парирование обычной атаки и Парирование психосилы Талантом «Щит
 * Клинков» считаются по книге одинаково (тест WS+навык+баланс+свойства
 * оружия), различаются только тем, ЧТО отменяет успех. Раньше расчёт жил
 * внутри _performParry, и второму вызову пришлось бы завести его копию —
 * то есть второе место, где живут бонусы Дуэлянтского и Шага За Шагом.
 *
 * Реакцию НЕ тратит и карточек не пишет: это делает вызывающий, у которого
 * свой текст отказа.
 *
 * @param {object} actor
 * @param {number} extraMod        модификатор приёма/ситуации
 * @param {?object} [weaponOverride] чем парируем, если не «надетое рукопашное»
 * @param {object} [opts]
 * @param {boolean} [opts.useCrossblock=true] спрашивается ДО вызова (askCrossblock)
 *
 * Разница Размеров (стр. 12, module/rules/parry-size.mjs) сюда НЕ входит —
 * это условие, допускающее сам тест («требует Навык Parry, продвинутый на
 * +10/+20/+30»), а не штраф к его порогу. Гейт проверяет вызывающая сторона
 * (_performParry) ДО вызова parryProfile, ей нужен резолв атакующего актора
 * по attackerUuid, которого здесь нет.
 */
export function parryProfile(actor, extraMod = 0, weaponOverride = null, { useCrossblock = true } = {}) {
  const wsTotal    = actor.system.characteristics.ws?.total ?? 0;
  const parrySkill = actor.system.skills?.parry;
  const rankBonus  = SKILL_RANKS[parrySkill?.rank ?? "untrained"]?.bonus ?? -20;

  // Интегральные атаки (кулак/пинок) надеты всегда — без фильтра они
  // перехватывали бы парирование у настоящего оружия (см. equipped-melee.mjs).
  const meleeWeapon = weaponOverride ?? equippedMeleeWeapon(actor);

  // Эффекты модификаций парирующего оружия (баланс, Защитное/Power Field и т.п.)
  const modFx      = getModEffects(actor, meleeWeapon);
  const balance    = parseInt(meleeWeapon?.system.balance ?? 0) + (modFx.balanceMod || 0);
  const balanceMod = BALANCE_PARRY_MOD[String(balance)];

  const stance    = actor.system.meleeStance || "standard";
  const stBonus   = MELEE_STANCES[stance]?.parryBonus ?? 0;

  // Свойства парирующего оружия (+ модификации): Защитное (+15), Силовое поле,
  // Дуэлянтское (+10 Парирование), Шаг За Шагом (+10 — Парирование само по
  // себе означает «в рукопашном бою», условие свойства выполнено безусловно)
  const parryProps    = resolveWeaponPropsList(withWitchsEdge(meleeWeapon, mergeWeaponPropEntries(meleeWeapon, modFx)));
  const pwp            = aggregateAuto(parryProps);
  const { defensive: defensiveBonus, dueling: duelingBonus, step: stepBonus, total: defBonus } =
    parryPropBonuses(pwp);
  // Тот же общий сбор, что у _performDodge (wdbc-ct65.1).
  const ruleMods = collectTestMods(actor, { kind: "skill", skill: "parry", char: "ws" });
  // Determination To Fight/Решительность Сражаться (wdbc-1rno): +30 при
  // отрицательных Ранах + прошлый раунд в Защитной Стойке.
  const dtfBonus = determinationToFightParryBonus(actor);

  // Крестовой Блок (стр. 62, wdbc-pb60): с двумя рукопашными Баланса не ниже 0
  // персонаж «суммирует бонусы на Парирование от свойств, Качества и
  // модификаций ОБОИХ оружий». Считается тем же расчётом, что и у первого
  // оружия — иначе второе место правды, и Защитное второй руки однажды
  // разошлось бы с Защитным первой.
  //
  // Баланс второго оружия сюда НЕ входит: балансом отвечает то оружие, которым
  // отбиваешь, и книга перечисляет именно свойства/Качество/модификации.
  // Парировать обоими — ВЫБОР игрока (wdbc-2hg): книга говорит «если он
  // парирует обоими», и цена этого выбора — Контратака с Ответным Ударом.
  // Пока бонус второго оружия суммировался сам, отказаться было нельзя: боец
  // с парой клинков терял Контратаку в каждом Парировании, не выбирая.
  const crossblock = useCrossblock ? crossblockPair(actor) : null;
  const crossWeapon = crossblock
    ? [crossblock.main, crossblock.off].find(w => w?.id !== meleeWeapon?.id)
    : null;
  const crossBonus = crossWeapon ? weaponParryPropBonus(actor, crossWeapon) : 0;

  const threshold = wsTotal + rankBonus + (balanceMod ?? 0) + stBonus + defBonus + extraMod
                  + ruleMods.total + dtfBonus + crossBonus;

  const modParts = [];
  if (rankBonus !== -20) modParts.push(`навык ${rankBonus >= 0 ? "+" : ""}${rankBonus}`);
  if (balanceMod !== 0 && balanceMod != null) modParts.push(`баланс ${balanceMod >= 0 ? "+" : ""}${balanceMod}`);
  if (stBonus !== 0)     modParts.push(`стойка ${stBonus >= 0 ? "+" : ""}${stBonus}`);
  if (defensiveBonus !== 0) modParts.push(`Защитное +${defensiveBonus}`);
  if (duelingBonus !== 0)   modParts.push(`Дуэлянтское +${duelingBonus}`);
  if (stepBonus !== 0)      modParts.push(`Шаг За Шагом +${stepBonus}`);
  if (extraMod !== 0)    modParts.push(`приём ${extraMod >= 0 ? "+" : ""}${extraMod}`);
  modParts.push(...ruleMods.parts);
  if (dtfBonus !== 0)    modParts.push(`Решительность Сражаться +${dtfBonus}`);
  if (crossBonus !== 0)  modParts.push(`Крестовой Блок: «${crossWeapon.name}» +${crossBonus}`);

  return { wsTotal, meleeWeapon, balance, balanceMod, threshold, modParts, pwp,
           crossblock: crossblock ? { weapon: crossWeapon, bonus: crossBonus,
                                      sizeSteps: CROSSBLOCK_SIZE_STEPS } : null };
}

/**
 * Бонусы к Парированию от свойств оружия: Защитное +15, Дуэлянтское +10, Шаг За
 * Шагом +10. Одно место правды на оба оружия — Крестовой Блок считает второе
 * тем же расчётом, а не своей копией, иначе они однажды разойдутся.
 */
function parryPropBonuses(props) {
  const defensive = props?.defensive    ? 15 : 0;
  const dueling   = props?.duelingParry ? 10 : 0;
  const step      = props?.stepByStep   ? 10 : 0;
  return { defensive, dueling, step, total: defensive + dueling + step };
}

/** Тот же бонус, но для оружия, которое ещё не разобрано (второе в Крестовом Блоке). */
export function weaponParryPropBonus(actor, weapon) {
  if (!weapon) return 0;
  const modFx = getModEffects(actor, weapon);
  const props = aggregateAuto(resolveWeaponPropsList(
    withWitchsEdge(weapon, mergeWeaponPropEntries(weapon, modFx))));
  return parryPropBonuses(props).total;
}

/** Отказ Парирования: почему нельзя. Реакция при этом не тратится. */
function _bladeShieldRefusal(actor, why) {
  return postTestCard(actor, {
    icon: rollIcon("sword"), title: `Парирование — ${esc(actor.name)}`, actorUuid: actor.uuid,
    outcome: `<span class="roll-failure">${rollIcon("ban","#ff6b6b")}${why}</span>`
  });
}

/**
 * Спросить, парировать ли обоими оружиями (Крестовой Блок, стр. 62).
 *
 * Вопрос задаётся, только если есть ЧТО терять: пара сложилась и Контратака
 * у бойца есть и доступна в этом Раунде. Иначе «обоими» ничего не стоит —
 * берём его молча, как и раньше.
 *
 * @returns {Promise<boolean>} парировать ли обоими
 */
export async function askCrossblock(actor) {
  if (!crossblockPair(actor)) return true;
  const canCounter = hasRuleFlag(actor, COUNTER_ATTACK_CAPABILITY)
                  && isRoundCapabilityAvailable(actor, COUNTER_ATTACK_CAPABILITY);
  if (!canCounter) return true;
  const both = await foundry.applications.api.DialogV2.confirm({
    window: { title: "Крестовой Блок" },
    content: "<p>Парировать <b>обоими</b> оружиями?</p>"
      + "<p>Да — бонусы обоих сложены и можно парировать существ на ступень Размера крупнее, "
      + "но Контратака и Ответный Удар в этом Парировании недоступны (стр. 62).<br>"
      + "Нет — парируете одним, Контратака остаётся.</p>",
    yes: { label: "Обоими" }, no: { label: "Одним" }
  }).catch(() => true);
  return both !== false;
}

/**
 * Защищающийся в Базовом/Глубоком контакте со стрелком (module/rules/
 * tactical-map.mjs::contactType, тот же геометрический расчёт, что у
 * Свободной Атаки, module/combat/free-attack.mjs) — стр. 12: «Парирование
 * работает только от атак в ближнем бою, в т.ч. выстрелов в рукопашной»,
 * отдельно от Таланта «Щит Клинков» (стр. 62, парирует С ЛЮБОЙ дистанции).
 * Без токена хотя бы у одной стороны решить нечем — не Парирование, а Талант
 * должен решать (consistent с прежним поведением до контакта).
 */
function _inMeleeContactWithAttacker(actor, attackerActor) {
  const myToken = actor?.getActiveTokens?.(false, true)?.[0];
  const atkToken = attackerActor?.getActiveTokens?.(false, true)?.[0];
  if (!myToken || !atkToken) return false;
  const rectA = tokenRect(myToken), rectB = tokenRect(atkToken);
  if (!rectA || !rectB) return false;
  return contactType(rectA, rectB) !== "none";
}

export async function _performParry(actor, extraMod = 0, attackerUuid = "", hitsCount = 1, burst = false, attackerIsHorde = false, isMelee = true, attackerWeaponUuid = "") {
  // Резолв атакующего — нужен и для Разницы Размеров (стр. 12, ЛЮБОЙ
  // Парирование), и для контакта при стрельбе ниже. Неизвестный/нерезолвящийся
  // attackerUuid — Размер атакующего считается 0 (нет штрафа), тот же честный
  // дефолт, что у остальных cross-actor резолвов этого файла.
  const attackerActor  = attackerUuid ? await fromUuid(attackerUuid).catch(() => null) : null;
  const attackerWeapon = attackerWeaponUuid ? await fromUuid(attackerWeaponUuid).catch(() => null) : null;

  // Крестовой Блок платит Контратакой (стр. 62), поэтому спрашивается ДО
  // броска — и только когда цена реальна: Талант Контратаки есть и доступен в
  // этом Раунде. Нечем платить — выгода бесплатна, и спрашивать не о чем.
  const useCrossblock = await askCrossblock(actor);

  // Длань Кхорна (wdbc-1rno): +2 эффективного Размера атакующего, когда бьёт
  // именно этой рукой — не своё поле на акторе, читается с оружия атаки.
  //
  // Размер берётся из sizeTotal, а НЕ из size: size — только база («0 =
  // Человек»), а весь реальный Размер существ приходит Чертой «Size/Размер
  // (X)»/«Hulking/Громила» через ActiveEffect на system.sizeMod, который
  // rules/character/movement.mjs сводит в system.sizeTotal. По одному size у
  // Астартес, Огрина и Дредноута читался бы 0 (это уже находили на живых
  // данных, см. комментарий там же), и вся Разница Размеров не срабатывала бы
  // ни разу. У техники своего sizeTotal нет — там size и есть итог, отсюда ??.
  const sizeOf = a => Number(a?.system?.sizeTotal ?? a?.system?.size) || 0;
  const attackerSize = sizeOf(attackerActor) + handOfKhorneAttackSizeBonus(attackerWeapon);
  const defenderSize  = sizeOf(actor);
  // Крестовой Блок поднимает предел «невозможно» на ступень (стр. 62) — та же
  // РЕАЛЬНАЯ (после вопроса игроку) готовность биться обоими, что идёт в
  // parryProfile ниже, не повторный независимый вопрос "есть ли пара".
  const crossblockActive = useCrossblock && !!crossblockPair(actor);
  // Разница Размеров (стр. 12) — условие, допускающее сам тест («требует
  // Навык Parry, продвинутый на +10/+20/+30»), не штраф к порогу: сверяется с
  // уже вложенным Рангом ДО построения профиля Парирования (parrySize.mjs).
  const parryRankBonus = SKILL_RANKS[actor.system.skills?.parry?.rank ?? "untrained"]?.bonus ?? -20;
  const sizeGate = parrySizeGate(attackerSize, defenderSize, parryRankBonus,
                                 crossblockActive ? CROSSBLOCK_SIZE_STEPS : 0);
  // Склонение по последней цифре: 1 ступень, 2-4 ступени, 5+ ступеней
  // (и 11-14 — ступеней). Раньше было «крупнее на 5 ступени».
  const stepWord = n => {
    const t = n % 100, o = n % 10;
    if (t >= 11 && t <= 14) return "ступеней";
    if (o === 1) return "ступень";
    if (o >= 2 && o <= 4) return "ступени";
    return "ступеней";
  };
  if (sizeGate.impossible) {
    return _bladeShieldRefusal(actor,
      `Противник крупнее на ${sizeGate.steps} ${stepWord(sizeGate.steps)} Размера — Парирование вообще невозможно (стр. 12).`);
  }
  if (!sizeGate.allowed) {
    // Ранга выше «Ветеран» (+30) в системе нет (constants/characteristics.mjs::
    // SKILL_RANKS), а при Крестовом Блоке предел «вообще невозможно» поднят на
    // ступень, и requiredBonus доходит до 40. Раньше 40 молча сваливался в
    // «expert» и печаталось «требует Ветеран (+40)» — ранга с таким числом не
    // существует. Честнее сказать, что не дотягивает и максимальный.
    const byBonus = Object.values(SKILL_RANKS).find(r => r.bonus === sizeGate.requiredBonus);
    const top = Object.values(SKILL_RANKS).reduce((a, b) => (b.bonus > a.bonus ? b : a));
    const need = byBonus
      ? `требует Навык «Парирование», продвинутый минимум до «${byBonus.label}» (+${sizeGate.requiredBonus})`
      : `недостижимо: нужен Ранг Парирования +${sizeGate.requiredBonus}, а выше «${top.label}» (+${top.bonus}) Рангов нет`;
    return _bladeShieldRefusal(actor,
      `Противник крупнее на ${sizeGate.steps} ${stepWord(sizeGate.steps)} Размера — Парирование ${need} (стр. 12).`);
  }

  const { wsTotal, meleeWeapon, balance, balanceMod, threshold, modParts, pwp, crossblock } =
    parryProfile(actor, extraMod, null, { useCrossblock });

  // ── Парирование СТРЕЛЬБЫ ───────────────────────────────────────────────
  // Стр. 12: «работает только от атак в ближнем бою, в т.ч. выстрелов в
  // рукопашной» — Базовый/Глубокий контакт со стрелком разрешает парировать
  // ВСЕМ, без Таланта, как обычную рукопашную атаку (полная шкала степеней
  // ниже). Стр. 62 («Щит Клинков», wdbc-3e2x): «может перехватывать клинком
  // пули и лучи» С ЛЮБОЙ дистанции — отдельная, более сильная возможность,
  // требует Баланс 1+ и режет степень до 1 (книга: «Успех ВСЕГДА блокирует
  // только одно попадание» — это про парирование БЕЗ контакта дистанционно,
  // не про общее правило рукопашной).
  const contactParry = !isMelee && _inMeleeContactWithAttacker(actor, attackerActor);
  if (!isMelee && !contactParry) {
    if (!hasBladeShield(actor)) {
      return _bladeShieldRefusal(actor,
        "Стрелковую атаку без Базового контакта со стрелком может парировать только персонаж с Талантом «Щит Клинков» (стр. 62).");
    }
    if (balance < 1) {
      return _bladeShieldRefusal(actor,
        `«Щит Клинков» требует оружия с Балансом 1 и выше — у ${meleeWeapon ? `«${esc(meleeWeapon.name)}»` : "голых рук"} Баланс ${balance >= 0 ? "+" : ""}${balance}.`);
    }
  }

  // Баланс −2 (или иное значение, помеченное null) — оружием нельзя парировать
  if (balanceMod === null) {
    const rollMode = game.settings.get("core", "rollMode");
    const messageData = ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
        <div class="wh-roll-result">
          <div class="roll-header">${rollIcon("sword")}Парирование — ${esc(actor.name)}</div>
          ${meleeWeapon
            ? `<div style="font-size:0.82em;color:#5a4a30;margin-bottom:2px;">
                 Оружие: ${esc(meleeWeapon.name)} (Баланс ${balance >= 0 ? "+" : ""}${balance})
               </div>`
            : ""
          }
          <div class="roll-outcome">
            <span class="roll-failure">${rollIcon("ban","#ff6b6b")}Этим оружием нельзя парировать (Баланс ${balance >= 0 ? "+" : ""}${balance}).</span>
          </div>
        </div>`
    }, rollMode);

    await ChatMessage.create(messageData);
    return;
  }

  if (!(await spendReaction(actor, { forDefense: true }))) return _noReactionCard(actor, "Парирование");

  // Танец Среди Огня и Один Против Сотни (wdbc-u0by) — Преимущество на
  // Парирование против Очереди / против атаки Орды, тот же приём
  // roll×2 + pickReroll, что у Уклонения выше.
  const dancerAdvantage = danceOfFireAdvantage(actor, burst);
  const hordeAdvantage  = oneAgainstAHundredAdvantage(actor, attackerIsHorde);
  // Мэн-Гош (стр. 62, wdbc-pb60): «перебрасывать тесты на Парирование ЭТИМ
  // ножом», если им не били в предыдущий Ход. Переброс с выбором лучшего — то
  // же самое, что делают два Преимущества выше, поэтому считается тем же
  // приёмом, а не отдельной веткой.
  const maineGauche     = maineGaucheParryReroll(actor, meleeWeapon, attackedPrevTurn(actor));
  const selfAdvantage   = dancerAdvantage || hordeAdvantage || maineGauche;
  const rolled = [];
  for (let i = 0; i < (selfAdvantage ? 2 : 1); i++) rolled.push(await new Roll("1d100").evaluate());
  const picked   = pickReroll(rolled.map(r => r.total), "keepBest");
  const roll     = rolled[picked.index];
  const rv       = picked.value;
  // Формула степени успеха/провала — module/rules/roll-outcome.mjs (wdbc-5dvx).
  const { success: passed, deg } = testOutcome(rv, threshold);

  // Стр. 12: при Успехе персонаж отбивает или блокирует атаку и попадание
  // становится промахом — сравнивать степени успеха со степенью атакующего не
  // нужно (это не встречная проверка). Очередь/Быстрая/Молниеносная Атака дают
  // больше одного попадания за атаку — тогда Успех снимает их по одному за
  // каждую степень, не больше их числа («Избегание множественных попаданий»).
  // Стр. 62: «Успех на этом тесте парирования ВСЕГДА блокирует только одно
  // попадание, независимо от количества Успехов» — это про Парирование
  // СТРЕЛЬБЫ дистанционно, «Щитом Клинков». В рукопашной, включая парирование
  // выстрела В КОНТАКТЕ (contactParry — та же строка стр. 12, что и разрешает
  // сам приём выше), работает общее правило стр. 12 (по попаданию за степень).
  const effectiveDeg = (isMelee || contactParry) ? deg : Math.min(deg, 1);
  const { total: totalHits, negated, remaining } = negatedHits(passed, effectiveDeg, hitsCount);
  const parried = passed;
  // Излишек Успехов — банкуется на попадания ДРУГИХ атак того же противника
  // в этом Ходу (стр. 12, module/combat/evasion-pool.mjs). См. _performDodge.
  // При Парировании СТРЕЛЬБЫ банковать нечего: книга даёт ровно одно снятое
  // попадание независимо от числа Успехов, значит «излишка» в её смысле не
  // возникает. В рукопашной пул работает как раньше.
  const leftover = passed && isMelee ? deg - negated : 0;
  const banked = leftover > 0 && await addEvasionSurplus(actor, attackerUuid, leftover, extraMod);

  if (picked.dropped.length) {
    // Книга называет это по-разному, и подпись должна называть так же: у
    // Танца и Сотни это Преимущество, у Мэн-Гоша — переброс.
    modParts.push(
      dancerAdvantage ? `Танец Среди Огня: Преимущество, отброшено ${picked.dropped.join(", ")}`
      : hordeAdvantage ? `Один Против Сотни: Преимущество, отброшено ${picked.dropped.join(", ")}`
      : `Мэн-Гош: переброс ножом, отброшено ${picked.dropped.join(", ")}`);
  }

  let outcomeHtml;
  if (!passed) {
    outcomeHtml = `<span class="roll-failure">Парирование провалено — ${deg} ${_degWord(deg)}. ${
      totalHits > 1 ? `Все ${totalHits} ${_hitWord(totalHits)} проходят.` : "Получает попадание."}</span>`;
  } else if (remaining === 0) {
    outcomeHtml = `<span class="roll-success">Парирование успешно — ${deg} ${_degWord(deg)}${
      totalHits > 1 ? `, снимает все ${totalHits} ${_hitWord(totalHits)}` : ""}! Атака отражена.</span>`;
  } else {
    outcomeHtml = `<span class="roll-failure">${rollIcon("warn","#ffb84d")}Парирование успешно — ${deg} ${_degWord(deg)}, снимает ${negated} из ${totalHits} ${_hitWord(totalHits)}. ${remaining} ${_hitWord(remaining)} всё ещё проходит.</span>`;
  }
  const leftoverNote = banked
    ? `<div class="roll-defense-note">Остаётся ${leftover} ${_leftoverSuccessPhrase(leftover)} — можно потратить на попадания других атак этого противника в этом Ходу (2 Усп./попадание).</div>`
    : "";

  // Силовое поле: при успешном парировании автоматически кидаем 1d100 —
  // на 1–75 оружие противника (без Power Field / Reinforced) уничтожено.
  const allRolls = [roll];
  let powerFieldNote = "";
  if (parried && pwp.powerField) {
    const pfRoll = await new Roll("1d100").evaluate();
    allRolls.push(pfRoll);
    const destroyed = pfRoll.total <= 75;
    powerFieldNote = `
      <div class="roll-defense-note">
        ${rollIcon("bolt","#6fe6ff")}Силовое поле — бросок: <b>${pfRoll.total}</b> →
        ${destroyed
          ? `<span class="roll-success">оружие противника <b>уничтожено</b> (если без Power Field / Reinforced)!</span>`
          : `<span class="roll-failure">оружие противника уцелело (76+).</span>`}
      </div>`;
  }

  // Контратака (стр. 12, Талант Counter Attack): «успешно Парировав, персонаж
  // может тут же атаковать этим же оружием со штрафом −10, раз в Раунд» — по
  // выбору игрока, поэтому кнопка, а не авто-атака. Без активного Combat
  // isRoundCapabilityAvailable считает её всегда доступной (раунд отследить
  // нечем) — тот же приём, что у Локуса Сокрушения.
  //
  // Крестовой Блок (стр. 62): «если парирует обоими — не может использовать
  // Counter Attack и Riposte». Бонус второго оружия и есть парирование обоими,
  // поэтому кнопка Контратаки при нём не показывается, а вместо неё в карточку
  // идёт строка с причиной — иначе игрок решит, что Талант «пропал».
  // Цена — за само парирование обоими, а не за величину бонуса: пара без
  // Защитного даёт 0 к порогу, но предел Размера поднимает так же.
  const crossblockUsed = !!crossblock;
  const counterAttackHtml = (parried && meleeWeapon && !crossblockUsed
      && hasRuleFlag(actor, COUNTER_ATTACK_CAPABILITY)
      && isRoundCapabilityAvailable(actor, COUNTER_ATTACK_CAPABILITY))
    ? `<div class="roll-defense-section">
         <button class="wh-counter-attack-btn" type="button"
           data-weapon-id="${meleeWeapon.id}" data-attacker-uuid="${attackerUuid}">
           ${rollIcon("sword")}Контратака (−10)
         </button>
       </div>`
    : "";

  // Что именно даёт Крестовой Блок сверх суммы бонусов — и чего он стоит.
  // Предел Размера (стр. 12, wdbc-1rno) — теперь настоящий расчёт
  // (module/rules/parry-size.mjs, crossblockActive выше), не напоминание
  // столу. Строка печатается только при парировании ОБОИМИ: и выгода (сумма
  // бонусов, предел Размера), и цена (Контратака) — одно и то же решение.
  const crossblockNote = crossblock
    ? `<div class="roll-defense-note">${rollIcon("sword")}Крестовой Блок: парируете обоими`
      + `${crossblock.bonus ? ` (+${crossblock.bonus} от «${esc(crossblock.weapon.name)}»)` : " (бонусов второго оружия нет)"}`
      + `, Контратака и Ответный Удар в этом Парировании недоступны.`
      + ` Предел «Парирование невозможно» по Размеру поднят на ${CROSSBLOCK_SIZE_STEPS} ступень.</div>`
    : "";

  await postTestCard(actor, {
    icon: rollIcon("sword"), title: `Парирование — ${esc(actor.name)}`, actorUuid: actor.uuid,
    threshold: thresholdLine({ label: "WS", base: wsTotal, parts: modParts, threshold }),
    lines: [meleeWeapon
      ? `<div style="font-size:0.82em;color:#5a4a30;margin-bottom:2px;">Оружие: ${esc(meleeWeapon.name)} (Баланс ${balance >= 0 ? "+" : ""}${balance})</div>`
      : ""],
    rv, outcome: outcomeHtml,
    sections: [leftoverNote, powerFieldNote, crossblockNote, counterAttackHtml]
  }, { rolls: [roll] });
}

/**
 * ПАРИРОВАНИЕ ПСИХОСИЛЫ Талантом «Щит Клинков» (wdbc-bwf9).
 *
 * Отличается от обычного Парирования только тем, что отменяет: не попадание, а
 * эффекты психосилы целиком (Книга Жаб-Псайкеров: «При успешном парировании
 * эффекты психосилы нивелируются»). Poor.Q ноктиковый щит развеивает частично —
 * снижает эPR за каждый успех, и тогда сила не отменена, а ослаблена.
 *
 * Порог тот же самый — parryProfile выше, один расчёт на оба вида Парирования.
 * Парируем ИМЕННО тем предметом, который разрешён книгой (tool), а не «надетым
 * рукопашным»: у варлока в другой руке может быть что угодно.
 *
 * Излишек Успехов в пул Избегания НЕ банкуется: пул книги (стр. 12) — про
 * попадания атак того же противника, а психосила попаданий не раздаёт.
 */
export async function _performPsychicParry(actor, { powerName = "", ePR = 0, extraMod = 0 } = {}) {
  const { ok, tool, weakens, reason } = canParryPsychic(actor);
  if (!ok) {
    return postTestCard(actor, {
      icon: rollIcon("sword"), title: `Парирование психосилы — ${esc(actor.name)}`, actorUuid: actor.uuid,
      outcome: `<span class="roll-failure">${rollIcon("ban","#ff6b6b")}Парировать психосилу нечем: ${esc(reason)}.</span>`
    });
  }

  const { wsTotal, balance, balanceMod, threshold, modParts } = parryProfile(actor, extraMod, tool);
  if (balanceMod === null) {
    return postTestCard(actor, {
      icon: rollIcon("sword"), title: `Парирование психосилы — ${esc(actor.name)}`, actorUuid: actor.uuid,
      outcome: `<span class="roll-failure">${rollIcon("ban","#ff6b6b")}Этим предметом нельзя парировать (Баланс ${balance >= 0 ? "+" : ""}${balance}).</span>`
    });
  }

  if (!(await spendReaction(actor, { forDefense: true }))) return _noReactionCard(actor, "Парирование психосилы");

  const roll = await new Roll("1d100").evaluate();
  const rv   = roll.total;
  const { success: passed, deg } = testOutcome(rv, threshold);
  const { negated, ePRLeft, drop } = psychicParryOutcome(passed, deg, weakens, ePR);

  let outcomeHtml;
  if (!passed) {
    outcomeHtml = `<span class="roll-failure">Парирование провалено — ${deg} ${_degWord(deg)}. Психосила действует полностью.</span>`;
  } else if (negated) {
    outcomeHtml = `<span class="roll-success">Парирование успешно — ${deg} ${_degWord(deg)}! Эффекты психосилы нивелированы.</span>`;
  } else {
    outcomeHtml = `<span class="roll-failure">${rollIcon("warn","#ffb84d")}Парирование успешно — ${deg} ${_degWord(deg)}, но щит развеивает не полностью: эPR ${ePR} − ${drop} = <b>${ePRLeft}</b>. Психосила действует ослабленной.</span>`;
  }

  return postTestCard(actor, {
    icon: rollIcon("sword"),
    title: `Парирование психосилы${powerName ? ` «${esc(powerName)}»` : ""} — ${esc(actor.name)}`,
    actorUuid: actor.uuid,
    threshold: thresholdLine({ label: "WS", base: wsTotal, parts: modParts, threshold }),
    lines: [`<div style="font-size:0.82em;color:#5a4a30;margin-bottom:2px;">Чем парирует: ${esc(tool.name)} (Баланс ${balance >= 0 ? "+" : ""}${balance})${weakens ? " — Poor.Q: развеивает частично" : ""}</div>`],
    rv, outcome: outcomeHtml
  }, { rolls: [roll] });
}

/**
 * Сжатие (мутация Compression, wdbc-1rno, стр. текста мутации) — реактивная
 * АЛЬТЕРНАТИВА Уклонению/Парированию для ОДНОГО попадания в конечность/
 * голову: тратит Реакцию (тот же гейт, что Уклонение/Парирование), БЕЗ
 * броска, всегда нивелирует ровно это попадание — книга не даёт теста,
 * просто «может втянуть эту часть тела». `location` — метка HIT_LOCATIONS
 * (constants/combat.mjs: «Голова»/«П. Рука»/«Л. Рука»/«П. Нога»/«Л. Нога»),
 * читается из карточки атаки (attack-card.mjs::defenseSection передаёт её
 * кнопке через data-атрибут, сама карточка Foundry-документов не касается —
 * доступность способности проверяется здесь, не на этапе рендера).
 *
 * Не смоделировано намеренно — см. шапку rules/compression.mjs: зрение при
 * втянутой Голове, мобильность при втянутых Ногах, выпуск удерживаемого
 * оружия из втягиваемой Руки — только чат-заметки, без числа/автоснятия.
 */
export async function _performCompression(actor, location, attackerUuid = "") {
  const rollMode = game.settings.get("core", "rollMode");
  if (!hasRuleFlag(actor, COMPRESSION_CAPABILITY)) {
    return ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
        <div class="wh-roll-result">
          <div class="roll-header">${rollIcon("shield")}Сжатие — ${esc(actor.name)}</div>
          <div class="roll-outcome">
            <span class="roll-failure">${rollIcon("ban","#ff6b6b")}У цели нет мутации «Сжатие» (Compression).</span>
          </div>
        </div>`
    }, rollMode));
  }
  if (!(await spendReaction(actor, { forDefense: true }))) return _noReactionCard(actor, "Сжатие");

  const current = actor.getFlag("warhammer-dbc", "compressedParts") ?? [];
  const updated = retractPart(current, location);
  await actor.update({ "flags.warhammer-dbc.compressedParts": updated });

  const notes = [];
  if (location === "Голова") notes.push("лишается зрения (но не слуха), пока голова не разложена обратно");
  if (location === "П. Нога" || location === "Л. Нога")
    notes.push("мобильность снижена, пока нога не разложена обратно (величина — на усмотрение ГМа)");
  if (location === "П. Рука" || location === "Л. Рука")
    notes.push("оружие/инструмент в этой руке пришлось выпустить (снимите/переместите вручную)");
  if (allLimbsCompressed(updated))
    notes.push("все конечности втянуты — помещается в пространства, слишком малые для обычных людей/космодесантников");

  // Кнопки «Разложить», по одной на каждую СЕЙЧАС втянутую часть (не только
  // ту, что втянута этим кликом — прошлые попадания могли втянуть другие).
  // data-actor-uuid на корне карточки — тот же приём, что уже несёт
  // _performParry для кнопки Контратаки (не полагаться на «выбранный
  // токен», карточка может открыться спустя ходы после самого Сжатия).
  const extendBtns = updated.map(loc => `
      <button class="wh-extend-btn" type="button" data-location="${loc}"
        title="Полудействие: разложить эту часть тела обратно (экономика действий не отслеживается — отыгрывается вручную)">
        Разложить ${loc}
      </button>`).join("");

  await postTestCard(actor, {
    icon: rollIcon("shield"), title: `Сжатие — ${esc(actor.name)}`, actorUuid: actor.uuid,
    outcome: `<span class="roll-success">Втягивает ${location} в торс (вместе с бронёй/снаряжением на ней) — попадание нивелировано.</span>`,
    sections: [
      notes.length ? `<div class="roll-defense-note">${notes.join("; ")}.</div>` : "",
      `<div class="roll-defense-section">${extendBtns}</div>`
    ]
  });
}

/**
 * Разложить одну втянутую часть тела обратно (за полудействие, книга) —
 * кнопка «Разложить» в карточке самого Сжатия выше (data-actor-uuid на
 * корне карточки, тот же приём, что у Контратаки после Парирования).
 * Экономика полудействия НЕ отслеживается системой — тот же принцип, что у
 * Pure Form/Mist Transformation, отыгрывается вручную.
 */
export async function _performExtendBodyPart(actor, location) {
  const current = actor.getFlag("warhammer-dbc", "compressedParts") ?? [];
  if (!current.includes(location)) return;
  const updated = extendPart(current, location);
  await actor.update({ "flags.warhammer-dbc.compressedParts": updated });
  await postTestCard(actor, {
    icon: rollIcon("shield"), title: `Сжатие — ${esc(actor.name)}`,
    outcome: `<span class="roll-success">Раскладывает ${location} обратно (полудействие).</span>`
  }, { sound: false });
}

/**
 * Ethereal Swarm / Эфирная Стая (wdbc-1rno, Дар Тзинч) — реактивное
 * поглощение ОДНОГО попадания призрачным Крикуном: тест Cor+0, НЕ через
 * spendReaction (книга прямо оговаривает «не тратит Реакций», в отличие от
 * Сжатия). Стая призывается отдельной kind:"script" записью самого предмета
 * (rules/ethereal-swarm.mjs::summonSwarm) — здесь только чтение остатка и
 * бросок.
 */
export async function _performEtherealSwarm(actor, attackerUuid = "") {
  const worldTime = game.time.worldTime;
  const swarm = activeSwarm(actor, worldTime);
  if (!swarm) {
    return ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
        <div class="wh-roll-result">
          <div class="roll-header">${rollIcon("warp")}Эфирная Стая — ${esc(actor.name)}</div>
          <div class="roll-outcome">
            <span class="roll-failure">${rollIcon("ban","#ff6b6b")}Стая не призвана, пуста или истёк срок.</span>
          </div>
        </div>`
    }, game.settings.get("core", "rollMode")));
  }

  const cor = Number(actor.system?.corruption?.value) || 0;
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const success = rv <= cor;
  const dof = Math.abs(degreesOfSuccess(rv, cor));
  if (success) await consumeSwarmScreamer(actor);

  await postTestCard(actor, {
    icon: rollIcon("warp"), title: `Эфирная Стая — ${esc(actor.name)}`,
    threshold: thresholdLine({ label: "Cor", base: cor, threshold: cor }),
    rv,
    outcome: success
      ? `<span class="roll-success">Успех — Крикун (осталось ${swarm.count - 1}) принимает попадание на себя и изгоняется в Варп. Попадание нивелировано.</span>`
      : `<span class="roll-failure">Провал — ${dof} ${_degWord(dof)}, Крикун не успевает обрести реальность. Попадание проходит как обычно.</span>`
  }, { rolls: [roll] });
}