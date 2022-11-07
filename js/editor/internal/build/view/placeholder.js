import { ViewPlugin } from "./extension.js";
import { Decoration, WidgetType } from "./decoration.js";
class Placeholder extends WidgetType {
    constructor(content) {
        super();
        this.content = content;
    }
    toDOM() {
        let wrap = document.createElement("span");
        wrap.className = "cm-placeholder";
        wrap.style.pointerEvents = "none";
        wrap.appendChild(typeof this.content == "string" ? document.createTextNode(this.content) : this.content);
        if (typeof this.content == "string")
            wrap.setAttribute("aria-label", "placeholder " + this.content);
        else
            wrap.setAttribute("aria-hidden", "true");
        return wrap;
    }
    ignoreEvent() { return false; }
}
/** Extension that enables a placeholder—a piece of example content to show when the editor is empty. */
export function placeholder(content) {
    return ViewPlugin.fromClass(class {
        constructor(view) {
            this.view = view;
            this.placeholder = Decoration.set([Decoration.widget({ widget: new Placeholder(content), side: 1 }).range(0)]);
        }
        get decorations() { return this.view.state.doc.length ? Decoration.none : this.placeholder; }
    }, { decorations: v => v.decorations });
}
