#!/usr/bin/env python3
"""Surgically heals the 3 static painted bats (+ top-left wing sliver) out of
the original 1024x576 artwork using dilated masks and harmonic Laplace
diffusion, leaving all unmasked pixels bit-identical to the source."""

from __future__ import annotations

import subprocess
from pathlib import Path

WIDTH = 1024
HEIGHT = 576
ROOT = Path(__file__).resolve().parent.parent
SRC_PATH = ROOT / "public" / "assets" / "graveyard-original.jpg"
DST_PATH = ROOT / "public" / "assets" / "graveyard-clean.png"


def build_bat_mask(rgb: bytes) -> list[bool]:
    mask = [False] * (WIDTH * HEIGHT)

    regions = [
        # (x0, x1, y0, y1, predicate)
        (0, 26, 0, 43, lambda r, g, b: (r + g + b) < 85),
        (260, 339, 58, 101, lambda r, g, b: r < 58 and g < 44 and b < 44),
        (
            342,
            383,
            125,
            146,
            lambda r, g, b: (r < 85 and g < 45 and b < 45)
            or (r < 145 and g < 35 and b < 30),
        ),
        (642, 689, 116, 146, lambda r, g, b: r < 90 and g < 45 and b < 40),
    ]

    for x0, x1, y0, y1, pred in regions:
        for y in range(y0, y1):
            row_off = y * WIDTH
            for x in range(x0, x1):
                idx = (row_off + x) * 3
                r, g, b = rgb[idx], rgb[idx + 1], rgb[idx + 2]
                if pred(r, g, b):
                    mask[row_off + x] = True

    return mask


def dilate_mask(mask: list[bool], radius: int = 2) -> list[bool]:
    current = mask
    for _ in range(radius):
        nxt = current[:]
        for y in range(HEIGHT):
            row = y * WIDTH
            for x in range(WIDTH):
                p = row + x
                if current[p]:
                    continue
                if (
                    (x > 0 and current[p - 1])
                    or (x + 1 < WIDTH and current[p + 1])
                    or (y > 0 and current[p - WIDTH])
                    or (y + 1 < HEIGHT and current[p + WIDTH])
                ):
                    nxt[p] = True
        current = nxt
    return current


def harmonic_inpaint(rgb: bytes, mask: list[bool], iterations: int = 200) -> bytes:
    # Work in float channels only for masked pixels + 1-ring boundary
    masked_indices = [i for i, m in enumerate(mask) if m]
    if not masked_indices:
        return rgb

    rf = [float(rgb[i * 3]) for i in range(WIDTH * HEIGHT)]
    gf = [float(rgb[i * 3 + 1]) for i in range(WIDTH * HEIGHT)]
    bf = [float(rgb[i * 3 + 2]) for i in range(WIDTH * HEIGHT)]

    # Seed masked pixels with local average of nearby unmasked pixels to speed convergence
    for p in masked_indices:
        x = p % WIDTH
        y = p // WIDTH
        sr = sg = sb = 0.0
        cnt = 0
        for dy in range(-12, 13, 2):
            yy = y + dy
            if 0 <= yy < HEIGHT:
                for dx in range(-12, 13, 2):
                    xx = x + dx
                    if 0 <= xx < WIDTH:
                        np = yy * WIDTH + xx
                        if not mask[np]:
                            sr += rf[np]
                            sg += gf[np]
                            sb += bf[np]
                            cnt += 1
        if cnt > 0:
            rf[p] = sr / cnt
            gf[p] = sg / cnt
            bf[p] = sb / cnt

    # Gauss-Seidel SOR relaxation for Laplace equation
    omega = 1.65
    for _ in range(iterations):
        for p in masked_indices:
            x = p % WIDTH
            y = p // WIDTH
            r_sum = g_sum = b_sum = 0.0
            n = 0
            if x > 0:
                q = p - 1
                r_sum += rf[q]; g_sum += gf[q]; b_sum += bf[q]; n += 1
            if x + 1 < WIDTH:
                q = p + 1
                r_sum += rf[q]; g_sum += gf[q]; b_sum += bf[q]; n += 1
            if y > 0:
                q = p - WIDTH
                r_sum += rf[q]; g_sum += gf[q]; b_sum += bf[q]; n += 1
            if y + 1 < HEIGHT:
                q = p + WIDTH
                r_sum += rf[q]; g_sum += gf[q]; b_sum += bf[q]; n += 1
            if n > 0:
                rf[p] = rf[p] + omega * (r_sum / n - rf[p])
                gf[p] = gf[p] + omega * (g_sum / n - gf[p])
                bf[p] = bf[p] + omega * (b_sum / n - bf[p])

    out = bytearray(rgb)
    for p in masked_indices:
        idx = p * 3
        out[idx] = max(0, min(255, round(rf[p])))
        out[idx + 1] = max(0, min(255, round(gf[p])))
        out[idx + 2] = max(0, min(255, round(bf[p])))
    return bytes(out)


def main() -> None:
    raw = subprocess.check_output(["magick", str(SRC_PATH), "-depth", "8", "rgb:-"])
    expected_len = WIDTH * HEIGHT * 3
    if len(raw) != expected_len:
        raise RuntimeError(f"Expected {expected_len} RGB bytes, got {len(raw)}")

    base_mask = build_bat_mask(raw)
    mask = dilate_mask(base_mask, radius=2)
    healed_count = sum(1 for m in mask if m)
    healed = harmonic_inpaint(raw, mask, iterations=200)

    subprocess.run(
        [
            "magick",
            "-size",
            f"{WIDTH}x{HEIGHT}",
            "-depth",
            "8",
            "rgb:-",
            str(DST_PATH),
        ],
        input=healed,
        check=True,
    )
    print(f"Generated {DST_PATH} (healed {healed_count} pixels)")


if __name__ == "__main__":
    main()
