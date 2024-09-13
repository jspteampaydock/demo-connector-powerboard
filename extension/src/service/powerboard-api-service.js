import fetch from 'node-fetch'
import {serializeError} from 'serialize-error'
import config from '../config/config.js'


async function callPowerboard(url, data, method) {
    let returnedRequest;
    let returnedResponse;
    url = await generatePowerboardUrlAction(url);
    try {
        const {response, request} = await fetchAsyncPowerboard(url, data, method);
        returnedRequest = request;
        returnedResponse = response;
    } catch (err) {
        returnedRequest = {body: JSON.stringify(data)};
        returnedResponse = serializeError(err);
    }

    return {request: returnedRequest, response: returnedResponse};
}

async function fetchAsyncPowerboard(
    url,
    requestObj,
    method
) {
    let response;
    let responseBody;
    let responseBodyInText;
    const request = await buildRequestPowerboard(requestObj, method);

    try {
        response = await fetch(url, request);
        responseBodyInText = await response.text();
        responseBody = responseBodyInText ? JSON.parse(responseBodyInText) : '';
    } catch (err) {
        if (response)
            throw new Error(
                `Unable to receive non-JSON format resposne from Powerboard API : ${responseBodyInText}`,
            );
        else throw err;
    } finally {
        if (responseBody.additionalData) {
            delete responseBody.additionalData;
        }
    }
    return {response: responseBody, request};
}


async function generatePowerboardUrlAction(url) {
    const apiUrl = await config.getPowerboardApiUrl();
    return apiUrl + url;
}

async function buildRequestPowerboard(requestObj, methodOverride) {
    const powerboardCredentials = await config.getPowerboardConfig('connection');
    let requestHeaders = {};

    if (powerboardCredentials.credentials_type === 'credentials') {
        requestHeaders = {
            'X-Commercetools-Meta': 'V1.0.0_commercetools',
            'Content-Type': 'application/json',
            'x-user-secret-key': powerboardCredentials.credentials_secret_key
        };
    } else {
        requestHeaders = {
            'X-Commercetools-Meta': 'V1.0.0_commercetools',
            'Content-Type': 'application/json',
            'x-access-token': powerboardCredentials.credentials_access_key
        };
    }

    const request = {
        method: methodOverride || 'POST',
        headers: requestHeaders,
    };
    if (methodOverride !== 'GET') {
        request.body = JSON.stringify(requestObj);
    }
    return request;
}


export {
    callPowerboard
}
