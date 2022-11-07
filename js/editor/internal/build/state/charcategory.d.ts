/**
 * The categories produced by a [character categorizer]{@link EditorState.charCategorizer}. These are used
 * do things like selecting by word.
 */
export declare enum CharCategory {
    Word = 0,
    Space = 1,
    Other = 2
}
export declare function makeCategorizer(wordChars: string): (char: string) => CharCategory;
