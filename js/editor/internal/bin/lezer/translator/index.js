#!/usr/bin/env node
import { Context } from "./context.js";

export function importGrammar(content) {
    let def = JSON.parse(content);
    let cx = new Context(def);
    cx.build();
    return cx.grammar();
}

const test = /^\s*==+\n(.*)\n==+\n\s*([^]+?)\n---+\n\s*([^]+?)(?=\n==+|$)/;

function translateName(name) {
    if (name[0] !== "_")
        return name[0].toUpperCase() + name.slice(1).replace(/_\w/g, m => m.slice(1).toUpperCase());
    if (name[1].toUpperCase() !== name[1])
        return name[1] + name.slice(2).replace(/_\w/g, m => m.slice(1).toUpperCase());
    return name;
}

export function importTest(file, renamed = {}) {
    let result = [], pos = 0;
    while (pos < file.length) {
        let next = test.exec(file.slice(pos));
        if (!next)
            throw new Error("Failing to find test at " + pos);
        let [, name, code, tree] = next;
        tree = tree
            .replace(/\w+: */g, "")
            .replace(/\((\w+)(\)| *)/g, (_, n, p) => n + (p === ")" ? "" : "("))
            .replace(/(\w|\))(\s+)(\w)/g, (_, before, space, after) => `${before},${space}${after}`)
            .replace(/\w+/g, w => {
                return Object.prototype.hasOwnProperty.call(renamed, w) ? renamed[w] : translateName(w);
            });
        result.push(`# ${name}\n\n${code}\n==>\n\n${tree}`);
        pos += next[0].length;
    }
    return result.join("\n\n");
}
