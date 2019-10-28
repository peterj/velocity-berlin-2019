const path = require('path');
const express = require('express');
const morgan = require('morgan');
const request = require('request');
const redis = require('redis');
const app = express();

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
app.use(express.static(path.join(__dirname, 'public')));

const Port = process.env.PORT || 3000;
const UppercaseServiceUrl = process.env.UPPERCASE_SERVICE_URL || "http://localhost:3001";
const RedisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379"

const redisClient = redis.createClient(RedisUrl);

app.get('/', (req, res) => {
    res.render('index', {});
});

app.get('/uppercase', (req, res) => {
    const name = req.query.name;

    const start = new Date();
    console.log(`[Redis]: Checking for key "${name}" in the cache`);
    redisClient.get(name, (err, cachedValue) => {
        // We don't have the cached value yet.
        if (cachedValue === null) {
            const url = `${UppercaseServiceUrl}/uppercase/${name}`;
            console.log(`[Web]: Calling service URL "${url}"`);

            request.get(url, (err, resp, body) => {
                const end = new Date();
                const timems = end - start;

                const result = {
                    result: JSON.parse(body).result,
                    time: timems,
                }
                console.log(`[Redis]: Caching value for key "${name}"`);

                // Store the value in the cache
                redisClient.set(name, result.result);
                res.render('result', result);
            });
        } else {
            // We can use the cached value!
            const end = new Date();
            const timems = end - start;
            const result = {
                result: cachedValue,
                time: timems,
            }
            console.log(`[Redis]: Using cached value for key "${name}"`);
            res.render('result', result);
        }
    });
});

redisClient.on('connect', () => {
    console.log('[Redis]: Connected');
    app.listen(Port, () => {
        console.log(`[Web]: Listening on ${Port}`);
    });
});

redisClient.on('error', (err) => console.error('[Redis]: Error ocurred', err));