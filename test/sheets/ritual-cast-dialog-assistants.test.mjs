// test/sheets/ritual-cast-dialog-assistants.test.mjs
//
// Sahara fallbacks-instructor: раздел «Ассистенты» диалога «Провести ритуал» —
// список акторов (дроп), роли, жертва, бейдж годности, галочка Инструктора.
// Тот же приём, что в ritual-cast-dialog.test.mjs: DialogV2.wait запоминается
// заглушкой, кнопка жмётся через captured.press, а живая часть (render) —
// через captured.rerender с подставными узлами, которые записывают слушателей.

import { beforeEach, describe, it, expect } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";

const { showRitualCastDialog, assistantRowsHtml } = await import("../../module/sheets/ritual-cast-dialog.mjs");

beforeEach(() => { resetCaptured(); globalThis.game.user = {}; globalThis.fromUuid = async () => null; });

const talent = name => ({ type: "talent", name, system: {} });
const FALLBACKS = "Fallbacks / Запасные Планы";
const INSTRUCTOR = "Instructor / Инструктор";

const ritualist = (items = []) => ({
  id: "boss", uuid: "Actor.boss", name: "Каэль Ворн", type: "character", items,
  system: { characteristics: { int: { total: 40, bonus: 4 } }, skills: {}, groupSkills: {} }
});
const helper = (id, rank) => ({
  id, uuid: `Actor.${id}`, name: `Помощник-${id}`, type: "character",
  system: { skills: rank ? { medicae: { rank } } : {}, groupSkills: {}, characteristics: {} }
});
const medicaeReq = rank => [{
  id: "g", operator: "AND",
  entries: [{ id: "e", kind: "reqSkill", skillScope: "plain", skillKey: "medicae", specKey: "", specialty: "", rank }]
}];
const item = (assistReq = medicaeReq("trained"), sys = {}) => ({
  id: "r1", name: "Зов Малефика",
  system: {
    testSkillScope: "", testSkillKey: "", testChar: "int", testMod: -10,
    aversionPerFail: 5, assistMin: 1, assistMax: 4, failureType: "summon", ...sys
  },
  getFlag: (_s, k) => (k === "assistReq" ? assistReq : undefined)
});

/** Подставной узел: пишет слушателей, хранит текст/разметку. */
const node = () => {
  const n = { handlers: {}, textContent: "", innerHTML: "", checked: false, value: "",
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(type, fn) { n.handlers[type] = fn; } };
  return n;
};

/** Открыть диалог, довести render до живого состояния; вернуть узлы. */
function open(actor, rit) {
  const promise = showRitualCastDialog(actor, rit);
  const nodes = {
    "#rit-total-display": node(), "#rit-rows": node(), "#rit-gmmod-display": node(),
    "#rit-assist-drop": node(), "#rit-assist-list": node(), "#rit-assist-count": node(),
    "#rit-instructor": node()
  };
  const form = fakeForm(nodes);
  // Слушатели самой формы — чтобы воспроизвести настоящий порядок событий (см. toggleSac).
  form.handlers = {};
  form.addEventListener = (type, fn) => { form.handlers[type] = fn; };
  captured.rerender(form);
  return { promise, nodes, form };
}

/** Перетащить актора в зону дропа (data — то, что кладёт Foundry в dataTransfer). */
async function drop(nodes, doc) {
  globalThis.fromUuid = async uuid => (uuid === doc.uuid ? doc : null);
  await nodes["#rit-assist-drop"].handlers.drop({
    preventDefault() {},
    dataTransfer: { getData: () => JSON.stringify({ type: "Actor", uuid: doc.uuid }) }
  });
}
const click = (nodes, act, uuid) => nodes["#rit-assist-list"].handlers.click({
  target: { closest: () => ({ dataset: { act, uuid } }) }
});
// Клик по чекбоксу в браузере: input всплывает от узла к списку, затем к форме
// (её update() перерисовывает список), и лишь потом change — уже по оторванному
// поддереву. Тест повторяет этот порядок: на прежнем слушателе "change" жертва терялась.
const toggleSac = (nodes, uuid, checked, form) => {
  nodes["#rit-assist-list"].handlers.input?.({ target: { dataset: { sac: uuid }, checked } });
  form.handlers.input();
};

describe("диалог ритуала: раздел «Ассистенты»", () => {
  it("зона дропа и список видны, когда у ритуала есть ассистенты", () => {
    showRitualCastDialog(ritualist(), item());
    expect(captured.dialog.content).toContain('id="rit-assist-drop"');
    expect(captured.dialog.content).toContain('id="rit-assist-list"');
  });

  it("у ритуала без ассистентов раздела нет", () => {
    showRitualCastDialog(ritualist(), item([], { assistMin: 0, assistMax: 0 }));
    expect(captured.dialog.content).not.toContain('id="rit-assist-drop"');
  });

  it("галочка Инструктора только у носителя Таланта", () => {
    showRitualCastDialog(ritualist(), item());
    expect(captured.dialog.content).not.toContain('id="rit-instructor"');
    showRitualCastDialog(ritualist([talent(INSTRUCTOR)]), item());
    expect(captured.dialog.content).toContain('id="rit-instructor"');
  });

  it("брошенный актор попадает в список, бейдж «годен» и жертва идёт в Порог", async () => {
    const { promise, nodes, form } = open(ritualist(), item());
    await drop(nodes, helper("a", "trained"));
    toggleSac(nodes, "Actor.a", true, form);

    expect(nodes["#rit-assist-list"].innerHTML).toContain("Помощник-a");
    expect(nodes["#rit-assist-list"].innerHTML).toContain("годен");

    captured.dice = [50, 50];
    await captured.press("cast", form);
    await promise;
    expect(captured.chat[0].content).toContain("Жертва ассистентов ×1");
  });

  it("негодный ассистент: причина названа, жертва не засчитана", async () => {
    const { promise, nodes, form } = open(ritualist(), item());
    await drop(nodes, helper("weak", "knows"));
    expect(nodes["#rit-assist-list"].innerHTML).toContain("Тренированное");
    toggleSac(nodes, "Actor.weak", true, form);

    captured.dice = [50, 50];
    await captured.press("cast", form);
    await promise;
    expect(captured.chat[0].content).not.toContain("Жертва ассистентов");
  });

  it("Инструктор: отметка подготовки делает слабого ассистента годным", async () => {
    const { promise, nodes, form } = open(ritualist([talent(INSTRUCTOR)]), item());
    await drop(nodes, helper("weak", "knows"));
    toggleSac(nodes, "Actor.weak", true, form);
    nodes["#rit-instructor"].checked = true;

    captured.dice = [50, 50];
    await captured.press("cast", form);
    await promise;
    expect(captured.chat[0].content).toContain("Жертва ассистентов ×1");
  });

  it("повторный дроп того же актора и самого ритуалиста отклоняется с предупреждением", async () => {
    const { nodes } = open(ritualist(), item());
    await drop(nodes, helper("a", "trained"));
    await drop(nodes, helper("a", "trained"));
    await drop(nodes, ritualist());
    expect(captured.warnings.length).toBe(2);
    expect((nodes["#rit-assist-list"].innerHTML.match(/data-act="remove"/g) || []).length).toBe(1);
  });

  it("запасным без Запасных Планов не сделать — предупреждение, роль прежняя", async () => {
    const { nodes } = open(ritualist(), item());
    await drop(nodes, helper("a", "trained"));
    click(nodes, "reserve", "Actor.a");
    expect(captured.warnings.length).toBe(1);
    expect(nodes["#rit-assist-list"].innerHTML).not.toContain('data-act="primary"');
  });

  it("негодный запасной не заменяет выбывшего: предупреждение, роль прежняя", async () => {
    const { nodes } = open(ritualist([talent(FALLBACKS)]), item());
    await drop(nodes, helper("weak", "knows"));
    click(nodes, "reserve", "Actor.weak");
    expect(captured.warnings.length).toBe(0);
    click(nodes, "primary", "Actor.weak");
    expect(captured.warnings.length).toBe(1);
    expect(captured.warnings[0]).toContain("не проходит требования");
    expect(nodes["#rit-assist-list"].innerHTML).toContain('data-act="primary"'); // всё ещё запасной
  });

  it("с Запасными Планами: запасной не даёт бонуса, замена выбывшего возвращает бонус", async () => {
    const { promise, nodes, form } = open(ritualist([talent(FALLBACKS)]), item());
    await drop(nodes, helper("a", "trained"));
    await drop(nodes, helper("b", "trained"));
    toggleSac(nodes, "Actor.a", true, form);
    toggleSac(nodes, "Actor.b", true, form);
    click(nodes, "reserve", "Actor.b");              // b — запасной
    expect(nodes["#rit-assist-list"].innerHTML).toContain('data-act="primary"');
    click(nodes, "remove", "Actor.a");               // a выбыл
    click(nodes, "primary", "Actor.b");              // b заменил
    toggleSac(nodes, "Actor.b", true, form);

    captured.dice = [50, 50];
    await captured.press("cast", form);
    await promise;
    expect(captured.chat[0].content).toContain("Жертва ассистентов ×1");
  });
});

describe("assistantRowsHtml: разметка строк", () => {
  const row = (over = {}) => ({
    uuid: "Actor.a", name: "Ада", role: "primary", sacrificed: false, ok: true, failed: [], ...over
  });

  it("годный основной: чекбокс жертвы есть, «запасным» — только при Запасных Планах", () => {
    const html = assistantRowsHtml([row()], { fallbacks: false });
    expect(html).toContain('data-sac="Actor.a"');
    expect(html).not.toContain('data-act="reserve"');
    expect(assistantRowsHtml([row()], { fallbacks: true })).toContain('data-act="reserve"');
  });

  it("негодный: причина в тексте, жертвы нет", () => {
    const html = assistantRowsHtml([row({ ok: false, failed: ["Навык: Медика — не ниже «Тренированное»"] })], {});
    expect(html).toContain("не годен");
    expect(html).toContain("Тренированное");
    expect(html).not.toContain("data-sac=");
  });

  it("запасной: без жертвы, «в основные» заблокирована, если негоден", () => {
    const okHtml = assistantRowsHtml([row({ role: "reserve" })], { fallbacks: true });
    expect(okHtml).toContain('data-act="primary"');
    expect(okHtml).not.toContain("data-sac=");
    const badHtml = assistantRowsHtml([row({ role: "reserve", ok: false, failed: ["x"] })], { fallbacks: true });
    expect(badHtml).toMatch(/data-act="primary"[^>]*disabled/);
  });

  it("имя экранируется", () => {
    expect(assistantRowsHtml([row({ name: "<b>x</b>" })], {})).not.toContain("<b>x</b>");
  });
});
