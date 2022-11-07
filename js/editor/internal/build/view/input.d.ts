import { EditorSelection, SelectionRange } from "../state/index.js";
import { EditorView, DOMEventHandlers } from "./editorview.js";
import { ViewUpdate, PluginValue, PluginInstance } from "./extension.js";
/** This will also be where dragging info and such goes */
export declare class InputState {
    lastKeyCode: number;
    lastKeyTime: number;
    lastTouchTime: number;
    lastFocusTime: number;
    lastScrollTop: number;
    lastScrollLeft: number;
    chromeScrollHack: number;
    pendingIOSKey: undefined | {
        key: string;
        keyCode: number;
    };
    lastSelectionOrigin: string | null;
    lastSelectionTime: number;
    lastEscPress: number;
    lastContextMenu: number;
    scrollHandlers: ((event: Event) => boolean | void)[];
    registeredEvents: string[];
    customHandlers: {
        plugin: PluginValue;
        handlers: DOMEventHandlers<any>;
    }[];
    /**
     * -1 means not in a composition. Otherwise, this counts the number of changes made during the
     * composition. The count is used to avoid treating the start state of the composition, before
     * any changes have been made, as part of the composition.
     */
    composing: number;
    /**
     * Tracks whether the next change should be marked as starting the composition (null means no
     * composition, true means next is the first, false means first has already been marked for this
     * composition)
     */
    compositionFirstChange: boolean | null;
    compositionEndedAt: number;
    mouseSelection: MouseSelection | null;
    notifiedFocused: boolean;
    setSelectionOrigin(origin: string): void;
    constructor(view: EditorView);
    ensureHandlers(view: EditorView, plugins: readonly PluginInstance[]): void;
    runCustomHandlers(type: string, view: EditorView, event: Event): boolean;
    runScrollHandlers(view: EditorView, event: Event): void;
    keydown(view: EditorView, event: KeyboardEvent): boolean;
    flushIOSKey(view: EditorView): boolean;
    ignoreDuringComposition(event: Event): boolean;
    mustFlushObserver(event: Event): boolean;
    startMouseSelection(mouseSelection: MouseSelection): void;
    update(update: ViewUpdate): void;
    destroy(): void;
}
/** Key codes for modifier keys */
export declare const modifierCodes: number[];
/** Interface that objects registered with {@link EditorView.mouseSelectionStyle} must conform to. */
export interface MouseSelectionStyle {
    /**
     * Return a new selection for the mouse gesture that starts with the event that was originally given
     * to the constructor, and ends with the event passed here. In case of a plain click, those may both
     * be the `mousedown` event, in case of a drag gesture, the latest `mousemove` event will be passed.
     *
     * When `extend` is true, that means the new selection should, if possible, extend the start selection.
     * If `multiple` is true, the new selection should be added to the original selection.
     */
    get: (curEvent: MouseEvent, extend: boolean, multiple: boolean) => EditorSelection;
    /**
     * Called when the view is updated while the gesture is in progress. When the document changes, it may
     * be necessary to map some data (like the original selection or start position) through the changes.
     *
     * This may return `true` to indicate that the `get` method should get queried again after the update,
     * because something in the update could change its result. Be wary of infinite loops when using this
     */
    update: (update: ViewUpdate) => boolean | void;
}
export declare type MakeSelectionStyle = (view: EditorView, event: MouseEvent) => MouseSelectionStyle | null;
declare class MouseSelection {
    private view;
    private style;
    private mustSelect;
    dragging: null | false | SelectionRange;
    dragMove: boolean;
    extend: boolean;
    multiple: boolean;
    lastEvent: MouseEvent;
    constructor(view: EditorView, startEvent: MouseEvent, style: MouseSelectionStyle, mustSelect: boolean);
    move(event: MouseEvent): void;
    up(event: MouseEvent): void;
    destroy(): void;
    select(event: MouseEvent): void;
    update(update: ViewUpdate): void;
}
export {};
