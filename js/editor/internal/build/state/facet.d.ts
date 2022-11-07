import { Transaction, StateEffect, StateEffectType } from "./transaction.js";
import { EditorState } from "./state.js";
declare type FacetConfig<Input, Output> = {
    /**
     * How to combine the input values into a single output value. When not given, the array of input
     * values becomes the output. This function will immediately be called on creating the facet, with
     * an empty array, to compute the facet's default value when no inputs are present.
     */
    combine?: (value: readonly Input[]) => Output;
    /**
     * How to compare output values to determine whether the value of the facet changed. Defaults to
     * comparing by `===` or, if no `combine` function was given, comparing each element of the array
     * with `===`.
     */
    compare?: (a: Output, b: Output) => boolean;
    /**
     * How to compare input values to avoid recomputing the output value when no inputs changed.
     * Defaults to comparing with `===`.
     */
    compareInput?: (a: Input, b: Input) => boolean;
    /** Forbids dynamic inputs to this facet. */
    static?: boolean;
    /**
     * If given, these extension(s) (or the result of calling the given function with the facet) will
     * be added to any state where this facet is provided. (Note that, while a facet's default value
     * can be read from a state even if the facet wasn't present in the state at all, these extensions
     * won't be added in that situation.)
     */
    enables?: Extension | ((self: Facet<Input, Output>) => Extension);
};
/**
 * A facet is a labeled value that is associated with an editor state. It takes inputs from any number
 * of extensions, and combines those into a single output value.
 * Examples of uses of facets are the
 * [tab size]{@link EditorState.tabSize},
 * [editor attributes]{@link EditorView.editorAttributes}, and
 * [update listeners]{@link EditorView.updateListener}.
 */
export declare class Facet<Input, Output = readonly Input[]> {
    readonly combine: (values: readonly Input[]) => Output;
    readonly compareInput: (a: Input, b: Input) => boolean;
    readonly compare: (a: Output, b: Output) => boolean;
    private isStatic;
    readonly id: number;
    readonly default: Output;
    readonly extensions: Extension | undefined;
    private constructor();
    /** Define a new facet. */
    static define<Input, Output = readonly Input[]>(config?: FacetConfig<Input, Output>): Facet<Input, Output>;
    /** Returns an extension that adds the given value to this facet. */
    of(value: Input): Extension;
    /**
     * Create an extension that computes a value for the facet from a state. You must take care to
     * declare the parts of the state that this value depends on, since your function is only called
     * again for a new state when one of those parts changed.
     *
     * In cases where your value depends only on a single field, you'll want to use the
     * [`from`]{@link Facet.from} method instead.
     */
    compute(deps: readonly Slot<any>[], get: (state: EditorState) => Input): Extension;
    /** Create an extension that computes zero or more values for this facet from a state. */
    computeN(deps: readonly Slot<any>[], get: (state: EditorState) => readonly Input[]): Extension;
    /**
     * Shorthand method for registering a facet source with a state field as input. If the field's type
     * corresponds to this facet's input type, the getter function can be omitted. If given, it will be
     * used to retrieve the input from the field value.
     */
    from<T extends Input>(field: StateField<T>): Extension;
    from<T>(field: StateField<T>, get: (value: T) => Input): Extension;
}
declare type Slot<T> = Facet<any, T> | StateField<T> | "doc" | "selection";
declare const enum Provider {
    Static = 0,
    Single = 1,
    Multi = 2
}
declare class FacetProvider<Input> {
    readonly dependencies: readonly Slot<any>[];
    readonly facet: Facet<Input, any>;
    readonly type: Provider;
    readonly value: ((state: EditorState) => Input) | ((state: EditorState) => readonly Input[]) | Input;
    readonly id: number;
    extension: Extension;
    constructor(dependencies: readonly Slot<any>[], facet: Facet<Input, any>, type: Provider, value: ((state: EditorState) => Input) | ((state: EditorState) => readonly Input[]) | Input);
    dynamicSlot(addresses: {
        [id: number]: number;
    }): DynamicSlot;
}
declare type StateFieldSpec<Value> = {
    /** Creates the initial value for the field when a state is created. */
    create: (state: EditorState) => Value;
    /** Compute a new value from the field's previous value and a [transaction]{@link Transaction}. */
    update: (value: Value, transaction: Transaction) => Value;
    /**
     * Compare two values of the field, returning `true` when they are the same. This is used to
     * avoid recomputing facets that depend on the field when its value did not change. Defaults
     * to using `===`.
     */
    compare?: (a: Value, b: Value) => boolean;
    /**
     * Provide extensions based on this field. The given function will be called once with the
     * initialized field. It will usually want to call some facet's {@link Facet.from} method
     * to create facet inputs from this field, but can also return other extensions that
     * should be enabled when the field is present in a configuration.
     */
    provide?: (field: StateField<Value>) => Extension;
    /**
     * A function used to serialize this field's content to JSON. Only necessary when this
     * field is included in the argument to {@link EditorState.toJSON}.
     */
    toJSON?: (value: Value, state: EditorState) => any;
    /** A function that deserializes the JSON representation of this field's content. */
    fromJSON?: (json: any, state: EditorState) => Value;
};
/** Fields can store additional information in an editor state, and keep it in sync with the rest of the state. */
export declare class StateField<Value> {
    readonly id: number;
    private createF;
    private updateF;
    private compareF;
    readonly spec: StateFieldSpec<Value>;
    provides: Extension | undefined;
    private constructor();
    /** Define a state field. */
    static define<Value>(config: StateFieldSpec<Value>): StateField<Value>;
    private create;
    slot(addresses: {
        [id: number]: number;
    }): DynamicSlot;
    /**
     * Returns an extension that enables this field and overrides the way it is initialized.
     * Can be useful when you need to provide a non-default starting value for the field.
     */
    init(create: (state: EditorState) => Value): Extension;
    /** State field instances can be used as {@link Extension} values to enable the field in a given state. */
    get extension(): Extension;
}
/**
 * Extension values can be [provided]{@link EditorStateConfig.extensions} when creating a
 * state to attach various kinds of configuration and behavior information. They can either
 * be built-in extension-providing objects, such as [state fields]{@link StateField} or
 * [facet providers]{@link Facet.of}, or objects with an extension in its `extension` property.
 * Extensions can be nested in arrays arbitrarily deep—they will be flattened when processed.
 */
export declare type Extension = {
    extension: Extension;
} | readonly Extension[];
/**
 * By default extensions are registered in the order they are found in the flattened form of nested array
 * that was provided. Individual extension values can be assigned a precedence to override this. Extensions
 * that do not have a precedence set get the precedence of the nearest parent with a precedence, or
 * [`default`]{@link Prec.default} if there is no such parent. The final ordering of extensions is
 * determined by first sorting by precedence and then by order within each precedence.
 */
export declare const Prec: {
    /** The highest precedence level, for extensions that should end up near the start of the precedence ordering. */
    highest: (ext: Extension) => Extension;
    /** A higher-than-default precedence, for extensions that should come before those with default precedence. */
    high: (ext: Extension) => Extension;
    /** The default precedence, which is also used for extensions without an explicit precedence. */
    default: (ext: Extension) => Extension;
    /** A lower-than-default precedence. */
    low: (ext: Extension) => Extension;
    /** The lowest precedence level. Meant for things that should end up near the end of the extension order. */
    lowest: (ext: Extension) => Extension;
};
/**
 * Extension compartments can be used to make a configuration dynamic. By [wrapping]{@link Compartment.of}
 * part of your configuration in a compartment, you can later [replace]{@link Compartment.reconfigure} that
 * part through a transaction.
 */
export declare class Compartment {
    /** Create an instance of this compartment to add to your [state configuration]{@link EditorStateConfig.extensions}. */
    of(ext: Extension): Extension;
    /** Create an [effect](#state.TransactionSpec.effects) that reconfigures this compartment. */
    reconfigure(content: Extension): StateEffect<unknown>;
    /** Get the current content of the compartment in the state, or `undefined` if it isn't present. */
    get(state: EditorState): Extension | undefined;
    /** This is initialized in state.ts to avoid a cyclic dependency */
    static reconfigure: StateEffectType<{
        compartment: Compartment;
        extension: Extension;
    }>;
}
export declare class CompartmentInstance {
    readonly compartment: Compartment;
    readonly inner: Extension;
    constructor(compartment: Compartment, inner: Extension);
    extension: Extension;
}
export interface DynamicSlot {
    create(state: EditorState): SlotStatus;
    update(state: EditorState, tr: Transaction): SlotStatus;
    reconfigure(state: EditorState, oldState: EditorState): SlotStatus;
}
export declare class Configuration {
    readonly base: Extension;
    readonly compartments: Map<Compartment, Extension>;
    readonly dynamicSlots: DynamicSlot[];
    readonly address: {
        [id: number]: number;
    };
    readonly staticValues: readonly any[];
    readonly facets: {
        [id: number]: readonly FacetProvider<any>[];
    };
    readonly statusTemplate: SlotStatus[];
    constructor(base: Extension, compartments: Map<Compartment, Extension>, dynamicSlots: DynamicSlot[], address: {
        [id: number]: number;
    }, staticValues: readonly any[], facets: {
        [id: number]: readonly FacetProvider<any>[];
    });
    staticFacet<Output>(facet: Facet<any, Output>): any;
    static resolve(base: Extension, compartments: Map<Compartment, Extension>, oldState?: EditorState): Configuration;
}
export declare const enum SlotStatus {
    Unresolved = 0,
    Changed = 1,
    Computed = 2,
    Computing = 4
}
export declare function ensureAddr(state: EditorState, addr: number): number;
export declare function getAddr(state: EditorState, addr: number): any;
export {};
