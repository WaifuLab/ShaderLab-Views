import { union } from "./grammar.js";

export const MAX_CHAR = 0xfffe;

export class Edge {
    /**
     * @param {number}from
     * @param {number} to
     * @param {State} target
     */
    constructor(from, to, target) {
        this.from = from;
        this.to = to;
        this.target = target;
    }

    /** @return {string} */
    toString() {
        return `-> ${this.target.id}[label=${JSON.stringify(this.from < 0 ? "ε" : charFor(this.from) + (this.to > this.from + 1 ? "-" + charFor(this.to - 1) : ""))}]`;
    }
}

/**
 * @param {number} n
 * @return {string}
 */
function charFor(n) {
    return n > MAX_CHAR ? "∞" : n >= 0xd800 && n < 0xdfff ? "\\u{" + n.toString(16) + "}" : String.fromCharCode(n);
}

/**
 * @param {State[]} states
 * @param {State} start
 */
function minimize(states, start) {
    let partition = Object.create(null);
    let byAccepting = Object.create(null);
    for (let state of states) {
        let id = ids(state.accepting);
        let group = byAccepting[id] || (byAccepting[id] = []);
        group.push(state);
        partition[state.id] = group;
    }
    for (;;) {
        let split = false, newPartition = Object.create(null);
        for (let state of states) {
            if (newPartition[state.id]) continue;
            let group = partition[state.id];
            if (group.length === 1) {
                newPartition[group[0].id] = group;
                continue;
            }
            let parts = [];
            groups: for (let state of group) {
                for (let p of parts) {
                    if (isEquivalent(state, p[0], partition)) {
                        p.push(state);
                        continue groups;
                    }
                }
                parts.push([state]);
            }
            if (parts.length > 1) split = true;
            for (let p of parts)
                for (let s of p)
                    newPartition[s.id] = p;
        }
        if (!split) return applyMinimization(states, start, partition);
        partition = newPartition;
    }
}

function isEquivalent(a, b, partition) {
    if (a.edges.length !== b.edges.length) return false;
    for (let i = 0; i < a.edges.length; i++) {
        let eA = a.edges[i], eB = b.edges[i];
        if (eA.from != eB.from || eA.to != eB.to || partition[eA.target.id] != partition[eB.target.id])
            return false;
    }
    return true;
}

function applyMinimization(states, start, partition) {
    for (let state of states) {
        for (let i = 0; i < state.edges.length; i++) {
            let edge = state.edges[i], target = partition[edge.target.id][0];
            if (target != edge.target)
                state.edges[i] = new Edge(edge.from, edge.to, target);
        }
    }
    return partition[start.id][0];
}

let stateID = 1;

export class State {
    /**
     * @param {Term[]} accepting
     * @param {State} id
     */
    constructor(accepting = [], id = stateID++) {
        this.accepting = accepting;
        this.id = id;
        this.edges = [];
    }

    /**
     * Create a edge
     * @param {number} from
     * @param {number} to
     * @param {State} target
     */
    edge(from, to, target) {
        this.edges.push(new Edge(from, to, target));
    }

    /**
     * Create a null edge
     * @param {State} target
     */
    nullEdge(target) { this.edge(-1, -1, target); }

    compile() {
        let labeled = Object.create(null), localID = 0;
        let startState = explore(this.closure().sort((a, b) => a.id - b.id));
        return minimize(Object.values(labeled), startState);
        function explore(states) {
            let newState = labeled[ids(states)] = new State(states.reduce((a, s) => union(a, s.accepting), []), localID++);
            let out = [];
            for (let state of states)
                for (let edge of state.edges) {
                    if (edge.from >= 0)
                        out.push(edge);
                }
            let transitions = mergeEdges(out);
            for (let merged of transitions) {
                let targets = merged.targets.sort((a, b) => a.id - b.id);
                newState.edge(merged.from, merged.to, labeled[ids(targets)] || explore(targets));
            }
            return newState;
        }
    }

    closure() {
        let result = [], seen = Object.create(null);
        function explore(state) {
            if (seen[state.id]) return;
            seen[state.id] = true;
            // States with only epsilon edges and no accepting term that isn't also in the next states
            // are left out to help reduce the number of unique state combinations
            if (state.edges.some(e => e.from >= 0) || (state.accepting.length > 0 && !state.edges.some(e => sameSet(state.accepting, e.target.accepting))))
                result.push(state);
            for (let edge of state.edges)
                if (edge.from < 0)
                    explore(edge.target);
        }
        explore(this);
        return result;
    }

    /**
     * Find conflict edge
     * @param {(a: Term, b: Term) => boolean} occurTogether
     * @return {Conflict[]}
     */
    findConflicts(occurTogether) {
        let conflicts = [], cycleTerms = this.cycleTerms();
        function add(a, b, soft, aEdges, bEdges) {
            if (a.id < b.id) { [a, b] = [b, a]; soft = -soft; }
            let found = conflicts.find(c => c.a == a && c.b == b);
            if (!found)
                conflicts.push(new Conflict(a, b, soft, exampleFromEdges(aEdges), bEdges && exampleFromEdges(bEdges)));
            else if (found.soft != soft)
                found.soft = 0;
        }
        this.reachable((state, edges) => {
            if (state.accepting.length === 0) return;
            for (let i = 0; i < state.accepting.length; i++)
                for (let j = i + 1; j < state.accepting.length; j++)
                    add(state.accepting[i], state.accepting[j], 0, edges);
            state.reachable((s, es) => {
                if (s != state)
                    for (let term of s.accepting) {
                        let hasCycle = cycleTerms.includes(term);
                        for (let orig of state.accepting)
                            if (term != orig)
                                add(term, orig, hasCycle || cycleTerms.includes(orig) || !occurTogether(term, orig) ? 0 : 1, edges, edges.concat(es));
                    }
            });
        });
        return conflicts;
    }

    cycleTerms() {
        let work = [];
        this.reachable(state => {
            for (let { target } of state.edges)
                work.push(state, target);
        });
        let table = new Map;
        let haveCycle = [];
        for (let i = 0; i < work.length;) {
            let from = work[i++], to = work[i++];
            let entry = table.get(from);
            if (!entry) table.set(from, entry = []);
            if (entry.includes(to)) continue;
            if (from == to) {
                if (!haveCycle.includes(from))
                    haveCycle.push(from);
            } else {
                for (let next of entry)
                    work.push(from, next);
                entry.push(to);
            }
        }
        let result = [];
        for (let state of haveCycle) {
            for (let term of state.accepting) {
                if (!result.includes(term))
                    result.push(term);
            }
        }
        return result;
    }

    reachable(f) {
        let seen = [], edges = [];
        (function explore(s) {
            f(s, edges);
            seen.push(s);
            for (let edge of s.edges)
                if (!seen.includes(edge.target)) {
                    edges.push(edge);
                    explore(edge.target);
                    edges.pop();
                }
        })(this);
    }

    toString() {
        let out = "digraph {\n";
        this.reachable(state => {
            if (state.accepting.length)
                out += `  ${state.id} [label=${JSON.stringify(state.accepting.join())}];\n`;
            for (let edge of state.edges)
                out += `  ${state.id} ${edge};\n`;
        });
        return out + "}";
    }

    // Tokenizer data is represented as a single flat array. This
    // contains regions for each tokenizer state. Region offsets are
    // used to identify states.
    //
    // Each state is laid out as:
    //  - Token group mask
    //  - Offset of the end of the accepting data
    //  - Number of outgoing edges in the state
    //  - Pairs of token masks and term ids that indicate the accepting
    //    states, sorted by precedence
    //  - Triples for the edges: each with a low and high bound and the
    //    offset of the next state.
    toArray(groupMasks, precedence) {
        let offsets = []; // Used to 'link' the states after building the arrays
        let data = [];
        this.reachable(state => {
            let start = data.length;
            let acceptEnd = start + 3 + state.accepting.length * 2;
            offsets[state.id] = start;
            data.push(state.stateMask(groupMasks), acceptEnd, state.edges.length);
            state.accepting.sort((a, b) => precedence.indexOf(a.id) - precedence.indexOf(b.id));
            for (let term of state.accepting)
                data.push(term.id, groupMasks[term.id] || 0xffff);
            for (let edge of state.edges)
                data.push(edge.from, edge.to, -edge.target.id - 1);
        });
        // Replace negative numbers with resolved state offsets
        for (let i = 0; i < data.length; i++)
            if (data[i] < 0) data[i] = offsets[-data[i] - 1];
        if (data.length > 2 ** 16)
            throw new Error("Tokenizer tables too big to represent with 16-bit offsets.");
        return Uint16Array.from(data);
    }

    stateMask(groupMasks) {
        let mask = 0;
        this.reachable(state => {
            for (let term of state.accepting)
                mask |= (groupMasks[term.id] || 0xffff);
        });
        return mask;
    }
}

export class Conflict {
    /**
     * @param {Term} a
     * @param {Term} b
     * @param {number} soft Conflicts between two non-cyclic tokens are marked as 'soft', with a negative number if a is shorter than b, and a positive if b is shorter than a.
     * @param {string} exampleA
     * @param {string} exampleB
     */
    constructor(a, b, soft, exampleA, exampleB) {
        this.a = a;
        this.b = b;
        this.soft = soft;
        this.exampleA = exampleA;
        this.exampleB = exampleB;
    }
}

function exampleFromEdges(edges) {
    let str = "";
    for (let i = 0; i < edges.length; i++)
        str += String.fromCharCode(edges[i].from);
    return str;
}

function ids(elts) {
    let result = "";
    for (let elt of elts) {
        if (result.length)
            result += "-";
        result += elt.id;
    }
    return result;
}

function sameSet(a, b) {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i++)
        if (a[i] != b[i])
            return false;
    return true;
}

class MergedEdge {
    constructor(from, to, targets) {
        this.from = from;
        this.to = to;
        this.targets = targets;
    }
}

// Merge multiple edges (tagged by character ranges) into a set of mutually exclusive ranges
// pointing at all target states for that range
function mergeEdges(edges) {
    let separate = [], result = [];
    for (let edge of edges) {
        if (!separate.includes(edge.from))
            separate.push(edge.from);
        if (!separate.includes(edge.to))
            separate.push(edge.to);
    }
    separate.sort((a, b) => a - b);
    for (let i = 1; i < separate.length; i++) {
        let from = separate[i - 1], to = separate[i];
        let found = [];
        for (let edge of edges)
            if (edge.to > from && edge.from < to) {
                for (let target of edge.target.closure())
                    if (!found.includes(target))
                        found.push(target);
            }
        if (found.length)
            result.push(new MergedEdge(from, to, found));
    }
    let eof = edges.filter(e => e.from == 65535 /* Seq.End */);
    if (eof.length) {
        let found = [];
        for (let edge of eof)
            for (let target of edge.target.closure())
                if (!found.includes(target))
                    found.push(target);
        if (found.length)
            result.push(new MergedEdge(65535 /* Seq.End */, 65535 /* Seq.End */, found));
    }
    return result;
}
