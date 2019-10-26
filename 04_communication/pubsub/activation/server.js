const express = require('express');
const morgan = require('morgan');
const amqp = require('amqplib');
const app = express();
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const QueueUrl = process.env.QUEUE_URL || `amqp://localhost`;
const ExchangeName = process.env.EXCHANGE_NAME || 'email-pub-sub';
const Port = process.env.PORT || 3001;

// creates an activation code
const createActivationCode = () => (Math.ceil(Math.random() * 10000)).toString();


// Storing activations (e.g. { "email": "mail", "activationCode": "code"})
let allActivations = [];

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
                ch.bindQueue(q.queue, ExchangeName, 'account.*');
                ch.consume(q.queue, (msg) => {
                    const msgContent = msg.content.toString();

                    switch (msg.fields.routingKey) {
                        case 'account.signup': {
                            const payload = {
                                "email": msgContent,
                                "activationCode": createActivationCode(),
                            };

                            payload.activated = false;

                            // Store this in memory
                            allActivations.push(payload);

                            console.log('Publishing event account.sendActivationCode ...');
                            // Publish the account.activate event
                            ch.publish(
                                ExchangeName,
                                'account.sendActivationCode',
                                Buffer.from(JSON.stringify(payload)),
                                { correlationId: msg.properties.correlationId })
                            return;
                        }

                        case 'account.activate': {
                            for (var a in allActivations) {
                                const act = allActivations[a];
                                if (act.activationCode === msgContent) {
                                    if (act.activated) {
                                        console.log(`Account is already activated!`);
                                    } else {
                                        console.log(`Activating account ${act.email}`);
                                        ch.publish(
                                            ExchangeName,
                                            'account.activated',
                                            Buffer.from(JSON.stringify(act)),
                                            { correlationId: msg.properties.correlationId })
                                    }
                                }
                            }

                        }
                    }



                }, { noAck: true });
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
