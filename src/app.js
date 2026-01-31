/**
 * Express Application Setup
 * 미들웨어 등록 및 라우트 연결
 */

const express = require('express');
const registerRoutes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// 미들웨어
app.use(express.json());

// 라우트 등록
registerRoutes(app);

// 에러 핸들러 (라우트 등록 이후에 위치해야 함)
app.use(errorHandler);

module.exports = app;
