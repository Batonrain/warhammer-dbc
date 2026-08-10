// ════════════════════════════════════════════════════════════════════════
//  Варп-хоррор оверлей сцены (Warhammer DBC).
//  При низкой (истончённой) завесе поверх сцены проступают жуткие мерцающие
//  слова, шёпоты и символы Тёмных богов — каждый в цвете своего бога.
//  Начинается с Истончения +3 и усиливается; при Инфернальной (+5)
//  добавляется варп-дымка. Работает у ВСЕХ клиентов (завеса — во флагах сцены).
// ════════════════════════════════════════════════════════════════════════

import { veilTotal, WARP_GODS_MAP } from "../constants/veil.mjs";
import { readVeilForScene } from "../constants/scene-nexus.mjs";

const ASSET = (n) => `systems/warhammer-dbc/assets/${n}.png`;

// Наборы фраз (шёпоты / возгласы) для каждого бога. Цвет/свечение/сигил берутся
// из WARP_GODS_MAP (общий источник с окном Завесы).
const WORDS = {
  khorne: {
    whispers: [
      "чувствуешь запах крови?", "возьми топор", "они заслужили смерть", "гнев твой праведен",
      "ещё крови…", "убей его первым", "твои руки помнят", "сталь жаждет", "не щади никого",
      "ярость — это честность", "пусть текут реки", "слабых на убой", "сломай их", "покажи силу",
      "трус умирает первым", "кровь смывает всё", "бей сильнее", "череп будет моим"
    ],
    shouts: [
      "КРОВЬ ДЛЯ БОГА КРОВИ", "ЧЕРЕПА ДЛЯ ТРОНА ЧЕРЕПОВ", "УБЕЙ! УБЕЙ! УБЕЙ!", "КРОВЬ И ЧЕРЕПА",
      "ЯРОСТЬ!", "РЕЖЬ ИХ ВСЕХ", "НИ КАПЛИ ПОЩАДЫ", "ВО ИМЯ КРОВАВОГО БОГА", "КХОРН ЖАЖДЕТ"
    ]
  },
  nurgle: {
    whispers: [
      "тебе нездоровится?", "чувствуешь зуд?", "прими болезнь", "она уже в крови", "кашель… кашель…",
      "мухи слетаются", "гниль так тепла", "не сопротивляйся хвори", "ты уже болен", "сладкий распад",
      "плоть — лишь глина", "обними тлен", "боль утихнет, обещаю", "мы все прах", "дыши глубже… споры",
      "тебе станет легче", "чувствуешь, как гниёшь?", "отец приглядывает за тобой"
    ],
    shouts: [
      "ВО СЛАВУ ЧУМНОГО ОТЦА", "ГНИЕНИЕ — ЭТО ДАР", "ОБНИМИ РАСПАД", "ПАПА НУРГЛ ЛЮБИТ ТЕБЯ",
      "ТРЕТИЙ ДАР ЖДЁТ", "РАЗЛОЖЕНИЕ ВЕЧНО", "ПЛОТЬ ТЛЕЕТ", "ПРИМИ ЧУМУ"
    ]
  },
  tzeentch: {
    whispers: [
      "ты пешка", "я знаю твоё будущее", "хочешь силы?", "план уже сплетён", "доверься мне",
      "тайна за тайной", "измени себя", "судьба смеётся", "всё это интрига", "ты не тот, кем себя считаешь",
      "загадай желание", "знание жжётся", "все нити в моих руках", "ложь — это ключ", "смотри глубже",
      "истина изменчива", "ты уже проиграл, но не знаешь", "выбор был иллюзией"
    ],
    shouts: [
      "ВСЁ ИДЁТ ПО ПЛАНУ", "ИЗМЕНЕНИЕ НЕИЗБЕЖНО", "ЗНАНИЕ — СИЛА", "ВСЁ ПРЕДРЕШЕНО",
      "ЛОЖЬ СТАНЕТ ПРАВДОЙ", "ВО ИМЯ ПЕРЕМЕН", "ДЕВЯТЬ И ДЕВЯТЬ", "СУДЬБА СПЛЕТЕНА"
    ]
  },
  slaanesh: {
    whispers: [
      "чего ты жаждешь?", "поддайся", "лишь один раз", "ты заслужил это", "почувствуй всё",
      "громче, ярче, сильнее", "запретное так сладко", "не отказывай себе", "я дам тебе всё",
      "утони в ощущениях", "ещё чуть-чуть", "боль так прекрасна", "будь совершенен", "возьми желаемое",
      "твои чувства — пир", "не сдерживайся", "хочешь больше?", "отдайся мне"
    ],
    shouts: [
      "ВКУСИ ИЗЛИШЕСТВО", "БОЛЬ ЕСТЬ НАСЛАЖДЕНИЕ", "ОТДАЙСЯ ЖЕЛАНИЮ", "СОВЕРШЕНСТВО ИЛИ СМЕРТЬ",
      "ВО СЛАВУ КНЯЗЯ НАСЛАЖДЕНИЙ", "ЕЩЁ… ЕЩЁ… ЕЩЁ", "УТОНИ В СТРАСТИ"
    ]
  },
  undivided: {
    whispers: [
      "оглянись", "мы видим тебя", "ты уже наш", "нет спасения", "за тобой", "не спи",
      "смотри на меня", "хе-хе-хе", "ха… ха… ха", "ш-ш-ш-ш", "иди к нам", "твоя душа",
      "поздно", "обернись", "они близко", "открой дверь", "отпусти", "здесь так холодно",
      "ты слышишь?", "назови своё имя", "беги", "помоги нам", "ты один", "мы ждали тебя",
      "варп голоден", "нет выхода", "стены дышат", "кто-то стоит рядом", "не оборачивайся", "всё напрасно"
    ],
    shouts: [
      "СЛАВА ТЁМНЫМ БОГАМ", "МЫ — ЛЕГИОН", "СМЕРТЬ ЛОЖНОМУ ИМПЕРАТОРУ", "ВСЁ ТЛЕН",
      "ГИБЕЛЬ ГРЯДЁТ", "ВАРП ГОЛОДЕН", "ЧЕТВЕРО ЖДУТ", "ОБРАТИСЬ К ХАОСУ"
    ]
  }
};
// Слияние: мета бога (цвет/свечение/сигил) + наборы фраз.
const GODS = {};
for (const k of Object.keys(WORDS)) {
  const meta = WARP_GODS_MAP[k] || {};
  GODS[k] = { color: meta.color, glow: meta.glow, sigil: ASSET(meta.sigil || "Chaos"), ...WORDS[k] };
}
// Неделимый выпадает чаще (общий фоновый ужас) — при «Смешанном» прорыве.
const GOD_BAG = ["khorne", "nurgle", "tzeentch", "slaanesh", "undivided", "undivided"];

const rand = (a) => a[Math.floor(Math.random() * a.length)];

class VeilOverlay {
  constructor() { this.el = null; this.timer = null; this.level = 0; this.god = ""; }

  _ensure() {
    if (this.el) return;
    const el = document.createElement("div");
    el.className = "wh-veil-fx";
    el.innerHTML = `<div class="wh-veil-haze"></div><div class="wh-veil-scanlines"></div>`;
    document.body.appendChild(el);
    this.el = el;
  }

  _teardown() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.el) { this.el.remove(); this.el = null; }
    this.level = 0;
  }

  // total — Истончение завесы; god — доминирующий Бог ("" = смешанный).
  set(total, god = "") {
    const t = Number(total) || 0;
    this.god = GODS[god] ? god : "";
    if (t < 3) { this._teardown(); return; }
    this._ensure();
    this.level = t;
    const lvl = t >= 5 ? "lvl-inf" : (t >= 4 ? "lvl-4" : "lvl-3");
    this.el.className = "wh-veil-fx " + lvl;
    const rate = t >= 5 ? 520 : (t >= 4 ? 900 : 1500);
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this._spawn(), rate);
  }

  _spawn() {
    if (!this.el) return;
    if (this.el.querySelectorAll(".wh-veil-word,.wh-veil-sigil").length > 16) return;
    // Сигилы — реже слов, но заметно; не более 2 на экране.
    const sigilChance = this.level >= 5 ? 0.14 : (this.level >= 4 ? 0.08 : 0.045);
    const sigils = this.el.querySelectorAll(".wh-veil-sigil").length;
    if (sigils < 2 && Math.random() < sigilChance) this._spawnSigil();
    else this._spawnWord();
  }

  // Позиция: держимся ближе к центру сцены, избегая правого сайдбара.
  _pos() { return { x: 5 + Math.random() * 76, y: 8 + Math.random() * 80 }; }

  _spawnWord() {
    const god = GODS[this.god || rand(GOD_BAG)];
    const shout = Math.random() < (this.level >= 5 ? 0.24 : (this.level >= 4 ? 0.15 : 0.09));
    const w = document.createElement("span");
    w.className = "wh-veil-word" + (shout ? " shout" : "");
    w.textContent = shout ? rand(god.shouts) : rand(god.whispers);
    w.style.color = god.color;
    w.style.setProperty("--glow", god.glow);
    const { x, y } = this._pos();
    w.style.left = x + "vw"; w.style.top = y + "vh";
    w.style.setProperty("--rot", (Math.random() * 10 - 5) + "deg");
    w.style.fontSize = (shout ? (1.7 + Math.random() * 1.6) : (0.9 + Math.random() * 0.9)) + "em";
    const dur = 2.4 + Math.random() * 2.8;
    w.style.animationDuration = dur + "s";
    this.el.appendChild(w);
    setTimeout(() => w.remove(), dur * 1000 + 120);
  }

  _spawnSigil() {
    const god = GODS[this.god || rand(GOD_BAG)];
    const d = document.createElement("div");
    d.className = "wh-veil-sigil";
    // PNG используется как маска, заливка — цветом бога (силуэт в его цвете).
    d.style.setProperty("--sig", `url("${god.sigil}")`);
    d.style.background = god.color;
    d.style.setProperty("--glow", god.glow);
    const { x, y } = this._pos();
    d.style.left = x + "vw"; d.style.top = y + "vh";
    const sz = this.level >= 5 ? (90 + Math.random() * 150) : (70 + Math.random() * 60);
    d.style.width = sz + "px"; d.style.height = sz + "px";
    const dur = 3.4 + Math.random() * 3;
    d.style.animationDuration = dur + "s";
    this.el.appendChild(d);
    setTimeout(() => d.remove(), dur * 1000 + 120);
  }
}

const _overlay = new VeilOverlay();

// Пересчитать оверлей по завесе просматриваемой сцены.
export function refreshVeilOverlay() {
  try {
    const scene = canvas?.scene ?? game.scenes?.current ?? null;
    if (!scene) { _overlay.set(0); return; }
    // Группо-осознанный резолв: сцена в группе → общая Завеса группы.
    const v = readVeilForScene(scene);
    _overlay.set(veilTotal(v), v?.god || "");
  } catch (e) { /* сцена ещё не готова */ }
}
