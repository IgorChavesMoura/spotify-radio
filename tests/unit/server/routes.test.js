import { jest, expect, describe, test, beforeEach } from '@jest/globals';
import { handler } from '../../../server/routes/index.js'; 
import TestUtil from '../util/testUtil.js';
import config from '../../../server/config.js';
import { Controller } from '../../../server/controller/index.js';

const {
    pages,
    location,
    constants: {
        CONTENT_TYPE
    }
} = config;

describe('#Routes', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
    });
    
    test('GET / - should redirect to home page', async () => {
        const params = TestUtil.defaultHandleParams();
        params.request.method = 'GET';
        params.request.url = '/';

        await handler(...params.values());

        expect(params.response.writeHead).toHaveBeenCalledWith(302, {
            'Location': location.home
        })
        expect(params.response.end).toHaveBeenCalled();
    });
    test('GET /home - should response with home/index.html file stream', async () => {
        const params = TestUtil.defaultHandleParams();
        params.request.method = 'GET';
        params.request.url = '/home';

        const mockFileStream = TestUtil.generateReadableStream(['data']);

        jest.spyOn(Controller.prototype, Controller.prototype.getFileStream.name).mockResolvedValue({
            stream: mockFileStream,
            type: ''
        });
        jest.spyOn(mockFileStream, "pipe").mockReturnValue();

        await handler(...params.values());

        expect(Controller.prototype.getFileStream).toHaveBeenCalledWith(pages.homeHTML);
        expect(mockFileStream.pipe).toHaveBeenCalledWith(params.response);
    });
    test('GET /controller - should response with controller/index.html file stream', async () => {
        const params = TestUtil.defaultHandleParams();
        params.request.method = 'GET';
        params.request.url = '/controller';

        const mockFileStream = TestUtil.generateReadableStream(['data']);

        jest.spyOn(Controller.prototype, Controller.prototype.getFileStream.name).mockResolvedValue({
            stream: mockFileStream,
            type: ''
        });
        jest.spyOn(mockFileStream, "pipe").mockReturnValue();

        await handler(...params.values());

        expect(Controller.prototype.getFileStream).toHaveBeenCalledWith(pages.controllerHTML);
        expect(mockFileStream.pipe).toHaveBeenCalledWith(params.response);
    });
    test('GET /<filename with extension> - should response with <filename> file stream', async () => {
        const filename = '/index.html'
        const params = TestUtil.defaultHandleParams();
        params.request.method = 'GET';
        params.request.url = filename;

        const expectedType = '.html';
        const mockFileStream = TestUtil.generateReadableStream(['data']);

        jest.spyOn(Controller.prototype, Controller.prototype.getFileStream.name).mockResolvedValue({
            stream: mockFileStream,
            type: expectedType
        });
        jest.spyOn(mockFileStream, "pipe").mockReturnValue();

        await handler(...params.values());

        expect(Controller.prototype.getFileStream).toHaveBeenCalledWith(filename);
        expect(mockFileStream.pipe).toHaveBeenCalledWith(params.response);
        expect(params.response.writeHead).toHaveBeenCalledWith(
            200,
            {
                'Content-Type': CONTENT_TYPE[expectedType]
            }
        )
    });
    test('GET /<filename without extension> - should response with <filename> file stream', async () => {
        const filename = '/file.ext'
        const params = TestUtil.defaultHandleParams();
        params.request.method = 'GET';
        params.request.url = filename;

        const expectedType = '.ext';
        const mockFileStream = TestUtil.generateReadableStream(['data']);

        jest.spyOn(Controller.prototype, Controller.prototype.getFileStream.name).mockResolvedValue({
            stream: mockFileStream,
            type: expectedType
        });
        jest.spyOn(mockFileStream, "pipe").mockReturnValue();

        await handler(...params.values());

        expect(Controller.prototype.getFileStream).toHaveBeenCalledWith(filename);
        expect(mockFileStream.pipe).toHaveBeenCalledWith(params.response);
        expect(params.response.writeHead).not.toHaveBeenCalled();
    });
    test('GET /unknown - given an inexistent route it should response with 404', async () => {
        const params = TestUtil.defaultHandleParams();
        params.request.method = 'POST';
        params.request.url = '/unknown';

        await handler(...params.values());

        expect(params.response.writeHead).toHaveBeenCalledWith(404);
        expect(params.response.end).toHaveBeenCalled();
    });

    describe('exceptions', () => {
        test('given an inexistent file it should response with 404', async () => {
            const params = TestUtil.defaultHandleParams();
            params.request.method = 'GET';
            params.request.url = '/index.png';

            jest.spyOn(
                Controller.prototype,
                Controller.prototype.getFileStream.name
            ).mockRejectedValue(new Error('Error: ENOENT: no such file or directory'));
    
            await handler(...params.values());
    
            expect(params.response.writeHead).toHaveBeenCalledWith(404);
            expect(params.response.end).toHaveBeenCalled();
        });
        test('given an error it should response with 500', async () => {
            const params = TestUtil.defaultHandleParams();
            params.request.method = 'GET';
            params.request.url = '/index.png';

            jest.spyOn(
                Controller.prototype,
                Controller.prototype.getFileStream.name
            ).mockRejectedValue(new Error('Error'));
    
            await handler(...params.values());
    
            expect(params.response.writeHead).toHaveBeenCalledWith(500);
            expect(params.response.end).toHaveBeenCalled();
        });

    });
})