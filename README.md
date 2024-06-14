# AWS Serverless Microservice

This project defines an AWS serverless microservice using AWS SAM (Serverless Application Model). It consists of an API Gateway, SQS queues, a Lambda function, and a DynamoDB table.

## Architecture

The architecture includes the following components:

1. **API Gateway**: Provides a RESTful API to send telemetry data.
2. **SQS Queues**: 
   - `TelemetryQueue`: Main queue to receive telemetry data.
   - `DeadLetterQueue`: Handles messages that cannot be processed.
3. **Lambda Function**: Processes telemetry data from the `TelemetryQueue` and stores it in the DynamoDB table.
4. **DynamoDB Table**: `Telemetry-Store` table stores the telemetry data.
5. **IAM Role**: Grants API Gateway permission to send messages to the SQS queue.

## AWS Resources

### IAM Role

**ApiGatewayToSqsRole**: Allows API Gateway to send messages to SQS.

### DynamoDB Table

**TelemetryTable**: Stores telemetry data with a `siteId` as the partition key.

### SQS Queues

**DeadLetterQueue**: Handles failed message processing.

**TelemetryQueue**: Receives telemetry data, with a redrive policy to the `DeadLetterQueue`.

### Lambda Layer

**TelemetryLambdaLayer**: Contains the AWS SDK required by the Lambda function.

### Lambda Function

**TelemetryProcessorFunction**: Processes messages from the `TelemetryQueue` and stores them in `TelemetryTable`.

### API Gateway

**ApiGateway**: Defines an API to send telemetry data to `TelemetryQueue`.

## SAM Template

The SAM template includes definitions for all the above resources and their configurations.

### Transform

```yaml
Transform: 'AWS::Serverless-2016-10-31'
```
## Deployment
To deploy the application, use the AWS SAM CLI:
   1. Build the application:
      ```
      sam build
       ```
   2. Deploy the application:
      ```
      sam deploy
      ```
### Usage
   After deployment, the API Gateway endpoint URL can be used to send telemetry data. Replace ``{siteId}`` with the actual site ID and POST telemetry data in JSON format to the endpoint.

### Cleanup
   ``sam delete``
