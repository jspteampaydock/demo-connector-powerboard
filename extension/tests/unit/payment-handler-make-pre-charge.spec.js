import {expect, test} from '@jest/globals';
import fetch from 'node-fetch';
import config from "../../src/config/config.js";
import {setupServer} from "../../src/server.js";
import {getAuthorizationRequestHeader, hasValidAuthorizationHeader} from "../../src/validator/authentication.js";

const request = require('supertest');

const paymentExtensionRequest = require('../../test-data/paymentHandler/create-precharge.json');
const preChargeRequest = require('../../test-data/paymentHandler/get-payment-methods.handler.request.json');
const moduleConfigData = require('../../test-data/moduleConfig.json');
const configData = require('../../test-data/config.json');
const preChargeRequestData = require('../../test-data/paymentHandler/create-precharge.json');

const {Response} = jest.requireActual('node-fetch');

jest.mock('../../src/validator/authentication.js');
jest.mock('node-fetch');
jest.mock('../../src/config/config.js');

configData.sandbox_mode = "Yes";

config.getModuleConfig.mockResolvedValue(moduleConfigData);
config.getCtpClient.mockResolvedValue({create: jest.fn(), builder: {customObjects: {}}});
config.getPowerboardConfig.mockResolvedValue(configData.sandbox)

getAuthorizationRequestHeader.mockResolvedValue('test-authorisation');
hasValidAuthorizationHeader.mockResolvedValue(true);
fetch.mockReturnValue(
    Promise.resolve(
        new Response(JSON.stringify({
            status: 201,
            resource: {
                data: {
                    status: "Success",
                    token: "some.awesome.jwt",
                    charge: {_id: "0123456789abcedf0123456789"}
                }
            }
        }))
    )
);

describe('Integration::PaymentHandler::makePreCharge::', () => {
    const server = setupServer();

    beforeEach(async () => {
        server.listen(3001, 'localhost')
    })

    afterEach(async () => {
        if (preChargeRequestData.hasOwnProperty('wallet_type')) {
            delete preChargeRequestData.wallet_type
        }
        if (preChargeRequestData.hasOwnProperty('success_url')) {
            delete preChargeRequestData.success_url
        }
        if (preChargeRequestData.hasOwnProperty('error_url')) {
            delete preChargeRequestData.error_url
        }
        if (preChargeRequestData.hasOwnProperty('pay_later')) {
            delete preChargeRequestData.pay_later
        }
        if (preChargeRequestData.hasOwnProperty('fraud')) {
            delete preChargeRequestData.fraud
        }

        server.close();
    })

    test('make pre charge', () => {
        preChargeRequest.resource.obj.custom.fields.PaymentExtensionRequest = JSON.stringify({
                action: "makePreChargeResponse",
                request: {
                    data: paymentExtensionRequest,
                    capture: true,
                }
            }
        );

        return request(server)
            .post('/')
            .send(preChargeRequest)
            .expect(200)
            .then((response) => {
                expect(response).toHaveProperty('text');

                const data = JSON.parse(response.text);

                expect(data).toHaveProperty('actions.0.action', 'setCustomField')
                expect(data).toHaveProperty('actions.0.name', 'PaymentExtensionResponse')
                expect(data).toHaveProperty('actions.0.value', JSON.stringify({
                    status: "Success",
                    token: "some.awesome.jwt",
                    chargeId: "0123456789abcedf0123456789"
                }))
            })
    })
})
