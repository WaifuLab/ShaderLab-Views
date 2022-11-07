import { showPanel } from "./internal/build/view/panel.js";
import { EditorView } from "./internal/build/view/index.js";

let compile = () => {};
export let compileDelegate = callback => { compile = callback; };

const countWords = doc => {
    let count = 0, iter = doc.iter();
    while (!iter.next().done) {
        for (let i = 0; i < iter.value.length; i++) {
            let word = /\w/.test(iter.value[i]);
            if (word) count++;
        }
    }
    return `Char count: ${count}`;
}

const wordCountPanel = view => {
    let dom = document.createElement("div"),
        left = document.createElement("div"),
        right = document.createElement("div");
    dom.append(left, right);
    left.classList.add("cm-count");
    left.textContent = countWords(view.state.doc);
    right.classList.add("cm-compile");
    right.textContent = "Compiler";
    right.addEventListener("click", () => compile());
    return {
        dom,
        update(update) {
            if (update.docChanged)
                left.textContent = countWords(update.state.doc);
        }
    };
}

const footerTheme = EditorView.baseTheme({
    ".cm-panel": {
        display: "flex",
        justifyContent: "space-between",
        lineHeight: "1.75em",
        fontSize: "1em"
    },

    ".cm-count": {
        margin: "3px 0 0 18px"
    },

    ".cm-compile": {
        margin: "2px 18px 2px 0",
        border: "1px solid #ccc",
        borderRadius: "10px",
        width: "4.75em",
        cursor: "pointer",
        textAlign: "center"
    }
})

export const wordCounter = [
    footerTheme,
    showPanel.of(wordCountPanel),
];
