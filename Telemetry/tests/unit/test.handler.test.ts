import { SQSEvent, Context, Callback, SQSBatchResponse } from 'aws-lambda';
import AWSMock from 'aws-sdk-mock';
import AWS from 'aws-sdk';
import { handler } from '../../index';

describe.skip('handler', () => {
  const TABLE_NAME = 'TelemetryTable';
  process.env.TABLE_NAME = TABLE_NAME;

  beforeEach(() => {
    AWSMock.setSDKInstance(AWS);
    AWSMock.mock('DynamoDB.DocumentClient', 'batchWrite', (params, callback) => {
      callback(null, { UnprocessedItems: {} });
    });
  });

  afterEach(() => {
    AWSMock.restore('DynamoDB.DocumentClient');
  });

  const createSQSEvent = (records: any[]): SQSEvent => ({
    Records: records.map(record => ({
      messageId: record.messageId,
      receiptHandle: 'handle',
      body: JSON.stringify(record.body),
      attributes: {
        ApproximateReceiveCount: '',
        SentTimestamp: '',
        SenderId: '',
        ApproximateFirstReceiveTimestamp: ''
      },
      messageAttributes: {},
      md5OfBody: '',
      eventSource: '',
      eventSourceARN: '',
      awsRegion: ''
    })),
  });

  const context: Context = {
      functionName: 'functionName',
      functionVersion: '1',
      invokedFunctionArn: 'arn',
      memoryLimitInMB: '128',
      awsRequestId: 'requestId',
      logGroupName: 'logGroup',
      logStreamName: 'logStream',
      identity: undefined,
      clientContext: undefined,
      getRemainingTimeInMillis: () => 1000,
      done: (error?: Error, result?: any): void => { },
      fail: (error: Error | string): void => { },
      succeed: (messageOrObject: any): void => { },
      callbackWaitsForEmptyEventLoop: false
  };

  const callback: Callback = (error, result) => {
    if (error) {
      console.error(error);
    } else {
      console.log(result);
    }
  };

  it('should process valid messages successfully', async () => {
    const event = createSQSEvent([
      {
        messageId: '1',
        body: {
          siteId: 'site1',
          telemetry: {
            version: '1.0',
            creationTime: 1627889181,
            creationTimeISO: new Date(),
            deviceId: 'device1',
            temperature: { celsius: 25, fahrenheit: 77 },
          },
        }
      }
    ]);

    const response: SQSBatchResponse = await handler(event, context, callback) as SQSBatchResponse;
    expect(response.batchItemFailures).toHaveLength(0);
  });

  it('should handle invalid messages and add to batchItemFailures', async () => {
    const event = createSQSEvent([
      {
        messageId: '1',
        body: {
          telemetry: {
            version: '1.0',
            creationTime: 1627889181,
            creationTimeISO: new Date(),
            deviceId: 'device1',
            temperature: { celsius: 25, fahrenheit: 77 },
          },
        }
      }
    ]);

    const response: SQSBatchResponse = await handler(event, context, callback) as SQSBatchResponse;
    expect(response.batchItemFailures).toHaveLength(1);
    expect(response.batchItemFailures[0].itemIdentifier).toBe('1');
  });

  it('should handle DynamoDB write failures and add to batchItemFailures', async () => {
    AWSMock.remock('DynamoDB.DocumentClient', 'batchWrite', (params, callback) => {
      callback(null, {
        UnprocessedItems: {
          [TABLE_NAME]: [
            {
              PutRequest: {
                Item: {
                  siteId: 'site1',
                  version: '1.0',
                  creationTime: 1627889181,
                  creationTimeISO: new Date(),
                  deviceId: 'device1',
                  temperature: { celsius: 25, fahrenheit: 77 },
                  currentTimeStamp: new Date().getTime(),
                  messageId: '1',
                },
              },
            },
          ],
        },
      });
    });

    const event = createSQSEvent([
      {
        messageId: '1',
        body: {
          siteId: 'site1',
          telemetry: {
            version: '1.0',
            creationTime: 1627889181,
            creationTimeISO: new Date(),
            deviceId: 'device1',
            temperature: { celsius: 25, fahrenheit: 77 },
          },
        }
      }
    ]);

    const response: SQSBatchResponse = await handler(event, context, callback) as SQSBatchResponse;
    expect(response.batchItemFailures).toHaveLength(1);
    expect(response.batchItemFailures[0].itemIdentifier).toBe('1');
  });
});
