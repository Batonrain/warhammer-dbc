// module/apps/session-rewards-app.mjs
// ════════════════════════════════════════════════════════════════════════
//  Окно «Итоги Сессии» (wdbc-ce8e) — раздача опыта по книжной таблице, плюс
//  необязательные Порча и Бесчестие.
//
//  ГДЕ ОТКРЫВАЕТСЯ. Главный вход — кнопка «⏻ Сессия» виджета Летоисчисления
//  (module/apps/imperial-calendar.mjs): по решению владельца от 07.09.2026
//  конец сессии — это одно действие, а не два в разных углах экрана. Раньше та
//  кнопка сразу звала triggerSessionEnd(); теперь она открывает это окно, а
//  triggerSessionEnd() вызывается отсюда, ПОСЛЕ наград (галочка «закончить
//  сессию» — она включена только у этого входа, см. openSessionRewards и
//  wdbc-f4q0). Порядок принципиален: восполнение ставит
//  Очки Бесчестия на максимум, и награда, выданная после него, пропала бы
//  молча. Запасной вход — пункт системных Настроек (warhammer-dbc.mjs,
//  game.settings.registerMenu), как «Обновить мир».
//
//  ДВЕ ВЕЩИ, РАДИ КОТОРЫХ ОНО И ДЕЛАЛОСЬ:
//
//  1. КНИЖНАЯ ТАБЛИЦА ВМЕСТО ПАМЯТИ. Корбук («III. ПРОДВИЖЕНИЕ → ОПЫТ») даёт
//     готовые ступени: 100 за «ничем не рисковали» и 1000 за «должно было
//     быть не по силам». ГМ выбирает ступень, а не вспоминает число.
//  2. КАЖДОМУ СВОЁ. Часть категорий книга формулирует про партию, часть — про
//     одного персонажа («если ПЕРСОНАЖ совершил ошибку», «игроков, которые
//     прикладывают усилия»). Одна сумма на всех выдавала бы за отыгрыш тому,
//     кто не отыгрывал, поэтому у каждой строки своё итоговое число, и его
//     ещё можно переписать руками.
//
//  Порча и Бесчестие книжной таблицы наград не имеют — они добавлены по
//  прямому решению владельца (07.09.2026) отдельными необязательными полями,
//  каждое либо числом, либо формулой броска («1d5»). Бесчестие при этом растит
//  ХАРАКТЕРИСТИКУ Inf, а не пул Очков Бесчестия: пул и так восполняется каждую
//  сессию, и награда в него не пережила бы до следующей игры (см. INFAMY_PATH
//  в rules/session-rewards.mjs).
//
//  Расчёт — в module/rules/session-rewards.mjs, здесь только окно и запись.
// ════════════════════════════════════════════════════════════════════════

import { XP_CATEGORIES, PARTY_KEYS, EACH_KEYS } from "../constants/session-rewards.mjs";
import { buildRewardRows, parseRewardAmount, infamyRoom, infamyGain, INFAMY_PATH,
         sessionXpWithFastLearner }
  from "../rules/session-rewards.mjs";
import { triggerSessionEnd } from "./game-session.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/** Кому вообще можно раздавать опыт: у Орды и техники его нет. */
const REWARDABLE = new Set(["character", "daemon", "demonPrince", "minion"]);

export class SessionRewardsApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "wh-session-rewards",
    classes: ["warhammer-dbc", "wh-holo", "wh-session-rewards"],
    window: { title: "Итоги Сессии", resizable: true },
    position: { width: 860, height: 720 }
  };

  static PARTS = {
    body: {
      template: "systems/warhammer-dbc/templates/apps/session-rewards.hbs",
      root: true, scrollable: [".wh-sr-body"]
    }
  };

  constructor(options = {}) {
    super(options);
    /** Состояние формы живёт в приложении, а не в DOM: окно перерисовывается
     *  на каждый выбор, и введённые числа иначе слетали бы.
     *
     *  НЕ `this.form`: у ApplicationV2 это свой геттер (DOM-элемент формы) без
     *  сеттера, и присваивание роняет конструктор целиком — окно тогда не
     *  открывается вовсе, молча, ещё до первого рендера (wdbc-gy9n). */
    this.picks = { party: {}, personal: {}, xpOverride: {}, corruption: {}, infamy: {} };
    this.chosen = null;   // Set id выбранных актёров; null — ещё не трогали
    /** Доводить ли конец сессии до конца (откат разовых + восполнение пулов).
     *
     *  Зависит от ТОЧКИ ВХОДА, а не от конструктора. Кнопка «⏻ Сессия»
     *  календаря до появления этого окна делала ровно откат — она и открывает
     *  окно с включённой галочкой. А пункт системных Настроек к концу сессии
     *  отношения не имеет: оттуда окно открывают выдать награду посреди игры,
     *  и включённая галочка одним нажатием вернула бы всему миру потраченные
     *  разовые способности и полные Очки Судьбы (wdbc-f4q0). */
    this.endSession = options.endSession === true;
    /** Раздача уже идёт — второй клик по кнопке игнорируется (см. _apply). */
    this.applying = false;
  }

  /** Кандидаты: игровые персонажи мира, у которых есть опыт. */
  get candidates() {
    return game.actors.contents
      .filter(a => REWARDABLE.has(a.type) && a.system?.experience)
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }

  /** Отмеченные. По умолчанию — те, у кого есть игрок-владелец. */
  get selectedActors() {
    const all = this.candidates;
    if (this.chosen === null) {
      const owned = all.filter(a => Object.entries(a.ownership ?? {})
        .some(([id, lvl]) => lvl === 3 && game.users.get(id) && !game.users.get(id).isGM));
      this.chosen = new Set((owned.length ? owned : all).map(a => a.id));
    }
    return all.filter(a => this.chosen.has(a.id));
  }

  async _prepareContext() {
    const actors = this.selectedActors;
    const rows = buildRewardRows(actors.map(a => ({ id: a.id, name: a.name })), this.picks);
    const byId = new Map(actors.map(a => [a.id, a]));

    return {
      isGM: game.user.isGM,
      partyCats: XP_CATEGORIES.filter(c => PARTY_KEYS.includes(c.key))
        .map(c => ({ ...c, chosen: Number(this.picks.party[c.key]) || 0 })),
      eachCats: XP_CATEGORIES.filter(c => EACH_KEYS.includes(c.key)),
      candidates: this.candidates.map(a => ({ id: a.id, name: a.name, on: this.chosen.has(a.id) })),
      rows: rows.map(r => {
        const actor = byId.get(r.id);
        return {
          ...r,
          personal: this.picks.personal[r.id] ?? {},
          override: this.picks.xpOverride[r.id] ?? "",
          corruptionRaw: this.picks.corruption[r.id] ?? "",
          infamyRaw: this.picks.infamy[r.id] ?? "",
          // Что у персонажа сейчас — чтобы ГМ видел, к чему прибавляет.
          xpNow: Number(actor?.system?.experience?.total) || 0,
          corNow: Number(actor?.system?.corruption?.value) || 0,
          infNow: Number(actor?.system?.characteristics?.inf?.total) || 0,
          infRoom: infamyRoom(actor),
          // Непонятый ввод — не «ноль», а прямая жалоба: пустое поле молчит,
          // а «много» в поле Порчи должно быть видно ошибкой.
          corBad: !!this.picks.corruption[r.id] && !r.corruption,
          infBad: !!this.picks.infamy[r.id] && !r.infamy
        };
      }),
      total: rows.reduce((n, r) => n + r.xp, 0),
      anyRows: rows.length > 0,
      endSession: this.endSession,
      // Кнопка называет то, что произойдёт: раздача без конца сессии и конец
      // сессии без раздачи — обе законные ситуации одного и того же окна.
      applyLabel: this.endSession
        ? (rows.length ? "Раздать и закончить сессию" : "Закончить сессию")
        : "Раздать"
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const el = this.element;
    const on = (sel, evt, fn) => el.querySelectorAll(sel).forEach(n => n.addEventListener(evt, fn));

    on(".wh-sr-party", "change", ev => {
      this.picks.party[ev.currentTarget.dataset.cat] = Number(ev.currentTarget.value) || 0;
      this.render();
    });
    on(".wh-sr-personal", "change", ev => {
      const { actor, cat } = ev.currentTarget.dataset;
      (this.picks.personal[actor] ??= {})[cat] = Number(ev.currentTarget.value) || 0;
      this.render();
    });
    on(".wh-sr-override", "change", ev => {
      this.picks.xpOverride[ev.currentTarget.dataset.actor] = ev.currentTarget.value;
      this.render();
    });
    on(".wh-sr-cor", "change", ev => {
      this.picks.corruption[ev.currentTarget.dataset.actor] = ev.currentTarget.value;
      this.render();
    });
    on(".wh-sr-inf", "change", ev => {
      this.picks.infamy[ev.currentTarget.dataset.actor] = ev.currentTarget.value;
      this.render();
    });
    // Пока печатаешь — без this.render() (wdbc-9jkq): полная перерисовка на
    // каждую нажатую клавишу увела бы фокус из поля прямо во время набора.
    // "change" выше остаётся подстраховкой на блюре: досчитывает то же самое
    // полным рендером на случай вставки без события "input" в редких
    // браузерах, и в это время поле уже не в фокусе — терять нечего.
    on(".wh-sr-override", "input", ev => {
      this.picks.xpOverride[ev.currentTarget.dataset.actor] = ev.currentTarget.value;
      this._recalcTotal();
    });
    on(".wh-sr-cor", "input", ev => {
      this.picks.corruption[ev.currentTarget.dataset.actor] = ev.currentTarget.value;
      this._recalcBad(ev.currentTarget);
    });
    on(".wh-sr-inf", "input", ev => {
      this.picks.infamy[ev.currentTarget.dataset.actor] = ev.currentTarget.value;
      this._recalcBad(ev.currentTarget);
    });
    on(".wh-sr-who", "change", ev => {
      const id = ev.currentTarget.dataset.actor;
      if (ev.currentTarget.checked) this.chosen.add(id); else this.chosen.delete(id);
      this.render();
    });
    on(".wh-sr-endsession", "change", ev => {
      this.endSession = ev.currentTarget.checked;
      this.render();
    });
    on(".wh-sr-apply", "click", () => this._apply());
  }

  /** Итог опыта на "input" поля Опыта — без перерисовки окна (wdbc-9jkq).
   *  Только партийные/личные категории и это же поле влияют на сумму, так что
   *  пересчёт по всем строкам достаточно дёшев, чтобы гнать на каждую клавишу. */
  _recalcTotal() {
    const rows = buildRewardRows(
      this.selectedActors.map(a => ({ id: a.id, name: a.name })), this.picks);
    const total = rows.reduce((n, r) => n + r.xp, 0);
    const totalEl = this.element?.querySelector(".wh-sr-total");
    if (totalEl) totalEl.textContent = String(total);
  }

  /** Подсветка непонятого ввода в поле Порчи/Бесчестия — на "input", без
   *  перерисовки: сама подсветка висит на этом же элементе, трогать больше
   *  нечего (wdbc-9jkq). */
  _recalcBad(input) {
    const bad = !!input.value && !parseRewardAmount(input.value);
    input.classList.toggle("wh-sr-bad", bad);
  }

  /**
   * Раздать — обёртка вокруг самой раздачи.
   *
   * Отвечает за две вещи, без которых раздача опасна (wdbc-mxm2):
   *
   * 1. ОДИН РАЗ. Раздача идёт заметное время — по await на каждого персонажа
   *    плюс бросок кубов, и всё это время окно открыто, а кнопка нажимается.
   *    Второй клик выдал бы всё заново: двойной опыт, две записи в журнале,
   *    два конца сессии. Отменить записанный опыт нечем, поэтому сторожит флаг
   *    на приложении, а не только disabled в разметке — тот снимается
   *    перерисовкой.
   * 2. НЕ МОЛЧА. Обработчик клика выбрасывает промис, и без своего catch любая
   *    ошибка записи уходила бы в необработанный промис: окно остаётся
   *    открытым, в чате пусто, и выглядит это как «кнопка не работает».
   */
  async _apply() {
    if (this.applying) return;
    this.applying = true;
    const button = this.element?.querySelector(".wh-sr-apply");
    if (button) button.disabled = true;
    try {
      await this._distribute();
    } catch (err) {
      console.error("Warhammer DBC | Итоги Сессии — раздача оборвалась", err);
      ui.notifications?.error(
        `Раздача оборвалась: ${err?.message ?? err}. Часть персонажей могла уже получить награду — проверьте журнал опыта, прежде чем раздавать снова.`);
      if (button) button.disabled = false;
    } finally {
      this.applying = false;
    }
  }

  /** Собственно запись: опыт, Порча и Бесчестие плюс одна карточка в чат. */
  async _distribute() {
    const actors = this.selectedActors;
    const rows = buildRewardRows(actors.map(a => ({ id: a.id, name: a.name })), this.picks);
    const byId = new Map(actors.map(a => [a.id, a]));
    const lines = [];
    const rolls = [];
    const failed = [];

    for (const row of rows) {
      const actor = byId.get(row.id);
      if (!actor) continue;
      const parts = [];

      // Сбой на одном персонаже не должен лишать награды остальных: раньше
      // исключение обрывало весь список, и половина партии молча оставалась ни
      // с чем. Теперь неудачник называется по имени, а раздача идёт дальше.
      try {
        if (row.xp > 0) {
          const exp = actor.system.experience ?? {};
          // «Ловит на Лету» (Fast Learner X): «+X% к стартовому опыту и опыту
          // ЗА СЕССИЮ» (module/rules/character.mjs, system.fastLearnerBonus).
          // Раньше процент читал только promptStatAdd — а раздача переехала
          // сюда, и Черта перестала работать на своём главном пути (wdbc-045).
          // Округление вверх — то же, что в apps/stat-log.mjs, чтобы одна и та
          // же Черта не давала разные числа из двух окон.
          const pct  = Number(actor.system?.fastLearnerBonus) || 0;
          const gain = sessionXpWithFastLearner(actor, row.xp);
          const log = Array.isArray(exp.log) ? foundry.utils.deepClone(exp.log) : [];
          log.push({ at: Date.now(), amount: gain, kind: "session", reason: "Итоги Сессии" });
          // system.experience.current не пишется: оно производное
          // (character.mjs — total минус потраченное) и пересчитывается на
          // каждом prepareDerivedData, так что запись сюда лишь оставляла бы
          // в базе число, которое тут же перетирается.
          await actor.update({
            "system.experience.total": (Number(exp.total) || 0) + gain,
            "system.experience.log":   log
          });
          parts.push(gain !== row.xp
            ? `<b>${gain}</b> опыта (${row.xp} +${pct}% «Ловит на Лету»)`
            : `<b>${gain}</b> опыта`);
        }

        const cor = await this._amount(row.corruption, rolls);
        if (cor !== null) {
          const now = Number(actor.system.corruption?.value) || 0;
          await actor.update({ "system.corruption.value": Math.max(0, now + cor) });
          parts.push(`Порча ${cor >= 0 ? "+" : ""}${cor}`);
        }

        const inf = await this._amount(row.infamy, rolls);
        if (inf !== null) {
          const base = Number(actor.system.characteristics?.inf?.base) || 0;
          const gain = infamyGain(actor, inf);
          await actor.update({ [INFAMY_PATH]: Math.max(0, base + gain) });
          // Обрезанную прибавку называем честно: «+2 (потолок)» вместо «+5».
          const clipped = gain !== inf ? " (потолок)" : "";
          parts.push(`Бесчестие ${gain >= 0 ? "+" : ""}${gain}${clipped}`);
        }
      } catch (err) {
        console.error(`Warhammer DBC | Итоги Сессии — не начислено «${row.name}»`, err);
        failed.push(row.name);
        continue;
      }

      if (parts.length) lines.push(`<li><b>${esc(row.name)}</b>: ${parts.join(", ")}</li>`);
    }

    if (failed.length) ui.notifications?.error(
      `Не удалось начислить: ${failed.join(", ")}. Остальным раздача прошла.`);

    if (!lines.length && !this.endSession) {
      ui.notifications?.warn("Нечего раздавать: ни у кого не выбрано ни опыта, ни Порчи, ни Бесчестия.");
      return;
    }

    if (lines.length) await ChatMessage.create({
      content: `<div class="wh-roll-result">
        <div class="roll-header">${rollIcon("crown", "#ffd24d")}Итоги Сессии</div>
        <ul class="roll-threshold" style="margin:2px 0 0;padding-left:18px;">${lines.join("")}</ul>
      </div>`,
      rolls, sound: null
    });

    // Строго ПОСЛЕ наград: восполнение ставит Очки Бесчестия на максимум, и
    // выданное до него остаётся в журнале чата, а выданное после пропало бы
    // молча — пул и так уже полон.
    if (this.endSession) await triggerSessionEnd();

    this.close();
  }

  /** Число или бросок → число. null, если поле пустое или непонятное. */
  async _amount(parsed, rolls) {
    if (!parsed) return null;
    if (parsed.kind === "flat") return parsed.value;
    try {
      const roll = await new Roll(parsed.formula).evaluate();
      rolls.push(roll);
      return roll.total;
    } catch {
      ui.notifications?.warn(`Не понял формулу «${parsed.formula}» — пропускаю.`);
      return null;
    }
  }
}

/**
 * Открыть окно.
 *
 * @param {object}  [options]
 * @param {boolean} [options.endSession=false] сразу отметить «закончить
 *   сессию». Ставит только кнопка «⏻ Сессия» календаря — она и означает конец
 *   сессии. Пункт Настроек и вызов из макроса открывают окно со снятой
 *   галочкой: оттуда его открывают раздать награду посреди игры.
 */
export function openSessionRewards(options = {}) {
  return new SessionRewardsApp(options).render(true);
}
