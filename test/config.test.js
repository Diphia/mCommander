const { expect } = require('chai');
const os = require('os');
const path = require('path');
const { quickJumpMappings } = require('../src/config');

describe('Config', () => {
    describe('quickJumpMappings', () => {
        it('should have correct default mappings', () => {
            expect(quickJumpMappings).to.have.property('1', os.homedir());
            expect(quickJumpMappings).to.have.property('d', path.join(os.homedir(), 'Downloads'));
            expect(quickJumpMappings).to.have.property('e', path.join(os.homedir(), 'Desktop'));
            expect(quickJumpMappings).to.have.property('t', path.join(os.homedir(), 'temp'));
            expect(quickJumpMappings).to.have.property('v', '/Volumes');
        });

        it('should have valid paths', () => {
            Object.values(quickJumpMappings).forEach(path => {
                expect(path).to.be.a('string');
                expect(path.length).to.be.greaterThan(0);
            });
        });
    });
}); 