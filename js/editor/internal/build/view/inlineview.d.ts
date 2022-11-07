import { Text as DocText } from "../state/index.js";
import { ContentView, DOMPos } from "./contentview.js";
import { WidgetType, MarkDecoration } from "./decoration.js";
import { Rect } from "./dom.js";
import { CompositionWidget } from "./docview.js";
export declare class TextView extends ContentView {
    text: string;
    children: ContentView[];
    dom: Text | null;
    constructor(text: string);
    get length(): number;
    createDOM(textDOM?: Node): void;
    sync(track?: {
        node: Node;
        written: boolean;
    }): void;
    reuseDOM(dom: Node): void;
    merge(from: number, to: number, source: ContentView | null): boolean;
    split(from: number): TextView;
    localPosFromDOM(node: Node, offset: number): number;
    domAtPos(pos: number): DOMPos;
    domBoundsAround(_from: number, _to: number, offset: number): {
        from: number;
        to: number;
        startDOM: Text | null;
        endDOM: ChildNode | null;
    };
    coordsAt(pos: number, side: number): Rect;
}
export declare class MarkView extends ContentView {
    readonly mark: MarkDecoration;
    children: ContentView[];
    length: number;
    dom: HTMLElement | null;
    constructor(mark: MarkDecoration, children?: ContentView[], length?: number);
    setAttrs(dom: HTMLElement): HTMLElement;
    reuseDOM(node: Node): void;
    sync(track?: {
        node: Node;
        written: boolean;
    }): void;
    merge(from: number, to: number, source: ContentView | null, _hasStart: boolean, openStart: number, openEnd: number): boolean;
    split(from: number): MarkView;
    domAtPos(pos: number): DOMPos;
    coordsAt(pos: number, side: number): Rect | null;
}
export declare class WidgetView extends ContentView {
    widget: WidgetType;
    length: number;
    readonly side: number;
    children: ContentView[];
    dom: HTMLElement | null;
    prevWidget: WidgetType | null;
    static create(widget: WidgetType, length: number, side: number): WidgetView;
    constructor(widget: WidgetType, length: number, side: number);
    split(from: number): WidgetView;
    sync(): void;
    getSide(): number;
    merge(from: number, to: number, source: ContentView | null, hasStart: boolean, openStart: number, openEnd: number): boolean;
    become(other: ContentView): boolean;
    ignoreMutation(): boolean;
    ignoreEvent(event: Event): boolean;
    get overrideDOMText(): DocText | null;
    domAtPos(pos: number): DOMPos;
    domBoundsAround(): null;
    coordsAt(pos: number, side: number): Rect | null;
    get isEditable(): boolean;
    destroy(): void;
}
export declare class CompositionView extends WidgetView {
    widget: CompositionWidget;
    domAtPos(pos: number): DOMPos;
    sync(): void;
    localPosFromDOM(node: Node, offset: number): number;
    ignoreMutation(): boolean;
    get overrideDOMText(): null;
    coordsAt(pos: number, side: number): Rect | null;
    destroy(): void;
    get isEditable(): boolean;
    canReuseDOM(): boolean;
}
/**
 * These are drawn around uneditable widgets to avoid a number of browser bugs that show up when the
 * cursor is directly next to uneditable inline content.
 */
export declare class WidgetBufferView extends ContentView {
    readonly side: number;
    children: ContentView[];
    dom: HTMLElement | null;
    constructor(side: number);
    get length(): number;
    merge(): boolean;
    become(other: ContentView): boolean;
    split(): WidgetBufferView;
    sync(): void;
    getSide(): number;
    domAtPos(pos: number): DOMPos;
    localPosFromDOM(): number;
    domBoundsAround(): null;
    coordsAt(pos: number): Rect | null;
    get overrideDOMText(): DocText;
}
export declare function inlineDOMAtPos(parent: ContentView, pos: number): DOMPos;
export declare function joinInlineInto(parent: ContentView, view: ContentView, open: number): void;
export declare function coordsInChildren(view: ContentView, pos: number, side: number): Rect | null;
