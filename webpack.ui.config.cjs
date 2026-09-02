// @ts-check
/**
 * Popup / side-panel UI with MetaMask-style LavaMoat Layer 3.
 * Content/inpage stay outside (page contexts). Background is separate (webpack.config.cjs).
 */
const path = require('node:path');
const webpack = require('webpack');
const LavaMoatPlugin = require('@lavamoat/webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const {
  lockdown,
  popupScuttleExceptions,
} = require('./webpack/lavamoat-options.cjs');

const isProd = process.env.NODE_ENV === 'production';
const generatePolicy = process.env.LAVAMOAT_GENERATE_POLICY === '1';

/** @type {import('webpack').Configuration} */
module.exports = {
  mode: isProd ? 'production' : 'development',
  target: 'web',
  devtool: false,
  entry: {
    popup: './src/main.tsx',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'assets/[name].[contenthash:8].js',
    chunkFilename: 'assets/[name].[contenthash:8].js',
    publicPath: 'auto',
    clean: false,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      buffer: path.resolve(__dirname, 'node_modules/buffer/'),
      // ESM `export default class Eth` becomes a live binding that throws
      // "Cannot access 'Eth' before initialization" under LavaMoat/webpack.
      '@ledgerhq/hw-app-eth': path.resolve(
        __dirname,
        'node_modules/@ledgerhq/hw-app-eth/lib/Eth.js',
      ),
      '@ledgerhq/hw-transport-webhid': path.resolve(
        __dirname,
        'node_modules/@ledgerhq/hw-transport-webhid/lib/TransportWebHID.js',
      ),
    },
  },
  plugins: [
    new LavaMoatPlugin({
      policyLocation: path.resolve(__dirname, 'lavamoat/webpack-ui'),
      generatePolicy,
      readableResourceIds: !isProd,
      runChecks: true,
      diagnosticsVerbosity: 1,
      HtmlWebpackPluginInterop: true,
      // Single popup chunk — SES must run before LavaMoat runtime.
      inlineLockdown: /assets\/popup\.[a-f0-9]+\.js$/,
      lockdown,
      scuttleGlobalThis: {
        enabled: true,
        exceptions: popupScuttleExceptions,
      },
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'development'),
    }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    new MiniCssExtractPlugin({
      filename: 'assets/[name].[contenthash:8].css',
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'webpack/index.html'),
      filename: 'index.html',
      chunks: ['popup'],
      inject: 'body',
      scriptLoading: 'blocking',
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'public',
          to: '.',
          globOptions: { ignore: ['**/.DS_Store'] },
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
            options: { loader: 'tsx', target: 'es2022' },
          },
        ],
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', LavaMoatPlugin.exclude],
        sideEffects: true,
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg|woff2?)$/i,
        type: 'asset/resource',
        generator: { filename: 'assets/[name].[hash:8][ext]' },
      },
    ],
  },
  optimization: {
    // LavaMoat wrappers use `with` — Terser cannot minify them.
    minimize: false,
    splitChunks: false,
    runtimeChunk: false,
  },
  performance: {
    hints: false,
  },
};
