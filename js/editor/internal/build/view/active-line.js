import { ViewPlugin } from "./extension.js";
import { Decoration } from "./decoration.js";
/** Mark lines that have a cursor on them with the `"cm-activeLine"` DOM class. */
export function highlightActiveLine() {
    return activeLineHighlighter;
}
const lineDeco = Decoration.line({ class: "cm-activeLine" });
const activeLineHighlighter = ViewPlugin.fromClass(class {
    constructor(view) {
        this.decorations = this.getDeco(view);
    }
    update(update) {
        if (update.docChanged || update.selectionSet)
            this.decorations = this.getDeco(update.view);
    }
    getDeco(view) {
        let lastLineStart = -1, deco = [];
        for (let r of view.state.selection.ranges) {
            let line = view.lineBlockAt(r.head);
            if (line.from > lastLineStart) {
                deco.push(lineDeco.range(line.from));
                lastLineStart = line.from;
            }
        }
        return Decoration.set(deco);
    }
}, {
    decorations: v => v.decorations
});
