# reality-capture-backend-app

AWS lambda backend app for the Autodesk Forge Reality Capture [mobile app](https://github.com/mazerab/reality-capture-mobile-app).

## Getting Started

Before you start, make sure you read [Serverless Code with Amazons AWS and Claudia](https://vincetocco.com/serverless-code/) to learn more about the setup.

1. Create a new repository directory
2. Download [this repository](https://github.com/mazerab/reality-capture-backend-app/archive/master.zip) and extract to the new directory

### Prerequisites

1. Install [Node.js and npm](https://www.npmjs.com/get-npm)
2. Run `npm install npm@latest -g`

### Installing

1. Browse to the repository directory
2. Run `npm install`
3. Run `npm run create` to send everything up to AWS Lambda. It will return a 'new URL'.
4. Edit the file `package.json` to update the Amazon access key ID and secret on line 11 `--set-env AWS_ACCESS_KEY_ID=xxx,AWS_SECRET_ACCESS_KEY=xxx`
5. Run `npm run setvars` to push the environment variables to Lambda.
6. Open the 'new URL' in a browser

**Example:** [https://adc6qwtnce.execute-api.us-east-1.amazonaws.com/demo/](https://adc6qwtnce.execute-api.us-east-1.amazonaws.com/demo/)

> Remember to add a '/' or a '/index.html' to the URL.

### Updating the app

Below I demonstrate ['Claudia.js'](https://claudiajs.com/tutorials/serverless-express.html) 'update' command to re-deploy a small html code change. Claudia handles the task of zipping, uploading and re-wiring node.js endpoints to 'AWS-Lambda & API-Gateway' automatically. 

1. Make a code change to file ```'www/index.html'```
2. Run `npm run update`... It outputs a 'new URL'
3. Open the 'new URL' in a browser to see your changes.

### Deployment

## Testing

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

Bastien Mazeran, Autodesk Inc.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 

### Acknowledgements

This code came from [GITHUB-Express-Lambda](https://github.com/claudiajs/example-projects/tree/master/express-app-lambda)

More information on Express/Serverless can be found here:
[Running Express Apps in AWS Lambda](https://claudiajs.com/tutorials/serverless-express.html)  

The package.json was modified from here: [Package.json](
https://vincetocco.com/serverless-code/)

[Why use Claudia?](https://github.com/claudiajs/claudia/blob/master/FAQ.md)

Inspired by [this blog post](https://forge.autodesk.com/blog/running-forge-viewer-aws-lambda-server-and-api-gateway), by Philippe Leefsma.