/**
 * brainShape — the point cloud the app's brain is actually made of.
 *
 * Lifted out of BrainModel so the landing page's opening animation can land a
 * few hundred cards on exactly the same coordinates the Study page lights up.
 * Two brains that are "roughly brain-shaped" in two different ways would have
 * been the tell that the marketing picture was a marketing picture; sharing
 * the function means the shape a visitor watches assemble in the first two
 * seconds is, to the point, the shape they are shown their own study history
 * on twenty minutes later.
 *
 * It is a genuine 3D cloud in normalised coordinates: x = right, y = up,
 * z = front, roughly within the unit sphere. Nothing here is anatomical
 * measurement. It is a sphere bent until the silhouette reads as a brain, and
 * every deformation below is annotated with which feature of that silhouette
 * it is responsible for.
 */

/** Fibonacci sphere — evenly spread points, no clumping at the poles. */
export function sphere(n) {
    const pts = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
        const y = 1 - (i / (n - 1)) * 2;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const th = golden * i;
        pts.push([Math.cos(th) * r, y, Math.sin(th) * r]);
    }
    return pts;
}

/**
 * Bend a sphere into something brain-shaped: longer front-to-back than wide,
 * flatter underneath, a cleft down the midline between the hemispheres, a
 * narrower frontal pole and a cerebellum tucked under the back.
 */
export function brainCloud(n) {
    const out = [];
    for (const [x, y, z] of sphere(n)) {
        let px = x * 0.82, py = y * 0.74, pz = z * 1.06;
        if (py < 0) py *= 0.72;                       // flat underside
        if (pz > 0.4) { px *= 0.86; py *= 0.92; }     // tapered frontal pole
        // Occipital pole — the back narrows and tucks upward over the
        // cerebellum instead of ending in a hemisphere.
        if (pz < -0.5) { px *= 0.88; py = py * 0.94 + 0.05; }
        const cleft = Math.exp(-(px * px) / 0.004) * Math.max(0, py) * 0.16;
        py -= cleft;                                   // longitudinal fissure
        // Sylvian fissure — the deep lateral groove above the temporal lobe.
        // It's the single most recognisable line on a brain seen side-on, and
        // without it the profile is one unbroken dome.
        const syl = Math.exp(-Math.pow((py + 0.10 + 0.14 * pz) / 0.075, 2));
        px -= Math.sign(px) * syl * 0.085 * Math.min(1, Math.abs(px) / 0.3);
        // Gyri: radial noise so it reads as folded, not as a balloon.
        const fold = 1 + 0.045 * Math.sin(px * 17) * Math.cos(pz * 13) + 0.03 * Math.sin(py * 21);
        out.push([px * fold, py * fold, pz * fold]);
    }
    // Temporal lobes — the forward-projecting lobes below the fissure. They
    // give the underside its hook; a brain without them reads as an egg.
    for (const [x, y, z] of sphere(Math.round(n * 0.16))) {
        const tx = 0.30 + Math.abs(x) * 0.16, ty = y * 0.16 - 0.34, tz = z * 0.44 + 0.16;
        const fold = 1 + 0.05 * Math.sin(tz * 15);
        out.push([tx * fold, ty * fold, tz * fold]);
        out.push([-tx * fold, ty * fold, tz * fold]);
    }
    // Cerebellum — the small dense lobe under the back that does most of the
    // work of making a silhouette read as a brain.
    for (const [x, y, z] of sphere(Math.round(n * 0.22))) {
        out.push([x * 0.42, y * 0.24 - 0.58, z * 0.34 - 0.62]);
    }
    // Brainstem. Cheap, and without it the underside just stops — which is the
    // single thing that stopped the silhouette reading as a brain.
    for (let i = 0; i < Math.round(n * 0.05); i++) {
        const k = i / Math.round(n * 0.05);
        const a = k * Math.PI * 7.7;
        const rr = 0.10 * (1 - 0.35 * k);
        out.push([Math.cos(a) * rr, -0.52 - k * 0.34, Math.sin(a) * rr - 0.30 + k * 0.06]);
    }
    return out;
}

/** Yaw then pitch, applied to one point. */
export const rotate = ([x, y, z], yaw, pitch) => {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
};
