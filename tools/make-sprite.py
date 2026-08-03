#!/usr/bin/env python3
"""Downscale source room art into a game sprite.

The pipeline was previously undocumented and half-run: `img/` holds 1536x1024
source art, `src/Assets/Buildings/` holds the 128x85 sprites the game imports,
and only six of the twelve-plus source images had ever been converted.

    python tools/make-sprite.py "Research Lab"
    python tools/make-sprite.py --all
    python tools/make-sprite.py --list

128x85 is exactly 1/12 of 1536x1024 (1024/12 = 85.33, floored), which is how the
existing sprites were made. Verified by re-deriving each shipped sprite from
source: mean per-channel difference came out around 2/255, i.e. PNG re-encoding
noise only.

That check also revealed which sources are canonical. `Hydroponics 2.png` and
`Water Pump 2.png` are the ones actually shipped (diff 2.4 and 2.6); the
un-suffixed `Hydroponics.png` and `Water Pump.png` are superseded drafts and
regenerate visibly different art (diff 30.6 and 22.9). CANONICAL below records
that so nobody rebuilds from the wrong file.

Note there is no source for Barracks in img/ -- the shipped sprite does not
derive from any file here.
"""
import argparse
import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required:  pip install Pillow")

SRC_DIR = "img"
OUT_DIR = os.path.join("src", "Assets", "Buildings")
SCALE = 12  # 1536/12 = 128, 1024/12 = 85 (floored)

# Source images that are references or scratch, not room art.
SKIP = {
    "Armory Reference",
    "Barracks Reference",
    "Power Cell Hydro Barracks and Armory With Doors",
    # Superseded drafts -- the " 2" versions are what shipped. See module docstring.
    "Hydroponics",
    "Water Pump",
}

# source stem -> sprite filename, where they differ.
CANONICAL = {
    "Hydroponics 2": "Hydroponics",
    "Water Pump 2": "Water Pump",
}


def source_files():
    if not os.path.isdir(SRC_DIR):
        sys.exit("No %s/ directory here. Run from the repo root." % SRC_DIR)
    out = []
    for f in sorted(os.listdir(SRC_DIR)):
        stem, ext = os.path.splitext(f)
        if ext.lower() != ".png" or stem in SKIP:
            continue
        out.append(stem)
    return out


def convert(stem, force=False):
    src = os.path.join(SRC_DIR, stem + ".png")
    dst = os.path.join(OUT_DIR, CANONICAL.get(stem, stem) + ".png")
    if not os.path.isfile(src):
        print("  MISSING SOURCE  %s" % src)
        return False
    if os.path.isfile(dst) and not force:
        print("  exists, skipping %-34s (use --force to overwrite)" % (stem + ".png"))
        return False

    im = Image.open(src).convert("RGBA")
    w, h = im.size
    target = (max(1, w // SCALE), max(1, h // SCALE))
    # LANCZOS keeps the fine detail (rebar, cable runs, screen glow) legible at
    # 128px far better than the default; these are dense illustrations, not
    # pixel art, so nearest-neighbour turns them to mush.
    im = im.resize(target, Image.LANCZOS)
    os.makedirs(OUT_DIR, exist_ok=True)
    im.save(dst, "PNG", optimize=True)
    kb = os.path.getsize(dst) // 1024
    print("  %-34s %dx%d -> %dx%d  %d kB" % (stem + ".png", w, h, target[0], target[1], kb))
    return True


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("name", nargs="?", help='source stem, e.g. "Research Lab"')
    ap.add_argument("--all", action="store_true", help="convert every source image")
    ap.add_argument("--list", action="store_true", help="show sources and whether a sprite exists")
    ap.add_argument("--force", action="store_true", help="overwrite existing sprites")
    args = ap.parse_args()

    stems = source_files()

    if args.list:
        print("%-40s %-18s %s" % ("SOURCE (img/)", "SPRITE FILE", "BUILT"))
        for s in stems:
            out = CANONICAL.get(s, s)
            has = os.path.isfile(os.path.join(OUT_DIR, out + ".png"))
            print("%-40s %-18s %s" % (s, out + ".png", "yes" if has else "-- none --"))
        return

    if args.all:
        print("Converting all sources:")
        n = sum(convert(s, args.force) for s in stems)
        print("%d written." % n)
        return

    if not args.name:
        ap.error("give a name, or --all, or --list")
    convert(args.name, args.force)


if __name__ == "__main__":
    main()
