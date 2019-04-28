console.log('Loading function');

// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');
// Set region
AWS.config.update({region: 'us-east-1'});

exports.handler = (event, context, callback) => {
    //console.log('Received event:', JSON.stringify(event, null, 2));
    
    const baseUrl = "https://fractalstack.com/upbook/intent?updates=";

    const done = (err, res) => callback(null, {
        statusCode: err ? '400' : '200',
        body: err ? err.message : JSON.stringify(res),
        headers: {
            'Content-Type': 'application/json',
        },
    });
    
    function sendTextMessages(name, phoneNumbersToMessage, base64Profile) {
        console.log("Phone numbers to message: " + phoneNumbersToMessage);
        
        for (var phoneNumIndex = 0; phoneNumIndex < phoneNumbersToMessage.length; phoneNumIndex++) {
            console.log("Sending text to: " + phoneNumbersToMessage[phoneNumIndex]);
            var updateMessage = ' sent you contact updates via UpBook! ';
            var textParams = {
                Message: name + updateMessage + baseUrl + base64Profile,
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

    switch (event.httpMethod) {
        case 'DELETE':
            //dynamo.deleteItem(JSON.parse(event.body), done);
            break;
        case 'GET':
            //Note: this api is just for testing
            // var phoneNumbers = ['19417163554', '14074317596'];
            // sendTextMessages(phoneNumbers);
            done();
            break;
        case 'POST':
            console.log('Received post:', JSON.stringify(event, null, 2));
            var jsonBody = JSON.parse(event.body);
            console.log(jsonBody);
            
            var profileFromRequest = jsonBody.profile;
            console.log(profileFromRequest);
            
            var name = profileFromRequest.name.formatted;
            
            var ubNetworkToMessage = jsonBody.networkNumbers;
            console.log(ubNetworkToMessage);
            
            var profileStringify = JSON.stringify(profileFromRequest);
            var base64Profile = Buffer.from(profileStringify).toString('base64');
            console.log(base64Profile);
            
            sendTextMessages(name, ubNetworkToMessage, base64Profile);
            
            if (jsonBody && jsonBody.phoneNumbers && jsonBody.phoneNumbers != '' && jsonBody.phoneNumbers.length > 0) {
                //sendTextMessages(jsonBody.phoneNumbers);
                
            }
            
            done();
            break;
        case 'PUT':
            
            break;
        default:
            done(new Error(`Unsupported method "${event.httpMethod}"`));
    }
};
