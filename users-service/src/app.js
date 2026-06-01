const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

app.use(express.json());

const usersRouter = require('./routes/users');
app.use('/users', usersRouter);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Users service rodando na porta ${PORT}`);
});