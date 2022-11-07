/**
 * A pattern matcher for fuzzy completion matching. Create an instance once for a pattern, and then use
 * that to match any number of completions.
 */
export declare class FuzzyMatcher {
    readonly pattern: string;
    chars: number[];
    folded: number[];
    astral: boolean;
    any: number[];
    precise: number[];
    byWord: number[];
    constructor(pattern: string);
    /**
     * Matches a given word (completion) against the pattern (input). Will return null for no match, and
     * otherwise an array that starts with the match score, followed by any number of `from, to` pairs
     * indicating the matched parts of `word`.
     * The score is a number that is more negative the worse the match is. See `Penalty` above.
     */
    match(word: string): number[] | null;
    result(score: number, positions: number[], word: string): number[];
}
