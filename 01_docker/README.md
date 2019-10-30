# Docker Exercises

In this exercise you will install Docker CLI, create a Docker hub account and try out different Docker CLI commands.

## Prerequisites

- [Docker for Mac/Windows](https://docs.docker.com/docker-for-mac/install/) (or Docker for Linux)

Run `docker version` to make sure you have Docker up and running. The of the `docker version` command should look similar to this:

```
$ docker version
Client: Docker Engine - Community
 Version:           19.03.3
 API version:       1.40
 Go version:        go1.12.10
 Git commit:        a872fc2
 Built:             Tue Oct  8 00:55:12 2019
 OS/Arch:           darwin/amd64
 Experimental:      true

Server: Docker Engine - Community
 Engine:
  Version:          19.03.3
  API version:      1.40 (minimum version 1.12)
  Go version:       go1.12.10
  Git commit:       a872fc2
  Built:            Tue Oct  8 01:01:15 2019
  OS/Arch:          linux/amd64
  Experimental:     true
 containerd:
  Version:          v1.2.10
  GitCommit:        b34a5c8af56e510852c35414db4c1f4fa6172339
 runc:
  Version:          1.0.0-rc8+dev
  GitCommit:        3e425f80a8c931f88e6d94a8c831b9d5aa481657
 docker-init:
  Version:          0.18.0
  GitCommit:        fec3683
```

## Docker layers

In this exercise you will build a Docker image and inspect different layers that make up that image. All commands are to be run from the `01_docker` folder.

1. Build the Docker image using the `Dockerfile`:

```
docker build -t docker-layers .
```

> Note: we are using `.` to provide the current folder as the build context for the image. You could also build the image from outside of the current folder, just make sure you provide the path to the Dockerfile using `-f` flag and a correct build context (e.g. `docker build -f ./01_docker/Dockerfile -t docker-layers ./01_docker`)

1. Run the image and check the output:

```
$ docker run docker-layers
Hello Docker!
```

1. Check the built Docker image size:

```
$ docker images | grep docker-layers
docker-layers                                                    latest              f7ef8bfd548a        2 minutes ago       8.31MB
```

1. Re-build the image again and notice how this time cached layers are used and the build process is much faster than the first time:

```
$ docker build -t docker-layers .
...
real    0m0.227s
user    0m0.079s
sys     0m0.052s

```

> Note: on Mac/Linux, you could use `time docker build -t docker-layers .` to time the execution.

1. Using `docker history` command, inspect the layers in the image:

```
docker history docker-layers
```

1. Notice a separate layer gets created for `apk update` and `apk add curl` commands. You can make this better and more efficient by combining both commands into a single command like this:

```
RUN apk update && apk add install
```

1. Now you can update the `Dockerfile` and rebuild it:

```
docker build -t docker-layers .
```

1. Check the layers on the image again, and you will notice the two commands are on the same layer now:

```
$ docker history docker-layers
7043f703e3f7        2 minutes ago        /bin/sh -c apk update && apt add curl   2.76MB
```

1. Add the `hello.txt` to the image, by adding the `COPY hello.txt /app` line to the `Dockerfile`:

```
FROM alpine:3.10.3
WORKDIR /app
COPY hello.sh /app
RUN chmod +x hello.sh
COPY hello.txt /app
RUN apk update && apk add curl
CMD ["./hello.sh"]
```

1. Rebuild the image and observe what happens:

```
docker build -t docker-layers .
```

Notice how the `apk` commands are executed again. That is because the way layers are stacked and the new layer is a difference between the previous one - this causes the `apk` commands to get re-executed again.

1. Let's try to optimize this. Move the `apk` commands right under the `FROM` command:

```
FROM alpine:3.10.3
RUN apk update && apk add curl
WORKDIR /app
COPY hello.sh /app
RUN chmod +x hello.sh
COPY hello.txt /app
CMD ["./hello.sh"]
```

1. Rebuild the image again:

```
docker build -t docker-layers .
```

The second step in the Dockerfile is now updating and adding curl. Just like previously, image will get rebuilt and the new layer be created. If you add a second file (`bye.txt`), you will notice that the build command is significantly faster this time and the `apk` layer is not rebuilt as the cached version is used.

1. Add the `bye.txt` to the Dockerfile:

```
FROM ubuntu:18.04
RUN apt-get update && apt-get install curl -y
WORKDIR /app
COPY hello.sh /app
RUN chmod +x hello.sh
COPY hello.txt /app
COPY bye.txt /app
CMD ["./hello.sh"]
```

1. Rebuild the image:

```
docker build -t docker-layers .
```

## Docker Hub (push and tag)

1. Login (or created the account) in Docker hub at https://hub.docker.com (you can also login through the Docker for Mac/Windows application)

> Note: In order to push the image to the Docker hub, you need to tag the image using the repository name. Default repository name is the account name use used when you created the Docker hub account (e.g. `peterj`). Alternatively, you can create an organization and use that as your repository name (e.g. `peterjvelocity`).

1. Tag the `docker-layers` image:

```
docker tag docker-layers [repository]/docker-layers
```

1. List the image and double check that the image was tagged:

```
$ docker images | grep docker-layers
peterjvelocity/docker-layers                 latest              4749e2d84376        4 minutes ago       8.31MB
docker-layers                        latest              4749e2d84376        4 minutes ago       8.31MB
```

1. Now you can push the image to your repository (replace `peterjvelocity` with your own repository name):

```
docker push peterjvelocity/docker-layers
```

Since we didn't provide any tags for the image, the image will have the `latest` tag - you can check that in the Docker hub.

1. Let's tag the image with version number `0.1.0`:

```
docker tag peterjvelocity/docker-layers peterjvelocity/docker-layers:0.1.0
```

1. Now we need to push it to the registry. Notice how the push is significantly faster this time. This is because all layers are already pushed to the registry, and the only thing that's changed is the tag name.

```
docker push peterjvelocity/docker-layers:0.1.0
```

## Pull and Run

To pull an image from a public Docker registry, you can use the `pull` command. For example:

```
$ docker pull alpine
Using default tag: latest
latest: Pulling from library/alpine
89d9c30c1d48: Pull complete
Digest: sha256:c19173c5ada610a5989151111163d28a67368362762534d8a8121ce95cf2bd5a
Status: Downloaded newer image for alpine:latest
docker.io/library/alpine:latest
```

Alternatively, you can just use the `run` command and Docker CLI will pull the image if the image is not available on the local machine yet and create a container:

```
docker run alpine
```

Using the run command we can create a container and get a shell prompt inside the container - you need to provide the `-i` and `-t` flags to make the container interactive and to allocate a pseudo TTY. Finally, you need to provide the command we want to run - in our case, we want to run the shell (`/bin/sh`):

```
$ docker run -it alpine /bin/sh
/ # env
HOSTNAME=bc54218a9cea
SHLVL=1
HOME=/root
TERM=xterm
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
PWD=/
```

Once we are inside the container, you can run e.g. `env` command to see the environment variables.

To exit from the container, you can type `exit`. Alternatively, you can kill the running container like this:

1. Open a separate terminal window and list the running containers using the `ps` command:

```
$ docker ps
CONTAINER ID        IMAGE                COMMAND                  CREATED             STATUS
 PORTS                                  NAMES
bc54218a9cea        alpine               "/bin/sh"                2 minutes ago       Up 2 minutes
                                        nostalgic_goldstine
```

To stop or kill the running container you can either use the container ID (`bc54218a9cea`above) or the container name (`nostaligc_goldstine`). Note: the name (if not provided) is set randomly.

Finally, you can kill the container with the `kill` command:

```
docker kill bc54218a9cea
```

You will notice the prompt from the previous terminal will exit.

# Exposing ports

Another fairly common task is running a container locally and exposing a port. For example, you can run a service inside the container, but in order to access that service, you will need to expose the container port to your host machine port so you can access it.

Let's use a simple Node.js application that's packaged in the `learncloudnative/helloworld:0.1.0` image.

If you just run the image, you won't be able to access the application running inside it, as the port the application is listening on within the container is not exposed to your machine.

To expose the container port to the host port, you can use the `-p` flag when running the container, like this:

```
$ docker run -p 8080:3000 learncloudnative/helloworld:0.1.0

> helloworld@1.0.0 start /app
> node server.js

Listening on port 3000
```

The first port number in the above command (`8080`) is the port we want to expose on the host machine, and the second port (`3000`) is the port application is listening on inside the container.

If you open `http://localhost:8080` you will get a response back from the application running within the container.
