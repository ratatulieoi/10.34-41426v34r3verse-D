const express = require('express');
const router = express.Router();
const config = require('../../config');

router.get('/', (req, res) => {
  const models = Object.keys(config.models).map(modelId => {
    return {
      id: modelId,
      object: 'model',
      created: 1686935002,
      owned_by: 'vear-reverse'
    };
  });

  res.json({
    object: 'list',
    data: models
  });
});

module.exports = router;
