# YTDown
Firefox add-on for downloading music from YouTube easily and with custom metadata.

This add-on is in development state and new features are going to get added as time goes on.

## List of planned features
- Settings
- Translations

## Server
A custom server is used to download the songs from YouTube. Current hosting isn't the fastest nor guarantees 100% uptime, so if you would like to self-host your own instance, you can find the code [here](https://github.com/Histmy/YTDown-server/).

## Build
If you want to build this add-on just follow these easy steps:

### Setup
1. You need to have [Node.js](https://nodejs.org/) installed on your machine.
1. Install typescript compiler with `npm i -g typescript`.
1. In root of this project run `npm i` to install project dependences.

### Building itself
1. To generate `/scripts` folder and compile typescript to javascript use `tsc` command
