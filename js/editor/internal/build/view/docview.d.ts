import { ContentView, ChildCursor, DOMPos } from "./contentview.js";
import { BlockView } from "./blockview.js";
import { CompositionView } from "./inlineview.js";
import { DecorationSet, WidgetType } from "./decoration.js";
import { Rect } from "./dom.js";
import { ViewUpdate, ScrollTarget } from "./extension.js";
import { EditorView } from "./editorview.js";
import { Direction } from "./bidi.js";
export declare class DocView extends ContentView {
    readonly view: EditorView;
    children: BlockView[];
    compositionDeco: DecorationSet;
    decorations: readonly DecorationSet[];
    dynamicDecorationMap: boolean[];
    minWidth: number;
    minWidthFrom: number;
    minWidthTo: number;
    impreciseAnchor: DOMPos | null;
    impreciseHead: DOMPos | null;
    forceSelection: boolean;
    dom: HTMLElement;
    lastUpdate: number;
    get editorView(): EditorView;
    get length(): number;
    constructor(view: EditorView);
    update(update: ViewUpdate): boolean;
    private updateInner;
    private updateChildren;
    updateSelection(mustRead?: boolean, fromPointer?: boolean): void;
    enforceCursorAssoc(): void;
    mayControlSelection(): boolean;
    nearest(dom: Node): ContentView | null;
    posFromDOM(node: Node, offset: number): number;
    domAtPos(pos: number): DOMPos;
    coordsAt(pos: number, side: number): Rect | null;
    measureVisibleLineHeights(viewport: {
        from: number;
        to: number;
    }): number[];
    textDirectionAt(pos: number): Direction;
    measureTextSize(): {
        lineHeight: number;
        charWidth: number;
    };
    childCursor(pos?: number): ChildCursor;
    computeBlockGapDeco(): DecorationSet;
    updateDeco(): DecorationSet[];
    scrollIntoView(target: ScrollTarget): void;
    split: () => ContentView;
}
export declare function compositionSurroundingNode(view: EditorView): {
    from: number;
    to: number;
    node: Node;
    text: Text;
} | null;
export declare class CompositionWidget extends WidgetType {
    readonly top: Node;
    readonly text: Text;
    readonly topView: ContentView | null;
    constructor(top: Node, text: Text, topView: ContentView | null);
    eq(other: CompositionWidget): boolean;
    toDOM(): HTMLElement;
    ignoreEvent(): boolean;
    get customView(): typeof CompositionView;
}
