import { Facet } from "../state/index.js";
import { StyleModule, StyleSpec } from "../utils/style-mod.js";
export declare const theme: Facet<string, string>;
export declare const darkTheme: Facet<boolean, boolean>;
export declare const baseThemeID: string, baseLightID: string, baseDarkID: string;
export declare const lightDarkIDs: {
    "&light": string;
    "&dark": string;
};
export declare function buildTheme(main: string, spec: {
    [name: string]: StyleSpec;
}, scopes?: {
    [name: string]: string;
}): StyleModule;
export declare const baseTheme: StyleModule;
