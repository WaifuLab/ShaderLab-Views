import {Tree, Range} from "./tree"

/** The {@link TreeFragment.applyChanges} method expects changed ranges in this format. */
export interface ChangedRange {
    // The start of the change in the start document
    fromA: number
    // The end of the change in the start document
    toA: number
    // The start of the replacement in the new document
    fromB: number
    // The end of the replacement in the new document
    toB: number
}

const enum Open { Start = 1, End = 2 }

export class TreeFragment {
    // @internal
    open: Open

    constructor(
        readonly from: number,
        readonly to: number,
        readonly tree: Tree,
        readonly offset: number,
        openStart: boolean = false,
        openEnd: boolean = false
    ) {
        this.open = (openStart ? Open.Start : 0) | (openEnd ? Open.End : 0)
    }

    get openStart() { return (this.open & Open.Start) > 0 }

    get openEnd() { return (this.open & Open.End) > 0 }

    static addTree(tree: Tree, fragments: readonly TreeFragment[] = [], partial = false) {
        let result = [new TreeFragment(0, tree.length, tree, 0, false, partial)]
        for (let f of fragments) if (f.to > tree.length) result.push(f)
        return result
    }

    static applyChanges(fragments: readonly TreeFragment[], changes: readonly ChangedRange[], minGap = 128) {
        if (!changes.length) return fragments
        let result: TreeFragment[] = []
        let fI = 1, nextF = fragments.length ? fragments[0] : null
        for (let cI = 0, pos = 0, off = 0;; cI++) {
            let nextC = cI < changes.length ? changes[cI] : null
            let nextPos = nextC ? nextC.fromA : 1e9
            if (nextPos - pos >= minGap) while (nextF && nextF.from < nextPos) {
                let cut: TreeFragment | null = nextF
                if (pos >= cut.from || nextPos <= cut.to || off) {
                    let fFrom = Math.max(cut.from, pos) - off, fTo = Math.min(cut.to, nextPos) - off
                    cut = fFrom >= fTo ? null : new TreeFragment(fFrom, fTo, cut.tree, cut.offset + off, cI > 0, !!nextC)
                }
                if (cut) result.push(cut)
                if (nextF.to > nextPos) break
                nextF = fI < fragments.length ? fragments[fI++] : null
            }
            if (!nextC) break
            pos = nextC.toA
            off = nextC.toA - nextC.toB
        }
        return result
    }
}

export interface PartialParse {
    advance(): Tree | null

    readonly parsedPos: number

    stopAt(pos: number): void

    readonly stoppedAt: number | null
}

export abstract class Parser {
    abstract createParse(
        input: Input,
        fragments: readonly TreeFragment[],
        ranges: readonly {from: number, to: number}[]
    ): PartialParse

    startParse(
        input: Input | string,
        fragments?: readonly TreeFragment[],
        ranges?: readonly {from: number, to: number}[]
    ): PartialParse {
        if (typeof input == "string") input = new StringInput(input)
        ranges = !ranges ? [new Range(0, input.length)] : ranges.length ? ranges.map(r => new Range(r.from, r.to)) : [new Range(0, 0)]
        return this.createParse(input, fragments || [], ranges)
    }

    parse(
        input: Input | string,
        fragments?: readonly TreeFragment[],
        ranges?: readonly {from: number, to: number}[]
    ) {
        let parse = this.startParse(input, fragments, ranges)
        for (;;) {
            let done = parse.advance()
            if (done) return done
        }
    }
}

export interface Input {
    readonly length: number
    chunk(from: number): string
    readonly lineChunks: boolean
    read(from: number, to: number): string
}

class StringInput implements Input {
    constructor(readonly string: string) {}

    get length() { return this.string.length }

    chunk(from: number) { return this.string.slice(from) }

    get lineChunks() { return false }

    read(from: number, to: number) { return this.string.slice(from, to) }
}

/** Parse wrapper functions are supported by some parsers to inject additional parsing logic. */
export type ParseWrapper = (
    inner: PartialParse,
    input: Input,
    fragments: readonly TreeFragment[],
    ranges: readonly {from: number, to: number}[]
) => PartialParse
