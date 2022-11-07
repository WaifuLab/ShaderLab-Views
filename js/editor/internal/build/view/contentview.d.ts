import { Text } from "../state/index.js";
import { Rect } from "./dom.js";
import { EditorView } from "./editorview.js";
export declare const enum Dirty {
    Not = 0,
    Child = 1,
    Node = 2,
    Attrs = 4
}
export declare class DOMPos {
    readonly node: Node;
    readonly offset: number;
    readonly precise: boolean;
    constructor(node: Node, offset: number, precise?: boolean);
    static before(dom: Node, precise?: boolean): DOMPos;
    static after(dom: Node, precise?: boolean): DOMPos;
}
export declare const noChildren: ContentView[];
export declare abstract class ContentView {
    parent: ContentView | null;
    dom: Node | null;
    dirty: number;
    abstract length: number;
    abstract children: ContentView[];
    breakAfter: number;
    get editorView(): EditorView;
    get overrideDOMText(): Text | null;
    get posAtStart(): number;
    get posAtEnd(): number;
    posBefore(view: ContentView): number;
    posAfter(view: ContentView): number;
    /**
     * Will return a rectangle directly before (when side < 0), after (side > 0) or directly on (when
     * the browser supports it) the given position.
     */
    coordsAt(_pos: number, _side: number): Rect | null;
    sync(track?: {
        node: Node;
        written: boolean;
    }): void;
    reuseDOM(_dom: Node): void;
    abstract domAtPos(pos: number): DOMPos;
    localPosFromDOM(node: Node, offset: number): number;
    domBoundsAround(from: number, to: number, offset?: number): {
        startDOM: Node | null;
        endDOM: Node | null;
        from: number;
        to: number;
    } | null;
    markDirty(andParent?: boolean): void;
    markParentsDirty(childList: boolean): void;
    setParent(parent: ContentView): void;
    setDOM(dom: Node): void;
    get rootView(): ContentView;
    replaceChildren(from: number, to: number, children?: ContentView[]): void;
    ignoreMutation(_rec: MutationRecord): boolean;
    ignoreEvent(_event: Event): boolean;
    childCursor(pos?: number): ChildCursor;
    childPos(pos: number, bias?: number): {
        i: number;
        off: number;
    };
    toString(): string;
    static get(node: Node): ContentView | null;
    get isEditable(): boolean;
    merge(from: number, to: number, source: ContentView | null, hasStart: boolean, openStart: number, openEnd: number): boolean;
    become(other: ContentView): boolean;
    canReuseDOM(other: ContentView): boolean;
    abstract split(at: number): ContentView;
    getSide(): number;
    destroy(): void;
}
export declare class ChildCursor {
    children: readonly ContentView[];
    pos: number;
    i: number;
    off: number;
    constructor(children: readonly ContentView[], pos: number, i: number);
    findPos(pos: number, bias?: number): this;
}
export declare function replaceRange(parent: ContentView, fromI: number, fromOff: number, toI: number, toOff: number, insert: ContentView[], breakAtStart: number, openStart: number, openEnd: number): void;
export declare function mergeChildrenInto(parent: ContentView, from: number, to: number, insert: ContentView[], openStart: number, openEnd: number): void;
