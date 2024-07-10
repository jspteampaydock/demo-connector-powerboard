import {expect, test} from '@jest/globals';
import config from '../../src/config/config.js'
import {setupServer} from "../../src/server.js";

describe('::getPaymentMethods::', () => {
    const server = setupServer();
    const moduleConfig = config.getModuleConfig();
    beforeEach(() => {
        server.listen(3001, 'localhost')
    })
    afterEach(() => {
        server.close();
    });

    test('get payment method', async () => {
        const ctpClient = await config.getCtpClient();
        const customFiledRequest = {
            action: 'getPaymentMethodsRequest',
            request: {}
        }
        const amountPlanned = {
            centAmount: 12345,
            currencyCode: 'AUD',
        }
        const custom = {
            fields: {
                CommercetoolsProjectKey: moduleConfig.projectKey,
                PaymentExtensionRequest: JSON.stringify(customFiledRequest)
            },
            type: {
                key: 'powerboard-components-payment-type',
                typeId: 'type'
            }
        }
        const paymentMethodInfo = {
            paymentInterface: "Mock",
            method: "powerboard-pay",
            name: {
                en: "Power Board"
            }
        }
        const transactions = [
            {
                type: "Charge",
                amount: amountPlanned,
                state: "Initial"
            }
        ]
        const {statusCode, body: payment} = await ctpClient.create(
            ctpClient.builder.payments,
            {
                amountPlanned,
                custom,
                paymentMethodInfo,
                transactions,
            },
        )
        expect(statusCode).toBe(201);

        // chack root onject structure
        expect(payment).toHaveProperty('id');
        expect(payment).toHaveProperty('version');
        expect(payment).toHaveProperty('versionModifiedAt');
        expect(payment).toHaveProperty('lastMessageSequenceNumber');
        expect(payment).toHaveProperty('createdAt');
        expect(payment).toHaveProperty('lastModifiedAt');
        expect(payment).toHaveProperty('lastModifiedBy');
        expect(payment).toHaveProperty('createdBy');

        expect(payment).toHaveProperty('amountPlanned.type', 'centPrecision');
        expect(payment).toHaveProperty('amountPlanned.currencyCode', 'AUD');
        expect(payment).toHaveProperty('amountPlanned.centAmount', 12345);
        expect(payment).toHaveProperty('amountPlanned.fractionDigits', 2);

        expect(payment).toHaveProperty('paymentMethodInfo.paymentInterface', 'Mock');
        expect(payment).toHaveProperty('paymentMethodInfo.method', 'powerboard-pay');
        expect(payment).toHaveProperty('paymentMethodInfo.name', {en: 'Power Board'});

        expect(payment).toHaveProperty('custom.type.typeId', 'type');
        expect(payment).toHaveProperty('custom.fields.CommercetoolsProjectKey', moduleConfig.projectKey);

        expect(payment).toHaveProperty('paymentStatus');
        expect(payment).toHaveProperty('transactions');
        expect(payment).toHaveProperty('interfaceInteractions');

        const response = await ctpClient.delete(ctpClient.builder.payments, payment.id, payment.version)

        expect(response).toHaveProperty('statusCode', 200);
        expect(response).toHaveProperty('body.id', payment.id);
        expect(response).toHaveProperty('body.version', payment.version);
        expect(response).toHaveProperty('body.versionModifiedAt', payment.versionModifiedAt);
        expect(response).toHaveProperty('body.lastModifiedAt', payment.lastModifiedAt);
        expect(response).toHaveProperty('body.amountPlanned', payment.amountPlanned);
        expect(response).toHaveProperty('body.paymentMethodInfo', payment.paymentMethodInfo);
        expect(response).toHaveProperty('body.custom', payment.custom);
    })
})