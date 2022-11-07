export { language, Language, LRLanguage, defineLanguageFacet, syntaxTree, ensureSyntaxTree, languageDataProp, ParseContext, LanguageSupport, LanguageDescription, syntaxTreeAvailable, syntaxParserRunning, forceParsing } from "./language.js";
export { IndentContext, getIndentUnit, indentString, indentOnInput, indentService, getIndentation, indentRange, indentUnit, TreeIndentContext, indentNodeProp, delimitedIndent, continuedIndent, flatIndent } from "./indent.js";
export { foldService, foldNodeProp, foldInside, foldable, foldCode, unfoldCode, foldAll, unfoldAll, foldKeymap, codeFolding, foldGutter, foldedRanges, foldEffect, unfoldEffect, foldState } from "./fold.js";
export { HighlightStyle, syntaxHighlighting, highlightingFor, defaultHighlightStyle } from "./highlight.js";
export { bracketMatching, matchBrackets } from "./matchbrackets.js";
export { StreamLanguage } from "./stream-parser.js";
export { StringStream } from "./stringstream.js";
