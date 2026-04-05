const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const AppError = require('./utils/AppError');
const globalErrorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Routes
const authRoutes = require('./routes/authRoutes');
const recordRoutes = require('./routes/recordRoutes');
const summaryRoutes = require('./routes/summaryRoutes');
const userRoutes = require('./routes/userRoutes');

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/records', recordRoutes);
app.use('/api/v1/summary', summaryRoutes);
app.use('/api/v1/users', userRoutes);

// 404 Route Handler
app.use((req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global Error Handler
app.use(globalErrorHandler);

module.exports = app;
