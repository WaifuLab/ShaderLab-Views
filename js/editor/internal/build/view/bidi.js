import { EditorSelection, findClusterBreak } from "../state/index.js";
/** Used to indicate [text direction]{@link EditorView.textDirection}. */
export var Direction;
(function (Direction) {
    // Left-to-right.
    Direction[Direction["LTR"] = 0] = "LTR";
    // Right-to-left.
    Direction[Direction["RTL"] = 1] = "RTL";
})(Direction || (Direction = {}));
const LTR = Direction.LTR, RTL = Direction.RTL;
/** Decode a string with each type encoded as log2(type) */
function dec(str) {
    let result = [];
    for (let i = 0; i < str.length; i++)
        result.push(1 << +str[i]);
    return result;
}
// Character types for codepoints 0 to 0xf8
const LowTypes = dec("88888888888888888888888888888888888666888888787833333333337888888000000000000000000000000008888880000000000000000000000000088888888888888888888888888888888888887866668888088888663380888308888800000000000000000000000800000000000000000000000000000008");
// Character types for codepoints 0x600 to 0x6f9
const ArabicTypes = dec("4444448826627288999999999992222222222222222222222222222222222222222222222229999999999999999999994444444444644222822222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222999999949999999229989999223333333333");
const Brackets = Object.create(null), BracketStack = [];
// There's a lot more in https://www.unicode.org/Public/UCD/latest/ucd/BidiBrackets.txt
for (let p of ["()", "[]", "{}"]) {
    let l = p.charCodeAt(0), r = p.charCodeAt(1);
    Brackets[l] = r;
    Brackets[r] = -l;
}
function charType(ch) {
    return ch <= 0xf7 ? LowTypes[ch] :
        0x590 <= ch && ch <= 0x5f4 ? 2 /* T.R */ :
            0x600 <= ch && ch <= 0x6f9 ? ArabicTypes[ch - 0x600] :
                0x6ee <= ch && ch <= 0x8ac ? 4 /* T.AL */ :
                    0x2000 <= ch && ch <= 0x200b ? 256 /* T.NI */ :
                        0xfb50 <= ch && ch <= 0xfdff ? 4 /* T.AL */ :
                            ch == 0x200c ? 256 /* T.NI */ : 1 /* T.L */;
}
const BidiRE = /[\u0590-\u05f4\u0600-\u06ff\u0700-\u08ac\ufb50-\ufdff]/;
/** Represents a contiguous range of text that has a single direction (as in left-to-right or right-to-left). */
export class BidiSpan {
    // @internal
    constructor(
    /** The start of the span (relative to the start of the line). */
    from, 
    /** The end of the span. */
    to, 
    /**
     * The ["bidi level"](https://unicode.org/reports/tr9/#Basic_Display_Algorithm) of the span
     * (in this context, 0 means left-to-right, 1 means right-to-left, 2 means left-to-right
     * number inside right-to-left text).
     */
    level) {
        this.from = from;
        this.to = to;
        this.level = level;
    }
    /** The direction of this span. */
    get dir() { return this.level % 2 ? RTL : LTR; }
    // @internal
    side(end, dir) { return (this.dir == dir) == end ? this.to : this.from; }
    // @internal
    static find(order, index, level, assoc) {
        let maybe = -1;
        for (let i = 0; i < order.length; i++) {
            let span = order[i];
            if (span.from <= index && span.to >= index) {
                if (span.level == level)
                    return i;
                // When multiple spans match, if assoc != 0, take the one that covers that side, otherwise take the one with the minimum level.
                if (maybe < 0 || (assoc != 0 ? (assoc < 0 ? span.from < index : span.to > index) : order[maybe].level > span.level))
                    maybe = i;
            }
        }
        if (maybe < 0)
            throw new RangeError("Index out of range");
        return maybe;
    }
}
// Reused array of character types
const types = [];
export function computeOrder(line, direction) {
    let len = line.length, outerType = direction == LTR ? 1 /* T.L */ : 2 /* T.R */, oppositeType = direction == LTR ? 2 /* T.R */ : 1 /* T.L */;
    if (!line || outerType == 1 /* T.L */ && !BidiRE.test(line))
        return trivialOrder(len);
    // W1. Examine each non-spacing mark (NSM) in the level run, and change the type of the NSM
    // to the type of the previous character. If the NSM is at the start of the level run, it will
    // get the type of sor.
    // W2. Search backwards from each instance of a European number until the first strong type
    // (R, L, AL, or sor) is found. If an AL is found, change the type of the European number to
    // Arabic number.
    // W3. Change all ALs to R.
    // (Left after this: L, R, EN, AN, ET, CS, NI)
    for (let i = 0, prev = outerType, prevStrong = outerType; i < len; i++) {
        let type = charType(line.charCodeAt(i));
        if (type == 512 /* T.NSM */)
            type = prev;
        else if (type == 8 /* T.EN */ && prevStrong == 4 /* T.AL */)
            type = 16 /* T.AN */;
        types[i] = type == 4 /* T.AL */ ? 2 /* T.R */ : type;
        if (type & 7 /* T.Strong */)
            prevStrong = type;
        prev = type;
    }
    // W5. A sequence of European terminators adjacent to European numbers changes to all European
    // numbers.
    // W6. Otherwise, separators and terminators change to Other Neutral.
    // W7. Search backwards from each instance of a European number until the first strong type (R,
    // L, or sor) is found. If an L is found, then change the type of the European number to L.
    // (Left after this: L, R, EN+AN, NI)
    for (let i = 0, prev = outerType, prevStrong = outerType; i < len; i++) {
        let type = types[i];
        if (type == 128 /* T.CS */) {
            if (i < len - 1 && prev == types[i + 1] && (prev & 24 /* T.Num */))
                type = types[i] = prev;
            else
                types[i] = 256 /* T.NI */;
        }
        else if (type == 64 /* T.ET */) {
            let end = i + 1;
            while (end < len && types[end] == 64 /* T.ET */)
                end++;
            let replace = (i && prev == 8 /* T.EN */) || (end < len && types[end] == 8 /* T.EN */) ? (prevStrong == 1 /* T.L */ ? 1 /* T.L */ : 8 /* T.EN */) : 256 /* T.NI */;
            for (let j = i; j < end; j++)
                types[j] = replace;
            i = end - 1;
        }
        else if (type == 8 /* T.EN */ && prevStrong == 1 /* T.L */) {
            types[i] = 1 /* T.L */;
        }
        prev = type;
        if (type & 7 /* T.Strong */)
            prevStrong = type;
    }
    // N0. Process bracket pairs in an isolating run sequence sequentially in the logical
    // order of the text positions of the opening paired brackets using the logic given
    // below. Within this
    // scope, bidirectional types EN and AN are treated as R.
    for (let i = 0, sI = 0, context = 0, ch, br, type; i < len; i++) {
        // Keeps [startIndex, type, strongSeen] triples for each open bracket on BracketStack.
        if (br = Brackets[ch = line.charCodeAt(i)]) {
            if (br < 0) { // Closing bracket
                for (let sJ = sI - 3; sJ >= 0; sJ -= 3) {
                    if (BracketStack[sJ + 1] == -br) {
                        let flags = BracketStack[sJ + 2];
                        let type = (flags & 2 /* Bracketed.EmbedInside */) ? outerType :
                            !(flags & 4 /* Bracketed.OppositeInside */) ? 0 :
                                (flags & 1 /* Bracketed.OppositeBefore */) ? oppositeType : outerType;
                        if (type)
                            types[i] = types[BracketStack[sJ]] = type;
                        sI = sJ;
                        break;
                    }
                }
            }
            else if (BracketStack.length == 189 /* Bracketed.MaxDepth */) {
                break;
            }
            else {
                BracketStack[sI++] = i;
                BracketStack[sI++] = ch;
                BracketStack[sI++] = context;
            }
        }
        else if ((type = types[i]) == 2 /* T.R */ || type == 1 /* T.L */) {
            let embed = type == outerType;
            context = embed ? 0 : 1 /* Bracketed.OppositeBefore */;
            for (let sJ = sI - 3; sJ >= 0; sJ -= 3) {
                let cur = BracketStack[sJ + 2];
                if (cur & 2 /* Bracketed.EmbedInside */)
                    break;
                if (embed) {
                    BracketStack[sJ + 2] |= 2 /* Bracketed.EmbedInside */;
                }
                else {
                    if (cur & 4 /* Bracketed.OppositeInside */)
                        break;
                    BracketStack[sJ + 2] |= 4 /* Bracketed.OppositeInside */;
                }
            }
        }
    }
    // N1. A sequence of neutrals takes the direction of the surrounding strong text if
    // the text on both sides has the same direction. European and Arabic numbers act as
    // if they were R in terms of their influence on neutrals. Start-of-level-run (sor)
    // and end-of-level-run (eor) are used at level run boundaries.
    // N2. Any remaining neutrals take the embedding direction.
    // (Left after this: L, R, EN+AN)
    for (let i = 0; i < len; i++) {
        if (types[i] == 256 /* T.NI */) {
            let end = i + 1;
            while (end < len && types[end] == 256 /* T.NI */)
                end++;
            let beforeL = (i ? types[i - 1] : outerType) == 1 /* T.L */;
            let afterL = (end < len ? types[end] : outerType) == 1 /* T.L */;
            let replace = beforeL == afterL ? (beforeL ? 1 /* T.L */ : 2 /* T.R */) : outerType;
            for (let j = i; j < end; j++)
                types[j] = replace;
            i = end - 1;
        }
    }
    // Here we depart from the documented algorithm, in order to avoid building up an actual levels
    // array. Since there are only three levels (0, 1, 2) in an implementation that doesn't take
    // explicit embedding into account, we can build up the order on the fly, without following the
    // level-based algorithm.
    let order = [];
    if (outerType == 1 /* T.L */) {
        for (let i = 0; i < len;) {
            let start = i, rtl = types[i++] != 1 /* T.L */;
            while (i < len && rtl == (types[i] != 1 /* T.L */))
                i++;
            if (rtl) {
                for (let j = i; j > start;) {
                    let end = j, l = types[--j] != 2 /* T.R */;
                    while (j > start && l == (types[j - 1] != 2 /* T.R */))
                        j--;
                    order.push(new BidiSpan(j, end, l ? 2 : 1));
                }
            }
            else {
                order.push(new BidiSpan(start, i, 0));
            }
        }
    }
    else {
        for (let i = 0; i < len;) {
            let start = i, rtl = types[i++] == 2 /* T.R */;
            while (i < len && rtl == (types[i] == 2 /* T.R */))
                i++;
            order.push(new BidiSpan(start, i, rtl ? 1 : 2));
        }
    }
    return order;
}
export function trivialOrder(length) {
    return [new BidiSpan(0, length, 0)];
}
export let movedOver = "";
export function moveVisually(line, order, dir, start, forward) {
    let startIndex = start.head - line.from, spanI = -1;
    if (startIndex == 0) {
        if (!forward || !line.length)
            return null;
        if (order[0].level != dir) {
            startIndex = order[0].side(false, dir);
            spanI = 0;
        }
    }
    else if (startIndex == line.length) {
        if (forward)
            return null;
        let last = order[order.length - 1];
        if (last.level != dir) {
            startIndex = last.side(true, dir);
            spanI = order.length - 1;
        }
    }
    if (spanI < 0)
        spanI = BidiSpan.find(order, startIndex, start.bidiLevel ?? -1, start.assoc);
    let span = order[spanI];
    // End of span. (But not end of line--that was checked for above.)
    if (startIndex == span.side(forward, dir)) {
        span = order[spanI += forward ? 1 : -1];
        startIndex = span.side(!forward, dir);
    }
    let indexForward = forward == (span.dir == dir);
    let nextIndex = findClusterBreak(line.text, startIndex, indexForward);
    movedOver = line.text.slice(Math.min(startIndex, nextIndex), Math.max(startIndex, nextIndex));
    if (nextIndex != span.side(forward, dir))
        return EditorSelection.cursor(nextIndex + line.from, indexForward ? -1 : 1, span.level);
    let nextSpan = spanI == (forward ? order.length - 1 : 0) ? null : order[spanI + (forward ? 1 : -1)];
    if (!nextSpan && span.level != dir)
        return EditorSelection.cursor(forward ? line.to : line.from, forward ? -1 : 1, dir);
    if (nextSpan && nextSpan.level < span.level)
        return EditorSelection.cursor(nextSpan.side(!forward, dir) + line.from, forward ? 1 : -1, nextSpan.level);
    return EditorSelection.cursor(nextIndex + line.from, forward ? -1 : 1, span.level);
}
