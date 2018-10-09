# reality-capture-backend-app

[![License](http://img.shields.io/:license-MIT-blue.svg)](http://opensource.org/licenses/MIT)

[![OAuth2](https://img.shields.io/badge/OAuth2-v1-green.svg)](http://forge.autodesk.com/)
[![Reality-Capture](https://img.shields.io/badge/Reality%20Capture-v1-green.svg)](http://developer.autodesk.com/)

AWS lambda backend app for the Autodesk Forge Reality Capture [mobile app](https://github.com/mazerab/reality-capture-mobile-app).

## Introduction

This server app calls the Forge Reality Capture API to process images found on your smartphone and generate an OBJ file. An OBJ file is an open geometry definition file format that represents 3D geometry alone. 

The flow is simple:

The mobile app lets users select image files from the camera roll and upload them to a S3 bucket.

1. The server app logs into Forge using 2-legged oAuth flow
1. The server app creates a new photoscene. The API documentation is found [here](https://developer.autodesk.com/en/docs/reality-capture/v1/reference/http/photoscene-POST/)
1. The images are added to the photoscene using the images' S3 URLs. The API documentation can be accessed [here](https://developer.autodesk.com/en/docs/reality-capture/v1/reference/http/file-POST/)
1. The photoscene is sent for processing. Refer to API documentation [here](https://developer.autodesk.com/en/docs/reality-capture/v1/reference/http/photoscene-:photosceneid-POST/)
1. When the processing is complete, the callback URL is hit and a photoscene link is returned

## Getting Started

Before you start, make sure you read [Serverless Code with Amazons AWS and Claudia](https://vincetocco.com/serverless-code/) to learn more about the setup.

1. Create a new repository directory
1. Download [this repository](https://github.com/mazerab/reality-capture-backend-app/archive/master.zip) and extract to the new directory

### Prerequisites

#### Node.js

1. Install [Node.js and npm](https://www.npmjs.com/get-npm)
1. Run `npm install npm@latest -g`

#### Redis Cloud

Redis Cloud is used here to store session data. AWS Lambda functions are stateless, hence the need to store session information and persist it elsewhere. Redis database will be used to persist the photoscenelink URL, photoscene ID and other parameters. 

1. Sign-up for a free Redis Cloud account [here](https://app.redislabs.com/#/sign-up/cloud)
1. Setup a new subscription, database and connect by following the [quick setup guide](https://redislabs.com/redis-cloud-documentation/quick-setup-redis-cloud/)


### Installing

1. Browse to the repository directory
1. Run `npm install`
1. Edit the file `package.json` to change the app name on line 2. Pick a name that is unique to you.
1. Continue editing the same file `package.json` to update the Forge App ID and secret, Amazon S3 bucket and Redis password on the setvars script line  `--set-env FORGE_APP_ID=xxx,FORGE_APP_SECRET=yyy,S3_BUCKET=reality-capture-images,REDIS_PASSWORD=zzz`
1. Save the changes
1. Run `npm run create` to send everything up to AWS Lambda. It will return a 'new URL', make a note of its value as you will need to input the URL in the *config.js* file under the **AWS_LAMBDA_BASE_ENDPOINT** variable.

![npm run create](/www/assets/npm-run-create.png)
1. Run `npm run setvars` to push the environment variables to Lambda.
1. Open the 'new URL' in a browser

**Example:** [https://adc6qwtnce.execute-api.us-east-1.amazonaws.com/demo/](https://adc6qwtnce.execute-api.us-east-1.amazonaws.com/demo/)

> Remember to add a '/' or a '/index.html' to the URL.

### Updating the app

Below I demonstrate ['Claudia.js'](https://claudiajs.com/tutorials/serverless-express.html) 'update' command to re-deploy a small code change. Claudia handles the task of zipping, uploading and re-wiring node.js endpoints to 'AWS-Lambda & API-Gateway' automatically. 

1. Using your favorite text editor, open the *config.js* file from the root directory
1. Input the correct values in **REDIS_ENDPOINT** and **AWS_LAMBDA_BASE_ENDPOINT** variables, save the changes
1. Run `npm run update`...

Anytime you need to make code changes, you should use the 'update' command to push your changes to the AWS lambda function. 

### AWS Lambda Function Configuration

* Login to your AWS console
* Navigate to Lambda Functions
* Open your new Lambda function
* Change the Node.js version to 8.10

![Node Version](/www/assets/nodejs-8.png)
* Increase memory to 512 Mb and timeout value to 30 seconds

![Timeout](/www/assets/memory-timeout.png)
* Connect the demo alias to $LATEST version

![Alias](/www/assets/demo-alias.png)
* Save the changes

## Testing

Go back to your mobile app to edit the `./constants/Config.js` file to have the correct AWS lambda endpoint in the variable named **AWS_RECAP_LAMBDA_BASE_ENDPOINT**. Save the change and submit **3 or more** images for processing by pressing the button called *"Process Photoscene"*.

This should generate a new OBJ file. You can validate the photoscenelink has the right data by browsing to the AWS lambda function endpoint **/demo/redis/photoscenelink** and use that URL to download the OBJ file locally. 

## Built With
* [Amazon Lambda](https://aws.amazon.com/lambda/) - Run code without thinking about servers.
* [Amazon API Gateway](https://aws.amazon.com/api-gateway) - Fully managed service to create, publish, maintain, monitor, and secure APIs.
* [Amazon S3](https://aws.amazon.com/s3) - Amazon Simple Storage Service.
* [Claudia JS](https://claudiajs.com/) - JavaScript cloud micro-services the easy way.
* [NodeJS](https://nodejs.org/en/) - JavaScript runtime.
* [Express](http://expressjs.com/) - Fast, unopiniated, minimalist web framework for Node.js.
* [AWS SDK](https://github.com/aws/aws-sdk-js) - AWS SDK for JavaScript in the browser and Node.js.
* [AWS Serverless Express](https://github.com/awslabs/aws-serverless-express) - AWS Serverless JavaScript framework.

## Authors

Bastien Mazeran [@BastienMazeran](https://twitter.com/BastienMazeran), Autodesk Inc.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 

## Acknowledgements

This code came from [GITHUB-Express-Lambda](https://github.com/claudiajs/example-projects/tree/master/express-app-lambda)

More information on Express/Serverless can be found here:
[Running Express Apps in AWS Lambda](https://claudiajs.com/tutorials/serverless-express.html)  

The package.json was modified from here: [Package.json](
https://vincetocco.com/serverless-code/)

[Why use Claudia?](https://github.com/claudiajs/claudia/blob/master/FAQ.md)

Inspired by [this blog post](https://forge.autodesk.com/blog/running-forge-viewer-aws-lambda-server-and-api-gateway), by Philippe Leefsma.
