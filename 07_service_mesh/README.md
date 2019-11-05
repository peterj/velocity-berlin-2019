# Service Mesh

As part of the service mesh exercises, you will deploy Istio service mesh to your cluster, then use different service mesh features to route traffic, inject failures and test the service resiliency.

## Prerequisites

- Kubernetes cluster
- [Helm](https://helm.sh)

## Installing Istio

1.  Download Istio:

```
curl -L https://git.io/getLatestIstio | ISTIO_VERSION=1.3.3 sh -
```

1. Ensure you can install Isto by running the pre-check command:

```
istioctl verify-install
```

1.  Open the `istio-1.3.3` folder in your terminal/console.
1.  Install Istio custom resource definitions (CRD) and wait for about a minute or so for the CRDs to get applied.

    ```bash
    helm install install/kubernetes/helm/istio-init --name istio-init --namespace istio-system
    ```

1.  Verify that all 23 Istio CRDs were committed to the Kubernetes api-server using the following command (you should get a response of 23):

    ```bash
    kubectl -n istio-system get crds | grep 'istio.io\|certmanager.k8s.io' | wc -l
    ```

1.  Install Istio

    ```bash
    helm install install/kubernetes/helm/istio --set tracing.enabled=true --set tracing.ingress.enabled=true --set pilot.traceSampling=100 --set pilot.resources.requests.memory="512Mi" --set grafana.enabled=true --set prometheus.enabled=true --set kiali.enabled=true --set "kiali.dashboard.jaegerURL=http://localhost:16686/jaeger" --set "kiali.dashboard.grafanaURL=http://localhost:3000" --name istio --namespace istio-system
    ```

1.  Verify the installation:

    ```bash
    $ kubectl get pods -n istio-system
    NAME                                     READY   STATUS      RESTARTS   AGE
    grafana-59d57c5c56-dvntk                 1/1     Running     0          7m41s
    istio-citadel-66f699cf68-l48hr           1/1     Running     0          7m41s
    istio-galley-fd94bc888-ftd6c             1/1     Running     0          7m41s
    istio-ingressgateway-5d6bc75c55-ngtbv    1/1     Running     0          7m41s
    istio-init-crd-10-1.3.3-6xjbw            0/1     Completed   0          9m28s
    istio-init-crd-11-1.3.3-7thmt            0/1     Completed   0          9m28s
    istio-init-crd-12-1.3.3-8m64n            0/1     Completed   0          9m28s
    istio-pilot-7979b875f6-rlmcf             2/2     Running     0          7m41s
    istio-policy-66f7dfb6b-sp74v             2/2     Running     0          117s
    istio-sidecar-injector-d8856c48f-79pn8   1/1     Running     0          7m41s
    istio-telemetry-675c94446f-sx8zm         2/2     Running     0          92s
    istio-tracing-6bbdc67d6c-pcz66           1/1     Running     0          7m41s
    kiali-8c9d6fbf6-tdjnx                    1/1     Running     0          7m41s
    prometheus-7d7b9f7844-dzw79              1/1     Running     0          7m41s
    ```

Once you see output similar to the one above, you have successfully installed Istio on your Kubernetes cluster. Next, we are going to label the default namespace, so anything we deploy in that namespace will have the Envoy proxy automatically injected:

```bash
kubectl label namespace default istio-injection=enabled
```

## Traffic routing

You are going to deploy the following services: a Hello Web and a Greeter service. The Hello web is a simple frontend that makes calls to the Greeter service and displays the responses. You will start with the v1 of the Greeter service and then deploy the v2 to demonstrate and test out traffic routing.

1. Deploy the Hello web first:

```
kubectl apply -f helloweb.yaml
```

1. Check that both containers are up and running (`2/2` - one container is the app istelf and the second one is the injected proxy):

```
$ kubectl get pod
NAME                        READY   STATUS    RESTARTS   AGE
helloweb-844b45ddb4-ddvgp   2/2     Running   0          13s
```

1. Deploy the Greeter service v1:

```
kubectl create -f greeter-v1.yaml
```

In order to access the Hello web, we need to deploy a `Gateway`. The `Gateway` resource controls the ingress gateway that was deployed together with Istio. For the `Gateway` to work we will also deploy a `VirtualService` for the Hello web, so we can point the `Gateway` to our service.

1. Deploy the gateway:

```
kubectl apply -f gateway.yaml
```

1. Deploy the Hello web virtual service:

```
kubectl apply -f helloweb-vs.yaml
```

1. Open `http://localhost` in your browser

### Deploy v2 of the Greeter service

Let's deploy a second version of the Greeter service and see how to split traffic between v1 and v2.

1. Deploy the Greeter v2:

```
kubectl apply -f greeter-v2.yaml
```

> Note: the deployment for Greeter v2 is almost identical with the v1 deployment. The only difference is the image tag.

If you would refresh the `http://localhost` a couple of times, you would see different responses - one coming from v1 and the other one coming from v2. Why is that? The reason lies in the `greeter` Kubernetes service. That service is simply using `app: greeter` as a selector and both v1 and v2 deployments have that label set.

At this point this is expected behavior, however we need a way to tell Istio that we have 2 versions and how to route traffic between them.

First, we need to deploy a `DestinationRule` for the Greeter and define the different versions in there:

```
kubectl apply -f dest-rule.yaml
```

In the `dest-rule.yaml` file we define the following subsets:

```
...
  subsets:
    - labels:
        version: v1
      name: v1
    - labels:
        version: v2
      name: v2
...
```

When traffic gets routed to the Greeter service, Istio will automatically apply either `version: v1` or `version: v2`. So when we say we want traffic to go to v2, the Kubernetes service has the `app: greeter` label and Istio adds the labels that are defined under the `v2` subset, which will route the traffic only to the v2 pods.

However, destination rule alone is not enough. We also need a VirtualService for the Greeter:

```
kubectl apply -f greeter-vs-all-v1.yaml
```

The above virtual service directs all traffic (`weight: 100`) to the v1 version.

Try updating the virtual service to route 10% of the traffic to the v2 version and 90% to the v1.

### Advanced traffic routing

1. Deploy the virtual service that routes requests coming from Firefox to v2, and all other requests to v1:

```
kubectl apply -f greeter-virtualservice-v2-firefox.yaml

```

Update the virtual service to route all traffic with header x-user: alpha to v3 and traffic with header x-user: beta to v2, while all other traffic gets routed to v1.

## Resiliency

1. Open Grafana (http://localhost:3000) and look around the dashboards:

```
kubectl -n istio-system port-forward $(kubectl -n istio-system get pod -l app=grafana -o jsonpath='{.items[0].metadata.name}') 3000:3000 &
```

1. Open Jaeger (http://localhost:16686) and look around:

```
kubectl port-forward -n istio-system $(kubectl get pod -n istio-system -l app=jaeger -o jsonpath='{.items[0].metadata.name}') 16686:16686 &
```

1. Open Kiali (http://localhost:20001/kiali/console) and look around:

```
kubectl -n istio-system port-forward $(kubectl -n istio-system get pod -l app=kiali -o jsonpath='{.items[0].metadata.name}') 20001:20001 &
```

### Slowing Services Down

Inject a 2 second delay to the Greeter service for 50% of the requests and observe how this affects the dashboards in Grafana. Can you find the traces in Jaeger?

Increase the delay to 6 second - do you see any changes in Grafana dashboards/Jaeger?

Hint: Use the snippet below from the Virtual Service to inject failures:

```
- route:
    - destination: ...
  fault:
    delay:
        percent: 5
        fixedDelay: 10s
```

### Breaking the Services

Update the Greeter service to respond with 501 HTTP status code in 70% of the cases. Can you find the dashboards that are being affected by this change? How does the 501 manifest itself in the dashboards and traces?

Hint:

```
- route:
    - destination: ...
  fault:
    abort:
        percent: 10
        httpStatus: 404
```

### Getting Advanced

Update the Greeter service, so it sends 404 in 30% of the time and a 4 second delay for 20% of the time. Look at the graphs and try to see where these changes are manifested.

Return 501 HTTP status code for 50% of the requests that are coming from the iPhones, all other traffic should be unaffected.
