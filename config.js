'use strict';

module.exports = {

    // Forge endpoints
    DERIVATIVE_BASE_ENDPOINT: 'https://developer.api.autodesk.com/modelderivative/v2',
    OSS_BASE_ENDPOINT: 'https://developer.api.autodesk.com/oss/v2',
    PROJECT_BASE_ENDPOINT: 'https://developer.api.autodesk.com/project/v1',
    REALITY_CAPTURE_BASE_ENDPOINT: 'https://developer.api.autodesk.com/photo-to-3d/v1',
    STORAGE_BASE_ENDPOINT: 'https://developer.api.autodesk.com/data/v1',

    // AWS configuration
    S3_BUCKET: 'reality-capture-images',

    // Upload folder path to store the output file
    localOutputTempFile: '/tmp/reality-capture-output.zip'

};
