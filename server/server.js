// DB password: k7W0JhLZo53JmpKc
const express = require('express');
const mongoose = require('mongoose');


//create a DB connection -> u can also
//create a seperate file for this then import/use that file

mongoose.connect(process.env.)
  .then(() => console.log('MongoDB: connected'))
  .catch((error) => console.log(error));

const PORT = process.env.PORT || 5000;

const app = express();
