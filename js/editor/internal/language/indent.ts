import {NodeProp, SyntaxNode, Tree} from "../lezer/common/index"
import {EditorState, Extension, Facet, countColumn, ChangeSpec} from "../state/index"
import {syntaxTree} from "./language"

/**
 * Facet that defines a way to provide a function that computes the appropriate indentation depth, as
 * a column number (see {@link indentString}), at the start of a given line, or `null` to indicate no
 * appropriate indentation could be determined.
 */
export const indentService = Facet.define<(context: IndentContext, pos: number) => number | null>()

export const indentUnit = Facet.define<string, string>({
    combine: values => {
        if (!values.length) return "  "
        if (!/^(?: +|\t+)$/.test(values[0])) throw new Error("Invalid indent unit: " + JSON.stringify(values[0]))
        return values[0]
    }
})

export function getIndentUnit(state: EditorState) {
    let unit = state.facet(indentUnit)
    return unit.charCodeAt(0) == 9 ? state.tabSize * unit.length : unit.length
}

export function indentString(state: EditorState, cols: number) {
    let result = "", ts = state.tabSize
    if (state.facet(indentUnit).charCodeAt(0) == 9) while (cols >= ts) {
        result += "\t"
        cols -= ts
    }
    for (let i = 0; i < cols; i++) result += " "
    return result
}

export function getIndentation(context: IndentContext | EditorState, pos: number): number | null {
    if (context instanceof EditorState) context = new IndentContext(context)
    for (let service of context.state.facet(indentService)) {
        let result = service(context, pos)
        if (result != null) return result
    }
    let tree = syntaxTree(context.state)
    return tree ? syntaxIndentation(context, tree, pos) : null
}

export function indentRange(state: EditorState, from: number, to: number) {
    let updated: {[lineStart: number]: number} = Object.create(null)
    let context = new IndentContext(state, {overrideIndentation: start => updated[start] ?? -1})
    let changes: ChangeSpec[] = []
    for (let pos = from; pos <= to;) {
        let line = state.doc.lineAt(pos)
        pos = line.to + 1
        let indent = getIndentation(context, line.from)
        if (indent == null) continue
        if (!/\S/.test(line.text)) indent = 0
        let cur = /^\s*/.exec(line.text)![0]
        let norm = indentString(state, indent)
        if (cur != norm) {
            updated[line.from] = indent
            changes.push({from: line.from, to: line.from + cur.length, insert: norm})
        }
    }
    return state.changes(changes)
}

export class IndentContext {
    unit: number

    constructor(
        readonly state: EditorState,
        // @internal
        readonly options: {
            overrideIndentation?: (pos: number) => number,
            simulateBreak?: number,
            simulateDoubleBreak?: boolean
        } = {}
    ) {
        this.unit = getIndentUnit(state)
    }

    lineAt(pos: number, bias: -1 | 1 = 1): {text: string, from: number} {
        let line = this.state.doc.lineAt(pos)
        let {simulateBreak, simulateDoubleBreak} = this.options
        if (simulateBreak != null && simulateBreak >= line.from && simulateBreak <= line.to) {
            if (simulateDoubleBreak && simulateBreak == pos)
                return {text: "", from: pos}
            else if (bias < 0 ? simulateBreak < pos : simulateBreak <= pos)
                return {text: line.text.slice(simulateBreak - line.from), from: simulateBreak}
            else
                return {text: line.text.slice(0, simulateBreak - line.from), from: line.from}
        }
        return line
    }

    textAfterPos(pos: number, bias: -1 | 1 = 1) {
        if (this.options.simulateDoubleBreak && pos == this.options.simulateBreak) return ""
        let {text, from} = this.lineAt(pos, bias)
        return text.slice(pos - from, Math.min(text.length, pos + 100 - from))
    }

    column(pos: number, bias: -1 | 1 = 1) {
        let {text, from} = this.lineAt(pos, bias)
        let result = this.countColumn(text, pos - from)
        let override = this.options.overrideIndentation ? this.options.overrideIndentation(from) : -1
        if (override > -1) result += override - this.countColumn(text, text.search(/\S|$/))
        return result
    }

    countColumn(line: string, pos: number = line.length) {
        return countColumn(line, this.state.tabSize, pos)
    }

    lineIndent(pos: number, bias: -1 | 1 = 1) {
        let {text, from} = this.lineAt(pos, bias)
        let override = this.options.overrideIndentation
        if (override) {
            let overriden = override(from)
            if (overriden > -1) return overriden
        }
        return this.countColumn(text, text.search(/\S|$/))
    }

    get simulatedBreak(): number | null {
        return this.options.simulateBreak || null
    }
}

export const indentNodeProp = new NodeProp<(context: TreeIndentContext) => number | null>()

// Compute the indentation for a given position from the syntax tree.
function syntaxIndentation(cx: IndentContext, ast: Tree, pos: number) {
    return indentFrom(ast.resolveInner(pos).enterUnfinishedNodesBefore(pos), pos, cx)
}

function ignoreClosed(cx: TreeIndentContext) {
    return cx.pos == cx.options.simulateBreak && cx.options.simulateDoubleBreak
}

function indentStrategy(tree: SyntaxNode): ((context: TreeIndentContext) => number | null) | null {
    let strategy = tree.type.prop(indentNodeProp)
    if (strategy) return strategy
    let first = tree.firstChild, close: readonly string[] | undefined
    if (first && (close = first.type.prop(NodeProp.closedBy))) {
        let last = tree.lastChild, closed = last && close.indexOf(last.name) > -1
        return cx => delimitedStrategy(cx, true, 1, undefined, closed && !ignoreClosed(cx) ? last!.from : undefined)
    }
    return tree.parent == null ? topIndent : null
}

function indentFrom(node: SyntaxNode | null, pos: number, base: IndentContext) {
    for (; node; node = node.parent) {
        let strategy = indentStrategy(node)
        if (strategy) return strategy(TreeIndentContext.create(base, pos, node))
    }
    return null
}

function topIndent() { return 0 }

/** Objects of this type provide context information and helper methods to indentation functions registered on syntax nodes. */
export class TreeIndentContext extends IndentContext {
    private constructor(private base: IndentContext, readonly pos: number, readonly node: SyntaxNode) {
        super(base.state, base.options)
    }

    // @internal
    static create(base: IndentContext, pos: number, node: SyntaxNode) {
        return new TreeIndentContext(base, pos, node)
    }

    /**
     * Get the text directly after `this.pos`, either the entire line or the next 100 characters,
     * whichever is shorter.
     */
    get textAfter() {
        return this.textAfterPos(this.pos)
    }

    /**
     * Get the indentation at the reference line for `this.node`, which is the line on which it starts,
     * unless there is a node that is _not_ a parent of this node covering the start of that line. If
     * so, the line at the start of that node is tried, again skipping on if it is covered by another
     * such node.
     */
    get baseIndent() {
        let line = this.state.doc.lineAt(this.node.from)
        // Skip line starts that are covered by a sibling (or cousin, etc)
        for (;;) {
            let atBreak = this.node.resolve(line.from)
            while (atBreak.parent && atBreak.parent.from == atBreak.from) atBreak = atBreak.parent
            if (isParent(atBreak, this.node)) break
            line = this.state.doc.lineAt(atBreak.from)
        }
        return this.lineIndent(line.from)
    }

    /** Continue looking for indentations in the node's parent nodes, and return the result of that. */
    continue() {
        let parent = this.node.parent
        return parent ? indentFrom(parent, this.pos, this.base) : 0
    }
}

function isParent(parent: SyntaxNode, of: SyntaxNode) {
    for (let cur: SyntaxNode | null = of; cur; cur = cur.parent) if (parent == cur) return true
    return false
}

// Check whether a delimited node is aligned (meaning there are
// non-skipped nodes on the same line as the opening delimiter). And
// if so, return the opening token.
function bracketedAligned(context: TreeIndentContext) {
    let tree = context.node
    let openToken = tree.childAfter(tree.from), last = tree.lastChild
    if (!openToken) return null
    let sim = context.options.simulateBreak
    let openLine = context.state.doc.lineAt(openToken.from)
    let lineEnd = sim == null || sim <= openLine.from ? openLine.to : Math.min(openLine.to, sim)
    for (let pos = openToken.to;;) {
        let next = tree.childAfter(pos)
        if (!next || next == last) return null
        if (!next.type.isSkipped)
            return next.from < lineEnd ? openToken : null
        pos = next.to
    }
}

/**
 * An indentation strategy for delimited (usually bracketed) nodes. Will, by default, indent one unit more
 * than the parent's base indent unless the line starts with a closing token. When `align` is true and
 * there are non-skipped nodes on the node's opening line, the content of the node will be aligned with the
 * end of the opening node, like this:
 *     foo(bar,
 *         baz)
 */
export function delimitedIndent({closing, align = true, units = 1}: {closing: string, align?: boolean, units?: number}) {
    return (context: TreeIndentContext) => delimitedStrategy(context, align, units, closing)
}

function delimitedStrategy(context: TreeIndentContext, align: boolean, units: number, closing?: string, closedAt?: number) {
    let after = context.textAfter, space = after.match(/^\s*/)![0].length
    let closed = closing && after.slice(space, space + closing.length) == closing || closedAt == context.pos + space
    let aligned = align ? bracketedAligned(context) : null
    if (aligned) return closed ? context.column(aligned.from) : context.column(aligned.to)
    return context.baseIndent + (closed ? 0 : context.unit * units)
}

/** An indentation strategy that aligns a node's content to its base indentation. */
export const flatIndent = (context: TreeIndentContext) => context.baseIndent

/**
 * Creates an indentation strategy that, by default, indents continued lines one unit more than the node's
 * base indentation. You can provide `except` to prevent indentation of lines that match a pattern (for
 * example `/^else\b/` in `if`/`else` constructs), and you can change the amount of units used with the
 * `units` option.
 */
export function continuedIndent({except, units = 1}: {except?: RegExp, units?: number} = {}) {
    return (context: TreeIndentContext) => {
        let matchExcept = except && except.test(context.textAfter)
        return context.baseIndent + (matchExcept ? 0 : units * context.unit)
    }
}

const DontIndentBeyond = 200

/**
 * Enables reindentation on input. When a language defines an `indentOnInput` field in its
 * [language data]{@link EditorState.languageDataAt}, which must hold a regular expression, the line at
 * the cursor will be reindented whenever new text is typed and the input from the start of the line up
 * to the cursor matches that regexp.
 *
 * To avoid unneccesary reindents, it is recommended to start the regexp with `^` (usually followed by
 * `\s*`), and end it with `$`. For example, `/^\s*\}$/` will reindent when a closing brace is added at
 * the start of a line.
 */
export function indentOnInput(): Extension {
    return EditorState.transactionFilter.of(tr => {
        if (!tr.docChanged || !tr.isUserEvent("input.type") && !tr.isUserEvent("input.complete")) return tr
        let rules = tr.startState.languageDataAt<RegExp>("indentOnInput", tr.startState.selection.main.head)
        if (!rules.length) return tr
        let doc = tr.newDoc, {head} = tr.newSelection.main, line = doc.lineAt(head)
        if (head > line.from + DontIndentBeyond) return tr
        let lineStart = doc.sliceString(line.from, head)
        if (!rules.some(r => r.test(lineStart))) return tr
        let {state} = tr, last = -1, changes = []
        for (let {head} of state.selection.ranges) {
            let line = state.doc.lineAt(head)
            if (line.from == last) continue
            last = line.from
            let indent = getIndentation(state, line.from)
            if (indent == null) continue
            let cur = /^\s*/.exec(line.text)![0]
            let norm = indentString(state, indent)
            if (cur != norm)
                changes.push({from: line.from, to: line.from + cur.length, insert: norm})
        }
        return changes.length ? [tr, {changes, sequential: true}] : tr
    })
}
