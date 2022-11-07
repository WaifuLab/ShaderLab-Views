import { EditorView } from "./editorview.js";
import { modifierCodes } from "./input.js";
import { base, shift, keyName } from "../utils/keyname.js";
import { Facet, Prec, codePointSize, codePointAt } from "../state/index.js";
import browser from "./browser.js";
const currentPlatform = browser.mac ? "mac" : browser.windows ? "win" : browser.linux ? "linux" : "key";
function normalizeKeyName(name, platform) {
    const parts = name.split(/-(?!$)/);
    let result = parts[parts.length - 1];
    if (result == "Space")
        result = " ";
    let alt, ctrl, shift, meta;
    for (let i = 0; i < parts.length - 1; ++i) {
        const mod = parts[i];
        if (/^(cmd|meta|m)$/i.test(mod))
            meta = true;
        else if (/^a(lt)?$/i.test(mod))
            alt = true;
        else if (/^(c|ctrl|control)$/i.test(mod))
            ctrl = true;
        else if (/^s(hift)?$/i.test(mod))
            shift = true;
        else if (/^mod$/i.test(mod)) {
            if (platform == "mac")
                meta = true;
            else
                ctrl = true;
        }
        else
            throw new Error("Unrecognized modifier name: " + mod);
    }
    if (alt)
        result = "Alt-" + result;
    if (ctrl)
        result = "Ctrl-" + result;
    if (meta)
        result = "Meta-" + result;
    if (shift)
        result = "Shift-" + result;
    return result;
}
function modifiers(name, event, shift) {
    if (event.altKey)
        name = "Alt-" + name;
    if (event.ctrlKey)
        name = "Ctrl-" + name;
    if (event.metaKey)
        name = "Meta-" + name;
    if (shift !== false && event.shiftKey)
        name = "Shift-" + name;
    return name;
}
const handleKeyEvents = Prec.default(EditorView.domEventHandlers({
    keydown(event, view) {
        return runHandlers(getKeymap(view.state), event, view, "editor");
    }
}));
/**
 * Facet used for registering keymaps.
 *
 * You can add multiple keymaps to an editor. Their priorities determine their precedence (the
 * ones specified early or with high priority get checked first). When a handler has returned
 * `true` for a given key, no further handlers are called.
 */
export const keymap = Facet.define({ enables: handleKeyEvents });
const Keymaps = new WeakMap();
/** This is hidden behind an indirection, rather than directly computed by the facet, to keep internal types out of the facet's type. */
function getKeymap(state) {
    let bindings = state.facet(keymap);
    let map = Keymaps.get(bindings);
    if (!map)
        Keymaps.set(bindings, map = buildKeymap(bindings.reduce((a, b) => a.concat(b), [])));
    return map;
}
/** Run the key handlers registered for a given scope. The event object should be a `"keydown"` event. Returns true if any of the handlers handled it. */
export function runScopeHandlers(view, event, scope) {
    return runHandlers(getKeymap(view.state), event, view, scope);
}
let storedPrefix = null;
const PrefixTimeout = 4000;
function buildKeymap(bindings, platform = currentPlatform) {
    let bound = Object.create(null);
    let isPrefix = Object.create(null);
    let checkPrefix = (name, is) => {
        let current = isPrefix[name];
        if (current == null)
            isPrefix[name] = is;
        else if (current != is)
            throw new Error("Key binding " + name + " is used both as a regular binding and as a multi-stroke prefix");
    };
    let add = (scope, key, command, preventDefault) => {
        let scopeObj = bound[scope] || (bound[scope] = Object.create(null));
        let parts = key.split(/ (?!$)/).map(k => normalizeKeyName(k, platform));
        for (let i = 1; i < parts.length; i++) {
            let prefix = parts.slice(0, i).join(" ");
            checkPrefix(prefix, true);
            if (!scopeObj[prefix])
                scopeObj[prefix] = {
                    preventDefault: true,
                    run: [(view) => {
                            let ourObj = storedPrefix = { view, prefix, scope };
                            setTimeout(() => { if (storedPrefix == ourObj)
                                storedPrefix = null; }, PrefixTimeout);
                            return true;
                        }]
                };
        }
        let full = parts.join(" ");
        checkPrefix(full, false);
        let binding = scopeObj[full] || (scopeObj[full] = { preventDefault: false, run: scopeObj._any?.run?.slice() || [] });
        if (command)
            binding.run.push(command);
        if (preventDefault)
            binding.preventDefault = true;
    };
    for (let b of bindings) {
        let scopes = b.scope ? b.scope.split(" ") : ["editor"];
        if (b.any)
            for (let scope of scopes) {
                let scopeObj = bound[scope] || (bound[scope] = Object.create(null));
                if (!scopeObj._any)
                    scopeObj._any = { preventDefault: false, run: [] };
                for (let key in scopeObj)
                    scopeObj[key].run.push(b.any);
            }
        let name = b[platform] || b.key;
        if (!name)
            continue;
        for (let scope of scopes) {
            add(scope, name, b.run, b.preventDefault);
            if (b.shift)
                add(scope, "Shift-" + name, b.shift, b.preventDefault);
        }
    }
    return bound;
}
function runHandlers(map, event, view, scope) {
    let name = keyName(event);
    let charCode = codePointAt(name, 0), isChar = codePointSize(charCode) == name.length && name != " ";
    let prefix = "", fallthrough = false;
    if (storedPrefix && storedPrefix.view == view && storedPrefix.scope == scope) {
        prefix = storedPrefix.prefix + " ";
        if (fallthrough = modifierCodes.indexOf(event.keyCode) < 0)
            storedPrefix = null;
    }
    let ran = new Set;
    let runFor = (binding) => {
        if (binding) {
            for (let cmd of binding.run)
                if (!ran.has(cmd)) {
                    ran.add(cmd);
                    if (cmd(view, event))
                        return true;
                }
            if (binding.preventDefault)
                fallthrough = true;
        }
        return false;
    };
    let scopeObj = map[scope], baseName, shiftName;
    if (scopeObj) {
        if (runFor(scopeObj[prefix + modifiers(name, event, !isChar)]))
            return true;
        if (isChar && (event.shiftKey || event.altKey || event.metaKey || charCode > 127) &&
            (baseName = base[event.keyCode]) && baseName != name) {
            if (runFor(scopeObj[prefix + modifiers(baseName, event, true)]))
                return true;
            else if (event.shiftKey && (shiftName = shift[event.keyCode]) != name && shiftName != baseName &&
                runFor(scopeObj[prefix + modifiers(shiftName, event, false)]))
                return true;
        }
        else if (isChar && event.shiftKey) {
            if (runFor(scopeObj[prefix + modifiers(name, event, true)]))
                return true;
        }
        if (runFor(scopeObj._any))
            return true;
    }
    return fallthrough;
}
