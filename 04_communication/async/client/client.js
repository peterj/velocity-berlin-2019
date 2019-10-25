const express = require('express');
const morgan = require('morgan');
const amqp = require('amqplib');
const app = express();
app.use(morgan('dev'));

const QueueUrl = process.env.QUEUE_URL || `amqp://localhost`;
const QueueName = process.env.QUEUE_NAME || 'requestQueue';
const Port = process.env.PORT || 3000;

// creates an id
const createId = () => Math.random().toString() + Math.random().toString() + Math.random().toString();

let channel = null;
let queue = null;

// Connects to the queue and creates a channel
const initQueue = () => {
    console.log(`Connecting to ${QueueUrl}`);
    amqp.connect(QueueUrl)
        .then(c => c.createChannel())
        .then(ch => {
            console.log('Channel created.');
            channel = ch;
            queue = channel.assertQueue('', { exclusive: true }).catch(err => console.error("Failed to assert queue:", err))
        });
};


app.get('/:msg', async (req, res) => {
    const message = req.params.msg;
    console.log(`${new Date().toUTCString()} - request received "${message}"`);

    const correlationId = createId();

    // Listen on the queue and wait for the response to come back.
    // No need to ack the the message as we exit anyway.
    channel.consume(queue.name, (msg) => {
        if (msg.properties.correlationId === correlationId) {
            console.log(`${new Date().toUTCString()} - message received "${msg.content.toString()}"`);
            res.json({ msg: msg.content.toString() });
        }
    }, { noAck: true });

    // Send the message to the queue and provide the
    // correlation ID as well as the queue name where
    // we are listening for response.
    channel.sendToQueue(QueueName, Buffer.from(message), {
        correlationId: correlationId,
        replyTo: queue.queue
    });
});


app.listen(Port, async () => {
    initQueue();
    console.log(`Listening on ${Port}`);
});

process.on('exit', () => {
    channel.close();
    console.log('Exiting...');
});
