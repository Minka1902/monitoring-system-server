const { celebrate, Joi } = require('celebrate');
const router = require('express').Router();
const { getPageData } = require('../controllers/data');

router.post('/page-data', celebrate({
    body: Joi.object().keys({
        dataNames: Joi.array().items(Joi.string()).required(),
        wellNames: Joi.array().items(Joi.string()).required(),
    })
}), getPageData);

module.exports = router;
