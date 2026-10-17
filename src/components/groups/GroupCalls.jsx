/**
 * GroupCalls — what a group can say, which is a fixed set of phrases.
 *
 * There is no text box, deliberately. The chat this replaced was free text
 * between minors, checked for swear words in the browser and nowhere else —
 * skippable by anybody who wrote the row directly, blind to bullying that
 * swears at nobody, and impossible to delete. Migration 0034 refused exactly
 * that for Compete, and the pranks and share notes were each built not to be
 * it. A phrase is named, rate limited, and can only ever say what is on the
 * list: the most a group can do to somebody is ask them to study.
 *
 * A tap SENDS, so each chip is a whole message, and the newest calls sit at
 * the bottom beside the chips that answer them.
 */
import React, { useState } from "react";
import InitialAvatar from "@/components/shared/InitialAvatar";
import Band from "@/components/shared/Band";
import { ago } from "@/components/groups/GroupShelf";

const SHOWN = 8;

export default function GroupCalls({ feed = [], phrases = [], working, onPhrase }) {
    const [all, setAll] = useState(false);
    const shown = all ? feed : feed.slice(-SHOWN);
    return (
        <Band title="Calls">
            <div data-group-block="calls">
                {feed.length > SHOWN && !all && (
                    <button type="button" onClick={() => setAll(true)}
                        className="text-xs font-bold text-muted-foreground hover:text-foreground mb-2">
                        Show {feed.length - SHOWN} earlier
                    </button>
                )}
                {shown.length === 0 ? (
                    <p className="text-sm text-muted-foreground pb-1">Quiet so far. Start one off below.</p>
                ) : (
                    <ul className="space-y-2.5">
                        {shown.map((f) => f.kind === "event" ? (
                            <li key={f.id} className="flex items-center gap-2 text-xs text-muted-foreground pl-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-border flex-shrink-0" aria-hidden />
                                <span className="min-w-0 break-words">{f.text}</span>
                                <span className="ml-auto flex-shrink-0">{ago(f.at)}</span>
                            </li>
                        ) : (
                            <li key={f.id} className="flex items-start gap-2.5">
                                <InitialAvatar name={f.name} size="xs" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs text-muted-foreground">
                                        <span className="font-bold text-foreground">{f.mine ? "You" : f.name}</span> · {ago(f.at)}
                                    </p>
                                    <p className="text-sm font-bold text-foreground mt-0.5">{f.text}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                <div className="mt-4 pt-4 border-t border-border">
                    <p className="stat-label text-muted-foreground mb-2">Send a call</p>
                    <div className="flex flex-wrap gap-1.5">
                        {phrases.map((p) => (
                            <button key={p.id} type="button" disabled={working === "phrase"}
                                onClick={() => onPhrase?.(p.id)}
                                className="h-8 px-3 rounded-full border border-border bg-surface text-[13px] font-bold text-foreground hover:bg-secondary hover:border-primary/40 transition-colors disabled:opacity-50">
                                {p.text}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </Band>
    );
}
