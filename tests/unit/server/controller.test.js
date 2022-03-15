import { jest, expect, describe, test, beforeEach } from '@jest/globals';
import config from '../../../server/config.js';
import { Controller } from '../../../server/controller/index.js';
import { Service } from '../../../server/service/index.js';

const {
    pages,
    location,
    constants: {
        CONTENT_TYPE
    }
} = config;

describe('#Controller', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
    });

    test('#getFileStream - should call service.getFileStream', async () => {
        jest.spyOn(Service.prototype, Service.prototype.getFileStream.name).mockReturnValue();

        const controller = new Controller();
        const filename = 'filename';
        
        await controller.getFileStream(filename);

        expect(Service.prototype.getFileStream).toHaveBeenCalledWith(filename);
    });
});