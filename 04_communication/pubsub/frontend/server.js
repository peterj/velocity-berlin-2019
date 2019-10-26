const express = require('express');
const morgan = require('morgan');
const amqp = require('amqplib');
const app = express();
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const RabbitMqUrl = process.env.RABBIT_MQ_URL || `amqp://localhost`;
const ExchangeName = process.env.EXCHANGE_NAME || 'email-pub-sub';
const MaxConnectRetries = parseInt(process.env.MAX_CONNECT_RETRIES) || 5;
const ConnectRetrySleep = parseInt(process.env.CONNECT_RETRY_SLEEP, 10) || 4000;
const Port = process.env.PORT || 3000;

// creates an id
const createId = () => Math.random().toString() + Math.random().toString() + Math.random().toString();

const AccountSignupEvent = 'account.signup';
const AccountActivateEvent = 'account.activate';

let channel = null;
let currentConnectionRetry = 1;

// connect to RabbitMQ
const connect = (url) => {
    return amqp.connect(url);
}

// create the connection with retries
const createConnection = () => {
    const url = `${RabbitMqUrl}?heartbeat=60`;
    console.log('[RabbitMQ]: Connecting to', url);
    return connect(url)
        .then((conn) => {
            console.log("[RabbitMQ]: Connected");
            currentConnectionRetry = 0;
            return conn.createChannel();
        }).then(ch => {
            console.log('[RabbitMQ]: Channel created');
            channel = ch;
            channel.assertExchange(ExchangeName, 'topic', {
                durable: false
            });

            startServer();
        }).catch(err => {
            if (err.code === 'ECONNREFUSED') {
                if (currentConnectionRetry <= MaxConnectRetries) {
                    console.error(`[RabbitMQ]: Error connecting. Retry ${currentConnectionRetry}/${MaxConnectRetries}...`);
                    currentConnectionRetry++;
                    return setTimeout(createConnection, ConnectRetrySleep);
                } else {
                    console.error(`[RabbitMQ]: Failed to connect after ${MaxConnectRetries} retries and ${ConnectRetrySleep * MaxConnectRetries} ms. Giving up.`)
                    process.exit(1);
                }
            }
            console.error('[RabbitMQ]: Error connecting', err);
        });
}

// Register the user, needs payload: { "email": "hello@learncloudnative.com" }
app.post('/register', async (req, res) => {
    const email = req.body.email;
    console.log(`[Frontend]: Publishing event "${AccountSignupEvent}" for "${email}"`);

    // Send the email to the account.signup key
    channel.publish(ExchangeName, AccountSignupEvent, Buffer.from(req.body.email), { correlationId: createId() });
    res.status(200).json({ msg: "ok" });
});

app.post('/activate', async (req, res) => {
    const activationCode = req.body.activationCode;
    console.log(`[Frontend]: Publishing event "${AccountActivateEvent}" using code "${activationCode}"`);

    channel.publish(ExchangeName, AccountActivateEvent, Buffer.from(req.body.activationCode), { correlationId: createId() });
    res.status(200).json({ msg: "ok" });
});

const startServer = () => {
    app.listen(Port, () => {
        console.log(`[Frontend]: Listening on ${Port}`);
    });
};

createConnection();

process.on('exit', () => {
    if (channel !== null) {
        channel.close();
    }
    console.log('[Frontend]: Exiting...');
});
