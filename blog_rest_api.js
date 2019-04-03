const path = require('path');
const fs = require('fs');

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const feedRoutes = require('./routes/feed');
const authRoutes = require('./routes/auth');

const blog_rest_api = express();

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'images');
  },
  filename: (req, file, cb) => {
    cb(null, (Math.random()*10000) + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/jpg' ||
    file.mimetype === 'image/jpeg'
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'),
    {flags: 'a'});

blog_rest_api.use(helmet());
blog_rest_api.use(compression());
blog_rest_api.use(morgan('combined', {stream: accessLogStream}));

// blog_rest_api.use(bodyParser.urlencoded()); // x-www-form-urlencoded <form>
blog_rest_api.use(bodyParser.json()); // application/json
blog_rest_api.use(
  multer({ storage: fileStorage, fileFilter: fileFilter }).single('image')
);
blog_rest_api.use('/images', express.static(path.join(__dirname, 'images')));

blog_rest_api.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'OPTIONS, GET, POST, PUT, PATCH, DELETE'
  );
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

blog_rest_api.use('/feed', feedRoutes);
blog_rest_api.use('/auth', authRoutes);

blog_rest_api.use((error, req, res, next) => {
  console.log(error);
  const status = error.statusCode || 500;
  const message = error.message;
  const data = error.data;
  res.status(status).json({ message: message, data: data });
});

mongoose
  .connect(process.env.MONGO_CONNECTION_STRING)
  .then(result => {
    const server = blog_rest_api.listen(process.env.PORT || 8080);
    const io = require('./socket').init(server);
    io.on('connection', socket => {
      console.log('Client connected');
    });
  })
  .catch(err => console.log(err));
