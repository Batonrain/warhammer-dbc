// module/constants/vitals.mjs
// ════════════════════════════════════════════════════════════════════════
//  Жизненные потребности (корбук «Опасности», стр. 483): Голод / Жажда / Сон.
//  Хранятся как стадии 0-3 в system.vitals.{hunger,thirst,sleep}. Стадии несут
//  подпись, описание эффекта и «pen» — авто-дебафф к характеристикам (голод —
//  ко всем; жажда — к S/T/Ag; сон — механика Усталости/Ран, char-штрафа нет).
//  Дебафф вычитается ОТДЕЛЬНО от ручного charDamage (не затирает его).
// ════════════════════════════════════════════════════════════════════════

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
