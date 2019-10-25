const amqp = require('amqplib/callback_api');

const QueueUrl = process.env.QUEUE_URL || `amqp://localhost`;
const QueueName = process.env.QUEUE_NAME || 'requestQueue';

let channel = null;

console.log(`Connecting to ${QueueUrl}`);

amqp.connect(QueueUrl, (err, conn) => {
    if (err) {
        console.error(`Failed to connect to ${QueueUrl}.`, err);
        process.exit(1);
    }

    console.log('Connected.');
    conn.createChannel((err, ch) => {
        channel = ch;
        if (err) {
            console.error(`Failed to create channel.`, err);
            process.exit(1);
        }

        const queueOptions = {
            durable: false
        };

        ch.assertQueue(QueueName, queueOptions);

        // Max number of messages that can be awaiting acknowledgment
        ch.prefetch(100);

        console.log('Waiting for requests');

        // Consume messages from the queue
        ch.consume(QueueName, (msg) => {
            console.log(`${new Date().toUTCString()} - received "${msg.content.toString()}"`);
            const reversedString = reverseString(msg.content.toString());

            console.log(`${new Date().toUTCString()} - sending "${reversedString}"`);

            // Send the processed string back to the queue
            // that was defined in the `replyTo` option.
            ch.sendToQueue(
                msg.properties.replyTo,
                Buffer.from(reversedString),
                { correlationId: msg.properties.correlationId });

            // Acknowledge the message
            ch.ack(msg);
        });
    });
});

const reverseString = (str) => str.split("").reverse().join("");

process.on('exit', () => {
    channel.close();
    console.log('Exiting...');
});
