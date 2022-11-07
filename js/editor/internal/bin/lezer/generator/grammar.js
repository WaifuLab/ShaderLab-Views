const TermFlag = {
    // This term is a terminal
    Terminal: 1,
    // This is the top production
    Top: 2,
    // This represents end-of-file
    Eof: 4,
    // This should be preserved, even if it doesn't occur in any rule
    Preserve: 8,
    // Rules used for * and + constructs
    Repeated: 16,
    // Rules explicitly marked as [inline]
    Inline: 32
}

let termHash = 0;

export function hasProps(props) {
    for (let prop in props) return true
    return false
}

export class Term {
    constructor(name, flags, nodeName, props = {}) {
        this.name = name;
        this.flags = flags;
        this.nodeName = nodeName;
        this.props = props;
        this.hash = ++termHash; // Used for sorting and hashing during parser generation
        this.id = -1; // Assigned in a later stage, used in actual output
        // Filled in only after the rules are simplified, used in automaton.ts
        this.rules = [];
    }

    toString() { return this.name; }

    get nodeType() { return this.top || this.nodeName != null || hasProps(this.props) || this.repeated; }

    get terminal() { return (this.flags & TermFlag.Terminal) > 0; }

    get eof() { return (this.flags & TermFlag.Eof) > 0; }

    get error() { return "error" in this.props; }

    get top() { return (this.flags & TermFlag.Top) > 0; }

    get interesting() { return this.flags > 0 || this.nodeName != null; }

    get repeated() { return (this.flags & TermFlag.Repeated) > 0; }

    set preserve(value) { this.flags = value ? this.flags | TermFlag.Preserve : this.flags & ~TermFlag.Preserve; }

    get preserve() { return (this.flags & TermFlag.Preserve) > 0; }

    set inline(value) { this.flags = value ? this.flags | TermFlag.Inline : this.flags & ~TermFlag.Inline; }

    get inline() { return (this.flags & TermFlag.Inline) > 0; }

    cmp(other) { return this.hash - other.hash; }
}

export class TermSet {
    constructor() {
        this.terms = [];
        // Map from term names to Term instances
        this.names = Object.create(null);
        this.tops = [];
        this.eof = this.term("␄", null, TermFlag.Terminal | TermFlag.Eof);
        this.error = this.term("⚠", "⚠", TermFlag.Preserve);
    }

    term(name, nodeName, flags = 0, props = {}) {
        let term = new Term(name, flags, nodeName, props);
        this.terms.push(term);
        this.names[name] = term;
        return term;
    }

    makeTop(nodeName, props) {
        const term = this.term("@top", nodeName, TermFlag.Top, props);
        this.tops.push(term);
        return term;
    }

    makeTerminal(name, nodeName, props = {}) {
        return this.term(name, nodeName, TermFlag.Terminal, props);
    }

    makeNonTerminal(name, nodeName, props = {}) {
        return this.term(name, nodeName, 0, props);
    }

    makeRepeat(name) {
        return this.term(name, null, TermFlag.Repeated);
    }

    uniqueName(name) {
        for (let i = 0;; i++) {
            let cur = i ? `${name}-${i}` : name;
            if (!this.names[cur]) return cur;
        }
    }

    finish(rules) {
        for (let rule of rules) rule.name.rules.push(rule);

        this.terms = this.terms.filter(t => t.terminal || t.preserve || rules.some(r => r.name == t || r.parts.includes(t)));

        let names = {};
        let nodeTypes = [this.error];

        this.error.id = 0 /* T.Err */;
        let nextID = 0 /* T.Err */ + 1;

        // Assign ids to terms that represent node types
        for (let term of this.terms)
            if (term.id < 0 && term.nodeType && !term.repeated) {
                term.id = nextID++;
                nodeTypes.push(term);
            }
        // Put all repeated terms after the regular node types
        let minRepeatTerm = nextID;
        for (let term of this.terms)
            if (term.repeated) {
                term.id = nextID++;
                nodeTypes.push(term);
            }
        // Then comes the EOF term
        this.eof.id = nextID++;
        // And then the remaining (non-node, non-repeat) terms.
        for (let term of this.terms) {
            if (term.id < 0) term.id = nextID++;
            if (term.name) names[term.id] = term.name;
        }
        if (nextID >= 0xfffe) throw new Error("Too many terms");

        return { nodeTypes, names, minRepeatTerm, maxTerm: nextID - 1 };
    }
}

export function cmpSet(a, b, cmp) {
    if (a.length !== b.length) return a.length - b.length;
    for (let i = 0; i < a.length; i++) {
        let diff = cmp(a[i], b[i]);
        if (diff) return diff;
    }
    return 0;
}

const none = [];

export class Conflicts {
    constructor(precedence, ambigGroups = none, cut = 0) {
        this.precedence = precedence;
        this.ambigGroups = ambigGroups;
        this.cut = cut;
    }

    join(other) {
        if (this == Conflicts.none || this == other) return other;
        if (other == Conflicts.none) return this;
        return new Conflicts(Math.max(this.precedence, other.precedence), union(this.ambigGroups, other.ambigGroups), Math.max(this.cut, other.cut));
    }

    cmp(other) {
        return this.precedence - other.precedence || cmpSet(this.ambigGroups, other.ambigGroups, (a, b) => a < b ? -1 : a > b ? 1 : 0) || this.cut - other.cut;
    }

    static none = new Conflicts(0);
}

export function union(a, b) {
    if (a.length === 0 || a == b) return b;
    if (b.length === 0) return a;
    let result = a.slice();
    for (let value of b)
        if (!a.includes(value))
            result.push(value);
    return result.sort();
}

let ruleID = 0;

export class Rule {
    /**
     * @param {Term} name
     * @param {Term[]} parts
     * @param {Conflicts[]} conflicts
     * @param {Term} skip
     */
    constructor(name, parts, conflicts, skip) {
        this.name = name;
        this.parts = parts;
        this.conflicts = conflicts;
        this.skip = skip;
        /** @type number */
        this.id = ruleID++;
    }

    cmp(rule) {
        return this.id - rule.id;
    }

    cmpNoName(rule) {
        return this.parts.length - rule.parts.length ||
            this.skip.hash - rule.skip.hash ||
            this.parts.reduce((r, s, i) => r || s.cmp(rule.parts[i]), 0) ||
            cmpSet(this.conflicts, rule.conflicts, (a, b) => a.cmp(b));
    }

    toString() {
        return this.name + " -> " + this.parts.join(" ");
    }

    get isRepeatWrap() {
        return this.name.repeated && this.parts.length === 2 && this.parts[0] == this.name;
    }

    sameReduce(other) {
        return this.name == other.name && this.parts.length === other.parts.length && this.isRepeatWrap === other.isRepeatWrap;
    }
}
