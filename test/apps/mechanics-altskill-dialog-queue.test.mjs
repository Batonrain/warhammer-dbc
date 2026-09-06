// test/apps/mechanics-altskill-dialog-queue.test.mjs
//
// Живая находка (побочная, при wdbc-2e9t): архетип Пират выдаёт «Общие
// знания»/«Ремесло» ДВАЖДЫ каждый (разные Специализации). Когда настройка ГМа
// «Повтор Навыка из разных источников» стоит на «Выбор альтернативного»
// (skillDuplicatePolicy:"altSkill") и Групповой Навык совпадает с уже
// имеющимся, applyMechEntry (module/apps/mechanics.mjs) открывает диалог
// «Дубль Навыка» (showAltSkillDialog). Разные ИСТОЧНИКИ (напр. Раса и
// Архетип — см. test/apps/mechanics-concurrent.test.mjs, «очередь у разных
// предметов независима») применяются НЕ сериализованно друг с другом —
// если несколько таких дублей обнаруживаются близко по времени, каждый
// источник открывает СВОЙ Dialog не глядя на остальные: живьём это дало 4
// окна стопкой одновременно.
//
// Фикс — общая очередь показов (_altSkillDialogQueue в mechanics.mjs): не
// устраняет саму гонку определения «дубль ли это» (для этого нужна была бы
// более рискованная сериализация между РАЗНЫМИ предметами), но гарантирует,
// что сами попапы открываются по одному — следующий только после ответа на
// предыдущий.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { applyItemMechanics } from "../../module/apps/mechanics.mjs";

async function flush() {
  await new Promise(r => setTimeout(r, 0));
  await new Promise(r => setTimeout(r, 0));
  await new Promise(r => setTimeout(r, 0));
}

const FLAG = "warhammer-dbc";

const andGroup = (...entries) => ({ id: "g1", operator: "AND", entries });
const groupSkillEntry = id => ({
  id, kind: "skill", skillScope: "group", skillKey: "commonLore",
  specKey: "tech", specialty: "Tech", rank: "knows"
});

/** Предмет-источник (Раса/Архетип), выдающий один Групповой Навык. */
function itemOnActor(actor, { mechanics, uuid }) {
  const own = { mechanics };
  return {
    id: uuid, uuid, type: "trait", name: "Источник", img: "icons/svg/aura.svg",
    system: {}, parent: actor, effects: [],
    getFlag: (_s, k) => own[k],
    setFlag: async (_s, k, v) => { own[k] = v; return v; },
    unsetFlag: async (_s, k) => { delete own[k]; },
    update: async () => own,
    createEmbeddedDocuments: async (_t, docs) => docs,
    deleteEmbeddedDocuments: async (_t, ids) => ids
  };
}

/** Dialog-стаб: конструктор ТОЛЬКО запоминает конфиг, ничего не рендерит и не
 *  резолвит сам — тест сам «нажимает» кнопку через config.buttons.*.callback,
 *  так виден момент, когда именно конструируется КАЖДЫЙ следующий диалог. */
class RecordingDialog {
  constructor(config) { this.config = config; RecordingDialog.instances.push(this); }
  render() { return this; }
}
RecordingDialog.instances = [];

const RealDialog = globalThis.Dialog;
const realSettingsGet = globalThis.game.settings.get;

beforeEach(() => {
  RecordingDialog.instances = [];
  globalThis.Dialog = RecordingDialog;
  globalThis.game.settings.get = (scope, key) =>
    (scope === FLAG && key === "skillDuplicatePolicy") ? "altSkill" : undefined;
});

afterEach(() => {
  globalThis.Dialog = RealDialog;
  globalThis.game.settings.get = realSettingsGet;
});

function actorWithExistingCommonLoreTech() {
  const actor = new Actor();
  actor.system = { groupSkills: { commonLore: [{ specialty: "Tech", specKey: "tech", rank: "knows", grantedRank: "knows", cost: 0 }] } };
  actor.update = async data => {
    for (const [path, value] of Object.entries(data)) {
      if (path === "system.groupSkills.commonLore") actor.system.groupSkills.commonLore = value;
    }
  };
  actor.createEmbeddedDocuments = async (_t, docs) => docs;
  return actor;
}

describe("showAltSkillDialog: несколько источников не открывают попапы разом", () => {
  it("второй Dialog не конструируется, пока не отвечен первый", async () => {
    const actor = actorWithExistingCommonLoreTech();
    const itemA = itemOnActor(actor, { mechanics: [andGroup(groupSkillEntry("a1"))], uuid: "Actor.a1.Item.RaceA" });
    const itemB = itemOnActor(actor, { mechanics: [andGroup(groupSkillEntry("b1"))], uuid: "Actor.a1.Item.ArchB" });

    // Как в реальном мире (test/apps/mechanics-concurrent.test.mjs): разные
    // предметы применяются НЕ дожидаясь друг друга.
    const combined = Promise.all([applyItemMechanics(itemA), applyItemMechanics(itemB)]);
    await flush();

    // Оба источника независимо обнаружили дубль (существующая запись Tech,
    // ранг совпадает — skillGrantOutcome даёт duplicate:true у обоих), но
    // ВТОРОЙ Dialog ещё не должен быть сконструирован — только один за раз.
    expect(RecordingDialog.instances.length).toBe(1);

    // «Компенсировать опытом» — самый простой ответ, resolve(null).
    RecordingDialog.instances[0].config.buttons.refund.callback();
    await flush();

    // Теперь второй Dialog сконструирован — очередь пропустила следующего.
    expect(RecordingDialog.instances.length).toBe(2);

    RecordingDialog.instances[1].config.buttons.refund.callback();
    await combined;
  });

  it("без дубля (разная Специализация) Dialog не открывается вовсе", async () => {
    const actor = actorWithExistingCommonLoreTech();
    const item = itemOnActor(actor, {
      mechanics: [andGroup({ id: "c1", kind: "skill", skillScope: "group", skillKey: "commonLore", specKey: "imperialFleet", specialty: "Imperial Fleet", rank: "knows" })],
      uuid: "Actor.a1.Item.ArchC"
    });

    await applyItemMechanics(item);

    expect(RecordingDialog.instances.length).toBe(0);
    expect(actor.system.groupSkills.commonLore).toHaveLength(2);
  });
});
