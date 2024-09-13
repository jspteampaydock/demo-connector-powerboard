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
echo 'COMMERCETOOLS_CLIENT_ID = [COMMERCETOOLS_CLIENT_ID]
   COMMERCETOOLS_CLIENT_SECRET = [COMMERCETOOLS_CLIENT_SECRET]
   COMMERCETOOLS_PROJECT_KEY = [COMMERCETOOLS_PROJECT_KEY]
   COMMERCETOOLS_API_URL = [COMMERCETOOLS_API_URL]
   COMMERCETOOLS_AUTH_URL = [COMMERCETOOLS_AUTH_URL]
   POWERBOARD_API_LIVE_URL = [POWERBOARD_API_LIVE_URL]
   POWERBOARD_API_SANDBOX_URL = [POWERBOARD_API_SANDBOX_URL]
}' > ./notification/.env
```


Replace the placeholder values with your Commercetools API credentials.

4. Build the docker images and run the application.

Build the following docker images:

- `docker build -t commercetools-powerboard-payment-connector-notification -f cnf/notification/Dockerfile .`

5. Launch the Docker container with the following command:

- `docker run -e COMMERCETOOLS_CLIENT_ID=**** COMMERCETOOLS_CLIENT_SECRET=**** COMMERCETOOLS_PROJECT_KEY=**** COMMERCETOOLS_API_URL=**** COMMERCETOOLS_AUTH_URL=*** POWERBOARD_API_LIVE_URL=**** POWERBOARD_API_SANDBOX_URL=**** -p 8443:8443 commercetools-powerboard-payment-connector-notification`

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
echo 'COMMERCETOOLS_CLIENT_ID = [COMMERCETOOLS_CLIENT_ID]
   COMMERCETOOLS_CLIENT_SECRET = [COMMERCETOOLS_CLIENT_SECRET]
   COMMERCETOOLS_PROJECT_KEY = [COMMERCETOOLS_PROJECT_KEY]
   COMMERCETOOLS_API_URL = [COMMERCETOOLS_API_URL]
   COMMERCETOOLS_AUTH_URL = [COMMERCETOOLS_AUTH_URL]
   POWERBOARD_API_LIVE_URL = [POWERBOARD_API_LIVE_URL]
   POWERBOARD_API_SANDBOX_URL = [POWERBOARD_API_SANDBOX_URL]
}' > ./notification/.env
```

Replace the placeholder values with your Commercetools API credentials.


4. Build the docker images and run the application.


* Launch docker-compose. The docker images will be built automatically:

```
    docker-compose up -d
```


The Notification Module is accessible at: http://your_domain:8443.

