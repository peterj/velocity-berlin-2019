const express = require('express');
const morgan = require('morgan');
const app = express();

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const Port = process.env.PORT || 3001;

app.post('/', async (req, res) => {
    const message = req.body.content;
    console.log(`${new Date().toUTCString()} - received "${message}"`);
    res.json({ msg: reverseString(message) });
});


app.listen(Port, () => {
    console.log(`Listening on ${Port}`);
});

process.on('exit', () => {
    console.log('Exiting...');
});

const reverseString = (str) => str.split("").reverse().join("");