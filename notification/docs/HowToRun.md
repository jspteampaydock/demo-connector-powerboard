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

3. Configure the environment variables for your  Notification Module.

Navigate to the notification directory and set up the environment variables:

```
echo 'POWERBOARD_INTEGRATION_CONFIG={
   "clientId":"[YOUR_CLIENT_ID]",
   "clientSecret":"[YOUR_CLIENT_SECRET]",
   "projectKey":"[YOUR_PROJECT_KEY]",
   "apiUrl":"https://api.[REGION_ID].gcp.commercetools.com",
   "authUrl":"https://auth.[REGION_ID].gcp.commercetools.com",
   "powerboardLiveUrl": "[API_POWERBOARD_URL]",
   "powerboardSandboxUrl":"[API_POWERBOARD_SANDBOX_URL]",
   "notificationBaseUrl": "[EXTENSION_BASE_URL]"
}' > ./extension/.env
```


Replace the placeholder values with your Commercetools API credentials.

4. Build the docker images and run the application.

Build the following docker images:

- `docker build -t commercetools-powerboard-payment-connector-notification -f cnf/notification/Dockerfile .`

5. Launch the Docker container with the following command:

- `docker run -e POWERBOARD_INTEGRATION_CONFIG=xxxxxx -p 8443:8443 commercetools-powerboard-payment-connector-notification`

6. Replace the placeholder `xxxxxx` for POWERBOARD_INTEGRATION_CONFIG variable  with your Json-escapes string.
###

The Notification Module is accessible at: http://your_domain:8443.



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

Navigate to the notification directory and set up the environment variables.

```
echo 'POWERBOARD_INTEGRATION_CONFIG={
   "clientId":"[YOUR_CLIENT_ID]",
   "clientSecret":"[YOUR_CLIENT_SECRET]",
   "projectKey":"[YOUR_PROJECT_KEY]",
   "apiUrl":"https://api.[REGION_ID].gcp.commercetools.com",
   "authUrl":"https://auth.[REGION_ID].gcp.commercetools.com",
   "powerboardLiveUrl": "[API_POWERBOARD_URL]",
   "powerboardSandboxUrl":"[API_POWERBOARD_SANDBOX_URL]",
   "notificationBaseUrl": "[EXTENSION_BASE_URL]"
}' > ./extension/.env
```

Replace the placeholder values with your Commercetools API credentials.


4. Build the docker images and run the application.

* Replace the placeholder `xxxxxx` for POWERBOARD_INTEGRATION_CONFIG variable in **./docker-compose.yml** with your Json-escapes string.


* Launch docker-compose. The docker images will be built automatically:

```
    docker-compose up -d
```


The Notification Module is accessible at: http://your_domain:8443.

