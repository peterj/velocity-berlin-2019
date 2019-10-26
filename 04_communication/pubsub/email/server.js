const amqp = require('amqplib');

const RabbitMqUrl = process.env.RABBIT_MQ_URL || `amqp://localhost`;
const ExchangeName = process.env.EXCHANGE_NAME || 'email-pub-sub';
const MaxConnectRetries = parseInt(process.env.MAX_CONNECT_RETRIES) || 5;
const ConnectRetrySleep = parseInt(process.env.CONNECT_RETRY_SLEEP, 10) || 4000;

// Events
const AccountSendActivationCodeEvent = 'account.sendActivationCode';
const AccountActivatedEvent = 'account.activated';

let channel = null;
let currentConnectionRetry = 1;

// Connect to RabbitMQ
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
}

const consume = (channel) => {
    channel.assertQueue('', { exclusive: true }).then(q => {
        channel.bindQueue(q.queue, ExchangeName, AccountSendActivationCodeEvent);
        channel.bindQueue(q.queue, ExchangeName, AccountActivatedEvent);

        channel.consume(q.queue, (msg) => {
            if (msg.fields.routingKey === AccountSendActivationCodeEvent) {
                console.log(`[Email]: Received event "${AccountSendActivationCodeEvent}". Sending activation email with payload "${msg.content.toString()}"`);
            } else if (msg.fields.routingKey === AccountActivatedEvent) {
                console.log(`[Email]: Received event "${AccountActivatedEvent}". Sending welcome email using payload "${msg.content.toString()}"`);
            }
        });
    });
};

createConnection();

process.on('exit', () => {
    if (channel !== null) {
        channel.close();
    }
    console.log('[Email]: Exiting...');
});