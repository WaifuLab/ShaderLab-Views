import { EditorView } from "./build/view/index.js";
import { javascript } from "./javascript.js";
import { wgsl } from "./wgsl.js";

export const Languages = {
    "lint/javascript": () => javascript(),
    "lint/wgsl": () => wgsl(),
    "lsp/javascript": () => void 0,
    "lsp/wgsl": () => void 0,
};

export const StyledTheme = EditorView.baseTheme({
    ".cm-scroller": {
        overflowY: "auto"
    },

    ".cm-scroller::-webkit-scrollbar": {
        width: "10px"
    },

    ".cm-scroller::-webkit-scrollbar-track": {
        borderRadius: "5px",
        background: "rgba(220, 220, 220, 0.4)"
    },

    ".cm-scroller::-webkit-scrollbar-thumb": {
        borderRadius: "5px",
        background: "rgba(150, 150, 150, 0.6)",
    },

    ".cm-scroller::-webkit-scrollbar-thumb:hover": {
        background: "rgba(120, 120, 120, 0.8)"
    },

    "&.cm-editor": {
        height: "450px",
        "&.cm-focused": {
            outline: "none"
        }
    }
});
