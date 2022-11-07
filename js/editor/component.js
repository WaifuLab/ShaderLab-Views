import { defaultConfig } from "./internal/default.js";
import { EditorView } from "./internal/build/view/index.js";
import { EditorState, Compartment } from "./internal/build/state/index.js";
import { wordCounter } from "./footer.js";
import { Languages, StyledTheme } from "./internal/constant.js";

const isMobile = /android|iphone|kindle/i.test(navigator.userAgent);
const themeCompartment = new Compartment();
const tabSizeCompartment = new Compartment();
const languageCompartment = new Compartment();

export class EditorElement extends HTMLElement {
    #shadowRoot;
    #editorView;
    codeHash;

    constructor(fileName) {
        super();
        this.codeHash = window.btoa(fileName); // force use window
        this.#shadowRoot = this.attachShadow({ mode: "open" });
        this.#editorView = new EditorView({
            state: EditorState.create({
                doc: localStorage.getItem(this.storageKey("source")) || '',
                extensions: [
                    defaultConfig,
                    EditorView.lineWrapping, // css white-space
                    EditorView.updateListener.of(update => {
                        if (!update.docChanged) return;
                        const content = this.#editorView.state.doc.toString();
                        localStorage.setItem(this.storageKey("source"), content);
                    }),
                    tabSizeCompartment.of(EditorState.tabSize.of(4)),
                    languageCompartment.of([
                        Languages[`${isMobile ? "lsp" : "lint"}/javascript`](),
                    ].filter(Boolean)),
                    wordCounter,
                    StyledTheme
                ]
            }),
            parent: this.#shadowRoot
        });
    }

    connectedCallback() {

    }

    /**
     * Generate local storage key
     * @param {string} field
     * @return {string}
     */
    storageKey(field) {
        return `ShaderLab:${this.hash}:${field}`;
    }

    /**
     * Set tab size
     * @param {number} size
     */
    setTabSize(size) {
        this.#editorView.dispatch({
            effects: tabSizeCompartment.reconfigure(EditorState.tabSize.of(size))
        });
    }

    /**
     * Set editor language
     * @param {string} language
     * @param {string} mode
     */
    setLanguage(language, mode = "lint") {
        this.#editorView.dispatch({
            effects: languageCompartment.reconfigure(Languages[`${language}/${mode}`]())
        });
    }
}

customElements.define("sl-editor", EditorElement);
