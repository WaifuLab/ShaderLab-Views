export declare function getSelection(root: DocumentOrShadowRoot): Selection | null;
export declare function contains(dom: Node, node: Node | null): boolean;
export declare function deepActiveElement(doc: Document): Element | null;
export declare function hasSelection(dom: HTMLElement, selection: SelectionRange): boolean;
export declare function clientRectsFor(dom: Node): DOMRectList;
export declare function isEquivalentPosition(node: Node, off: number, targetNode: Node | null, targetOff: number): boolean;
export declare function domIndex(node: Node): number;
export declare function maxOffset(node: Node): number;
/** Basic rectangle type. */
export interface Rect {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
}
export declare const Rect0: {
    left: number;
    right: number;
    top: number;
    bottom: number;
};
export declare function flattenRect(rect: Rect, left: boolean): {
    left: number;
    right: number;
    top: number;
    bottom: number;
};
export declare type ScrollStrategy = "nearest" | "start" | "end" | "center";
export declare function scrollRectIntoView(dom: HTMLElement, rect: Rect, side: -1 | 1, x: ScrollStrategy, y: ScrollStrategy, xMargin: number, yMargin: number, ltr: boolean): void;
export interface SelectionRange {
    focusNode: Node | null;
    focusOffset: number;
    anchorNode: Node | null;
    anchorOffset: number;
}
export declare class DOMSelectionState implements SelectionRange {
    anchorNode: Node | null;
    anchorOffset: number;
    focusNode: Node | null;
    focusOffset: number;
    eq(domSel: SelectionRange): boolean;
    setRange(range: SelectionRange): void;
    set(anchorNode: Node | null, anchorOffset: number, focusNode: Node | null, focusOffset: number): void;
}
export declare function focusPreventScroll(dom: HTMLElement): any;
export declare function textRange(node: Text, from: number, to?: number): Range;
export declare function dispatchKey(elt: HTMLElement, name: string, code: number): boolean;
export declare function getRoot(node: Node | null | undefined): DocumentOrShadowRoot | null;
export declare function clearAttributes(node: HTMLElement): void;
export declare function atElementStart(doc: HTMLElement, selection: SelectionRange): boolean;
