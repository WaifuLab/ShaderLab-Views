import { Text, ChangeSet } from "../state/index.js";
import { DecorationSet, BlockType } from "./decoration.js";
import { ChangedRange } from "./extension.js";
export declare class HeightOracle {
    doc: Text;
    lineWrapping: boolean;
    heightSamples: {
        [key: number]: boolean;
    };
    lineHeight: number;
    charWidth: number;
    lineLength: number;
    heightChanged: boolean;
    heightForGap(from: number, to: number): number;
    heightForLine(length: number): number;
    setDoc(doc: Text): this;
    mustRefreshForWrapping(whiteSpace: string): boolean;
    mustRefreshForHeights(lineHeights: number[]): boolean;
    refresh(whiteSpace: string, lineHeight: number, charWidth: number, lineLength: number, knownHeights: number[]): boolean;
}
/**
 * This object is used by `updateHeight` to make DOM measurements arrive at the right nides.
 * The `heights` array is a sequence of block heights, starting from position `from`.
 */
export declare class MeasuredHeights {
    readonly from: number;
    readonly heights: number[];
    index: number;
    constructor(from: number, heights: number[]);
    get more(): boolean;
}
/** Record used to represent information about a block-level element in the editor view. */
export declare class BlockInfo {
    /** The start of the element in the document. */
    readonly from: number;
    /** The length of the element. */
    readonly length: number;
    /** The top position of the element (relative to the top of the document). */
    readonly top: number;
    /** Its height. */
    readonly height: number;
    /** The type of element this is. When querying lines, this may be an array of all the blocks that make up the line. */
    readonly type: BlockType | readonly BlockInfo[];
    constructor(
    /** The start of the element in the document. */
    from: number, 
    /** The length of the element. */
    length: number, 
    /** The top position of the element (relative to the top of the document). */
    top: number, 
    /** Its height. */
    height: number, 
    /** The type of element this is. When querying lines, this may be an array of all the blocks that make up the line. */
    type: BlockType | readonly BlockInfo[]);
    /** The end of the element as a document position. */
    get to(): number;
    /** The bottom position of the element. */
    get bottom(): number;
    join(other: BlockInfo): BlockInfo;
}
export declare enum QueryType {
    ByPos = 0,
    ByHeight = 1,
    ByPosNoHeight = 2
}
export declare abstract class HeightMap {
    length: number;
    height: number;
    flags: number;
    constructor(length: number, // The number of characters covered
    height: number, // Height of this part of the document
    flags?: number);
    size: number;
    get outdated(): boolean;
    set outdated(value: boolean);
    abstract blockAt(height: number, doc: Text, top: number, offset: number): BlockInfo;
    abstract lineAt(value: number, type: QueryType, doc: Text, top: number, offset: number): BlockInfo;
    abstract forEachLine(from: number, to: number, doc: Text, top: number, offset: number, f: (line: BlockInfo) => void): void;
    abstract updateHeight(oracle: HeightOracle, offset?: number, force?: boolean, measured?: MeasuredHeights): HeightMap;
    abstract toString(): void;
    setHeight(oracle: HeightOracle, height: number): void;
    /**
     * Base case is to replace a leaf node, which simply builds a tree from the new nodes and
     * returns that (HeightMapBranch and HeightMapGap override this to actually use from/to)
     */
    replace(_from: number, _to: number, nodes: (HeightMap | null)[]): HeightMap;
    /** Again, these are base cases, and are overridden for branch and gap nodes. */
    decomposeLeft(_to: number, result: (HeightMap | null)[]): void;
    decomposeRight(_from: number, result: (HeightMap | null)[]): void;
    applyChanges(decorations: readonly DecorationSet[], oldDoc: Text, oracle: HeightOracle, changes: readonly ChangedRange[]): HeightMap;
    static empty(): HeightMap;
    /**
     * nodes uses null values to indicate the position of line breaks. There are never line breaks
     * at the start or end of the array, or two line breaks next to each other, and the array isn't
     * allowed to be empty (same restrictions as return value from the builder).
     */
    static of(nodes: (HeightMap | null)[]): HeightMap;
}
export declare function heightRelevantDecoChanges(a: readonly DecorationSet[], b: readonly DecorationSet[], diff: ChangeSet): number[];
