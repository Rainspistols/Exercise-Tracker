require('dotenv').config();
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const moment = require('moment');

const { Schema } = mongoose;
const PORT = process.env.PORT || '8080';

app.use(cors({ optionsSuccessStatus: 200 }));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(__dirname + '/build'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/build/index.html');
});

// MongoDB Schema
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
});

const UserSchema = new Schema({
  username: { type: String, required: true },
  _id: String,
  count: { type: Number, default: 0 },
  log: [{ description: String, duration: Number, date: String }],
});

const User = mongoose.model('user', UserSchema);

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || 'Internal Server Error';
  }
  res.status(errCode).send(errMessage);
});

const postNewUser = (req, res) => {
  User.estimatedDocumentCount().exec((err, count) => {
    const newUser = new User({
      username: req.body.username,
      _id: count,
    });

    newUser.save((err, savedUser) => {
      if (err) return res.send(err);
      return res.json(savedUser);
    });
  });
};

const getAllUsers = (req, res) => {
  User.find({}, (err, users) => {
    res.json(users);
  });
};

const addExercise = (req, res) => {
  let { userId, description, duration, date } = req.body;
  if (!date) {
    date = moment().format('ddd MMM DD YYYY');
  }

  User.findById(userId, (err, updatedUser) => {
    if (!updatedUser) return res.send('User not found');
    const changes = {
      date: moment(date).format('ddd MMM DD YYYY'),
      description: description,
      duration: +duration,
    };
    updatedUser.log.push(changes);
    updatedUser.count = updatedUser.log.length;
    updatedUser.save((err, updatedUser2) => {
      if (err) return res.json(err);
      return res.json({
        ...changes,
        _id: userId,
        username: updatedUser2.username,
      });
    });
  });
};

const getLogByUser = (req, res) => {
  const { userId, from, to, limit } = req.query;

  User.findById(userId, (err, userFounded) => {
    if (limit) {
      const limitedLog = userFounded.log.slice(0, limit);
      userFounded.log = limitedLog;
      userFounded.count = limitedLog.length;
    }

    if (from && to) {
      const start = new Date(from).getTime();
      const end = new Date(to).getTime();
      const log = userFounded.log;
      console.log(start, end);
      log.filter((item) => {
        const dateInTS = new Date(item.date).getTime();
        return dateInTS > start && dateInTS < end;
      });
      userFounded.log = log;
    }
    return res.json(userFounded);
  });
};

app.post('/api/exercise/new-user', postNewUser);
app.get('/api/exercise/users', getAllUsers);
app.post('/api/exercise/add', addExercise);
app.get('/api/exercise/log', getLogByUser);

const listener = app.listen(PORT, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});
