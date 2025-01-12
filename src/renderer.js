const fs = require('fs')
const path = require('path')
const os = require('os')
const { shell, clipboard } = require('electron')
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

    moveMultipleItems(count) {
        const newIndex = this.selectedIndex + count
        this.selectedIndex = Math.max(0, Math.min(newIndex, this.files.length - 1))
        this.render()
    }

    enterSelected() {
        const selected = this.files[this.selectedIndex]
        if (selected && selected.isDirectory) {
            const newPath = path.join(this.currentPath, selected.name)
            this.loadDirectory(newPath)
        } else if (selected) {
            // Open file with system default application
            const filePath = path.join(this.currentPath, selected.name)
            shell.openPath(filePath).catch(err => {
                console.error('Error opening file:', err)
            })
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

    searchAndSelect(query) {
        if (!query) return;
        
        const lowerQuery = query.toLowerCase();
        const foundIndex = this.files.findIndex(file => 
            file.name.toLowerCase().includes(lowerQuery)
        );
        
        if (foundIndex !== -1) {
            this.selectedIndex = foundIndex;
            this.render();
        }
    }

    moveSelectedFile(targetPath) {
        const selected = this.files[this.selectedIndex];
        if (!selected) return;

        const sourcePath = path.join(this.currentPath, selected.name);
        const targetFilePath = path.join(targetPath, selected.name);

        try {
            // Check if target file exists
            if (fs.existsSync(targetFilePath)) {
                console.error('Target file already exists:', targetFilePath);
                return;
            }

            fs.renameSync(sourcePath, targetFilePath);
            
            // Refresh both current directory and target directory
            this.loadDirectory(this.currentPath);
            const inactivePane = this === leftPane ? rightPane : leftPane;
            inactivePane.loadDirectory(inactivePane.currentPath);
        } catch (error) {
            console.error('Error moving file:', error);
        }
    }

    showPreview() {
        const selected = this.files[this.selectedIndex];
        if (!selected || selected.isDirectory) {
            this.clearPreview();
            return;
        }

        const filePath = path.join(this.currentPath, selected.name);
        const ext = path.extname(selected.name).toLowerCase();
        
        if (supportedPreviewExtensions.includes(ext)) {
            const inactivePane = this === leftPane ? rightPane : leftPane;
            inactivePane.fileList.innerHTML = '';
            inactivePane.fileList.classList.add('preview-mode');
            const img = document.createElement('img');
            img.src = filePath;
            img.style.maxWidth = '100%';
            img.style.maxHeight = '100%';
            img.style.objectFit = 'contain';
            inactivePane.fileList.appendChild(img);
        } else {
            this.clearPreview();
        }
    }

    clearPreview() {
        const inactivePane = this === leftPane ? rightPane : leftPane;
        inactivePane.fileList.classList.remove('preview-mode');
        inactivePane.loadDirectory(inactivePane.currentPath);
    }

    copySelectedFile(targetPath) {
        const selected = this.files[this.selectedIndex];
        if (!selected) return;

        const sourcePath = path.join(this.currentPath, selected.name);
        const targetFilePath = path.join(targetPath, selected.name);

        try {
            // Check if target file exists
            if (fs.existsSync(targetFilePath)) {
                console.error('Target file already exists:', targetFilePath);
                return;
            }

            // Use copyFileSync for files and recursive copy for directories
            if (selected.isDirectory) {
                fs.cpSync(sourcePath, targetFilePath, { recursive: true });
            } else {
                fs.copyFileSync(sourcePath, targetFilePath);
            }
            
            // Refresh target directory
            const inactivePane = this === leftPane ? rightPane : leftPane;
            inactivePane.loadDirectory(inactivePane.currentPath);
            showNotification(`Copied: ${selected.name}`);
        } catch (error) {
            console.error('Error copying file:', error);
            showNotification(`Error copying file: ${error.message}`);
        }
    }
}

// Initialize both panes
const leftPane = new FilePane('leftFiles', 'leftPath')
const rightPane = new FilePane('rightFiles', 'rightPath')

// Track which pane is active
let activePane = leftPane
leftPane.isActive = true // Set initial active pane

// Add preview mode state
let isPreviewMode = false;
const supportedPreviewExtensions = ['.jpg', '.jpeg', '.png', '.gif'];

// Add these properties to track key sequences
let waitingForQuickJump = false
let waitingForG = false
let waitingForZ = false

// Add search mode handling
const searchBox = document.getElementById('searchBox');
const searchInput = document.getElementById('searchInput');
const notificationBox = document.getElementById('notificationBox');
const notificationText = document.getElementById('notificationText');
let isSearchMode = false;

function showNotification(text, duration = 2000) {
    notificationText.textContent = text;
    notificationBox.classList.remove('hidden');
    setTimeout(() => {
        notificationBox.classList.add('hidden');
    }, duration);
}

function enterSearchMode() {
    isSearchMode = true;
    searchBox.classList.remove('hidden');
    searchInput.value = '';
    searchInput.focus();
}

function exitSearchMode() {
    isSearchMode = false;
    searchBox.classList.add('hidden');
    searchInput.value = '';
}

// Handle keyboard events
document.addEventListener('keydown', (e) => {
    if (isSearchMode) {
        if (e.key === 'Escape') {
            exitSearchMode();
            return;
        }
        if (e.key === 'Enter') {
            exitSearchMode();
            return;
        }
        return;
    }

    if (e.key === '/' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        enterSearchMode();
        return;
    }

    // Handle quick jump sequence
    if (e.key === 'd' && !e.ctrlKey && !waitingForQuickJump) {
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

    if (e.key === 'q') {
        isPreviewMode = !isPreviewMode;
        if (isPreviewMode) {
            activePane.showPreview();
        } else {
            activePane.clearPreview();
        }
        return;
    }

    switch (e.key) {
        case 'Y':
            const selectedFile = activePane.files[activePane.selectedIndex];
            if (selectedFile) {
                const fullPath = path.join(activePane.currentPath, selectedFile.name);
                clipboard.writeText(fullPath);
                showNotification(fullPath);
            }
            break;
        case 'C':
            const inactivePaneForCopy = activePane === leftPane ? rightPane : leftPane;
            activePane.copySelectedFile(inactivePaneForCopy.currentPath);
            break;
        case 'R':
            const inactivePane = activePane === leftPane ? rightPane : leftPane;
            activePane.moveSelectedFile(inactivePane.currentPath);
            break;
        case 'G':
            activePane.jumpToBottom();
            break;
        case 'j':
            activePane.moveSelection(1)
            if (isPreviewMode) activePane.showPreview()
            break
        case 'k':
            activePane.moveSelection(-1)
            if (isPreviewMode) activePane.showPreview()
            break
        case 'u':
            if (e.ctrlKey) {
                e.preventDefault()
                activePane.moveMultipleItems(-10)
            }
            break
        case 'd':
            if (e.ctrlKey) {
                e.preventDefault()
                activePane.moveMultipleItems(10)
            } else if (!waitingForQuickJump) {
                waitingForQuickJump = true
            }
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

// Add search input handler
searchInput.addEventListener('input', (e) => {
    if (isSearchMode) {
        activePane.searchAndSelect(e.target.value);
    }
}); 