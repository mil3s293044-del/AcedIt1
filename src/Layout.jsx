import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster } from "@/components/ui/toaster";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import XPFeedback from "@/components/ranked/XPFeedback";
import StreakCelebration from "@/components/ranked/StreakCelebration";
import StakesPill from "@/components/arena/StakesPill";
import TopNav from "@/components/layout/TopNav";
import BottomNav from "@/components/layout/BottomNav";
import SideRail from "@/components/layout/SideRail";
import AceCompanion from "@/components/ace/AceCompanion";
import AceIntro from "@/components/ace/AceIntro";
import { recordVisit } from "@/lib/aceDeck";
import AceBuddy from "@/components/ace/AceBuddy";
import AceReacts from "@/components/ace/AceReacts";
import AceTour from "@/components/ace/AceTour";
import PomodoroOrb from "@/components/study/PomodoroOrb";

/**
 * The running block, wherever you are in the app.
 *
 * WHAT CHANGED AND WHY. It was a purple clock GLYPH beside a mono countdown —
 * a picture of a clock next to the time, carrying nothing the digits did not
 * already say, which is the decoration this codebase keeps taking out. It is a
 * real clock now: the ring empties with the block, the hand ticks every
 * second, and the colour says work or break before you read a word. See
 * PomodoroOrb.
 *
 * THE DRAG HANDLE IS THE WHOLE CARD, and the move icon went with the glyph.
 * `cursor: grab` on the card already says it can be moved, and an icon that
 * only means "this is draggable" is a caption on an affordance.
 *
 * It only SAID that, though. The card's whole interior is the link to Study,
 * and the drag handler bailed out on anything inside `.timer-content a` — so
 * the grab cursor sat over roughly twelve pixels of padding that could
 * actually be grabbed, and every student who tried to move the widget by the
 * clock or the countdown was told it was draggable and then found it wasn't.
 *
 * So drag and click are separated by DISTANCE, not by target. A press
 * anywhere on the card starts a drag; if the pointer never travels further
 * than a few pixels it was a tap and the link fires, and if it did travel the
 * click is swallowed on the way out. That is how a draggable thing that is
 * also a link has to work — an element cannot decide which one you meant
 * until you let go.
 *
 * POINTER events, not mouse: one code path covers touch, and a captured
 * pointer keeps sending moves after it leaves the card, so a fast drag can't
 * shake the widget loose the way the old document-level mousemove could when
 * it crossed an iframe or left the window.
 *
 * The capture is taken LATE — at the moment the pointer passes the threshold,
 * not when it goes down. A captured pointer retargets the click that follows
 * it to the capturing element, so capturing on press meant the click never
 * reached the anchor inside and a plain tap on the widget silently did
 * nothing. Capture is a drag tool; a tap is not a drag.
 */
const FloatingTimer = React.memo(({
    currentTime, timerPosition, isDragging, handlePointerDown, swallowClickAfterDrag,
    timerRef, formatTime,
}) => (
    <motion.div
        ref={timerRef}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        style={{
            position: 'fixed',
            left: `${timerPosition.x}px`,
            top: `${timerPosition.y}px`,
            cursor: isDragging ? 'grabbing' : 'grab',
            zIndex: 99
        }}
        onPointerDown={handlePointerDown}
        /* Capture phase, so a drag that ended over the link is stopped BEFORE
           the anchor sees the click. On the bubble phase the navigation has
           already been queued. */
        onClickCapture={swallowClickAfterDrag}
        className="touch-none"
    >
        <Card className={`bg-surface/95 backdrop-blur-sm border-2 transition-all select-none
            ${isDragging
                ? 'border-primary/60 shadow-2xl'
                : currentTime.isBreak
                    ? 'border-xp/40 shadow-lg hover:shadow-xl hover:border-xp/60'
                    : 'border-primary/40 shadow-lg hover:shadow-xl hover:border-primary/60'}`}>
            <CardContent className="p-3 timer-content">
                <Link to={createPageUrl("Study")} draggable={false}
                    className="flex items-center gap-3">
                    <PomodoroOrb left={currentTime.timeLeft} total={currentTime.total}
                        isBreak={currentTime.isBreak} />
                    <div className="min-w-0">
                        <div className="font-mono font-bold text-lg text-foreground tabular-nums leading-none">
                            {formatTime(currentTime.timeLeft)}
                        </div>
                        <div className={`text-xs font-bold mt-1 ${currentTime.isBreak ? 'text-xp' : 'text-primary'}`}>
                            {currentTime.isBreak ? 'Break' : `Session #${currentTime.session}`}
                        </div>
                        {currentTime.subject && !currentTime.isBreak && (
                            <div className="text-xs text-muted-foreground truncate max-w-32">
                                {currentTime.subject}
                            </div>
                        )}
                    </div>
                </Link>
            </CardContent>
        </Card>
    </motion.div>
));

FloatingTimer.displayName = 'FloatingTimer';

export default function Layout({ children }) {
    const location = useLocation();
    // The signup tour owns the corner and the mascot while it runs. Ace
    // introducing a page over the top of Ace touring you through it is the app
    // arguing with itself, and it is the same corner besides.
    const [tourLive, setTourLive] = useState(false);
    const pageKey = location.pathname.replace(/^\//, "").split("/")[0] || "Dashboard";

    // The deck's weaker half. Opening a page isn't using a feature, which is
    // why this is kept apart from the evidence in the student's own rows — but
    // for the read-only parts of the app (Analytics, Ranked, the guides) it's
    // the only thing we can honestly know at all.
    useEffect(() => {
        recordVisit(location.pathname + location.search);
    }, [location.pathname, location.search]);
    const navigate = useNavigate();
    const [globalTimer, setGlobalTimer] = useState(null);
    const [currentTime, setCurrentTime] = useState(null);
    const [timerPosition, setTimerPosition] = useState(() => {
        const saved = localStorage.getItem('timerPosition');
        return saved ? JSON.parse(saved) : { x: window.innerWidth - 220, y: 70 };
    });
    const [isDragging, setIsDragging] = useState(false);
    // The live drag, in a ref rather than state. A pointermove fires far more
    // often than a frame, and re-rendering the whole Layout on each one to
    // read back an offset it already knows is how a drag starts feeling
    // heavy. Only the POSITION is state, because only the position is drawn.
    const dragRef = useRef(null);
    const timerRef = useRef(null);
    const [userProfile, setUserProfile] = useState(null);
    const [navigationGuard, setNavigationGuard] = useState({ show: false, targetUrl: null, onSave: null });
    const [pendingNavigation, setPendingNavigation] = useState(null);
    const { toast } = useToast();

    useEffect(() => {
        const loadUserProfile = async () => {
            try {
                const user = await base44.auth.me();
                const profiles = await base44.entities.UserProfile.filter({ created_by: user.email });
                let profile = profiles[0] || null;

                // Silently expire premium if past expiry date
                if (profile && profile.subscription_tier === 'premium' && profile.subscription_expires_at) {
                    if (new Date(profile.subscription_expires_at) < new Date()) {
                        profile = await base44.entities.UserProfile.update(profile.id, {
                            subscription_tier: 'free',
                            user_role: 'free_user',
                            subscription_expires_at: null,
                            ai_credits: 500,
                        });
                    }
                }

                // Expire trial if trial_ends_at has passed
                if (profile && profile.trial_active && profile.trial_ends_at) {
                    if (new Date(profile.trial_ends_at) < new Date()) {
                        profile = await base44.entities.UserProfile.update(profile.id, {
                            trial_active: false,
                            subscription_active: false,
                        });
                    }
                }

                setUserProfile(profile);

                // Best-effort ban check. RLS may block reads of other users'
                // rate-limit rows; that's fine — server.mjs enforces bans on
                // every AI call, so a missed read here just defers detection.
                let rlRecord = null;
                try {
                    const records = await base44.entities.AIRateLimit.filter({ user_email: user.email });
                    rlRecord = records[0];
                } catch {}
                if (rlRecord?.is_frozen && rlRecord?.freeze_reason === 'banned_account') {
                    navigate("/Suspended");
                    return;
                }

                // Onboarding + subscription gates intentionally removed for v1 launch:
                //   • Free users keep access to free-tier features. Premium-only
                //     features are gated at the page level via <RequirePremium>
                //     (e.g. /AITools) — no app-wide blanket block.
                //   • Onboarding modal disabled until we redesign the flow.
                // If you ever want either back, uncomment the original blocks
                // in git history (commit `Add SAC mode, skeleton loading, ...`).
                if (profile && profile.subscription_active && !profile.onboarding_completed) {
                    // Keep the data clean: any active-subscription user without
                    // an onboarding flag gets it set silently (no UI prompt).
                    await base44.entities.UserProfile.update(profile.id, {
                        onboarding_completed: true,
                        onboarding_completed_at: new Date().toISOString(),
                    });
                }
            } catch (error) {
                console.error("Error loading user profile:", error);
            }
        };
        loadUserProfile();
    }, []);

    useEffect(() => {
        const handleTimerStateChange = (event) => {
            try { setGlobalTimer(event.detail); } catch {}
        };
        const checkInitialTimerState = () => {
            try {
                const savedState = localStorage.getItem('globalTimerState');
                if (savedState) {
                    const state = JSON.parse(savedState);
                    if (state?.isActive) setGlobalTimer(state);
                }
            } catch {
                localStorage.removeItem('globalTimerState');
                localStorage.removeItem('pomodoroTimerState');
            }
        };
        window.addEventListener('timerStateChanged', handleTimerStateChange);
        checkInitialTimerState();
        return () => window.removeEventListener('timerStateChanged', handleTimerStateChange);
    }, []);

    useEffect(() => {
        if (!globalTimer?.isActive || !globalTimer?.isRunning) {
            setCurrentTime(null);
            return;
        }
        const updateTimer = () => {
            try {
                const savedState = localStorage.getItem('pomodoroTimerState');
                if (!savedState) { setCurrentTime(null); setGlobalTimer(null); return; }
                const state = JSON.parse(savedState);
                if (!state?.isRunning || state.timeLeft <= 0) {
                    setCurrentTime(null); setGlobalTimer(null);
                    localStorage.removeItem('pomodoroTimerState');
                    localStorage.removeItem('globalTimerState');
                    return;
                }
                const now = Date.now();
                const timeSinceUpdate = Math.floor((now - (state.lastUpdated || now)) / 1000);
                const actualTimeLeft = Math.max(0, state.timeLeft - timeSinceUpdate);
                if (actualTimeLeft > 0) {
                    // The block's full length, so the ring can be a proportion
                    // rather than a guess. PomodoroTimer already saves its
                    // settings into this state; an older saved state without
                    // them yields undefined and the ring is simply not drawn.
                    const mins = state.isBreak
                        ? (state.settings?.shortBreak ?? state.settings?.longBreak)
                        : state.settings?.workTime;
                    setCurrentTime({
                        timeLeft: actualTimeLeft,
                        total: mins > 0 ? mins * 60 : 0,
                        isBreak: state.isBreak || false,
                        session: state.session,
                        subject: state.selectedSubject,
                    });
                } else {
                    setCurrentTime(null); setGlobalTimer(null);
                    localStorage.removeItem('pomodoroTimerState');
                    localStorage.removeItem('globalTimerState');
                }
            } catch {
                setCurrentTime(null); setGlobalTimer(null);
            }
        };
        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [globalTimer]);

    // Whether the widget is on screen at all. Declared up here because the
    // drag effect keys on it — the listeners go on when the widget appears and
    // come off when it goes, rather than being tied to a drag being in flight.
    const showFloatingTimer = currentTime?.timeLeft > 0 && !location.pathname.includes(createPageUrl("Study"));

    // Below this, a press was a TAP and the link should fire. Above it, the
    // student was moving the widget and the click that follows is an accident
    // of letting go. 4px is roughly the slop in a deliberate tap — a hand on a
    // trackpad or a thumb on glass never lands perfectly still.
    const DRAG_SLOP = 4;

    /** Keep the widget on screen, whatever the viewport is now. */
    const clampToViewport = useCallback((x, y) => {
        const w = timerRef.current?.offsetWidth || 200;
        const h = timerRef.current?.offsetHeight || 100;
        return {
            x: Math.max(16, Math.min(x, Math.max(16, window.innerWidth - w - 16))),
            y: Math.max(16, Math.min(y, Math.max(16, window.innerHeight - h - 16))),
        };
    }, []);

    const handlePointerDown = useCallback((e) => {
        // Left button or touch only. A right-click is a context menu and a
        // middle-click on the link is "open in a new tab"; neither is a drag.
        if (e.button !== 0) return;
        dragRef.current = {
            id: e.pointerId,
            offsetX: e.clientX - timerPosition.x,
            offsetY: e.clientY - timerPosition.y,
            startX: e.clientX,
            startY: e.clientY,
            moved: false,
            captured: false,
        };
        setIsDragging(true);
    }, [timerPosition.x, timerPosition.y]);

    /**
     * A click that ends a drag is swallowed.
     *
     * `moved` stays true until the NEXT press, on purpose: the click event
     * arrives after pointerup, so clearing it on release would let the
     * navigation through every time.
     */
    const swallowClickAfterDrag = useCallback((e) => {
        if (!dragRef.current?.moved) return;
        e.preventDefault();
        e.stopPropagation();
    }, []);

    // Attached for as long as the widget is on screen, NOT while a drag is in
    // flight. Keyed on `isDragging`, the listeners only went on after React
    // had re-rendered for the state change — so every pointermove between the
    // press and that commit was dropped on the floor, and a quick flick could
    // finish before anything was listening. `dragRef` already says whether a
    // drag is live; the handlers read it and no-op when it is not.
    useEffect(() => {
        const node = timerRef.current;
        if (!node) return;

        const onMove = (e) => {
            const d = dragRef.current;
            if (!d || e.pointerId !== d.id) return;
            if (!d.moved
                && Math.abs(e.clientX - d.startX) < DRAG_SLOP
                && Math.abs(e.clientY - d.startY) < DRAG_SLOP) return;
            if (!d.captured) {
                // Now it is a drag. From here the pointer reports to this
                // element even when it outruns the card or leaves the window.
                //
                // Guarded: setPointerCapture THROWS if the pointer is no
                // longer active, and an exception here would abort the rest of
                // this handler — so a pointer that died mid-gesture would take
                // the position update with it. Capture is an optimisation on
                // top of a drag that already works without it.
                d.captured = true;
                try { node.setPointerCapture?.(e.pointerId); } catch { d.captured = false; }
            }
            d.moved = true;
            setTimerPosition(clampToViewport(e.clientX - d.offsetX, e.clientY - d.offsetY));
        };
        const onUp = (e) => {
            const d = dragRef.current;
            if (!d) return;                       // no drag in flight
            if (e.pointerId !== d.id) return;
            dragRef.current = { ...d, id: null }; // keep `moved` for the click
            if (d.captured) {
                try { node.releasePointerCapture?.(e.pointerId); } catch { /* already gone */ }
            }
            setIsDragging(false);
            // Read the position off the node rather than the closure: this
            // effect re-runs on isDragging alone, so `timerPosition` in scope
            // is whatever it was when the drag STARTED. Persisting that put
            // the widget back where it came from on the next page load.
            if (d?.moved) {
                localStorage.setItem('timerPosition', JSON.stringify({
                    x: node.offsetLeft, y: node.offsetTop,
                }));
            }
        };

        node.addEventListener('pointermove', onMove);
        node.addEventListener('pointerup', onUp);
        // A cancelled pointer (a system gesture, a phone call) must not leave
        // the widget stuck to the cursor.
        node.addEventListener('pointercancel', onUp);
        // Until the threshold is passed there is no capture, so a press that
        // is released off the card — or one the browser hands to something
        // else — would otherwise leave `isDragging` stuck on forever.
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        return () => {
            node.removeEventListener('pointermove', onMove);
            node.removeEventListener('pointerup', onUp);
            node.removeEventListener('pointercancel', onUp);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };
    }, [showFloatingTimer, clampToViewport]);

    // A saved position is only valid for the viewport it was saved in. Resize
    // to a narrow window and the widget was simply off the right-hand edge,
    // with no way to reach it and no way to put it back.
    useEffect(() => {
        const onResize = () => setTimerPosition(p => clampToViewport(p.x, p.y));
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [clampToViewport]);

    const formatTime = useCallback((seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }, []);


    return (
        <div className="min-h-screen bg-background relative">
            <SideRail />
            <TopNav />

            <AnimatePresence>
                {showFloatingTimer && (
                    <FloatingTimer
                        currentTime={currentTime}
                        timerPosition={timerPosition}
                        isDragging={isDragging}
                        handlePointerDown={handlePointerDown}
                        swallowClickAfterDrag={swallowClickAfterDrag}
                        timerRef={timerRef}
                        formatTime={formatTime}
                    />
                )}
            </AnimatePresence>

            <main className="text-foreground w-full pb-20 md:pb-0 md:pl-16">
                <StakesPill />
                {children}
            </main>

            <BottomNav />

            <AceReacts />

            <Toaster />

            {/* Navigation Guard Dialog */}
            <Dialog open={navigationGuard.show} onOpenChange={(open) => {
                if (!open) {
                    setNavigationGuard({ show: false, targetUrl: null, onSave: null });
                    setPendingNavigation(null);
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>You have unsaved work</DialogTitle>
                    </DialogHeader>
                    <p className="text-muted-foreground">Your current work will be lost if you leave without saving.</p>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => {
                            setNavigationGuard({ show: false, targetUrl: null, onSave: null });
                            setPendingNavigation(null);
                        }}>Go Back</Button>
                        <Button variant="destructive" onClick={() => {
                            setNavigationGuard({ show: false, targetUrl: null, onSave: null });
                            if (pendingNavigation) { navigate(pendingNavigation); setPendingNavigation(null); }
                        }}>Don't Save & Continue</Button>
                    </div>
                </DialogContent>
            </Dialog>
            <XPFeedback />
            <StreakCelebration />

            <AceCompanion userProfile={userProfile} />
            {/* One mount for the whole app rather than a call on each of the
                ten pages that carry a help button — the route already tells us
                where we are, and this way a page added later is covered the
                moment it gets a knowledge-map entry. */}
            <AceIntro page={pageKey} suppressed={tourLive} />
            {/* He asks what the plan is once a day and then travels with you. */}
            <AceBuddy page={pageKey} userProfile={userProfile} suppressed={tourLive} />

            {/* Six stops and a sign-off, once, for accounts that are hours old.
                Renders nothing at all for anyone else — see aceTour's header
                for why eligibility is derived from the profile's age rather
                than from a flag we would have had to backfill. */}
            <AceTour page={pageKey} userProfile={userProfile} onLiveChange={setTourLive} />
            {/* There is no second onboarding to suppress these for any more.
                Signup runs the wizard at /Onboarding, which is its own route —
                by the time Layout is on screen that conversation is over. The
                modal that used to mount here was a nine-step duplicate of it,
                gated on a flag nothing ever set, so it never opened. */}
        </div>
    );
}