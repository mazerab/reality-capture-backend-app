'use strict';

const bodyParser = require('body-parser');
const { Expo } = require('expo-server-sdk');
const express = require('express');
const forgeSDK = require('forge-apis');
const helmet = require('helmet');
const redis = require('redis');
const rp = require('request-promise');

// Load configuration settings
const config = require('./config');

// Load Redis
const client = redis.createClient(config.REDIS_PORT, config.REDIS_ENDPOINT, { no_ready_check: true });
client.auth(process.env.REDIS_PASSWORD, function (err) {
  if (err) { console.error(`ERROR: Redis authentification failed: ${err}`); }
})
client.on('connect', function () { console.info('INFO: Connected to Redis'); })

// Load Expo SDK client
const expo = new Expo();

// Load express
const app = express();
app.use(helmet());

// Load bodyParser
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Redis endpoints
const redisRouter = express.Router();
redisRouter.post('/initSessionState', (req, res) => {
  client.set('filename', 'blank', redis.print);
  client.set('filesize', 0, redis.print);
  client.del('imageUris', redis.print);
  client.set('objectid', 'blank', redis.print);
  client.set('photosceneid', 'blank', redis.print);
  client.set('photoscenelink', 'blank', redis.print);
  client.set('processingstatus', 'NotStarted', redis.print);
  client.set('pushToken', 'blank', redis.print);
  client.set('token', 'blank', redis.print);
  res.send({'InitializedSessionStat;e': 'Done'});
  res.end();
});
redisRouter.get('/filename', function (req, res) {
  client.get('filename', function (err, reply) {
    if (reply) { res.send({'filename': reply, 'source': 'redis cache'}); }
    if (err) { res.status(500).send({'Redis': err}); }
  });
});
redisRouter.get('/filesize', function (req, res) {
  client.get('filesize', function (err, reply) {
    if (reply) { res.send({'filesize': reply, 'source': 'redis cache'}); }
    if (err) { res.status(500).send({'Redis': err}); }
  });
});
redisRouter.get('/objectid', function (req, res) {
  client.get('objectid', function (err, reply) {
    if (reply) { res.send({'objectid': reply, 'source': 'redis cache'}); }
    if (err) { res.status(500).send({'Redis': err}); }
  });
});
redisRouter.get('/photosceneid', function (req, res) {
  client.get('photosceneid', function (err, reply) {
    if (reply) { res.send({'photosceneid': reply, 'source': 'redis cache'}); }
    if (err) { res.status(500).send({'Redis': err}); }
  });
});
redisRouter.get('/photoscenelink', function (req, res) {
  client.get('photoscenelink', function (err, reply) {
    if (reply) { res.send({'photoscenelink': reply, 'source': 'redis cache'}); }
    if (err) { res.status(500).send({'Redis': err}); }
  });
});
redisRouter.get('/processingstatus', function (req, res) {
  client.get('processingstatus', function (err, reply) {
    if (reply) { res.send({'processingstatus': reply, 'source': 'redis cache'}); }
    if (err) { res.status(500).send({'Redis': err}); }
  });
});
redisRouter.post('/processingstatus', function (req, res) {
  if (!req.query) { res.status(500).send({'Redis': 'Missing query parameter'}); }
  client.set('processingstatus', req.query.processingstatus, function (err, reply) {
    if (reply) { res.send({'processingstatus': reply, 'source': 'redis cache'}); }
    if (err) { res.status(500).send({'Redis': err}); }
  });
});
redisRouter.get('/imageUris', function (req, res) {
  client.lrange('imageUris', 0, -1, function (err, reply) {
    if (reply) { res.send({'imageUri': reply, 'source': 'redis cache'}); }
    if (err) { res.status(500).send({'Redis': err}); }
  });
});
redisRouter.post('/imageUris', function (req, res) {
  if (!req.query) { res.status(500).send({'Redis': 'Missing query parameter'}); }
  client.rpush(['imageUris', req.query.uri], function (err, reply) {
    if (reply) { res.send({'imageUri': req.query.uri, 'source': 'redis cache'}); }
    if (err) { res.status(500).send({'Redis': err}); }
  });
});
redisRouter.get('/token', function (req, res) {
  client.get('token', function (err, reply) {
    if (reply) { res.send({'token': reply, 'source': 'redis cache'}); }
    if (err) { res.status(500).send({'Redis': err}); }
  });
});
redisRouter.get('/pushToken', function (req, res) {
  client.get('pushToken', function (err, reply) {
    if (reply) { res.send({'pushToken': reply, 'source': 'redis cache'}); }
    if (err) { res.status(500).send({'Redis': err}); }
  });
});
app.use('/redis', redisRouter);

// Expo push endpoints
const expoRouter = express.Router();
expoRouter.post('/tokens', function (req, res) {
  if (!req.body) { res.status(500).send({'Expo': 'Missing body!'}); }
  if (Expo.isExpoPushToken(req.body.pushToken)) {
    client.set('pushToken', req.body.pushToken, function (err, reply) {
      if (reply) { res.send({'pushToken': reply, 'source': 'expo cache'}); }
      if (err) { res.status(500).send({'Expo': err}); }
    })
  } else {
    res.status(500).send({'Expo': 'Unrecognized Expo push token!'});
  }
})
app.use('/expo', expoRouter);

// Recap API endpoints
const recapRouter = express.Router();
recapRouter.post('/processPhotoScene', function (req, res) {
  // Get 2-legged oAuth2 token
  twoLeggedoAuth2Login()
    .then(function (accessToken) {
    // Create PhotoScene
      createPhotoScene(accessToken)
        .then(function (jsonScene) {
          console.info(`PhotoScene response: ${JSON.stringify(jsonScene)}`);
          client.set('photosceneid', jsonScene.Photoscene.photosceneid, redis.print);
          // Start adding S3 image uris to PhotoScene
          client.lrange('imageUris', 0, -1, (err, imageUris) => {
            if (err) {
              console.error('ERROR: Failed to retrieve image uris!');
              res.status(500).send({ 'ERROR': err });
            }
            if (imageUris.length < 3) {
              console.error('ERROR: Cannot submit Photoscene with less than three images!');
              res.status(500).send({'ERROR': 'Cannot submit Photoscene with less than three images!'});
            }
            if (imageUris.length > 2) {
              addImages(accessToken, jsonScene.Photoscene.photosceneid, imageUris)
                .then(function (imagesJson) {
                  // Parse response for errors
                  let foundError = false;
                  for (let idx in imagesJson.Files.file) {
                    if (imagesJson.Files.file[idx].msg !== 'No error') {
                      foundError = true;
                      console.error(`ERROR: Failed to add image: ${imagesJson.Files.file[idx].msg}`);
                      res.status(500).send(imagesJson.Files.file[idx].msg);
                      break;
                    }
                  }
                  if (!foundError) {
                    // Start processing photoscene
                    processPhotoScene(accessToken, jsonScene.Photoscene.photosceneid)
                      .then(function (processJson) {
                        if (processJson.msg === 'No error') {
                          res.send(processJson);
                          res.end();
                        } else {
                          console.error(`ERROR: Failed to process PhotoScene! ${processJson.msg}`);
                          res.status(500).send(processJson.msg);
                        }
                      }, function (err) {
                        console.error('ERROR: Failed to process PhotoScene!');
                        res.status(500).send(err);
                      })
                  }
                }, function (err) {
                  console.error('ERROR: Failed to add images to PhotoScene!');
                  res.status(500).send(err);
                })
            }
          })
        }, function (err) {
          console.error('ERROR: Failed to create PhotoScene!');
          res.status(500).send(err);
        })
    }, function (err) {
      console.error('ERROR: Failed to set two legged oAuth2 token!');
      res.status(500).send(err);
    });
})
recapRouter.get('/scene/callback', function (req, res) {
  client.get('processingstatus', function (err, reply) {
    if (reply === 'InProgress') {
      client.set('processingstatus', 'Completed', function (err, resp) {
        if (resp) {
          client.get('token', function (err, token) {
            if (token) {
              client.get('photosceneid', function (err, photosceneid) {
                if (photosceneid) {
                  downloadProcessedData(token, photosceneid)
                    .then(function (scenedata) {
                      client.set('photoscenelink', scenedata.Photoscene.scenelink, function (err, resp) {
                        if (err) { res.status(500).send({'Redis': err}); }
                        if (resp) {
                          client.set('filesize', scenedata.Photoscene.filesize, function (err, resp) {
                            if (err) { res.status(500).send({'Redis': err}); }
                            if (resp) {
                              let messages = [];
                              client.get('pushToken', function (err, pushToken) {
                                if (err) { res.status(500).send({'Redis': err}); }
                                if (pushToken) {
                                  messages.push({
                                    to: pushToken,
                                    sound: 'default',
                                    body: 'Successfully retrieved photo scenelink',
                                    data: scenedata
                                  });
                                  const chunks = expo.chunkPushNotifications(messages);
                                  expo.sendPushNotificationsAsync(chunks);
                                  res.send({'processingdata': scenedata});
                                  res.end();
                                }
                              })
                            }
                          })
                        }
                      })
                    })
                }
                if (err) { res.status(500).send({'Redis': err}); }
              })
            }
            if (err) { res.status(500).send({'Redis': err}); }
          })
        }
        if (err) { res.status(500).send({'Redis': err}); }
      })
    }
    if (err) { res.status(500).send({'Callback': err}); }
  });
})
recapRouter.delete('/deletePhotoScene', function (req, res) {
  // Get 2-legged oAuth2 token
  twoLeggedoAuth2Login()
    .then(function (accessToken) {
      client.get('photosceneid', function (err, photosceneid) {
        if (err) { res.status(500).send({'Redis': err}); }
        if (photosceneid) {
          deletePhotoScene(accessToken, photosceneid)
            .then(
              function (deleteJson) {
                console.info(`INFO: Successfully deleted PhotoScene: ${JSON.stringify(deleteJson)}`);
                res.send(deleteJson);
                res.end();
              }, function (deleteErr) {
                console.error('ERROR: Failed to delete PhotoScene!');
                res.status(500).send(deleteErr);
              }
            )
        }
      })
    }, function (err) {
      console.error('ERROR: Failed to set two legged oAuth2 token!');
      res.status(500).send(err);
    });
})
app.use('/recap', recapRouter);

module.exports = app;

function addImages (accessToken, photosceneid, imageUris) {
  const endpoint = `${config.REALITY_CAPTURE_BASE_ENDPOINT}/file`;
  const bodyData = {
    'photosceneid': photosceneid,
    'type': 'image'
  };
  for (var idx in imageUris) {
    bodyData['file[' + idx + ']'] = imageUris[idx];
  }
  logInfoToConsole('/file', 'POST', endpoint, bodyData);
  const options = {
    agentOptions: { secureProtocol: config.TLS_VERSION },
    formData: bodyData,
    headers: { 'Authorization': 'Bearer ' + accessToken },
    json: true,
    method: 'POST',
    resolveWithFullResponse: true,
    uri: endpoint
  };
  return rp(options)
    .then(res => {
      if (res.statusCode === 200) {
        return res.body;
      }
      console.error('ERROR: Failed to add images!\n');
    })
    .catch(reason => {
      console.error(`ERROR: Failed to add images: ${JSON.stringify(reason)}\n`);
    });
}

function createPhotoScene (accessToken) {
  const endpoint = `${config.REALITY_CAPTURE_BASE_ENDPOINT}/photoscene`;
  const bodyData = `scenename=${config.SCENENAME}&scenetype=${config.SCENETYPE}&format=${config.FORMAT}&callback=${config.AWS_LAMBDA_BASE_ENDPOINT}${config.SCENECALLBACK}`;
  logInfoToConsole('/photoscene', 'POST', endpoint, bodyData);
  const options = {
    agentOptions: { secureProtocol: config.TLS_VERSION },
    body: bodyData,
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    json: true,
    method: 'POST',
    resolveWithFullResponse: true,
    uri: endpoint
  };
  return rp(options)
    .then(res => {
      if (res.statusCode === 200) {
        return res.body;
      }
      console.error('ERROR: Failed to create PhotoScene!\n');
    })
    .catch(reason => {
      console.error(`ERROR: Failed to create PhotoScene: ${JSON.stringify(reason)}\n`);
    });
}

function deletePhotoScene (accessToken, photosceneid) {
  const endpoint = `${config.REALITY_CAPTURE_BASE_ENDPOINT}/photoscene/${photosceneid}`;
  logInfoToConsole('/photoscene/:photosceneid', 'DELETE', endpoint, null);
  const options = {
    agentOptions: { secureProtocol: config.TLS_VERSION },
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    json: true,
    method: 'DELETE',
    resolveWithFullResponse: true,
    uri: endpoint
  };
  return rp(options)
    .then(res => {
      if (res.statusCode === 200) {
        return res.body;
      }
      console.error('ERROR: Failed to delete PhotoScene!\n');
    })
    .catch(reason => {
      console.error(`ERROR: Failed to delete PhotoScene: ${JSON.stringify(reason)}\n`);
    });
}

function downloadProcessedData (accessToken, photosceneid) {
  const endpoint = `${config.REALITY_CAPTURE_BASE_ENDPOINT}/photoscene/${photosceneid}?format=${config.FORMAT}`;
  logInfoToConsole('/photoscene/:photosceneid', 'GET', endpoint, null);
  const options = {
    agentOptions: { secureProtocol: config.TLS_VERSION },
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    json: true,
    method: 'GET',
    resolveWithFullResponse: true,
    uri: endpoint
  };
  return rp(options)
    .then(res => {
      if (res.statusCode === 200) {
        return res.body;
      }
      console.error('ERROR: Failed to download PhotoScene data!\n');
    })
    .catch(reason => {
      console.error(`ERROR: Failed to download PhotoScene data: ${JSON.stringify(reason)}\n`);
    });
}

function logInfoToConsole (endPoint, httpMethod, url, body) {
  if (body) {
    console.info('INFO: ' + httpMethod + ' ' + endPoint +
    '      Url: ' + url +
    '      Body:' + JSON.stringify(body));
  } else {
    console.info('INFO: ' + httpMethod + ' ' + endPoint +
    '      Url: ' + url);
  }
}

function processPhotoScene (accessToken, photosceneid) {
  const endpoint = `${config.REALITY_CAPTURE_BASE_ENDPOINT}/photoscene/${photosceneid}`;
  logInfoToConsole('/photoscene/:photosceneid', 'POST', endpoint, null);
  const options = {
    agentOptions: { secureProtocol: config.TLS_VERSION },
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    json: true,
    method: 'POST',
    resolveWithFullResponse: true,
    uri: endpoint
  };
  return rp(options)
    .then(res => {
      if (res.statusCode === 200) {
        return res.body;
      }
      console.error('ERROR: Failed to process PhotoScene!\n');
    })
    .catch(reason => {
      console.error(`ERROR: Failed to process PhotoScene: ${JSON.stringify(reason)}\n`);
    });
}

function twoLeggedoAuth2Login () {
  return new Promise(function (resolve, reject) {
    const autoRefresh = true;
    const oAuth2TwoLegged = new forgeSDK.AuthClientTwoLegged(
      process.env.FORGE_APP_ID,
      process.env.FORGE_APP_SECRET,
      config.SCOPES,
      autoRefresh
    );
    oAuth2TwoLegged.authenticate()
      .then(function (credentials) {
        client.set('token', credentials.access_token, function (err, reply) {
          if (reply) {
            console.info(`INFO: access_token: ${credentials.access_token}`);
            resolve(credentials.access_token);
          }
          if (err) {
            console.error('ERROR: failed to cache access token!\n');
            reject(new Error('ERROR: failed to cache access token!'));
          }
        });
      }, function (err) {
        console.error(`ERROR: failed to login to Forge: ${err}\n`);
        reject(new Error(`ERROR: failed to login to Forge! ${err}`));
      });
  });
}
