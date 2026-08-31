// module/constants/vitals.mjs
// ════════════════════════════════════════════════════════════════════════
//  Жизненные потребности (корбук «Опасности», стр. 483): Голод / Жажда / Сон.
//  Хранятся как стадии 0-3 в system.vitals.{hunger,thirst,sleep}. Стадии несут
//  подпись, описание эффекта и «pen» — авто-дебафф к характеристикам (голод —
//  ко всем; жажда — к S/T/Ag; сон — механика Усталости/Ран, char-штрафа нет).
//  Дебафф вычитается ОТДЕЛЬНО от ручного charDamage (не затирает его).
//
//  wdbc-jnqj: стадии двигаются САМИ по game.time.worldTime — рядом со
//  стадией хранится момент последнего удовлетворения (system.vitals.
//  {lastFed,lastDrank,lastSlept}, см. VITAL_TIME_FIELD). vitalNaturalStage()
//  переводит «сколько суток прошло» в стадию по порогам книги (Голод: ½T.b
//  суток без штрафов, дальше книга гоняет тест ЕЖЕДНЕВНО с штрафом −5 за
//  каждые 3 суток ГОЛОДАНИЯ — здесь это 2 дальнейшие стадии на той же
//  3-дневной каденции, книга отдельных стадий не называет. Жажда/Сон книга
//  вообще описывает эскалацией теста, а не 4 стадиями — пороги ниже держат ту
//  же логику, что уже была лестницей меток этого файла, а не новую цифру).
//  vitalEffectiveStage() — то, что видит лист и что уходит в vitalCharMods:
//  max(сохранённая стадия, естественная по времени) — ручное «−» или старое
//  сохранение НЕ откатывает автопрогресс, снять его может только кнопка
//  «Поесть/Попить/Поспать» (sheets/tabs/body.mjs::satisfyVital, обнуляет
//  стадию И метку времени разом — как в книге: штраф «нельзя снять, пока не
//  поест»).
// ════════════════════════════════════════════════════════════════════════

import { SECONDS_PER_DAY } from "./imperial-calendar.mjs";

export const VITALS = [
  {
    key: "hunger", label: "Голод", icon: "🍖", tone: "#e0a24a",
    scope: "all",   // к каким хар-кам применяется pen
    action: "Поесть",
    stages: [
      { label: "Сыт",        fx: "Нет штрафов. Голодать без последствий можно ½ T.b (окр.▼) суток.", pen: 0 },
      { label: "Голоден",    fx: "+1 Усталость (не снять, пока не поест); тест T+0 или 1 урон во все хар-ки.", pen: 0 },
      { label: "Истощён",    fx: "−5 ко ВСЕМ характеристикам (голод >3 дней). Урон в хар-ки не лечится.", pen: 5 },
      { label: "Дистрофия",  fx: "−10 ко всем; штраф растёт на −5 за каждые 3 дня голода.", pen: 10 }
    ]
  },
  {
    key: "thirst", label: "Жажда", icon: "💧", tone: "#4ab0e0",
    scope: "sta",   // S, T, Ag
    action: "Попить",
    stages: [
      { label: "Утолена",       fx: "Нет штрафов. Норма — 2 л/сутки (космодесантнику 4 л).", pen: 0 },
      { label: "Жажда",         fx: "+1 Усталость (не снять, пока не попьёт); тест T+0 или 1d5+Провалы урона в S, T, Ag.", pen: 0 },
      { label: "Обезвоживание", fx: "−5 к Силе/Стойкости/Ловкости; тест T со штрафом −10 за каждую норму сверх.", pen: 5 },
      { label: "Критическая",   fx: "−10 к S/T/Ag; урон не лечится, пока не напьётся.", pen: 10 }
    ]
  },
  {
    key: "sleep", label: "Сон", icon: "🌙", tone: "#9a7fe0",
    scope: "none",  // сон — Усталость/урон в Раны, char-штрафа нет
    action: "Поспать",
    stages: [
      { label: "Отдохнул",         fx: "Нет штрафов. Норма — 8 ч сна в сутки.", pen: 0 },
      { label: "Недосып",          fx: "Тест T−10 при пробуждении или +1 Усталость (не снять отдыхом, пока не выспится 6 ч).", pen: 0 },
      { label: "Сильный недосып",  fx: "Бессонные сутки: тест T−10×(суток подряд); галлюцинации, микросны.", pen: 0 },
      { label: "Истощение сна",    fx: "Тест T−30; при провале <Провалы>d5 урона в Раны (не лечится), пока не поспит 8 ч.", pen: 0 }
    ]
  }
];
export const VITALS_MAP = Object.fromEntries(VITALS.map(v => [v.key, v]));
export const VITAL_MAX_STAGE = 3;

export function vitalStage(key, val) {
  const meta = VITALS_MAP[key]; if (!meta) return null;
  const s = Math.max(0, Math.min(VITAL_MAX_STAGE, Math.round(Number(val) || 0)));
  return { ...meta.stages[s], stage: s };
}

// Авто-дебафф к характеристикам от потребностей (отдельно от ручного charDamage).
// Возвращает { ws,bs,s,t,ag,int,per,wp,fel,inf } — величина ВЫЧИТАНИЯ (>=0).
const STA_KEYS = ["s", "t", "ag"];
const ALL_KEYS = ["ws", "bs", "s", "t", "ag", "int", "per", "wp", "fel", "inf"];
export function vitalCharMods(vitals) {
  const out = {};
  for (const k of ALL_KEYS) out[k] = 0;
  const add = (keys, pen) => { for (const k of keys) out[k] += pen; };
  for (const meta of VITALS) {
    const st = vitalStage(meta.key, vitals?.[meta.key]);
    if (!st || !st.pen) continue;
    if (meta.scope === "all") add(ALL_KEYS, st.pen);
    else if (meta.scope === "sta") add(STA_KEYS, st.pen);
  }
  return out;
}

// ── Автопрогресс по времени (wdbc-jnqj) ────────────────────────────────────

/** Поле system.vitals.* с моментом (worldTime) последнего удовлетворения потребности. */
export const VITAL_TIME_FIELD = { hunger: "lastFed", thirst: "lastDrank", sleep: "lastSlept" };

// Пороги в СУТКАХ без удовлетворения для стадий 1/2/3. ctx = { tb, isAstartes }.
function _hungerDayThresholds(ctx) {
  const half = Math.floor((Number(ctx?.tb) || 0) / 2);
  // ½T.b суток без еды → 1 (книга); дальше книга гоняет тест ЕЖЕДНЕВНО и копит
  // штраф −5 за каждые 3 суток ГОЛОДАНИЯ (не от сытости, а от входа в стадию
  // 1) — здесь эта же каденция отсчитана от half, чтобы при большом T.b
  // (half ≥ 3) пороги не схлопывались друг с другом.
  return [half, half + 3, half + 6];
}
function _thirstDayThresholds(ctx) {
  // Книга: штраф после 2-дневной нормы (7-дневной у космодесантника), дальше
  // тест повторяется за каждую ЕЩЁ одну норму — здесь это шаг в 1 сутки на стадию.
  const base = ctx?.isAstartes ? 7 : 2;
  return [base, base + 1, base + 2];
}
const _SLEEP_DAY_THRESHOLDS = [1, 2, 3]; // книга считает по бессонным суткам подряд

function _dayThresholds(key, ctx) {
  if (key === "hunger") return _hungerDayThresholds(ctx);
  if (key === "thirst") return _thirstDayThresholds(ctx);
  if (key === "sleep")  return _SLEEP_DAY_THRESHOLDS;
  return null;
}

/** Стадия 0-3, которую диктует ТОЛЬКО прошедшее время (без учёта ручной/сохранённой стадии). */
export function vitalNaturalStage(key, lastSatisfiedWorldTime, worldTime, ctx = {}) {
  if (lastSatisfiedWorldTime == null) return 0; // ещё не инициализировано — без штрафа задним числом
  const thresholds = _dayThresholds(key, ctx);
  if (!thresholds) return 0;
  const elapsedDays = Math.max(0, (Number(worldTime) - Number(lastSatisfiedWorldTime)) / SECONDS_PER_DAY);
  let stage = 0;
  for (let i = 0; i < thresholds.length; i++) if (elapsedDays >= thresholds[i]) stage = i + 1;
  return Math.min(VITAL_MAX_STAGE, stage);
}

/** Эффективная стадия для листа/штрафов: max(сохранённая, естественная по времени). */
export function vitalEffectiveStage(key, storedStage, lastSatisfiedWorldTime, worldTime, ctx = {}) {
  const stored  = Math.max(0, Math.min(VITAL_MAX_STAGE, Math.round(Number(storedStage) || 0)));
  const natural = vitalNaturalStage(key, lastSatisfiedWorldTime, worldTime, ctx);
  return Math.max(stored, natural);
}
