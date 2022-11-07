#!/usr/bin/env node
import { writeFileSync, readFileSync } from "node:fs";
import { buildParserFile } from "./build.js";

let config = {
    file: undefined,
    out: undefined,
    moduleStyle: "es",
    includeNames: false,
    exportName: undefined,
    noTerms: false
}

const usage = "Usage: generator [--cjs] [--names] [--noTerms] [--output outfile] [--export name] file";

function argvError(msg) {
    console.error(msg);
    console.log(usage);
    process.exit(1);
}

for (let i = 2; i < process.argv.length;) {
    let arg = process.argv[i++];
    switch (true) {
        case !/^-/.test(arg):
            if (config.file) argvError("Multiple input files given");
            config.file = arg;
            break;
        case arg === "--help":
            console.log(usage);
            process.exit(0);
            break;
        case arg === "--cjs":
            config.moduleStyle = "cjs";
            break;
        case arg === "-o" || arg === "--output":
            if (config.out) argvError("Multiple output files given");
            config.out = process.argv[i++];
            break;
        case arg === "--names":
            config.includeNames = true;
            break;
        case arg === "--export":
            config.exportName = process.argv[i++];
            break;
        case arg === "--noTerms":
            config.noTerms = true;
            break;
        default:
            argvError("Unrecognized option " + arg);
            break;
    }
}

if (!config.file) argvError("No input file given");

let parser, terms;
try {
    ;({ parser, terms } = buildParserFile(readFileSync(config.file, "utf8"), {
        fileName: config.file,
        moduleStyle: config.moduleStyle,
        includeNames: config.includeNames,
        exportName: config.exportName
    }));
} catch (e) {
    console.error(e.stack);
    process.exit(1);
}

if (config.out) {
    let ext = /^(.*)\.(c?js|mjs|ts|esm?)$/.exec(config.out);
    let [parserFile, termFile] = ext ? [config.out, ext[1] + ".terms." + ext[2]] : [config.out + ".js", config.out + ".terms.js"];
    writeFileSync(parserFile, parser);
    if (!config.noTerms) writeFileSync(termFile, terms);
    console.log(`Wrote ${parserFile}${config.noTerms ? "" : ` and ${termFile}`}`);
} else {
    console.log(parser);
}
