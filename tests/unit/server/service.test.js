import { jest, expect, describe, test, beforeEach } from '@jest/globals';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path, { join } from 'path';
import config from '../../../server/config.js';
import { Service } from '../../../server/service/index.js';

const {
    dir: {
        publicDir
    }
} = config;

describe('#Service', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
    });

    test('#createFileStream - should create file stream', async () => {
        jest.spyOn(fs, fs.createReadStream.name).mockReturnValue();

        const filename = 'filename';
        const service = new Service();
        service.createFileStream(filename);


        expect(fs.createReadStream).toHaveBeenCalledWith(filename);
    });
    test('#getFileInfo - should return file info', async () => {
        jest.spyOn(fsPromises, fsPromises.access.name).mockResolvedValue();
        const filename = 'filename.ext';
        const expectedFileType = '.ext';

        const expectedFullFilePath = join(publicDir, filename);
        const expected = {
            type: expectedFileType,
            name: expectedFullFilePath
        };
        const service = new Service();
        const result = await service.getFileInfo(filename);

        expect(fsPromises.access).toHaveBeenCalledWith(expectedFullFilePath);
        expect(result).toEqual(expected);

    });
    test('#getFileStream - should return file stream', async () => {
        const filename = 'filename';
        const filetype = '.ext';
        const expectedStreamValue = 'some stream';

        jest.spyOn(Service.prototype, Service.prototype.createFileStream.name).mockReturnValue(expectedStreamValue);
        jest.spyOn(Service.prototype, Service.prototype.getFileInfo.name).mockResolvedValue({ name: filename, type: filetype });

        const expected = { stream: expectedStreamValue, type: filetype };
        const service = new Service();
        const result = await service.getFileStream(filename);

        expect(Service.prototype.createFileStream).toHaveBeenCalledWith(filename);
        expect(Service.prototype.getFileInfo).toHaveBeenCalledWith(filename);
        expect(result).toEqual(expected);
        
    });
});