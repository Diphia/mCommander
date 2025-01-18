const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { FilePane } = require('../src/renderer');

describe('FilePane', () => {
    let testDir;
    let filePane;
    
    beforeEach(() => {
        // Create a temporary test directory
        testDir = path.join(os.tmpdir(), 'filePane-test-' + Math.random().toString(36).substr(2));
        fs.mkdirSync(testDir);
        
        filePane = new FilePane('leftFiles', 'leftPath');
    });
    
    afterEach(() => {
        // Clean up test directory
        if (fs.existsSync(testDir)) {
            try {
                // First try to make the directory writable
                const cleanupDir = (dirPath) => {
                    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
                    entries.forEach(entry => {
                        const fullPath = path.join(dirPath, entry.name);
                        if (entry.isDirectory()) {
                            try {
                                fs.chmodSync(fullPath, 0o777);
                                cleanupDir(fullPath);
                                fs.rmdirSync(fullPath);
                            } catch (err) {
                                console.warn(`Warning: Could not remove directory ${fullPath}: ${err.message}`);
                            }
                        } else {
                            try {
                                fs.unlinkSync(fullPath);
                            } catch (err) {
                                console.warn(`Warning: Could not remove file ${fullPath}: ${err.message}`);
                            }
                        }
                    });
                };

                cleanupDir(testDir);
                fs.rmdirSync(testDir);
            } catch (err) {
                console.warn(`Warning: Could not fully clean up test directory ${testDir}: ${err.message}`);
            }
        }
    });
    
    describe('loadDirectory', () => {
        it('should load directory contents correctly', () => {
            // Create test files
            fs.writeFileSync(path.join(testDir, 'test1.txt'), 'test1');
            fs.writeFileSync(path.join(testDir, 'test2.txt'), 'test2');
            fs.mkdirSync(path.join(testDir, 'testDir'));
            
            filePane.loadDirectory(testDir);
            
            expect(filePane.files).to.have.lengthOf(3);
            expect(filePane.files.map(f => f.name)).to.include('test1.txt');
            expect(filePane.files.map(f => f.name)).to.include('test2.txt');
            expect(filePane.files.map(f => f.name)).to.include('testDir');
            expect(filePane.currentPath).to.equal(testDir);
        });
        
        it('should handle inaccessible directories gracefully', () => {
            const inaccessibleDir = path.join(testDir, 'inaccessible');
            fs.mkdirSync(inaccessibleDir, { mode: 0 });
            
            filePane.loadDirectory(inaccessibleDir);
            
            expect(filePane.currentPath).to.not.equal(inaccessibleDir);
        });
    });
    
    describe('sortFiles', () => {
        beforeEach(() => {
            // Create test files with different sizes and dates
            fs.writeFileSync(path.join(testDir, 'large.txt'), Buffer.alloc(1000));
            fs.writeFileSync(path.join(testDir, 'small.txt'), Buffer.alloc(100));
            fs.mkdirSync(path.join(testDir, 'dir1'));
            filePane.loadDirectory(testDir);
        });
        
        it('should sort by size correctly', () => {
            filePane.sortFiles('s');
            expect(filePane.files[0].isDirectory).to.be.true;  // Directories first
            expect(filePane.files[1].name).to.equal('large.txt');
            expect(filePane.files[2].name).to.equal('small.txt');
        });
        
        it('should sort by name correctly', () => {
            filePane.sortFiles('n');
            expect(filePane.files[0].isDirectory).to.be.true;  // Directories first
            expect(filePane.files[1].name).to.equal('large.txt');
            expect(filePane.files[2].name).to.equal('small.txt');
        });
    });
    
    describe('formatFileSize', () => {
        it('should format file sizes correctly', () => {
            expect(filePane.formatFileSize(500)).to.equal('500.0 B');
            expect(filePane.formatFileSize(1024)).to.equal('1.0 KB');
            expect(filePane.formatFileSize(1024 * 1024)).to.equal('1.0 MB');
            expect(filePane.formatFileSize(1024 * 1024 * 1024)).to.equal('1.0 GB');
        });
    });
    
    describe('navigation', () => {
        beforeEach(() => {
            fs.mkdirSync(path.join(testDir, 'subdir'));
            fs.writeFileSync(path.join(testDir, 'subdir', 'test.txt'), 'test');
            filePane.loadDirectory(testDir);
        });
        
        it('should navigate into subdirectories', () => {
            filePane.selectedIndex = filePane.files.findIndex(f => f.name === 'subdir');
            filePane.enterSelected();
            expect(filePane.currentPath).to.equal(path.join(testDir, 'subdir'));
        });
        
        it('should navigate up correctly', () => {
            filePane.loadDirectory(path.join(testDir, 'subdir'));
            filePane.navigateUp();
            expect(filePane.currentPath).to.equal(testDir);
        });
    });
}); 