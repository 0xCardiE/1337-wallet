// @ts-check
/** LavaMoat-protected MV3 service worker (session keys, signing, Trezor bridge). */
const path = require('node:path');
const webpack = require('webpack');
const LavaMoatPlugin = require('@lavamoat/webpack');
const {
  lockdown,
  backgroundScuttleExceptions,
} = require('./webpack/lavamoat-options.cjs');

const isProd = process.env.NODE_ENV === 'production';

/** @type {import('webpack').Configuration} */
module.exports = {
  mode: isProd ? 'production' : 'development',
  target: 'web',
  devtool: false,
  entry: {
    background: './src/background.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    publicPath: 'auto',
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
      inlineLockdown: /background\.js$/,
      lockdown,
      scuttleGlobalThis: {
        enabled: true,
        exceptions: backgroundScuttleExceptions,
      },
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'development'),
    }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
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
    ],
  },
  optimization: {
    minimize: false,
  },
  performance: {
    hints: false,
  },
};
