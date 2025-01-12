const os = require('os')
const path = require('path')

// Quick jump mappings
// key: the key to press after 'd'
// value: the target directory path
const quickJumpMappings = {
    '1': os.homedir(),  // Home directory
    'd': path.join(os.homedir(), 'Downloads'),
    'e': path.join(os.homedir(), 'Desktop'),
    't': '/tmp'
    // Add more mappings as needed
}

module.exports = {
    quickJumpMappings
} 