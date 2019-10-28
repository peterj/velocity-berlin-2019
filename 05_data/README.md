# Working with Data

In this exercise you will work with a web frontend and a backend service that takes a string as an input and returns the same string in the uppercase. The backend service is slow, so we are caching the value using Redis.

## Caching

Redis is an applications you can use for key-value item store. You can use Redis as a short-term cache for your data.

To launch Redis, run:

```
docker run -d -p 6379:6379 redis
```

Next, you can run the `uppercase` service and the `web` frontend by running the following commands from their respective folders (`./caching/uppercase` and `./caching/web`):

```
npm install
npm run
```

To test the application, open `http://localhost:3000` and enter your name, click the button and wait for the result. Note how long the first call took. Next, submit the exact same value again and notice that this time it takes significantly less, because we are using Redis to cache the values.

## Cache invalidation

Implement an `/invalidate` endpoint on the web frontend that invalidates the cache. You can use a nuclear option with the function on the Redis called `flushall` to delete all keys.

Think about implementing a cache invalidation in a different way; either using a TTL or invalidating a cache based on the request headers.

## Docker compose

Create a `docker-compose.yaml` file to bring all services up. Look at the sample Docker compose file in the pubsub example in the communication folder.
