#!/usr/bin/env python3
"""
Resize archix-icon-original.{png,jpg,jpeg,webp} -> archix-icon.png (1024x1024)
Run from the Discord Bot directory:
  python3 scripts/resize-icon.py
"""
from PIL import Image
import os, sys

BOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT_CANDIDATES = [
    os.path.join(BOT_DIR, f"archix-icon-original.{ext}")
    for ext in ["png", "jpg", "jpeg", "webp"]
]
OUTPUT = os.path.join(BOT_DIR, "archix-icon.png")

src = next((p for p in INPUT_CANDIDATES if os.path.exists(p)), None)
if not src:
    print("ERROR: Drop your image in the Discord Bot folder as archix-icon-original.png (or .jpg/.webp)")
    sys.exit(1)

img = Image.open(src).convert("RGBA")
img = img.resize((1024, 1024), Image.LANCZOS)
img.save(OUTPUT, "PNG", optimize=True)
print(f"Saved {OUTPUT}")
print(f"Original size: {Image.open(src).size}")
