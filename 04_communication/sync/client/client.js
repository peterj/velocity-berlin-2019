const express = require('express');
const morgan = require('morgan');
const request = require('request');
const app = express();
app.use(morgan('dev'));

const ServerUrl = process.env.SERVER_URL || `http://localhost:3001`;
const Port = process.env.PORT || 3000;

// creates an id
const createId = () => Math.random().toString() + Math.random().toString() + Math.random().toString();

let channel = null;

app.get('/:msg', async (req, res) => {
    const message = req.params.msg;
    request.post(ServerUrl, {
        json: {
            content: message,
            correlationId: createId(),
        }
    }, (err, resp, body) => {
        if (err) {
            res.status(500).json(err);
        } else {
            res.json(body);
        }
    });
});


app.listen(Port, () => {
    console.log(`Listening on ${Port}`);
});

process.on('exit', () => {
    console.log('Exiting...');
});
