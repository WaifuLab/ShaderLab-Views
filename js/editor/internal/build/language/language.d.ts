import { Tree, TreeFragment, NodeProp, Parser } from "../lezer/common/index.js";
import type { LRParser, ParserConfig } from "../lezer/lr/index.js";
import { EditorState, StateField, Transaction, Extension, Facet, ChangeDesc } from "../state/index.js";
import { EditorView } from "../view/index.js";
/**
 * Node prop stored in a parser's top syntax node to provide the facet that stores language-specific data
 * for that language.
 */
export declare const languageDataProp: NodeProp<Facet<{
    [name: string]: any;
}, readonly {
    [name: string]: any;
}[]>>;
/**
 * Helper function to define a facet (to be added to the top syntax node(s) for a language via
 * {@link languageDataProp}), that will be used to associate language data with the language. You
 * probably only need this when subclassing {@link Language}.
 */
export declare function defineLanguageFacet(baseData?: {
    [name: string]: any;
}): Facet<{
    [name: string]: any;
}, readonly {
    [name: string]: any;
}[]>;
/**
 * A language object manages parsing and per-language [metadata]{@link languageDataAt}. Parse data is
 * managed as a [Lezer](https://lezer.codemirror.net) tree. The class can be used directly, via the
 * {@link LRLanguage} subclass for [Lezer](https://lezer.codemirror.net/) LR parsers, or via the
 * {@link StreamLanguage} subclass for stream parsers.
 */
export declare class Language {
    /** The [language data]{@link EditorState.languageDataAt} facet used for this language. */
    readonly data: Facet<{
        [name: string]: any;
    }>;
    /** A language name. */
    readonly name: string;
    /** The extension value to install this as the document language. */
    readonly extension: Extension;
    /** The parser object. Can be useful when using this as a [nested parser](https://lezer.codemirror.net/docs/ref#common.Parser). */
    parser: Parser;
    constructor(
    /** The [language data]{@link EditorState.languageDataAt} facet used for this language. */
    data: Facet<{
        [name: string]: any;
    }>, parser: Parser, extraExtensions?: Extension[], 
    /** A language name. */
    name?: string);
    /** Query whether this language is active at the given position. */
    isActiveAt(state: EditorState, pos: number, side?: -1 | 0 | 1): boolean;
    /**
     * Find the document regions that were parsed using this language. The returned regions will
     * _include_ any nested languages rooted in this language, when those exist.
     */
    findRegions(state: EditorState): {
        from: number;
        to: number;
    }[];
    /** Indicates whether this language allows nested languages. The default implementation returns true. */
    get allowsNesting(): boolean;
    static state: StateField<LanguageState>;
    static setState: import("../state/transaction").StateEffectType<LanguageState>;
}
/** A subclass of {@link Language} for use with Lezer [LR parsers](https://lezer.codemirror.net/docs/ref#lr.LRParser) parsers. */
export declare class LRLanguage extends Language {
    readonly parser: LRParser;
    private constructor();
    /** Define a language from a parser. */
    static define(spec: {
        /** The [name]{@link Language.name} of the language. */
        name?: string;
        /** The parser to use. Should already have added editor-relevant node props (and optionally things like dialect and top rule) configured. */
        parser: LRParser;
        /** [Language data]{@link languageDataAt} to register for this language. */
        languageData?: {
            [name: string]: any;
        };
    }): LRLanguage;
    /**
     * Create a new instance of this language with a reconfigured version of its parser and optionally a new name.
     */
    configure(options: ParserConfig, name?: string): LRLanguage;
    get allowsNesting(): boolean;
}
/**
 * Get the syntax tree for a state, which is the current (possibly incomplete) parse tree of the
 * active [language]{@link Language}, or the empty tree if there is no language available.
 */
export declare function syntaxTree(state: EditorState): Tree;
/**
 * Try to get a parse tree that spans at least up to `upto`. The method will do at most `timeout`
 * milliseconds of work to parse up to that point if the tree isn't already available.
 */
export declare function ensureSyntaxTree(state: EditorState, upto: number, timeout?: number): Tree | null;
/**
 * Queries whether there is a full syntax tree available up to the given document position.
 * If there isn't, the background parse process _might_ still be working and update the tree
 * further, but there is no guarantee of that—the parser will [stop working]{@link syntaxParserRunning}
 * when it has spent a certain amount of time or has moved beyond the visible viewport.
 * Always returns false if no language has been enabled.
 */
export declare function syntaxTreeAvailable(state: EditorState, upto?: number): boolean;
/**
 * Move parsing forward, and update the editor state afterwards to reflect the new tree.
 * Will work for at most `timeout` milliseconds. Returns true if the parser managed get
 * to the given position in that time.
 */
export declare function forceParsing(view: EditorView, upto?: number, timeout?: number): boolean;
/**
 * Tells you whether the language parser is planning to do more parsing work (in a `requestIdleCallback`
 * pseudo-thread) or has stopped running, either because it parsed the entire document, because it spent
 * too much time and was cut off, or because there is no language parser enabled.
 */
export declare function syntaxParserRunning(view: EditorView): boolean;
/** A parse context provided to parsers working on the editor content. */
export declare class ParseContext {
    private parser;
    /** The current editor state. */
    readonly state: EditorState;
    /** Tree fragments that can be reused by incremental re-parses. */
    fragments: readonly TreeFragment[];
    tree: Tree;
    treeLen: number;
    /**
     * The current editor viewport (or some overapproximation thereof). Intended to be used
     * for opportunistically avoiding work (in which case {@link skipUntilInView} should be
     * called to make sure the parser is restarted when the skipped region becomes visible).
     */
    viewport: {
        from: number;
        to: number;
    };
    skipped: {
        from: number;
        to: number;
    }[];
    /**
     * This is where skipping parsers can register a promise that, when resolved, will
     * schedule a new parse. It is cleared when the parse worker picks up the promise.
     */
    scheduleOn: Promise<unknown> | null;
    private parse;
    tempSkipped: {
        from: number;
        to: number;
    }[];
    private constructor();
    static create(parser: Parser, state: EditorState, viewport: {
        from: number;
        to: number;
    }): ParseContext;
    private startParse;
    work(until: number | (() => boolean), upto?: number): boolean;
    takeTree(): void;
    private withContext;
    private withoutTempSkipped;
    changes(changes: ChangeDesc, newState: EditorState): ParseContext;
    updateViewport(viewport: {
        from: number;
        to: number;
    }): boolean;
    reset(): void;
    /**
     * Notify the parse scheduler that the given region was skipped because it wasn't in view, and the
     * parse should be restarted when it comes into view.
     */
    skipUntilInView(from: number, to: number): void;
    /**
     * Returns a parser intended to be used as placeholder when asynchronously loading a nested parser.
     * It'll skip its input and mark it as not-really-parsed, so that the next update will parse it again.
     * @param until a reparse will be scheduled when that promise resolves.
     */
    static getSkippingParser(until?: Promise<unknown>): Parser;
    isDone(upto: number): boolean | 0;
    /** Get the context for the current parse, or `null` if no editor parse is in progress. */
    static get(): ParseContext | null;
}
declare class LanguageState {
    readonly context: ParseContext;
    readonly tree: Tree;
    constructor(context: ParseContext);
    apply(tr: Transaction): LanguageState;
    static init(state: EditorState): LanguageState;
}
/** The facet used to associate a language with an editor state. */
export declare const language: Facet<Language, Language | null>;
/**
 * This class bundles a {@link language} with an optional set of supporting extensions. Language
 * packages are encouraged to export a function that optionally takes a configuration object and
 * returns a `LanguageSupport` instance, as the main way for client code to use the package.
 */
export declare class LanguageSupport {
    /** The language object. */
    readonly language: Language;
    /**
     * An optional set of supporting extensions. When nesting a language in another language, the
     * outer language is encouraged to include the supporting extensions for its inner languages
     * in its own set of support extensions.
     */
    readonly support: Extension;
    /**
     * An extension including both the language and its support extensions. (Allowing the object to
     * be used as an extension value itself.)
     */
    extension: Extension;
    /** Create a language support object. */
    constructor(
    /** The language object. */
    language: Language, 
    /**
     * An optional set of supporting extensions. When nesting a language in another language, the
     * outer language is encouraged to include the supporting extensions for its inner languages
     * in its own set of support extensions.
     */
    support?: Extension);
}
/**
 * Language descriptions are used to store metadata about languages and to dynamically load them.
 * Their main role is finding the appropriate language for a filename or dynamically loading nested
 * parsers.
 */
export declare class LanguageDescription {
    /** The name of this language. */
    readonly name: string;
    /** Alternative names for the mode (lowercased, includes `this.name`). */
    readonly alias: readonly string[];
    /** File extensions associated with this language. */
    readonly extensions: readonly string[];
    /** Optional filename pattern that should be associated with this language. */
    readonly filename: RegExp | undefined;
    private loadFunc;
    /** If the language has been loaded, this will hold its value. */
    support: LanguageSupport | undefined;
    private loading;
    private constructor();
    /**
     * Start loading the language. Will return a promise that resolves to a {@link LanguageSupport}
     * object when the language successfully loads.
     */
    load(): Promise<LanguageSupport>;
    /**
     * Create a language description.
     * @param spec.name The language's name.
     * @param [spec.alias] An optional array of alternative names.
     * @param [spec.extensions] An optional array of filename extensions associated with this language.
     * @param [spec.filename] An optional filename pattern associated with this language.
     * @param [spec.load] A function that will asynchronously load the language.
     * @param [spec.support] Alternatively to `load`, you can provide an already loaded support object. Either this or `load` should be provided.
     */
    static of(spec: {
        name: string;
        alias?: readonly string[];
        extensions?: readonly string[];
        filename?: RegExp;
        load?: () => Promise<LanguageSupport>;
        support?: LanguageSupport;
    }): LanguageDescription;
    /**
     * Look for a language in the given array of descriptions that matches the filename. Will first
     * match {@link filename} patterns, and then {@link extensions}, and return the first language
     * that matches.
     */
    static matchFilename(descs: readonly LanguageDescription[], filename: string): LanguageDescription | null;
    /**
     * Look for a language whose name or alias matches the the given name (case-insensitively). If
     * `fuzzy` is true, and no direct matchs is found, this'll also search for a language whose name
     * or alias occurs in the string (for names shorter than three characters, only when surrounded
     * by non-word characters).
     */
    static matchLanguageName(descs: readonly LanguageDescription[], name: string, fuzzy?: boolean): LanguageDescription | null;
}
export {};
