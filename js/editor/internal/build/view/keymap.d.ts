import { EditorView } from "./editorview.js";
import { Command } from "./extension.js";
import { Facet } from "../state/index.js";
/**
 * Key bindings associate key names with [command]{@link Command}-style functions.
 *
 * Key names may be strings like `"Shift-Ctrl-Enter"`—a key identifier prefixed with zero or more
 * modifiers. Key identifiers are based on the strings that can appear in
 * [`KeyEvent.key`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key)
 * Use lowercase letters to refer to letter keys (or uppercase letters if you want shift to be held).
 * You may use `"Space"` as an alias for the `" "` name.
 *
 * When a key binding contains multiple key names separated by spaces, it represents a multi-stroke
 * binding, which will fire when the user presses the given keys after each other.
 *
 * You can use `Mod-` as a shorthand for `Cmd-` on Mac and `Ctrl-` on other platforms. So `Mod-b`
 * is `Ctrl-b` on Linux but `Cmd-b` on macOS.
 */
export interface KeyBinding {
    /**
     * The key name to use for this binding. If the platform-specific property (`mac`, `win`, or
     * `linux`) for the current platform is used as well in the binding, that one takes precedence.
     * If `key` isn't defined and the platform-specific binding isn't either, a binding is ignored.
     */
    key?: string;
    /** Key to use specifically on macOS. */
    mac?: string;
    /** Key to use specifically on Windows. */
    win?: string;
    /** Key to use specifically on Linux. */
    linux?: string;
    /**
     * The command to execute when this binding is triggered. When the command function returns `false`,
     * further bindings will be tried for the key.
     */
    run?: Command;
    /**
     * When given, this defines a second binding, using the (possibly platform-specific) key name
     * prefixed with `Shift-` to activate this command.
     */
    shift?: Command;
    /**
     * When this property is present, the function is called for every key that is not a multi-stroke
     * prefix.
     */
    any?: (view: EditorView, event: KeyboardEvent) => boolean;
    /**
     * By default, key bindings apply when focus is on the editor content (the `"editor"` scope).
     * Some extensions, mostly those that define their own panels, might want to allow you to
     * register bindings local to that panel. Such bindings should use a custom scope name. You
     * may also assign multiple scope names to a binding, separating them by spaces.
     */
    scope?: string;
    /**
     * When set to true (the default is false), this will always prevent the further handling for
     * the bound key, even if the command(s) return false. This can be useful for cases where the
     * native behavior of the key is annoying or irrelevant but the command doesn't always apply
     * (such as, Mod-u for undo selection, which would cause the browser to view source instead when
     * no selection can be undone).
     */
    preventDefault?: boolean;
}
/**
 * Facet used for registering keymaps.
 *
 * You can add multiple keymaps to an editor. Their priorities determine their precedence (the
 * ones specified early or with high priority get checked first). When a handler has returned
 * `true` for a given key, no further handlers are called.
 */
export declare const keymap: Facet<readonly KeyBinding[], readonly (readonly KeyBinding[])[]>;
/** Run the key handlers registered for a given scope. The event object should be a `"keydown"` event. Returns true if any of the handlers handled it. */
export declare function runScopeHandlers(view: EditorView, event: KeyboardEvent, scope: string): boolean;
