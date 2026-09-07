// test/apps/aptitude-binding-dialog.test.mjs
//
// СТОРОЖ: одну и ту же Склонность нельзя привязать к объекту дважды
// (wdbc-4ltj, хвост ревью PR #379).
//
// Правило живёт в module/apps/aptitude-binding-dialog.mjs и до сих пор ничем не
// было закреплено. Цена ошибки тихая: aptitudeCat считает совпадения по
// множеству, «Ловкость + Ловкость» схлопывается в одну — и объект НАВСЕГДА
// перестаёт быть Дружественным кому бы то ни было, максимум Нейтральным.
// Подпись на листе при этом честно покажет «Ловкость + Ловкость», и заметить
// подвох можно, только заранее зная, что так быть не должно.
//
// Проверяется через настоящее открытие диалога (заглушка DialogV2.wait
// возвращает значение колбэка нажатой кнопки), а не через отдельную чистую
// функцию: сторож стоит именно в разборе результата окна, и тест на выделенном
// предикате пережил бы зелёным его снятие.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { showAptitudeBindingDialog } from "../../module/apps/aptitude-binding-dialog.mjs";

/** Актор ровно той формы, какую трогает диалог и пересчёт цен. */
function fakeActor() {
  const a = {
    system: {
      aptitudes: ["ag", "defence"],
      aptitudeBinding: {},
      characteristics: {},
      skills: {},
      groupSkills: {}
    },
    items: [],
    updates: [],
    async update(patch) { a.updates.push(patch); return a; },
    async updateEmbeddedDocuments() { return []; }
  };
  return a;
}

/** Открыть окно привязки для Навыка «Уклонение» и нажать «Сохранить». */
async function saveWith(actor, first, second) {
  const promise = showAptitudeBindingDialog(actor, "skill", "dodge", "Уклонение", ["ag", "defence"]);
  await captured.press("save", fakeForm({ ".apt-first": first, ".apt-second": second }));
  return promise;
}

describe("диалог привязки Склонностей: две одинаковые не записываются (wdbc-4ltj)", () => {
  beforeEach(() => resetCaptured());

  it("«Ловкость + Ловкость» — записи нет вовсе, актор не тронут", async () => {
    const actor = fakeActor();
    const result = await saveWith(actor, "ag", "ag");

    expect(result).toBeNull();
    expect(actor.updates).toEqual([]);
  });

  it("…и игроку сказано, почему — иначе кнопка выглядит сломанной", async () => {
    const actor = fakeActor();
    await saveWith(actor, "ag", "ag");

    expect(captured.warnings.join(" ")).toContain("одинаковые");
  });

  it("две РАЗНЫЕ пишутся как обычно — регресс, сторож не запирает нормальный выбор", async () => {
    const actor = fakeActor();
    const result = await saveWith(actor, "int", "knowledge");

    expect(result).toEqual({ "system.aptitudeBinding.skill.dodge": ["int", "knowledge"] });
    expect(actor.updates.at(0)).toEqual({ "system.aptitudeBinding.skill.dodge": ["int", "knowledge"] });
    expect(captured.warnings).toEqual([]);
  });

  it("«Вернуть как в книге» сторож не задевает — там значений из списков нет", async () => {
    const actor = fakeActor();
    actor.system.aptitudeBinding = { skill: { dodge: ["ag", "ag"] } };
    const promise = showAptitudeBindingDialog(actor, "skill", "dodge", "Уклонение", ["ag", "defence"]);
    await captured.press("book", fakeForm({}));
    await promise;

    // Снятие записи, а не копия книжных значений (правка книги должна доезжать).
    expect(actor.updates.at(0)).toEqual({ "system.aptitudeBinding.skill.-=dodge": null });
    expect(captured.warnings).toEqual([]);
  });
});
