const { celebrate, Joi } = require('celebrate');
const router = require('express').Router();
const { getAllPageFiles, getFile } = require('../controllers/files');

router.post('/file', celebrate({
    body: Joi.object().keys({
        fileName: Joi.string().required().min(10),
    })
}), getFile);

router.post('/files', celebrate({
    body: Joi.object().keys({
        folderName: Joi.string().required(),
    })
}), getAllPageFiles);

module.exports = router;
