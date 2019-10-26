const express = require('express');
const morgan = require('morgan');
const amqp = require('amqplib');
const app = express();
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const QueueUrl = process.env.QUEUE_URL || `amqp://localhost`;
const ExchangeName = process.env.EXCHANGE_NAME || 'email-pub-sub';
const Port = process.env.PORT || 3000;

// creates an id
const createId = () => Math.random().toString() + Math.random().toString() + Math.random().toString();

let channel = null;

// Connects to the queue and creates a channel
const initQueue = () => {
    console.log(`Connecting to ${QueueUrl}`);
    amqp.connect(QueueUrl)
        .then(c => c.createChannel())
        .then(ch => {
            console.log('Channel created.');
            channel = ch;
            channel.assertExchange(ExchangeName, 'topic', {
                durable: false
            });
        });
};

// Register the user, needs payload: { "email": "hello@learncloudnative.com" }
app.post('/register', async (req, res) => {
    const email = req.body.email;
    console.log(`Starting registration flow for ${email}`);

    const key = "account.signup"
    // Send the email to the account.signup key
    channel.publish(ExchangeName, key, Buffer.from(req.body.email), { correlationId: createId() });
    res.status(200).json({ msg: "ok" });
});

app.post('/activate', async (req, res) => {
    const activationCode = req.body.activationCode;

    console.log(`Starting activation flow using code ${activationCode}`);

    const key = "account.activate";
    channel.publish(ExchangeName, key, Buffer.from(req.body.activationCode), { correlationId: createId() });
    res.status(200).json({ msg: "ok" });
});

app.listen(Port, async () => {
    initQueue();
    console.log(`Listening on ${Port}`);
});

process.on('exit', () => {
    channel.close();
    console.log('Exiting...');
});
