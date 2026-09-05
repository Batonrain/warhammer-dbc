// test/combat/defense-compression.test.mjs
//
// Сжатие (мутация Compression, wdbc-1rno): реактивная альтернатива
// Уклонению — без броска, тратит Реакцию, нивелирует ОДНО попадание в
// конечность/голову, помнит втянутые части на акторе, «Разложить»
// возвращает часть обратно (module/combat/defense.mjs, module/rules/
// compression.mjs). Тот же тестовый харнесс, что test/combat/defense.test.mjs.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor } from "../support/combat-fixtures.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";
import { _performCompression, _performExtendBodyPart, COMPRESSION_CAPABILITY } from "../../module/combat/defense.mjs";

const DEFAULT_SOURCES = getRuleSources();

/** Актор с getFlag/update — flags.warhammer-dbc.compressedParts хранится флагом. */
function attacker(overrides = {}) {
  const a = actorFor(overrides);
  const flags = { "warhammer-dbc": {} };
  a.getFlag = (scope, key) => flags[scope]?.[key];
  a.update = async (data) => {
    for (const [path, value] of Object.entries(data)) {
      const m = path.match(/^flags\.([^.]+)\.(.+)$/);
      if (m) { flags[m[1]] ??= {}; flags[m[1]][m[2]] = value; }
    }
  };
  return a;
}

function grantCompression() {
  registerRuleSource("test", () => [{ id: "a", label: "Тест",
    effects: [{ kind: "grantFlag", target: COMPRESSION_CAPABILITY }] }]);
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.combat = undefined;
});
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
});

describe("_performCompression", () => {
  it("без мутации — отказ, ничего не меняется", async () => {
    const actor = attacker();
    await _performCompression(actor, "Голова", "Actor.attacker-1");
    const card = captured.chat.at(-1).content;
    expect(card).toContain("нет мутации «Сжатие»");
    expect(actor.getFlag("warhammer-dbc", "compressedParts")).toBeUndefined();
  });

  it("с мутацией — втягивает часть, нивелирует попадание, метит флаг", async () => {
    grantCompression();
    const actor = attacker();
    await _performCompression(actor, "П. Рука", "Actor.attacker-1");
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Втягивает П. Рука в торс");
    expect(card).toContain("попадание нивелировано");
    expect(actor.getFlag("warhammer-dbc", "compressedParts")).toEqual(["П. Рука"]);
  });

  it("Голова — заметка о слепоте (но не глухоте)", async () => {
    grantCompression();
    const actor = attacker();
    await _performCompression(actor, "Голова");
    expect(captured.chat.at(-1).content).toContain("лишается зрения (но не слуха)");
  });

  it("Нога — заметка о сниженной мобильности", async () => {
    grantCompression();
    const actor = attacker();
    await _performCompression(actor, "П. Нога");
    expect(captured.chat.at(-1).content).toContain("мобильность снижена");
  });

  it("Рука — заметка о выпуске оружия/инструмента", async () => {
    grantCompression();
    const actor = attacker();
    await _performCompression(actor, "Л. Рука");
    expect(captured.chat.at(-1).content).toContain("пришлось выпустить");
  });

  it("все 4 конечности втянуты — заметка про мелкие пространства", async () => {
    grantCompression();
    const actor = attacker();
    await _performCompression(actor, "П. Рука");
    await _performCompression(actor, "Л. Рука");
    await _performCompression(actor, "П. Нога");
    const card = await (async () => {
      await _performCompression(actor, "Л. Нога");
      return captured.chat.at(-1).content;
    })();
    expect(card).toContain("слишком малые для обычных людей");
  });

  it("повторное Сжатие ТОЙ ЖЕ части не дублирует её во флаге", async () => {
    grantCompression();
    const actor = attacker();
    await _performCompression(actor, "Голова");
    await _performCompression(actor, "Голова");
    expect(actor.getFlag("warhammer-dbc", "compressedParts")).toEqual(["Голова"]);
  });

  it("карточка несёт data-actor-uuid и кнопку «Разложить» на только что втянутую часть", async () => {
    grantCompression();
    const actor = attacker();
    // Подставному актору uuid нужен явно: раньше тест проходил и без него,
    // потому что карточка писала в атрибут буквальное «undefined». Общий
    // сборщик (helpers/test-card.mjs) такой атрибут не рисует вовсе — и
    // проверять теперь есть что: доезжает ли НАСТОЯЩИЙ uuid.
    actor.uuid = "Actor.compression-1";
    await _performCompression(actor, "Голова", "Actor.attacker-1");
    const card = captured.chat.at(-1).content;
    expect(card).toContain('data-actor-uuid="Actor.compression-1"');
    expect(card).toContain("wh-extend-btn");
    expect(card).toContain('data-location="Голова"');
  });
});

describe("_performExtendBodyPart", () => {
  it("разлагает втянутую часть — снимает её с флага, постит карточку", async () => {
    grantCompression();
    const actor = attacker();
    await _performCompression(actor, "Голова");
    await _performExtendBodyPart(actor, "Голова");
    expect(actor.getFlag("warhammer-dbc", "compressedParts")).toEqual([]);
    expect(captured.chat.at(-1).content).toContain("Раскладывает Голова обратно");
  });

  it("часть не была втянута — no-op, новой карточки нет", async () => {
    const actor = attacker();
    const before = captured.chat.length;
    await _performExtendBodyPart(actor, "Голова");
    expect(captured.chat.length).toBe(before);
  });

  it("несколько втянутых частей — разложение одной не трогает остальные", async () => {
    grantCompression();
    const actor = attacker();
    await _performCompression(actor, "Голова");
    await _performCompression(actor, "П. Рука");
    await _performExtendBodyPart(actor, "Голова");
    expect(actor.getFlag("warhammer-dbc", "compressedParts")).toEqual(["П. Рука"]);
  });
});
