/**
 * Whether Ace's eyes are shut right now. One chain while `enabled` is true;
 * see aceBlink.js for why the scheduler lives there and not in each face.
 *
 * Keyed on a BOOLEAN, never on the eyelid value: a pose that opens his eyes a
 * little wider is not a reason to restart the blink clock.
 */
import { useEffect, useState } from "react";
import { startBlinking } from "@/lib/aceBlink";

export default function useBlink(enabled) {
    const [blinking, setBlinking] = useState(false);
    useEffect(() => (enabled ? startBlinking(setBlinking) : undefined), [enabled]);
    return enabled && blinking;
}
