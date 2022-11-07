const { existsSync, mkdirSync } = require("node:fs");
const { join, normalize } = require("node:path");
const { join: contact } = require("node:path/posix");
const { sources } = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const getAttributes = markup => markup.match(/([^\r\n\t\f\v= '"]+)(?:=(["'])?((?:.(?!\2?\s+(?:\S+)=|\2))+.)\2?)?/g).slice(1, -1);

class FaviconsPlugin {
    constructor(options, callback) {
        this.options = Object.assign({
            src: false,
            path: '',
            appName: null,                            // Your application's name. `string`
            appShortName: null,                       // Your application's short_name. `string`. Optional. If not set, appName will be used
            appDescription: null,                     // Your application's description. `string`
            developerName: null,                      // Your (or your developer's) name. `string`
            developerURL: null,                       // Your (or your developer's) URL. `string`
            dir: "auto",                              // Primary text direction for name, short_name, and description
            lang: "en-US",                            // Primary language for name and short_name
            background: "#fff",                       // Background colour for flattened icons. `string`
            theme_color: "#fff",                      // Theme color user for example in Android's task switcher. `string`
            appleStatusBarStyle: "black-translucent", // Style for Apple status bar: "black-translucent", "default", "black". `string`
            display: "standalone",                    // Preferred display mode: "fullscreen", "standalone", "minimal-ui" or "browser". `string`
            orientation: "any",                       // Default orientation: "any", "natural", "portrait" or "landscape". `string`
            scope: '',                                // set of URLs that the browser considers within your app
            start_url: "/?homescreen=1",              // Start URL when launching the application from a device. `string`
            version: "1.0",                           // Your application's version string. `string`
            logging: false,                           // Print logs to console? `boolean`
            pixel_art: false,                         // Keeps pixels "sharp" when scaling up, for pixel art.  Only supported in offline mode.
            loadManifestWithCredentials: false,       // Browsers don't send cookies when fetching a manifest, enable this to fix that. `boolean`
            icons: { favicons: true }
        }, options);

        this.options.icons = Object.assign({
            android: false,                          // Create Android homescreen icon. `boolean` or `{ offset, background, mask, overlayGlow, overlayShadow }` or an array of sources
            appleIcon: false,                        // Create Apple touch icons. `boolean` or `{ offset, background, mask, overlayGlow, overlayShadow }` or an array of sources
            appleStartup: false,                     // Create Apple startup images. `boolean` or `{ offset, background, mask, overlayGlow, overlayShadow }` or an array of sources
            favicons: true,                          // Create regular favicons. `boolean` or `{ offset, background, mask, overlayGlow, overlayShadow }` or an array of sources
            windows: false,                          // Create Windows 8 tile icons. `boolean` or `{ offset, background, mask, overlayGlow, overlayShadow }` or an array of sources
            yandex: false                            // Create Yandex browser icon. `boolean` or `{ offset, background, mask, overlayGlow, overlayShadow }` or an array of sources
        }, this.options.icons);

        this.callback = callback;
    }

    apply(compiler) {
        let { output } = compiler.options;

        /* Ensure our ouput directory exists */
        if (!existsSync(join(output.path, this.options.path)))
            mkdirSync(join(output.path, this.options.path), { recursive: true });

        if (this.options.src && output.path) {
            compiler.hooks.thisCompilation.tap("FaviconsPlugin", compilation => {
                compilation.hooks.processAssets.tapPromise({
                    name: "FaviconsPlugin",
                    stage: compilation.PROCESS_ASSETS_STAGE_ADDITIONAL, // see below for more stages
                    additionalAssets: false
                }, assets => import("favicons").then(module =>
                    module.favicons(this.options.src, this.options, (error, response) => {
                        if (error) { compilation.errors.push(new compiler.webpack.WebpackError(`FaviconsPlugin - icon generate failed ${error.message}`)); return; }

                        response = typeof this.callback == "function" ? Object.assign({ ...response }, this.callback(response)) : response;

                        try {
                            HtmlWebpackPlugin.getHooks(compilation).alterAssetTags.tapAsync("FaviconsPlugin", (data, callback) => {
                                Object.keys(response.html).map(i => {
                                    let attrs = getAttributes(response.html[i]), attributes = {};
                                    Object.keys(attrs).map(j => { // Map ["{key}={value}"] to key, value object
                                        const parts = attrs[j].split("="), outPath = compiler.options.output.publicPath, key = parts[0], value = parts[1].slice(1, -1);
                                        attributes[key] = (key === "href" && outPath !== "auto") ? contact(outPath, value) : value;
                                    });
                                    data.assetTags.meta.push({ tagName: "link", voidTag: true, meta: { plugin: "FaviconsPlugin" }, attributes });
                                });
                                // Run required callback with altered data
                                callback(null, data);
                            });
                        } catch (err) { }

                        Object.keys(assets).map(i => {
                            if (i.indexOf(".html") === -1) return false;

                            // Prepend output.plublicPath to favicon href paths by hand
                            if (compiler.options.output.publicPath !== "auto") {
                                response.html = Object.keys(response.html).map((i) => {
                                    response.html[i].replace(/href="(.*?)"/g, (match, p1, string) => `href="${normalize(`${compiler.options.output.publicPath}/${p1}`)}"`.replace(/\\/g, "/"));
                                });
                            }

                            // Inject favicon <link> into .html document(s)
                            let HTML = compilation.getAsset(i).source.source().toString();
                            compilation.updateAsset(i, new sources.RawSource(HTML.replace(/<head>([\s\S]*?)<\/head>/, `<head>$1\r    ${response.html.join('\r    ')}\r  </head>`)));
                        });

                        if (response.images) { // images handle
                            Object.keys(response.images).map(i => {
                                let image = response.images[i], outPath = normalize(`${this.options.path}/${image.name}`).replace(/\\/g, "/");
                                assets[outPath] = { source: () => image.contents, size: () => image.contents.length };
                            });
                        }

                        if (response.files) { // manifest and xml handle
                            Object.keys(response.files).map(i => {
                                let file = response.files[i], outPath = normalize(`${this.options.path}/${file.name}`).replace(/\\/g, "/");
                                assets[outPath] = { source: () => file.contents, size: () => file.contents.length };
                            });
                        }

                        return assets;
                    }
                )));
            });
        }
    }
}

module.exports = FaviconsPlugin;
