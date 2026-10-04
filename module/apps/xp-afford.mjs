// module/apps/xp-afford.mjs
// Вопрос «Взять всё равно?» при нехватке опыта — для Характеристик, Навыков и
// Талантов. Правило и текст — rules/xp-shortfall.mjs; Элитные Архетипы и
// Психосилы спрашивают тем же по смыслу окном у себя (apps/elite-buy.mjs).
import { xpShortfall, shortfallMessage } from "../rules/xp-shortfall.mjs";

/**
 * Можно ли списать `cost` опыта у актора. Молча «да», если опыта хватает;
 * иначе окно, и ответ — выбор игрока/ГМ.
 *
 * @param {Actor}  actor
 * @param {number} cost  прирост цены (не полная цена уровня)
 * @param {string} what  что покупается — для заголовка окна
 * @returns {Promise<boolean>}
 */
export async function confirmXpSpend(actor, cost, what) {
  // Нет счёта опыта (Орда, техника) — тратить нечего, спрашивать не о чем.
  if (!actor?.system?.experience) return true;
  const short = xpShortfall(actor?.system?.experience?.current, cost);
  if (!short) return true;
  const ok = await foundry.applications.api.DialogV2.confirm({
    window: { title: `${what}: не хватает опыта` },
    content: `<p>${shortfallMessage(short)}</p>`,
    // Подписи заданы явно: без них кнопки берут язык ядра, а в мире он en.
    yes: { label: "Да" },
    no: { label: "Нет", default: true },
    rejectClose: false
  });
  return ok === true;
}
