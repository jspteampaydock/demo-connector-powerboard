# How to run

## Prerequisites

Ensure you have the following prerequisites before proceeding with installation:

- Docker and docker-compose installed on your machine.
- An active commercetools account with API credentials.
- Git installed on your machine.


## Install the Modules

You can install the modules using either `docker run...` or `docker-compose`. The following subsections detail both methods.

---
### Install with `docker run...`
---

The following steps describe how to install using `docker run...`.

1. Clone the Repository.

```
git clone https://github.com/CommBank-PowerBoard/powerboard-e-commerce-commercetools-payment-connector
```

2. Navigate to the project-directory.
```
cd powerboard-e-commerce-commercetools-payment-connector
```

3. Configure the environment variables for your Extension Module


Navigate to the extension directory and set up the following environment variables:

```
echo 'POWERBOARD_INTEGRATION_CONFIG={
   "clientId":"[YOUR_CLIENT_ID]",
   "clientSecret":"[YOUR_CLIENT_SECRET]",
   "projectKey":"[YOUR_PROJECT_KEY]",
   "apiUrl":"https://api.[REGION_ID].gcp.commercetools.com",
   "authUrl":"https://auth.[REGION_ID].gcp.commercetools.com",
   "powerboardLiveUrl": "[API_POWERBOARD_URL]",
   "powerboardSandboxUrl":"[API_POWERBOARD_SANDBOX_URL]",
   "extensionBaseUrl": "[EXTENSION_BASE_URL]",
   "powerboardWidgetTypeSdk": "[WIDGET_TYPE_SDK]",//("staging_cba", "sandbox_cba")
   "powerboardWidgetUrl": "[WIDGET_URL]",
   "powerboardWidgetTestUrl": "[WIDGET_TEST_URL]"
}' > ./extension/.env
```


Replace the placeholder values with your Commercetools API credentials.

4. Build the docker images and run the application.

Build the following docker images:

- `docker build -t commercetools-powerboard-payment-connector-extention -f cnf/extension/Dockerfile .`


5. Launch the Docker container with the following command:

- `docker run -e POWERBOARD_INTEGRATION_CONFIG=xxxxxx -p 8082:8082 commercetools-powerboard-payment-connector-extention`


6. Replace the placeholder `xxxxxx` for POWERBOARD_INTEGRATION_CONFIG variable  with your Json-escapes string.
###
The Extension Module is accessible at: http://your_domain:8082.


---
### Install with `docker-compose`
---

The following steps describe how to install the modules using `docker compose...`.

1. Clone the Repository.

```
git clone https://github.com/CommBank-PowerBoard/powerboard-e-commerce-commercetools-payment-connector
```

2. Navigate to the project-directory.

```
cd powerboard-e-commerce-commercetools-payment-connector
```

3. Configure Environment Variables.

Navigate to the extension directory and set up the environment variables.

```
echo 'POWERBOARD_INTEGRATION_CONFIG={
   "clientId":"[YOUR_CLIENT_ID]",
   "clientSecret":"[YOUR_CLIENT_SECRET]",
   "projectKey":"[YOUR_PROJECT_KEY]",
   "apiUrl":"https://api.[REGION_ID].gcp.commercetools.com",
   "authUrl":"https://auth.[REGION_ID].gcp.commercetools.com",
   "powerboardLiveUrl": "[API_POWERBOARD_URL]",
   "powerboardSandboxUrl":"[API_POWERBOARD_SANDBOX_URL]",
   "extensionBaseUrl": "[EXTENSION_BASE_URL]",
   "powerboardWidgetTypeSdk": "[WIDGET_TYPE_SDK]",//("staging_cba", "sandbox_cba")
   "powerboardWidgetUrl": "[WIDGET_URL]",
   "powerboardWidgetTestUrl": "[WIDGET_TEST_URL]"
}' > ./extension/.env
```

Replace the placeholder values with your Commercetools API credentials.


4. Build the docker images and run the application.

* Replace the placeholder `xxxxxx` for POWERBOARD_INTEGRATION_CONFIG variable in **./docker-compose.yml** with your Json-escapes string.

* Launch docker-compose. The docker images will be built automatically:

```
    docker-compose up -d
```

The Extension Module is accessible at: http://your_domain:8082.
