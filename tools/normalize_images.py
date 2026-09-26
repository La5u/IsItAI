"""Normalize quiz images so shape, size and file names don't reveal the answer.

Every image is center-cropped to a square, resized to SIZE x SIZE and
re-encoded as WebP at one quality (which also strips metadata). Files get
random names and the entry order in images.json is shuffled. Sign markers
are remapped to the cropped coordinates.

Run from the project root:  python3 tools/normalize_images.py
"""

import json
import re
import secrets
import random
from pathlib import Path

from PIL import Image

SIZE = 448
QUALITY = 82
DATA = Path("data/images.json")


def center_square(im):
    w, h = im.size
    side = min(w, h)
    left, top = (w - side) // 2, (h - side) // 2
    return im.crop((left, top, left + side, top + side)), (left, top, side, w, h)


def remap_sign(sign, box):
    left, top, side, w, h = box
    x = (sign["x"] / 100 * w - left) / side * 100
    y = (sign["y"] / 100 * h - top) / side * 100
    if not (0 <= x <= 100 and 0 <= y <= 100):
        print(f"  dropped cropped-out sign: {sign['text']!r}")
        return None
    return {**sign, "x": round(x, 1), "y": round(y, 1)}


def is_normalized(item):
    if not re.fullmatch(r"[0-9a-f]{8}", item["id"]):
        return False
    with Image.open(item["image"]) as im:
        return im.size == (SIZE, SIZE)


def main():
    items = json.loads(DATA.read_text())
    used = set()
    old_files = []

    for item in items:
        if is_normalized(item):
            continue
        src = Path(item["image"])
        with Image.open(src) as im:
            square, box = center_square(im.convert("RGB"))
            square = square.resize((SIZE, SIZE), Image.LANCZOS)

            new_id = secrets.token_hex(4)
            while new_id in used or (src.parent / f"{new_id}.webp").exists():
                new_id = secrets.token_hex(4)
            used.add(new_id)

            dest = src.parent / f"{new_id}.webp"
            square.save(dest, "WEBP", quality=QUALITY, method=6)

        signs = [remap_sign(s, box) for s in item.get("signs", [])]
        item["signs"] = [s for s in signs if s]
        item["id"] = new_id
        item["image"] = dest.as_posix()
        old_files.append(src)

    for src in old_files:
        src.unlink()

    random.shuffle(items)
    DATA.write_text(json.dumps(items, indent=2, ensure_ascii=False) + "\n")
    print(f"Normalized {len(old_files)} new images to {SIZE}x{SIZE}")


if __name__ == "__main__":
    main()
