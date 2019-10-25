# Service Communication Exercises

For these exercises you will be using two simple services - a client and a server. A client sends a string to the server and the server returns a reversed string.

## Prerequisites
- Kubernetes cluster
- [Helm](https://helm.sh)

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

>Above command runs the `rabbitmq` image in detached mode (`-d`) and exposes port `5672` to the host machine. This will allow you to connect to broker by simply using `amqp://localhost`

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
