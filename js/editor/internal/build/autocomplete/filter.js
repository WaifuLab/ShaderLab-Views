import { codePointAt, codePointSize, fromCodePoint } from "../state/index.js";
/**
 * A pattern matcher for fuzzy completion matching. Create an instance once for a pattern, and then use
 * that to match any number of completions.
 */
export class FuzzyMatcher {
    constructor(pattern) {
        this.pattern = pattern;
        this.chars = [];
        this.folded = [];
        // Buffers reused by calls to `match` to track matched character positions.
        this.any = [];
        this.precise = [];
        this.byWord = [];
        for (let p = 0; p < pattern.length;) {
            let char = codePointAt(pattern, p), size = codePointSize(char);
            this.chars.push(char);
            let part = pattern.slice(p, p + size), upper = part.toUpperCase();
            this.folded.push(codePointAt(upper == part ? part.toLowerCase() : upper, 0));
            p += size;
        }
        this.astral = pattern.length != this.chars.length;
    }
    /**
     * Matches a given word (completion) against the pattern (input). Will return null for no match, and
     * otherwise an array that starts with the match score, followed by any number of `from, to` pairs
     * indicating the matched parts of `word`.
     * The score is a number that is more negative the worse the match is. See `Penalty` above.
     */
    match(word) {
        if (this.pattern.length == 0)
            return [0];
        if (word.length < this.pattern.length)
            return null;
        let { chars, folded, any, precise, byWord } = this;
        // For single-character queries, only match when they occur right at the start
        if (chars.length == 1) {
            let first = codePointAt(word, 0);
            return first == chars[0] ? [0, 0, codePointSize(first)] :
                first == folded[0] ? [-200 /* Penalty.CaseFold */, 0, codePointSize(first)] : null;
        }
        let direct = word.indexOf(this.pattern);
        if (direct == 0)
            return [0, 0, this.pattern.length];
        let len = chars.length, anyTo = 0;
        if (direct < 0) {
            for (let i = 0, e = Math.min(word.length, 200); i < e && anyTo < len;) {
                let next = codePointAt(word, i);
                if (next == chars[anyTo] || next == folded[anyTo])
                    any[anyTo++] = i;
                i += codePointSize(next);
            }
            // No match, exit immediately
            if (anyTo < len)
                return null;
        }
        // This tracks the extent of the precise (non-folded, not necessarily adjacent) match
        let preciseTo = 0;
        // Tracks whether there is a match that hits only characters that appear to be starting words. `byWordFolded` is set to true when
        // a case folded character is encountered in such a match
        let byWordTo = 0, byWordFolded = false;
        // If we've found a partial adjacent match, these track its state
        let adjacentTo = 0, adjacentStart = -1, adjacentEnd = -1;
        let hasLower = /[a-z]/.test(word), wordAdjacent = true;
        // Go over the option's text, scanning for the various kinds of matches
        for (let i = 0, e = Math.min(word.length, 200), prevType = 0 /* Tp.NonWord */; i < e && byWordTo < len;) {
            let next = codePointAt(word, i);
            if (direct < 0) {
                if (preciseTo < len && next == chars[preciseTo])
                    precise[preciseTo++] = i;
                if (adjacentTo < len) {
                    if (next == chars[adjacentTo] || next == folded[adjacentTo]) {
                        if (adjacentTo == 0)
                            adjacentStart = i;
                        adjacentEnd = i + 1;
                        adjacentTo++;
                    }
                    else {
                        adjacentTo = 0;
                    }
                }
            }
            let ch, type = next < 0xff ?
                (next >= 48 && next <= 57 || next >= 97 && next <= 122 ? 2 /* Tp.Lower */ : next >= 65 && next <= 90 ? 1 /* Tp.Upper */ : 0 /* Tp.NonWord */) :
                ((ch = fromCodePoint(next)) != ch.toLowerCase() ? 1 /* Tp.Upper */ : ch != ch.toUpperCase() ? 2 /* Tp.Lower */ : 0 /* Tp.NonWord */);
            if (!i || type == 1 /* Tp.Upper */ && hasLower || prevType == 0 /* Tp.NonWord */ && type != 0 /* Tp.NonWord */) {
                if (chars[byWordTo] == next || (folded[byWordTo] == next && (byWordFolded = true)))
                    byWord[byWordTo++] = i;
                else if (byWord.length)
                    wordAdjacent = false;
            }
            prevType = type;
            i += codePointSize(next);
        }
        if (byWordTo == len && byWord[0] == 0 && wordAdjacent)
            return this.result(-100 /* Penalty.ByWord */ + (byWordFolded ? -200 /* Penalty.CaseFold */ : 0), byWord, word);
        if (adjacentTo == len && adjacentStart == 0)
            return [-200 /* Penalty.CaseFold */ - word.length, 0, adjacentEnd];
        if (direct > -1)
            return [-700 /* Penalty.NotStart */ - word.length, direct, direct + this.pattern.length];
        if (adjacentTo == len)
            return [-200 /* Penalty.CaseFold */ + -700 /* Penalty.NotStart */ - word.length, adjacentStart, adjacentEnd];
        if (byWordTo == len)
            return this.result(-100 /* Penalty.ByWord */ + (byWordFolded ? -200 /* Penalty.CaseFold */ : 0) + -700 /* Penalty.NotStart */ +
                (wordAdjacent ? 0 : -1100 /* Penalty.Gap */), byWord, word);
        return chars.length == 2 ? null : this.result((any[0] ? -700 /* Penalty.NotStart */ : 0) + -200 /* Penalty.CaseFold */ + -1100 /* Penalty.Gap */, any, word);
    }
    result(score, positions, word) {
        let result = [score - word.length], i = 1;
        for (let pos of positions) {
            let to = pos + (this.astral ? codePointSize(codePointAt(word, pos)) : 1);
            if (i > 1 && result[i - 1] == pos)
                result[i - 1] = to;
            else {
                result[i++] = pos;
                result[i++] = to;
            }
        }
        return result;
    }
}
