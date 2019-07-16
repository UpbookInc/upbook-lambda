console.log('Loading function');

// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');
// Set region
AWS.config.update({region: 'us-east-1'});
const uuidv1 = require('uuid/v1');
const uuidv3 = require('uuid/v3');
const redis = require('redis');

exports.handler = (event, context, callback) => {   
    const baseUrl = "https://fractalstack.com/upbook/intent?updates=";

    const done = (res, err) => callback(null, {
        statusCode: err ? '400' : '200',
        body: err ? err.message : JSON.stringify(res),
        headers: {
            'Content-Type': 'application/json',
        },
    });

    const redis_client = redis.createClient({
        host: 'upbook-redis-1.yjt0dp.0001.use1.cache.amazonaws.com',
        port: 6379
    });
    
    function sendTextMessages(name, phoneNumbersToMessage, base64Profile) {
        console.log("Phone numbers to message: " + phoneNumbersToMessage);
        
        var uuid1 = uuidv1();
        var uuid2 = uuidv3('fflsys.com', uuidv3.DNS);
        var storeKey = uuid1 + uuid2;
        storeKey = storeKey.replace(/-/g, ""); // remove dashes
        console.log("storing with key: " + storeKey);
        redis_client.set(storeKey, base64Profile, 'EX', 86400); // expires in one day 
        redis_client.quit(); //required for this to work!
               
        for (var phoneNumIndex = 0; phoneNumIndex < phoneNumbersToMessage.length; phoneNumIndex++) {
            console.log("Sending text to: " + phoneNumbersToMessage[phoneNumIndex]);
            var updateMessage = ' sent you contact updates via UpBook! ';
            var textParams = {
                Message: name + updateMessage + baseUrl + storeKey,
                PhoneNumber: phoneNumbersToMessage[phoneNumIndex],
            };
            console.log(textParams);
            if (phoneNumbersToMessage[phoneNumIndex].length === 11) {
                // Create promise and SNS service object
                var publishTextPromise = new AWS.SNS({apiVersion: '2010-03-31'}).publish(textParams).promise();
                // Handle promise's fulfilled/rejected states
                publishTextPromise.then(
                  function(data) {
                    console.log("MessageID is " + data.MessageId);
                  }).catch(
                    function(err) {
                    console.error(err, err.stack);
                  });
            }
        }
    }

    function getProfileDataFromCache(dataUuid, profileDataCallback) {       
        redis_client.on("error", function (err) {
            console.log("Redis error " + err);
        });
        
        redis_client.get(dataUuid, function(error, reply) {
            console.log("Profile data from redis get: " + reply);
            if (!error && reply) {
                console.log("profileDataCallback with reply");
                redis_client.quit(); //required for this to work!
                profileDataCallback(reply);
            } else {
                console.log("Redis request error, or reply was empty:");
                console.log("error:" + error);
                done('Redis request errored.');
            }
        });
    }

    switch (event.httpMethod) {
        case 'GET':
            console.log('Received GET request');
            var dataUuid = event["queryStringParameters"]['dataId'];
            console.log("dataId: " + dataUuid);
            if (dataUuid) {
                getProfileDataFromCache(dataUuid, function(resp) {
                    console.log("call done");
                    done({data: resp});
                });
            } else {
                done();
            }
            
            break;
        case 'POST':
            console.log('Received post:', JSON.stringify(event, null, 2));
            var jsonBody = JSON.parse(event.body);
            console.log(jsonBody);
            
            var profileFromRequest = jsonBody.profile;
            console.log(profileFromRequest);
            
            var name = profileFromRequest.name.givenName;
            if (profileFromRequest.name.familyName && profileFromRequest.name.familyName != '') {
                name += " " + profileFromRequest.name.familyName;
            }
            
            var ubNetworkToMessage = jsonBody.networkNumbers;
            console.log(ubNetworkToMessage);
            
            var profileStringify = JSON.stringify(profileFromRequest);
            var base64Profile = Buffer.from(profileStringify).toString('base64');
            console.log(base64Profile);
            
            sendTextMessages(name, ubNetworkToMessage, base64Profile);
            
            done();
            break;
        default:
            done(new Error(`Unsupported method "${event.httpMethod}"`));
    }
};
