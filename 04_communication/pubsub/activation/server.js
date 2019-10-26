const amqp = require('amqplib');

const RabbitMqUrl = process.env.RABBIT_MQ_URL || `amqp://localhost`;
const ExchangeName = process.env.EXCHANGE_NAME || 'email-pub-sub';
const MaxConnectRetries = parseInt(process.env.MAX_CONNECT_RETRIES) || 5;
const ConnectRetrySleep = parseInt(process.env.CONNECT_RETRY_SLEEP, 10) || 4000;

// creates an activation code
const createActivationCode = () => (Math.ceil(Math.random() * 10000)).toString();

// Events
const AllAccountEvents = 'account.*';
const AccountSignupEvent = 'account.signup';
const AccountActivateEvent = 'account.activate';
const AccountActivatedEvent = 'account.activated';
const AccountSendActivationCodeEvent = 'account.sendActivationCode';

// Storing activations (e.g. { "email": "mail", "activationCode": "code"})
let allActivations = [];

let channel = null;
let currentConnectionRetry = 1;

// Connect to RabbitMQ
const connect = (url) => {
    return amqp.connect(url);
};

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

            consume(channel);
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
};

const consume = (channel) => {
    channel.assertQueue('', { exclusive: true }).then(q => {
        channel.bindQueue(q.queue, ExchangeName, AllAccountEvents);
        channel.consume(q.queue, (msg) => {
            const msgContent = msg.content.toString();

            switch (msg.fields.routingKey) {
                case AccountSignupEvent: {
                    const payload = {
                        "email": msgContent,
                        "activationCode": createActivationCode(),
                    };

                    payload.activated = false;

                    // Store this in memory
                    allActivations.push(payload);

                    console.log(`[Activation]: Received event "${AccountSignupEvent}" for "${msgContent}"`);
                    console.log(`[Activation]: Publishing event "${AccountSendActivationCodeEvent}" for "${msgContent}"`);
                    // Publish the account.sendActivationCode event
                    channel.publish(
                        ExchangeName,
                        AccountSendActivationCodeEvent,
                        Buffer.from(JSON.stringify(payload)),
                        { correlationId: msg.properties.correlationId })
                    return;
                }

                case AccountActivateEvent: {
                    console.log(`[Activation]: Received event "${AccountActivateEvent}" for "${msgContent}"`);
                    for (var a in allActivations) {
                        const act = allActivations[a];
                        if (act.activationCode === msgContent) {
                            if (act.activated) {
                                console.log(`[Activation]: Account "${act.email}" is already activated`);
                            } else {
                                console.log(`[Activation]: Activating account "${act.email}"`);
                                act.activated = true;

                                console.log(`[Activation]: Publishing event "${AccountActivatedEvent}" for "${act.email}"`);
                                channel.publish(
                                    ExchangeName,
                                    AccountActivatedEvent,
                                    Buffer.from(JSON.stringify(act)),
                                    { correlationId: msg.properties.correlationId })
                            }
                        }
                    }

                }
            }

        }, { noAck: true });
    });
};

createConnection();

process.on('exit', () => {
    if (channel !== null) {
        channel.close();
    }
    console.log('[Activation]: Exiting...');
});
