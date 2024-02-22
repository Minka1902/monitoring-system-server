const { celebrate, Joi } = require('celebrate');
const router = require('express').Router();
const { getArrayOfWells, getFileStructure, scanDirectoryTree } = require('../controllers/reservoirs');

router.post('/reservoir', celebrate({
    body: Joi.object().keys({
        path: Joi.string().required(),
    }),
}), getArrayOfWells);

router.post('/fields', celebrate({
    body: Joi.object().keys({
        folderName: Joi.string().required(),
    })
}), scanDirectoryTree);

router.get('/reservoirs', getFileStructure);

module.exports = router;
