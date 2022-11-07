import { RangeValue, Range, RangeSet } from "../state/index.js";
import { WidgetView } from "./inlineview.js";
import { Attrs } from "./attributes.js";
import { EditorView } from "./editorview.js";
interface MarkDecorationSpec {
    /**
     * Whether the mark covers its start and end position or not. This influences whether content
     * inserted at those positions becomes part of the mark. Defaults to false.
     */
    inclusive?: boolean;
    /**
     * Specify whether the start position of the marked range should be inclusive. Overrides
     * `inclusive`, when both are present.
     */
    inclusiveStart?: boolean;
    /** Whether the end should be inclusive. */
    inclusiveEnd?: boolean;
    /** Add attributes to the DOM elements that hold the text in the marked range. */
    attributes?: {
        [key: string]: string;
    };
    /** Shorthand for `{attributes: {class: value}}`. */
    class?: string;
    /**
     * Add a wrapping element around the text in the marked range. Note that there will not
     * necessarily be a single element covering the entire range—other decorations with lower
     * precedence might split this one if they partially overlap it, and line breaks always
     * end decoration elements.
     */
    tagName?: string;
    /**
     * Decoration specs allow extra properties, which can be retrieved through the decoration's
     * [`spec`]{@link Decoration.spec} property.
     */
    [other: string]: any;
}
interface WidgetDecorationSpec {
    widget: WidgetType;
    side?: number;
    block?: boolean;
    [other: string]: any;
}
interface ReplaceDecorationSpec {
    /** An optional widget to drawn in the place of the replaced content. */
    widget?: WidgetType;
    /**
     * Whether this range covers the positions on its sides. This influences whether new content
     * becomes part of the range and whether the cursor can be drawn on its sides. Defaults to
     * false for inline replacements, and true for block replacements.
     */
    inclusive?: boolean;
    /** Set inclusivity at the start. */
    inclusiveStart?: boolean;
    /** Set inclusivity at the end. */
    inclusiveEnd?: boolean;
    /** Whether this is a block-level decoration. Defaults to false. */
    block?: boolean;
    /** Other properties are allowed. */
    [other: string]: any;
}
interface LineDecorationSpec {
    /** DOM attributes to add to the element wrapping the line. */
    attributes?: {
        [key: string]: string;
    };
    /** Shorthand for `{attributes: {class: value}}`. */
    class?: string;
    /** Other properties are allowed. */
    [other: string]: any;
}
/**
 * Widgets added to the content are described by subclasses of this class. Using a description
 * object like that makes it possible to delay creating of the DOM structure for a widget until
 * it is needed, and to avoid redrawing widgets even if the decorations that define them are
 * recreated.
 */
export declare abstract class WidgetType {
    /** Build the DOM structure for this widget instance. */
    abstract toDOM(view: EditorView): HTMLElement;
    /**
     * Compare this instance to another instance of the same type. (TypeScript can't express
     * this, but only instances of the same specific class will be passed to this method.) This
     * is used to avoid redrawing widgets when they are replaced by a new decoration of the same
     * type. The default implementation just returns `false`, which will cause new instances of
     * the widget to always be redrawn.
     */
    eq(widget: WidgetType): boolean;
    /**
     * Update a DOM element created by a widget of the same type (but different, non-`eq` content)
     * to reflect this widget. May return true to indicate that it could update, false to indicate
     * it couldn't (in which case the widget will be redrawn). The default implementation just
     * returns false.
     */
    updateDOM(dom: HTMLElement): boolean;
    compare(other: WidgetType): boolean;
    /**
     * The estimated height this widget will have, to be used when estimating the height of content
     * that hasn't been drawn. May return -1 to indicate you don't know. The default implementation
     * returns -1.
     */
    get estimatedHeight(): number;
    /**
     * Can be used to configure which kinds of events inside the widget should be ignored by the
     * editor. The default is to ignore all events.
     */
    ignoreEvent(event: Event): boolean;
    get customView(): null | typeof WidgetView;
    /** This is called when the an instance of the widget is removed from the editor view. */
    destroy(dom: HTMLElement): void;
}
export declare type DecorationSet = RangeSet<Decoration>;
/** The different types of blocks that can occur in an editor view. */
export declare enum BlockType {
    /** A line of text. */
    Text = 0,
    /** A block widget associated with the position after it. */
    WidgetBefore = 1,
    /** A block widget associated with the position before it. */
    WidgetAfter = 2,
    /** A block widget [replacing](#view.Decoration^replace) a range of content. */
    WidgetRange = 3
}
export declare abstract class Decoration extends RangeValue {
    readonly startSide: number;
    readonly endSide: number;
    readonly widget: WidgetType | null;
    readonly spec: any;
    protected constructor(startSide: number, endSide: number, widget: WidgetType | null, spec: any);
    point: boolean;
    get heightRelevant(): boolean;
    abstract eq(other: Decoration): boolean;
    /**
     * Create a mark decoration, which influences the styling of the content in its range. Nested
     * mark decorations will cause nested DOM elements to be created. Nesting order is determined
     * by precedence of the [facet](#view.EditorView^decorations), with the higher-precedence
     * decorations creating the inner DOM nodes. Such elements are split on line boundaries and on
     * the boundaries of lower-precedence decorations.
     */
    static mark(spec: MarkDecorationSpec): Decoration;
    /** Create a widget decoration, which displays a DOM element at the given position. */
    static widget(spec: WidgetDecorationSpec): Decoration;
    static replace(spec: ReplaceDecorationSpec): Decoration;
    static line(spec: LineDecorationSpec): Decoration;
    static set(of: Range<Decoration> | readonly Range<Decoration>[], sort?: boolean): DecorationSet;
    static none: DecorationSet;
    hasHeight(): boolean;
}
export declare class MarkDecoration extends Decoration {
    tagName: string;
    class: string;
    attrs: Attrs | null;
    constructor(spec: MarkDecorationSpec);
    eq(other: Decoration): boolean;
    range(from: number, to?: number): Range<this>;
}
export declare class LineDecoration extends Decoration {
    constructor(spec: LineDecorationSpec);
    eq(other: Decoration): boolean;
    range(from: number, to?: number): Range<this>;
}
export declare class PointDecoration extends Decoration {
    block: boolean;
    readonly isReplace: boolean;
    constructor(spec: any, startSide: number, endSide: number, block: boolean, widget: WidgetType | null, isReplace: boolean);
    get type(): BlockType.WidgetBefore | BlockType.WidgetAfter | BlockType.WidgetRange;
    get heightRelevant(): boolean;
    eq(other: Decoration): boolean;
    range(from: number, to?: number): Range<this>;
}
export declare function addRange(from: number, to: number, ranges: number[], margin?: number): void;
export {};
