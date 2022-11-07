import {Parser} from "./parse"

// The default maximum length of a `TreeBuffer` node.
export const DefaultBufferLength = 1024

let nextPropID = 0

export class Range {
    constructor(readonly from: number, readonly to: number) {}
}

export class NodeProp<T> {
    // @internal
    id: number

    perNode: boolean

    /**
     * A method that deserializes a value of this prop from a string. Can be used to
     * allow a prop to be directly written in a grammar file.
     */
    deserialize: (str: string) => T

    constructor(config: { deserialize?: (str: string) => T, perNode?: boolean } = {}) {
        this.id = nextPropID++
        this.perNode = !!config.perNode
        this.deserialize = config.deserialize || (() => {
            throw new Error("This node type doesn't define a deserialize function")
        })
    }

    add(match: {[selector: string]: T} | ((type: NodeType) => T | undefined)): NodePropSource {
        if (this.perNode) throw new RangeError("Can't add per-node props to node types")
        if (typeof match != "function") match = NodeType.match(match)
        return (type) => {
            let result = (match as (type: NodeType) => T | undefined)(type)
            return result === undefined ? null : [this, result]
        }
    }

    static closedBy = new NodeProp<readonly string[]>({deserialize: str => str.split(" ")})

    static openedBy = new NodeProp<readonly string[]>({deserialize: str => str.split(" ")})

    static group = new NodeProp<readonly string[]>({deserialize: str => str.split(" ")})

    static contextHash = new NodeProp<number>({perNode: true})

    static lookAhead = new NodeProp<number>({perNode: true})

    static mounted = new NodeProp<MountedTree>({perNode: true})
}

export class MountedTree {
    constructor(
        readonly tree: Tree,
        readonly overlay: readonly {from: number, to: number}[] | null,
        readonly parser: Parser
    ) {}
}

export type NodePropSource = (type: NodeType) => null | [NodeProp<any>, any]

// Note: this is duplicated in lr/src/constants.ts
const enum NodeFlag {
    Top = 1,
    Skipped = 2,
    Error = 4,
    Anonymous = 8
}

const noProps: {[propID: number]: any} = Object.create(null)

export class NodeType {
    // @internal
    constructor(
        readonly name: string,
        // @internal
        readonly props: {readonly [prop: number]: any},
        readonly id: number,
        // @internal
        readonly flags: number = 0) {}

    static define(spec: {
        id: number,
        name?: string,
        props?: readonly ([NodeProp<any>, any] | NodePropSource)[],
        top?: boolean,
        error?: boolean,
        skipped?: boolean
    }) {
        let props = spec.props && spec.props.length ? Object.create(null) : noProps
        let flags = (spec.top ? NodeFlag.Top : 0) | (spec.skipped ? NodeFlag.Skipped : 0) |
                    (spec.error ? NodeFlag.Error : 0) | (spec.name == null ? NodeFlag.Anonymous : 0)
        let type = new NodeType(spec.name || "", props, spec.id, flags)
        if (spec.props) for (let src of spec.props) {
            if (!Array.isArray(src)) src = src(type)!
            if (src) {
                if (src[0].perNode) throw new RangeError("Can't store a per-node prop on a node type")
                props[src[0].id] = src[1]
            }
        }
        return type
    }

    prop<T>(prop: NodeProp<T>): T | undefined { return this.props[prop.id] }

    get isTop() { return (this.flags & NodeFlag.Top) > 0 }

    get isSkipped() { return (this.flags & NodeFlag.Skipped) > 0 }

    get isError() { return (this.flags & NodeFlag.Error) > 0 }

    get isAnonymous() { return (this.flags & NodeFlag.Anonymous) > 0 }

    is(name: string | number) {
        if (typeof name == 'string') {
            if (this.name == name) return true
            let group = this.prop(NodeProp.group)
            return group ? group.indexOf(name) > -1 : false
        }
        return this.id == name
    }

    static none: NodeType = new NodeType("", Object.create(null), 0, NodeFlag.Anonymous)

    static match<T>(map: {[selector: string]: T}): (node: NodeType) => T | undefined {
        let direct = Object.create(null)
        for (let prop in map)
            for (let name of prop.split(" ")) direct[name] = map[prop]
        return (node: NodeType) => {
            for (let groups = node.prop(NodeProp.group), i = -1; i < (groups ? groups.length : 0); i++) {
                let found = direct[i < 0 ? node.name : groups![i]]
                if (found) return found
            }
        }
    }
}

export class NodeSet {
    constructor(readonly types: readonly NodeType[]) {
        for (let i = 0; i < types.length; i++) if (types[i].id != i)
            throw new RangeError("Node type ids should correspond to array positions when creating a node set")
    }

    extend(...props: NodePropSource[]): NodeSet {
        let newTypes: NodeType[] = []
        for (let type of this.types) {
            let newProps: null | {[id: number]: any} = null
            for (let source of props) {
                let add = source(type)
                if (add) {
                    if (!newProps) newProps = Object.assign({}, type.props)
                    newProps[add[0].id] = add[1]
                }
            }
            newTypes.push(newProps ? new NodeType(type.name, newProps, type.id, type.flags) : type)
        }
        return new NodeSet(newTypes)
    }
}

const CachedNode = new WeakMap<Tree, SyntaxNode>(), CachedInnerNode = new WeakMap<Tree, SyntaxNode>()

export enum IterMode {
    ExcludeBuffers = 1,
    IncludeAnonymous = 2,
    IgnoreMounts = 4,
    IgnoreOverlays = 8,
}

export class Tree {
    // @internal
    props: null | {[id: number]: any} = null

    constructor(
        readonly type: NodeType,
        readonly children: readonly (Tree | TreeBuffer)[],
        readonly positions: readonly number[],
        readonly length: number,
        props?: readonly [NodeProp<any> | number, any][]
    ) {
        if (props && props.length) {
            this.props = Object.create(null)
            for (let [prop, value] of props) this.props![typeof prop == "number" ? prop : prop.id] = value
        }
    }

    // @internal
    toString(): string {
        let mounted = this.prop(NodeProp.mounted)
        if (mounted && !mounted.overlay) return mounted.tree.toString()
        let children = ""
        for (let ch of this.children) {
            let str = ch.toString()
            if (str) {
                if (children) children += ","
                children += str
            }
        }
        return !this.type.name ? children :
            (/\W/.test(this.type.name) && !this.type.isError ? JSON.stringify(this.type.name) : this.type.name) +
            (children.length ? "(" + children + ")" : "")
    }

    static empty = new Tree(NodeType.none, [], [], 0)

    cursor(mode: IterMode = 0) {
        return new TreeCursor(this.topNode as TreeNode, mode)
    }

    cursorAt(pos: number, side: -1 | 0 | 1 = 0, mode: IterMode = 0): TreeCursor {
        let scope = CachedNode.get(this) || this.topNode
        let cursor = new TreeCursor(scope as TreeNode | BufferNode)
        cursor.moveTo(pos, side)
        CachedNode.set(this, cursor._tree)
        return cursor
    }

    get topNode(): SyntaxNode {
        return new TreeNode(this, 0, 0, null)
    }

    resolve(pos: number, side: -1 | 0 | 1 = 0) {
        let node = resolveNode(CachedNode.get(this) || this.topNode, pos, side, false)
        CachedNode.set(this, node)
        return node
    }

    resolveInner(pos: number, side: -1 | 0 | 1 = 0) {
        let node = resolveNode(CachedInnerNode.get(this) || this.topNode, pos, side, true)
        CachedInnerNode.set(this, node)
        return node
    }

    iterate(spec: {
        enter(node: SyntaxNodeRef): boolean | void,
        leave?(node: SyntaxNodeRef): void,
        from?: number,
        to?: number,
        mode?: IterMode
    }) {
        let {enter, leave, from = 0, to = this.length} = spec
        for (let c = this.cursor((spec.mode || 0) | IterMode.IncludeAnonymous);;) {
            let entered = false
            if (c.from <= to && c.to >= from && (c.type.isAnonymous || enter(c) !== false)) {
                if (c.firstChild()) continue
                entered = true
            }
            for (;;) {
                if (entered && leave && !c.type.isAnonymous) leave(c)
                if (c.nextSibling()) break
                if (!c.parent()) return
                entered = true
            }
        }
    }

    prop<T>(prop: NodeProp<T>): T | undefined {
        return !prop.perNode ? this.type.prop(prop) : this.props ? this.props[prop.id] : undefined
    }

    get propValues(): readonly [NodeProp<any> | number, any][] {
        let result: [NodeProp<any> | number, any][] = []
        if (this.props) for (let id in this.props) result.push([+id, this.props[id]])
        return result
    }

    balance(config: {
        makeTree?: (children: readonly (Tree | TreeBuffer)[], positions: readonly number[], length: number) => Tree
    } = {}) {
        return this.children.length <= Balance.BranchFactor ? this :
            balanceRange(NodeType.none, this.children, this.positions, 0, this.children.length, 0, this.length,
                (children, positions, length) => new Tree(this.type, children, positions, length, this.propValues),
                config.makeTree || ((children, positions, length) => new Tree(NodeType.none, children, positions, length)))
    }

    static build(data: BuildData) { return buildTree(data) }
}

type BuildData = {
    buffer: BufferCursor | readonly number[],
    nodeSet: NodeSet,
    topID: number,
    start?: number,
    bufferStart?: number,
    length?: number,
    maxBufferLength?: number,
    reused?: readonly Tree[],
    minRepeatType?: number
}

export interface BufferCursor {
    pos: number
    id: number
    start: number
    end: number
    size: number
    next(): void
    fork(): BufferCursor
}

class FlatBufferCursor implements BufferCursor {
    constructor(readonly buffer: readonly number[], public index: number) {}

    get id() { return this.buffer[this.index - 4] }
    get start() { return this.buffer[this.index - 3] }
    get end() { return this.buffer[this.index - 2] }
    get size() { return this.buffer[this.index - 1] }

    get pos() { return this.index }

    next() { this.index -= 4 }

    fork() { return new FlatBufferCursor(this.buffer, this.index) }
}

export class TreeBuffer {
    constructor(readonly buffer: Uint16Array, readonly length: number, readonly set: NodeSet) {}

    // @internal
    get type() { return NodeType.none }

    // @internal
    toString() {
        let result: string[] = []
        for (let index = 0; index < this.buffer.length;) {
            result.push(this.childString(index))
            index = this.buffer[index + 3]
        }
        return result.join(",")
    }

    // @internal
    childString(index: number): string {
        let id = this.buffer[index], endIndex = this.buffer[index + 3]
        let type = this.set.types[id], result = type.name
        if (/\W/.test(result) && !type.isError) result = JSON.stringify(result)
        index += 4
        if (endIndex == index) return result
        let children: string[] = []
        while (index < endIndex) {
            children.push(this.childString(index))
            index = this.buffer[index + 3]
        }
        return result + "(" + children.join(",") + ")"
    }

    // @internal
    findChild(startIndex: number, endIndex: number, dir: 1 | -1, pos: number, side: Side) {
        let {buffer} = this, pick = -1
        for (let i = startIndex; i != endIndex; i = buffer[i + 3]) {
            if (checkSide(side, pos, buffer[i + 1], buffer[i + 2])) {
                pick = i
                if (dir > 0) break
            }
        }
        return pick
    }

    // @internal
    slice(startI: number, endI: number, from: number, to: number) {
        let b = this.buffer
        let copy = new Uint16Array(endI - startI)
        for (let i = startI, j = 0; i < endI;) {
            copy[j++] = b[i++]
            copy[j++] = b[i++] - from
            copy[j++] = b[i++] - from
            copy[j++] = b[i++] - startI
        }
        return new TreeBuffer(copy, to - from, this.set)
    }
}

export interface SyntaxNodeRef {
    readonly from: number
    readonly to: number
    readonly type: NodeType
    readonly name: string
    readonly tree: Tree | null
    readonly node: SyntaxNode
    /** Test whether the node matches a given context. */
    matchContext(context: readonly string[]): boolean
}

export interface SyntaxNode extends SyntaxNodeRef {
    parent: SyntaxNode | null
    firstChild: SyntaxNode | null
    lastChild: SyntaxNode | null
    childAfter(pos: number): SyntaxNode | null
    childBefore(pos: number): SyntaxNode | null
    enter(pos: number, side: -1 | 0 | 1, mode?: IterMode): SyntaxNode | null
    nextSibling: SyntaxNode | null
    prevSibling: SyntaxNode | null
    cursor(mode?: IterMode): TreeCursor
    resolve(pos: number, side?: -1 | 0 | 1): SyntaxNode
    resolveInner(pos: number, side?: -1 | 0 | 1): SyntaxNode
    enterUnfinishedNodesBefore(pos: number): SyntaxNode
    toTree(): Tree

    getChild(type: string | number, before?: string | number | null, after?: string | number | null): SyntaxNode | null

    getChildren(type: string | number, before?: string | number | null, after?: string | number | null): SyntaxNode[]

    matchContext(context: readonly string[]): boolean
}

const enum Side {
    Before = -2,
    AtOrBefore = -1,
    Around = 0,
    AtOrAfter = 1,
    After = 2,
    DontCare = 4
}

function checkSide(side: Side, pos: number, from: number, to: number) {
    switch (side) {
        case Side.Before: return from < pos
        case Side.AtOrBefore: return to >= pos && from < pos
        case Side.Around: return from < pos && to > pos
        case Side.AtOrAfter: return from <= pos && to > pos
        case Side.After: return to > pos
        case Side.DontCare: return true
    }
}

function enterUnfinishedNodesBefore(node: SyntaxNode, pos: number) {
    let scan = node.childBefore(pos)
    while (scan) {
        let last = scan.lastChild
        if (!last || last.to != scan.to) break
        if (last.type.isError && last.from == last.to) {
            node = scan
            scan = last.prevSibling
        } else {
            scan = last
        }
    }
    return node
}

function resolveNode(node: SyntaxNode, pos: number, side: -1 | 0 | 1, overlays: boolean): SyntaxNode {
    // Move up to a node that actually holds the position, if possible
    while (node.from == node.to ||
    (side < 1 ? node.from >= pos : node.from > pos) ||
    (side > -1 ? node.to <= pos : node.to < pos)) {
        let parent = !overlays && node instanceof TreeNode && node.index < 0 ? null : node.parent
        if (!parent) return node
        node = parent
    }
    let mode = overlays ? 0 : IterMode.IgnoreOverlays
    // Must go up out of overlays when those do not overlap with pos
    if (overlays) for (let scan: SyntaxNode | null = node, parent = scan.parent; parent; scan = parent, parent = scan.parent) {
        if (scan instanceof TreeNode && scan.index < 0 && parent.enter(pos, side, mode)?.from != scan.from)
            node = parent
    }
    for (;;) {
        let inner = node.enter(pos, side, mode)
        if (!inner) return node
        node = inner
    }
}

export class TreeNode implements SyntaxNode {
    constructor(readonly _tree: Tree,
                readonly from: number,
                // Index in parent node, set to -1 if the node is not a direct child of _parent.node (overlay)
                readonly index: number,
                readonly _parent: TreeNode | null) {}

    get type() { return this._tree.type }

    get name() { return this._tree.type.name }

    get to() { return this.from + this._tree.length }

    nextChild(i: number, dir: 1 | -1, pos: number, side: Side, mode: IterMode = 0): TreeNode | BufferNode | null {
        for (let parent: TreeNode = this;;) {
            for (let {children, positions} = parent._tree, e = dir > 0 ? children.length : -1; i != e; i += dir) {
                let next = children[i], start = positions[i] + parent.from
                if (!checkSide(side, pos, start, start + next.length)) continue
                if (next instanceof TreeBuffer) {
                    if (mode & IterMode.ExcludeBuffers) continue
                    let index = next.findChild(0, next.buffer.length, dir, pos - start, side)
                    if (index > -1) return new BufferNode(new BufferContext(parent, next, i, start), null, index)
                } else if ((mode & IterMode.IncludeAnonymous) || (!next.type.isAnonymous || hasChild(next))) {
                    let mounted
                    if (!(mode & IterMode.IgnoreMounts) &&
                        next.props && (mounted = next.prop(NodeProp.mounted)) && !mounted.overlay)
                        return new TreeNode(mounted.tree, start, i, parent)
                    let inner = new TreeNode(next, start, i, parent)
                    return (mode & IterMode.IncludeAnonymous) || !inner.type.isAnonymous ? inner
                        : inner.nextChild(dir < 0 ? next.children.length - 1 : 0, dir, pos, side)
                }
            }
            if ((mode & IterMode.IncludeAnonymous) || !parent.type.isAnonymous) return null
            if (parent.index >= 0) i = parent.index + dir
            else i = dir < 0 ? -1 : parent._parent!._tree.children.length
            parent = parent._parent!
            if (!parent) return null
        }
    }

    get firstChild() { return this.nextChild(0, 1, 0, Side.DontCare) }
    get lastChild() { return this.nextChild(this._tree.children.length - 1, -1, 0, Side.DontCare) }

    childAfter(pos: number) { return this.nextChild(0, 1, pos, Side.After) }
    childBefore(pos: number) { return this.nextChild(this._tree.children.length - 1, -1, pos, Side.Before) }

    enter(pos: number, side: -1 | 0 | 1, mode = 0) {
        let mounted
        if (!(mode & IterMode.IgnoreOverlays) && (mounted = this._tree.prop(NodeProp.mounted)) && mounted.overlay) {
            let rPos = pos - this.from
            for (let {from, to} of mounted.overlay) {
                if ((side > 0 ? from <= rPos : from < rPos) &&
                    (side < 0 ? to >= rPos : to > rPos))
                    return new TreeNode(mounted.tree, mounted.overlay[0].from + this.from, -1, this)
            }
        }
        return this.nextChild(0, 1, pos, side, mode)
    }

    nextSignificantParent() {
        let val: TreeNode = this
        while (val.type.isAnonymous && val._parent) val = val._parent
        return val
    }

    get parent(): TreeNode | null {
        return this._parent ? this._parent.nextSignificantParent() : null
    }

    get nextSibling(): SyntaxNode | null {
        return this._parent && this.index >= 0 ? this._parent.nextChild(this.index + 1, 1, 0, Side.DontCare) : null
    }
    get prevSibling(): SyntaxNode | null {
        return this._parent && this.index >= 0 ? this._parent.nextChild(this.index - 1, -1, 0, Side.DontCare) : null
    }

    cursor(mode: IterMode = 0) { return new TreeCursor(this, mode) }

    get tree() { return this._tree }

    toTree() { return this._tree }

    resolve(pos: number, side: -1 | 0 | 1 = 0) {
        return resolveNode(this, pos, side, false)
    }

    resolveInner(pos: number, side: -1 | 0 | 1 = 0) {
        return resolveNode(this, pos, side, true)
    }

    enterUnfinishedNodesBefore(pos: number) { return enterUnfinishedNodesBefore(this, pos) }

    getChild(type: string | number, before: string | number | null = null, after: string | number | null = null) {
        let r = getChildren(this, type, before, after)
        return r.length ? r[0] : null
    }

    getChildren(type: string | number, before: string | number | null = null, after: string | number | null = null) {
        return getChildren(this, type, before, after)
    }

    // @internal
    toString() { return this._tree.toString() }

    get node() { return this }

    matchContext(context: readonly string[]): boolean { return matchNodeContext(this, context) }
}

function getChildren(node: SyntaxNode, type: string | number, before: string | number | null, after: string | number | null): SyntaxNode[] {
    let cur = node.cursor(), result: SyntaxNode[] = []
    if (!cur.firstChild()) return result
    if (before != null) while (!cur.type.is(before)) if (!cur.nextSibling()) return result
    for (;;) {
        if (after != null && cur.type.is(after)) return result
        if (cur.type.is(type)) result.push(cur.node)
        if (!cur.nextSibling()) return after == null ? result : []
    }
}

function matchNodeContext(node: SyntaxNode, context: readonly string[], i = context.length - 1): boolean {
    for (let p: SyntaxNode | null = node.parent; i >= 0; p = p.parent) {
        if (!p) return false
        if (!p.type.isAnonymous) {
            if (context[i] && context[i] != p.name) return false
            i--
        }
    }
    return true
}

class BufferContext {
    constructor(readonly parent: TreeNode,
                readonly buffer: TreeBuffer,
                readonly index: number,
                readonly start: number) {}
}

class BufferNode implements SyntaxNode {
    type: NodeType

    get name() { return this.type.name }

    get from() { return this.context.start + this.context.buffer.buffer[this.index + 1] }

    get to() { return this.context.start + this.context.buffer.buffer[this.index + 2] }

    constructor(readonly context: BufferContext,
                readonly _parent: BufferNode | null,
                readonly index: number) {
        this.type = context.buffer.set.types[context.buffer.buffer[index]]
    }

    child(dir: 1 | -1, pos: number, side: Side): BufferNode | null {
        let {buffer} = this.context
        let index = buffer.findChild(this.index + 4, buffer.buffer[this.index + 3], dir, pos - this.context.start, side)
        return index < 0 ? null : new BufferNode(this.context, this, index)
    }

    get firstChild() { return this.child(1, 0, Side.DontCare) }
    get lastChild() { return this.child(-1, 0, Side.DontCare) }

    childAfter(pos: number) { return this.child(1, pos, Side.After) }
    childBefore(pos: number) { return this.child(-1, pos, Side.Before) }

    enter(pos: number, side: -1 | 0 | 1, mode: IterMode = 0) {
        if (mode & IterMode.ExcludeBuffers) return null
        let {buffer} = this.context
        let index = buffer.findChild(this.index + 4, buffer.buffer[this.index + 3], side > 0 ? 1 : -1, pos - this.context.start, side)
        return index < 0 ? null : new BufferNode(this.context, this, index)
    }

    get parent(): SyntaxNode | null {
        return this._parent || this.context.parent.nextSignificantParent()
    }

    externalSibling(dir: 1 | -1) {
        return this._parent ? null : this.context.parent.nextChild(this.context.index + dir, dir, 0, Side.DontCare)
    }

    get nextSibling(): SyntaxNode | null {
        let {buffer} = this.context
        let after = buffer.buffer[this.index + 3]
        if (after < (this._parent ? buffer.buffer[this._parent.index + 3] : buffer.buffer.length))
            return new BufferNode(this.context, this._parent, after)
        return this.externalSibling(1)
    }

    get prevSibling(): SyntaxNode | null {
        let {buffer} = this.context
        let parentStart = this._parent ? this._parent.index + 4 : 0
        if (this.index == parentStart) return this.externalSibling(-1)
        return new BufferNode(this.context, this._parent, buffer.findChild(parentStart, this.index, -1, 0, Side.DontCare))
    }

    cursor(mode: IterMode = 0) { return new TreeCursor(this, mode) }

    get tree() { return null }

    toTree() {
        let children = [], positions = []
        let {buffer} = this.context
        let startI = this.index + 4, endI = buffer.buffer[this.index + 3]
        if (endI > startI) {
            let from = buffer.buffer[this.index + 1], to = buffer.buffer[this.index + 2]
            children.push(buffer.slice(startI, endI, from, to))
            positions.push(0)
        }
        return new Tree(this.type, children, positions, this.to - this.from)
    }

    resolve(pos: number, side: -1 | 0 | 1 = 0) {
        return resolveNode(this, pos, side, false)
    }

    resolveInner(pos: number, side: -1 | 0 | 1 = 0) {
        return resolveNode(this, pos, side, true)
    }

    enterUnfinishedNodesBefore(pos: number) { return enterUnfinishedNodesBefore(this, pos) }

    // @internal
    toString() { return this.context.buffer.childString(this.index) }

    getChild(type: string | number, before: string | number | null = null, after: string | number | null = null) {
        let r = getChildren(this, type, before, after)
        return r.length ? r[0] : null
    }

    getChildren(type: string | number, before: string | number | null = null, after: string | number | null = null) {
        return getChildren(this, type, before, after)
    }

    get node() { return this }

    matchContext(context: readonly string[]): boolean { return matchNodeContext(this, context) }
}

export class TreeCursor implements SyntaxNodeRef {
    type!: NodeType

    get name() { return this.type.name }

    from!: number

    to!: number

    // @internal
    _tree!: TreeNode
    // @internal
    buffer: BufferContext | null = null
    private stack: number[] = []
    // @internal
    index: number = 0
    private bufferNode: BufferNode | null = null

    // @internal
    constructor(
        node: TreeNode | BufferNode,
        // @internal
        readonly mode = 0
    ) {
        if (node instanceof TreeNode) {
            this.yieldNode(node)
        } else {
            this._tree = node.context.parent
            this.buffer = node.context
            for (let n: BufferNode | null = node._parent; n; n = n._parent) this.stack.unshift(n.index)
            this.bufferNode = node
            this.yieldBuf(node.index)
        }
    }

    private yieldNode(node: TreeNode | null) {
        if (!node) return false
        this._tree = node
        this.type = node.type
        this.from = node.from
        this.to = node.to
        return true
    }

    private yieldBuf(index: number, type?: NodeType) {
        this.index = index
        let {start, buffer} = this.buffer!
        this.type = type || buffer.set.types[buffer.buffer[index]]
        this.from = start + buffer.buffer[index + 1]
        this.to = start + buffer.buffer[index + 2]
        return true
    }

    private yield(node: TreeNode | BufferNode | null) {
        if (!node) return false
        if (node instanceof TreeNode) {
            this.buffer = null
            return this.yieldNode(node)
        }
        this.buffer = node.context
        return this.yieldBuf(node.index, node.type)
    }

    // @internal
    toString() {
        return this.buffer ? this.buffer.buffer.childString(this.index) : this._tree.toString()
    }

    // @internal
    enterChild(dir: 1 | -1, pos: number, side: Side) {
        if (!this.buffer)
            return this.yield(this._tree.nextChild(dir < 0 ? this._tree._tree.children.length - 1 : 0, dir, pos, side, this.mode))

        let {buffer} = this.buffer
        let index = buffer.findChild(this.index + 4, buffer.buffer[this.index + 3], dir, pos - this.buffer.start, side)
        if (index < 0) return false
        this.stack.push(this.index)
        return this.yieldBuf(index)
    }

    firstChild() { return this.enterChild(1, 0, Side.DontCare) }

    lastChild() { return this.enterChild(-1, 0, Side.DontCare) }

    childAfter(pos: number) { return this.enterChild(1, pos, Side.After) }

    childBefore(pos: number) { return this.enterChild(-1, pos, Side.Before) }

    enter(pos: number, side: -1 | 0 | 1, mode: IterMode = this.mode) {
        if (!this.buffer)
            return this.yield(this._tree.enter(pos, side, mode))
        return mode & IterMode.ExcludeBuffers ? false : this.enterChild(1, pos, side)
    }

    /** Move to the node's parent node, if this isn't the top node. */
    parent() {
        if (!this.buffer) return this.yieldNode((this.mode & IterMode.IncludeAnonymous) ? this._tree._parent : this._tree.parent)
        if (this.stack.length) return this.yieldBuf(this.stack.pop()!)
        let parent = (this.mode & IterMode.IncludeAnonymous) ? this.buffer.parent : this.buffer.parent.nextSignificantParent()
        this.buffer = null
        return this.yieldNode(parent)
    }

    // @internal
    sibling(dir: 1 | -1) {
        if (!this.buffer)
            return !this._tree._parent ? false
                : this.yield(this._tree.index < 0 ? null
                    : this._tree._parent.nextChild(this._tree.index + dir, dir, 0, Side.DontCare, this.mode))

        let {buffer} = this.buffer, d = this.stack.length - 1
        if (dir < 0) {
            let parentStart = d < 0 ? 0 : this.stack[d] + 4
            if (this.index != parentStart)
                return this.yieldBuf(buffer.findChild(parentStart, this.index, -1, 0, Side.DontCare))
        } else {
            let after = buffer.buffer[this.index + 3]
            if (after < (d < 0 ? buffer.buffer.length : buffer.buffer[this.stack[d] + 3]))
                return this.yieldBuf(after)
        }
        return d < 0 ? this.yield(this.buffer.parent.nextChild(this.buffer.index + dir, dir, 0, Side.DontCare, this.mode)) : false
    }

    nextSibling() { return this.sibling(1) }

    prevSibling() { return this.sibling(-1) }

    private atLastNode(dir: 1 | -1) {
        let index, parent: TreeNode | null, {buffer} = this
        if (buffer) {
            if (dir > 0) {
                if (this.index < buffer.buffer.buffer.length) return false
            } else {
                for (let i = 0; i < this.index; i++) if (buffer.buffer.buffer[i + 3] < this.index) return false
            }
            ;({index, parent} = buffer)
        } else {
            ({index, _parent: parent} = this._tree)
        }
        for (; parent; {index, _parent: parent} = parent) {
            if (index > -1) for (let i = index + dir, e = dir < 0 ? -1 : parent._tree.children.length; i != e; i += dir) {
                let child = parent._tree.children[i]
                if ((this.mode & IterMode.IncludeAnonymous) ||
                    child instanceof TreeBuffer ||
                    !child.type.isAnonymous ||
                    hasChild(child)) return false
            }
        }
        return true
    }

    private move(dir: 1 | -1, enter: boolean) {
        if (enter && this.enterChild(dir, 0, Side.DontCare)) return true
        for (;;) {
            if (this.sibling(dir)) return true
            if (this.atLastNode(dir) || !this.parent()) return false
        }
    }

    next(enter = true) { return this.move(1, enter) }

    prev(enter = true) { return this.move(-1, enter) }

    moveTo(pos: number, side: -1 | 0 | 1 = 0) {
        // Move up to a node that actually holds the position, if possible
        while (this.from == this.to ||
        (side < 1 ? this.from >= pos : this.from > pos) ||
        (side > -1 ? this.to <= pos : this.to < pos))
            if (!this.parent()) break

        // Then scan down into child nodes as far as possible
        while (this.enterChild(1, pos, side)) {}
        return this
    }

    get node(): SyntaxNode {
        if (!this.buffer) return this._tree

        let cache = this.bufferNode, result: BufferNode | null = null, depth = 0
        if (cache && cache.context == this.buffer) {
            scan: for (let index = this.index, d = this.stack.length; d >= 0;) {
                for (let c: BufferNode | null = cache; c; c = c._parent) if (c.index == index) {
                    if (index == this.index) return c
                    result = c
                    depth = d + 1
                    break scan
                }
                index = this.stack[--d]
            }
        }
        for (let i = depth; i < this.stack.length; i++) result = new BufferNode(this.buffer, result, this.stack[i])
        return this.bufferNode = new BufferNode(this.buffer, result, this.index)
    }

    get tree(): Tree | null {
        return this.buffer ? null : this._tree._tree
    }

    iterate(enter: (node: SyntaxNodeRef) => boolean | void,
            leave?: (node: SyntaxNodeRef) => void) {
        for (let depth = 0;;) {
            let mustLeave = false
            if (this.type.isAnonymous || enter(this) !== false) {
                if (this.firstChild()) { depth++; continue }
                if (!this.type.isAnonymous) mustLeave = true
            }
            for (;;) {
                if (mustLeave && leave) leave(this)
                mustLeave = this.type.isAnonymous
                if (this.nextSibling()) break
                if (!depth) return
                this.parent()
                depth--
                mustLeave = true
            }
        }
    }

    matchContext(context: readonly string[]): boolean {
        if (!this.buffer) return matchNodeContext(this.node, context)
        let {buffer} = this.buffer, {types} = buffer.set
        for (let i = context.length - 1, d = this.stack.length - 1; i >= 0; d--) {
            if (d < 0) return matchNodeContext(this.node, context, i)
            let type = types[buffer.buffer[this.stack[d]]]
            if (!type.isAnonymous) {
                if (context[i] && context[i] != type.name) return false
                i--
            }
        }
        return true
    }
}

function hasChild(tree: Tree): boolean {
    return tree.children.some(ch => ch instanceof TreeBuffer || !ch.type.isAnonymous || hasChild(ch))
}

const enum Balance { BranchFactor = 8 }

const enum SpecialRecord {
    Reuse = -1,
    ContextChange = -3,
    LookAhead = -4
}

function buildTree(data: BuildData) {
    let {buffer, nodeSet,
        maxBufferLength = DefaultBufferLength,
        reused = [],
        minRepeatType = nodeSet.types.length} = data
    let cursor = Array.isArray(buffer) ? new FlatBufferCursor(buffer, buffer.length) : buffer as BufferCursor
    let types = nodeSet.types

    let contextHash = 0, lookAhead = 0

    function takeNode(parentStart: number, minPos: number,
                      children: (Tree | TreeBuffer)[], positions: number[],
                      inRepeat: number) {
        let {id, start, end, size} = cursor
        let lookAheadAtStart = lookAhead
        while (size < 0) {
            cursor.next()
            if (size == SpecialRecord.Reuse) {
                let node = reused[id]
                children.push(node)
                positions.push(start - parentStart)
                return
            } else if (size == SpecialRecord.ContextChange) { // Context change
                contextHash = id
                return
            } else if (size == SpecialRecord.LookAhead) {
                lookAhead = id
                return
            } else {
                throw new RangeError(`Unrecognized record size: ${size}`)
            }
            ;({id, start, end, size} = cursor)
        }

        let type = types[id], node, buffer: {size: number, start: number, skip: number} | undefined
        let startPos = start - parentStart
        if (end - start <= maxBufferLength && (buffer = findBufferSize(cursor.pos - minPos, inRepeat))) {
            // Small enough for a buffer, and no reused nodes inside
            let data = new Uint16Array(buffer.size - buffer.skip)
            let endPos = cursor.pos - buffer.size, index = data.length
            while (cursor.pos > endPos)
                index = copyToBuffer(buffer.start, data, index)
            node = new TreeBuffer(data, end - buffer.start, nodeSet)
            startPos = buffer.start - parentStart
        } else { // Make it a node
            let endPos = cursor.pos - size
            cursor.next()
            let localChildren: (Tree | TreeBuffer)[] = [], localPositions: number[] = []
            let localInRepeat = id >= minRepeatType ? id : -1
            let lastGroup = 0, lastEnd = end
            while (cursor.pos > endPos) {
                if (localInRepeat >= 0 && cursor.id == localInRepeat && cursor.size >= 0) {
                    if (cursor.end <= lastEnd - maxBufferLength) {
                        makeRepeatLeaf(localChildren, localPositions, start, lastGroup, cursor.end, lastEnd, localInRepeat, lookAheadAtStart)
                        lastGroup = localChildren.length
                        lastEnd = cursor.end
                    }
                    cursor.next()
                } else {
                    takeNode(start, endPos, localChildren, localPositions, localInRepeat)
                }
            }
            if (localInRepeat >= 0 && lastGroup > 0 && lastGroup < localChildren.length)
                makeRepeatLeaf(localChildren, localPositions, start, lastGroup, start, lastEnd, localInRepeat, lookAheadAtStart)
            localChildren.reverse(); localPositions.reverse()

            if (localInRepeat > -1 && lastGroup > 0) {
                let make = makeBalanced(type)
                node = balanceRange(type, localChildren, localPositions, 0, localChildren.length, 0, end - start, make, make)
            } else {
                node = makeTree(type, localChildren, localPositions, end - start, lookAheadAtStart - end)
            }
        }

        children.push(node)
        positions.push(startPos)
    }

    function makeBalanced(type: NodeType) {
        return (children: readonly (Tree | TreeBuffer)[], positions: readonly number[], length: number) => {
            let lookAhead = 0, lastI = children.length - 1, last, lookAheadProp
            if (lastI >= 0 && (last = children[lastI]) instanceof Tree) {
                if (!lastI && last.type == type && last.length == length) return last
                if (lookAheadProp = last.prop(NodeProp.lookAhead))
                    lookAhead = positions[lastI] + last.length + lookAheadProp
            }
            return makeTree(type, children, positions, length, lookAhead)
        }
    }

    function makeRepeatLeaf(children: (Tree | TreeBuffer)[], positions: number[], base: number, i: number,
                            from: number, to: number, type: number, lookAhead: number) {
        let localChildren = [], localPositions = []
        while (children.length > i) { localChildren.push(children.pop()!); localPositions.push(positions.pop()! + base - from) }
        children.push(makeTree(nodeSet.types[type], localChildren, localPositions, to - from, lookAhead - to))
        positions.push(from - base)
    }

    function makeTree(type: NodeType,
                      children: readonly (Tree | TreeBuffer)[],
                      positions: readonly number[], length: number,
                      lookAhead: number = 0,
                      props?: readonly [number | NodeProp<any>, any][]) {
        if (contextHash) {
            let pair: [number | NodeProp<any>, any] = [NodeProp.contextHash, contextHash]
            props = props ? [pair].concat(props) : [pair]
        }
        if (lookAhead > 25) {
            let pair: [number | NodeProp<any>, any] = [NodeProp.lookAhead, lookAhead]
            props = props ? [pair].concat(props) : [pair]
        }
        return new Tree(type, children, positions, length, props)
    }

    function findBufferSize(maxSize: number, inRepeat: number) {
        // Scan through the buffer to find previous siblings that fit
        // together in a TreeBuffer, and don't contain any reused nodes
        // (which can't be stored in a buffer).
        // If `inRepeat` is > -1, ignore node boundaries of that type for
        // nesting, but make sure the end falls either at the start
        // (`maxSize`) or before such a node.
        let fork = cursor.fork()
        let size = 0, start = 0, skip = 0, minStart = fork.end - maxBufferLength
        let result = {size: 0, start: 0, skip: 0}
        scan: for (let minPos = fork.pos - maxSize; fork.pos > minPos;) {
            let nodeSize = fork.size
            // Pretend nested repeat nodes of the same type don't exist
            if (fork.id == inRepeat && nodeSize >= 0) {
                // Except that we store the current state as a valid return
                // value.
                result.size = size; result.start = start; result.skip = skip
                skip += 4; size += 4
                fork.next()
                continue
            }
            let startPos = fork.pos - nodeSize
            if (nodeSize < 0 || startPos < minPos || fork.start < minStart) break
            let localSkipped = fork.id >= minRepeatType ? 4 : 0
            let nodeStart = fork.start
            fork.next()
            while (fork.pos > startPos) {
                if (fork.size < 0) {
                    if (fork.size == SpecialRecord.ContextChange) localSkipped += 4
                    else break scan
                } else if (fork.id >= minRepeatType) {
                    localSkipped += 4
                }
                fork.next()
            }
            start = nodeStart
            size += nodeSize
            skip += localSkipped
        }
        if (inRepeat < 0 || size == maxSize) {
            result.size = size; result.start = start; result.skip = skip
        }
        return result.size > 4 ? result : undefined
    }

    function copyToBuffer(bufferStart: number, buffer: Uint16Array, index: number): number {
        let {id, start, end, size} = cursor
        cursor.next()
        if (size >= 0 && id < minRepeatType) {
            let startIndex = index
            if (size > 4) {
                let endPos = cursor.pos - (size - 4)
                while (cursor.pos > endPos)
                    index = copyToBuffer(bufferStart, buffer, index)
            }
            buffer[--index] = startIndex
            buffer[--index] = end - bufferStart
            buffer[--index] = start - bufferStart
            buffer[--index] = id
        } else if (size == SpecialRecord.ContextChange) {
            contextHash = id
        } else if (size == SpecialRecord.LookAhead) {
            lookAhead = id
        }
        return index
    }

    let children: (Tree | TreeBuffer)[] = [], positions: number[] = []
    while (cursor.pos > 0) takeNode(data.start || 0, data.bufferStart || 0, children, positions, -1)
    let length = data.length ?? (children.length ? positions[0] + children[0].length : 0)
    return new Tree(types[data.topID], children.reverse(), positions.reverse(), length)
}

const nodeSizeCache: WeakMap<Tree, number> = new WeakMap
function nodeSize(balanceType: NodeType, node: Tree | TreeBuffer): number {
    if (!balanceType.isAnonymous || node instanceof TreeBuffer || node.type != balanceType) return 1
    let size = nodeSizeCache.get(node)
    if (size == null) {
        size = 1
        for (let child of node.children) {
            if (child.type != balanceType || !(child instanceof Tree)) {
                size = 1
                break
            }
            size += nodeSize(balanceType, child)
        }
        nodeSizeCache.set(node, size)
    }
    return size
}

function balanceRange(
    // The type the balanced tree's inner nodes.
    balanceType: NodeType,
    // The direct children and their positions
    children: readonly (Tree | TreeBuffer)[],
    positions: readonly number[],
    // The index range in children/positions to use
    from: number, to: number,
    // The start position of the nodes, relative to their parent.
    start: number,
    // Length of the outer node
    length: number,
    // Function to build the top node of the balanced tree
    mkTop: ((children: readonly (Tree | TreeBuffer)[], positions: readonly number[], length: number) => Tree) | null,
    // Function to build internal nodes for the balanced tree
    mkTree: (children: readonly (Tree | TreeBuffer)[], positions: readonly number[], length: number) => Tree
): Tree {
    let total = 0
    for (let i = from; i < to; i++) total += nodeSize(balanceType, children[i])

    let maxChild = Math.ceil((total * 1.5) / Balance.BranchFactor)
    let localChildren: (Tree | TreeBuffer)[] = [], localPositions: number[] = []
    function divide(children: readonly (Tree | TreeBuffer)[], positions: readonly number[],
                    from: number, to: number, offset: number) {
        for (let i = from; i < to;) {
            let groupFrom = i, groupStart = positions[i], groupSize = nodeSize(balanceType, children[i])
            i++
            for (; i < to; i++) {
                let nextSize = nodeSize(balanceType, children[i])
                if (groupSize + nextSize >= maxChild) break
                groupSize += nextSize
            }
            if (i == groupFrom + 1) {
                if (groupSize > maxChild) {
                    let only = children[groupFrom] as Tree // Only trees can have a size > 1
                    divide(only.children, only.positions, 0, only.children.length, positions[groupFrom] + offset)
                    continue
                }
                localChildren.push(children[groupFrom])
            } else {
                let length = positions[i - 1] + children[i - 1].length - groupStart
                localChildren.push(balanceRange(balanceType, children, positions, groupFrom, i, groupStart, length, null, mkTree))
            }
            localPositions.push(groupStart + offset - start)
        }
    }
    divide(children, positions, from, to, 0)
    return (mkTop || mkTree)(localChildren, localPositions, length)
}

export class NodeWeakMap<T> {
    private map = new WeakMap<Tree | TreeBuffer, T | Map<number, T>>()

    private setBuffer(buffer: TreeBuffer, index: number, value: T) {
        let inner = this.map.get(buffer) as Map<number, T> | undefined
        if (!inner) this.map.set(buffer, inner = new Map)
        inner.set(index, value)
    }

    private getBuffer(buffer: TreeBuffer, index: number): T | undefined {
        let inner = this.map.get(buffer) as Map<number, T> | undefined
        return inner && inner.get(index)
    }

    set(node: SyntaxNode, value: T) {
        if (node instanceof BufferNode) this.setBuffer(node.context.buffer, node.index, value)
        else if (node instanceof TreeNode) this.map.set(node.tree, value)
    }

    get(node: SyntaxNode): T | undefined {
        return node instanceof BufferNode ? this.getBuffer(node.context.buffer, node.index)
            : node instanceof TreeNode ? this.map.get(node.tree) as T | undefined : undefined
    }

    /** Set the value for the node that a cursor currently points to. */
    cursorSet(cursor: TreeCursor, value: T) {
        if (cursor.buffer) this.setBuffer(cursor.buffer.buffer, cursor.index, value)
        else this.map.set(cursor.tree!, value)
    }

    /** Retrieve the value for the node that a cursor currently points to. */
    cursorGet(cursor: TreeCursor): T | undefined {
        return cursor.buffer ? this.getBuffer(cursor.buffer.buffer, cursor.index) : this.map.get(cursor.tree!) as T | undefined
    }
}
