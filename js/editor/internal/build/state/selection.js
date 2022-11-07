/**
 * A single selection range. When {@link allowMultipleSelections} is enabled, a [selection]{@link EditorSelection}
 * may hold multiple ranges. By default, selections hold exactly one range.
 */
export class SelectionRange {
    constructor(
    /** The lower boundary of the range. */
    from, 
    /** The upper boundary of the range. */
    to, flags) {
        this.from = from;
        this.to = to;
        this.flags = flags;
    }
    /** The anchor of the range—the side that doesn't move when you extend it. */
    get anchor() { return this.flags & 16 /* RangeFlag.Inverted */ ? this.to : this.from; }
    /** The head of the range, which is moved when the range is [extended]{@link SelectionRange.extend}. */
    get head() { return this.flags & 16 /* RangeFlag.Inverted */ ? this.from : this.to; }
    /** True when `anchor` and `head` are at the same position. */
    get empty() { return this.from == this.to; }
    /**
     * If this is a cursor that is explicitly associated with the character on one of its sides, this
     * returns the side. -1 means the character before its position, 1 the character after, and 0 means
     * no association.
     */
    get assoc() { return this.flags & 4 /* RangeFlag.AssocBefore */ ? -1 : this.flags & 8 /* RangeFlag.AssocAfter */ ? 1 : 0; }
    /** The bidirectional text level associated with this cursor, if any. */
    get bidiLevel() {
        let level = this.flags & 3 /* RangeFlag.BidiLevelMask */;
        return level == 3 ? null : level;
    }
    /**
     * The goal column (stored vertical offset) associated with a cursor. This is used to preserve the
     * vertical position when [moving]{@link EditorView.moveVertically} across lines of different length.
     */
    get goalColumn() {
        let value = this.flags >> 5 /* RangeFlag.GoalColumnOffset */;
        return value == 33554431 /* RangeFlag.NoGoalColumn */ ? undefined : value;
    }
    /** Map this range through a change, producing a valid range in the updated document. */
    map(change, assoc = -1) {
        let from, to;
        if (this.empty) {
            from = to = change.mapPos(this.from, assoc);
        }
        else {
            from = change.mapPos(this.from, 1);
            to = change.mapPos(this.to, -1);
        }
        return from == this.from && to == this.to ? this : new SelectionRange(from, to, this.flags);
    }
    /** Extend this range to cover at least `from` to `to`. */
    extend(from, to = from) {
        if (from <= this.anchor && to >= this.anchor)
            return EditorSelection.range(from, to);
        let head = Math.abs(from - this.anchor) > Math.abs(to - this.anchor) ? from : to;
        return EditorSelection.range(this.anchor, head);
    }
    /** Compare this range to another range. */
    eq(other) {
        return this.anchor == other.anchor && this.head == other.head;
    }
    /** Return a JSON-serializable object representing the range. */
    toJSON() { return { anchor: this.anchor, head: this.head }; }
    /** Convert a JSON representation of a range to a `SelectionRange` instance. */
    static fromJSON(json) {
        if (!json || typeof json.anchor != "number" || typeof json.head != "number")
            throw new RangeError("Invalid JSON representation for SelectionRange");
        return EditorSelection.range(json.anchor, json.head);
    }
    // @internal
    static create(from, to, flags) {
        return new SelectionRange(from, to, flags);
    }
}
/** An editor selection holds one or more selection ranges. */
export class EditorSelection {
    constructor(
    /** The ranges in the selection, sorted by position. Ranges cannot overlap (but they may touch, if they aren't empty). */
    ranges, 
    /** The index of the _main_ range in the selection (which is usually the range that was added last). */
    mainIndex) {
        this.ranges = ranges;
        this.mainIndex = mainIndex;
    }
    /** Map a selection through a change. Used to adjust the selection position for changes. */
    map(change, assoc = -1) {
        if (change.empty)
            return this;
        return EditorSelection.create(this.ranges.map(r => r.map(change, assoc)), this.mainIndex);
    }
    /** Compare this selection to another selection. */
    eq(other) {
        if (this.ranges.length != other.ranges.length ||
            this.mainIndex != other.mainIndex)
            return false;
        for (let i = 0; i < this.ranges.length; i++)
            if (!this.ranges[i].eq(other.ranges[i]))
                return false;
        return true;
    }
    /**
     * Get the primary selection range. Usually, you should make sure your code applies to _all_ ranges,
     * by using methods like [`changeByRange`]{@link EditorState.changeByRange}.
     */
    get main() { return this.ranges[this.mainIndex]; }
    /** Make sure the selection only has one range. Returns a selection holding only the main range from this selection. */
    asSingle() {
        return this.ranges.length == 1 ? this : new EditorSelection([this.main], 0);
    }
    /** Extend this selection with an extra range. */
    addRange(range, main = true) {
        return EditorSelection.create([range].concat(this.ranges), main ? 0 : this.mainIndex + 1);
    }
    /** Replace a given range with another range, and then normalize the selection to merge and sort ranges if necessary. */
    replaceRange(range, which = this.mainIndex) {
        let ranges = this.ranges.slice();
        ranges[which] = range;
        return EditorSelection.create(ranges, this.mainIndex);
    }
    /** Convert this selection to an object that can be serialized to JSON. */
    toJSON() {
        return { ranges: this.ranges.map(r => r.toJSON()), main: this.mainIndex };
    }
    /** Create a selection from a JSON representation. */
    static fromJSON(json) {
        if (!json || !Array.isArray(json.ranges) || typeof json.main != "number" || json.main >= json.ranges.length)
            throw new RangeError("Invalid JSON representation for EditorSelection");
        return new EditorSelection(json.ranges.map((r) => SelectionRange.fromJSON(r)), json.main);
    }
    /** Create a selection holding a single range. */
    static single(anchor, head = anchor) {
        return new EditorSelection([EditorSelection.range(anchor, head)], 0);
    }
    /** Sort and merge the given set of ranges, creating a valid selection. */
    static create(ranges, mainIndex = 0) {
        if (ranges.length == 0)
            throw new RangeError("A selection needs at least one range");
        for (let pos = 0, i = 0; i < ranges.length; i++) {
            let range = ranges[i];
            if (range.empty ? range.from <= pos : range.from < pos)
                return EditorSelection.normalized(ranges.slice(), mainIndex);
            pos = range.to;
        }
        return new EditorSelection(ranges, mainIndex);
    }
    /** Create a cursor selection range at the given position. You can safely ignore the optional arguments in most situations. */
    static cursor(pos, assoc = 0, bidiLevel, goalColumn) {
        return SelectionRange.create(pos, pos, (assoc == 0 ? 0 : assoc < 0 ? 4 /* RangeFlag.AssocBefore */ : 8 /* RangeFlag.AssocAfter */) |
            (bidiLevel == null ? 3 : Math.min(2, bidiLevel)) |
            ((goalColumn ?? 33554431 /* RangeFlag.NoGoalColumn */) << 5 /* RangeFlag.GoalColumnOffset */));
    }
    /** Create a selection range. */
    static range(anchor, head, goalColumn) {
        let goal = (goalColumn ?? 33554431 /* RangeFlag.NoGoalColumn */) << 5 /* RangeFlag.GoalColumnOffset */;
        return head < anchor ? SelectionRange.create(head, anchor, 16 /* RangeFlag.Inverted */ | goal | 8 /* RangeFlag.AssocAfter */)
            : SelectionRange.create(anchor, head, goal | (head > anchor ? 4 /* RangeFlag.AssocBefore */ : 0));
    }
    // @internal
    static normalized(ranges, mainIndex = 0) {
        let main = ranges[mainIndex];
        ranges.sort((a, b) => a.from - b.from);
        mainIndex = ranges.indexOf(main);
        for (let i = 1; i < ranges.length; i++) {
            let range = ranges[i], prev = ranges[i - 1];
            if (range.empty ? range.from <= prev.to : range.from < prev.to) {
                let from = prev.from, to = Math.max(range.to, prev.to);
                if (i <= mainIndex)
                    mainIndex--;
                ranges.splice(--i, 2, range.anchor > range.head ? EditorSelection.range(to, from) : EditorSelection.range(from, to));
            }
        }
        return new EditorSelection(ranges, mainIndex);
    }
}
export function checkSelection(selection, docLength) {
    for (let range of selection.ranges)
        if (range.to > docLength)
            throw new RangeError("Selection points outside of document");
}
