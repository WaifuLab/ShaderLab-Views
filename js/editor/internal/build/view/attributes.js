export function combineAttrs(source, target) {
    for (let name in source) {
        if (name == "class" && target.class)
            target.class += " " + source.class;
        else if (name == "style" && target.style)
            target.style += ";" + source.style;
        else
            target[name] = source[name];
    }
    return target;
}
export function attrsEq(a, b) {
    if (a == b)
        return true;
    if (!a || !b)
        return false;
    let keysA = Object.keys(a), keysB = Object.keys(b);
    if (keysA.length != keysB.length)
        return false;
    for (let key of keysA) {
        if (keysB.indexOf(key) == -1 || a[key] !== b[key])
            return false;
    }
    return true;
}
export function updateAttrs(dom, prev, attrs) {
    let changed = null;
    if (prev)
        for (let name in prev)
            if (!(attrs && name in attrs))
                dom.removeAttribute(changed = name);
    if (attrs)
        for (let name in attrs)
            if (!(prev && prev[name] == attrs[name]))
                dom.setAttribute(changed = name, attrs[name]);
    return !!changed;
}
