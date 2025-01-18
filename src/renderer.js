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
        this.isSortMode = false
        this.sortTimeout = null
        this.showDetails = false
        
        this.loadDirectory(this.currentPath)
    }

    loadDirectory(dirPath, preserveSelection = false) {
        const currentSelectedFile = preserveSelection ? this.files[this.selectedIndex]?.name : null;
        try {
            const entries = fs.readdirSync(dirPath);
            this.files = entries
                .map(file => {
                    try {
                        const fullPath = path.join(dirPath, file);
                        const stats = fs.statSync(fullPath);
                        return {
                            name: file,
                            isDirectory: stats.isDirectory(),
                            size: stats.size,
                            mtime: stats.mtime,
                            extension: path.extname(file).toLowerCase()
                        };
                    } catch (error) {
                        console.log(`Skipping inaccessible file: ${file}`);
                        return null;
                    }
                })
                .filter(file => file !== null)
                .sort((a, b) => {
                    if (a.isDirectory === b.isDirectory) {
                        return a.name.localeCompare(b.name);
                    }
                    return b.isDirectory - a.isDirectory;
                });

            this.currentPath = dirPath;
            
            // Restore selection if the file still exists
            if (preserveSelection && currentSelectedFile) {
                const newIndex = this.files.findIndex(file => file.name === currentSelectedFile);
                this.selectedIndex = newIndex !== -1 ? newIndex : 0;
            } else {
                this.selectedIndex = 0;
            }
            
            this.render();
        } catch (error) {
            console.error('Error loading directory:', error);
            showNotification(`Cannot access directory: ${error.message}`);
            
            if (this.currentPath !== dirPath) {
                this.loadDirectory(this.currentPath);
            }
        }
    }

    sortFiles(sortType) {
        const currentFile = this.files[this.selectedIndex]?.name;
        
        switch (sortType) {
            case 'm': // Modified time
                this.files.sort((a, b) => {
                    if (a.isDirectory === b.isDirectory) {
                        return b.mtime - a.mtime;
                    }
                    return b.isDirectory - a.isDirectory;
                });
                break;
            case 's': // Size
                this.files.sort((a, b) => {
                    if (a.isDirectory === b.isDirectory) {
                        return b.size - a.size;
                    }
                    return b.isDirectory - a.isDirectory;
                });
                break;
            case 'n': // Name
                this.files.sort((a, b) => {
                    if (a.isDirectory === b.isDirectory) {
                        return a.name.localeCompare(b.name);
                    }
                    return b.isDirectory - a.isDirectory;
                });
                break;
            case 'e': // Extension
                this.files.sort((a, b) => {
                    if (a.isDirectory === b.isDirectory) {
                        return a.extension.localeCompare(b.extension) || a.name.localeCompare(b.name);
                    }
                    return b.isDirectory - a.isDirectory;
                });
                break;
        }

        // Try to maintain selection on the same file after sorting
        if (currentFile) {
            const newIndex = this.files.findIndex(file => file.name === currentFile);
            if (newIndex !== -1) {
                this.selectedIndex = newIndex;
            }
        }
        
        this.render();
        this.exitSortMode();
    }

    enterSortMode() {
        this.isSortMode = true;
        showNotification('Sort mode: [m]time [s]ize [n]ame [e]xtension');
        
        // Exit sort mode after 2 seconds if no key is pressed
        if (this.sortTimeout) {
            clearTimeout(this.sortTimeout);
        }
        this.sortTimeout = setTimeout(() => this.exitSortMode(), 2000);
    }

    exitSortMode() {
        this.isSortMode = false;
        if (this.sortTimeout) {
            clearTimeout(this.sortTimeout);
            this.sortTimeout = null;
        }
    }

    formatFileSize(size) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    formatDate(date) {
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).replace(',', '');
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

            // Icon and name
            const icon = document.createElement('i')
            icon.className = file.isDirectory ? 'fas fa-folder' : 'fas fa-file'
            const nameSpan = document.createElement('span')
            nameSpan.textContent = file.name
            nameSpan.className = 'file-name'
            item.appendChild(icon)
            item.appendChild(nameSpan)

            // Add details if enabled
            if (this.showDetails) {
                const sizeSpan = document.createElement('span')
                sizeSpan.className = 'file-size'
                sizeSpan.textContent = file.isDirectory ? '<DIR>' : this.formatFileSize(file.size)
                
                const dateSpan = document.createElement('span')
                dateSpan.className = 'file-date'
                dateSpan.textContent = this.formatDate(file.mtime)

                item.appendChild(sizeSpan)
                item.appendChild(dateSpan)
            }

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

    async moveSelectedFile(targetPath) {
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

            showProgress('Moving');

            // For move operations, first copy with progress then delete source
            if (selected.isDirectory) {
                await new Promise((resolve, reject) => {
                    try {
                        copyDirWithProgress(sourcePath, targetFilePath, updateProgress);
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                });
                fs.rmSync(sourcePath, { recursive: true });
            } else {
                await copyFileWithProgress(sourcePath, targetFilePath, updateProgress);
                fs.unlinkSync(sourcePath);
            }
            
            hideProgress();
            
            // Refresh both directories
            this.loadDirectory(this.currentPath);
            const inactivePane = this === leftPane ? rightPane : leftPane;
            inactivePane.loadDirectory(inactivePane.currentPath);
        } catch (error) {
            hideProgress();
            console.error('Error moving file:', error);
            showNotification(`Error moving file: ${error.message}`);
        }
    }

    async copySelectedFile(targetPath) {
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

            showProgress('Copying');

            // Use different copy methods based on file type
            if (selected.isDirectory) {
                await new Promise((resolve, reject) => {
                    try {
                        copyDirWithProgress(sourcePath, targetFilePath, updateProgress);
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                });
            } else {
                await copyFileWithProgress(sourcePath, targetFilePath, updateProgress);
            }
            
            hideProgress();
            
            // Refresh target directory
            const inactivePane = this === leftPane ? rightPane : leftPane;
            inactivePane.loadDirectory(inactivePane.currentPath);
            showNotification(`Copied: ${selected.name}`);
        } catch (error) {
            hideProgress();
            console.error('Error copying file:', error);
            showNotification(`Error copying file: ${error.message}`);
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
        const inactivePane = this === leftPane ? rightPane : leftPane;
        
        inactivePane.fileList.innerHTML = '';
        inactivePane.fileList.classList.add('preview-mode');
        
        if (supportedPreviewExtensions.includes(ext)) {
            const img = document.createElement('img');
            img.src = filePath;
            img.style.maxWidth = '100%';
            img.style.maxHeight = '100%';
            img.style.objectFit = 'contain';
            inactivePane.fileList.appendChild(img);
        } else {
            const message = document.createElement('div');
            message.textContent = 'File type not supported for preview';
            message.style.color = '#fff';
            message.style.fontSize = '16px';
            inactivePane.fileList.appendChild(message);
        }
    }

    clearPreview() {
        const inactivePane = this === leftPane ? rightPane : leftPane;
        inactivePane.fileList.classList.remove('preview-mode');
        inactivePane.loadDirectory(inactivePane.currentPath);
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

// Progress bar elements
const progressBox = document.getElementById('progressBox');
const progressBar = document.getElementById('progressBar');
const progressLabel = progressBox.querySelector('.progress-label');

function showProgress(operation) {
    progressLabel.textContent = `${operation}...`;
    progressBox.classLimove('hidden');
    progressBar.style.width = '0%';
}

function updateProgress(percent) {
    progressBar.style.width = `${percent}%`;
}

function hideProgress() {
    progressBox.classList.add('hidden');
}

function getFileSize(filePath) {
    try {
        const stats = fs.statSync(filePath);
        return stats.size;
    } catch (error) {
        console.error('Error getting file size:', error);
        return 0;
    }
}

function copyFileWithProgress(sourcePath, targetPath, onProgress) {
    return new Promise((resolve, reject) => {
        const sourceSize = getFileSize(sourcePath);
        const readStream = fs.createReadStream(sourcePath);
        const writeStream = fs.createWriteStream(targetPath);
        let bytesRead = 0;

        readStream.on('data', (chunk) => {
            bytesRead += chunk.length;
            const progress = (bytesRead / sourceSize) * 100;
            onProgress(Math.min(progress, 100));
        });

        readStream.on('error', reject);
        writeStream.on('error', reject);
        writeStream.on('finish', resolve);

        readStream.pipe(writeStream);
    });
}

function copyDirWithProgress(sourcePath, targetPath, onProgress) {
    try {
        // Create target directory
        fs.mkdirSync(targetPath, { recursive: true });
        
        // Get all items in the directory
        const items = fs.readdirSync(sourcePath);
        let processedItems = 0;
        
        // Process each item
        for (const item of items) {
            const srcPath = path.join(sourcePath, item);
            const tgtPath = path.join(targetPath, item);
            
            if (fs.statSync(srcPath).isDirectory()) {
                copyDirWithProgress(srcPath, tgtPath, (subProgress) => {
                    // Weight the progress of subdirectories
                    const itemProgress = (processedItems / items.length) * 100;
                    const weightedSubProgress = (subProgress / items.length);
                    onProgress(itemProgress + weightedSubProgress);
                });
            } else {
                fs.copyFileSync(srcPath, tgtPath);
            }
            
            processedItems++;
            onProgress((processedItems / items.length) * 100);
        }
    } catch (error) {
        throw error;
    }
}

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

    // Handle sort mode
    if (activePane.isSortMode) {
        switch (e.key.toLowerCase()) {
            case 'm':
            case 's':
            case 'n':
            case 'e':
                activePane.sortFiles(e.key.toLowerCase());
                return;
            case 'Escape':
                activePane.exitSortMode();
                return;
        }
        return;
    }

    if (e.key === 's' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        activePane.enterSortMode();
        return;
    }

    if (e.key === '/' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        enterSearchMode();
        return;
    }

    // Handle quick jump sequence
    if (e.key === 'd' && !e.ctrlKey && !waitingForQuickJump) {
        waitingForQuickJump = true;
        console.log('Waiting for quick jump key...');
        return;
    }

    if (waitingForQuickJump) {
        waitingForQuickJump = false;
        console.log('Quick jump key pressed:', e.key);
        const targetPath = quickJumpMappings[e.key];
        if (targetPath) {
            console.log('Jumping to:', targetPath);
            try {
                // Check if directory exists and is accessible
                fs.accessSync(targetPath, fs.constants.R_OK);
                activePane.loadDirectory(targetPath);
            } catch (error) {
                console.error('Error accessing directory:', error);
                showNotification(`Cannot access ${targetPath}: ${error.message}`);
            }
        } else {
            console.log('No mapping found for key:', e.key);
        }
        return;
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
        if (e.key === 'r') {
            activePane.loadDirectory(activePane.currentPath, true)
            showNotification('Directory refreshed')
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
        case '(':
            activePane.showDetails = !activePane.showDetails;
            activePane.render();
            break;
    }
}) 

// Add search input handler
searchInput.addEventListener('input', (e) => {
    if (isSearchMode) {
        activePane.searchAndSelect(e.target.value);
    }
}); 