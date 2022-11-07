import { EditorView } from "./editorview.js";
import { DOMSelectionState } from "./dom.js";
import { DOMChange } from "./domchange.js";
export declare class DOMObserver {
    private view;
    dom: HTMLElement;
    win: Window;
    observer: MutationObserver;
    active: boolean;
    selectionRange: DOMSelectionState;
    selectionChanged: boolean;
    delayedFlush: number;
    resizeTimeout: number;
    queue: MutationRecord[];
    delayedAndroidKey: {
        key: string;
        keyCode: number;
        force: boolean;
    } | null;
    flushingAndroidKey: number;
    lastChange: number;
    onCharData: any;
    scrollTargets: HTMLElement[];
    intersection: IntersectionObserver | null;
    resize: ResizeObserver | null;
    intersecting: boolean;
    gapIntersection: IntersectionObserver | null;
    gaps: readonly HTMLElement[];
    parentCheck: number;
    constructor(view: EditorView);
    onScrollChanged(e: Event): void;
    onScroll(e: Event): void;
    onResize(): void;
    onPrint(): void;
    updateGaps(gaps: readonly HTMLElement[]): void;
    onSelectionChange(event: Event): void;
    readSelectionRange(): boolean;
    setSelectionRange(anchor: {
        node: Node;
        offset: number;
    }, head: {
        node: Node;
        offset: number;
    }): void;
    clearSelectionRange(): void;
    listenForScroll(): void;
    ignore<T>(f: () => T): T;
    start(): void;
    stop(): void;
    clear(): void;
    /**
     * Chrome Android, especially in combination with GBoard, not only doesn't reliably fire regular
     * key events, but also often surrounds the effect of enter or backspace with a bunch of composition
     * events that, when interrupted, cause text duplication or other kinds of corruption. This hack
     * makes the editor back off from handling DOM changes for a moment when such a key is detected
     * (via beforeinput or keydown), and then tries to flush them or, if that has no effect, dispatches
     * the given key.
     */
    delayAndroidKey(key: string, keyCode: number): void;
    clearDelayedAndroidKey(): void;
    flushSoon(): void;
    forceFlush(): void;
    processRecords(): {
        from: number;
        to: number;
        typeOver: boolean;
    };
    readChange(): DOMChange | null;
    flush(readSelection?: boolean): boolean;
    readMutation(rec: MutationRecord): {
        from: number;
        to: number;
        typeOver: boolean;
    } | null;
    setWindow(win: Window): void;
    addWindowListeners(win: Window): void;
    removeWindowListeners(win: Window): void;
    destroy(): void;
}
