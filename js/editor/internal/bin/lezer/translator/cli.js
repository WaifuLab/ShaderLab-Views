#!/usr/bin/env node
import { readFile, writeFile } from "node:fs";
import { importGrammar } from "./index.js";

let config = { file: undefined, out: undefined };

const usage = "Usage: translator [--output outfile] file";

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
        case arg === "-o" || arg === "--output":
            if (config.out) argvError("Multiple output files given");
            config.out = process.argv[i++];
            break;
        default:
            argvError("Unrecognized option " + arg);
            break;
    }
}

try {
    readFile(config.file, (readError, data) => {
        if (readError) throw readError;
        writeFile(config.out, importGrammar(data), writeError => {
            if (writeError) throw writeError;
            console.log(`> Translate ${config.file} successfully, save at location "${config.out}"`)
        });
    });
} catch (e) {
    console.error(e.stack);
    process.exit(1);
}
