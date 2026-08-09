// @ts-check
/**
 * Content scripts run outside LavaMoat compartments:
 * - inpage.js executes in the page MAIN world (LavaMoat lockdown would break dapps)
 * - content.js is a thin bridge in the isolated world
 */
const path = require('node:path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const isProd = process.env.NODE_ENV === 'production';

/** @type {import('webpack').Configuration} */
module.exports = {
  mode: isProd ? 'production' : 'development',
  target: 'web',
  devtool: false,
  entry: {
    content: './src/content/inject.ts',
    inpage: './src/inpage/provider.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    iife: true,
    clean: false,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(
            __dirname,
            'node_modules/@trezor/connect-webextension/build/content-script.js',
          ),
          to: 'vendor/trezor-content-script.js',
          noErrorOnMissing: true,
        },
      ],
    }),
  ],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'esbuild-loader',
            options: { loader: 'tsx', target: 'es2020' },
          },
        ],
      },
    ],
  },
  optimization: {
    minimize: isProd,
  },
};
