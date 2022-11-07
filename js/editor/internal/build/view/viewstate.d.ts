import { EditorState, ChangeSet, ChangeDesc } from "../state/index.js";
import { Rect } from "./dom.js";
import { HeightMap, HeightOracle, BlockInfo } from "./heightmap.js";
import { ViewUpdate, UpdateFlag, ScrollTarget } from "./extension.js";
import { Decoration, DecorationSet } from "./decoration.js";
import { EditorView } from "./editorview.js";
import { Direction } from "./bidi.js";
export declare class LineGap {
    readonly from: number;
    readonly to: number;
    readonly size: number;
    constructor(from: number, to: number, size: number);
    static same(a: readonly LineGap[], b: readonly LineGap[]): boolean;
    draw(wrapping: boolean): import("../state/rangeset").Range<Decoration>;
}
export declare class ViewState {
    state: EditorState;
    pixelViewport: Rect;
    inView: boolean;
    paddingTop: number;
    paddingBottom: number;
    contentDOMWidth: number;
    contentDOMHeight: number;
    editorHeight: number;
    editorWidth: number;
    heightOracle: HeightOracle;
    heightMap: HeightMap;
    scaler: YScaler;
    scrollTarget: ScrollTarget | null;
    printing: boolean;
    mustMeasureContent: boolean;
    stateDeco: readonly DecorationSet[];
    viewportLines: BlockInfo[];
    defaultTextDirection: Direction;
    /** The main viewport for the visible part of the document */
    viewport: Viewport;
    /**
     * If the main selection starts or ends outside of the main viewport, extra single-line viewports
     * are created for these points, so that the DOM selection doesn't fall in a gap.
     */
    viewports: readonly Viewport[];
    visibleRanges: readonly {
        from: number;
        to: number;
    }[];
    lineGaps: readonly LineGap[];
    lineGapDeco: DecorationSet;
    mustEnforceCursorAssoc: boolean;
    constructor(state: EditorState);
    updateForViewport(): void;
    updateViewportLines(): void;
    update(update: ViewUpdate, scrollTarget?: ScrollTarget | null): void;
    measure(view: EditorView): number;
    get visibleTop(): number;
    get visibleBottom(): number;
    getViewport(bias: number, scrollTarget: ScrollTarget | null): Viewport;
    mapViewport(viewport: Viewport, changes: ChangeDesc): Viewport;
    viewportIsAppropriate({ from, to }: Viewport, bias?: number): boolean;
    mapLineGaps(gaps: readonly LineGap[], changes: ChangeSet): readonly LineGap[];
    ensureLineGaps(current: readonly LineGap[], mayMeasure?: EditorView): LineGap[];
    gapSize(line: BlockInfo, from: number, to: number, structure: LineStructure): number;
    updateLineGaps(gaps: readonly LineGap[]): void;
    computeVisibleRanges(): 0 | UpdateFlag.Viewport;
    lineBlockAt(pos: number): BlockInfo;
    lineBlockAtHeight(height: number): BlockInfo;
    elementAtHeight(height: number): BlockInfo;
    get docHeight(): number;
    get contentHeight(): number;
}
export declare class Viewport {
    readonly from: number;
    readonly to: number;
    constructor(from: number, to: number);
}
declare type LineStructure = {
    total: number;
    ranges: {
        from: number;
        to: number;
    }[];
};
declare type YScaler = {
    toDOM(n: number): number;
    fromDOM(n: number): number;
    scale: number;
};
export {};
