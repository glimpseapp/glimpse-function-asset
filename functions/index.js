'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const gcs = require('@google-cloud/storage')();
const multipart = require('connect-multiparty');
const multipartMiddleware = multipart();

const express = require('express');
const app = express();

// Validate the user is logged in taking the Firebase JWT, and adding uid and email to the req.user
const validateFirebaseIdToken = (req, res, next) => {
    if (req.originalUrl == '/healthz') {
        return res.send({status: true});
    }

    if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
        return res.status(403).send('Unauthorized');
    }

    // Read the ID Token from the Authorization header.
    let idToken = req.headers.authorization.split('Bearer ')[1];

    admin.auth().verifyIdToken(idToken).then(decodedIdToken => {
        console.log('Authenticated ', decodedIdToken.email);
        req.user = decodedIdToken;
        next();
    }).catch(error => {
        console.error('Error while verifying Firebase ID token:', error);
        res.status(403).send('Unauthorized');
    });
};

app.use(validateFirebaseIdToken);

app.post('/asset', multipartMiddleware, (req, res) => {
    const file = req.files.asset;
    const bucket_name = 'glimpse-123456.appspot.com';
    const bucket = gcs.bucket(bucket_name);
    const destination_name = Date.now() + '.' + req.user.uid + '.' + file.name;
    const destination = '/asset/' + destination_name;
    bucket.upload(file.path, {destination: destination}).then((response, err) => {
        if (err) {
            res.send({error: err});
        } else {
            res.send({success: true, name: destination_name});
        }
    });
});

app.get('/asset/:asset_name', (req, res) => {
    const filepath = '/asset/' + req.params.asset_name;
    const bucket_name = 'glimpse-123456.appspot.com';
    const bucket = gcs.bucket(bucket_name);
    const file = bucket.file(filepath);
    file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 86400 // one day
    }, (err, url) => {
        if (err) {
            res.send({error: err});
        } else {
            res.send({url: url, name: req.body.name});
        }
    });
});

exports.asset = functions.https.onRequest(app);
