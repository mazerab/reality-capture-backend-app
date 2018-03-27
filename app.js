'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const request = require('request');

// Load configuration settings
const config = require('./config');

// Load the AWS SDK for Node.js
const AWS = require('aws-sdk');
AWS.config.update({
    signatureVersion: 'v4',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID, 
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: 'us-east-1'
});
const s3 = new AWS.S3();

// Load Express
const app = express();
const awsS3Router = express.Router();
const dataRouter = express.Router();
const derivativeRouter = express.Router();
const oauthRouter = express.Router();
const recapRouter = express.Router();

// parse application/json
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(express.static(__dirname + '/www')); // redirect static calls

// Root welcome message
app.get('/', (req, res) => {
    res.send('Welcome to Reality Capture Backend App');
    res.end();
});

// AWS S3 REST endpoints
awsS3Router.get('/getImageDrop', function(req, res) {
    if(!req.query.filename) {
        res.status(400).send('Request query is empty!');
    }
    const s3Params = {
        Bucket: config.S3_BUCKET,
        ContentType: 'image/jpg',
        ACL: 'public-read',
        Key: req.query.filename,
        Expires: 6000
    };
    s3.getSignedUrl('putObject', s3Params, function(err, data) {
        if(err){
            console.error('ERROR: ' + err);
            return res.end();
        }
        const returnData = {
            signedRequest: data,
            url: 'https://' + config.S3_BUCKET + '.s3.amazonaws.com/' + req.query.filename
        };
        app.locals.s3SignedUrl = returnData.signedRequest;
        res.write(JSON.stringify(returnData));
        res.end();
    });
});
app.use('/aws/s3', awsS3Router);

// oAuth POST access token
oauthRouter.use(bodyParser.json());
oauthRouter.post('/setToken', function(req, res) {
    if (!req.body.accessToken) {
        res.status(400).send('Request body is empty!');
    } 
    app.locals.token = req.body.accessToken;
    res.send(req.body);
    res.end();
});
app.use('/oauth', oauthRouter);

// Reality Capture REST endpoints
recapRouter.use(bodyParser.json());
recapRouter.use(bodyParser.urlencoded({extended: true}));
recapRouter.post('/addImage', function(req, res) {
    if (!req.body.file) {
        res.status(400).send('Request body is empty!');
    }
    const endpoint = config.REALITY_CAPTURE_BASE_ENDPOINT + '/file';
    const token = app.locals.token;
    const requestBody = {
        'photosceneid': app.locals.photosceneid,
        'type': 'image',
        'file[0]': req.body.file
    };
    logInfoToConsole('/file', 'POST', endpoint, requestBody);
    sendAuthFormData(endpoint, 'POST', token, requestBody, function(status, body) {
        responseToConsole(status, body);
        if (status === 200) { // this does not mean the API call succeeded
            const result = JSON.parse(body); // let's parse the body to make sure
            if (result.Error) {
                res.send(result.Error);
            } else {
                app.locals.files = result.Files;
                res.send(result.Files);
            }
        } else {
            res.status(status).send(body);
        }
        res.end();
    });
});
recapRouter.get('/checkOutputFileExists', function(req, res) {
    if (fs.existsSync(config.localOutputTempFile)) {
        const stats = fs.statSync(config.localOutputTempFile);
        res.send({ 'FileExists': 'true', 'FileSize': stats.size });
    } else {
        res.send({'FileExists': 'false'});
    }
    res.end();
});
recapRouter.post('/createPhotoScene', function(req, res) {
    if (!req.body) {
        res.status(400).send('Request body is empty!');
    }
    const endpoint = config.REALITY_CAPTURE_BASE_ENDPOINT + '/photoscene';
    const token = app.locals.token;
    logInfoToConsole('/photoscene', 'POST', endpoint, req.body);
    sendAuthForm(endpoint, 'POST', token, req.body, function(status, body) {
        responseToConsole(status, body);
        if (status === 200) { // this does not mean the API call succeeded
            let result = JSON.parse(body); // let's parse the body to make sure
            if (result.Error) {
                res.send(result.Error);
            } else {
                app.locals.photosceneid = result.Photoscene.photosceneid;
                res.send(result.Photoscene);
            }
        } else {
            res.status(status).send(body);
        }
        res.end();
    });
});
recapRouter.get('/downloadProcessedData', function(req, res) {
    if (!app.locals.photosceneid && req.query.format !== null && req.query.format !== undefined) {
        res.status(400).send('Request body is empty!');
    }
    const endpoint = config.REALITY_CAPTURE_BASE_ENDPOINT 
    + '/photoscene/' + app.locals.photosceneid 
    + '?format=' + req.query.format;
    const token = app.locals.token;
    logInfoToConsole('/photoscene/:photosceneid', 'GET', endpoint, null);
    sendAuthForm(endpoint, 'GET', token, null, function(status, body) {
        responseToConsole(status, body);
        if (status === 200) { // this does not mean the API call succeeded
            const result = JSON.parse(body); // let's parse the body to make sure
            if (result.Error) {
                res.send(result.Error);
            } else {
                app.locals.scenelink = result.Photoscene.scenelink;
                app.locals.filesize = result.Photoscene.filesize;
                const file = fs.createWriteStream(config.localOutputTempFile);
                request(app.locals.scenelink)
                    .pipe(file)
                    .on('close', () => {
                        console.info('INFO: Output file written to /tmp!');
                    });
                res.send(result);
            }
        }
        res.end();
    });
});
recapRouter.get('/pollPhotosceneProcessingProgress', function(req, res) {
    const endpoint = config.REALITY_CAPTURE_BASE_ENDPOINT + '/photoscene/' + app.locals.photosceneid + '/progress';
    const token = app.locals.token;
    logInfoToConsole('/photoscene/:photosceneid/progress', 'GET', endpoint, null);
    sendAuthForm(endpoint, 'GET', token, null, function(status, body){
        responseToConsole(status, body);
        if (status === 200) { // this does not mean the API call succeeded
            const result = JSON.parse(body); // let's parse the body to make sure
            if (result.Error) {
                res.send(result.Error);
            } else {
                res.send(result);
            }
        } else {
            res.status(status).send(body);
        }
        res.end();
    });
});
recapRouter.post('/processPhotoScene', function(req, res) {
    const endpoint = config.REALITY_CAPTURE_BASE_ENDPOINT + '/photoscene/' + app.locals.photosceneid;
    const token = app.locals.token;
    logInfoToConsole('/photoscene/:photosceneid', 'POST', endpoint, null);
    sendAuthForm(endpoint, 'POST', token, null, function(status, body){
        responseToConsole(status, body);
        if (status === 200) { // this does not mean the API call succeeded
            const result = JSON.parse(body); // let's parse the body to make sure
            if (result.Error) {
                res.send(result.Error);
            } else {
                res.send(result);
            }
        } else {
            res.status(status).send(body);
        }
        res.end();
    });
});
recapRouter.get('/scene/callback', function(req, res) {
    if (app.locals.processingStatus === 'InProgress') {
        app.locals.processingStatus = 'Completed';
        res.send({'Callback': 'Success'});
    } else {
        res.send({'Callback': 'Failure'});
    }
    res.end();
});
recapRouter.get('/scene/processingReset', function(req, res) {
    app.locals.processingStatus = 'NotStarted';
    res.send({'photoSceneProcessing': app.locals.processingStatus});
    res.end();
});
recapRouter.get('/scene/processingStatus', function(req, res) {
    if (app.locals.processingStatus !== 'Completed' || app.locals.processingStatus === undefined) {
        app.locals.processingStatus = 'InProgress';
    }
    res.send({'photoSceneProcessing': app.locals.processingStatus });
    res.end();
});
app.use('/recap', recapRouter);


// Data Management REST endpoints
dataRouter.post('/createFirstVersion', function(req, res){
    if(!req.query) {
        res.status(400).send('Request query parameters are missing!');
    }
    const endpoint = config.STORAGE_BASE_ENDPOINT + '/projects/' + req.query.projectid + '/items';
    const filename = app.locals.filename;
    const requestBody = {
        'jsonapi': { 'version': '1.0' },
        'data': {
            'type': 'items',
            'attributes': {
                'displayName': filename,
                'extension': { 
                    'type': 'items:autodesk.core:File', 
                    'version': '1.0' 
                }
            },
            'relationships': {
                'tip': { 
                    'data': { 
                        'type': 'versions', 
                        'id': '1' 
                    } 
                },
                'parent': {
                    'data': {
                        'type': 'folders',
                        'id': req.query.folderid
                    }
                }
            },
        },
        'included': [
            {
                'type': 'versions',
                'id': '1',
                'attributes': {
                    'name': filename,
                    'extension': {
                        'type': 'versions:autodesk.core:File',
                        'version': '1.0'
                    }
                },
                'relationships': {
                    'storage': {
                        'data': {
                            'type': 'objects',
                            'id': req.query.objectid
                        }
                    }
                }
            }
        ]
    };
    const token = app.locals.token;
    logInfoToConsole('/projects/:projectId/items', 'POST', endpoint, requestBody);
    sendAuthBody(endpoint, 'POST', token, requestBody, 'vnd', function(status, body) {
        responseToConsole(status, body);
        if (status === 200) { // this does not mean the API call succeeded
            const result = JSON.parse(body); // let's parse the body to make sure
            if (result.Error) {
                res.send(result.Error);
            } else {
                res.send(result);
            }
        } else {
            res.status(status).send(body);
        }
        res.end();
    });
});
dataRouter.post('/createStorageLocation', function(req, res){
    if(!req.query) {
        res.status(400).send('Request query parameter is missing!');
    }
    const endpoint = config.STORAGE_BASE_ENDPOINT + '/projects/' + req.query.projectid + '/storage';
    let filename = config.localOutputTempFile.split('/').pop();
    const timestamp = new Date().getTime().toString();
    filename = timestamp + '_' + filename;
    app.locals.filename = filename;
    const requestBody = { 
        'jsonapi': { 
            'version': '1.0' 
        }, 
        'data': { 
            'type': 'objects', 
            'attributes': { 
                'name': filename
            }, 
            'relationships': { 
                'target': { 
                    'data': { 
                        'type': 'folders', 
                        'id': req.query.folderid 
                    } 
                } 
            } 
        } 
    };
    const token = app.locals.token;
    logInfoToConsole('/projects/:projectId/storage', 'POST', endpoint, requestBody);
    sendAuthBody(endpoint, 'POST', token, requestBody, 'vnd', function(status, body) {
        responseToConsole(status, body);
        if (status === 201) { // this does not mean the API call succeeded
            const result = JSON.parse(body); // parse body to ensure
            if (result.Error) {
                res.send(result.Error);
            } else {
                res.send(result);
            }
        } else {
            res.status(status).send(body);
        }
        res.end();
    });
});
dataRouter.get('/getHubs', function(req, res) {
    const endpoint = config.PROJECT_BASE_ENDPOINT + '/hubs';
    const token = app.locals.token;
    logInfoToConsole('/hubs', 'GET', endpoint, null);
    sendAuthBody(endpoint, 'GET', token, null, 'default', function(status, body) {
        responseToConsole(status, body);
        if (status === 200) { // this does not mean the API call succeeded
            const result = JSON.parse(body); // let's parse the body to make sure
            if (result.Error) {
                res.send(result.Error);
            } else {
                res.send(result);
            }
        } else {
            res.status(status).send(body);
        }
        res.end();
    });
});
dataRouter.get('/getProjects', function(req, res) {
    if(!req.query.hubid) {
        res.status(400).send('Request query parameter is missing!');
    }
    const endpoint = config.PROJECT_BASE_ENDPOINT + '/hubs/' + req.query.hubid + '/projects';
    const token = app.locals.token;
    logInfoToConsole('/hubs/:hubId/projects', 'GET', endpoint, null);
    sendAuthBody(endpoint, 'GET', token, null, 'default', function(status, body) {
        responseToConsole(status, body);
        if (status === 200) { // this does not mean the API call succeeded
            const result = JSON.parse(body); // let's parse the body to make sure
            if (result.Error) {
                res.send(result.Error);
            } else {
                res.send(result);
            }
        } else {
            res.status(status).send(body);
        }
        res.end();
    });
});
dataRouter.put('/uploadFileToStorageLocation', function(req, res) {
    if(!req.query) {
        res.status(400).send('Request query parameters are missing!');
    }
    const endpoint = config.OSS_BASE_ENDPOINT + '/buckets/wip.dm.prod/objects/' + req.query.objectname;
    const token = app.locals.token;
    try {
        let fileStats, buffer;
        if (fs.existsSync(config.localOutputTempFile)) {
            fileStats = fs.statSync(config.localOutputTempFile);
            buffer = fs.readFileSync(config.localOutputTempFile);
            if(Number(fileStats.size) === Number(app.locals.filesize)) { // only uploads after checking file size
                logInfoToConsole('/buckets/:bucketkey/objects/:objectName', 'PUT', endpoint, null);
                sendAuthBody(endpoint, 'PUT', token, buffer, 'default', function(status, body) {
                    responseToConsole(status, body);
                    if (status === 200) { // this does not mean the API call succeeded
                        const result = JSON.parse(body); // let's parse the body to make sure
                        if (result.Error) {
                            res.send(result.Error);
                        } else {
                            res.send(result);
                        }
                    } else {
                        res.status(status).send(body);
                    }
                    res.end();
                });
            }
        }
    } catch(err) {
        console.error('ERROR: ' + err.stack);
    }
});
app.use('/data', dataRouter);

// Derivative REST endpoints 
derivativeRouter.get('/getStatus', function(req, res) {
    if(!req.query.urn) {
        res.status(400).send('Request query parameter is missing!');
    }
    const endpoint = config.DERIVATIVE_BASE_ENDPOINT + '/designdata/' + req.query.urn + '/manifest';
    const token = app.locals.token;
    logInfoToConsole('/designdata/' + req.query.urn + '/manifest', 'GET', endpoint, null);
    sendAuthBody(endpoint, 'GET', token, null, 'default', function(status, body) {
        responseToConsole(status, body);
        if (status === 200) { // this does not mean the API call succeeded
            const result = JSON.parse(body); // let's parse the body to make sure
            if (result.Error) {
                res.send(result.Error);
            } else {
                res.send(result);
            }
        } else {
            res.status(status).send(body);
        }
        res.end();
    });
});
derivativeRouter.post('/translateToSVF', function(req, res) {
    if(!req.query.objectid) {
        res.status(400).send('Request query parameter is missing!');
    }
    const endpoint = config.DERIVATIVE_BASE_ENDPOINT + '/designdata/job';
    const token = app.locals.token;
    const base64ObjectId = Buffer.from(JSON.stringify(req.query.objectid)).toString('base64');
    const requestBody = {
        'input': {
            'urn': base64ObjectId,
            'compressedUrn': true,
            'rootFilename': 'result.obj'
        },
        'output': {
            'destination': {
                'region': 'us'
            },
            'formats': [
                {
                    'type': 'svf',
                    'views': [
                        '2d',
                        '3d'
                    ]
                }
            ]
        }
    };
    logInfoToConsole('/designdata/job', 'POST', endpoint, requestBody);
    sendAuthBody(endpoint, 'POST', token, requestBody, 'json', function(status, body) {
        responseToConsole(status, body);
        if (status === 201) { // this does not mean the API call succeeded
            const result = JSON.parse(body); // let's parse the body to make sure
            if (result.Error) {
                res.send(result.Error);
            } else {
                res.send(result);
            }
        } else {
            res.status(status).send(body);
        }
        res.end();
    });
});
app.use('/derivative', derivativeRouter);

module.exports = app;

function logInfoToConsole(endPoint, httpMethod, url, body) {
    if (body) {
        console.info('INFO: ' + httpMethod + ' ' + endPoint 
        + '      Url: ' + url
        + '      Body:' + JSON.stringify(body));
    } else {
        console.info('INFO: ' + httpMethod + ' ' + endPoint 
        + '      Url: ' + url);
    }
    
}

function responseToConsole(status, body) {
    if (status && body) {
        console.info('INFO: Response Status: ' + status
            + '               Body: ' + body);
    }
}

function sendAuthBody(endPoint, httpMethod, token, bodyData, specialHeaders, callback) {
    let requestBody = '';
    if(bodyData) {
        if(bodyData instanceof Buffer) {
            requestBody = bodyData;
        } else {
            requestBody = JSON.stringify(bodyData);
        }
    }
    let headers = {};
    if (specialHeaders === 'default') {
        headers = {'Authorization': 'Bearer ' + token};
    }
    if (specialHeaders === 'json') {
        headers = {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        };
    }
    if (specialHeaders === 'vnd') {
        headers = {
            'Accept': 'application/vnd.api+json',
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/vnd.api+json'
        };
    }
    request({
        url: endPoint,
        method: httpMethod,
        headers: headers,
        body: requestBody
    }, function(error, response, body) {
        if(callback) {
            callback(error || response.statusCode, body);
        } else {
            if(error) {
                console.error('ERROR: ' + error);
            } else {
                console.info('INFO: ' + response.statusCode, body);
            }
        }
    });
}

function sendAuthForm(endPoint, httpMethod, token, formData, callback) {
    let requestForm = '';
    if(formData) {
        requestForm = formData;
    }
    request({
        url: endPoint,
        method: httpMethod,
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'    
        },
        form: requestForm
    }, function(error, response, body) {
        if(callback) {
            callback(error || response.statusCode, body);
        } else {
            if(error) {
                console.error('ERROR: ' + error);
            } else {
                console.info('INFO: ' + response.statusCode, body);
            }
        }
    });
}

function sendAuthFormData(endPoint, httpMethod, token, formData, callback) {
    let requestFormData = '';
    if(formData) {
        requestFormData = formData;
    }
    request({
        url: endPoint,
        method: httpMethod,
        headers: {
            'Authorization': 'Bearer ' + token  
        },
        formData: requestFormData
    }, function(error, response, body) {
        if(callback) {
            callback(error || response.statusCode, body);
        } else {
            if(error) {
                console.error('ERROR: ' + error);
            } else {
                console.info('INFO: ' + response.statusCode, body);
            }
        }
    });
}



