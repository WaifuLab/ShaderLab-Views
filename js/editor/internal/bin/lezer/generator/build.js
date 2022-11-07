import { RuleDeclaration, ExternalTokenDeclaration, LiteralExpression, NameExpression, SequenceExpression,
         ChoiceExpression, RepeatExpression, SetExpression, AnyExpression, InlineRuleExpression,
         SpecializeExpression, Prop, PropPart, CharClass, CharClasses, exprsEq, exprEq } from "./node.js";
import { TermSet, Rule, Conflicts, hasProps } from "./grammar.js";
import { State, MAX_CHAR, Conflict } from "./token.js";
import { Input } from "./parse.js";
import { computeFirstSets, buildFullAutomaton, finishAutomaton, Shift, Reduce } from "./automaton.js";
import { encodeArray } from "./encode.js";
import { verbose, time } from "./log.js";
import { NodeProp } from "lezer-common";
import { LRParser } from "lezer-lr";

const none = [];

class Parts {
    constructor(terms, conflicts) {
        this.terms = terms;
        this.conflicts = conflicts;
    }

    concat(other) {
        if (this == Parts.none) return other;
        if (other == Parts.none) return this;
        let conflicts = null;
        if (this.conflicts || other.conflicts) {
            conflicts = this.conflicts ? this.conflicts.slice() : this.ensureConflicts();
            let otherConflicts = other.ensureConflicts();
            conflicts[conflicts.length - 1] = conflicts[conflicts.length - 1].join(otherConflicts[0]);
            for (let i = 1; i < otherConflicts.length; i++) conflicts.push(otherConflicts[i]);
        }
        return new Parts(this.terms.concat(other.terms), conflicts);
    }

    withConflicts(pos, conflicts) {
        if (conflicts == Conflicts.none) return this;
        let array = this.conflicts ? this.conflicts.slice() : this.ensureConflicts();
        array[pos] = array[pos].join(conflicts);
        return new Parts(this.terms, array);
    }

    ensureConflicts() {
        if (this.conflicts) return this.conflicts;
        let empty = [];
        for (let i = 0; i <= this.terms.length; i++)
            empty.push(Conflicts.none);
        return empty;
    }

    static none = new Parts(none, null);
}

function p(...terms) { return new Parts(terms, null); }

class BuiltRule {
    constructor(id, args, term) {
        this.id = id;
        this.args = args;
        this.term = term;
    }

    matches(expr) {
        return this.id == expr.id.name && exprsEq(expr.args, this.args);
    }

    matchesRepeat(expr) {
        return this.id == "+" && exprEq(expr.expr, this.args[0]);
    }
}

class Builder {
    constructor(text, options) {
        this.options = options;
        this.terms = new TermSet;
        this.specialized = Object.create(null);
        this.tokenOrigins = Object.create(null);
        this.rules = [];
        this.built = [];
        this.ruleNames = Object.create(null);
        this.namespaces = Object.create(null);
        this.namedTerms = Object.create(null);
        this.termTable = Object.create(null);
        this.knownProps = Object.create(null);
        this.dynamicRulePrecedences = [];
        this.definedGroups = [];
        this.astRules = [];
        this.currentSkip = [];

        time("Parse", () => {
            this.input = new Input(text, options.fileName);
            this.ast = this.input.parse();
        });

        let NP = NodeProp;
        for (let prop in NP) {
            if (NP[prop] instanceof NodeProp && !NP[prop].perNode)
                this.knownProps[prop] = { prop: NP[prop], source: { name: prop, from: null } };
        }
        for (let prop of this.ast.externalProps) {
            this.knownProps[prop.id.name] = {
                prop: this.options.externalProp ? this.options.externalProp(prop.id.name) : new NodeProp(),
                source: { name: prop.externalID.name, from: prop.source }
            };
        }

        this.dialects = this.ast.dialects.map(d => d.name);

        this.tokens = new TokenSet(this, this.ast.tokens);
        this.externalTokens = this.ast.externalTokens.map(ext => new ExternalTokenSet(this, ext));
        this.externalSpecializers = this.ast.externalSpecializers.map(decl => new ExternalSpecializer(this, decl));

        time("Build rules", () => {
            let noSkip = this.newName("%noskip", true);
            this.defineRule(noSkip, []);

            let mainSkip = this.ast.mainSkip ? this.newName("%mainskip", true) : noSkip;
            let scopedSkip = [], topRules = [];
            for (let rule of this.ast.rules)
                this.astRules.push({ skip: mainSkip, rule });
            for (let rule of this.ast.topRules)
                topRules.push({ skip: mainSkip, rule });
            for (let scoped of this.ast.scopedSkip) {
                let skip = noSkip, found = this.ast.scopedSkip.findIndex((sc, i) => i < scopedSkip.length && exprEq(sc.expr, scoped.expr));
                if (found > -1)
                    skip = scopedSkip[found];
                else if (this.ast.mainSkip && exprEq(scoped.expr, this.ast.mainSkip))
                    skip = mainSkip;
                else if (!isEmpty(scoped.expr))
                    skip = this.newName("%skip", true);
                scopedSkip.push(skip);
                for (let rule of scoped.rules)
                    this.astRules.push({ skip, rule });
                for (let rule of scoped.topRules)
                    topRules.push({ skip, rule });
            }

            for (let { rule } of this.astRules) {
                this.unique(rule.id);
            }

            this.currentSkip.push(noSkip);
            this.skipRules = mainSkip == noSkip ? [mainSkip] : [noSkip, mainSkip];
            if (mainSkip != noSkip)
                this.defineRule(mainSkip, this.normalizeExpr(this.ast.mainSkip));
            for (let i = 0; i < this.ast.scopedSkip.length; i++) {
                let skip = scopedSkip[i];
                if (!this.skipRules.includes(skip)) {
                    this.skipRules.push(skip);
                    if (skip != noSkip)
                        this.defineRule(skip, this.normalizeExpr(this.ast.scopedSkip[i].expr));
                }
            }
            this.currentSkip.pop();

            for (let { rule, skip } of topRules.sort((a, b) => a.rule.start - b.rule.start)) {
                this.unique(rule.id);
                this.used(rule.id.name);
                this.currentSkip.push(skip);
                let { name, props } = this.nodeInfo(rule.props, "a", rule.id.name, none, none, rule.expr);
                let term = this.terms.makeTop(name, props);
                this.namedTerms[name] = term;
                this.defineRule(term, this.normalizeExpr(rule.expr));
                this.currentSkip.pop();
            }

            for (let ext of this.externalSpecializers) ext.finish();

            for (let { skip, rule } of this.astRules) {
                if (this.ruleNames[rule.id.name] && isExported(rule) && !rule.params.length) {
                    this.buildRule(rule, [], skip, false);
                    if (rule.expr instanceof SequenceExpression && rule.expr.exprs.length == 0)
                        this.used(rule.id.name);
                }
            }
        });

        for (let name in this.ruleNames) {
            let value = this.ruleNames[name];
            if (value) this.warn(`Unused rule '${value.name}'`, value.start);
        }

        this.tokens.takePrecedences();
        this.tokens.takeConflicts();

        for (let { name, group, rule } of this.definedGroups)
            this.defineGroup(name, group, rule);
        this.checkGroups();
    }

    unique(id) {
        if (id.name in this.ruleNames)
            this.raise(`Duplicate definition of rule '${id.name}'`, id.start);
        this.ruleNames[id.name] = id;
    }

    used(name) {
        this.ruleNames[name] = null;
    }

    newName(base, nodeName = null, props = {}) {
        for (let i = nodeName ? 0 : 1;; i++) {
            let name = i ? `${base}-${i}` : base;
            if (!this.terms.names[name])
                return this.terms.makeNonTerminal(name, nodeName === true ? null : nodeName, props);
        }
    }

    prepareParser() {
        let rules = time("Simplify rules", () => simplifyRules(this.rules, [
            ...this.skipRules,
            ...this.terms.tops
        ]));
        let { nodeTypes, names: termNames, minRepeatTerm, maxTerm } = this.terms.finish(rules);
        for (let prop in this.namedTerms)
            this.termTable[prop] = this.namedTerms[prop].id;

        if (/\bgrammar\b/.test(verbose)) console.log(rules.join("\n"));

        let startTerms = this.terms.tops.slice();
        let first = computeFirstSets(this.terms);
        let skipInfo = this.skipRules.map((name, id) => {
            let skip = [], startTokens = [], rules = [];
            for (let rule of name.rules) {
                if (!rule.parts.length)
                    continue;
                let start = rule.parts[0];
                for (let t of start.terminal ? [start] : first[start.name] || [])
                    if (!startTokens.includes(t))
                        startTokens.push(t);
                if (start.terminal && rule.parts.length == 1 && !rules.some(r => r != rule && r.parts[0] == start))
                    skip.push(start);
                else
                    rules.push(rule);
            }
            name.rules = rules;
            if (rules.length)
                startTerms.push(name);
            return { skip, rule: rules.length ? name : null, startTokens, id };
        });
        let fullTable = time("Build full automaton", () => buildFullAutomaton(this.terms, startTerms, first));
        let { tokenGroups, tokenPrec, tokenData } = time("Build token groups", () => this.tokens.buildTokenGroups(fullTable, skipInfo));
        let table = time("Finish automaton", () => finishAutomaton(fullTable));
        let skipState = findSkipStates(table, this.terms.tops);

        if (/\blr\b/.test(verbose)) console.log(table.join("\n"));

        let specialized = [];
        for (let ext of this.externalSpecializers)
            specialized.push(ext);
        for (let name in this.specialized)
            specialized.push({ token: this.terms.names[name], table: buildSpecializeTable(this.specialized[name]) });

        let tokStart = (tokenizer) => {
            if (tokenizer instanceof ExternalTokenDeclaration)
                return tokenizer.start;
            return this.tokens.ast ? this.tokens.ast.start : -1;
        };
        let tokenizers = tokenGroups.concat(this.externalTokens.map(e => e.ast)).sort((a, b) => tokStart(a) - tokStart(b));

        let data = new DataBuilder;
        let skipData = skipInfo.map(info => {
            let actions = [];
            for (let term of info.skip)
                actions.push(term.id, 0, 262144 /* Action.StayFlag */ >> 16);
            if (info.rule) {
                let state = table.find(s => s.startRule == info.rule);
                for (let action of state.actions)
                    actions.push(action.term.id, state.id, 131072 /* Action.GotoFlag */ >> 16);
            }
            actions.push(65535 /* Seq.End */, 0 /* Seq.Done */);
            return data.storeArray(actions);
        });
        let states = time("Finish states", () => {
            let states = new Uint32Array(table.length * 6 /* ParseState.Size */);
            let forceReductions = this.computeForceReductions(table, skipInfo);
            let finishCx = new FinishStateContext(tokenizers, data, states, skipData, skipInfo, table, this);
            for (let s of table)
                finishCx.finish(s, skipState(s.id), forceReductions[s.id]);
            return states;
        });
        let dialects = Object.create(null);
        for (let i = 0; i < this.dialects.length; i++)
            dialects[this.dialects[i]] = data.storeArray((this.tokens.byDialect[i] || none).map(t => t.id).concat(65535 /* Seq.End */));

        let dynamicPrecedences = null;
        if (this.dynamicRulePrecedences.length) {
            dynamicPrecedences = Object.create(null);
            for (let { rule, prec } of this.dynamicRulePrecedences)
                dynamicPrecedences[rule.id] = prec;
        }
        let topRules = Object.create(null);
        for (let term of this.terms.tops)
            topRules[term.nodeName] = [table.find(state => state.startRule == term).id, term.id];

        let precTable = data.storeArray(tokenPrec.concat(65535 /* Seq.End */));
        let { nodeProps, skippedTypes } = this.gatherNodeProps(nodeTypes);

        return {
            states,
            stateData: data.finish(),
            goto: computeGotoTable(table),
            nodeNames: nodeTypes.filter(t => t.id < minRepeatTerm).map(t => t.nodeName).join(" "),
            nodeProps,
            skippedTypes,
            maxTerm,
            repeatNodeCount: nodeTypes.length - minRepeatTerm,
            tokenizers,
            tokenData,
            topRules,
            dialects,
            dynamicPrecedences,
            specialized,
            tokenPrec: precTable,
            termNames
        };
    }

    getParser() {
        let { states, stateData, goto, nodeNames, nodeProps: rawNodeProps, skippedTypes, maxTerm,
              repeatNodeCount, tokenizers: rawTokenizers, tokenData, topRules, dialects, dynamicPrecedences,
              specialized: rawSpecialized, tokenPrec, termNames } = this.prepareParser();

        let specialized = rawSpecialized.map(v => {
            if (v instanceof ExternalSpecializer) {
                let ext = this.options.externalSpecializer(v.ast.id.name, this.termTable);
                return {
                    term: v.term.id,
                    get: (value, stack) => (ext(value, stack) << 1) |
                        (v.ast.type == "extend" ? 1 /* Specialize.Extend */ : 0 /* Specialize.Specialize */),
                    external: ext,
                    extend: v.ast.type == "extend"
                };
            } else {
                return { term: v.token.id, get: (value) => v.table[value] || -1 };
            }
        });

        let tokenizers = rawTokenizers.map(tok => {
            return tok instanceof ExternalTokenDeclaration ? this.options.externalTokenizer(tok.id.name, this.termTable) : tok.id;
        });

        return LRParser.deserialize({
            version: 14 /* File.Version */,
            states,
            stateData,
            goto,
            nodeNames,
            maxTerm,
            repeatNodeCount,
            nodeProps: rawNodeProps.map(({ prop, terms }) => [this.knownProps[prop].prop, ...terms]),
            propSources: !this.options.externalPropSource ? undefined
                : this.ast.externalPropSources.map(s => this.options.externalPropSource(s.id.name)),
            skippedNodes: skippedTypes,
            tokenData,
            tokenizers,
            context: this.ast.context ? this.options.contextTracker : undefined,
            topRules,
            dialects,
            dynamicPrecedences,
            specialized,
            tokenPrec,
            termNames
        });
    }

    getParserFile() {
        let { states, stateData, goto, nodeNames, nodeProps: rawNodeProps, skippedTypes, maxTerm, repeatNodeCount, tokenizers: rawTokenizers, tokenData, topRules, dialects: rawDialects, dynamicPrecedences, specialized: rawSpecialized, tokenPrec, termNames } = this.prepareParser();
        let mod = this.options.moduleStyle || "es";
        let gen = "// This file was generated by lezer-generator. You probably shouldn't edit it.\n", head = gen;
        head += mod == "cjs" ? `const { LRParser } = require("lezer-lr")\n` : `import { LRParser } from "lezer-lr"\n`;
        let imports = {}, imported = Object.create(null);
        let defined = Object.create(null);
        let exportName = this.options.exportName || "parser";
        defined.Parser = defined[exportName] = true;
        let getName = (prefix) => {
            for (let i = 0;; i++) {
                let id = prefix + (i ? "_" + i : "");
                if (!defined[id]) return id;
            }
        };
        let importName = (name, source, prefix) => {
            let spec = name + " from " + source;
            if (imported[spec]) return imported[spec];
            let src = JSON.stringify(source), varName = name;
            if (name in defined) {
                varName = getName(prefix);
                name += `${mod == "cjs" ? ":" : " as"} ${varName}`;
            }
            ;(imports[src] || (imports[src] = [])).push(name);
            return imported[spec] = varName;
        };

        let tokenizers = rawTokenizers.map(tok => {
            if (tok instanceof ExternalTokenDeclaration) {
                let { source, id: { name } } = tok;
                return importName(name, source, "tok");
            } else return tok.id;
        });

        let context = this.ast.context ? importName(this.ast.context.id.name, this.ast.context.source, "cx") : null;

        let nodeProps = rawNodeProps.map(({ prop, terms }) => {
            let { source } = this.knownProps[prop];
            let propID = source.from ? importName(source.name, source.from, "prop") : JSON.stringify(source.name);
            return `[${propID}, ${terms.map(serializePropValue).join(",")}]`;
        });

        function specializationTableString(table) {
            return "{__proto__:null," + Object.keys(table).map(key => `${/\W/.test(key) ? JSON.stringify(key) : key}:${table[key]}`)
                .join(", ") + "}";
        }

        let specHead = "";
        let specialized = rawSpecialized.map(v => {
            if (v instanceof ExternalSpecializer) {
                let name = importName(v.ast.id.name, v.ast.source, v.ast.id.name);
                return `{term: ${v.term.id}, get: (value, stack) => (${name}(value, stack) << 1)${
                    v.ast.type == "extend" ? ` | ${1 /* Specialize.Extend */}` : ''}, external: ${name}${
                    v.ast.type == "extend" ? ', extend: true' : ''}}`;
            } else {
                let tableName = getName("spec_" + v.token.name.replace(/\W/g, ""));
                specHead += `const ${tableName} = ${specializationTableString(v.table)}\n`;
                return `{term: ${v.token.id}, get: value => ${tableName}[value] || -1}`;
            }
        });

        let propSources = this.ast.externalPropSources.map(s => importName(s.id.name, s.source, "props"));

        for (let source in imports) {
            if (mod == "cjs")
                head += `const { ${imports[source].join(", ")} } = require(${source})\n`;
            else
                head += `import { ${imports[source].join(", ")} } from ${source}\n`;
        }

        head += specHead;

        function serializePropValue(value) {
            return typeof value != "string" || /^(true|false|\d+(\.\d+)?|\.\d+)$/.test(value) ? value : JSON.stringify(value);
        }

        let dialects = Object.keys(rawDialects).map(d => `${d}: ${rawDialects[d]}`);

        let parserStr = `LRParser.deserialize({
  version: ${14 /* File.Version */},
  states: ${encodeArray(states, 0xffffffff)},
  stateData: ${encodeArray(stateData)},
  goto: ${encodeArray(goto)},
  nodeNames: ${JSON.stringify(nodeNames)},
  maxTerm: ${maxTerm}${context ? `,
  context: ${context}` : ""}${nodeProps.length ? `,
  nodeProps: [
    ${nodeProps.join(",\n    ")}
  ]` : ""}${propSources.length ? `,
  propSources: [${propSources.join()}]` : ""}${skippedTypes.length ? `,
  skippedNodes: ${JSON.stringify(skippedTypes)}` : ""},
  repeatNodeCount: ${repeatNodeCount},
  tokenData: ${encodeArray(tokenData)},
  tokenizers: [${tokenizers.join(", ")}],
  topRules: ${JSON.stringify(topRules)}${dialects.length ? `,
  dialects: {${dialects.join(", ")}}` : ""}${dynamicPrecedences ? `,
  dynamicPrecedences: ${JSON.stringify(dynamicPrecedences)}` : ""}${specialized.length ? `,
  specialized: [${specialized.join(",")}]` : ""},
  tokenPrec: ${tokenPrec}${this.options.includeNames ? `,
  termNames: ${JSON.stringify(termNames)}` : ''}
})`;

        let terms = [];
        for (let name in this.termTable) {
            let id = name;
            if (KEYWORDS.includes(id))
                for (let i = 1;; i++) {
                    id = "_".repeat(i) + name;
                    if (!(id in this.termTable)) break;
                }
            terms.push(`${id}${mod == "cjs" ? ":" : " ="} ${this.termTable[name]}`);
        }
        for (let id = 0; id < this.dialects.length; id++)
            terms.push(`Dialect_${this.dialects[id]}${mod == "cjs" ? ":" : " ="} ${id}`);
        return {
            parser: head + (mod == "cjs" ? `exports.${exportName} = ${parserStr}\n` : `export const ${exportName} = ${parserStr}\n`),
            terms: mod == "cjs" ? `${gen}module.exports = {\n  ${terms.join(",\n  ")}\n}` : `${gen}export const\n  ${terms.join(",\n  ")}\n`
        };
    }

    gatherNonSkippedNodes() {
        let seen = Object.create(null);
        let work = [];
        let add = (term) => {
            if (!seen[term.id]) {
                seen[term.id] = true;
                work.push(term);
            }
        };
        this.terms.tops.forEach(add);
        for (let i = 0; i < work.length; i++) {
            for (let rule of work[i].rules)
                for (let part of rule.parts)
                    add(part);
        }
        return seen;
    }

    gatherNodeProps(nodeTypes) {
        let notSkipped = this.gatherNonSkippedNodes(), skippedTypes = [];
        let nodeProps = [];
        for (let type of nodeTypes) {
            if (!notSkipped[type.id] && !type.error)
                skippedTypes.push(type.id);
            for (let prop in type.props) {
                let known = this.knownProps[prop];
                if (!known)
                    throw new Error("No known prop type for " + prop);
                if (known.source.from == null && (known.source.name == "repeated" || known.source.name == "error"))
                    continue;
                let rec = nodeProps.find(r => r.prop == prop);
                if (!rec)
                    nodeProps.push(rec = { prop, values: {} });
                (rec.values[type.props[prop]] || (rec.values[type.props[prop]] = [])).push(type.id);
            }
        }
        return {
            nodeProps: nodeProps.map(({ prop, values }) => {
                let terms = [];
                for (let val in values) {
                    let ids = values[val];
                    if (ids.length == 1) {
                        terms.push(ids[0], val);
                    }
                    else {
                        terms.push(-ids.length);
                        for (let id of ids)
                            terms.push(id);
                        terms.push(val);
                    }
                }
                return { prop, terms };
            }),
            skippedTypes
        };
    }

    makeTerminal(name, tag, props) {
        return this.terms.makeTerminal(this.terms.uniqueName(name), tag, props);
    }

    computeForceReductions(states, skipInfo) {
        // This finds a forced reduction for every state, trying to guard
        // against cyclic forced reductions, where a given parse stack can
        // endlessly continue running forced reductions without making any
        // progress.
        //
        // This occurs with length-1 reductions. We never generate
        // length-0 reductions, and length-2+ reductions always shrink the
        // stack, so they are guaranteed to make progress.
        //
        // If there are states S1 and S2 whose forced reductions reduce
        // terms T1 and T2 respectively, both with a length of 1, _and_
        // there is a state S3, which has goto entries T1 -> S2, T2 -> S1,
        // you can get cyclic reductions. Of course, the cycle may also
        // contain more than two steps.
        let reductions = [];
        let candidates = [];
        // A map from terms to states that they are mapped to in goto entries.
        let gotoEdges = Object.create(null);
        for (let state of states) {
            reductions.push(0);
            for (let edge of state.goto) {
                let array = gotoEdges[edge.term.id] || (gotoEdges[edge.term.id] = []);
                let found = array.find(o => o.target == edge.target.id);
                if (found)
                    found.parents.push(state.id);
                else
                    array.push({ parents: [state.id], target: edge.target.id });
            }
            candidates[state.id] = state.set.filter(pos => pos.pos > 0 && !pos.rule.name.top)
                .sort((a, b) => b.pos - a.pos || a.rule.parts.length - b.rule.parts.length);
        }
        // Mapping from state ids to terms that that state has a length-1 forced reduction for.
        let length1Reductions = Object.create(null);
        function createsCycle(term, startState, parents = null) {
            let edges = gotoEdges[term];
            if (!edges)
                return false;
            return edges.some(val => {
                let parentIntersection = parents ? parents.filter(id => val.parents.includes(id)) : val.parents;
                if (parentIntersection.length == 0)
                    return false;
                if (val.target == startState)
                    return true;
                let found = length1Reductions[val.target];
                return found != null && createsCycle(found, startState, parentIntersection);
            });
        }
        for (let state of states) {
            if (state.defaultReduce && state.defaultReduce.parts.length > 0) {
                reductions[state.id] = reduceAction(state.defaultReduce, skipInfo);
                if (state.defaultReduce.parts.length == 1)
                    length1Reductions[state.id] = state.defaultReduce.name.id;
            }
        }
        // To avoid painting states that only have one potential forced
        // reduction into a corner, reduction assignment is done by
        // candidate size, starting with the states with fewer candidates.
        for (let setSize = 1;; setSize++) {
            let done = true;
            for (let state of states) {
                if (state.defaultReduce)
                    continue;
                let set = candidates[state.id];
                if (set.length != setSize) {
                    if (set.length > setSize)
                        done = false;
                    continue;
                }
                for (let pos of set) {
                    if (pos.pos != 1 || !createsCycle(pos.rule.name.id, state.id)) {
                        reductions[state.id] = reduceAction(pos.rule, skipInfo, pos.pos);
                        if (pos.pos == 1)
                            length1Reductions[state.id] = pos.rule.name.id;
                        break;
                    }
                }
            }
            if (done)
                break;
        }
        return reductions;
    }

    substituteArgs(expr, args, params) {
        if (args.length == 0) return expr;
        return expr.walk(expr => {
            let found;
            if (expr instanceof NameExpression &&
                (found = params.findIndex(p => p.name == expr.id.name)) > -1) {
                let arg = args[found];
                if (expr.args.length) {
                    if (arg instanceof NameExpression && !arg.args.length)
                        return new NameExpression(expr.start, arg.id, expr.args);
                    this.raise(`Passing arguments to a parameter that already has arguments`, expr.start);
                }
                return arg;
            } else if (expr instanceof InlineRuleExpression) {
                let r = expr.rule, props = this.substituteArgsInProps(r.props, args, params);
                return props == r.props ? expr :
                    new InlineRuleExpression(expr.start, new RuleDeclaration(r.start, r.id, props, r.params, r.expr));
            } else if (expr instanceof SpecializeExpression) {
                let props = this.substituteArgsInProps(expr.props, args, params);
                return props == expr.props ? expr :
                    new SpecializeExpression(expr.start, expr.type, props, expr.token, expr.content);
            }
            return expr;
        });
    }

    substituteArgsInProps(props, args, params) {
        let substituteInValue = (value) => {
            let result = value;
            for (let i = 0; i < value.length; i++) {
                let part = value[i];
                if (!part.name) continue;
                let found = params.findIndex(p => p.name == part.name);
                if (found < 0) continue;
                if (result == value)
                    result = value.slice();
                let expr = args[found];
                if (expr instanceof NameExpression && !expr.args.length)
                    result[i] = new PropPart(part.start, expr.id.name, null);
                else if (expr instanceof LiteralExpression)
                    result[i] = new PropPart(part.start, expr.value, null);
                else
                    this.raise(`Trying to interpolate expression '${expr}' into a prop`, part.start);
            }
            return result;
        };
        let result = props;
        for (let i = 0; i < props.length; i++) {
            let prop = props[i], value = substituteInValue(prop.value);
            if (value != prop.value) {
                if (result == props)
                    result = props.slice();
                result[i] = new Prop(prop.start, prop.at, prop.name, value);
            }
        }
        return result;
    }

    conflictsFor(markers) {
        let here = Conflicts.none, atEnd = Conflicts.none;
        for (let marker of markers) {
            if (marker.type == "ambig") {
                here = here.join(new Conflicts(0, [marker.id.name]));
            } else {
                let precs = this.ast.precedences;
                let index = precs ? precs.items.findIndex(item => item.id.name == marker.id.name) : -1;
                if (index < 0)
                    this.raise(`Reference to unknown precedence: '${marker.id.name}'`, marker.id.start);
                let prec = precs.items[index], value = precs.items.length - index;
                if (prec.type == "cut") {
                    here = here.join(new Conflicts(0, none, value));
                } else {
                    here = here.join(new Conflicts(value << 2));
                    atEnd = atEnd.join(new Conflicts((value << 2) + (prec.type == "left" ? 1 : prec.type == "right" ? -1 : 0)));
                }
            }
        }
        return { here, atEnd };
    }

    raise(message, pos = 1) {
        return this.input.raise(message, pos);
    }

    warn(message, pos = -1) {
        let msg = this.input.message(message, pos);
        if (this.options.warn)
            this.options.warn(msg);
        else
            console.warn(msg);
    }

    defineRule(name, choices) {
        let skip = this.currentSkip[this.currentSkip.length - 1];
        for (let choice of choices)
            this.rules.push(new Rule(name, choice.terms, choice.ensureConflicts(), skip));
    }

    resolve(expr) {
        for (let built of this.built)
            if (built.matches(expr))
                return [p(built.term)];
        let found = this.tokens.getToken(expr);
        if (found) return [p(found)];
        for (let ext of this.externalTokens) {
            let found = ext.getToken(expr);
            if (found) return [p(found)];
        }
        for (let ext of this.externalSpecializers) {
            let found = ext.getToken(expr);
            if (found) return [p(found)];
        }
        let known = this.astRules.find(r => r.rule.id.name == expr.id.name);
        if (!known)
            return this.raise(`Reference to undefined rule '${expr.id.name}'`, expr.start);
        if (known.rule.params.length != expr.args.length)
            this.raise(`Wrong number or arguments for '${expr.id.name}'`, expr.start);
        this.used(known.rule.id.name);
        return [p(this.buildRule(known.rule, expr.args, known.skip))];
    }

    // For tree-balancing reasons, repeat expressions X+ have to be
    // normalized to something like
    //
    //     R -> X | R R
    //
    // Returns the `R` term.
    normalizeRepeat(expr) {
        let known = this.built.find(b => b.matchesRepeat(expr));
        if (known)
            return p(known.term);
        let name = expr.expr.prec < expr.prec ? `(${expr.expr})+` : `${expr.expr}+`;
        let term = this.terms.makeRepeat(this.terms.uniqueName(name));
        this.built.push(new BuiltRule("+", [expr.expr], term));
        this.defineRule(term, this.normalizeExpr(expr.expr).concat(p(term, term)));
        return p(term);
    }

    normalizeSequence(expr) {
        let result = expr.exprs.map(e => this.normalizeExpr(e));
        let builder = this;
        function complete(start, from, endConflicts) {
            let { here, atEnd } = builder.conflictsFor(expr.markers[from]);
            if (from == result.length)
                return [start.withConflicts(start.terms.length, here.join(endConflicts))];
            let choices = [];
            for (let choice of result[from]) {
                for (let full of complete(start.concat(choice).withConflicts(start.terms.length, here), from + 1, endConflicts.join(atEnd)))
                    choices.push(full);
            }
            return choices;
        }
        return complete(Parts.none, 0, Conflicts.none);
    }

    normalizeExpr(expr) {
        if (expr instanceof RepeatExpression && expr.kind == "?") {
            return [Parts.none, ...this.normalizeExpr(expr.expr)];
        } else if (expr instanceof RepeatExpression) {
            let repeated = this.normalizeRepeat(expr);
            return expr.kind == "+" ? [repeated] : [Parts.none, repeated];
        } else if (expr instanceof ChoiceExpression) {
            return expr.exprs.reduce((o, e) => o.concat(this.normalizeExpr(e)), []);
        } else if (expr instanceof SequenceExpression) {
            return this.normalizeSequence(expr);
        } else if (expr instanceof LiteralExpression) {
            return [p(this.tokens.getLiteral(expr))];
        } else if (expr instanceof NameExpression) {
            return this.resolve(expr);
        } else if (expr instanceof SpecializeExpression) {
            return [p(this.resolveSpecialization(expr))];
        } else if (expr instanceof InlineRuleExpression) {
            return [p(this.buildRule(expr.rule, none, this.currentSkip[this.currentSkip.length - 1], true))];
        } else {
            return this.raise(`This type of expression ('${expr}') may not occur in non-token rules`, expr.start);
        }
    }

    buildRule(rule, args, skip, inline = false) {
        let expr = this.substituteArgs(rule.expr, args, rule.params);
        let { name: nodeName, props, dynamicPrec, inline: explicitInline, group, exported } = this.nodeInfo(rule.props || none, inline ? "pg" : "pgi", rule.id.name, args, rule.params, rule.expr);
        if (exported && rule.params.length)
            this.warn(`Can't export parameterized rules`, rule.start);
        if (exported && inline)
            this.warn(`Can't export inline rule`, rule.start);
        let name = this.newName(rule.id.name + (args.length ? "<" + args.join(",") + ">" : ""), nodeName || true, props);
        if (explicitInline)
            name.inline = true;
        if (dynamicPrec)
            this.registerDynamicPrec(name, dynamicPrec);
        if ((name.nodeType || exported) && rule.params.length == 0) {
            if (!nodeName)
                name.preserve = true;
            if (!inline)
                this.namedTerms[exported || rule.id.name] = name;
        }
        if (!inline) this.built.push(new BuiltRule(rule.id.name, args, name));
        this.currentSkip.push(skip);
        this.defineRule(name, this.normalizeExpr(expr));
        this.currentSkip.pop();
        if (group) this.definedGroups.push({ name, group, rule });
        return name;
    }

    nodeInfo(props,
    // p for dynamic precedence, d for dialect, i for inline, g for group, a for disabling the ignore test for default name
    allow, defaultName = null, args = none, params = none, expr, defaultProps) {
        let result = {};
        let name = defaultName && (allow.indexOf("a") > -1 || !ignored(defaultName)) && !/ /.test(defaultName) ? defaultName : null;
        let dialect = null, dynamicPrec = 0, inline = false, group = null, exported = null;
        for (let prop of props) {
            if (!prop.at) {
                if (!this.knownProps[prop.name]) {
                    let builtin = ["name", "dialect", "dynamicPrecedence", "export", "isGroup"].includes(prop.name)
                        ? ` (did you mean '@${prop.name}'?)` : "";
                    this.raise(`Unknown prop name '${prop.name}'${builtin}`, prop.start);
                }
                result[prop.name] = this.finishProp(prop, args, params);
            }
            else if (prop.name == "name") {
                name = this.finishProp(prop, args, params);
                if (/ /.test(name))
                    this.raise(`Node names cannot have spaces ('${name}')`, prop.start);
            }
            else if (prop.name == "dialect") {
                if (allow.indexOf("d") < 0)
                    this.raise("Can't specify a dialect on non-token rules", props[0].start);
                if (prop.value.length != 1 && !prop.value[0].value)
                    this.raise("The '@dialect' rule prop must hold a plain string value");
                let dialectID = this.dialects.indexOf(prop.value[0].value);
                if (dialectID < 0)
                    this.raise(`Unknown dialect '${prop.value[0].value}'`, prop.value[0].start);
                dialect = dialectID;
            }
            else if (prop.name == "dynamicPrecedence") {
                if (allow.indexOf("p") < 0)
                    this.raise("Dynamic precedence can only be specified on nonterminals");
                if (prop.value.length != 1 || !/^-?(?:10|\d)$/.test(prop.value[0].value))
                    this.raise("The '@dynamicPrecedence' rule prop must hold an integer between -10 and 10");
                dynamicPrec = +prop.value[0].value;
            }
            else if (prop.name == "inline") {
                if (prop.value.length)
                    this.raise("'@inline' doesn't take a value", prop.value[0].start);
                if (allow.indexOf("i") < 0)
                    this.raise("Inline can only be specified on nonterminals");
                inline = true;
            }
            else if (prop.name == "isGroup") {
                if (allow.indexOf("g") < 0)
                    this.raise("'@isGroup' can only be specified on nonterminals");
                group = prop.value.length ? this.finishProp(prop, args, params) : defaultName;
            }
            else if (prop.name == "export") {
                if (prop.value.length)
                    exported = this.finishProp(prop, args, params);
                else
                    exported = defaultName;
            }
            else {
                this.raise(`Unknown built-in prop name '@${prop.name}'`, prop.start);
            }
        }
        if (expr && this.ast.autoDelim && (name || hasProps(result))) {
            let delim = this.findDelimiters(expr);
            if (delim) {
                addToProp(delim[0], "closedBy", delim[1].nodeName);
                addToProp(delim[1], "openedBy", delim[0].nodeName);
            }
        }
        if (defaultProps && hasProps(defaultProps)) {
            for (let prop in defaultProps)
                if (!(prop in result))
                    result[prop] = defaultProps[prop];
        }
        if (hasProps(result) && !name)
            this.raise(`Node has properties but no name`, props.length ? props[0].start : expr.start);
        if (inline && (hasProps(result) || dialect || dynamicPrec))
            this.raise(`Inline nodes can't have props, dynamic precedence, or a dialect`, props[0].start);
        if (inline && name)
            name = null;
        return { name, props: result, dialect, dynamicPrec, inline, group, exported };
    }

    finishProp(prop, args, params) {
        return prop.value.map(part => {
            if (part.value) return part.value;
            let pos = params.findIndex(param => param.name == part.name);
            if (pos < 0)
                this.raise(`Property refers to '${part.name}', but no parameter by that name is in scope`, part.start);
            let expr = args[pos];
            if (expr instanceof NameExpression && !expr.args.length) return expr.id.name;
            if (expr instanceof LiteralExpression) return expr.value;
            return this.raise(`Expression '${expr}' can not be used as part of a property value`, part.start);
        }).join("");
    }

    resolveSpecialization(expr) {
        let type = expr.type;
        let { name, props, dialect } = this.nodeInfo(expr.props, "d");
        let terminal = this.normalizeExpr(expr.token);
        if (terminal.length != 1 || terminal[0].terms.length != 1 || !terminal[0].terms[0].terminal)
            this.raise(`The first argument to '${type}' must resolve to a token`, expr.token.start);
        let values;
        if (expr.content instanceof LiteralExpression)
            values = [expr.content.value];
        else if ((expr.content instanceof ChoiceExpression) && expr.content.exprs.every(e => e instanceof LiteralExpression))
            values = expr.content.exprs.map(expr => expr.value);
        else
            return this.raise(`The second argument to '${expr.type}' must be a literal or choice of literals`, expr.content.start);
        let term = terminal[0].terms[0], token = null;
        let table = this.specialized[term.name] || (this.specialized[term.name] = []);
        for (let value of values) {
            let known = table.find(sp => sp.value == value);
            if (known == null) {
                if (!token) {
                    token = this.makeTerminal(term.name + "/" + JSON.stringify(value), name, props);
                    if (dialect != null)
                        (this.tokens.byDialect[dialect] || (this.tokens.byDialect[dialect] = [])).push(token);
                }
                table.push({ value, term: token, type, dialect, name });
                this.tokenOrigins[token.name] = { spec: term };
            }
            else {
                if (known.type != type)
                    this.raise(`Conflicting specialization types for ${JSON.stringify(value)} of ${term.name} (${type} vs ${known.type})`, expr.start);
                if (known.dialect != dialect)
                    this.raise(`Conflicting dialects for specialization ${JSON.stringify(value)} of ${term.name}`, expr.start);
                if (known.name != name)
                    this.raise(`Conflicting names for specialization ${JSON.stringify(value)} of ${term.name}`, expr.start);
                if (token && known.term != token)
                    this.raise(`Conflicting specialization tokens for ${JSON.stringify(value)} of ${term.name}`, expr.start);
                token = known.term;
            }
        }
        return token;
    }

    findDelimiters(expr) {
        if (!(expr instanceof SequenceExpression) || expr.exprs.length < 2)
            return null;
        let findToken = (expr) => {
            if (expr instanceof LiteralExpression)
                return { term: this.tokens.getLiteral(expr), str: expr.value };
            if (expr instanceof NameExpression && expr.args.length == 0) {
                let rule = this.ast.rules.find(r => r.id.name == expr.id.name);
                if (rule)
                    return findToken(rule.expr);
                let token = this.tokens.rules.find(r => r.id.name == expr.id.name);
                if (token && token.expr instanceof LiteralExpression)
                    return { term: this.tokens.getToken(expr), str: token.expr.value };
            }
            return null;
        };
        let lastToken = findToken(expr.exprs[expr.exprs.length - 1]);
        if (!lastToken || !lastToken.term.nodeName)
            return null;
        const brackets = ["()", "[]", "{}", "<>"];
        let bracket = brackets.find(b => lastToken.str.indexOf(b[1]) > -1 && lastToken.str.indexOf(b[0]) < 0);
        if (!bracket)
            return null;
        let firstToken = findToken(expr.exprs[0]);
        if (!firstToken || !firstToken.term.nodeName ||
            firstToken.str.indexOf(bracket[0]) < 0 || firstToken.str.indexOf(bracket[1]) > -1)
            return null;
        return [firstToken.term, lastToken.term];
    }

    registerDynamicPrec(term, prec) {
        this.dynamicRulePrecedences.push({ rule: term, prec });
        term.preserve = true;
    }

    defineGroup(rule, group, ast) {
        var _a;
        let recur = [];
        let getNamed = (rule) => {
            if (rule.nodeName)
                return [rule];
            if (recur.includes(rule))
                this.raise(`Rule '${ast.id.name}' cannot define a group because it contains a non-named recursive rule ('${rule.name}')`, ast.start);
            let result = [];
            recur.push(rule);
            for (let r of this.rules)
                if (r.name == rule) {
                    let names = r.parts.map(getNamed).filter(x => x.length);
                    if (names.length > 1)
                        this.raise(`Rule '${ast.id.name}' cannot define a group because some choices produce multiple named nodes`, ast.start);
                    if (names.length == 1)
                        for (let n of names[0])
                            result.push(n);
                }
            recur.pop();
            return result;
        };
        for (let name of getNamed(rule))
            name.props["group"] = (name.props["group"]?.split(" ") || []).concat(group).sort().join(" ");
    }
    checkGroups() {
        let groups = Object.create(null), nodeNames = Object.create(null);
        for (let term of this.terms.terms)
            if (term.nodeName) {
                nodeNames[term.nodeName] = true;
                if (term.props["group"])
                    for (let group of term.props["group"].split(" ")) {
                        ;
                        (groups[group] || (groups[group] = [])).push(term);
                    }
            }
        let names = Object.keys(groups);
        for (let i = 0; i < names.length; i++) {
            let name = names[i], terms = groups[name];
            if (nodeNames[name])
                this.warn(`Group name '${name}' conflicts with a node of the same name`);
            for (let j = i + 1; j < names.length; j++) {
                let other = groups[names[j]];
                if (terms.some(t => other.includes(t)) &&
                    (terms.length > other.length ? other.some(t => !terms.includes(t)) : terms.some(t => !other.includes(t))))
                    this.warn(`Groups '${name}' and '${names[j]}' overlap without one being a superset of the other`);
            }
        }
    }
}

const MinSharedActions = 5;

class FinishStateContext {
    constructor(tokenizers, data, stateArray, skipData, skipInfo, states, builder) {
        this.tokenizers = tokenizers;
        this.data = data;
        this.stateArray = stateArray;
        this.skipData = skipData;
        this.skipInfo = skipInfo;
        this.states = states;
        this.builder = builder;
        this.sharedActions = [];
    }

    findSharedActions(state) {
        if (state.actions.length < MinSharedActions)
            return null;
        let found = null;
        for (let shared of this.sharedActions) {
            if ((!found || shared.actions.length > found.actions.length) &&
                shared.actions.every(a => state.actions.some(b => b.eq(a))))
                found = shared;
        }
        if (found)
            return found;
        let max = null, scratch = [];
        for (let i = state.id + 1; i < this.states.length; i++) {
            let other = this.states[i], fill = 0;
            if (other.defaultReduce || other.actions.length < MinSharedActions)
                continue;
            for (let a of state.actions)
                for (let b of other.actions)
                    if (a.eq(b))
                        scratch[fill++] = a;
            if (fill >= MinSharedActions && (!max || max.length < fill)) {
                max = scratch;
                scratch = [];
            }
        }
        if (!max)
            return null;
        let result = { actions: max, addr: this.storeActions(max, -1, null) };
        this.sharedActions.push(result);
        return result;
    }

    storeActions(actions, skipReduce, shared) {
        if (skipReduce < 0 && shared && shared.actions.length == actions.length)
            return shared.addr;
        let data = [];
        for (let action of actions) {
            if (shared && shared.actions.some(a => a.eq(action)))
                continue;
            if (action instanceof Shift) {
                data.push(action.term.id, action.target.id, 0);
            }
            else {
                let code = reduceAction(action.rule, this.skipInfo);
                if (code != skipReduce)
                    data.push(action.term.id, code & 65535 /* Action.ValueMask */, code >> 16);
            }
        }
        data.push(65535 /* Seq.End */);
        if (skipReduce > -1)
            data.push(2 /* Seq.Other */, skipReduce & 65535 /* Action.ValueMask */, skipReduce >> 16);
        else if (shared)
            data.push(1 /* Seq.Next */, shared.addr & 0xffff, shared.addr >> 16);
        else
            data.push(0 /* Seq.Done */);
        return this.data.storeArray(data);
    }

    finish(state, isSkip, forcedReduce) {
        let b = this.builder;
        let skipID = b.skipRules.indexOf(state.skip);
        let skipTable = this.skipData[skipID], skipTerms = this.skipInfo[skipID].startTokens;
        let defaultReduce = state.defaultReduce ? reduceAction(state.defaultReduce, this.skipInfo) : 0;
        let flags = isSkip ? 1 /* StateFlag.Skipped */ : 0;
        let skipReduce = -1, shared = null;
        if (defaultReduce == 0) {
            if (isSkip)
                for (const action of state.actions)
                    if (action instanceof Reduce && action.term.eof)
                        skipReduce = reduceAction(action.rule, this.skipInfo);
            if (skipReduce < 0)
                shared = this.findSharedActions(state);
        }
        if (state.set.some(p => p.rule.name.top && p.pos == p.rule.parts.length))
            flags |= 2 /* StateFlag.Accepting */;
        let external = [];
        for (let i = 0; i < state.actions.length + skipTerms.length; i++) {
            let term = i < state.actions.length ? state.actions[i].term : skipTerms[i - state.actions.length];
            for (;;) {
                let orig = b.tokenOrigins[term.name];
                if (orig && orig.spec) {
                    term = orig.spec;
                    continue;
                }
                if (orig && (orig.external instanceof ExternalTokenSet))
                    addToSet(external, orig.external.ast);
                break;
            }
        }
        external.sort((a, b) => a.start - b.start);
        let tokenizerMask = 0;
        for (let i = 0; i < this.tokenizers.length; i++) {
            let tok = this.tokenizers[i];
            if (tok instanceof ExternalTokenDeclaration ? external.includes(tok) : tok.id == state.tokenGroup)
                tokenizerMask |= (1 << i);
        }
        let base = state.id * 6 /* ParseState.Size */;
        this.stateArray[base + 0 /* ParseState.Flags */] = flags;
        this.stateArray[base + 1 /* ParseState.Actions */] = this.storeActions(defaultReduce ? none : state.actions, skipReduce, shared);
        this.stateArray[base + 2 /* ParseState.Skip */] = skipTable;
        this.stateArray[base + 3 /* ParseState.TokenizerMask */] = tokenizerMask;
        this.stateArray[base + 4 /* ParseState.DefaultReduce */] = defaultReduce;
        this.stateArray[base + 5 /* ParseState.ForcedReduce */] = forcedReduce;
    }
}

function addToProp(term, prop, value) {
    let cur = term.props[prop];
    if (!cur || cur.split(" ").indexOf(value) < 0)
        term.props[prop] = cur ? cur + " " + value : value;
}

function buildSpecializeTable(spec) {
    let table = Object.create(null);
    for (let { value, term, type } of spec) {
        let code = type == "specialize" ? 0 /* Specialize.Specialize */ : 1 /* Specialize.Extend */;
        table[value] = (term.id << 1) | code;
    }
    return table;
}

function reduceAction(rule, skipInfo, depth = rule.parts.length) {
    return rule.name.id | 65536 /* Action.ReduceFlag */ |
        (rule.isRepeatWrap && depth == rule.parts.length ? 131072 /* Action.RepeatFlag */ : 0) |
        (skipInfo.some(i => i.rule == rule.name) ? 262144 /* Action.StayFlag */ : 0) |
        (depth << 19 /* Action.ReduceDepthShift */);
}

function findArray(data, value) {
    search: for (let i = 0;;) {
        let next = data.indexOf(value[0], i);
        if (next == -1 || next + value.length > data.length)
            break;
        for (let j = 1; j < value.length; j++) {
            if (value[j] != data[next + j]) {
                i = next + 1;
                continue search;
            }
        }
        return next;
    }
    return -1;
}

function findSkipStates(table, startRules) {
    let nonSkip = Object.create(null);
    let work = [];
    let add = (state) => {
        if (!nonSkip[state.id]) {
            nonSkip[state.id] = true;
            work.push(state);
        }
    };
    for (let state of table)
        if (state.startRule && startRules.includes(state.startRule))
            add(state);
    for (let i = 0; i < work.length; i++) {
        for (let a of work[i].actions)
            if (a instanceof Shift)
                add(a.target);
        for (let a of work[i].goto)
            add(a.target);
    }
    return (id) => !nonSkip[id];
}

class DataBuilder {
    data = [];

    storeArray(data) {
        let found = findArray(this.data, data);
        if (found > -1)
            return found;
        let pos = this.data.length;
        for (let num of data)
            this.data.push(num);
        return pos;
    }

    finish() {
        return Uint16Array.from(this.data);
    }
}

// The goto table maps a start state + a term to a new state, and is
// used to determine the new state when reducing. Because this allows
// more more efficient representation and access, unlike the action
// tables, the goto table is organized by term, with groups of start
// states that map to a given end state enumerated for each term.
// Since many terms only have a single valid goto target, this makes
// it cheaper to look those up.
//
// (Unfortunately, though the standard LR parsing mechanism never
// looks up invalid goto states, the incremental parsing mechanism
// needs accurate goto information for a state/term pair, so we do
// need to store state ids even for terms that have only one target.)
//
// - First comes the amount of terms in the table
//
// - Then, for each term, the offset of the term's data
//
// - At these offsets, there's a record for each target state
//
//   - Such a record starts with the amount of start states that go to
//     this target state, shifted one to the left, with the first bit
//     only set if this is the last record for this term.
//
//   - Then follows the target state id
//
//   - And then the start state ids
function computeGotoTable(states) {
    let goto = {};
    let maxTerm = 0;
    for (let state of states) {
        for (let entry of state.goto) {
            maxTerm = Math.max(entry.term.id, maxTerm);
            let set = goto[entry.term.id] || (goto[entry.term.id] = {});
            (set[entry.target.id] || (set[entry.target.id] = [])).push(state.id);
        }
    }
    let data = new DataBuilder;
    let index = [];
    let offset = maxTerm + 2; // Offset of the data, taking index size into account
    for (let term = 0; term <= maxTerm; term++) {
        let entries = goto[term];
        if (!entries) {
            index.push(1);
            continue;
        }
        let termTable = [];
        let keys = Object.keys(entries);
        for (let target of keys) {
            let list = entries[target];
            termTable.push((target == keys[keys.length - 1] ? 1 : 0) + (list.length << 1));
            termTable.push(+target);
            for (let source of list)
                termTable.push(source);
        }
        index.push(data.storeArray(termTable) + offset);
    }
    if (index.some(n => n > 0xffff))
        throw new Error("Goto table too large");
    return Uint16Array.from([maxTerm + 1, ...index, ...data.data]);
}

class TokenGroup {
    constructor(tokens, id) {
        this.tokens = tokens;
        this.id = id;
    }
}

function addToSet(set, value) {
    if (!set.includes(value))
        set.push(value);
}

function buildTokenMasks(groups) {
    let masks = Object.create(null);
    for (let group of groups) {
        let groupMask = 1 << group.id;
        for (let term of group.tokens) {
            masks[term.id] = (masks[term.id] || 0) | groupMask;
        }
    }
    return masks;
}

class TokenArg {
    constructor(name, expr, scope) {
        this.name = name;
        this.expr = expr;
        this.scope = scope;
    }
}

class BuildingRule {
    constructor(name, start, to, args) {
        this.name = name;
        this.start = start;
        this.to = to;
        this.args = args;
    }
}

class TokenSet {
    constructor(b, ast) {
        this.b = b;
        this.ast = ast;
        this.startState = new State;
        this.built = [];
        this.building = []; // Used for recursion check
        this.byDialect = Object.create(null);
        this.precedenceRelations = [];
        this.explicitConflicts = [];
        this.rules = ast ? ast.rules : none;
        for (let rule of this.rules)
            this.b.unique(rule.id);
    }

    getToken(expr) {
        for (let built of this.built)
            if (built.matches(expr))
                return built.term;
        let name = expr.id.name;
        let rule = this.rules.find(r => r.id.name == name);
        if (!rule)
            return null;
        let { name: nodeName, props, dialect, exported } = this.b.nodeInfo(rule.props, "d", name, expr.args, rule.params.length != expr.args.length ? none : rule.params);
        let term = this.b.makeTerminal(expr.toString(), nodeName, props);
        if (dialect != null)
            (this.byDialect[dialect] || (this.byDialect[dialect] = [])).push(term);
        if ((term.nodeType || exported) && rule.params.length == 0) {
            if (!term.nodeType)
                term.preserve = true;
            this.b.namedTerms[exported || name] = term;
        }
        this.buildRule(rule, expr, this.startState, new State([term]));
        this.built.push(new BuiltRule(name, expr.args, term));
        return term;
    }

    getLiteral(expr) {
        let id = JSON.stringify(expr.value);
        for (let built of this.built)
            if (built.id == id)
                return built.term;
        let name = null, props = {}, dialect = null, exported = null;
        let decl = this.ast ? this.ast.literals.find(l => l.literal == expr.value) : null;
        if (decl)
            ({ name, props, dialect, exported } = this.b.nodeInfo(decl.props, "da", expr.value));
        let term = this.b.makeTerminal(id, name, props);
        if (dialect != null)
            (this.byDialect[dialect] || (this.byDialect[dialect] = [])).push(term);
        if (exported)
            this.b.namedTerms[exported] = term;
        this.build(expr, this.startState, new State([term]), none);
        this.built.push(new BuiltRule(id, none, term));
        return term;
    }

    buildRule(rule, expr, from, to, args = none) {
        let name = expr.id.name;
        if (rule.params.length != expr.args.length)
            this.b.raise(`Incorrect number of arguments for token '${name}'`, expr.start);
        let building = this.building.find(b => b.name == name && exprsEq(expr.args, b.args));
        if (building) {
            if (building.to == to) {
                from.nullEdge(building.start);
                return;
            }
            let lastIndex = this.building.length - 1;
            while (this.building[lastIndex].name != name)
                lastIndex--;
            this.b.raise(`Invalid (non-tail) recursion in token rules: ${this.building.slice(lastIndex).map(b => b.name).join(" -> ")}`, expr.start);
        }
        this.b.used(rule.id.name);
        let start = new State;
        from.nullEdge(start);
        this.building.push(new BuildingRule(name, start, to, expr.args));
        this.build(this.b.substituteArgs(rule.expr, expr.args, rule.params), start, to, expr.args.map((e, i) => new TokenArg(rule.params[i].name, e, args)));
        this.building.pop();
    }

    build(expr, from, to, args) {
        if (expr instanceof NameExpression) {
            let name = expr.id.name, arg = args.find(a => a.name == name);
            if (arg) return this.build(arg.expr, from, to, arg.scope);
            let rule = this.rules.find(r => r.id.name == name);
            if (!rule) return this.b.raise(`Reference to rule '${expr.id.name}', which isn't found in this token group`, expr.start);
            this.buildRule(rule, expr, from, to, args);
        } else if (expr instanceof CharClass) {
            for (let [a, b] of CharClasses[expr.type])
                from.edge(a, b, to);
        } else if (expr instanceof ChoiceExpression) {
            for (let choice of expr.exprs)
                this.build(choice, from, to, args);
        } else if (isEmpty(expr)) {
            from.nullEdge(to);
        } else if (expr instanceof SequenceExpression) {
            let conflict = expr.markers.find(c => c.length > 0);
            if (conflict)
                this.b.raise("Conflict marker in token expression", conflict[0].start);
            for (let i = 0; i < expr.exprs.length; i++) {
                let next = i == expr.exprs.length - 1 ? to : new State;
                this.build(expr.exprs[i], from, next, args);
                from = next;
            }
        } else if (expr instanceof RepeatExpression) {
            if (expr.kind == "*") {
                let loop = new State;
                from.nullEdge(loop);
                this.build(expr.expr, loop, loop, args);
                loop.nullEdge(to);
            } else if (expr.kind == "+") {
                let loop = new State;
                this.build(expr.expr, from, loop, args);
                this.build(expr.expr, loop, loop, args);
                loop.nullEdge(to);
            } else { // expr.kind == "?"
                from.nullEdge(to);
                this.build(expr.expr, from, to, args);
            }
        } else if (expr instanceof SetExpression) {
            for (let [a, b] of expr.inverted ? invertRanges(expr.ranges) : expr.ranges)
                rangeEdges(from, to, a, b);
        } else if (expr instanceof LiteralExpression) {
            for (let i = 0; i < expr.value.length; i++) {
                let ch = expr.value.charCodeAt(i);
                let next = i == expr.value.length - 1 ? to : new State;
                from.edge(ch, ch + 1, next);
                from = next;
            }
        } else if (expr instanceof AnyExpression) {
            from.edge(0, MAX_CHAR + 1, to);
        } else {
            return this.b.raise(`Unrecognized expression type in token`, expr.start);
        }
    }

    takePrecedences() {
        let rel = this.precedenceRelations = [];
        if (this.ast) for (let group of this.ast.precedences) {
            let prev = [];
            for (let item of group.items) {
                let level = [];
                if (item instanceof NameExpression) {
                    for (let built of this.built)
                        if (item.args.length ? built.matches(item) : built.id == item.id.name)
                            level.push(built.term);
                } else {
                    let id = JSON.stringify(item.value), found = this.built.find(b => b.id == id);
                    if (found)
                        level.push(found.term);
                }
                if (!level.length)
                    this.b.warn(`Precedence specified for unknown token ${item}`, item.start);
                for (let term of level)
                    addRel(rel, term, prev);
                prev = prev.concat(level);
            }
        }
    }

    takeConflicts() {
        let resolve = (expr) => {
            if (expr instanceof NameExpression) {
                for (let built of this.built)
                    if (built.matches(expr))
                        return built.term;
            }
            else {
                let id = JSON.stringify(expr.value), found = this.built.find(b => b.id == id);
                if (found) return found.term;
            }
            this.b.warn(`Precedence specified for unknown token ${expr}`, expr.start);
            return null;
        };
        for (let c of this.ast?.conflicts || []) {
            let a = resolve(c.a), b = resolve(c.b);
            if (a && b) {
                if (a.id < b.id) [a, b] = [b, a];
                this.explicitConflicts.push({ a, b });
            }
        }
    }

    precededBy(a, b) {
        let found = this.precedenceRelations.find(r => r.term == a);
        return found && found.after.includes(b);
    }

    // Token groups are a mechanism for allowing conflicting (matching
    // overlapping input, without an explicit precedence being given)
    // tokens to exist in a grammar _if_ they don't occur in the same
    // place (aren't used in the same states).
    //
    // States that use tokens that conflict will raise an error when any
    // of the conflicting pairs of tokens both occur in that state.
    // Otherwise, they are assigned a token group, which includes all
    // the potentially-conflicting tokens they use. If there's already a
    // group that doesn't have any conflicts with those tokens, that is
    // reused, otherwise a new group is created.
    //
    // So each state has zero or one token groups, and each conflicting
    // token may belong to one or more groups. Tokens get assigned a
    // 16-bit bitmask with the groups they belong to set to 1 (all-1s
    // for non-conflicting tokens). When tokenizing, that mask is
    // compared to the current state's group (again using all-1s for
    // group-less states) to determine whether a token is applicable for
    // this state.
    //
    // Extended/specialized tokens are treated as their parent token for
    // this purpose.
    buildTokenGroups(states, skipInfo) {
        let tokens = this.startState.compile();
        if (tokens.accepting.length)
            this.b.raise(`Grammar contains zero-length tokens (in '${tokens.accepting[0].name}')`,
                this.rules.find(r => r.id.name == tokens.accepting[0].name).start);
        if (/\btokens\b/.test(verbose)) console.log(tokens.toString());

        // If there is a precedence specified for the pair, the conflict is resolved
        let allConflicts = tokens.findConflicts(checkTogether(states, this.b, skipInfo))
            .filter(({ a, b }) => !this.precededBy(a, b) && !this.precededBy(b, a));
        for (let { a, b } of this.explicitConflicts) {
            if (!allConflicts.some(c => c.a == a && c.b == b))
                allConflicts.push(new Conflict(a, b, 0, "", ""));
        }
        let softConflicts = allConflicts.filter(c => c.soft), conflicts = allConflicts.filter(c => !c.soft);
        let errors = [];

        let groups = [];
        for (let state of states) {
            if (state.defaultReduce) continue;
            // Find potentially-conflicting terms (in terms) and the things they conflict with (in conflicts),
            // and raise an error if there's a token conflict directly in this state.
            let terms = [], incompatible = [];
            let skip = skipInfo[this.b.skipRules.indexOf(state.skip)].startTokens;
            for (let term of skip)
                if (state.actions.some(a => a.term == term))
                    this.b.raise(`Use of token ${term.name} conflicts with skip rule`);
            let stateTerms = [];
            for (let i = 0; i < state.actions.length + (skip ? skip.length : 0); i++) {
                let term = i < state.actions.length ? state.actions[i].term : skip[i - state.actions.length];
                let orig = this.b.tokenOrigins[term.name];
                if (orig && orig.spec)
                    term = orig.spec;
                else if (orig && orig.external)
                    continue;
                addToSet(stateTerms, term);
            }
            if (stateTerms.length == 0) continue;

            for (let term of stateTerms) {
                for (let conflict of conflicts) {
                    let conflicting = conflict.a == term ? conflict.b : conflict.b == term ? conflict.a : null;
                    if (!conflicting) continue;
                    if (stateTerms.includes(conflicting) && !errors.some(e => e.conflict == conflict)) {
                        let example = conflict.exampleA ? ` (example: ${JSON.stringify(conflict.exampleA)}${conflict.exampleB ? ` vs ${JSON.stringify(conflict.exampleB)}` : ""})` : "";
                        errors.push({
                            error: `Overlapping tokens ${term.name} and ${conflicting.name} used in same context${example}\n` +
                                `After: ${state.set[0].trail()}`,
                            conflict
                        });
                    }
                    addToSet(terms, term);
                    addToSet(incompatible, conflicting);
                }
            }

            let tokenGroup = null;
            for (let group of groups) {
                if (incompatible.some(term => group.tokens.includes(term))) continue;
                for (let term of terms) addToSet(group.tokens, term);
                tokenGroup = group;
                break;
            }
            if (!tokenGroup) {
                tokenGroup = new TokenGroup(terms, groups.length);
                groups.push(tokenGroup);
            }
            state.tokenGroup = tokenGroup.id;
        }

        if (errors.length)
            this.b.raise(errors.map(e => e.error).join("\n\n"));
        if (groups.length > 16)
            this.b.raise(`Too many different token groups (${groups.length}) to represent them as a 16-bit bitfield`);

        let precTable = [], rel = this.precedenceRelations.slice();
        // Add entries for soft-conflicting tokens that are in the
        // precedence table, to make sure they'll appear in the right
        // order and don't mess up the longer-wins default rule.
        for (let { a, b, soft } of softConflicts) if (soft) {
            if (!rel.some(r => r.term == a) || !rel.some(r => r.term == b)) continue;
            if (soft < 0) [a, b] = [b, a]; // Now a is longer than b (and should thus take precedence)
            addRel(rel, b, [a]);
            addRel(rel, a, []);
        }
        add: while (rel.length) {
            for (let i = 0; i < rel.length; i++) {
                let record = rel[i];
                if (record.after.every(t => precTable.includes(t.id))) {
                    precTable.push(record.term.id);
                    if (rel.length == 1) break add;
                    rel[i] = rel.pop();
                    continue add;
                }
            }
            this.b.raise(`Cyclic token precedence relation between ${rel.map(r => r.term).join(", ")}`);
        }
        return {
            tokenGroups: groups,
            tokenPrec: precTable.filter(id => allConflicts.some(c => !c.soft && (c.a.id == id || c.b.id == id))),
            tokenData: tokens.toArray(buildTokenMasks(groups), precTable)
        };
    }
}

function checkTogether(states, b, skipInfo) {
    let cache = Object.create(null);
    function hasTerm(state, term) {
        return state.actions.some(a => a.term == term) ||
            skipInfo[b.skipRules.indexOf(state.skip)].startTokens.includes(term);
    }
    return (a, b) => {
        if (a.id < b.id) [a, b] = [b, a];
        let key = a.id | (b.id << 16), cached = cache[key];
        if (cached != null) return cached;
        return cache[key] = states.some(state => hasTerm(state, a) && hasTerm(state, b));
    };
}

function invertRanges(ranges) {
    let pos = 0, result = [];
    for (let [a, b] of ranges) {
        if (a > pos) result.push([pos, a]);
        pos = b;
    }
    if (pos <= MAX_CODE) result.push([pos, MAX_CODE + 1]);
    return result;
}

const ASTRAL = 0x10000, GAP_START = 0xd800, GAP_END = 0xe000, MAX_CODE = 0x10ffff;
const LOW_SURR_B = 0xdc00, HIGH_SURR_B = 0xdfff;

// Create intermediate states for astral characters in a range, if necessary, since the tokenizer acts on UTF16 characters
function rangeEdges(from, to, low, hi) {
    if (low < GAP_START && hi == MAX_CODE + 1) {
        from.edge(low, MAX_CHAR + 1, to);
        return;
    }
    if (low < ASTRAL) {
        if (low < GAP_START) from.edge(low, Math.min(hi, GAP_START), to);
        if (hi > GAP_END) from.edge(Math.max(low, GAP_END), Math.min(hi, MAX_CHAR + 1), to);
        low = ASTRAL;
    }
    if (hi < ASTRAL) return;

    let lowStr = String.fromCodePoint(low), hiStr = String.fromCodePoint(hi - 1);
    let lowA = lowStr.charCodeAt(0), lowB = lowStr.charCodeAt(1);
    let hiA = hiStr.charCodeAt(0), hiB = hiStr.charCodeAt(1);
    if (lowA == hiA) { // Share the first char code
        let hop = new State;
        from.edge(lowA, lowA + 1, hop);
        hop.edge(lowB, hiB + 1, to);
    } else {
        let midStart = lowA, midEnd = hiA;
        if (lowB > LOW_SURR_B) {
            midStart++;
            let hop = new State;
            from.edge(lowA, lowA + 1, hop);
            hop.edge(lowB, HIGH_SURR_B + 1, to);
        }
        if (hiB < HIGH_SURR_B) {
            midEnd--;
            let hop = new State;
            from.edge(hiA, hiA + 1, hop);
            hop.edge(LOW_SURR_B, hiB + 1, to);
        }
        if (midStart <= midEnd) {
            let hop = new State;
            from.edge(midStart, midEnd + 1, hop);
            hop.edge(LOW_SURR_B, HIGH_SURR_B + 1, to);
        }
    }
}

function isEmpty(expr) {
    return expr instanceof SequenceExpression && expr.exprs.length == 0;
}

function gatherExtTokens(b, tokens) {
    let result = Object.create(null);
    for (let token of tokens) {
        b.unique(token.id);
        let { name, props, dialect } = b.nodeInfo(token.props, "d", token.id.name);
        let term = b.makeTerminal(token.id.name, name, props);
        if (dialect != null)
            (b.tokens.byDialect[dialect] || (b.tokens.byDialect[dialect] = [])).push(term);
        b.namedTerms[token.id.name] = result[token.id.name] = term;
    }
    return result;
}

function findExtToken(b, tokens, expr) {
    let found = tokens[expr.id.name];
    if (!found) return null;
    if (expr.args.length)
        b.raise("External tokens cannot take arguments", expr.args[0].start);
    b.used(expr.id.name);
    return found;
}

function addRel(rel, term, after) {
    let found = rel.findIndex(r => r.term == term);
    if (found < 0) rel.push({ term, after });
    else rel[found] = { term, after: rel[found].after.concat(after) };
}

class ExternalTokenSet {
    constructor(b, ast) {
        this.b = b;
        this.ast = ast;
        this.tokens = gatherExtTokens(b, ast.tokens);
        for (let name in this.tokens)
            this.b.tokenOrigins[this.tokens[name].name] = { external: this };
    }

    getToken(expr) { return findExtToken(this.b, this.tokens, expr); }
}

class ExternalSpecializer {
    constructor(b, ast) {
        this.b = b;
        this.ast = ast;
        this.term = null;
        this.tokens = gatherExtTokens(b, ast.tokens);
    }

    finish() {
        let terms = this.b.normalizeExpr(this.ast.token);
        if (terms.length != 1 || terms[0].terms.length != 1 || !terms[0].terms[0].terminal)
            this.b.raise(`The token expression to '@external ${this.ast.type}' must resolve to a token`, this.ast.token.start);
        this.term = terms[0].terms[0];
        for (let name in this.tokens)
            this.b.tokenOrigins[this.tokens[name].name] = { spec: this.term, external: this };
    }

    getToken(expr) { return findExtToken(this.b, this.tokens, expr); }
}

function inlineRules(rules, preserve) {
    for (let pass = 0;; pass++) {
        let inlinable = Object.create(null), found;
        if (pass == 0) for (let rule of rules) {
            if (rule.name.inline && !inlinable[rule.name.name]) {
                let group = rules.filter(r => r.name == rule.name);
                if (group.some(r => r.parts.includes(rule.name))) continue;
                found = inlinable[rule.name.name] = group;
            }
        }
        for (let i = 0; i < rules.length; i++) {
            let rule = rules[i];
            if (!rule.name.interesting && !rule.parts.includes(rule.name) && rule.parts.length < 3 &&
                !preserve.includes(rule.name) &&
                (rule.parts.length == 1 || rules.every(other => other.skip == rule.skip || !other.parts.includes(rule.name))) &&
                !rule.parts.some(p => !!inlinable[p.name]) &&
                !rules.some((r, j) => j != i && r.name == rule.name))
                found = inlinable[rule.name.name] = [rule];
        }
        if (!found) return rules;
        let newRules = [];
        for (let rule of rules) {
            if (inlinable[rule.name.name]) continue;
            if (!rule.parts.some(p => !!inlinable[p.name])) {
                newRules.push(rule);
                continue;
            }
            function expand(at, conflicts, parts) {
                if (at == rule.parts.length) {
                    newRules.push(new Rule(rule.name, parts, conflicts, rule.skip));
                    return;
                }
                let next = rule.parts[at], replace = inlinable[next.name];
                if (!replace) {
                    expand(at + 1, conflicts.concat(rule.conflicts[at + 1]), parts.concat(next));
                    return;
                }
                for (let r of replace)
                    expand(at + 1, conflicts.slice(0, conflicts.length - 1)
                        .concat(conflicts[at].join(r.conflicts[0]))
                        .concat(r.conflicts.slice(1, r.conflicts.length - 1))
                        .concat(rule.conflicts[at + 1].join(r.conflicts[r.conflicts.length - 1])), parts.concat(r.parts));
            }
            expand(0, [rule.conflicts[0]], []);
        }
        rules = newRules;
    }
}

function mergeRules(rules) {
    let merged = Object.create(null), found;
    for (let i = 0; i < rules.length;) {
        let groupStart = i;
        let name = rules[i++].name;
        while (i < rules.length && rules[i].name == name) i++;
        let size = i - groupStart;
        if (name.interesting) continue;
        for (let j = i; j < rules.length;) {
            let otherStart = j, otherName = rules[j++].name;
            while (j < rules.length && rules[j].name == otherName) j++;
            if (j - otherStart != size || otherName.interesting) continue;
            let match = true;
            for (let k = 0; k < size && match; k++) {
                let a = rules[groupStart + k], b = rules[otherStart + k];
                if (a.cmpNoName(b) != 0) match = false;
            }
            if (match) found = merged[name.name] = otherName;
        }
    }
    if (!found) return rules;
    let newRules = [];
    for (let rule of rules)
        if (!merged[rule.name.name]) {
            newRules.push(rule.parts.every(p => !merged[p.name]) ? rule :
                new Rule(rule.name, rule.parts.map(p => merged[p.name] || p), rule.conflicts, rule.skip));
        }
    return newRules;
}

function simplifyRules(rules, preserve) {
    return mergeRules(inlineRules(rules, preserve));
}

/// Build an in-memory parser instance for a given grammar. This is
/// mostly useful for testing. If your grammar uses external
/// tokenizers, you'll have to provide the `externalTokenizer` option
/// for the returned parser to be able to parse anything.
export function buildParser(text, options = {}) {
    let builder = new Builder(text, options), parser = builder.getParser();
    parser.termTable = builder.termTable;
    return parser;
}

const KEYWORDS = ["break", "case", "catch", "continue", "debugger", "default", "do", "else", "finally",
                  "for", "function", "if", "return", "switch", "throw", "try", "var", "while", "with",
                  "null", "true", "false", "instanceof", "typeof", "void", "delete", "new", "in", "this",
                  "const", "class", "extends", "export", "import", "super", "enum", "implements", "interface",
                  "let", "package", "private", "protected", "public", "static", "yield"];

/// Build the code that represents the parser tables for a given
/// grammar description. The `parser` property in the return value
/// holds the main file that exports the `Parser` instance. The
/// `terms` property holds a declaration file that defines constants
/// for all of the named terms in grammar, holding their ids as value.
/// This is useful when external code, such as a tokenizer, needs to
/// be able to use these ids. It is recommended to run a tree-shaking
/// bundler when importing this file, since you usually only need a
/// handful of the many terms in your code.
export function buildParserFile(text, options = {}) {
    return new Builder(text, options).getParserFile();
}

function ignored(name) {
    let first = name[0];
    return first == "_" || first.toUpperCase() != first;
}

function isExported(rule) {
    return rule.props.some(p => p.at && p.name == "export");
}
