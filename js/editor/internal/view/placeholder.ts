import {Extension} from "../state/index"
import {ViewPlugin} from "./extension"
import {Decoration, DecorationSet, WidgetType} from "./decoration"
import {EditorView} from "./editorview"

class Placeholder extends WidgetType {
    constructor(readonly content: string | HTMLElement) { super() }

    toDOM() {
        let wrap = document.createElement("span")
        wrap.className = "cm-placeholder"
        wrap.style.pointerEvents = "none"
        wrap.appendChild(typeof this.content == "string" ? document.createTextNode(this.content) : this.content)
        if (typeof this.content == "string")
            wrap.setAttribute("aria-label", "placeholder " + this.content)
        else
            wrap.setAttribute("aria-hidden", "true")
        return wrap
    }

    ignoreEvent() { return false }
}

/** Extension that enables a placeholder—a piece of example content to show when the editor is empty. */
export function placeholder(content: string | HTMLElement): Extension {
    return ViewPlugin.fromClass(class {
        placeholder: DecorationSet

        constructor(readonly view: EditorView) {
            this.placeholder = Decoration.set([Decoration.widget({widget: new Placeholder(content), side: 1}).range(0)])
        }

        update!: () => void // Kludge to convince TypeScript that this is a plugin value

        get decorations() { return this.view.state.doc.length ? Decoration.none : this.placeholder }
    }, {decorations: v => v.decorations})
}
