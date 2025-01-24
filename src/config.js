const os = require('os')
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')

// Common paths where ffmpeg/ffprobe might be installed
const commonPaths = {
    darwin: [
        '/opt/homebrew/bin',
        '/usr/local/bin',
        '/usr/bin'
    ],
    linux: [
        '/usr/bin',
        '/usr/local/bin',
        '/opt/local/bin'
    ],
    win32: [
        'C:\\Program Files\\ffmpeg\\bin',
        'C:\\ffmpeg\\bin'
    ]
}

// Cache for found binary paths
let ffmpegPath = null
let ffprobePath = null

function findBinary(binaryName) {
    // If already found, return from cache
    if (binaryName === 'ffmpeg' && ffmpegPath) return ffmpegPath
    if (binaryName === 'ffprobe' && ffprobePath) return ffprobePath

    // Try to find in PATH first
    try {
        const command = process.platform === 'win32' ? 'where' : 'which'
        const binaryPath = execSync(`${command} ${binaryName}`).toString().trim()
        if (fs.existsSync(binaryPath)) {
            return binaryPath
        }
    } catch (error) {
        // Binary not found in PATH, continue with common paths
    }

    // Check common paths based on OS
    const platform = process.platform
    const paths = commonPaths[platform] || []
    const ext = platform === 'win32' ? '.exe' : ''

    for (const basePath of paths) {
        const fullPath = path.join(basePath, `${binaryName}${ext}`)
        if (fs.existsSync(fullPath)) {
            return fullPath
        }
    }

    throw new Error(`${binaryName} not found in system. Please install it first.`)
}

function getFfmpegPath() {
    if (!ffmpegPath) {
        ffmpegPath = findBinary('ffmpeg')
    }
    return ffmpegPath
}

function getFfprobePath() {
    if (!ffprobePath) {
        ffprobePath = findBinary('ffprobe')
    }
    return ffprobePath
}

// Quick jump mappings
// key: the key to press after 'd'
// value: the target directory path
const quickJumpMappings = {
    '1': os.homedir(),  // Home directory
    'd': path.join(os.homedir(), 'Downloads'),
    'e': path.join(os.homedir(), 'Desktop'),
    't': path.join(os.homedir(), 'temp'),
    'v': '/Volumes'
}

module.exports = {
    quickJumpMappings,
    getFfmpegPath,
    getFfprobePath
} 