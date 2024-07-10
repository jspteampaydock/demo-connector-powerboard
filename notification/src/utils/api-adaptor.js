import config from '../config/config.js'


async function callPowerboard(url, data, httpMethod) {
  const apiUrl = await config.getPowerboardApiUrl() + url
  const powerboardCredentials = await config.getPowerboardConfig('connection')

  let requestHeaders = {};
  if (powerboardCredentials.credentials_type === 'credentials') {
    requestHeaders = {
      'X-Commercetools-Meta': 'V1.0.0_commercetools',
      'Content-Type': 'application/json',
      'x-user-secret-key': powerboardCredentials.credentials_secret_key
    }
  } else {
    requestHeaders = {
      'X-Commercetools-Meta': 'V1.0.0_commercetools',
      'Content-Type': 'application/json',
      'x-access-token': powerboardCredentials.credentials_access_key
    }
  }
  const requestOptions = {
    method: httpMethod,
    headers: requestHeaders
  };

  if (httpMethod !== 'GET' && data) {
     requestOptions.body = JSON.stringify(data);
  }


  try {
    const response = await fetch(apiUrl, requestOptions);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const responseData = await response.json();
    return responseData?.resource?.data ?? {};
  } catch (error) {
    return {};
  }
}

export default {
  callPowerboard
}
