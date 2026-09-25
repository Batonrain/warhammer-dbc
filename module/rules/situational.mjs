// module/rules/situational.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Ситуативные штрафы состояния тела и снаряжения (wdbc-n17t): Усталость,
//  Марш, снятый шлем силовой брони, выключенная силовая броня, Перевес
//  инвентаря.
//
//  Раньше каждый из пяти дописывался отдельным слагаемым прямо в формулу
//  Порога на каждом месте броска (module/sheets/actor-sheet.mjs — дважды
//  целиком, module/apps/infoguard.mjs — со СВОЕЙ копией расчёта Усталости,
//  module/combat/defense.mjs — трижды). Слагаемое доезжает ровно туда, куда
//  его вписали руками, поэтому «−10 за Усталость» действовал примерно в
//  двадцати местах и молчал во всех остальных.
//
//  Здесь они становятся записями реестра правил (docs/rules-format.md) и
//  приходят источником «situational» (rules/sources.mjs) в ЛЮБОЙ тест,
//  который идёт через конвейер (rules/resolve-test.mjs).
//
//  Почему `value`, а не число в данных: все пять величин ситуативны по самой
//  своей природе — Усталость даёт −10, или −20 (Иссушенный), или 0 (Не
//  Чувствует Боли, отсрочка Добывающего мира); Марш несёт величину во флаге;
//  у выключенной брони поверх плоского −10 идёт каскад Перевеса. Тот же приём
//  функции-источника, что у Зависимости (rules/addiction.mjs): данные тут не
//  число, а состояние актора.
//
//  Почему `auto: true`: это не выбор игрока («уместен ли здесь бонус Черты»),
//  а состояние его тела, действующее всегда — галочку по нему предлагать не за
//  что. Тот же принцип, что у critRangeMod и grantWeaponProp
//  (docs/rules-format.md): «не выбирают, оно просто есть, пока правило
//  действует».
//
//  Область у всех пяти — `all`: по книге это штрафы на ТЕСТЫ, без оговорок про
//  вид теста. Реальный охват при этом растёт не здесь, а по мере того, как
//  каждый путь броска подключается к конвейеру (wdbc-ct65): пока атака
//  собирает свой Порог мимо resolveTest, `all` до неё не доедет — и это ровно
//  то, что нужно на шаге, где ни одно число за столом не должно измениться.
//
//  ── Почему этот файл ничего не импортирует из sheets/ и combat/ ──
//
//  Он работает ВНУТРИ сбора правил, поэтому не имеет права тянуть за собой
//  ничего, что тянет сбор обратно. Расчёт Усталости жил в
//  module/sheets/tabs/conditions.mjs, а тот спрашивает возможности актора
//  (rules/flags.mjs), а те собирают правила (rules/collect.mjs → sources.mjs)
//  — круг замыкался на самом себе, и ES-загрузчик вставал насмерть при
//  параллельном импорте (полный прогон тестов повис на десять минут). Поэтому:
//
//   - fatiguePenalty/marchPenalty переехали сюда, а conditions.mjs
//     реэкспортирует их — прежние импортёры не тронуты;
//   - штраф выключенной брони переехал в rules/armour-penalty.mjs из
//     combat/armor-mods.mjs (тот тянет лист) — там тоже реэкспорт;
//   - две Мутации, меняющие Усталость, читаются ПРЯМЫМ сканом записей
//     Конструктора на предметах, а не через hasRuleFlag. Тем же способом
//     рядом читается терпимость к Усталости (rules/fatigue-grace.mjs) и
//     Зависимость (rules/addiction.mjs) — обе внутри сбора правил, обе по той
//     же причине. Разницы в ответе нет: обе возможности выдаются только
//     записями предметов-Мутаций (packs-src/mutations), больше ими никто не
//     разбрасывается.
// ════════════════════════════════════════════════════════════════════════════

import { shockPenalty, shockFleeing } from "./shock.mjs";
import { HOMEWORLD_BY_KEY } from "../constants/homeworlds.mjs";
import { HELMETLESS_FEL_BONUS } from "../constants/power-armour-lore.mjs";
import { fatigueGraceForActor } from "./fatigue-grace.mjs";
import { disabledArmourPenalty } from "./armour-penalty.mjs";
import { inventoryOverloadPenalty } from "./encumbrance.mjs";
import { isItemActive } from "../apps/effects.mjs";

/**
 * Тесты, которых Усталость не касается. Книга («Раны и Урон» → «Статусы»,
 * wdbc-x1nz.2.95): «штраф −10 на все тесты, кроме тестов T, Inf и Cor».
 *
 * Было ["t","inf","cog","pf"] со времён первого коммита: "cog" — опечатка
 * вместо "cor" (характеристики/теста с ключом "cog" в системе нет вовсе,
 * а тест Проявления Порчи — sheets/tabs/possession.mjs, char:"cor" — зря
 * получал −10). "pf" — тест Фактора Прибыли (actor-sheet.mjs::_rollCharacteristic,
 * «не характеристика»): в книге его нет, но это тот же род теста, что Inf
 * (богатство/положение династии, а не тело персонажа) — оставлен как
 * аналог Inf, а не как отступление от книги.
 */
const FATIGUE_EXEMPT = ["t", "inf", "cor", "pf"];

/**
 * Действующая Усталость: хранимая + 1 от Гангрены (wdbc-x1nz.2.96, книга:
 * «получает 1 Усталости, которую нельзя снять, пока не вылечена Гангрена»).
 * +1 — производная надбавка, а не запись в fatigue.value: хранимое число
 * снимается отдыхом/сном как обычно, а эта единица держится, пока стоит
 * Состояние. Считается заново из value + флага, а не читается из
 * fatigue.effective (rules/character.mjs): между actor.update и пересчётом
 * производных fatigue.effective ещё старое.
 */
export function gangreneFatigueExtra(actor) {
  return actor?.system?.conditions?.gangrene ? 1 : 0;
}
export function effectiveFatigue(actor) {
  return Math.max(0, Number(actor?.system?.fatigue?.value) || 0) + gangreneFatigueExtra(actor);
}

// Гололит (стр. 256, wdbc-x1nz.2): «час подготовки → +10 Command» — бонус
// разовый, на СЛЕДУЮЩИЙ тест Command после успешного брифинга (combat/
// hololith-briefing.mjs::useHololithBriefing ставит флаг, actor-sheet.mjs::
// _runTest гасит его через clearHololithBriefing сразу после теста Command,
// независимо от исхода). Флаг читается напрямую (getFlag), не через
// hasRuleFlag/capability — тот же приём, что у остальных ситуативных здесь,
// не завязан на предмет-источник (гололит мог уже убрать в рюкзак к моменту
// самой речи, подготовка это не отменяет).
const HOLOLITH_BRIEFED_FLAG = "hololithBriefed";
function hololithBriefingBonus(actor, skillKey) {
  if (skillKey !== "command") return 0;
  return actor?.getFlag?.("warhammer-dbc", HOLOLITH_BRIEFED_FLAG) ? 10 : 0;
}

const actorHomeworldKey = actor =>
  actor?.items?.find(i => i.type === "homeworld")?.system?.key || "";

/**
 * Есть ли у актора включённый предмет с такой возможностью Конструктора.
 * Прямой скан, а не hasRuleFlag — см. шапку файла (иначе круг импортов).
 */
function actorHasCapability(actor, key) {
  for (const item of actor?.items ?? []) {
    const groups = item?.flags?.["warhammer-dbc"]?.mechanics;
    if (!Array.isArray(groups)) continue;
    const grants = groups.some(g => (g.entries || []).some(
      e => e?.kind === "capability" && e.capabilityKey === key));
    if (grants && isItemActive(item)) return true;
  }
  return false;
}

/**
 * Штраф Усталости на тест этой характеристикой (стр. 26).
 *
 * Порядок проверок не косметика: дешёвые впереди, скан предметов позади.
 * Функция зовётся на каждый сбор правил, то есть на каждый тест, а у
 * отдохнувшего персонажа (обычный случай) всё решает первое же сравнение.
 */
export function fatiguePenalty(actor, charKey) {
  // Добывающий мир, «Потом и кровью»: штрафы начинаются лишь после T.b Усталости.
  const hw = HOMEWORLD_BY_KEY[actorHomeworldKey(actor)];
  const hwGrace = hw?.fatigueGrace === "tBonus" ? (actor?.system?.characteristics?.t?.bonus ?? 0) : 0;
  // То же самое, но заданное записью Конструктора kind:"fatigue" на предмете.
  // Источники не суммируются — это терпимость к усталости, а не бонус,
  // поэтому берётся максимум. Прежний захардкоженный путь оставлен работать
  // рядом: Происхождения на новую запись не переводились.
  const grace = Math.max(hwGrace, fatigueGraceForActor(actor));
  // Действующая, а не хранимая: +1 Гангрены тоже даёт штраф (wdbc-x1nz.2.96).
  if (effectiveFatigue(actor) < 1 + grace) return 0;
  if (FATIGUE_EXEMPT.includes(String(charKey ?? "").toLowerCase())) return 0;

  // Feels No Pain / Не Чувствует Боли (wdbc-1rno): «не получает штраф −10 от
  // Усталости» — полный иммунитет, а не отсрочка порога (в отличие от grace
  // выше, которая лишь отодвигает начало штрафа).
  if (actorHasCapability(actor, "mutation.feelsNoPain")) return 0;
  // Desiccated / Иссушенный (wdbc-1rno): «Усталость накладывает на персонажа
  // штраф −20 вместо обычного −10».
  return actorHasCapability(actor, "mutation.desiccated") ? -20 : -10;
}

/**
 * Штраф Марша/Бега/Форсированного марша (стр. 29) на тесты Восприятия
 * (P — навык `per`), пока марш активен. Значение хранится флагом
 * marchPPenalty (module/combat/movement-actions.mjs, showMarchDialog).
 */
export function marchPenalty(actor, charKey) {
  if (String(charKey ?? "").toLowerCase() !== "per") return 0;
  return Number(actor?.getFlag?.("warhammer-dbc", "marchPPenalty")) || 0;
}

/**
 * Бонус НАБЛЮДАТЕЛЮ на тесты Awareness/Survival, если он пытается
 * засечь/выследить ЦЕЛЬ (ctx.targetActor), которая сейчас марширует/бежит
 * (стр. 29: «тесты на его отслеживание или засекание получают бонус»).
 * Cross-actor чтение через ctx.targetActor — тот же приём, что
 * hexMarkedPreyAllyBonus (rules/predicates.mjs). Флаг marchTrackBonus стоит
 * на ЦЕЛИ (movement-actions.mjs::showMarchDialog), не на наблюдателе — этой
 * функции сам actor (наблюдатель) не нужен вовсе, только ctx.
 */
function marchTrackBonus(ctx) {
  const skillKey = skillKeyOf(ctx);
  if (skillKey !== "awareness" && skillKey !== "survival") return 0;
  return Number(ctx?.targetActor?.getFlag?.("warhammer-dbc", "marchTrackBonus")) || 0;
}

/**
 * Пружинящая Стойка (стр. 15, wdbc-x1nz.2.66.8): «тесты S −10» — читается
 * широко, как остальные четыре штрафа этого файла (любой тест характеристикой
 * Силы, не только Athletics), пока Стойка активна.
 */
export function springingStrengthPenalty(actor, charKey) {
  if (String(charKey ?? "").toLowerCase() !== "s") return 0;
  return actor?.system?.meleeStance === "springing" ? -10 : 0;
}

/**
 * Снятый шлем силовой брони: +5 ко всем тестам на основе Товарищества.
 * Раньше жил методом листа (`_getHelmetlessBonus`) — единственный из пяти,
 * у кого своей функции вне листа не было вовсе.
 */
export function helmetlessBonus(actor, charKey) {
  if (!actor?.system?.helmetlessActive) return 0;
  return String(charKey ?? "").toLowerCase() === "fel" ? HELMETLESS_FEL_BONUS : 0;
}

/**
 * Ключ навыка теста. Групповой навык (Ремесло/Навигация) несёт ключ в
 * ctx.group, обычный — в ctx.skill: штраф выключенной брони Уклонению
 * различает именно ключ навыка, и потерять его на групповом было бы
 * молчаливой дырой.
 */
const skillKeyOf = ctx => ctx?.skill ?? ctx?.group ?? undefined;

/**
 * Источник «situational» для реестра правил: по записи на каждый ненулевой
 * штраф. Ноль записи не даёт вовсе — иначе игрок видел бы в окне броска
 * строку «Усталость (+0)» у отдохнувшего персонажа.
 */
/**
 * Сжать (стр. 12, wdbc-x1nz.2.76): «штраф –10 на любые Физические действия, за
 * каждое полудействие, потраченное на Сжатие, если она все еще в Захвате».
 * Физические тесты здесь — атаки и Навыки тела (Атлетика — все тесты Борьбы,
 * Акробатика, Уклонение, Парирование); социальные/ментальные не задеты.
 * Счётчик ставит combat/grapple.mjs::_doSqueeze, в действующий переводит начало
 * Хода Цели (rules/turn-flags.mjs::turnStartSqueezeCarryOver).
 */
const PHYSICAL_SKILLS = ["athletics", "acrobatics", "dodge", "parry"];
function grappleSqueezePenalty(actor, ctx, skillKey) {
  if (!actor?.system?.conditions?.grappling) return 0;
  const n = Number(actor?.getFlag?.("warhammer-dbc", "grappleSqueezeActive")
    ?? actor?.flags?.["warhammer-dbc"]?.grappleSqueezeActive) || 0;
  if (!n) return 0;
  const physical = ctx.kind === "attack" || PHYSICAL_SKILLS.includes(skillKey);
  return physical ? -10 * n : 0;
}

export function situationalRules(actor, ctx = {}) {
  if (!actor) return [];
  const charKey  = ctx.char;
  const skillKey = skillKeyOf(ctx);

  const rules = [];
  const add = (id, label, value) => {
    if (!value) return;
    rules.push({
      id, label, when: {},
      effects: [{ kind: "rollBonus", target: "all", value, label, auto: true }]
    });
  };

  add("situational.fatigue",    "😓 Усталость",   fatiguePenalty(actor, charKey));
  add("situational.march",      "🏃 Марш",        marchPenalty(actor, charKey));
  add("situational.helmetless", "🪖 Шлем снят",   helmetlessBonus(actor, charKey));
  add("situational.armourDisabled", "🔌 Броня выключена",
      disabledArmourPenalty(actor, { charKey, skillKey }));
  add("situational.inventoryOverload", "◈ Перевес инвентаря",
      inventoryOverloadPenalty(actor, { charKey, skillKey }));
  add("situational.hololithBriefing", "📽️ Гололит: подготовленный брифинг",
      hololithBriefingBonus(actor, skillKey));
  add("situational.marchTrackBonus", "🏃 Цель марширует/бежит — легче засечь",
      marchTrackBonus(ctx));
  add("situational.springingStance", "🐸 Пружинящая Стойка",
      springingStrengthPenalty(actor, charKey));
  add("situational.grappleSqueeze", "🤼 Сжат в Захвате",
      grappleSqueezePenalty(actor, ctx, skillKey));
  // Шок (стр. 53, rules/shock.mjs): штраф выпавшей строки таблицы.
  add("situational.shock", "😨 Шок", shockPenalty(actor, charKey));
  // «Бежит в панике; если пути к побегу нет — −20» (строка 81–100): есть ли
  // путь, видно только за столом, поэтому это галочка, а не автоштраф — и
  // только галочка (askOnly): в бросках без диалога её не складывают
  // (решение Сергея 25.09.2026: считать, что путь есть).
  if (shockFleeing(actor) && String(charKey ?? "").toLowerCase() !== "t") {
    rules.push({ id: "situational.shockNoEscape", label: "😨 Шок: нет пути к побегу", when: {},
      effects: [{ kind: "rollBonus", target: "all", value: -20, askOnly: true, label: "😨 Шок: нет пути к побегу" }] });
  }

  return rules;
}
