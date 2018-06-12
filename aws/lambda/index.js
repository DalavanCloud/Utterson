var AWS = require('aws-sdk');

AWS.config.apiVersions = {
    ec2: '2016-11-15',
    sqs: '2012-11-05',
};

var ec2 = new AWS.EC2();
var sqs = new AWS.SQS();

exports.handler = function(event, context) {
    try {
        var response = {
            "isBase64Encoded": false,
            "statusCode": 200,
            "headers": {},
            "body": ""
        };

        var json = event.body;
        if (typeof json === "string") {
            json = JSON.parse(json);
        }

        if (json["action"] === "created" || "zen" in json) {
            response["body"] = "ok";
            context.succeed(response);
            return;
        }

        var pull_request;
        if (json["action"] === "requested" || json["action"] === "rerequested") {
            pull_request = json["check_suite"]["pull_requests"][0];
        }
        else {
            pull_request = json["pull_request"];
        }

        var title = "New PR #" + pull_request["number"] +
            "\nwith base " + pull_request["base"]["ref"] +
            "\nand head " + pull_request["head"]["sha"];

        response.body = title;

        var params = {
            InstanceIds: [
                process.env["INSTANCE_ID"],
            ]
        };

        var message = {
            MessageBody: title,
            QueueUrl: process.env["QUEUE_URL"],
            MessageGroupId: "0",
            MessageAttributes: {
                "pr": {
                    DataType: "String",
                    StringValue: String(pull_request["number"])
                },
                "base": {
                    DataType: "String",
                    StringValue: pull_request["base"]["ref"]
                },
                "base-sha": {
                    DataType: "String",
                    StringValue: pull_request["base"]["sha"]
                },
                "head": {
                    DataType: "String",
                    StringValue: pull_request["head"]["sha"]
                },
                "head-branch": {
                    DataType: "String",
                    StringValue: pull_request["head"]["ref"]
                },
                "repo": {
                    DataType: "String",
                    StringValue: json["repository"]["clone_url"]
                },
                "installation": {
                    DataType: "String",
                    StringValue: String(json["installation"]["id"])
                },
                "url": {
                    DataType: "String",
                    StringValue: pull_request["base"]["repo"]["url"]
                },
            }
        };

        sqs.sendMessage(message, function(err, data) {
            if (err) {
                console.log("Error", err);
            }
        });

        ec2.startInstances(params, function(err, data) {
            if (err) {
                console.log("Error", err);
            }
            else {
                console.log("Success");
                context.succeed(response);

            }
        });

    }
    catch (err) {
        response.statusCode = 500;
        response.body = err.message + "\n\n" + JSON.stringify(event.body);
        context.succeed(response);
    }
};
