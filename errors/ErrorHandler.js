class ErrorHandler extends Error {
  constructor(statusCode, message) {
    super();
    this.statusCode = statusCode;
    this.message = message;
  }
}

const checkError = (err, req, res) => {
  if (err.name == 'CastError') {
    return res.status(400).send({ message: 'Data invalid.' });
  } if (err.name == 'ForbiddenError') {
    return res.status(403).send({ message: 'Can`t delete object.' });
  } if (err.name == 'DocumentNotFoundError') {
    return res.status(404).send({ message: 'Object not found.' });
  } if (err.name == 'ValidationError') {
    return res.status(422).send({ message: 'Validation error.' });
  } if (err.name == 'PayloadTooLargeError') {
    return res.status(413).send({ message: 'Content to long.' })
  } else {
    return res.status(500).send({ message: 'An error has occurred on the server.' });
  }
};

const handleError = (err, req, res) => {
  checkError(err, req, res);
};

module.exports = { handleError, ErrorHandler };
