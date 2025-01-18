const { JSDOM } = require('jsdom');

const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<body>
    <div id="leftFiles"></div>
    <div id="rightFiles"></div>
    <div id="leftPath"></div>
    <div id="rightPath"></div>
    <div id="notificationBox" class="notification-box hidden">
        <span id="notificationPrefix"></span>
        <span id="notificationText"></span>
    </div>
    <div id="progressBox" class="progress-box hidden">
        <div class="progress-label"></div>
        <div id="progressBar" class="progress-bar-fill"></div>
    </div>
    <div id="searchBox" class="search-box hidden">
        <span class="search-prefix">/</span>
        <input type="text" id="searchInput" placeholder="Search...">
    </div>
</body>
</html>
`, {
    url: 'http://localhost',
    pretendToBeVisual: true
});

// Set up the global variables
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.Element = dom.window.Element;
global.HTMLElement = dom.window.HTMLElement;

// Now we can add the scrollIntoView mock
dom.window.Element.prototype.scrollIntoView = function() {};
dom.window.HTMLElement.prototype.scrollIntoView = function() {};

// Mock Electron module
const mockElectron = {
    shell: {
        openPath: () => Promise.resolve()
    },
    clipboard: {
        writeText: () => {}
    }
};

// Mock require('electron') by modifying require.cache
const electronPath = require.resolve('electron');
require.cache[electronPath] = {
    id: electronPath,
    filename: electronPath,
    loaded: true,
    exports: mockElectron
}; 