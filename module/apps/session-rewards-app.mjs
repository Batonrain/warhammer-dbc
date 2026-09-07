// module/apps/session-rewards-app.mjs
// ════════════════════════════════════════════════════════════════════════
//  Окно «Итоги Сессии» (wdbc-ce8e) — раздача опыта по книжной таблице, плюс
//  необязательные Порча и Бесчестие. Открывается пунктом системных Настроек
//  (warhammer-dbc.mjs, game.settings.registerMenu), как «Обновить мир».
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
//  каждое либо числом, либо формулой броска («1d5»).
//
//  Расчёт — в module/rules/session-rewards.mjs, здесь только окно и запись.
// ════════════════════════════════════════════════════════════════════════

import { XP_CATEGORIES, PARTY_KEYS, EACH_KEYS } from "../constants/session-rewards.mjs";
import { buildRewardRows } from "../rules/session-rewards.mjs";
import { actorInfamyValue } from "./infamy-points.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/** Кому вообще можно раздавать опыт: у Орды и техники его нет. */
const REWARDABLE = new Set(["character", "daemon", "demonPrince", "minion"]);

/** Куда писать Очки Бесчестия у этого актора — пул зависит от типа. */
export function infamyPathOf(actor) {
  return actor?.type === "demonPrince" ? "system.dp.ip" : "system.fate.value";
}

/** Максимум Очков Бесчестия — Inf.b (тот же, что показывает лист). */
export function infamyMaxOf(actor) {
  return Math.max(0, Number(actor?.system?.characteristics?.inf?.bonus) || 0);
}

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
     *  на каждый выбор, и введённые числа иначе слетали бы. */
    this.form = { party: {}, personal: {}, xpOverride: {}, corruption: {}, infamy: {} };
    this.chosen = null;   // Set id выбранных актёров; null — ещё не трогали
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
    const rows = buildRewardRows(actors.map(a => ({ id: a.id, name: a.name })), this.form);
    const byId = new Map(actors.map(a => [a.id, a]));

    return {
      isGM: game.user.isGM,
      partyCats: XP_CATEGORIES.filter(c => PARTY_KEYS.includes(c.key))
        .map(c => ({ ...c, chosen: Number(this.form.party[c.key]) || 0 })),
      eachCats: XP_CATEGORIES.filter(c => EACH_KEYS.includes(c.key)),
      candidates: this.candidates.map(a => ({ id: a.id, name: a.name, on: this.chosen.has(a.id) })),
      rows: rows.map(r => {
        const actor = byId.get(r.id);
        return {
          ...r,
          personal: this.form.personal[r.id] ?? {},
          override: this.form.xpOverride[r.id] ?? "",
          corruptionRaw: this.form.corruption[r.id] ?? "",
          infamyRaw: this.form.infamy[r.id] ?? "",
          // Что у персонажа сейчас — чтобы ГМ видел, к чему прибавляет.
          xpNow: Number(actor?.system?.experience?.total) || 0,
          corNow: Number(actor?.system?.corruption?.value) || 0,
          ipNow: actorInfamyValue(actor),
          ipMax: infamyMaxOf(actor),
          // Непонятый ввод — не «ноль», а прямая жалоба: пустое поле молчит,
          // а «много» в поле Порчи должно быть видно ошибкой.
          corBad: !!this.form.corruption[r.id] && !r.corruption,
          infBad: !!this.form.infamy[r.id] && !r.infamy
        };
      }),
      total: rows.reduce((n, r) => n + r.xp, 0),
      anyRows: rows.length > 0
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const el = this.element;
    const on = (sel, evt, fn) => el.querySelectorAll(sel).forEach(n => n.addEventListener(evt, fn));

    on(".wh-sr-party", "change", ev => {
      this.form.party[ev.currentTarget.dataset.cat] = Number(ev.currentTarget.value) || 0;
      this.render();
    });
    on(".wh-sr-personal", "change", ev => {
      const { actor, cat } = ev.currentTarget.dataset;
      (this.form.personal[actor] ??= {})[cat] = Number(ev.currentTarget.value) || 0;
      this.render();
    });
    on(".wh-sr-override", "change", ev => {
      this.form.xpOverride[ev.currentTarget.dataset.actor] = ev.currentTarget.value;
      this.render();
    });
    on(".wh-sr-cor", "change", ev => {
      this.form.corruption[ev.currentTarget.dataset.actor] = ev.currentTarget.value;
      this.render();
    });
    on(".wh-sr-inf", "change", ev => {
      this.form.infamy[ev.currentTarget.dataset.actor] = ev.currentTarget.value;
      this.render();
    });
    on(".wh-sr-who", "change", ev => {
      const id = ev.currentTarget.dataset.actor;
      if (ev.currentTarget.checked) this.chosen.add(id); else this.chosen.delete(id);
      this.render();
    });
    on(".wh-sr-apply", "click", () => this._apply());
  }

  /** Раздать. Пишет опыт, Порчу и Бесчестие и кладёт одну карточку в чат. */
  async _apply() {
    const actors = this.selectedActors;
    const rows = buildRewardRows(actors.map(a => ({ id: a.id, name: a.name })), this.form);
    const byId = new Map(actors.map(a => [a.id, a]));
    const lines = [];
    const rolls = [];

    for (const row of rows) {
      const actor = byId.get(row.id);
      if (!actor) continue;
      const parts = [];

      if (row.xp > 0) {
        const exp = actor.system.experience ?? {};
        const log = Array.isArray(exp.log) ? foundry.utils.deepClone(exp.log) : [];
        log.push({ at: Date.now(), amount: row.xp, kind: "session", reason: "Итоги Сессии" });
        await actor.update({
          "system.experience.total":   (Number(exp.total) || 0) + row.xp,
          "system.experience.current": (Number(exp.current) || 0) + row.xp,
          "system.experience.log":     log
        });
        parts.push(`<b>${row.xp}</b> опыта`);
      }

      const cor = await this._amount(row.corruption, rolls);
      if (cor !== null) {
        const now = Number(actor.system.corruption?.value) || 0;
        await actor.update({ "system.corruption.value": Math.max(0, now + cor) });
        parts.push(`Порча ${cor >= 0 ? "+" : ""}${cor}`);
      }

      const inf = await this._amount(row.infamy, rolls);
      if (inf !== null) {
        const path = infamyPathOf(actor);
        const max = infamyMaxOf(actor);
        const now = Math.max(0, Number(foundry.utils.getProperty(actor, path)) || 0);
        await actor.update({ [path]: Math.max(0, Math.min(max, now + inf)) });
        parts.push(`Бесчестие ${inf >= 0 ? "+" : ""}${inf}`);
      }

      if (parts.length) lines.push(`<li><b>${esc(row.name)}</b>: ${parts.join(", ")}</li>`);
    }

    if (!lines.length) {
      ui.notifications?.warn("Нечего раздавать: ни у кого не выбрано ни опыта, ни Порчи, ни Бесчестия.");
      return;
    }

    await ChatMessage.create({
      content: `<div class="wh-roll-result">
        <div class="roll-header">${rollIcon("crown", "#ffd24d")}Итоги Сессии</div>
        <ul class="roll-threshold" style="margin:2px 0 0;padding-left:18px;">${lines.join("")}</ul>
      </div>`,
      rolls, sound: null
    });
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

/** Открыть окно из макроса или консоли. */
export function openSessionRewards() {
  return new SessionRewardsApp().render(true);
}
