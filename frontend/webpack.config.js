const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  devServer: {
    port: process.env.PORT || 8090,
    allowedHosts: [
      'tockenlock-sol-front.herokuapp.com'
    ]
  },  
  node: {
    global: true,
  },
  resolve: {
    fallback: {
      fs: false,
      "assert": false,
      "process": false,
      "util": false,
      "path": false,
      "crypto": false,
      os: false, 
      "buffer": require.resolve("buffer")
    },
  },
  entry: {
    main: path.resolve(__dirname, './src/index.js'),
  },
  output: {
    path: path.resolve(__dirname, './dist'),
    filename: '[name].bundle.js',
  },
  module: {
    rules: [
      {
        test: /\.m?js/,
        type: "javascript/auto",
      },
      {
        test: /\.m?js/,
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },
      {
        test: /\.(css)$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.json$/,
        loader: 'json-loader'
      }
    ],
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    new HtmlWebpackPlugin({
      title: 'webpack Boilerplate',
      template: path.resolve(__dirname, './src/index.html'), 
      filename: 'index.html',
    }),
    new CleanWebpackPlugin(),
  ],
};