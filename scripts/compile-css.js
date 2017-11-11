const fs = require('fs');
const path = require('path');
const os = require('os');
const spawn = require('child_process').spawn;

const watcher = fs.watch(path.resolve(__dirname, '../src'), { encoding: 'utf8', recursive: true, persistent: true });
const npmCommand = os.platform() === 'win32' ? 'npm.cmd' : 'npm';
const debounceTime = 500;
let watchTimer = null;

watcher.addListener('change', (eventName, fileName) => {
    clearTimeout(watchTimer);

    watchTimer = setTimeout(() => eventHandler(fileName), debounceTime);
});

function eventHandler(fileName) {
    const isSassFile = /\.scss$/i.test(fileName);

    if (isSassFile) {
        compileSassToCss();
    }
}

function compileSassToCss() {
    const process = spawn(npmCommand, ['run', 'css'], { stdio: 'inherit' });
}