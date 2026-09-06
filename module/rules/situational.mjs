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

import { HOMEWORLD_BY_KEY } from "../constants/homeworlds.mjs";
import { HELMETLESS_FEL_BONUS } from "../constants/power-armour-lore.mjs";
import { fatigueGraceForActor } from "./fatigue-grace.mjs";
import { disabledArmourPenalty } from "./armour-penalty.mjs";
import { inventoryOverloadPenalty } from "./encumbrance.mjs";
import { isItemActive } from "../apps/effects.mjs";

/** Характеристики, которых Усталость не касается (стр. 26). */
const FATIGUE_EXEMPT = ["t", "inf", "cog", "pf"];

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
  if ((actor?.system?.fatigue?.value ?? 0) < 1 + grace) return 0;
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

  return rules;
}
