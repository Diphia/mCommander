const fs = require('fs')
const path = require('path')
const os = require('os')
const { quickJumpMappings } = require('./config')

class FilePane {
    constructor(fileListId, pathDisplayId) {
        this.fileList = document.getElementById(fileListId)
        this.pathDisplay = document.getElementById(pathDisplayId)
        this.currentPath = os.homedir()
        this.selectedIndex = 0
        this.files = []
        this.isActive = false
        
        this.loadDirectory(this.currentPath)
    }

    loadDirectory(dirPath) {
        try {
            this.files = fs.readdirSync(dirPath)
                .map(file => ({
                    name: file,
                    isDirectory: fs.statSync(path.join(dirPath, file)).isDirectory()
                }))
                .sort((a, b) => {
                    if (a.isDirectory === b.isDirectory) {
                        return a.name.localeCompare(b.name)
                    }
                    return b.isDirectory - a.isDirectory
                })

            this.currentPath = dirPath
            this.selectedIndex = 0
            this.render()
        } catch (error) {
            console.error('Error loading directory:', error)
        }
    }

    render() {
        this.pathDisplay.textContent = this.currentPath
        this.fileList.innerHTML = ''

        this.files.forEach((file, index) => {
            const item = document.createElement('div')
            const isSelected = index === this.selectedIndex
            let className = 'file-item'
            if (isSelected) {
                className += this.isActive ? ' selected' : ' selected-inactive'
            }
            item.className = className
            const icon = document.createElement('i')
            icon.className = file.isDirectory ? 'fas fa-folder' : 'fas fa-file'
            const nameSpan = document.createElement('span')
            nameSpan.textContent = file.name
            item.appendChild(icon)
            item.appendChild(nameSpan)
            this.fileList.appendChild(item)
            
            // If this is the selected item, scroll it into view
            if (index === this.selectedIndex) {
                setTimeout(() => item.scrollIntoView({ block: 'nearest' }), 0)
            }
        })
    }

    moveSelection(direction) {
        const newIndex = this.selectedIndex + direction
        if (newIndex >= 0 && newIndex < this.files.length) {
            this.selectedIndex = newIndex
            this.render()
        }
    }

    enterSelected() {
        const selected = this.files[this.selectedIndex]
        if (selected && selected.isDirectory) {
            const newPath = path.join(this.currentPath, selected.name)
            this.loadDirectory(newPath)
        }
    }

    navigateUp() {
        const parentPath = path.dirname(this.currentPath)
        const currentDirName = path.basename(this.currentPath)
        this.loadDirectory(parentPath)
        // Find and select the directory we came from
        const dirIndex = this.files.findIndex(file => file.name === currentDirName)
        if (dirIndex !== -1) {
            this.selectedIndex = dirIndex
            this.render()
        }
    }

    jumpToTop() {
        this.selectedIndex = 0
        this.render()
    }

    jumpToBottom() {
        this.selectedIndex = this.files.length - 1
        this.render()
    }

    centerCurrentFile() {
        const selectedItem = this.fileList.children[this.selectedIndex]
        if (selectedItem) {
            selectedItem.scrollIntoView({ block: 'center' })
        }
    }
}

// Initialize both panes
const leftPane = new FilePane('leftFiles', 'leftPath')
const rightPane = new FilePane('rightFiles', 'rightPath')

// Track which pane is active
let activePane = leftPane
leftPane.isActive = true // Set initial active pane

// Add these properties to track key sequences
let waitingForQuickJump = false
let waitingForG = false
let waitingForZ = false

// Handle keyboard events
document.addEventListener('keydown', (e) => {
    // Handle quick jump sequence
    if (e.key === 'd' && !waitingForQuickJump) {
        waitingForQuickJump = true
        return
    }

    if (waitingForQuickJump) {
        waitingForQuickJump = false
        const targetPath = quickJumpMappings[e.key]
        if (targetPath) {
            activePane.loadDirectory(targetPath)
            return
        }
    }

    // Handle 'gg' sequence
    if (e.key === 'g' && !waitingForG) {
        waitingForG = true
        return
    }

    if (waitingForG) {
        waitingForG = false
        if (e.key === 'g') {
            activePane.jumpToTop()
            return
        }
    }

    // Handle 'zz' sequence
    if (e.key === 'z' && !waitingForZ) {
        waitingForZ = true
        return
    }

    if (waitingForZ) {
        waitingForZ = false
        if (e.key === 'z') {
            activePane.centerCurrentFile()
            return
        }
    }

    switch (e.key) {
        case 'G':
            activePane.jumpToBottom()
            break
        case 'j':
            activePane.moveSelection(1)
            break
        case 'k':
            activePane.moveSelection(-1)
            break
        case 'Enter':
            activePane.enterSelected()
            break
        case '-':
            activePane.navigateUp()
            break
        case 'Tab':
            // Switch active pane
            e.preventDefault()
            activePane.isActive = false
            activePane.render()
            activePane = activePane === leftPane ? rightPane : leftPane
            activePane.isActive = true
            activePane.render()
            break
    }
}) 