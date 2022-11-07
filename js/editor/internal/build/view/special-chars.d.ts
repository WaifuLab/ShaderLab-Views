import { Extension } from "../state/index.js";
interface SpecialCharConfig {
    /**
     * An optional function that renders the placeholder elements.
     *
     * The `description` argument will be text that clarifies what the character is, which should
     * be provided to screen readers (for example with the [`aria-label`](https://www.w3.org/TR/wai-aria/#aria-label)
     * attribute) and optionally shown to the user in other ways (such as the
     * [`title`](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/title) attribute).
     *
     * The given placeholder string is a suggestion for how to display the character visually.
     */
    render?: ((code: number, description: string | null, placeholder: string) => HTMLElement) | null;
    /** Regular expression that matches the special characters to highlight. Must have its 'g'/global flag set. */
    specialChars?: RegExp;
    /** Regular expression that can be used to add characters to the default set of characters to highlight. */
    addSpecialChars?: RegExp | null;
}
/**
 * Returns an extension that installs highlighting of special characters.
 * @param config Configuration options.
 */
export declare function highlightSpecialChars(config?: SpecialCharConfig): Extension;
export {};
