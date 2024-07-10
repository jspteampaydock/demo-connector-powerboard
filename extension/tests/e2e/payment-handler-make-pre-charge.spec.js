import {expect, test} from '@jest/globals';
import config from "../../src/config/config.js";

const creatPaymentRequest = require('../../test-data/paymentHandler/create-payment.json');

let preChargeRequestData = require('../../test-data/paymentHandler/create-precharge.json');

describe('E2E::PaymentHandler::makePreCharge::', () => {
    let ctpClient;
    let paymentResponse;
    let configPayments;

    beforeEach(async () => {
        creatPaymentRequest.custom.fields.CommercetoolsProjectKey = config.getExtensionConfig().projectKey
        ctpClient = await config.getCtpClient();
        configPayments = await config.getPowerboardConfig();
        paymentResponse = await ctpClient.create(ctpClient.builder.payments, creatPaymentRequest)

        configPayments = configPayments.hasOwnProperty('sandbox')
            ? configPayments.sandbox
            : configPayments.live;
    })

    afterEach(async () => {
        paymentResponse = await ctpClient.fetchById(ctpClient.builder.payments, paymentResponse.body.id)
        ctpClient.delete(ctpClient.builder.payments, paymentResponse.body.id, paymentResponse.body.version)

        preChargeRequestData.reference = null;

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
    })

    test('Apple', async () => {
        if (configPayments.wallets_apple_pay_fraud === 'Enable' && configPayments.wallets_apple_pay_fraud_service_id) {
            preChargeRequestData.fraud = {
                service_id: configPayments.wallets_apple_pay_fraud_service_id,
                data: {}
            }
        }

        if (configPayments.wallets_apple_pay_use_on_checkout === 'Yes') {
            preChargeRequestData.customer.payment_source.wallet_type = 'apple';
            preChargeRequestData.customer.payment_source.gateway_id = configPayments.wallets_apple_pay_gateway_id

            let response = await ctpClient.update(
                ctpClient.builder.payments,
                paymentResponse.body.id,
                paymentResponse.body.version,
                [{
                    action: "setCustomField",
                    name: "PaymentExtensionRequest",
                    value: JSON.stringify({
                        action: "makePreChargeResponse",
                        request: {
                            data: preChargeRequestData,
                            capture: configPayments.wallets_apple_pay_direct_charge === 'Enable'
                        }
                    })
                }]);
            expect(response).toHaveProperty('statusCode', 200);
            expect(response).toHaveProperty('body.custom.fields.PaymentExtensionResponse');

            const paymentExtensionResponse = JSON.parse(response.body.custom.fields.PaymentExtensionResponse);

            expect(paymentExtensionResponse).toHaveProperty('status', 'Success');
            expect(paymentExtensionResponse).toHaveProperty('token');
            expect(paymentExtensionResponse).toHaveProperty('chargeId');
        }else{
            expect(configPayments.wallets_apple_pay_use_on_checkout).not.toBe('Yes')
        }
    })

    test('Google', async () => {
        if (configPayments.wallets_google_pay_fraud === 'Enable' && configPayments.wallets_google_pay_fraud_service_id) {
            preChargeRequestData.fraud = {
                service_id: configPayments.wallets_google_pay_fraud_service_id,
                data: {}
            }
        }

        if (configPayments.wallets_google_pay_use_on_checkout === 'Yes') {
            preChargeRequestData.customer.payment_source.gateway_id = configPayments.wallets_google_pay_gateway_id

            let response = await ctpClient.update(
                ctpClient.builder.payments,
                paymentResponse.body.id,
                paymentResponse.body.version,
                [{
                    action: "setCustomField",
                    name: "PaymentExtensionRequest",
                    value: JSON.stringify({
                        action: "makePreChargeResponse",
                        request: {
                            data: preChargeRequestData,
                            capture: configPayments.wallets_google_pay_direct_charge === 'Enable'
                        }
                    })
                }]);
            expect(response).toHaveProperty('statusCode', 200);
            expect(response).toHaveProperty('body.custom.fields.PaymentExtensionResponse');

            const paymentExtensionResponse = JSON.parse(response.body.custom.fields.PaymentExtensionResponse);

            expect(paymentExtensionResponse).toHaveProperty('status', 'Success');
            expect(paymentExtensionResponse).toHaveProperty('token');
            expect(paymentExtensionResponse).toHaveProperty('chargeId');
        }else{
            expect(configPayments.wallets_google_pay_use_on_checkout).not.toBe('Yes')
        }
    })

    test('PayPal', async () => {
        if (configPayments.wallets_paypal_smart_button_fraud === 'Enable' && configPayments.wallets_paypal_smart_button_fraud_service_id) {
            preChargeRequestData.fraud = {
                service_id: configPayments.wallets_paypal_smart_button_fraud_service_id,
                data: {}
            }
        }else{
            expect(configPayments.wallets_paypal_smart_button_fraud).not.toBe('Enable');
        }

        if(configPayments.wallets_paypal_smart_button_pay_later === 'Enable'){
            preChargeRequestData.pay_later = true;
        }else{
            expect(configPayments.wallets_paypal_smart_button_pay_later).not.toBe('Enable');
        }

        if (configPayments.wallets_paypal_smart_button_use_on_checkout === 'Yes') {
            preChargeRequestData.customer.payment_source.gateway_id = configPayments.wallets_paypal_smart_button_gateway_id

            let response = await ctpClient.update(
                ctpClient.builder.payments,
                paymentResponse.body.id,
                paymentResponse.body.version,
                [{
                    action: "setCustomField",
                    name: "PaymentExtensionRequest",
                    value: JSON.stringify({
                        action: "makePreChargeResponse",
                        request: {
                            data: preChargeRequestData,
                            capture: configPayments.wallets_paypal_smart_button_direct_charge === 'Enable'
                        }
                    })
                }]);
            expect(response).toHaveProperty('statusCode', 200);
            expect(response).toHaveProperty('body.custom.fields.PaymentExtensionResponse');

            const paymentExtensionResponse = JSON.parse(response.body.custom.fields.PaymentExtensionResponse);

            expect(paymentExtensionResponse).toHaveProperty('status', 'Success');
            expect(paymentExtensionResponse).toHaveProperty('token');
            expect(paymentExtensionResponse).toHaveProperty('chargeId');
        }else{
            expect(configPayments.wallets_paypal_smart_button_use_on_checkout).not.toBe('Yes')
        }
    })

    test('Afterpay V2', async () => {
        if (configPayments.wallets_afterpay_v2_fraud === 'Enable' && configPayments.wallets_afterpay_v2_fraud_service_id) {
            preChargeRequestData.fraud = {
                service_id: configPayments.wallets_afterpay_v2_fraud_service_id,
                data: {}
            }
        }

        if (configPayments.wallets_afterpay_v2_use_on_checkout === 'Yes') {
            preChargeRequestData.customer.payment_source.gateway_id = configPayments.wallets_afterpay_v2_gateway_id

            let response = await ctpClient.update(
                ctpClient.builder.payments,
                paymentResponse.body.id,
                paymentResponse.body.version,
                [{
                    action: "setCustomField",
                    name: "PaymentExtensionRequest",
                    value: JSON.stringify({
                        action: "makePreChargeResponse",
                        request: {
                            data: preChargeRequestData,
                            capture: configPayments.wallets_afterpay_v2_direct_charge === 'Enable'
                        }
                    })
                }]);
            expect(response).toHaveProperty('statusCode', 200);
            expect(response).toHaveProperty('body.custom.fields.PaymentExtensionResponse');

            const paymentExtensionResponse = JSON.parse(response.body.custom.fields.PaymentExtensionResponse);

            expect(paymentExtensionResponse).toHaveProperty('status', 'Success');
            expect(paymentExtensionResponse).toHaveProperty('token');
            expect(paymentExtensionResponse).toHaveProperty('chargeId');
        }else{
            expect(configPayments.wallets_afterpay_v2_use_on_checkout).not.toBe('Yes')
        }
    })
})
