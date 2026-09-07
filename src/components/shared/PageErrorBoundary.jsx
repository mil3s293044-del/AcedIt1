/**
 * PageErrorBoundary — the app had none, anywhere.
 *
 * ─── Why a blank screen was the default failure ─────────────────────────────
 * React's contract is that an error thrown during render unmounts the whole
 * tree unless something catches it. With no boundary in the app, ANY failure
 * in ANY page — a chunk that would not load, a row shaped differently from
 * what a component assumed, a null nobody guarded — took the nav, the rail and
 * the theme down with it and left white. Nothing on screen, nothing in the UI
 * to report, and a student who has no way to know whether it is them or us.
 *
 * A boundary does not fix the underlying error. It changes the failure from
 * "the app disappeared" to "this page didn't load, here is a button", which is
 * the difference between a bug report and a lost user.
 *
 * ─── It resets on navigation ────────────────────────────────────────────────
 * `resetKey` is the current path. Without it a boundary that has caught once
 * stays caught: React keeps rendering the fallback until state changes, so a
 * student who hit an error on one page would find every OTHER page broken too
 * until they refreshed — turning one bad page into a bad app, which is exactly
 * the failure mode this is here to end.
 */
import React from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, ArrowLeft } from "lucide-react";

export default class PageErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidUpdate(prev) {
        // A new route is a new chance. See the note above on why this matters.
        if (prev.resetKey !== this.props.resetKey && this.state.error) {
            this.setState({ error: null });
        }
    }

    componentDidCatch(error, info) {
        // Loud on purpose: this is the only trace of a page that failed to
        // render, and without it the report is "it went white".
        console.error("[PageErrorBoundary] page crashed:", error, info?.componentStack);
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div className="flex flex-col items-center justify-center text-center py-20 px-6">
                <h2 className="font-display font-extrabold text-xl text-foreground">
                    This page didn't load
                </h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm leading-relaxed">
                    Something went wrong on our side. Your work is saved — reloading
                    usually sorts it.
                </p>
                <div className="flex gap-2 mt-5">
                    <Button onClick={() => window.location.reload()} className="gap-1.5">
                        <RefreshCw className="w-4 h-4" /> Reload
                    </Button>
                    <Button variant="outline" className="gap-1.5"
                        onClick={() => { window.location.href = "/"; }}>
                        <ArrowLeft className="w-4 h-4" /> Go home
                    </Button>
                </div>
            </div>
        );
    }
}
