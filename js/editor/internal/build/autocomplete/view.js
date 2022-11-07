import { ViewPlugin, logException, getTooltip } from "../view/index.js";
import { completionState, setSelectedEffect, startCompletionEffect, closeCompletionEffect, setActiveEffect, ActiveSource, ActiveResult, getUserEvent } from "./state.js";
import { completionConfig } from "./config.js";
import { cur, CompletionContext, applyCompletion } from "./completion.js";
/** Returns a command that moves the completion selection forward or backward by the given amount. */
export function moveCompletionSelection(forward, by = "option") {
    return (view) => {
        let cState = view.state.field(completionState, false);
        if (!cState || !cState.open || Date.now() - cState.open.timestamp < view.state.facet(completionConfig).interactionDelay)
            return false;
        let step = 1, tooltip;
        if (by == "page" && (tooltip = getTooltip(view, cState.open.tooltip)))
            step = Math.max(2, Math.floor(tooltip.dom.offsetHeight / tooltip.dom.querySelector("li").offsetHeight) - 1);
        let { length } = cState.open.options;
        let selected = cState.open.selected > -1 ? cState.open.selected + step * (forward ? 1 : -1) : forward ? 0 : length - 1;
        if (selected < 0)
            selected = by == "page" ? 0 : length - 1;
        else if (selected >= length)
            selected = by == "page" ? length - 1 : 0;
        view.dispatch({ effects: setSelectedEffect.of(selected) });
        return true;
    };
}
/** Accept the current completion. */
export const acceptCompletion = (view) => {
    let cState = view.state.field(completionState, false);
    if (view.state.readOnly || !cState || !cState.open || cState.open.selected < 0 ||
        Date.now() - cState.open.timestamp < view.state.facet(completionConfig).interactionDelay)
        return false;
    applyCompletion(view, cState.open.options[cState.open.selected]);
    return true;
};
/** Explicitly start autocompletion. */
export const startCompletion = (view) => {
    let cState = view.state.field(completionState, false);
    if (!cState)
        return false;
    view.dispatch({ effects: startCompletionEffect.of(true) });
    return true;
};
/** Close the currently active completion. */
export const closeCompletion = (view) => {
    let cState = view.state.field(completionState, false);
    if (!cState || !cState.active.some(a => a.state != 0 /* State.Inactive */))
        return false;
    view.dispatch({ effects: closeCompletionEffect.of(null) });
    return true;
};
class RunningQuery {
    constructor(active, context) {
        this.active = active;
        this.context = context;
        this.time = Date.now();
        this.updates = [];
        // Note that 'undefined' means 'not done yet', whereas 'null' means 'query returned null'.
        this.done = undefined;
    }
}
const DebounceTime = 50, MaxUpdateCount = 50, MinAbortTime = 1000;
export const completionPlugin = ViewPlugin.fromClass(class {
    constructor(view) {
        this.view = view;
        this.debounceUpdate = -1;
        this.running = [];
        this.debounceAccept = -1;
        this.composing = 0 /* CompositionState.None */;
        for (let active of view.state.field(completionState).active)
            if (active.state == 1 /* State.Pending */)
                this.startQuery(active);
    }
    update(update) {
        let cState = update.state.field(completionState);
        if (!update.selectionSet && !update.docChanged && update.startState.field(completionState) == cState)
            return;
        let doesReset = update.transactions.some(tr => {
            return (tr.selection || tr.docChanged) && !getUserEvent(tr);
        });
        for (let i = 0; i < this.running.length; i++) {
            let query = this.running[i];
            if (doesReset ||
                query.updates.length + update.transactions.length > MaxUpdateCount && Date.now() - query.time > MinAbortTime) {
                for (let handler of query.context.abortListeners) {
                    try {
                        handler();
                    }
                    catch (e) {
                        logException(this.view.state, e);
                    }
                }
                query.context.abortListeners = null;
                this.running.splice(i--, 1);
            }
            else {
                query.updates.push(...update.transactions);
            }
        }
        if (this.debounceUpdate > -1)
            window.clearTimeout(this.debounceUpdate);
        this.debounceUpdate = cState.active.some(a => a.state == 1 /* State.Pending */ && !this.running.some(q => q.active.source == a.source)) ?
            window.setTimeout(() => this.startUpdate(), DebounceTime) : -1;
        if (this.composing != 0 /* CompositionState.None */)
            for (let tr of update.transactions) {
                if (getUserEvent(tr) == "input")
                    this.composing = 2 /* CompositionState.Changed */;
                else if (this.composing == 2 /* CompositionState.Changed */ && tr.selection)
                    this.composing = 3 /* CompositionState.ChangedAndMoved */;
            }
    }
    startUpdate() {
        this.debounceUpdate = -1;
        let { state } = this.view, cState = state.field(completionState);
        for (let active of cState.active) {
            if (active.state == 1 /* State.Pending */ && !this.running.some(r => r.active.source == active.source))
                this.startQuery(active);
        }
    }
    startQuery(active) {
        let { state } = this.view, pos = cur(state);
        let context = new CompletionContext(state, pos, active.explicitPos == pos);
        let pending = new RunningQuery(active, context);
        this.running.push(pending);
        Promise.resolve(active.source(context)).then(result => {
            if (!pending.context.aborted) {
                pending.done = result || null;
                this.scheduleAccept();
            }
        }, err => {
            this.view.dispatch({ effects: closeCompletionEffect.of(null) });
            logException(this.view.state, err);
        });
    }
    scheduleAccept() {
        if (this.running.every(q => q.done !== undefined))
            this.accept();
        else if (this.debounceAccept < 0)
            this.debounceAccept = window.setTimeout(() => this.accept(), DebounceTime);
    }
    // For each finished query in this.running, try to create a result or, if appropriate, restart the query.
    accept() {
        if (this.debounceAccept > -1)
            clearTimeout(this.debounceAccept);
        this.debounceAccept = -1;
        let updated = [];
        let conf = this.view.state.facet(completionConfig);
        for (let i = 0; i < this.running.length; i++) {
            let query = this.running[i];
            if (query.done === undefined)
                continue;
            this.running.splice(i--, 1);
            if (query.done) {
                let active = new ActiveResult(query.active.source, query.active.explicitPos, query.done, query.done.from, query.done.to ?? cur(query.updates.length ? query.updates[0].startState : this.view.state));
                // Replay the transactions that happened since the start of the request and see if that preserves the result
                for (let tr of query.updates)
                    active = active.update(tr, conf);
                if (active.hasResult()) {
                    updated.push(active);
                    continue;
                }
            }
            let current = this.view.state.field(completionState).active.find(a => a.source == query.active.source);
            if (current && current.state == 1 /* State.Pending */) {
                if (query.done == null) {
                    // Explicitly failed. Should clear the pending status if it hasn't been re-set in the meantime.
                    let active = new ActiveSource(query.active.source, 0 /* State.Inactive */);
                    for (let tr of query.updates)
                        active = active.update(tr, conf);
                    if (active.state != 1 /* State.Pending */)
                        updated.push(active);
                }
                else {
                    // Cleared by subsequent transactions. Restart.
                    this.startQuery(current);
                }
            }
        }
        if (updated.length)
            this.view.dispatch({ effects: setActiveEffect.of(updated) });
    }
}, {
    eventHandlers: {
        blur() {
            let state = this.view.state.field(completionState, false);
            if (state && state.tooltip && this.view.state.facet(completionConfig).closeOnBlur)
                this.view.dispatch({ effects: closeCompletionEffect.of(null) });
        },
        compositionstart() {
            this.composing = 1 /* CompositionState.Started */;
        },
        compositionend() {
            if (this.composing == 3 /* CompositionState.ChangedAndMoved */) {
                // Safari fires compositionend events synchronously, possibly from inside an update, so dispatch asynchronously to avoid reentrancy
                setTimeout(() => this.view.dispatch({ effects: startCompletionEffect.of(false) }), 20);
            }
            this.composing = 0 /* CompositionState.None */;
        }
    }
});
