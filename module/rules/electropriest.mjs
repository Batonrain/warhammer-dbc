// module/rules/electropriest.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Электрожрец (Элитные архетипы) — чистая часть без Foundry. Кнопки —
//  combat/electropriest.mjs.
//
//  Катушки Электрожреца (Черта): «Увеличивает максимальный заряд Катушки
//  Потенции на W.b… Если не носит на голове, торсе и руках брони и одежды,
//  закрывающей более 20% кожи, получает: +заряд к SPD; +заряд×2 к тестам
//  Уклонения; +W.b к Инициативе; +3×W.b на Компенсатор Мотивотеургии; +½W.b
//  (окр.▲) к Dmg и Pen всех Люминен Техночудес; при Voltagheist Shield — …;
//  Electroepithany +3×W.b на Awareness…».
//  Сила Из Плоти (Черта): «Трейт Machine отключает все эффекты Архетипа, кроме
//  как от мутации Механоид или если персонаж возьмёт Талант Fleshmetal» —
//  electropriestActive() гасит всё ниже.
//
//  Читатели:
//    • максимум заряда — rules/character/final-pools.mjs (coilsEnergyMaxBonus);
//    • SPD — rules/character/movement.mjs (coilsSpeedBonus);
//    • Инициатива — rules/character/final-pools.mjs (coilsInitiativeBonus);
//    • Уклонение и Внимательность — источник eliteMech2 (electropriestRules);
//    • Компенсатор и Люминен — sheets/tabs/tech.mjs (coilsTechBonus).
// ════════════════════════════════════════════════════════════════════════════

import { hasItemNamed } from "./req-atom.mjs";

export const hasCoils = actor => hasItemNamed(actor, "Electropriest Coils", ["trait"]);
export const hasPowerFromFlesh = actor => hasItemNamed(actor, "Power From Flesh", ["trait"]);
export const hasVoltagheistBlast = actor => hasItemNamed(actor, "Voltagheist Blast", ["talent"]);
export const hasVoltagheistBubble = actor => hasItemNamed(actor, "Voltagheist Bubble", ["talent"]);
export const hasVoltaicAbsorption = actor => hasItemNamed(actor, "Voltaic Absorption", ["talent"]);
export const hasVoltaicConfluence = actor => hasItemNamed(actor, "Voltaic Confluence", ["talent"]);
export const hasVoltagheistShield = actor => hasItemNamed(actor, "Voltagheist Shield", ["techPower"]);
export const hasElectroepithany = actor => hasItemNamed(actor, "Electroepithany", ["techPower"]);

/** Вольтагейст Взрыв: цена в зарядах. */
export const VOLTAGHEIST_BLAST_COST = 3;
/** Вольтагейст Пузырь: запас воздуха, секунд (15 минут). */
export const BUBBLE_AIR_SECONDS = 15 * 60;
export const BUBBLE_FLAG = "voltagheistBubble";

const NS = "warhammer-dbc";
const wpBonus = actor => Math.max(0, Number(actor?.system?.characteristics?.wp?.bonus) || 0);
const energyOf = actor => Math.max(0, Number(actor?.system?.energy?.value) || 0);

/**
 * Фреймы Механикус, отличные от Хоминис (человеческого тела по умолчанию):
 * Черты-тела архетипов Тех-Ассасин, Секутор, Архимагос. «Все эффекты
 * Архетипа действуют только с фреймом Хоминис и теряются при установке
 * другого Фрейма».
 */
export const OTHER_FRAMES = ["Assassin Frame", "Paladin Frame", "Masterpiece Frame"];
export const HOMINIS_FRAME = "Hominis Frame";
export const hasHominisFrame = actor => hasItemNamed(actor, HOMINIS_FRAME, ["trait"]);
export const otherFrameInstalled = actor => OTHER_FRAMES.some(n => hasItemNamed(actor, n, ["trait"]));

/**
 * Сила Из Плоти: с Чертой Machine эффекты Архетипа не действуют, если нет
 * мутации Механоид или Таланта Fleshmetal. Без самой Черты — не гасит.
 */
export function electropriestActive(actor) {
  if (!hasPowerFromFlesh(actor)) return true;
  // «Действуют только с фреймом Хоминис» (решение Сергея 21.11.2026): пока
  // Фреймы — заготовки, признак тела — Черта «Фрейм Хоминис» (её выдаёт
  // Архетип). Нет её — Архетип не действует, какой бы Фрейм ни стоял.
  if (!hasHominisFrame(actor)) return false;
  if (otherFrameInstalled(actor)) return false;
  if (!hasItemNamed(actor, "Machine", ["trait"])) return true;
  return hasItemNamed(actor, "Fleshmetal", ["talent"]) || hasItemNamed(actor, "Mechanoid", ["mutation", "trait"])
    || hasItemNamed(actor, "Механоид", ["mutation", "trait"]);
}

/** Катушки действуют (Черта есть и Сила Из Плоти не гасит). */
export const coilsOn = actor => hasCoils(actor) && electropriestActive(actor);

/**
 * «Не носит на голове, торсе и руках брони и одежды, закрывающей более 20%
 * кожи» — по надетой броне: ни одна не даёт AP голове, телу или рукам.
 * Одежду без AP система не видит — её снимает игрок.
 */
export function coilsBare(actor) {
  for (const i of actor?.items ?? []) {
    if (i?.type !== "armor" || !i.system?.equipped) continue;
    const s = i.system;
    if ((Number(s.head) || 0) > 0 || (Number(s.body) || 0) > 0
        || (Number(s.leftArm) || 0) > 0 || (Number(s.rightArm) || 0) > 0) return false;
  }
  return true;
}

const bareOn = actor => coilsOn(actor) && coilsBare(actor);

/** +W.b к максимуму заряда Катушки Потенции. */
export const coilsEnergyMaxBonus = actor => (coilsOn(actor) ? wpBonus(actor) : 0);
/** Без одежды: +заряд к SPD. */
export const coilsSpeedBonus = actor => (bareOn(actor) ? energyOf(actor) : 0);
/** Без одежды: +W.b к Инициативе. */
export const coilsInitiativeBonus = actor => (bareOn(actor) ? wpBonus(actor) : 0);

/** Техночудо Люминен (подвид в паке). */
export const isLuminen = power => power?.type === "techPower" && /люминен|luminen/i.test(String(power.system?.subtype ?? ""));

/**
 * Прибавки Катушек к Техночуду: тест Компенсатора Мотивотеургии +3×W.b,
 * Dmg и Pen Люминен +½W.b (окр.▲).
 */
export function coilsTechBonus(actor, power) {
  const none = { test: 0, dmg: 0, pen: 0, note: "" };
  if (!bareOn(actor) || power?.type !== "techPower") return none;
  const wb = wpBonus(actor);
  const s = power.system ?? {};
  const compensator = s.discipline === "motivotheurgy"
    && (s.miracleType === "compensator" || (s.extraTypes ?? []).some(e => e?.type === "compensator"));
  const test = compensator ? 3 * wb : 0;
  const lum = isLuminen(power) ? Math.ceil(wb / 2) : 0;
  if (!test && !lum) return none;
  const parts = [test ? `+${test} к тесту Компенсатора` : "", lum ? `+${lum} к Dmg и Pen Люминен` : ""].filter(Boolean);
  return { test, dmg: lum, pen: lum, note: `Катушки Электрожреца (без одежды): ${parts.join(", ")}.` };
}

/** Правила Катушек для броска (источник eliteMech2): Уклонение и Внимательность. */
export function electropriestRules(actor) {
  if (!bareOn(actor)) return [];
  const out = [];
  const dodge = energyOf(actor) * 2;
  if (dodge) out.push({
    id: "electropriest.coilsDodge", label: "Катушки Электрожреца: Уклонение",
    when: {},
    effects: [{ kind: "rollBonus", target: "skill:dodge", value: dodge, auto: true, label: `⚡ Катушки (заряд×2) +${dodge}` }]
  });
  const wb = wpBonus(actor);
  if (wb && hasElectroepithany(actor)) out.push({
    id: "electropriest.electroepithany", label: "Катушки Электрожреца: Electroepithany",
    when: {},
    effects: [{ kind: "rollBonus", target: "skill:awareness", value: 3 * wb, auto: true, label: `⚡ Электроэпифания +${3 * wb}` }]
  });
  return out;
}

/** Щит-купол Катушек: за 1 заряд +2×W.b аблативных Ран. */
export const coilsShieldAblative = actor => 2 * wpBonus(actor);

/**
 * Катушки: «за 1 заряд уменьшение непоглощённого урона на W.b (до минимума
 * в 1)» — сколько Ран вернуть после попадания, нанёсшего damage.
 */
export function coilsDamageRefund(actor, damage) {
  const d = Math.max(0, Number(damage) || 0);
  return Math.max(0, Math.min(wpBonus(actor), d - 1));
}

/** Вольтагейст Взрыв: радиус Blast(½W.b окр.▲) и формула урона. */
export function voltagheistBlastProfile(actor) {
  const wb = wpBonus(actor);
  return { radius: Math.ceil(wb / 2), formula: `1d10+${wb}`, pen: 0, allies: wb };
}

/** Вольтаическое Поглощение: за 1 заряд восстановить щиту W.b аблативных Ран. */
export const absorptionRestore = actor => wpBonus(actor);

/** Пузырь включён (метка с моментом времени мира) и воздух ещё не кончился. */
export function bubbleState(actor, now = 0) {
  const f = actor?.flags?.[NS]?.[BUBBLE_FLAG] ?? actor?.getFlag?.(NS, BUBBLE_FLAG);
  if (!f) return { on: false, breathable: false, left: 0 };
  const left = f.vacuum ? 0 : Math.max(0, (Number(f.at) || 0) + BUBBLE_AIR_SECONDS - (Number(now) || 0));
  return { on: true, breathable: !f.vacuum && left > 0, left };
}

/**
 * Тест вакуума не нужен: Пузырь включён в атмосфере и 15 минут воздуха ещё
 * не прошли. Включённый в вакууме (азот) от удушья не спасает — тест остаётся.
 */
export function bubbleProtects(actor, now = 0) {
  return hasVoltagheistBubble(actor) && electropriestActive(actor) && bubbleState(actor, now).breathable;
}

// ── Аблативные Раны Вольтагейст Щита ────────────────────────────────────────
// Доля щита в общем пуле аблативных Ран (system.wounds.ablative) — метка-вклад,
// как у Псалма Незримой Крепости (rules/wounds.mjs::replaceAblativeContribution).
// Пул тратится уроном общим порядком; «сколько осталось на щите» — меньшее из
// вклада и текущего пула.

export const SHIELD_ABLATIVE_FLAG = "voltagheistAblative";

const shieldFlag = actor => Math.max(0, Number(actor?.flags?.[NS]?.[SHIELD_ABLATIVE_FLAG]
  ?? actor?.getFlag?.(NS, SHIELD_ABLATIVE_FLAG)) || 0);

/** Аблативные Раны на щите сейчас. */
export function shieldAblative(actor) {
  return Math.min(shieldFlag(actor), Math.max(0, Number(actor?.system?.wounds?.ablative) || 0));
}

/**
 * Изменить долю щита на delta (может быть отрицательной). Возвращает поля для
 * actor.update и новый вклад.
 */
export function shieldAblativeChange(actor, delta) {
  const prev = shieldFlag(actor);
  const effective = shieldAblative(actor);
  const next = Math.max(0, effective + (Number(delta) || 0));
  const w = actor?.system?.wounds ?? {};
  const currentAblative = Math.max(0, Number(w.ablative) || 0);
  const currentMax = Math.max(0, Number(w.ablativeMax) || 0);
  // Вклад prev мог уже частично сгореть в уроне: базовая часть пула — без effective.
  const baseAblative = Math.max(0, currentAblative - effective);
  const baseMax = Math.max(0, currentMax - prev);
  return {
    contribution: next,
    update: {
      "system.wounds.ablative": baseAblative + next,
      "system.wounds.ablativeMax": baseMax + next,
      [`flags.${NS}.${SHIELD_ABLATIVE_FLAG}`]: next
    }
  };
}
