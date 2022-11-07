export class Node {
    constructor(start) {
        this.start = start;
    }
}

export class GrammarDeclaration extends Node {
    constructor(start, rules, topRules, tokens, context, externalTokens, externalSpecializers, externalPropSources, precedences, mainSkip, scopedSkip, dialects, externalProps, autoDelim) {
        super(start);
        this.rules = rules;
        this.topRules = topRules;
        this.tokens = tokens;
        this.context = context;
        this.externalTokens = externalTokens;
        this.externalSpecializers = externalSpecializers;
        this.externalPropSources = externalPropSources;
        this.precedences = precedences;
        this.mainSkip = mainSkip;
        this.scopedSkip = scopedSkip;
        this.dialects = dialects;
        this.externalProps = externalProps;
        this.autoDelim = autoDelim;
    }

    toString() { return Object.values(this.rules).join("\n"); }
}

export class RuleDeclaration extends Node {
    constructor(start, id, props, params, expr) {
        super(start);
        this.id = id;
        this.props = props;
        this.params = params;
        this.expr = expr;
    }

    toString() {
        return this.id.name + (this.params.length ? `<${this.params.join()}>` : "") + " -> " + this.expr;
    }
}

export class PrecDeclaration extends Node {
    constructor(start, items) {
        super(start);
        this.items = items;
    }
}

export class TokenPrecDeclaration extends Node {
    constructor(start, items) {
        super(start);
        this.items = items;
    }
}

export class TokenConflictDeclaration extends Node {
    constructor(start, a, b) {
        super(start);
        this.a = a;
        this.b = b;
    }
}

export class TokenDeclaration extends Node {
    constructor(start, precedences, conflicts, rules, literals) {
        super(start);
        this.precedences = precedences;
        this.conflicts = conflicts;
        this.rules = rules;
        this.literals = literals;
    }
}

export class LiteralDeclaration extends Node {
    constructor(start, literal, props) {
        super(start);
        this.literal = literal;
        this.props = props;
    }
}

export class ContextDeclaration extends Node {
    constructor(start, id, source) {
        super(start);
        this.id = id;
        this.source = source;
    }
}

export class ExternalTokenDeclaration extends Node {
    constructor(start, id, source, tokens) {
        super(start);
        this.id = id;
        this.source = source;
        this.tokens = tokens;
    }
}

export class ExternalSpecializeDeclaration extends Node {
    constructor(start, type, token, id, source, tokens) {
        super(start);
        this.type = type;
        this.token = token;
        this.id = id;
        this.source = source;
        this.tokens = tokens;
    }
}

export class ExternalPropSourceDeclaration extends Node {
    constructor(start, id, source) {
        super(start);
        this.id = id;
        this.source = source;
    }
}

export class ExternalPropDeclaration extends Node {
    constructor(start, id, externalID, source) {
        super(start);
        this.id = id;
        this.externalID = externalID;
        this.source = source;
    }
}

export class Identifier extends Node {
    constructor(start, name) {
        super(start);
        this.name = name;
    }

    toString() { return this.name; }
}

export class Expression extends Node {
    walk(f) { return f(this); }

    eq(_other) { return false; }
}
Expression.prototype.prec = 10;

export class NameExpression extends Expression {
    constructor(start, id, args) {
        super(start);
        this.id = id;
        this.args = args;
    }

    toString() { return this.id.name + (this.args.length ? `<${this.args.join()}>` : ""); }

    eq(other) {
        return this.id.name == other.id.name && exprsEq(this.args, other.args);
    }

    walk(f) {
        let args = walkExprs(this.args, f);
        return f(args == this.args ? this : new NameExpression(this.start, this.id, args));
    }
}

export class SpecializeExpression extends Expression {
    constructor(start, type, props, token, content) {
        super(start);
        this.type = type;
        this.props = props;
        this.token = token;
        this.content = content;
    }

    toString() { return `@${this.type}[${this.props.join(",")}]<${this.token}, ${this.content}>`; }

    eq(other) {
        return this.type == other.type && Prop.eqProps(this.props, other.props) && exprEq(this.token, other.token) &&
            exprEq(this.content, other.content);
    }

    walk(f) {
        let token = this.token.walk(f), content = this.content.walk(f);
        return f(token == this.token && content == this.content ? this : new SpecializeExpression(this.start, this.type, this.props, token, content));
    }
}

export class InlineRuleExpression extends Expression {
    constructor(start, rule) {
        super(start);
        this.rule = rule;
    }

    toString() {
        let rule = this.rule;
        return `${rule.id}${rule.props.length ? `[${rule.props.join(",")}]` : ""} { ${rule.expr} }`;
    }

    eq(other) {
        let rule = this.rule, oRule = other.rule;
        return exprEq(rule.expr, oRule.expr) && rule.id.name == oRule.id.name && Prop.eqProps(rule.props, oRule.props);
    }

    walk(f) {
        let rule = this.rule, expr = rule.expr.walk(f);
        return f(expr == rule.expr ? this :
            new InlineRuleExpression(this.start, new RuleDeclaration(rule.start, rule.id, rule.props, [], expr)));
    }
}

export class ChoiceExpression extends Expression {
    constructor(start, exprs) {
        super(start);
        this.exprs = exprs;
    }

    toString() { return this.exprs.map(e => maybeParens(e, this)).join(" | "); }

    eq(other) {
        return exprsEq(this.exprs, other.exprs);
    }

    walk(f) {
        let exprs = walkExprs(this.exprs, f);
        return f(exprs == this.exprs ? this : new ChoiceExpression(this.start, exprs));
    }
}
ChoiceExpression.prototype.prec = 1;

export class SequenceExpression extends Expression {
    constructor(start, exprs, markers, empty = false) {
        super(start);
        this.exprs = exprs;
        this.markers = markers;
        this.empty = empty;
    }

    toString() { return this.empty ? "()" : this.exprs.map(e => maybeParens(e, this)).join(" "); }

    eq(other) {
        return exprsEq(this.exprs, other.exprs) && this.markers.every((m, i) => {
            let om = other.markers[i];
            return m.length == om.length && m.every((x, i) => x.eq(om[i]));
        });
    }

    walk(f) {
        let exprs = walkExprs(this.exprs, f);
        return f(exprs == this.exprs ? this : new SequenceExpression(this.start, exprs, this.markers, this.empty && !exprs.length));
    }
}
SequenceExpression.prototype.prec = 2;

export class ConflictMarker extends Node {
    constructor(start, id, type) {
        super(start);
        this.id = id;
        this.type = type;
    }

    toString() { return (this.type == "ambig" ? "~" : "!") + this.id.name; }

    eq(other) { return this.id.name == other.id.name && this.type == other.type; }
}

export class RepeatExpression extends Expression {
    constructor(start, expr, kind) {
        super(start);
        this.expr = expr;
        this.kind = kind;
    }

    toString() { return maybeParens(this.expr, this) + this.kind; }

    eq(other) {
        return exprEq(this.expr, other.expr) && this.kind == other.kind;
    }

    walk(f) {
        let expr = this.expr.walk(f);
        return f(expr == this.expr ? this : new RepeatExpression(this.start, expr, this.kind));
    }
}
RepeatExpression.prototype.prec = 3;

export class LiteralExpression extends Expression {
    // value.length is always > 0
    constructor(start, value) {
        super(start);
        this.value = value;
    }

    toString() { return JSON.stringify(this.value); }

    eq(other) { return this.value == other.value; }
}

export class SetExpression extends Expression {
    constructor(start, ranges, inverted) {
        super(start);
        this.ranges = ranges;
        this.inverted = inverted;
    }

    toString() {
        return `[${this.inverted ? "^" : ""}${this.ranges.map(([a, b]) => {
            return String.fromCodePoint(a) + (b == a + 1 ? "" : "-" + String.fromCodePoint(b));
        })}]`;
    }

    eq(other) {
        return this.inverted == other.inverted && this.ranges.length == other.ranges.length &&
            this.ranges.every(([a, b], i) => { let [x, y] = other.ranges[i]; return a == x && b == y; });
    }
}

export class AnyExpression extends Expression {
    constructor(start) {
        super(start);
    }

    toString() { return "_"; }

    eq() { return true; }
}

function walkExprs(exprs, f) {
    let result = null;
    for (let i = 0; i < exprs.length; i++) {
        let expr = exprs[i].walk(f);
        if (expr != exprs[i] && !result) result = exprs.slice(0, i);
        if (result) result.push(expr);
    }
    return result || exprs;
}

export const CharClasses = {
    asciiLetter: [[65, 91], [97, 123]],
    asciiLowercase: [[97, 123]],
    asciiUppercase: [[65, 91]],
    digit: [[48, 58]],
    whitespace: [[9, 14], [32, 33], [133, 134], [160, 161], [5760, 5761], [8192, 8203],
                 [8232, 8234], [8239, 8240], [8287, 8288], [12288, 12289]],
    eof: [[0xffff, 0xffff]]
};

export class CharClass extends Expression {
    constructor(start, type) {
        super(start);
        this.type = type;
    }

    toString() { return "@" + this.type; }

    eq(expr) { return this.type == expr.type; }
}

export function exprEq(a, b) {
    return a.constructor == b.constructor && a.eq(b);
}

export function exprsEq(a, b) {
    return a.length == b.length && a.every((e, i) => exprEq(e, b[i]));
}

export class Prop extends Node {
    /**
     * @param {number} start
     * @param {boolean} at
     * @param {string} name
     * @param {PropPart[]} value
     */
    constructor(start, at, name, value) {
        super(start);
        this.at = at;
        this.name = name;
        this.value = value;
    }

    eq(other) {
        return this.name == other.name && this.value.length == other.value.length &&
            this.value.every((v, i) => v.value == other.value[i].value && v.name == other.value[i].name);
    }

    toString() {
        let result = (this.at ? "@" : "") + this.name;
        if (this.value.length) {
            result += "=";
            for (let { name, value } of this.value)
                result += name ? `{${name}}` : /[^\w-]/.test(value) ? JSON.stringify(value) : value;
        }
        return result;
    }

    static eqProps(a, b) {
        return a.length == b.length && a.every((p, i) => p.eq(b[i]));
    }
}

export class PropPart extends Node {
    constructor(start, value, name) {
        super(start);
        this.value = value;
        this.name = name;
    }
}

/**
 * @param {Expression} node
 * @param {Expression} parent
 * @return {string}
 */
function maybeParens(node, parent) {
    return node.prec < parent.prec ? "(" + node.toString() + ")" : node.toString();
}
