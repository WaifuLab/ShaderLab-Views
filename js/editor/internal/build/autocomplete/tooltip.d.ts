import { EditorView, TooltipView } from "../view/index.js";
import { StateField } from "../state/index.js";
import { CompletionState } from "./state.js";
/**
 * We allocate a new function instance every time the completion changes to force redrawing/repositioning
 * of the tooltip
 */
export declare function completionTooltip(stateField: StateField<CompletionState>): (view: EditorView) => TooltipView;
