import {jest} from "@jest/globals";
import {setupServer} from "../../src/server.js";
import paymentController from '../../src/api/payment/payment.controller.js'

const request = require('supertest');

jest.mock('../../src/api/payment/payment.controller.js');

describe('Uint::Server::', () => {
    const server = setupServer();

    beforeEach(() => {
        server.listen(3001, 'localhost')
    })

    afterEach(() => {
        server.close();
    });

    test('500 error', () => {
        paymentController.processRequest.mockImplementation(jest.fn(() => {
            throw new Error()
        }));

        return request(server)
            .post('/')
            .send({test: 'test'})
            .expect(500)
    })

    test('404 error', () => {
        paymentController.processRequest.mockImplementation(jest.fn(() => {
            throw new Error()
        }));

        return request(server)
            .post('/wrong')
            .send({test: 'test'})
            .expect(404)
    })
})