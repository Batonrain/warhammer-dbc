// module/apps/elite-buy.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Покупка Элитного архетипа — так же, как покупка Таланта: за опыт, с
//  проверкой требований и записью в журнал.
//
//  Цена берётся у самого архетипа и удваивается за каждый уже взятый: ×2 за
//  второй, ×4 за третий (rules/elite-requirements.mjs). Уплаченное пишется на
//  сам предмет (system.paidCost), а лист складывает его по предметам — так
//  снятый с листа архетип возвращает опыт сам, как это делают Таланты.
//
//  Требования проверяются перед покупкой. Основные («кто ты есть») до этого
//  места не доходят — архетип с ними не попадает в список вовсе. Прочие
//  спрашиваются: ГМ вправе разрешить исключение, поэтому окно предлагает
//  «Добавить» и «Отменить», а не запрещает.
// ════════════════════════════════════════════════════════════════════════════

import { checkEliteRequirements, eliteWho, eliteTakenCount, eliteCost, eliteCostNote }
  from "../rules/elite-requirements.mjs";
import { esc } from "../helpers/utils.mjs";

/** Цена архетипа именно для этого персонажа, с множителем за уже взятые. */
export function eliteCostFor(actor, doc) {
  const taken = eliteTakenCount(actor);
  return { cost: eliteCost(doc?.system?.cost, taken), taken, note: eliteCostNote(taken) };
}

/**
 * Спросить, брать ли архетип с невыполненными требованиями. Возвращает true,
 * если решили брать.
 */
function confirmUnmet(doc, check) {
  const list = [...check.secondaryUnmet, ...check.talentsUnmet];
  return new Promise(resolve => {
    new Dialog({
      title: `${doc.name}: требования не выполнены`,
      content: `<form class="wh-elite-warn">
        <p>Персонаж не отвечает требованиям Элитного архетипа:</p>
        <ul class="elite-warn-list">${list.map(t => `<li>${esc(t)}</li>`).join("")}</ul>
        ${check.manual.length
          ? `<p class="elite-warn-manual">Проверяется ГМом: ${check.manual.map(esc).join("; ")}</p>` : ""}
        <p>Взять всё равно?</p>
      </form>`,
      buttons: {
        add:    { label: "Добавить", callback: () => resolve(true) },
        cancel: { label: "Отменить", callback: () => resolve(false) }
      },
      default: "cancel",
      close: () => resolve(false)
    }, { classes: ["dialog", "warhammer-dbc", "wh-holo"], width: 460 }).render(true);
  });
}

/**
 * Взять Элитный архетип: проверить требования, списать опыт, положить предмет
 * на лист и записать трату в журнал опыта.
 *
 * @returns {Promise<Item|null>} созданный предмет либо null, если отменили
 */
export async function buyEliteArchetype(actor, doc) {
  if (!actor || !doc) return null;

  const check = checkEliteRequirements(doc.system?.requirements, eliteWho(actor));
  if (check.warn && !(await confirmUnmet(doc, check))) return null;

  const { cost, note } = eliteCostFor(actor, doc);
  const s = actor.system ?? {};
  const exp = s.experience ?? {};
  const current = Number(exp.current) || 0;

  // Опыта не хватает — тоже вопрос, а не запрет: за столом бывает «в долг».
  if (cost > current) {
    const ok = await Dialog.confirm({
      title: `${doc.name}: не хватает опыта`,
      content: `<p>Нужно <b>${cost}</b>${note ? ` (${esc(note)})` : ""}, свободно <b>${current}</b>. Взять всё равно?</p>`
    });
    if (!ok) return null;
  }

  const data = doc.toObject();
  delete data._id;
  data.system = data.system || {};
  data.system.paidCost = cost;

  const [item] = await actor.createEmbeddedDocuments("Item", [data]);

  // Имя дублируется в шапку листа: по строкам смотрят и доступ к папкам
  // Талантов элитного архетипа, и Гемункул, и перевод в Орду. Первый архетип
  // идёт в основное поле, следующие — в дополнительные.
  const upd = {};
  if (!String(s.eliteArchetype || "").trim()) upd["system.eliteArchetype"] = doc.name;
  else {
    const extra = [...(actor.system?.eliteArchetypesExtra || [])];
    if (!extra.includes(doc.name)) { extra.push(doc.name); upd["system.eliteArchetypesExtra"] = extra; }
  }

  if (cost) {
    const log = Array.isArray(exp.log) ? foundry.utils.deepClone(exp.log) : [];
    log.push({ at: Date.now(), amount: -cost, kind: "spend",
               reason: `Элитный архетип «${doc.name}»${note ? ` (${note})` : ""}` });
    upd["system.experience.log"] = log;
  }
  if (Object.keys(upd).length) await actor.update(upd);

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p><b>Элитный архетип:</b> ${esc(doc.name)}${cost ? ` — потрачено <b>${cost}</b> опыта${note ? ` (${esc(note)})` : ""}` : ""}.</p>`
  });

  return item;
}

// Снятый архетип обязан уйти и из шапки: опыт вернётся сам (лист складывает
// paidCost по предметам), а вот имя осталось бы висеть строкой и держать
// открытыми папки Талантов этого архетипа.
// Хук срабатывает у всех, кто в игре, — чистит тот, кто удалял: у него на
// актора точно есть права, а лишних одновременных правок не будет.
Hooks.on("deleteItem", async (item, _opts, userId) => {
  const actor = item?.parent;
  if (item?.type !== "eliteArchetype" || !actor?.system || userId !== game.user?.id) return;
  const upd = {};
  if (actor.system.eliteArchetype === item.name) upd["system.eliteArchetype"] = "";
  const extra = actor.system.eliteArchetypesExtra || [];
  if (extra.includes(item.name)) upd["system.eliteArchetypesExtra"] = extra.filter(n => n !== item.name);
  if (Object.keys(upd).length) await actor.update(upd);
});
