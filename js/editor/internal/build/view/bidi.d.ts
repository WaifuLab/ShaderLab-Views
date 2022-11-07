import { SelectionRange, Line } from "../state/index.js";
/** Used to indicate [text direction]{@link EditorView.textDirection}. */
export declare enum Direction {
    LTR = 0,
    RTL = 1
}
/** Represents a contiguous range of text that has a single direction (as in left-to-right or right-to-left). */
export declare class BidiSpan {
    /** The start of the span (relative to the start of the line). */
    readonly from: number;
    /** The end of the span. */
    readonly to: number;
    /**
     * The ["bidi level"](https://unicode.org/reports/tr9/#Basic_Display_Algorithm) of the span
     * (in this context, 0 means left-to-right, 1 means right-to-left, 2 means left-to-right
     * number inside right-to-left text).
     */
    readonly level: number;
    /** The direction of this span. */
    get dir(): Direction;
    constructor(
    /** The start of the span (relative to the start of the line). */
    from: number, 
    /** The end of the span. */
    to: number, 
    /**
     * The ["bidi level"](https://unicode.org/reports/tr9/#Basic_Display_Algorithm) of the span
     * (in this context, 0 means left-to-right, 1 means right-to-left, 2 means left-to-right
     * number inside right-to-left text).
     */
    level: number);
    side(end: boolean, dir: Direction): number;
    static find(order: readonly BidiSpan[], index: number, level: number, assoc: number): number;
}
export declare function computeOrder(line: string, direction: Direction): BidiSpan[];
export declare function trivialOrder(length: number): BidiSpan[];
export declare let movedOver: string;
export declare function moveVisually(line: Line, order: readonly BidiSpan[], dir: Direction, start: SelectionRange, forward: boolean): SelectionRange | null;
