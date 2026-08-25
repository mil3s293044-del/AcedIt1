#!/usr/bin/env python3
"""
Stitch rendered scene stills into a 1080x1920 reel: slow alternating Ken Burns
push on each scene, 0.35s crossfades between them, no audio.

    python3 build_reel.py frames/recall acedit-reel-recall.mp4 2.4 2.2 2.7 2.9 3.0 2.5 3.0

Silent on purpose — Reels using in-app audio get pushed harder than ones with
baked-in sound, so add a trending track inside Instagram when you post.
"""
import os
import subprocess
import sys

FPS = 30
XFADE = 0.35
ZOOM = 0.00045      # per-frame zoom step
ZMAX = 1.06


def build(framedir, out, durations):
    n = len(durations)
    inputs = []
    for i, d in enumerate(durations):
        inputs += ["-loop", "1", "-t", f"{d}", "-i", os.path.join(framedir, f"s{i+1}.png")]

    parts = []
    for i, d in enumerate(durations):
        frames = int(round(d * FPS))
        # alternate push-in / pull-back so consecutive scenes never drift the same way
        z = (f"min(1.001+{ZOOM}*on,{ZMAX})" if i % 2 == 0
             else f"max({ZMAX}-{ZOOM}*on,1.001)")
        parts.append(
            f"[{i}:v]scale=2160:3840,setsar=1,"
            f"zoompan=z='{z}':d={frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
            f":s=1080x1920:fps={FPS},trim=duration={d},format=yuv420p[v{i}]"
        )

    chain, prev, offset = [], "v0", durations[0]
    for i in range(1, n):
        tag = f"x{i}"
        chain.append(f"[{prev}][v{i}]xfade=transition=fade:duration={XFADE}"
                     f":offset={offset - XFADE:.2f}[{tag}]")
        prev = tag
        offset += durations[i] - XFADE

    filt = ";".join(parts + chain)
    cmd = (["ffmpeg", "-y"] + inputs +
           ["-filter_complex", filt, "-map", f"[{prev}]",
            "-c:v", "libx264", "-preset", "slow", "-crf", "18",
            "-pix_fmt", "yuv420p", "-r", str(FPS), "-movflags", "+faststart", out])
    subprocess.run(cmd, check=True, capture_output=True)
    print(f"{out}  ({offset:.2f}s, {os.path.getsize(out) // 1024} KB)")


if __name__ == "__main__":
    build(sys.argv[1], sys.argv[2], [float(x) for x in sys.argv[3:]])
