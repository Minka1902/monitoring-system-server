const { celebrate, Joi } = require('celebrate');
const router = require('express').Router();
const { getAllPageFiles, getFile } = require('../controllers/files');

router.post('/file', celebrate({
    body: Joi.object().keys({
        fileName: Joi.string().required().min(10),
    })
}), getFile);

module.exports = router;
