/**
 * True for the first `ms` after a board mounts, and false from then on.
 *
 * Every board draws two kinds of motion: the ARRIVAL (the podium dealt, the
 * rows coming in, the figures counting up from nothing) and a CHANGE (a row
 * racing to its new place, a figure counting from its old value). They must
 * not be confused: a row that appears because somebody pressed "Show all" is
 * not arriving at the board, and staggering it in as though it were makes the
 * thirtieth row wait a second for nothing. So the arrival is a window, and
 * whatever mounts after it closes is a change.
 */
import { useEffect, useState } from "react";

export default function useArrival(ms) {
    const [arriving, setArriving] = useState(true);
    useEffect(() => {
        const t = setTimeout(() => setArriving(false), ms);
        return () => clearTimeout(t);
    }, [ms]);
    return arriving;
}
