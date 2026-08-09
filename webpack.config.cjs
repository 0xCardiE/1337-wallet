// @ts-check
/**
 * LavaMoat-protected extension bundles: popup UI + MV3 service worker.
 * Content/inpage scripts are built separately (page contexts — see webpack.content.config.cjs).
 */
const path = require('node:path');
const webpack = require('webpack');
const LavaMoatPlugin = require('@lavamoat/webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const isProd = process.env.NODE_ENV === 'production';

/** @type {import('webpack').Configuration} */
module.exports = {
  mode: isProd ? 'production' : 'development',
  target: 'web',
  devtool: false,
  entry: {
    popup: './src/main.tsx',
    background: './src/background.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: (pathData) =>
      pathData.chunk?.name === 'background' ? 'background.js' : 'assets/[name].[contenthash:8].js',
    chunkFilename: 'assets/[name].[contenthash:8].js',
    publicPath: './',
    clean: true,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      buffer: path.resolve(__dirname, 'node_modules/buffer/'),
    },
  },
  plugins: [
    new LavaMoatPlugin({
      policyLocation: path.resolve(__dirname, 'lavamoat/webpack'),
      generatePolicy: process.env.LAVAMOAT_GENERATE_POLICY === '1',
      readableResourceIds: !isProd,
      runChecks: true,
      diagnosticsVerbosity: 1,
      HtmlWebpackPluginInterop: true,
      inlineLockdown: /background\.js$/,
      lockdown: {
        errorTaming: 'unsafe',
        consoleTaming: 'unsafe',
      },
      scuttleGlobalThis: {
        enabled: true,
        exceptions: [
          'chrome',
          'browser',
          'self',
          'globalThis',
          'console',
          'performance',
          'setTimeout',
          'clearTimeout',
          'setInterval',
          'clearInterval',
          'queueMicrotask',
          'structuredClone',
          'atob',
          'btoa',
          'crypto',
          'fetch',
          'Response',
          'Request',
          'Headers',
          'URL',
          'URLSearchParams',
          'TextEncoder',
          'TextDecoder',
          'AbortController',
          'AbortSignal',
          'BroadcastChannel',
          'importScripts',
          /Uint[0-9]+Array/,
          'Proxy',
        ],
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
    minimize: false,
    splitChunks: {
      chunks: (chunk) => chunk.name === 'popup',
    },
  },
  performance: {
    hints: false,
  },
};
