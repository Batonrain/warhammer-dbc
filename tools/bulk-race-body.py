"""Строит расовый набор масок тела (вкладка ТЕЛО / Хирургикон) поперечным
растяжением базовых human-масок (assets/body/sm/) вокруг опорных точек
плеча/бедра/центра — та же техника, что дала assets/body/astartes/.

Опорные точки (pivot) НЕ двигаются: масштаб только растягивает силуэт от
точки крепления к торсу, поэтому плечи/бёдра остаются на тех же координатах
и не отходят от торса — швов между частями не возникает. Для рук/ног pivot —
это ВНУТРЕННИЙ (ближний к телу) край маски, а не центр: иначе при масштабе
>1 внутренний контур ноги уезжает в сторону паха и может пересечь другую ногу
(поэтому у ног/рук растяжение ВСЕГДА наружу от pivot, не внутрь).

Канва — 1000×1600 (=2× viewBox 500×800). Запястье human-маски уже стоит
почти у самого края канвы (viewBox x≈29 у левой руки) — поэтому plечевой
scaleX для рук физически не может быть намного больше ~1.15-1.17: дальше
кисть уезжает за границу и обрезается (проверено на практике: 1.20 и 1.17
у Скватов/Огринов давали 0px/1px запаса на краю канвы — пересчитаны на
1.12-1.13 с реальным замером после генерации). Массу для очень широких рас
поэтому берём в первую очередь через ТОРС и НОГИ, где запаса по канве больше.

add_protrusion() дорисовывает поверх маски тонкую (тот же ~3px на канве, что
и у исходной линии) V-образную накладку — уши Эльдари/Друкхари, рога
Зверолюдов, хвост, разрез копыта. РГБ линии — сплошной белый (как в исходных
масках, см. пиксельный замер в сессии), альфа — сама форма.

ВАЖНО про пост-хуки на растянутых частях (напр. hoof-split на ногах
Зверолюдов): хук получает картинку УЖЕ ПОСЛЕ аффинного растяжения. Если
координата накладки взята из замера ИСХОДНОЙ маски, её надо сначала
пересчитать через ту же формулу пивота: x_out = pivot + sx*(x_in-pivot).
Иначе накладка попадёт не туда (наступил на эти грабли с копытами один раз).

Проверка результата — не глазами (маски почти невидимы при простом просмотре,
это тонкие линии на канве 1000×1600), а через bbox-скрипт в браузере
(getImageData, alpha>20) — см. как это делалось в сессии.

Запуск: python tools/bulk-race-body.py <raceKey>
Добавить новую расу — дописать словарь в RACES (и, если нужно, POST_HOOKS)
ниже и прогнать заново.
"""

import os
import sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "body", "sm")
COPY_AS_IS = ["heart.png", "lungs.png", "brain.png"]

# pivot в единицах viewBox (0..500 x 0..800) — как в body-map.mjs.
# Найдены один раз через bbox-замер текущих sm/-масок:
#   body:  x185-315 y150-378 (центр 250,264)
#   head:  x214-286 y50-152  (центр 250,101)
#   arm:   плечевой (внутренний) угол ~(195,160) / (305,160)
#   leg:   бедренный (внутренний) край ~(246,329) / (253,329)
RACES = {
    # Астартес — шире и массивнее человека, тот же рост/поза.
    "astartes": [
        ("body.png",      1.45, 1.00, 250, 264),
        ("head.png",      1.15, 1.15, 250, 101),
        ("left-arm.png",  1.15, 1.00, 195, 160),
        ("right-arm.png", 1.15, 1.00, 305, 160),
        ("left-leg.png",  1.30, 1.00, 246, 329),
        ("right-leg.png", 1.30, 1.00, 253, 329),
    ],
    # Эльдари/Друкхари/Юннари/Полу-Эльдари/Арлекины/Экзодиты — общий силуэт
    # (module/constants/races.mjs: AELDARI_RACES): стройнее и выше человека,
    # руки/ноги длиннее (scaleY>1 от плеча/бедра вниз), плюс заострённые уши.
    "aeldari": [
        ("body.png",      0.82, 1.00, 250, 264),
        ("head.png",      0.95, 1.02, 250, 101),
        ("left-arm.png",  0.85, 1.15, 195, 160),
        ("right-arm.png", 0.85, 1.15, 305, 160),
        ("left-leg.png",  0.85, 1.12, 246, 329),
        ("right-leg.png", 0.85, 1.12, 253, 329),
    ],
    # Скваты — низкие и коренастые: сильно укороченные ноги/руки, широкий торс.
    "squat": [
        ("body.png",      1.25, 0.92, 250, 264),
        ("head.png",      1.10, 1.05, 250, 101),
        ("left-arm.png",  1.13, 0.82, 195, 160),
        ("right-arm.png", 1.13, 0.82, 305, 160),
        ("left-leg.png",  1.25, 0.72, 246, 329),
        ("right-leg.png", 1.25, 0.72, 253, 329),
    ],
    # Огрины — гора мышц: торс/ноги как можно шире (запас канвы больше), руки
    # у потолка ~1.12 (см. заметку про запястье у края канвы), голова НЕ
    # растёт пропорционально телу — маленькая голова на огромной туше.
    "ogryn": [
        ("body.png",      1.65, 1.08, 250, 264),
        ("head.png",      1.05, 1.05, 250, 101),
        ("left-arm.png",  1.12, 1.05, 195, 160),
        ("right-arm.png", 1.12, 1.05, 305, 160),
        ("left-leg.png",  1.45, 1.05, 246, 329),
        ("right-leg.png", 1.45, 1.05, 253, 329),
    ],
    # Зверолюды — умеренно плотнее человека + рога/хвост/раздвоенное копыто
    # (см. POST_HOOKS).
    "beastman": [
        ("body.png",      1.18, 1.02, 250, 264),
        ("head.png",      1.08, 1.02, 250, 101),
        ("left-arm.png",  1.12, 1.00, 195, 160),
        ("right-arm.png", 1.12, 1.00, 305, 160),
        ("left-leg.png",  1.15, 1.00, 246, 329),
        ("right-leg.png", 1.15, 1.00, 253, 329),
    ],
    # Голиафы = Репликанты (module/constants/races.mjs: race key "replicant",
    # генно-модифицированные рабы-качки на сыворотках — Size+1, S.b/T.b +4,
    # "Bulging Biceps"). Плотнее человека, но не так экстремально, как Огрин;
    # рост/длина конечностей человеческие, вся масса — в ширину.
    "goliath": [
        ("body.png",      1.38, 1.03, 250, 264),
        ("head.png",      1.08, 1.05, 250, 101),
        ("left-arm.png",  1.12, 1.00, 195, 160),
        ("right-arm.png", 1.12, 1.00, 305, 160),
        ("left-leg.png",  1.30, 1.00, 246, 329),
        ("right-leg.png", 1.30, 1.00, 253, 329),
    ],
}


def _draw_prong(draw, base, tip, width_vb=7):
    """Тонкая V-образная накладка (native px, canvas = 2x viewBox)."""
    bx, by = base[0] * 2, base[1] * 2
    tx, ty = tip[0] * 2, tip[1] * 2
    w = width_vb * 2
    dx, dy = tx - bx, ty - by
    length = max(1.0, (dx * dx + dy * dy) ** 0.5)
    nx, ny = -dy / length * (w / 2), dx / length * (w / 2)
    b1 = (bx + nx, by + ny)
    b2 = (bx - nx, by - ny)
    for a, b in ((b1, (tx, ty)), (b2, (tx, ty))):
        draw.line([a, b], fill=(255, 255, 255, 255), width=3)


def _add_ears(img):
    """Эльдари/Друкхари — небольшие заострённые уши по бокам головы."""
    d = ImageDraw.Draw(img)
    _draw_prong(d, (216, 80), (196, 64), width_vb=6)
    _draw_prong(d, (284, 80), (304, 64), width_vb=6)
    return img


def _add_horns(img):
    """Зверолюды — изогнутые рога от верха головы (грубая ломаная-дуга)."""
    d = ImageDraw.Draw(img)
    for side in (-1, 1):
        base = (250 + side * 16, 56)
        mid  = (250 + side * 30, 28)
        tip  = (250 + side * 20, 8)
        _draw_prong(d, base, mid, width_vb=8)
        _draw_prong(d, mid, tip, width_vb=5)
    return img


def _add_tail(img):
    """Зверолюды — хвост от крестца, свисающий за левое бедро, с кисточкой."""
    d = ImageDraw.Draw(img)
    base, mid, tip = (250, 372), (272, 400), (262, 432)
    _draw_prong(d, base, mid, width_vb=9)
    _draw_prong(d, mid, tip, width_vb=6)
    _draw_prong(d, tip, (250, 442), width_vb=3)
    _draw_prong(d, tip, (272, 444), width_vb=3)
    return img


def _hoof_split(cx):
    """Зверолюды — раздвоенное копыто: рассечение в широкой части стопы,
    не трогая сам контур (его форма и так тонкая рисованная линия)."""
    def hook(img):
        d = ImageDraw.Draw(img)
        _draw_prong(d, (cx, 700), (cx, 718), width_vb=3)
        return img
    return hook


POST_HOOKS = {
    "aeldari":  {"head.png": _add_ears},
    "beastman": {
        "head.png": _add_horns,
        "body.png": _add_tail,
        # Центр стопы измерен на ИСХОДНОЙ (нерастянутой) маске (151/349), но
        # хук получает картинку УЖЕ после аффинного растяжения по pivot=246/253,
        # sx=1.15 — пересчитано: 246+1.15*(151-246)=136.75, 253+1.15*(349-253)=363.4.
        "left-leg.png":  _hoof_split(137),
        "right-leg.png": _hoof_split(363),
    },
}


def build(race):
    if race not in RACES:
        raise SystemExit(f"Нет конфига для расы {race!r}. Известные: {', '.join(RACES)}")
    dst = os.path.join(ROOT, "assets", "body", race)
    os.makedirs(dst, exist_ok=True)
    hooks = POST_HOOKS.get(race, {})
    for name, sx, sy, pvx, pvy in RACES[race]:
        img = Image.open(os.path.join(SRC, name)).convert("RGBA")
        w, h = img.size
        px, py = pvx * 2, pvy * 2   # viewBox -> canvas px (canvas 2x viewBox)
        a, c = 1.0 / sx, px * (1 - 1.0 / sx)
        e, f = 1.0 / sy, py * (1 - 1.0 / sy)
        out = img.transform((w, h), Image.AFFINE, (a, 0, c, 0, e, f), resample=Image.BICUBIC)
        if name in hooks:
            out = hooks[name](out)
        out.save(os.path.join(dst, name))
        print(f"{name}: sx={sx} sy={sy} pivot=({px},{py}) -> {dst}")
    for name in COPY_AS_IS:
        p = os.path.join(SRC, name)
        if os.path.exists(p):
            Image.open(p).convert("RGBA").save(os.path.join(dst, name))
            print(f"{name}: copied as-is")
    print("done")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Использование: python tools/bulk-race-body.py <raceKey>")
    build(sys.argv[1])
