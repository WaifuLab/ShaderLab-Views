const { stdout } = require("node:process");
const { join } = require("node:path");
const { ProgressPlugin } = require("webpack");
const CopyPlugin = require("copy-webpack-plugin");
const FaviconsPlugin = require("./webpack.favicons.js");
const TerserPlugin = require("terser-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const HtmlInlineScriptPlugin = require("html-inline-script-webpack-plugin");

const defaultSourceMap = {
    root: join(__dirname, "dist/static"),
    login: {
        entry: [
            join(__dirname, "js/login.js")
        ]
    },
    home: {
        entry: [
            join(__dirname, "js/home.js")
        ]
    },
    editor: {
        entry: [
            join(__dirname, "js/editor.js")
        ]
    },
};

const resolveOverride = (devMode, env) => {
    let override = {};
    if (env.BUILD_TARGET) Object.assign(override, { root: env.BUILD_TARGET });
    return override;
}

module.exports = env => {
    const devMode = env.NODE_ENV !== "production";

    const override = resolveOverride(devMode, env);

    const sourceMap = { ...defaultSourceMap, ...override };

    stdout.write(`> Webpack Build Mode: ${env.NODE_ENV ?? "production"} \n\n`);

    return {
        mode: devMode ? "development" : "production",
        entry: {
            login: sourceMap.login.entry,
            home: sourceMap.home.entry,
            editor: sourceMap.editor.entry,
        },
        output: {
            publicPath: "", // relative to HTML page (same directory)
            path: sourceMap.root,
            clean: true,
            filename: "js/[name].js",
            assetModuleFilename: "img/[hash][ext][query]"
        },
        module: {
            rules: [
                {
                    test: /\.css$/i,
                    /* Support both import assert and regular css loading */
                    oneOf: [
                        {
                            assert: { type: "css" },
                            loader: "css-loader",
                            options: {
                                exportType: "css-style-sheet"
                            }
                        },
                        {
                            use: [
                                MiniCssExtractPlugin.loader,
                                "css-loader"
                            ]
                        }
                    ],
                },
                {
                    test: /\.jpe?g$|\.gif$|\.png$|\.PNG$|\.svg$/,
                    type: "asset/resource",
                }
            ],
        },
        plugins: [
            new ProgressPlugin(),
            /* Resolve css files to separate folder */
            new MiniCssExtractPlugin({
                filename: "css/[name].css"
            }),
            /* Build up html page */
            new HtmlWebpackPlugin({
                title: "Shader Lab Login",
                filename: "login.html",
                meta: { description: "Shader Lab Login" },
                minify: false,
                chunks: ["login"]
            }),
            new HtmlWebpackPlugin({
                title: "Shader Lab",
                filename: "home.html",
                meta: { description: "Shader Lab" },
                minify: false,
                chunks: ["home"]
            }),
            new HtmlWebpackPlugin({
                title: "Shader Lab Editor",
                filename: "editor.html",
                meta: { description: "Shader Lab Editor" },
                minify: false,
                chunks: ["editor"],
            }),
            new HtmlInlineScriptPlugin({
                scriptMatchPattern: [/login.js$/],
                htmlMatchPattern: [/login.html$/],
            }),
            new HtmlInlineScriptPlugin({
                scriptMatchPattern: [/home.js$/],
                htmlMatchPattern: [/home.html$/],
            }),
            new HtmlInlineScriptPlugin({
                scriptMatchPattern: [/editor.js$/],
                htmlMatchPattern: [/editor.html$/],
            }),
            new FaviconsPlugin({
                src: join(__dirname, "img/default.png"),
                path: "img",
                appName: "shaderlab",
                appDescription: "Shader Lab",
                background: "#ddd",
                theme_color: "#333",
                manifestMaskable: true,
                icons: {
                    favicons: true,
                    appleIcon: true
                }
            })
        ],
        optimization: {
            minimize: !devMode,
            minimizer: [
                new CssMinimizerPlugin(),
                new TerserPlugin({ parallel: true }),
            ],
        }
    }
}
