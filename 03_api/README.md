# API Exercises

In this exercise you will be using [Swagger](http://editor.swagger.io/) to create an API document, generate a service implementation.

# Using Swagger for APIs

## Create the API spec

You can use an online API editor at http://editor.swagger.io to create/test the API.

1. Go to the http://editor.swagger.io
1. Copy/paste the contents of the provided `./swagger/users.yaml` file. You can also create your own API spec or modify the users one if you want to.

On the right side of the editor, you will see the UI representation of your API. You can explore operations and models the API has as shown in figure below.

![API UI](./img/ui-api.png)

## Create server code

First order of business is to generate code for our service - the server code. 

1. From the http://editor.swagger.io, click the **Generate Server** menu and pick your language (I am using Javascript (`nodejs-server`) for the example).

1. As you pick the language, Swagger generates the server code and you can download the server package. 

1. Unzip the package into a desired folder.

At this point, let's run `npm start` from the folder to launch the server.

```
$ npm start
...
> users-service@0.1.0 start  /nodejs-server-server 
> node index.js

Your server is listening on port 8080 (http://localhost:8080)
Swagger-ui is available on http://localhost:8080/docs

```

With the server running, you can open a second terminal window and try to invoke some of the API endpoints.

```
$ curl http://localhost:8080/v1/user/someuser
{
  "firstName": "firstName",
  "lastName": "lastName",
  "password": "password",
  "id": 0,
  "email": "email",
  "username": "username"
}
```

If you look at the source code (`/service/UserService.js`) you will notice that a same user is being returned each time.

The idea behind the generated server code is to get you quickly up and running with a service. The next step would be to go an implement the actual business logic. 

For the sake of simplicity, let's implement a simple in-memory storage for the users service.

## Implement server code

First, let's define an array where we will store the user information. We will make all updates in the `/service/UserService.js` file in your generate server project you downloaded earlier.

1. Define the array - add the following line to the top of the file:

```
'use string'

let users = [];
```

1. Implement `createUser` function:

```
exports.createUser = function (body) {
  return new Promise(function (resolve, reject) {
    users.push(body)
    resolve();
  });
}
```

1. Implement `deleteUser` function:
```
exports.deleteUser = function (username) {
  return new Promise(function (resolve, reject) {
    for (var id in users) {
      const u = users[id];
      if (u['username'] === username) {
        users.splice(u, 1)
        resolve();
        return;
      }
    }
    resolve();
  });
}
```

1. Implement `getUserByName` function:

```
exports.getUserByName = function (username) {
  return new Promise(function (resolve, reject) {
    for (var id in users) {
      const u = users[id];
      if (u['username'] === username) {
        resolve(u);
        return;
      }
    }
    resolve();
  });
}
```

1. Implement `updateUser` function:

```
exports.updateUser = function (username, body) {
  return new Promise(function (resolve, reject) {
    for (var id in users) {
      const u = users[id];
      if (u['username'] === username) {
        users[id] = body;
        resolve();
        return;
      }
    }
    resolve();
  });
}
```

## Testing the server code

Next, run the `npm start` from the project folder to start the service and you can then test the service.


1. Create a new user:

```
$ curl -X POST "http://localhost:8080/v1/user" -H "accept: application/json" -H "Content-Type: application/json" -d "{ \"id\": 0, \"username\": \"johnd\", \"firstName\": \"John\", \"lastName\": \"Doe\", \"email\": \"john@learncloudnative.com\", \"password\": \"hello\"}"
```

1. Retrieve the user:

```
$ curl http://localhost:8080/v1/user/johnd
{
  "id": 0,
  "username": "johnd",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@learncloudnative.com",
  "password": "hello"
}
```

1. Update the user (change the username from `johnd` to `john_doe`):

```
$ curl -X PUT "http://localhost:8080/v1/user/johnd" -H "accept: application/json" -H "Content-Type: application/json" -d "{ \"id\": 0, \"username\": \"john_doe\", \"firstName\": \"John\", \"lastName\": \"Doe\", \"email\": \"john@learncloudnative.com\", \"password\": \"hello\"}"
```

1. Retrieve the user by the new username (`john_doe`):

```
$ curl http://localhost:8080/v1/user/john_doe
{
  "id": 0,
  "username": "john_doe",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@learncloudnative.com",
  "password": "hello"
}
```

1. Delete the user:

```
$ curl -X DELETE http://localhost:8080/v1/user/john_doe
```

At this point the user should be deleted - you can try retrieving it again and see that nothing gets returned. Similarly, you can try and add more users as well.


# API Gateway with HAProxy

In this exercise you will learn a couple of basic features of an API gateway using the HAProxy. As a backing service for this exercise you will be using a Go service that runs an HTTP server and returns a square of the given number. For example:

```
$ curl localhost:8080/square/55
3025
```

Since we don't want to directly expose this functionality, you will be configuring an instance of HAProxy that will act as an API gateway.

## Simple proxy in front of the service

Let's start the example by running a simple proxy in-front of the `square` service. This will simply take the incoming requests and pass them to the instance of the square service.

The `./gateway/docker-compose.yaml` defines two services - `haproxy` and `square-service`. The `haproxy` service also mounts a volume - this is so we can include the `haproxy.cfg` file in the container.

>Another option would be to create a separate Dockerfile that is based on the HAProxy image and then copy the proxy configuration.

We are also exposing port `8080` (on the host) to be directed to the port `80` inside the container - this is where the HAProxy instance will be listening on and it's defined in the `haproxy.cfg` file.

Let's look at the contents of the `haproxy.cfg` file:

```
global
  maxconn 4096
  daemon

defaults
    log     global
    mode    http

    timeout connect 10s
    timeout client 30s
    timeout server 30s

frontend api_gateway
    bind 0.0.0.0:80
    default_backend be_square 

backend be_square
    server s1 square-service:8080
```

We are interested in two sections - **frontend** and **backend**. We are calling the frontend section `api_gateway` and this is where we define where the proxy will listen on as well as how to route the incoming traffic. We are simply setting a default_backend to the `be_square` backend that's defined right after the frontend section.

In the backend section we are creating a single server called `s1` with an endpoint `square-service:8080` - this is the name that we defined for the square service in the `docker-compose.yaml` file.

Let's run this and test the behavior - from the `./gateway` folder, run;

```
$ docker-compose up
Creating network "gateway_default" with the default driver
Creating gateway_square-service_1 ... done
Creating gateway_haproxy_1        ... done
Attaching to gateway_square-service_1, gateway_haproxy_1
square-service_1  | {"level":"info","msg":"Running on 8080","time":"2019-11-02T00:56:07Z"}
haproxy_1         | <7>haproxy-systemd-wrapper: executing /usr/local/sbin/haproxy -p /run/haproxy.pid -db -f /usr/local/etc/haproxy/haproxy.cfg -Ds
```

The docker-compose will do it's job, it will create a new network and two services. Run the `curl` command from a separate terminal window:

```
$ curl localhost:5000/square/12
144
```

You will also notice the log that gets written when the service is called. 

## Enabling stats

HAProxy is collecting a lot of stats on the requests, frontends, and backend servers. To enable the stats, add the following section to the end of the `haproxy.cfg` file:

```
listen stats
    bind *:8404
    stats enable
    stats uri /stats
    stats refresh 5s
```

The above section binds port `8404` to be available on the `/monitor` URL. Since we are exposing the stats on a different port, you also need to update the `docker-compose.yaml` file to expose that additional port. Add the line `"8404:8404"` under the ports key:

```
    ports:
      - "5000:80"
      - "8404:8404"
```

Restart the containers and see if you can get to the stats page (press CTRL+C if you still have docker-compose running):

```
$ docker-compose down
...
$ docker-compose up
...
```

Next, open `http://localhost:8404/stats` to see the stats for the frontend and backend. This page shows you the number of requests, sessions, and bunch of other stats. Make a couple of request to the `square` service and see how the stats page changes.

## Health checks

The simplest way you can add a health check for your backend services is to add the word `check` on the same line your server backend is defined. Like this:

```
server s1 square-service:8080 check
```

This instructs the HAProxy to do an active health check by periodically making a TCP request to the server.

Update the `haproxy.cfg` by adding the `check` keyword as shown above and restart the containers.

Next, you can open the HAProxy stats page (`http://localhost:8404/stats`) again to see the health check in action. Notice the row in the backend table has turned green as shown in figure below.

![HAProxy health check](./img/haproxy-healthcheck.png)

With the containers running, go back to the terminal and kill the container running the square service. First, run `docker ps` to get the container ID and then run `docker kill [container-id].

Alternatively, you use the name of the container (`gateway_square-service_1`) to kill it.

With the container killed, go back to the stats page and you will notice that the row that was previously green, has turned yellow and eventually red. This means that the health check is failing.

>If you hover over the column `LastChk`, you will also get a reason for the failing health check (Layer4 timeout)

## Denying requests

We want the square API users to use an API key when accessing the functionality. As a first step we can do is to deny any requests that don't have an API key header set. 

To do that, you can add the following line, right after the bind command in the frontend section:

```
http-request deny unless { req.hdr(api-key) -m found }
```

With this line we are telling the proxy to deny the request unless a header called `api-key` is found.

If you try to make the exact same request as before, you will get the 403 response from the proxy:

```
$ curl localhost:5000/square/12
<html><body><h1>403 Forbidden</h1>
Request forbidden by administrative rules.
</body></html>
```

However, if you add a header value, the request will work just fine: 

```
$ curl -H "api-key: hello" localhost:5000/square/12
144
```

## Rate limiting

In addition to requiring the API keys, we also want to rate-limit users, so they aren't making too many requests and causing unnecessary strain to our service.

To do that, we need to define a couple of things - let's explain each line separately first, and then see how to put it together.

1. We need a way to store/count the number of requests. For that purpose, you can use a stick table - it stores the number of requests and automatically expires after a certain period of time (`5m` in our case):

```
stick-table type string size 1m expire 5m store http_req_cnt
```

1. We also need to set a limit after which we will be denying request. You can do that using an ACL where we check if the number of requests with a specific `api-key` header value exceeds the limit - we set it to 10, so it's easier to test:

```
acl exceeds_limit req.hdr(api-key),table_http_req_cnt(api_gateway) gt 10
```

1. If the limit is not exceeded, let's track the current request:

```
http-request track-sc0 req.hdr(api-key) unless exceeds_limit
```

1. Finally, we need to deny the request if limit is exceeded:

```
http-request deny deny_status 429 if exceeds_limit
```

The final frontend configuration should then look like this:

```
frontend api_gateway
    bind 0.0.0.0:80

    # Deny the request unless the api-key header is present
    http-request deny unless { req.hdr(api-key) -m found }

    # Create a stick table to track request counts
    # The values in the table expire in 5m
    stick-table type string size 1m expire 5m store http_req_cnt

    # Create an ACL that checks if we exceeded the value of 10 requests 
    acl exceeds_limit req.hdr(api-key),table_http_req_cnt(api_gateway) gt 10
    

    # Track the value of the `api-key` header unless the limit was exceeded 
    http-request track-sc0 req.hdr(api-key) unless exceeds_limit

    # Deny the request with 429 if limit was exceeded
    http-request deny deny_status 429 if exceeds_limit

    default_backend be_square 
    ....
```


Restart the containers and try it out - make 10 requests and on the eleventh request, you will get the following response back:

```
$ curl -H "api-key: hello" localhost:5000/square/12
<html><body><h1>429 Too Many Requests</h1>
You have sent too many requests in a given amount of time.
</body></html>
```

You can wait for 5 min to check that the table expires, or you can also try making requests using a different `api-key` header value, since we are tracking the value of it:

```
$ curl -H "api-key: TEST" localhost:5000/square/12
144
```

Finally, let's check the stats again - specifically the Denied column in the `api_gateway` section. You should see the number of denied requests there.

