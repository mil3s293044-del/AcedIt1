#!/usr/bin/env python3
"""
Render each .frame of an ad HTML file to a PNG with headless Chrome.

    python3 render.py reel-recall.html frames/recall 1080 1920 7

Renders at 2x device scale so the video pipeline has real pixels to zoom into
(the reel scales 2160x3840 down to 1080x1920 after the Ken Burns push).
"""
import os
import re
import shutil
import subprocess
import sys
import time

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HERE = os.path.dirname(os.path.abspath(__file__))


def frame_count(html_path):
    return len(re.findall(r'class="frame\b', open(html_path).read()))


def render(html, outdir, w, h, n=None):
    """
    Chrome's new headless mode hangs after the first screenshot on this machine,
    so we use the old one, poll for the PNG, then kill the process ourselves.
    """
    html_path = os.path.join(HERE, html)
    n = n or frame_count(html_path)
    os.makedirs(outdir, exist_ok=True)
    for i in range(1, n + 1):
        out = os.path.abspath(os.path.join(outdir, f"s{i}.png"))
        tmp = os.path.join("/tmp", f"acedit-chrome-{i}")
        shutil.rmtree(tmp, ignore_errors=True)
        if os.path.exists(out):
            os.remove(out)
        proc = subprocess.Popen([
            CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
            "--force-device-scale-factor=2",
            f"--window-size={w},{h}",
            f"--user-data-dir={tmp}",
            "--timeout=8000",
            f"--screenshot={out}",
            f"file://{html_path}#{i}",
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(400):
            if os.path.exists(out):
                time.sleep(0.4)          # let the write finish
                break
            time.sleep(0.1)
        proc.kill()
        proc.wait()
        shutil.rmtree(tmp, ignore_errors=True)
        if not os.path.exists(out):
            raise SystemExit(f"frame {i} never rendered")
        print(f"  {out}  ({os.path.getsize(out) // 1024} KB)")
    return n


if __name__ == "__main__":
    html = sys.argv[1]
    outdir = sys.argv[2]
    w = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
    h = int(sys.argv[4]) if len(sys.argv) > 4 else 1920
    n = int(sys.argv[5]) if len(sys.argv) > 5 else None
    print(f"{html} -> {outdir}  ({w}x{h} @2x)")
    render(html, outdir, w, h, n)
