const express = require('express');
const morgan = require('morgan');
const app = express();
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const Port = process.env.PORT || 3001;

app.get('/uppercase/:value', async (req, res) => {
    const value = req.params.value;
    setTimeout(() =>
        res.status(200).json({ result: value.toUpperCase() }), 2000);
});

app.listen(Port, () => {
    console.log(`[Uppercase]: Listening on ${Port}`);
});
