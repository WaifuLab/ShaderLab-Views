import { codePointAt, codePointSize, fromCodePoint } from "../state/index.js";
const basicNormalize = typeof String.prototype.normalize == "function"
    ? x => x.normalize("NFKD") : x => x;
/** A search cursor provides an iterator over text matches in a document. */
export class SearchCursor {
    /**
     * Create a text cursor. The query is the search string, `from` to `to` provides the region to search.
     *
     * When `normalize` is given, it will be called, on both the query string and the content it is matched
     * against, before comparing. You can, for example, create a case-insensitive search by passing
     * `s => s.toLowerCase()`.
     *
     * Text is always normalized with
     * [`.normalize("NFKD")`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize) (when supported).
     */
    constructor(text, query, from = 0, to = text.length, normalize, test) {
        this.test = test;
        /**
         * The current match (only holds a meaningful value after [`next`]{@link SearchCursor.next} has been
         * called and when `done` is false).
         */
        this.value = { from: 0, to: 0 };
        /** Whether the end of the iterated region has been reached. */
        this.done = false;
        this.matches = [];
        this.buffer = "";
        this.bufferPos = 0;
        this.iter = text.iterRange(from, to);
        this.bufferStart = from;
        this.normalize = normalize ? x => normalize(basicNormalize(x)) : basicNormalize;
        this.query = this.normalize(query);
    }
    static { Symbol.iterator; }
    peek() {
        if (this.bufferPos == this.buffer.length) {
            this.bufferStart += this.buffer.length;
            this.iter.next();
            if (this.iter.done)
                return -1;
            this.bufferPos = 0;
            this.buffer = this.iter.value;
        }
        return codePointAt(this.buffer, this.bufferPos);
    }
    /**
     * Look for the next match. Updates the iterator's [`value`]{@link SearchCursor.value} and
     * [`done`]{@link SearchCursor.done} properties. Should be called at least once before using the cursor.
     */
    next() {
        while (this.matches.length)
            this.matches.pop();
        return this.nextOverlapping();
    }
    /**
     * The `next` method will ignore matches that partially overlap a previous match. This method behaves
     * like `next`, but includes such matches.
     */
    nextOverlapping() {
        for (;;) {
            let next = this.peek();
            if (next < 0) {
                this.done = true;
                return this;
            }
            let str = fromCodePoint(next), start = this.bufferStart + this.bufferPos;
            this.bufferPos += codePointSize(next);
            let norm = this.normalize(str);
            for (let i = 0, pos = start;; i++) {
                let code = norm.charCodeAt(i);
                let match = this.match(code, pos);
                if (match) {
                    this.value = match;
                    return this;
                }
                if (i == norm.length - 1)
                    break;
                if (pos == start && i < str.length && str.charCodeAt(i) == code)
                    pos++;
            }
        }
    }
    match(code, pos) {
        let match = null;
        for (let i = 0; i < this.matches.length; i += 2) {
            let index = this.matches[i], keep = false;
            if (this.query.charCodeAt(index) == code) {
                if (index == this.query.length - 1) {
                    match = { from: this.matches[i + 1], to: pos + 1 };
                }
                else {
                    this.matches[i]++;
                    keep = true;
                }
            }
            if (!keep) {
                this.matches.splice(i, 2);
                i -= 2;
            }
        }
        if (this.query.charCodeAt(0) == code) {
            if (this.query.length == 1)
                match = { from: pos, to: pos + 1 };
            else
                this.matches.push(1, pos);
        }
        if (match && this.test && !this.test(match.from, match.to, this.buffer, this.bufferPos))
            match = null;
        return match;
    }
}
if (typeof Symbol != "undefined")
    SearchCursor.prototype[Symbol.iterator] = function () { return this; };
