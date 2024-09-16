import {jest, expect} from "@jest/globals";

import {callPowerboard} from '../../../../src/handler/notification/powerboard-api-service.js';

import fetch from 'node-fetch';
import config from '../../../../src/config/config.js';
import {serializeError} from 'serialize-error';

jest.mock('node-fetch', () => jest.fn());
jest.mock('../../../../src/config/config.js');
jest.mock('serialize-error');

jest.mock('../../../../src/config/config-loader.js', () => {
    const originalModule = jest.requireActual('../../../../src/config/config-loader.js');
    const loaderConfigResult = jest.requireActual('../../../../test-data/notificationConfig.json')

    return {
        __esModule: true,
        ...originalModule,
        loadConfig: jest.fn(() => loaderConfigResult),
    };
});

describe('callPowerboard', () => {
    let url, data, method;

    beforeEach(() => {
        url = '/test-url';
        data = {key: 'value'};
        method = 'POST';
        config.getPowerboardApiUrl.mockResolvedValue('https://api.powerboard.com/');
        config.getPowerboardConfig.mockResolvedValue({
            credentials_secret_key: 'test_secret_key'
        });
    });

    test('should successfully call Powerboard API and return response and request', async () => {
        const mockFetchResponse = {
            ok: true,
            text: jest.fn().mockResolvedValueOnce(JSON.stringify({key: 'response'})),
        };
        fetch.mockResolvedValueOnce(mockFetchResponse);
        const result = await callPowerboard(url, data, method);
        expect(result.request.headers).toEqual( {
            'Content-Type': 'application/json',
            'x-user-secret-key': 'test_secret_key'
        });
    });
});