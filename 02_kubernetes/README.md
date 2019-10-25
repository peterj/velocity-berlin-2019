# Kubernetes Exercieses

In this exercise you will install a Kubernetes cluster (or use a cloud-managed one) to deploy an application and try out some `kubectl`

## Prerequisites

- Docker for Mac/Windows (or Docker for Linux) with Kubernetes support enabled
- Kubernetes CLI (`kubectl`) (https://kubernetes.io/docs/tasks/tools/install-kubectl/)

If you're using Linux, you will have to install [Minikube](https://kubernetes.io/docs/tasks/tools/install-minikube/)
Minikube for running a Kubernetes cluster)

## Getting familiar

Kubernetes CLI (`kubectl`) is what you will use to talk to your Kubernetes cluster.

Let's make sure we have a cluster running:

```
$ kubectl get nodes
NAME             STATUS   ROLES    AGE    VERSION
docker-desktop   Ready    master   2d6h   v1.15.4
```

The `get` command is used for retrieving resources from the cluster. In the example above you used `get nodes` to get the information about all the nodes in the cluster. Since you're using Docker (you'd get a similar output if using Minikube), you will only have a single node.

## Running containers

To run a container inside the cluster, you can use the `run` command.

For example, to run the Node.js hello world application we used before, you can use the following command:

```
kubectl run helloworld --image=learncloudnative/helloworld:0.1.0 --port=3000
```

> Note: Ignore the message about the command being deprecated.

With the command above we are creating a Kubernetes deployment called `helloworld` and telling Kubernetes to create a container from the provided image and run it on port `3000`.

You can look at all the deployments in your cluster with the get command:

```
$ kubectl get deployments
NAME         READY   UP-TO-DATE   AVAILABLE   AGE
helloworld   1/1     1            1           8s
```

Let's also check the pods we have running for this deployment:

```
$ kubectl get pods
NAME                          READY   STATUS    RESTARTS   AGE
helloworld-5fc86b997c-7jksc   1/1     Running   0          2m16s
```

To get more information about the resources, you can use the `describe` command, like this:

```
$ kubectl describe deployment helloworld
Name:                   helloworld
Namespace:              default
CreationTimestamp:      Wed, 1 Oct 2019 21:32:42 -0700
Labels:                 run=helloworld
Annotations:            deployment.kubernetes.io/revision: 1
Selector:               run=helloworld
Replicas:               1 desired | 1 updated | 1 total | 1 available | 0 unavailable
StrategyType:           RollingUpdate
MinReadySeconds:        0
RollingUpdateStrategy:  25% max unavailable, 25% max surge
Pod Template:
  Labels:  run=helloworld
  Containers:
   helloworld:
    Image:        learncloudnative/helloworld:0.1.0
    Port:         3000/TCP
    Host Port:    0/TCP
    Environment:  <none>
    Mounts:       <none>
  Volumes:        <none>
Conditions:
  Type           Status  Reason
  ----           ------  ------
  Available      True    MinimumReplicasAvailable
  Progressing    True    NewReplicaSetAvailable
OldReplicaSets:  <none>
NewReplicaSet:   helloworld-5fc86b997c (1/1 replicas created)
Events:
  Type    Reason             Age    From                   Message
  ----    ------             ----   ----                   -------
  Normal  ScalingReplicaSet  3m55s  deployment-controller  Scaled up replica set helloworld-5fc86b997c to 1

```

Above command gives you more details about the desired resource instance.

## Accessing services

Any containers running inside Kubernetes need to be explicitly exposed in order to be able to access them from the outside of the cluster.

You can use the `expose` command to create a Kubernetes service and 'expose' your application:

```
$ kubectl expose deployment helloworld --port=8080 --target-port=3000 --type=LoadBalancer
service/helloworld exposed
```

The above command exposes the deployment called `helloworld` on port `8080`, talking to the target port (container port) `3000`. Additionall, we are saying we want to expose this on a service of type LoadBalancer - this will allocate a 'public' IP for us (`localhost` when running Docker for Mac), so we can acccess the application on e.g. `http://localhost:8080`.

> Minikube: Use the Minikube IP address (get it with `minikube ip`) and the internal port (run `kubectl get services` and use second port in the pair (e.g. `8080:30012` -> use `30012`)) to access the exposed application.

Expose command creates another Kubernetes resource - a Service. To look at the details of the created service, run:

```
$ kubectl describe service helloworld
Name:                     helloworld
Namespace:                default
Labels:                   run=helloworld
Annotations:              <none>
Selector:                 run=helloworld
Type:                     LoadBalancer
IP:                       10.101.40.103
LoadBalancer Ingress:     localhost
Port:                     <unset>  8080/TCP
TargetPort:               3000/TCP
NodePort:                 <unset>  30075/TCP
Endpoints:                10.1.0.67:3000
Session Affinity:         None
External Traffic Policy:  Cluster
Events:                   <none>
```

## Scalling up

Now that you can access the application through exposed service, you can try and scale the deployment and create more replicas of the application:

```
kubectl scale deployment helloworld --replicas=5
```

If you look at the pods now, you should see 5 different instances:

```
$ kubectl get pods
NAME                          READY   STATUS    RESTARTS   AGE
helloworld-5fc86b997c-2p4ww   1/1     Running   0          3s
helloworld-5fc86b997c-7jksc   1/1     Running   0          11m
helloworld-5fc86b997c-fg986   1/1     Running   0          3s
helloworld-5fc86b997c-ftm6d   1/1     Running   0          3s
helloworld-5fc86b997c-jc9jt   1/1     Running   0          3s
```

Similarly, you can scale down the pods by running the same command and providing a smaller number of replicas:

```
kubectl scale deployment helloworld --replicas=1
```
