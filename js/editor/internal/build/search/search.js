import { EditorView, ViewPlugin, Decoration, runScopeHandlers, showPanel, getPanel } from "../view/index.js";
import { EditorState, StateField, StateEffect, EditorSelection, Prec, Facet, RangeSetBuilder, CharCategory, findClusterBreak, combineConfig } from "../state/index.js";
import elt from "../utils/crelt.js";
import { SearchCursor } from "./cursor.js";
import { RegExpCursor, validRegExp } from "./regexp.js";
import { gotoLine } from "./goto-line.js";
import { selectNextOccurrence } from "./selection-match.js";
const searchConfigFacet = Facet.define({
    combine(configs) {
        return combineConfig(configs, {
            top: false,
            caseSensitive: false,
            literal: false,
            wholeWord: false,
            createPanel: view => new SearchPanel(view)
        });
    }
});
/**
 * Add search state to the editor configuration, and optionally configure the search extension.
 * ({@link openSearchPanel} will automatically enable this if it isn't already on).
 */
export function search(config) {
    return config ? [searchConfigFacet.of(config), searchExtensions] : searchExtensions;
}
/** A search query. Part of the editor's search state. */
export class SearchQuery {
    /**
     * Create a query object.
     * @param config.search The search string.
     * @param [config.cassSensitive] Controls whether the search should be case-sensitive.
     * @param [config.literal] By default, string search will replace `\n`, `\r`, and `\t` in
     *                         the query with newline, return, and tab characters. When this
     *                         is set to true, that behavior is disabled.
     * @param [config.regexp] When true, interpret the search string as a regular expression.
     * @param [config.replace] The replace text.
     * @param [config.wholeWord] Enable whole-word matching.
     */
    constructor(config) {
        this.search = config.search;
        this.caseSensitive = !!config.caseSensitive;
        this.literal = !!config.literal;
        this.regexp = !!config.regexp;
        this.replace = config.replace || "";
        this.valid = !!this.search && (!this.regexp || validRegExp(this.search));
        this.unquoted = this.unquote(this.search);
        this.wholeWord = !!config.wholeWord;
    }
    // @internal
    unquote(text) {
        return this.literal ? text :
            text.replace(/\\([nrt\\])/g, (_, ch) => ch == "n" ? "\n" : ch == "r" ? "\r" : ch == "t" ? "\t" : "\\");
    }
    /** Compare this query to another query. */
    eq(other) {
        return this.search == other.search && this.replace == other.replace &&
            this.caseSensitive == other.caseSensitive && this.regexp == other.regexp &&
            this.wholeWord == other.wholeWord;
    }
    // @internal
    create() {
        return this.regexp ? new RegExpQuery(this) : new StringQuery(this);
    }
    /** Get a search cursor for this query, searching through the given range in the given state. */
    getCursor(state, from = 0, to) {
        let st = state.doc ? state : EditorState.create({ doc: state });
        if (to == null)
            to = st.doc.length;
        return this.regexp ? regexpCursor(this, st, from, to) : stringCursor(this, st, from, to);
    }
}
class QueryType {
    constructor(spec) {
        this.spec = spec;
    }
}
function stringCursor(spec, state, from, to) {
    return new SearchCursor(state.doc, spec.unquoted, from, to, spec.caseSensitive ? undefined : x => x.toLowerCase(), spec.wholeWord ? stringWordTest(state.doc, state.charCategorizer(state.selection.main.head)) : undefined);
}
function stringWordTest(doc, categorizer) {
    return (from, to, buf, bufPos) => {
        if (bufPos > from || bufPos + buf.length < to) {
            bufPos = Math.max(0, from - 2);
            buf = doc.sliceString(bufPos, Math.min(doc.length, to + 2));
        }
        return (categorizer(charBefore(buf, from - bufPos)) != CharCategory.Word ||
            categorizer(charAfter(buf, from - bufPos)) != CharCategory.Word) &&
            (categorizer(charAfter(buf, to - bufPos)) != CharCategory.Word ||
                categorizer(charBefore(buf, to - bufPos)) != CharCategory.Word);
    };
}
class StringQuery extends QueryType {
    constructor(spec) {
        super(spec);
    }
    nextMatch(state, curFrom, curTo) {
        let cursor = stringCursor(this.spec, state, curTo, state.doc.length).nextOverlapping();
        if (cursor.done)
            cursor = stringCursor(this.spec, state, 0, curFrom).nextOverlapping();
        return cursor.done ? null : cursor.value;
    }
    // Searching in reverse is, rather than implementing inverted search cursor, done by scanning chunk after chunk forward.
    prevMatchInRange(state, from, to) {
        for (let pos = to;;) {
            let start = Math.max(from, pos - 10000 /* FindPrev.ChunkSize */ - this.spec.unquoted.length);
            let cursor = stringCursor(this.spec, state, start, pos), range = null;
            while (!cursor.nextOverlapping().done)
                range = cursor.value;
            if (range)
                return range;
            if (start == from)
                return null;
            pos -= 10000 /* FindPrev.ChunkSize */;
        }
    }
    prevMatch(state, curFrom, curTo) {
        return this.prevMatchInRange(state, 0, curFrom) ||
            this.prevMatchInRange(state, curTo, state.doc.length);
    }
    getReplacement(_result) { return this.spec.unquote(this.spec.replace); }
    matchAll(state, limit) {
        let cursor = stringCursor(this.spec, state, 0, state.doc.length), ranges = [];
        while (!cursor.next().done) {
            if (ranges.length >= limit)
                return null;
            ranges.push(cursor.value);
        }
        return ranges;
    }
    highlight(state, from, to, add) {
        let cursor = stringCursor(this.spec, state, Math.max(0, from - this.spec.unquoted.length), Math.min(to + this.spec.unquoted.length, state.doc.length));
        while (!cursor.next().done)
            add(cursor.value.from, cursor.value.to);
    }
}
function regexpCursor(spec, state, from, to) {
    return new RegExpCursor(state.doc, spec.search, {
        ignoreCase: !spec.caseSensitive,
        test: spec.wholeWord ? regexpWordTest(state.charCategorizer(state.selection.main.head)) : undefined
    }, from, to);
}
function charBefore(str, index) {
    return str.slice(findClusterBreak(str, index, false), index);
}
function charAfter(str, index) {
    return str.slice(index, findClusterBreak(str, index));
}
function regexpWordTest(categorizer) {
    return (_from, _to, match) => !match[0].length ||
        (categorizer(charBefore(match.input, match.index)) != CharCategory.Word ||
            categorizer(charAfter(match.input, match.index)) != CharCategory.Word) &&
            (categorizer(charAfter(match.input, match.index + match[0].length)) != CharCategory.Word ||
                categorizer(charBefore(match.input, match.index + match[0].length)) != CharCategory.Word);
}
class RegExpQuery extends QueryType {
    nextMatch(state, curFrom, curTo) {
        let cursor = regexpCursor(this.spec, state, curTo, state.doc.length).next();
        if (cursor.done)
            cursor = regexpCursor(this.spec, state, 0, curFrom).next();
        return cursor.done ? null : cursor.value;
    }
    prevMatchInRange(state, from, to) {
        for (let size = 1;; size++) {
            let start = Math.max(from, to - size * 10000 /* FindPrev.ChunkSize */);
            let cursor = regexpCursor(this.spec, state, start, to), range = null;
            while (!cursor.next().done)
                range = cursor.value;
            if (range && (start == from || range.from > start + 10))
                return range;
            if (start == from)
                return null;
        }
    }
    prevMatch(state, curFrom, curTo) {
        return this.prevMatchInRange(state, 0, curFrom) ||
            this.prevMatchInRange(state, curTo, state.doc.length);
    }
    getReplacement(result) {
        return this.spec.unquote(this.spec.replace.replace(/\$([$&\d+])/g, (m, i) => i == "$" ? "$"
            : i == "&" ? result.match[0]
                : i != "0" && +i < result.match.length ? result.match[i]
                    : m));
    }
    matchAll(state, limit) {
        let cursor = regexpCursor(this.spec, state, 0, state.doc.length), ranges = [];
        while (!cursor.next().done) {
            if (ranges.length >= limit)
                return null;
            ranges.push(cursor.value);
        }
        return ranges;
    }
    highlight(state, from, to, add) {
        let cursor = regexpCursor(this.spec, state, Math.max(0, from - 250 /* RegExp.HighlightMargin */), Math.min(to + 250 /* RegExp.HighlightMargin */, state.doc.length));
        while (!cursor.next().done)
            add(cursor.value.from, cursor.value.to);
    }
}
/**
 * A state effect that updates the current search query. Note that this only has an effect if the search
 * state has been initialized (by including {@link search} in your configuration or by running
 * {@link openSearchPanel} at least once).
 */
export const setSearchQuery = StateEffect.define();
const togglePanel = StateEffect.define();
const searchState = StateField.define({
    create(state) {
        return new SearchState(defaultQuery(state).create(), null);
    },
    update(value, tr) {
        for (let effect of tr.effects) {
            if (effect.is(setSearchQuery))
                value = new SearchState(effect.value.create(), value.panel);
            else if (effect.is(togglePanel))
                value = new SearchState(value.query, effect.value ? createSearchPanel : null);
        }
        return value;
    },
    provide: f => showPanel.from(f, val => val.panel)
});
/** Get the current search query from an editor state. */
export function getSearchQuery(state) {
    let curState = state.field(searchState, false);
    return curState ? curState.query.spec : defaultQuery(state);
}
/** Query whether the search panel is open in the given editor state. */
export function searchPanelOpen(state) {
    return state.field(searchState, false)?.panel != null;
}
class SearchState {
    constructor(query, panel) {
        this.query = query;
        this.panel = panel;
    }
}
const matchMark = Decoration.mark({ class: "cm-searchMatch" }), selectedMatchMark = Decoration.mark({ class: "cm-searchMatch cm-searchMatch-selected" });
const searchHighlighter = ViewPlugin.fromClass(class {
    constructor(view) {
        this.view = view;
        this.decorations = this.highlight(view.state.field(searchState));
    }
    update(update) {
        let state = update.state.field(searchState);
        if (state != update.startState.field(searchState) || update.docChanged || update.selectionSet || update.viewportChanged)
            this.decorations = this.highlight(state);
    }
    highlight({ query, panel }) {
        if (!panel || !query.spec.valid)
            return Decoration.none;
        let { view } = this;
        let builder = new RangeSetBuilder();
        for (let i = 0, ranges = view.visibleRanges, l = ranges.length; i < l; i++) {
            let { from, to } = ranges[i];
            while (i < l - 1 && to > ranges[i + 1].from - 2 * 250 /* RegExp.HighlightMargin */)
                to = ranges[++i].to;
            query.highlight(view.state, from, to, (from, to) => {
                let selected = view.state.selection.ranges.some(r => r.from == from && r.to == to);
                builder.add(from, to, selected ? selectedMatchMark : matchMark);
            });
        }
        return builder.finish();
    }
}, {
    decorations: v => v.decorations
});
function searchCommand(f) {
    return view => {
        let state = view.state.field(searchState, false);
        return state && state.query.spec.valid ? f(view, state) : openSearchPanel(view);
    };
}
/**
 * Open the search panel if it isn't already open, and move the selection to the first match
 * after the current main selection. Will wrap around to the start of the document when it
 * reaches the end.
 */
export const findNext = searchCommand((view, { query }) => {
    let { to } = view.state.selection.main;
    let next = query.nextMatch(view.state, to, to);
    if (!next)
        return false;
    view.dispatch({
        selection: { anchor: next.from, head: next.to },
        scrollIntoView: true,
        effects: announceMatch(view, next),
        userEvent: "select.search"
    });
    return true;
});
/**
 * Move the selection to the previous instance of the search query, before the current main selection.
 * Will wrap past the start of the document to start searching at the end again.
 */
export const findPrevious = searchCommand((view, { query }) => {
    let { state } = view, { from } = state.selection.main;
    let range = query.prevMatch(state, from, from);
    if (!range)
        return false;
    view.dispatch({
        selection: { anchor: range.from, head: range.to },
        scrollIntoView: true,
        effects: announceMatch(view, range),
        userEvent: "select.search"
    });
    return true;
});
/** Select all instances of the search query. */
export const selectMatches = searchCommand((view, { query }) => {
    let ranges = query.matchAll(view.state, 1000);
    if (!ranges || !ranges.length)
        return false;
    view.dispatch({
        selection: EditorSelection.create(ranges.map(r => EditorSelection.range(r.from, r.to))),
        userEvent: "select.search.matches"
    });
    return true;
});
/** Select all instances of the currently selected text. */
export const selectSelectionMatches = ({ state, dispatch }) => {
    let sel = state.selection;
    if (sel.ranges.length > 1 || sel.main.empty)
        return false;
    let { from, to } = sel.main;
    let ranges = [], main = 0;
    for (let cur = new SearchCursor(state.doc, state.sliceDoc(from, to)); !cur.next().done;) {
        if (ranges.length > 1000)
            return false;
        if (cur.value.from == from)
            main = ranges.length;
        ranges.push(EditorSelection.range(cur.value.from, cur.value.to));
    }
    dispatch(state.update({
        selection: EditorSelection.create(ranges, main),
        userEvent: "select.search.matches"
    }));
    return true;
};
/** Replace the current match of the search query. */
export const replaceNext = searchCommand((view, { query }) => {
    let { state } = view, { from, to } = state.selection.main;
    if (state.readOnly)
        return false;
    let next = query.nextMatch(state, from, from);
    if (!next)
        return false;
    let changes = [], selection, replacement;
    let announce = [];
    if (next.from == from && next.to == to) {
        replacement = state.toText(query.getReplacement(next));
        changes.push({ from: next.from, to: next.to, insert: replacement });
        next = query.nextMatch(state, next.from, next.to);
        announce.push(EditorView.announce.of(state.phrase("replaced match on line $", state.doc.lineAt(from).number) + "."));
    }
    if (next) {
        let off = changes.length == 0 || changes[0].from >= next.to ? 0 : next.to - next.from - replacement.length;
        selection = { anchor: next.from - off, head: next.to - off };
        announce.push(announceMatch(view, next));
    }
    view.dispatch({
        changes, selection,
        scrollIntoView: !!selection,
        effects: announce,
        userEvent: "input.replace"
    });
    return true;
});
/** Replace all instances of the search query with the given replacement. */
export const replaceAll = searchCommand((view, { query }) => {
    if (view.state.readOnly)
        return false;
    let changes = query.matchAll(view.state, 1e9).map(match => {
        let { from, to } = match;
        return { from, to, insert: query.getReplacement(match) };
    });
    if (!changes.length)
        return false;
    let announceText = view.state.phrase("replaced $ matches", changes.length) + ".";
    view.dispatch({
        changes,
        effects: EditorView.announce.of(announceText),
        userEvent: "input.replace.all"
    });
    return true;
});
function createSearchPanel(view) {
    return view.state.facet(searchConfigFacet).createPanel(view);
}
function defaultQuery(state, fallback) {
    let sel = state.selection.main;
    let selText = sel.empty || sel.to > sel.from + 100 ? "" : state.sliceDoc(sel.from, sel.to);
    if (fallback && !selText)
        return fallback;
    let config = state.facet(searchConfigFacet);
    return new SearchQuery({
        search: (fallback?.literal ?? config.literal) ? selText : selText.replace(/\n/g, "\\n"),
        caseSensitive: fallback?.caseSensitive ?? config.caseSensitive,
        literal: fallback?.literal ?? config.literal,
        wholeWord: fallback?.wholeWord ?? config.wholeWord
    });
}
/** Make sure the search panel is open and focused. */
export const openSearchPanel = view => {
    let state = view.state.field(searchState, false);
    if (state && state.panel) {
        let panel = getPanel(view, createSearchPanel);
        if (!panel)
            return false;
        let searchInput = panel.dom.querySelector("[main-field]");
        if (searchInput && searchInput != view.root.activeElement) {
            let query = defaultQuery(view.state, state.query.spec);
            if (query.valid)
                view.dispatch({ effects: setSearchQuery.of(query) });
            searchInput.focus();
            searchInput.select();
        }
    }
    else {
        view.dispatch({ effects: [
                togglePanel.of(true),
                state ? setSearchQuery.of(defaultQuery(view.state, state.query.spec)) : StateEffect.appendConfig.of(searchExtensions)
            ] });
    }
    return true;
};
/** Close the search panel. */
export const closeSearchPanel = view => {
    let state = view.state.field(searchState, false);
    if (!state || !state.panel)
        return false;
    let panel = getPanel(view, createSearchPanel);
    if (panel && panel.dom.contains(view.root.activeElement))
        view.focus();
    view.dispatch({ effects: togglePanel.of(false) });
    return true;
};
/**
 * Default search-related key bindings.
 *
 *  - Mod-f: {@link openSearchPanel}
 *  - F3, Mod-g: {@link findNext}
 *  - Shift-F3, Shift-Mod-g: {@link findPrevious}
 *  - Alt-g: {@link gotoLine}
 *  - Mod-d: {@link selectNextOccurrence}
 */
export const searchKeymap = [
    { key: "Mod-f", run: openSearchPanel, scope: "editor search-panel" },
    { key: "F3", run: findNext, shift: findPrevious, scope: "editor search-panel", preventDefault: true },
    { key: "Mod-g", run: findNext, shift: findPrevious, scope: "editor search-panel", preventDefault: true },
    { key: "Escape", run: closeSearchPanel, scope: "editor search-panel" },
    { key: "Mod-Shift-l", run: selectSelectionMatches },
    { key: "Alt-g", run: gotoLine },
    { key: "Mod-d", run: selectNextOccurrence, preventDefault: true },
];
class SearchPanel {
    constructor(view) {
        this.view = view;
        let query = this.query = view.state.field(searchState).query.spec;
        this.commit = this.commit.bind(this);
        this.searchField = elt("input", {
            value: query.search,
            placeholder: phrase(view, "Find"),
            "aria-label": phrase(view, "Find"),
            class: "cm-textfield",
            name: "search",
            form: "",
            "main-field": "true",
            onchange: this.commit,
            onkeyup: this.commit
        });
        this.replaceField = elt("input", {
            value: query.replace,
            placeholder: phrase(view, "Replace"),
            "aria-label": phrase(view, "Replace"),
            class: "cm-textfield",
            name: "replace",
            form: "",
            onchange: this.commit,
            onkeyup: this.commit
        });
        this.caseField = elt("input", {
            type: "checkbox",
            name: "case",
            form: "",
            checked: query.caseSensitive,
            onchange: this.commit
        });
        this.reField = elt("input", {
            type: "checkbox",
            name: "re",
            form: "",
            checked: query.regexp,
            onchange: this.commit
        });
        this.wordField = elt("input", {
            type: "checkbox",
            name: "word",
            form: "",
            checked: query.wholeWord,
            onchange: this.commit
        });
        function button(name, onclick, content) {
            return elt("button", { class: "cm-button", name, onclick, type: "button" }, content);
        }
        this.dom = elt("div", { onkeydown: (e) => this.keydown(e), class: "cm-search" }, [
            this.searchField,
            button("next", () => findNext(view), [phrase(view, "next")]),
            button("prev", () => findPrevious(view), [phrase(view, "previous")]),
            button("select", () => selectMatches(view), [phrase(view, "all")]),
            elt("label", null, [this.caseField, phrase(view, "match case")]),
            elt("label", null, [this.reField, phrase(view, "regexp")]),
            elt("label", null, [this.wordField, phrase(view, "by word")]),
            ...view.state.readOnly ? [] : [
                elt("br"),
                this.replaceField,
                button("replace", () => replaceNext(view), [phrase(view, "replace")]),
                button("replaceAll", () => replaceAll(view), [phrase(view, "replace all")]),
                elt("button", {
                    name: "close",
                    onclick: () => closeSearchPanel(view),
                    "aria-label": phrase(view, "close"),
                    type: "button"
                }, ["×"])
            ]
        ]);
    }
    commit() {
        let query = new SearchQuery({
            search: this.searchField.value,
            caseSensitive: this.caseField.checked,
            regexp: this.reField.checked,
            wholeWord: this.wordField.checked,
            replace: this.replaceField.value
        });
        if (!query.eq(this.query)) {
            this.query = query;
            this.view.dispatch({ effects: setSearchQuery.of(query) });
        }
    }
    keydown(e) {
        if (runScopeHandlers(this.view, e, "search-panel")) {
            e.preventDefault();
        }
        else if (e.keyCode == 13 && e.target == this.searchField) {
            e.preventDefault();
            (e.shiftKey ? findPrevious : findNext)(this.view);
        }
        else if (e.keyCode == 13 && e.target == this.replaceField) {
            e.preventDefault();
            replaceNext(this.view);
        }
    }
    update(update) {
        for (let tr of update.transactions)
            for (let effect of tr.effects) {
                if (effect.is(setSearchQuery) && !effect.value.eq(this.query))
                    this.setQuery(effect.value);
            }
    }
    setQuery(query) {
        this.query = query;
        this.searchField.value = query.search;
        this.replaceField.value = query.replace;
        this.caseField.checked = query.caseSensitive;
        this.reField.checked = query.regexp;
        this.wordField.checked = query.wholeWord;
    }
    mount() {
        this.searchField.select();
    }
    get pos() { return 80; }
    get top() { return this.view.state.facet(searchConfigFacet).top; }
}
function phrase(view, phrase) { return view.state.phrase(phrase); }
const AnnounceMargin = 30;
const Break = /[\s\.,:;?!]/;
function announceMatch(view, { from, to }) {
    let line = view.state.doc.lineAt(from), lineEnd = view.state.doc.lineAt(to).to;
    let start = Math.max(line.from, from - AnnounceMargin), end = Math.min(lineEnd, to + AnnounceMargin);
    let text = view.state.sliceDoc(start, end);
    if (start != line.from) {
        for (let i = 0; i < AnnounceMargin; i++)
            if (!Break.test(text[i + 1]) && Break.test(text[i])) {
                text = text.slice(i);
                break;
            }
    }
    if (end != lineEnd) {
        for (let i = text.length - 1; i > text.length - AnnounceMargin; i--)
            if (!Break.test(text[i - 1]) && Break.test(text[i])) {
                text = text.slice(0, i);
                break;
            }
    }
    return EditorView.announce.of(`${view.state.phrase("current match")}. ${text} ${view.state.phrase("on line")} ${line.number}.`);
}
const baseTheme = EditorView.baseTheme({
    ".cm-panel.cm-search": {
        padding: "2px 6px 4px",
        position: "relative",
        "& [name=close]": {
            position: "absolute",
            top: "0",
            right: "4px",
            backgroundColor: "inherit",
            border: "none",
            font: "inherit",
            padding: 0,
            margin: 0
        },
        "& input, & button, & label": {
            margin: ".2em .6em .2em 0"
        },
        "& input[type=checkbox]": {
            marginRight: ".2em"
        },
        "& label": {
            fontSize: "80%",
            whiteSpace: "pre"
        }
    },
    "&light .cm-searchMatch": { backgroundColor: "#ffff0054" },
    "&dark .cm-searchMatch": { backgroundColor: "#00ffff8a" },
    "&light .cm-searchMatch-selected": { backgroundColor: "#ff6a0054" },
    "&dark .cm-searchMatch-selected": { backgroundColor: "#ff00ff8a" }
});
const searchExtensions = [
    searchState,
    Prec.lowest(searchHighlighter),
    baseTheme
];
