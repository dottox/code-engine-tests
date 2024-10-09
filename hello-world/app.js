/**
  * CONFIG PARAMETERS
  * useHmac: Use HMAC credentials - defaults to false
  * bucketName: The name of the selected bucket
  * serviceCredential: This is a  service credential created in a service instance
  *
  * INSTRUCTIONS
  * - Install Nodejs 10 or above, Then run the following commands
  * - npm i ibm-cos-sdk
  * - npm i request-promise
  * - node <scriptName>
  *
  * ========= Example Configuration =========
  * export default {
  *   useHmac: false,
  *   bucketName: 'testbucketname',
  *   serviceCredential: {
  *     "apikey": "XXXXXXXX",
  *     "cos_hmac_keys": {
  *       "access_key_id": "XXXXXXXXX",
  *       "secret_access_key": "XXXXXXXX"
  *     },
  *     "endpoints": "https://control.cloud-object-storage.cloud.ibm.com/v2/endpoints",
  *     "iam_apikey_description": "Auto-generated for key XXXXXX-XXXX-XXXX-XXXX",
  *     "iam_apikey_name": "Service credentials-2",
  *     "iam_role_crn": "crn:v1:bluemix:public:iam::::serviceRole:Writer",
  *     "iam_serviceid_crn": "crn:v1:bluemix:public:iam-identity::a/XXXXXXXX::serviceid:ServiceId-XXXXX-XXXXX-XXXXX",
  *     "resource_instance_id": "crn:v1:bluemix:public:cloud-object-storage:global:a/XXXXXXXX:XXXXX-XXXXX-XXXXX-XXXX::"
  *   },
  * };
  */

// ========= Configuration =========
const _dotenv = require('dotenv').config().parsed;

const dotenv = JSON.parse(_dotenv.CREDENTIALS);

const CONFIG = {
  useHmac: false,
  bucketName: _dotenv.BUCKETNAME,
  serviceCredential: {
    "apikey": dotenv.apikey,
    "endpoints": dotenv.endpoints,
    "iam_apikey_description": dotenv.iam_apikey_description,
    "iam_apikey_id": dotenv.iam_apikey_id,
    "iam_apikey_name": dotenv.iam_apikey_name,
    "iam_role_crn": dotenv.iam_role_crn,
    "iam_serviceid_crn": dotenv.iam_serviceid_crn,
    "resource_instance_id": dotenv.resource_instance_id
  },
};

const IBMCOS = require('ibm-cos-sdk');

const getS3 = async (endpoint, serviceCredential) => {
  let s3Options;

  if (serviceCredential.apikey) {
    /*
       * Cloud Object Storage S3 can be access via two types of credentials. IAM/HMAC
       * An IAM APIKey can be used to create an S3 Object as below.
       * The APIKey, S3 endpoint and resource Instance Id are required
       */
    s3Options = {
      apiKeyId: serviceCredential.apikey,
      serviceInstanceId: serviceCredential.resource_instance_id,
      region: 'ibm',
      endpoint: new IBMCOS.Endpoint(endpoint),
    };
  } else {
    console.log(serviceCredential.apikey)
    throw new Error('IAM ApiKey required to create S3 Client');
  }

  console.info(' S3 Options Used: \n', s3Options);
  console.debug('\n\n ================== \n\n');
  return new IBMCOS.S3(s3Options);
};

const getS3Hmac = async (endpoint, serviceCredential) => {
  let s3Options;

  if (serviceCredential.cos_hmac_keys && serviceCredential.cos_hmac_keys.access_key_id) {
    /*
      * Cloud Object Storage S3 can be access via two types of credentials. IAM/HMAC
      * An HMAC Credential is the equivalent of the AWS S3 credential type
      * The Access Key Id, Secret Access Key, and S3 Endpoint are needed to use HMAC.
      */
    s3Options = {
      accessKeyId: serviceCredential.cos_hmac_keys.access_key_id,
      secretAccessKey: serviceCredential.cos_hmac_keys.secret_access_key,
      region: 'ibm',
      endpoint: new IBMCOS.Endpoint(endpoint),
    };
  } else {
    throw new Error('HMAC credentials required to create S3 Client using HMAC');
  }

  console.info(' S3 Options Used: \n', s3Options);
  console.debug('\n\n ================== \n\n');
  return new IBMCOS.S3(s3Options);
};

const rp = require('request-promise');

/*
 * Cloud Object Storage is available in 3 resiliency across many Availability Zones across the world.
 * Each AZ will require a different endpoint to access the data in it.
 * The endpoints url provides a JSON consisting of all Endpoints for the user.
 */
const getEndpoints = async (endpointsUrl) => {
  console.info('======= Getting Endpoints =========');

  const options = {
    url: endpointsUrl,
    method: 'GET',
  };
  const response = await rp(options);
  return JSON.parse(response);
};

/*
 * Once we have the available endpoints, we need to extract the endpoint we need to use.
 * This method uses the bucket's LocationConstraint to determine which endpoint to use.
 */
const findBucketEndpoint = (bucket, endpoints) => {
  const region = bucket.region || bucket.LocationConstraint.substring(0, bucket.LocationConstraint.lastIndexOf('-'));
  const serviceEndpoints = endpoints['service-endpoints'];
  const regionUrls = serviceEndpoints['cross-region'][region]
  || serviceEndpoints.regional[region]
  || serviceEndpoints['single-site'][region];

  if (!regionUrls.public || Object.keys(regionUrls.public).length === 0) {
    return '';
  }
  return Object.values(regionUrls.public)[0];
};

/*
 * A simple putObject to upload a simple object to COS.
 * COS also allows Multipart upload to facilitate upload of larger objects.
 */
const putMyObject = async (s3, params) => {

  console.info(' putting Objects \n', params);

  const data = await Promise.all([
    s3.putObject(params).promise(),
  ]);
  console.info(' Response: \n', JSON.stringify(data, null, 2));
  return true;
};

/*
 * Download an Object from COS
 */
const getObject = async (s3, bucketName, objectName) => {
  const getObjectParam = {
    Bucket: bucketName,
    Key: objectName,
  };
  console.info(' getObject \n', getObjectParam);

  const data = await s3.getObject(getObjectParam).promise();
  console.info(' Response: \n', JSON.stringify(data, null, 2));
  return data;
};

/*
 * Fetch the headers and any metadata attached to an object
 */
const headObject = async (s3, bucketName, objectName) => {
  const headObjectP = {
    Bucket: bucketName,
    Key: objectName,
  };
  console.info(' headObject \n', headObjectP);

  const data = await s3.headObject(headObjectP).promise();
  console.info(' Response: \n', JSON.stringify(data, null, 2));
  return data;
};

/*
 * Delete a selected Object
 */
const deleteObject = async (s3, bucketName, objectName) => {
  const deleteObjectP = {
    Bucket: bucketName,
    Key: objectName,
  };
  console.info(' deleteObject \n', deleteObjectP);

  const data = await s3.deleteObject(deleteObjectP).promise();
  console.info(' Response: \n', JSON.stringify(data, null, 2));
  return data;
};

const listObjects = async (s3, bucketName) => {
  const listObject = {
    Bucket: bucketName,
  };
  console.info(' fetching object \n', listObject);

  const data = await s3.listObjectsV2(listObject).promise();
  console.info(' Response: \n', JSON.stringify(data, null, 2));
  return data;
};

/*
 * The listBucketsExtended S3 call will return a list of buckets along with the LocationConstraint.
 * This will help in identifing the endpoint that needs to be used for a given bucket.
 */
const listBuckets = async (s3, bucketName) => {
  const params = {
    Prefix: bucketName,
  };
  console.error('\n Fetching extended bucket list to get Location');
  const data = await s3.listBucketsExtended(params).promise();
  console.info(' Response: \n', JSON.stringify(data, null, 2));

  return data;
};

const configureEndpoint = async (s3, bucketName) => {
    const bucketsData = await listBuckets(s3, bucketName)
    .catch((err) => {
      res.send(err);
    });
    const myBucket = bucketsData.Buckets[0]
    s3.endpoint = findBucketEndpoint(myBucket, endpoints)
}

const defaultEndpoint = 's3.us.cloud-object-storage.appdomain.cloud';

console.info('\n ======== Config: ========= ');
console.info('\n ', CONFIG);



const express = require('express');
const path = require('path')
const multer = require('multer');
const app = express();
const upload = multer({ storage: multer.memoryStorage() });


app.set('views', path.join(__dirname, '/views')) 
app.set('view engine', 'ejs') 

app.use(express.urlencoded({ extended: false }));



// --- / ---
app.get('/', (req, res) => {
    res.render('index', { 
        title: 'View Engine Demo'
    }) 
});

// --- /UPLOAD ---
app.get('/upload', (req, res) => {
    res.render('upload', { 
        title: 'Upload Image',
        bucketName: CONFIG.bucketName
    });
});

app.get('/upload-result', (req, res) => {
    return res.redirect('/upload');
});

app.post('/upload', upload.single('image'), async (req, res) => {
    if (!req.file || !req.body.name) {
        return res.status(400).send('Image file and name are required');
    }

    if (req.file.mimetype !== 'image/jpeg' && req.file.mimetype !== 'image/png' && req.file.mimetype !== 'image/jpg') {
        return res.status(400).send('Only jpeg, jpg, and png images are allowed');
    }

    await configureEndpoint(s3, CONFIG.bucketName)

    const params = {
        Bucket: CONFIG.bucketName,
        Key: req.body.name + path.extname(req.file.originalname),
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
        Metadata: {
            fileType: 'image',
        },
    };

    try {
        const data = await s3.putObject(params).promise();
        res.status(200).render('upload-result', { 
            title: 'Upload Image Result',
            message: `Image uploaded successfully: ${JSON.stringify(data)}`
        });
    } catch (err) {
        res.status(400).render('upload-result', {
            title: 'Upload Image Result',
            message: `Error uploading image: ${err.message}`
        });
    }
});

// --- /DELETE ---
app.get('/delete', async (req, res) => {

    // Get all items in the bucket
    await configureEndpoint(s3, CONFIG.bucketName)

    const items = await listObjects(s3, CONFIG.bucketName)
    console.log(JSON.stringify(items))

    res.render('delete', { 
        title: 'Delete Image',
        bucketName: CONFIG.bucketName,
        items: items.Contents
    });
});

app.get('/delete-result', (req, res) => {
    return res.redirect('/delete');
});

app.post('/delete', async (req, res) => {    

    if (!req.body.name) {
        return res.status(400).send('Image name is required');
    }

    await configureEndpoint(s3, CONFIG.bucketName)

    const params = {
        Bucket: CONFIG.bucketName,
        Key: req.body.name,
    };

    try {
        const data = await s3.deleteObject(params).promise();
        res.status(200).render('delete-result', { 
            title: 'Delete Image Result',
            message: `Image deleted successfully: ${req.body.name}`
        });
    } catch (err) {
        res.status(400).render('delete-result', {
            title: 'Delete Image Result',
            message: `Error deleting image: ${err.message}`
        });
    }

});


// --- /BUCKETS ---
app.get ('/buckets', async (req, res) => {
  const data = await listBuckets(s3, CONFIG.bucketName)
    .catch((err) => {
      res.send(err);
    });
  res.send(data);
});


// --- /:BUCKET/ALL ---
app.get('/:bucket/all', async (req, res) => {
  
    await configureEndpoint(s3, req.params.bucket)

    const data = await listObjects(s3, req.params.bucket)
        .catch((err) => {
        res.send(err);
        });
    res.send(data);
});

// --- /:BUCKET/:NAME ---
app.get('/:bucket/:name', async (req, res) => {
    
    await configureEndpoint(s3, req.params.bucket)

    const data = await getObject(s3, req.params.bucket, req.params.name)
        .catch((err) => {
            res.send(err);
        });
    res.send(data);
});


// --- LISTENER ---
app.listener = app.listen(8000, async () => {
    s3 = await getS3(defaultEndpoint, CONFIG.serviceCredential);
    endpoints = await getEndpoints(CONFIG.serviceCredential.endpoints);
    console.info('Server started on port 8000');
});