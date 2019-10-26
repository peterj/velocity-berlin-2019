const express = require('express');
const morgan = require('morgan');
const amqp = require('amqplib');
const app = express();
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const QueueUrl = process.env.QUEUE_URL || `amqp://localhost`;
const ExchangeName = process.env.EXCHANGE_NAME || 'email-pub-sub';
const Port = process.env.PORT || 3002;

let channel = null;

// Connects to the queue and creates a channel
const initQueue = async () => {
    console.log(`Connecting to ${QueueUrl}`);
    amqp.connect(QueueUrl)
        .then(c => c.createChannel())
        .then(ch => {
            console.log('Channel created.');
            channel = ch;

            ch.assertExchange(ExchangeName, 'topic', { durable: false });
            ch.assertQueue('', { exclusive: true }).then(q => {
                ch.bindQueue(q.queue, ExchangeName, 'account.sendActivationCode');
                ch.bindQueue(q.queue, ExchangeName, 'account.activated');

                ch.consume(q.queue, (msg) => {
                    if (msg.fields.routingKey === 'account.sendActivationCode') {
                        console.log(`Sending activation email with payload ${msg.content.toString()}`);
                    } else if (msg.fields.routingKey === 'account.activated') {
                        console.log(`Sending welcome email using payload ${msg.content.toString()}`);
                    }
                });
            });
        });

};

app.listen(Port, async () => {
    initQueue();
    console.log(`Listening on ${Port}`);
});

process.on('exit', () => {
    channel.close();
    console.log('Exiting...');
});
