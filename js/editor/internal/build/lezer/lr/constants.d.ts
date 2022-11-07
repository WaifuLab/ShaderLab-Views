/**
 * This file defines some constants that are needed both in this package and in
 * lezer-generator, so that the generator code can access them without them being part
 * of lezer's public interface.

 * Parse actions are represented as numbers, in order to cheaply and simply pass them
 * around. The numbers are treated as bitfields holding different pieces of information.
 *
 * When storing actions in 16-bit number arrays, they are split in the middle, with the
 * first element holding the first 16 bits, and the second the rest.
 *
 * The value 0 (which is not a valid action because no shift goes to state 0, the start
 * state), is often used to denote the absence of valid action.
 */
export declare const enum Action {
    /** Distinguishes between shift (off) and reduce (on) actions. */
    ReduceFlag = 65536,
    /** The first 16 bits hold the target state's id for shift actions, and the reduced term id for reduce actions. */
    ValueMask = 65535,
    /** In reduce actions, all bits beyond 18 hold the reduction's depth (the amount of stack frames it reduces). */
    ReduceDepthShift = 19,
    /**
     * This is set for reduce actions that reduce two instances of a repeat term to the
     * term (but _not_ for the reductions that match the repeated content).
     */
    RepeatFlag = 131072,
    /**
     * Goto actions are a special kind of shift that don't actually shift the current
     * token, just add a stack frame. This is used for non-simple skipped expressions,
     * to enter the skip rule when the appropriate token is seen (because the arbitrary
     * state from which such a rule may start doesn't have the correct goto entries).
     */
    GotoFlag = 131072,
    /**
     * Both shifts and reduces can have a stay flag set. For shift, it means that the
     * current token must be shifted but the state should stay the same (used for
     * single-token skip expression). For reduce, it means that, instead of consulting
     * the goto table to determine which state to go to, the state already on the stack
     * must be returned to (used at the end of non-simple skip expressions).
     */
    StayFlag = 262144
}
export declare const enum StateFlag {
    Skipped = 1,
    Accepting = 2
}
/**
 * The lowest bit of the values stored in `parser.specializations` indicate whether this
 * specialization replaced the original token (`Specialize`) or adds a second interpretation
 * while also leaving the first (`Extend`).
 */
export declare const enum Specialize {
    Specialize = 0,
    Extend = 1
}
export declare const enum Term {
    Err = 0
}
export declare const enum Seq {
    End = 65535,
    Done = 0,
    Next = 1,
    Other = 2
}
export declare const enum ParseState {
    Flags = 0,
    Actions = 1,
    Skip = 2,
    TokenizerMask = 3,
    DefaultReduce = 4,
    ForcedReduce = 5,
    Size = 6
}
export declare const enum Encode {
    BigValCode = 126,
    BigVal = 65535,
    Start = 32,
    Gap1 = 34,
    Gap2 = 92,
    Base = 46
}
export declare const enum File {
    Version = 14
}
