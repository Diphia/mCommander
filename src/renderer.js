const fs = require('fs')
const path = require('path')
const os = require('os')

class FilePane {
    constructor(fileListId, pathDisplayId) {
        this.fileList = document.getElementById(fileListId)
        this.pathDisplay = document.getElementById(pathDisplayId)
        this.currentPath = os.homedir()
        this.selectedIndex = 0
        this.files = []
        
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
            item.className = `file-item ${index === this.selectedIndex ? 'selected' : ''}`
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
        this.loadDirectory(parentPath)
    }
}

// Initialize both panes
const leftPane = new FilePane('leftFiles', 'leftPath')
const rightPane = new FilePane('rightFiles', 'rightPath')

// Track which pane is active
let activePane = leftPane

// Handle keyboard events
document.addEventListener('keydown', (e) => {
    switch (e.key) {
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
            activePane = activePane === leftPane ? rightPane : leftPane
            break
    }
}) 