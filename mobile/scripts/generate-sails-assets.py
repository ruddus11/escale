"""새 돛 로고(2026-11-12)에서 앱 아이콘, 스플래시, 환영 사진을 만든다.

원본
- assets/brand/margin-sails.svg: 로고 이미지에서 따 낸 돛 세 개 경로(흰색).
- assets/brand/welcome-sea-source.jpg: 환영 화면 바다 사진 원본(컬러).
- assets/brand/logo-sails-source.jpg: 받은 로고 이미지. 색과 질감의 기준으로만 둔다.

로고처럼 먹청록과 산호 두 색으로 인쇄한 느낌(2도 망점)을 낸다. 외부 서비스로 보내지 않고 이 기기에서만 만든다.
실행: python3 mobile/scripts/generate-sails-assets.py  (Pillow, rsvg-convert 필요)
환영 사진까지 다시 만들려면 --photo를 붙인다.
"""

import math
import random
import re
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageOps

ASSETS = Path(__file__).resolve().parent.parent / "assets"
BRAND = ASSETS / "brand"

# 로고 사진에서 뽑은 색. 어두운 먹청록 → 중간 청록 → 산호 → 노을 분홍.
DEEP = (16, 58, 69)
MID = (45, 89, 102)
CORAL = (202, 116, 119)
BLUSH = (248, 232, 230)
STOPS = [(0.0, DEEP), (0.38, MID), (0.62, CORAL), (1.0, BLUSH)]

svg = (BRAND / "margin-sails.svg").read_text()
SAILS = re.search(r' d="([^"]+)"', svg).group(1)
VW, VH = (float(v) for v in re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg).groups())


def gradient(t: float) -> tuple[int, int, int]:
    for (t0, a), (t1, b) in zip(STOPS, STOPS[1:]):
        if t <= t1:
            u = (t - t0) / (t1 - t0)
            return tuple(round(a[k] + (b[k] - a[k]) * u) for k in range(3))
    return STOPS[-1][1]


LUT = [gradient(i / 255) for i in range(256)]


def duotone(gray: Image.Image) -> Image.Image:
    return Image.merge("RGB", [gray.point([c[k] for c in LUT]) for k in range(3)])


def screen(pitch: float, angle: float = 22):
    """인쇄 망점 무늬. -1~1을 돌려준다."""
    ca, sa = math.cos(math.radians(angle)), math.sin(math.radians(angle))
    return lambda x, y: math.cos(2 * math.pi * (x * ca + y * sa) / pitch) * math.cos(2 * math.pi * (-x * sa + y * ca) / pitch)


def riso(img: Image.Image, pitch: float = 5, amount: float = 60, grain: float = 9) -> Image.Image:
    gray = ImageOps.autocontrast(img.convert("L"), cutoff=1)
    dots = screen(pitch)
    src, out = gray.load(), Image.new("L", gray.size)
    dst = out.load()
    random.seed(3)
    for y in range(gray.size[1]):
        for x in range(gray.size[0]):
            dst[x, y] = max(0, min(255, int(src[x, y] + dots(x, y) * amount + random.gauss(0, grain))))
    return duotone(out)


def sails_png(size: int, scale: float, offset_y: float = 0, fill: str = "#FFFFFF", line: str | None = None) -> Image.Image:
    """돛 세 개. line을 주면 돛 아래에 수평선 한 줄을 긋는다."""
    w, h = VW * scale, VH * scale
    x, y = (size - w) / 2, (size - h) / 2 + offset_y
    rule = ""
    if line:
        lw, lh = w * 0.9, max(2.0, size * 0.018)
        rule = f'<rect x="{(size - lw) / 2:.1f}" y="{y + h + size * 0.05:.1f}" width="{lw:.1f}" height="{lh:.1f}" fill="{line}"/>'
    doc = f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}"><g transform="translate({x:.1f} {y:.1f}) scale({scale})"><path d="{SAILS}" fill="{fill}"/></g>{rule}</svg>'
    with tempfile.TemporaryDirectory() as tmp:
        src, png = Path(tmp) / "s.svg", Path(tmp) / "s.png"
        src.write_text(doc)
        subprocess.run(["rsvg-convert", str(src), "-o", str(png)], check=True)
        return Image.open(png).convert("RGBA").copy()


WHITE = (255, 255, 255)
TEAL_HEX, CORAL_HEX = "#103A45", "#EE9A8F"


def white_icon(size: int = 1024) -> Image.Image:
    """흰 바탕에 먹청록 돛, 그 아래 산호 수평선 한 줄(2026-11-13 A안)."""
    icon = Image.new("RGBA", (size, size), WHITE + (255,))
    icon.alpha_composite(sails_png(size, 2.9, -50, TEAL_HEX, CORAL_HEX))
    return icon.convert("RGB")


def app_icon(size: int = 1024) -> Image.Image:
    """먹청록 바탕, 아래로 갈수록 커지는 산호 망점(물에 비친 노을), 흰 돛."""
    icon = Image.new("RGB", (size, size), DEEP)
    px, dots = icon.load(), screen(12)
    for y in range(600, size):
        t = min(1, (y - 600) / 330)
        for x in range(size):
            if dots(x, y) > 1 - 1.6 * t**1.2:
                px[x, y] = CORAL
    out = icon.convert("RGBA")
    out.alpha_composite(sails_png(size, 3.15, -40))
    return out.convert("RGB")


if __name__ == "__main__":
    import sys

    # 아이콘은 흰 바탕 A안. 앱 화면이 흰 바탕이라 아이콘도 맞춘다.
    white_icon().save(ASSETS / "app-icon.png")
    # Android 적응형 아이콘은 가운데 66/108만 항상 보인다. 돛 상자 대각선이 그 안에 들도록 줄인다.
    # 바탕색은 app.json의 adaptiveIcon.backgroundColor(흰색)가 채운다.
    sails_png(1024, 2.1, -30, TEAL_HEX, CORAL_HEX).save(ASSETS / "adaptive-icon.png")
    # 기본 실행 화면은 항구 물빛(#205361) 위에 흰 돛만 둔다. 이어서 앱의 LaunchCurtain이 같은 자리에 항구 사진을 깐다.
    sails_png(1024, 4.4).save(ASSETS / "splash-icon.png")
    if "--photo" in sys.argv:
        riso(Image.open(BRAND / "welcome-sea-source.jpg").convert("RGB")).save(ASSETS / "welcome-sea.jpg", quality=88)
