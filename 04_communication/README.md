# Service Communication Exercises

This folder contains exercises for sync, async and pub/sub service communication. For both sets of exercises you can either run them directly using Node.js or you can build the Docker images and run containers.

## Sync & Async Communication exercises

For these exercises you will be using two simple services - a client and a server. A client sends a string to the server and the server returns a reversed string.

## Pub/sub Exercises

For the pub/sub exercise you will use three different services to simulate a user sign-up and activation scenarios.

## Prerequisites

- Docker
- Kubernetes cluster
- [Helm](https://helm.sh)
- [Node.js](https://nodejs.org/en/) and [npm](https://www.npmjs.com/get-npm)

## Sync communication

In the sync example, the client (`./sync/client`) will talk directly to the server (`./sync/server`) using sychronous request/response messaging.

1. Open a terminal window and change folder to `./sync/server`.
1. Run `npm install` to install all dependencies.
1. Run `npm start` to run the server:

```
$ npm start

> server@0.1.0 start /velocity-berlin-2019/04_communication/sync/server
> node server.js

Listening on 3001
```

To verify server is running and acccepting connection, send a sample request:

```
$ curl -X POST -d '{ "content": "hello" }' -H "Content-type: application/json"  http://localhost:3001
{"msg":"olleh"}
```

1. Open a second terminal window and go to `./sync/client`.
1. Run `npm install` to install all dependencies.
1. Run `npm start` to run the client:

```
$ npm start

> client@0.1.0 start /velocity-berlin-2019/04_communication/sync/client
> node client.js

Listening on 3000
```

With both services up and running, you can start making requests to the client service:

```
$ curl localhost:3000/hello
{"msg":"olleh"}
```

## Async communication using RabbitMQ

For the async communcation example you will run an instance of the [RabbitMQ](https://rabbitmq.com) message broker. Instead of client calling directly to the server instance, instead, it will post a message to a channel which server listens on. Together with the string we want reversed, you will also send a correlation ID. Additionally, the client creates a second queue where it listens on for the response from the server. As soon as server responds (by sending a message to the channel), the client will return the value.

1. Run a local RabbitMQ instance.

```
docker run -d --name amqp -p 5672:5672 rabbitmq
```

> Above command runs the `rabbitmq` image in detached mode (`-d`) and exposes port `5672` to the host machine. This will allow you to connect to broker by simply using `amqp://localhost`

1. Run the async server from the `./async/server` folder:

```
$ npm start

> server@0.1.0 start /velocity-berlin-2019/04_communication/async/server
> node server.js

Connecting to amqp://localhost
Connected.
Waiting for requests
```

1. Run the async client from the `./async/client` folder:

```
$ npm start

> client@0.1.0 start /velocity-berlin-2019/04_communication/async/client
> node client.js

Connecting to amqp://localhost
Listening on 3000
Channel created.
```

Just like with the sync example, you can start making requests to the client:

```
$ curl localhost:3000/bye
{"msg":"eyb"}
```

Observe the logs from server and client to see how messages are being passed.

Next, try stopping the server and sending a request to the client. After a while the client will timeout of course, however, if you start the server again before the timeout, you will notice that you will receive a response back from the client as the message was queued. Same would happen if you would make multiple requests while the server was down - the messages would accummulate and as soon as server comes back up, they would get processed. If we do the same thing in the sync example you would get a failed response right away, because client is calling the server directly.

### Scaling the client/server

Using a message broker makes scaling the services really easy. Let's try an scale up the server portion. Open two additional terminal windows and run an async server in each of them (you should have 3 servers running).

Observe the logs as you are making requests to the client. The messages will get picked up by different servers.

#### Scaling with Kubernetes

To scale the client portion we can deploy server, client and the RabbitMQ to the Kubernetes cluster.

1. Deploy the RabbitMQ, from the `./async` folder, run:

```
helm install stable/rabbitmq-ha --name my-rabbit --namespace rabbit -f rabbitmq.yaml
```

1. Deploy the server (from `./async/server` folder):

```
kubectl apply -f deploy.yaml
```

1. Deploy the client (from `./async/client` folder):

```
kubectl apply -f deploy.yaml
```

With everything deployed, try invoking the client (note, if using Docker for mac, you can use `http://localhost`). If using a managed Kubernetes cluster, run `kubectl get services` and look at the value in the `EXTERNAL-IP` column for the client service (`async-client`) and use that IP address:

```
curl http://localhost/hello
```

To scale up/down the deployments, you can use the `kubectl scale` command, like this:

```
kubectl scale deployment async-client-deployment --replicas=5
```

Similarly, to scale down, you would run:

```
kubectl scale deployment async-client-deployment --replicas=1
```

##### Monitoring RabbitMQ

To get the RabbitMQ stats, you can create a port forward to the administration portal using the following command:

```
kubectl port-forward svc/my-rabbit-rabbitmq-ha -n rabbit 8000:15672
```

The management portal will be at `http://localhost:8000`

##### Horizontal pod scaling Metrics Server

In order to use the horizontal pod scaler, you need to install the metrics server using Helm:

```
helm install stable/metrics-server
```

Next, you can define a pod scaler like this:

```yaml
apiVersion: autoscaling/v2beta2
kind: HorizontalPodAutoscaler
metadata:
  name: async-client
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: async-client-deployment
  minReplicas: 1
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 50
```

If you deploy the above horizontal pod autoscaler, Kubernetes will automatically scale up (or down) the number of pods based on the avergae CPU utilization.

## Pub/Sub

For the Pub/Sub scenario, there are 3 services involved: frontend, activation and email.

### Sign up flow

Use the following command to start the sign up flow:

```
curl -X POST -d '{"email":"peter@example.com" }' -H "content-type: application/json" localhost:3000/register
```

Sign-up flow:

1. **Frontend service** publishes an `account.signup` event
1. **Activation service** listens to all events starting with the key `account.*`. It reacts to the signup event and creates an activation code
1. **Activation service** publishes an `account.sendActivationCode` event
1. **Email service** listents to the `sendActivationCode` event and sends an email

### Activation flow

To trigger the activation flow, use the following requests (you can get the activation code from the output of the email service):

```
curl -X POST -d '{"activationCode": "7606" }' -H "content-type: application/json" localhost:3000/activate
```

Activation flow:

1. **Frontend service** publishes `account.activate` event
1. **Activation service** reacts to that event, checks if the account hasn't been activated and code mathces, then activates the account
1. **Activation service** sends the `account.activated` event
1. **Email service** reacts to the `account.activated` event and sends an email

## Running the pub/sub example

You can use the docker-compose to run the pub/sub example. Before running everything, we need to build the images first. Run the build command from the `/pubsub` folder, where the `docker-compose.yaml` is located at:

```
docker-compose build
```

After images are built, you can run the `docker-compose up` command:

```
docker-compose up
```

> Note: you will see the containers start up and some errors as they are trying to connect to RabbitMQ. Docker compose allows to define which containers to start first using the `depends_on` key, however it can't wait for the containers to start up. We designed the services in such a way that they will do a couple of retries when connecting to RabbitMQ. You can control the number of retries (default: 5) and wait (default: 3000 ms) between retries using the `MAX_CONNECT_RETRIES` and `CONNECT_RETRY_SLEEP` environment variables.

To ensure all containers are up and running, you can look for the following output from each service in the logs:

```
activation_1  | [RabbitMQ]: Connected
activation_1  | [RabbitMQ]: Channel created
```

Alternatively, run `docker ps` and check that all containers are up, like this:

```
$ docker ps
CONTAINER ID        IMAGE               COMMAND                  CREATED             STATUS              PORTS                                NAMES
97e856ba319f        pubsub_activation   "docker-entrypoint.s…"   41 seconds ago      Up 40 seconds                                            pubsub_activation_1
a282da97a494        pubsub_frontend     "docker-entrypoint.s…"   41 seconds ago      Up 40 seconds       0.0.0.0:3000->3000/tcp               pubsub_frontend_1
7ad660395cfc        pubsub_email        "docker-entrypoint.s…"   41 seconds ago      Up 40 seconds                                            pubsub_email_1
ef4a9957add7        rabbitmq:3.8.0      "docker-entrypoint.s…"   2 minutes ago       Up 41 seconds       4369/tcp, 5671-5672/tcp, 25672/tcp   pubsub_rabbitmq_1
```

> Note: the image and container names are created automatically by `docker-compose` using the root folder and the service names.

The frontend service is exposed on `localhost:3000`, so you can try the registration flow by sending this request:

```
curl -X POST -d '{"email":"peter@example.com" }' -H "content-type: application/json" localhost:3000/register
```

The output from the logs should look similar to this:

```
frontend_1    | [Frontend]: Publishing event "account.signup" for "peter@example.com"
frontend_1    | POST /register 200 27.620 ms - 12
activation_1  | [Activation]: Received event "account.signup" for "peter@example.com"
activation_1  | [Activation]: Publishing event "account.sendActivationCode" for "peter@example.com"
email_1       | [Email]: Received event "account.sendActivationCode". Sending activation email with payload "{"email":"peter@example.com","activationCode":"1710","activated":false}"

```

1. The frontend starts the registration flow by publishing the `account.signup` for the provided email.
1. The activation services receives the event, creates an activation code and publishes an `account.sendActivationCode` event.
1. The email service is listening to this event and once it receives it, it should "send an email" with the activation code.

Next, let's try out the activation flow. If the email service would actually be sending emails, you would receive the activation code to activate your account. To activate the account, send the following request:

```
curl -X POST -d '{"activationCode": "7606" }' -H "content-type: application/json" localhost:3000/activate
```

The output from the containers looks like this:

```
frontend_1    | [Frontend]: Publishing event "account.activate" using code "1710"
frontend_1    | POST /activate 200 2.100 ms - 12
activation_1  | [Activation]: Received event "account.activate" for "1710"
activation_1  | [Activation]: Activating account "peter@example.com"
activation_1  | [Activation]: Publishing event "account.activated" for "peter@example.com"
email_1       | [Email]: Received event "account.activated". Sending welcome email using payload "{"email":"peter@example.com","activationCode":"1710","activated":true}"
```

1. The frontend publishes the `account.activate` event with the activation code.
1. The activation service listens to that event and "activates the account". It also publishes the `account.activated` event.
1. The email service listens to the `account.activated` event and sends a welcome email.

### Add email to the activation flow

Notice how in the activation flow we are only providing the activation code. This is not correct, as we should also be providing the email. To fix this, you have to make the following changes:

1. Update the frontend service to `/activate` endpoint to read the email from the `req.body` and send both activation code and the email when publishing the `AccountActivateEvent`. For example:

```
    ...
    const activationCode = req.body.activationCode;
    const email = req.body.email

    const payload = {
      activationCode: activationCode
      email: email
    }
    console.log(`[Frontend]: Publishing event "${AccountActivateEvent}" using code "${activationCode}"`);

    channel.publish(ExchangeName, AccountActivateEvent, Buffer.from(JSON.stringify(payload)), { correlationId: createId() });
    ...
```

1. Update the Activation service where the event is listened to (`server.js`, line 90) to check that both email _and_ activation code match, before activating the account:

### Add the deactivate flow

Think about and design how a deactivate account flow would look like. As part of the deactivation we want to remove the email from the `allActivations` array in the Activation service as well as send a Goodbye email from the email service
