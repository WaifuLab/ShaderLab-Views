import { Facet, Extension } from "../state/index.js";
import { EditorView } from "./editorview.js";
import { ViewUpdate } from "./extension.js";
declare type PanelConfig = {
    /** By default, panels will be placed inside the editor's DOM structure. */
    topContainer?: HTMLElement;
    /** Override where panels with `top: false` are placed. */
    bottomContainer?: HTMLElement;
};
/** Configures the panel-managing extension. */
export declare function panels(config?: PanelConfig): Extension;
/** Object that describes an active panel. */
export interface Panel {
    /** The element representing this panel. The library will add the `"cm-panel"` DOM class to this. */
    dom: HTMLElement;
    /** Optionally called after the panel has been added to the editor. */
    mount?(): void;
    /** Update the DOM for a given view update. */
    update?(update: ViewUpdate): void;
    /** Called when the panel is removed from the editor or the editor is destroyed. */
    destroy?(): void;
    /** Whether the panel should be at the top or bottom of the editor. Defaults to false. */
    top?: boolean;
}
/**
 * Get the active panel created by the given constructor, if any. This can be useful when you need
 * access to your panels' DOM structure.
 */
export declare function getPanel(view: EditorView, panel: PanelConstructor): Panel | null;
/** A function that initializes a panel. Used in {@link showPanel}. */
export declare type PanelConstructor = (view: EditorView) => Panel;
/**
 * Opening a panel is done by providing a constructor function for the panel through this facet.
 * (The panel is closed again when its constructor is no longer provided.) Values of `null` are ignored.
 */
export declare const showPanel: Facet<PanelConstructor | null, readonly (PanelConstructor | null)[]>;
export {};
