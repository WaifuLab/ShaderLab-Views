import { MapMode, RangeValue, RangeSet } from "../state/index.js";
import { attrsEq } from "./attributes.js";
/**
 * Widgets added to the content are described by subclasses of this class. Using a description
 * object like that makes it possible to delay creating of the DOM structure for a widget until
 * it is needed, and to avoid redrawing widgets even if the decorations that define them are
 * recreated.
 */
export class WidgetType {
    /**
     * Compare this instance to another instance of the same type. (TypeScript can't express
     * this, but only instances of the same specific class will be passed to this method.) This
     * is used to avoid redrawing widgets when they are replaced by a new decoration of the same
     * type. The default implementation just returns `false`, which will cause new instances of
     * the widget to always be redrawn.
     */
    eq(widget) { return false; }
    /**
     * Update a DOM element created by a widget of the same type (but different, non-`eq` content)
     * to reflect this widget. May return true to indicate that it could update, false to indicate
     * it couldn't (in which case the widget will be redrawn). The default implementation just
     * returns false.
     */
    updateDOM(dom) { return false; }
    // @internal
    compare(other) {
        return this == other || this.constructor == other.constructor && this.eq(other);
    }
    /**
     * The estimated height this widget will have, to be used when estimating the height of content
     * that hasn't been drawn. May return -1 to indicate you don't know. The default implementation
     * returns -1.
     */
    get estimatedHeight() { return -1; }
    /**
     * Can be used to configure which kinds of events inside the widget should be ignored by the
     * editor. The default is to ignore all events.
     */
    ignoreEvent(event) { return true; }
    // @internal
    get customView() { return null; }
    /** This is called when the an instance of the widget is removed from the editor view. */
    destroy(dom) { }
}
/** The different types of blocks that can occur in an editor view. */
export var BlockType;
(function (BlockType) {
    /** A line of text. */
    BlockType[BlockType["Text"] = 0] = "Text";
    /** A block widget associated with the position after it. */
    BlockType[BlockType["WidgetBefore"] = 1] = "WidgetBefore";
    /** A block widget associated with the position before it. */
    BlockType[BlockType["WidgetAfter"] = 2] = "WidgetAfter";
    /** A block widget [replacing](#view.Decoration^replace) a range of content. */
    BlockType[BlockType["WidgetRange"] = 3] = "WidgetRange";
})(BlockType || (BlockType = {}));
// A decoration provides information on how to draw or style a piece
// of content. You'll usually use it wrapped in a
// [`Range`](#state.Range), which adds a start and end position.
// @nonabstract
export class Decoration extends RangeValue {
    constructor(
    // @internal
    startSide, 
    // @internal
    endSide, 
    // @internal
    widget, 
    // The config object used to create this decoration. You can
    // include additional properties in there to store metadata about
    // your decoration.
    spec) {
        super();
        this.startSide = startSide;
        this.endSide = endSide;
        this.widget = widget;
        this.spec = spec;
    }
    // @internal
    get heightRelevant() { return false; }
    /**
     * Create a mark decoration, which influences the styling of the content in its range. Nested
     * mark decorations will cause nested DOM elements to be created. Nesting order is determined
     * by precedence of the [facet](#view.EditorView^decorations), with the higher-precedence
     * decorations creating the inner DOM nodes. Such elements are split on line boundaries and on
     * the boundaries of lower-precedence decorations.
     */
    static mark(spec) {
        return new MarkDecoration(spec);
    }
    /** Create a widget decoration, which displays a DOM element at the given position. */
    static widget(spec) {
        let side = spec.side || 0, block = !!spec.block;
        side += block ? (side > 0 ? 300000000 /* Side.BlockAfter */ : -400000000 /* Side.BlockBefore */) : (side > 0 ? 100000000 /* Side.InlineAfter */ : -100000000 /* Side.InlineBefore */);
        return new PointDecoration(spec, side, side, block, spec.widget || null, false);
    }
    // Create a replace decoration which replaces the given range with
    // a widget, or simply hides it.
    static replace(spec) {
        let block = !!spec.block, startSide, endSide;
        if (spec.isBlockGap) {
            startSide = -500000000 /* Side.GapStart */;
            endSide = 400000000 /* Side.GapEnd */;
        }
        else {
            let { start, end } = getInclusive(spec, block);
            startSide = (start ? (block ? -300000000 /* Side.BlockIncStart */ : -1 /* Side.InlineIncStart */) : 500000000 /* Side.NonIncStart */) - 1;
            endSide = (end ? (block ? 200000000 /* Side.BlockIncEnd */ : 1 /* Side.InlineIncEnd */) : -600000000 /* Side.NonIncEnd */) + 1;
        }
        return new PointDecoration(spec, startSide, endSide, block, spec.widget || null, true);
    }
    // Create a line decoration, which can add DOM attributes to the
    // line starting at the given position.
    static line(spec) {
        return new LineDecoration(spec);
    }
    // Build a [`DecorationSet`](#view.DecorationSet) from the given
    // decorated range or ranges. If the ranges aren't already sorted,
    // pass `true` for `sort` to make the library sort them for you.
    static set(of, sort = false) {
        return RangeSet.of(of, sort);
    }
    // The empty set of decorations.
    static { this.none = RangeSet.empty; }
    // @internal
    hasHeight() { return this.widget ? this.widget.estimatedHeight > -1 : false; }
}
export class MarkDecoration extends Decoration {
    constructor(spec) {
        let { start, end } = getInclusive(spec);
        super(start ? -1 /* Side.InlineIncStart */ : 500000000 /* Side.NonIncStart */, end ? 1 /* Side.InlineIncEnd */ : -600000000 /* Side.NonIncEnd */, null, spec);
        this.tagName = spec.tagName || "span";
        this.class = spec.class || "";
        this.attrs = spec.attributes || null;
    }
    eq(other) {
        return this == other ||
            other instanceof MarkDecoration &&
                this.tagName == other.tagName &&
                this.class == other.class &&
                attrsEq(this.attrs, other.attrs);
    }
    range(from, to = from) {
        if (from >= to)
            throw new RangeError("Mark decorations may not be empty");
        return super.range(from, to);
    }
}
MarkDecoration.prototype.point = false;
export class LineDecoration extends Decoration {
    constructor(spec) {
        super(-200000000 /* Side.Line */, -200000000 /* Side.Line */, null, spec);
    }
    eq(other) {
        return other instanceof LineDecoration && attrsEq(this.spec.attributes, other.spec.attributes);
    }
    range(from, to = from) {
        if (to != from)
            throw new RangeError("Line decoration ranges must be zero-length");
        return super.range(from, to);
    }
}
LineDecoration.prototype.mapMode = MapMode.TrackBefore;
LineDecoration.prototype.point = true;
export class PointDecoration extends Decoration {
    constructor(spec, startSide, endSide, block, widget, isReplace) {
        super(startSide, endSide, widget, spec);
        this.block = block;
        this.isReplace = isReplace;
        this.mapMode = !block ? MapMode.TrackDel : startSide <= 0 ? MapMode.TrackBefore : MapMode.TrackAfter;
    }
    // Only relevant when this.block == true
    get type() {
        return this.startSide < this.endSide ? BlockType.WidgetRange
            : this.startSide <= 0 ? BlockType.WidgetBefore : BlockType.WidgetAfter;
    }
    get heightRelevant() { return this.block || !!this.widget && this.widget.estimatedHeight >= 5; }
    eq(other) {
        return other instanceof PointDecoration &&
            widgetsEq(this.widget, other.widget) &&
            this.block == other.block &&
            this.startSide == other.startSide && this.endSide == other.endSide;
    }
    range(from, to = from) {
        if (this.isReplace && (from > to || (from == to && this.startSide > 0 && this.endSide <= 0)))
            throw new RangeError("Invalid range for replacement decoration");
        if (!this.isReplace && to != from)
            throw new RangeError("Widget decorations can only have zero-length ranges");
        return super.range(from, to);
    }
}
PointDecoration.prototype.point = true;
function getInclusive(spec, block = false) {
    let { inclusiveStart: start, inclusiveEnd: end } = spec;
    if (start == null)
        start = spec.inclusive;
    if (end == null)
        end = spec.inclusive;
    return { start: start ?? block, end: end ?? block };
}
function widgetsEq(a, b) {
    return a == b || !!(a && b && a.compare(b));
}
export function addRange(from, to, ranges, margin = 0) {
    let last = ranges.length - 1;
    if (last >= 0 && ranges[last] + margin >= from)
        ranges[last] = Math.max(ranges[last], to);
    else
        ranges.push(from, to);
}
