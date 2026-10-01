// module/combat/fall-damage.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Кнопка «Применить урон падения» (wdbc-eyd1l). Книга (стр. 30): «Урон от
//  падения игнорирует броню, но может быть поглощён тестом на Группирование»,
//  Стойкость поглощает как обычно (решение владельца 01.10.2026), подвид —
//  обычный I без (Cr): Пустые Кости Гарпии на падение не действуют.
//  Кнопку подхватывает общий обработчик .wh-apply-dmg-btn в hooks.mjs;
//  data-ignore-armour="1" превращается в damageData.ignoreArmour.
// ════════════════════════════════════════════════════════════════════════════

/** Секция чат-карточки с кнопкой урона падения. */
export function fallDamageSectionHtml(total, weaponName = "Падение") {
  return `
    <div class="roll-damage-section">
      <div class="roll-damage-label">Урон падения — броню игнорирует, Стойкость поглощает</div>
      <button class="wh-apply-dmg-btn" type="button"
        data-damage="${total}" data-penetration="0" data-damage-type="impact"
        data-ignore-armour="1"
        data-hit-location="Торс" data-weapon-name="${weaponName}" data-attacker="—"
        data-felling="0" data-primitive="0" data-ignore-shield="0" data-warp-soak="0">
        Применить урон падения: <b>${total}</b>
      </button>
    </div>`;
}
