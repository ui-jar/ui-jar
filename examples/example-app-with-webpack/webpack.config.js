const appNameToLoad = process.argv[process.argv.findIndex(
    function(value) {
        return value.indexOf('--content-base') > -1
    }
) + 1];

if(appNameToLoad === 'ui-jar') {
    module.exports = require('./config/webpack.ui-jar.js');
} else {
    module.exports = require('./config/webpack.dev.js');
}